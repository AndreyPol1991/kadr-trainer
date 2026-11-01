/* Схемы для баз данных: из них собираются «Разборы на схеме» и лаборатории теории.
   Строковые помощники возвращают HTML, интерактивные — рисуют в переданный элемент.
   - ui.dbt(cfg)            — маленькая таблица с подсветкой ячеек, строк и столбцов, бейджи PK/FK
   - TR.rel.steps(spec)     — учебный «движок» запроса: шаги FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
   - ui.qplay(el, cfg)      — проигрыватель этих шагов с подсветкой части запроса
   - ui.joinViz(el, cfg)    — две таблицы, линии совпадений и результат JOIN; переключатель типа
   - ui.fkViz(el, cfg)      — удаление родительской строки при CASCADE / RESTRICT / SET NULL
   - ui.anomalyViz(el, cfg) — аномалии ненормализованной таблицы против нормализованных
   - ui.crowRead(el, cfg)   — связь «вороньими лапками» и её чтение словами в обе стороны
   - ui.indexViz(el, cfg)   — полный просмотр против поиска по индексу: сколько строк прочитано
   - ui.stateViz(el, cfg)   — статусная модель: щёлкаете переходы, растёт таблица истории
   - ui.depViz(cfg)         — функциональные зависимости по одной: «X определяет Y», вердикт и повторы в данных
   - ui.truth3(el)          — трёхзначная логика NULL
   - ui.resDiff(mine, ref)  — результат запроса ученика рядом с эталоном */
