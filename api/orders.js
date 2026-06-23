import { getSupabaseAdmin } from './_lib/supabase-admin.js';
import { readJson, requireAdmin, sendJson } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  try {
    if (!requireAdmin(req, res)) return;

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      sendJson(res, 200, {
        success: true,
        orders: data || []
      });
      return;
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const id = String(body.id || '').trim();

      if (!id) {
        sendJson(res, 400, {
          success: false,
          message: 'ID order kosong.'
        });
        return;
      }

      const payload = {};

      if (body.status !== undefined) payload.status = String(body.status);
      if (body.payment_status !== undefined) payload.payment_status = String(body.payment_status);
      if (body.admin_note !== undefined) payload.admin_note = String(body.admin_note);

      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      sendJson(res, 200, {
        success: true,
        order: data
      });
      return;
    }

    sendJson(res, 405, {
      success: false,
      message: 'Method tidak didukung.'
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      message: error.message || 'Server error.'
    });
  }
}
