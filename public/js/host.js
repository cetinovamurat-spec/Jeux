// Écran « maître de cérémonie » et écran TV (à partager sur Teams / Discord / Zoom).

import { h, fmt, fmtNum, signed, LETTERS, OPTION_COLORS, sfx, confetti, qrSvg, pick, isMuted, toggleMute } from './lib.js';
import { app, hostAct } from './app.js';
import { playerById, avatar, chip, avatarRow, stamp, teamsBoard, leaderboard, chart, estimateScale, podium, teamOf, teamTag } from './components.js';

const ACCROCHES = [
  'Pendant ce temps, la balance âgée attend toujours.',
  'Rappel : aucune pièce justificative ne sera demandée ce soir.',
  'Ce soir, le seul écart qui compte, c’est l’écart au classement.',
  'Interdit de dire « je regarde ça » pendant les Olympiades.',
  'Le VAR sera assuré par le maître de cérémonie. Ses décisions sont définitives.',
  'Excel est fermé. Respirez.',
  'Aucun budget d’heures n’a été alloué à cette soirée.',
  'Le comité décline toute responsabilité en cas de trahison.',
];

const ROOKIE_TITLES = ['Recrue prometteuse', 'Profil à auditer', 'Dossier en cours d’ouverture', 'Arrivé(e) sans pièces justificatives', 'Transfert du mercato', 'Joker de la direction', 'Talent non provisionné', 'Espoir du centre de formation'];

