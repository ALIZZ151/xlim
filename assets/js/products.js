import { supabase } from './supabase-client.js';
import { PENDING_ORDER_KEY, waLink, BRAND_NAME } from './config.js';
import { loginWithGoogle, updateUserUI } from './main.js';

let loadedProducts = [];
const fallbackProducts = [
  {
    id: 'fallback-basic', name: 'Panel Bot Basic', category: 'Starter', price: 'Rp 5.000',
    description: 'Cocok untuk bot WhatsApp, bot Discord kecil, dan script ringan.',
    features: ['Setup cepat', 'Panel siap deploy', 'Support Node.js', 'Cocok untuk pemula'],
    badge: 'Starter', icon: 'ri-robot-2-line', theme: 'ocean', is_popular: false, is_active: true, sort_order: 1
  },
  {
    id: 'fallback-private', name: 'Private Node', category: 'Best Seller', price: 'Rp 15.000',
    description: 'Performa lebih stabil untuk bot aktif, API, backend, dan project yang butuh uptime.',
    features: ['Resource lebih lega', 'Server lebih stabil', 'Cocok untuk bot rame', 'Support aktif'],
    badge: 'Populer', icon: 'ri-vip-crown-fill', theme: 'yellow', is_popular: true, is_active: true, sort_order: 2
  },
  {
    id: 'fallback-vps', name: 'VPS Cloud Custom', category: 'Developer', price: 'Chat Admin',
    description: 'Untuk developer yang butuh akses server penuh, deployment backend, bot, dan tools custom.',
    features: ['Full akses server', 'OS sesuai stok', 'Cocok untuk backend', 'Spek bisa request'],
    badge: 'Custom', icon: 'ri-server-fill', theme: 'cyan', is_popular: false, is_active: true, sort_order: 3
  }
];

function normalizeFeatures(features) {
  if (Array.isArray(features)) return features;
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return features.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function renderProductCard(product) {
  const features = normalizeFeatures(product.features).slice(0, 6);
  const theme = product.theme || 'ocean';
  return `
    <article class="product-card ultra-card theme-${theme}" data-aos="fade-up">
      ${product.is_popular ? '<div class="popular-ribbon">POPULER</div>' : ''}
      <div class="product-top">
        <div>
          <span class="product-label">${product.category || product.badge || 'Produk'}</span>
          <h3 class="product-title">${product.name}</h3>
        </div>
        <div class="product-icon"><i class="${product.icon || 'ri-server-fill'}"></i></div>
      </div>
      <p class="product-desc">${product.description || 'Produk digital xlim store.'}</p>
      <div class="price">${product.price || 'Chat Admin'}<small>/mulai</small></div>
      <ul class="product-list">
        ${features.map((feature) => `<li><i class="ri-check-line"></i>${feature}</li>`).join('')}
      </ul>
      <button class="btn-super btn-block" data-order-product="${product.id}">
        Order Sekarang <i class="ri-arrow-right-line"></i>
      </button>
    </article>
  `;
}

export async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="empty-box"><i class="ri-loader-4-line ri-spin"></i><br>Memuat produk dari database...</div>';

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    loadedProducts = data?.length ? data : fallbackProducts;
  } catch (error) {
    console.warn('Gagal load products, pakai fallback:', error.message);
    loadedProducts = fallbackProducts;
  }

  if (!loadedProducts.length) {
    grid.innerHTML = '<div class="empty-box">Belum ada produk aktif. Tambahkan produk lewat halaman admin.</div>';
    return;
  }

  grid.innerHTML = loadedProducts.map(renderProductCard).join('');
  bindOrderButtons();
  if (window.AOS) setTimeout(() => AOS.refresh(), 50);
}

function bindOrderButtons() {
  document.querySelectorAll('[data-order-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = loadedProducts.find((item) => String(item.id) === String(button.dataset.orderProduct));
      if (product) startOrder(product);
    });
  });
}

async function startOrder(product) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(product));
    await Swal.fire({
      title: 'Login Dulu',
      text: 'Untuk order produk, kamu perlu login Google supaya riwayat pembelian masuk ke akun kamu.',
      icon: 'info',
      background: '#07111f',
      color: '#ffffff',
      confirmButtonText: '<i class="fab fa-google"></i> Login Google',
      confirmButtonColor: '#0ea5e9',
      customClass: { popup: 'rounded-2xl' }
    });
    return loginWithGoogle();
  }

  await createOrder(product, user);
}

async function createOrder(product, user) {
  const payload = {
    user_id: user.id,
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    product_snapshot: product,
    status: 'pending',
    payment_status: 'unpaid',
    customer_note: ''
  };

  Swal.fire({ title: 'Membuat Order...', background: '#07111f', color: '#fff', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const { data, error } = await supabase.from('orders').insert(payload).select('*').single();
  if (error) {
    Swal.fire({ icon: 'error', title: 'Order Gagal', text: error.message, background: '#07111f', color: '#fff' });
    return;
  }

  const message = `Halo admin ${BRAND_NAME}, saya sudah membuat order.\n\nOrder ID: ${data.id}\nProduk: ${data.product_name}\nHarga: ${data.price}\nEmail akun: ${user.email}\n\nTolong info pembayaran dan prosesnya.`;

  Swal.fire({
    title: 'Order Berhasil Dibuat',
    html: `
      <div class="text-left" style="background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.12);border-radius:16px;padding:16px">
        <b style="color:white">${data.product_name}</b><br>
        <span style="color:#38bdf8;font-family:monospace">${data.price}</span><br><br>
        <small style="color:#94a3b8">Order ID: ${data.id}</small>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:14px">Order sudah tersimpan di akun kamu. Lanjut chat admin untuk pembayaran.</p>
    `,
    background: '#07111f',
    color: '#ffffff',
    showCancelButton: true,
    confirmButtonText: '<i class="fab fa-whatsapp"></i> Chat Admin',
    cancelButtonText: 'Lihat Riwayat',
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#0ea5e9'
  }).then((result) => {
    if (result.isConfirmed) window.open(waLink(message), '_blank');
    else window.location.href = '/account/';
  });
}

export async function handlePendingOrder() {
  const raw = localStorage.getItem(PENDING_ORDER_KEY);
  if (!raw) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return;

  localStorage.removeItem(PENDING_ORDER_KEY);
  try {
    const product = JSON.parse(raw);
    await updateUserUI();
    await createOrder(product, data.session.user);
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await handlePendingOrder();
});
