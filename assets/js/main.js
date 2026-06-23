import { supabase } from './supabase-client.js';
import { BRAND_NAME } from './config.js';

function initCanvas() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

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
      this.vx = (Math.random() - 0.5) * 0.36;
      this.vy = (Math.random() - 0.5) * 0.36;
      this.radius = Math.random() * 1.2 + 0.2;
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
      ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.fill();
    }
  }

  function makeParticles() {
    const count = window.innerWidth < 768 ? 42 : 86;
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

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(14, 165, 233, ${0.7 - dist / 160})`;
          ctx.lineWidth = 0.45;
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

function initPreloader() {
  const preloader = document.getElementById('preloader');
  const progressEl = document.getElementById('loading-progress');

  if (!preloader || !progressEl) return;

  let progress = 0;
  let pageLoaded = false;
  let finished = false;
  let aosStarted = false;

  const startTime = Date.now();
  const minimumTime = 2400;
  const maximumTime = 7200;

  progressEl.textContent = '0%';

  function startAfterLoaderAnimations() {
    if (aosStarted) return;
    aosStarted = true;

    if (window.AOS) {
      AOS.init({
        once: true,
        duration: 800,
        offset: 50,
        easing: 'ease-out-cubic'
      });
    }

    if (window.gsap && document.querySelector('.gs-reveal')) {
      gsap.from('.gs-reveal', {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.14,
        ease: 'power3.out',
        delay: 0.1
      });
    }
  }

  function closePreloader() {
    if (finished) return;

    finished = true;
    progress = 100;
    progressEl.textContent = '100% - STORE READY';

    setTimeout(() => {
      preloader.style.opacity = '0';
      preloader.style.pointerEvents = 'none';

      setTimeout(() => {
        preloader.remove();
        startAfterLoaderAnimations();
      }, 650);
    }, 420);
  }

  function updateProgress() {
    if (finished) return;

    const elapsed = Date.now() - startTime;

    if (!pageLoaded) {
      if (progress < 28) {
        progress += 1;
      } else if (progress < 58) {
        progress += Math.random() > 0.45 ? 1 : 0;
      } else if (progress < 82) {
        progress += Math.random() > 0.7 ? 1 : 0;
      } else if (progress < 90) {
        progress += Math.random() > 0.86 ? 1 : 0;
      }
    } else {
      if (elapsed < minimumTime) {
        if (progress < 88) {
          progress += 1;
        } else if (progress < 94) {
          progress += Math.random() > 0.65 ? 1 : 0;
        }
      } else if (progress < 100) {
        progress += Math.floor(Math.random() * 4) + 2;
      }
    }

    if (elapsed >= maximumTime && progress < 100) {
      progress += 6;
    }

    if (progress >= 100) {
      closePreloader();
      return;
    }

    progressEl.textContent = `${Math.floor(progress)}%`;
  }

  const progressInterval = setInterval(() => {
    updateProgress();

    if (finished) {
      clearInterval(progressInterval);
    }
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
    typeSpeed: 50,
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
    duration: 1.05,
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
  const backToTop = document.getElementById('backToTop');

  window.addEventListener('scroll', () => {
    if (!navbar) return;

    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(2, 6, 23, 0.88)';
      navbar.style.borderBottom = '1px solid rgba(14, 165, 233, 0.22)';
      backToTop?.classList.add('show');
    } else {
      navbar.style.background = 'rgba(2, 6, 23, 0.72)';
      navbar.style.borderBottom = '1px solid rgba(148, 163, 184, 0.12)';
      backToTop?.classList.remove('show');
    }
  });

  menuBtn?.addEventListener('click', () => {
    mobileMenu?.classList.toggle('show');

    const icon = menuBtn.querySelector('i');

    if (icon) {
      icon.className = mobileMenu?.classList.contains('show') ? 'ri-close-line' : 'ri-menu-3-line';
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');

      if (!selector || selector === '#') return;

      const target = document.querySelector(selector);
      if (!target) return;

      event.preventDefault();

      const offset = (navbar?.offsetHeight || 82) + 18;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });

      mobileMenu?.classList.remove('show');

      const icon = menuBtn?.querySelector('i');
      if (icon) icon.className = 'ri-menu-3-line';
    });
  });

  backToTop?.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

function initCardSpotlight() {
  window.addEventListener('mousemove', (event) => {
    document.querySelectorAll('.ultra-card').forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
  });
}

function initTouchEffect() {
  document.querySelectorAll('a, button, .ultra-card, .stat-card, .mobile-link, .nav-link').forEach((target) => {
    target.classList.add('tap-target');

    target.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;

      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');

      ripple.className = 'tap-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;

      target.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 620);
    });
  });
}

function initDeviceClass() {
  const root = document.documentElement;

  function apply() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ua = navigator.userAgent.toLowerCase();

    root.classList.remove(
      'device-android',
      'device-iphone',
      'device-ipad',
      'device-tablet',
      'device-laptop',
      'device-pc'
    );

    if (/iphone/.test(ua)) {
      root.classList.add('device-iphone');
    } else if (/ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      root.classList.add('device-ipad');
    } else if (/android/.test(ua) && Math.min(width, height) >= 600) {
      root.classList.add('device-tablet', 'device-android');
    } else if (/android/.test(ua)) {
      root.classList.add('device-android');
    } else if (width >= 1440) {
      root.classList.add('device-pc');
    } else if (width >= 1024) {
      root.classList.add('device-laptop');
    }
  }

  apply();

  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}

export async function loginWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo
    }
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
  await supabase.auth.signOut();
  window.location.href = '/';
}

export async function updateUserUI() {
  const loginBtns = document.querySelectorAll('[data-login-google]');
  const logoutBtns = document.querySelectorAll('[data-logout]');
  const userPills = document.querySelectorAll('[data-user-pill]');
  const userNames = document.querySelectorAll('[data-user-name]');
  const userAvatars = document.querySelectorAll('[data-user-avatar]');

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

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
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
    const avatar = user.user_metadata?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name || BRAND_NAME)}`;

    userNames.forEach((el) => {
      el.textContent = name;
    });

    userAvatars.forEach((img) => {
      img.src = avatar;
      img.alt = name;
    });
  }
}

function bindAuthButtons() {
  document.querySelectorAll('[data-login-google]').forEach((btn) => {
    btn.addEventListener('click', loginWithGoogle);
  });

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', logoutUser);
  });

  supabase.auth.onAuthStateChange(() => {
    updateUserUI();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initPreloader();
  initTyped();
  initLenis();
  initNavbar();
  initCardSpotlight();
  initTouchEffect();
  initDeviceClass();
  bindAuthButtons();
  updateUserUI();
});