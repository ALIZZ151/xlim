import { supabase } from './supabase-client.js';

const WELCOME_KEY = 'xlim_welcome_closed_session';

let currentUser = null;

let ratingState = {
  selectedStars: 5,
  ratings: [],
  draftExperience: null
};

let profileOrders = [];

function injectFinalStyles() {
  if (document.getElementById('xlim-final-style')) return;

  const style = document.createElement('style');
  style.id = 'xlim-final-style';
  style.textContent = `
    :root {
      --xlim-bg: #020617;
      --xlim-surface: #07111f;
      --xlim-blue: #38bdf8;
      --xlim-blue-2: #0ea5e9;
      --xlim-cyan: #22d3ee;
      --xlim-green: #22c55e;
      --xlim-red: #ef4444;
      --xlim-yellow: #facc15;
      --xlim-text: #ffffff;
      --xlim-muted: #94a3b8;
      --xlim-line: rgba(148, 163, 184, .14);
      --xlim-glow: rgba(56, 189, 248, .32);
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      padding-bottom: 94px;
    }

    .loader-ultra {
      background:
        radial-gradient(circle at 50% 42%, rgba(56, 189, 248, .13), transparent 34%),
        radial-gradient(circle at 78% 18%, rgba(34, 211, 238, .10), transparent 28%),
        linear-gradient(180deg, #020617 0%, #061426 52%, #020617 100%) !important;
    }

    .loader-ultra::before {
      content: "";
      position: absolute;
      inset: 0;
      opacity: .35;
      background-image:
        linear-gradient(rgba(56,189,248,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56,189,248,.07) 1px, transparent 1px);
      background-size: 76px 76px;
      mask-image: radial-gradient(circle at center, black, transparent 74%);
      pointer-events: none;
    }

    .cyber-spinner {
      width: 82px !important;
      height: 82px !important;
      border-width: 3px !important;
      border-top-color: var(--xlim-blue) !important;
      border-bottom-color: var(--xlim-cyan) !important;
      filter: drop-shadow(0 0 26px rgba(56,189,248,.30));
    }

    .cyber-spinner::after {
      inset: 9px !important;
      border-left-color: rgba(224,242,254,.85) !important;
      border-right-color: rgba(34,211,238,.8) !important;
    }

    #preloader .xlim-loader-brand {
      margin-top: 22px;
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      letter-spacing: .42em;
      color: rgba(255,255,255,.78);
      font-weight: 900;
      text-align: center;
      position: relative;
      z-index: 2;
    }

    #preloader .xlim-loader-sub {
      margin-top: 10px;
      color: rgba(148,163,184,.8);
      font-size: 11px;
      letter-spacing: .12em;
      font-family: var(--font-main, sans-serif);
      position: relative;
      z-index: 2;
    }

    #loading-progress {
      margin-top: 12px !important;
      color: #7dd3fc !important;
      font-weight: 800;
      letter-spacing: .16em;
      position: relative;
      z-index: 2;
    }

    .ultra-card,
    .product-card,
    .stat-card,
    .feature-card,
    .account-card,
    .rating-card,
    .xlim-welcome-card,
    .xlim-route-card {
      box-shadow: 0 18px 55px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.04);
      transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease, background .25s ease;
    }

    .ultra-card:hover,
    .product-card:hover,
    .feature-card:hover,
    .rating-card:hover,
    .xlim-route-card:hover {
      transform: translateY(-5px) scale(1.004);
      border-color: rgba(56,189,248,.30) !important;
      box-shadow: 0 26px 75px rgba(14,165,233,.16), inset 0 1px 0 rgba(255,255,255,.07);
    }

    .tap-target {
      transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease;
      -webkit-tap-highlight-color: transparent;
    }

    .tap-target.is-pressing {
      transform: scale(.985);
    }

    .product-card.is-pressing,
    .ultra-card.is-pressing,
    .rating-card.is-pressing,
    .xlim-route-card.is-pressing {
      transform: translateY(-4px) scale(.992);
      border-color: rgba(56,189,248,.32) !important;
      box-shadow: 0 22px 62px rgba(14,165,233,.16);
    }

    button,
    a {
      -webkit-tap-highlight-color: transparent;
    }

    #backToTop,
    .back-to-top {
      display: none !important;
    }

    .xlim-welcome-overlay {
      position: fixed;
      inset: 0;
      z-index: 9990;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(2, 6, 23, .55);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      opacity: 0;
      pointer-events: none;
      transition: .35s ease;
    }

    .xlim-welcome-overlay.show {
      opacity: 1;
      pointer-events: auto;
    }

    .xlim-welcome-card {
      width: min(560px, 100%);
      border-radius: 30px;
      border: 1px solid rgba(56,189,248,.22);
      background:
        radial-gradient(circle at 85% 0%, rgba(56,189,248,.18), transparent 36%),
        linear-gradient(160deg, rgba(15,23,42,.95), rgba(2,6,23,.92));
      padding: 28px;
      position: relative;
      overflow: hidden;
      transform: translateY(18px) scale(.97);
      transition: .35s ease;
    }

    .xlim-welcome-overlay.show .xlim-welcome-card {
      transform: translateY(0) scale(1);
    }

    .xlim-welcome-card::before {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      right: -70px;
      top: -70px;
      border-radius: 50%;
      background: rgba(56,189,248,.18);
      filter: blur(18px);
    }

    .xlim-welcome-close {
      position: absolute;
      top: 18px;
      right: 18px;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,.15);
      background: rgba(15,23,42,.72);
      color: #e0f2fe;
      display: grid;
      place-items: center;
      font-size: 20px;
      z-index: 2;
    }

    .xlim-welcome-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 13px;
      border-radius: 999px;
      background: rgba(56,189,248,.10);
      border: 1px solid rgba(56,189,248,.20);
      color: #7dd3fc;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
      position: relative;
      z-index: 1;
    }

    .xlim-welcome-title {
      margin: 18px 0 12px;
      font-family: var(--font-display, sans-serif);
      font-size: clamp(30px, 8vw, 46px);
      line-height: .98;
      letter-spacing: -.055em;
      font-weight: 900;
      position: relative;
      z-index: 1;
    }

    .xlim-welcome-text {
      margin: 0;
      color: #cbd5e1;
      line-height: 1.75;
      font-size: 14px;
      position: relative;
      z-index: 1;
    }

    .xlim-welcome-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 22px;
      position: relative;
      z-index: 1;
    }

    .xlim-welcome-actions a,
    .xlim-welcome-actions button {
      min-height: 48px;
      padding: 0 18px;
      border-radius: 16px;
      font-weight: 900;
      border: 1px solid rgba(148,163,184,.14);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .xlim-welcome-primary {
      background: #e0f2fe;
      color: #020617;
    }

    .xlim-welcome-secondary {
      background: rgba(15,23,42,.72);
      color: white;
    }

    .xlim-route-page {
      width: min(1240px, calc(100% - 32px));
      margin: 0 auto;
      padding: 124px 0 42px;
      position: relative;
      z-index: 12;
      min-height: calc(100vh - 94px);
      display: none;
    }

    .xlim-route-page.active {
      display: block;
      animation: xlimRouteIn .34s ease both;
    }

    @keyframes xlimRouteIn {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .xlim-route-head {
      text-align: center;
      margin-bottom: 28px;
    }

    .xlim-route-eyebrow {
      color: var(--xlim-blue);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .18em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .xlim-route-title {
      margin: 0;
      color: white;
      font-family: var(--font-display, sans-serif);
      font-size: clamp(34px, 8vw, 58px);
      line-height: .96;
      letter-spacing: -.06em;
      font-weight: 900;
    }

    .xlim-route-desc {
      margin: 14px auto 0;
      max-width: 720px;
      color: #94a3b8;
      line-height: 1.75;
      font-size: 14px;
    }

    .xlim-rating-grid {
      display: grid;
      grid-template-columns: 410px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .xlim-rating-panel,
    .xlim-rating-list,
    .xlim-profile-panel,
    .xlim-profile-orders {
      border-radius: 28px;
      border: 1px solid rgba(148,163,184,.14);
      background:
        radial-gradient(circle at top right, rgba(56,189,248,.10), transparent 34%),
        linear-gradient(160deg, rgba(15,23,42,.82), rgba(2,6,23,.72));
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      padding: 22px;
    }

    .xlim-rating-user {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .xlim-rating-user img {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(56,189,248,.3);
    }

    .xlim-rating-user strong {
      display: block;
      font-family: var(--font-display, sans-serif);
      font-size: 19px;
    }

    .xlim-rating-user span {
      display: block;
      color: #94a3b8;
      font-size: 12px;
      margin-top: 3px;
      word-break: break-all;
    }

    .xlim-stars {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    .xlim-star-btn {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,.14);
      background: rgba(2,6,23,.56);
      color: #64748b;
      font-size: 21px;
      display: grid;
      place-items: center;
      transition: .2s ease;
    }

    .xlim-star-btn.active {
      color: #facc15;
      border-color: rgba(250,204,21,.26);
      background: rgba(250,204,21,.10);
      box-shadow: 0 0 24px rgba(250,204,21,.12);
    }

    .xlim-rating-form textarea {
      width: 100%;
      min-height: 118px;
      resize: vertical;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,.14);
      background: rgba(2,6,23,.58);
      color: white;
      padding: 15px;
      outline: none;
      line-height: 1.6;
    }

    .xlim-rating-form textarea:focus {
      border-color: rgba(56,189,248,.44);
      box-shadow: 0 0 0 4px rgba(56,189,248,.08);
    }

    .xlim-rating-submit,
    .xlim-rating-login,
    .xlim-profile-primary,
    .xlim-profile-secondary,
    .xlim-profile-danger {
      width: 100%;
      min-height: 50px;
      margin-top: 12px;
      border-radius: 17px;
      font-weight: 900;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 9px;
      border: 1px solid rgba(148,163,184,.14);
    }

    .xlim-rating-submit,
    .xlim-profile-primary {
      border-color: #e0f2fe;
      background: #e0f2fe;
      color: #020617;
    }

    .xlim-rating-login,
    .xlim-profile-secondary {
      border-color: rgba(56,189,248,.26);
      background: rgba(56,189,248,.10);
      color: white;
    }

    .xlim-profile-danger {
      border-color: rgba(239,68,68,.22);
      background: rgba(239,68,68,.10);
      color: #fecaca;
    }

    .xlim-rating-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .xlim-rating-score {
      font-family: var(--font-display, sans-serif);
      font-size: 36px;
      font-weight: 900;
      letter-spacing: -.05em;
    }

    .xlim-rating-items {
      display: grid;
      gap: 12px;
      max-height: 540px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .rating-card {
      border-radius: 22px;
      border: 1px solid rgba(148,163,184,.12);
      background: rgba(2,6,23,.42);
      padding: 16px;
    }

    .rating-card-head {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 10px;
    }

    .rating-card-head img {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(56,189,248,.28);
    }

    .rating-card-head strong {
      display: block;
      color: white;
      font-size: 14px;
    }

    .rating-card-head small {
      display: block;
      color: #64748b;
      font-size: 11px;
      margin-top: 2px;
    }

    .rating-stars {
      color: #facc15;
      font-size: 14px;
      letter-spacing: .04em;
      margin-bottom: 8px;
    }

    .rating-card p {
      margin: 0;
      color: #cbd5e1;
      line-height: 1.65;
      font-size: 13px;
    }

    .rating-actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }

    .rating-action-btn {
      min-height: 38px;
      padding: 0 13px;
      border-radius: 13px;
      border: 1px solid rgba(148,163,184,.14);
      background: rgba(255,255,255,.05);
      color: #e0f2fe;
      font-weight: 900;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .rating-action-btn.danger {
      color: #fecaca;
      border-color: rgba(239,68,68,.22);
      background: rgba(239,68,68,.10);
    }

    .xlim-profile-grid {
      display: grid;
      grid-template-columns: 420px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .xlim-profile-card {
      text-align: center;
    }

    .xlim-profile-avatar-wrap {
      width: 118px;
      height: 118px;
      margin: 0 auto 18px;
      border-radius: 50%;
      position: relative;
    }

    .xlim-profile-avatar-wrap::before {
      content: "";
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      background: rgba(56,189,248,.18);
      filter: blur(12px);
    }

    .xlim-profile-avatar {
      position: relative;
      width: 118px;
      height: 118px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(56,189,248,.35);
    }

    .xlim-profile-name {
      margin: 0;
      font-family: var(--font-display, sans-serif);
      font-size: 34px;
      line-height: 1;
      letter-spacing: -.05em;
      font-weight: 900;
    }

    .xlim-profile-email {
      margin: 10px 0 0;
      color: #94a3b8;
      word-break: break-all;
    }

    .xlim-profile-actions {
      display: grid;
      gap: 10px;
      margin-top: 22px;
    }

    .xlim-profile-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 22px;
    }

    .xlim-profile-stat {
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,.12);
      background: rgba(2,6,23,.42);
      padding: 14px 10px;
      text-align: center;
    }

    .xlim-profile-stat b {
      display: block;
      font-family: var(--font-display, sans-serif);
      font-size: 24px;
      line-height: 1;
    }

    .xlim-profile-stat span {
      display: block;
      margin-top: 6px;
      color: #94a3b8;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .xlim-profile-orders h3 {
      margin: 0 0 16px;
      font-family: var(--font-display, sans-serif);
      font-size: 28px;
      letter-spacing: -.04em;
      font-weight: 900;
    }

    .xlim-profile-order-list {
      display: grid;
      gap: 12px;
    }

    .xlim-profile-order {
      border-radius: 20px;
      border: 1px solid rgba(148,163,184,.12);
      background: rgba(2,6,23,.42);
      padding: 16px;
    }

    .xlim-profile-order strong {
      display: block;
      color: white;
      font-family: var(--font-display, sans-serif);
      font-size: 18px;
      margin-bottom: 8px;
    }

    .xlim-profile-order span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 12px;
      margin-right: 12px;
      margin-top: 6px;
    }

    .xlim-profile-order small {
      display: block;
      margin-top: 10px;
      color: #64748b;
      font-family: var(--font-mono, monospace);
      word-break: break-all;
    }

    .xlim-bottom-nav {
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 999;
      width: min(430px, calc(100% - 28px));
      min-height: 72px;
      border-radius: 26px;
      border: 1px solid rgba(148,163,184,.16);
      background:
        radial-gradient(circle at top, rgba(56,189,248,.14), transparent 48%),
        rgba(2, 8, 23, .82);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      box-shadow: 0 20px 60px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.05);
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 8px;
      gap: 7px;
    }

    .xlim-bottom-link {
      border: 0;
      border-radius: 20px;
      background: transparent;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-weight: 900;
      font-size: 11px;
      letter-spacing: .02em;
      transition: .22s ease;
      position: relative;
      overflow: hidden;
    }

    .xlim-bottom-link i {
      font-size: 21px;
      line-height: 1;
    }

    .xlim-bottom-link.active {
      background: #e0f2fe;
      color: #020617;
      box-shadow: 0 12px 30px rgba(56,189,248,.16);
    }

    .xlim-bottom-link:not(.active):hover {
      color: white;
      background: rgba(56,189,248,.09);
    }

    .xlim-bottom-dot {
      position: absolute;
      top: 8px;
      right: 18px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 14px rgba(34,197,94,.55);
      display: none;
    }

    .xlim-bottom-link.has-user .xlim-bottom-dot {
      display: block;
    }

    body.xlim-page-home #xlimRatingPage,
    body.xlim-page-home #xlimProfilePage {
      display: none !important;
    }

    body.xlim-page-rating main,
    body.xlim-page-rating footer,
    body.xlim-page-profile main,
    body.xlim-page-profile footer {
      display: none !important;
    }

    body.xlim-page-rating #xlimRatingPage,
    body.xlim-page-profile #xlimProfilePage {
      display: block;
    }

    body.xlim-page-rating,
    body.xlim-page-profile {
      min-height: 100vh;
    }

    #xlimFooterAccount,
    #footerUserPanel,
    .xlim-footer-account {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }

    @media (max-width: 900px) {
      .xlim-rating-grid,
      .xlim-profile-grid {
        grid-template-columns: 1fr;
      }

      .xlim-rating-panel,
      .xlim-rating-list,
      .xlim-profile-panel,
      .xlim-profile-orders {
        border-radius: 24px;
        padding: 18px;
      }
    }

    @media (max-width: 640px) {
      .xlim-route-page {
        width: calc(100% - 24px);
        padding-top: 108px;
      }

      .xlim-bottom-nav {
        bottom: 12px;
        min-height: 68px;
        border-radius: 24px;
      }

      .xlim-bottom-link {
        border-radius: 18px;
        font-size: 10px;
      }

      .xlim-bottom-link i {
        font-size: 20px;
      }
    }

    @media (max-width: 520px) {
      .xlim-welcome-card {
        border-radius: 26px;
        padding: 24px 20px;
      }

      .xlim-welcome-actions a,
      .xlim-welcome-actions button {
        width: 100%;
      }

      .xlim-stars {
        justify-content: space-between;
      }

      .xlim-star-btn {
        width: 40px;
        height: 40px;
      }

      .xlim-profile-stats {
        grid-template-columns: 1fr;
      }

      .rating-actions {
        grid-template-columns: 1fr;
        display: grid;
      }

      .rating-action-btn {
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Customer XLIM';
}

function getAvatar(user) {
  const name = getDisplayName(user);
  return user?.user_metadata?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getOwnRating() {
  if (!currentUser) return null;
  return ratingState.ratings.find((item) => item.user_id === currentUser.id) || null;
}

function removeBadFooterAccount() {
  document.querySelectorAll('#xlimFooterAccount, #footerUserPanel, .xlim-footer-account').forEach((el) => {
    el.remove();
  });
}

function initCanvas() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  container.appendChild(canvas);

  let width = 0;
  let height = 0;
  let particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.38;
      this.vy = (Math.random() - 0.5) * 0.38;
      this.radius = Math.random() * 1.3 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fill();
    }
  }

  function makeParticles() {
    const count = window.innerWidth < 768 ? 46 : 92;
    particles = Array.from({ length: count }, () => new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });

    particles.forEach((p1, index) => {
      for (let i = index + 1; i < particles.length; i++) {
        const p2 = particles[i];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 116) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(14, 165, 233, ${0.78 - dist / 150})`;
          ctx.lineWidth = 0.48;
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(animate);
  }

  resize();
  makeParticles();
  animate();

  window.addEventListener('resize', () => {
    resize();
    makeParticles();
  });
}

