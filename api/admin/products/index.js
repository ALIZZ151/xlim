'use strict';
const { withApi, ok, methodNotAllowed } = require('../../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../../_lib/supabase');
const { requireAdmin, audit, requestIntegrityHash } = require('../../_lib/auth');
const { readJsonBody, productFromBody, publicProduct, sha256 } = require('../../_lib/utils');

module.exports = withApi(async (req, res) => {
  if (req.method === 'GET') return listProducts(req, res);
  if (req.method === 'POST') return createProduct(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function listProducts(req, res) {
  await requireAdmin(req, { requireNonce: false });
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error, 'Gagal mengambil produk admin.');
  const products = (data || []).map(publicProduct);
  ok(res, { products, count: products.length });
}

async function createProduct(req, res) {
  await requireAdmin(req);
  const body = await readJsonBody(req);
  const payload = productFromBody(body);
  const signature = requestIntegrityHash(req, sha256(JSON.stringify(payload)));
  const { data, error } = await getSupabaseAdmin().from('products').insert(payload).select('*').single();
  if (error) throw mapDbError(error, 'Gagal menambah produk.');
  await audit('product_created', req, { id: data.id, slug: data.slug, signature });
  ok(res, { product: publicProduct(data), message: 'Produk berhasil ditambahkan.' }, 201);
}
