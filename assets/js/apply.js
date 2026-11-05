/* Анкета участника → отправка в Google Forms.
   Вопросы описаны в STEPS. Значения вариантов (v) должны совпадать с вариантами
   в Google-форме слово в слово — иначе Google не примет ответ. Подписи (ru/en) можно менять свободно. */
(function () {
  'use strict';

  var FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSdNdcz-bhe11F-3Ln2LerXR3q0brYlOSSoA6LhBOBS9X0bdsg/formResponse';
  var FORM_EXTRA = {
    fvv: '1',
    pageHistory: '0,1,2,3,4',
    fbzx: '-3094951576178558100',
    partialResponse: '[null,null,"-3094951576178558100"]',
    submissionTimestamp: '-1'
  };
  var RULES_URL = 'https://docs.google.com/document/d/1uhkTW_Wl2Kt01I_s67hevnbW48xrJMRSRxvOOjTfRWY/edit?usp=sharing';
  var DRAFT_KEY = 'retreat-apply-kazbegi-2027';

  var YES_NO = [{ v: 'Да', ru: 'Да', en: 'Yes' }, { v: 'Нет', ru: 'Нет', en: 'No' }];
  var TIMES = [{ v: '1' }, { v: '2' }, { v: '3' }, { v: '4' }, { v: '> 5', ru: 'Больше 5', en: 'More than 5' }];

  var STEPS = [
    {
      title: { ru: 'Личные данные', en: 'About you' },
      intro: { ru: 'Как к тебе обращаться и как связаться.', en: 'How to address you and how to reach you.' },
      fields: [
        { name: 'fullname', entry: '1866626505', type: 'text', required: true, autocomplete: 'name',
          label: { ru: 'Как тебя зовут?', en: 'What’s your name?' },
          hint: { ru: 'Имя и фамилия — как в загранпаспорте', en: 'First and last name, exactly as in your passport' },
          placeholder: { ru: 'Имя Фамилия', en: 'First name Last name' } },
        { name: 'email', entry: '150088759', type: 'email', required: true, autocomplete: 'email',
          label: { ru: 'Электронная почта для связи', en: 'Email' },
          placeholder: { ru: 'name@example.com', en: 'name@example.com' } },
        { name: 'telegram', entry: '1962739531', type: 'text', required: true,
          label: { ru: 'Telegram для связи', en: 'Telegram' },
          hint: { ru: 'Ник (например, @username) или номер телефона', en: 'Username (e.g. @username) or phone number' },
          placeholder: { ru: '@username', en: '@username' } },
        { name: 'source', entry: '1600217376', type: 'textarea', required: true,
          label: { ru: 'Откуда ты знаешь о&nbsp;ретрите с&nbsp;Мастером?', en: 'How did you hear about the retreat with the Master?' } }
      ]
    },
    {
      title: { ru: 'Опыт практики', en: 'Your practice' },
      intro: { ru: 'Это поможет нам лучше подготовиться к&nbsp;встрече.', en: 'This helps us prepare for meeting you.' },
      fields: [
        { name: 'format', entry: '1453769740', type: 'cards', required: true,
          label: { ru: 'В каком формате хочешь участвовать?', en: 'Which format would you like to join?' },
          options: [{ v: 'Оффлайн', ru: 'Офлайн — приеду в Казбеги, 11–18 июля', en: 'In person — in Kazbegi, 11–18 July' },
                    { v: 'Онлайн', ru: 'Онлайн — трансляции в Zoom, 11–18 июля', en: 'Online — live on Zoom, 11–18 July' }] },
        { name: 'offline', entry: '561608447', type: 'radio', required: true, options: YES_NO,
          label: { ru: 'Есть ли у тебя опыт офлайн-ретритов с&nbsp;Мастером?', en: 'Have you been to in-person retreats with the Master?' } },
        { name: 'offlineTimes', entry: '1333758775', type: 'radio', required: true, options: TIMES,
          showIf: { name: 'offline', value: 'Да' }, valueIfHidden: 'Не участвовал',
          label: { ru: 'Сколько раз?', en: 'How many times?' } },
        { name: 'online', entry: '114879850', type: 'radio', required: true, options: YES_NO,
          label: { ru: 'А опыт онлайн-ретритов с&nbsp;Мастером?', en: 'And online retreats with the Master?' } },
        { name: 'onlineTimes', entry: '1757094999', type: 'radio', required: true, options: TIMES,
          showIf: { name: 'online', value: 'Да' }, valueIfHidden: 'Не участвовал',
          label: { ru: 'Сколько раз?', en: 'How many times?' } },
        { name: 'regular', entry: '1456676807', type: 'radio', required: true, options: YES_NO,
          label: { ru: 'Занимаешься на&nbsp;регулярных встречах Мастера по&nbsp;понедельникам и&nbsp;четвергам?', en: 'Do you attend the Master’s regular Monday and Thursday sessions?' } },
        { name: 'regularHowLong', entry: '1320910160', type: 'radio', required: true,
          showIf: { name: 'regular', value: 'Да' }, valueIfHidden: 'Не участвую',
          label: { ru: 'Как давно?', en: 'For how long?' },
          options: [{ v: '1 месяц', en: '1 month' }, { v: '3 месяца', en: '3 months' }, { v: '6 месяцев', en: '6 months' },
                    { v: 'Больше 1 года', en: 'Over a year' }, { v: 'Больше 3 лет', en: 'Over 3 years' }] },
        { name: 'experience', entry: '8220411', type: 'textarea', required: false,
          label: { ru: 'Опиши свой опыт медитативных практик', en: 'Describe your meditation experience' },
          hint: { ru: 'Традиции, методы, сколько лет практикуешь', en: 'Traditions, methods, how long you have practised' } }
      ]
    },
    {
      title: { ru: 'Проживание', en: 'Your stay' },
      intro: { ru: 'Нужны точные даты заезда и&nbsp;выезда, даже если будешь жить не в&nbsp;Rooms Kazbegi.', en: 'We need exact arrival and departure dates, even if you stay outside Rooms Kazbegi.' },
      fields: [
        { name: 'dates', entry: '1700040031', type: 'dates', required: true,
          label: { ru: 'Когда приедешь и&nbsp;уедешь?', en: 'When will you arrive and leave?' },
          hint: { ru: 'Ретрит идёт с&nbsp;11 по&nbsp;18 июля 2027, интенсив — 19–21 июля. Заезд 10 июля с&nbsp;15:00, выезд 19 июля (или 22 июля после интенсива) до&nbsp;12:00', en: 'The retreat runs 11–18 July 2027, the intensive 19–21 July. Check-in on 10 July from 15:00, check-out on 19 July (or 22 July after the intensive) by 12:00' } },
        { name: 'stay', entry: '1508398290', type: 'cards', required: true,
          label: { ru: 'Планируешь жить в&nbsp;Rooms Kazbegi?', en: 'Are you planning to stay at Rooms Kazbegi?' },
          hint: { ru: 'Помимо лучшей кухни, в&nbsp;отеле есть бассейн и&nbsp;сауны. Для нашей группы — скидка до&nbsp;40%', en: 'Besides the best food, the hotel has a pool and saunas. Our group gets up to 40% off' },
          options: [{ v: 'Да, хочу забронировать номер', ru: 'Да, хочу забронировать номер в&nbsp;Rooms', en: 'Yes, I’d like to book a room at Rooms' },
                    { v: 'Нет, буду жить в другом месте и приходить только на практику с мастером', ru: 'Нет, буду жить в&nbsp;другом месте и&nbsp;приходить на&nbsp;практики', en: 'No, I’ll stay elsewhere and come for the sessions' }] },
        { name: 'roommate', entry: '1103524626', type: 'checkboxes', required: true,
          showIf: { name: 'stay', value: 'Да, хочу забронировать номер' }, valueIfHidden: 'Живу в другом месте',
          label: { ru: 'Будешь жить в&nbsp;номере один или вдвоём?', en: 'Will you stay alone or share a room?' },
          hint: { ru: 'Если знаешь, с&nbsp;кем хочешь жить, выбери «Другое» и&nbsp;укажи имя и&nbsp;фамилию соседа как в&nbsp;загранпаспорте', en: 'If you know who you’d like to share with, choose “Other” and give their name exactly as in their passport' },
          options: [{ v: 'Один', ru: 'Один', en: 'Alone' }, { v: 'Вдвоем', ru: 'Вдвоём', en: 'Two of us' }],
          other: { ru: 'Другое — с конкретным человеком', en: 'Other — with a specific person' } },
        { name: 'child', entry: '882413745', type: 'textarea', required: false,
          showIf: { name: 'stay', value: 'Да, хочу забронировать номер' },
          label: { ru: 'Будешь жить в&nbsp;Rooms с&nbsp;ребёнком?', en: 'Will a child stay with you at Rooms?' },
          hint: { ru: 'Если да — сколько детей и&nbsp;сколько им лет. Доплата отеля без НДС: доп. кровать — 10&nbsp;$ за&nbsp;ночь, завтрак для ребёнка 7–11 лет — 10&nbsp;$, 12+ лет — 20&nbsp;$', en: 'If so, how many children and their ages. Hotel surcharges excl. VAT: extra bed $10 per night, breakfast for a child aged 7–11 $10, 12+ $20' } },
        { name: 'roomsWait', entry: '1091618273', type: 'derived',
          derive: function (val) { return val('stay') === 'Да, хочу забронировать номер' ? 'Хочу жить в Rooms! Сообщите как появится любой свободный номер!' : 'Проживаю в другом месте'; } },
        { type: 'note',
          text: { ru: 'Номер в&nbsp;Rooms Kazbegi бронируют организаторы: передадим твои данные в&nbsp;отель. Для брони нужен депозит 10% от&nbsp;стоимости проживания за&nbsp;все дни, остаток — при заселении.',
                  en: 'The organisers book your room at Rooms Kazbegi and pass your details to the hotel. Booking needs a 10% deposit of the total stay; the rest is paid at check-in.' } }
      ]
    },
    {
      title: { ru: 'Активности и&nbsp;условия', en: 'Activities & terms' },
      intro: { ru: 'Последний шаг.', en: 'The last step.' },
      fields: [
        { name: 'kids', entry: '496575736', type: 'radio', required: true, options: YES_NO,
          label: { ru: 'Интересна детская программа?', en: 'Are you interested in the kids’ programme?' },
          hint: { ru: 'Оплачивается отдельно, около 40&nbsp;€ в&nbsp;день за&nbsp;ребёнка', en: 'Paid separately, about €40 per child per day' } },
        { name: 'kidsCount', entry: '2016769807', type: 'radio', required: false,
          showIf: { name: 'kids', value: 'Да' },
          label: { ru: 'Сколько детей будет участвовать?', en: 'How many children will take part?' },
          options: [{ v: '1 ребенок', ru: '1', en: '1' }, { v: '2 ребенка', ru: '2', en: '2' }, { v: '3 ребенка', ru: '3', en: '3' },
                    { v: '4 ребенка', ru: '4', en: '4' }, { v: '5 детей', ru: '5', en: '5' }] },
        { name: 'activitiesWanted', entry: '2093172798', type: 'radio', required: false, options: YES_NO,
          label: { ru: 'Интересны совместные активности, которые можно организовать заранее?', en: 'Interested in shared activities we can arrange in advance?' } },
        { name: 'activities', entry: '157482944', type: 'checkboxes', required: false,
          showIf: { name: 'activitiesWanted', value: 'Да' },
          label: { ru: 'Какие активности тебе интересны?', en: 'Which activities interest you?' },
          options: [{ v: 'Поездка на внедорожниках к достопримечательностям', ru: 'Поездка на&nbsp;внедорожниках к&nbsp;достопримечательностям', en: 'Off-road trip to the sights' },
                    { v: 'Конная прогулка по горам', ru: 'Конная прогулка по&nbsp;горам', en: 'Horse ride in the mountains' },
                    { v: 'Хайкинг с проводником', ru: 'Хайкинг с&nbsp;проводником', en: 'Guided hike' },
                    { v: 'Кулинарный мастеркласс', ru: 'Кулинарный мастер-класс', en: 'Cooking class' },
                    { v: 'Прогулки по ближайшим деревням', ru: 'Прогулки по&nbsp;ближайшим деревням', en: 'Walks to nearby villages' },
                    { v: 'Предложу свой вариант в чате', ru: 'Предложу свой вариант в&nbsp;чате', en: 'I’ll suggest my own in the chat' }],
          other: { ru: 'Другое', en: 'Other' } },
        { name: 'propose', entry: '1874340831', type: 'textarea', required: false,
          label: { ru: 'Хочешь предложить или провести какую-то активность?', en: 'Would you like to offer or lead an activity?' },
          hint: { ru: 'Коротко: что это и&nbsp;с&nbsp;чем нужна помощь', en: 'Briefly: what it is and what help you need' } },
        { name: 'consent', entry: '1828670316', type: 'consent', required: true,
          value: 'Я ОЗНАКОМЛЕН С УСЛОВИЯМИ УЧАСТИЯ В РЕТРИТЕ И ПРИНИМАЮ ИХ',
          text: { ru: 'Я принимаю <a href="' + RULES_URL + '" target="_blank" rel="noopener">условия участия в&nbsp;ретрите</a>',
                  en: 'I accept the <a href="' + RULES_URL + '" target="_blank" rel="noopener">retreat terms and rules</a>' } }
      ]
    }
  ];

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

  /* ---------- helpers ---------- */
  var root = document.documentElement;
  function L(o) {
    if (!o) return '';
    if (typeof o === 'string') return o;
    var ru = o.ru != null ? o.ru : o.v, en = o.en != null ? o.en : ru;
    return ru === en ? ru : '<span lang="ru">' + ru + '</span><span lang="en">' + en + '</span>';
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  var arrow = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

  /* ---------- rendering ---------- */
  var form = $('#apply-form');
  var card = $('.form-card');
  var allFields = [];

  function fieldHTML(f, stepIndex) {
    if (f.type === 'note') return '<div class="note-box">' + L(f.text) + '</div>';
    allFields.push(f);
    if (f.type === 'derived') return '';
    var id = 'f-' + f.name;
    var req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    var hint = f.hint ? '<p class="field__hint">' + L(f.hint) + '</p>' : '';
    var html = '<div class="field" data-field="' + f.name + '"' + (f.showIf ? ' hidden' : '') + '>';
    var ph = f.placeholder ? ' data-ph-ru="' + f.placeholder.ru + '" data-ph-en="' + f.placeholder.en + '" placeholder="' + f.placeholder.ru + '"' : '';

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
      f.options.forEach(function (o) {
        html += '<label class="choice' + (isBox ? ' choice--box' : '') + '"><input type="' + (isBox ? 'checkbox' : 'radio') + '" name="' + f.name + '" value="' + o.v + '"><span>' + L(o) + '</span></label>';
      });
      if (f.other) {
        html += '<label class="choice choice--box"><input type="checkbox" name="' + f.name + '" value="__other_option__" data-other><span>' + L(f.other) + '</span></label>';
      }
      html += '</div>';
      if (f.other) {
        html += '<input class="input other-input" name="' + f.name + '_other" type="text" hidden data-ph-ru="' + UI.otherPh.ru + '" data-ph-en="' + UI.otherPh.en + '" placeholder="' + UI.otherPh.ru + '">';
      }
    } else if (f.type === 'dates') {
      html += '<p class="field__label" id="l-' + f.name + '">' + L(f.label) + req + '</p>' + hint +
        '<div class="dates" role="group" aria-labelledby="l-' + f.name + '">' +
        '<label><span>' + L(UI.arrival) + '</span><input class="input" type="date" name="arrival" value="2027-07-10" min="2027-06-01" max="2027-08-31"></label>' +
        '<label><span>' + L(UI.departure) + '</span><input class="input" type="date" name="departure" value="2027-07-19" min="2027-06-01" max="2027-08-31"></label>' +
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
    s.fields.forEach(function (f) { html += fieldHTML(f, i); });
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
  function getValue(f) {
    if (f.type === 'derived') return f.derive(function (n) { var d = allFields.filter(function (x) { return x.name === n; })[0]; return d ? getValue(d) : ''; });
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
    var dep = allFields.filter(function (x) { return x.name === f.showIf.name; })[0];
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
    var box = el.querySelector('.field__error');
    el.classList.toggle('has-error', !!msg);
    box.hidden = !msg;
    box.innerHTML = msg ? L(msg) : '';
  }
  function validateField(f) {
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
      if (f.type === 'note' || f.type === 'derived') return;
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
  }
  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-next]')) { if (validateStep(current)) goTo(current + 1, true); }
    if (e.target.closest('[data-back]')) goTo(current - 1, true);
  });

  /* ---------- draft (localStorage) ---------- */
  function saveDraft() {
    var data = {};
    $$('input, textarea', form).forEach(function (el) {
      if (!el.name) return;
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
      var f = allFields.filter(function (x) { return x.name === fieldEl.dataset.field; })[0];
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
    Object.keys(FORM_EXTRA).forEach(function (k) { body.append(k, FORM_EXTRA[k]); });
    return body;
  }
  var states = { success: $('.form-state--success'), error: $('.form-state--error') };
  function showState(name) {
    form.hidden = !!name;
    Object.keys(states).forEach(function (k) { states[k].hidden = k !== name; });
    if (name === 'success') {
      progress.style.width = '100%';
      $$('li', nav).forEach(function (li) { li.classList.remove('is-current'); li.classList.add('is-done'); });
    }
    var top = card.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  var sending = false;
  function send() {
    if (sending) return;
    sending = true;
    var btn = form.querySelector('[data-submit]');
    btn.disabled = true;
    btn.innerHTML = L(UI.sending);
    fetch(FORM_ACTION, { method: 'POST', mode: 'no-cors', body: buildBody() })
      .then(function () {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        showState('success');
      })
      .catch(function () { showState('error'); })
      .then(function () {
        sending = false;
        btn.disabled = false;
        btn.innerHTML = L(UI.submit) + arrow;
      });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (validateStep(current)) send();
  });
  $('[data-retry]').addEventListener('click', function () { showState(null); goTo(STEPS.length - 1); });

  /* ---------- language ---------- */
  var TITLES = {
    ru: 'Анкета участника · Ретрит с Мастером в Казбеги · 11–18 июля 2027',
    en: 'Application · Retreat with the Master in Kazbegi · 11–18 July 2027'
  };
  function applyLang(lang) {
    if (!TITLES[lang]) lang = 'ru';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    document.title = TITLES[lang];
    $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    $$('[data-ph-ru]').forEach(function (el) { el.placeholder = el.dataset['ph' + (lang === 'en' ? 'En' : 'Ru')]; });
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
})();
