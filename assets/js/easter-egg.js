/**
 * DS FUN LOGISTIC - EASTER EGG DEVELOPER / ADMIN MODE ALA ANDROID
 * Sesuai referensi METODE_EASTER_EGG_ADMIN_DEVMODE.md
 * 15 Ketukan bertahap:
 *  - Ketukan 1-4 : Silent (Micro scale feedback)
 *  - Ketukan 5-14: Countdown feedback toast ala Android
 *  - Ketukan ke-15: Unlocked + Toast Perayaan + Modal Portal Admin & Redirect
 */

(function () {
  'use strict';

  const TOTAL_CLICKS = 15;
  const NOTIFY_START = 5; // Mulai countdown di klik ke-5 agar lebih responsif
  const STORAGE_KEY = 'admin_unlocked';
  const TOKEN_KEY = 'dsfun_admin_token';
  const SESSION_USER_KEY = 'dsfun_admin_user';

  let clickTimeout = null;
  let toastTimeout = null;

  // Check initial unlocked state
  function checkInitialUnlocked() {
    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      if (
        params.get('role') === 'admin' ||
        params.get('preview_role') === 'admin' ||
        hash.includes('admin') ||
        sessionStorage.getItem(STORAGE_KEY) === 'true' ||
        sessionStorage.getItem('app_admin_unlocked') === 'true'
      ) {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        sessionStorage.setItem('app_admin_unlocked', 'true');
        return true;
      }
    } catch (e) {
      console.warn('Easter egg storage error:', e);
    }
    return false;
  }

  let isUnlocked = checkInitialUnlocked();

  // Create Android Toast Element
  function getOrCreateToastEl() {
    let el = document.getElementById('dsfun-android-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dsfun-android-toast';
      el.className = 'dsfun-android-toast';
      document.body.appendChild(el);
    }
    return el;
  }

  // Show Android Style Toast
  function showToast(message, type = 'info', duration = 2600) {
    const toast = getOrCreateToastEl();
    toast.textContent = message;
    toast.className = `dsfun-android-toast show ${type}`;

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Create or Show Admin Modal Dialog
  function showAdminUnlockModal() {
    let modal = document.getElementById('dsfun-unlock-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsfun-unlock-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        padding: 20px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      `;

      modal.innerHTML = `
        <div style="
          background: #0F172A;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          max-width: 420px;
          width: 100%;
          padding: 28px;
          text-align: center;
          color: #fff;
          box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(10, 79, 196, 0.3);
          transform: translateY(20px);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        " id="dsfun-unlock-modal-card">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0A4FC4, #D0021B); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 8px 24px rgba(208, 2, 27, 0.4);">
            🛡️
          </div>
          <h3 style="font-size: 20px; font-weight: 800; margin: 0 0 8px 0; color: #fff;">Mode Developer &amp; Admin Terbuka!</h3>
          <p style="font-size: 13.5px; color: #94A3B8; margin: 0 0 24px 0; line-height: 1.5;">
            Akses portal administrator DS Fun Logistic telah diaktifkan melalui ketukan rahasia Android DevMode.
          </p>
          <div style="display: flex; gap: 10px;">
            <button id="dsfun-modal-btn-enter" style="
              flex: 1;
              padding: 12px 16px;
              background: linear-gradient(135deg, #D0021B, #0A4FC4);
              color: #fff;
              border: none;
              border-radius: 10px;
              font-size: 13.5px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 14px rgba(208, 2, 27, 0.4);
            ">Masuk Portal Admin &rarr;</button>
            <button id="dsfun-modal-btn-close" style="
              padding: 12px 16px;
              background: rgba(255, 255, 255, 0.1);
              color: #CBD5E1;
              border: none;
              border-radius: 10px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
            ">Tutup</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById('dsfun-modal-btn-enter').addEventListener('click', () => {
        const hasSession = !!sessionStorage.getItem(TOKEN_KEY);
        window.location.href = hasSession ? 'admin-dashboard.html' : 'admin-login.html';
      });

      document.getElementById('dsfun-modal-btn-close').addEventListener('click', () => {
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        const card = document.getElementById('dsfun-unlock-modal-card');
        if (card) card.style.transform = 'translateY(20px)';
      });
    }

    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    const card = document.getElementById('dsfun-unlock-modal-card');
    if (card) card.style.transform = 'translateY(0)';
  }

  // Inject or Show Admin Portal Badge in Header / TopBar
  function renderAdminPortalBadge() {
    if (!isUnlocked) return;

    const hasSession = !!sessionStorage.getItem(TOKEN_KEY);
    const targetUrl = hasSession ? 'admin-dashboard.html' : 'admin-login.html';

    // Target 1: Top bar right
    let badge = document.getElementById('header-admin-badge');
    if (!badge) {
      const topBarRight = document.querySelector('.top-bar-right');
      if (topBarRight) {
        badge = document.createElement('a');
        badge.id = 'header-admin-badge';
        badge.href = targetUrl;
        badge.className = 'admin-portal-badge';
        badge.title = 'Akses Portal Administrator DS Fun';
        badge.innerHTML = `
          <span class="admin-badge-dot"></span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <span>${hasSession ? 'Dashboard Admin' : 'Portal Admin'}</span>
        `;
        topBarRight.insertBefore(badge, topBarRight.firstChild);
      }
    } else {
      badge.style.display = 'inline-flex';
    }

    // Target 2: Nav Menu
    let navItem = document.getElementById('nav-admin-link');
    if (!navItem) {
      const navMenu = document.querySelector('.nav-menu');
      if (navMenu) {
        navItem = document.createElement('li');
        navItem.id = 'nav-admin-link';
        navItem.className = 'nav-item nav-item-admin';
        navItem.innerHTML = `
          <a href="${targetUrl}" class="nav-link admin-nav-highlight">
            🛡️ ${hasSession ? 'Dashboard Admin' : 'Portal Admin'}
          </a>
        `;
        navMenu.appendChild(navItem);
      }
    } else {
      navItem.style.display = '';
    }
  }

  // Handle Easter Egg Tap
  function handleSecretTap(e) {
    // PREVENT DEFAULT AGAR TIDAK RELOAD HALAMAN!
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    // Micro scale bounce feedback pada elemen yang diklik
    const targetEl = (e && (e.currentTarget || e.target)) ? (e.currentTarget || e.target) : null;
    if (targetEl) {
      targetEl.style.transition = 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)';
      targetEl.style.transform = 'scale(0.93)';
      setTimeout(() => {
        targetEl.style.transform = '';
      }, 140);
    }

    // Haptic vibration jika didukung
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch (err) {}
    }

    // Jika sudah unlocked, langsung buka modal atau portal admin
    if (isUnlocked) {
      showToast('🛡️ Portal Administrator Terbuka. Membuka opsi...', 'success', 2000);
      showAdminUnlockModal();
      renderAdminPortalBadge();
      return;
    }

    // Ambil klik tersimpan dari sessionStorage agar tahan jika terjadi interupsi
    const now = Date.now();
    let clicks = Number(sessionStorage.getItem('dsfun_easter_clicks') || 0);
    let lastTs = Number(sessionStorage.getItem('dsfun_easter_last_ts') || 0);

    // Reset jika jeda klik lebih dari 4.5 detik
    if (now - lastTs > 4500) {
      clicks = 0;
    }

    clicks++;
    sessionStorage.setItem('dsfun_easter_clicks', clicks);
    sessionStorage.setItem('dsfun_easter_last_ts', now);

    clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      sessionStorage.removeItem('dsfun_easter_clicks');
    }, 4500);

    // KETUKAN 15: UNLOCKED!
    if (clicks >= TOTAL_CLICKS) {
      isUnlocked = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        sessionStorage.setItem('app_admin_unlocked', 'true');
        sessionStorage.removeItem('dsfun_easter_clicks');
      } catch (err) {}

      showToast('🎉 Mode Developer & Akses Admin Terbuka!', 'success', 3500);
      renderAdminPortalBadge();
      showAdminUnlockModal();

      // Trigger custom event
      window.dispatchEvent(new CustomEvent('dsfun:admin_unlocked', { detail: { unlocked: true } }));
    } 
    // KETUKAN 5 s/d 14: COUNTDOWN FEEDBACK TOAST ALA ANDROID
    else if (clicks >= NOTIFY_START) {
      const remaining = TOTAL_CLICKS - clicks;
      showToast(`Tinggal ${remaining} langkah lagi untuk membuka akses Administrator`, 'info', 1800);
    }
  }

  // Attach event listeners to secret triggers
  function initEasterEggTriggers() {
    // 1. Logo in header and anywhere on the page
    const logos = document.querySelectorAll('.site-logo, .footer-logo, .brand-logo, a[href="/"] img, img[alt*="DS Fun Logistic"]');
    logos.forEach(logo => {
      logo.style.cursor = 'pointer';
      logo.style.userSelect = 'none';

      // Pastikan elemen induk <a> tidak reload halaman
      const parentA = logo.closest('a');
      if (parentA) {
        parentA.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSecretTap(e);
        }, { passive: false });
      } else {
        logo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSecretTap(e);
        }, { passive: false });
      }
    });

    // 2. Footer copyright text
    const copyrightEls = document.querySelectorAll('.footer-bottom, .footer-caption, .copyright, .footer-copy, p:has(span:contains("Hak Cipta"))');
    copyrightEls.forEach(el => {
      el.style.cursor = 'pointer';
      el.style.userSelect = 'none';
      el.addEventListener('click', (e) => {
        handleSecretTap(e);
      });
    });

    // If already unlocked on load, render badge immediately
    if (isUnlocked) {
      renderAdminPortalBadge();
    }
  }

  // Public API
  window.DSFunEasterEgg = {
    isUnlocked: () => isUnlocked,
    handleSecretTap: handleSecretTap,
    unlock: () => {
      isUnlocked = true;
      sessionStorage.setItem(STORAGE_KEY, 'true');
      sessionStorage.setItem('app_admin_unlocked', 'true');
      showToast('🎉 Mode Developer & Akses Admin Terbuka!', 'success');
      renderAdminPortalBadge();
      showAdminUnlockModal();
      window.dispatchEvent(new CustomEvent('dsfun:admin_unlocked', { detail: { unlocked: true } }));
    },
    lock: () => {
      isUnlocked = false;
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('app_admin_unlocked');
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem('dsfun_easter_clicks');
      const b = document.getElementById('header-admin-badge');
      if (b) b.remove();
      const n = document.getElementById('nav-admin-link');
      if (n) n.remove();
      const m = document.getElementById('dsfun-unlock-modal');
      if (m) m.remove();
      showToast('🔒 Mode Admin & Developer Telah Dikunci Kembali', 'info');
    },
    showToast: showToast
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEasterEggTriggers);
  } else {
    initEasterEggTriggers();
  }
})();
