/* Занятие 4. Data Dictionary и описание таблиц: зачем словарь и кто его читает, карточка поля, заполнение словаря
   для таблицы билетов, ошибки в чужом словаре, перечисления статусов, именование, персональные данные,
   описание поля своими словами. Ключ преподавателя — _dev/key/40-dict.md. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'dict';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .d4-card{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr);border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface)}
  .d4-card>button{all:unset;display:contents;cursor:pointer}
  .d4-card .k,.d4-card .v{padding:7px 12px;border-bottom:1px solid var(--border);font-size:13px}
  .d4-card .k{background:var(--surface-2);color:var(--text-2);font-weight:600}
  .d4-card .v{font-family:var(--f-mono);font-size:12.5px}
  .d4-card>div{display:contents}
  .d4-card button.on .k,.d4-card button.on .v,.d4-card .d4-r.on .k,.d4-card .d4-r.on .v{background:color-mix(in srgb,var(--accent) 16%,var(--surface))}
  .d4-grid{display:grid;gap:6px}
  .d4-row{display:grid;grid-template-columns:minmax(110px,150px) repeat(3,minmax(0,1fr));gap:6px;align-items:center;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2)}
  .d4-row code{font-size:12.5px}.d4-row select{width:100%;min-width:0}
  .d4-row select.ok{border-color:var(--ok)}.d4-row select.bad{border-color:var(--bad)}
  .d4-head{font:600 11px var(--f-mono);color:var(--text-muted);text-transform:uppercase;background:none;border:0}
  @media (max-width:640px){.d4-row{grid-template-columns:1fr 1fr}.d4-row code{grid-column:1/-1}.d4-head{display:none}.d4-card{grid-template-columns:1fr}}
  </style>`);

  // =====================================================================
  // Теория 1. Карточка поля
  const CARD = [
    ['Поле', 'screening.starts_at', 'Имя в базе: таблица.столбец, snake_case. По нему разработчик пишет код, а аналитик данных — запросы.'],
    ['Название', 'Начало сеанса', 'Как поле называют люди. Его увидит Нина Сергеевна и поддержка.'],
    ['Тип', 'TIMESTAMPTZ', 'Тип с поясом — кинотеатры в двух часовых поясах. Тип сразу отвечает на вопросы «можно ли сравнивать», «есть ли время».'],
    ['Обязательность', 'NOT NULL', 'Сеанс без времени не бывает. Обязательность — первое, о чём спросит тестировщик.'],
    ['Ключ / связь', '—', 'Не ключ. Для внешних ключей здесь пишут «FK → film.id, ON DELETE RESTRICT».'],
    ['Значение по умолчанию', 'нет', 'Явно «нет» — значит, приложение обязано передать значение.'],
    ['Допустимые значения', 'не раньше текущего момента при создании; шаг 5 минут', 'Ограничения и правила формата. Для перечислений — полный список значений с расшифровкой.'],
    ['Бизнес-правило', 'BR-07: сеансы одного зала не пересекаются с учётом длительности фильма и 15 минут уборки', 'Связь с требованиями: откуда это правило и где оно проверяется (база, приложение, отчёт качества).'],
    ['Источник', 'Нина Сергеевна, экран «Расписание»', 'Кто и где создаёт значение. Помогает при спорах «откуда взялась эта цифра».'],
    ['Пример', '2027-03-14 20:00:00+05', 'Пример снимает половину вопросов разработчика.'],
    ['Персональные данные', 'нет', 'Отметка для безопасности и юристов: что маскировать в логах, что удалять по запросу.'],
    ['Кто меняет', 'программный директор; после продажи билетов — только с уведомлением покупателей', 'Права и последствия изменения.']
  ];
  const howDd = {
    id: 'how-dd', title: 'Как это работает: словарь данных и карточка поля', covers: ['fill', 'bugs'], free: true, noReset: true,
    simple: { icon: '📘', plain: '<b>Словарь данных</b> (Data Dictionary) — описание каждой таблицы и каждого поля: что это, какого типа, обязательно ли, какие значения допустимы, откуда берётся и по какому правилу. ERD показывает картину целиком, словарь — подробности, без которых нельзя написать код и тесты.', analogy: 'ERD — карта города, словарь — справочник с адресами, часами работы и правилами парковки.', tech: 'Паспорт таблицы: назначение, владелец, объём и рост, срок хранения, ключи и индексы. Карточка поля: имя, тип, NULL, ключ, DEFAULT, домен, бизнес-правило, источник, пример, ПДн. Читатели — разработка, QA, аналитики данных, поддержка, безопасность.' },
    lead: ui.brief({ situation: 'Карточка одного поля из словаря «Кадра».', todo: ['Нажимайте на строки карточки — увидите, зачем каждая и кто её читает.', 'Откройте хотя бы шесть строк.'], look: 'Какие строки снимают вопросы разработчика, а какие — тестировщика.' }),
    render(el, ctx) {
      const a = ctx.ans; a.seen = a.seen || {};
      const draw = () => { el.innerHTML = `<div class="stack"><div class="d4-card">${CARD.map((r, i) => `<button type="button" class="${a.last === i ? 'on' : ''}" data-c="${i}"><span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span></button>`).join('')}</div><div class="qp-note">${a.last != null ? `<b>${esc(CARD[a.last][0])}.</b> ${esc(CARD[a.last][2])}` : 'Нажмите на строку карточки.'}</div></div>`; };
      TR.on(el, 'click', '[data-c]', (e, b) => { a.last = +b.dataset.c; a.seen[a.last] = 1; ctx.save(); draw(); if (Object.keys(a.seen).length >= 6) ctx.ready(); });
      draw();
      if (ctx.readonly || Object.keys(a.seen).length >= 6) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Словарь для ticket
  const TYPES = [['bigint', 'BIGINT'], ['num', 'NUMERIC(8,2)'], ['enum', 'VARCHAR + CHECK'], ['tstz', 'TIMESTAMPTZ'], ['int', 'INTEGER'], ['text', 'TEXT']];
  const NULLS = [['nn', 'NOT NULL'], ['null', 'NULL допустим']];
  const KEYS = [['pk', 'PK'], ['fk', 'FK'], ['none', '—']];
  const FIELDS = [
    { f: 'id', ty: 'bigint', nl: 'nn', k: 'pk', because: 'Суррогатный ключ большой таблицы: BIGINT, обязателен, PK.' },
    { f: 'order_id', ty: 'bigint', nl: 'nn', k: 'fk', because: 'Билет всегда в заказе: FK → orders.id, обязателен. Тип совпадает с типом orders.id.' },
    { f: 'screening_id', ty: 'bigint', nl: 'nn', k: 'fk', because: 'FK → screening.id, обязателен: билет без сеанса не бывает.' },
    { f: 'seat_id', ty: 'bigint', nl: 'nn', k: 'fk', because: 'FK → seat.id, обязателен: билет — это место.' },
    { f: 'price', ty: 'num', nl: 'nn', k: 'none', because: 'Деньги — NUMERIC, обязательна; 0 — пригласительный, а не «пусто».' },
    { f: 'status', ty: 'enum', nl: 'nn', k: 'none', because: 'Перечисление hold / active / used / refunded / cancelled, обязателен, по умолчанию hold.' },
    { f: 'hold_until', ty: 'tstz', nl: 'null', k: 'none', because: 'Срок брони есть только у брони — у проданного билета пусто. Поэтому NULL допустим.' },
    { f: 'refunded_at', ty: 'tstz', nl: 'null', k: 'none', because: 'Момент возврата есть только у возвращённых билетов. Сделаете NOT NULL — не продадите ни одного билета.' }
  ];
  const CONSEQ = {
    nl: { nn: f => `NOT NULL у <code>${f}</code>: при продаже билета значения ещё нет — база не даст записать ни один действующий билет.`, null: f => `NULL у <code>${f}</code>: база пропустит билет без значения — например, без цены или без места. Выручка с NULL превращается в «неизвестно», а схема зала — в загадку.` },
    k: { pk: f => `PK на <code>${f}</code>: значение должно быть уникальным — у двух билетов одного заказа или сеанса так не получится.`, fk: f => `FK на <code>${f}</code>: ссылаться не на что — это не номер строки другой таблицы.`, none: f => `Без ключа у <code>${f}</code>: ${f === 'id' ? 'строку нечем однозначно найти' : 'база не проверит, что такая строка существует — появятся билеты на несуществующие сеансы'}.` },
    ty: { real: '', text: f => `TEXT у <code>${f}</code>: ни сравнить, ни сложить, ни проверить формат.`, int: f => `INTEGER у <code>${f}</code>: ${f === 'price' ? 'копейки пропадут' : 'тип не совпадёт с BIGINT в родительской таблице, а через несколько лет номера переполнятся'}.`, bigint: f => `BIGINT у <code>${f}</code>: тип для номеров, не для ${f === 'price' ? 'денег' : 'этих значений'}.`, num: f => `NUMERIC у <code>${f}</code>: тип для денег, а здесь ${/_id$|^id$/.test(f) ? 'номер строки' : 'не деньги'}.`, enum: f => `Перечисление у <code>${f}</code>: значение не из короткого списка.`, tstz: f => `TIMESTAMPTZ у <code>${f}</code>: это не момент времени.` }
  };
  const lab = (L, v) => (L.find(x => x[0] === v) || [, '—'])[1];
  const fill = {
    id: 'fill', title: 'Заполните словарь данных для таблицы ticket',
    lead: ui.brief({ situation: 'Артём: «Разработчик возьмёт словарь и напишет DDL без единого вопроса. Тестировщица Оля по нему же напишет проверки». Таблица билетов с бронью и возвратом.', todo: ['Для каждого поля выберите тип, обязательность и ключ.', 'Нажмите «Проверить». Засчитывается, когда всё верно.'], look: 'Обязательность определяйте по жизни билета: что известно уже в момент брони, а что появляется позже или только у части билетов.' }),
    blank: () => ({ d: {} }),
    reference: () => ({ d: Object.fromEntries(FIELDS.map(x => [x.f, { ty: x.ty, nl: x.nl, k: x.k }])) }),
    render(el, ctx) {
      const a = ctx.ans; a.d = a.d || {};
      const judged = !!(ctx.result || ctx.readonly);
      const sel = (f, key, L, right) => { const v = (a.d[f] || {})[key] || ''; return `<select data-f="${f}" data-k="${key}" class="${judged && v ? (v === right ? 'ok' : 'bad') : ''}" ${ctx.readonly ? 'disabled' : ''} aria-label="${f}: ${key}"><option value="">…</option>${L.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`; };
      el.innerHTML = `<div class="d4-grid"><div class="d4-row d4-head"><span>Поле</span><span>Тип</span><span>Обязательность</span><span>Ключ</span></div>${FIELDS.map(x => `<div class="d4-row"><code>${x.f}</code>${sel(x.f, 'ty', TYPES, x.ty)}${sel(x.f, 'nl', NULLS, x.nl)}${sel(x.f, 'k', KEYS, x.k)}</div>`).join('')}</div>`;
      el.addEventListener('change', e => { const s = e.target.closest('select[data-f]'); if (!s) return; const f = s.dataset.f; a.d[f] = Object.assign({}, a.d[f], { [s.dataset.k]: s.value }); s.classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      const d = ans.d || {}; let good = 0;
      FIELDS.forEach(x => ['ty', 'nl', 'k'].forEach(k => { if ((d[x.f] || {})[k] === x[k]) good++; }));
      const total = FIELDS.length * 3;
      const notes = FIELDS.filter(x => (d[x.f] || {}).nl && d[x.f].nl !== x.nl).map(x => ({ ok: false, html: CONSEQ.nl[d[x.f].nl](x.f) }));
      return { ok: good === total, score: good / total, notes, summary: `Верно ${good} из ${total} ячеек.` };
    },
    flags: ans => { const d = ans.d || {}; return ((d.refunded_at || {}).nl === 'nn' ? ['refunded_at NOT NULL'] : []).concat((d.price || {}).ty && d.price.ty !== 'num' ? ['Цена не NUMERIC'] : []); },
    answers: ans => FIELDS.map(x => { const g = (ans.d || {})[x.f] || {}; const ok = g.ty === x.ty && g.nl === x.nl && g.k === x.k; const bad = ['nl', 'k'].filter(k => g[k] && g[k] !== x[k]); return { q: 'ticket.' + x.f, mine: g.ty || g.nl || g.k ? [lab(TYPES, g.ty), lab(NULLS, g.nl), lab(KEYS, g.k)].join(' · ') : '', right: [lab(TYPES, x.ty), lab(NULLS, x.nl), lab(KEYS, x.k)].join(' · '), ok, slip: bad.map(k => CONSEQ[k][g[k]](x.f)).join(' ') || (g.ty && g.ty !== x.ty && CONSEQ.ty[g.ty] ? CONSEQ.ty[g.ty](x.f) : ''), why: x.because }; }),
    viz(el, ans) {
      const d = ans.d || {};
      let life = 'hold';
      const LIFE = { hold: { t: 'Бронь', row: [9001, 777, 37, 412, 700, 'hold', '20:15', null] }, active: { t: 'Оплачен', row: [9001, 777, 37, 412, 700, 'active', null, null] }, refunded: { t: 'Возвращён', row: [9001, 777, 37, 412, 700, 'refunded', null, '14.03 18:40'] } };
      const draw = () => {
        const row = LIFE[life].row;
        const blocked = FIELDS.map((x, j) => { const g = (d[x.f] || {}).nl; return row[j] === null && g === 'nn' ? x.f : null; }).filter(Boolean);
        el.innerHTML = `<div class="stack">${ui.dbt({ name: 'Словарь ticket по вашим ответам', cols: ['Поле', 'Тип', 'Обязательность', 'Ключ'], rows: FIELDS.map(x => { const g = d[x.f] || {}; return [x.f, lab(TYPES, g.ty || x.ty), lab(NULLS, g.nl || x.nl), lab(KEYS, g.k || x.k)]; }), cells: Object.assign({}, ...FIELDS.map((x, i) => { const g = d[x.f] || {}; return { [i + ':1']: g.ty ? (g.ty === x.ty ? 'ok' : 'bad') : '', [i + ':2']: g.nl ? (g.nl === x.nl ? 'ok' : 'bad') : '', [i + ':3']: g.k ? (g.k === x.k ? 'ok' : 'bad') : '' }; })) })}
          <div class="dv-k">Проживите один билет по вашему словарю</div>${ui.seg('lf', Object.entries(LIFE).map(([v, x]) => ({ v, t: x.t })), life)}
          ${ui.dbt({ name: 'ticket — строка в момент «' + LIFE[life].t.toLowerCase() + '»', cols: FIELDS.map(x => x.f), rows: [row], cells: Object.fromEntries(FIELDS.map((x, j) => [`0:${j}`, row[j] === null && (d[x.f] || {}).nl === 'nn' ? 'bad' : row[j] === null ? 'info' : ''])) })}
          <div class="qp-note">${blocked.length ? `<b>База отказала:</b> NOT NULL constraint failed: ${blocked.map(f => 'ticket.' + f).join(', ')}. В момент «${LIFE[life].t.toLowerCase()}» у билета этих значений ещё (или уже) нет — по вашему словарю такой билет записать нельзя.` : 'По вашему словарю этот этап жизни билета записывается без ошибок. Пустые ячейки (NULL) — нормальны там, где значение появляется не у всех билетов.'}</div></div>`;
      };
      ui.onSeg(el, (n, v) => { life = v; draw(); });
      draw();
    },
    explain: '<p>Обязательность определяют по жизни строки: что известно уже в момент создания (заказ, сеанс, место, цена, статус) — NOT NULL; что появляется позже или не у всех (срок брони, момент возврата) — NULL допустим. Внешние ключи — того же типа, что первичный ключ, на который ссылаются. Цена — NUMERIC и обязательна: «бесплатно» — это 0, а не пусто.</p>',
    report: ans => FIELDS.map(x => { const g = (ans.d || {})[x.f] || {}; return `- ${x.f}: ${lab(TYPES, g.ty)} · ${lab(NULLS, g.nl)} · ${lab(KEYS, g.k)}`; }).join('\n')
  };

  // =====================================================================
  // Практика 2. Ошибки в чужом словаре
  const PAY = [
    { id: 'p1', f: 'amount', ty: 'FLOAT', nl: 'NOT NULL', d: 'Сумма платежа, ₽', ok: 'type', because: 'Деньги во FLOAT — копейки «плывут», сверка с банком не сходится. Нужен NUMERIC(10,2).', fix: ['amount', 'NUMERIC(10,2)', 'NOT NULL', 'Сумма попытки оплаты в рублях с копейками; для отклонённой — сумма, которую пытались списать'] },
    { id: 'p2', f: 'order_id', ty: 'BIGINT', nl: 'NULL', d: 'Заказ', ok: 'null', because: 'Платёж без заказа не бывает — нужно NOT NULL и FK → orders.id.', fix: ['order_id', 'BIGINT', 'NOT NULL', 'FK → orders.id, ON DELETE RESTRICT'] },
    { id: 'p3', f: 'status', ty: 'VARCHAR(7)', nl: 'NOT NULL', d: 'Статус платежа', ok: 'enum', because: 'Какие значения? Без списка разработчик напишет «success», банк вернёт «OK», а отчёт будет искать «ok». Нужен полный перечень: ok — прошёл, failed — отклонён.', fix: ['status', 'VARCHAR(7) + CHECK', 'NOT NULL', "ok — банк подтвердил; failed — отклонён. Других значений нет"] },
    { id: 'p4', f: 'method', ty: 'VARCHAR(5)', nl: 'NOT NULL', d: 'Метод', ok: 'tauto', because: 'Описание повторяет имя и ничего не объясняет. Нужно: способ оплаты — card, sbp, cash; cash только для кассы.', fix: ['method', 'VARCHAR(5) + CHECK', 'NOT NULL', 'Способ оплаты: card — карта, sbp — СБП, cash — наличные (только канал box)'] },
    { id: 'p5', f: 'flag1', ty: 'BOOLEAN', nl: 'NULL', d: 'Флаг', ok: 'name', because: 'По имени и описанию не понять, что это. Если это «чек отправлен в ОФД» — так и назвать: receipt_sent, NOT NULL DEFAULT false.', fix: ['receipt_sent', 'BOOLEAN', 'NOT NULL DEFAULT false', 'Электронный чек отправлен оператору фискальных данных'] },
    { id: 'p6', f: 'card_number', ty: 'VARCHAR(19)', nl: 'NOT NULL', d: 'Номер карты покупателя', ok: 'forbid', because: 'Полный номер карты хранить нельзя (стандарт безопасности платёжных карт PCI DSS) — и не нужно. Храним токен от банка и последние 4 цифры для поддержки.', fix: ['card_last4', 'CHAR(4)', 'NULL', 'Последние 4 цифры карты для поддержки; у СБП и наличных — пусто'] },
    { id: 'p7', f: 'paid_at', ty: 'TIMESTAMPTZ', nl: 'NOT NULL', d: 'Момент, когда банк подтвердил или отклонил попытку оплаты', ok: 'none', because: 'Тип с поясом, обязательность и описание — всё на месте.', fix: ['paid_at', 'TIMESTAMPTZ', 'NOT NULL', 'Момент, когда банк подтвердил или отклонил попытку оплаты'] }
  ];
  const PC = [{ v: 'type', t: 'Тип не подходит' }, { v: 'null', t: 'NULL разрешён у обязательного' }, { v: 'enum', t: 'Перечисление без списка значений' }, { v: 'tauto', t: 'Описание повторяет имя' }, { v: 'name', t: 'Неинформативное имя' }, { v: 'forbid', t: 'Это нельзя хранить' }, { v: 'none', t: 'Ошибки нет' }];
  const bugs = TR.task.match({
    id: 'bugs', title: 'Найдите ошибки в словаре таблицы payment',
    lead: ui.brief({ situation: 'Подрядчик прислал словарь для платежей. Оля, тестировщица: «По такому описанию я не напишу ни одной проверки».', todo: ['Для каждой строки словаря выберите, что с ней не так, — или «ошибки нет».', 'Нажмите «Проверить».'], look: 'Читайте строку глазами разработчика и тестировщика: хватает ли её, чтобы написать код и проверку без вопросов?' }),
    above: ui.dbt({ name: 'payment — словарь подрядчика', cols: ['Поле', 'Тип', 'NULL', 'Описание'], rows: PAY.map(p => [p.f, p.ty, p.nl, p.d]) }),
    rows: PAY.map(p => ({ id: p.id, t: `<code>${p.f}</code> · ${esc(p.ty)} · ${esc(p.nl)} · «${esc(p.d)}»`, ok: p.ok, because: p.because, pic: () => ui.dbt({ name: 'как исправить', cols: ['Поле', 'Тип', 'NULL', 'Описание'], rows: [p.fix], cells: p.ok === 'none' ? {} : { '0:0': p.ok === 'name' || p.ok === 'forbid' ? 'ok' : '', '0:1': p.ok === 'type' || p.ok === 'enum' || p.ok === 'forbid' ? 'ok' : '', '0:2': p.ok === 'null' || p.ok === 'name' ? 'ok' : '', '0:3': ['enum', 'tauto', 'name', 'forbid'].includes(p.ok) ? 'ok' : '' } }) })),
    choices: PC, placeholder: 'Что не так…',
    viz(el, ans) {
      let v = 'bad';
      const draw = () => {
        el.innerHTML = `<div class="stack">${ui.seg('pv', [{ v: 'bad', t: 'Как прислали' }, { v: 'fix', t: 'Как исправить' }], v)}
          ${v === 'bad' ? ui.dbt({ name: 'payment — что не так', cols: ['Поле', 'Тип', 'NULL', 'Описание', 'Ошибка', 'Вы'], rows: PAY.map(p => { const g = (ans.m || {})[p.id]; return [p.f, p.ty, p.nl, p.d, (PC.find(c => c.v === p.ok) || {}).t, g ? ((PC.find(c => c.v === g) || {}).t) + (g === p.ok ? ' ✓' : ' ✗') : '—']; }), cells: Object.assign({}, ...PAY.map((p, i) => ({ [i + ':' + ({ type: 1, null: 2, enum: 3, tauto: 3, name: 0, forbid: 0 }[p.ok] ?? 4)]: p.ok === 'none' ? 'ok' : 'bad' }))) })
          : ui.dbt({ name: 'payment — исправленный словарь', cols: ['Поле', 'Тип', 'NULL', 'Описание'], rows: PAY.map(p => p.fix), cells: Object.assign({}, ...PAY.map((p, i) => p.ok === 'none' ? {} : { [i + ':' + ({ type: 1, null: 2, enum: 3, tauto: 3, name: 0, forbid: 0 }[p.ok])]: 'ok' })) })}
          <div class="qp-note">Красная ячейка — где ошибка в строке. Переключите на «Как исправить»: зелёным — что поменяли. Каждая исправленная строка отвечает на вопросы разработчика и тестировщика без созвона.</div></div>`;
      };
      ui.onSeg(el, (n, x) => { v = x; draw(); });
      draw();
    },
    explain: '<p>Семь проверок строки словаря: подходит ли тип; верна ли обязательность; перечислены ли значения; объясняет ли описание больше, чем имя; понятно ли имя; можно ли это вообще хранить; есть ли единицы и формат. Полный номер карты не хранят — это требование стандарта PCI DSS; храним токен и последние четыре цифры.</p>'
  });

  // =====================================================================
  // Практика 3. Статусы билета из слов Нины Сергеевны
  const TICKET_SM = { states: [{ id: 'hold', t: 'бронь', x: 10, y: 80 }, { id: 'active', t: 'действует', x: 210, y: 20 }, { id: 'cancelled', t: 'бронь сгорела', x: 210, y: 150, end: true }, { id: 'used', t: 'прошёл в зал', x: 430, y: 20, end: true }, { id: 'refunded', t: 'возвращён', x: 430, y: 150, end: true }],
    trans: [{ from: 'hold', to: 'active', t: 'оплата' }, { from: 'hold', to: 'cancelled', t: '15 минут' }, { from: 'active', to: 'used', t: 'сканер' }, { from: 'active', to: 'refunded', t: 'возврат' }], start: 'hold', entity: 'ticket', width: 580, height: 200 };
  const PH = [
    { id: 'e1', t: '«Место держим, пока человек платит»', ok: 'hold', because: 'Бронь: место занято, денег ещё нет, есть срок.' },
    { id: 'e2', t: '«Билет оплачен»', ok: 'active', because: 'Оплаченный билет действует.' },
    { id: 'e3', t: '«Продан»', ok: 'active', because: 'Синоним «оплачен» — тот же статус. Два слова у заказчика — не два статуса в базе.' },
    { id: 'e4', t: '«Прошёл по билету в зал»', ok: 'used', because: 'Сканер на входе погасил билет — used. Вернуть его уже нельзя.' },
    { id: 'e5', t: '«Отсканирован на входе»', ok: 'used', because: 'Тот же факт другими словами — used.' },
    { id: 'e6', t: '«Деньги за билет вернули»', ok: 'refunded', because: 'Возврат — конечный статус.' },
    { id: 'e7', t: '«Бронь сгорела — не оплатил за 15 минут»', ok: 'cancelled', because: 'Бронь отменена по таймеру, место свободно.' },
    { id: 'e8', t: '«Купил, но не пришёл»', ok: 'active', because: 'Неявка — не отдельный статус: билет так и остался действующим (не used). После сеанса это видно из статуса и времени сеанса. Заводить статус «не пришёл» — значит запускать ночной процесс, который его проставляет.' }
  ];
  const EC = [{ v: 'hold', t: 'hold — бронь' }, { v: 'active', t: 'active — действует' }, { v: 'used', t: 'used — использован' }, { v: 'refunded', t: 'refunded — возвращён' }, { v: 'cancelled', t: 'cancelled — отменён' }];
  const enumT = TR.task.match({
    id: 'enum', title: 'Слова заказчика → перечисление ticket.status',
    lead: ui.brief({ situation: 'Нина Сергеевна за десять минут назвала статус билета восемью разными словами. Артём: «В базе статусов будет пять. Разложи слова».', todo: ['Для каждой фразы выберите код статуса.', 'Нажмите «Проверить».'], look: 'Синонимы — один статус. И подумайте, всякое ли событие — статус.' }),
    rows: PH.map(p => ({ id: p.id, t: esc(p.t), ok: p.ok, because: p.because })),
    choices: EC, placeholder: 'Код статуса…',
    viz(el, ans) {
      el.innerHTML = `<div class="stack"><div data-sm></div>${ui.dbt({ name: 'Перечисление ticket.status для словаря', cols: ['Код', 'Значение', 'Слова заказчика', 'Ваши ошибки'], rows: EC.map(c => [c.v, c.t.split(' — ')[1], PH.filter(p => p.ok === c.v).map(p => p.t.replace(/[«»]/g, '')).join('; '), PH.filter(p => (ans.m || {})[p.id] === c.v && p.ok !== c.v).map(p => p.t).join('; ') || '—']), cells: Object.fromEntries(EC.map((c, i) => [i + ':3', PH.some(p => (ans.m || {})[p.id] === c.v && p.ok !== c.v) ? 'bad' : ''])) })}</div>`;
      ui.stateViz(TR.$('[data-sm]', el), Object.assign({}, TICKET_SM, { note: 'У билета пять статусов, и восемь слов заказчика укладываются в них без остатка.' }));
    },
    explain: '<p>Перечисление в словаре — это код, значение и правило перехода. Синонимы заказчика («оплачен», «продан») сводятся к одному коду. Не всякое событие — статус: «не пришёл» выводится из «действует» + «сеанс прошёл», отдельный статус потребовал бы процесса, который его проставляет, и мог бы разойтись с реальностью.</p>'
  });

  // =====================================================================
  // Практика 4. Именование
  const NAMES = [
    { id: 'n1', bad: 'Цена', q: 'Поле цены билета', options: [{ t: '<code>price</code>', ok: true, why: 'Да: латиница, snake_case, существительное.', because: 'Имена полей — латиницей в snake_case: кириллица и пробелы ломают инструменты и запросы.' }, { t: '<code>Цена</code>', why: 'Кириллица в именах — источник ошибок в коде и выгрузках.' }, { t: '<code>ticketPriceValue</code>', why: 'camelCase и избыточность: в таблице ticket «ticket» и «Value» лишние.' }], rule: 'латиница, snake_case' },
    { id: 'n2', bad: 'filmID', q: 'Ссылка на фильм в сеансе', options: [{ t: '<code>film_id</code>', ok: true, why: 'Да.', because: 'Внешний ключ — <code>&lt;таблица&gt;_id</code>: сразу видно, куда ссылка.' }, { t: '<code>filmID</code>', why: 'Смешение регистров: в PostgreSQL без кавычек это станет filmid.' }, { t: '<code>film</code>', why: 'Похоже на название фильма, а это номер строки.' }], rule: 'внешний ключ — <таблица>_id' },
    { id: 'n3', bad: 'DateCreate', q: 'Когда создан заказ', options: [{ t: '<code>created_at</code>', ok: true, why: 'Да.', because: 'Моменты времени — с суффиксом <code>_at</code>, даты без времени — <code>_date</code> (birth_date). Глагол в прошедшем времени: created, paid, refunded.' }, { t: '<code>DateCreate</code>', why: 'Регистр и порядок слов как попало.' }, { t: '<code>date</code>', why: 'Зарезервированное слово и не говорит, какая дата.' }], rule: '_at — момент, _date — дата' },
    { id: 'n4', bad: 'is_not_active', q: 'Признак, что зал работает', options: [{ t: '<code>is_active</code>', ok: true, why: 'Да.', because: 'Логические поля — <code>is_</code>/<code>has_</code> и без отрицания: «WHERE NOT is_not_active» читается с трудом и рождает ошибки.' }, { t: '<code>is_not_active</code>', why: 'Двойное отрицание в условиях: WHERE is_not_active = false.' }, { t: '<code>active_flag_yn</code>', why: 'Шум: флаг, yn — тип и так BOOLEAN.' }], rule: 'is_/has_, без отрицания' },
    { id: 'n5', bad: 'order', q: 'Имя таблицы заказов', options: [{ t: '<code>orders</code>', ok: true, why: 'Да: order — зарезервированное слово SQL.', because: '<code>order</code> — ключевое слово (ORDER BY): каждое обращение придётся брать в кавычки. Поэтому orders. Остальные таблицы «Кадра» — в единственном числе; исключение записано в словаре.' }, { t: '<code>order</code>', why: 'Зарезервированное слово — вечные кавычки.' }, { t: '<code>tbl_order</code>', why: 'Префикс tbl_ ничего не добавляет: и так видно, что это таблица.' }], rule: 'без зарезервированных слов' },
    { id: 'n6', bad: 'sum', q: 'Сумма платежа', options: [{ t: '<code>amount</code>', ok: true, why: 'Да.', because: '<code>sum</code> совпадает с функцией SUM — запрос «SELECT sum(sum)» сбивает с толку. Для денег — amount, единицы и валюту пишут в словаре.' }, { t: '<code>sum</code>', why: 'Совпадает с агрегатной функцией.' }, { t: '<code>s</code>', why: 'Однобуквенное имя ничего не объясняет.' }], rule: 'не совпадать с функциями SQL' }
  ];
  const names = TR.task.quizSet({
    id: 'names', title: 'Назовите поля по правилам',
    lead: ui.brief({ situation: 'В черновике подрядчика поля названы кто во что горазд. Артём: «Единые правила имён — часть словаря. Выбери правильные варианты».', todo: ['Для каждого поля выберите имя.', 'Нажмите «Проверить».'], look: 'snake_case латиницей; внешний ключ — <таблица>_id; моменты — _at; логические — is_; без зарезервированных слов SQL.' }),
    qs: NAMES.map(n => ({ id: n.id, q: `${esc(n.q)} <span class="dim">(было: <code>${esc(n.bad)}</code>)</span>`, qText: n.q, options: n.options })),
    viz(el, ans) {
      el.innerHTML = `<div class="stack">${ui.dbt({ name: 'Было → стало', cols: ['Было', 'Ваш выбор', 'Правильно', 'Правило'], html: true, rows: NAMES.map(n => { const sel = ((ans.q || {})[n.id] || [])[0]; const mine = sel != null ? n.options[sel].t : '—'; const right = n.options.find(o => o.ok).t; return [`<code>${esc(n.bad)}</code>`, mine, right, esc(n.rule)]; }), cells: Object.fromEntries(NAMES.map((n, i) => { const sel = ((ans.q || {})[n.id] || [])[0]; return [i + ':1', sel == null ? '' : n.options[sel].ok ? 'ok' : 'bad']; })) })}
        ${ui.code("SELECT o.id, o.created_at, p.amount\nFROM orders o\nJOIN payment p ON p.order_id = o.id\nWHERE p.status = 'ok' AND o.created_at >= '2027-03-08';", 'sql', 'Запрос с хорошими именами читается как фраза')}</div>`;
    },
    explain: '<p>Правила имён «Кадра»: латиница, snake_case; таблицы в единственном числе (orders — исключение из-за ключевого слова); первичный ключ — id, внешний — &lt;таблица&gt;_id; моменты — _at, даты — _date; логические — is_/has_ без отрицаний; без зарезервированных слов и имён функций. Правила записываются в начале словаря.</p>'
  });

  // =====================================================================
  // Практика 5. Персональные данные
  const PD = [
    { id: 'pd1', t: 'customer.full_name — имя', ok: 'pd', because: 'Имя — персональные данные (152-ФЗ).' },
    { id: 'pd2', t: 'customer.phone — телефон', ok: 'pd', because: 'Телефон прямо указывает на человека.' },
    { id: 'pd3', t: 'customer.birth_date — дата рождения', ok: 'pd', because: 'Персональные данные; вместе с именем — однозначно.' },
    { id: 'pd4', t: 'customer.email — почта', ok: 'pd', because: 'Почта идентифицирует человека.' },
    { id: 'pd5', t: 'film.title — название фильма', ok: 'no', because: 'О человеке ничего не говорит.' },
    { id: 'pd6', t: 'seat.row_no — ряд места', ok: 'no', because: 'Свойство кресла, не человека.' },
    { id: 'pd7', t: 'payment.cvv — код с обратной стороны карты', ok: 'never', because: 'CVV запрещено хранить после авторизации платежа — даже в зашифрованном виде (PCI DSS).' },
    { id: 'pd8', t: 'customer.passport — паспорт для фильмов 18+', ok: 'never', because: 'Не нужен: возраст проверяют по паспорту на входе, в базе достаточно даты рождения. Принцип минимизации: не собирать того, без чего можно обойтись.' },
    { id: 'pd9', t: 'payment.card_number — полный номер карты', ok: 'never', because: 'Полный номер хранить нельзя без сертификации PCI DSS, и он не нужен: банк отдаёт токен, для поддержки хватает последних четырёх цифр.' }
  ];
  const PB = [{ id: 'pd', t: 'Персональные данные', sub: 'хранить, защищать, маскировать в логах' }, { id: 'no', t: 'Не персональные' }, { id: 'never', t: 'Не хранить вовсе', sub: 'запрещено или не нужно' }];
  const pd = TR.task.sort({
    id: 'pd', title: 'Отметьте персональные данные и то, что хранить нельзя',
    lead: ui.brief({ situation: 'Перед согласованием словаря — проверка безопасности. Борис Ильич напоминает: «Покупатель может попросить удалить свои данные».', todo: ['Разложите девять полей по трём корзинам.', 'Нажмите «Проверить».'], look: 'Персональные данные — всё, по чему можно узнать человека. «Не хранить» — то, что запрещено правилами платёжных карт или просто не нужно для задачи.' }),
    items: PD.map(p => ({ id: p.id, t: p.t, ok: p.ok, because: p.because })),
    buckets: PB,
    viz(el, ans) {
      const b = ans.b || {};
      const badge = ok => ok === 'pd' ? '<span class="status warn">ПДн</span>' : ok === 'never' ? '<span class="status bad">не хранить</span>' : '<span class="status">—</span>';
      el.innerHTML = `<div class="stack">${ui.dbt({ name: 'Отметки для словаря', cols: ['Поле', 'Отметка', 'Вы', 'Что делать'], html: true, rows: PD.map(p => [`<code>${esc(p.t.split(' — ')[0])}</code>`, badge(p.ok), b[p.id] ? badge(b[p.id]) + (b[p.id] === p.ok ? ' ✓' : ' ✗') : '—', p.ok === 'pd' ? 'маскировать в логах и выгрузках; удалять по запросу (заказы — SET NULL)' : p.ok === 'never' ? esc(p.because) : 'без ограничений']), rowCls: (r, i) => b[PD[i].id] && b[PD[i].id] !== PD[i].ok ? 'dup' : '' })}
        <div class="dv-row">${ui.dbt({ name: 'Как храним карту', cols: ['card_token', 'card_last4'], rows: [['tok_8f3a…c21', '4417']], cells: { '0:0': 'ok', '0:1': 'ok' } })}${ui.dbt({ name: 'Как нельзя', cols: ['card_number', 'cvv'], rows: [['4276 1600 1234 4417', '123']], cells: { '0:0': 'bad', '0:1': 'bad' } })}</div>
        <div class="qp-note">Персональные данные в словаре помечают отдельным флагом: по нему безопасники настраивают маскирование, а разработчики — удаление по запросу. Всё, что можно не собирать, — не собирают.</div></div>`;
    },
    explain: '<p>Персональные данные (152-ФЗ) — имя, телефон, почта, дата рождения: их помечают в словаре, маскируют в логах и удаляют по запросу. Данные карт регулирует PCI DSS: CVV не хранят никогда, полный номер — только с сертификацией, а обычно хранят токен и последние четыре цифры. Паспорт для 18+ не нужен вовсе — это принцип минимизации.</p>'
  });

  // =====================================================================
  // Практика 6. Описать поле своими словами
  const RUBRIC = ['Тип и точность: NUMERIC(8,2), рубли с копейками', 'Обязательность: NOT NULL; 0 — пригласительный, а не «пусто»', 'Смысл: цена на момент покупки со всеми наценками и скидками, не меняется при смене прайса', 'Откуда берётся: базовая цена сеанса + наценка за тип места − скидка', 'Ограничение: CHECK (price >= 0)', 'Где используется: выручка, сверка с платежами, возврат той же суммы'];
  const REF = 'ticket.price — цена билета на момент покупки, NUMERIC(8,2), рубли с копейками, NOT NULL, CHECK (price >= 0). Считается при бронировании: screening.base_price + наценка за тип места (VIP +150, диван +300) − скидка; 0 — пригласительный. После покупки не меняется, даже если прайс сеанса изменили. Используется в отчёте о выручке, при сверке с payment.amount и при возврате — возвращается ровно эта сумма. Не персональные данные.';
  const card = {
    id: 'card', title: 'Опишите поле ticket.price для словаря своими словами',
    lead: ui.brief({ situation: 'Последнее задание дня. Артём: «Напиши карточку поля так, чтобы разработчик, тестировщица и Борис Ильич поняли её одинаково».', todo: ['Напишите описание поля в свободной форме (от 60 символов).', 'Сверьтесь с эталоном и честно отметьте пункты, которые у вас прозвучали. Засчитывается от 60 % пунктов.'], look: 'Тип, обязательность, смысл «на момент покупки», из чего складывается, ограничение, где используется.' }),
    rubric: RUBRIC,
    blank: () => ({ j: { text: '', ai: null, self: null } }),
    reference: () => ({ j: { text: REF, ai: null, self: RUBRIC.map(() => true) } }),
    render(el, ctx) { ui.justify(el, { q: 'Карточка поля ticket.price', rubric: RUBRIC, reference: REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 60, placeholder: 'ticket.price — …', onChange: v => { ctx.ans.j = v; ctx.save(); } }); },
    check(ans) { const s = ui.justifyScore(ans.j); return { ok: s >= 0.6, score: s, summary: !ans.j || !ans.j.text || ans.j.text.trim().length < 30 ? 'Напишите описание и сверьтесь с эталоном.' : ans.j.self ? `Отмечено пунктов: ${ans.j.self.filter(Boolean).length} из ${RUBRIC.length}.` : 'Сверьтесь с эталоном и отметьте пункты.' }; },
    viz(el, ans) {
      const self = (ans.j && ans.j.self) || [];
      const rows = [['Поле', 'ticket.price', 0], ['Название', 'Цена билета', 2], ['Тип', 'NUMERIC(8,2), ₽', 0], ['Обязательность', 'NOT NULL; 0 — пригласительный', 1], ['Ограничение', 'CHECK (price >= 0)', 4], ['Как считается', 'base_price сеанса + наценка места − скидка', 3], ['Смысл', 'цена на момент покупки, не меняется при смене прайса', 2], ['Используется', 'выручка, сверка с payment.amount, сумма возврата', 5], ['Пример', '850.00 (VIP, вечер)', 0], ['ПДн', 'нет', 0]];
      el.innerHTML = `<div class="stack"><div class="d4-card">${rows.map(r => `<div class="d4-r ${self[r[2]] ? 'on' : ''}"><span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div><div class="qp-note">Эталонная карточка поля. Подсвечены строки, которые вы отметили у себя в самопроверке. Карточку читают трое: разработчик берёт тип и ограничение, тестировщица — обязательность, CHECK и «0 — пригласительный», Борис Ильич — «на момент покупки» и «сверка с платежами».</div></div>`;
    },
    report: ans => (ans.j && ans.j.text) || '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 2, order: 40, slot: 'Занятие 4', title: 'Data Dictionary и описание таблиц',
    when: 'четверг · вы, Артём и тестировщица Оля над общим документом',
    intro: [
      { who: 'olya', html: 'Я пишу тесты по вашему словарю. Если в нём нет списка статусов или непонятно, может ли поле быть пустым, — я приду с вопросами. Много раз.' },
      { who: 'artem', html: 'Задача на сегодня — чтобы Оля не пришла ни разу.' }
    ],
    facts: ['F-refund', 'F-hold', 'F-pd', 'F-price'],
    glossary: [
      { term: 'Словарь данных (Data Dictionary)', simple: 'Описание каждой таблицы и поля: смысл, тип, обязательность, значения, правила.', tech: 'Метаданные модели: паспорта таблиц и карточки атрибутов; источник правды для разработки, QA, аналитики данных и безопасности.' },
      { term: 'Паспорт таблицы', simple: 'Шапка словаря для таблицы: зачем она, кто владелец, сколько строк и как растёт, сколько хранить.', tech: 'Назначение, владелец данных, объём и рост, срок хранения, ключи, индексы, связи.' },
      { term: 'Карточка поля', simple: 'Строка словаря об одном поле: имя, название, тип, NULL, ключ, по умолчанию, допустимые значения, правило, источник, пример.', tech: 'Описание атрибута с доменом, ограничениями и трассировкой к требованиям.' },
      { term: 'Перечисление (enum)', simple: 'Короткий список допустимых значений с расшифровкой: hold — бронь, active — действует.', tech: 'Домен из фиксированного набора; реализуется CHECK, типом ENUM или справочником.' },
      { term: 'snake_case', simple: 'Стиль имён: строчные латинские буквы и подчёркивания — created_at.', tech: 'Принятая в PostgreSQL конвенция: без кавычек идентификаторы приводятся к нижнему регистру.' },
      { term: 'Зарезервированное слово', simple: 'Слово языка SQL (order, user, select): как имя таблицы требует кавычек.', tech: 'Ключевые слова SQL; их избегают в именах объектов.' },
      { term: 'Персональные данные (ПДн)', simple: 'Любые сведения, по которым можно узнать человека: имя, телефон, почта, дата рождения.', tech: '152-ФЗ «О персональных данных»: обработка, защита, удаление по запросу субъекта.' },
      { term: 'Минимизация данных', simple: 'Не собирать того, без чего можно обойтись.', tech: 'Принцип обработки ПДн: объём данных соответствует целям.' },
      { term: 'PCI DSS', simple: 'Стандарт безопасности данных платёжных карт: CVV не хранить, полный номер — только с сертификацией.', tech: 'Payment Card Industry Data Security Standard; токенизация вместо хранения PAN.' },
      { term: 'Токен карты', simple: 'Заменитель номера карты от банка: по нему можно списывать, а номер узнать нельзя.', tech: 'Токенизация PAN платёжным провайдером.' }
    ],
    outro: 'Словарь «Кадра» готов: Оля пишет тесты без вопросов. Следующее занятие — SQL на живой базе: проверим, что данные действительно такие, как описано.',
    tasks: [howDd, fill, bugs, enumT, names, pd, card]
  });
})();
