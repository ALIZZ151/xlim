const XLIM_ADMIN_TOKEN_KEY = 'xlim_admin_session_v3';
let xlimCustomerCache = [];
let xlimSelectedCustomerId = '';
let xlimCustomerPanelReady = false;

function xlimAdminToken() {
  return localStorage.getItem(XLIM_ADMIN_TOKEN_KEY) || '';
}

function xlimEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function xlimDate(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function xlimMoney(value) {
  if (value === null || value === undefined || value === '') return 'Chat Admin';
  const raw = String(value);
  if (raw.toLowerCase().includes('rp')) return raw;
  const number = Number(raw.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(number) || number <= 0) return raw;
  return `Rp ${number.toLocaleString('id-ID')}`;
}

function xlimOrderStatusLabel(status = '') {
  const labels = {
    pending: 'Menunggu',
    waiting_payment: 'Menunggu Pembayaran',
    processing: 'Diproses',
    active: 'Aktif',
    done: 'Selesai',
    cancelled: 'Dibatalkan',
    hidden_by_admin: 'Disembunyikan'
  };

  return labels[status] || status || 'pending';
}

function xlimOrderBadgeClass(status = '') {
  if (['done', 'active'].includes(status)) return 'done';
  if (['cancelled', 'hidden_by_admin'].includes(status)) return 'inactive';
  return 'pending';
}

async function xlimCustomerFetch(url, options = {}) {
  const token = xlimAdminToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request gagal.');
  }

  return data;
}

