'use strict';

const { config } = require('./config');

class ApiError extends Error {
  constructor(message, status = 500, code = 'APP_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
}

function applyCors(req, res) {
  const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '';
  if (!origin || config.allowedOrigins.has(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-Timestamp, X-Request-Nonce, X-Requested-With');
    return true;
  }
  return false;
}

function ensureOrigin(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '';
  if (origin && !config.allowedOrigins.has(origin)) throw new ApiError('Origin tidak diizinkan.', 403, 'BAD_ORIGIN');
}

function ok(res, data = {}, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ success: true, ...data }));
}

function fail(res, error) {
  const status = Number(error.status || 500);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const payload = {
    success: false,
    error: {
      message: status >= 500 && config.isProd ? 'Server lagi ngambek. Coba lagi bentar.' : (error.message || 'Terjadi kesalahan.'),
      code: error.code || 'APP_ERROR',
      status,
    },
  };
  if (!config.isProd && error.stack) payload.error.stack = error.stack;
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allowed = ['GET']) {
  res.setHeader('Allow', allowed.join(', '));
  throw new ApiError('Method tidak diizinkan.', 405, 'METHOD_NOT_ALLOWED');
}

function withApi(handler) {
  return async function apiHandler(req, res) {
    setSecurityHeaders(res);
    const corsOk = applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = corsOk ? 204 : 403;
      return res.end();
    }
    try {
      if (!corsOk) throw new ApiError('Origin tidak diizinkan.', 403, 'BAD_ORIGIN');
      ensureOrigin(req);
      await handler(req, res);
    } catch (error) {
      fail(res, error);
    }
  };
}

module.exports = { ApiError, ok, fail, methodNotAllowed, withApi, setSecurityHeaders, ensureOrigin };