function enhancePreloaderMarkup() {
  const preloader = document.getElementById('preloader');
  if (!preloader || preloader.dataset.enhanced === 'true') return;

  preloader.dataset.enhanced = 'true';

  const oldText = preloader.querySelector('.text-white');
  if (oldText) oldText.remove();

  const brand = document.createElement('div');
  brand.className = 'xlim-loader-brand';
  brand.textContent = 'XLIM STORE';

  const sub = document.createElement('div');
  sub.className = 'xlim-loader-sub';
  sub.textContent = 'Preparing cloud client area';

  const progress = document.getElementById('loading-progress');
  const spinner = preloader.querySelector('.cyber-spinner');

  if (spinner) spinner.insertAdjacentElement('afterend', brand);
  brand.insertAdjacentElement('afterend', sub);
  if (progress) sub.insertAdjacentElement('afterend', progress);
}

function initPreloader() {
  const preloader = document.getElementById('preloader');
  const progressEl = document.getElementById('loading-progress');

  if (!preloader || !progressEl) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('xlim:preloader-done')), 600);
    return;
  }

  enhancePreloaderMarkup();

  let progress = 0;
  let pageLoaded = false;
  let finished = false;
  let aosStarted = false;

  const startTime = Date.now();
  const minimumTime = 2500;
  const maximumTime = 7200;

  progressEl.textContent = '0%';

  function startAfterLoaderAnimations() {
    if (aosStarted) return;
    aosStarted = true;

    if (window.AOS) {
      AOS.init({
        once: true,
        duration: 850,
        offset: 50,
        easing: 'ease-out-cubic'
      });
    }

    if (window.gsap && document.querySelector('.gs-reveal')) {
      gsap.from('.gs-reveal', {
        y: 44,
        opacity: 0,
        duration: 1,
        stagger: 0.14,
        ease: 'power3.out',
        delay: 0.08
      });
    }
  }

  function closePreloader() {
    if (finished) return;

    finished = true;
    progress = 100;
    progressEl.textContent = '100%';

    setTimeout(() => {
      preloader.style.opacity = '0';
      preloader.style.pointerEvents = 'none';

      setTimeout(() => {
        preloader.remove();
        startAfterLoaderAnimations();
        window.dispatchEvent(new CustomEvent('xlim:preloader-done'));
      }, 650);
    }, 480);
  }

  function updateProgress() {
    if (finished) return;

    const elapsed = Date.now() - startTime;

    if (!pageLoaded) {
      if (progress < 28) progress += 1;
      else if (progress < 58) progress += Math.random() > 0.42 ? 1 : 0;
      else if (progress < 82) progress += Math.random() > 0.7 ? 1 : 0;
      else if (progress < 90) progress += Math.random() > 0.86 ? 1 : 0;
    } else {
      if (elapsed < minimumTime) {
        if (progress < 88) progress += 1;
        else if (progress < 94) progress += Math.random() > 0.65 ? 1 : 0;
      } else {
        progress += Math.floor(Math.random() * 4) + 2;
      }
    }

    if (elapsed >= maximumTime && progress < 100) progress += 7;

    if (progress >= 100) {
      closePreloader();
      return;
    }

    progressEl.textContent = `${Math.floor(progress)}%`;
  }

  const progressInterval = setInterval(() => {
    updateProgress();
    if (finished) clearInterval(progressInterval);
  }, 75);

  if (document.readyState === 'complete') {
    setTimeout(() => {
      pageLoaded = true;
    }, 900);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        pageLoaded = true;
      }, 500);
    }, { once: true });
  }

  setTimeout(() => {
    pageLoaded = true;
  }, maximumTime);
}

