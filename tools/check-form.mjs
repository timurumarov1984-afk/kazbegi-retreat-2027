#!/usr/bin/env node
/* Сверка анкеты сайта с Google-формой.
   Запуск:  node tools/check-form.mjs [путь к apply.js]      (по умолчанию assets/js/apply.js)
   Ничего не отправляет: только читает публичную страницу формы и сравнивает её с вопросами сайта.

   Ловит то, из-за чего Google молча отклоняет заявку или теряет ответ:
   - обязательный вопрос формы, на который сайт не отвечает;
   - поле сайта, которого нет в форме;
   - вариант ответа, который не совпадает с формой слово в слово;
   - у формы появился новый раздел, а pageHistory на сайте старый.
   Код выхода 1, если есть ошибки (можно запускать по расписанию). */
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2] || 'assets/js/apply.js';
const src = fs.readFileSync(file, 'utf8');

/* 1. Вопросы сайта: выполняем только настройки анкеты (от FORM_ACTION до MSG) */
const a = src.indexOf('var FORM_ACTION'), b = src.indexOf('var MSG');
if (a < 0 || b < 0) { console.error('Не нашёл FORM_ACTION / MSG в ' + file); process.exit(2); }
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(a, b), ctx);
const fields = ctx.STEPS.flatMap(s => s.fields).filter(f => f.entry);
const byName = Object.fromEntries(ctx.STEPS.flatMap(s => s.fields).filter(f => f.name).map(f => [f.name, f]));

/* 2. Вопросы формы из её публичной страницы */
const view = ctx.FORM_ACTION.replace(/formResponse$/, 'viewform');
const res = await fetch(view, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) check-form', 'accept-language': 'ru' } });
const html = await res.text();
const m = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s);
if (!m) { console.error(`Не удалось прочитать форму (${res.status}): ${view}`); process.exit(2); }
const data = JSON.parse(m[1]);
const items = data[1][1] || [];
const title = data[3] || data[1][8] || '';
const TYPE = { 0: 'строка', 1: 'абзац', 2: 'один вариант', 3: 'список', 4: 'несколько вариантов', 5: 'шкала', 7: 'сетка', 9: 'дата', 10: 'время' };
const formQ = [];
let breaks = 0;
for (const it of items) {
  const [, qTitle, , type, entries] = it;
  if (type === 8) breaks++;
  if (!entries) continue;
  for (const e of entries) {
    formQ.push({
      entry: String(e[0]), type, page: breaks,
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
const label = f => (f.label && (f.label.ru || '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '')) || f.name;
const siteValues = f => {
  if (f.type === 'fixed') return [f.value];
  if (f.type === 'consent') return [f.value];
  if (f.type === 'derived') {
    // перебираем ответы полей, от которых зависит значение
    const deps = [...f.derive.toString().matchAll(/val\('([^']+)'\)/g)].map(x => x[1]);
    let combos = [{}];
    for (const d of deps) {
      const vals = ((byName[d] && byName[d].options) || []).map(o => o.v).concat(['']);
      combos = combos.flatMap(c => vals.map(v => ({ ...c, [d]: v })));
    }
    return [...new Set(combos.map(c => f.derive(n => c[n] || '')))];
  }
  const vals = (f.options || []).map(o => o.v);
  if (f.valueIfHidden) vals.push(f.valueIfHidden);
  return vals;
};

for (const f of fields) {
  const q = formBy[f.entry];
  if (!q) { errors.push(`поле сайта «${label(f)}» (entry.${f.entry}) — такого вопроса в форме нет, ответ потеряется`); continue; }
  if ([2, 3, 4].includes(q.type) || f.type === 'consent' || f.type === 'fixed' || f.type === 'derived') {
    const bad = siteValues(f).filter(v => v && !q.options.includes(v));
    bad.forEach(v => errors.push(`«${q.title}»: вариант «${v}» не совпадает с формой — Google отклонит заявку`));
    if (f.other && !q.hasOther) errors.push(`«${q.title}»: на сайте есть «Другое», а в форме нет`);
  }
  const canBeEmpty = (!f.required && !['fixed', 'derived', 'consent'].includes(f.type)) || (f.showIf && !f.valueIfHidden);
  if (q.required && canBeEmpty) errors.push(`«${q.title}» обязателен в форме, а на сайте может остаться пустым — такие заявки Google отклонит`);
}
for (const q of formQ) {
  if (fields.some(f => f.entry === q.entry)) continue;
  (q.required ? errors : warns).push(q.required
    ? `обязательный вопрос формы «${q.title}» (entry.${q.entry}) сайт не задаёт — Google отклонит каждую заявку`
    : `вопрос формы «${q.title}» (entry.${q.entry}) сайт не задаёт (он необязательный)`);
}
const ph = ctx.FORM_EXTRA && ctx.FORM_EXTRA.pageHistory;
const expected = Array.from({ length: breaks + 1 }, (_, i) => i).join(',');
if (ph && ph !== expected) errors.push(`pageHistory на сайте «${ph}», а у формы ${breaks + 1} страниц — нужно «${expected}»`);

/* 4. Отчёт */
console.log(`Форма: ${title.trim()}\n${view}\nВопросов в форме: ${formQ.length} · полей на сайте: ${fields.length} · разделов: ${breaks}`);
warns.forEach(w => console.log('  ! ' + w));
errors.forEach(e => console.log('  ✗ ' + e));
console.log(errors.length ? `\nОШИБКИ: ${errors.length} — заявки могут не доходить до таблицы.` : '\n✓ Анкета совпадает с формой: все вопросы, номера полей и варианты ответов на месте.');
process.exit(errors.length ? 1 : 0);
