// Composants visuels partagés : avatars, classement animé, graphiques SVG, équipes, tampons, podium.

import { h, fmt, fmtNum, signed, countUp, sfx } from './lib.js';

export function playerById(state, id) {
  return state.players.find((p) => p.id === id) || { id, name: '?', avatar: '❔', score: 0 };
}

export function avatar(p, opts = {}) {
  return h(`span.avatar${opts.size ? '.av-' + opts.size : ''}${p.connected === false ? '.offline' : ''}`, { title: p.name }, p.avatar || '🙂');
}

export function chip(p, opts = {}) {
  return h(`span.chip${opts.cls ? '.' + opts.cls : ''}${p.connected === false ? '.offline' : ''}`,
    avatar(p), h('span.chip-name', p.name), opts.extra ? h('span.chip-extra', opts.extra) : null);
}

export function avatarRow(state, ids, opts = {}) {
  return h('div.avatar-row', ids.map((id) => {
    const p = playerById(state, id);
    return h('span.avatar-pop', { title: p.name }, avatar(p, opts), opts.names ? h('small', p.name) : null);
  }));
}

export function stamp(text, ok, opts = {}) {
  setTimeout(() => sfx.stamp(), opts.delay || 250);
  return h(`div.stamp.${ok ? 'stamp-ok' : 'stamp-ko'}${opts.small ? '.stamp-small' : ''}`, text);
}

export function teamTag(team) {
  if (!team) return null;
  return h('span.team-tag', { style: { '--team': team.hex } }, `${team.emoji} ${team.color}`);
}

export function teamOf(state, pid) {
  return (state.teams || []).find((t) => t.members.includes(pid)) || null;
}

// ───────────── Équipes (révélation « Mercato ») ─────────────
export function teamsBoard(state, opts = {}) {
  if (!state.teams || !state.teams.length) return null;
  return h('div.teams-board', state.teams.map((t, ti) => h('div.team-card', { style: { '--team': t.hex, '--delay': `${ti * 0.15}s` } },
    h('div.team-head', h('span.team-color', `${t.emoji} ÉQUIPE ${t.color}`), h('span.team-name', t.name)),
    h('div.team-members', t.members.map((m, i) => {
      const p = playerById(state, m);
      return h('div.team-member', { style: { '--d': `${0.4 + ti * 0.15 + i * 0.12}s` } }, avatar(p), h('span', p.name), opts.scores ? h('small', fmt(p.score)) : null);
    })),
  )));
}

// ───────────── Classement animé ─────────────
export function leaderboard(state, opts = {}) {
  const rows = state.leaderboard || [];
  const animate = opts.animate !== false;
  const max = opts.max || rows.length;
  const list = h('div.lb');
  const shown = rows.slice(0, max);
  const prevOrder = shown.slice().sort((a, b) => a.prevRank - b.prevRank || b.prevScore - a.prevScore);
  const ROW = opts.compact ? 46 : 58;
  list.style.height = `${shown.length * ROW}px`;
  const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r);
  const els = {};
  shown.forEach((r) => {
    const p = playerById(state, r.id);
    const delta = r.prevRank - r.rank;
    const scoreEl = h('span.lb-score', fmt(animate ? r.prevScore : r.score));
    const badges = [];
    if (delta >= 3) badges.push(h('span.lb-badge.hot', `🔥 +${delta} places`));
    else if (delta > 0) badges.push(h('span.lb-badge.up', `▲ ${delta}`));
    else if (delta <= -2) badges.push(h('span.lb-badge.down', `💀 ${delta} places`));
    else if (delta < 0) badges.push(h('span.lb-badge.down', `▼ ${-delta}`));
    if (r.gain >= 300) badges.push(h('span.lb-badge.gain', `📈 ${signed(r.gain)}`));
    const row = h(`div.lb-row${r.rank <= 3 ? '.top' + r.rank : ''}${opts.me === r.id ? '.me' : ''}`,
      h('span.lb-rank', medal(r.rank)),
      avatar(p),
      h('span.lb-name', p.name, p.outsider ? h('span.lb-flag', { title: 'Prime d’outsider' }, '🚀') : null, p.streak >= 3 ? h('span.lb-flag', `🔥${p.streak}`) : null),
      h('span.lb-badges', badges),
      h(`span.lb-gain${r.gain < 0 ? '.neg' : ''}`, r.gain ? signed(r.gain) : ''),
      scoreEl,
    );
    els[r.id] = { row, scoreEl, r };
    list.appendChild(row);
  });
  const place = (order) => order.forEach((r, i) => { els[r.id].row.style.transform = `translateY(${i * ROW}px)`; });
  if (animate) {
    place(prevOrder);
    shown.forEach((r) => els[r.id].row.classList.add('lb-enter'));
    setTimeout(() => {
      list.classList.add('lb-moving');
      place(shown);
      shown.forEach((r) => countUp(els[r.id].scoreEl, r.prevScore, r.score, 1400));
      sfx.reveal();
    }, opts.delay ?? 900);
  } else {
    place(shown);
  }
  return list;
}

