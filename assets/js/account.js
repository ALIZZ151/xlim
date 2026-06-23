import { supabase } from './supabase-client.js';
import { loginWithGoogle, logoutUser } from './main.js';
import { waLink, BRAND_NAME } from './config.js';

function statusBadge(status) {
  const map = {
    pending: 'Menunggu',
    waiting_payment: 'Menunggu Pembayaran',
    processing: 'Diproses',
    active: 'Aktif',
    done: 'Selesai',
    cancelled: 'Dibatalkan'
  };
  const cls = ['done', 'active'].includes(status) ? 'done' : status === 'cancelled' ? 'inactive' : 'pending';
  return `<span class="badge ${cls}">${map[status] || status}</span>`;
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

async function renderAccount() {
  const loginBox = document.getElementById('accountLoginBox');
  const dashboard = document.getElementById('accountDashboard');
  const ordersBox = document.getElementById('accountOrders');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileAvatar = document.getElementById('profileAvatar');

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    loginBox?.classList.remove('hidden');
    dashboard?.classList.add('hidden');
    return;
  }

  loginBox?.classList.add('hidden');
  dashboard?.classList.remove('hidden');

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const avatar = user.user_metadata?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`;
  if (profileName) profileName.textContent = name;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profileAvatar) profileAvatar.src = avatar;

  ordersBox.innerHTML = '<div class="empty-box"><i class="ri-loader-4-line ri-spin"></i><br>Memuat riwayat...</div>';
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    ordersBox.innerHTML = `<div class="empty-box">Gagal memuat riwayat: ${error.message}</div>`;
    return;
  }

  if (!orders.length) {
    ordersBox.innerHTML = '<div class="empty-box">Belum ada riwayat pembelian. Klik order produk dulu di halaman utama.</div>';
    return;
  }

  ordersBox.innerHTML = orders.map((order) => {
    const message = `Halo admin ${BRAND_NAME}, saya mau tanya order saya.\n\nOrder ID: ${order.id}\nProduk: ${order.product_name}\nEmail: ${user.email}`;
    return `
      <article class="ultra-card order-history-card">
        <div>
          <div class="order-head">
            <h3>${order.product_name}</h3>
            ${statusBadge(order.status)}
          </div>
          <p class="order-price">${order.price}</p>
          <div class="order-meta-list">
            <span><i class="ri-time-line"></i>${formatDate(order.created_at)}</span>
            <span><i class="ri-bank-card-line"></i>${order.payment_status || 'unpaid'}</span>
            <span><i class="ri-fingerprint-line"></i>${order.id}</span>
          </div>
          ${order.admin_note ? `<p class="admin-note"><b>Catatan admin:</b> ${order.admin_note}</p>` : ''}
        </div>
        <a href="${waLink(message)}" target="_blank" class="btn-outline-super btn-sm">Chat Admin</a>
      </article>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-login-google]').forEach((btn) => btn.addEventListener('click', loginWithGoogle));
  document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', logoutUser));
  supabase.auth.onAuthStateChange(renderAccount);
  renderAccount();
});
