import { createAdminToken } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { username, password } = req.body || {};
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return res.status(500).json({ message: 'ADMIN_USERNAME atau ADMIN_PASSWORD belum diset di Vercel.' });
  }

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ message: 'Username atau password salah.' });
  }

  const token = createAdminToken(username);
  return res.status(200).json({ token, username });
}
