'use strict';
const { withApi, ok, methodNotAllowed, ApiError } = require('../_lib/responses');
const { config, requiredEnvStatus } = require('../_lib/config');
const { clientHashes } = require('../_lib/utils');
const { verifyPassword, createSession, setAdminCookie, parseLoginBody, audit, checkRateLimit, recordRateFailure, resetRateLimit } = require('../_lib/auth');

module.exports = withApi(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const env = requiredEnvStatus();
  if (!env.adminKey || !env.adminPasswordHash || !env.adminPasswordSalt || !env.adminSessionSecret || !env.adminApiHashSecret) {
    throw new ApiError('Admin belum dikonfigurasi. Isi ADMIN_KEY, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD_SALT, ADMIN_SESSION_SECRET, dan ADMIN_API_HASH_SECRET.', 500, 'ADMIN_NOT_CONFIGURED');
  }
  const body = await parseLoginBody(req);
  const meta = clientHashes(req);
  const rateKey = `admin_login:${meta.fingerprint}:${body.adminKey ? meta.userAgentOnly : 'blank'}`;
  await checkRateLimit(rateKey, 3, 4 * 60 * 1000, 4 * 60 * 1000);
  const keyOk = body.adminKey && body.adminKey === config.adminKey;
  const passwordOk = verifyPassword(body.password);
  if (!keyOk || !passwordOk) {
    await recordRateFailure(rateKey, 3, 4 * 60 * 1000);
    await audit('admin_login_failed', req, { keyProvided: Boolean(body.adminKey) });
    throw new ApiError('Login gagal. Cek key dan password.', 401, 'LOGIN_FAILED');
  }
  await resetRateLimit(rateKey);
  const session = createSession(req);
  setAdminCookie(res, session.token, session.maxAge);
  await audit('admin_login_success', req, { sidHash: meta.userAgentOnly });
  ok(res, {
    authenticated: true,
    csrfToken: session.payload.csrf,
    sessionExpiresAt: new Date(session.payload.exp).toISOString(),
  });
});
