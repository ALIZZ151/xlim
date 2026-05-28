'use strict';

const crypto = require('crypto');
const { config } = require('./config');
const { ApiError } = require('./responses');
const { getSupabaseAdmin } = require('./supabase');
const {
  base64url, unbase64url, hmac, sha256, safeEqualHex, randomId, readCookie, serializeCookie,
  clientHashes, readJsonBody,
} = require('./utils');

const ADMIN_COOKIE = 'xlim_admin_session';
const SESSION_VERSION = 1;

function verifyPassword(password) {
  if (!config.adminPasswordHash || !config.adminPasswordSalt) return false;
  const hash = crypto.pbkdf2Sync(String(password || ''), config.adminPasswordSalt, 210000, 32, 'sha256').toString('hex');
  return safeEqualHex(hash, config.adminPasswordHash);
}

function signPayload(payload) {
  if (!config.adminSessionSecret) throw new ApiError('ADMIN_SESSION_SECRET belum di-set.', 500, 'AUTH_NOT_CONFIGURED');
  const body = base64url(JSON.stringify(payload));
  const sig = hmac(body, config.adminSessionSecret);
  return `${body}.${sig}`;
}

function unsignPayload(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || hmac(body, config.adminSessionSecret) !== sig) return null;
  try { return JSON.parse(unbase64url(body)); } catch (_) { return null; }
}

function createSession(req) {
  const ttlMs = Math.max(1, config.adminSessionTtlHours) * 60 * 60 * 1000;
  const meta = clientHashes(req);
  const payload = {
    v: SESSION_VERSION,
    sub: 'admin',
    sid: randomId(18),
    csrf: randomId(20),
    ua: meta.userAgentOnly,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  return { token: signPayload(payload), payload, maxAge: Math.floor(ttlMs / 1000) };
}

function setAdminCookie(res, token, maxAge) {
  res.setHeader('Set-Cookie', serializeCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge,
  }));
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(ADMIN_COOKIE, '', { maxAge: 0, httpOnly: true, secure: true, sameSite: 'Lax' }));
}

function getAdminSession(req) {
  if (!config.adminSessionSecret) throw new ApiError('ADMIN_SESSION_SECRET belum di-set.', 500, 'AUTH_NOT_CONFIGURED');
  const token = readCookie(req, ADMIN_COOKIE);
  const session = unsignPayload(token);
  if (!session || session.sub !== 'admin' || session.v !== SESSION_VERSION || !session.exp || session.exp < Date.now()) {
    throw new ApiError('Sesi admin tidak valid. Login dulu.', 401, 'UNAUTHENTICATED');
  }
  const meta = clientHashes(req);
  if (session.ua && session.ua !== meta.userAgentOnly) {
    throw new ApiError('Sesi admin tidak valid. Login ulang.', 401, 'UNAUTHENTICATED');
  }
  return session;
}

async function requireAdmin(req, options = {}) {
  const session = getAdminSession(req);
  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = String(req.headers['x-csrf-token'] || '');
    if (!csrf || csrf !== session.csrf) throw new ApiError('CSRF token tidak valid.', 403, 'BAD_CSRF');
    if (options.requireNonce !== false) await validateNonce(req, session);
  }
  return session;
}

async function validateNonce(req, session) {
  const timestamp = Number(req.headers['x-request-timestamp'] || 0);
  const nonce = String(req.headers['x-request-nonce'] || '');
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    throw new ApiError('Timestamp request tidak valid.', 403, 'BAD_TIMESTAMP');
  }
  if (!/^[a-f0-9-]{12,80}$/i.test(nonce)) throw new ApiError('Nonce request tidak valid.', 403, 'BAD_NONCE');
  const supabase = getSupabaseAdmin();
  const nonceHash = hmac(`${session.sid}|${timestamp}|${nonce}`);
  const { error } = await supabase.from('admin_request_nonces').insert({
    nonce_hash: nonceHash,
    session_id_hash: hmac(session.sid),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) {
    if (error.code === '23505') throw new ApiError('Request sudah pernah dipakai. Refresh lalu coba lagi.', 409, 'REPLAY_BLOCKED');
    throw new ApiError('Gagal validasi nonce.', 500, 'NONCE_DB_ERROR');
  }
}

function requestIntegrityHash(req, bodyHash = '') {
  const timestamp = String(req.headers['x-request-timestamp'] || '');
  const nonce = String(req.headers['x-request-nonce'] || '');
  return hmac([req.method, req.url, timestamp, nonce, bodyHash].join('\n'), config.adminApiHashSecret);
}

async function audit(action, req, detail = {}) {
  try {
    const supabase = getSupabaseAdmin();
    const meta = clientHashes(req);
    await supabase.from('admin_audit_logs').insert({
      action,
      detail: detail || {},
      ip_hash: meta.ipHash,
      user_agent_hash: meta.userAgentHash,
    });
  } catch (_) {}
}

async function checkRateLimit(bucketKey, limit, blockMs, windowMs) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const { data, error } = await supabase.from('security_rate_limits').select('*').eq('key', bucketKey).maybeSingle();
  if (error) throw new ApiError('Rate limit gagal dicek.', 500, 'RATE_LIMIT_DB_ERROR');
  if (data?.blocked_until && new Date(data.blocked_until) > now) {
    throw new ApiError('Terlalu banyak percobaan. Coba lagi beberapa menit.', 429, 'RATE_LIMITED');
  }
  if (data?.updated_at && now - new Date(data.updated_at) > windowMs) {
    await supabase.from('security_rate_limits').upsert({ key: bucketKey, attempts: 0, blocked_until: null, updated_at: now.toISOString() });
  }
}

async function recordRateFailure(bucketKey, limit, blockMs) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const { data } = await supabase.from('security_rate_limits').select('*').eq('key', bucketKey).maybeSingle();
  const attempts = Number(data?.attempts || 0) + 1;
  const blockedUntil = attempts >= limit ? new Date(Date.now() + blockMs).toISOString() : null;
  await supabase.from('security_rate_limits').upsert({
    key: bucketKey,
    attempts,
    blocked_until: blockedUntil,
    updated_at: now.toISOString(),
  });
}

async function resetRateLimit(bucketKey) {
  try {
    await getSupabaseAdmin().from('security_rate_limits').delete().eq('key', bucketKey);
  } catch (_) {}
}

async function parseLoginBody(req) {
  const body = await readJsonBody(req);
  return { adminKey: String(body.adminKey || body.key || ''), password: String(body.password || '') };
}

module.exports = {
  ADMIN_COOKIE,
  verifyPassword,
  createSession,
  setAdminCookie,
  clearAdminCookie,
  getAdminSession,
  requireAdmin,
  requestIntegrityHash,
  audit,
  checkRateLimit,
  recordRateFailure,
  resetRateLimit,
  parseLoginBody,
};
