const USER_TOOLS_TOKEN_KEY = 'xlim_admin_session_v3';

function userToolsToken() {
  return localStorage.getItem(USER_TOOLS_TOKEN_KEY) || '';
}

async function userToolsRequest(payload) {
  const response = await fetch('/api/orders', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToolsToken()}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Aksi gagal.');
  return data;
}

function userToolsId() {
  return document.querySelector('.xlim-customer-card.active')?.dataset?.customerId || '';
}

function userToolsRefresh() {
  document.getElementById('xlimRefreshCustomersBtn')?.click();
}

async function userToolsConfirm(title, text) {
  if (!window.Swal) return confirm(`${title}\n${text}`);
  const result = await Swal.fire({
    icon: 'warning',
    title,
    text,
    background: '#07111f',
    color: '#ffffff',
    showCancelButton: true,
    confirmButtonText: 'Lanjut',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#38bdf8',
    cancelButtonColor: '#334155'
  });
  return result.isConfirmed;
}

async function userToolsRun(action) {
  const userId = userToolsId();
  if (!userId) return;
  const ok = await userToolsConfirm('Konfirmasi aksi akun', 'Aksi ini hanya berlaku untuk akun customer yang sedang dipilih.');
  if (!ok) return;
  await userToolsRequest({ action, user_id: userId });
  userToolsRefresh();
}

function userToolsAddButtons() {
  const profile = document.querySelector('.xlim-customer-profile');
  if (!profile || profile.dataset.toolsReady === 'true') return;
  if (!userToolsId()) return;

  const box = document.createElement('div');
  box.style.display = 'flex';
  box.style.gap = '8px';
  box.style.flexWrap = 'wrap';
  box.innerHTML = `
    <button class="btn-outline-super" data-user-tools-action="suspend_user"><i class="ri-forbid-line"></i> Suspend</button>
    <button class="btn-outline-super" data-user-tools-action="unsuspend_user"><i class="ri-checkbox-circle-line"></i> Buka Suspend</button>
    <button class="btn-danger" data-user-tools-action="deactivate_user"><i class="ri-user-unfollow-line"></i> Nonaktifkan Akses</button>
    <button class="btn-super" data-user-tools-action="activate_user"><i class="ri-user-follow-line"></i> Aktifkan Akses</button>
  `;
  profile.appendChild(box);
  profile.dataset.toolsReady = 'true';
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-user-tools-action]');
  if (!button) return;
  userToolsRun(button.dataset.userToolsAction);
});

setInterval(userToolsAddButtons, 700);
document.addEventListener('DOMContentLoaded', userToolsAddButtons);
