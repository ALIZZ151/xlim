'use strict';

const { createClient } = require('@supabase/supabase-js');
const { config } = require('./config');
const { ApiError } = require('./responses');

let adminClient;

function getSupabaseAdmin() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ApiError('Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel Env.', 500, 'SUPABASE_NOT_CONFIGURED');
  }
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'xlimstore-vercel-api' } },
    });
  }
  return adminClient;
}

function mapDbError(error, fallback = 'Database error.') {
  if (!error) return null;
  if (error.code === '23505') return new ApiError('Slug produk sudah dipakai. Coba nama/slug lain.', 409, 'DUPLICATE');
  return new ApiError(error.message || fallback, 500, 'DB_ERROR');
}

module.exports = { getSupabaseAdmin, mapDbError };
