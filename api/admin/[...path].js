'use strict';

// Explicit Vercel route wrapper for /api/admin/*.
// Keeps the existing single-router architecture while avoiding admin API 404 on nested routes.
module.exports = require('../[...path].js');