function stableIndex(str, n) {
  let x = 0;
  for (const ch of String(str)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return x % n;
}

function joinUrl() {
  return `${location.host}/${app.code}`;
}

// ───────────── En-tête ─────────────
export function hostHeader(s) {
  return h('div.hh',
    h('div.hh-logo', h('span.hh-trophy', '🏆'), h('div', h('div.hh-title', 'LES OLYMPIADES DU CABINET'), h('div.hh-sub', 'AUDIT GAMES 2026'))),
    h('div.hh-rounds', s.rounds.map((r, i) => h(`span.hh-dot${i < s.roundIndex || (i === s.roundIndex && s.phase === 'roundEnd') ? '.done' : ''}${i === s.roundIndex && s.phase !== 'roundEnd' && s.phase !== 'final' ? '.current' : ''}${s.phase === 'final' ? '.done' : ''}`, { title: r.name }, r.emoji))),
    h('div.hh-join', h('span.hh-join-label', 'Rejoindre'), h('span.hh-join-url', joinUrl()), h('span.hh-count', `👥 ${s.players.filter((p) => p.connected).length}`)),
  );
}

// ───────────── Barre de contrôle du MC ─────────────
function nextLabel(s) {
  if (s.phase === 'lobby') return '🚀 Lancer les Olympiades';
  if (s.phase === 'roundIntro') return '▶ Commencer l’épreuve';
  if (s.phase === 'roundEnd') return s.roundIndex >= s.rounds.length - 1 ? '🏆 Cérémonie finale' : '▶ Suite';
  if (s.phase === 'event') return s.event && s.event.stage === 'interactive' ? '⏩ Trancher' : '▶ Épreuve suivante';
  if (s.phase === 'final') return null;
  const p = s.play || {};
  const map = {
    questions: { ask: '👁 Révéler', reveal: '▶ Question suivante' },
    menteur: { brief: '🎤 Plaidoiries', plead: '▶ Plaideur suivant', vote: '👁 Révéler', reveal: '▶ Suivant' },
    reaction: { ready: '▶ Go', go: '👁 Résultat', reveal: '▶ Mini-jeu suivant' },
    mot: { ready: '▶ Lancer le chrono', play: '⏹ Fin du tour', turnEnd: '▶ Orateur suivant' },
    bluff: { cards: '🗣️ Discussion', discuss: '🗳️ Passer au vote', act: '👁 Révéler', reveal: '▶ Manche suivante' },
    encheres: { present: '🔨 Ouvrir les enchères', bid: '🔨 Adjugé !', bids: '▶ Suite', answer: '👁 Révéler', choose: '⏩ Trancher', result: '▶ Lot suivant', final: '🏁 Terminer' },
  };
  return (map[p.kind] && map[p.kind][p.stage]) || '▶ Suivant';
}

export function hostControls(s) {
  const L = app.local;
  const label = nextLabel(s);
  const bar = h('div.cbar',
    label ? h('button.btn.btn-gold.cbar-next', { onclick: () => { sfx.click(); hostAct({ type: 'next' }); }, title: 'Raccourci : espace ou →' }, label) : null,
    s.timer ? h('button.btn.btn-ghost', { onclick: () => hostAct({ type: 'pause' }) }, s.timer.paused ? '▶ Reprendre' : '⏸ Pause') : null,
    s.phase === 'play' ? h('button.btn.btn-ghost', { onclick: () => { if (confirm('Terminer cette épreuve maintenant ?')) hostAct({ type: 'skipRound' }); } }, '⏭ Passer l’épreuve') : null,
    s.phase === 'roundEnd' && s.roundIndex < s.rounds.length - 1 ? h('button.btn.btn-ghost', { onclick: () => hostAct({ type: 'forceEvent' }) }, '🎲 Événement surprise') : null,
    s.phase !== 'lobby' && s.phase !== 'final' ? h('button.btn.btn-ghost', { onclick: () => { L.adjustOpen = !L.adjustOpen; app.rerender(); } }, '⚖️ Points') : null,
    h('label.toggle', { title: 'Enchaîne automatiquement les révélations (pratique si le MC joue aussi)' },
      h('input', { type: 'checkbox', checked: s.settings.autoNext, onchange: (e) => hostAct({ type: 'autoNext', value: e.target.checked }) }), h('span', 'Auto')),
    h('span.cbar-spacer'),
    h('a.btn.btn-ghost', { href: `/tv?code=${app.code}`, target: '_blank', title: 'Écran sans contrôles, idéal pour le partage d’écran' }, '📺 Écran TV'),
    h('a.btn.btn-ghost', { href: `/play?code=${app.code}`, target: '_blank', title: 'Jouer aussi depuis cet ordinateur' }, '🎮 Jouer aussi'),
    h('button.icon-btn', { onclick: (e) => { toggleMute(); e.currentTarget.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'),
    s.phase !== 'lobby' && s.phase !== 'final' ? h('button.btn.btn-ghost.btn-danger', { onclick: () => { if (confirm('Terminer la partie et afficher le classement final ?')) hostAct({ type: 'end' }); } }, '🏁 Fin') : null,
  );
  if (!L.adjustOpen || s.phase === 'lobby' || s.phase === 'final') return bar;
  const panel = h('div.adjust',
    h('div.adjust-head', h('strong', '⚖️ Décisions arbitrales du MC'), h('button.icon-btn', { onclick: () => { L.adjustOpen = false; app.rerender(); } }, '✕')),
    h('div.adjust-list', s.players.map((p) => h('div.adjust-row',
      avatar(p), h('span.adjust-name', p.name), h('span.adjust-score', fmt(p.score)),
      [-100, -50, -20, 20, 50, 100].map((d) => h(`button.btn.btn-small${d < 0 ? '.btn-danger' : '.btn-green'}`, { onclick: () => hostAct({ type: 'adjust', pid: p.id, delta: d }) }, signed(d))),
      h('button.btn.btn-small.btn-ghost', { title: 'Retirer ce joueur', onclick: () => { if (confirm(`Retirer ${p.name} de la partie ?`)) hostAct({ type: 'kick', pid: p.id }); } }, '🟥'),
    ))),
  );
  return h('div', panel, bar);
}

// ───────────── Vue principale ─────────────
export function hostView(s, isHost) {
  const p = s.play || {};
  const sub = [p.kind, p.stage, p.index, p.turn, p.manche, p.pleadIdx, p.revealIdx].join('.');
  const ev = s.event ? `${s.event.id}.${s.event.stage}` : '';
  const key = `${s.phase}|${s.roundIndex}|${sub}|${ev}`;
  return { key, build: (fresh) => buildHost(s, isHost, fresh) };
}

function buildHost(s, isHost, fresh) {
  switch (s.phase) {
    case 'lobby': return lobby(s, isHost);
    case 'roundIntro': if (fresh) sfx.whistle(); return roundIntro(s);
    case 'play': return play(s, isHost, fresh);
    case 'roundEnd': return roundEnd(s, fresh);
    case 'event': return eventScreen(s, fresh);
    case 'final': return finalScreen(s, isHost, fresh);
    default: return h('div', '…');
  }
}

// ───────────── Lobby ─────────────
function lobby(s, isHost) {
  const qr = qrSvg(`${location.origin}/play?code=${app.code}`, 170);
  const players = s.players;
  const left = h('div.lobby-join',
    h('div.lobby-kicker', 'Rejoignez les Olympiades'),
    h('div.lobby-url', joinUrl()),
    h('div.lobby-or', 'ou entrez le code'),
    h('div.lobby-code', app.code.split('').map((c, i) => h('span', { style: { '--i': i } }, c))),
    qr,
    h('div.lobby-accroche', ACCROCHES[Math.floor(Date.now() / 15000) % ACCROCHES.length]),
  );
  const right = h('div.lobby-players',
    h('h2.section-title', `🧑‍💼 Dans le vestiaire (${players.length})`),
    players.length ? h('div.player-grid', players.map((p, i) => h(`div.player-card${p.connected ? '' : '.offline'}`, { style: { '--i': i } },
      h('div.pc-avatar', p.avatar),
      h('div.pc-name', p.name),
      p.profile ? h('div.pc-title', p.profile.titre) : h('div.pc-title.muted', ROOKIE_TITLES[stableIndex(p.id, ROOKIE_TITLES.length)]),
    ))) : h('div.empty', h('div.big-emoji', '🪑'), 'En attente des premiers collègues…'),
  );
  return h('div.lobby', left, right, isHost ? settingsPanel(s) : null);
}

function settingsPanel(s) {
  const set = (patch) => hostAct({ type: 'settings', settings: patch });
  const rounds = s.settings.rounds;
  const all = s.allRounds || [];
  const toggleRound = (id) => {
    const next = rounds.includes(id) ? rounds.filter((r) => r !== id) : all.map((r) => r.id).filter((r) => rounds.includes(r) || r === id);
    if (next.length) set({ rounds: next });
  };
  return h('div.settings',
    h('h3', '⚙️ Réglages de la soirée'),
    h('div.set-rounds', all.map((r, i) => h(`button.set-round${rounds.includes(r.id) ? '.on' : ''}`, { onclick: () => toggleRound(r.id) }, h('span', r.emoji), h('small', `${i + 1}. ${r.name}`)))),
    h('div.set-row',
      h('span.set-label', 'Durée'),
      ['court', 'normal', 'long'].map((l) => h(`button.btn.btn-small${s.settings.length === l ? '.btn-gold' : '.btn-ghost'}`, { onclick: () => set({ length: l }) }, { court: '⚡ Express (~45 min)', normal: '⏱ Normale (~75 min)', long: '🌙 Longue (~2 h)' }[l])),
    ),
    h('div.set-row',
      h('label.toggle', h('input', { type: 'checkbox', checked: s.settings.teams, onchange: (e) => set({ teams: e.target.checked }) }), h('span', '🔀 Équipes recomposées à chaque épreuve')),
      h('label.toggle', h('input', { type: 'checkbox', checked: s.settings.events, onchange: (e) => set({ events: e.target.checked }) }), h('span', '🎲 Événements aléatoires')),
      h('label.toggle', h('input', { type: 'checkbox', checked: s.settings.autoNext, onchange: (e) => set({ autoNext: e.target.checked }) }), h('span', '🤖 Enchaînement automatique')),
    ),
    h('button.btn.btn-gold.btn-big.start-btn', { disabled: !s.players.length, onclick: () => hostAct({ type: 'start', settings: {} }) }, s.players.length ? `🚀 Lancer les Olympiades (${s.players.length} joueur${s.players.length > 1 ? 's' : ''})` : 'En attente de joueurs…'),
    h('p.set-hint', 'Astuce : partagez l’onglet « 📺 Écran TV » et gardez celui-ci pour piloter. Espace / → = suivant, P = pause.'),
    app.hostToken ? h('details.rescue', h('summary', '🔑 Lien MC de secours (pour reprendre l’animation depuis un autre appareil — à garder pour toi)'),
      h('input.input.small', { readonly: true, value: `${location.origin}/host?code=${app.code}&t=${encodeURIComponent(app.hostToken)}`, onclick: (e) => e.target.select() })) : null,
  );
}

// ───────────── Intro d'épreuve ─────────────
function roundIntro(s) {
  const r = s.round;
  const outsiders = s.players.filter((p) => p.outsider);
  const mods = [];
  if (s.roundMods && s.roundMods.mult && s.roundMods.mult !== 1) mods.push(h('div.mod-banner', `💀 Événement actif : tous les points ×${String(s.roundMods.mult).replace('.', ',')}`));
  const withMods = s.players.filter((p) => p.mods && p.mods.length);
  const MOD_LABEL = { noSpeed: '📞 sans bonus de rapidité', blind: '🧾 pièces manquantes', noLoss: '🛡️ aucune perte', mult: '✖️ gains multipliés' };
  withMods.forEach((p) => mods.push(h('div.mod-banner.small', `${p.avatar} ${p.name} : ${p.mods.map((m) => MOD_LABEL[m] || m).join(', ')}`)));
  return h('div.round-intro',
    h('div.folder',
      h('div.folder-tab', `DOSSIER N° ${r.index + 1} / ${s.rounds.length}`),
      h('div.folder-body',
        h('div.ri-emoji', r.emoji),
        h('h1.ri-name', r.name),
        h('p.ri-tagline', r.tagline),
        h('div.ri-badges',
          r.coef !== 1 ? h('span.badge.badge-gold', `Coefficient ×${String(r.coef).replace('.', ',')}`) : h('span.badge', 'Coefficient ×1'),
          s.teams ? h('span.badge.badge-blue', '🏅 Bonus pour la meilleure équipe') : null,
        ),
        h('ul.ri-rules', r.rules.map((x, i) => h('li', { style: { '--i': i } }, x))),
        mods,
      ),
    ),
    h('div.ri-side',
      s.teams ? h('div', h('h2.section-title.mercato', '🔀 MERCATO : nouvelles équipes !'), teamsBoard(s)) : h('div.solo', h('div.big-emoji', '🧍'), h('p', 'Épreuve en individuel : chacun pour soi.')),
      outsiders.length ? h('div.outsiders', h('strong', '🚀 Prime d’outsider (+20 % sur les gains) : '), outsiders.map((p) => chip(p))) : null,
    ),
  );
}

// ───────────── Jeu ─────────────
function play(s, isHost, fresh) {
  const p = s.play;
  switch (p.kind) {
    case 'questions': return questionsHost(s, p, fresh);
    case 'menteur': return menteurHost(s, p, fresh);
    case 'reaction': return reactionHost(s, p, fresh);
    case 'mot': return motHost(s, p, isHost, fresh);
    case 'bluff': return bluffHost(s, p, fresh);
    case 'encheres': return encheresHost(s, p, fresh);
    default: return h('div', 'Épreuve inconnue');
  }
}

function answeredBar(s, ids, label = 'ont répondu') {
  const connected = s.players.filter((p) => p.connected);
  return h('div.answered',
    h('span.answered-count', `${ids.length} / ${connected.length} ${label}`),
    h('div.answered-avatars', connected.map((p) => h(`span.answered-av${ids.includes(p.id) ? '.done' : ''}`, { title: p.name }, p.avatar))),
  );
}

function roundTag(s, extra) {
  return h('div.round-tag', h('span', `${s.round.emoji} ${s.round.name}`), extra ? h('span.round-tag-extra', extra) : null);
}

function questionsHost(s, p, fresh) {
  const it = p.item;
  const rv = p.reveal;
  if (fresh && rv) sfx.reveal();
  const head = roundTag(s, `Question ${p.index + 1} / ${p.total}${it.difficultyLabel && !['vote', 'predict', 'estimate', 'order'].includes(it.type) ? ' · ' + it.difficultyLabel : ''}${it.cat ? ' · ' + it.cat : ''}`);
  const target = it.target ? playerById(s, it.target) : null;
  const typeBadge = {
    vote: '🗳️ QUI EST LE PLUS SUSCEPTIBLE…',
    predict: '🪞 MIROIR',
    estimate: '🔢 ESTIMATION',
    number: '🧮 RÉPONSE CHIFFRÉE',
    order: '📋 CLASSEMENT',
  }[it.type];
  const q = h('div.q-card',
    typeBadge ? h('div.q-type', typeBadge) : null,
    h('div.q-text', it.q),
    it.type === 'predict' && target ? h('div.q-target', avatar(target, { size: 'lg' }), h('span', `${target.name} répond pour lui/elle-même… les autres doivent deviner !`)) : null,
    it.visual ? h('div.q-visual', it.visual) : null,
    it.unit && (it.type === 'estimate' || it.type === 'number') ? h('div.q-unit', `Réponse en ${it.unit}`) : null,
  );
  const body = [];
  if (it.chart) body.push(chart(it.chart, { height: 330 }));
  if (it.type === 'mcq' || it.type === 'predict') {
    body.push(h(`div.options${it.options.length === 2 ? '.two' : ''}`, it.options.map((o, i) => {
      const isAns = rv && rv.answer === i;
      const voters = rv && rv.distribution ? rv.distribution[i] || [] : [];
      return h(`div.option${rv ? (isAns ? '.correct' : '.wrong') : ''}`, { style: { '--c': OPTION_COLORS[i] } },
        h('span.opt-letter', LETTERS[i]), h('span.opt-text', o),
        rv ? h('span.opt-voters', voters.map((id) => avatar(playerById(s, id), { size: 'sm' }))) : null,
        isAns ? stamp(it.type === 'predict' ? 'SA RÉPONSE' : 'VALIDÉ', true, { small: true }) : null,
      );
    })));
    if (rv && rv.cancelled) body.push(h('div.notice', `${target ? target.name : 'La cible'} n’a pas répondu : question annulée.`));
  } else if (it.type === 'vote') {
    body.push(h('div.vote-grid', it.options.map((id) => {
      const pl = playerById(s, id);
      const n = rv ? rv.counts[id] || 0 : 0;
      const elected = rv && rv.elected.includes(id);
      return h(`div.vote-card${elected ? '.elected' : ''}`, avatar(pl, { size: 'lg' }), h('div.vote-name', pl.name), rv ? h('div.vote-count', `${n} vote${n > 1 ? 's' : ''}`) : null, elected ? h('div.crown', '👑') : null);
    })));
    if (rv && rv.elected.length) body.push(h('div.notice.gold', `🏅 Titre décerné : « ${it.title} » → ${rv.elected.map((id) => playerById(s, id).name).join(', ')}`));
  } else if (it.type === 'order') {
    const list = rv ? rv.ordered.map((label, i) => ({ label, i })) : it.items.map((x) => ({ label: x.label }));
    body.push(h('ol.order-list', list.map((x, k) => h(`li${rv ? '.correct' : ''}`, { style: { '--i': k } }, x.label))));
  } else if ((it.type === 'number' || it.type === 'estimate') && !rv) {
    body.push(h('div.big-input-hint', '⌨️ Tapez votre réponse sur votre écran'));
  }
  if (rv && it.type === 'number') {
    body.push(h('div.answer-big', `${fmtNum(rv.answer)}${it.unit ? ' ' + it.unit : ''}`, stamp('VALIDÉ', true, { small: true })));
    body.push(h('div.guess-list', rv.list.slice(0, 12).map((g) => h(`span.guess${g.ok ? '.ok' : ''}`, avatar(playerById(s, g.id), { size: 'sm' }), fmtNum(g.value)))));
  }
  if (rv && it.type === 'estimate') {
    body.push(h('div.answer-big', `${fmtNum(rv.answer)}${it.unit ? ' ' + it.unit : ''}`));
    body.push(estimateScale(s, rv, it.unit));
    body.push(h('div.est-ranking', rv.list.map((l) => {
      const pl = playerById(s, l.id);
      const ratio = l.ratio >= 1 ? `×${fmtNum(Math.round(l.ratio * 10) / 10)} trop haut` : `÷${fmtNum(Math.round((1 / l.ratio) * 10) / 10)} trop bas`;
      return h('div.est-row', h('span.est-rank', `#${l.rank}`), avatar(pl, { size: 'sm' }), h('span.est-name', pl.name), h('span.est-val', fmtNum(l.value)), h('span.est-ratio', Math.abs(l.ratio - 1) < 0.005 ? 'pile !' : ratio), h('span.est-tags', l.tags.join(' ')), h(`span.est-pts${l.points < 0 ? '.neg' : ''}`, signed(l.points)));
    })));
  }
  // Graphique + réponses côte à côte pour tenir sur un écran partagé 16:9
  if (it.chart && body.length >= 2) {
    const [ch, opts] = body.splice(0, 2);
    opts.classList.add('stacked');
    body.unshift(h('div.q-chart-layout', ch, opts));
  }
  if (rv && rv.explain) body.push(h('div.explain', h('span.explain-icon', '📎'), rv.explain));
  if (rv && fresh) setTimeout(() => celebrateTop(s, rv), 400);
  return h('div.play.questions', head, q, h('div.q-body', body), !rv ? answeredBar(s, p.answered) : topGains(s, rv.results));
}

function celebrateTop(s, rv) {
  const res = Object.values(rv.results || {});
  if (res.some((r) => r.correct)) confetti(40, { y: 0.9, x: 0.5, spread: 14 });
}

function topGains(s, results) {
  const entries = Object.entries(results || {}).filter(([, r]) => r.points).sort((a, b) => b[1].points - a[1].points).slice(0, 8);
  if (!entries.length) return h('div.answered', h('span.muted', 'Personne ne marque sur cette question. Le client est ravi.'));
  return h('div.gains', entries.map(([id, r]) => {
    const pl = playerById(s, id);
    return h(`span.gain${r.points < 0 ? '.neg' : ''}`, avatar(pl, { size: 'sm' }), h('span', pl.name), h('strong', signed(r.points)), r.streak >= 3 ? h('span.streak', `🔥${r.streak}`) : null);
  }));
}

// ───── Menteur ─────
function menteurHost(s, p, fresh) {
  const head = roundTag(s, { brief: 'Distribution des rôles', plead: `Plaidoirie ${p.pleadIdx + 1} / ${p.order.length}`, vote: 'Vote final', reveal: `Révélation ${p.revealIdx + 1} / ${p.order.length}` }[p.stage]);
  const roles = h('div.role-counts', p.roleCounts.map((r) => h('span.role-count', `${r.emoji} ${r.n} ${r.name}${r.n > 1 ? 's' : ''}`)));
  if (p.stage === 'brief') {
    return h('div.play.menteur', head,
      h('div.big-title', '🤫 Regardez votre écran : votre rôle est SECRET'),
      roles,
      h('div.statement-grid', p.order.map((id, i) => h('div.statement-card', { style: { '--i': i } }, chip(playerById(s, id)), h('p', `« ${p.statements[id]} »`)))),
    );
  }
  if (p.stage === 'plead') {
    const pl = playerById(s, p.pleader);
    return h('div.play.menteur', head,
      h('div.spotlight',
        h('div.spot-avatar', pl.avatar),
        h('div.spot-name', `🎤 ${pl.name} a la parole`),
        h('blockquote.spot-quote', `« ${p.statements[p.pleader]} »`),
        h('div.spot-hint', 'Vrai ou faux ? Posez vos questions, cuisinez-le/la… puis votez sur votre écran.'),
        h('div.spot-timer', h('span', { 'data-countdown': '' }, '')),
      ),
      roles,
      h('div.next-up', 'Ensuite : ', p.order.slice(p.pleadIdx + 1, p.pleadIdx + 4).map((id) => chip(playerById(s, id)))),
    );
  }
  if (p.stage === 'vote') {
    const n = s.players.filter((x) => x.connected).length;
    return h('div.play.menteur', head,
      h('div.big-title', '🗳️ Dernier moment pour voter : Vérité ou Mensonge ?'),
      roles,
      h('div.statement-grid', p.order.map((id) => h('div.statement-card', chip(playerById(s, id)), h('p', `« ${p.statements[id]} »`)))),
      h('div.answered', h('span.answered-count', `Votes : ${Object.values(p.voted).reduce((a, b) => a + b, 0)} / ${n * (p.order.length - 1)}`)),
    );
  }
  // reveal
  const last = p.revealed[p.revealed.length - 1];
  if (fresh && last) setTimeout(() => (last.roleInfo.lying ? sfx.bad() : sfx.good()), 300);
  return h('div.play.menteur', head,
    last ? h('div.reveal-card',
      h('div.rc-left', h('div.spot-avatar', playerById(s, last.id).avatar), h('div.spot-name', playerById(s, last.id).name), h('blockquote.spot-quote.small', `« ${p.statements[last.id]} »`)),
      h('div.rc-mid',
        stamp(last.roleInfo.lying ? 'MENSONGE' : 'VÉRITÉ', !last.roleInfo.lying),
        h('div.rc-role', `${last.roleInfo.emoji} ${last.roleInfo.name}`),
        last.role === 'manipulateur' && last.target ? h('div.rc-note', `Sa cible secrète : ${playerById(s, last.target).name}${last.manipBonus ? ' — mission réussie (+bonus) !' : ' — mission ratée.'}`) : null,
        last.role === 'double' ? h('div.rc-note', 'Disait la vérité… en faisant tout pour paraître louche !') : null,
      ),
      h('div.rc-right',
        h('div.rc-votes', h('strong', `😇 Croyaient à la vérité (${last.believed.length})`), avatarRow(s, last.believed)),
        h('div.rc-votes', h('strong', `😈 Criaient au mensonge (${last.doubted.length})`), avatarRow(s, last.doubted)),
        h('div.rc-points', `${playerById(s, last.id).name} : ${signed(last.points)} pts`),
      ),
    ) : null,
    h('div.revealed-strip', p.revealed.slice(0, -1).map((r) => h(`span.rv-mini${r.roleInfo.lying ? '.lie' : '.truth'}`, avatar(playerById(s, r.id), { size: 'sm' }), r.roleInfo.emoji))),
    p.revealIdx >= p.order.length - 1 && p.detective ? h('div.gains', h('strong', '🕵️ Flair de détective : '), Object.entries(p.detective).sort((a, b) => b[1] - a[1]).map(([id, pts]) => h('span.gain', avatar(playerById(s, id), { size: 'sm' }), playerById(s, id).name, h('strong', signed(pts))))) : null,
  );
}

// ───── Réaction ─────
function reactionHost(s, p, fresh) {
  const g = p.game;
  const head = roundTag(s, `Mini-jeu ${p.index + 1} / ${p.total}`);
  if (p.stage === 'ready') {
    if (fresh) sfx.tick();
    return h('div.play.reaction', head, h('div.rx-ready', h('div.rx-title', `⚡ ${g.title}`), h('div.rx-instr', g.instruction), h('div.rx-count', { 'data-countdown': '' }, '3')));
  }
  if (p.stage === 'go') {
    let content;
    if (g.type === 'signal') content = h('div.rx-big', '👀 Regardez VOTRE écran… et cliquez au VERT !');
    else if (g.type === 'memory') {
      const k = `mem-${s.roundIndex}-${p.index}`;
      app.local[k] = app.local[k] || performance.now();
      const showing = performance.now() - app.local[k] < g.showMs;
      content = showing ? h('div.rx-seq', g.sequence.map((i) => h('span', g.symbols[i]))) : h('div.rx-big', '🧠 À vous de reproduire la séquence !');
      if (showing) setTimeout(() => app.rerender(), g.showMs - (performance.now() - app.local[k]) + 30);
    } else if (g.type === 'type') content = h('div.rx-word', g.word);
    else if (g.type === 'stroop') content = h('div.rx-stroop', { style: { color: g.ink } }, g.word);
    else if (g.type === 'flash') content = h('div.rx-word', g.instruction);
    else if (g.grid) content = h(`div.rx-grid${g.text ? '.text' : ''}`, { style: { '--cols': g.cols } }, g.grid.map((x) => h('span', x)));
    return h('div.play.reaction', head, h('div.rx-instr', `${g.title} — ${g.instruction}`), content, answeredBar(s, p.answered));
  }
  // reveal
  const ranking = Object.entries(p.results || {}).sort((a, b) => (b[1].ok - a[1].ok) || (a[1].ms || 1e9) - (b[1].ms || 1e9));
  let sol = null;
  if (g.grid && !g.options && p.solution !== undefined) {
    const sols = [].concat(p.solution);
    sol = h(`div.rx-grid.small${g.text ? '.text' : ''}`, { style: { '--cols': g.cols } }, g.grid.map((x, i) => h(`span${sols.includes(i) ? '.sol' : ''}`, x)));
  } else if (g.type === 'memory') sol = h('div.rx-seq.small', g.sequence.map((i) => h('span', g.symbols[i])));
  else if (p.solution !== undefined && g.type !== 'signal') sol = h('div.rx-word.small', `✅ ${p.solution}`);
  return h('div.play.reaction', head,
    h('div.rx-title', `⚡ ${g.title} — résultats`), sol,
    h('div.rx-results', ranking.map(([id, r], i) => h(`div.rx-row${r.ok ? '' : '.ko'}`, { style: { '--i': i } },
      h('span.rx-rank', r.ok ? (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`) : r.early ? '🟥' : '❌'),
      avatar(playerById(s, id)), h('span.rx-name', playerById(s, id).name),
      h('span.rx-ms', r.early ? 'Faux départ !' : r.ok ? `${r.ms} ms` : 'Raté'),
      h(`span.rx-pts${r.points < 0 ? '.neg' : ''}`, signed(r.points)),
    ))),
  );
}

// ───── Deviner un mot ─────
function motHost(s, p, isHost, fresh) {
  const d = playerById(s, p.describer);
  const team = teamOf(s, p.describer);
  const mates = p.teamMode && team ? team.members.filter((m) => m !== p.describer) : s.players.filter((x) => x.id !== p.describer).map((x) => x.id);
  const head = roundTag(s, `Orateur ${p.turn + 1} / ${p.totalTurns}`);
  const found = p.words.filter((w) => w.status === 'found').length;
  const wordsList = h('div.words-done', p.words.map((w) => h(`span.word-done.${w.status}`, { title: w.interdits.join(', ') },
    { found: '✅', stolen: '🦹', passed: '⏭', carton: '🟥', timeout: '⌛' }[w.status] + ' ' + w.mot,
    w.by ? h('small', ` ${playerById(s, w.by).name}`) : null)));
  if (p.stage === 'ready') {
    return h('div.play.mot', head,
      h('div.spotlight',
        h('div.spot-avatar', d.avatar),
        h('div.spot-name', `🎙️ ${d.name} va faire deviner`),
        team ? teamTag(team) : null,
        h('div.mates', h('span', 'Ses coéquipiers : '), mates.map((m) => chip(playerById(s, m)))),
        h('div.spot-hint', `${d.name} appuie sur GO quand il/elle est prêt(e). Les adversaires peuvent voler les mots !`),
      ),
      p.upcoming.length ? h('div.next-up', 'Ensuite : ', p.upcoming.map((id) => chip(playerById(s, id)))) : null,
    );
  }
  if (p.stage === 'play') {
    const peek = isHost && p.hostWord ? h('button.btn.btn-ghost.peek', {
      onpointerdown: (e) => { e.currentTarget.textContent = `${p.hostWord.mot} — ❌ ${p.hostWord.interdits.join(' · ')}`; },
      onpointerup: (e) => { e.currentTarget.textContent = '👁 Maintenir pour voir le mot (MC)'; },
      onpointerleave: (e) => { e.currentTarget.textContent = '👁 Maintenir pour voir le mot (MC)'; },
    }, '👁 Maintenir pour voir le mot (MC)') : null;
    return h('div.play.mot', head,
      h('div.mot-top',
        h('div.mot-describer', avatar(d, { size: 'lg' }), h('div', h('div.spot-name', d.name), team ? teamTag(team) : null)),
        h('div.mot-timer', h('span', { 'data-countdown': '' }, '')),
        h('div.mot-score', h('div.mot-found', found), h('small', 'mot(s) trouvé(s)')),
      ),
      h('div.mot-cat', `Catégorie du mot en cours : ${p.wordCat || '?'}`),
      h('div.feed', p.feed.slice(-10).map((f) => h('span.feed-item', avatar(playerById(s, f.pid), { size: 'sm' }), f.text))),
      wordsList,
      isHost ? h('div.mot-host', peek, h('button.btn.btn-danger', { onclick: () => hostAct({ type: 'carton' }) }, '🟥 Carton rouge (mot interdit)')) : null,
      p.claims.length ? h('div.claims', `🚩 Réclamation de ${p.claims.map((id) => playerById(s, id).name).join(', ')} : carton rouge ?`) : null,
    );
  }
  return h('div.play.mot', head,
    h('div.big-title', `⏱️ Fin du tour de ${d.name} : ${found} mot(s) trouvé(s)`),
    h('div.words-recap', p.words.map((w) => h(`div.word-recap.${w.status}`, h('strong', w.mot), h('small', `interdits : ${w.interdits.join(', ')}`), h('span', { found: '✅ trouvé', stolen: '🦹 volé', passed: '⏭ passé', carton: '🟥 carton', timeout: '⌛ temps écoulé' }[w.status] + (w.by ? ` par ${playerById(s, w.by).name}` : ''))))),
    p.claims.length ? h('div.claims', `🚩 Réclamation de ${p.claims.map((id) => playerById(s, id).name).join(', ')} : le MC peut encore sortir le carton.`) : null,
    isHost ? h('div.mot-host', h('button.btn.btn-danger', { onclick: () => hostAct({ type: 'carton' }) }, '🟥 Carton rouge rétroactif')) : null,
  );
}

// ───── Bluff ─────
function bluffHost(s, p, fresh) {
  const head = roundTag(s, `Manche ${p.manche + 1} / ${p.total}`);
  const deck = h('div.deck', p.deck.map((c) => h('span.deck-card', { title: c.desc }, h('span.deck-emoji', c.emoji), h('span', `${c.n > 1 ? c.n + '× ' : ''}${c.name}`))));
  const question = h('div.q-card', h('div.q-type', '🎭 BLUFF'), h('div.q-text', p.q.q));
  const opts = (rv) => h('div.options', p.q.options.map((o, i) => {
    const voters = rv ? Object.entries(p.answers).filter(([, v]) => v === i).map(([id]) => id) : [];
    return h(`div.option${rv ? (p.answer === i ? '.correct' : '.wrong') : ''}`, { style: { '--c': OPTION_COLORS[i] } },
      h('span.opt-letter', LETTERS[i]), h('span.opt-text', o),
      rv ? h('span.opt-voters', voters.map((id) => avatar(playerById(s, id), { size: 'sm' }))) : null,
      rv && p.answer === i ? stamp('VRAIE RÉPONSE', true, { small: true }) : null);
  }));
  if (p.stage === 'cards') {
    return h('div.play.bluff', head, h('div.big-title', '🃏 Distribution des cartes secrètes… regardez votre écran !'), question, h('h3.section-title', 'Cartes en jeu dans cette manche'), deck);
  }
  if (p.stage === 'discuss') {
    return h('div.play.bluff', head,
      h('div.discuss-banner', '🗣️ DISCUSSION LIBRE — Partagez vos infos… ou mentez. Alliances et trahisons autorisées.'),
      question, opts(false), h('h3.section-title', 'Cartes en jeu'), deck);
  }
  if (p.stage === 'act') {
    return h('div.play.bluff', head, h('div.big-title', '🗳️ Votez et utilisez vos pouvoirs sur votre écran'), question, opts(false), answeredBar(s, p.locked, 'ont verrouillé'));
  }
  if (fresh) sfx.reveal();
  const owners = Object.entries(p.cards || {});
  return h('div.play.bluff', head, question, opts(true),
    h('div.bluff-reveal',
      h('div.card-owners', owners.map(([id, c]) => h('span.owner', avatar(playerById(s, id), { size: 'sm' }), h('span', playerById(s, id).name), h('span.owner-card', `${c.emoji} ${c.name}`), p.results && p.results[id] ? h(`strong${p.results[id] < 0 ? '.neg' : ''}`, signed(p.results[id])) : null))),
      h('div.bluff-log', (p.log || []).map((l, i) => h('div.log-line', { style: { '--i': i } }, l))),
    ),
    p.info ? h('div.explain', h('span.explain-icon', '📎'), p.info) : null,
  );
}

// ───── Enchères ─────
function encheresHost(s, p, fresh) {
  const lot = p.lot;
  const head = roundTag(s, `Lot ${p.index + 1} / ${p.total}`);
  const coins = h('div.coins-board', s.players.map((pl) => h(`span.coin-chip${p.blocked === pl.id ? '.blocked' : ''}${p.bidders && p.bidders.includes(pl.id) && p.stage === 'bid' ? '.bid' : ''}`, avatar(pl, { size: 'sm' }), h('span', pl.name), h('strong', `🪙 ${fmt(p.coins[pl.id] || 0)}`), p.multipliers && p.multipliers[pl.id] ? h('span.mult', '×2') : null)));
  const lotCard = lot ? h(`div.lot-card${lot.final ? '.final' : ''}`,
    h('div.lot-type', `${lot.emoji} ${lot.label}`),
    h('div.lot-title', lot.titre),
    h('div.lot-text', lot.texte),
    lot.cat ? h('div.lot-cat', `Catégorie : ${lot.cat} · ${'🌶️'.repeat(lot.d || 1)}`) : null,
    lot.final ? h('div.lot-final', '🏆 LOT FINAL — gains ×1,5') : null,
  ) : null;
  if (p.stage === 'present') return h('div.play.encheres', head, h('div.big-title', '🔨 Mesdames et messieurs, le lot suivant…'), lotCard, coins);
  if (p.stage === 'bid') return h('div.play.encheres', head, lotCard, h('div.big-title', '🤫 Enchères secrètes en cours…'), answeredBar(s, p.bidders, 'ont enchéri'), coins);
  const bids = p.bids ? Object.entries(p.bids).sort((a, b) => b[1] - a[1]) : [];
  const bidList = h('div.bid-list', bids.map(([id, amount], i) => h(`div.bid-row${id === p.winner ? '.winner' : ''}`, { style: { '--i': bids.length - i } },
    avatar(playerById(s, id)), h('span', playerById(s, id).name), h('strong', amount ? `🪙 ${fmt(amount)}` : 'passe'), id === p.winner ? h('span.hammer', '🔨 ADJUGÉ') : null)));
  const winner = p.winner ? playerById(s, p.winner) : null;
  if (p.stage === 'bids') {
    if (fresh) setTimeout(() => sfx.coin(), 600);
    return h('div.play.encheres', head, lotCard, h('div.big-title', winner ? `🔨 Adjugé à ${winner.name} pour 🪙 ${fmt(p.winBid)} !${p.tie ? ' (égalité : avantage au moins bien classé)' : ''}` : '🦗 Aucune enchère…'), bidList);
  }
  if (p.stage === 'answer') {
    return h('div.play.encheres', head,
      winner ? h('div.winner-spot', avatar(winner, { size: 'lg' }), h('span', `${winner.name} joue pour 🪙 ${fmt(p.winBid)}`)) : h('div.winner-spot', 'Tout le monde répond !'),
      h('div.q-card', h('div.q-text', p.question.q)),
      h('div.options', p.question.options.map((o, i) => h('div.option', { style: { '--c': OPTION_COLORS[i] } }, h('span.opt-letter', LETTERS[i]), h('span.opt-text', o)))),
      answeredBar(s, p.answered || []),
    );
  }
  if (p.stage === 'choose') {
    return h('div.play.encheres', head, lotCard, h('div.big-title', `🤔 ${winner ? winner.name : '?'} choisit…`), h('div.choices', (p.choices || []).map((c) => h('span.choice-chip', c.avatar || '', c.label, c.points ? ` (+${c.points})` : ''))));
  }
  if (p.stage === 'result') {
    const o = p.outcome || {};
    const ok = o.delta && winner && o.delta[winner.id] > 0;
    if (fresh) setTimeout(() => (ok ? (sfx.fanfare(), confetti(80)) : sfx.bad()), 300);
    return h('div.play.encheres', head,
      p.question ? h('div.q-card.small', h('div.q-text', p.question.q)) : lotCard,
      p.question ? h('div.options', p.question.options.map((opt, i) => h(`div.option${o.answer === i ? '.correct' : '.wrong'}`, { style: { '--c': OPTION_COLORS[i] } }, h('span.opt-letter', LETTERS[i]), h('span.opt-text', opt), o.answers ? h('span.opt-voters', Object.entries(o.answers).filter(([, v]) => v === i).map(([id]) => avatar(playerById(s, id), { size: 'sm' }))) : null))) : null,
      h('div.outcome', o.text),
      o.info ? h('div.explain', h('span.explain-icon', '📎'), o.info) : null,
      coins,
    );
  }
  // final
  return h('div.play.encheres', head, h('div.big-title', '💱 Conversion des Audit Coins restants (20 %)'),
    h('div.bid-list', Object.entries(p.conversion || {}).sort((a, b) => b[1] - a[1]).map(([id, pts]) => h('div.bid-row', avatar(playerById(s, id)), h('span', playerById(s, id).name), h('strong', `+${fmt(pts)} pts`)))));
}

// ───────────── Classement d'épreuve ─────────────
function roundEnd(s, fresh) {
  const lr = s.lastRound;
  if (fresh) setTimeout(() => confetti(60), 1600);
  const side = [];
  if (lr && lr.best) {
    const p = playerById(s, lr.best.id);
    side.push(h('div.award.award-gold', h('div.award-title', '⭐ JOUEUR DE LA MANCHE'), avatar(p, { size: 'lg' }), h('div.award-name', p.name), h('div.award-pts', signed(lr.best.gain)), h('div.award-quip', lr.best.quip)));
  }
  if (lr && lr.worst) {
    const p = playerById(s, lr.worst.id);
    side.push(h('div.award.award-grey', h('div.award-title', '🐌 BOULET DE LA MANCHE'), avatar(p), h('div.award-name', p.name), h('div.award-pts', signed(lr.worst.gain)), h('div.award-quip', lr.worst.quip)));
  }
  if (lr && lr.team) {
    const t = lr.team.winner;
    side.push(h('div.award.award-team', { style: { '--team': t.hex } }, h('div.award-title', `🏅 ÉQUIPE GAGNANTE : ${t.emoji} ${t.color}`), h('div.award-name', t.name), avatarRow(s, t.members, { names: true }), h('div.award-quip', `+${lr.team.bonus} pts de bonus chacun`)));
  }
  return h('div.round-end',
    h('h1.re-title', `🏆 CLASSEMENT — après ${lr ? lr.emoji + ' ' + lr.name : ''}`),
    h('div.re-grid', h('div.re-board', leaderboard(s, { animate: fresh })), h('div.re-side', side)),
  );
}

// ───────────── Événement ─────────────
function eventScreen(s, fresh) {
  const e = s.event;
  if (!e) return h('div');
  if (fresh) sfx.siren();
  const it = e.interactive;
  const deltas = Object.entries(e.deltas || {});
  return h('div.event-screen',
    h('div.ev-flash', '⚠️ ÉVÉNEMENT ⚠️'),
    h('div.ev-emoji', e.emoji),
    h('h1.ev-title', e.titre),
    h('p.ev-text', e.texte),
    e.flavor ? h('p.ev-flavor', e.flavor) : null,
    e.lines && e.lines.length ? h('div.ev-lines', e.lines.map((l) => h('p', l))) : null,
    it && it.kind === 'defi' ? h('div.ev-defi',
      h('div.q-card', h('div.q-text', it.q)),
      h('div.options', it.options.map((o, i) => h(`div.option${it.answer !== undefined ? (it.answer === i ? '.correct' : '.wrong') : ''}`, { style: { '--c': OPTION_COLORS[i] } }, h('span.opt-letter', LETTERS[i]), h('span.opt-text', o), it.answers ? h('span.opt-voters', Object.entries(it.answers).filter(([, v]) => v === i).map(([id]) => avatar(playerById(s, id), { size: 'sm' }))) : null))),
      e.stage === 'interactive' ? h('div.answered', h('span', 'Répondent : '), avatarRow(s, it.players), h('span.muted', ` (${it.answered.length} / ${it.players.length})`)) : null,
    ) : null,
    it && it.kind === 'don' && e.stage === 'interactive' ? h('div.big-title', `🎁 ${playerById(s, it.chooser).name} choisit l’heureux bénéficiaire…`) : null,
    deltas.length ? h('div.gains', deltas.map(([id, d]) => h(`span.gain${d < 0 ? '.neg' : ''}`, avatar(playerById(s, id), { size: 'sm' }), playerById(s, id).name, h('strong', signed(d))))) : null,
  );
}

// ───────────── Finale ─────────────
function finalScreen(s, isHost, fresh) {
  const f = s.final;
  if (!f || !f.ranking.length) return h('div', 'Aucun joueur…');
  const champ = f.ranking[0];
  const cp = playerById(s, champ.id);
  if (fresh) {
    setTimeout(() => sfx.fanfare(), 2200);
    setTimeout(() => confetti(250), 2600);
    setTimeout(() => confetti(150), 4200);
  }
  return h('div.final',
    h('div.final-head', h('div.final-kicker', `🏆 CHAMPION DES OLYMPIADES ${f.year}`), h('div.final-name', cp.name)),
    h('div.final-top',
      podium(s),
      h('div.champ-card',
        h('div.champ-avatar', cp.avatar),
        h('div.champ-stats',
          h('div', h('strong', fmt(champ.score)), ' points'),
          h('div', h('strong', champ.roundWins), ` épreuve${champ.roundWins > 1 ? 's' : ''} remportée${champ.roundWins > 1 ? 's' : ''}`),
          h('div', h('strong', champ.podiums), ' podiums d’épreuve'),
          champ.accuracy !== null ? h('div', h('strong', `${champ.accuracy} %`), ' de réussite') : null,
          h('div', h('strong', champ.betrayals), ` collègue${champ.betrayals > 1 ? 's' : ''} trahi${champ.betrayals > 1 ? 's' : ''}`),
        ),
        h('blockquote.champ-quote', `« ${champ.quote} »`),
      ),
    ),
    h('h2.section-title', '🎖️ Trophées de la soirée'),
    h('div.trophies', f.trophies.map((t, i) => h('div.trophy', { style: { '--i': i } }, h('div.trophy-emoji', t.emoji), h('div.trophy-title', t.title), h('div.trophy-name', playerById(s, t.id).name), h('div.trophy-detail', t.detail)))),
    f.bestTeam || f.bestDuo ? h('div.final-teams',
      f.bestTeam ? h('div.award.award-team', { style: { '--team': f.bestTeam.hex } }, h('div.award-title', `🏅 MEILLEURE ÉQUIPE DE LA SOIRÉE (${f.bestTeam.emoji} ${f.bestTeam.round})`), h('div.award-name', f.bestTeam.name), avatarRow(s, f.bestTeam.members, { names: true }), h('div.award-quip', `${fmt(f.bestTeam.avg)} pts de moyenne sur l’épreuve`)) : null,
      f.bestDuo ? h('div.award.award-gold', h('div.award-title', '🤝 DUO INFERNAL'), avatarRow(s, f.bestDuo.ids, { names: true }), h('div.award-quip', `${f.bestDuo.n} épreuve(s) ensemble, ${fmt(f.bestDuo.avg)} pts de moyenne`)) : null,
    ) : null,
    h('h2.section-title', '📰 Le résumé de la soirée'),
    h('div.summary', f.summary.map((l, i) => h('p', { style: { '--i': i } }, l))),
    h('h2.section-title', '📋 Classement général'),
    h('table.final-table',
      h('thead', h('tr', h('th', '#'), h('th', 'Joueur'), h('th', 'Points'), h('th', 'Victoires'), h('th', 'Réussite'), h('th', 'Série'), h('th', 'Trahisons'), h('th', 'Titres'))),
      h('tbody', f.ranking.map((r) => {
        const p = playerById(s, r.id);
        return h('tr', h('td', r.rank), h('td', `${p.avatar} ${p.name}`), h('td', fmt(r.score)), h('td', r.roundWins), h('td', r.accuracy !== null ? `${r.accuracy} %` : '–'), h('td', r.bestStreak ? `🔥${r.bestStreak}` : '–'), h('td', r.betrayals), h('td.titles', (r.titles || []).slice(0, 2).join(' · ')));
      })),
    ),
    isHost ? h('div.final-actions', h('button.btn.btn-gold.btn-big', { onclick: () => hostAct({ type: 'rematch' }) }, '🔁 Revanche (mêmes joueurs)'), h('a.btn.btn-ghost.btn-big', { href: '/host' }, '🆕 Nouvelle partie')) : null,
  );
}