function initTyped() {
  if (!window.Typed || !document.getElementById('typed-output')) return;

  new Typed('#typed-output', {
    strings: ['Panel Hosting.', 'VPS Server.', 'Bot Online.', 'Node.js Ready.', 'Python Apps.'],
    typeSpeed: 52,
    backSpeed: 30,
    backDelay: 1800,
    loop: true,
    showCursor: true,
    cursorChar: '_'
  });
}

function initLenis() {
  if (!window.Lenis) return;

  const lenis = new Lenis({
    duration: 1.08,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}

function initNavbar() {
  const navbar = document.getElementById('navbar');
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const backToTop = document.getElementById('backToTop') || document.querySelector('.back-to-top');

  if (backToTop) backToTop.remove();

  window.addEventListener('scroll', () => {
    if (!navbar) return;

    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(2, 6, 23, 0.9)';
      navbar.style.borderBottom = '1px solid rgba(56, 189, 248, 0.24)';
      navbar.style.boxShadow = '0 14px 40px rgba(0,0,0,.25)';
    } else {
      navbar.style.background = 'rgba(2, 6, 23, 0.72)';
      navbar.style.borderBottom = '1px solid rgba(148, 163, 184, 0.12)';
      navbar.style.boxShadow = 'none';
    }
  });

  menuBtn?.addEventListener('click', () => {
    mobileMenu?.classList.toggle('show');
    const icon = menuBtn.querySelector('i');
    if (icon) icon.className = mobileMenu?.classList.contains('show') ? 'ri-close-line' : 'ri-menu-3-line';
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      if (!selector || selector === '#') return;
      if (['#home', '#rating', '#profile'].includes(selector)) return;

      const target = document.querySelector(selector);
      if (!target) return;

      event.preventDefault();

      const offset = (navbar?.offsetHeight || 82) + 18;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });

      mobileMenu?.classList.remove('show');
      const icon = menuBtn?.querySelector('i');
      if (icon) icon.className = 'ri-menu-3-line';
    });
  });
}

