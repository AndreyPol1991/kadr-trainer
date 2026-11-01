/* Теория занятия 1: нормализация по шагам — отдельная лаборатория.
   Восемь шагов от листа Excel до таблиц базы: повторы → ключ строки → 1НФ → зависимости → 2НФ → 3НФ → итог → шпаргалка.
   На каждом шаге: простыми словами, расшифровка терминов, интерактивная таблица и «что изменилось».
   Подключается в s1-basics.js как TR.NORM_LAB(FLAT, ANOM_OPS, SPLIT). */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .nl{display:grid;gap:12px;min-width:0}
  .nl-pills{display:flex;flex-wrap:wrap;gap:5px}
  .nl-pills button{border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);border-radius:999px;padding:5px 11px;font:600 12px var(--f-body);cursor:pointer}
  .nl-pills button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
  .nl-pills button.seen{border-color:var(--ok);color:var(--text)}
  .nl-head h4{margin:0;font:700 18px/1.25 var(--f-brand)}
  .nl-plain{font-size:14.5px;line-height:1.6;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border))}
  .nl-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px}
  .nl-terms div{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);font-size:12.5px;line-height:1.45}
  .nl-terms b{display:block;font:700 12.5px var(--f-mono);color:var(--info);margin-bottom:2px}
  .nl-act{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .nl-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;align-items:start}
  .nl-arrow{text-align:center;font:700 22px var(--f-brand);color:var(--accent)}
  .nl-cell{cursor:pointer}
  .nl-res{font-size:14px;line-height:1.55;padding:10px 14px;border-radius:12px;border-left:4px solid var(--ok);background:var(--ok-soft)}
  .nl-res.bad{border-left-color:var(--bad);background:var(--bad-soft)}
  .nl-res.warn{border-left-color:var(--warn);background:var(--warn-soft)}
  .nl-stat{display:flex;flex-wrap:wrap;gap:8px}
  .nl-stat span{border:1px solid var(--border);border-radius:9px;padding:5px 10px;font-size:12.5px;background:var(--surface-2)}
  .nl-stat b{font:700 15px var(--f-brand)}
  .nl-nav{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .nl-clickable .dv-t td{cursor:pointer}
  </style>`);

  TR.NORM_LAB = (FLAT, ANOM_OPS, SPLIT) => {
    const COLS = FLAT.cols, ROWS = FLAT.rows;          // Заказ, Покупатель, Телефон, Фильм, Длит., Жанры, Сеанс, Ряд-место, Цена
    const I = Object.fromEntries(COLS.map((c, i) => [c, i]));
    const pick = (rows, names) => rows.map(r => names.map(n => r[I[n]]));
    const uniq = rows => { const seen = new Set(); return rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); };
    // 1НФ: жанры — отдельными строками связки
    const FG = uniq(ROWS.flatMap(r => String(r[I['Жанры']]).split(',').map(g => [r[I['Фильм']], g.trim()])));
    const C1 = COLS.filter(c => c !== 'Жанры');
    const R1 = pick(ROWS, C1);
    const T = (name, cols, rows, extra) => ui.dbt(Object.assign({ name: `${name} · ${rows.length} ${TR.plural(rows.length, 'строка', 'строки', 'строк')}`, cols, rows }, extra || {}));
    const keyCols = (cols, keys) => cols.map(c => keys.includes(c) ? { n: c, k: 'PK' } : c);

    const STEPS = [
      {
        id: 's0', t: '0. Что не так', title: 'Шаг 0. Что не так с таблицей «как в Excel»',
        plain: 'Это пять строк из листа «Продажи». Каждая строка — один проданный билет. Нажмите на любую ячейку: подсветятся все места, где записан <b>тот же самый факт</b>. Чем больше повторов, тем больше шансов, что при изменении одну копию забудут — и данные начнут противоречить сами себе.',
        terms: [['Избыточность', 'один и тот же факт хранится несколько раз («телефон Анны» — в трёх строках).'], ['Аномалия', 'неприятность из-за избыточности: изменить, добавить или удалить один факт нельзя, не задев другие.'], ['Нормализация', 'пошаговая раскладка таблицы на несколько так, чтобы каждый факт хранился ровно один раз.']],
        render(box, st) {
          st.cell = st.cell || '0:2';
          const [r, c] = st.cell.split(':').map(Number), v = ROWS[r][c];
          const same = ROWS.map((row, i) => row[c] === v ? i : -1).filter(i => i >= 0);
          const cells = Object.fromEntries(same.map(i => [i + ':' + c, i === r ? 'hl' : 'bad']));
          box.innerHTML = `<div class="nl-clickable">${T(FLAT.name, COLS, ROWS, { cells })}</div>
            <div class="nl-res ${same.length > 1 ? 'bad' : ''}">«${esc(String(v))}» в столбце «${esc(COLS[c])}» записано <b>${same.length} ${TR.plural(same.length, 'раз', 'раза', 'раз')}</b>.${same.length > 1 ? ` Если ${c === 2 ? 'Анна сменит телефон' : 'это значение изменится'}, придётся править ${same.length} ${TR.plural(same.length, 'ячейку', 'ячейки', 'ячеек')} — и легко пропустить одну.` : ' Повторов нет — этот факт принадлежит именно этой строке.'}</div>
            <div class="small dim">Попробуйте: телефон Анны, длительность «Котопса», цену — сравните.</div>`;
          box.querySelectorAll('.dv-t tbody tr').forEach((tr, ri) => tr.querySelectorAll('td').forEach((td, ci) => { td.dataset.cell = ri + ':' + ci; }));
          return 'Повторяются имена, телефоны, длительность и жанры фильмов — то, что описывает не сам билет, а покупателя или фильм. Цена и место не повторяются: это свойства конкретного билета.';
        },
        click(e, st) { const td = e.target.closest('[data-cell]'); if (td) { st.cell = td.dataset.cell; return true; } }
      },
      {
        id: 's1', t: '1. Ключ строки', title: 'Шаг 1. Найти ключ: что однозначно определяет строку',
        plain: 'Прежде чем раскладывать, нужно понять, <b>чем одна строка отличается от другой</b>. Ключ — столбец (или несколько), значения которого у двух строк никогда не совпадают. Выберите кандидата — таблица покажет, уникален ли он.',
        terms: [['Ключ (первичный ключ)', 'столбец или набор столбцов, однозначно определяющий строку: два одинаковых значения быть не может.'], ['Составной ключ', 'ключ из нескольких столбцов: уникально только их сочетание.'], ['Кандидат в ключ', 'любой набор столбцов, который мог бы быть ключом; из них выбирают один.']],
        render(box, st) {
          const OPT = [['Заказ', ['Заказ']], ['Покупатель', ['Покупатель']], ['Ряд-место', ['Ряд-место']], ['Заказ + Ряд-место', ['Заказ', 'Ряд-место']]];
          st.key = st.key || 'Заказ';
          const ks = OPT.find(o => o[0] === st.key)[1];
          const by = new Map(); ROWS.forEach((r, i) => { const k = JSON.stringify(ks.map(c => r[I[c]])); by.set(k, (by.get(k) || []).concat(i)); });
          const dup = [...by.values()].filter(g => g.length > 1).flat();
          const cells = {}; ROWS.forEach((r, i) => ks.forEach(c => { cells[i + ':' + I[c]] = dup.includes(i) ? 'bad' : 'ok'; }));
          box.innerHTML = `<div class="nl-act"><span class="small">Кандидат в ключ:</span>${ui.seg('nlk', OPT.map(o => ({ v: o[0], t: o[0] })), st.key)}</div>
            ${T(FLAT.name, keyCols(COLS, ks), ROWS, { cells })}
            <div class="nl-res ${dup.length ? 'bad' : ''}">${dup.length ? `Не годится: значения повторяются в строках ${dup.map(i => i + 1).join(', ')} (красные). ${st.key === 'Заказ' ? 'В заказе 501 два билета — у них один номер заказа.' : st.key === 'Покупатель' ? 'Анна купила несколько билетов.' : 'Место «2-3» есть в разных залах и на разных сеансах.'}` : 'Годится: пара «Заказ + Ряд-место» у всех строк разная. Один заказ не может купить одно место дважды. Это <b>составной ключ</b>.'}</div>`;
          return 'Ключ строки этой таблицы — пара (Заказ, Ряд-место). Запомните его: на шаге 2НФ мы будем спрашивать, зависит ли столбец от всего ключа или только от его половины.';
        },
        seg(n, v, st) { if (n === 'nlk') { st.key = v; return true; } }
      },
      {
        id: 's2', t: '2. 1НФ', title: 'Шаг 2. Первая нормальная форма: одно значение в ячейке',
        plain: 'Первое правило: в каждой ячейке — <b>одно</b> значение. В столбце «Жанры» записано «фантастика, триллер» — два значения. Такую ячейку нельзя проверить, по ней неудобно искать, её нельзя связать со справочником. Нажмите «Разбить» — жанры уедут в отдельную таблицу, по строке на каждую пару «фильм — жанр».',
        terms: [['1НФ (первая нормальная форма)', 'все значения атомарны и нет повторяющихся групп столбцов.'], ['Атомарное значение', 'неделимое: одна дата, одно число, один жанр. «драма, комедия» — не атомарно.'], ['Повторяющаяся группа', 'столбцы-близнецы: phone1, phone2, phone3. Тоже нарушение 1НФ.']],
        render(box, st) {
          const cells = Object.fromEntries(ROWS.map((r, i) => [i + ':' + I['Жанры'], st.split ? '' : 'bad']));
          box.innerHTML = `<div class="nl-act"><button type="button" class="btn sm ${st.split ? '' : 'primary'}" data-nl="split">${st.split ? '⟲ Вернуть как было' : '✂ Разбить жанры'}</button></div>
            ${st.split ? `<div class="nl-two">${T('Продажи без жанров', C1, R1)}<div>${T('film_genre — фильм и жанр', [{ n: 'Фильм', k: 'PK' }, { n: 'Жанр', k: 'PK' }], FG, { cells: Object.fromEntries(FG.map((r, i) => [i + ':1', 'ok'])) })}</div></div>` : T(FLAT.name, COLS, ROWS, { cells })}
            <div class="nl-res ${st.split ? '' : 'bad'}">${st.split ? `Готово: в каждой ячейке одно значение. «Найти все триллеры» теперь — точное сравнение <code>Жанр = 'триллер'</code>, а не поиск подстроки, которая найдёт и «психотриллер». Таблица в <b>1НФ</b>.` : 'В красных ячейках — список. Это нарушение 1НФ.'}</div>`;
          return 'Таблица в 1НФ. Но повторы имён, телефонов и длительностей остались — значит, одной 1НФ мало. Чтобы понять, что выносить дальше, нужно разобраться, от чего зависит каждый столбец.';
        },
        click(e, st) { if (e.target.closest('[data-nl="split"]')) { st.split = !st.split; return true; } }
      },
      {
        id: 's3', t: '3. Зависимости', title: 'Шаг 3. Функциональные зависимости: «знаю X — знаю Y»',
        plain: 'Зависимость — это когда по одному значению <b>однозначно</b> узнаёшь другое. Знаю номер заказа — знаю покупателя. Знаю покупателя — знаю его телефон. Знаю фильм — знаю длительность. Нажимайте зависимости по очереди: синим — что определяет, красным — что из-за этого повторяется в строках.',
        terms: [['Функциональная зависимость X → Y', 'одинаковые X всегда дают одинаковые Y. «Фильм → Длительность»: у «Котопса» всегда 86 минут.'], ['Детерминант', 'столбец слева от стрелки — тот, что определяет (X).'], ['Частичная зависимость', 'столбец зависит только от части составного ключа. Ломает 2НФ.'], ['Транзитивная зависимость', 'зависимость по цепочке через неключевой столбец: Заказ → Покупатель → Телефон. Ломает 3НФ.']],
        render(box) {
          const c = C1.map(n => ({ n, key: n === 'Заказ' || n === 'Ряд-место' }));
          const i = n => C1.indexOf(n);
          box.innerHTML = ui.depViz({ title: 'Продажи (1НФ)', rows: R1, cols: c, deps: [
            { from: [i('Заказ')], to: [i('Покупатель'), i('Сеанс')], bad: true, t: 'от половины ключа — частичная', why: 'Покупатель и сеанс — свойства заказа целиком. Ключ строки — заказ плюс место, а они зависят только от заказа. Поэтому повторяются в каждом билете заказа.' },
            { from: [i('Покупатель')], to: [i('Телефон')], bad: true, t: 'через неключевой столбец — транзитивная', why: 'Телефон описывает покупателя, а не билет и не заказ. Цепочка Заказ → Покупатель → Телефон.' },
            { from: [i('Сеанс')], to: [i('Фильм')], bad: true, t: 'через неключевой столбец — транзитивная', why: 'Фильм определяется сеансом: на сеанс 12.03 20:00 идёт «Глубина».' },
            { from: [i('Фильм')], to: [i('Длит.')], bad: true, t: 'через неключевой столбец — транзитивная', why: 'Длительность — свойство фильма.' },
            { from: [i('Заказ'), i('Ряд-место')], to: [i('Цена')], t: 'от всего ключа — так и надо', why: 'Цена — свойство конкретного билета: зависит и от заказа, и от места.' }
          ] });
          return 'Нашли пять зависимостей. Хорошая одна — цена от всего ключа. Остальные «плохие»: одна частичная (лечит 2НФ) и три транзитивных (лечит 3НФ).';
        }
      },
      {
        id: 's4', t: '4. 2НФ', title: 'Шаг 4. Вторая нормальная форма: всё — от всего ключа',
        plain: 'Правило: каждый неключевой столбец зависит от <b>всего</b> ключа, а не от его половины. Покупатель, телефон, сеанс, фильм, длительность зависят только от заказа — половины ключа (Заказ, Ряд-место). Нажмите «Вынести» — они уедут в таблицу заказов, где заказ и есть весь ключ.',
        terms: [['2НФ (вторая нормальная форма)', '1НФ + нет частичных зависимостей: каждый неключевой столбец зависит от всего составного ключа.'], ['Декомпозиция', 'разбиение таблицы на несколько без потери данных: их можно собрать обратно через JOIN по ключу.'], ['Важно', 'если ключ простой (один столбец), частичной зависимости быть не может — такая таблица в 2НФ автоматически.']],
        render(box, st) {
          const OC = ['Заказ', 'Покупатель', 'Телефон', 'Сеанс', 'Фильм', 'Длит.'], TC = ['Заказ', 'Ряд-место', 'Цена'];
          const orders = uniq(pick(ROWS, OC));
          box.innerHTML = `<div class="nl-act"><button type="button" class="btn sm ${st.out2 ? '' : 'primary'}" data-nl="out2">${st.out2 ? '⟲ Как было' : '↗ Вынести всё, что зависит только от заказа'}</button></div>
            ${st.out2 ? `<div class="nl-two">${T('ticket — билет', keyCols(TC, ['Заказ', 'Ряд-место']), pick(ROWS, TC))}<div>${T('orders — заказ', keyCols(OC, ['Заказ']), orders, { cells: Object.fromEntries(orders.flatMap((r, i) => [1, 2, 3, 4, 5].map(j => [i + ':' + j, 'ok']))) })}</div></div>
              <div class="nl-stat"><span>Было: <b>${ROWS.length}</b> копий «покупатель + сеанс»</span><span>Стало: <b>${orders.length}</b> — по одной на заказ</span></div>`
              : T('Продажи (1НФ)', keyCols(C1, ['Заказ', 'Ряд-место']), R1, { cells: Object.fromEntries(R1.flatMap((r, i) => ['Покупатель', 'Телефон', 'Сеанс', 'Фильм', 'Длит.'].map(n => [i + ':' + C1.indexOf(n), r[0] === 501 ? 'bad' : 'warn']))) })}
            <div class="nl-res ${st.out2 ? '' : 'warn'}">${st.out2 ? 'В <code>ticket</code> остались только ключ и цена — всё зависит от всего ключа. В <code>orders</code> ключ простой (Заказ), значит частичных зависимостей нет. Обе таблицы в <b>2НФ</b>. Заказ 501 больше не повторяет Анну дважды.' : 'Подсвечено то, что зависит только от «Заказа». У заказа 501 два билета — и всё это записано дважды (красным).'}</div>`;
          return 'Повторы внутри заказа ушли. Но Анна сделала два заказа (501 и 503) — её телефон всё ещё записан дважды. И длительность «Котопса» — тоже. Это транзитивные зависимости, их лечит 3НФ.';
        },
        click(e, st) { if (e.target.closest('[data-nl="out2"]')) { st.out2 = !st.out2; return true; } }
      },
      {
        id: 's5', t: '5. 3НФ', title: 'Шаг 5. Третья нормальная форма: ничего, кроме ключа',
        plain: 'Правило: неключевой столбец не должен зависеть от <b>другого неключевого</b>. В таблице заказов телефон зависит от покупателя, фильм — от сеанса, длительность — от фильма. Нажимайте «Вынести» по очереди: каждая цепочка уедет в свою таблицу, а в заказе останется только ссылка.',
        terms: [['3НФ (третья нормальная форма)', '2НФ + нет транзитивных зависимостей: неключевые столбцы зависят только от ключа.'], ['Внешний ключ', 'столбец-ссылка, который остаётся на месте вынесенных данных: в заказе — «Покупатель», по нему находим телефон в customer.'], ['Формула на память', '«ключ, весь ключ и ничего, кроме ключа»: 1НФ — есть ключ и атомарность, 2НФ — весь ключ, 3НФ — ничего, кроме ключа.']],
        render(box, st) {
          st.out3 = st.out3 || {};
          const o = st.out3;
          const OC = ['Заказ', 'Покупатель'].concat(o.cust ? [] : ['Телефон']).concat(['Сеанс']).concat(o.scr ? [] : ['Фильм']).concat(o.scr || o.film ? [] : ['Длит.']);
          const orders = uniq(pick(ROWS, OC));
          const extra = [];
          if (o.cust) extra.push(T('customer — покупатель', keyCols(['Покупатель', 'Телефон'], ['Покупатель']), uniq(pick(ROWS, ['Покупатель', 'Телефон']))));
          if (o.scr) extra.push(T('screening — сеанс', keyCols(['Сеанс', 'Фильм'], ['Сеанс']), uniq(pick(ROWS, ['Сеанс', 'Фильм']))));
          if (o.film || o.scr) extra.push(T('film — фильм', keyCols(['Фильм', 'Длит.'], ['Фильм']), uniq(pick(ROWS, ['Фильм', 'Длит.']))));
          const badCols = ['Телефон', 'Фильм', 'Длит.'].filter(n => OC.includes(n));
          const cells = Object.fromEntries(orders.flatMap((r, i) => badCols.map(n => [i + ':' + OC.indexOf(n), 'bad'])));
          const left = [!o.cust && 'Телефон зависит от Покупателя', !o.scr && 'Фильм и длительность зависят от Сеанса'].filter(Boolean);
          box.innerHTML = `<div class="nl-act">${['cust', 'scr'].map(k => `<button type="button" class="btn sm ${o[k] ? '' : 'primary'}" data-nl3="${k}">${o[k] ? '⟲ ' : '↗ '}${k === 'cust' ? 'Вынести покупателя с телефоном' : 'Вынести сеанс → фильм → длительность'}</button>`).join('')}</div>
            <div class="nl-two">${T('orders — заказ', keyCols(OC, ['Заказ']), orders, { cells })}<div class="stack tight">${extra.join('') || '<p class="small dim">Вынесенные таблицы появятся здесь.</p>'}</div></div>
            <div class="nl-res ${left.length ? 'warn' : ''}">${left.length ? 'Ещё не в 3НФ: ' + left.join('; ') + '. Красное — то, что повторяется из-за этого.' : 'Готово: в <code>orders</code> остались ключ и две ссылки. Каждый факт — один раз: телефон Анны — в одной строке <code>customer</code>, длительность «Котопса» — в одной строке <code>film</code>. Все таблицы в <b>3НФ</b>.'}</div>`;
          return 'Вынося цепочку, мы оставляем на её месте ссылку (внешний ключ). Данные не теряются: соединив таблицы через JOIN, получим исходный лист обратно.';
        },
        click(e, st) { const b = e.target.closest('[data-nl3]'); if (b) { st.out3 = Object.assign({}, st.out3, { [b.dataset.nl3]: !(st.out3 || {})[b.dataset.nl3] }); return true; } }
      },
      {
        id: 's6', t: '6. Итог', title: 'Шаг 6. Что получилось и зачем это всё',
        plain: 'Из одного листа получилось шесть таблиц. Каждая хранит факты об одной вещи: билет, заказ, покупатель, сеанс, фильм, жанры фильма. Связаны они ссылками. Внизу — проверка: те же три «неприятности» в одной таблице и в разложенной.',
        terms: [['Аномалия изменения', 'сменить телефон — править много строк.'], ['Аномалия удаления', 'удалили продажу — пропал фильм.'], ['Аномалия вставки', 'нельзя завести фильм без продажи.'], ['В настоящей базе', 'ключами служат не имена, а суррогатные id: имя и название могут повториться или измениться.']],
        render(box) {
          box.innerHTML = '<div data-er></div><div class="dv-k">Проверка аномалий: одна таблица против разложенной</div><div data-an></div>';
          ui.er(TR.$('[data-er]', box), { entities: [
            { id: 't', t: 'ticket', x: 10, y: 10, attrs: [{ n: 'Заказ', k: 'PK FK' }, { n: 'Ряд-место', k: 'PK' }, { n: 'Цена' }] },
            { id: 'o', t: 'orders', x: 250, y: 10, attrs: [{ n: 'Заказ', k: 'PK' }, { n: 'Покупатель', k: 'FK' }, { n: 'Сеанс', k: 'FK' }] },
            { id: 'c', t: 'customer', x: 490, y: 10, attrs: [{ n: 'Покупатель', k: 'PK' }, { n: 'Телефон' }] },
            { id: 's', t: 'screening', x: 250, y: 170, attrs: [{ n: 'Сеанс', k: 'PK' }, { n: 'Фильм', k: 'FK' }] },
            { id: 'f', t: 'film', x: 490, y: 170, attrs: [{ n: 'Фильм', k: 'PK' }, { n: 'Длит.' }] },
            { id: 'g', t: 'film_genre', x: 730, y: 170, attrs: [{ n: 'Фильм', k: 'PK FK' }, { n: 'Жанр', k: 'PK' }] }
          ], rels: [{ a: 'o', b: 't', ca: '1', cb: '1..N' }, { a: 'c', b: 'o', ca: '1', cb: '0..N' }, { a: 's', b: 'o', ca: '1', cb: '0..N' }, { a: 'f', b: 's', ca: '1', cb: '0..N' }, { a: 'f', b: 'g', ca: '1', cb: '1..N' }], width: 960, height: 290, title: 'Итог нормализации' });
          ui.anomalyViz(TR.$('[data-an]', box), { flat: FLAT, split: SPLIT, ops: ANOM_OPS });
          return 'Нормализация — не ради красоты: она убирает противоречия в данных. Но не всё повторяющееся — дубль: цена билета «на момент покупки» — отдельный факт, её храним в билете (об этом в занятии 3).';
        }
      },
      {
        id: 's7', t: '7. Шпаргалка', title: 'Шаг 7. Шпаргалка: как нормализовать любую таблицу',
        plain: 'Алгоритм, который работает на собеседовании и в работе. Идите сверху вниз.',
        terms: [],
        render(box) {
          box.innerHTML = ui.table(['Шаг', 'Правило простыми словами', 'Вопрос для проверки', 'Что делаем'], [
            ['Ключ', 'у каждой строки есть то, что её однозначно отличает', 'Что не повторяется ни у одной пары строк?', 'выбираем ключ; если нет — добавляем id'],
            ['<b>1НФ</b>', 'в ячейке одно значение, нет столбцов-близнецов', 'Есть ли списки через запятую? phone1, phone2?', 'выносим список в отдельную таблицу строками'],
            ['<b>2НФ</b>', 'всё зависит от всего ключа', 'Ключ составной? Есть столбец, которому хватает половины ключа?', 'выносим его вместе с этой половиной'],
            ['<b>3НФ</b>', 'неключевые столбцы не зависят друг от друга', 'Можно ли узнать столбец по другому неключевому?', 'выносим цепочку, оставляем ссылку'],
            ['Проверка', 'каждый факт — один раз', 'Сменить телефон — сколько ячеек править?', 'должна быть одна']
          ]) + '<div class="nl-res">Формула: <b>«ключ, весь ключ и ничего, кроме ключа»</b>. Есть ключ и атомарность — 1НФ. Весь ключ — 2НФ. Ничего, кроме ключа — 3НФ. Выше (НФБК, 4НФ, 5НФ) в рабочих системах нужно редко.</div>';
          return 'Вы прошли нормализацию целиком. Задания ниже проверят то же самое на других таблицах.';
        }
      }
    ];

    return {
      id: 'how-norm', title: 'Как это работает: нормализация по шагам — от листа Excel до таблиц', covers: ['norm', 'nf'], free: true, noReset: true,
      simple: { icon: '🧩', plain: 'Нормализация — пошаговая раскладка данных по таблицам так, чтобы каждый факт хранился один раз. <b>1НФ</b> — в ячейке одно значение. <b>2НФ</b> — всё зависит от всего ключа. <b>3НФ</b> — ничего, кроме ключа. Ниже — восемь шагов на настоящем листе Нины Сергеевны: с кнопками «разбить» и «вынести» и расшифровкой каждого термина.', analogy: 'Разбор кладовки: по одной вещи в ячейку, каждую — на полку хозяина, а не к соседу, который «знает хозяина».', tech: 'Функциональные зависимости, частичные (2НФ) и транзитивные (3НФ); декомпозиция без потерь — исходную таблицу можно собрать обратно JOIN по ключам.' },
      lead: ui.brief({ situation: 'Лист «Продажи» Нины Сергеевны — пять строк из двух тысяч.', todo: ['Идите по шагам кнопкой «Дальше →». На каждом шаге нажимайте то, что предлагают: ячейки, «Разбить», «Вынести».', 'Раздел засчитается, когда дойдёте до шпаргалки.'], look: 'Следите за красным: это повторы. С каждым шагом их меньше.' }),
      render(el, ctx) {
        const a = ctx.ans; a.k = a.k || 0; a.seen = a.seen || {}; a.st = a.st || {};
        const draw = () => {
          const S = STEPS[a.k], st = (a.st[S.id] = a.st[S.id] || {});
          a.seen[S.id] = 1;
          el.innerHTML = `<div class="nl">
            <div class="nl-pills" role="tablist">${STEPS.map((x, i) => `<button type="button" data-nk="${i}" aria-pressed="${i === a.k}" class="${a.seen[x.id] ? 'seen' : ''}">${esc(x.t)}</button>`).join('')}</div>
            <div class="nl-head"><h4>${esc(S.title)}</h4></div>
            <div class="nl-plain">${S.plain}</div>
            ${S.terms.length ? `<div class="nl-terms">${S.terms.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>` : ''}
            <div class="stack" data-box></div>
            <div class="qp-note" data-sum></div>
            <div class="nl-nav"><button type="button" class="btn sm" data-nk="${Math.max(0, a.k - 1)}" ${a.k === 0 ? 'disabled' : ''}>← Назад</button><span class="small dim">шаг ${a.k + 1} из ${STEPS.length}</span><button type="button" class="btn sm primary" data-nk="${Math.min(STEPS.length - 1, a.k + 1)}" ${a.k === STEPS.length - 1 ? 'disabled' : ''}>Дальше →</button></div></div>`;
          const box = TR.$('[data-box]', el);
          TR.$('[data-sum]', el).innerHTML = '<b>Что изменилось.</b> ' + S.render(box, st);
          ctx.save();
          if (a.k === STEPS.length - 1) ctx.ready();
        };
        el.addEventListener('click', e => {
          const nk = e.target.closest('[data-nk]');
          if (nk && !nk.disabled) { a.k = +nk.dataset.nk; draw(); el.scrollIntoView({ block: 'nearest' }); return; }
          const S = STEPS[a.k];
          if (S.click && S.click(e, a.st[S.id])) draw();
        });
        ui.onSeg(el, (n, v) => { const S = STEPS[a.k]; if (S.seg && S.seg(n, v, a.st[S.id])) draw(); });
        draw();
        if (ctx.readonly || a.seen.s7) ctx.ready();
      }
    };
  };
})();
