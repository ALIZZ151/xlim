'use strict';
const { withApi, ok } = require('./_lib/responses');
const { publicConfig } = require('./_lib/config');
module.exports = withApi(async (req, res) => ok(res, { config: publicConfig() }));
