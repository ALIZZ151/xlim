'use strict';
const { withApi, ok, methodNotAllowed } = require('../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../_lib/supabase');
const { requireAdmin } = require('../_lib/auth');
module.exports = withApi(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  await requireAdmin(req, { requireNonce: false });
  const { data, error } = await getSupabaseAdmin()
    .from('admin_audit_logs')
    .select('id,action,detail,created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw mapDbError(error, 'Gagal mengambil audit log.');
  ok(res, { logs: data || [] });
});
