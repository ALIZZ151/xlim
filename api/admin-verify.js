import { sendJson, verifyAdminToken } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {
      success: false,
      message: 'Method tidak didukung.'
    });
    return;
  }

  const payload = verifyAdminToken(req);

  if (!payload) {
    sendJson(res, 401, {
      success: false,
      message: 'Sesi admin tidak valid.'
    });
    return;
  }

  sendJson(res, 200, {
    success: true,
    admin: {
      role: payload.role,
      exp: payload.exp
    }
  });
}