function initCardSpotlight() {
  window.addEventListener('mousemove', (event) => {
    document.querySelectorAll('.ultra-card, .product-card, .rating-card, .xlim-route-card').forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
  });
}

function initTouchEffect() {
  document.querySelectorAll('a, button, .ultra-card, .product-card, .stat-card, .mobile-link, .nav-link, .rating-card, .xlim-route-card').forEach((target) => {
    if (target.dataset.tapReady === 'true') return;

    target.dataset.tapReady = 'true';
    target.classList.add('tap-target');

    const clear = () => target.classList.remove('is-pressing');

    target.addEventListener('pointerdown', () => target.classList.add('is-pressing'));
    target.addEventListener('pointerup', clear);
    target.addEventListener('pointercancel', clear);
    target.addEventListener('pointerleave', clear);
    target.addEventListener('blur', clear);
  });
}

function initDeviceClass() {
  const root = document.documentElement;

  function apply() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ua = navigator.userAgent.toLowerCase();

    root.classList.remove('device-android', 'device-iphone', 'device-ipad', 'device-tablet', 'device-laptop', 'device-pc');

    if (/iphone/.test(ua)) root.classList.add('device-iphone');
    else if (/ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) root.classList.add('device-ipad');
    else if (/android/.test(ua) && Math.min(width, height) >= 600) root.classList.add('device-tablet', 'device-android');
    else if (/android/.test(ua)) root.classList.add('device-android');
    else if (width >= 1440) root.classList.add('device-pc');
    else if (width >= 1024) root.classList.add('device-laptop');
  }

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}

