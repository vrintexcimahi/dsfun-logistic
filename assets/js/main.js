// ==========================================================
// DS FUN LOGISTIC MAIN JAVASCRIPT
// ==========================================================

// Ensure Easter Egg module is loaded
(function ensureEasterEgg() {
  if (!window.DSFunEasterEgg && !document.querySelector('script[src*="easter-egg.js"]')) {
    const script = document.createElement('script');
    script.src = 'assets/js/easter-egg.js?v=3.1';
    document.head.appendChild(script);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        navMenu.classList.remove('open');
      }
    });

    // Submenu toggle on mobile
    const dropdownItems = navMenu.querySelectorAll('.nav-item.has-children');
    dropdownItems.forEach(item => {
      const link = item.querySelector('.nav-link');
      if (link) {
        link.addEventListener('click', (e) => {
          if (window.innerWidth <= 900) {
            e.preventDefault();
            item.classList.toggle('open');
          }
        });
      }
    });
  }

  // ==========================================================
  // CMS DYNAMIC SYNCHRONIZATION (Show/Hide Menu, Banners, etc.)
  // ==========================================================
  async function syncCMSContent() {
    let config = null;

    // 1. Try local storage first for zero-latency instant render
    try {
      const local = localStorage.getItem('dsfun_cms_config');
      if (local) config = JSON.parse(local);
    } catch (e) {}

    // Apply immediate local config if available
    if (config) {
      applyCMSConfig(config);
    }

    // 2. Fetch fresh config from backend server
    try {
      const resp = await fetch('/api/admin/content?t=' + Date.now());
      if (resp.ok) {
        const remoteConfig = await resp.json();
        localStorage.setItem('dsfun_cms_config', JSON.stringify(remoteConfig));
        applyCMSConfig(remoteConfig);
      }
    } catch (e) {
      // Offline / fallback to local
    }
  }

  function applyCMSConfig(config) {
    if (!config) return;

    // 1. Apply Show / Hide Menu
    if (config.menus && Array.isArray(config.menus)) {
      const navItems = document.querySelectorAll('.nav-menu .nav-item');
      navItems.forEach(item => {
        // Skip admin highlight item if present
        if (item.classList.contains('nav-item-admin')) return;

        const link = item.querySelector('.nav-link');
        if (!link) return;
        const href = (link.getAttribute('href') || '').toLowerCase().trim();

        // Match against CMS menu config
        const match = config.menus.find(m => {
          const mUrl = m.url.toLowerCase();
          if (mUrl === '/' && (href === '/' || href === 'index.html' || href === '')) return true;
          return href.includes(mUrl) || mUrl.includes(href);
        });

        if (match) {
          if (match.visible === false) {
            item.style.setProperty('display', 'none', 'important');
          } else {
            item.style.removeProperty('display');
            // Update custom label if modified
            const textNode = Array.from(link.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
            if (textNode && match.label) {
              textNode.textContent = match.label + ' ';
            }
          }
        }
      });
    }

    // 2. Apply Contact & CS WhatsApp
    if (config.contact && config.contact.cs_whatsapp) {
      const cleanWA = config.contact.cs_whatsapp.replace(/\D/g, '');
      const waButtons = document.querySelectorAll('a[href*="whatsapp.com"], a.btn-header-wa, a.floating-wa-btn');
      waButtons.forEach(btn => {
        let href = btn.getAttribute('href') || '';
        if (href.includes('phone=')) {
          href = href.replace(/phone=\d+/, 'phone=' + cleanWA);
          btn.setAttribute('href', href);
        }
      });
    }

    // 3. Apply Top Bar Info
    if (config.contact) {
      const topBarItems = document.querySelectorAll('.top-bar-item');
      topBarItems.forEach(it => {
        const text = it.textContent || '';
        if (text.includes('Call Center') && config.contact.call_center) {
          it.querySelector('span').textContent = `Call Center: ${config.contact.call_center}`;
        }
        const emailLink = it.querySelector('a[href^="mailto:"]');
        if (emailLink && config.contact.email) {
          emailLink.setAttribute('href', `mailto:${config.contact.email}`);
          emailLink.textContent = config.contact.email;
        }
      });
    }
    // 4. Apply Hero Banners (Active/Inactive, Title, Links)
    if (config.banners && Array.isArray(config.banners)) {
      const slideEls = document.querySelectorAll('.hero-slide');
      config.banners.forEach((b, idx) => {
        const slide = slideEls[idx];
        if (slide) {
          if (b.active === false) {
            slide.style.display = 'none';
          } else {
            slide.style.display = '';
          }
          if (b.title) {
            slide.setAttribute('data-title', b.title);
          }
          const link = slide.querySelector('.hero-slide-link');
          if (link && b.link) {
            link.setAttribute('href', b.link);
          }
        }
      });
      if (typeof window.dsfunRefreshSlider === 'function') {
        window.dsfunRefreshSlider();
      }
    }

    // 5. Apply Alerts & Warnings
    if (config.alerts) {
      const penipuanStrong = Array.from(document.querySelectorAll('strong')).find(s => s.textContent.includes('Waspada Penipuan'));
      if (penipuanStrong) {
        const card = penipuanStrong.closest('div');
        if (card) {
          if (config.alerts.show_warning_penipuan === false) {
            card.style.display = 'none';
          } else {
            card.style.display = '';
            const p = card.querySelector('p');
            if (p && config.alerts.warning_text) {
              p.textContent = config.alerts.warning_text;
            }
          }
        }
      }

      const pungliImg = document.querySelector('img[alt*="Anti Pungli"], img[alt*="Bebas Pungli"]');
      if (pungliImg) {
        const wrap = pungliImg.closest('.anti-pungli-wrap, .banner-anti-pungli') || pungliImg;
        if (config.alerts.show_bebas_pungli === false) {
          wrap.style.display = 'none';
        } else {
          wrap.style.display = '';
        }
      }
    }

    // 6. Apply Rates Policy
    if (config.rates_config) {
      const quickBrt = document.getElementById('quickBrt');
      if (quickBrt && config.rates_config.min_weight_kg) {
        quickBrt.min = config.rates_config.min_weight_kg;
      }
    }

    // 7. Apply Footer Contact
    if (config.contact && config.contact.address) {
      const addrSpan = document.querySelector('.footer-contact-item span');
      if (addrSpan) addrSpan.textContent = config.contact.address;
    }
  }

  // Execute CMS Sync
  syncCMSContent();

  // ==========================================================
  // HERO SLIDER CAROUSEL
  // ==========================================================
  const sliderWrap = document.querySelector('.hero-slider-wrap');
  const slider = document.querySelector('.hero-slider');
  let slides = document.querySelectorAll('.hero-slide');
  const prevBtn = document.querySelector('.slider-prev');
  const nextBtn = document.querySelector('.slider-next');
  const dotsContainer = document.querySelector('.slider-dots');

  if (slider && slides.length > 0) {
    let currentSlide = 0;
    let autoSlideInterval;

    function getActiveSlides() {
      return Array.from(document.querySelectorAll('.hero-slide')).filter(s => s.style.display !== 'none');
    }

    function initSliderControls() {
      const activeSlides = getActiveSlides();
      if (activeSlides.length === 0) return;

      if (dotsContainer) {
        dotsContainer.innerHTML = '';
        activeSlides.forEach((slide, idx) => {
          const title = slide.getAttribute('data-title') || `Slide ${idx + 1}`;
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `slider-pill ${idx === 0 ? 'active' : ''}`;
          pill.setAttribute('aria-label', title);
          pill.innerHTML = `<span class="pill-text">${title}</span>`;
          pill.addEventListener('click', () => goToSlide(idx));
          dotsContainer.appendChild(pill);
        });
      }
      updateSlider();
    }

    function updateSlider() {
      const activeSlides = getActiveSlides();
      if (activeSlides.length === 0) return;

      if (currentSlide >= activeSlides.length) currentSlide = 0;
      if (currentSlide < 0) currentSlide = activeSlides.length - 1;

      activeSlides.forEach((slide, idx) => {
        if (idx === currentSlide) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });

      const pills = document.querySelectorAll('.slider-pill, .slider-dot');
      pills.forEach((p, idx) => {
        p.classList.toggle('active', idx === currentSlide);
      });
    }

    function goToSlide(idx) {
      const activeSlides = getActiveSlides();
      if (activeSlides.length === 0) return;
      currentSlide = (idx + activeSlides.length) % activeSlides.length;
      updateSlider();
      resetAutoSlide();
    }

    function nextSlide() {
      goToSlide(currentSlide + 1);
    }

    function prevSlide() {
      goToSlide(currentSlide - 1);
    }

    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    function startAutoSlide() {
      clearInterval(autoSlideInterval);
      autoSlideInterval = setInterval(nextSlide, 5000);
    }

    function resetAutoSlide() {
      clearInterval(autoSlideInterval);
      startAutoSlide();
    }

    if (sliderWrap) {
      sliderWrap.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
      sliderWrap.addEventListener('mouseleave', startAutoSlide);
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });

    initSliderControls();
    startAutoSlide();

    window.dsfunRefreshSlider = function() {
      initSliderControls();
    };
  }

  // Quick Widget Tabs
  const tabBtns = document.querySelectorAll('.widget-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Back to Top Button
  const backToTopBtn = document.querySelector('.back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 350) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Contact Form Submission (if present on page)
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Mengirim Pesan...';

      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const resp = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const res = await resp.json();
        alert(res.message || 'Pesan Anda berhasil dikirim!');
        contactForm.reset();
      } catch (err) {
        alert('Terima kasih! Pesan Anda telah diterima oleh Customer Service DS Fun Logistic.');
        contactForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }
});
