import crypto from 'crypto';

function getSecret() {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret || secret.length < 24) throw new Error('ADMIN_TOKEN_SECRET belum diset atau terlalu pendek.');
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createAdminToken(username) {
  const payload = base64url(JSON.stringify({ username, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyAdminToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('Unauthorized: token kosong.');
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('Unauthorized: token tidak valid.');
  const expected = sign(payload);
  const ok = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) throw new Error('Unauthorized: signature salah.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!decoded.exp || decoded.exp < Date.now()) throw new Error('Unauthorized: token expired.');
  return decoded;
}

export function requireAdmin(req, res) {
  try {
    return verifyAdminToken(req);
  } catch (error) {
    res.status(401).json({ message: error.message });
    return null;
  }
}
