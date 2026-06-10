'use strict';

const { withApi, ok, methodNotAllowed, ApiError } = require('../server/_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../server/_lib/supabase');
const { readJsonBody, sanitizeText, clientHashes } = require('../server/_lib/utils');
const { audit, checkRateLimit, recordRateFailure } = require('../server/_lib/auth');

module.exports = withApi(async (req, res) => {
  if (req.method === 'GET') return getRatings(res);
  if (req.method === 'POST') return postRating(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function getRatings(res) {
  const supabase = getSupabaseAdmin();
  let result = await supabase
    .from('ratings')
    .select('id,name,rating,comment,avatar_url,created_at,is_visible')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(40);

  if (isSchemaFallback(result.error)) {
    safeLog('warn', 'ratings_schema_fallback', result.error);
    result = await supabase
      .from('ratings')
      .select('id,name,rating,comment,avatar_url,created_at')
      .order('created_at', { ascending: false })
      .limit(40);
  }

  if (result.error) {
    safeLog('error', 'ratings_query_failed', result.error);
    throw mapDbError(result.error, 'Gagal mengambil rating.');
  }

  const ratings = (result.data || [])
    .filter((row) => row && row.is_visible !== false)
    .map(({ is_visible, ...rating }) => rating);
  const count = ratings.length;
  const average = count ? Number((ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / count).toFixed(1)) : 0;
  ok(res, { ratings, average, count, data: ratings });
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

  const { data, error } = await getSupabaseAdmin().from('ratings').insert({
    name,
    rating,
    comment,
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