function xlimInjectCustomerStyle() {
  if (document.getElementById('xlim-admin-customer-style')) return;

  const style = document.createElement('style');
  style.id = 'xlim-admin-customer-style';
  style.textContent = `
    .xlim-customer-shell {
      display: grid;
      gap: 18px;
    }

    .xlim-customer-tools {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px;
      margin-top: 14px;
    }

    .xlim-customer-search {
      min-height: 52px;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.58);
      color: #fff;
      padding: 0 16px;
      font-weight: 800;
      outline: none;
    }

    .xlim-customer-search:focus {
      border-color: rgba(56,189,248,.45);
      box-shadow: 0 0 0 4px rgba(56,189,248,.08);
    }

    .xlim-customer-layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 16px;
    }

    .xlim-customer-list,
    .xlim-customer-orders {
      border-radius: 28px;
      border: 1px solid rgba(148,163,184,.14);
      background: linear-gradient(160deg, rgba(15,23,42,.82), rgba(2,6,23,.62));
      box-shadow: 0 24px 70px rgba(0,0,0,.30);
      padding: 14px;
      min-height: 460px;
    }

    .xlim-customer-list {
      display: grid;
      gap: 10px;
      align-content: start;
      max-height: 660px;
      overflow-y: auto;
    }

    .xlim-customer-card {
      border: 1px solid rgba(148,163,184,.12);
      background: rgba(15,23,42,.58);
      color: #fff;
      border-radius: 22px;
      padding: 14px;
      display: flex;
      gap: 12px;
      align-items: center;
      text-align: left;
      transition: .22s ease;
      width: 100%;
    }

    .xlim-customer-card:hover,
    .xlim-customer-card.active {
      border-color: rgba(56,189,248,.36);
      background: rgba(56,189,248,.10);
      transform: translateY(-1px);
    }

    .xlim-customer-card img,
    .xlim-customer-profile img {
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(56,189,248,.25);
    }

    .xlim-customer-card img {
      width: 52px;
      height: 52px;
    }

    .xlim-customer-card strong {
      display: block;
      font-family: var(--font-display, Outfit, sans-serif);
      font-size: 16px;
      line-height: 1.15;
    }

    .xlim-customer-card span {
      display: block;
      margin-top: 4px;
      color: #94a3b8;
      font-size: 12px;
      word-break: break-all;
    }

    .xlim-customer-card small {
      display: inline-flex;
      margin-top: 8px;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(56,189,248,.12);
      color: #7dd3fc;
      font-size: 10px;
      font-weight: 900;
    }

    .xlim-customer-profile {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 8px 8px 16px;
      border-bottom: 1px solid rgba(148,163,184,.12);
      margin-bottom: 14px;
    }

    .xlim-customer-profile-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .xlim-customer-profile img {
      width: 60px;
      height: 60px;
    }

    .xlim-customer-profile strong {
      display: block;
      font-size: 19px;
      color: #fff;
      font-family: var(--font-display, Outfit, sans-serif);
    }

    .xlim-customer-profile span {
      display: block;
      color: #94a3b8;
      font-size: 12px;
      margin-top: 4px;
      word-break: break-all;
    }

    .xlim-admin-order-list {
      display: grid;
      gap: 12px;
    }

    .xlim-admin-order-item {
      border-radius: 22px;
      border: 1px solid rgba(148,163,184,.12);
      background: radial-gradient(circle at top right, rgba(56,189,248,.10), transparent 34%), rgba(15,23,42,.52);
      padding: 16px;
    }

    .xlim-admin-order-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .xlim-admin-order-top strong {
      display: block;
      color: #fff;
      font-size: 17px;
      font-family: var(--font-display, Outfit, sans-serif);
    }

    .xlim-admin-order-price {
      margin-top: 5px;
      color: #38bdf8;
      font-weight: 900;
      font-family: var(--font-mono, monospace);
    }

    .xlim-admin-order-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: #94a3b8;
      font-size: 12px;
      margin-top: 10px;
    }

    .xlim-admin-order-id {
      margin-top: 10px;
      color: #64748b;
      font-size: 10px;
      word-break: break-all;
      font-family: var(--font-mono, monospace);
    }

    .xlim-admin-order-note {
      margin-top: 10px;
      border-radius: 14px;
      background: rgba(255,255,255,.05);
      color: #cbd5e1;
      padding: 10px;
      font-size: 12px;
    }

    .xlim-admin-order-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .xlim-empty-state {
      min-height: 220px;
      display: grid;
      place-items: center;
      text-align: center;
      color: #94a3b8;
      padding: 24px;
    }

    .xlim-empty-state i {
      font-size: 42px;
      color: #38bdf8;
      margin-bottom: 12px;
    }

    .xlim-empty-state strong {
      display: block;
      color: #fff;
      font-size: 20px;
      margin-bottom: 8px;
    }

    @media (max-width: 1024px) {
      .xlim-customer-layout {
        grid-template-columns: 1fr;
      }
      .xlim-customer-list {
        max-height: 360px;
      }
    }

    @media (max-width: 620px) {
      .xlim-customer-tools {
        grid-template-columns: 1fr;
      }
      .xlim-customer-profile {
        flex-direction: column;
        align-items: stretch;
      }
      .xlim-admin-order-top {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

function xlimSetCustomerNavActive() {
  document.querySelectorAll('.side-link').forEach((button) => button.classList.remove('active'));
  document.getElementById('xlimCustomerNavBtn')?.classList.add('active');
}

function xlimEnsureCustomerNav() {
  const nav = document.querySelector('.side-nav');
  if (!nav || document.getElementById('xlimCustomerNavBtn')) return;

  const button = document.createElement('button');
  button.id = 'xlimCustomerNavBtn';
  button.type = 'button';
  button.className = 'side-link';
  button.innerHTML = '<i class="ri-user-search-line"></i> Customer';
  button.addEventListener('click', () => xlimRenderCustomerPanel());
  nav.appendChild(button);
}

function xlimSelectedCustomer() {
  return xlimCustomerCache.find((user) => user.id === xlimSelectedCustomerId) || null;
}

function xlimPanelMain() {
  return document.getElementById('panelMain') || document.querySelector('.panel-main');
}

function xlimCustomerPanelMarkup() {
  return `
    <div class="xlim-customer-shell">
      <div class="panel-header">
        <div>
          <h2>Customer History</h2>
          <p>Cari akun Google pembeli, lihat profil, email, dan sembunyikan riwayat order yang tidak jadi.</p>
        </div>
        <div class="admin-actions">
          <button class="btn-super" id="xlimRefreshCustomersBtn"><i class="ri-refresh-line"></i> Refresh</button>
        </div>
      </div>

      <div class="admin-card">
        <div class="xlim-customer-tools">
          <input class="xlim-customer-search" id="xlimCustomerSearch" placeholder="Cari nama atau email customer..." autocomplete="off">
          <button class="btn-super" id="xlimSearchCustomersBtn"><i class="ri-search-line"></i> Cari</button>
          <button class="btn-outline-super" id="xlimResetCustomersBtn"><i class="ri-close-circle-line"></i> Reset</button>
        </div>
      </div>

      <div class="xlim-customer-layout">
        <div class="xlim-customer-list" id="xlimCustomerList"></div>
        <div class="xlim-customer-orders" id="xlimCustomerOrders"></div>
      </div>
    </div>
  `;
}

async function xlimLoadCustomers(query = '') {
  const list = document.getElementById('xlimCustomerList');
  const orders = document.getElementById('xlimCustomerOrders');

  if (list) {
    list.innerHTML = '<div class="xlim-empty-state"><div><i class="ri-loader-4-line"></i><strong>Memuat customer...</strong><p>Data akun Google sedang diambil.</p></div></div>';
  }

  if (orders) {
    orders.innerHTML = '<div class="xlim-empty-state"><div><i class="ri-user-search-line"></i><strong>Pilih customer</strong><p>Klik salah satu akun untuk melihat riwayat pembeliannya.</p></div></div>';
  }

  try {
    const params = new URLSearchParams({ mode: 'customers' });
    if (query) params.set('q', query);

    const data = await xlimCustomerFetch(`/api/orders?${params.toString()}`);
    xlimCustomerCache = data.users || [];
    xlimSelectedCustomerId = '';
    xlimRenderCustomerList();
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="xlim-empty-state"><div><i class="ri-error-warning-line"></i><strong>Gagal memuat</strong><p>${xlimEscape(error.message)}</p></div></div>`;
    }
  }
}

