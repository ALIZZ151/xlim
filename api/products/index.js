'use strict';
const { withApi, ok, methodNotAllowed } = require('../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../_lib/supabase');
const { publicProduct } = require('../_lib/utils');
module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error, 'Gagal mengambil produk.');
  const products = (data || []).map(publicProduct);
  ok(res, { products, count: products.length, data: products });
});
