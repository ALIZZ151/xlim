'use strict';
const { withApi, ok, methodNotAllowed } = require('../_lib/responses');
const { clearAdminCookie, requireAdmin, audit } = require('../_lib/auth');
module.exports = withApi(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { await requireAdmin(req, { requireNonce: false }); } catch (_) {}
  clearAdminCookie(res);
  await audit('admin_logout', req, {});
  ok(res, { authenticated: false, message: 'Logout berhasil.' });
});