function xlimRenderCustomerList() {
  const list = document.getElementById('xlimCustomerList');
  if (!list) return;

  if (!xlimCustomerCache.length) {
    list.innerHTML = '<div class="xlim-empty-state"><div><i class="ri-search-eye-line"></i><strong>Customer tidak ditemukan</strong><p>Coba cari dengan email atau nama lain.</p></div></div>';
    return;
  }

  list.innerHTML = xlimCustomerCache.map((user) => `
    <button class="xlim-customer-card ${user.id === xlimSelectedCustomerId ? 'active' : ''}" data-customer-id="${xlimEscape(user.id)}">
      <img src="${xlimEscape(user.avatar_url)}" alt="${xlimEscape(user.name)}">
      <div>
        <strong>${xlimEscape(user.name)}</strong>
        <span>${xlimEscape(user.email || '-')}</span>
        <small>${Number(user.order_count || 0)} order aktif${Number(user.hidden_order_count || 0) ? ` • ${Number(user.hidden_order_count)} tersembunyi` : ''}</small>
      </div>
    </button>
  `).join('');

  list.querySelectorAll('[data-customer-id]').forEach((button) => {
    button.addEventListener('click', () => {
      xlimSelectedCustomerId = button.dataset.customerId;
      xlimRenderCustomerList();
      xlimRenderCustomerOrders();
    });
  });
}

function xlimRenderCustomerOrders() {
  const box = document.getElementById('xlimCustomerOrders');
  const user = xlimSelectedCustomer();

  if (!box) return;

  if (!user) {
    box.innerHTML = '<div class="xlim-empty-state"><div><i class="ri-user-search-line"></i><strong>Pilih customer</strong><p>Klik salah satu akun untuk melihat riwayat pembeliannya.</p></div></div>';
    return;
  }

  const orders = user.orders || [];

  box.innerHTML = `
    <div class="xlim-customer-profile">
      <div class="xlim-customer-profile-main">
        <img src="${xlimEscape(user.avatar_url)}" alt="${xlimEscape(user.name)}">
        <div>
          <strong>${xlimEscape(user.name)}</strong>
          <span>${xlimEscape(user.email || '-')}</span>
          <span>${xlimEscape(user.id)}</span>
        </div>
      </div>
      <button class="btn-danger" id="xlimHideAllOrdersBtn" ${orders.some((order) => order.status !== 'hidden_by_admin') ? '' : 'disabled'}>
        <i class="ri-eye-off-line"></i> Sembunyikan Semua
      </button>
    </div>

    <div class="xlim-admin-order-list">
      ${orders.length ? orders.map(xlimOrderCard).join('') : '<div class="xlim-empty-state"><div><i class="ri-inbox-line"></i><strong>Belum ada riwayat</strong><p>User ini belum punya order.</p></div></div>'}
    </div>
  `;

  document.getElementById('xlimHideAllOrdersBtn')?.addEventListener('click', () => xlimSetOrderHidden({ userId: user.id }));
  box.querySelectorAll('[data-hide-order]').forEach((button) => button.addEventListener('click', () => xlimSetOrderHidden({ orderId: button.dataset.hideOrder })));
  box.querySelectorAll('[data-restore-order]').forEach((button) => button.addEventListener('click', () => xlimRestoreOrder(button.dataset.restoreOrder)));
}

