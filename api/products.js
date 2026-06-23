import { supabaseAdmin } from './_lib/supabase-admin.js';
import { requireAdmin } from './_lib/admin-auth.js';

function cleanProduct(payload) {
  const allowed = ['name', 'category', 'price', 'description', 'features', 'badge', 'icon', 'theme', 'is_popular', 'is_active', 'sort_order'];
  const data = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) data[key] = payload[key];
  }
  if (data.features && !Array.isArray(data.features)) {
    data.features = String(data.features).split('\n').map((item) => item.trim()).filter(Boolean);
  }
  if (data.sort_order !== undefined) data.sort_order = Number(data.sort_order || 0);
  return data;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const isAdmin = req.query.admin === '1';
      let query = supabaseAdmin.from('products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('is_active', true);
      if (isAdmin && !requireAdmin(req, res)) return;
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ products: data || [] });
    }

    const admin = requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'POST') {
      const payload = cleanProduct(req.body || {});
      if (!payload.name || !payload.price) return res.status(400).json({ message: 'Nama produk dan harga wajib diisi.' });
      const { data, error } = await supabaseAdmin.from('products').insert(payload).select('*').single();
      if (error) throw error;
      return res.status(201).json({ product: data });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ message: 'ID produk wajib diisi.' });
      const payload = cleanProduct(req.body || {});
      const { data, error } = await supabaseAdmin.from('products').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return res.status(200).json({ product: data });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ message: 'ID produk wajib diisi.' });
      const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
