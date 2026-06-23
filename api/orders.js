import { supabaseAdmin } from './_lib/supabase-admin.js';
import { requireAdmin } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('orders_admin_view')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ orders: data || [] });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ message: 'ID order wajib diisi.' });
      const allowed = ['status', 'payment_status', 'admin_note'];
      const payload = {};
      for (const key of allowed) {
        if (req.body?.[key] !== undefined) payload[key] = req.body[key];
      }
      const { data, error } = await supabaseAdmin.from('orders').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return res.status(200).json({ order: data });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
