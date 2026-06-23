import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 45;

function getSecret() {
  const secret = process.env.ADMIN_TOKEN_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error('ADMIN_TOKEN_SECRET belum aman atau belum diisi.');
  }

  return secret;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64urlJson(data) {
  return base64url(JSON.stringify(data));
}

function unbase64url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function sign(data) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

export function getClientIp(req) {
  const header = req.headers['x-forwarded-for'];
  if (typeof header === 'string' && header.length) return header.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function getDeviceHash(req) {
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 32);
}

export function signAdminToken(req) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: 'xlim-admin',
    role: 'admin',
    device: getDeviceHash(req),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };

  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsigned);

  return {
    token: `${unsigned}.${signature}`,
    expiresAt: payload.exp
  };
}

export function verifyAdminToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsigned);

  if (!safeEqual(signature, expected)) return null;

  let payload;

  try {
    payload = JSON.parse(unbase64url(encodedPayload));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) return null;
  if (payload.role !== 'admin') return null;
  if (payload.device !== getDeviceHash(req)) return null;

  return payload;
}

export function requireAdmin(req, res) {
  const payload = verifyAdminToken(req);

  if (!payload) {
    sendJson(res, 401, {
      success: false,
      message: 'Sesi admin tidak valid.'
    });
    return null;
  }

  return payload;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export function sendJson(res, status, data) {
  setSecurityHeaders(res);
  res.status(status).json(data);
}
