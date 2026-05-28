'use strict';
const { withApi, ok, methodNotAllowed, ApiError } = require('./_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('./_lib/supabase');
const { readJsonBody, sanitizeText, clientHashes, hmac } = require('./_lib/utils');
const { checkRateLimit, recordRateFailure, resetRateLimit, audit } = require('./_lib/auth');

module.exports = withApi(async (req, res) => {
  if (req.method === 'GET') return getRatings(req, res);
  if (req.method === 'POST') return postRating(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function getRatings(req, res) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ratings')
    .select('id,name,rating,comment,avatar_url,created_at')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw mapDbError(error, 'Gagal mengambil rating.');
  const ratings = data || [];
  const count = ratings.length;
  const average = count ? Number((ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / count).toFixed(1)) : 0;
  ok(res, { ratings, average, count });
}

async function postRating(req, res) {
  const body = await readJsonBody(req);
  const meta = clientHashes(req);
  const key = `rating:${meta.fingerprint}`;
  await checkRateLimit(key, 2, 10 * 60 * 1000, 10 * 60 * 1000);
  const name = sanitizeText(body.name, 40) || 'Pembeli XLIM';
  const rating = Number(body.rating);
  const comment = sanitizeText(body.comment, 280);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError('Rating harus 1 sampai 5.', 400, 'VALIDATION_ERROR');
  if (comment.length < 3) throw new ApiError('Komentar minimal 3 karakter.', 400, 'VALIDATION_ERROR');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('ratings').insert({
    name, rating, comment,
    avatar_url: null,
    ip_hash: meta.ipHash,
    user_agent_hash: meta.userAgentHash,
    is_visible: true,
  }).select('id,name,rating,comment,avatar_url,created_at').single();
  if (error) {
    await recordRateFailure(key, 2, 10 * 60 * 1000);
    throw mapDbError(error, 'Gagal menyimpan rating.');
  }
  await recordRateFailure(key, 2, 10 * 60 * 1000);
  await audit('rating_created', req, { id: data?.id, rating });
  ok(res, { rating: data, message: 'Rating masuk. Makasih sudah mampir!' }, 201);
}
