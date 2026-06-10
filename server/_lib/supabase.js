'use strict';

const { createClient } = require('@supabase/supabase-js');
const { config } = require('./config');
const { ApiError } = require('./responses');

let adminClient;

function getSupabaseAdmin() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ApiError('Supabase belum dikonfigurasi lengkap di Vercel Env.', 500, 'SUPABASE_NOT_CONFIGURED');
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
  if (error.code === '42P01') return new ApiError(`${fallback} Tabel belum ada di Supabase. Jalankan ulang supabase/schema.sql.`, 500, 'DB_TABLE_MISSING');
  if (error.code === '42703') return new ApiError(`${fallback} Kolom database belum lengkap. Jalankan ulang supabase/schema.sql terbaru.`, 500, 'DB_COLUMN_MISSING');
  if (error.code === 'PGRST204') return new ApiError(`${fallback} Schema cache Supabase belum mengenali kolom terbaru. Reload schema cache atau tunggu beberapa saat.`, 500, 'DB_SCHEMA_CACHE');
  return new ApiError(error.message || fallback, 500, 'DB_ERROR');
}

module.exports = { getSupabaseAdmin, mapDbError };
