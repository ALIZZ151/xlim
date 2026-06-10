'use strict';

const { withApi, ok, methodNotAllowed, ApiError } = require('../server/_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../server/_lib/supabase');
const { publicProduct } = require('../server/_lib/utils');

module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const supabase = getSupabaseAdmin();
  let result = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (isSchemaFallback(result.error)) {
    safeLog('warn', 'products_schema_fallback', result.error);
    result = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
  }

  if (result.error) {
    safeLog('error', 'products_query_failed', result.error);
    throw mapDbError(result.error, 'Gagal mengambil produk.');
  }

  const products = (result.data || [])
    .filter((row) => row && row.status !== 'inactive' && row.is_active !== false)
    .map(publicProduct);

  ok(res, { products, count: products.length, data: products });
});

function isSchemaFallback(error) {
  return error && (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .* does not exist/i.test(String(error.message || ''))
  );
}

function safeLog(level, event, error) {
  const payload = {
    event,
    code: error?.code,
    message: error?.message ? String(error.message).slice(0, 180) : undefined,
    hint: error?.hint ? String(error.hint).slice(0, 180) : undefined,
  };
  const writer = level === 'error' ? console.error : console.warn;
  writer(`[xlim-api] ${event}`, payload);
}
