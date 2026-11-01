/* Занятие 1. Основы баз данных и реляционная модель: таблица и термины, первичные и внешние ключи, ограничения,
   ON DELETE, нормализация и нормальные формы, транзакции и ACID. Ключ преподавателя — _dev/key/10-basics.md. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'basics';

  // ---------- Excel Нины Сергеевны: одна таблица на всё ----------
  const FLAT = {
    name: 'Продажи.xlsx — лист «Март»',
    cols: ['Заказ', 'Покупатель', 'Телефон', 'Фильм', 'Длит.', 'Жанры', 'Сеанс', 'Ряд-место', 'Цена'],
    rows: [
      [501, 'Анна Смирнова', '+79120001122', 'Глубина', 142, 'фантастика, триллер', '12.03 20:00', '5-7', 700],
      [501, 'Анна Смирнова', '+79120001122', 'Глубина', 142, 'фантастика, триллер', '12.03 20:00', '5-8', 700],
      [502, 'Иван Попов', '+79120003344', 'Котопёс', 86, 'мультфильм, комедия', '13.03 11:00', '2-3', 300],
      [503, 'Анна Смирнова', '+79120001122', 'Котопёс', 86, 'мультфильм, комедия', '13.03 11:00', '2-4', 300],
      [504, 'Олег Ким', '+79120005566', 'Архив', 99, 'триллер', '13.03 20:00', '3-1', 500]
    ]
  };
  const SPLIT = [
    { name: 'customer', cols: [{ n: 'id', k: 'PK' }, 'full_name', 'phone'], rows: [[1, 'Анна Смирнова', '+79120001122'], [2, 'Иван Попов', '+79120003344'], [3, 'Олег Ким', '+79120005566']] },
    { name: 'film', cols: [{ n: 'id', k: 'PK' }, 'title', 'duration_min'], rows: [[1, 'Глубина', 142], [2, 'Котопёс', 86], [3, 'Архив', 99]] },
    { name: 'orders', cols: [{ n: 'id', k: 'PK' }, { n: 'customer_id', k: 'FK' }], rows: [[501, 1], [502, 2], [503, 1], [504, 3]] },
    { name: 'ticket (упрощённо: фильм вместо сеанса)', cols: [{ n: 'id', k: 'PK' }, { n: 'order_id', k: 'FK' }, { n: 'film_id', k: 'FK' }, 'seat', 'price'], rows: [[1, 501, 1, '5-7', 700], [2, 501, 1, '5-8', 700], [3, 502, 2, '2-3', 300], [4, 503, 2, '2-4', 300], [5, 504, 3, '3-1', 500]] }
  ];
  const ANOM_OPS = [
    { id: 'upd', t: 'Изменить: Анна сменила телефон', flat: { cells: ['0:2', '1:2', '3:2'] }, split: [{ cells: ['0:2'] }], note: '<b>Аномалия изменения.</b> В Excel телефон Анны записан в трёх строках — менять надо в трёх местах. Забудете одну — у Анны два телефона, и какой верный, уже не понять. В нормализованной базе телефон хранится один раз, в <code>customer</code>: одна ячейка.' },
    { id: 'del', t: 'Удалить: Олег вернул единственный билет', flat: { rows: { 4: 'gone' } }, split: [{ cells: [['2:1', 'ok'], ['2:2', 'ok']] }, { cells: [['2:1', 'ok'], ['2:2', 'ok']] }, {}, { rows: { 4: 'gone' } }], note: '<b>Аномалия удаления.</b> В Excel вместе с продажей исчезает всё: что «Архив» идёт 99 минут и какой у Олега телефон. Эти факты жили только в строке продажи. В базе удаляется один билет, а фильм и покупатель остаются (зелёные).' },
    { id: 'ins', t: 'Добавить: новый фильм ещё без продаж', flat: { add: [[null, null, null, 'Лето в Плёсе', 102, 'комедия', null, null, null]], cells: ['5:0', '5:1', '5:2', '5:6', '5:7', '5:8'] }, split: [{}, { add: [[4, 'Лето в Плёсе', 102]] }], note: '<b>Аномалия вставки.</b> Фильм хочется завести заранее, а в Excel строка — это продажа. Приходится оставлять дыры в заказе, покупателе и цене или придумывать фальшивую продажу. В базе фильм — отдельная строка в <code>film</code>, продажи ему не нужны.' },
    { id: 'gen', t: 'Найти: все триллеры', flat: { cells: [['0:5', 'warn'], ['1:5', 'warn'], ['2:5', 'warn'], ['3:5', 'warn'], ['4:5', 'warn']] }, split: [], note: '<b>Неатомарное значение.</b> Жанры записаны через запятую в одной ячейке. Искать приходится по подстроке — <code>LIKE \'%триллер%\'</code> найдёт и «психотриллер»; переименовать жанр — править каждую строку; посчитать фильмы по жанрам — никак. В базе жанр — строка справочника <code>genre</code>, а связь с фильмом — строка в <code>film_genre</code>.' }
  ];

  // =====================================================================
  // Теория 1. Excel против базы
  const howExcel = {
    id: 'how-excel', title: 'Как это работает: почему Excel ломается, а таблицы базы — нет', covers: ['terms'], free: true, noReset: true,
    simple: { icon: '🗃️', plain: 'База данных хранит каждый факт <b>один раз</b> и в своей таблице: покупатели отдельно, фильмы отдельно, продажи отдельно. Таблицы связаны ключами — номерами строк. Excel Нины Сергеевны записывает всё в одну строку продажи, поэтому один факт повторяется много раз.', analogy: 'Записная книжка, где телефон друга переписан в каждую запись о встрече с ним. Сменил номер — ищите все встречи.', tech: 'Реляционная модель (Э. Кодд, 1970): данные — отношения (таблицы) из кортежей (строк) с атрибутами (столбцами); связи — через значения ключей. Аномалии изменения, вставки и удаления лечит нормализация.' },
    lead: ui.brief({ situation: 'Это настоящий лист Нины Сергеевны за март (пять строк из двух тысяч). Справа — те же данные, разложенные по таблицам базы.', todo: ['Нажимайте операции сверху и смотрите, сколько ячеек надо тронуть слева и справа.', 'Пройдите все четыре — после этого раздел засчитается.'], look: 'Красное — что придётся менять или что потеряется. Зелёное — что сохранилось или добавилось без лишнего.' }),
    render(el, ctx) {
      const a = ctx.ans; a.seen = a.seen || {};
      ui.anomalyViz(el, { flat: FLAT, split: SPLIT, ops: ANOM_OPS.map(o => Object.assign({}, o)), op: a.last || 'upd' });
      ui.onSeg(el, (n, v) => { a.last = v; a.seen[v] = 1; ctx.save(); if (Object.keys(a.seen).length >= 3) ctx.ready(); });
      if (ctx.readonly || Object.keys(a.seen).length >= 3) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Термины на картинке таблицы
  const T_ROWS = [[101, 501, 37, 412, 700, 'active'], [102, 501, 37, 413, 700, 'active'], [103, 502, 41, 15, 300, 'refunded']];
  const T_COLS = [{ n: 'id', k: 'PK' }, { n: 'order_id', k: 'FK' }, { n: 'screening_id', k: 'FK' }, { n: 'seat_id', k: 'FK' }, 'price', 'status'];
  const PARTS = [
    { id: 'p1', t: '① Вся таблица <code>ticket</code> целиком', ok: 'rel', because: 'Таблица в теории — <b>отношение</b>: набор строк одной структуры. «Реляционная» база — от слова relation, отношение, а не от «связей между таблицами».' },
    { id: 'p2', t: '② Одна строка: билет 102', ok: 'tuple', because: 'Строка — <b>кортеж</b> (запись): один экземпляр сущности, здесь один билет со всеми его значениями.' },
    { id: 'p3', t: '③ Столбец <code>price</code>', ok: 'attr', because: 'Столбец — <b>атрибут</b>: одно свойство, у всех строк одного типа. Цена есть у каждого билета.' },
    { id: 'p4', t: '④ Столбец <code>id</code>: у каждого билета свой, не пустой, не меняется', ok: 'pk', because: 'Это <b>первичный ключ</b>: по нему находят ровно одну строку. Уникален, не NULL и не меняется за жизнь строки.' },
    { id: 'p5', t: '⑤ Столбец <code>screening_id</code>: номер строки из таблицы сеансов', ok: 'fk', because: 'Это <b>внешний ключ</b>: значение первичного ключа другой таблицы. База проверяет, что сеанс с таким id существует.' },
    { id: 'p6', t: '⑥ Набор допустимых значений <code>status</code>: active или refunded', ok: 'dom', because: '<b>Домен</b> — множество допустимых значений атрибута. В SQL его задают типом и ограничением CHECK или справочником.' }
  ];
  const TERMS = [{ v: 'rel', t: 'Отношение (таблица)' }, { v: 'tuple', t: 'Кортеж (строка, запись)' }, { v: 'attr', t: 'Атрибут (столбец, поле)' }, { v: 'pk', t: 'Первичный ключ' }, { v: 'fk', t: 'Внешний ключ' }, { v: 'dom', t: 'Домен' }, { v: 'idx', t: 'Индекс' }, { v: 'schema', t: 'Схема базы' }];
  const SLIP_T = { idx: 'индекс — служебная структура для быстрого поиска, на картинке таблицы его не видно', schema: 'схема — описание всех таблиц базы и связей, а не часть одной таблицы', rel: 'отношение — вся таблица целиком', tuple: 'кортеж — одна строка', attr: 'атрибут — столбец целиком', pk: 'первичный ключ определяет строку своей таблицы', fk: 'внешний ключ ссылается на строку другой таблицы', dom: 'домен — множество допустимых значений, а не сами данные' };
  const termCells = { p1: [], p2: [0, 1, 2, 3, 4, 5].map(j => '1:' + j), p3: [0, 1, 2].map(i => i + ':4'), p4: [0, 1, 2].map(i => i + ':0'), p5: [0, 1, 2].map(i => i + ':2'), p6: [0, 1, 2].map(i => i + ':5') };
  const terms = TR.task.match({
    id: 'terms', title: 'Назовите части таблицы билетов',
    lead: ui.brief({ situation: 'Артём показывает первую таблицу будущей базы: «На собеседовании спросят словами из учебника. Давай сверим словарь».', todo: ['Для каждой отмеченной части таблицы выберите термин. Два термина лишние.', 'Нажмите «Проверить».'], look: 'Реляционная модель называет таблицу отношением, строку — кортежем, столбец — атрибутом.' }),
    above: ui.dbt({ name: 'ticket ①', cols: T_COLS, rows: T_ROWS, cells: { '1:0': 'hl', '1:1': 'hl', '1:2': 'hl', '1:3': 'hl', '1:4': 'hl', '1:5': 'hl', '0:4': 'info', '2:4': 'info' }, note: '② — строка билета 102 (подсвечена). ③ price, ④ id, ⑤ screening_id, ⑥ значения status.' }),
    rows: PARTS.map(p => Object.assign({ slip: SLIP_T }, p, { slip: Object.fromEntries(Object.entries(SLIP_T).filter(([k]) => k !== p.ok)) })),
    choices: TERMS, placeholder: 'Термин…',
    viz(el, ans) {
      const m = ans.m || {};
      let cur = 'p2';
      const draw = () => {
        const p = PARTS.find(x => x.id === cur), got = m[cur], lab = v => (TERMS.find(t => t.v === v) || {}).t || '—';
        const cells = Object.fromEntries((termCells[cur] || []).map(k => [k, got && got !== p.ok ? 'bad' : 'hl']));
        el.innerHTML = `<div class="stack">${ui.seg('tp', PARTS.map(x => ({ v: x.id, t: x.t.replace(/<[^>]+>/g, '').slice(0, 2) + ' ' + ((m[x.id] && m[x.id] === x.ok) ? '✓' : m[x.id] ? '✗' : '·') })), cur)}
          ${ui.dbt({ name: 'ticket', cols: T_COLS, rows: T_ROWS, cells, rowCls: cur === 'p1' ? { 0: 'new', 1: 'new', 2: 'new' } : {} })}
          <div class="qp-note"><b>${p.t}</b><br>Вы: ${esc(got ? lab(got) : 'нет ответа')} ${got === p.ok ? '✓' : got ? '✗' : ''} · верно: <b>${esc(lab(p.ok))}</b>. ${p.because}</div></div>`;
      };
      ui.onSeg(el, (n, v) => { cur = v; draw(); });
      draw();
    },
    explain: '<p>Шесть слов, которые звучат на каждом собеседовании: отношение — таблица, кортеж — строка, атрибут — столбец, домен — допустимые значения, первичный ключ — «паспорт» строки, внешний ключ — ссылка на строку другой таблицы. «Реляционная» — от <i>relation</i> (отношение), а не от связей; связи между таблицами строятся ключами.</p>'
  });

  // =====================================================================
  // Теория 2. Ключи, ограничения и внешние ключи
  const TRY = [
    { id: 'ok', t: 'Обычный билет', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price) VALUES (510, 37, 414, 700);", res: 'ok', msg: 'Строка добавлена. status не указан — подставился DEFAULT \'active\'.' },
    { id: 'nn', t: 'Без цены', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price) VALUES (510, 37, 415, NULL);", res: 'bad', msg: 'NOT NULL constraint failed: ticket.price — цена обязательна.' },
    { id: 'uq', t: 'То же место ещё раз', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price) VALUES (511, 37, 412, 700);", res: 'bad', msg: 'UNIQUE constraint failed: ticket.screening_id, ticket.seat_id — место 412 на сеанс 37 уже продано. Ровно то, что случилось в субботу в Excel.' },
    { id: 'ck', t: 'Цена −100', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price) VALUES (510, 37, 416, -100);", res: 'bad', msg: 'CHECK constraint failed: price >= 0.' },
    { id: 'fk', t: 'Несуществующий сеанс', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price) VALUES (510, 9999, 416, 700);", res: 'bad', msg: 'FOREIGN KEY constraint failed — сеанса 9999 нет в таблице screening.' }
  ];
  const howKeys = {
    id: 'how-keys', title: 'Как это работает: ключи, ограничения и что база делает при удалении', covers: ['pk', 'fk', 'constraints', 'ondelete'], free: true, noReset: true,
    simple: { icon: '🔑', plain: '<b>Первичный ключ</b> — номер строки, по которому её находят: уникален, не пустой, не меняется. <b>Внешний ключ</b> — номер строки из другой таблицы: база не даст сослаться на то, чего нет. <b>Ограничения</b> (NOT NULL, UNIQUE, CHECK, DEFAULT) — правила, которые база проверяет сама при каждой записи, кто бы ни писал: сайт, касса или скрипт.', analogy: 'Паспорт (первичный ключ) и графа «мать: паспорт №…» в анкете (внешний ключ). Нельзя вписать паспорт, которого не существует.', tech: 'PRIMARY KEY = UNIQUE + NOT NULL. FOREIGN KEY … REFERENCES … ON DELETE RESTRICT | CASCADE | SET NULL | NO ACTION. Ограничения целостности — последний рубеж: проверки в приложении обходятся, ограничения базы — нет.' },
    lead: ui.brief({ situation: 'Таблица ticket уже с ограничениями. Попробуйте записать в неё разные билеты — база ответит так же, как настоящий PostgreSQL.', todo: ['Нажмите хотя бы три попытки вставки.', 'Ниже — удаление строки, на которую ссылаются: переключайте ON DELETE и жмите «Удалить».'], look: 'Обратите внимание на третью попытку: уникальность пары (сеанс, место) — ответ на субботний скандал.' }),
    render(el, ctx) {
      const a = ctx.ans; a.tried = a.tried || {};
      el.innerHTML = `<div class="stack">${ui.code("CREATE TABLE ticket (\n  id           BIGSERIAL PRIMARY KEY,\n  order_id     BIGINT  NOT NULL REFERENCES orders(id),\n  screening_id BIGINT  NOT NULL REFERENCES screening(id),\n  seat_id      BIGINT  NOT NULL REFERENCES seat(id),\n  price        NUMERIC(8,2) NOT NULL CHECK (price >= 0),\n  status       VARCHAR(10)  NOT NULL DEFAULT 'active',\n  UNIQUE (screening_id, seat_id)\n);", 'sql')}
        <div class="row">${TRY.map(x => `<button type="button" class="btn sm ${a.tried[x.id] ? '' : 'ghost'}" data-try="${x.id}">${esc(x.t)}</button>`).join('')}</div><div data-tryout></div>
        <div class="eyebrow">Удаляем сеанс, на который проданы билеты</div><div data-fk></div></div>`;
      const show = id => { const x = TRY.find(t => t.id === id); TR.$('[data-tryout]', el).innerHTML = ui.code(x.sql, 'sql') + ui.note(x.res === 'ok' ? 'ok' : 'bad', x.res === 'ok' ? 'База: готово' : 'База: ошибка', esc(x.msg)); };
      if (a.last) show(a.last);
      TR.on(el, 'click', '[data-try]', (e, b) => { a.tried[b.dataset.try] = 1; a.last = b.dataset.try; ctx.save(); b.classList.remove('ghost'); show(b.dataset.try); if (Object.keys(a.tried).length >= 3) ctx.ready(); });
      ui.fkViz(TR.$('[data-fk]', el), { parent: { name: 'screening', cols: [{ n: 'id', k: 'PK' }, 'film', 'starts_at'], rows: [[37, 'Глубина', '12.03 20:00'], [41, 'Котопёс', '13.03 11:00']] }, child: { name: 'ticket', cols: [{ n: 'id', k: 'PK' }, { n: 'screening_id', k: 'FK' }, 'seat_id', 'price'], rows: [[101, 37, 412, 700], [102, 37, 413, 700], [103, 41, 15, 300]], fk: 1 }, del: 0, mode: 'RESTRICT' });
      if (ctx.readonly || Object.keys(a.tried).length >= 3) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 2. Годится ли в первичный ключ
  const PK_REQ = ['уникален', 'не пустой', 'не меняется'];
  const PKI = [
    { id: 'phone', t: '<code>customer.phone</code> — телефон покупателя', ok: 'no', req: [1, 1, 0], because: 'Телефон уникален, но <b>меняется</b>: человек сменил номер — и ключ, и все ссылки на него из заказов надо переписывать. А старый номер оператор отдаст другому человеку. Телефон — UNIQUE, но не первичный ключ.', why: 'телефон меняется и переходит к другому человеку', ex: { name: 'customer, через год', cols: ['phone', 'full_name'], rows: [['+79120001122', 'Анна Смирнова'], ['+79120001122', 'Пётр Белов — номер отдали ему']], cells: { '0:0': 'bad', '1:0': 'bad' } } },
    { id: 'email', t: '<code>customer.email</code> — почта', ok: 'no', req: [1, 0, 0], because: 'Почта необязательна: у покупателей с кассы и у части приложения её нет. Первичный ключ не может быть NULL.', why: 'почты может не быть — NULL', ex: { name: 'customer', cols: ['email', 'full_name'], rows: [['anna@mail.example', 'Анна'], [null, 'Иван'], [null, 'Олег']], cells: { '1:0': 'bad', '2:0': 'bad' } } },
    { id: 'name', t: '<code>customer.full_name</code> — имя', ok: 'no', req: [0, 1, 0], because: 'Тёзки встречаются постоянно: «Анна Смирнова» в городе-миллионнике не одна.', why: 'имена повторяются', ex: { name: 'customer', cols: ['full_name', 'phone'], rows: [['Анна Смирнова', '+7912…1122'], ['Анна Смирнова', '+7922…8890']], cells: { '0:0': 'bad', '1:0': 'bad' } } },
    { id: 'id', t: '<code>customer.id</code> — номер, который выдаёт база', ok: 'yes', req: [1, 1, 1], because: 'Суррогатный ключ: смысла не несёт, поэтому и меняться ему незачем. Уникальность и непустоту гарантирует сама база (последовательность, IDENTITY).', ex: { name: 'customer', cols: [{ n: 'id', k: 'PK' }, 'full_name'], rows: [[1, 'Анна Смирнова'], [2, 'Анна Смирнова']], cells: { '0:0': 'ok', '1:0': 'ok' } } },
    { id: 'seat', t: '<code>seat</code>: пара (hall_id, row_no, seat_no)', ok: 'yes', req: [1, 1, 1], because: 'Естественный составной ключ: в зале не бывает двух «5-й ряд, 7-е место», и номер места не меняется. На практике часто добавляют суррогатный id, а эту тройку делают UNIQUE — так короче ссылки из билетов. Оба варианта корректны.', ex: { name: 'seat', cols: [{ n: 'hall_id', k: 'PK' }, { n: 'row_no', k: 'PK' }, { n: 'seat_no', k: 'PK' }, 'kind'], rows: [[3, 5, 7, 'vip'], [3, 5, 8, 'vip'], [1, 5, 7, 'sofa']], cells: { '0:1': 'ok', '0:2': 'ok', '2:1': 'ok', '2:2': 'ok' }, note: '«5-7» встречается дважды, но в разных залах — тройка уникальна.' } },
    { id: 'tk', t: '<code>ticket</code>: пара (screening_id, seat_id)', ok: 'no', req: [0, 1, 1], because: 'После возврата место продают снова — у пары (сеанс, место) появится вторая строка: возвращённый билет и новый. Уникальна пара только среди <b>активных</b> билетов — это частичный уникальный индекс, а не первичный ключ.', why: 'после возврата место продают повторно — пара повторится', ex: { name: 'ticket', cols: [{ n: 'id', k: 'PK' }, 'screening_id', 'seat_id', 'status'], rows: [[101, 37, 412, 'refunded'], [188, 37, 412, 'active']], cells: { '0:1': 'bad', '0:2': 'bad', '1:1': 'bad', '1:2': 'bad' } } },
    { id: 'title', t: '<code>film.title</code> — название фильма', ok: 'no', req: [0, 1, 0], because: 'Ремейки и одноимённые фильмы: «Солярис» 1972 и 2002. А опечатку в названии исправляют — ключ поменяется.', why: 'названия повторяются и исправляются', ex: { name: 'film', cols: ['title', 'release_date'], rows: [['Солярис', '1972-03-20'], ['Солярис', '2002-11-27']], cells: { '0:0': 'bad', '1:0': 'bad' } } },
    { id: 'fg', t: '<code>film_genre</code>: пара (film_id, genre_id)', ok: 'yes', req: [1, 1, 1], because: 'В таблице-связке строка и есть пара «фильм — жанр»; дважды одну пару хранить незачем. Составной ключ из двух внешних ключей — классика для «многие ко многим».', ex: { name: 'film_genre', cols: [{ n: 'film_id', k: 'PK FK' }, { n: 'genre_id', k: 'PK FK' }], rows: [[4, 3], [4, 4], [2, 3]], cells: { '0:0': 'ok', '0:1': 'ok', '1:0': 'ok', '1:1': 'ok' } } }
  ];
  const pkMatrix = (ans, focus) => ui.dbt({ name: 'Три требования к первичному ключу', cols: ['Кандидат', ...PK_REQ, 'Годится?', 'Вы'], html: true, rows: PKI.map(i => { const got = ((ans || {}).b || {})[i.id]; return [`<code>${esc(i.t.replace(/<[^>]+>/g, '').split(' — ')[0])}</code>`, ...i.req.map(x => x ? '✓' : '✗'), i.ok === 'yes' ? '<b>да</b>' : 'нет', got ? (got === 'yes' ? 'да' : 'нет') + (got === i.ok ? ' ✓' : ' ✗') : '—']; }), cells: Object.assign({}, ...PKI.map((i, r) => Object.fromEntries(i.req.map((x, j) => [r + ':' + (j + 1), x ? 'ok' : 'bad'])))), rowCls: (row, r) => focus === PKI[r].id ? 'new' : (((ans || {}).b || {})[PKI[r].id] && ((ans || {}).b || {})[PKI[r].id] !== PKI[r].ok ? 'dup' : '') });
  const pk = TR.task.sort({
    id: 'pk', title: 'Кто годится в первичный ключ',
    lead: ui.brief({ situation: 'Разработчик подрядчика предлагает: «Ключ покупателя — телефон, ключ билета — сеанс плюс место, ключ фильма — название. Зачем лишние id?»', todo: ['Разложите кандидатов: годится в первичный ключ или нет.', 'Нажмите «Проверить».'], look: 'Первичный ключ: уникален, всегда заполнен и не меняется за жизнь строки. Проверьте каждого по трём требованиям — и вспомните, что бывает с местом после возврата.' }),
    items: PKI.map(i => ({ id: i.id, t: i.t, ok: i.ok, because: i.because, why: i.why, pic: () => ui.dbt(i.ex) })),
    buckets: [{ id: 'yes', t: 'Годится в первичный ключ' }, { id: 'no', t: 'Не годится' }],
    flags: ans => ((ans.b || {}).phone === 'yes' ? ['Телефон — первичный ключ'] : []).concat((ans.b || {}).tk === 'yes' ? ['(сеанс, место) — первичный ключ билета, забыл про возвраты'] : []),
    viz(el, ans) {
      let cur = PKI.find(i => ((ans.b || {})[i.id] && ans.b[i.id] !== i.ok))?.id || 'phone';
      const draw = () => {
        const i = PKI.find(x => x.id === cur);
        el.innerHTML = `<div class="stack">${pkMatrix(ans, cur)}<div class="row">${PKI.map(x => `<button type="button" class="btn xs ${x.id === cur ? 'primary' : 'ghost'}" data-pk="${x.id}">${esc(x.t.replace(/<[^>]+>/g, '').split(' — ')[0])}</button>`).join('')}</div>
          <div class="dv-row"><div>${ui.dbt(i.ex)}</div><div class="qp-note">${i.because}</div></div></div>`;
      };
      TR.on(el, 'click', '[data-pk]', (e, b) => { cur = b.dataset.pk; draw(); });
      draw();
    },
    explain: '<p>Ключ должен быть <b>уникальным, обязательным и неизменным</b>. Телефон и почта меняются или отсутствуют, имена и названия повторяются. Поэтому в «Кадре» у каждой таблицы суррогатный <code>id</code>, а естественные уникальные признаки (телефон, тройка «зал–ряд–место») защищены ограничением UNIQUE. Ловушка задания — пара (сеанс, место) у билета: после возврата место продают снова, и пара повторяется. Её уникальность — только среди активных билетов (частичный индекс).</p>'
  });

  // =====================================================================
  // Практика 3. Где живёт внешний ключ
  const FKR = [
    { id: 'ch', t: 'Кинотеатр — Зал', a: 'cinema', b: 'hall', ok: 'b', fk: 'hall.cinema_id', because: 'В кинотеатре много залов, у зала — один кинотеатр. Ссылка всегда со стороны «многих»: у каждого зала поле <code>cinema_id</code>.' },
    { id: 'hs', t: 'Зал — Место', a: 'hall', b: 'seat', ok: 'b', fk: 'seat.hall_id', because: 'Мест в зале много, зал у места один — <code>seat.hall_id</code>.' },
    { id: 'fs', t: 'Фильм — Сеанс', a: 'film', b: 'screening', ok: 'b', fk: 'screening.film_id', because: 'У фильма много сеансов, у сеанса один фильм — <code>screening.film_id</code>.' },
    { id: 'ot', t: 'Заказ — Билет', a: 'orders', b: 'ticket', ok: 'b', fk: 'ticket.order_id', because: 'В заказе один или несколько билетов, билет — в одном заказе: <code>ticket.order_id</code>.' },
    { id: 'co', t: 'Покупатель — Заказ', a: 'customer', b: 'orders', ok: 'b', fk: 'orders.customer_id (может быть NULL)', because: 'У покупателя много заказов: <code>orders.customer_id</code>. Он может быть пустым — покупка на кассе без регистрации.' },
    { id: 'fg', t: 'Фильм — Жанр', a: 'film', b: 'genre', ok: 'link', fk: 'film_genre(film_id, genre_id)', because: 'У фильма несколько жанров, в жанре много фильмов — «многие ко многим». Ни в фильме, ни в жанре одним полем это не записать: нужна таблица-связка <code>film_genre</code> с двумя внешними ключами.' }
  ];
  const FKC = [{ v: 'a', t: 'В первой таблице' }, { v: 'b', t: 'Во второй таблице' }, { v: 'both', t: 'В обеих — для надёжности' }, { v: 'link', t: 'Нужна отдельная таблица-связка' }];
  const FK_SLIP = { a: 'тогда у одной строки «одного» должно быть много значений — список id в одной ячейке, а это ломает первую нормальную форму', both: 'две ссылки навстречу друг другу дублируют факт и расходятся при первой же ошибке; ссылка ставится с одной стороны', link: 'связка нужна для «многие ко многим», а здесь «один ко многим»', b: 'у строки второй таблицы тоже может быть много пар — одним полем не обойтись' };
  const fkPic = (r, got) => {
    const where = got || r.ok;
    if (r.ok === 'link') {
      if (where === 'link') return `<div class="dv-row">${ui.dbt({ name: 'film', cols: [{ n: 'id', k: 'PK' }, 'title'], rows: [[2, 'Последний рейс'], [4, 'Глубина']] })}${ui.dbt({ name: 'film_genre', cols: [{ n: 'film_id', k: 'PK FK' }, { n: 'genre_id', k: 'PK FK' }], rows: [[2, 3], [2, 6], [4, 3], [4, 4]], cells: { '0:0': 'ok', '1:0': 'ok', '2:0': 'ok', '3:0': 'ok' } })}${ui.dbt({ name: 'genre', cols: [{ n: 'id', k: 'PK' }, 'name'], rows: [[3, 'триллер'], [4, 'фантастика'], [6, 'боевик']] })}</div>`;
      return `<div class="dv-row">${ui.dbt({ name: 'film — жанр полем', cols: [{ n: 'id', k: 'PK' }, 'title', { n: 'genre_id', k: 'FK' }], rows: [[2, 'Последний рейс', '3, 6 ?'], [4, 'Глубина', '3, 4 ?']], cells: { '0:2': 'bad', '1:2': 'bad' }, note: 'Два жанра в одно поле не влезают: либо список через запятую (ломается 1НФ и внешний ключ), либо теряем жанр.' })}</div>`;
    }
    if (where === 'b') return ui.dbt({ name: r.b, cols: [{ n: 'id', k: 'PK' }, { n: r.fk.split('.')[1].split(' ')[0], k: 'FK' }], rows: [[1, 1], [2, 1], [3, 2]], cells: { '0:1': 'ok', '1:1': 'ok', '2:1': 'ok' }, note: `Каждая строка ${r.b} хранит одну ссылку — ровно столько, сколько ей нужно.` });
    if (where === 'a') return ui.dbt({ name: r.a + ' — ссылка «не с той стороны»', cols: [{ n: 'id', k: 'PK' }, r.b + '_ids'], rows: [[1, '1, 2, 3'], [2, '4, 5']], cells: { '0:1': 'bad', '1:1': 'bad' }, note: 'Один кинотеатр — много залов, значит, в одну ячейку надо уложить список. База не проверит такие «ссылки», а добавить зал — значит переписывать строку кинотеатра.' });
    if (where === 'both') return `<div class="dv-row">${ui.dbt({ name: r.a, cols: [{ n: 'id', k: 'PK' }, r.b + '_id ?'], rows: [[1, 2]], cells: { '0:1': 'bad' } })}${ui.dbt({ name: r.b, cols: [{ n: 'id', k: 'PK' }, { n: r.a + '_id', k: 'FK' }], rows: [[1, 1], [2, 1]], cells: { '0:1': 'ok', '1:1': 'ok' } })}</div><p class="small">Встречная ссылка хранит один и тот же факт дважды — и не может вместить «многих».</p>`;
    return ui.note('warn', 'Связка вместо прямой ссылки', 'Таблица-связка для «один ко многим» работает, но позволяет то, чего быть не должно: один зал в двух кинотеатрах. Связь «один ко многим» записывается внешним ключом на стороне «многих».');
  };
  const fk = TR.task.match({
    id: 'fk', title: 'Где поставить внешний ключ',
    lead: ui.brief({ situation: 'Артём: «Ключи выбрали — теперь связи. Для каждой пары скажи, в какой таблице появится поле-ссылка».', todo: ['Для каждой пары таблиц выберите, где хранится внешний ключ.', 'Нажмите «Проверить».'], look: 'Спросите себя в обе стороны: сколько залов у кинотеатра и сколько кинотеатров у зала. Ссылку хранит та сторона, у которой «один».' }),
    rows: FKR.map(r => ({ id: r.id, t: `${esc(r.t)} <span class="small dim">(${r.a} → ${r.b})</span>`, ok: r.ok, because: r.because, slip: Object.fromEntries(Object.entries(FK_SLIP).filter(([k]) => k !== r.ok)), pic: got => fkPic(r, got) })),
    choices: FKC, placeholder: 'Где ссылка…',
    viz(el, ans) {
      ui.er(el, { entities: [
        { id: 'cinema', t: 'cinema', x: 10, y: 10, attrs: [{ n: 'id', k: 'PK' }, { n: 'name' }] },
        { id: 'hall', t: 'hall', x: 250, y: 10, attrs: [{ n: 'id', k: 'PK' }, { n: 'cinema_id', k: 'FK', tone: (ans.m || {}).ch === 'b' ? 'ok' : 'bad' }] },
        { id: 'seat', t: 'seat', x: 490, y: 10, attrs: [{ n: 'id', k: 'PK' }, { n: 'hall_id', k: 'FK', tone: (ans.m || {}).hs === 'b' ? 'ok' : 'bad' }] },
        { id: 'film', t: 'film', x: 10, y: 150, attrs: [{ n: 'id', k: 'PK' }, { n: 'title' }] },
        { id: 'screening', t: 'screening', x: 250, y: 150, attrs: [{ n: 'id', k: 'PK' }, { n: 'film_id', k: 'FK', tone: (ans.m || {}).fs === 'b' ? 'ok' : 'bad' }, { n: 'hall_id', k: 'FK' }] },
        { id: 'genre', t: 'genre', x: 10, y: 310, attrs: [{ n: 'id', k: 'PK' }, { n: 'name' }] },
        { id: 'fg', t: 'film_genre', x: 250, y: 310, tone: (ans.m || {}).fg === 'link' ? 'ok' : 'bad', attrs: [{ n: 'film_id', k: 'PK FK' }, { n: 'genre_id', k: 'PK FK' }] },
        { id: 'customer', t: 'customer', x: 740, y: 10, attrs: [{ n: 'id', k: 'PK' }, { n: 'phone' }] },
        { id: 'orders', t: 'orders', x: 740, y: 150, attrs: [{ n: 'id', k: 'PK' }, { n: 'customer_id', k: 'FK', nul: true, tone: (ans.m || {}).co === 'b' ? 'ok' : 'bad' }] },
        { id: 'ticket', t: 'ticket', x: 490, y: 230, attrs: [{ n: 'id', k: 'PK' }, { n: 'order_id', k: 'FK', tone: (ans.m || {}).ot === 'b' ? 'ok' : 'bad' }, { n: 'screening_id', k: 'FK' }, { n: 'seat_id', k: 'FK' }] }
      ], rels: [
        { a: 'cinema', b: 'hall', ca: '1', cb: '1..N' }, { a: 'hall', b: 'seat', ca: '1', cb: '1..N' }, { a: 'film', b: 'screening', ca: '1', cb: '0..N' }, { a: 'hall', b: 'screening', ca: '1', cb: '0..N' },
        { a: 'film', b: 'fg', ca: '1', cb: '0..N' }, { a: 'genre', b: 'fg', ca: '1', cb: '0..N' }, { a: 'customer', b: 'orders', ca: '0..1', cb: '0..N' }, { a: 'orders', b: 'ticket', ca: '1', cb: '0..N' },
        { a: 'screening', b: 'ticket', ca: '1', cb: '0..N' }, { a: 'seat', b: 'ticket', ca: '1', cb: '0..N' }
      ], width: 960, height: 420, title: 'Внешние ключи «Кадра»' });
      el.insertAdjacentHTML('beforeend', `<div class="qp-note">Внешние ключи — поля с пометкой FK. Зелёные — там, куда вы их поставили верно; красные — где ошиблись. Правило одно: ссылка живёт на стороне «многих» (у лапки), а «многие ко многим» превращается в таблицу-связку с двумя ссылками.</div>`);
    },
    explain: '<p>Правило «ссылка на стороне многих» снимает все сомнения: у зала один кинотеатр — значит <code>hall.cinema_id</code>. Обратная ссылка (список залов в кинотеатре) не помещается в одно поле. Встречные ссылки дублируют факт. Связь «многие ко многим» (фильм — жанр) записывается таблицей-связкой с составным ключом из двух внешних ключей.</p>'
  });

  // =====================================================================
  // Практика 4. Правило → ограничение (и честная проверка в живой базе)
  const CR = [
    { id: 'c1', t: 'У билета обязательно есть цена', ok: 'nn', because: 'Обязательность поля — NOT NULL.', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price, status) VALUES (1, 1, 1, NULL, 'refunded');" },
    { id: 'c2', t: 'Телефон покупателя не повторяется', ok: 'uq', because: 'Неповторяющееся значение одного столбца — UNIQUE. По нему же входят в приложение.', sql: "INSERT INTO customer (full_name, phone, created_at) SELECT 'Тест', phone, '2027-03-14' FROM customer WHERE id = 1;" },
    { id: 'c3', t: 'В зале не бывает двух мест «ряд 1, место 1»', ok: 'uq2', because: 'Уникальна не одна колонка, а их сочетание (зал, ряд, место) — составной UNIQUE.', sql: "INSERT INTO seat (hall_id, row_no, seat_no, kind) VALUES (1, 1, 1, 'standard');" },
    { id: 'c4', t: 'Цена не бывает отрицательной', ok: 'ck', because: 'Правило на значение внутри одной строки — CHECK (price >= 0).', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price, status) VALUES (1, 1, 1, -100, 'refunded');" },
    { id: 'c5', t: 'Сеанс можно создать только для фильма, который есть в базе', ok: 'fk', because: 'Ссылка на строку другой таблицы — FOREIGN KEY.', sql: "INSERT INTO screening (film_id, hall_id, starts_at, base_price) VALUES (999, 1, '2027-03-20 11:00', 250);" },
    { id: 'c6', t: 'Если статус заказа не указан — заказ «new»', ok: 'df', because: 'Значение по умолчанию — DEFAULT \'new\'.', sql: "INSERT INTO orders (customer_id, created_at, channel) VALUES (1, '2027-03-14 20:00', 'app');\nSELECT id, status FROM orders ORDER BY id DESC LIMIT 1;" },
    { id: 'c7', t: 'Место на сеанс продаётся один раз, но после возврата его можно продать снова', ok: 'pu', because: 'Уникальность только среди активных билетов — частичный уникальный индекс: <code>CREATE UNIQUE INDEX … ON ticket (screening_id, seat_id) WHERE status = \'active\'</code>. Обычный UNIQUE не дал бы продать место после возврата.', sql: "INSERT INTO ticket (order_id, screening_id, seat_id, price, status)\nSELECT order_id, screening_id, seat_id, price, 'active' FROM ticket WHERE status = 'active' LIMIT 1;" },
    { id: 'c8', t: 'Покупатель младше 18 лет не покупает билет на фильм 18+', ok: 'app', because: 'Правило связывает три таблицы (покупатель, сеанс, фильм) и зависит от сегодняшней даты. Ограничением таблицы его не выразить — проверка в приложении (или триггер), а на входе в зал — паспорт.', sql: "INSERT INTO customer (full_name, phone, birth_date, created_at) VALUES ('Школьник Петя', '+79990000000', '2013-05-01', '2027-03-14');\nINSERT INTO orders (customer_id, created_at, status, channel) VALUES (last_insert_rowid(), '2027-03-14 19:00', 'new', 'app');\nINSERT INTO ticket (order_id, screening_id, seat_id, price, status)\n  SELECT last_insert_rowid(), s.id, st.id, 450, 'refunded' FROM screening s JOIN seat st ON st.hall_id = s.hall_id WHERE s.film_id = 9 LIMIT 1;\nSELECT 'Билет на 18+ продан 13-летнему — база не возразила' AS итог;" }
  ];
  const CC = [{ v: 'nn', t: 'NOT NULL' }, { v: 'uq', t: 'UNIQUE на столбец' }, { v: 'uq2', t: 'UNIQUE на несколько столбцов' }, { v: 'ck', t: 'CHECK' }, { v: 'fk', t: 'FOREIGN KEY' }, { v: 'df', t: 'DEFAULT' }, { v: 'pu', t: 'Частичный уникальный индекс (… WHERE …)' }, { v: 'app', t: 'Не ограничение таблицы — проверка в приложении' }];
  const crSlip = r => ({ nn: 'NOT NULL требует, чтобы поле было заполнено, но не проверяет значение', uq: r.ok === 'uq2' ? 'уникален не один столбец: ряд 1 есть в каждом зале' : 'UNIQUE запрещает повторы, но не пустоту и не диапазон', uq2: 'составной UNIQUE для сочетания столбцов; тут хватает одного', ck: 'CHECK проверяет значение внутри одной строки и не видит другие таблицы', fk: 'внешний ключ проверяет существование строки в другой таблице', df: 'DEFAULT подставляет значение, но ничего не запрещает', pu: 'частичный индекс нужен, когда уникальность действует только для части строк', app: r.ok === 'app' ? '' : 'это правило база умеет проверять сама — а значит, и должна: проверку в приложении обойдёт любой скрипт' });
  const runViz = (el, sql, label) => {
    el.innerHTML = `<div class="stack tight">${ui.code(sql, 'sql')}<div class="row"><button type="button" class="btn sm" data-run>▶ ${esc(label || 'Нарушить в живой базе')}</button><span class="small dim">выполняется на копии базы «Кадра» (SQLite)</span></div><div data-out></div></div>`;
    TR.on(el, 'click', '[data-run]', async () => {
      const out = TR.$('[data-out]', el); out.innerHTML = '<span class="small dim">Выполняю…</span>';
      try { await TR.db.ready(); } catch (e) { out.innerHTML = ui.note('bad', 'База не загрузилась', 'Нужен интернет: движок грузится с cdnjs.'); return; }
      const r = TR.db.runFresh(sql);
      out.innerHTML = r.ok ? (r.columns.length ? TR.db.resultHTML(r) : ui.note('warn', 'База приняла запись', 'Ограничения нет — строка записалась.')) : ui.note('bad', 'База отказала', esc(r.error));
    });
  };
  const constraints = TR.task.match({
    id: 'constraints', title: 'Правило заказчика → ограничение в базе',
    lead: ui.brief({ situation: 'Нина Сергеевна диктует правила, Артём: «Всё, что база умеет проверять сама, должна проверять сама. Касса, сайт и приложение пишут в одну базу — одна ошибка в любом из них, и правило нарушено».', todo: ['Для каждого правила выберите, чем его обеспечить.', 'Нажмите «Проверить». В разборе каждое правило можно нарушить в живой базе и увидеть ответ.'], look: 'Подумайте про возвраты: что будет с правилом «место продаётся один раз», когда билет вернули.' }),
    rows: CR.map(r => ({ id: r.id, t: esc(r.t), ok: r.ok, because: r.because, slip: Object.fromEntries(Object.entries(crSlip(r)).filter(([k]) => k !== r.ok)), viz: el => runViz(el, r.sql, r.ok === 'df' ? 'Вставить без статуса' : r.ok === 'app' ? 'Попробовать продать' : 'Нарушить в живой базе') })),
    choices: CC, placeholder: 'Чем обеспечить…',
    flags: ans => ((ans.m || {}).c7 === 'uq2' ? ['Обычный UNIQUE на (сеанс, место) — после возврата место не продать'] : []).concat((ans.m || {}).c4 === 'app' || (ans.m || {}).c1 === 'app' ? ['Простые правила оставляет приложению'] : []),
    viz(el, ans) {
      const got = (ans.m || {}).c7;
      el.innerHTML = `<div class="stack"><div class="dv-k">Главное правило «Кадра»: место на сеанс — один раз</div>
        <div class="dv-row">${ui.dbt({ name: 'UNIQUE (screening_id, seat_id)', cols: ['id', 'screening_id', 'seat_id', 'status'], rows: [[101, 37, 412, 'refunded'], [188, 37, 412, 'active']], rowCls: { 1: 'gone' }, note: 'Билет 101 вернули. Продать место 412 снова нельзя: пара уже занята — даже возвращённым билетом. Зал пустеет, деньги теряются.' })}
        ${ui.dbt({ name: 'UNIQUE … WHERE status = \'active\'', cols: ['id', 'screening_id', 'seat_id', 'status'], rows: [[101, 37, 412, 'refunded'], [188, 37, 412, 'active'], [190, 37, 412, 'active']], rowCls: { 1: 'new', 2: 'gone' }, note: 'Возвращённый не мешает: новый билет 188 продан. А второй активный (190) база отвергнет — двойной продажи нет.' })}</div>
        <div class="qp-note">Вы выбрали для этого правила: <b>${esc((CC.find(c => c.v === got) || {}).t || 'нет ответа')}</b>. ${got === 'pu' ? 'Верно.' : 'Верно — частичный уникальный индекс.'} Остальные правила можно нарушить в живой базе прямо в списке ответов выше — кнопка «Нарушить» под каждым.</div></div>`;
    },
    explain: '<p>Что база умеет проверить в одной строке или по ссылке — проверяет база: NOT NULL, UNIQUE (в том числе составной), CHECK, FOREIGN KEY, DEFAULT. Приложению остаются правила, которые зависят от нескольких таблиц и текущего момента (возраст на дату сеанса). Главная ловушка — «место продаётся один раз»: обычный UNIQUE запретит перепродажу после возврата; нужна уникальность только среди активных билетов — частичный индекс (в PostgreSQL и SQLite он так и пишется, в MySQL обходят вычисляемым столбцом).</p>'
  });

  // =====================================================================
  // Практика 5. ON DELETE
  const OD = [
    { id: 'o1', t: 'Удалить фильм, на который уже продавали билеты', ok: 'RESTRICT', because: 'Продажи храним пять лет — фильм с историей удалять нельзя. RESTRICT не даст стереть его случайно; снятый с проката фильм помечают <code>is_archived</code>.', fact: 'F-keep', p: { name: 'film', cols: [{ n: 'id', k: 'PK' }, 'title'], rows: [[9, 'Архив'], [3, 'Котопёс']] }, c: { name: 'screening', cols: [{ n: 'id', k: 'PK' }, { n: 'film_id', k: 'FK' }, 'starts_at'], rows: [[51, 9, '13.03 20:00'], [52, 9, '14.03 20:00'], [53, 3, '13.03 11:00']], fk: 1 } },
    { id: 'o2', t: 'Удалить неоплаченный заказ-черновик вместе с бронями мест', ok: 'CASCADE', because: 'Бронь — часть заказа и без него смысла не имеет. CASCADE удалит заказ вместе с его билетами-бронями и освободит места.', p: { name: 'orders', cols: [{ n: 'id', k: 'PK' }, 'status'], rows: [[777, 'new'], [501, 'paid']] }, c: { name: 'ticket', cols: [{ n: 'id', k: 'PK' }, { n: 'order_id', k: 'FK' }, 'seat_id'], rows: [[901, 777, 412], [902, 777, 413], [101, 501, 15]], fk: 1 } },
    { id: 'o3', t: 'Покупатель попросил удалить его данные, а его заказы нужны бухгалтерии', ok: 'SET NULL', because: 'Заказы остаются для отчётности, а связь с человеком обрывается: <code>customer_id</code> становится NULL (поле должно допускать пустоту). Имя и телефон удаляются вместе со строкой покупателя.', fact: 'F-pd', p: { name: 'customer', cols: [{ n: 'id', k: 'PK' }, 'full_name'], rows: [[17, 'Ольга Новикова'], [3, 'Анна Смирнова']] }, c: { name: 'orders', cols: [{ n: 'id', k: 'PK' }, { n: 'customer_id', k: 'FK' }, 'status'], rows: [[610, 17, 'paid'], [611, 17, 'refunded'], [501, 3, 'paid']], fk: 1 } },
    { id: 'o4', t: 'Удалить жанр «документальный» из справочника вместе со связями фильм — жанр', ok: 'CASCADE', because: 'Строка связки — это пара «фильм + жанр». Без жанра пара бессмысленна, а сами фильмы не страдают: удаляются только строки <code>film_genre</code>.', p: { name: 'genre', cols: [{ n: 'id', k: 'PK' }, 'name'], rows: [[7, 'документальный'], [1, 'драма']] }, c: { name: 'film_genre', cols: [{ n: 'film_id', k: 'PK FK' }, { n: 'genre_id', k: 'PK FK' }], rows: [[11, 7], [12, 7], [1, 1]], fk: 1 } },
    { id: 'o5', t: 'Удалить зал, закрытый навсегда, у которого за годы были тысячи сеансов', ok: 'RESTRICT', because: 'История сеансов и билетов ссылается на зал. Удалять нельзя — зал помечают закрытым (<code>closed_at</code>), а RESTRICT страхует от случайного DELETE.', fact: 'F-keep', p: { name: 'hall', cols: [{ n: 'id', k: 'PK' }, 'name'], rows: [[5, 'Малый'], [4, 'Большой']] }, c: { name: 'screening', cols: [{ n: 'id', k: 'PK' }, { n: 'hall_id', k: 'FK' }, 'film'], rows: [[61, 5, 'Котопёс'], [62, 5, 'Тихая гавань'], [63, 4, 'Архив']], fk: 1 } }
  ];
  const ODC = [{ v: 'RESTRICT', t: 'RESTRICT — запретить удаление' }, { v: 'CASCADE', t: 'CASCADE — удалить и зависимые строки' }, { v: 'SET NULL', t: 'SET NULL — обнулить ссылку' }];
  const OD_SLIP = { RESTRICT: 'удаление станет невозможным, хотя зависимые строки — часть целого и должны уйти вместе с ним', CASCADE: 'вместе с родителем молча исчезнет история, которую обязаны хранить', 'SET NULL': 'ссылка обнулится, и строки останутся «ничьими» — для истории продаж это потеря смысла, а для частей целого — мусор' };
  const ondelete = TR.task.match({
    id: 'ondelete', title: 'Что делать при удалении: RESTRICT, CASCADE или SET NULL',
    lead: ui.brief({ situation: 'Борис Ильич заглядывает к вам: «Если кто-то удалит фильм — продажи за прошлый месяц пропадут?» Это решает ON DELETE у внешнего ключа.', todo: ['Для каждого случая выберите поведение внешнего ключа.', 'Нажмите «Проверить». В разборе каждое удаление можно проиграть.'], look: 'Сверяйтесь с блокнотом: что Борис Ильич говорил про хранение продаж и про удаление данных покупателя.' }),
    rows: OD.map(r => ({ id: r.id, t: esc(r.t), ok: r.ok, because: r.because, slip: Object.fromEntries(Object.entries(OD_SLIP).filter(([k]) => k !== r.ok)), viz: (el, got) => ui.fkViz(el, { parent: r.p, child: r.c, del: 0, mode: got || r.ok, title: 'Проиграйте удаление — начинаем с вашего варианта' }) })),
    choices: ODC, placeholder: 'ON DELETE…',
    flags: ans => ((ans.m || {}).o1 === 'CASCADE' ? ['CASCADE у фильма — стирает историю продаж'] : []),
    viz(el, ans) {
      el.innerHTML = `<div class="stack">${ui.table(['Случай', 'Вы', 'Верно', 'Почему'], OD.map(r => { const g = (ans.m || {})[r.id]; return [esc(r.t), g ? `<span style="color:var(--${g === r.ok ? 'ok' : 'bad'})">${esc(g)}</span>` : '—', `<b>${esc(r.ok)}</b>`, r.because]; }))}
        <div class="qp-note">Подсказка, которая работает почти всегда: <b>часть целого</b> (бронь заказа, строка связки) — CASCADE; <b>история и деньги</b> — RESTRICT плюс пометка «в архиве» вместо удаления; <b>связь с человеком, который ушёл</b> — SET NULL. Под каждым ответом выше можно проиграть удаление в любом режиме.</div></div>`;
    },
    explain: '<p>ON DELETE — это решение аналитика, а не разработчика по умолчанию. В «Кадре»: фильмы и залы с историей — RESTRICT (и мягкое удаление пометкой), брони черновика и строки связок — CASCADE, покупатель по запросу на удаление — SET NULL у заказов и обезличивание. По умолчанию во многих СУБД стоит NO ACTION — почти то же, что RESTRICT (проверка в конце оператора).</p>'
  });

  // =====================================================================
  // Теория 3. Нормальные формы
  const howNorm = TR.NORM_LAB(FLAT, ANOM_OPS, SPLIT);

  // =====================================================================
  // Практика 6. Разнести столбцы Excel по таблицам
  const NB = [{ id: 'customer', t: 'customer', sub: 'покупатель' }, { id: 'film', t: 'film', sub: 'фильм' }, { id: 'genre', t: 'genre + film_genre', sub: 'жанры' }, { id: 'screening', t: 'screening', sub: 'сеанс' }, { id: 'seat', t: 'seat', sub: 'место в зале' }, { id: 'orders', t: 'orders', sub: 'заказ' }, { id: 'ticket', t: 'ticket', sub: 'билет' }];
  const NI = [
    { id: 'n1', t: 'Номер заказа', ok: 'orders', because: 'Номер заказа — его первичный ключ; в билете останется ссылка <code>order_id</code>.', col: 0 },
    { id: 'n2', t: 'Дата и время заказа', ok: 'orders', because: 'Заказ создан один раз — время у заказа, а не у каждого билета.' },
    { id: 'n3', t: 'Имя покупателя', ok: 'customer', because: 'Имя зависит от покупателя, а не от заказа: в листе Анна повторялась трижды.', col: 1 },
    { id: 'n4', t: 'Телефон покупателя', ok: 'customer', because: 'Телефон — свойство покупателя; в заказе — только ссылка <code>customer_id</code>.', col: 2 },
    { id: 'n5', t: 'Название фильма', ok: 'film', because: 'Свойство фильма. В сеансе — ссылка <code>film_id</code>.', col: 3 },
    { id: 'n6', t: 'Длительность фильма', ok: 'film', because: 'Зависит от фильма, а не от сеанса или билета — транзитивная зависимость, нарушение 3НФ.', col: 4 },
    { id: 'n7', t: 'Жанры', ok: 'genre', because: 'Неатомарное значение — нарушение 1НФ. Справочник жанров плюс таблица-связка.', col: 5 },
    { id: 'n8', t: 'Начало сеанса', ok: 'screening', because: 'Сеанс — это фильм в зале в конкретное время. В билете — ссылка на сеанс.', col: 6 },
    { id: 'n9', t: 'Ряд и место', ok: 'seat', because: 'Место — часть схемы зала, оно существует и без продаж. Билет ссылается на <code>seat_id</code>.', col: 7 },
    { id: 'n10', t: 'Цена билета', ok: 'ticket', because: 'Цена — на момент покупки, у каждого билета своя (VIP, скидки, пригласительные). В сеансе — только базовая цена, а прайс меняется.', col: 8 }
  ];
  const norm = TR.task.sort({
    id: 'norm', title: 'Разнесите столбцы листа «Продажи» по таблицам',
    lead: ui.brief({ situation: 'Пора переносить Excel в базу. Артём: «Возьми каждый столбец листа и скажи, в какой таблице он будет жить. Внешние ключи появятся сами».', todo: ['Разложите десять столбцов по семи таблицам.', 'Нажмите «Проверить».'], look: 'Для каждого столбца спросите: «от чего он зависит?» — от покупателя, фильма, сеанса, места, заказа или от конкретного билета.' }),
    items: NI.map(i => ({ id: i.id, t: i.t, ok: i.ok, because: i.because, why: `это свойство таблицы ${(NB.find(b => b.id === i.ok) || {}).t}` })),
    buckets: NB,
    viz(el, ans) {
      const b = ans.b || {};
      const cells = {};
      NI.forEach(i => { if (i.col == null) return; for (let r = 0; r < FLAT.rows.length; r++) cells[r + ':' + i.col] = !b[i.id] ? '' : b[i.id] === i.ok ? 'ok' : 'bad'; });
      el.innerHTML = `<div class="stack"><div class="dv-k">Ваша раскладка на листе Нины Сергеевны</div>${ui.dbt({ name: FLAT.name, cols: FLAT.cols.map((c, j) => { const it = NI.find(i => i.col === j); return it && b[it.id] ? `${c} → ${(NB.find(x => x.id === b[it.id]) || {}).t}` : c; }), rows: FLAT.rows, cells })}
        ${ui.legend([['var(--ok)', 'столбец уехал в верную таблицу'], ['var(--bad)', 'не туда']])}
        <div class="dv-k">Зачем это всё — проверьте аномалии</div><div data-an></div></div>`;
      ui.anomalyViz(TR.$('[data-an]', el), { flat: FLAT, split: SPLIT, ops: ANOM_OPS });
    },
    explain: '<p>Каждый столбец уезжает туда, от чего он зависит: имя и телефон — к покупателю, длительность — к фильму, начало — к сеансу, ряд и место — к месту, время заказа — к заказу. В билете остаются только ссылки и то, что принадлежит именно этому билету: <b>цена на момент покупки</b> и статус. Жанры — классическое нарушение 1НФ: справочник плюс таблица-связка.</p>'
  });

  // =====================================================================
  // Практика 7. Какая нормальная форма нарушена
  const NFQ = [
    { id: 'q1', t: '<code>film(id, title, genres)</code>, где genres = «драма, комедия»', ok: '1', because: 'В ячейке список — значение неатомарно. Нарушена 1НФ.', dep: { cols: [{ n: 'id', key: 1 }, { n: 'title' }, { n: 'genres = «драма, комедия»' }], deps: [{ from: [0], to: [1, 2], bad: true, t: 'в ячейке список — 1НФ', why: 'Зависимость от ключа есть, но значение неатомарно: «драма, комедия» — два значения в одной ячейке.' }] }, fix: 'genre + film_genre' },
    { id: 'q2', t: '<code>customer(id, name, phone1, phone2, phone3)</code>', ok: '1', because: 'Повторяющаяся группа столбцов: четвёртый телефон не влезет, искать по телефону — в трёх местах. Тоже 1НФ: выносим в <code>customer_phone</code>.', dep: { cols: [{ n: 'id', key: 1 }, { n: 'name' }, { n: 'phone1' }, { n: 'phone2' }, { n: 'phone3' }], deps: [{ from: [0], to: [2, 3, 4], bad: true, t: 'три столбца под одно и то же — 1НФ', why: 'phone1, phone2, phone3 — повторяющаяся группа: четвёртый телефон некуда записать, а искать по телефону придётся в трёх столбцах.' }] }, fix: 'customer_phone(customer_id, phone)' },
    { id: 'q3', t: '<code>ticket_line(order_id, seat_id, price, customer_phone)</code>, ключ — (order_id, seat_id); телефон зависит только от заказа', ok: '2', because: 'Телефон зависит от части составного ключа (от заказа), а не от всей пары. Частичная зависимость — нарушение 2НФ.', dep: { title: 'ticket_line — пример строк', rows: [[501, 412, 700, '+79120001122'], [501, 413, 700, '+79120001122'], [502, 15, 300, '+79120003344']], cols: [{ n: 'order_id', key: 1 }, { n: 'seat_id', key: 1 }, { n: 'price' }, { n: 'customer_phone' }], deps: [{ from: [0], to: [3], bad: true, t: 'только от части ключа — 2НФ' }, { from: [0, 1], to: [2], t: 'от всего ключа' }] }, fix: 'телефон — в customer, в заказе — customer_id' },
    { id: 'q4', t: '<code>screening(id, hall_id, hall_format, starts_at)</code> — формат зала хранится в каждом сеансе', ok: '3', because: 'hall_format зависит от hall_id, а тот — от id сеанса: id → hall_id → hall_format. Транзитивная зависимость — нарушение 3НФ. Формат живёт в <code>hall</code>.', dep: { title: 'screening — пример строк', rows: [[51, 2, '3D', '12.03 15:30'], [52, 2, '3D', '12.03 20:00'], [53, 1, '2D', '13.03 11:00']], cols: [{ n: 'id', key: 1 }, { n: 'hall_id' }, { n: 'hall_format' }, { n: 'starts_at' }], deps: [{ from: [1], to: [2], bad: true, t: 'от неключевого hall_id — 3НФ' }, { from: [0], to: [1, 3], t: 'от ключа' }] }, fix: 'hall(id, format)' },
    { id: 'q5', t: '<code>seat(id, hall_id, row_no, seat_no, kind)</code>', ok: 'none', because: 'Каждый столбец — свойство конкретного места и зависит только от id. Нарушений нет.', dep: { cols: [{ n: 'id', key: 1 }, { n: 'hall_id' }, { n: 'row_no' }, { n: 'seat_no' }, { n: 'kind' }], deps: [{ from: [0], to: [1, 2, 3, 4], t: 'всё — от ключа, нарушений нет' }] } },
    { id: 'q6', t: '<code>orders(id, customer_id, customer_name, created_at)</code>', ok: '3', because: 'Имя зависит от покупателя: id → customer_id → customer_name. Транзитивная зависимость, 3НФ. Если имя нужно «на момент заказа» для документа — это осознанная денормализация, и её подписывают явно.', dep: { title: 'orders — пример строк', rows: [[501, 1, 'Анна Смирнова', '12.03 18:02'], [503, 1, 'Анна Смирнова', '13.03 10:40'], [502, 2, 'Иван Попов', '13.03 09:15']], cols: [{ n: 'id', key: 1 }, { n: 'customer_id' }, { n: 'customer_name' }, { n: 'created_at' }], deps: [{ from: [1], to: [2], bad: true, t: 'от неключевого customer_id — 3НФ' }, { from: [0], to: [1, 3], t: 'от ключа' }] }, fix: 'имя — только в customer' }
  ];
  const NFC = [{ v: '1', t: 'Нарушена 1НФ' }, { v: '2', t: 'Нарушена 2НФ' }, { v: '3', t: 'Нарушена 3НФ' }, { v: 'none', t: 'Нарушений нет (3НФ)' }];
  const nf = TR.task.match({
    id: 'nf', title: 'Какая нормальная форма нарушена',
    lead: ui.brief({ situation: 'Подрядчик прислал черновик таблиц. Артём: «Найди, где и что нарушено, — назови форму, на собеседовании спросят именно так».', todo: ['Для каждой таблицы выберите нарушенную нормальную форму или «нарушений нет».', 'Нажмите «Проверить».'], look: '1НФ — неатомарные значения и повторяющиеся группы. 2НФ — зависимость от части составного ключа. 3НФ — зависимость неключевого столбца от другого неключевого.' }),
    rows: NFQ.map(q => ({ id: q.id, t: q.t, ok: q.ok, because: q.because, slip: { '1': 'значения атомарны и повторяющихся групп нет', '2': q.ok === '3' ? 'ключ здесь простой — частичной зависимости не бывает; зависимость идёт через другой столбец' : 'частичная зависимость бывает только у составного ключа', '3': 'транзитивной зависимости через неключевой столбец тут нет', none: 'зависимость «не от ключа» здесь есть — посмотрите на красную стрелку' }, pic: () => ui.depViz(q.dep) + (q.fix ? `<div class="small">Как исправить: <code>${esc(q.fix)}</code></div>` : '') })),
    choices: NFC, placeholder: 'Нормальная форма…',
    viz(el, ans) {
      let cur = NFQ.find(q => (ans.m || {})[q.id] && ans.m[q.id] !== q.ok)?.id || 'q3';
      const draw = () => {
        const q = NFQ.find(x => x.id === cur), g = (ans.m || {})[q.id];
        el.innerHTML = `<div class="stack"><div class="row">${NFQ.map((x, i) => `<button type="button" class="btn xs ${x.id === cur ? 'primary' : 'ghost'}" data-nq="${x.id}">Таблица ${i + 1} ${(ans.m || {})[x.id] ? ((ans.m || {})[x.id] === x.ok ? '✓' : '✗') : ''}</button>`).join('')}</div>
          <div><b>${q.t}</b></div>${ui.depViz(q.dep)}
          <div class="qp-note">Вы: <b>${esc((NFC.find(c => c.v === g) || {}).t || 'нет ответа')}</b> · верно: <b>${esc(NFC.find(c => c.v === q.ok).t)}</b>. ${q.because}</div></div>`;
      };
      TR.on(el, 'click', '[data-nq]', (e, b) => { cur = b.dataset.nq; draw(); });
      draw();
    },
    explain: '<p>Алгоритм на собеседовании: 1) есть ли списки в ячейках или столбцы-близнецы (phone1, phone2) — 1НФ; 2) ключ составной? Есть ли столбец, зависящий только от его части — 2НФ; 3) есть ли столбец, который определяется другим неключевым — 3НФ. Простой ключ (один столбец) не может нарушить 2НФ — это частая ловушка.</p>'
  });

  // =====================================================================
  // Теория 4. Транзакции
  // Три сценария одной покупки: без транзакции, транзакция с отказом банка (ROLLBACK), транзакция с оплатой (COMMIT)
  const ORD = (S, st) => S.ins('orders', [777, st || 'new']);
  const TIX = S => { S.ins('ticket', [9001, 777, 412]); S.ins('ticket', [9002, 777, 413]); };
  const TX_SC = [
    { v: 'no', t: '1. Без транзакции, банк отказал', steps: [
      { t: 'Создать заказ 777', sql: "INSERT INTO orders VALUES (777, 'new');", op: S => ORD(S), note: 'Транзакции нет — значит, каждая команда <b>сразу сохраняется навсегда</b>. Посмотрите справа: кассир уже видит заказ 777, хотя покупатель ещё ничего не оплатил.' },
      { t: 'Занять места 412 и 413', sql: 'INSERT INTO ticket VALUES (9001, 777, 412), (9002, 777, 413);', op: TIX, note: 'Места сразу стали проданными <b>для всех</b>: у кассира они красные, он их уже не продаст.' },
      { t: 'Банк: списать 1 400 ₽ → отказ, не хватает денег', who: 'bank', kind: 'bad', note: 'Банк отказал. Нужно вернуть всё как было — а как? Заказ и билеты уже сохранены отдельными командами.' },
      { t: 'Итог: «полузаказ» остался в базе', kind: 'bad', note: '<b>Отменить нечего</b>: команды прошли по отдельности. Места 412 и 413 заняты, денег нет, в базе висит неоплаченный заказ. Кто-то должен найти его и удалить руками — а если в этот момент упадёт сервер, мусор останется навсегда. Именно от этого спасает транзакция.' }
    ] },
    { v: 'rb', t: '2. В транзакции, банк отказал → ROLLBACK', steps: [
      { t: 'BEGIN — начать транзакцию', sql: 'BEGIN;', op: S => S.begin(), note: '<b>BEGIN</b> говорит базе: «всё, что я сейчас сделаю, — один пакет». Дальше изменения ложатся в <b>черновик</b>: их видит только это приложение.' },
      { t: 'Создать заказ 777', sql: "INSERT INTO orders VALUES (777, 'new');", op: S => ORD(S), note: 'Заказ появился — но жёлтым: это черновик. Приложение его видит, а кассир справа — <b>нет</b>, для него заказа ещё не существует.' },
      { t: 'Занять места 412 и 413', sql: 'INSERT INTO ticket VALUES (9001, 777, 412), (9002, 777, 413);', op: TIX, note: 'Места держит черновик (жёлтые с пунктиром). Кассир видит их свободными, но если попробует продать — база попросит его подождать, пока наша транзакция не закончится. Двойной продажи не будет.' },
      { t: 'Банк: списать 1 400 ₽ → отказ, не хватает денег', who: 'bank', kind: 'bad', note: 'Банк отказал. Но теперь у нас есть кнопка «отменить всё».' },
      { t: 'ROLLBACK — откатить транзакцию', sql: 'ROLLBACK;', op: S => S.rollback(), kind: 'ok', note: '<b>ROLLBACK</b> — «выбросить черновик»: база отменяет <b>всё</b>, что сделано после BEGIN, одной командой. Заказа 777 и броней как не бывало, места свободны и у приложения, и у кассира. Ничего не надо искать и удалять руками. Это и есть атомарность — «всё или ничего».' }
    ] },
    { v: 'ok', t: '3. В транзакции, оплата прошла → COMMIT', steps: [
      { t: 'BEGIN — начать транзакцию', sql: 'BEGIN;', op: S => S.begin(), note: 'Открываем черновик.' },
      { t: 'Создать заказ 777', sql: "INSERT INTO orders VALUES (777, 'new');", op: S => ORD(S), note: 'Заказ — в черновике. Кассир его не видит.' },
      { t: 'Занять места 412 и 413', sql: 'INSERT INTO ticket VALUES (9001, 777, 412), (9002, 777, 413);', op: TIX, note: 'Места держит черновик.' },
      { t: 'Банк: списать 1 400 ₽ → прошло', who: 'bank', kind: 'ok', note: 'Банк подтвердил оплату.' },
      { t: 'Записать платёж', sql: "INSERT INTO payment VALUES (777, 1400, 'ok');", op: S => S.ins('payment', [777, 1400, 'ok']), note: 'Платёж — тоже в черновик.' },
      { t: 'Отметить заказ оплаченным', sql: "UPDATE orders SET status = 'paid' WHERE id = 777;", op: S => S.set('orders', 777, [777, 'paid']), note: 'Статус «paid» — в черновике. Кассир по-прежнему не видит ни заказа, ни платежа.' },
      { t: 'COMMIT — зафиксировать транзакцию', sql: 'COMMIT;', op: S => S.commit(), kind: 'ok', note: '<b>COMMIT</b> — «сохранить черновик». Все четыре изменения (заказ, два билета, платёж, статус) <b>одновременно</b> стали настоящими: кассир теперь видит заказ оплаченным и места проданными. Промежуточного состояния «билеты есть, а платежа нет» не видел никто. После COMMIT отменить уже нельзя — только новым действием, например возвратом.' }
    ] }
  ];
  const howAcid = {
    id: 'how-acid', title: 'Как это работает: транзакция — всё или ничего, и буквы ACID', covers: ['acid'], free: true, noReset: true,
    simple: { icon: '🔒', plain: '<b>Транзакция</b> — несколько изменений, которые база выполняет как одно: либо сохраняются все, либо ни одного. Начинается командой <b>BEGIN</b>; пока она не закончилась, изменения — черновик, который видит только эта транзакция. <b>COMMIT</b> сохраняет черновик целиком, <b>ROLLBACK</b> выбрасывает его целиком. <b>ACID</b> — четыре обещания транзакции: <b>A</b>томарность (всё или ничего), <b>C</b>огласованность (ограничения соблюдены до и после), <b>I</b>золированность (параллельные транзакции не мешают друг другу), <b>D</b>олговечность (подтверждённое не пропадёт при сбое).', analogy: 'Перевод денег: списали у одного и зачислили другому — или ни то, ни другое. Половины перевода не бывает.', tech: 'BEGIN … COMMIT / ROLLBACK. Долговечность — журнал предзаписи (WAL): изменение сначала пишется в журнал на диск, потом подтверждается. Изолированность настраивается уровнями изоляции — разберём в занятии про транзакции.' },
    lead: ui.brief({ situation: 'Покупатель покупает два билета: приложение создаёт заказ, занимает места и идёт в банк. Три сценария одной покупки.', todo: ['Пройдите каждый сценарий кнопкой «Шаг →» и после каждого шага смотрите на обе панели: что видит само приложение и что в ту же секунду видит кассир.', 'Пройдите хотя бы первые два сценария до конца.'], look: 'Жёлтое — черновик транзакции: ещё не сохранено, кассир этого не видит. Сравните, чем кончается отказ банка без транзакции и с ROLLBACK.' }),
    render(el, ctx) {
      const a = ctx.ans; a.seen = a.seen || {};
      ui.txViz(el, { scenarios: TX_SC, start: 'no', onEnd: v => { if (a.seen[v]) return; a.seen[v] = 1; ctx.save(); if (Object.keys(a.seen).length >= 2) ctx.ready(); } });
      if (ctx.readonly || Object.keys(a.seen).length >= 2) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 8. Буквы ACID
  const LANES = [{ id: 'a', t: 'Касса' }, { id: 'db', t: 'База' }, { id: 'b', t: 'Приложение' }];
  const ACIDQ = [
    { id: 'a1', t: 'Деньги списались, а при создании билетов сервер упал. После перезапуска нет ни заказа, ни билетов, деньги вернулись автоматически', ok: 'A', because: 'Незавершённая транзакция откатилась целиком — это атомарность: всё или ничего.', steps: [{ from: 'a', to: 'db', t: 'BEGIN; INSERT заказ' }, { from: 'a', to: 'db', t: 'INSERT билеты…' }, { from: 'db', to: 'db', t: 'сбой сервера', kind: 'bad' }, { from: 'db', to: 'db', t: 'после рестарта: откат', kind: 'ok', note: 'Транзакция не дошла до COMMIT — база откатывает её целиком.' }] },
    { id: 'a2', t: 'База отказалась сохранить билет с ценой −100 ₽', ok: 'C', because: 'Транзакция переводит базу из одного корректного состояния в другое: ограничения (CHECK, FK, UNIQUE) соблюдены. Нарушение — откат. Это согласованность.', steps: [{ from: 'a', to: 'db', t: 'INSERT price = -100' }, { from: 'db', to: 'a', t: 'CHECK price >= 0 нарушен', reply: true, kind: 'bad', note: 'Ограничение не пустило некорректные данные.' }] },
    { id: 'a3', t: 'Кассир и приложение одновременно покупают место 412: каждая операция работает так, будто она одна, и одна из них получает отказ', ok: 'I', because: 'Параллельные транзакции не видят незавершённых изменений друг друга и не портят их — изолированность. Отказ второй гарантирует ограничение уникальности.', steps: [{ from: 'a', to: 'db', t: 'BEGIN; место 412 свободно?' }, { from: 'b', to: 'db', t: 'BEGIN; место 412 свободно?' }, { from: 'a', to: 'db', t: 'INSERT билет 412; COMMIT', kind: 'ok' }, { from: 'b', to: 'db', t: 'INSERT билет 412' }, { from: 'db', to: 'b', t: 'ошибка уникальности → откат', reply: true, kind: 'bad', note: 'Вторая транзакция не испортила первую: одна продажа на место.' }] },
    { id: 'a4', t: 'Сразу после «Оплачено» отключили электричество. После включения заказ на месте', ok: 'D', because: 'Подтверждённая (COMMIT) транзакция пережила сбой — долговечность. Её обеспечивает журнал предзаписи на диске.', steps: [{ from: 'b', to: 'db', t: 'COMMIT', kind: 'ok' }, { from: 'db', to: 'b', t: 'Оплачено', reply: true }, { from: 'db', to: 'db', t: 'отключили свет', kind: 'bad' }, { from: 'db', to: 'db', t: 'включили: заказ на месте', kind: 'ok', note: 'COMMIT записан в журнал на диск до ответа «Оплачено».' }] },
    { id: 'a5', t: 'Отчёт Бориса Ильича считается 20 секунд и всё это время видит продажи на момент начала, хотя кассы продолжают продавать', ok: 'I', because: 'Отчёт видит согласованный снимок данных и не замечает чужих изменений, сделанных после его начала, — это тоже изоляция (снимок, MVCC).', steps: [{ from: 'b', to: 'db', t: 'отчёт: BEGIN (снимок 20:00)' }, { from: 'a', to: 'db', t: 'продажа 20:00:05; COMMIT' }, { from: 'db', to: 'b', t: 'отчёт видит данные на 20:00', reply: true, kind: 'ok', note: 'Снимок не меняется до конца транзакции отчёта.' }] }
  ];
  const ACIDC = [{ v: 'A', t: 'A — атомарность' }, { v: 'C', t: 'C — согласованность' }, { v: 'I', t: 'I — изолированность' }, { v: 'D', t: 'D — долговечность' }, { v: 'R', t: 'Репликация' }];
  const acid = TR.task.match({
    id: 'acid', title: 'Узнайте букву ACID в ситуации',
    lead: ui.brief({ situation: 'Последний вопрос дня. Артём: «Четыре буквы все помнят, а узнать их в живой ситуации может не каждый».', todo: ['Для каждой ситуации выберите свойство транзакции. Один вариант лишний.', 'Нажмите «Проверить».'], look: 'A — всё или ничего; C — правила целы; I — параллельные не мешают; D — подтверждённое не теряется.' }),
    rows: ACIDQ.map(q => ({ id: q.id, t: esc(q.t), ok: q.ok, because: q.because, slip: { A: 'атомарность — про незавершённую транзакцию целиком', C: 'согласованность — про ограничения и правила данных', I: 'изолированность — про параллельные транзакции', D: 'долговечность — про подтверждённое и сбой после него', R: 'репликация — копии базы на других серверах, к ACID отношения не имеет' }, viz: el => ui.seq(el, { lanes: LANES, steps: q.steps, start: 'all', laneW: 170, row: 42 }) })),
    choices: ACIDC, placeholder: 'Свойство…',
    viz(el, ans) {
      el.innerHTML = `<div class="stack">${ui.table(['', 'Обещание', 'Что ломается без него', 'Ваши ситуации'], [['A', 'Всё или ничего', 'полузаказы: места заняты, денег нет'], ['C', 'Ограничения соблюдены', 'билет с отрицательной ценой, ссылка в никуда'], ['I', 'Параллельные не мешают', 'двойная продажа, отчёт «плавает» во время подсчёта'], ['D', 'Подтверждённое не теряется', 'клиенту сказали «оплачено», а заказа нет']].map(r => r.concat([ACIDQ.map((q, i) => (ans.m || {})[q.id] === r[0] ? `${i + 1}${q.ok === r[0] ? '✓' : '✗'}` : '').filter(Boolean).join(', ') || '—'])))}
        <div class="qp-note">Под каждым ответом выше — диаграмма последовательности именно этой ситуации. Цифры в последнем столбце — номера ситуаций, которые вы отнесли к букве. Ниже — атомарность и изоляция по шагам: что лежит в базе у приложения и у кассира.</div><div data-tx></div></div>`;
      ui.txViz(TR.$('[data-tx]', el), { scenarios: TX_SC, start: 'rb' });
    },
    explain: '<p>Атомарность — сбой посреди транзакции не оставляет половины. Согласованность — ограничения базы соблюдены после каждой транзакции. Изолированность — параллельные транзакции не видят незавершённого чужого и не портят друг друга (уровни изоляции — в занятии про транзакции). Долговечность — после COMMIT данные переживут сбой. Репликация — про копии на других серверах, к ACID отношения не имеет.</p>'
  });

  // =====================================================================
  TR.stage({
    id: ID, act: 1, order: 10, slot: 'Занятие 1', title: 'Основы баз данных и реляционная модель',
    when: 'понедельник · переговорная «Кадра», на столе ноутбук Нины Сергеевны с Excel',
    intro: [
      { who: 'nina', html: 'Вот наш Excel. Две тысячи строк за март, всё работает. Ну, почти — в субботу одно место продали дважды.' },
      { who: 'artem', html: 'Сегодня разбираем, почему «почти». Таблицы, ключи, ограничения, нормализация, транзакции — основа, на которой стоит всё остальное. После каждого задания — разбор на схеме: смотрите, как ваш ответ выглядит внутри базы.' }
    ],
    glossary: [
      { term: 'База данных', simple: 'Организованное хранилище данных, которым управляет СУБД.', tech: 'Совокупность данных, организованных по модели (реляционной, документной и др.), с доступом через СУБД.' },
      { term: 'СУБД', simple: 'Программа, которая хранит данные, проверяет правила и выполняет запросы: PostgreSQL, MySQL, Oracle, SQLite.', tech: 'Система управления базами данных: хранение, язык запросов, ограничения целостности, транзакции, конкурентный доступ, восстановление.' },
      { term: 'Отношение (таблица)', simple: 'Таблица: набор строк одной структуры.', tech: 'Relation — множество кортежей над набором атрибутов. Отсюда «реляционная модель».' },
      { term: 'Кортеж (строка, запись)', simple: 'Одна строка таблицы — один экземпляр: один билет, один фильм.', tech: 'Упорядоченный набор значений атрибутов одной строки отношения.' },
      { term: 'Атрибут (столбец, поле)', simple: 'Свойство, общее для всех строк таблицы: цена, название.', tech: 'Именованный столбец отношения со своим доменом (типом и ограничениями).' },
      { term: 'Домен', simple: 'Множество допустимых значений столбца.', tech: 'Тип данных плюс ограничения на значения (CHECK, перечисление, справочник).' },
      { term: 'Первичный ключ (PK)', simple: 'Поле или набор полей, по которым находят ровно одну строку. Уникален, не пустой, не меняется.', tech: 'PRIMARY KEY = UNIQUE + NOT NULL; по нему строится индекс. Бывает простым и составным, естественным и суррогатным.' },
      { term: 'Суррогатный ключ', simple: 'Номер строки без смысла, который выдаёт база: id = 1, 2, 3…', tech: 'Искусственный ключ (SERIAL/IDENTITY, UUID). Не меняется, потому что ничего не означает.' },
      { term: 'Естественный ключ', simple: 'Ключ из реальных данных: ИНН, тройка «зал — ряд — место».', tech: 'Уникальный набор атрибутов предметной области; рискован, если значения меняются.' },
      { term: 'Составной ключ', simple: 'Ключ из нескольких полей сразу.', tech: 'PRIMARY KEY (a, b): уникальна комбинация, а не каждое поле.' },
      { term: 'Внешний ключ (FK)', simple: 'Поле со ссылкой на первичный ключ другой таблицы. База не даст сослаться на несуществующее.', tech: 'FOREIGN KEY (x) REFERENCES t(id) ON DELETE … ON UPDATE …: ссылочная целостность.' },
      { term: 'Ссылочная целостность', simple: 'Правило: каждая ссылка указывает на существующую строку.', tech: 'Обеспечивается внешними ключами и действиями ON DELETE / ON UPDATE.' },
      { term: 'NOT NULL', simple: 'Поле обязательно к заполнению.', tech: 'Ограничение столбца: запрет значения NULL.' },
      { term: 'UNIQUE', simple: 'Значение (или сочетание значений) не повторяется.', tech: 'Ограничение уникальности; NULL обычно уникальностью не считается — несколько NULL допустимы.' },
      { term: 'CHECK', simple: 'Условие на значение в строке: цена ≥ 0, статус из списка.', tech: 'Ограничение-предикат, проверяемое для каждой вставляемой и изменяемой строки.' },
      { term: 'DEFAULT', simple: 'Значение по умолчанию, если поле не указали.', tech: 'Выражение, подставляемое при INSERT без значения столбца.' },
      { term: 'Частичный индекс', simple: 'Индекс только по части строк, например по активным билетам.', tech: 'CREATE [UNIQUE] INDEX … WHERE условие. Уникальность «среди активных».' },
      { term: 'ON DELETE CASCADE / RESTRICT / SET NULL', simple: 'Что делать со ссылками при удалении строки: удалить их, запретить удаление или обнулить ссылку.', tech: 'Ссылочные действия внешнего ключа. NO ACTION — проверка в конце оператора, почти как RESTRICT.' },
      { term: 'Мягкое удаление', simple: 'Строку не удаляют, а помечают: is_archived, deleted_at.', tech: 'Soft delete: история сохраняется, запросы фильтруют помеченные строки.' },
      { term: 'Нормализация', simple: 'Раскладка данных по таблицам так, чтобы каждый факт хранился один раз.', tech: 'Устранение избыточности и аномалий через декомпозицию отношений по функциональным зависимостям.' },
      { term: 'Аномалии изменения, вставки, удаления', simple: 'Беды ненормализованной таблицы: менять в многих местах, нельзя добавить без лишнего, удаление уносит чужие факты.', tech: 'Update, insert, delete anomalies — следствие избыточности.' },
      { term: '1НФ', simple: 'В каждой ячейке одно значение, нет столбцов-близнецов (phone1, phone2).', tech: 'Атомарность значений, отсутствие повторяющихся групп.' },
      { term: '2НФ', simple: '1НФ + всё зависит от целого составного ключа, а не от его части.', tech: 'Нет частичных функциональных зависимостей неключевых атрибутов от составного ключа.' },
      { term: '3НФ', simple: '2НФ + неключевые поля не зависят друг от друга.', tech: 'Нет транзитивных зависимостей: «ключ, весь ключ и ничего, кроме ключа».' },
      { term: 'Функциональная зависимость', simple: 'Значение одного поля однозначно определяет другое: фильм → длительность.', tech: 'X → Y: равные значения X влекут равные значения Y.' },
      { term: 'Транзакция', simple: 'Несколько изменений, выполняемых как одно: всё или ничего.', tech: 'BEGIN … COMMIT | ROLLBACK; единица работы с гарантиями ACID.' },
      { term: 'ACID', simple: 'Атомарность, согласованность, изолированность, долговечность — обещания транзакции.', tech: 'Atomicity, Consistency, Isolation, Durability.' },
      { term: 'Журнал предзаписи (WAL)', simple: 'Журнал на диске, куда база сначала пишет изменение — поэтому подтверждённое не теряется при сбое.', tech: 'Write-Ahead Log: изменения фиксируются в журнале до записи страниц данных; основа долговечности и восстановления.' }
    ],
    outro: 'Ключи, ограничения и нормальные формы на месте, двойная продажа места теперь невозможна. Следующее занятие — ERD: нарисуем всё это так, чтобы Нина Сергеевна прочитала схему сама.',
    tasks: [howExcel, terms, howKeys, pk, fk, constraints, ondelete, howNorm, norm, nf, howAcid, acid]
  });
})();
