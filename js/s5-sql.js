/* Занятие 5. SQL для системного аналитика: порядок выполнения запроса, NULL и трёхзначная логика, агрегаты и группы,
   JOIN и его ловушки (потерянные строки, размножение, NOT IN с NULL), запросы на живой базе «Кадра» и проверка
   качества данных. Ключ преподавателя — _dev/key/50-sql.md. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'sql';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .s5-q{border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:grid;gap:8px;background:var(--surface);min-width:0}
  .s5-q.ok{border-left:4px solid var(--ok)}.s5-q.bad{border-left:4px solid var(--bad)}
  .s5-q h5{margin:0;font:700 14px/1.3 var(--f-brand)}
  .s5-q .ret{font-size:12.5px;color:var(--text-2)}
  .s5-q .why{font-size:13px;color:var(--bad)}
  .s5-num{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:10px;align-items:center}
  .s5-num input.ok{border-color:var(--ok)}.s5-num input.bad{border-color:var(--bad)}
  </style>`);

  // ---------- мини-таблица билетов для предсказаний ----------
  const MINI_COLS = ['id', 'screening_id', 'seat_id', 'price', 'status', 'promo'];
  const MINI = [[1, 37, 412, 700, 'active', null], [2, 37, 413, 700, 'active', 'FRIEND'], [3, 37, 414, 850, 'refunded', null], [4, 41, 15, 300, 'active', 'FRIEND'], [5, 41, 16, 0, 'active', 'INVITE'], [6, 52, 7, 450, 'active', null]];
  const from = { t: 'ticket', a: 't', cols: MINI_COLS, rows: MINI };
  const g = (r, c) => r['t.' + c];
  const sum = (rows, c) => rows.reduce((s, r) => s + (g(r, c) || 0), 0);

  // =====================================================================
  // Теория 1. Порядок выполнения
  const HOW_SQL = [{ t: 'SELECT screening_id, COUNT(*) AS sold, SUM(price) AS revenue', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: "WHERE status = 'active'", c: 'WHERE' }, { t: 'GROUP BY screening_id', c: 'GROUP BY' }, { t: 'HAVING COUNT(*) >= 2', c: 'HAVING' }, { t: 'ORDER BY revenue DESC', c: 'ORDER BY' }, { t: 'LIMIT 2;', c: 'LIMIT' }];
  const HOW_SPEC = { short: true, from, where: { fn: r => g(r, 'status') === 'active', text: "status = 'active'" }, group: { by: ['t.screening_id'], text: 'screening_id' }, having: { fn: rows => rows.length >= 2, text: 'COUNT(*) >= 2' }, select: [{ as: 'screening_id', fn: r => g(r, 'screening_id') }, { as: 'sold', agg: rows => rows.length }, { as: 'revenue', agg: rows => sum(rows, 'price') }], order: { fn: (a, b) => b.revenue - a.revenue, text: 'revenue DESC' }, limit: 2 };
  const howSelect = {
    id: 'how-select', title: 'Как это работает: в каком порядке база выполняет запрос', covers: ['order'], free: true, noReset: true,
    simple: { icon: '🧾', plain: 'Запрос пишут, начиная с SELECT, а база выполняет его в другом порядке: <b>FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT</b>. Отсюда три правила: псевдоним из SELECT нельзя использовать в WHERE; агрегаты (COUNT, SUM) — только в HAVING, не в WHERE; LIMIT без ORDER BY берёт «какие попало» строки.', analogy: 'Рецепт пишут «салат из огурцов и помидоров», а готовят: достать овощи → помыть → отобрать хорошие → нарезать → разложить по тарелкам.', tech: 'Логический порядок обработки SELECT (стандарт SQL). Оптимизатор может менять физический порядок, но результат обязан совпасть с логическим.' },
    lead: ui.brief({ situation: 'Шесть билетов и запрос «выручка по сеансам, где продано хотя бы два». Ниже — живая консоль с базой «Кадра».', todo: ['Пройдите запрос по шагам кнопкой «Шаг →» и смотрите промежуточную таблицу.', 'Попробуйте свой запрос в консоли, например: <code>SELECT * FROM film;</code>'], look: 'На каком шаге исчезает возвращённый билет, а на каком — сеанс 52.' }),
    render(el, ctx) {
      el.innerHTML = '<div class="stack"><div data-qp></div><div class="eyebrow">Консоль: база «Кадра» за неделю 8–14 марта 2027</div><div data-con></div></div>';
      ui.qplay(TR.$('[data-qp]', el), { sql: HOW_SQL, spec: HOW_SPEC, start: 0 });
      TR.db.console(TR.$('[data-con]', el), { value: ctx.ans.sql || 'SELECT title, duration_min, age_rating\nFROM film\nORDER BY duration_min DESC;', rows: 4, tables: TR.db.SCHEMA.map(t => t.name), onChange: v => { ctx.ans.sql = v; ctx.save(); }, onRun: () => ctx.ready() });
      el.addEventListener('click', e => { if (e.target.closest('[data-qs],[data-qa]')) ctx.ready(); });
      if (ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Порядок частей
  const CL = ['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'LIMIT'];
  const CL_WHY = { FROM: 'Сначала база берёт таблицу — без неё нечего фильтровать.', JOIN: 'Присоединяет связанные таблицы: из них тоже могут быть условия.', WHERE: 'Отбрасывает строки до группировки. Агрегатов здесь ещё нет — поэтому COUNT в WHERE запрещён.', 'GROUP BY': 'Раскладывает оставшиеся строки по группам.', HAVING: 'Фильтрует группы уже после подсчёта агрегатов.', SELECT: 'Только теперь считаются выражения и появляются псевдонимы — поэтому в WHERE псевдоним не виден.', 'ORDER BY': 'Сортирует готовый результат; псевдонимы из SELECT здесь уже работают.', LIMIT: 'Обрезает отсортированный результат.' };
  const order = {
    id: 'order', title: 'Расставьте части запроса в порядке выполнения',
    lead: ui.brief({ situation: 'Артём: «Восемь из десяти ошибок в SQL у новичков — от того, что они думают, будто база читает запрос сверху вниз».', todo: ['Расставьте части запроса в том порядке, в каком их выполняет база.', 'Нажмите «Проверить».'], look: 'Подсказка: псевдоним из SELECT работает в ORDER BY, но не в WHERE.' }),
    blank: () => ({ o: TR.shuffle(CL, 'sql-order') }),
    reference: () => ({ o: CL.slice() }),
    render(el, ctx) {
      const a = ctx.ans; if (!a.o || a.o.length !== CL.length) a.o = TR.shuffle(CL, 'sql-order');
      const rv = ctx.result || ctx.readonly ? Object.fromEntries(a.o.map((c, i) => [c, CL[i] === c ? 'ok' : 'bad'])) : null;
      ui.order(el, { items: CL.map(c => ({ id: c, t: `<code>${c}</code>` })), value: a.o, reveal: rv, readonly: ctx.readonly, onChange: v => { a.o = v; ctx.save(); } });
    },
    check(ans) { const s = ui.orderScore(ans.o || [], CL), pos = (ans.o || []).filter((c, i) => CL[i] === c).length; return { ok: s === 1, score: s, summary: `На своём месте ${pos} из ${CL.length}.`, notes: (ans.o || []).indexOf('SELECT') < (ans.o || []).indexOf('WHERE') ? [{ ok: false, html: 'SELECT выполняется после WHERE — поэтому псевдоним из SELECT в WHERE не виден.' }] : [] }; },
    answers: ans => CL.map((c, i) => ({ q: `Шаг ${i + 1}`, mine: (ans.o || [])[i] || '', right: c, ok: (ans.o || [])[i] === c, why: CL_WHY[c] })),
    viz(el) { ui.qplay(el, { sql: HOW_SQL, spec: HOW_SPEC, start: 0, title: 'Проиграйте запрос и смотрите, когда выполняется каждая часть' }); },
    explain: '<p>FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. Следствия, о которых спрашивают на собеседовании: агрегат в WHERE — ошибка (групп ещё нет), псевдоним SELECT в WHERE — ошибка (его ещё нет), в ORDER BY — можно; LIMIT без ORDER BY не определяет, какие строки вернутся.</p>',
    report: ans => (ans.o || []).join(' → ')
  };

  // =====================================================================
  // Теория 2. NULL
  const howNull = {
    id: 'how-null', title: 'Как это работает: NULL — не ноль и не пусто, а «неизвестно»', covers: ['predict'], free: true, noReset: true,
    simple: { icon: '❔', plain: 'NULL — «значение неизвестно». Сравнение с ним даёт не «ложь», а «неизвестно», и WHERE такую строку выбрасывает. <code>COUNT(*)</code> считает строки, <code>COUNT(поле)</code> — только непустые значения. <code>SUM</code> и <code>AVG</code> пропускают NULL, но не ноль: средняя цена с пригласительным за 0 ₽ меньше, чем без него.', analogy: '«Сколько лет вашему соседу?» — «Не знаю». Старше ли он 30? Тоже «не знаю», а не «нет».', tech: 'Трёхзначная логика SQL: TRUE / FALSE / UNKNOWN. IS NULL / IS NOT NULL; COALESCE(x, значение); NOT IN с NULL в подзапросе даёт пустой результат.' },
    lead: ui.brief({ situation: 'Таблица из шести билетов, в поле promo есть NULL.', todo: ['Поиграйте со значениями A и B в таблице истинности.', 'Посмотрите, что делают COUNT и AVG с NULL и нулём.'], look: 'Почему <code>promo &lt;&gt; \'FRIEND\'</code> не находит билеты без промокода.' }),
    render(el, ctx) {
      el.innerHTML = `<div class="stack">${ui.dbt({ name: 'ticket (6 строк)', cols: MINI_COLS, rows: MINI, cells: { '0:5': 'warn', '2:5': 'warn', '5:5': 'warn', '4:3': 'info' } })}<div data-t3></div>
        ${ui.table(['Выражение', 'Результат', 'Почему'], [['<code>COUNT(*)</code>', '6', 'считает строки'], ['<code>COUNT(promo)</code>', '3', 'NULL не считается'], ['<code>COUNT(DISTINCT promo)</code>', '2', 'FRIEND, INVITE'], ["<code>WHERE promo &lt;&gt; 'FRIEND'</code>", '1 строка', 'NULL &lt;&gt; \'FRIEND\' — «неизвестно», три строки без промокода выпали'], ["<code>WHERE promo IS NULL OR promo &lt;&gt; 'FRIEND'</code>", '4 строки', 'так находят «всё, кроме FRIEND»'], ['<code>AVG(price) WHERE screening_id = 41</code>', '150', '(300 + 0) / 2: ноль — значение, он считается']])}</div>`;
      ui.truth3(TR.$('[data-t3]', el));
      el.addEventListener('change', () => ctx.ready());
      ctx.ready();
    }
  };

  // =====================================================================
  // Практика 2. Предскажите результат
  const MINI_BOX = ui.dbt({ name: 'ticket — те же шесть строк', cols: MINI_COLS, rows: MINI });
  const P = [
    { id: 'p1', code: 'SELECT COUNT(*), COUNT(promo)\nFROM ticket;', q: 'Что вернёт запрос?', options: [{ t: '6 и 6', why: 'COUNT(promo) пропускает NULL.' }, { t: '6 и 3', ok: true, why: 'Да.', because: 'COUNT(*) считает все строки — 6. COUNT(promo) — только непустые значения: FRIEND, FRIEND, INVITE — 3.' }, { t: '3 и 3', why: 'COUNT(*) считает строки, а не значения — их шесть.' }],
      sql: [{ t: 'SELECT COUNT(*), COUNT(promo)', c: 'SELECT' }, { t: 'FROM ticket;', c: 'FROM' }], spec: { short: true, from, select: [{ as: 'COUNT(*)', agg: r => r.length }, { as: 'COUNT(promo)', agg: r => r.filter(x => g(x, 'promo') != null).length }] } },
    { id: 'p2', code: "SELECT COUNT(*)\nFROM ticket\nWHERE promo <> 'FRIEND';", q: 'Сколько строк посчитает запрос?', options: [{ t: '4', why: 'Казалось бы: шесть минус два FRIEND. Но три строки с NULL дают «неизвестно» и тоже выпадают.' }, { t: '1', ok: true, why: 'Да.', because: 'Условие истинно только для INVITE. Для NULL сравнение <> даёт «неизвестно», и WHERE выбрасывает строку. «Всё, кроме FRIEND» пишут так: promo IS NULL OR promo <> \'FRIEND\'.' }, { t: '3', why: 'Строки без промокода не проходят: NULL <> \'FRIEND\' — «неизвестно».' }],
      sql: [{ t: 'SELECT COUNT(*)', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: "WHERE promo <> 'FRIEND';", c: 'WHERE' }], spec: { short: true, from, where: { fn: r => g(r, 'promo') == null ? null : g(r, 'promo') !== 'FRIEND', text: "promo <> 'FRIEND'" }, select: [{ as: 'COUNT(*)', agg: r => r.length }] } },
    { id: 'p3', code: "SELECT screening_id, SUM(price)\nFROM ticket\nWHERE status = 'active'\nGROUP BY screening_id\nHAVING SUM(price) > 500;", q: 'Сколько строк вернёт запрос?', options: [{ t: '1 строка', ok: true, why: 'Да.', because: 'Возвращённый билет выпадает в WHERE. Группы: 37 → 1 400, 41 → 300, 52 → 450. Больше 500 — только 37.' }, { t: '2 строки', why: 'У сеанса 52 выручка 450 — меньше 500.' }, { t: '3 строки', why: 'HAVING отбрасывает группы с суммой не больше 500.' }],
      sql: [{ t: 'SELECT screening_id, SUM(price)', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: "WHERE status = 'active'", c: 'WHERE' }, { t: 'GROUP BY screening_id', c: 'GROUP BY' }, { t: 'HAVING SUM(price) > 500;', c: 'HAVING' }], spec: { short: true, from, where: { fn: r => g(r, 'status') === 'active', text: "status = 'active'" }, group: { by: ['t.screening_id'], text: 'screening_id' }, having: { fn: rows => sum(rows, 'price') > 500, text: 'SUM(price) > 500' }, select: [{ as: 'screening_id', fn: r => g(r, 'screening_id') }, { as: 'SUM(price)', agg: rows => sum(rows, 'price') }] } },
    { id: 'p4', code: 'SELECT AVG(price)\nFROM ticket\nWHERE screening_id = 41;', q: 'Какая средняя цена?', options: [{ t: '150', ok: true, why: 'Да.', because: 'Цены 300 и 0. Ноль — значение, а не NULL, поэтому (300 + 0) / 2 = 150. Если «бесплатно» записать как NULL, AVG дал бы 300 — и это другой смысл.' }, { t: '300', why: 'Пригласительный за 0 ₽ участвует в среднем: 0 — не NULL.' }, { t: 'NULL', why: 'Значения есть — среднее посчитается.' }],
      sql: [{ t: 'SELECT AVG(price)', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: 'WHERE screening_id = 41;', c: 'WHERE' }], spec: { short: true, from, where: { fn: r => g(r, 'screening_id') === 41, text: 'screening_id = 41' }, select: [{ as: 'AVG(price)', agg: r => r.length ? sum(r, 'price') / r.length : null }] } },
    { id: 'p5', code: 'SELECT id\nFROM ticket\nORDER BY price DESC\nLIMIT 2;', q: 'Какие id вернёт запрос?', options: [{ t: '3 и 1', why: 'Может быть и так — а может и 3 и 2: у билетов 1 и 2 одинаковая цена 700, их порядок не определён.' }, { t: '3, а вторым — 1 или 2: порядок одинаковых цен не определён', ok: true, why: 'Да.', because: 'Первый — 850 (билет 3). Дальше две строки по 700, и база вправе вернуть любую. Для стабильного результата добавляют второй ключ сортировки: ORDER BY price DESC, id.' }, { t: '1 и 2', why: 'Сортировка по убыванию — первым идёт 850 (билет 3).' }],
      sql: [{ t: 'SELECT id   -- цена показана для наглядности', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: 'ORDER BY price DESC', c: 'ORDER BY' }, { t: 'LIMIT 2;', c: 'LIMIT' }], spec: { short: true, from, select: [{ as: 'id', fn: r => g(r, 'id') }, { as: 'price', fn: r => g(r, 'price') }], order: { fn: (a, b) => b.price - a.price, text: 'price DESC' }, limit: 2 } },
    { id: 'p6', code: 'SELECT COUNT(DISTINCT promo)\nFROM ticket;', q: 'Сколько разных промокодов?', options: [{ t: '2', ok: true, why: 'Да.', because: 'Разные непустые значения: FRIEND и INVITE. NULL в COUNT(DISTINCT …) не входит.' }, { t: '3', why: 'NULL — не значение, COUNT его не считает.' }, { t: '6', why: 'DISTINCT убирает повторы, а COUNT(поле) — пустые.' }],
      sql: [{ t: 'SELECT COUNT(DISTINCT promo)', c: 'SELECT' }, { t: 'FROM ticket;', c: 'FROM' }], spec: { short: true, from, select: [{ as: 'COUNT(DISTINCT promo)', agg: r => new Set(r.map(x => g(x, 'promo')).filter(v => v != null)).size }] } },
    { id: 'p7', code: "SELECT SUM(price)\nFROM ticket\nWHERE status = 'active' AND promo IS NULL;", q: 'Какая сумма?', options: [{ t: '1 150', ok: true, why: 'Да.', because: 'Активные без промокода — билеты 1 (700) и 6 (450). Билет 3 без промокода, но возвращён.' }, { t: '2 000', why: 'Билет 3 (850) возвращён — status не active.' }, { t: 'NULL', why: 'IS NULL — правильная проверка пустоты, строки найдутся.' }],
      sql: [{ t: 'SELECT SUM(price)', c: 'SELECT' }, { t: 'FROM ticket', c: 'FROM' }, { t: "WHERE status = 'active' AND promo IS NULL;", c: 'WHERE' }], spec: { short: true, from, where: { fn: r => g(r, 'status') === 'active' && g(r, 'promo') == null, text: "status = 'active' AND promo IS NULL" }, select: [{ as: 'SUM(price)', agg: r => sum(r, 'price') }] } }
  ];
  const predict = TR.task.quizSet({
    id: 'predict', title: 'Прочитайте запрос и предскажите результат',
    lead: ui.brief({ situation: 'Артём: «Аналитик читает чужой запрос и сразу видит, что он вернёт. Вот шесть билетов и семь запросов». Таблица — та же, что в теории.', todo: ['Для каждого запроса выберите результат — в уме, без консоли.', 'Нажмите «Проверить». В разборе каждый запрос можно проиграть по шагам.'], look: 'NULL в promo, ноль в цене и одинаковые цены у билетов 1 и 2.' }),
    above: MINI_BOX,
    qs: P.map(p => ({ id: p.id, code: p.code, q: p.q, qText: p.code.replace(/\n/g, ' '), options: p.options, viz: el => ui.qplay(el, { sql: p.sql, spec: p.spec, start: 0 }) })),
    viz(el, ans) {
      const wrong = P.filter(p => { const s = ((ans.q || {})[p.id] || [])[0]; return s == null || !p.options[s].ok; });
      el.innerHTML = `<div class="stack">${ui.dbt({ name: 'Итог: где помог бы проигрыватель', cols: ['Запрос', 'Ловушка', 'Вы'], rows: P.map(p => { const s = ((ans.q || {})[p.id] || [])[0]; return [p.code.split('\n').join(' ').slice(0, 60), { p1: 'COUNT(поле) и NULL', p2: 'NULL в сравнении', p3: 'WHERE до групп, HAVING после', p4: 'ноль — не NULL', p5: 'LIMIT при равных значениях', p6: 'DISTINCT и NULL', p7: 'IS NULL и статус' }[p.id], s == null ? '—' : p.options[s].ok ? '✓' : '✗']; }), cells: Object.fromEntries(P.map((p, i) => { const s = ((ans.q || {})[p.id] || [])[0]; return [i + ':2', s == null ? '' : p.options[s].ok ? 'ok' : 'bad']; })) })}
        <div class="qp-note">${wrong.length ? `Под каждым ответом выше — проигрыватель этого запроса. Начните с ${wrong.slice(0, 2).map(p => 'запроса ' + p.id.slice(1)).join(' и ')}: пройдите шаги и найдите момент, где строка выпала или посчиталась не так, как вы ждали.` : 'Всё верно. Проигрыватели под ответами остались — пригодятся объяснять это другим.'}</div><div data-qp></div></div>`;
      const p = wrong[0] || P[1];
      ui.qplay(TR.$('[data-qp]', el), { sql: p.sql, spec: p.spec, start: 0, title: 'Запрос ' + p.id.slice(1) });
    },
    explain: '<p>Пять ловушек, которые ломают отчёты: <b>COUNT(поле)</b> не считает NULL; <b>сравнение с NULL</b> даёт «неизвестно» и выкидывает строку; <b>ноль — значение</b> и участвует в AVG; <b>LIMIT при равных значениях</b> недетерминирован — добавляйте второй ключ сортировки; <b>WHERE до групп, HAVING после</b>.</p>'
  });

  // =====================================================================
  // Теория 3. JOIN
  const J_CUST = { name: 'customer', short: 'c', cols: ['id', 'full_name'], rows: [[1, 'Анна'], [2, 'Иван'], [3, 'Олег']], key: 0 };
  const J_ORD = { name: 'orders', short: 'o', cols: ['id', 'customer_id'], rows: [[501, 1], [502, 2], [503, 1], [504, null]], key: 1 };
  const howJoin = {
    id: 'how-join', title: 'Как это работает: JOIN — какие строки остаются, а какие размножаются', covers: ['bugs'], free: true, noReset: true,
    simple: { icon: '🔀', plain: '<b>INNER JOIN</b> оставляет только строки, у которых нашлась пара. <b>LEFT JOIN</b> сохраняет все строки левой таблицы, а где пары нет — справа NULL. Если у строки слева несколько пар справа, она <b>повторится</b> столько раз — и SUM по левой таблице после такого JOIN завышен.', analogy: 'Список гостей и список подарков. INNER — только гости с подарками. LEFT — все гости, у кого нет подарка — прочерк. Гость с тремя подарками появится в итоговом списке трижды.', tech: 'INNER, LEFT/RIGHT/FULL OUTER JOIN, CROSS JOIN. Условие на правую таблицу в WHERE превращает LEFT в INNER — его ставят в ON. Размножение строк (fan-out) при соединении с несколькими «многими».' },
    lead: ui.brief({ situation: 'Три покупателя и четыре заказа; заказ 504 — с кассы, без покупателя; у Олега заказов нет, у Анны — два.', todo: ['Переключайте тип JOIN и смотрите, какие строки остаются и где появляется NULL.', 'Посмотрите все четыре.'], look: 'Анна появится дважды. Где пропадут Олег и заказ 504?' }),
    render(el, ctx) {
      const a = ctx.ans; a.seen = a.seen || {};
      ui.joinViz(el, { L: J_CUST, R: J_ORD, type: 'INNER', onType: t => { a.seen[t] = 1; ctx.save(); if (Object.keys(a.seen).length >= 2) ctx.ready(); } });
      if (ctx.readonly || Object.keys(a.seen).length >= 2) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 3. Найдите ошибку в запросе (с живой проверкой обоих вариантов)
  const liveTwo = (el, bad, good, labels) => {
    el.innerHTML = `<div class="stack tight"><div class="row"><button type="button" class="btn sm" data-lt>▶ Выполнить оба на живой базе</button><span class="small dim">${esc(labels || 'с ошибкой и исправленный')}</span></div><div data-lo></div></div>`;
    TR.on(el, 'click', '[data-lt]', async () => {
      const out = TR.$('[data-lo]', el); out.innerHTML = '<span class="small dim">Выполняю…</span>';
      try { await TR.db.ready(); } catch (e) { out.innerHTML = ui.note('bad', 'База не загрузилась', 'Нужен интернет.'); return; }
      const r1 = TR.db.runFresh(bad), r2 = TR.db.runFresh(good);
      out.innerHTML = `<div class="dv-row" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))"><div class="stack tight">${ui.code(bad, 'sql', 'С ошибкой')}${TR.db.resultHTML(r1, { max: 12 })}</div><div class="stack tight">${ui.code(good, 'sql', 'Исправлено')}${TR.db.resultHTML(r2, { max: 12 })}</div></div>`;
    });
  };
  const FILMS = { name: 'film', short: 'f', cols: ['id', 'title'], rows: [[1, 'Северный ветер'], [3, 'Котопёс'], [10, 'Лето в Плёсе']], key: 0 };
  const TICKS = { name: 'ticket (через сеанс)', short: 't', cols: ['id', 'film_id', 'status'], rows: [[101, 1, 'active'], [102, 1, 'active'], [103, 3, 'refunded']], key: 1 };
  const B = [
    { id: 'b1', q: 'Запрос «сколько билетов у каждого фильма». Фильм без продаж показывает 1. Почему?', code: "SELECT f.title, COUNT(*) AS sold\nFROM film f\nLEFT JOIN screening s ON s.film_id = f.id\nLEFT JOIN ticket t ON t.screening_id = s.id\nGROUP BY f.id, f.title;", options: [
      { t: 'COUNT(*) считает и строку, где справа NULL; нужно COUNT(t.id)', ok: true, why: 'Да.', because: 'LEFT JOIN оставил «Лето в Плёсе» одной строкой с NULL справа. COUNT(*) считает строки — получилась 1. COUNT(t.id) считает только найденные билеты — 0.' },
      { t: 'LEFT JOIN здесь не нужен — надо INNER', why: 'С INNER фильм без продаж пропадёт совсем — а Борису Ильичу нужен ноль.' },
      { t: 'Нельзя группировать по названию', why: 'Группировать по f.id, f.title можно и нужно.' }],
      bad: "SELECT f.title, COUNT(*) AS sold FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id GROUP BY f.id, f.title ORDER BY sold;", good: "SELECT f.title, COUNT(t.id) AS sold FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id GROUP BY f.id, f.title ORDER BY sold;", diag: el => ui.joinViz(el, { L: FILMS, R: TICKS, type: 'LEFT', types: false, note: 'У «Лета в Плёсе» строка есть, но справа NULL: COUNT(*) даст 1, COUNT(t.id) — 0.' }) },
    { id: 'b2', q: 'Хотели все фильмы и число активных билетов, включая нули. Фильмы без продаж исчезли. Почему?', code: "SELECT f.title, COUNT(t.id) AS sold\nFROM film f\nLEFT JOIN screening s ON s.film_id = f.id\nLEFT JOIN ticket t ON t.screening_id = s.id\nWHERE t.status = 'active'\nGROUP BY f.id, f.title;", options: [
      { t: 'Условие на правую таблицу в WHERE выкинуло строки с NULL — его надо перенести в ON', ok: true, why: 'Да.', because: 'Для фильма без продаж t.status = NULL, условие даёт «неизвестно», и WHERE выбрасывает строку: LEFT JOIN превратился в INNER. Условие на присоединяемую таблицу пишут в ON: LEFT JOIN ticket t ON t.screening_id = s.id AND t.status = \'active\'.' },
      { t: 'COUNT(t.id) не считает нули', why: 'COUNT вернул бы 0, если бы строка дожила до GROUP BY. Её выкинул WHERE раньше.' },
      { t: 'Надо добавить DISTINCT', why: 'Повторов здесь нет — строки пропали.' }],
      bad: "SELECT f.title, COUNT(t.id) AS sold FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id WHERE t.status = 'active' GROUP BY f.id, f.title ORDER BY sold;", good: "SELECT f.title, COUNT(t.id) AS sold FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id AND t.status = 'active' GROUP BY f.id, f.title ORDER BY sold;",
      diag: el => ui.qplay(el, { sql: [{ t: 'SELECT f.title, COUNT(t.id)', c: 'SELECT' }, { t: 'FROM film f', c: 'FROM' }, { t: 'LEFT JOIN ticket t ON t.film_id = f.id', c: 'JOIN' }, { t: "WHERE t.status = 'active'", c: 'WHERE' }, { t: 'GROUP BY f.title', c: 'GROUP BY' }], spec: { from: { t: 'film', a: 'f', cols: FILMS.cols, rows: FILMS.rows }, joins: [{ type: 'LEFT', t: 'ticket', a: 't', cols: TICKS.cols, rows: TICKS.rows, on: (L, R) => L['f.id'] === R['t.film_id'], text: 't.film_id = f.id' }], where: { fn: r => r['t.status'] == null ? null : r['t.status'] === 'active', text: "t.status = 'active'" }, group: { by: ['f.title'], text: 'f.title' }, select: [{ as: 'title', fn: r => r['f.title'] }, { as: 'COUNT(t.id)', agg: rows => rows.filter(r => r['t.id'] != null).length }] }, start: 0 }) },
    { id: 'b3', q: 'Сверка «сумма билетов против суммы платежей» по заказам. У некоторых заказов оплачено вдвое больше, чем продано. Почему?', code: "SELECT o.id, SUM(t.price) AS tickets, SUM(p.amount) AS paid\nFROM orders o\nJOIN ticket t  ON t.order_id = o.id\nJOIN payment p ON p.order_id = o.id\nGROUP BY o.id;", options: [
      { t: 'Два соединения с «многими»: каждая строка платежа повторилась на каждый билет — суммы размножились', ok: true, why: 'Да.', because: 'В заказе 2 билета и 1 платёж: после двух JOIN — 2 строки, и платёж посчитан дважды. С неудачной попыткой оплаты — ещё и билеты удвоятся. Суммы считают отдельно (подзапросами), а потом соединяют.' },
      { t: 'SUM не работает с NUMERIC', why: 'Работает. Дело в числе строк после JOIN.' },
      { t: 'Нужен LEFT JOIN вместо JOIN', why: 'LEFT сохранит заказы без платежей, но размножение строк никуда не денется.' }],
      bad: "SELECT o.id, SUM(t.price) AS tickets, SUM(p.amount) AS paid FROM orders o JOIN ticket t ON t.order_id = o.id JOIN payment p ON p.order_id = o.id WHERE o.id IN (SELECT order_id FROM ticket GROUP BY order_id HAVING COUNT(*) >= 2) GROUP BY o.id LIMIT 8;", good: "SELECT o.id, (SELECT SUM(price) FROM ticket WHERE order_id = o.id) AS tickets, (SELECT SUM(amount) FROM payment WHERE order_id = o.id AND status = 'ok') AS paid FROM orders o WHERE o.id IN (SELECT order_id FROM ticket GROUP BY order_id HAVING COUNT(*) >= 2) LIMIT 8;",
      diag: el => ui.joinViz(el, { L: { name: 'ticket заказа 530', short: 't', cols: ['id', 'order_id', 'price'], rows: [[188, 530, 700], [189, 530, 850]], key: 1 }, R: { name: 'payment', short: 'p', cols: ['id', 'order_id', 'amount'], rows: [[71, 530, 1550]], key: 1 }, type: 'INNER', types: false, note: 'Платёж 1 550 ₽ повторился на оба билета: SUM(p.amount) = 3 100.' }) },
    { id: 'b4', q: 'Ищем покупателей без заказов. Запрос вернул 0, хотя такие точно есть. Почему?', code: "SELECT COUNT(*)\nFROM customer\nWHERE id NOT IN (SELECT customer_id FROM orders);", options: [
      { t: 'В подзапросе есть NULL (заказы с кассы) — NOT IN с NULL никогда не бывает истинным', ok: true, why: 'Да.', because: 'id NOT IN (1, 2, NULL) раскрывается в id <> 1 AND id <> 2 AND id <> NULL — последнее «неизвестно», и всё условие никогда не истинно. Пишут NOT EXISTS или фильтруют NULL в подзапросе.' },
      { t: 'У всех покупателей есть заказы', why: 'Проверьте исправленным запросом — покупатели без заказов есть.' },
      { t: 'Нужно COUNT(id) вместо COUNT(*)', why: 'Строк ноль ещё до подсчёта — их выкинул WHERE.' }],
      bad: 'SELECT COUNT(*) AS without_orders FROM customer WHERE id NOT IN (SELECT customer_id FROM orders);', good: 'SELECT COUNT(*) AS without_orders FROM customer c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);',
      diag: el => { el.innerHTML = ui.table(['Выражение', 'Результат'], [['5 NOT IN (1, 2)', '<span style="color:var(--ok)">TRUE</span>'], ['5 NOT IN (1, 2, NULL)', '<span style="color:var(--warn)">NULL — неизвестно</span>'], ['= 5 &lt;&gt; 1 AND 5 &lt;&gt; 2 AND 5 &lt;&gt; NULL', 'TRUE AND TRUE AND <span style="color:var(--warn)">NULL</span> → NULL']]); } },
    { id: 'b5', q: 'Нужны сеансы, где продано больше 50 билетов. Запрос падает с ошибкой. Почему?', code: "SELECT screening_id, COUNT(*)\nFROM ticket\nWHERE COUNT(*) > 50\nGROUP BY screening_id;", options: [
      { t: 'Агрегат в WHERE: условия на группы пишут в HAVING', ok: true, why: 'Да.', because: 'WHERE выполняется до GROUP BY — групп и их COUNT ещё нет. Условие на агрегат — HAVING COUNT(*) > 50.' },
      { t: 'COUNT(*) нельзя писать дважды', why: 'Можно сколько угодно раз.' },
      { t: 'Не хватает ORDER BY', why: 'Сортировка необязательна.' }],
      bad: "SELECT screening_id, COUNT(*) FROM ticket WHERE COUNT(*) > 50 GROUP BY screening_id;", good: "SELECT screening_id, COUNT(*) AS sold FROM ticket WHERE status = 'active' GROUP BY screening_id HAVING COUNT(*) > 50 ORDER BY sold DESC;",
      diag: el => ui.qplay(el, { sql: HOW_SQL, spec: HOW_SPEC, start: 2 }) }
  ];
  const bugs = TR.task.quizSet({
    id: 'bugs', title: 'Найдите ошибку в запросе',
    lead: ui.brief({ situation: 'Оля собрала запросы, по которым считают отчёты, и в каждом что-то не так. Артём: «Это пять ошибок, которые я вижу в каждом втором отчёте».', todo: ['Для каждого запроса выберите причину ошибки.', 'Нажмите «Проверить». В разборе каждый запрос можно выполнить на живой базе — с ошибкой и исправленный.'], look: 'Лаборатория «JOIN — какие строки остаются, а какие размножаются» и раздел про NULL.' }),
    qs: B.map(b => ({ id: b.id, q: b.q, code: b.code, options: b.options, viz: el => { el.innerHTML = '<div class="stack"><div data-d></div><div data-l></div></div>'; b.diag(TR.$('[data-d]', el)); liveTwo(TR.$('[data-l]', el), b.bad, b.good); } })),
    viz(el) {
      el.innerHTML = '<div class="stack"><div class="dv-k">Главная схема задания: как JOIN размножает и теряет строки</div><div data-j></div></div>';
      ui.joinViz(TR.$('[data-j]', el), { L: J_CUST, R: J_ORD, type: 'LEFT' });
    },
    explain: '<p>COUNT(*) после LEFT JOIN считает пустые совпадения — считайте COUNT(столбец справа). Условие на правую таблицу — в ON, иначе LEFT превращается в INNER. Два JOIN к разным «многим» размножают строки — суммы считают раздельно. NOT IN с NULL в подзапросе — пустой результат, пишите NOT EXISTS. Агрегат — в HAVING.</p>'
  });

  // =====================================================================
  // Практика 4. Запросы на живой базе
  const W = [
    { id: 'w1', t: 'Активные билеты по каждому фильму — включая фильмы без продаж', ask: 'Борис Ильич: «Мне нужен список всех фильмов и сколько по каждому продано. Если не продано — ноль, а не пропуск».', ret: '2 столбца: название фильма, число активных билетов. 10 строк — все фильмы.', tables: ['film', 'screening', 'ticket'],
      ref: "SELECT f.title, COUNT(t.id)\nFROM film f\nLEFT JOIN screening s ON s.film_id = f.id\nLEFT JOIN ticket t ON t.screening_id = s.id AND t.status = 'active'\nGROUP BY f.id, f.title;",
      alts: [{ sql: "SELECT f.title, COUNT(t.id) FROM film f JOIN screening s ON s.film_id = f.id JOIN ticket t ON t.screening_id = s.id AND t.status = 'active' GROUP BY f.id, f.title;", why: 'Пропал фильм без продаж: INNER JOIN (или условие в WHERE) выкидывает строки без пары. Нужен LEFT JOIN от film, условие на статус — в ON.' }, { sql: "SELECT f.title, COUNT(*) FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id AND t.status = 'active' GROUP BY f.id, f.title;", why: 'У фильма без продаж получилась 1: COUNT(*) считает строку с NULL справа. Считайте COUNT(t.id).' }, { sql: "SELECT f.title, COUNT(t.id) FROM film f LEFT JOIN screening s ON s.film_id = f.id LEFT JOIN ticket t ON t.screening_id = s.id GROUP BY f.id, f.title;", why: 'Посчитаны и возвращённые билеты. Добавьте t.status = \'active\' — в ON, чтобы не потерять фильмы без продаж.' }] },
    { id: 'w2', t: 'Выручка за неделю по кинотеатрам', ask: 'Борис Ильич: «Выручка по каждому кинотеатру за неделю — по действующим билетам».', ret: '2 столбца: название кинотеатра, сумма цен активных билетов. 3 строки.', tables: ['cinema', 'hall', 'screening', 'ticket'],
      ref: "SELECT c.name, SUM(t.price)\nFROM ticket t\nJOIN screening s ON s.id = t.screening_id\nJOIN hall h ON h.id = s.hall_id\nJOIN cinema c ON c.id = h.cinema_id\nWHERE t.status = 'active'\nGROUP BY c.id, c.name;",
      alts: [{ sql: "SELECT c.name, SUM(t.price) FROM ticket t JOIN screening s ON s.id = t.screening_id JOIN hall h ON h.id = s.hall_id JOIN cinema c ON c.id = h.cinema_id GROUP BY c.id, c.name;", why: 'В сумму попали возвращённые билеты — добавьте WHERE t.status = \'active\'.' }, { sql: "SELECT c.name, SUM(p.amount) FROM payment p JOIN orders o ON o.id = p.order_id JOIN ticket t ON t.order_id = o.id JOIN screening s ON s.id = t.screening_id JOIN hall h ON h.id = s.hall_id JOIN cinema c ON c.id = h.cinema_id WHERE p.status = 'ok' GROUP BY c.id, c.name;", why: 'Сумма платежей через JOIN с билетами размножилась: каждый платёж посчитан столько раз, сколько билетов в заказе.' }] },
    { id: 'w3', t: 'Сеансы, где продано больше 70 % мест зала', ask: 'Нина Сергеевна: «Покажите сеансы, где зал заполнен больше чем на 70 % — туда добавим показы».', ret: '2 столбца: id сеанса, число активных билетов. Мест в зале — COUNT по seat этого зала.', tables: ['screening', 'ticket', 'seat'],
      ref: "SELECT s.id, COUNT(t.id)\nFROM screening s\nJOIN ticket t ON t.screening_id = s.id AND t.status = 'active'\nGROUP BY s.id\nHAVING COUNT(t.id) > 0.7 * (SELECT COUNT(*) FROM seat st WHERE st.hall_id = s.hall_id);",
      alts: [{ sql: "SELECT s.id, COUNT(t.id) FROM screening s JOIN ticket t ON t.screening_id = s.id GROUP BY s.id HAVING COUNT(t.id) > 0.7 * (SELECT COUNT(*) FROM seat st WHERE st.hall_id = s.hall_id);", why: 'Посчитаны и возвращённые билеты: место после возврата свободно. Нужен t.status = \'active\'.' }, { sql: "SELECT s.id, COUNT(t.id) FROM screening s JOIN ticket t ON t.screening_id = s.id AND t.status = 'active' GROUP BY s.id HAVING COUNT(t.id) / (SELECT COUNT(*) FROM seat st WHERE st.hall_id = s.hall_id) > 0.7;", why: 'Пусто из-за целочисленного деления: COUNT / COUNT — целые, 29 / 40 в SQLite даёт 0. Умножайте на 1.0 или сравнивайте COUNT(t.id) > 0.7 * мест.' }] },
    { id: 'w4', t: 'Топ-3 фильма по выручке за выходные 13–14 марта', ask: 'Нина Сергеевна: «Три самых кассовых фильма выходных — по убыванию».', ret: '2 столбца: название, выручка активных билетов. 3 строки по убыванию выручки. Порядок важен.', tables: ['film', 'screening', 'ticket'], ordered: true,
      ref: "SELECT f.title, SUM(t.price) AS revenue\nFROM ticket t\nJOIN screening s ON s.id = t.screening_id\nJOIN film f ON f.id = s.film_id\nWHERE t.status = 'active'\n  AND s.starts_at >= '2027-03-13' AND s.starts_at < '2027-03-15'\nGROUP BY f.id, f.title\nORDER BY revenue DESC\nLIMIT 3;",
      alts: [{ sql: "SELECT f.title, SUM(t.price) AS revenue FROM ticket t JOIN screening s ON s.id = t.screening_id JOIN film f ON f.id = s.film_id WHERE t.status = 'active' AND s.starts_at BETWEEN '2027-03-13' AND '2027-03-14' GROUP BY f.id, f.title ORDER BY revenue DESC LIMIT 3;", why: 'BETWEEN \'2027-03-13\' AND \'2027-03-14\' не включает 14 марта после полуночи: строка «2027-03-14 11:00» больше, чем «2027-03-14». Для дат с временем пишите >= начала и < следующего дня.' }, { sql: "SELECT f.title, SUM(t.price) AS revenue FROM ticket t JOIN screening s ON s.id = t.screening_id JOIN film f ON f.id = s.film_id WHERE t.status = 'active' AND s.starts_at >= '2027-03-13' AND s.starts_at < '2027-03-15' GROUP BY f.id, f.title ORDER BY revenue LIMIT 3;", why: 'Сортировка по возрастанию — это три наименее кассовых. Нужно ORDER BY … DESC.' }] }
  ];
  const evalW = ans => {
    const sql = (ans && ans.sql) || {};
    if (!TR.db.loaded) return { offline: true };
    return Object.fromEntries(W.map(q => {
      const s = String(sql[q.id] || '').trim();
      if (!s) return [q.id, { ok: false, why: 'Запрос не написан.' }];
      const r = TR.db.compare(s, q.ref, { ordered: q.ordered });
      if (r.ok) return [q.id, { ok: true, r }];
      const hit = (q.alts || []).find(a => TR.db.compare(s, a.sql, { ordered: q.ordered }).ok);
      return [q.id, { ok: false, r, why: hit ? hit.why : r.why }];
    }));
  };
  const write = {
    id: 'write', title: 'Запросы для Бориса Ильича и Нины Сергеевны на живой базе',
    lead: ui.brief({ situation: 'Понедельник, отчёт. Четыре вопроса — четыре запроса к настоящей базе «Кадра» (неделя 8–14 марта). Артём: «Каждый — пиши, запускай, смотри на результат. Только потом отвечай».', todo: ['Для каждого вопроса напишите запрос и запустите (кнопка или Ctrl+Enter).', 'Сверьтесь с подсказкой «что вернуть»: число столбцов и строк важно, имена столбцов — нет.', 'Нажмите «Проверить»: каждый запрос сравнивается с эталоном на свежей копии базы.'], look: 'Статус действующего билета — t.status = \'active\'. Время сеанса — строка «ГГГГ-ММ-ДД ЧЧ:ММ». Заказы — таблица orders.' }),
    blank: () => ({ sql: {} }),
    reference: () => ({ sql: Object.fromEntries(W.map(q => [q.id, q.ref])) }),
    render(el, ctx) {
      const a = ctx.ans; a.sql = a.sql || {};
      const res = ctx.result && ctx.result.sub;
      el.innerHTML = `<div class="stack">${W.map((q, i) => { const s = res && res[q.id]; return `<div class="s5-q ${s ? (s.ok ? 'ok' : 'bad') : ''}"><h5>Вопрос ${i + 1}. ${esc(q.t)}</h5>${ui.say(q.ask.startsWith('Борис') ? 'boris' : 'nina', esc(q.ask.replace(/^[^:]+:\s*/, '')))}<div class="ret">Что вернуть: ${esc(q.ret)}</div><div data-c="${q.id}"></div>${s && !s.ok ? `<div class="why">${esc(s.why || '')}</div>` : ''}</div>`; }).join('')}</div>`;
      W.forEach(q => TR.db.console(TR.$(`[data-c="${q.id}"]`, el), { value: ctx.readonly ? q.ref : a.sql[q.id] || '', readonly: ctx.readonly, rows: 6, tables: q.tables, label: q.t, placeholder: 'SELECT …', onChange: v => { a.sql[q.id] = v; ctx.save(); } }));
    },
    check(ans) {
      const sub = evalW(ans);
      if (sub.offline) return { ok: false, score: 0, summary: 'База ещё загружается — подождите несколько секунд и нажмите «Проверить» снова.' };
      const good = W.filter(q => sub[q.id].ok).length;
      return { ok: good === W.length, score: good / W.length, sub, summary: `Сходится с эталоном: ${good} из ${W.length}.`, notes: W.filter(q => !sub[q.id].ok).map(q => ({ ok: false, html: `<b>${esc(q.t)}</b>: ${esc(sub[q.id].why || 'не сходится')}` })) };
    },
    flags: ans => { const sub = evalW(ans); if (sub.offline) return []; return W.filter(q => !sub[q.id].ok && /LEFT JOIN|COUNT\(\*\)|размножил/.test(sub[q.id].why || '')).map(q => q.t + ': ' + sub[q.id].why.split('.')[0]); },
    answers: ans => { const sub = evalW(ans); return W.map(q => { const s = sub.offline ? { ok: false, why: 'база не загрузилась' } : sub[q.id]; return { q: q.t, mine: String((ans.sql || {})[q.id] || '').replace(/\s+/g, ' ').slice(0, 140), right: q.ref.replace(/\s+/g, ' '), ok: s.ok, slip: s.ok ? '' : esc(s.why || ''), why: { w1: 'LEFT JOIN от film сохраняет фильмы без продаж; условие на статус — в ON; COUNT(t.id) даёт 0, а не 1.', w2: 'Путь от билета к кинотеатру — через сеанс и зал; суммируем цены действующих билетов, а не платежи (их сумма размножилась бы).', w3: 'Число мест зала — подзапрос COUNT по seat; условие на группу — в HAVING; 0.7 спасает от целочисленного деления.', w4: 'Даты с временем — полуинтервал >= начала и < следующего дня; ORDER BY … DESC и LIMIT 3.' }[q.id], viz: el => { el.innerHTML = '<span class="small dim">Считаю…</span>'; TR.db.ready().then(() => { el.innerHTML = ui.resDiff(String((ans.sql || {})[q.id] || '').trim() ? TR.db.runFresh((ans.sql || {})[q.id]) : null, TR.db.runFresh(q.ref)); }).catch(() => { el.innerHTML = ui.note('bad', 'База не загрузилась', 'Нужен интернет.'); }); } }; }); },
    viz(el, ans) {
      let cur = 'w1';
      const draw = () => {
        const q = W.find(x => x.id === cur);
        el.innerHTML = `<div class="stack">${ui.seg('wq', W.map((x, i) => ({ v: x.id, t: 'Вопрос ' + (i + 1) })), cur)}<div class="small"><b>${esc(q.t)}</b></div><div data-rd><span class="small dim">Считаю…</span></div>${cur === 'w1' ? '<div class="dv-k">Почему LEFT JOIN и COUNT(t.id)</div><div data-j></div>' : ''}</div>`;
        TR.db.ready().then(() => { const mine = String((ans.sql || {})[cur] || '').trim(); TR.$('[data-rd]', el).innerHTML = ui.resDiff(mine ? TR.db.runFresh(mine) : null, TR.db.runFresh(q.ref)) + ui.code(q.ref, 'sql', 'Один из верных запросов'); }).catch(() => { TR.$('[data-rd]', el).innerHTML = ui.note('bad', 'База не загрузилась', 'Нужен интернет.'); });
        if (cur === 'w1') ui.joinViz(TR.$('[data-j]', el), { L: FILMS, R: TICKS, type: 'LEFT' });
      };
      ui.onSeg(el, (n, v) => { cur = v; draw(); });
      draw();
    },
    explain: '<p>Четыре приёма, на которых держатся отчёты: <b>LEFT JOIN с условием в ON</b>, чтобы нули не пропадали; <b>путь по внешним ключам</b> от билета к кинотеатру — сумма по билетам, а не по платежам, иначе размножение; <b>подзапрос в HAVING</b> и 0.7 вместо целочисленного деления; <b>полуинтервал дат</b> вместо BETWEEN по строкам с временем. И привычка: перед тем как отдать цифру, проговорить, что именно она значит.</p>',
    refNote: 'Засчитывается любой запрос с тем же результатом: имена столбцов, порядок строк (кроме топ-3) и способ не важны; числа — с точностью до копеек.',
    report: ans => W.map(q => `- ${q.t}: ${String((ans.sql || {})[q.id] || '—').replace(/\s+/g, ' ')}`).join('\n')
  };

  // =====================================================================
  // Практика 5. Можно ли верить данным?
  const QC = [
    { id: 'k1', t: 'Сколько покупателей-дублей: телефон в формате 8XXXXXXXXXX совпадает с чужим +7XXXXXXXXXX?', hint: "Сравните '+7' || substr(c1.phone, 2) с c2.phone для телефонов, начинающихся с 8.",
      ref: "SELECT COUNT(*) FROM customer c1 JOIN customer c2 ON c2.id <> c1.id AND '+7' || substr(c1.phone, 2) = c2.phone WHERE c1.phone LIKE '8%';",
      rows: "SELECT c1.id, c1.full_name, c1.phone, c2.id AS same_as, c2.phone FROM customer c1 JOIN customer c2 ON c2.id <> c1.id AND '+7' || substr(c1.phone, 2) = c2.phone WHERE c1.phone LIKE '8%';",
      because: 'Перенос из старой кассы создал второго покупателя с тем же телефоном в другом формате. UNIQUE на phone их не поймал — строки разные. Лечится нормализацией формата при вводе (и CHECK на формат +7…).' },
    { id: 'k2', t: 'Сколько оплаченных заказов без единого удачного платежа?', hint: "orders.status = 'paid' и NOT EXISTS платежа со status = 'ok'.",
      ref: "SELECT COUNT(*) FROM orders o WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id AND p.status = 'ok');",
      rows: "SELECT o.id, o.created_at, o.channel, (SELECT COUNT(*) FROM payment p WHERE p.order_id = o.id) AS attempts FROM orders o WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id AND p.status = 'ok');",
      because: 'Заказ «оплачен», а денег нет — платёж потерялся при переносе. Ограничением это не запретить (правило про две таблицы) — нужен регулярный отчёт качества.' },
    { id: 'k3', t: 'Сколько пар сеансов в одном зале пересекаются по времени (с учётом длительности фильма)?', hint: "Начало второго сеанса раньше конца первого: s2.starts_at < datetime(s1.starts_at, '+' || f.duration_min || ' minutes').",
      ref: "SELECT COUNT(*) FROM screening s1 JOIN film f ON f.id = s1.film_id JOIN screening s2 ON s2.hall_id = s1.hall_id AND s2.id <> s1.id AND s2.starts_at >= s1.starts_at AND s2.starts_at < datetime(s1.starts_at, '+' || f.duration_min || ' minutes');",
      rows: "SELECT s1.id, s1.starts_at, f.title, f.duration_min, s2.id AS overlaps, s2.starts_at FROM screening s1 JOIN film f ON f.id = s1.film_id JOIN screening s2 ON s2.hall_id = s1.hall_id AND s2.id <> s1.id AND s2.starts_at >= s1.starts_at AND s2.starts_at < datetime(s1.starts_at, '+' || f.duration_min || ' minutes');",
      because: 'В зале «Красный» 12 марта «Глубина» стоит в 15:30 (142 минуты) и ещё раз в 16:30. Простое ограничение этого не ловит — нужна проверка в приложении или ограничение-исключение по интервалу (EXCLUDE в PostgreSQL) и отчёт качества.' },
    { id: 'k4', t: 'Сколько оплаченных заказов, где удачный платёж не равен сумме действующих билетов?', hint: "Сравните SUM(price) активных билетов с суммой платежей status = 'ok' — подзапросами, а не двумя JOIN.",
      ref: "SELECT COUNT(*) FROM orders o WHERE o.status = 'paid' AND EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id AND p.status = 'ok') AND (SELECT SUM(amount) FROM payment p WHERE p.order_id = o.id AND p.status = 'ok') <> COALESCE((SELECT SUM(price) FROM ticket t WHERE t.order_id = o.id AND t.status = 'active'), 0);",
      rows: "SELECT o.id, (SELECT SUM(amount) FROM payment p WHERE p.order_id = o.id AND p.status = 'ok') AS paid, (SELECT SUM(price) FROM ticket t WHERE t.order_id = o.id AND t.status = 'active') AS active_tickets, (SELECT COUNT(*) FROM ticket t WHERE t.order_id = o.id AND t.status = 'refunded') AS refunded FROM orders o WHERE o.status = 'paid' AND EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id AND p.status = 'ok') AND (SELECT SUM(amount) FROM payment p WHERE p.order_id = o.id AND p.status = 'ok') <> COALESCE((SELECT SUM(price) FROM ticket t WHERE t.order_id = o.id AND t.status = 'active'), 0);",
      because: 'Посмотрите на столбец refunded: в большинстве таких заказов один билет возвращён — деньги за него ушли покупателю, но в базе нет записи о возврате, и сверка не сходится. Это не мусор, а дыра в модели: нужна таблица возвратов (refund), о которой просил Борис Ильич. Оставшийся заказ — касса взяла на 100 ₽ меньше.' }
  ];
  const qcRef = id => { if (!TR.db.loaded) return null; const r = TR.db.runFresh(QC.find(q => q.id === id).ref); return r.ok && r.rows[0] ? +r.rows[0][0] : null; };
  const parseN = v => { const s = String(v == null ? '' : v).replace(/\s/g, ''); return s === '' ? NaN : +s; };
  const quality = {
    id: 'quality', title: 'Можно ли верить цифрам? Проверка качества данных',
    lead: ui.brief({ situation: 'Перед отправкой отчёта Артём останавливает вас: «Данные перенесли из старой кассы и Excel. Прежде чем Борис Ильич понесёт цифры в банк — проверим, что в базе нет мусора».', todo: ['Для каждого вопроса напишите запрос в консоли (подсказка — под вопросом) и впишите число.', 'Нажмите «Проверить». В разборе — сами проблемные строки.'], look: 'Это четыре типовые проверки качества: дубли, «висящие» статусы, пересечения интервалов и сверка сумм.' }),
    blank: () => ({ n: {}, sql: {} }),
    reference: () => ({ n: Object.fromEntries(QC.map(q => [q.id, String(qcRef(q.id))])), sql: Object.fromEntries(QC.map(q => [q.id, q.ref])) }),
    render(el, ctx) {
      const a = ctx.ans; a.n = a.n || {}; a.sql = a.sql || {};
      const judged = !!(ctx.result || ctx.readonly);
      el.innerHTML = `<div class="stack">${QC.map((q, i) => { const v = parseN(a.n[q.id]), r = judged ? qcRef(q.id) : null; return `<div class="s5-q"><h5>Проверка ${i + 1}. ${esc(q.t)}</h5><details class="more"><summary>Подсказка</summary><div class="small">${esc(q.hint)}</div></details><div data-c="${q.id}"></div>
        <div class="s5-num"><label for="qc-${q.id}" class="small">Ваш ответ — число:</label><input id="qc-${q.id}" type="text" inputmode="numeric" data-n="${q.id}" value="${esc(a.n[q.id] || '')}" class="${judged && a.n[q.id] ? (v === r ? 'ok' : 'bad') : ''}" ${ctx.readonly ? 'readonly' : ''}></div></div>`; }).join('')}</div>`;
      QC.forEach(q => TR.db.console(TR.$(`[data-c="${q.id}"]`, el), { value: ctx.readonly ? q.ref : a.sql[q.id] || '', readonly: ctx.readonly, rows: 4, tables: ['customer', 'orders', 'payment', 'ticket', 'screening', 'film'].slice(0, 6), label: q.t, onChange: v => { a.sql[q.id] = v; ctx.save(); } }));
      el.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.n; if (!k) return; a.n[k] = e.target.value; e.target.classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      if (!TR.db.loaded) return { ok: false, score: 0, summary: 'База ещё загружается — подождите и проверьте снова.' };
      const res = QC.map(q => parseN((ans.n || {})[q.id]) === qcRef(q.id));
      const good = res.filter(Boolean).length;
      return { ok: good === QC.length, score: good / QC.length, summary: `Верно ${good} из ${QC.length}.`, notes: QC.filter((q, i) => !res[i] && (ans.n || {})[q.id]).map(q => ({ ok: false, html: `${esc(q.t)} — не сходится. ${esc(q.hint)}` })) };
    },
    answers: ans => QC.map(q => { const r = qcRef(q.id); return { q: q.t, mine: (ans.n || {})[q.id] || '', right: r == null ? '(база не загрузилась)' : String(r), ok: r != null && parseN((ans.n || {})[q.id]) === r, why: q.because, viz: el => { el.innerHTML = '<span class="small dim">Ищу строки…</span>'; TR.db.ready().then(() => { el.innerHTML = TR.db.resultHTML(TR.db.runFresh(q.rows), { max: 10 }); }).catch(() => { el.innerHTML = ''; }); } }; }),
    viz(el) {
      el.innerHTML = '<div class="stack"><div data-t></div><div class="qp-note">Каждую из этих проверок превращают в регулярный отчёт качества данных: ночью запрос, утром — письмо, если число больше нуля. Для каждой проблемы в разборе выше видны сами строки.</div></div>';
      TR.db.ready().then(() => {
        const rows = QC.map(q => [q.t, String(qcRef(q.id)), { k1: 'формат телефона при вводе + CHECK', k2: 'оплата и статус — в одной транзакции; ночная сверка', k3: 'проверка расписания в приложении, EXCLUDE по интервалу', k4: 'таблица возвратов refund; сверка с банком' }[q.id]]);
        TR.$('[data-t]', el).innerHTML = ui.dbt({ name: 'Отчёт качества данных «Кадра»', cols: ['Проверка', 'Найдено', 'Как лечить'], rows, cells: Object.fromEntries(rows.map((r, i) => [i + ':1', +r[1] > 0 ? 'bad' : 'ok'])) });
      }).catch(() => { });
    },
    explain: '<p>Ограничения ловят ошибки в одной строке и по ссылке, но не правила, которые связывают несколько таблиц или время. Для них — запросы качества: дубли по нормализованному ключу, «висящие» статусы без подтверждения, пересечения интервалов, сверка сумм между таблицами. Самая ценная находка — расхождение сумм из-за частичных возвратов: это не мусор, а пробел в модели (нет таблицы возвратов). Аналитик, который нашёл это до банка, спас Бориса Ильича от неловкого разговора.</p>',
    report: ans => QC.map(q => `- ${q.t}: ${(ans.n || {})[q.id] || '—'}`).join('\n')
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 3, order: 50, slot: 'Занятие 5', title: 'SQL для системного аналитика',
    when: 'понедельник следующей недели · отчёт для Бориса Ильича, живая база «Кадра»',
    intro: [
      { who: 'boris', html: 'Мне к обеду нужна выручка по кинотеатрам и что продаётся. И я понесу эти цифры в банк — так что они должны быть правдой.' },
      { who: 'artem', html: 'База «Кадра» перед тобой, прямо в браузере. Сначала разберёмся, как база читает запрос, где прячутся NULL и как JOIN теряет и размножает строки. Потом — запросы и проверка, можно ли верить данным.' }
    ],
    facts: ['F-report', 'F-refund', 'F-box'],
    glossary: [
      { term: 'SQL', simple: 'Язык запросов к реляционной базе: выбрать, добавить, изменить, удалить данные.', tech: 'Structured Query Language: DQL (SELECT), DML (INSERT/UPDATE/DELETE), DDL (CREATE/ALTER), DCL (GRANT), TCL (COMMIT/ROLLBACK).' },
      { term: 'Порядок выполнения запроса', simple: 'FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.', tech: 'Логический порядок обработки SELECT; объясняет, где доступны псевдонимы и агрегаты.' },
      { term: 'WHERE', simple: 'Фильтр строк до группировки.', tech: 'Предикат над строками; агрегаты в нём недопустимы.' },
      { term: 'GROUP BY', simple: 'Раскладывает строки по группам: одинаковое значение — одна группа.', tech: 'Группировка для агрегатных функций; каждый неагрегированный столбец SELECT должен быть в GROUP BY (в строгих СУБД).' },
      { term: 'HAVING', simple: 'Фильтр групп после подсчёта: «где продано больше 50».', tech: 'Предикат над группами, может содержать агрегаты.' },
      { term: 'Агрегатная функция', simple: 'Считает по группе одно число: COUNT, SUM, AVG, MIN, MAX.', tech: 'Агрегаты пропускают NULL; COUNT(*) считает строки.' },
      { term: 'NULL', simple: 'Значение неизвестно. Не ноль и не пустая строка.', tech: 'Отсутствие значения; сравнения с NULL дают UNKNOWN; проверка — IS NULL.' },
      { term: 'Трёхзначная логика', simple: 'Кроме «истина» и «ложь» есть «неизвестно» — результат сравнения с NULL.', tech: 'TRUE / FALSE / UNKNOWN; WHERE пропускает только TRUE.' },
      { term: 'COALESCE', simple: 'Подставить значение вместо NULL: COALESCE(promo, \'без промокода\').', tech: 'Возвращает первый не-NULL аргумент.' },
      { term: 'INNER JOIN', simple: 'Соединение, где остаются только строки с парой.', tech: 'Декартово произведение, отфильтрованное условием ON.' },
      { term: 'LEFT JOIN', simple: 'Все строки левой таблицы; где пары нет — справа NULL.', tech: 'LEFT OUTER JOIN. Условие на правую таблицу — в ON, иначе он превращается в INNER.' },
      { term: 'Размножение строк (fan-out)', simple: 'Строка повторяется столько раз, сколько у неё пар; суммы после этого завышены.', tech: 'Эффект соединения с несколькими таблицами «многие»; лечится агрегацией в подзапросах до соединения.' },
      { term: 'NOT EXISTS', simple: 'Проверка «нет ни одной связанной строки» — безопасна при NULL.', tech: 'Коррелированный подзапрос; в отличие от NOT IN корректно работает с NULL.' },
      { term: 'Подзапрос', simple: 'Запрос внутри запроса.', tech: 'Скалярный, табличный, коррелированный; в SELECT, FROM, WHERE, HAVING.' },
      { term: 'Качество данных', simple: 'Насколько данным можно верить: нет дублей, пропусков, противоречий.', tech: 'Data quality: полнота, уникальность, согласованность, актуальность; проверки запросами и мониторинг.' }
    ],
    outro: 'Отчёт собран, а до банка найдены дубли, потерянные платежи, пересечение в расписании и дыра в модели — нет таблицы возвратов. Следующее занятие — под капотом: транзакции, уровни изоляции и индексы.',
    tasks: [howSelect, order, howNull, predict, howJoin, bugs, write, quality]
  });
})();