export async function loginWithGoogle() {
  if (!supabase?.auth) return;

  const redirectTo = `${window.location.origin}/#profile`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });

  if (error) {
    window.Swal?.fire({
      icon: 'error',
      title: 'Login gagal',
      text: error.message,
      background: '#07111f',
      color: '#ffffff'
    });
  }
}

export async function logoutUser() {
  if (!supabase?.auth) return;
  await supabase.auth.signOut();
  window.location.href = '/#home';
}

async function refreshCurrentUser() {
  if (!supabase?.auth) return null;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  return currentUser;
}

export async function updateUserUI() {
  const user = await refreshCurrentUser();

  removeBadFooterAccount();

  const loginBtns = document.querySelectorAll('[data-login-google]');
  const logoutBtns = document.querySelectorAll('[data-logout]');
  const userPills = document.querySelectorAll('[data-user-pill]');
  const userNames = document.querySelectorAll('[data-user-name]');
  const userAvatars = document.querySelectorAll('[data-user-avatar]');

  loginBtns.forEach((btn) => {
    btn.style.display = user ? 'none' : 'inline-flex';
  });

  logoutBtns.forEach((btn) => {
    btn.style.display = user ? 'inline-flex' : 'none';
  });

  userPills.forEach((pill) => {
    pill.style.display = user ? 'inline-flex' : 'none';
  });

  if (user) {
    const name = getDisplayName(user);
    const avatar = getAvatar(user);

    userNames.forEach((el) => {
      el.textContent = name;
    });

    userAvatars.forEach((img) => {
      img.src = avatar;
      img.alt = name;
    });
  }

  renderRatingPanel();
  renderProfilePage();
  updateBottomNavUser();
}

function bindAuthButtons() {
  document.addEventListener('click', (event) => {
    const loginTarget = event.target.closest('[data-login-google]');
    const logoutTarget = event.target.closest('[data-logout]');

    if (loginTarget) loginWithGoogle();
    if (logoutTarget) logoutUser();
  });

  supabase?.auth?.onAuthStateChange(() => {
    updateUserUI();
  });
}

