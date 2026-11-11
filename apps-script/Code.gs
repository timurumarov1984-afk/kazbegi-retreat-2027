/**
 * Приёмник заявок с сайта ретрита (Google Apps Script).
 * Устанавливается на почте ретрита, которой принадлежит Google-форма. Инструкция — apps-script/README.md.
 *
 * Что делает с каждой заявкой:
 *  1. передаёт ответы в Google-форму и проверяет, что ответ действительно появился в форме;
 *  2. сохраняет копию в лист «Заявки с сайта» (даже если форма ответ не приняла);
 *  3. присылает письмо с заявкой на почту ретрита; если форма ответ не приняла — письмо с пометкой ⚠;
 *  4. сообщает сайту настоящий результат: «спасибо» человек видит, только когда заявка сохранена.
 * Раз в день (dailyCheck) сверяет вопросы формы с анкетой на сайте и число заявок за сутки.
 */

/* ======================= НАСТРОЙКИ: заполнить один раз ======================= */
var CONFIG = {
  // Ссылка на РЕДАКТИРОВАНИЕ формы (адрес из строки браузера, когда форма открыта в режиме редактора)
  FORM_EDIT_URL: 'https://docs.google.com/forms/d/…/edit',
  // Куда присылать заявки и предупреждения (можно несколько через запятую)
  NOTIFY_EMAIL: 'kazbegi.retreat@gmail.com',
  // Адрес сайта ретрита со слешем в конце — для ежедневной сверки анкеты с формой
  SITE_URL: 'https://…/',
  // Название ретрита — в теме писем
  RETREAT: 'Казбеги 2027',
  // Лист с копиями заявок (создаётся сам в таблице ответов формы)
  BACKUP_SHEET: 'Заявки с сайта'
};
/* ============================================================================ */

function doPost(e) {
  var started = new Date();
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad request' });
  }
  if (data.website) return json_({ ok: true }); // спам-ловушка: настоящие люди это поле не видят

  var answers = data.answers || [];
  var meta = data.meta || {};
  var email = valueOf_(answers, 'email');
  var name = valueOf_(answers, 'fullname');
  var lock = LockService.getScriptLock();
  var formOk = false, formNote = '', backupOk = false, mailOk = false;

  try {
    lock.waitLock(30000);
    var form = FormApp.openByUrl(CONFIG.FORM_EDIT_URL);
    var res = UrlFetchApp.fetch(formResponseUrl_(form), {
      method: 'post',
      payload: data.body || '',
      contentType: 'application/x-www-form-urlencoded; charset=utf-8',
      followRedirects: true,
      muteHttpExceptions: true
    });
    formNote = 'HTTP ' + res.getResponseCode();
    formOk = res.getResponseCode() === 200 && waitForResponse_(form, started, email, name);
    if (!formOk && res.getResponseCode() === 200) formNote += ', ответа нет в форме';
  } catch (err) {
    formNote = 'ошибка: ' + err;
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ignore */ }
  }

  try { backup_(started, answers, meta, formOk, formNote); backupOk = true; } catch (err) { formNote += ' · копия не сохранилась: ' + err; }
  try { mail_(answers, meta, formOk, formNote, name); mailOk = true; } catch (err) { /* письмо не ушло */ }

  // Заявка не потеряна, если она есть в форме, или в копии, или в письме
  return json_({ ok: formOk || backupOk || mailOk, form: formOk });
}

function doGet() {
  return json_({ ok: true, service: 'retreat-applications', retreat: CONFIG.RETREAT });
}

/* ---------- проверка, что ответ появился в форме ---------- */
function waitForResponse_(form, since, email, name) {
  var needle = String(email || name || '').toLowerCase();
  var from = new Date(since.getTime() - 5000);
  for (var i = 0; i < 8; i++) {
    var list = form.getResponses(from);
    for (var r = list.length - 1; r >= 0; r--) {
      if (!needle) return true;
      var items = list[r].getItemResponses();
      for (var k = 0; k < items.length; k++) {
        var v = items[k].getResponse();
        if (String(v).toLowerCase().indexOf(needle) > -1) return true;
      }
    }
    Utilities.sleep(1000);
  }
  return false;
}

