import crypto from 'node:crypto';
import { getClientIp, readJson, sendJson, signAdminToken } from './_lib/admin-auth.js';

const attempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_TIME_MS = 1000 * 60 * 8;

function getKey(req) {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex');
}

function getAttempt(key) {
  const now = Date.now();
  const item = attempts.get(key);

  if (!item) {
    return {
      count: 0,
      blockedUntil: 0,
      lastAt: now
    };
  }

  if (item.blockedUntil && item.blockedUntil < now) {
    attempts.delete(key);
    return {
      count: 0,
      blockedUntil: 0,
      lastAt: now
    };
  }

  return item;
}

function failAttempt(key) {
  const now = Date.now();
  const item = getAttempt(key);

  item.count += 1;
  item.lastAt = now;

  if (item.count >= MAX_ATTEMPTS) {
    item.blockedUntil = now + BLOCK_TIME_MS;
  }

  attempts.set(key, item);
  return item;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, {
      success: false,
      message: 'Method tidak didukung.'
    });
    return;
  }

  const key = getKey(req);
  const attempt = getAttempt(key);

  if (attempt.blockedUntil && attempt.blockedUntil > Date.now()) {
    sendJson(res, 429, {
      success: false,
      message: 'Login terlalu sering gagal. Tunggu beberapa menit.'
    });
    return;
  }

  const body = await readJson(req);

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const honeypot = String(body.website || body.company || body._gotcha || '');

  if (honeypot) {
    failAttempt(key);
    sendJson(res, 403, {
      success: false,
      message: 'Login ditolak.'
    });
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  const ok = username === adminUsername && password === adminPassword;

  if (!ok) {
    failAttempt(key);
    sendJson(res, 401, {
      success: false,
      message: 'Username atau password salah.'
    });
    return;
  }

  attempts.delete(key);

  const session = signAdminToken(req);

  sendJson(res, 200, {
    success: true,
    token: session.token,
    expiresAt: session.expiresAt
  });
}
