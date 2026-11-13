#!/usr/bin/env node
/* Сверка анкеты сайта с Google-формой.
   Запуск:
     node tools/check-form.mjs https://сайт/apply.html     — опубликованная анкета
     node tools/check-form.mjs _site/apply.html             — собранная локально (jekyll build)
     node tools/check-form.mjs assets/js/apply.js           — старый формат (вопросы в apply.js)
   Ничего не отправляет: читает публичную страницу формы и сравнивает её с вопросами сайта.

   Ловит то, из-за чего Google молча отклоняет заявку или теряет ответ:
   - обязательный вопрос формы, на который сайт не отвечает;
   - поле сайта, которого нет в форме;
   - вариант ответа, который не совпадает с формой слово в слово;
   - у формы появился новый раздел, а pageHistory на сайте старый.
   Код выхода 1, если есть ошибки (можно запускать по расписанию). */
import fs from 'node:fs';
import vm from 'node:vm';

const src = process.argv[2] || '_site/apply.html';

async function readSource(p) {
  if (/^https?:\/\//.test(p)) { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.text(); }
  return fs.readFileSync(p, 'utf8');
}

/* 1. Вопросы сайта */
const text = await readSource(src);
let formAction, extra, fields, presets = {}, formState = null;
const cfgMatch = text.match(/<script id="form-config" type="application\/json">([\s\S]*?)<\/script>/);
if (cfgMatch) {
  const cfg = JSON.parse(cfgMatch[1]).form;
  formAction = cfg.google_form; extra = cfg.extra || {}; presets = cfg.presets || {};
  formState = { enabled: cfg.enabled !== false, endpoint: cfg.endpoint || '' };
  fields = (cfg.steps || []).flatMap(s => s.fields || []).filter(f => f.entry);
  fields.forEach(f => { if (typeof f.options === 'string') f.options = presets[f.options] || []; });
} else {
  const a = text.indexOf('var FORM_ACTION'), b = text.indexOf('var MSG');
  if (a < 0 || b < 0) { console.error('Не нашёл настройки анкеты в ' + src); process.exit(2); }
  const ctx = {}; vm.createContext(ctx); vm.runInContext(text.slice(a, b), ctx);
  formAction = ctx.FORM_ACTION; extra = ctx.FORM_EXTRA || {};
  fields = ctx.STEPS.flatMap(s => s.fields).filter(f => f.entry).map(f => ({ ...f, show_if: f.showIf, value_if_hidden: f.valueIfHidden, legacyDerive: typeof f.derive === 'function' ? f.derive : null }));
}
const byName = Object.fromEntries(fields.map(f => [f.name, f]));

/* 2. Вопросы формы из её публичной страницы */
const view = formAction.replace(/formResponse$/, 'viewform');
const res = await fetch(view, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) check-form', 'accept-language': 'ru' } });
const html = await res.text();
const m = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s);
if (!m) { console.error(`Не удалось прочитать форму (${res.status}): ${view}`); process.exit(2); }
const data = JSON.parse(m[1]);
const items = data[1][1] || [];
const title = data[3] || data[1][8] || '';
const formQ = [];
let breaks = 0;
for (const it of items) {
  const [, qTitle, , type, entries] = it;
  if (type === 8) breaks++;
  if (!entries) continue;
  for (const e of entries) {
    formQ.push({
      entry: String(e[0]), type,
      title: String(qTitle || '').split('\n')[0].trim().slice(0, 80),
      required: e[2] === 1,
      options: (e[1] || []).filter(o => !o[4]).map(o => String(o[0])),
      hasOther: (e[1] || []).some(o => o[4])
    });
  }
}
const formBy = Object.fromEntries(formQ.map(q => [q.entry, q]));

/* 3. Сравнение */
const errors = [], warns = [];
const label = f => (f.label && String(f.label.ru || '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '')) || f.name;
function siteValues(f) {
  if (f.type === 'fixed' || f.type === 'consent') return [f.value];
  if (f.type === 'derived') {
    if (f.map) return [...Object.values(f.map), f.default].filter(Boolean);
    if (f.legacyDerive) {
      const deps = [...f.legacyDerive.toString().matchAll(/val\('([^']+)'\)/g)].map(x => x[1]);
      let combos = [{}];
      for (const d of deps) {
        const vals = ((byName[d] && byName[d].options) || []).map(o => o.v).concat(['']);
        combos = combos.flatMap(c => vals.map(v => ({ ...c, [d]: v })));
      }
      return [...new Set(combos.map(c => f.legacyDerive(n => c[n] || '')))];
    }
    return [];
  }
  const vals = (f.options || []).map(o => String(o.v));
  if (f.value_if_hidden) vals.push(f.value_if_hidden);
  return vals;
}
for (const f of fields) {
  const q = formBy[String(f.entry)];
  if (!q) { errors.push(`поле сайта «${label(f)}» (entry.${f.entry}) — такого вопроса в форме нет, ответ потеряется`); continue; }
  if ([2, 3, 4].includes(q.type) || ['consent', 'fixed', 'derived'].includes(f.type)) {
    siteValues(f).filter(v => v && !q.options.includes(v))
      .forEach(v => errors.push(`«${q.title}»: вариант «${v}» не совпадает с формой — Google отклонит заявку`));
    if (f.other && !q.hasOther) errors.push(`«${q.title}»: на сайте есть «Другое», а в форме нет`);
  }
  const auto = ['fixed', 'derived', 'consent'].includes(f.type);
  const canBeEmpty = (!f.required && !auto) || (f.show_if && !f.value_if_hidden);
  if (q.required && canBeEmpty) errors.push(`«${q.title}» обязателен в форме, а на сайте может остаться пустым — такие заявки Google отклонит`);
}
for (const q of formQ) {
  if (fields.some(f => String(f.entry) === q.entry)) continue;
  (q.required ? errors : warns).push(q.required
    ? `обязательный вопрос формы «${q.title}» (entry.${q.entry}) сайт не задаёт — Google отклонит каждую заявку`
    : `вопрос формы «${q.title}» (entry.${q.entry}) сайт не задаёт (он необязательный)`);
}
if (formState && formState.enabled && !formState.endpoint) errors.push('анкета включена (form.enabled), но приёмник не подключён (form.endpoint пуст) — заявки не уйдут; см. apps-script/README.md');
if (formState && !formState.enabled) warns.push('анкета выключена (form.enabled: false) — черновик, заявки не отправляются');
const expected = Array.from({ length: breaks + 1 }, (_, i) => i).join(',');
if (extra.pageHistory && extra.pageHistory !== expected) errors.push(`pageHistory на сайте «${extra.pageHistory}», а у формы ${breaks + 1} страниц — нужно «${expected}»`);

/* 4. Отчёт */
console.log(`Форма: ${String(title).trim()}\n${view}\nВопросов в форме: ${formQ.length} · полей на сайте: ${fields.length} · разделов: ${breaks}`);
warns.forEach(w => console.log('  ! ' + w));
errors.forEach(e => console.log('  ✗ ' + e));
console.log(errors.length ? `\nОШИБКИ: ${errors.length} — заявки могут не доходить до таблицы.` : '\n✓ Анкета совпадает с формой: все вопросы, номера полей и варианты ответов на месте.');
process.exit(errors.length ? 1 : 0);