function formResponseUrl_(form) {
  return form.getPublishedUrl().replace(/\/viewform.*$/, '/formResponse');
}

/* ---------- копия заявки в таблицу ---------- */
function backup_(when, answers, meta, formOk, formNote) {
  var sheet = backupSheet_();
  var header = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var base = ['Получена', 'В форме', 'Примечание', 'Язык', 'Источник (utm)', 'Страница входа'];
  if (sheet.getLastRow() === 0 || header[0] !== base[0]) {
    header = base.concat(answers.map(function (a) { return a.q; }));
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var utm = meta.utm ? Object.keys(meta.utm).map(function (k) { return k.replace('utm_', '') + '=' + meta.utm[k]; }).join(' ') : '';
  var landing = meta.landing ? (meta.landing.page || '') + (meta.landing.ref ? ' ← ' + meta.landing.ref : '') : '';
  var row = [when, formOk ? 'да' : 'НЕТ', formNote, meta.lang || '', utm, landing];
  answers.forEach(function (a) {
    var col = header.indexOf(a.q);
    if (col < 0) { header.push(a.q); col = header.length - 1; sheet.getRange(1, col + 1).setValue(a.q).setFontWeight('bold'); }
    row[col] = a.a;
  });
  sheet.appendRow(row);
}

function backupSheet_() {
  var form = FormApp.openByUrl(CONFIG.FORM_EDIT_URL);
  var ss;
  try {
    ss = SpreadsheetApp.openById(form.getDestinationId());
  } catch (err) {
    ss = SpreadsheetApp.create('Заявки с сайта · ' + CONFIG.RETREAT);
  }
  return ss.getSheetByName(CONFIG.BACKUP_SHEET) || ss.insertSheet(CONFIG.BACKUP_SHEET);
}

/* ---------- письмо организаторам ---------- */
function mail_(answers, meta, formOk, formNote, name) {
  var rows = answers.map(function (a) {
    return '<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">' + esc_(a.q) + '</td><td style="padding:6px 0"><b>' + esc_(a.a) + '</b></td></tr>';
  }).join('');
  var warn = formOk ? '' :
    '<p style="padding:12px;background:#fff3cd;border-radius:8px"><b>⚠ Google-форма не приняла эту заявку</b> (' + esc_(formNote) + '). ' +
    'Она сохранена в листе «' + CONFIG.BACKUP_SHEET + '» и в этом письме. Скорее всего, в форме поменяли вопрос или вариант ответа — ' +
    'сверьте форму с сайтом (node tools/check-form.mjs) и внесите эту заявку в таблицу вручную.</p>';
  var utm = meta.utm ? Object.keys(meta.utm).map(function (k) { return k + '=' + meta.utm[k]; }).join(', ') : '—';
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: (formOk ? '' : '⚠ ') + 'Заявка · ' + CONFIG.RETREAT + ' · ' + (name || 'без имени'),
    htmlBody: warn + '<table style="border-collapse:collapse;font:14px/1.5 sans-serif">' + rows + '</table>' +
      '<p style="color:#888;font:12px sans-serif">Язык: ' + esc_(meta.lang || '') + ' · utm: ' + esc_(utm) + ' · ' + esc_(meta.page || '') + '</p>'
  });
}

/* ---------- ежедневная сверка ---------- */
function dailyCheck() {
  var problems = [];
  try { problems = problems.concat(compareFormWithSite_()); } catch (err) { problems.push('Не удалось сверить форму с сайтом: ' + err); }
  try {
    var since = new Date(Date.now() - 24 * 3600 * 1000);
    var sheet = backupSheet_();
    var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
    var day = rows.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
    var notInForm = day.filter(function (r) { return r[1] !== 'да'; }).length;
    if (notInForm) problems.push('За сутки ' + notInForm + ' из ' + day.length + ' заявок с сайта не попали в форму — они есть в листе «' + CONFIG.BACKUP_SHEET + '».');
  } catch (err) { problems.push('Не удалось проверить заявки за сутки: ' + err); }
  if (problems.length) {
    MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: '⚠ Анкета на сайте · ' + CONFIG.RETREAT, body: problems.join('\n\n') });
  }
  return problems;
}

