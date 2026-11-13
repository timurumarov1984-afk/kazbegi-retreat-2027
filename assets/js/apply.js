/* Анкета участника → Google-форма.
   Вопросы и настройки — в _data/retreat.yml (раздел form), сайт кладёт их в <script id="form-config">.
   Значения вариантов (v) должны совпадать с вариантами в Google-форме слово в слово — иначе Google не примет ответ.
   Проверка: node tools/check-form.mjs <адрес или путь к apply.html>.

   Отправка:
   - если задан form.endpoint (Apps Script, см. apps-script/README.md) — заявка уходит туда; скрипт передаёт её
     в Google-форму, сохраняет копию и присылает письмо; «Спасибо» показывается только после подтверждения;
   - если endpoint пуст — заявка не отправляется: человек видит ошибку и запасные пути (почта, Telegram, Google-форма).
     «Спасибо» без подтверждённой записи сайт не показывает никогда. */
(function () {
  'use strict';

  var cfgEl = document.getElementById('form-config');
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var FORM = CFG.form || {};
  var TOKENS = CFG.tokens || {};
  var DRAFT_KEY = FORM.draft_key || 'retreat-apply';
  var PRESETS = FORM.presets || {};

  var MSG = {
    required: { ru: 'Заполни, пожалуйста, это поле', en: 'Please fill this in' },
    choose: { ru: 'Выбери вариант', en: 'Please choose an option' },
    email: { ru: 'Проверь адрес почты', en: 'Please check the email address' },
    dates: { ru: 'Дата отъезда раньше даты приезда', en: 'Departure is before arrival' },
    other: { ru: 'Напиши свой вариант', en: 'Please describe your option' },
    consent: { ru: 'Нужно принять условия участия', en: 'Please accept the terms' }
  };
  var UI = {
    step: { ru: 'Шаг', en: 'Step' }, of: { ru: 'из', en: 'of' },
    next: { ru: 'Далее', en: 'Next' }, back: { ru: 'Назад', en: 'Back' },
    submit: { ru: 'Отправить заявку', en: 'Send application' }, sending: { ru: 'Отправляем…', en: 'Sending…' },
    arrival: { ru: 'Приезд', en: 'Arrival' }, departure: { ru: 'Отъезд', en: 'Departure' },
    saved: { ru: 'Ответы сохраняются на&nbsp;этом устройстве, можно вернуться позже', en: 'Your answers are saved on this device — you can come back later' },
    otherPh: { ru: 'Твой вариант', en: 'Your option' }
  };

  /* ---------- text helpers: {tokens}, typography, [links](url) ---------- */
  var SHORT = /(^|[\s(«])(а|и|в|к|о|с|у|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|над|под|при|про|А|И|В|К|О|С|У|До|За|Из|На|Не|По|Для|При) /g;
  function fill(s, lang) {
    if (s == null) return '';
    s = String(s).replace(/\{(\w+)\}/g, function (m, k) {
      var t = TOKENS[k];
      if (t == null) return m;
      return typeof t === 'object' ? (t[lang] != null && t[lang] !== '' ? t[lang] : t.ru || '') : t;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/ — /g, '&nbsp;— ');
    if (lang !== 'en') s = s.replace(SHORT, '$1$2&nbsp;').replace(SHORT, '$1$2&nbsp;');
    return s;
  }
  function L(o) {
    if (o == null) return '';
    if (typeof o !== 'object') { var x = fill(o, 'ru'), y = fill(o, 'en'); return x === y ? x : '<span lang="ru">' + x + '</span><span lang="en">' + y + '</span>'; }
    var ru = o.ru != null ? o.ru : (o.v != null ? o.v : o.en), en = o.en != null ? o.en : ru;
    ru = fill(ru, 'ru'); en = fill(en, 'en');
    return ru === en ? ru : '<span lang="ru">' + ru + '</span><span lang="en">' + en + '</span>';
  }
  function plain(o) { return String(L(o)).replace(/<span lang="en">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function track(name) { try { if (window.rt) window.rt(name); } catch (e) { /* ignore */ } }
  var arrow = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
  var root = document.documentElement;

  /* ---------- questions from the config ---------- */
  var STEPS = (FORM.steps || []).map(function (s) {
    return {
      title: s.title, intro: s.intro,
      fields: (s.fields || []).filter(function (f) {
        if (f.type === 'note') return true;
        if (!f.entry) { if (window.console) console.info('Анкета: поле «' + (f.name || '') + '» скрыто — у него нет entry'); return false; }
        return true;
      }).map(function (f) {
        if (typeof f.options === 'string') f.options = PRESETS[f.options] || [];
        if (f.show_if) f.showIf = f.show_if;
        if (f.value_if_hidden) f.valueIfHidden = f.value_if_hidden;
        return f;
      })
    };
  }).filter(function (s) { return s.fields.length; });

  /* ---------- rendering ---------- */
  var form = $('#apply-form');
  var card = $('.form-card');
  var allFields = [];
  var dA = (CFG.dates && CFG.dates.arrival) || '', dD = (CFG.dates && CFG.dates.departure) || '';
  function shiftMonths(iso, n) { if (!iso) return ''; var d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }

  function fieldHTML(f) {
    if (f.type === 'note') return '<div class="note-box">' + L(f.text) + '</div>';
    allFields.push(f);
    if (f.type === 'derived' || f.type === 'fixed') return '';
    var id = 'f-' + f.name;
    var req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    var hint = f.hint ? '<p class="field__hint">' + L(f.hint) + '</p>' : '';
    var html = '<div class="field" data-field="' + f.name + '"' + (f.showIf ? ' hidden' : '') + '>';
    var ph = f.placeholder ? ' data-ph-ru="' + f.placeholder.ru + '" data-ph-en="' + (f.placeholder.en || f.placeholder.ru) + '" placeholder="' + f.placeholder.ru + '"' : '';

    if (f.type === 'text' || f.type === 'email') {
      html += '<label class="field__label" for="' + id + '">' + L(f.label) + req + '</label>' + hint +
        '<input class="input" id="' + id + '" name="' + f.name + '" type="' + (f.type === 'email' ? 'email' : 'text') + '"' +
        (f.autocomplete ? ' autocomplete="' + f.autocomplete + '"' : '') + (f.type === 'email' ? ' inputmode="email"' : '') + ph + '>';
    } else if (f.type === 'textarea') {
      html += '<label class="field__label" for="' + id + '">' + L(f.label) + req + '</label>' + hint +
        '<textarea class="textarea" id="' + id + '" name="' + f.name + '" rows="4"' + ph + '></textarea>';
    } else if (f.type === 'radio' || f.type === 'cards' || f.type === 'checkboxes') {
      var isBox = f.type === 'checkboxes';
      html += '<p class="field__label" id="l-' + f.name + '">' + L(f.label) + req + '</p>' + hint +
        '<div class="choices' + (f.type === 'cards' ? ' choices--cards' : '') + '" role="' + (isBox ? 'group' : 'radiogroup') + '" aria-labelledby="l-' + f.name + '">';
      (f.options || []).forEach(function (o) {
        html += '<label class="choice' + (isBox ? ' choice--box' : '') + '"><input type="' + (isBox ? 'checkbox' : 'radio') + '" name="' + f.name + '" value="' + String(o.v).replace(/"/g, '&quot;') + '"><span>' + L(o) + '</span></label>';
      });
      if (f.other) {
        html += '<label class="choice choice--box"><input type="checkbox" name="' + f.name + '" value="__other_option__" data-other><span>' + L(f.other) + '</span></label>';
      }
      html += '</div>';
      if (f.other) {
        html += '<input class="input other-input" name="' + f.name + '_other" type="text" hidden data-ph-ru="' + UI.otherPh.ru + '" data-ph-en="' + UI.otherPh.en + '" placeholder="' + UI.otherPh.ru + '">';
      }
    } else if (f.type === 'dates') {
      var mn = shiftMonths(dA, -2), mx = shiftMonths(dD, 2);
      html += '<p class="field__label" id="l-' + f.name + '">' + L(f.label) + req + '</p>' + hint +
        '<div class="dates" role="group" aria-labelledby="l-' + f.name + '">' +
        '<label><span>' + L(UI.arrival) + '</span><input class="input" type="date" name="arrival" value="' + dA + '" min="' + mn + '" max="' + mx + '"></label>' +
        '<label><span>' + L(UI.departure) + '</span><input class="input" type="date" name="departure" value="' + dD + '" min="' + mn + '" max="' + mx + '"></label>' +
        '</div>';
    } else if (f.type === 'consent') {
      html += '<label class="consent"><input type="checkbox" name="' + f.name + '" value="1"><span>' + L(f.text) + req + '</span></label>';
    }
    html += '<p class="field__error" hidden></p></div>';
    return html;
  }

  var html = '';
  STEPS.forEach(function (s, i) {
    var last = i === STEPS.length - 1;
    html += '<fieldset class="qstep' + (i === 0 ? ' is-active' : '') + '" data-step="' + i + '">' +
      '<legend class="visually-hidden">' + L(s.title) + '</legend>' +
      '<div class="step-head"><p class="step-count">' + L(UI.step) + ' ' + (i + 1) + ' ' + L(UI.of) + ' ' + STEPS.length + '</p>' +
      '<h2 tabindex="-1">' + L(s.title) + '</h2>' + (s.intro ? '<p>' + L(s.intro) + '</p>' : '') + '</div>';
    s.fields.forEach(function (f) { html += fieldHTML(f); });
    if (last) html += '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>';
    html += '<div class="form-nav">' +
      (i > 0 ? '<button type="button" class="btn btn--outline btn--back" data-back>' + arrow + L(UI.back) + '</button>' : '') +
      '<span class="form-nav__spacer"></span>' +
      (last ? '<button type="submit" class="btn btn--lg" data-submit>' + L(UI.submit) + arrow + '</button>'
            : '<button type="button" class="btn btn--lg" data-next>' + L(UI.next) + arrow + '</button>') +
      '</div><p class="saved-note">' + L(UI.saved) + '</p></fieldset>';
  });
  form.innerHTML = html;

  var nav = $('.steps-nav');
  nav.innerHTML = STEPS.map(function (s) { return '<li>' + L(s.title) + '</li>'; }).join('');

  /* ---------- values ---------- */
  function byName(n) { return allFields.filter(function (x) { return x.name === n; })[0]; }
  function getValue(f) {
    if (f.type === 'fixed') return f.value;
    if (f.type === 'derived') {
      var src = byName(f.from), sv = src ? getValue(src) : '';
      return (f.map && f.map[sv] != null) ? f.map[sv] : (f['default'] || '');
    }
    if (f.type === 'radio' || f.type === 'cards') {
      var c = form.querySelector('input[name="' + f.name + '"]:checked');
      return c ? c.value : '';
    }
    if (f.type === 'checkboxes') {
      return $$('input[name="' + f.name + '"]:checked', form).map(function (i) { return i.value; });
    }
    if (f.type === 'dates') {
      var a = form.elements.arrival.value, d = form.elements.departure.value;
      return a && d ? { a: a, d: d } : null;
    }
    if (f.type === 'consent') return form.elements[f.name].checked ? f.value : '';
    return (form.elements[f.name].value || '').trim();
  }
  function otherText(f) { var el = form.elements[f.name + '_other']; return el ? el.value.trim() : ''; }
  function isVisible(f) {
    if (!f.showIf) return true;
    var dep = byName(f.showIf.name);
    return dep && getValue(dep) === f.showIf.value;
  }
  function fmtDate(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0].slice(2); }

  function updateVisibility() {
    allFields.forEach(function (f) {
      var el = form.querySelector('[data-field="' + f.name + '"]');
      if (el) el.hidden = !isVisible(f);
      if (f.other) {
        var on = !!form.querySelector('input[name="' + f.name + '"][data-other]:checked');
        form.elements[f.name + '_other'].hidden = !on;
      }
    });
  }

  /* ---------- validation ---------- */
  function setError(f, msg) {
    var el = form.querySelector('[data-field="' + f.name + '"]');
    if (!el) return;
    var box = el.querySelector('.field__error');
    el.classList.toggle('has-error', !!msg);
    box.hidden = !msg;
    box.innerHTML = msg ? L(msg) : '';
  }
  function validateField(f) {
    if (f.type === 'fixed' || f.type === 'derived') return true;
    if (!isVisible(f)) { setError(f, null); return true; }
    var v = getValue(f), err = null;
    if (f.type === 'dates') {
      if (!v) err = MSG.required; else if (v.d < v.a) err = MSG.dates;
    } else if (f.type === 'checkboxes') {
      if (f.required && !v.length) err = MSG.choose;
      else if (v.indexOf('__other_option__') > -1 && !otherText(f)) err = MSG.other;
    } else if (f.required && !v) {
      err = f.type === 'consent' ? MSG.consent : (f.type === 'radio' || f.type === 'cards') ? MSG.choose : MSG.required;
    } else if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      err = MSG.email;
    }
    setError(f, err);
    return !err;
  }
  function validateStep(i) {
    var ok = true, first = null;
    STEPS[i].fields.forEach(function (f) {
      if (f.type === 'note' || f.type === 'derived' || f.type === 'fixed') return;
      if (!validateField(f)) { ok = false; if (!first) first = f; }
    });
    if (first) {
      var el = form.querySelector('[data-field="' + first.name + '"]');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = el.querySelector('input, textarea');
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 300);
    }
    return ok;
  }

  /* ---------- steps ---------- */
  var current = 0;
  var stepEls = $$('.qstep', form);
  var progress = $('.progress span');
  function goTo(i, focus) {
    current = i;
    stepEls.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    $$('li', nav).forEach(function (li, k) {
      li.classList.toggle('is-current', k === i);
      li.classList.toggle('is-done', k < i);
    });
    progress.style.width = ((i + 1) / STEPS.length * 100) + '%';
    var top = card.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
    if (focus) { var h = stepEls[i].querySelector('h2'); if (h) h.focus({ preventScroll: true }); }
    track('apply-step-' + (i + 1));
  }
  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-next]')) { if (validateStep(current)) goTo(current + 1, true); }
    if (e.target.closest('[data-back]')) goTo(current - 1, true);
  });

  /* ---------- draft (localStorage) ---------- */
  function saveDraft() {
    var data = {};
    $$('input, textarea', form).forEach(function (el) {
      if (!el.name || el.name === 'website') return;
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else if (el.type === 'checkbox') {
        if (!data[el.name] || !Array.isArray(data[el.name])) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
      } else data[el.name] = el.value;
    });
    data.__step = current;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  function restoreDraft() {
    var data;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { data = null; }
    if (!data) return;
    $$('input, textarea', form).forEach(function (el) {
      if (!el.name || !(el.name in data)) return;
      var v = data[el.name];
      if (el.type === 'radio') el.checked = el.value === v;
      else if (el.type === 'checkbox') el.checked = Array.isArray(v) && v.indexOf(el.value) > -1;
      else el.value = v;
    });
  }
  form.addEventListener('input', function () { updateVisibility(); saveDraft(); });
  form.addEventListener('change', function (e) {
    updateVisibility();
    var fieldEl = e.target.closest('[data-field]');
    if (fieldEl && fieldEl.classList.contains('has-error')) {
      var f = byName(fieldEl.dataset.field);
      if (f) validateField(f);
    }
    saveDraft();
  });

  /* ---------- submit ---------- */
  function buildBody() {
    var body = new URLSearchParams();
    allFields.forEach(function (f) {
      var key = 'entry.' + f.entry, visible = isVisible(f), v = visible ? getValue(f) : null;
      if (f.type === 'checkboxes') {
        if (!visible && f.valueIfHidden) body.append(key, f.valueIfHidden);
        (v || []).forEach(function (x) { body.append(key, x); });
        if (v && v.indexOf('__other_option__') > -1) body.append(key + '.other_option_response', otherText(f));
      } else if (f.type === 'dates') {
        if (v) body.append(key, fmtDate(v.a) + '-' + fmtDate(v.d));
      } else if (visible) {
        if (v) body.append(key, v);
      } else if (f.valueIfHidden) {
        body.append(key, f.valueIfHidden);
      }
    });
    var extra = FORM.extra || {};
    Object.keys(extra).forEach(function (k) { body.append(k, extra[k]); });
    return body;
  }
  // human-readable copy of the answers for the backup sheet and the email
  function readable() {
    var out = [];
    allFields.forEach(function (f) {
      if (!isVisible(f) && !f.valueIfHidden) return;
      var v = isVisible(f) ? getValue(f) : f.valueIfHidden;
      if (f.type === 'dates' && v) v = fmtDate(v.a) + ' – ' + fmtDate(v.d);
      if (Array.isArray(v)) v = v.map(function (x) { return x === '__other_option__' ? otherText(f) : x; }).join(', ');
      out.push({ name: f.name, entry: f.entry, q: f.label ? plain(f.label) : f.name, a: v == null ? '' : String(v) });
    });
    return out;
  }
  function meta() {
    var m = { page: location.href, lang: root.getAttribute('lang') || 'ru', sent: new Date().toISOString() };
    try { m.utm = JSON.parse(sessionStorage.getItem('utm') || '{}'); m.landing = JSON.parse(sessionStorage.getItem('landing') || '{}'); } catch (e) { /* ignore */ }
    var qs = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (qs.get(k)) { m.utm = m.utm || {}; m.utm[k] = qs.get(k); } });
    return m;
  }

  var states = { success: $('.form-state--success'), error: $('.form-state--error'), preview: $('.form-state--preview') };
  function showState(name) {
    form.hidden = !!name;
    Object.keys(states).forEach(function (k) { if (states[k]) states[k].hidden = k !== name; });
    if (name === 'success') {
      progress.style.width = '100%';
      $$('li', nav).forEach(function (li) { li.classList.remove('is-current'); li.classList.add('is-done'); });
    }
    var top = card.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  var sending = false;
  function done(ok) {
    sending = false;
    var btn = form.querySelector('[data-submit]');
    btn.disabled = false;
    btn.innerHTML = L(UI.submit) + arrow;
    if (ok) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
      track('apply-sent');
      showState('success');
    } else {
      track('apply-error');
      showState('error');
    }
  }
  function send() {
    if (sending) return;
    if (FORM.enabled === false) { track('apply-preview'); showState('preview'); return; }   // черновик: ничего не отправляем
    sending = true;
    var btn = form.querySelector('[data-submit]');
    btn.disabled = true;
    btn.innerHTML = L(UI.sending);
    track('apply-submit');
    var body = buildBody();
    if (FORM.endpoint) {
      // through Apps Script: it forwards to the Google Form, keeps a copy and answers with the real status
      var payload = { body: body.toString(), answers: readable(), meta: meta(), website: form.elements.website ? form.elements.website.value : '' };
      fetch(FORM.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (res) { done(!!(res && res.ok)); })
        .catch(function () { done(false); });
    } else {
      // без приёмника нельзя узнать, приняла ли форма заявку, — «спасибо» не показываем никогда
      if (window.console) console.error('Анкета: не задан form.endpoint — заявка не отправлена (см. apps-script/README.md)');
      done(false);
    }
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (validateStep(current)) send();
  });
  $('[data-retry]').addEventListener('click', function () { showState(null); goTo(STEPS.length - 1); });
  var backBtn = $('[data-back-to-form]');
  if (backBtn) backBtn.addEventListener('click', function () { showState(null); goTo(STEPS.length - 1); });

  /* ---------- language ---------- */
  var bd = document.body.dataset;
  function applyLang(lang) {
    if (lang !== 'en') lang = 'ru';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    if (bd.titleRu) document.title = lang === 'en' ? (bd.titleEn || bd.titleRu) : bd.titleRu;
    $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    $$('[data-ph-ru]').forEach(function (el) { el.placeholder = el.dataset['ph' + (lang === 'en' ? 'En' : 'Ru')]; });
    $$('img[data-alt-en]').forEach(function (img) {
      if (img.dataset.altRu == null) img.dataset.altRu = img.getAttribute('alt') || '';
      img.setAttribute('alt', lang === 'en' ? img.dataset.altEn : img.dataset.altRu);
    });
    try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
  }
  $$('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.dataset.setLang);
      try { var u = new URL(location.href); u.searchParams.set('lang', b.dataset.setLang); history.replaceState(null, '', u); } catch (e) { /* ignore */ }
    });
  });

  /* ---------- init ---------- */
  applyLang(root.getAttribute('data-lang') || 'ru');
  restoreDraft();
  updateVisibility();
  goTo(0);
  track('apply-open');
})();