function xlimOrderCard(order) {
  const isHidden = order.status === 'hidden_by_admin';

  return `
    <article class="xlim-admin-order-item">
      <div class="xlim-admin-order-top">
        <div>
          <strong>${xlimEscape(order.product_name)}</strong>
          <div class="xlim-admin-order-price">${xlimEscape(xlimMoney(order.price))}</div>
        </div>
        <span class="badge ${xlimOrderBadgeClass(order.status)}">${xlimEscape(xlimOrderStatusLabel(order.status))}</span>
      </div>
      <div class="xlim-admin-order-meta">
        <span><i class="ri-calendar-line"></i> ${xlimEscape(xlimDate(order.created_at))}</span>
        <span><i class="ri-bank-card-line"></i> ${xlimEscape(order.payment_status || 'unpaid')}</span>
      </div>
      <div class="xlim-admin-order-id">Order ID: ${xlimEscape(order.id)}</div>
      ${order.admin_note ? `<div class="xlim-admin-order-note">Catatan admin: ${xlimEscape(order.admin_note)}</div>` : ''}
      <div class="xlim-admin-order-actions">
        ${isHidden ? `
          <button class="btn-super" data-restore-order="${xlimEscape(order.id)}"><i class="ri-arrow-go-back-line"></i> Restore</button>
        ` : `
          <button class="btn-danger" data-hide-order="${xlimEscape(order.id)}"><i class="ri-eye-off-line"></i> Sembunyikan Riwayat</button>
        `}
      </div>
    </article>
  `;
}

async function xlimAsk(title, text, confirmText = 'Lanjut') {
  if (!window.Swal) return window.confirm(`${title}\n${text}`);

  const result = await Swal.fire({
    icon: 'warning',
    title,
    text,
    background: '#07111f',
    color: '#ffffff',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Batal',
    confirmButtonColor: '#38bdf8',
    cancelButtonColor: '#334155'
  });

  return result.isConfirmed;
}

async function xlimSetOrderHidden({ orderId = '', userId = '' }) {
  const ok = await xlimAsk('Sembunyikan riwayat?', 'Riwayat tidak tampil lagi di akun customer, tapi jejaknya tetap aman di database.', 'Ya, Sembunyikan');
  if (!ok) return;

  await xlimCustomerFetch('/api/orders', {
    method: 'PATCH',
    body: JSON.stringify({
      order_id: orderId,
      user_id: userId,
      mode: 'hide'
    })
  });

  await xlimReloadAfterAction();
}

async function xlimRestoreOrder(orderId) {
  const ok = await xlimAsk('Restore riwayat?', 'Riwayat ini akan tampil lagi di akun customer.', 'Ya, Restore');
  if (!ok) return;

  await xlimCustomerFetch('/api/orders', {
    method: 'PATCH',
    body: JSON.stringify({
      order_id: orderId,
      mode: 'restore'
    })
  });

  await xlimReloadAfterAction();
}

async function xlimReloadAfterAction() {
  const selected = xlimSelectedCustomerId;
  const query = document.getElementById('xlimCustomerSearch')?.value || '';
  await xlimLoadCustomers(query);
  xlimSelectedCustomerId = selected;
  xlimRenderCustomerList();
  xlimRenderCustomerOrders();

  if (window.Swal) {
    Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      background: '#07111f',
      color: '#ffffff',
      timer: 1200,
      showConfirmButton: false
    });
  }
}

function xlimBindCustomerPanel() {
  document.getElementById('xlimRefreshCustomersBtn')?.addEventListener('click', () => xlimLoadCustomers(document.getElementById('xlimCustomerSearch')?.value || ''));
  document.getElementById('xlimSearchCustomersBtn')?.addEventListener('click', () => xlimLoadCustomers(document.getElementById('xlimCustomerSearch')?.value || ''));
  document.getElementById('xlimResetCustomersBtn')?.addEventListener('click', () => {
    const input = document.getElementById('xlimCustomerSearch');
    if (input) input.value = '';
    xlimLoadCustomers('');
  });
  document.getElementById('xlimCustomerSearch')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') xlimLoadCustomers(event.target.value || '');
  });
}

function xlimRenderCustomerPanel() {
  xlimInjectCustomerStyle();
  xlimSetCustomerNavActive();
  const main = xlimPanelMain();
  if (!main) return;

  main.innerHTML = xlimCustomerPanelMarkup();
  xlimBindCustomerPanel();
  xlimLoadCustomers('');
}

function xlimBootCustomerPanel() {
  const hasDashboard = Boolean(document.querySelector('.panel-layout') && document.querySelector('.side-nav'));
  if (!hasDashboard) {
    xlimCustomerPanelReady = false;
    return;
  }

  xlimEnsureCustomerNav();
  xlimCustomerPanelReady = true;
}

const xlimCustomerObserver = new MutationObserver(() => xlimBootCustomerPanel());
xlimCustomerObserver.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', xlimBootCustomerPanel);
setInterval(() => {
  if (!xlimCustomerPanelReady || !document.getElementById('xlimCustomerNavBtn')) xlimBootCustomerPanel();
}, 1000);
