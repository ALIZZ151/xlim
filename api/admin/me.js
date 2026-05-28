'use strict';
const { withApi, ok, methodNotAllowed } = require('../_lib/responses');
const { requiredEnvStatus, publicConfig } = require('../_lib/config');
const { requireAdmin } = require('../_lib/auth');
module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireAdmin(req, { requireNonce: false });
    ok(res, {
      authenticated: true,
      csrfToken: session.csrf,
      sessionExpiresAt: new Date(session.exp).toISOString(),
      env: requiredEnvStatus(),
      config: publicConfig(),
    });
  } catch (_) {
    ok(res, { authenticated: false, env: requiredEnvStatus(), config: publicConfig() });
  }
});
