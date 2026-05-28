'use strict';

const crypto = require('crypto');
const { config } = require('./config');
const { ApiError } = require('./responses');

function nowIso() { return new Date().toISOString(); }
function randomId(bytes = 16) { return crypto.randomBytes(bytes).toString('hex'); }
function base64url(input) { return Buffer.from(input).toString('base64url'); }
function unbase64url(input) { return Buffer.from(input, 'base64url').toString('utf8'); }
function hmac(value, secret = config.adminApiHashSecret || config.adminSessionSecret || 'xlim-dev-secret') {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}
function sha256(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch (_) { return false; }
}
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}
function clientUserAgent(req) { return String(req.headers['user-agent'] || 'unknown').slice(0, 240); }
function clientHashes(req) {
  return {
    ipHash: hmac(clientIp(req)),
    userAgentHash: hmac(clientUserAgent(req)),
    fingerprint: hmac(`${clientIp(req)}|${clientUserAgent(req)}`),
    userAgentOnly: hmac(clientUserAgent(req)),
  };
}
function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const cookies = Object.create(null);
  raw.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  });
  return cookies[name] || '';
}
function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false && config.isProd) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Number(options.maxAge)}`);
  return parts.join('; ');
}
function stripControl(value) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim(); }
function sanitizeText(value, max = 200) {
  return stripControl(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, max).trim();
}
function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `produk-${randomId(4)}`;
}
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount || 0));
}
function readJsonBody(req, limitBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') {
      try { return resolve(req.body ? JSON.parse(req.body) : {}); } catch (_) { return reject(new ApiError('Body JSON tidak valid.', 400, 'BAD_JSON')); }
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > limitBytes) {
        req.destroy();
        reject(new ApiError('Body terlalu besar.', 413, 'BODY_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { reject(new ApiError('Body JSON tidak valid.', 400, 'BAD_JSON')); }
    });
    req.on('error', reject);
  });
}
function normalizeFeatures(features) {
  if (Array.isArray(features)) return features.map((x) => sanitizeText(x, 80)).filter(Boolean).slice(0, 12);
  if (typeof features === 'string') return features.split(/\r?\n|,/).map((x) => sanitizeText(x, 80)).filter(Boolean).slice(0, 12);
  return [];
}
function normalizeStatus(status) {
  const value = String(status || 'ready').toLowerCase().trim();
  if (['ready', 'soldout', 'preorder', 'inactive'].includes(value)) return value;
  if (value === 'habis') return 'soldout';
  return 'ready';
}
function productFromBody(body, current = {}) {
  const name = sanitizeText(body.name ?? current.name, 120);
  if (!name) throw new ApiError('Nama produk wajib diisi.', 400, 'VALIDATION_ERROR');
  const price = Number(body.price ?? current.price ?? 0);
  if (!Number.isInteger(price) || price < 0 || price > 1000000000) throw new ApiError('Harga produk tidak valid.', 400, 'VALIDATION_ERROR');
  const slug = slugify(body.slug || current.slug || name);
  return {
    slug,
    name,
    category: sanitizeText(body.category ?? current.category ?? 'Produk Digital', 80),
    price,
    price_label: sanitizeText(body.price_label ?? body.priceLabel ?? current.price_label ?? current.priceLabel ?? '', 120) || null,
    description: sanitizeText(body.description ?? current.description ?? '', 900) || null,
    features: normalizeFeatures(body.features ?? current.features ?? []),
    image_url: sanitizeText(body.image_url ?? body.imageUrl ?? current.image_url ?? current.imageUrl ?? '', 600) || null,
    status: normalizeStatus(body.status ?? current.status),
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : (current.is_active !== undefined ? Boolean(current.is_active) : true),
    sort_order: Number.isInteger(Number(body.sort_order ?? body.sortOrder ?? current.sort_order ?? current.sortOrder ?? 0)) ? Number(body.sort_order ?? body.sortOrder ?? current.sort_order ?? current.sortOrder ?? 0) : 0,
  };
}
function publicProduct(row) {
  const image = row.image_url || '';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category || 'Produk Digital',
    price: Number(row.price || 0),
    priceLabel: row.price_label || formatRupiah(row.price || 0),
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    imageUrl: image,
    image,
    status: row.status || 'ready',
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function buildOrderMessage(product, note = '') {
  return [
    'Halo admin XLIMSTORE, saya mau order:',
    `Produk: ${product.name}`,
    `Harga: ${product.priceLabel || formatRupiah(product.price)}`,
    `Kategori: ${product.category || '-'}`,
    `Link/ID Produk: ${product.slug || product.id}`,
    note ? `Catatan: ${sanitizeText(note, 180)}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  nowIso, randomId, base64url, unbase64url, hmac, sha256, safeEqualHex, clientIp, clientUserAgent,
  clientHashes, readCookie, serializeCookie, sanitizeText, slugify, formatRupiah, readJsonBody,
  normalizeFeatures, normalizeStatus, productFromBody, publicProduct, buildOrderMessage,
};