/* Сравнивает вопросы опубликованной анкеты (apply.html) с вопросами Google-формы */
function compareFormWithSite_() {
  var html = UrlFetchApp.fetch(CONFIG.SITE_URL + 'apply.html', { muteHttpExceptions: true }).getContentText();
  var m = html.match(/<script id="form-config" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return ['На странице анкеты нет настроек формы: ' + CONFIG.SITE_URL + 'apply.html'];
  var cfg = JSON.parse(m[1]).form;
  var presets = cfg.presets || {};
  var fields = [];
  (cfg.steps || []).forEach(function (s) { (s.fields || []).forEach(function (f) { if (f.entry) fields.push(f); }); });

  var view = UrlFetchApp.fetch(cfg.google_form.replace(/formResponse$/, 'viewform'), { muteHttpExceptions: true }).getContentText();
  var d = view.match(/FB_PUBLIC_LOAD_DATA_ = ([\s\S]*?);<\/script>/);
  if (!d) return ['Не удалось открыть Google-форму: ' + cfg.google_form];
  var items = JSON.parse(d[1])[1][1] || [];
  var formQ = {}, pages = 1;
  items.forEach(function (it) {
    if (it[3] === 8) pages++;
    (it[4] || []).forEach(function (e) {
      formQ[String(e[0])] = { title: String(it[1] || '').split('\n')[0].slice(0, 80), type: it[3], required: e[2] === 1,
        options: (e[1] || []).filter(function (o) { return !o[4]; }).map(function (o) { return String(o[0]); }) };
    });
  });

  var out = [];
  fields.forEach(function (f) {
    var q = formQ[String(f.entry)];
    if (!q) { out.push('Поле сайта «' + f.name + '» (entry.' + f.entry + ') — такого вопроса в форме нет.'); return; }
    var opts = typeof f.options === 'string' ? (presets[f.options] || []) : (f.options || []);
    var vals = opts.map(function (o) { return String(o.v); });
    if (f.value_if_hidden) vals.push(f.value_if_hidden);
    if (f.type === 'fixed' || f.type === 'consent') vals = [f.value];
    if (f.type === 'derived') { vals = Object.keys(f.map || {}).map(function (k) { return f.map[k]; }); if (f['default']) vals.push(f['default']); }
    if ([2, 3, 4].indexOf(q.type) > -1) vals.forEach(function (v) { if (v && q.options.indexOf(v) < 0) out.push('«' + q.title + '»: вариант «' + v + '» не совпадает с формой.'); });
  });
  Object.keys(formQ).forEach(function (id) {
    var q = formQ[id];
    if (q.required && !fields.some(function (f) { return String(f.entry) === id; })) out.push('Обязательный вопрос формы «' + q.title + '» сайт не задаёт.');
  });
  var ph = (cfg.extra || {}).pageHistory;
  var want = []; for (var i = 0; i < pages; i++) want.push(i);
  if (ph && ph !== want.join(',')) out.push('pageHistory на сайте «' + ph + '», нужно «' + want.join(',') + '».');
  return out;
}

/* ---------- установка: запустить один раз ---------- */
function setup() {
  var form = FormApp.openByUrl(CONFIG.FORM_EDIT_URL);
  backupSheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).create();
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'Приёмник заявок подключён · ' + CONFIG.RETREAT,
    'Форма: ' + form.getTitle() + '\nКопии заявок — в листе «' + CONFIG.BACKUP_SHEET + '».\nСверка анкеты с формой — каждый день около 9:00.');
}

/* ---------- мелочи ---------- */
function valueOf_(answers, name) {
  for (var i = 0; i < answers.length; i++) if (answers[i].name === name) return answers[i].a;
  return '';
}
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
