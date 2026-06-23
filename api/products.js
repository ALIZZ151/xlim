import { getSupabaseAdmin } from './_lib/supabase-admin.js';
import { readJson, requireAdmin, sendJson } from './_lib/admin-auth.js';

function cleanProduct(body) {
  return {
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim(),
    price: String(body.price || '').trim(),
    description: String(body.description || '').trim(),
    features: Array.isArray(body.features) ? body.features : [],
    badge: String(body.badge || '').trim(),
    icon: String(body.icon || 'ri-server-fill').trim(),
    theme: String(body.theme || 'ocean').trim(),
    is_popular: Boolean(body.is_popular),
    is_active: Boolean(body.is_active),
    sort_order: Number(body.sort_order || 1)
  };
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      const isAdmin = req.query?.admin === '1';

      if (isAdmin && !requireAdmin(req, res)) return;

      let query = supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      sendJson(res, 200, {
        success: true,
        products: data || []
      });
      return;
    }

    if (!requireAdmin(req, res)) return;

    if (req.method === 'POST') {
      const body = await readJson(req);
      const payload = cleanProduct(body);

      if (!payload.name || !payload.category || !payload.price) {
        sendJson(res, 400, {
          success: false,
          message: 'Nama, kategori, dan harga wajib diisi.'
        });
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      sendJson(res, 200, {
        success: true,
        product: data
      });
      return;
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const id = String(body.id || '').trim();

      if (!id) {
        sendJson(res, 400, {
          success: false,
          message: 'ID produk kosong.'
        });
        return;
      }

      const allowed = [
        'name',
        'category',
        'price',
        'description',
        'features',
        'badge',
        'icon',
        'theme',
        'is_popular',
        'is_active',
        'sort_order'
      ];

      const payload = {};

      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          payload[key] = body[key];
        }
      });

      if (payload.sort_order !== undefined) payload.sort_order = Number(payload.sort_order || 1);
      if (payload.is_active !== undefined) payload.is_active = Boolean(payload.is_active);
      if (payload.is_popular !== undefined) payload.is_popular = Boolean(payload.is_popular);
      if (payload.features !== undefined && !Array.isArray(payload.features)) payload.features = [];

      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      sendJson(res, 200, {
        success: true,
        product: data
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || '').trim();

      if (!id) {
        sendJson(res, 400, {
          success: false,
          message: 'ID produk kosong.'
        });
        return;
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      sendJson(res, 200, {
        success: true
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