function initWelcomePopup() {
  if (sessionStorage.getItem(WELCOME_KEY) === '1') return;
  if (document.getElementById('xlimWelcomePopup')) return;

  const overlay = document.createElement('div');
  overlay.id = 'xlimWelcomePopup';
  overlay.className = 'xlim-welcome-overlay';
  overlay.innerHTML = `
    <div class="xlim-welcome-card">
      <button class="xlim-welcome-close" type="button" aria-label="Tutup iklan">
        <i class="ri-close-line"></i>
      </button>
      <div class="xlim-welcome-badge">
        <i class="ri-sparkling-2-line"></i>
        Cloud Digital Store
      </div>
      <h2 class="xlim-welcome-title">Selamat datang di XLIM STORE.</h2>
      <p class="xlim-welcome-text">
        Tempat cepat untuk kebutuhan panel hosting, VPS, node server, dan layanan cloud digital.
        Login dengan Google untuk order lebih aman, melihat riwayat pembelian, dan memberi rating pengalaman kamu.
      </p>
      <div class="xlim-welcome-actions">
        <a href="#home" class="xlim-welcome-primary">
          <i class="ri-home-5-line"></i>
          Masuk Home
        </a>
        <button class="xlim-welcome-secondary" type="button" data-login-google>
          <i class="ri-google-fill"></i>
          Login Google
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function close() {
    sessionStorage.setItem(WELCOME_KEY, '1');
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 360);
  }

  overlay.querySelector('.xlim-welcome-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelector('a[href="#home"]')?.addEventListener('click', close);

  window.addEventListener('xlim:preloader-done', () => {
    setTimeout(() => {
      if (getRoute() === 'home') overlay.classList.add('show');
    }, 450);
  }, { once: true });

  setTimeout(() => {
    if (document.body.contains(overlay) && !overlay.classList.contains('show') && getRoute() === 'home') {
      overlay.classList.add('show');
    }
  }, 5500);
}

function createRoutePages() {
  if (!document.getElementById('xlimRatingPage')) {
    const ratingPage = document.createElement('section');
    ratingPage.id = 'xlimRatingPage';
    ratingPage.className = 'xlim-route-page';
    ratingPage.innerHTML = `
      <div class="xlim-route-head">
        <div class="xlim-route-eyebrow">Customer Experience</div>
        <h2 class="xlim-route-title">Rating XLIM STORE</h2>
        <p class="xlim-route-desc">
          Rating ini dikirim langsung oleh akun Google pelanggan. Semua pengunjung bisa melihat pengalaman pengguna lain secara publik.
        </p>
      </div>

      <div class="xlim-rating-grid">
        <div class="xlim-rating-panel xlim-route-card" id="xlimRatingPanel"></div>
        <div class="xlim-rating-list xlim-route-card">
          <div class="xlim-rating-summary" id="xlimRatingSummary"></div>
          <div class="xlim-rating-items" id="xlimRatingItems"></div>
        </div>
      </div>
    `;

    document.body.appendChild(ratingPage);
  }

  if (!document.getElementById('xlimProfilePage')) {
    const profilePage = document.createElement('section');
    profilePage.id = 'xlimProfilePage';
    profilePage.className = 'xlim-route-page';
    profilePage.innerHTML = `
      <div class="xlim-route-head">
        <div class="xlim-route-eyebrow">Customer Area</div>
        <h2 class="xlim-route-title">Profil Akun</h2>
        <p class="xlim-route-desc">
          Kelola akses akun Google kamu, lihat riwayat order, dan masuk ke halaman akun pembeli dengan lebih cepat.
        </p>
      </div>

      <div id="xlimProfileContent"></div>
    `;

    document.body.appendChild(profilePage);
  }
}

function createBottomNav() {
  if (document.getElementById('xlimBottomNav')) return;

  const nav = document.createElement('nav');
  nav.id = 'xlimBottomNav';
  nav.className = 'xlim-bottom-nav';
  nav.innerHTML = `
    <a class="xlim-bottom-link" href="#home" data-route-link="home">
      <i class="ri-home-5-fill"></i>
      <span>Home</span>
    </a>
    <a class="xlim-bottom-link" href="#rating" data-route-link="rating">
      <i class="ri-star-smile-fill"></i>
      <span>Rating</span>
    </a>
    <a class="xlim-bottom-link" href="#profile" data-route-link="profile">
      <span class="xlim-bottom-dot"></span>
      <i class="ri-user-3-fill"></i>
      <span>Profil</span>
    </a>
  `;

  document.body.appendChild(nav);
}

function getRoute() {
  const hash = (window.location.hash || '#home').replace('#', '').trim().toLowerCase();

  if (hash === 'rating') return 'rating';
  if (hash === 'profile' || hash === 'profil') return 'profile';

  return 'home';
}

function applyRoute() {
  const route = getRoute();

  document.body.classList.remove('xlim-page-home', 'xlim-page-rating', 'xlim-page-profile');
  document.body.classList.add(`xlim-page-${route}`);

  document.querySelectorAll('[data-route-link]').forEach((item) => {
    item.classList.toggle('active', item.dataset.routeLink === route);
  });

  if (route === 'rating') {
    loadRatings();
    renderRatingPanel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (route === 'profile') {
    renderProfilePage();
    loadProfileOrders();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (route === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateBottomNavUser() {
  const profileBtn = document.querySelector('[data-route-link="profile"]');
  if (!profileBtn) return;

  profileBtn.classList.toggle('has-user', Boolean(currentUser));
}

function renderRatingPanel() {
  const panel = document.getElementById('xlimRatingPanel');
  if (!panel) return;

  if (!currentUser) {
    panel.innerHTML = `
      <div class="xlim-rating-user">
        <img src="https://api.dicebear.com/8.x/initials/svg?seed=XLIM%20STORE" alt="XLIM STORE">
        <div>
          <strong>Login untuk memberi rating</strong>
          <span>Rating kamu akan tampil memakai akun Google.</span>
        </div>
      </div>
      <button class="xlim-rating-login" type="button" data-login-google>
        <i class="ri-google-fill"></i>
        Login Google
      </button>
    `;
    initTouchEffect();
    return;
  }

  const name = getDisplayName(currentUser);
  const avatar = getAvatar(currentUser);
  const ownRating = getOwnRating();

  if (ownRating && ratingState.draftExperience === null) {
    ratingState.selectedStars = Number(ownRating.stars || 5);
  }

  const textValue = ratingState.draftExperience !== null ? ratingState.draftExperience : ownRating?.experience || '';
  const buttonText = ownRating ? 'Update Rating' : 'Kirim Rating';

  panel.innerHTML = `
    <div class="xlim-rating-user">
      <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(currentUser.email || '')}</span>
      </div>
    </div>
    <form class="xlim-rating-form" id="xlimRatingForm">
      <div class="xlim-stars" id="xlimStarButtons">
        ${[1, 2, 3, 4, 5].map((star) => `
          <button class="xlim-star-btn ${star <= ratingState.selectedStars ? 'active' : ''}" type="button" data-star="${star}">
            <i class="ri-star-fill"></i>
          </button>
        `).join('')}
      </div>
      <textarea id="xlimRatingText" maxlength="500" placeholder="Ceritakan pengalaman kamu menggunakan XLIM STORE...">${escapeHtml(textValue)}</textarea>
      <button class="xlim-rating-submit" type="submit">
        <i class="ri-send-plane-fill"></i>
        ${buttonText}
      </button>
      ${ownRating ? `
        <button class="xlim-profile-danger" type="button" id="deleteOwnRatingBtn">
          <i class="ri-delete-bin-line"></i>
          Hapus Rating Saya
        </button>
      ` : ''}
    </form>
  `;

  panel.querySelectorAll('[data-star]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('xlimRatingText');
      ratingState.draftExperience = textarea?.value || '';
      ratingState.selectedStars = Number(btn.dataset.star);
      renderRatingPanel();
    });
  });

  panel.querySelector('#xlimRatingForm')?.addEventListener('submit', submitRating);
  panel.querySelector('#deleteOwnRatingBtn')?.addEventListener('click', () => deleteRating(ownRating?.id));
  initTouchEffect();
}

async function submitRating(event) {
  event.preventDefault();

  if (!currentUser) {
    loginWithGoogle();
    return;
  }

  const textarea = document.getElementById('xlimRatingText');
  const experience = textarea?.value?.trim() || '';

  if (experience.length < 8) {
    window.Swal?.fire({
      icon: 'info',
      title: 'Rating belum lengkap',
      text: 'Tulis pengalaman minimal beberapa kata dulu.',
      background: '#07111f',
      color: '#ffffff',
      confirmButtonColor: '#38bdf8'
    });
    return;
  }

  const payload = {
    user_id: currentUser.id,
    display_name: getDisplayName(currentUser),
    email: currentUser.email,
    avatar_url: getAvatar(currentUser),
    stars: ratingState.selectedStars,
    experience
  };

  const { error } = await supabase
    .from('ratings')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    window.Swal?.fire({
      icon: 'error',
      title: 'Gagal mengirim rating',
      text: error.message,
      background: '#07111f',
      color: '#ffffff',
      confirmButtonColor: '#38bdf8'
    });
    return;
  }

  ratingState.draftExperience = null;

  window.Swal?.fire({
    icon: 'success',
    title: 'Rating tersimpan',
    text: 'Rating kamu sudah diperbarui di website.',
    background: '#07111f',
    color: '#ffffff',
    timer: 1700,
    showConfirmButton: false
  });

  await loadRatings();
  renderRatingPanel();
  renderProfilePage();
}

async function deleteRating(ratingId) {
  if (!currentUser || !ratingId) return;

  let confirmed = true;

  if (window.Swal) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus rating?',
      text: 'Rating kamu akan dihapus dari website.',
      background: '#07111f',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#334155'
    });

    confirmed = result.isConfirmed;
  } else {
    confirmed = confirm('Hapus rating kamu?');
  }

  if (!confirmed) return;

  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('id', ratingId)
    .eq('user_id', currentUser.id);

  if (error) {
    window.Swal?.fire({
      icon: 'error',
      title: 'Gagal hapus rating',
      text: error.message,
      background: '#07111f',
      color: '#ffffff',
      confirmButtonColor: '#38bdf8'
    });
    return;
  }

  ratingState.selectedStars = 5;
  ratingState.draftExperience = null;

  window.Swal?.fire({
    icon: 'success',
    title: 'Rating dihapus',
    background: '#07111f',
    color: '#ffffff',
    timer: 1300,
    showConfirmButton: false
  });

  await loadRatings();
  renderRatingPanel();
  renderProfilePage();
}

async function editRating(ratingId) {
  const rating = ratingState.ratings.find((item) => item.id === ratingId);

  if (!rating || !currentUser || rating.user_id !== currentUser.id) return;

  ratingState.selectedStars = Number(rating.stars || 5);
  ratingState.draftExperience = rating.experience || '';

  window.location.hash = '#rating';
  renderRatingPanel();

  setTimeout(() => {
    document.getElementById('xlimRatingPanel')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, 200);
}

async function loadRatings() {
  const items = document.getElementById('xlimRatingItems');
  const summary = document.getElementById('xlimRatingSummary');

  if (!items || !summary || !supabase?.from) return;

  items.innerHTML = `<div class="rating-card"><p>Memuat rating pelanggan...</p></div>`;

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    items.innerHTML = `<div class="rating-card"><p>Rating belum siap. Jalankan SQL ratings di Supabase.</p></div>`;
    summary.innerHTML = `<span class="xlim-rating-score">0.0</span><span>Belum ada rating</span>`;
    return;
  }

  ratingState.ratings = data || [];

  const total = ratingState.ratings.length;
  const avg = total
    ? ratingState.ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / total
    : 0;

  summary.innerHTML = `
    <div>
      <div class="xlim-rating-score">${avg.toFixed(1)}</div>
      <div class="rating-stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</div>
    </div>
    <span style="color:#94a3b8;font-weight:800;">${total} rating publik</span>
  `;

  if (!total) {
    items.innerHTML = `<div class="rating-card"><p>Belum ada rating. Jadilah pengguna pertama yang memberi pengalaman.</p></div>`;
    renderRatingPanel();
    return;
  }

  items.innerHTML = ratingState.ratings.map((item) => {
    const isOwner = currentUser && item.user_id === currentUser.id;

    return `
      <article class="rating-card">
        <div class="rating-card-head">
          <img src="${escapeHtml(item.avatar_url || 'https://api.dicebear.com/8.x/initials/svg?seed=Customer')}" alt="${escapeHtml(item.display_name)}">
          <div>
            <strong>${escapeHtml(item.display_name)}</strong>
            <small>${formatDate(item.updated_at)}</small>
          </div>
        </div>
        <div class="rating-stars">${'★'.repeat(item.stars)}${'☆'.repeat(5 - item.stars)}</div>
        <p>${escapeHtml(item.experience)}</p>
        ${isOwner ? `
          <div class="rating-actions">
            <button class="rating-action-btn" type="button" data-edit-rating="${escapeHtml(item.id)}">
              <i class="ri-edit-2-line"></i>
              Edit
            </button>
            <button class="rating-action-btn danger" type="button" data-delete-rating="${escapeHtml(item.id)}">
              <i class="ri-delete-bin-line"></i>
              Hapus
            </button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-edit-rating]').forEach((button) => {
    button.addEventListener('click', () => editRating(button.dataset.editRating));
  });

  document.querySelectorAll('[data-delete-rating]').forEach((button) => {
    button.addEventListener('click', () => deleteRating(button.dataset.deleteRating));
  });

  renderRatingPanel();
  initTouchEffect();
}

function renderProfilePage() {
  const root = document.getElementById('xlimProfileContent');
  if (!root) return;

  if (!currentUser) {
    root.innerHTML = `
      <div class="xlim-profile-grid">
        <div class="xlim-profile-panel xlim-profile-card xlim-route-card">
          <div class="xlim-profile-avatar-wrap">
            <img class="xlim-profile-avatar" src="https://api.dicebear.com/8.x/initials/svg?seed=XLIM%20STORE" alt="Guest">
          </div>
          <h3 class="xlim-profile-name">Guest User</h3>
          <p class="xlim-profile-email">Login Google untuk membuka akun pembeli.</p>
          <div class="xlim-profile-actions">
            <button class="xlim-profile-primary" type="button" data-login-google>
              <i class="ri-google-fill"></i>
              Login Google
            </button>
            <a class="xlim-profile-secondary" href="#home">
              <i class="ri-home-5-line"></i>
              Kembali ke Home
            </a>
          </div>
        </div>

        <div class="xlim-profile-orders xlim-route-card">
          <h3>Kenapa harus login?</h3>
          <div class="xlim-profile-order-list">
            <div class="xlim-profile-order">
              <strong>Riwayat per akun</strong>
              <span><i class="ri-shield-user-line"></i> Order kamu tidak bercampur dengan user lain.</span>
            </div>
            <div class="xlim-profile-order">
              <strong>Rating pakai identitas asli</strong>
              <span><i class="ri-star-smile-line"></i> Rating tampil dengan nama dan avatar Google.</span>
            </div>
          </div>
        </div>
      </div>
    `;
    initTouchEffect();
    return;
  }

  const name = getDisplayName(currentUser);
  const avatar = getAvatar(currentUser);
  const totalOrders = profileOrders.length;
  const activeOrders = profileOrders.filter((item) => !['done', 'cancelled'].includes(item.status)).length;
  const totalRatings = ratingState.ratings.filter((item) => item.user_id === currentUser.id).length;

  root.innerHTML = `
    <div class="xlim-profile-grid">
      <div class="xlim-profile-panel xlim-profile-card xlim-route-card">
        <div class="xlim-profile-avatar-wrap">
          <img class="xlim-profile-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">
        </div>
        <h3 class="xlim-profile-name">${escapeHtml(name)}</h3>
        <p class="xlim-profile-email">${escapeHtml(currentUser.email || '')}</p>

        <div class="xlim-profile-stats">
          <div class="xlim-profile-stat">
            <b>${totalOrders}</b>
            <span>Order</span>
          </div>
          <div class="xlim-profile-stat">
            <b>${activeOrders}</b>
            <span>Proses</span>
          </div>
          <div class="xlim-profile-stat">
            <b>${totalRatings}</b>
            <span>Rating</span>
          </div>
        </div>

        <div class="xlim-profile-actions">
          <a class="xlim-profile-primary" href="/account/">
            <i class="ri-user-3-line"></i>
            Buka Akun Pembeli
          </a>
          <a class="xlim-profile-secondary" href="#rating">
            <i class="ri-star-smile-line"></i>
            Beri / Edit Rating
          </a>
          <button class="xlim-profile-danger" type="button" data-logout>
            <i class="ri-logout-box-r-line"></i>
            Logout
          </button>
        </div>
      </div>

      <div class="xlim-profile-orders xlim-route-card">
        <h3>Riwayat Cepat</h3>
        <div class="xlim-profile-order-list" id="xlimProfileOrderList">
          ${renderProfileOrders()}
        </div>
      </div>
    </div>
  `;

  initTouchEffect();
}

function renderProfileOrders() {
  if (!currentUser) return '';

  if (!profileOrders.length) {
    return `
      <div class="xlim-profile-order">
        <strong>Belum ada order</strong>
        <span><i class="ri-shopping-bag-3-line"></i> Pilih produk di Home lalu klik Order.</span>
      </div>
    `;
  }

  return profileOrders.slice(0, 5).map((item) => `
    <article class="xlim-profile-order">
      <strong>${escapeHtml(item.product_name || item.name || 'Order XLIM')}</strong>
      <span><i class="ri-calendar-line"></i> ${formatDate(item.created_at)}</span>
      <span><i class="ri-bank-card-line"></i> ${escapeHtml(item.payment_status || 'unpaid')}</span>
      <span><i class="ri-loader-4-line"></i> ${escapeHtml(item.status || 'pending')}</span>
      <small>${escapeHtml(item.id || '')}</small>
    </article>
  `).join('');
}

async function loadProfileOrders() {
  if (!currentUser || !supabase?.from) {
    profileOrders = [];
    renderProfilePage();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    profileOrders = data || [];
  } catch {
    profileOrders = [];
  }

  renderProfilePage();
}

document.addEventListener('DOMContentLoaded', () => {
  injectFinalStyles();
  removeBadFooterAccount();
  createRoutePages();
  createBottomNav();
  initCanvas();
  initPreloader();
  initTyped();
  initLenis();
  initNavbar();
  initCardSpotlight();
  initTouchEffect();
  initDeviceClass();
  bindAuthButtons();
  initWelcomePopup();
  updateUserUI();
  loadRatings();

  if (!window.location.hash || window.location.hash === '#') {
    history.replaceState(null, '', '#home');
  }

  applyRoute();

  window.addEventListener('hashchange', applyRoute);

  setInterval(removeBadFooterAccount, 1200);
});

window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
