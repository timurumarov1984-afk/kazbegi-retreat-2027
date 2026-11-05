/* Master's Retreat · Kazbegi 2027 — interactions */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Language ---------- */
  var META = {
    ru: {
      title: 'Ретрит с Мастером Камильпашой в Казбеги · 1–18 июля 2027 · Грузия',
      desc: 'Восемнадцать дней утренних и вечерних медитаций с Мастером Камильпашой в Rooms Kazbegi — у подножия Казбека, в горах Грузии. 1–18 июля 2027, интенсив 19–21 июля.'
    },
    en: {
      title: 'Retreat with Master Kamilpasha in Kazbegi · 1–18 July 2027 · Georgia',
      desc: 'Eighteen days of morning and evening meditation with Master Kamilpasha at Rooms Kazbegi — at the foot of Mount Kazbek in the mountains of Georgia. 1–18 July 2027, intensive 19–21 July.'
    }
  };
  var metaDesc = document.querySelector('meta[name="description"]');
  var altImages = document.querySelectorAll('img[data-alt-en]');
  altImages.forEach(function (img) { img.dataset.altRu = img.getAttribute('alt') || ''; });

  function applyLang(lang) {
    if (!META[lang]) lang = 'ru';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    var bd = document.body.dataset;
    document.title = bd.titleRu ? (lang === 'en' ? bd.titleEn : bd.titleRu) : META[lang].title;
    if (metaDesc) metaDesc.setAttribute('content', META[lang].desc);
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
      if (heroShown || !heroPoster || heroPoster.classList.contains('is-motion')) return;
      heroPoster.classList.add('is-motion');
      var mob = document.createElement('source');
      mob.type = 'image/avif';
      mob.media = '(max-aspect-ratio: 4/5)';
      mob.srcset = 'assets/video/hero-intro-m.avif';
      var desk = document.createElement('source');
      desk.type = 'image/avif';
      desk.srcset = 'assets/video/hero-intro.avif';
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
        if (!im.getAttribute('src')) im.setAttribute('src', im.getAttribute('srcset').split(' ')[0]);
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

  /* ---------- Gallery arrows ---------- */
  document.querySelectorAll('[data-scroll]').forEach(function (btn) {
    var track = document.querySelector(btn.dataset.target);
    if (!track) return;
    btn.addEventListener('click', function () {
      var dir = btn.dataset.scroll === 'next' ? 1 : -1;
      track.scrollBy({ left: dir * track.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
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
    var lbCount = lb.querySelector('.lightbox__count');
    var lbIndex = 0;
    var lastFocus = null;
    var lbShow = function (i) {
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
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    mosaicItems.forEach(function (item, i) {
      item.addEventListener('click', function () { lbOpen(i); });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', lbClose);
    lb.querySelector('.lightbox__prev').addEventListener('click', function () { lbShow(lbIndex - 1); });
    lb.querySelector('.lightbox__next').addEventListener('click', function () { lbShow(lbIndex + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
      if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    });
    var touchX = null;
    lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) lbShow(lbIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }
})();
