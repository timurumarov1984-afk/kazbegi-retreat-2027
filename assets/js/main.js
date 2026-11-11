/* Master's Retreat — interactions (shared by every retreat site) */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Language ---------- */
  var metaDesc = document.querySelector('meta[name="description"]');
  var altImages = document.querySelectorAll('img[data-alt-en]');
  altImages.forEach(function (img) { img.dataset.altRu = img.getAttribute('alt') || ''; });

  function applyLang(lang) {
    if (lang !== 'en') lang = 'ru';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    var bd = document.body.dataset;
    if (bd.titleRu) document.title = lang === 'en' ? (bd.titleEn || bd.titleRu) : bd.titleRu;
    if (metaDesc && bd.descRu) metaDesc.setAttribute('content', lang === 'en' ? (bd.descEn || bd.descRu) : bd.descRu);
    document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
    });
    altImages.forEach(function (img) {
      img.setAttribute('alt', lang === 'en' ? img.dataset.altEn : img.dataset.altRu);
    });
    try { localStorage.setItem('lang', lang); } catch (e) { /* private mode */ }
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.dataset.setLang;
      applyLang(lang);
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url);
      } catch (e) { /* file:// or old browser */ }
    });
  });

  applyLang(root.getAttribute('data-lang') || 'ru');

  /* ---------- Where the visitor came from (utm_*) — passed on with the application ---------- */
  try {
    var qs = new URLSearchParams(location.search), utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (qs.get(k)) utm[k] = qs.get(k); });
    if (Object.keys(utm).length) sessionStorage.setItem('utm', JSON.stringify(utm));
    if (!sessionStorage.getItem('landing')) sessionStorage.setItem('landing', JSON.stringify({ page: location.pathname, ref: document.referrer || '' }));
  } catch (e) { /* private mode */ }

  /* ---------- Header state ---------- */
  var header = document.querySelector('.header');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var menu = document.getElementById('menu');
  var burger = document.querySelector('.burger');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  menu.querySelector('.menu__close').addEventListener('click', function () { setMenu(false); });
  menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealIO.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Videos: autoplay while visible ----------
     In-app browsers (Telegram, WhatsApp, Instagram) and iOS Low Power Mode block autoplay
     until the first touch. Then the hero shows a moving preview (animated AVIF) instead of a still
     frame, and every video starts on the first touch while it is on screen. */
  var autoVideos = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));
  var inView = new Map();
  var started = new Set();
  var tryPlay = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); return p; };
  autoVideos.forEach(function (video) {
    video.addEventListener('playing', function () { started.add(video); });
    if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); return; }
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        inView.set(video, entry.isIntersecting);
        if (entry.isIntersecting) {
          if (video.preload === 'none') video.preload = 'auto';
          tryPlay(video);
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.05 }).observe(video);
  });

  var unlockEvents = ['touchstart', 'touchend', 'pointerup', 'mousedown', 'keydown', 'click'];
  var unlock = function () {
    autoVideos.forEach(function (v) { if (v.paused && inView.get(v)) tryPlay(v); });
    if (started.size >= autoVideos.length) {
      unlockEvents.forEach(function (ev) { window.removeEventListener(ev, unlock, true); });
    }
  };
  if (!reduceMotion) {
    unlockEvents.forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true, capture: true }); });
  }

  /* ---------- Hero: show the video the moment it really plays ---------- */
  var heroSection = document.querySelector('.hero');
  var heroVideo = heroSection && heroSection.querySelector('video');
  if (heroVideo) {
    var heroShown = false;
    var heroPoster = heroSection.querySelector('.hero__poster');
    var showHeroVideo = function () {
      if (heroShown) return;
      heroShown = true;
      heroSection.classList.add('is-playing');
    };
    // autoplay blocked → swap the still first frame for a moving preview
    var useMotionPreview = function () {
      if (heroShown || !heroPoster || heroPoster.classList.contains('is-motion') || !heroVideo.dataset.intro) return;
      heroPoster.classList.add('is-motion');
      var mob = document.createElement('source');
      mob.type = 'image/avif';
      mob.media = '(max-aspect-ratio: 4/5)';
      mob.srcset = heroVideo.dataset.introM || heroVideo.dataset.intro || '';
      var desk = document.createElement('source');
      desk.type = 'image/avif';
      desk.srcset = heroVideo.dataset.intro || '';
      heroPoster.insertBefore(desk, heroPoster.firstChild);
      heroPoster.insertBefore(mob, desk);
    };
    heroVideo.addEventListener('playing', showHeroVideo);
    heroVideo.addEventListener('timeupdate', function () { if (heroVideo.currentTime > 0.04) showHeroVideo(); });
    if (!heroVideo.paused && heroVideo.readyState >= 3) showHeroVideo();
    if (!reduceMotion) {
      var pr = heroVideo.play();
      if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === 'NotAllowedError') useMotionPreview(); });
      setTimeout(function () { if (!heroShown && heroVideo.paused) useMotionPreview(); }, 2500);
    }
  }

  /* ---------- Hero: photo sequence with a slow drift ----------
     The first photo is in the HTML; the others load after the page (data-srcset)
     and join the loop only once they are decoded, so a slide never appears half-loaded. */
  var slides = Array.prototype.slice.call(document.querySelectorAll('.hero__slide'));
  if (slides.length > 1 && !reduceMotion) {
    var SLIDE_MS = 6500, FADE_MS = 1900;
    var current = 0;
    var ready = function (s) { var im = s.querySelector('img'); return im.complete && im.naturalWidth > 0 && !im.hasAttribute('data-srcset'); };
    var loadSlides = function () {
      slides.slice(1).forEach(function (s) {
        s.querySelectorAll('[data-srcset]').forEach(function (el) {
          el.setAttribute('srcset', el.getAttribute('data-srcset'));
          el.removeAttribute('data-srcset');
        });
        var im = s.querySelector('img');
        if (!im.getAttribute('src') && im.getAttribute('srcset')) { im.setAttribute('src', im.getAttribute('srcset').split(' ')[0]); im.removeAttribute('srcset'); }
      });
    };
    var advance = function () {
      if (document.hidden) { setTimeout(advance, SLIDE_MS); return; }
      var next = (current + 1) % slides.length;
      if (!ready(slides[next])) { setTimeout(advance, 700); return; }
      var prev = slides[current];
      prev.classList.remove('is-active');
      prev.classList.add('is-prev');
      slides[next].classList.add('is-active');
      setTimeout(function () { prev.classList.remove('is-prev'); }, FADE_MS + 100);
      current = next;
      setTimeout(advance, SLIDE_MS);
    };
    if (document.readyState === 'complete') loadSlides(); else window.addEventListener('load', loadSlides);
    setTimeout(advance, SLIDE_MS);
  }

  /* ---------- Early-bird prices: highlight the current step, count the days to the next price ---------- */
  var tiersEl = document.querySelector('[data-tiers]');
  if (tiersEl) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var tiers = Array.prototype.slice.call(tiersEl.querySelectorAll('.tier'));
    var cur = null;
    tiers.forEach(function (t) {
      var until = new Date(t.dataset.until + 'T23:59:59');
      var past = until < today;
      t.classList.toggle('is-past', past);
      t.classList.remove('is-current');
      if (!past && !cur) cur = t;
    });
    var priceEl = document.querySelector('[data-tier-price]');
    var countEl = document.querySelector('[data-tier-countdown]');
    var closedEl = document.querySelector('[data-tier-closed]');
    if (cur) {
      cur.classList.add('is-current');
      if (priceEl) priceEl.textContent = money(cur.dataset.price);
      var idx = tiers.indexOf(cur), next = tiers[idx + 1];
      var days = Math.ceil((new Date(cur.dataset.until + 'T23:59:59') - today) / 86400000);
      if (countEl && next && days <= 60) {
        countEl.innerHTML = '<span lang="ru">До повышения цены — ' + days + ' ' + ruDays(days) + '</span><span lang="en">' + days + ' day' + (days === 1 ? '' : 's') + ' until the price goes up</span>';
        countEl.hidden = false;
      }
    } else if (tiers.length) {
      var lastT = tiers[tiers.length - 1];
      if (tiersEl.dataset.after === 'closed') { if (closedEl) closedEl.hidden = false; }
      else { lastT.classList.remove('is-past'); lastT.classList.add('is-current'); if (priceEl) priceEl.textContent = money(lastT.dataset.price); }
    }
  }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function ruDays(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'день' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'дня' : 'дней'; }

  /* ---------- Gallery arrows ---------- */
  document.querySelectorAll('[data-scroll]').forEach(function (btn) {
    var track = document.querySelector(btn.dataset.target);
    if (!track) return;
    btn.addEventListener('click', function () {
      var dir = btn.dataset.scroll === 'next' ? 1 : -1;
      track.scrollBy({ left: dir * track.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Statistics: clicks on any "apply" button ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="apply.html"]');
    if (a && window.rt) window.rt('apply-click');
  });

  /* ---------- Mobile sticky CTA ---------- */
  var mcta = document.querySelector('.mcta');
  var hero = document.querySelector('.hero');
  var finalSection = document.getElementById('final');
  var footer = document.querySelector('.footer');
  if (mcta && hero && 'IntersectionObserver' in window) {
    var pastHero = false;
    var nearEnd = false;
    var update = function () {
      var show = pastHero && !nearEnd;
      mcta.classList.toggle('is-visible', show);
      mcta.setAttribute('aria-hidden', String(!show));
      mcta.querySelector('a').tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting;
      update();
    }, { threshold: 0.1 }).observe(hero);
    var visibleEnd = new Set();
    var endIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visibleEnd.add(e.target); else visibleEnd.delete(e.target);
      });
      nearEnd = visibleEnd.size > 0;
      update();
    });
    if (finalSection) endIO.observe(finalSection);
    if (footer) endIO.observe(footer);
  }

  /* ---------- Lightbox for the retreat photos ---------- */
  var lb = document.querySelector('.lightbox');
  var mosaicItems = Array.prototype.slice.call(document.querySelectorAll('.mosaic__item'));
  if (lb && mosaicItems.length) {
    var lbImg = lb.querySelector('img');
    var lbVideo = lb.querySelector('video');
    var lbCount = lb.querySelector('.lightbox__count');
    var lbIndex = 0;
    var lastFocus = null;
    var lbShow = function (i) {
      if (lbVideo) { lbVideo.pause(); lbVideo.hidden = true; lbImg.hidden = false; lb.classList.remove('is-video'); }
      lbIndex = (i + mosaicItems.length) % mosaicItems.length;
      var item = mosaicItems[lbIndex];
      lbImg.src = item.dataset.full;
      lbImg.alt = item.querySelector('img').alt;
      lbCount.textContent = (lbIndex + 1) + ' / ' + mosaicItems.length;
    };
    var lbOpen = function (i) {
      lastFocus = document.activeElement;
      lbShow(i);
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      lb.querySelector('.lightbox__close').focus();
    };
    var lbClose = function () {
      if (lbVideo) { lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load(); }
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    mosaicItems.forEach(function (item, i) {
      item.addEventListener('click', function () { lbOpen(i); });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', lbClose);
    var videoBtn = document.querySelector('[data-video]');
    if (videoBtn && lbVideo) {
      videoBtn.addEventListener('click', function () {
        lastFocus = document.activeElement;
        lbImg.hidden = true;
        lbVideo.hidden = false;
        if (videoBtn.dataset.poster) lbVideo.poster = videoBtn.dataset.poster;
        lbVideo.src = videoBtn.dataset.video;
        lbCount.textContent = '';
        lb.classList.add('is-open', 'is-video');
        lb.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        var p = lbVideo.play(); if (p && p.catch) p.catch(function () {});
        lb.querySelector('.lightbox__close').focus();
        if (window.rt) window.rt('memories-video');
      });
    }
    lb.querySelector('.lightbox__prev').addEventListener('click', function () { lbShow(lbIndex - 1); });
    lb.querySelector('.lightbox__next').addEventListener('click', function () { lbShow(lbIndex + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') lbClose();
      if (lb.classList.contains('is-video')) return;
      if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
      if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    });
    var touchX = null;
    lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null || lb.classList.contains('is-video')) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) lbShow(lbIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }
})();