'use strict';
(function () {
  const TR = window.TR, esc = TR.esc, ui = TR.ui;
  let uid = 0;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .dv-t{border:1px solid var(--border);border-radius:10px;overflow:auto;background:var(--surface);min-width:0;max-width:100%}
  .dv-t .dv-cap{display:flex;gap:8px;align-items:baseline;justify-content:space-between;padding:6px 10px;background:var(--surface-3);border-bottom:1px solid var(--border);font:600 12.5px var(--f-mono);color:var(--text)}
  .dv-t .dv-cap small{font:400 11.5px var(--f-body);color:var(--text-muted)}
  .dv-t table{border-collapse:collapse;width:100%;font:12.5px/1.35 var(--f-mono)}
  .dv-t th,.dv-t td{padding:5px 9px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;vertical-align:top}
  .dv-t th{background:var(--surface-2);color:var(--text-2);font-weight:600}
  .dv-t th .k{display:inline-block;margin-right:4px;padding:0 4px;border-radius:4px;font:700 9.5px/16px var(--f-mono);background:var(--accent-soft);color:var(--accent)}
  .dv-t th .k.fk{background:var(--info-soft);color:var(--info)}
  .dv-t td.null{color:var(--text-muted);font-style:italic}
  .dv-t .hl{background:color-mix(in srgb,var(--accent) 22%,transparent);box-shadow:inset 0 0 0 1.5px var(--accent)}
  .dv-t .ok{background:var(--ok-soft);box-shadow:inset 0 0 0 1.5px var(--ok)}
  .dv-t .bad{background:var(--bad-soft);box-shadow:inset 0 0 0 1.5px var(--bad)}
  .dv-t .warn{background:var(--warn-soft);box-shadow:inset 0 0 0 1.5px var(--warn)}
  .dv-t .info{background:var(--info-soft)}
  .dv-t tr.out td{opacity:.42;text-decoration:line-through}
  .dv-t tr.unk td{opacity:.5;text-decoration:line-through;text-decoration-style:wavy}
  .dv-t tr.dup td{background:var(--warn-soft)}
  .dv-t tr.new td{background:var(--ok-soft)}
  .dv-t tr.gone td{background:var(--bad-soft);text-decoration:line-through}
  .dv-t tr.g0 td:first-child{box-shadow:inset 4px 0 0 var(--p1)}.dv-t tr.g1 td:first-child{box-shadow:inset 4px 0 0 var(--p2)}.dv-t tr.g2 td:first-child{box-shadow:inset 4px 0 0 var(--p3)}
  .dv-t tr.g3 td:first-child{box-shadow:inset 4px 0 0 var(--p4)}.dv-t tr.g4 td:first-child{box-shadow:inset 4px 0 0 var(--p5)}.dv-t tr.g5 td:first-child{box-shadow:inset 4px 0 0 var(--p6)}
  .dv-t .dv-note{padding:6px 10px;font:12px/1.4 var(--f-body);color:var(--text-2);border-top:1px solid var(--border)}
  .dv-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px;align-items:start;min-width:0}
  .dv-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--text-2)}
  .dv-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}
  .dv-big{font:700 22px/1.15 var(--f-brand)}
  .dv-k{font:600 11px var(--f-mono);color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
  .qp{display:grid;gap:10px;min-width:0}
  .qp-sql{margin:0;padding:10px 12px;border-radius:10px;background:var(--code-bg);border:1px solid var(--border);font:12.5px/1.55 var(--f-mono);overflow:auto;white-space:pre}
  .qp-sql .ln{display:block;padding:0 6px;border-radius:5px;opacity:.55}
  .qp-sql .ln.on{opacity:1;background:color-mix(in srgb,var(--accent) 18%,transparent);box-shadow:inset 3px 0 0 var(--accent)}
  .qp-sql .ln.past{opacity:.9}
  .qp-steps{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .qp-steps button{border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);border-radius:999px;padding:4px 10px;font:600 11.5px var(--f-mono);cursor:pointer}
  .qp-steps button[aria-pressed="true"]{background:var(--accent);color:var(--accent-text);border-color:var(--accent)}
  .qp-steps button.past{color:var(--text);border-color:var(--border-strong)}
  .qp-steps .arr{color:var(--text-muted);font-size:11px}
  .qp-note{font-size:13.5px;line-height:1.5;padding:8px 12px;border-radius:10px;background:var(--surface-2);border-left:3px solid var(--accent)}
  .jv-svg text{font:12px var(--f-mono)}
  .fk-err{animation:dvShake .45s}
  @keyframes dvShake{0%,100%{transform:none}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
  .iv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:3px}
  .iv-c{font:600 10.5px/22px var(--f-mono);text-align:center;border-radius:5px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-2)}
  .iv-c.seen{background:var(--warn-soft);border-color:var(--warn)}
  .iv-c.hit{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
  .iv-c.mid{background:var(--info-soft);border-color:var(--info);color:var(--text)}
  .iv-c.off{opacity:.25}
  .sv-hist{max-height:200px;overflow:auto}
  .tx-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:8px}
  .tx-cards div{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);font-size:12.5px;line-height:1.4;color:var(--text-2)}
  .tx-cards b{display:block;font:700 13px var(--f-mono);color:var(--accent);margin-bottom:2px}
  .tx-steps{list-style:none;margin:0;padding:0;display:grid;gap:4px}
  .tx-steps button{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);opacity:.6;font-size:13px}
  .tx-steps button:focus-visible{outline:2px solid var(--accent)}
  .tx-steps button.past{opacity:1}.tx-steps button.on{opacity:1;border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface))}
  .tx-steps button.bad.past{border-left:4px solid var(--bad)}.tx-steps button.ok.past{border-left:4px solid var(--ok)}
  .tx-steps .n{font:700 12px var(--f-mono);color:var(--text-muted)}.tx-steps code{display:block;font-size:11.5px;color:var(--text-2);margin-top:1px}.tx-steps small{color:var(--text-muted);font-size:11px}
  .tx-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}
  .tx-pane{display:grid;gap:8px;align-content:start;padding:10px;border:1px dashed var(--border-strong);border-radius:12px;min-width:0}
  .tx-seats{display:flex;gap:5px;flex-wrap:wrap}
  .tx-seat{font:600 11px/26px var(--f-mono);min-width:40px;text-align:center;border-radius:7px 7px 3px 3px;border:1px solid var(--border-strong);background:var(--surface-2)}
  .tx-seat.sold{background:var(--bad-soft);border-color:var(--bad);color:var(--bad)}
  .tx-seat.held{background:var(--warn-soft);border:1.5px dashed var(--warn);color:var(--warn)}
  .dv-t tr.tx-p td{background:var(--warn-soft);border-top:1px dashed var(--warn);border-bottom:1px dashed var(--warn)}
  .dp{display:grid;gap:10px;min-width:0}
  .dp-keyline{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .dp-list{display:grid;gap:6px}
  .dp-dep{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;text-align:left;border:1px solid var(--border);border-left:4px solid var(--ok);border-radius:10px;padding:8px 12px;background:var(--surface-2);color:var(--text);font:13px/1.35 var(--f-body);cursor:pointer}
  .dp-dep.bad{border-left-color:var(--bad)}
  .dp-dep[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 12%,var(--surface));border-color:var(--accent);border-left-width:4px}
  .dp-dep .dp-side{font-family:var(--f-mono);font-size:12.5px}
  .dp-dep .dp-arr{color:var(--text-muted);font-size:12px}.dp-dep .dp-arr::after{content:' →'}
  .dp-dep .dp-badge{margin-left:auto;font-size:12px;font-weight:600;color:var(--ok)}.dp-dep.bad .dp-badge{color:var(--bad)}
  .dp-cols{display:flex;flex-wrap:wrap;gap:6px}
  .dp-chip{display:inline-grid;justify-items:center;gap:1px;padding:5px 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-2);font:600 12px var(--f-mono);color:var(--text)}
  .dp-chip small{font:500 10px var(--f-body);color:var(--text-muted)}
  .dp-chip.key{text-decoration:underline;text-underline-offset:3px;border-color:var(--accent)}
  .dp-chip.from{background:var(--info-soft);border-color:var(--info);box-shadow:0 0 0 2px color-mix(in srgb,var(--info) 30%,transparent)}
  .dp-chip.to.bad{background:var(--bad-soft);border-color:var(--bad)}.dp-chip.to.ok{background:var(--ok-soft);border-color:var(--ok)}
  .dp-chip.dim{opacity:.45}
  .t3 select{min-width:96px}
  .t3 .v-t{color:var(--ok);font-weight:700}.t3 .v-f{color:var(--bad);font-weight:700}.t3 .v-n{color:var(--warn);font-weight:700}
  </style>`);

  // ---------- маленькая таблица ----------
  // cfg: { name, sub, cols:[строка | {n, k:'PK'|'FK'|'PK FK'}], rows:[[…]], cells:{'r:c': cls}, rowCls:{r: cls} | fn(r,i), colCls:{c: cls}, note, max }
  const isNull = v => v === null || v === undefined;
  const cellText = v => isNull(v) ? 'NULL' : v === true ? 'true' : v === false ? 'false' : String(v);
  ui.dbt = cfg => {
    const cols = (cfg.cols || []).map(c => typeof c === 'string' ? { n: c } : c);
    const rows = cfg.rows || [], max = cfg.max || 999;
    const rc = (r, i) => typeof cfg.rowCls === 'function' ? cfg.rowCls(r, i) || '' : ((cfg.rowCls || {})[i] || '');
    const head = cols.map((c, j) => `<th class="${(cfg.colCls || {})[j] || ''}">${c.k ? c.k.split(' ').map(k => `<span class="k ${k === 'FK' ? 'fk' : ''}">${esc(k)}</span>`).join('') : ''}${esc(c.n)}</th>`).join('');
    const body = rows.slice(0, max).map((r, i) => `<tr class="${rc(r, i)}">${r.map((v, j) => {
      const cls = [(cfg.cells || {})[i + ':' + j] || '', (cfg.colCls || {})[j] || '', isNull(v) ? 'null' : ''].join(' ').trim();
      return `<td class="${cls}">${cfg.html ? (isNull(v) ? 'NULL' : v) : esc(cellText(v))}</td>`;
    }).join('')}</tr>`).join('');
    const more = rows.length > max ? `<tr><td colspan="${cols.length}" class="null">… ещё ${rows.length - max}</td></tr>` : '';
    return `<div class="dv-t">${cfg.name ? `<div class="dv-cap"><span>${esc(cfg.name)}</span>${cfg.sub ? `<small>${cfg.sub}</small>` : ''}</div>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}${more}${!rows.length ? `<tr><td colspan="${cols.length || 1}" class="null">пусто — 0 строк</td></tr>` : ''}</tbody></table>${cfg.note ? `<div class="dv-note">${cfg.note}</div>` : ''}</div>`;
  };
  ui.legend = items => `<div class="dv-legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;

  // ---------- учебный движок запроса ----------
  // Не парсер SQL: запрос описан данными рядом с его текстом, а движок честно выполняет шаги и показывает
  // промежуточные таблицы. Строки — объекты с ключами «алиас.столбец».
  // spec: { from:{t, a, cols, rows}, joins:[{type:'INNER'|'LEFT', t, a, cols, rows, on(L,R), text}],
  //         where:{fn(r) → true|false|null, text}, group:{by:[ключи], text}, having:{fn(rows) → bool, text, show:{as, agg(rows)}},
  //         select:[{as, fn(r)} | {as, agg(rows)}], distinct, order:{fn(a,b), text}, limit, sql:[{t, c:'FROM'|…}] }
  const TR_rel = TR.rel = {};
  const pref = (a, cols, row) => Object.fromEntries(cols.map((c, i) => [a + '.' + c, row[i]]));
  TR_rel.steps = spec => {
    const steps = [];
    const fromCols = spec.from.cols.map(c => spec.from.a + '.' + c);
    let cols = fromCols.slice();
    let rows = spec.from.rows.map((r, i) => Object.assign(pref(spec.from.a, spec.from.cols, r), { __src: i }));
    const tbl = (cs, rs, rowCls) => ({ cols: cs.map(c => c.replace(/^\w+\./, m => spec.short ? '' : m)), rows: rs.map(r => cs.map(c => r[c])), rowCls });
    steps.push({ c: 'FROM', t: `FROM ${spec.from.t}`, table: tbl(cols, rows), note: `Берём таблицу <b>${esc(spec.from.t)}</b> целиком: ${rows.length} ${TR.plural(rows.length, 'строка', 'строки', 'строк')}. Дальше всё работает с этим набором.` });
    (spec.joins || []).forEach(j => {
      const jc = j.cols.map(c => j.a + '.' + c), out = [], cnt = {};
      rows.forEach(L => {
        const hits = j.rows.filter(R => j.on(L, pref(j.a, j.cols, R)));
        if (hits.length) hits.forEach(R => out.push(Object.assign({}, L, pref(j.a, j.cols, R))));
        else if (j.type === 'LEFT') out.push(Object.assign({}, L, Object.fromEntries(jc.map(c => [c, null])), { __nul: true }));
      });
      out.forEach(r => { cnt[r.__src] = (cnt[r.__src] || 0) + 1; });
      cols = cols.concat(jc); rows = out;
      const dup = out.filter(r => cnt[r.__src] > 1).length, lost = new Set(out.map(r => r.__src)).size;
      const before = spec.from.rows.length;
      steps.push({
        c: 'JOIN', t: `${j.type} JOIN ${j.t} ON ${j.text}`, table: tbl(cols, out, (r, i) => out[i].__nul ? 'warn' : cnt[out[i].__src] > 1 ? 'dup' : ''),
        note: `${j.type === 'LEFT' ? 'LEFT JOIN оставляет каждую строку слева; где пары нет — справа NULL (жёлтым).' : 'INNER JOIN оставляет только строки, у которых нашлась пара.'} Было ${before}, стало ${rows.length}.${dup ? ` <b>${dup} ${TR.plural(dup, 'строка повторилась', 'строки повторились', 'строк повторились')}</b> — у строки слева несколько пар справа (размножение строк).` : ''}${j.type !== 'LEFT' && lost < before ? ` ${before - lost} ${TR.plural(before - lost, 'строка пропала', 'строки пропали', 'строк пропали')}: им не нашлось пары.` : ''}`
      });
    });
    if (spec.where) {
      const res = rows.map(r => spec.where.fn(r));
      const kept = rows.filter((r, i) => res[i] === true), unk = res.filter(x => x === null || x === undefined).length;
      steps.push({ c: 'WHERE', t: `WHERE ${spec.where.text}`, table: tbl(cols, rows, (r, i) => res[i] === true ? '' : (res[i] === false ? 'out' : 'unk')), note: `Проверяем условие для каждой строки. Остаются только те, где условие <b>истинно</b>: ${kept.length} из ${rows.length}.${unk ? ` ${unk} ${TR.plural(unk, 'строка', 'строки', 'строк')} с NULL дали «неизвестно» (волнистое зачёркивание) — WHERE их тоже выбрасывает.` : ''}` });
      rows = kept;
    }
    const aggSel = (spec.select || []).some(s => s.agg);
    let groups = null;
    if (spec.group || aggSel) {
      const by = spec.group ? spec.group.by : [];
      const map = new Map();
      rows.forEach(r => { const k = JSON.stringify(by.map(b => r[b])); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
      groups = [...map.values()];
      const order = []; groups.forEach((g, gi) => g.forEach(r => order.push([r, gi])));
      steps.push({ c: 'GROUP BY', t: spec.group ? `GROUP BY ${spec.group.text}` : '(без GROUP BY — все строки одна группа)', table: tbl(cols, order.map(x => x[0]), (r, i) => 'g' + (order[i][1] % 6)), note: spec.group ? `Раскладываем строки по группам: одинаковое значение <code>${esc(spec.group.text)}</code> — одна группа (цветная полоска слева). Групп: ${groups.length}. Дальше каждая группа станет одной строкой.` : `GROUP BY нет, но в SELECT есть агрегат — значит, все ${rows.length} ${TR.plural(rows.length, 'строка', 'строки', 'строк')} образуют одну группу и дадут одну строку результата.` });
      if (spec.having) {
        const show = (spec.select || []).concat(spec.having.show ? [spec.having.show] : []).filter((s, i, a) => a.findIndex(x => x.as === s.as) === i);
        const hres = groups.map(g => spec.having.fn(g));
        steps.push({ c: 'HAVING', t: `HAVING ${spec.having.text}`, table: { cols: show.map(s => s.as), rows: groups.map(g => show.map(s => s.agg ? s.agg(g) : s.fn(g[0]))), rowCls: (r, i) => hres[i] ? '' : 'out' }, note: `HAVING — фильтр по <b>группам</b>, уже после подсчёта. Остаются группы, где условие истинно: ${hres.filter(Boolean).length} из ${groups.length}. В WHERE так нельзя: там групп ещё нет.` });
        groups = groups.filter((g, i) => hres[i]);
      }
    }
    // SELECT
    let out;
    if (groups) out = groups.map(g => (spec.select || []).map(s => s.agg ? s.agg(g) : s.fn(g[0])));
    else out = rows.map(r => (spec.select || []).map(s => s.fn(r)));
    const scols = (spec.select || []).map(s => s.as);
    let dupNote = '';
    if (spec.distinct) { const seen = new Set(), before = out.length; out = out.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); dupNote = ` DISTINCT убрал повторы: было ${before}, стало ${out.length}.`; }
    steps.push({ c: 'SELECT', t: 'SELECT ' + scols.join(', '), table: { cols: scols, rows: out }, note: `Только теперь считаются столбцы из SELECT${groups ? ' — по одной строке на группу' : ''}. Поэтому псевдоним из SELECT нельзя использовать в WHERE: на шаге WHERE его ещё нет.${dupNote}` });
    if (spec.order) {
      const idx = out.map((r, i) => i).sort((a, b) => spec.order.fn(Object.fromEntries(scols.map((c, k) => [c, out[a][k]])), Object.fromEntries(scols.map((c, k) => [c, out[b][k]]))));
      out = idx.map(i => out[i]);
      steps.push({ c: 'ORDER BY', t: `ORDER BY ${spec.order.text}`, table: { cols: scols, rows: out }, note: 'Сортируем готовый результат. Здесь псевдонимы из SELECT уже доступны.' });
    }
    if (spec.limit != null) {
      const n = spec.limit;
      steps.push({ c: 'LIMIT', t: `LIMIT ${n}`, table: { cols: scols, rows: out, rowCls: (r, i) => i < n ? 'new' : 'out' }, note: `Берём первые ${n} ${TR.plural(n, 'строку', 'строки', 'строк')} — после сортировки. Без ORDER BY «первые» — какие попало.` });
      out = out.slice(0, n);
    }
    return { steps, result: { cols: scols, rows: out } };
  };

  // ---------- проигрыватель шагов запроса ----------
  // cfg: { sql:[{t:'строка запроса', c:'FROM'|'JOIN'|'WHERE'|'GROUP BY'|'HAVING'|'SELECT'|'ORDER BY'|'LIMIT'}], spec, start:'all'|0, title }
  ui.qplay = (el, cfg) => {
    const run = TR.rel.steps(cfg.spec), steps = run.steps;
    let k = cfg.start === 0 ? 0 : steps.length - 1, timer = null;
    const ORDER = ['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'LIMIT'];
    function draw() {
      const cur = steps[k], seenC = new Set(steps.slice(0, k + 1).map(s => s.c));
      el.innerHTML = `<div class="qp">${cfg.title ? `<div class="dv-k">${esc(cfg.title)}</div>` : ''}
        <pre class="qp-sql">${(cfg.sql || []).map(l => `<span class="ln ${l.c === cur.c ? 'on' : seenC.has(l.c) ? 'past' : ''}">${ui.hl(l.t, 'sql')}</span>`).join('')}</pre>
        <div class="qp-steps" role="group" aria-label="Шаги выполнения">${steps.map((s, i) => `${i ? '<span class="arr">→</span>' : ''}<button type="button" data-qs="${i}" aria-pressed="${i === k}" class="${i < k ? 'past' : ''}">${i + 1}. ${esc(s.c)}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn sm" data-qa="prev" ${k === 0 ? 'disabled' : ''}>← Шаг</button><button type="button" class="btn sm primary" data-qa="play">${timer ? '⏸ Пауза' : '▶ Проиграть с начала'}</button><button type="button" class="btn sm" data-qa="next" ${k === steps.length - 1 ? 'disabled' : ''}>Шаг →</button><span class="small dim">Порядок выполнения: ${steps.map(s => s.c).join(' → ')}</span></div>
        <div class="qp-note">${cur.note}</div>
        ${ui.dbt({ name: cur.t, cols: cur.table.cols, rows: cur.table.rows, rowCls: cur.table.rowCls, max: 40 })}
      </div>`;
    }
    function stop() { clearInterval(timer); timer = null; }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-qs],[data-qa]'); if (!b || !el.contains(b)) return;
      if (b.dataset.qs != null) { stop(); k = +b.dataset.qs; draw(); return; }
      const a = b.dataset.qa;
      if (a === 'prev') { stop(); k = Math.max(0, k - 1); }
      if (a === 'next') { stop(); k = Math.min(steps.length - 1, k + 1); }
      if (a === 'play') { if (timer) stop(); else { k = 0; timer = setInterval(() => { if (k >= steps.length - 1) { stop(); draw(); return; } k++; draw(); }, 1700); } }
      draw();
    });
    draw();
    void ORDER;
    return { result: run.result, steps };
  };

  // ---------- JOIN построчно ----------
  // cfg: { L:{name, cols, rows, key}, R:{name, cols, rows, key}, type, types:[…]|false, onType(t), note }
  ui.joinViz = (el, cfg) => {
    let type = cfg.type || 'INNER';
    const id = 'jv' + (++uid);
    function draw() {
      const L = cfg.L, R = cfg.R, RH = 24, HEAD = 30, CW = 92;
      const lw = L.cols.length * CW, rw = R.cols.length * CW, GAP = 110, W = lw + GAP + rw, H = HEAD + Math.max(L.rows.length, R.rows.length) * RH + 8;
      const lMatch = L.rows.map(l => R.rows.map((r, j) => (!isNull(l[L.key]) && l[L.key] === r[R.key]) ? j : -1).filter(j => j >= 0));
      const rMatched = new Set(lMatch.flat());
      const keep = { INNER: [true, false, false], LEFT: [true, true, false], RIGHT: [true, false, true], FULL: [true, true, true] }[type];
      let s = `<svg class="jv-svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;min-width:${Math.min(W, 520)}px" role="img" aria-label="${esc(type)} JOIN ${esc(L.name)} и ${esc(R.name)}">`;
      const tableSvg = (T, x0, side) => {
        let t = `<text x="${x0}" y="14" style="fill:var(--text);font-weight:700">${esc(T.name)}</text>`;
        T.cols.forEach((c, j) => { t += `<text x="${x0 + j * CW + 6}" y="${HEAD - 4}" style="fill:var(--text-muted);font-size:11px">${esc(c)}</text>`; });
        T.rows.forEach((r, i) => {
          const y = HEAD + i * RH, matched = side === 'L' ? lMatch[i].length > 0 : rMatched.has(i);
          const kept = matched || (side === 'L' ? keep[1] : keep[2]);
          t += `<rect x="${x0}" y="${y + 2}" width="${T.cols.length * CW}" height="${RH - 4}" rx="5" style="fill:${matched ? 'color-mix(in srgb, var(--accent) 16%, var(--surface))' : kept ? 'var(--warn-soft)' : 'var(--surface-2)'};stroke:${matched ? 'var(--accent)' : kept ? 'var(--warn)' : 'var(--border)'};${kept ? '' : 'opacity:.5'}"/>`;
          r.forEach((v, j) => { t += `<text x="${x0 + j * CW + 6}" y="${y + RH / 2 + 4}" style="fill:${isNull(v) ? 'var(--text-muted)' : 'var(--text)'};${j === T.key ? 'font-weight:700' : ''}${kept ? '' : ';opacity:.5'}">${esc(cellText(v))}</text>`; });
        });
        return t;
      };
      s += tableSvg(L, 0, 'L') + tableSvg(R, lw + GAP, 'R');
      lMatch.forEach((js, i) => js.forEach(j => { const y1 = HEAD + i * RH + RH / 2, y2 = HEAD + j * RH + RH / 2; s += `<path d="M${lw + 2} ${y1} C${lw + GAP / 2} ${y1} ${lw + GAP / 2} ${y2} ${lw + GAP - 2} ${y2}" style="fill:none;stroke:var(--accent);stroke-width:1.8"/>`; }));
      s += '</svg>';
      // результат
      const rows = [], cls = [];
      L.rows.forEach((l, i) => { if (lMatch[i].length) lMatch[i].forEach(j => { rows.push(l.concat(R.rows[j])); cls.push(lMatch[i].length > 1 ? 'dup' : ''); }); else if (keep[1]) { rows.push(l.concat(R.cols.map(() => null))); cls.push('warn'); } });
      if (keep[2]) R.rows.forEach((r, j) => { if (!rMatched.has(j)) { rows.push(L.cols.map(() => null).concat(r)); cls.push('warn'); } });
      const lostL = L.rows.filter((l, i) => !lMatch[i].length).length, lostR = R.rows.length - rMatched.size, dup = cls.filter(c => c === 'dup').length;
      el.innerHTML = `<div class="stack">${cfg.types === false ? '' : ui.seg('jt', (cfg.types || ['INNER', 'LEFT', 'RIGHT', 'FULL']).map(t => ({ v: t, t: t + ' JOIN' })), type)}
        <div style="overflow:auto">${s}</div>
        ${ui.legend([['var(--accent)', 'нашлась пара (линия)'], ['var(--warn)', 'пары нет, но строка остаётся — другая сторона NULL'], ['var(--surface-3)', 'пары нет — строка выпадает']])}
        ${ui.dbt({ name: `Результат ${type} JOIN — ${rows.length} ${TR.plural(rows.length, 'строка', 'строки', 'строк')}`, cols: L.cols.map(c => L.short + '.' + c).concat(R.cols.map(c => R.short + '.' + c)), rows, rowCls: (r, i) => cls[i] })}
        <div class="qp-note">${type === 'INNER' ? `INNER: только пары. Без пары выпали слева ${lostL}, справа ${lostR}.` : type === 'LEFT' ? `LEFT: все строки «${esc(L.name)}» остаются; у ${lostL} без пары справа NULL.` : type === 'RIGHT' ? `RIGHT: все строки «${esc(R.name)}» остаются; у ${lostR} без пары слева NULL.` : `FULL: остаются все строки с обеих сторон; без пары — NULL на другой стороне.`}${dup ? ` Строки с жёлтым фоном повторились: у одной строки слева несколько пар справа — так JOIN размножает строки, и SUM по левой таблице после него завышается.` : ''}${cfg.note ? ' ' + cfg.note : ''}</div></div>`;
      void id;
    }
    ui.onSeg(el, (n, v) => { type = v; draw(); cfg.onType && cfg.onType(v); });
    draw();
    return { set: t => { type = t; draw(); } };
  };

  // ---------- внешний ключ при удалении ----------
  // cfg: { parent:{name, cols, rows}, child:{name, cols, rows, fk}, del: индекс строки родителя, mode, modes, title }
  ui.fkViz = (el, cfg) => {
    let mode = cfg.mode || 'RESTRICT', done = false;
    const MODES = cfg.modes || ['RESTRICT', 'CASCADE', 'SET NULL'];
    function draw() {
      const P = cfg.parent, C = cfg.child, pid = P.rows[cfg.del][0];
      const refs = C.rows.map((r, i) => r[C.fk] === pid ? i : -1).filter(i => i >= 0);
      let pCls = {}, cRows = C.rows.map(r => r.slice()), cCls = {}, note = '', err = false;
      refs.forEach(i => { cCls[i] = 'warn'; });
      pCls[cfg.del] = 'warn';
      if (done) {
        if (mode === 'CASCADE') { pCls[cfg.del] = 'gone'; refs.forEach(i => { cCls[i] = 'gone'; }); note = `CASCADE: удалилась строка «${esc(cellText(P.rows[cfg.del][1]))}» и вместе с ней ${refs.length} ${TR.plural(refs.length, 'зависимая строка', 'зависимые строки', 'зависимых строк')} в <b>${esc(C.name)}</b>. Удобно для «частей целого», опасно для истории: она исчезает молча.`; }
        if (mode === 'SET NULL') { pCls[cfg.del] = 'gone'; refs.forEach(i => { cRows[i][C.fk] = null; cCls[i] = 'info'; }); note = `SET NULL: родитель удалён, у ${refs.length} ${TR.plural(refs.length, 'строки', 'строк', 'строк')} в <b>${esc(C.name)}</b> ссылка стала NULL. Сами строки живы — история сохранилась, но «чья» она, уже не узнать. Поле внешнего ключа должно допускать NULL.`; }
        if (mode === 'RESTRICT' || mode === 'NO ACTION') { err = true; note = refs.length ? `<b>Ошибка: нарушен внешний ключ.</b> На строку ссылаются ${refs.length} ${TR.plural(refs.length, 'строка', 'строки', 'строк')} в ${esc(C.name)} — база отказывается удалять. Сначала разберитесь с зависимыми данными (или не удаляйте, а помечайте неактивной).` : 'Ссылок нет — RESTRICT разрешает удаление.'; if (!refs.length) pCls[cfg.del] = 'gone'; }
      } else note = `Удаляем строку <b>${esc(cellText(P.rows[cfg.del][1]))}</b> (id ${esc(cellText(pid))}) из <b>${esc(P.name)}</b>. На неё ссылаются ${refs.length} ${TR.plural(refs.length, 'строка', 'строки', 'строк')} в ${esc(C.name)} (жёлтые). Что сделает база при ON DELETE ${mode}?`;
      el.innerHTML = `<div class="stack">${cfg.title ? `<div class="dv-k">${esc(cfg.title)}</div>` : ''}
        <div class="row">${ui.seg('fm', MODES.map(m => ({ v: m, t: 'ON DELETE ' + m })), mode)}</div>
        <div class="dv-row"><div class="${err ? 'fk-err' : ''}">${ui.dbt({ name: P.name, cols: P.cols, rows: P.rows, rowCls: (r, i) => pCls[i] === 'gone' ? 'gone' : '', cells: pCls[cfg.del] === 'warn' ? Object.fromEntries(P.cols.map((c, j) => [cfg.del + ':' + j, 'warn'])) : {} })}</div>
        ${ui.dbt({ name: C.name, cols: C.cols, rows: cRows, rowCls: (r, i) => cCls[i] === 'gone' ? 'gone' : '', cells: Object.fromEntries(Object.entries(cCls).filter(([, v]) => v !== 'gone').map(([i, v]) => [i + ':' + C.fk, v])) })}</div>
        <div class="row"><button type="button" class="btn sm ${done ? '' : 'primary'}" data-fk="del" ${done ? 'disabled' : ''}>Удалить строку</button><button type="button" class="btn sm ghost" data-fk="reset" ${done ? '' : 'disabled'}>⟲ Вернуть</button></div>
        <div class="qp-note" ${err ? 'style="border-left-color:var(--bad)"' : ''}>${note}</div></div>`;
    }
    ui.onSeg(el, (n, v) => { mode = v; done = false; draw(); });
    TR.on(el, 'click', '[data-fk]', (e, b) => { done = b.dataset.fk === 'del'; draw(); });
    draw();
  };

  // ---------- аномалии ----------
  // cfg: { flat:{name, cols, rows}, split:[{name, cols, rows}], ops:[{id, t, flat:{cells:[], rows:{r:cls}}, split:[{cells:[], rows:{}}], note}], op }
  // add — строки, которые операция добавляет (зелёные); rows — классы строк (gone — удалена)
  const withAdd = (t, o, cellsOf) => { const add = o.add || [], base = t.rows.length, rc = Object.assign({}, o.rows || {}); add.forEach((r, k) => { rc[base + k] = rc[base + k] || 'new'; }); return ui.dbt({ name: t.name, cols: t.cols, rows: t.rows.concat(add), cells: cellsOf(o.cells), rowCls: rc }); };
  ui.anomalyViz = (el, cfg) => {
    let op = cfg.op || cfg.ops[0].id;
    function draw() {
      const o = cfg.ops.find(x => x.id === op);
      const cellsOf = arr => Object.fromEntries((arr || []).map(k => Array.isArray(k) ? [k[0], k[1]] : [k, 'bad']));
      const nFlat = (o.flat.cells || []).length, nSplit = (o.split || []).reduce((s, x) => s + ((x && x.cells) || []).length, 0);
      el.innerHTML = `<div class="stack">${ui.seg('an', cfg.ops.map(x => ({ v: x.id, t: x.t })), op)}
        <div class="dv-row" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
          <div class="stack tight"><div class="dv-k">Одна таблица (как в Excel) · ${o.flat.count || (nFlat ? nFlat + ' ' + TR.plural(nFlat, 'ячейка', 'ячейки', 'ячеек') : '')}</div>${withAdd(cfg.flat, o.flat, cellsOf)}</div>
          <div class="stack tight"><div class="dv-k">После нормализации · ${o.splitCount || (nSplit ? nSplit + ' ' + TR.plural(nSplit, 'ячейка', 'ячейки', 'ячеек') : '')}</div>${cfg.split.map((t, i) => withAdd(t, (o.split && o.split[i]) || {}, cellsOf)).join('')}</div>
        </div><div class="qp-note">${o.note}</div></div>`;
    }
    ui.onSeg(el, (n, v) => { op = v; draw(); });
    draw();
  };

  // ---------- вороньи лапки словами ----------
  const PH = { '1': 'ровно один', '0..1': 'ноль или один', '1..N': 'один или много', '0..N': 'ноль, один или много' };
  ui.cardPhrase = c => PH[c] || c;
  // cfg: { A:'Кинотеатр', B:'Зал', ca, cb, aOf:'у одного кинотеатра', bOf:'у одного зала', aW:'кинотеатров', bW:'залов', mine:{ca,cb}, why }
  // ca — сколько A у одного B (у конца A), cb — сколько B у одного A (у конца B).
  ui.crowRead = (el, cfg) => {
    const er = (box, ca, cb, tone) => ui.er(box, { entities: [{ id: 'a', t: cfg.A, x: 4, y: 14, w: 116 }, { id: 'b', t: cfg.B, x: 206, y: 14, w: 116 }], rels: [{ a: 'a', b: 'b', ca, cb, t: cfg.verb || '', tone }], width: 326, height: 76, title: cfg.A + ' — ' + cfg.B });
    const say = (ca, cb) => `<div class="small">${ui.cap(cfg.aOf)}: ${esc(cfg.bW)} — <b>${PH[cb]}</b>.<br>${ui.cap(cfg.bOf)}: ${esc(cfg.aW)} — <b>${PH[ca]}</b>.</div>`;
    const mine = cfg.mine && (cfg.mine.ca !== cfg.ca || cfg.mine.cb !== cfg.cb) && cfg.mine.ca && cfg.mine.cb ? cfg.mine : null;
    el.innerHTML = `<div class="dv-row">${mine ? `<div class="stack tight"><div class="dv-k" style="color:var(--bad)">Ваш вариант</div><div data-m></div>${say(mine.ca, mine.cb)}</div>` : ''}
      <div class="stack tight"><div class="dv-k" style="color:var(--ok)">${mine ? 'Как верно' : 'Как читается'}</div><div data-r></div>${say(cfg.ca, cfg.cb)}</div></div>${cfg.why ? `<div class="qp-note">${cfg.why}</div>` : ''}`;
    if (mine) er(TR.$('[data-m]', el), mine.ca, mine.cb, 'bad');
    er(TR.$('[data-r]', el), cfg.ca, cfg.cb, 'ok');
  };

  // ---------- индекс ----------
  // cfg: { n, target, label }
  ui.indexViz = (el, cfg) => {
    const n = cfg.n || 48, rnd = TR.rand('iv' + n);
    const vals = Array.from({ length: n }, (_, i) => 100 + i * 7);
    const heap = TR.shuffle(vals, 'heap' + n);
    const target = cfg.target != null ? cfg.target : vals[Math.floor(rnd() * n)];
    let mode = 'scan', pos = -1, timer = null, lo = 0, hi = n - 1, mids = [], found = false;
    function reset() { clearInterval(timer); timer = null; pos = -1; lo = 0; hi = n - 1; mids = []; found = false; }
    function tick() {
      if (mode === 'scan') { pos++; if (heap[pos] === target || pos >= n - 1) { found = heap[pos] === target; clearInterval(timer); timer = null; } }
      else { if (lo > hi) { clearInterval(timer); timer = null; return; } const m = (lo + hi) >> 1; mids.push(m); if (vals[m] === target) { found = true; clearInterval(timer); timer = null; } else if (vals[m] < target) lo = m + 1; else hi = m - 1; }
      draw();
    }
    function draw() {
      const reads = mode === 'scan' ? pos + 1 : mids.length;
      const cells = mode === 'scan'
        ? heap.map((v, i) => `<div class="iv-c ${i < pos ? 'seen' : ''} ${i === pos ? (v === target ? 'hit' : 'seen') : ''}">${v}</div>`).join('')
        : vals.map((v, i) => { const isMid = mids.includes(i), last = mids[mids.length - 1] === i; const off = mids.length && !found && (i < lo || i > hi) && !isMid; return `<div class="iv-c ${isMid ? (last && found ? 'hit' : 'mid') : ''} ${off ? 'off' : ''}">${v}</div>`; }).join('');
      el.innerHTML = `<div class="stack">${ui.seg('iv', [{ v: 'scan', t: 'Без индекса — полный просмотр' }, { v: 'idx', t: 'С индексом — поиск по дереву' }], mode)}
        <div class="row between"><span class="small">Ищем ${esc(cfg.label || 'значение')} = <b class="mono">${target}</b> среди ${n} строк</span><span class="dv-big tnum" style="color:${mode === 'scan' ? 'var(--warn)' : 'var(--accent)'}">прочитано: ${reads}</span></div>
        <div class="iv-grid">${cells}</div>
        <div class="row"><button type="button" class="btn sm primary" data-iv="go">${timer ? '⏸ Пауза' : '▶ Искать'}</button><button type="button" class="btn sm ghost" data-iv="reset">⟲ Сначала</button></div>
        <div class="qp-note">${mode === 'scan' ? 'Строки в таблице лежат в порядке вставки. Без индекса база читает их подряд, пока не найдёт, — а если значение может повторяться, дочитывает до конца. На миллионе строк это миллион чтений.' : 'Индекс — отдельная отсортированная структура (B-дерево) со ссылками на строки. Поиск каждый раз отбрасывает половину оставшегося: на 48 значениях хватает ~6 шагов, на миллионе — ~20. Плата: место на диске и замедление каждой вставки и изменения — индекс тоже надо обновлять.'}</div></div>`;
    }
    ui.onSeg(el, (nm, v) => { mode = v; reset(); draw(); });
    TR.on(el, 'click', '[data-iv]', (e, b) => {
      if (b.dataset.iv === 'reset') { reset(); draw(); return; }
      if (timer) { clearInterval(timer); timer = null; draw(); return; }
      if (found || (mode === 'scan' && pos >= n - 1)) reset();
      timer = setInterval(tick, mode === 'scan' ? 140 : 650); tick();
    });
    draw();
  };

  // ---------- статусная модель ----------
  // cfg: { states:[{id, t, x, y, end}], trans:[{from, to, t}], start, entity, highlight:[{from,to,cls}] }
  ui.stateViz = (el, cfg) => {
    let cur = cfg.start, hist = [{ st: cfg.start, at: '10:00', by: 'система' }];
    const W = cfg.width || 640, H = cfg.height || 220, BW = 120, BH = 38;
    const pos = id => cfg.states.find(s => s.id === id);
    function draw() {
      const id = 'sv' + (++uid);
      let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;min-width:${Math.min(W, 480)}px" role="img" aria-label="Статусная модель"><defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--text-2)"/></marker><marker id="${id}-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--bad)"/></marker></defs>`;
      cfg.trans.forEach(t => {
        const a = pos(t.from), b = pos(t.to); if (!a || !b) return;
        const ax = a.x + BW / 2, ay = a.y + BH / 2, bx = b.x + BW / 2, by = b.y + BH / 2;
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const k = Math.min(Math.abs((BW / 2 + 4) / (dx / len || 1e-9)), Math.abs((BH / 2 + 4) / (dy / len || 1e-9)));
        const x1 = ax + dx / len * k, y1 = ay + dy / len * k, x2 = bx - dx / len * k, y2 = by - dy / len * k;
        const bad = t.bad, can = t.from === cur && !bad;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:${bad ? 'var(--bad)' : can ? 'var(--accent)' : 'var(--text-2)'};stroke-width:${can ? 2.4 : 1.4};${bad ? 'stroke-dasharray:5 4;' : ''}" marker-end="url(#${id}-${bad ? 'b' : 'a'})"/>`;
        if (t.t) s += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 5}" text-anchor="middle" style="fill:${bad ? 'var(--bad)' : 'var(--text-muted)'};font-size:10.5px;paint-order:stroke;stroke:var(--surface);stroke-width:4px">${esc(t.t)}</text>`;
      });
      cfg.states.forEach(st => {
        const on = st.id === cur;
        s += `<rect x="${st.x}" y="${st.y}" width="${BW}" height="${BH}" rx="${st.end ? 19 : 9}" style="fill:${on ? 'var(--accent)' : 'var(--surface-2)'};stroke:${on ? 'var(--accent)' : 'var(--border-strong)'};stroke-width:${st.end ? 2.5 : 1.2}"/>`;
        s += `<text x="${st.x + BW / 2}" y="${st.y + 16}" text-anchor="middle" style="fill:${on ? 'var(--accent-text)' : 'var(--text)'};font:600 12px var(--f-mono)">${esc(st.id)}</text><text x="${st.x + BW / 2}" y="${st.y + 30}" text-anchor="middle" style="fill:${on ? 'var(--accent-text)' : 'var(--text-muted)'};font-size:10.5px">${esc(st.t)}</text>`;
      });
      s += '</svg>';
      const next = cfg.trans.filter(t => t.from === cur && !t.bad);
      el.innerHTML = `<div class="stack"><div style="overflow:auto">${s}</div>
        <div class="row">${next.length ? next.map(t => `<button type="button" class="btn sm" data-sv="${esc(t.to)}">${esc(t.t || t.to)} → ${esc(t.to)}</button>`).join('') : '<span class="small dim">Конечный статус: переходов дальше нет.</span>'}<button type="button" class="btn sm ghost" data-sv="">⟲ Сначала</button></div>
        <div class="dv-row" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))">
          ${ui.dbt({ name: (cfg.entity || 'orders') + ' — текущее', cols: ['id', 'status'], rows: [[1042, cur]], cells: { '0:1': 'hl' } })}
          <div class="sv-hist">${ui.dbt({ name: (cfg.entity || 'orders') + '_status_history — история', cols: ['order_id', 'status', 'changed_at', 'changed_by'], rows: hist.map(h => [1042, h.st, h.at, h.by]), rowCls: (r, i) => i === hist.length - 1 && hist.length > 1 ? 'new' : '' })}</div>
        </div>
        <div class="qp-note">В основной таблице — только текущий статус, его удобно фильтровать. Каждый переход — новая строка в таблице истории: когда, кто, из какого в какой. Без истории на вопрос «почему заказ отменён и кем» ответа нет.${cfg.note ? ' ' + cfg.note : ''}</div></div>`;
    }
    TR.on(el, 'click', '[data-sv]', (e, b) => {
      if (!b.dataset.sv) { cur = cfg.start; hist = [{ st: cfg.start, at: '10:00', by: 'система' }]; draw(); return; }
      cur = b.dataset.sv; const m = 2 + hist.length * 3;
      hist.push({ st: cur, at: `10:${String(m).padStart(2, '0')}`, by: cfg.who ? cfg.who(cur) : 'приложение' }); draw();
    });
    draw();
  };

  // ---------- функциональные зависимости ----------
  // Не стрелки, а разбор по одной зависимости: кнопка «X → Y» с вердиктом, подсветка столбцов «определяет / зависит»
  // и — если даны строки — таблица, где видно, какие значения из-за этой зависимости повторяются.
  // Возвращает HTML (годится и для картинки к ответу); нажатия обрабатывает общий обработчик ниже.
  // cfg: { cols:[{n, key}], deps:[{from:[i], to:[j], bad, t, why}], rows:[[…]], title }
  const DEPS = new Map();
  const depHTML = (id, sel) => {
    const cfg = DEPS.get(id), d = cfg.deps[sel], tone = d.bad ? 'bad' : 'ok';
    const name = i => cfg.cols[i].n, keys = cfg.cols.map((c, i) => c.key ? i : -1).filter(i => i >= 0);
    const role = i => d.from.includes(i) ? 'from' : d.to.includes(i) ? 'to' : '';
    // строки с одинаковым определяющим значением: из-за них зависимое значение повторяется
    let groups = [], rowCls = {}, cells = {};
    if (cfg.rows) {
      const by = new Map();
      cfg.rows.forEach((r, ri) => { const k = JSON.stringify(d.from.map(i => r[i])); if (!by.has(k)) by.set(k, []); by.get(k).push(ri); });
      groups = [...by.values()].filter(g => g.length > 1);
      cfg.rows.forEach((r, ri) => { d.from.forEach(i => { cells[ri + ':' + i] = 'info'; }); d.to.forEach(i => { cells[ri + ':' + i] = d.bad && groups.some(g => g.includes(ri)) ? 'bad' : tone === 'ok' ? 'ok' : ''; }); });
      groups.forEach((g, gi) => g.forEach(ri => { rowCls[ri] = 'g' + (gi % 6); }));
    }
    const big = groups.length ? groups.reduce((a, g) => g.length > a.length ? g : a, groups[0]) : null;
    const rep = big && d.bad ? `В примере «${esc(d.from.map(i => cfg.rows[big[0]][i]).join(' + '))}» встречается в ${big.length} строках — и ${esc(d.to.map(name).join(', '))} ${d.to.length > 1 ? 'записаны' : 'записан'} ${big.length} раза. Поменять — значит править все эти строки.` : '';
    const verdict = d.bad ? (d.t || 'не от ключа') : (d.t || 'от всего ключа — так и надо');
    return `<div class="dp-keyline"><span class="dv-k">Ключ строки</span>${keys.map(i => `<span class="dp-chip key">${esc(name(i))}</span>`).join('<span class="dim">+</span>')}</div>
      <div class="dp-list" role="group" aria-label="Зависимости">${cfg.deps.map((x, k) => `<button type="button" class="dp-dep ${x.bad ? 'bad' : 'ok'}" data-depsel="${k}" aria-pressed="${k === sel}"><span class="dp-side">${x.from.map(i => `<b>${esc(name(i))}</b>`).join(' + ')}</span><span class="dp-arr">определяет</span><span class="dp-side">${x.to.map(i => esc(name(i))).join(', ')}</span><span class="dp-badge">${x.bad ? '✗ ' : '✓ '}${esc(x.bad ? (x.t || 'не от ключа') : (x.t || 'от ключа'))}</span></button>`).join('')}</div>
      <div class="dp-cols">${cfg.cols.map((c, i) => `<span class="dp-chip ${c.key ? 'key' : ''} ${role(i)} ${role(i) === 'to' ? tone : ''} ${role(i) ? '' : 'dim'}">${esc(c.n)}${role(i) === 'from' ? '<small>определяет</small>' : role(i) === 'to' ? '<small>зависит</small>' : ''}</span>`).join('')}</div>
      ${cfg.rows ? ui.dbt({ name: cfg.title || 'Пример строк', cols: cfg.cols.map(c => c.n), rows: cfg.rows, cells, rowCls }) : ''}
      <div class="qp-note" style="border-left-color:var(--${tone})"><b>${esc(d.to.map(name).join(', '))} ${d.to.length > 1 ? 'зависят' : 'зависит'} от ${esc(d.from.map(name).join(' + '))}: ${esc(verdict)}.</b> ${d.why || (d.bad ? 'Этот факт описывает не строку таблицы целиком, поэтому повторяется в каждой строке с тем же значением — его выносят в отдельную таблицу.' : 'Значение описывает именно эту строку — повторов нет.')} ${rep}</div>`;
  };
  ui.depViz = cfg => {
    const id = 'dp' + (++uid);
    DEPS.set(id, cfg);
    const sel = Math.max(0, cfg.deps.findIndex(d => d.bad));
    return `<div class="dp" data-depviz="${id}">${depHTML(id, sel)}</div>`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-depsel]'); if (!b) return;
    const box = b.closest('[data-depviz]'); if (!box || !DEPS.has(box.dataset.depviz)) return;
    box.innerHTML = depHTML(box.dataset.depviz, +b.dataset.depsel);
  });

  // ---------- транзакция: что лежит в базе после каждого шага ----------
  // Слева — что видит само приложение (черновик транзакции жёлтым), справа — что в ту же секунду видит кассир.
  // cfg: { scenarios:[{ v, t, steps:[{ t, sql, who:'app'|'bank', kind, op(S), note }] }], start, onEnd(v) }
  // op меняет состояние S: S.begin(), S.ins(table, row), S.set(table, id, row), S.rollback(), S.commit()
  const TX_COLS = { orders: ['id', 'status'], ticket: ['id', 'order_id', 'seat'], payment: ['order_id', 'amount', 'status'] };
  const txState = () => {
    const S = { tx: false, last: null, rows: { orders: [], ticket: [], payment: [] } };
    S.begin = () => { S.tx = true; S.last = 'begin'; };
    S.ins = (t, row) => { S.rows[t].push({ d: row, p: S.tx }); };
    S.set = (t, id, row) => { const r = S.rows[t].find(x => x.d[0] === id); if (r) { r.old = r.p ? r.old : r.d; r.d = row; r.p = S.tx; } };
    S.rollback = () => { Object.keys(S.rows).forEach(t => { S.rows[t] = S.rows[t].filter(r => !r.p || r.old).map(r => r.p ? { d: r.old, p: false } : r); }); S.tx = false; S.last = 'rollback'; };
    S.commit = () => { Object.keys(S.rows).forEach(t => S.rows[t].forEach(r => { r.p = false; delete r.old; })); S.tx = false; S.last = 'commit'; };
    return S;
  };
  ui.txViz = (el, cfg) => {
    let v = cfg.start || cfg.scenarios[0].v, k = 0, timer = null;
    const sc = () => cfg.scenarios.find(x => x.v === v);
    const stateAt = n => { const S = txState(); sc().steps.slice(0, n).forEach(st => { S.last = null; st.op && st.op(S); }); return S; };
    const seats = (S, mine) => { const sold = new Set(), held = new Set(); S.rows.ticket.forEach(r => { if (!r.p) sold.add(r.d[2]); else if (mine) held.add(r.d[2]); }); return `<div class="tx-seats">${[410, 411, 412, 413, 414, 415].map(n => `<span class="tx-seat ${sold.has(n) ? 'sold' : held.has(n) ? 'held' : ''}" title="место ${n}">${n}</span>`).join('')}</div>`; };
    // приложение видит свои черновые строки; кассир — только сохранённое (для изменённой в черновике строки — старую версию)
    const tables = (S, mine) => Object.keys(TX_COLS).map(t => {
      const list = mine ? S.rows[t] : S.rows[t].map(r => !r.p ? r : r.old ? { d: r.old, p: false } : null).filter(Boolean);
      return ui.dbt({ name: t, cols: TX_COLS[t], rows: list.map(r => r.d), rowCls: (r, i) => list[i].p ? 'tx-p' : '' });
    }).join('');
    function draw() {
      const steps = sc().steps, S = stateAt(k), cur = steps[k - 1];
      const status = S.last === 'rollback' ? ['ok', 'ROLLBACK: черновик выброшен целиком — в базе ничего не изменилось'] : S.last === 'commit' ? ['ok', 'COMMIT: черновик сохранён — теперь это видят все и навсегда'] : S.tx ? ['warn', 'Транзакция открыта: всё, что меняем, — черновик. Его видит только это приложение'] : v === 'no' && k > 0 ? ['bad', 'Транзакции нет: каждая команда сохраняется сразу и навсегда'] : ['', 'Начало: в базе ничего нет про этот заказ'];
      el.innerHTML = `<div class="stack">
        <div class="tx-cards"><div><b>Транзакция</b>несколько изменений, которые база выполняет как одно: либо сохраняются все, либо ни одного</div><div><b>BEGIN</b>«начинаю черновик»: дальше изменения видны только мне, остальные видят базу как раньше</div><div><b>COMMIT</b>«сохранить черновик»: все изменения разом становятся настоящими и видны всем</div><div><b>ROLLBACK</b>«выбросить черновик»: всё, что сделано после BEGIN, отменяется, будто ничего не было</div></div>
        ${ui.seg('txs', cfg.scenarios.map(x => ({ v: x.v, t: x.t })), v)}
        <ol class="tx-steps">${steps.map((st, i) => `<li><button type="button" data-txk="${i + 1}" class="${i < k ? 'past' : ''} ${i === k - 1 ? 'on' : ''} ${st.kind || ''}"><span class="n">${i + 1}</span><span>${esc(st.t)}${st.sql ? `<code>${esc(st.sql)}</code>` : ''}</span><small>${st.who === 'bank' ? 'банк' : 'приложение → база'}</small></button></li>`).join('')}</ol>
        <div class="row"><button type="button" class="btn sm" data-txa="prev" ${k === 0 ? 'disabled' : ''}>← Шаг</button><button type="button" class="btn sm primary" data-txa="next" ${k >= steps.length ? 'disabled' : ''}>Шаг →</button><button type="button" class="btn sm" data-txa="play">${timer ? '⏸ Пауза' : '▶ Проиграть всё'}</button><button type="button" class="btn sm ghost" data-txa="reset" ${k === 0 ? 'disabled' : ''}>⟲ Сначала</button><span class="small dim">шаг ${k} из ${steps.length}</span></div>
        <div class="note ${status[0]}"><div>${status[1]}</div></div>
        <div class="qp-note">${cur ? cur.note : 'Нажимайте «Шаг →» и смотрите, что после каждой команды лежит в базе — у приложения и у кассира в соседнем окне.'}</div>
        <div class="tx-two"><div class="tx-pane"><div class="dv-k">Что видит это приложение</div>${seats(S, true)}${tables(S, true)}</div><div class="tx-pane"><div class="dv-k">Что в ту же секунду видит кассир</div>${seats(S, false)}${tables(S, false)}</div></div>
        ${ui.legend([['var(--warn-soft)', 'черновик транзакции — ещё не сохранён'], ['var(--bad-soft)', 'место продано (сохранено)'], ['var(--warn)', 'место держит черновик']])}</div>`;
    }
    function stop() { clearInterval(timer); timer = null; }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-txk],[data-txa]'); if (!b || !el.contains(b)) return;
      const n = sc().steps.length;
      if (b.dataset.txk) { stop(); k = +b.dataset.txk; }
      else if (b.dataset.txa === 'prev') { stop(); k = Math.max(0, k - 1); }
      else if (b.dataset.txa === 'next') { stop(); k = Math.min(n, k + 1); }
      else if (b.dataset.txa === 'reset') { stop(); k = 0; }
      else if (b.dataset.txa === 'play') { if (timer) stop(); else { k = 0; timer = setInterval(() => { if (k >= n) { stop(); draw(); return; } k++; draw(); if (k >= n) { stop(); draw(); cfg.onEnd && cfg.onEnd(v); } }, 1500); } }
      draw();
      if (k >= n) cfg.onEnd && cfg.onEnd(v);
    });
    ui.onSeg(el, (nm, x) => { if (nm !== 'txs') return; stop(); v = x; k = 0; draw(); });
    draw();
  };

  // ---------- NULL: трёхзначная логика ----------
  ui.truth3 = el => {
    let A = 'NULL', B = 'TRUE';
    const V = { TRUE: 1, FALSE: 0, NULL: null };
    const and = (a, b) => a === 0 || b === 0 ? 0 : a === null || b === null ? null : 1;
    const or = (a, b) => a === 1 || b === 1 ? 1 : a === null || b === null ? null : 0;
    const not = a => a === null ? null : 1 - a;
    const show = v => v === null ? '<span class="v-n">NULL (неизвестно)</span>' : v ? '<span class="v-t">TRUE</span>' : '<span class="v-f">FALSE</span>';
    function draw() {
      const a = V[A], b = V[B];
      el.innerHTML = `<div class="stack t3"><div class="row"><label class="small">A = <select data-t="A">${Object.keys(V).map(k => `<option ${k === A ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="small">B = <select data-t="B">${Object.keys(V).map(k => `<option ${k === B ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
        ${ui.table(['Выражение', 'Результат'], [['A AND B', show(and(a, b))], ['A OR B', show(or(a, b))], ['NOT A', show(not(a))], ['A = B', show(a === null || b === null ? null : +(a === b))], ['A IS NULL', show(+(a === null))]])}
        <div class="qp-note">NULL — «значение неизвестно». Любое сравнение с ним (=, &lt;&gt;, &gt;) даёт не FALSE, а «неизвестно», и WHERE такую строку отбрасывает. Даже <code>NULL = NULL</code> — неизвестно. Проверять пустоту — только <code>IS NULL</code> / <code>IS NOT NULL</code>.</div></div>`;
    }
    el.addEventListener('change', e => { const s = e.target.closest('[data-t]'); if (!s) return; if (s.dataset.t === 'A') A = s.value; else B = s.value; draw(); });
    draw();
  };

  // ---------- результат ученика рядом с эталоном ----------
  ui.resDiff = (mine, ref, opts) => {
    const o = opts || {};
    const asT = (r, name) => !r ? ui.note('', name, 'Запрос не запускался.') : !r.ok ? ui.note('bad', name, esc(r.error || 'ошибка')) : ui.dbt({ name: `${name} — ${r.total} ${TR.plural(r.total, 'строка', 'строки', 'строк')}`, cols: r.columns, rows: r.rows, max: o.max || 12 });
    return `<div class="dv-row" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">${asT(mine, 'Ваш результат')}${asT(ref, 'Эталон')}</div>`;
  };

  // ---------- фабрики типовых заданий ----------
  // У каждой строки/вопроса можно задать pic(got) — HTML-картинку и viz(el, got) — интерактивную схему к этому ответу.
  // Общая схема задания — cfg.viz(el, ans, info), как у любого задания.
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  TR.strip = strip;
  const TK = TR.task = {};
  const itemExtras = (row, got) => ({ pic: row.pic ? row.pic(got) : '', viz: row.viz ? (el => row.viz(el, got)) : null });
  const above = (cfg, a) => cfg.above ? `<div style="margin-bottom:10px">${typeof cfg.above === 'function' ? cfg.above(a) : cfg.above}</div>` : '';

  // Сопоставление: rows [{ id, t, sub, ok (v или [v]), because, slip:{ v: 'почему не то' } }], choices [{ v, t }]
  TK.match = cfg => Object.assign({
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(cfg.rows.map(r => [r.id, [].concat(r.ok)[0]])) }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; cfg.rows.forEach(r => { const g = a.m[r.id]; if (g) rv[r.id] = { s: [].concat(r.ok).includes(g) ? 'ok' : 'bad' }; }); }
      el.innerHTML = above(cfg, a) + '<div data-mm></div>';
      ui.match(TR.$('[data-mm]', el), { rows: cfg.rows.map(r => ({ id: r.id, t: r.t, sub: r.sub })), choices: cfg.choices, value: a.m, reveal: rv, readonly: ctx.readonly, placeholder: cfg.placeholder || 'Выберите…', onChange: v => { a.m = v; ctx.save(); } });
    },
    check(ans) {
      const m = ans.m || {}, n = cfg.rows.length, good = cfg.rows.filter(r => [].concat(r.ok).includes(m[r.id])).length;
      const notes = cfg.rows.filter(r => m[r.id] && ![].concat(r.ok).includes(m[r.id]) && r.slip && r.slip[m[r.id]]).map(r => ({ ok: false, html: `${esc(strip(r.t).slice(0, 90))}: ${r.slip[m[r.id]]}` }));
      const empty = cfg.rows.filter(r => !m[r.id]).length;
      return { ok: good === n, score: good / n, notes, summary: `Верно ${good} из ${n}.${empty ? ` Без ответа: ${empty}.` : ''}` };
    },
    answers: ans => cfg.rows.map(r => {
      const got = (ans.m || {})[r.id], okList = [].concat(r.ok), lab = v => ((cfg.choices.find(c => c.v === v) || {}).t) || '';
      const ok = got != null && okList.includes(got);
      return Object.assign({ q: strip(r.t), mine: got ? lab(got) : '', right: okList.map(lab).join(' или '), ok, slip: !ok && got && r.slip ? r.slip[got] || '' : '', why: r.because }, itemExtras(r, got));
    }),
    report: ans => cfg.rows.map(r => { const g = (ans.m || {})[r.id]; return `- ${strip(r.t)} → ${((cfg.choices.find(c => c.v === g) || {}).t) || '—'} ${[].concat(r.ok).includes(g) ? '✓' : '✗'}`; }).join('\n')
  }, cfg);

  // Раскладка: items [{ id, t, sub, ok: bucketId, because, why (чем плохо не туда) }], buckets [{ id, t, sub }]
  TK.sort = cfg => Object.assign({
    blank: () => ({ b: {} }),
    reference: () => ({ b: Object.fromEntries(cfg.items.map(i => [i.id, i.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.b = a.b || {};
      const rv = ctx.result || ctx.readonly ? Object.fromEntries(cfg.items.filter(i => a.b[i.id]).map(i => [i.id, a.b[i.id] === i.ok ? 'ok' : 'bad'])) : null;
      el.innerHTML = above(cfg, a) + '<div data-ss></div>';
      ui.sort(TR.$('[data-ss]', el), { items: cfg.items, buckets: cfg.buckets, value: a.b, reveal: rv, readonly: ctx.readonly, seed: cfg.id, onChange: v => { a.b = v; ctx.save(); } });
    },
    check(ans) {
      const b = ans.b || {}, n = cfg.items.length, good = cfg.items.filter(i => b[i.id] === i.ok).length, empty = cfg.items.filter(i => !b[i.id]).length;
      const notes = cfg.items.filter(i => b[i.id] && b[i.id] !== i.ok && i.why).map(i => ({ ok: false, html: `${esc(strip(i.t))}: ${i.why}` }));
      return { ok: good === n, score: good / n, notes, summary: `Верно ${good} из ${n}.${empty ? ` Не разложено: ${empty}.` : ''}` };
    },
    answers: ans => cfg.items.map(i => {
      const got = (ans.b || {})[i.id], lab = v => ((cfg.buckets.find(x => x.id === v) || {}).t) || '';
      return Object.assign({ q: strip(i.t), mine: got ? strip(lab(got)) : '', right: strip(lab(i.ok)), ok: got === i.ok, slip: got && got !== i.ok ? i.why || '' : '', why: i.because || i.why }, itemExtras(i, got));
    }),
    report: ans => cfg.buckets.map(bk => `- ${strip(bk.t)}: ${cfg.items.filter(i => (ans.b || {})[i.id] === bk.id).map(i => strip(i.t) + (i.ok === bk.id ? '' : ' ✗')).join(', ') || '—'}`).join('\n')
  }, cfg);

  // Набор вопросов с вариантами: qs [{ id, q (HTML), qText, code, lang, above, options:[{ t, ok, why, because }], pic(got), viz(el, got) }]
  const multiOf = x => x.multi || x.options.filter(o => o.ok).length > 1;
  TK.quizSet = cfg => Object.assign({
    blank: () => ({ q: {} }),
    reference: () => ({ q: Object.fromEntries(cfg.qs.map(x => [x.id, x.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0)])) }),
    render(el, ctx) {
      const a = ctx.ans; a.q = a.q || {};
      el.innerHTML = above(cfg, a) + `<div class="stack">${cfg.qs.map((x, k) => `<div class="card flat" style="padding:12px 14px">${cfg.qs.length > 1 ? `<div class="eyebrow">Вопрос ${k + 1} из ${cfg.qs.length}</div>` : ''}${x.above || ''}${x.code ? ui.code(x.code, x.lang || 'sql') : ''}<div data-qq="${esc(x.id)}"></div></div>`).join('')}</div>`;
      cfg.qs.forEach(x => ui.quiz(TR.$(`[data-qq="${x.id}"]`, el), { q: x.q, options: x.options, multi: multiOf(x), value: a.q[x.id] || [], readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: cfg.id + x.id, onChange: v => { a.q[x.id] = v; ctx.save(); } }));
    },
    check(ans) {
      const q = ans.q || {}, n = cfg.qs.length;
      const res = cfg.qs.map(x => ui.quizScore({ options: x.options, multi: multiOf(x) }, q[x.id] || []));
      const good = res.filter(r => r.ok).length;
      return { ok: good === n, score: res.reduce((s, r) => s + r.score, 0) / n, notes: [], summary: `Верно ${good} из ${n}.` };
    },
    answers: ans => cfg.qs.map(x => Object.assign(ui.quizAnswers(strip(x.qText || x.q), x.options, (ans.q || {})[x.id])[0], itemExtras(x, (ans.q || {})[x.id] || []))),
    report: ans => cfg.qs.map((x, k) => { const sel = (ans.q || {})[x.id] || []; return `- ${k + 1}. ${strip(x.qText || x.q).slice(0, 80)} → ${sel.map(i => strip(x.options[i].t)).join('; ') || '—'} ${ui.quizScore({ options: x.options, multi: multiOf(x) }, sel).ok ? '✓' : '✗'}`; }).join('\n')
  }, cfg);
})();