// ───────────── Graphiques SVG ─────────────
const SERIES = ['#3987e5', '#d95926', '#199e70'];

function niceTicks(min, max, count = 5) {
  const span = max - min || Math.abs(max) || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function chart(def, opts = {}) {
  const W = 760;
  const H = opts.height || 340;
  const m = { t: 34, r: 20, b: 46, l: 58 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const all = def.series.flatMap((s) => s.valeurs);
  const isLine = def.type === 'courbes';
  let lo = Math.min(0, ...all);
  let hi = Math.max(...all);
  if (isLine && def.min !== undefined) lo = def.min;
  const ticks = niceTicks(lo, hi);
  lo = ticks[0];
  hi = ticks[ticks.length - 1];
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const n = def.labels.length;
  const band = iw / n;
  const xc = (i) => m.l + band * i + band / 2;
  const hl = new Set(def.highlight || []);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', def.titre || 'Graphique');
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    svg.appendChild(e);
    return e;
  };
  const title = (e, t) => { const tt = document.createElementNS(ns, 'title'); tt.textContent = t; e.appendChild(tt); };
  // grille + axe Y
  ticks.forEach((t) => {
    el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' });
    el('text', { x: m.l - 8, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, fmtNum(t));
  });
  // labels X
  const every = n > 10 ? Math.ceil(n / 12) : 1;
  def.labels.forEach((l, i) => {
    if (i % every === 0) el('text', { x: xc(i), y: H - m.b + 20, class: `tick${hl.has(i) ? ' tick-hl' : ''}`, 'text-anchor': 'middle' }, l);
  });
  // zones d'anomalie (révélation)
  hl.forEach((i) => {
    el('rect', { x: m.l + band * i + 2, y: m.t - 6, width: band - 4, height: ih + 12, rx: 6, class: 'hl-zone' });
  });
  const unit = def.unite ? ` ${def.unite}` : '';
  if (isLine) {
    def.series.forEach((s, si) => {
      const color = SERIES[si % SERIES.length];
      const d = s.valeurs.map((v, i) => `${i ? 'L' : 'M'}${xc(i)},${y(v)}`).join(' ');
      el('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'line-draw' });
      s.valeurs.forEach((v, i) => {
        const c = el('circle', { cx: xc(i), cy: y(v), r: hl.has(i) ? 7 : 4.5, fill: color, stroke: '#142236', 'stroke-width': 2, class: hl.has(i) ? 'dot-hl' : '' });
        title(c, `${s.nom} — ${def.labels[i]} : ${fmtNum(v)}${unit}`);
      });
      // étiquette directe en bout de courbe
      const last = s.valeurs.length - 1;
      if (def.series.length > 1) el('text', { x: xc(last) - 6, y: y(s.valeurs[last]) - 10, class: 'direct-label', 'text-anchor': 'end' }, s.nom);
    });
  } else {
    const k = def.series.length;
    const gap = 2;
    const bw = Math.min(24, (band * 0.7 - gap * (k - 1)) / k);
    const group = bw * k + gap * (k - 1);
    def.series.forEach((s, si) => {
      const color = SERIES[si % SERIES.length];
      s.valeurs.forEach((v, i) => {
        const x = xc(i) - group / 2 + si * (bw + gap);
        const y0 = y(Math.max(0, v));
        const y1 = y(Math.min(0, v));
        const hgt = Math.max(1, y1 - y0);
        const r = Math.min(4, hgt / 2, bw / 2);
        // coins arrondis côté valeur, carrés côté ligne de base
        const d = v >= 0
          ? `M${x},${y1} V${y0 + r} Q${x},${y0} ${x + r},${y0} H${x + bw - r} Q${x + bw},${y0} ${x + bw},${y0 + r} V${y1} Z`
          : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
        const bar = el('path', { d, fill: color, class: `bar-grow${hl.has(i) ? ' bar-hl' : ''}`, style: `animation-delay:${i * 40}ms` });
        title(bar, `${s.nom} — ${def.labels[i]} : ${fmtNum(v)}${unit}`);
        if (hl.has(i) && si === 0) el('text', { x: x + bw / 2, y: y0 - 8, class: 'value-label', 'text-anchor': 'middle' }, fmtNum(v));
      });
    });
  }
  if (def.unite) el('text', { x: 4, y: 14, class: 'unit' }, `(${def.unite})`);
  const wrap = h('figure.chart',
    h('figcaption.chart-title', def.titre),
    def.series.length > 1 ? h('div.legend', def.series.map((s, i) => h('span.legend-item', h('span.legend-key', { style: { background: SERIES[i % SERIES.length] } }), s.nom))) : null,
  );
  wrap.appendChild(svg);
  return wrap;
}

// ───────────── Échelle logarithmique des estimations ─────────────
export function estimateScale(state, reveal, unit) {
  const list = reveal.list || [];
  // échelle log(1 + x) : gère aussi les réponses à 0
  const L = (v) => Math.log10(Math.max(0, v) + 1);
  const values = [reveal.answer, ...list.map((l) => l.value)].filter((v) => v >= 0);
  if (!values.length) return null;
  const lo = Math.min(...values.map(L)) - 0.3;
  const hi = Math.max(...values.map(L)) + 0.3;
  const pos = (v) => `${((L(v) - lo) / (hi - lo || 1)) * 100}%`;
  return h('div.est-scale',
    h('div.est-line'),
    h('div.est-answer', { style: { left: pos(reveal.answer) } }, h('span.est-answer-flag', `🎯 ${fmtNum(reveal.answer)}${unit ? ' ' + unit : ''}`)),
    list.map((l, i) => {
      const p = playerById(state, l.id);
      return h('div.est-dot', { style: { left: pos(l.value), '--row': i % 3, '--d': `${0.3 + i * 0.12}s` }, title: `${p.name} : ${fmtNum(l.value)}` }, avatar(p, { size: 'sm' }));
    }),
  );
}

// ───────────── Podium final ─────────────
export function podium(state) {
  const f = state.final;
  const top = f.ranking.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return h('div.podium', order.map((r) => {
    const p = playerById(state, r.id);
    const place = r.rank;
    return h(`div.podium-step.place-${Math.min(place, 3)}`, { style: { '--d': place === 1 ? '2.4s' : place === 2 ? '1.4s' : '0.6s' } },
      h('div.podium-player', h('div.podium-avatar', p.avatar), h('div.podium-name', p.name), h('div.podium-score', `${fmt(r.score)} pts`)),
      h('div.podium-block', h('span', place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉')),
    );
  }));
}
