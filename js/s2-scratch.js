/* Занятие 2, первое задание. С нуля: от рассказа заказчика к таблицам — пять шагов с проверкой каждого:
   кандидаты (сущность, атрибут, значение, не для базы) → атрибуты по сущностям → ключи → связи → таблицы.
   Справа по ходу растёт ERD и DDL из ответов ученика. Подключается в s2-erd.js как TR.ERD_SCRATCH. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .sc-wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;align-items:start}
  @media (max-width:1100px){.sc-wrap{grid-template-columns:minmax(0,1fr)}}
  .sc-steps{display:flex;flex-wrap:wrap;gap:6px}
  .sc-steps button{border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);border-radius:999px;padding:5px 12px;font:600 12px var(--f-body);cursor:pointer}
  .sc-steps button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
  .sc-steps button.done{border-color:var(--ok);color:var(--ok)}.sc-steps button:disabled{opacity:.4;cursor:not-allowed}
  .sc-story{font-size:14.5px;line-height:1.95;padding:12px 14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)}
  .sc-story mark{background:none;color:inherit;border-bottom:2px dashed var(--text-muted);padding:0 2px}
  .sc-story mark.on{border-bottom:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}
  .sc-help{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:8px}
  .sc-help div{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface);font-size:12.5px;line-height:1.4}
  .sc-help b{display:block;color:var(--accent);font-size:12.5px}
  .sc-rows{display:grid;gap:5px}
  .sc-row{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr);gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}
  .sc-row.ok{border-left:4px solid var(--ok)}.sc-row.bad{border-left:4px solid var(--bad)}
  .sc-row .w{font-weight:600}.sc-row .why{grid-column:1/-1;font-size:12.5px;color:var(--bad)}.sc-row.ok .why{color:var(--ok)}
  .sc-opts{display:flex;flex-wrap:wrap;gap:4px}
  .sc-opts button{border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);border-radius:7px;padding:4px 9px;font:500 12px var(--f-body);cursor:pointer}
  .sc-opts button[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent);color:var(--text);font-weight:600}
  .sc-row select{width:100%;min-width:0}
  .sc-rel{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
  .sc-res{font:600 12px var(--f-mono);color:var(--accent)}
  .sc-side{position:sticky;top:70px;display:grid;gap:10px;min-width:0}
  @media (max-width:1100px){.sc-side{position:static}}
  </style>`);

  // ---------- кейс ----------
  const STORY = [
    'В «Кадре» показывают ', ['фильмы', 'film'], '. У каждого фильма есть ', ['название', 'title'], ', ', ['длительность', 'duration'], ' и ', ['возрастной рейтинг', 'rating'], '. Фильм показывают на ', ['сеансе', 'screening'], ': сеанс — это фильм в конкретном ', ['зале', 'hall'], ' в конкретное ', ['время начала', 'starts'], ', у сеанса своя ', ['базовая цена', 'base'], '. У зала есть ', ['название зала', 'hname'], ' и ', ['формат', 'format'], ' — 2D, 3D или IMAX. В зале ряды ', ['мест', 'seat'], ', у каждого места ', ['номер ряда', 'row'], ' и ', ['номер места', 'num'], '. ', ['Покупатель', 'customer'], ' с ', ['именем', 'cname'], ' и ', ['телефоном', 'phone'], ' покупает ', ['билет', 'ticket'], ' на конкретное место на конкретный сеанс; у билета своя ', ['цена', 'price'], '. Например, вчера ', ['Анна', 'anna'], ' купила билет на ', ['«Глубину»', 'glub'], ' в зал ', ['«Синий»', 'blue'], '. Ещё хотим ', ['красивую афишу', 'poster'], ' и чтобы всё ', ['быстро работало', 'fast'], '.'
  ];
  const ENT = { film: 'Фильм', screening: 'Сеанс', hall: 'Зал', seat: 'Место', customer: 'Покупатель', ticket: 'Билет' };
  const TBL = { film: 'film', screening: 'screening', hall: 'hall', seat: 'seat', customer: 'customer', ticket: 'ticket' };
  const C = {
    film: ['ent', 'Фильмов много, о каждом храним название, длительность, рейтинг — сущность.'],
    screening: ['ent', 'Сеансов много, у каждого своё время и цена — сущность.'],
    hall: ['ent', 'Залов несколько, у каждого название и формат — сущность.'],
    seat: ['ent', 'Мест много, у каждого ряд и номер — сущность.'],
    customer: ['ent', 'Покупателей много, у каждого имя и телефон — сущность.'],
    ticket: ['ent', 'Билетов много, у каждого своя цена, место и сеанс — сущность.'],
    title: ['attr', 'Название — свойство фильма, своих свойств у него нет.', 'film', 'title VARCHAR(120)'],
    duration: ['attr', 'Длительность описывает фильм.', 'film', 'duration_min INTEGER'],
    rating: ['attr', 'Рейтинг описывает фильм.', 'film', 'age_rating VARCHAR(3)'],
    starts: ['attr', 'Время начала — свойство сеанса.', 'screening', 'starts_at TIMESTAMPTZ'],
    base: ['attr', 'Базовая цена — свойство сеанса (утро дешевле вечера).', 'screening', 'base_price NUMERIC(8,2)'],
    hname: ['attr', 'Название зала — свойство зала.', 'hall', 'name VARCHAR(30)'],
    format: ['attr', 'Формат — свойство зала: его определяет оборудование.', 'hall', 'format VARCHAR(5)'],
    row: ['attr', 'Номер ряда — свойство места.', 'seat', 'row_no INTEGER'],
    num: ['attr', 'Номер места — свойство места.', 'seat', 'seat_no INTEGER'],
    cname: ['attr', 'Имя — свойство покупателя.', 'customer', 'full_name VARCHAR(120)'],
    phone: ['attr', 'Телефон — свойство покупателя.', 'customer', 'phone VARCHAR(20)'],
    price: ['attr', 'Цена билета — свойство продажи: зависит от сеанса, места и момента покупки.', 'ticket', 'price NUMERIC(8,2)'],
    anna: ['val', 'Анна — один конкретный покупатель, то есть строка таблицы покупателей, а не таблица.'],
    glub: ['val', '«Глубина» — конкретный фильм, одна строка таблицы фильмов.'],
    blue: ['val', '«Синий» — конкретный зал, одна строка таблицы залов.'],
    poster: ['none', 'Афиша — интерфейс. В базе может появиться разве что постер фильма.'],
    fast: ['none', 'Скорость — нефункциональное требование, на сущности не влияет.']
  };
  const WORD = Object.fromEntries(STORY.filter(Array.isArray).map(([w, id]) => [id, w]));
  const CANDS = STORY.filter(Array.isArray).map(x => x[1]);
  const ENTS = Object.keys(ENT), ATTRS = CANDS.filter(id => C[id][0] === 'attr');
  const CAT = [['ent', 'Сущность'], ['attr', 'Атрибут'], ['val', 'Конкретное значение'], ['none', 'Не для базы']];
  const KEYS = { film: ['id', 'title'], screening: ['id', 'starts'], hall: ['id', 'hname'], seat: ['id', 'combo', 'num'], customer: ['id', 'phone', 'cname'], ticket: ['id', 'price'] };
  const KEY_OK = { film: ['id'], screening: ['id'], hall: ['id'], seat: ['id', 'combo'], customer: ['id'], ticket: ['id'] };
  const KEY_WHY = {
    title: 'Названия повторяются (ремейки) и исправляются — ключ должен быть уникальным и неизменным.', starts: 'В одно время идут сеансы в разных залах — время не уникально.', hname: 'Название зала могут сменить, а в сети «Синий» может быть в двух кинотеатрах.',
    num: 'Номер места повторяется в каждом ряду и в каждом зале.', phone: 'Телефон меняют, а старый номер оператор отдаёт другому человеку.', cname: 'Тёзки — обычное дело.', price: 'Одинаковых цен тысячи.',
    id: 'Суррогатный id выдаёт база: уникален, всегда заполнен и ничего не означает — поэтому никогда не меняется.', combo: 'Тройка (зал, ряд, номер) уникальна и не меняется — естественный составной ключ. Часто всё равно добавляют id, а тройку делают UNIQUE.'
  };
  const keyLabel = (e, k) => k === 'id' ? 'id — номер, который выдаёт база' : k === 'combo' ? 'зал + ряд + номер места' : WORD[k];
  const RELS = [
    { id: 'r1', a: 'film', b: 'screening', ab: 'many', ba: 'one', q1: 'Сколько сеансов может быть у одного фильма?', q2: 'Сколько фильмов показывают на одном сеансе?' },
    { id: 'r2', a: 'hall', b: 'screening', ab: 'many', ba: 'one', q1: 'Сколько сеансов в одном зале?', q2: 'В скольких залах идёт один сеанс?' },
    { id: 'r3', a: 'hall', b: 'seat', ab: 'many', ba: 'one', q1: 'Сколько мест в одном зале?', q2: 'Скольким залам принадлежит одно место?' },
    { id: 'r4', a: 'screening', b: 'ticket', ab: 'many', ba: 'one', q1: 'Сколько билетов продают на один сеанс?', q2: 'На сколько сеансов действует один билет?' },
    { id: 'r5', a: 'seat', b: 'ticket', ab: 'many', ba: 'one', q1: 'Сколько билетов за неделю продают на одно место (на разные сеансы)?', q2: 'Сколько мест в одном билете?' },
    { id: 'r6', a: 'customer', b: 'ticket', ab: 'many', ba: 'one', q1: 'Сколько билетов может купить один покупатель?', q2: 'Сколько покупателей у одного билета?' },
    { id: 'r7', a: 'screening', b: 'seat', ab: 'many', ba: 'many', q1: 'Сколько мест продают на одном сеансе?', q2: 'На скольких сеансах продают одно и то же место?' }
  ];
  const ONE_MANY = [['one', 'один'], ['many', 'много']];
  const relKind = (ab, ba) => !ab || !ba ? null : ab === 'many' && ba === 'many' ? 'mn' : ab === 'many' ? '1n' : ba === 'many' ? 'n1' : '11';
  const relText = (r, ab, ba) => { const k = relKind(ab, ba); if (!k) return ''; if (k === 'mn') return `многие ко многим → нужна таблица-связка${r.id === 'r7' ? ' — это и есть Билет' : ''}`; if (k === '1n') return `один ко многим → внешний ключ ${TBL[r.b]}.${TBL[r.a]}_id`; if (k === 'n1') return `один ко многим → внешний ключ ${TBL[r.a]}.${TBL[r.b]}_id`; return 'один к одному → обычно одна таблица'; };
  const STEPS = [['cat', '1. Кандидаты'], ['own', '2. Атрибуты'], ['key', '3. Ключи'], ['rel', '4. Связи'], ['ddl', '5. Таблицы']];

  // ---------- проверка шагов ----------
  const okCat = a => CANDS.filter(id => (a.cat || {})[id] === C[id][0]).length;
  const okOwn = a => ATTRS.filter(id => (a.own || {})[id] === C[id][2]).length;
  const okKey = a => ENTS.filter(e => KEY_OK[e].includes((a.key || {})[e])).length;
  const okRel = a => RELS.filter(r => ((a.rel || {})[r.id] || {}).ab === r.ab && ((a.rel || {})[r.id] || {}).ba === r.ba).length;
  const stepOk = (a, s) => s === 'cat' ? okCat(a) === CANDS.length : s === 'own' ? okOwn(a) === ATTRS.length : s === 'key' ? okKey(a) === ENTS.length : s === 'rel' ? okRel(a) === RELS.length : true;

  // ---------- модель из ответов ученика (для ERD и DDL справа) ----------
  function model(a, ref) {
    const cat = ref ? Object.fromEntries(CANDS.map(id => [id, C[id][0]])) : (a.cat || {});
    const own = ref ? Object.fromEntries(ATTRS.map(id => [id, C[id][2]])) : (a.own || {});
    const key = ref ? Object.fromEntries(ENTS.map(e => [e, 'id'])) : (a.key || {});
    const rel = ref ? Object.fromEntries(RELS.map(r => [r.id, { ab: r.ab, ba: r.ba }])) : (a.rel || {});
    const ents = CANDS.filter(id => cat[id] === 'ent');
    const fks = {};
    RELS.forEach(r => { const x = rel[r.id] || {}, k = relKind(x.ab, x.ba); if (!ents.includes(r.a) || !ents.includes(r.b)) return; if (k === '1n') (fks[r.b] = fks[r.b] || []).push(TBL[r.a] + '_id'); if (k === 'n1') (fks[r.a] = fks[r.a] || []).push(TBL[r.b] + '_id'); });
    return { ents, own, key, rel, fks, cat };
  }
  function erOf(a, ref, el) {
    const m = model(a, ref);
    const POS = { film: [10, 10], screening: [260, 10], hall: [510, 10], customer: [10, 220], ticket: [260, 220], seat: [510, 220] };
    let extra = 0;
    const entities = m.ents.map(id => {
      const p = POS[id] || [10 + (extra++) * 200, 400];
      const k = m.key[id], attrs = [];
      if (k === 'id') attrs.push({ n: 'id', k: 'PK' });
      else if (k === 'combo') attrs.push({ n: 'hall_id + row_no + seat_no', k: 'PK' });
      else if (k) attrs.push({ n: WORD[k], k: 'PK', tone: ref ? '' : 'bad' });
      (m.fks[id] || []).forEach(f => attrs.push({ n: f, k: 'FK' }));
      ATTRS.filter(x => m.own[x] === id && x !== k).forEach(x => attrs.push({ n: WORD[x], tone: ref || C[x][2] === id ? '' : 'bad' }));
      return { id, t: ENT[id] || WORD[id], x: p[0], y: p[1], w: 210, tone: ref || C[id][0] === 'ent' ? '' : 'bad', attrs };
    });
    const rels = [];
    RELS.forEach(r => { const x = m.rel[r.id] || {}, k = relKind(x.ab, x.ba); if (!k || !m.ents.includes(r.a) || !m.ents.includes(r.b)) return; const good = ref || (x.ab === r.ab && x.ba === r.ba); rels.push({ a: r.a, b: r.b, ca: x.ba === 'many' ? '0..N' : '1', cb: x.ab === 'many' ? '0..N' : '1', tone: good ? '' : 'bad', dash: k === 'mn', t: k === 'mn' ? 'M:N' : '' }); });
    if (!entities.length) { el.innerHTML = '<p class="small dim">Здесь появится схема, как только вы отметите сущности.</p>'; return; }
    ui.er(el, { entities, rels, width: 740, height: entities.some(e => e.y > 300) ? 470 : 380, title: ref ? 'Модель — эталон' : 'Ваша модель' });
  }
  function ddlOf(a, ref) {
    const m = model(a, ref);
    return m.ents.map(id => {
      const k = m.key[id], cols = [];
      if (k === 'id' || !k) cols.push('  id        BIGINT PRIMARY KEY');
      else if (k === 'combo') cols.push('  hall_id   BIGINT NOT NULL REFERENCES hall(id)');
      (m.fks[id] || []).filter(f => !(k === 'combo' && f === 'hall_id')).forEach(f => cols.push(`  ${f.padEnd(9)} BIGINT NOT NULL REFERENCES ${f.replace(/_id$/, '')}(id)`));
      ATTRS.filter(x => m.own[x] === id).forEach(x => cols.push(`  ${C[x][3] ? C[x][3].replace(' ', ' '.repeat(Math.max(1, 10 - C[x][3].indexOf(' ')))) : WORD[x]} NOT NULL${k === x ? ' PRIMARY KEY' : ''}`));
      if (k === 'combo') cols.push('  PRIMARY KEY (hall_id, row_no, seat_no)');
      return `CREATE TABLE ${TBL[id] || WORD[id]} (\n${cols.join(',\n')}\n);`;
    }).join('\n\n') || '-- пока нет сущностей';
  }

  // ---------- задание ----------
  TR.ERD_SCRATCH = {
    id: 'scratch', title: 'С нуля: от рассказа заказчика к таблицам',
    lead: ui.brief({ situation: 'Нина Сергеевна рассказала, как устроен «Кадр». Никакой схемы ещё нет — только этот текст. Артём: «Пройди весь путь сам: найди сущности, разложи свойства, выбери ключи, свяжи — и таблицы получатся сами».', todo: ['Идите по шагам 1 → 5. На каждом шаге нажмите «Проверить шаг»: верные строки станут зелёными, у неверных появится подсказка. Следующий шаг открывается после верного.', 'Справа по ходу растёт ваша модель: ERD и таблицы из ваших ответов.', 'В конце нажмите «Проверить» внизу задания.'], look: 'Сущность — то, чего много и о чём храним свои факты. Атрибут — одно свойство сущности. Конкретное значение — одна строка, а не таблица.' }),
    blank: () => ({ cat: {}, own: {}, key: {}, rel: {}, step: 'cat', done: {} }),
    reference: () => ({ cat: Object.fromEntries(CANDS.map(id => [id, C[id][0]])), own: Object.fromEntries(ATTRS.map(id => [id, C[id][2]])), key: Object.fromEntries(ENTS.map(e => [e, 'id'])), rel: Object.fromEntries(RELS.map(r => [r.id, { ab: r.ab, ba: r.ba }])), step: 'ddl', done: { cat: 1, own: 1, key: 1, rel: 1 } }),
    render(el, ctx) {
      const a = ctx.ans; ['cat', 'own', 'key', 'rel', 'done'].forEach(k => { a[k] = a[k] || {}; }); a.step = a.step || 'cat';
      const ro = ctx.readonly, judged = s => !!a.done[s] || !!(a.tried && a.tried[s]) || !!ctx.result || ro;
      const unlocked = s => { const i = STEPS.findIndex(x => x[0] === s); return ro || ctx.teacher || STEPS.slice(0, i).every(x => a.done[x[0]]); };
      const row = (cls, w, body, why) => `<div class="sc-row ${cls}"><span class="w">${w}</span><div>${body}</div>${why ? `<div class="why">${why}</div>` : ''}</div>`;
      const opts = (name, list, cur) => `<div class="sc-opts" role="group">${list.map(([v, t]) => `<button type="button" data-o="${esc(name)}" data-v="${esc(v)}" aria-pressed="${cur === v}" ${ro ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>`;
      function body() {
        const s = a.step, J = judged(s);
        if (s === 'cat') return `<div class="sc-story">${STORY.map(x => Array.isArray(x) ? `<mark class="${a.cat[x[1]] ? 'on' : ''}">${esc(x[0])}</mark>` : esc(x)).join('')}</div>
          <div class="sc-help"><div><b>1. Этого много?</b>Фильмов, залов, мест — много. «Глубина» — один конкретный фильм: это значение.</div><div><b>2. Есть свои свойства?</b>У фильма — название, длительность. У «названия» своих свойств нет — оно само свойство.</div><div><b>3. Нужно базе?</b>Афиша и скорость — про интерфейс и нагрузку, в таблицы не попадут.</div><div><b>Итог</b>Да-да-да — сущность (таблица). Свойство чего-то — атрибут (столбец). Один конкретный — значение (строка).</div></div>
          <div class="sc-rows">${CANDS.map(id => { const g = a.cat[id], ok = g === C[id][0]; return row(J && g ? (ok ? 'ok' : 'bad') : '', esc(WORD[id]), opts('cat.' + id, CAT, g), J && g && !ok ? esc(C[id][1]) : ''); }).join('')}</div>`;
        if (s === 'own') return `<p class="small">Каждый атрибут — свойство одной сущности. Спросите: «название <i>чего</i>?», «цена <i>чего</i>?».</p><div class="sc-rows">${ATTRS.map(id => { const g = a.own[id], ok = g === C[id][2]; return row(J && g ? (ok ? 'ok' : 'bad') : '', esc(WORD[id]), `<select data-sel="own.${id}" ${ro ? 'disabled' : ''}><option value="">— чьё свойство? —</option>${ENTS.map(e => `<option value="${e}" ${g === e ? 'selected' : ''}>${ENT[e]}</option>`).join('')}</select>`, J && g && !ok ? esc(C[id][1]) : ''); }).join('')}</div>`;
        if (s === 'key') return `<p class="small">Первичный ключ находит ровно одну строку: <b>уникален</b>, <b>всегда заполнен</b>, <b>не меняется</b>. Проверьте каждого кандидата по трём требованиям.</p><div class="sc-rows">${ENTS.map(e => { const g = a.key[e], ok = KEY_OK[e].includes(g); return row(J && g ? (ok ? 'ok' : 'bad') : '', ENT[e], opts('key.' + e, KEYS[e].map(k => [k, keyLabel(e, k)]), g), J && g ? esc(KEY_WHY[g]) : ''); }).join('')}</div>`;
        if (s === 'rel') return `<p class="small">Для каждой пары — два вопроса, в обе стороны. Ответы сами скажут тип связи и где будет внешний ключ.</p><div class="sc-rows">${RELS.map(r => { const x = a.rel[r.id] || {}, ok = x.ab === r.ab && x.ba === r.ba; return row(J && x.ab && x.ba ? (ok ? 'ok' : 'bad') : '', `${ENT[r.a]} — ${ENT[r.b]}`, `<div class="sc-rel"><label class="small">${esc(r.q1)}${opts(`rel.${r.id}.ab`, ONE_MANY, x.ab)}</label><label class="small">${esc(r.q2)}${opts(`rel.${r.id}.ba`, ONE_MANY, x.ba)}</label></div>${x.ab && x.ba ? `<div class="sc-res">→ ${esc(relText(r, x.ab, x.ba))}</div>` : ''}`, J && x.ab && x.ba && !ok ? esc(`Верно: ${r.q1.toLowerCase()} — ${r.ab === 'many' ? 'много' : 'один'}; ${r.q2.toLowerCase()} — ${r.ba === 'many' ? 'много' : 'один'}. ${relText(r, r.ab, r.ba)}.`) : ''); }).join('')}</div>`;
        return `<div class="note ok"><div class="ttl">Таблицы готовы</div><div>Из рассказа в 9 предложений получилось шесть таблиц. Внешние ключи появились сами — там, где у связи сторона «многие». Связь «сеанс — место» оказалась многие ко многим, и её связка — это Билет: у него свои атрибуты (цена) и ссылки на сеанс и место. Дальше в занятии — мощности подробнее, обязательность и ошибки ERD.</div></div>${ui.code(ddlOf(a), 'sql', 'Ваши таблицы — CREATE TABLE из ответов')}`;
      }
      function draw() {
        const s = a.step, total = { cat: [okCat(a), CANDS.length], own: [okOwn(a), ATTRS.length], key: [okKey(a), ENTS.length], rel: [okRel(a), RELS.length] }[s];
        el.innerHTML = `<div class="sc-wrap"><div class="stack">
          <div class="sc-steps" role="tablist">${STEPS.map(([id, t]) => `<button type="button" data-st="${id}" aria-pressed="${s === id}" class="${a.done[id] ? 'done' : ''}" ${unlocked(id) ? '' : 'disabled'}>${a.done[id] ? '✓ ' : ''}${esc(t)}</button>`).join('')}</div>
          ${body()}
          ${s !== 'ddl' && !ro ? `<div class="row"><button type="button" class="btn primary sm" data-chk>Проверить шаг</button>${judged(s) && total ? `<span class="small">${a.done[s] ? `<b style="color:var(--ok)">Верно ${total[0]} из ${total[1]} — шаг пройден.</b>` : `Верно ${total[0]} из ${total[1]}. Исправьте красные строки.`}</span>` : ''}${a.done[s] ? `<button type="button" class="btn sm" data-next>Следующий шаг →</button>` : ''}</div>` : ''}
        </div><div class="sc-side"><div class="dv-k">Ваша модель растёт здесь</div><div data-er></div></div></div>`;
        erOf(a, false, TR.$('[data-er]', el));
      }
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-o],[data-st],[data-chk],[data-next]'); if (!t || ro) return;
        if (t.dataset.o) { const [kind, id, side] = t.dataset.o.split('.'); if (kind === 'rel') { a.rel[id] = Object.assign({}, a.rel[id], { [side]: t.dataset.v }); } else a[kind][id] = t.dataset.v; if (a.done[a.step] && !stepOk(a, a.step)) delete a.done[a.step]; ctx.save(); draw(); return; }
        if (t.dataset.st) { a.step = t.dataset.st; ctx.save(); draw(); return; }
        if (t.dataset.chk) { a.tried = Object.assign({}, a.tried, { [a.step]: 1 }); if (stepOk(a, a.step)) a.done[a.step] = 1; ctx.save(); draw(); return; }
        if (t.dataset.next) { const i = STEPS.findIndex(x => x[0] === a.step); a.step = STEPS[Math.min(STEPS.length - 1, i + 1)][0]; ctx.save(); draw(); }
      });
      el.addEventListener('change', e => { const s = e.target.closest('[data-sel]'); if (!s) return; const [kind, id] = s.dataset.sel.split('.'); a[kind][id] = s.value; if (a.done[a.step] && !stepOk(a, a.step)) delete a.done[a.step]; ctx.save(); draw(); });
      draw();
    },
    check(ans) {
      const parts = [[okCat(ans), CANDS.length, 'кандидаты'], [okOwn(ans), ATTRS.length, 'атрибуты'], [okKey(ans), ENTS.length, 'ключи'], [okRel(ans), RELS.length, 'связи']];
      const good = parts.reduce((s, p) => s + p[0], 0), all = parts.reduce((s, p) => s + p[1], 0);
      return { ok: good === all, score: good / all, summary: parts.map(p => `${p[2]}: ${p[0]} из ${p[1]}`).join(' · '), notes: parts.filter(p => p[0] < p[1]).map(p => ({ ok: false, html: `Шаг «${p[2]}» ещё не сходится — вернитесь к нему и нажмите «Проверить шаг».` })) };
    },
    flags: ans => CANDS.filter(id => C[id][0] === 'val' && (ans.cat || {})[id] === 'ent').map(id => `Конкретное значение «${WORD[id]}» сделал сущностью`).concat(RELS.filter(r => r.id === 'r7' && ((ans.rel || {}).r7 || {}).ba === 'one').map(() => 'Не увидел «многие ко многим» у сеанса и места')),
    answers: ans => [
      { q: 'Шаг 1. Кандидаты: сущность, атрибут, значение, не для базы', mine: `верно ${okCat(ans)} из ${CANDS.length}`, right: `сущности: ${ENTS.map(e => ENT[e]).join(', ')}`, ok: okCat(ans) === CANDS.length, why: 'Сущность — то, чего много и о чём храним свои факты: фильм, сеанс, зал, место, покупатель, билет. «Глубина», «Синий», Анна — конкретные строки. Название, цена, телефон — свойства. Афиша и скорость — не про данные.' },
      { q: 'Шаг 2. Атрибуты по сущностям', mine: `верно ${okOwn(ans)} из ${ATTRS.length}`, right: 'каждый атрибут — у той сущности, которую он описывает', ok: okOwn(ans) === ATTRS.length, why: 'Вопрос «чего?» решает: название чего, формат чего, цена чего. Цена билета — у билета, базовая цена — у сеанса: это разные факты.' },
      { q: 'Шаг 3. Первичные ключи', mine: `верно ${okKey(ans)} из ${ENTS.length}`, right: 'id у всех (у места можно зал + ряд + номер)', ok: okKey(ans) === ENTS.length, why: 'Названия, телефоны и имена не уникальны или меняются. Суррогатный id уникален, всегда заполнен и никогда не меняется.' },
      { q: 'Шаг 4. Связи', mine: `верно ${okRel(ans)} из ${RELS.length}`, right: 'шесть «один ко многим» и одна «многие ко многим» (сеанс — место через билет)', ok: okRel(ans) === RELS.length, why: 'Два вопроса в обе стороны дают тип связи. «Один ко многим» — внешний ключ на стороне «многих». «Многие ко многим» — таблица-связка; у сеанса и места это Билет.' }
    ],
    viz(el, ans) {
      let v = 'mine';
      const draw = () => {
        el.innerHTML = `<div class="stack">${ui.seg('scv', [{ v: 'mine', t: 'Ваша модель' }, { v: 'ref', t: 'Эталон' }], v)}<div data-er></div>${ui.code(ddlOf(ans, v === 'ref'), 'sql', v === 'ref' ? 'Таблицы эталона' : 'Ваши таблицы')}<div class="qp-note">Путь, который вы прошли, — тот же, что у аналитика на настоящем проекте: <b>кандидаты</b> из текста → проверка «много ли, есть ли свои свойства» → <b>атрибуты</b> по вопросу «чего?» → <b>ключи</b> по трём требованиям → <b>связи</b> двумя вопросами в обе стороны → таблицы. Красным на схеме — где ваш ответ расходится с эталоном.</div></div>`;
        erOf(ans, v === 'ref', TR.$('[data-er]', el));
      };
      ui.onSeg(el, (n, x) => { if (n !== 'scv') return; v = x; draw(); });
      draw();
    },
    explain: '<p>Сущности не «видят», их <b>проверяют</b>: много ли экземпляров, есть ли у них свои свойства, нужны ли они базе. Конкретные имена — это строки, а не таблицы. Атрибут ищут вопросом «свойство чего?». Ключ — по трём требованиям. Связь — двумя вопросами в обе стороны: «сколько B у одного A» и «сколько A у одного B». Если в обе стороны «много» — нужна таблица-связка, и часто у неё находятся свои атрибуты: так появился Билет.</p>',
    report: ans => `кандидаты ${okCat(ans)}/${CANDS.length}, атрибуты ${okOwn(ans)}/${ATTRS.length}, ключи ${okKey(ans)}/${ENTS.length}, связи ${okRel(ans)}/${RELS.length}`
  };
})();
