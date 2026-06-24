function xlimCleanupAccountOrders() {
  const box = document.getElementById('accountOrders');
  if (!box) return;

  const cards = [...box.querySelectorAll('.order-history-card')];
  let removed = 0;

  for (const card of cards) {
    const text = String(card.textContent || '').toLowerCase();

    if (text.includes('hidden_by_admin')) {
      card.remove();
      removed += 1;
    }
  }

  const visibleCards = box.querySelectorAll('.order-history-card');
  const hasLoader = String(box.textContent || '').toLowerCase().includes('memuat riwayat');
  const hasEmpty = box.querySelector('.empty-box');

  if (removed > 0 && visibleCards.length === 0 && !hasLoader && !hasEmpty) {
    box.innerHTML = '<div class="empty-box">Belum ada riwayat pembelian aktif. Klik order produk dulu di halaman utama.</div>';
  }
}

const xlimAccountHistoryObserver = new MutationObserver(xlimCleanupAccountOrders);

document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('accountOrders');
  if (box) {
    xlimAccountHistoryObserver.observe(box, { childList: true, subtree: true });
  }

  xlimCleanupAccountOrders();
});

setInterval(xlimCleanupAccountOrders, 1200);
