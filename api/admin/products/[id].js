'use strict';
const { withApi, ok, methodNotAllowed, ApiError } = require('../../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../../_lib/supabase');
const { requireAdmin, audit, requestIntegrityHash } = require('../../_lib/auth');
const { readJsonBody, productFromBody, publicProduct, sha256 } = require('../../_lib/utils');

module.exports = withApi(async (req, res) => {
  if (req.method === 'GET') return getProduct(req, res);
  if (req.method === 'PATCH' || req.method === 'PUT') return updateProduct(req, res);
  if (req.method === 'DELETE') return deleteProduct(req, res);
  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
});

async function findProduct(id) {
  const query = getSupabaseAdmin().from('products').select('*');
  const { data, error } = await (isUuid(id) ? query.eq('id', id) : query.eq('slug', id)).maybeSingle();
  if (error) throw mapDbError(error, 'Gagal mengambil produk.');
  if (!data) throw new ApiError('Produk tidak ditemukan.', 404, 'NOT_FOUND');
  return data;
}

async function getProduct(req, res) {
  await requireAdmin(req, { requireNonce: false });
  const id = String(req.query.id || '').trim();
  const row = await findProduct(id);
  ok(res, { product: publicProduct(row) });
}

async function updateProduct(req, res) {
  await requireAdmin(req);
  const id = String(req.query.id || '').trim();
  const current = await findProduct(id);
  const body = await readJsonBody(req);
  const payload = productFromBody(body, current);
  const signature = requestIntegrityHash(req, sha256(JSON.stringify(payload)));
  const { data, error } = await getSupabaseAdmin().from('products').update(payload).eq('id', current.id).select('*').single();
  if (error) throw mapDbError(error, 'Gagal mengedit produk.');
  await audit('product_updated', req, { id: data.id, slug: data.slug, signature });
  ok(res, { product: publicProduct(data), message: 'Produk berhasil diupdate.' });
}

async function deleteProduct(req, res) {
  await requireAdmin(req);
  const id = String(req.query.id || '').trim();
  const current = await findProduct(id);
  const signature = requestIntegrityHash(req, sha256(current.id));
  const { data, error } = await getSupabaseAdmin().from('products').update({ is_active: false, status: 'inactive' }).eq('id', current.id).select('*').single();
  if (error) throw mapDbError(error, 'Gagal menghapus produk.');
  await audit('product_deleted', req, { id: current.id, slug: current.slug, softDelete: true, signature });
  ok(res, { product: publicProduct(data), message: 'Produk dihapus dari katalog publik.' });
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
