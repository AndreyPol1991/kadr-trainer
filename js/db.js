/* База данных «Кадра» в браузере: схема с описаниями (для заданий и словаря данных), детерминированные данные
   за неделю 8–14 марта 2027 и SQL-движок sql.js (SQLite, WebAssembly) с cdnjs.
   В данные намеренно заложены «грязные» случаи для заданий на проверку качества — см. TR.db.ANOMALIES.
   API: TR.db.SCHEMA, ENUMS, NOW, ready(), loaded, run(sql) (общая песочница), runFresh(sql) / compare(sql, ref, opts) —
   синхронно на свежей копии (после ready), resultHTML(res), schemaHTML(names), console(el, cfg). */
'use strict';
(function () {
  const TR = window.TR, esc = TR.esc, ui = TR.ui;
  const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  const NOW = '2027-03-14 20:00';

  // ---------- схема ----------
  // col: { n, type, ru, desc, pk, fk:'table.col', nul, uniq, def, enum:'table.col', pd (персональные данные), chk }
  const C = (n, type, ru, o) => Object.assign({ n, type, ru, nul: false }, o || {});
  const SCHEMA = [
    { name: 'cinema', ru: 'Кинотеатр', desc: 'Кинотеатр сети «Кадр».', cols: [
      C('id', 'INTEGER', 'Идентификатор кинотеатра', { pk: true }),
      C('name', 'VARCHAR(60)', 'Название', { uniq: true }),
      C('city', 'VARCHAR(40)', 'Город'),
      C('address', 'VARCHAR(200)', 'Адрес'),
      C('tz', 'VARCHAR(40)', 'Часовой пояс', { desc: 'Например, Asia/Yekaterinburg. Время сеансов в базе — местное время кинотеатра.' })
    ] },
    { name: 'hall', ru: 'Зал', desc: 'Кинозал. Схема мест зала — в таблице seat.', cols: [
      C('id', 'INTEGER', 'Идентификатор зала', { pk: true }),
      C('cinema_id', 'INTEGER', 'Кинотеатр', { fk: 'cinema.id' }),
      C('name', 'VARCHAR(30)', 'Название зала', { desc: 'Уникально в пределах кинотеатра.' }),
      C('format', 'VARCHAR(5)', 'Формат', { enum: 'hall.format' })
    ] },
    { name: 'seat', ru: 'Место', desc: 'Место в зале. Пара (ряд, место) уникальна в пределах зала.', cols: [
      C('id', 'INTEGER', 'Идентификатор места', { pk: true }),
      C('hall_id', 'INTEGER', 'Зал', { fk: 'hall.id' }),
      C('row_no', 'INTEGER', 'Ряд'),
      C('seat_no', 'INTEGER', 'Место в ряду'),
      C('kind', 'VARCHAR(10)', 'Тип места', { enum: 'seat.kind', def: "'standard'" })
    ] },
    { name: 'film', ru: 'Фильм', desc: 'Фильм в прокате.', cols: [
      C('id', 'INTEGER', 'Идентификатор фильма', { pk: true }),
      C('title', 'VARCHAR(120)', 'Название'),
      C('duration_min', 'INTEGER', 'Длительность, мин', { chk: '> 0' }),
      C('age_rating', 'VARCHAR(3)', 'Возрастной рейтинг', { enum: 'film.age_rating' }),
      C('release_date', 'DATE', 'Дата выхода в прокат')
    ] },
    { name: 'genre', ru: 'Жанр', desc: 'Справочник жанров.', cols: [
      C('id', 'INTEGER', 'Идентификатор жанра', { pk: true }),
      C('name', 'VARCHAR(40)', 'Название жанра', { uniq: true })
    ] },
    { name: 'film_genre', ru: 'Жанр фильма', desc: 'Связь «многие ко многим»: у фильма несколько жанров, в жанре много фильмов. Первичный ключ — пара (film_id, genre_id).', cols: [
      C('film_id', 'INTEGER', 'Фильм', { pk: true, fk: 'film.id' }),
      C('genre_id', 'INTEGER', 'Жанр', { pk: true, fk: 'genre.id' })
    ] },
    { name: 'screening', ru: 'Сеанс', desc: 'Показ фильма в зале в конкретное время.', cols: [
      C('id', 'INTEGER', 'Идентификатор сеанса', { pk: true }),
      C('film_id', 'INTEGER', 'Фильм', { fk: 'film.id' }),
      C('hall_id', 'INTEGER', 'Зал', { fk: 'hall.id' }),
      C('starts_at', 'DATETIME', 'Начало', { desc: 'Местное время кинотеатра, ГГГГ-ММ-ДД ЧЧ:ММ.' }),
      C('base_price', 'DECIMAL(8,2)', 'Базовая цена, ₽', { desc: 'Цена стандартного места на этот сеанс. Итоговая цена билета — в ticket.price.' })
    ] },
    { name: 'customer', ru: 'Покупатель', desc: 'Зарегистрированный покупатель приложения или сайта. На кассе можно купить без регистрации.', cols: [
      C('id', 'INTEGER', 'Идентификатор покупателя', { pk: true }),
      C('full_name', 'VARCHAR(120)', 'Имя', { pd: true }),
      C('phone', 'VARCHAR(20)', 'Телефон', { uniq: true, pd: true, desc: 'Логин. Формат +7XXXXXXXXXX (при переносе из старой кассы встречаются 8XXXXXXXXXX).' }),
      C('email', 'VARCHAR(120)', 'Email', { nul: true, pd: true }),
      C('birth_date', 'DATE', 'Дата рождения', { nul: true, pd: true, desc: 'Не обязательна. Нужна для фильмов 18+ в приложении.' }),
      C('bonus_balance', 'INTEGER', 'Баллы', { def: '0' }),
      C('created_at', 'DATETIME', 'Дата регистрации')
    ] },
    { name: 'orders', ru: 'Заказ', desc: 'Покупка: один или несколько билетов на один сеанс. Имя orders во множественном числе — order зарезервировано в SQL.', cols: [
      C('id', 'INTEGER', 'Идентификатор заказа', { pk: true }),
      C('customer_id', 'INTEGER', 'Покупатель', { fk: 'customer.id', nul: true, desc: 'Пусто — покупка на кассе без регистрации.' }),
      C('created_at', 'DATETIME', 'Создан'),
      C('status', 'VARCHAR(10)', 'Статус', { enum: 'orders.status', def: "'new'" }),
      C('channel', 'VARCHAR(5)', 'Канал продажи', { enum: 'orders.channel' })
    ] },
    { name: 'ticket', ru: 'Билет', desc: 'Место на сеансе в заказе. Активный билет на пару (сеанс, место) — только один: частичный уникальный индекс WHERE status = \'active\'. В учебной копии только действующие и возвращённые билеты: брони и проход в зал (hold, used, cancelled из словаря данных) в выгрузку не попали.', cols: [
      C('id', 'INTEGER', 'Идентификатор билета', { pk: true }),
      C('order_id', 'INTEGER', 'Заказ', { fk: 'orders.id' }),
      C('screening_id', 'INTEGER', 'Сеанс', { fk: 'screening.id' }),
      C('seat_id', 'INTEGER', 'Место', { fk: 'seat.id' }),
      C('price', 'DECIMAL(8,2)', 'Цена, ₽', { chk: '>= 0', desc: 'Цена на момент покупки — со всеми наценками и скидками. 0 — пригласительный.' }),
      C('status', 'VARCHAR(10)', 'Статус', { enum: 'ticket.status', def: "'active'" })
    ] },
    { name: 'payment', ru: 'Платёж', desc: 'Попытка оплаты заказа. У заказа может быть несколько попыток: неудачные и одна удачная.', cols: [
      C('id', 'INTEGER', 'Идентификатор платежа', { pk: true }),
      C('order_id', 'INTEGER', 'Заказ', { fk: 'orders.id' }),
      C('amount', 'DECIMAL(10,2)', 'Сумма, ₽'),
      C('method', 'VARCHAR(5)', 'Способ', { enum: 'payment.method' }),
      C('status', 'VARCHAR(7)', 'Результат', { enum: 'payment.status' }),
      C('paid_at', 'DATETIME', 'Время попытки')
    ] }
  ];
  const ENUMS = {
    'hall.format': [['2D', 'обычный'], ['3D', 'стерео'], ['IMAX', 'IMAX']],
    'seat.kind': [['standard', 'обычное'], ['vip', 'VIP-кресло'], ['sofa', 'диван на двоих']],
    'film.age_rating': [['0+', '0+'], ['6+', '6+'], ['12+', '12+'], ['16+', '16+'], ['18+', '18+']],
    'orders.status': [['new', 'создан, ждёт оплаты'], ['paid', 'оплачен'], ['cancelled', 'отменён до оплаты'], ['refunded', 'деньги возвращены']],
    'orders.channel': [['app', 'приложение'], ['site', 'сайт'], ['box', 'касса']],
    'ticket.status': [['active', 'действует'], ['refunded', 'возвращён']],
    'payment.method': [['card', 'карта'], ['sbp', 'СБП'], ['cash', 'наличные']],
    'payment.status': [['ok', 'прошёл'], ['failed', 'отклонён']]
  };

  // ---------- данные ----------
  function seed() {
    const r = TR.rand('kadr-db-2027');
    const pick = a => a[Math.floor(r() * a.length)];
    const T = { cinema: [], hall: [], seat: [], film: [], genre: [], film_genre: [], screening: [], customer: [], orders: [], ticket: [], payment: [] };
    T.cinema = [[1, 'Кадр Плотинка', 'Екатеринбург', 'ул. Малышева, 5', 'Asia/Yekaterinburg'], [2, 'Кадр Кама', 'Пермь', 'ул. Ленина, 60', 'Asia/Yekaterinburg'], [3, 'Кадр Янтарь', 'Калининград', 'Ленинский пр., 30', 'Europe/Kaliningrad']];
    const HALLS = [[1, 1, 'Синий', '2D', 5, 8], [2, 1, 'Красный', '3D', 6, 10], [3, 1, 'IMAX', 'IMAX', 8, 12], [4, 2, 'Большой', '2D', 6, 10], [5, 2, 'Малый', '2D', 5, 8], [6, 3, 'Зал 1', '3D', 6, 10], [7, 3, 'Зал 2', '2D', 5, 8]];
    const seatsOf = {};
    HALLS.forEach(([id, cin, name, fmt, rows, per]) => {
      T.hall.push([id, cin, name, fmt]); seatsOf[id] = [];
      for (let rr = 1; rr <= rows; rr++) for (let s = 1; s <= per; s++) {
        const kind = (id === 1 || id === 4) && rr === rows ? 'sofa' : id === 3 && (rr === 5 || rr === 6) ? 'vip' : 'standard';
        const sid = T.seat.length + 1; T.seat.push([sid, id, rr, s, kind]); seatsOf[id].push({ sid, kind });
      }
    });
    T.film = [[1, 'Северный ветер', 118, '12+', '2027-02-25'], [2, 'Последний рейс', 104, '16+', '2027-03-04'], [3, 'Котопёс', 86, '0+', '2027-02-18'], [4, 'Глубина', 142, '12+', '2027-03-11'], [5, 'Тихая гавань', 97, '16+', '2027-02-11'], [6, 'Ночной патруль', 111, '18+', '2027-03-04'], [7, 'Мама в деле', 95, '6+', '2027-02-25'], [8, 'Звёздная пыль', 131, '12+', '2027-01-28'], [9, 'Архив', 99, '18+', '2027-03-11'], [10, 'Лето в Плёсе', 102, '12+', '2027-04-01']];
    T.genre = [[1, 'драма'], [2, 'комедия'], [3, 'триллер'], [4, 'фантастика'], [5, 'мультфильм'], [6, 'боевик'], [7, 'документальный']];
    T.film_genre = [[1, 1], [2, 3], [2, 6], [3, 5], [3, 2], [4, 4], [4, 3], [5, 1], [5, 2], [6, 6], [7, 2], [8, 4], [8, 1], [9, 3], [10, 2]];
    const dur = Object.fromEntries(T.film.map(f => [f[0], f[2]]));
    // сеансы: 7 дней × 7 залов × 3 показа; «Лето в Плёсе» ещё не вышел — сеансов нет
    const SLOTS = ['11:00', '15:30', '20:00'], FILMS_BY_HALL = { 1: [3, 7, 5], 2: [4, 2, 8], 3: [4, 8, 1], 4: [1, 6, 9], 5: [3, 5, 2], 6: [7, 4, 6], 7: [1, 9, 3] };
    for (let d = 8; d <= 14; d++) HALLS.forEach(([hid, , , fmt]) => SLOTS.forEach((sl, k) => {
      const fid = FILMS_BY_HALL[hid][(k + d) % 3];
      const base = (k === 0 ? 250 : k === 1 ? 350 : 450) + (fmt === '3D' ? 100 : fmt === 'IMAX' ? 250 : 0) + (d >= 13 ? 50 : 0);
      T.screening.push([T.screening.length + 1, fid, hid, `2027-03-${String(d).padStart(2, '0')} ${sl}`, base]);
    }));
    // заложенная ошибка расписания: в зале «Красный» 12 марта лишний сеанс «Глубины» в 16:30 — пересекается с 15:30
    const overlapId = T.screening.length + 1;
    T.screening.push([overlapId, 4, 2, '2027-03-12 16:30', 450]);
    // покупатели
    const FN = ['Анна', 'Иван', 'Мария', 'Дмитрий', 'Елена', 'Сергей', 'Ольга', 'Павел', 'Наталья', 'Алексей', 'Ксения', 'Михаил', 'Татьяна', 'Андрей', 'Юлия', 'Никита', 'Дарья', 'Артур', 'Софья', 'Глеб'];
    const LN = ['Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров'];
    for (let i = 1; i <= 60; i++) {
      const f = FN[(i * 7) % FN.length], l = LN[(i * 11) % LN.length], fem = /[ая]$/.test(f);
      const phone = '+79' + String(120000000 + i * 104729 % 879999999).slice(0, 9);
      const email = i % 4 === 0 ? null : `user${i}@mail.example`;
      const bd = i % 5 === 0 ? null : `${1970 + (i * 3) % 38}-${String(1 + i % 12).padStart(2, '0')}-${String(1 + (i * 5) % 28).padStart(2, '0')}`;
      T.customer.push([i, `${f} ${l}${fem ? 'а' : ''}`, phone, email, bd, (i * 37) % 900, `2026-${String(1 + i % 12).padStart(2, '0')}-${String(1 + i % 27).padStart(2, '0')} 12:00`]);
    }
    // дубли из старой кассы: тот же человек, телефон в формате 8XXXXXXXXXX
    const dups = [[61, 3], [62, 17]];
    dups.forEach(([id, of]) => { const c = T.customer[of - 1]; T.customer.push([id, c[1], '8' + c[2].slice(2), null, null, 0, '2027-03-01 10:00']); });
    // заказы, билеты, платежи
    const taken = new Set();
    let oid = 0, tid = 0, pid = 0;
    const meta = { paidNoPayment: [], sumMismatch: [], partial: [] };
    T.screening.forEach(sc => {
      const [scid, fid, hid, at, base] = sc;
      const day = +at.slice(8, 10), hour = +at.slice(11, 13);
      const seats = seatsOf[hid], fill = scid === overlapId ? 0.05 : Math.min(0.85, (hour >= 20 ? 0.45 : hour >= 15 ? 0.25 : 0.12) + (day >= 13 ? 0.2 : 0) + (fid === 4 ? 0.15 : 0) + r() * 0.1);
      let want = Math.round(seats.length * fill);
      let guard = 0;
      while (want > 0 && guard++ < 200) {
        const n = Math.min(want, 1 + Math.floor(r() * 4));
        const free = seats.filter(s => !taken.has(scid + ':' + s.sid));
        if (free.length < n) break;
        const start = Math.floor(r() * (free.length - n + 1)), mine = free.slice(start, start + n);
        oid++;
        const channel = r() < 0.5 ? 'app' : r() < 0.6 ? 'site' : 'box';
        const cust = channel === 'box' ? null : 1 + Math.floor(r() * 60);
        const created = `2027-03-${String(Math.max(1, day - Math.floor(r() * 3))).padStart(2, '0')} ${String(9 + Math.floor(r() * 11)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
        const roll = r();
        let status = roll < 0.06 ? 'cancelled' : roll < 0.1 ? 'refunded' : 'paid';
        if (day === 14 && hour === 20 && roll > 0.97) status = 'new';
        T.orders.push([oid, cust, created, status, channel]);
        if (status === 'cancelled') {
          pid++; T.payment.push([pid, oid, 0, 'card', 'failed', created]);
          continue;   // билеты отменённого заказа освобождены и в базе не лежат
        }
        let sum = 0;
        mine.forEach(s => {
          const price = r() < 0.03 ? 0 : base + (s.kind === 'vip' ? 150 : s.kind === 'sofa' ? 300 : 0);
          tid++; taken.add(scid + ':' + s.sid);
          T.ticket.push([tid, oid, scid, s.sid, price, status === 'refunded' ? 'refunded' : 'active']);
          sum += price;
        });
        want -= n;
        if (status === 'new') continue;
        const method = channel === 'box' ? (r() < 0.4 ? 'cash' : 'card') : (r() < 0.35 ? 'sbp' : 'card');
        if (method !== 'cash' && r() < 0.12) { pid++; T.payment.push([pid, oid, sum, method, 'failed', created]); }
        pid++; T.payment.push([pid, oid, sum, method, 'ok', created]);
      }
    });
    // заложенные «грязные» случаи
    const paid = T.orders.filter(o => o[3] === 'paid');
    // 1) два оплаченных заказа без удачного платежа (платёж потерян при переносе)
    [paid[40], paid[211]].forEach(o => { const i = T.payment.findIndex(p => p[1] === o[0] && p[4] === 'ok'); if (i >= 0) { T.payment.splice(i, 1); meta.paidNoPayment.push(o[0]); } });
    // 2) сумма платежа не совпадает с билетами (касса взяла меньше)
    [paid[95]].forEach(o => { const p = T.payment.find(x => x[1] === o[0] && x[4] === 'ok'); if (p) { p[2] = p[2] - 100; meta.sumMismatch.push(o[0]); } });
    // 3) частичный возврат: в заказе из нескольких билетов один возвращён, заказ остаётся оплаченным
    const multi = paid.filter(o => T.ticket.filter(t => t[1] === o[0]).length >= 3).slice(5, 8);
    multi.forEach(o => { const t = T.ticket.find(x => x[1] === o[0]); t[5] = 'refunded'; meta.partial.push(o[0]); });
    meta.overlap = overlapId; meta.dups = dups.map(d => d[0]);
    return { T, meta };
  }

  const q = v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  function ddl() {
    const chk = c => c.enum ? ` CHECK (${c.n} IN (${ENUMS[c.enum].map(e => q(e[0])).join(', ')}))` : c.chk ? ` CHECK (${c.n} ${c.chk})` : '';
    return SCHEMA.map(t => {
      const pk = t.cols.filter(c => c.pk);
      const cols = t.cols.map(c => `  ${c.n} ${c.type}${pk.length === 1 && c.pk ? ' PRIMARY KEY' : ''}${c.nul ? '' : ' NOT NULL'}${c.uniq ? ' UNIQUE' : ''}${c.def ? ' DEFAULT ' + c.def : ''}${chk(c)}${c.fk ? ` REFERENCES ${c.fk.split('.')[0]}(${c.fk.split('.')[1]})` : ''}`);
      if (pk.length > 1) cols.push(`  PRIMARY KEY (${pk.map(c => c.n).join(', ')})`);
      if (t.name === 'seat') cols.push('  UNIQUE (hall_id, row_no, seat_no)');
      if (t.name === 'hall') cols.push('  UNIQUE (cinema_id, name)');
      return `CREATE TABLE ${t.name} (\n${cols.join(',\n')}\n);`;
    }).join('\n') + "\nCREATE UNIQUE INDEX ux_ticket_active_seat ON ticket (screening_id, seat_id) WHERE status = 'active';";
  }
  const inserts = T => Object.keys(T).map(name => T[name].map(row => `INSERT INTO ${name} VALUES (${row.map(q).join(', ')});`).join('\n')).join('\n');

  // ---------- движок ----------
  let SQL = null, bytes = null, sandbox = null, loadP = null, meta = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src)); document.head.appendChild(s); });
  }
  function ready() {
    if (!loadP) loadP = (async () => {
      if (!window.initSqlJs) await loadScript(SQLJS + 'sql-wasm.js');
      SQL = await window.initSqlJs({ locateFile: f => SQLJS + f });
      const db = new SQL.Database();
      const s = seed(); meta = s.meta;
      db.run(ddl());
      db.run('BEGIN;' + inserts(s.T) + 'COMMIT;');
      bytes = db.export(); db.close();
      sandbox = fresh();
      TR.emit('db-ready');
      return true;
    })().catch(e => { loadP = null; throw e; });
    return loadP;
  }
  const fresh = () => { const d = new SQL.Database(bytes); d.run('PRAGMA foreign_keys = ON;'); return d; };
  const LIMIT = 500;
  function execOn(db, sql) {
    const t0 = performance.now();
    try {
      const out = db.exec(String(sql || ''));
      const last = out[out.length - 1];
      const changes = db.getRowsModified();
      return { ok: true, columns: last ? last.columns : [], rows: last ? last.values.slice(0, LIMIT) : [], total: last ? last.values.length : 0, changes, ms: Math.round(performance.now() - t0) };
    } catch (e) { return { ok: false, error: ruErr(e.message), raw: e.message, columns: [], rows: [], ms: Math.round(performance.now() - t0) }; }
  }
  function ruErr(m) {
    const s = String(m || '');
    let x;
    if ((x = s.match(/no such table: (\S+)/))) return `Нет такой таблицы: ${x[1]}. Посмотрите список таблиц в схеме (заказы — orders, во множественном числе).`;
    if ((x = s.match(/no such column: (\S+)/))) return `Нет такого столбца: ${x[1]}. Проверьте имя и таблицу (алиас).`;
    if ((x = s.match(/ambiguous column name: (\S+)/))) return `Столбец ${x[1]} есть в нескольких таблицах — укажите таблицу: имя_таблицы.${x[1]}.`;
    if (/syntax error/.test(s)) return 'Синтаксическая ошибка: ' + s.replace(/^.*?:\s*/, '') + '. Проверьте запятые, кавычки и порядок частей: SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT.';
    if (/incomplete input/.test(s)) return 'Запрос оборван: не хватает закрывающей скобки или кавычки.';
    if (/FOREIGN KEY constraint failed/.test(s)) return 'Нарушен внешний ключ: ссылка на строку, которой нет (или удаление строки, на которую ссылаются).';
    if (/UNIQUE constraint failed: (\S+)/.test(s)) return 'Нарушена уникальность: ' + s.match(/UNIQUE constraint failed: (.+)$/)[1] + ' — такое значение уже есть.';
    if (/NOT NULL constraint failed: (\S+)/.test(s)) return 'Поле обязательно (NOT NULL): ' + s.match(/NOT NULL constraint failed: (\S+)/)[1] + '.';
    if (/CHECK constraint failed/.test(s)) return 'Нарушено ограничение CHECK: значение вне допустимого.';
    if (/misuse of aggregate/.test(s)) return 'Агрегат (COUNT, SUM…) нельзя использовать в WHERE — для условий на группы есть HAVING.';
    return s;
  }
  async function run(sql) { await ready(); return execOn(sandbox, sql); }
  async function reset() { await ready(); try { sandbox.close(); } catch (e) { } sandbox = fresh(); }
  // запрос на свежей копии базы: изменения не попадают в общую песочницу. Синхронно — база должна быть загружена.
  function runFresh(sql) { if (!bytes) return { ok: false, offline: true, error: 'База ещё загружается', columns: [], rows: [] }; const d = fresh(); try { return execOn(d, sql); } finally { d.close(); } }
  // Сравнение результата ученика с эталоном. Имена столбцов не важны, важны число столбцов и строки
  // (по умолчанию как множество; ordered:true — с учётом порядка). Синхронно, после ready().
  const normV = v => v == null ? null : typeof v === 'number' ? Math.round(v * 100) / 100 : /^-?\d+(\.\d+)?$/.test(String(v).trim()) ? Math.round(parseFloat(v) * 100) / 100 : String(v).trim();
  const key = row => JSON.stringify(row.map(normV));
  function compare(sql, refSql, opts) {
    const o = opts || {};
    if (!bytes) return { ok: false, offline: true, why: 'База ещё загружается — подождите пару секунд и проверьте снова.' };
    const mine = runFresh(sql), ref = runFresh(refSql);
    if (!String(sql || '').trim()) return { ok: false, mine: null, ref, why: 'Запрос не написан.' };
    if (!mine.ok) return { ok: false, mine, ref, why: mine.error };
    if (!ref.ok) return { ok: false, mine, ref, why: 'Ошибка в эталоне: ' + ref.error };
    const mc = mine.columns.length, rc = ref.columns.length;
    if (mc !== rc) return { ok: false, mine, ref, why: `Столбцов ${mc}, а нужно ${rc}${o.cols ? ': ' + o.cols : ''}.` };
    if (mine.total !== ref.total) return { ok: false, mine, ref, why: `Строк ${mine.total}, а должно быть ${ref.total}.` };
    if (o.ordered) {
      for (let i = 0; i < ref.rows.length; i++) if (key(mine.rows[i]) !== key(ref.rows[i])) return { ok: false, mine, ref, why: `Строки те же по числу, но порядок или значения расходятся начиная со строки ${i + 1}.` };
    } else {
      const cnt = new Map(); ref.rows.forEach(r => { const k = key(r); cnt.set(k, (cnt.get(k) || 0) + 1); });
      let miss = 0; mine.rows.forEach(r => { const k = key(r); if (cnt.get(k)) cnt.set(k, cnt.get(k) - 1); else miss++; });
      if (miss) return { ok: false, mine, ref, why: `Число строк совпало, но ${miss} ${TR.plural(miss, 'строка отличается', 'строки отличаются', 'строк отличаются')} от эталона.` };
    }
    return { ok: true, mine, ref, why: '' };
  }

  // ---------- отрисовка ----------
  function resultHTML(res, opts) {
    const o = opts || {};
    if (!res) return '';
    if (!res.ok) return `<div class="note bad"><div class="ttl">Ошибка</div><div>${esc(res.error)}</div></div>`;
    if (!res.columns.length) return `<div class="note ok"><div>Выполнено${res.changes ? ` · изменено строк: ${res.changes}` : ''} · ${res.ms} мс</div></div>`;
    return ui.dbt({ name: `${res.total} ${TR.plural(res.total, 'строка', 'строки', 'строк')} · ${res.ms} мс`, cols: res.columns, rows: res.rows, max: o.max || 30 });
  }
  function schemaHTML(names) {
    const list = names ? SCHEMA.filter(t => names.includes(t.name)) : SCHEMA;
    return `<div class="stack tight">${list.map(t => `<details class="more"><summary><code>${esc(t.name)}</code> — ${esc(t.ru)}</summary><div><p class="small muted">${esc(t.desc)}</p>
      ${ui.table(['Поле', 'Тип', 'Ключ', 'Описание'], t.cols.map(c => [`<code>${esc(c.n)}</code>${c.nul ? '<span class="dim">?</span>' : ''}`, `<span class="mono small">${esc(c.type)}</span>`, `<span class="mono small">${c.pk ? 'PK ' : ''}${c.fk ? 'FK→' + esc(c.fk) : ''}${c.uniq && !c.pk ? 'UQ' : ''}</span>`, `<span class="small">${esc(c.ru)}${c.enum ? `<span class="dim"> · ${ENUMS[c.enum].map(e => `${e[0]} — ${e[1]}`).join('; ')}</span>` : ''}${c.desc ? `<br><span class="dim">${esc(c.desc)}</span>` : ''}</span>`]))}</div></details>`).join('')}</div>`;
  }

  // ---------- консоль SQL ----------
  // cfg: { value, readonly, rows, tables:[имена для схемы], placeholder, label, onChange(sql), onRun(res), fresh:true }
  function sqlConsole(el, cfg) {
    let v = cfg.value || '';
    el.innerHTML = `<div class="stack tight">
      <textarea class="mono" rows="${cfg.rows || 5}" spellcheck="false" aria-label="${esc(cfg.label || 'Запрос SQL')}" placeholder="${esc(cfg.placeholder || 'SELECT …')}" ${cfg.readonly ? 'readonly' : ''}>${esc(v)}</textarea>
      <div class="row"><button type="button" class="btn sm primary" data-sq="run">▶ Выполнить</button><span class="small dim">Ctrl+Enter · база — копия «Кадра», испортить нельзя</span></div>
      <div data-sqout></div>
      ${cfg.tables ? `<details class="more"><summary>Схема таблиц</summary><div>${schemaHTML(cfg.tables)}</div></details>` : ''}</div>`;
    const ta = TR.$('textarea', el), out = TR.$('[data-sqout]', el);
    const go = async () => {
      out.innerHTML = '<div class="small dim">Выполняю…</div>';
      try { await ready(); } catch (e) { out.innerHTML = ui.note('bad', 'База не загрузилась', 'Нужен интернет: движок sql.js грузится с cdnjs. Обновите страницу.'); return; }
      const res = cfg.fresh === false ? execOn(sandbox, ta.value) : runFresh(ta.value);
      out.innerHTML = resultHTML(res);
      cfg.onRun && cfg.onRun(res);
    };
    ta.addEventListener('input', () => { v = ta.value; cfg.onChange && cfg.onChange(v); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });
    TR.$('[data-sq="run"]', el).addEventListener('click', go);
    return { get value() { return ta.value; }, run: go };
  }

  TR.db = {
    SCHEMA, ENUMS, NOW, SQLJS,
    ddl, ready, run, runFresh, reset, compare, resultHTML, schemaHTML, console: sqlConsole,
    table: name => SCHEMA.find(t => t.name === name) || null,
    get ANOMALIES() { return meta; },
    get loaded() { return !!bytes; }
  };
  // грузим заранее: к заданиям по SQL база уже готова
  setTimeout(() => { ready().catch(() => { }); }, 400);
})();
