'use strict';
const { withApi, ok, methodNotAllowed, ApiError } = require('../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../_lib/supabase');
const { publicProduct } = require('../_lib/utils');
module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const id = String(req.query.id || '').trim();
  const supabase = getSupabaseAdmin();
  const query = supabase.from('products').select('*').eq('is_active', true);
  const { data, error } = await (isUuid(id) ? query.eq('id', id) : query.eq('slug', id)).maybeSingle();
  if (error) throw mapDbError(error, 'Gagal mengambil produk.');
  if (!data) throw new ApiError('Produk tidak ditemukan.', 404, 'NOT_FOUND');
  ok(res, { product: publicProduct(data), data: publicProduct(data) });
});
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
