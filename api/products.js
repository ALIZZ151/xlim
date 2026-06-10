'use strict';

const { withApi, ok, methodNotAllowed } = require('../server/_lib/responses');
const { getSupabaseAdmin } = require('../server/_lib/supabase');
const { publicProduct } = require('../server/_lib/utils');

module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const empty = () => ok(res, { products: [], count: 0, data: [] });

  try {
    const supabase = getSupabaseAdmin();
    let result = await supabase
      .from('products')
      .select('id,slug,name,category,price,price_label,description,features,image_url,status,is_active,sort_order,created_at,updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (result.error) {
      safeLog('warn', 'products_primary_query_failed', result.error);
      result = await supabase
        .from('products')
        .select('*')
        .limit(100);
    }

    if (result.error) {
      safeLog('error', 'products_fallback_query_failed', result.error);
      return empty();
    }

    const products = (result.data || [])
      .filter((row) => row && row.status !== 'inactive' && row.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map(publicProduct);

    return ok(res, { products, count: products.length, data: products });
  } catch (error) {
    safeLog('error', 'products_handler_failed', error);
    return empty();
  }
});

function safeLog(level, event, error) {
  const payload = {
    event,
    code: error?.code,
    name: error?.name,
    message: error?.message ? String(error.message).slice(0, 220) : undefined,
    hint: error?.hint ? String(error.hint).slice(0, 180) : undefined,
  };
  const writer = level === 'error' ? console.error : console.warn;
  writer(`[xlim-api] ${event}`, payload);
}
