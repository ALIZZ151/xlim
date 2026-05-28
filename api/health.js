'use strict';
const { withApi, ok } = require('./_lib/responses');
const { publicConfig, requiredEnvStatus } = require('./_lib/config');
module.exports = withApi(async (req, res) => {
  ok(res, {
    status: 'online',
    name: 'XLIMSTORE Vercel API',
    timestamp: new Date().toISOString(),
    env: requiredEnvStatus(),
    config: publicConfig(),
  });
});
