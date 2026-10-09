// Écran joueur (téléphone ou ordinateur) : rejoindre, répondre, bluffer, enchérir.

import { h, fmt, fmtNum, signed, LETTERS, OPTION_COLORS, sfx, confetti, pick } from './lib.js';
import { app, act, joinGame } from './app.js';
import { playerById, avatar, chip, stamp, teamTag, teamOf, chart, avatarRow } from './components.js';

const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐨', '🐵', '🦉', '🐧', '🐢', '🐝', '🦖', '🐳', '🦩', '🧮', '📎', '📊', '☕', '⚽', '🏆', '🕵️', '🧾', '🤓', '😎', '🥸', '🤠', '👑', '🚀'];
const WAIT = [
  'Réponse envoyée. Comme une petite relance : maintenant, on attend.',
  'Validé. Ta réponse est partie en revue.',
  'Écriture passée. Pas de contre-passation possible.',
  'Bien reçu. On ne touche plus à rien.',
];
const OK_WORDS = ['VALIDÉ', 'CERTIFIÉ', 'LETTRÉ', 'SANS RÉSERVE', 'JUSTIFIÉ'];
const KO_WORDS = ['REFUSÉ', 'À JUSTIFIER', 'ÉCART', 'NON CONFORME', 'POINT DE REVUE'];
const MOD_LABEL = {
  noSpeed: '📞 Le client t’appelle : pas de bonus de rapidité pendant cette épreuve.',
  blind: '🧾 Pièces manquantes : une réponse sera indisponible à chaque question.',
  noLoss: '🛡️ Protégé : aucune perte de points pendant cette épreuve.',
  mult: '✖️ Tes gains sont multipliés pendant cette épreuve !',
};

// ───────────── Rejoindre ─────────────
export function joinView() {
  if (app.homonymes === undefined && app.code) {
    app.homonymes = null;
    fetch(`/api/game/${app.code}`).then((r) => r.json()).then((d) => {
      app.homonymes = d.homonymes || [];
      if (!d.exists) app.joinError = app.joinError || 'Code de partie inconnu. Vérifie auprès du MC !';
      if (!app.joined && (app.homonymes.length || !d.exists)) app.rerender();
    }).catch(() => { app.homonymes = []; });
  }
  if (app.playerToken && !app.joinError) {
    return h('div.loading', h('div.spinner'), h('p', 'Reconnexion à la partie…'));
  }
  // Sans choix explicite, le joueur reconnu dans le trombinoscope reçoit l'emoji de sa fiche
  let chosen = app.playerAvatar || '';
  const name = h('input.input', { placeholder: 'Ton prénom (ex. « Hélène »)', maxlength: 24, value: app.playerName || '', autocomplete: 'nickname', 'aria-label': 'Pseudo' });
  const grid = h('div.avatar-picker', AVATARS.map((a) => h(`button.av-pick${a === chosen ? '.on' : ''}`, {
    type: 'button',
    onclick: (e) => {
      if (chosen === a) { chosen = ''; e.currentTarget.classList.remove('on'); return; }
      chosen = a; grid.querySelectorAll('.av-pick').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on');
    },
  }, a)));
  const submit = () => {
    const n = name.value.trim();
    if (!n) { name.classList.add('shake'); setTimeout(() => name.classList.remove('shake'), 500); return; }
    app.joinError = null;
    joinGame(n, chosen);
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  setTimeout(() => name.focus(), 50);
  return h('div.join',
    h('div.join-card',
      h('div.hero-badge', 'AUDIT GAMES 2026'),
      h('h1', 'Les Olympiades du Cabinet'),
      h('div.join-code', 'Partie ', h('strong', app.code)),
      name,
      h('div.join-label', 'Choisis ton avatar (facultatif)'),
      grid,
      app.joinError ? h('div.join-error', `⚠️ ${app.joinError}`) : null,
      h('button.btn.btn-gold.btn-big.btn-block', { onclick: submit }, 'Entrer dans le vestiaire 🏟️'),
      h('p.muted.small', 'Entre ton prénom (ou « Prénom Nom ») : le jeu te reconnaît grâce au trombinoscope.'),
      app.homonymes && app.homonymes.length ? h('p.muted.small', `Homonymes dans l’équipe (${app.homonymes.join(', ')}) : ajoute l’initiale du nom, ex. « ${app.homonymes[0]} B. ».`) : null,
    ),
  );
}

// ───────────── En-tête joueur ─────────────
export function playerHeader(s) {
  const me = s.me || {};
  const team = s.teams ? teamOf(s, me.id) : null;
  return h('div.ph',
    h('span.ph-av', me.avatar),
    h('div.ph-id', h('div.ph-name', me.name), team ? teamTag(team) : h('div.ph-code', `Partie ${s.code}`)),
    h('div.ph-score', h('div.ph-pts', fmt(me.score)), h('div.ph-rank', s.phase === 'lobby' ? 'pts' : `#${me.rank || '–'} · pts`)),
  );
}

// ───────────── Aiguillage ─────────────
export function playerView(s) {
  const me = s.me || {};
  const base = `${s.phase}|${s.roundIndex}`;
  switch (s.phase) {
    case 'lobby': return { key: `${base}|${s.players.map((p) => p.id + p.avatar + p.connected).join()}|${me.avatar}`, build: () => lobby(s) };
    case 'roundIntro': return { key: `${base}|${(s.teams || []).map((t) => t.members.join()).join('/')}`, build: (fresh) => roundIntro(s, fresh) };
    case 'roundEnd': return { key: base, build: (fresh) => roundEnd(s, fresh) };
    case 'event': return eventView(s);
    case 'final': return { key: base, build: (fresh) => finalView(s, fresh) };
    case 'play': return playView(s);
    default: return { key: base, build: () => h('div', '…') };
  }
}

function card(...children) {
  return h('div.p-card', ...children);
}

function waiting(text, extra) {
  return h('div.p-wait', h('div.p-wait-emoji', pick(['⏳', '☕', '📎', '🧾'])), h('p', text || pick(WAIT)), extra);
}

// ───────────── Lobby ─────────────
function lobby(s) {
  const me = s.me;
  return h('div.p-lobby',
    h('div.p-ok', '✅ Tu es dans la partie !'),
    me.profile ? card(h('div.p-profile', me.profile.gradeLabel ? h('div.pc-grade', me.profile.gradeLabel) : null, h('div.p-profile-title', `🏷️ ${me.profile.titre}`), h('p', me.profile.intro))) : h('p.p-hint', 'Pas de fiche trombinoscope reconnue pour ce pseudo (pas grave : tu joues normalement).'),
    card(h('div.join-label', 'Change d’avatar si tu veux'),
      h('div.avatar-picker.small', AVATARS.map((a) => h(`button.av-pick${a === me.avatar ? '.on' : ''}`, { onclick: () => { act({ type: 'avatar', avatar: a }); } }, a)))),
    h('p.p-hint', '🎤 Le maître de cérémonie va bientôt lancer les Olympiades. Garde cet écran ouvert : c’est ta manette.'),
    h('div.p-players', s.players.map((p) => chip(p))),
  );
}

// ───────────── Intro d'épreuve ─────────────
function roundIntro(s, fresh) {
  const r = s.round;
  const me = s.me;
  const team = s.teams ? teamOf(s, me.id) : null;
  if (fresh) sfx.whistle();
  const mods = Object.keys(me.mods || {}).map((m) => h('div.mod-banner.small', MOD_LABEL[m] || m));
  return h('div.p-intro',
    h('div.p-round-emoji', r.emoji),
    h('div.p-round-num', `ÉPREUVE ${r.index + 1} / ${s.rounds.length}`),
    h('h2.p-round-name', r.name),
    h('p.p-tagline', r.tagline),
    team ? card(h('div.p-team', { style: { '--team': team.hex } },
      h('div.p-team-head', `${team.emoji} ÉQUIPE ${team.color}`),
      h('div.p-team-name', team.name),
      h('div.p-team-mates', team.members.filter((m) => m !== me.id).map((m) => chip(playerById(s, m)))))) : null,
    me.outsider ? h('div.mod-banner.small', '🚀 Prime d’outsider : +20 % sur tes gains pendant cette épreuve !') : null,
    s.roundMods && s.roundMods.mult > 1 ? h('div.mod-banner.small', `💀 Tous les points ×${String(s.roundMods.mult).replace('.', ',')} !`) : null,
    mods,
    h('details.p-rules', { open: true }, h('summary', '📜 Règles'), h('ul', r.rules.map((x) => h('li', x)))),
  );
}

// ───────────── Jeu ─────────────
function playView(s) {
  const p = s.play;
  const base = `play|${s.roundIndex}`;
  switch (p.kind) {
    case 'questions': return questionsView(s, p, base);
    case 'menteur': return menteurView(s, p, base);
    case 'reaction': return reactionView(s, p, base);
    case 'mot': return motView(s, p, base);
    case 'bluff': return bluffView(s, p, base);
    case 'encheres': return encheresView(s, p, base);
    default: return { key: base, build: () => h('div') };
  }
}

function resultBanner(res, opts = {}) {
  if (!res) return null;
  if (res.missing) return h('div.p-result.neutral', h('div.p-result-big', '⌛'), h('p', 'Pas de réponse… le client attend toujours.'));
  const ok = opts.ok !== undefined ? opts.ok : res.correct;
  return h(`div.p-result${ok ? '.ok' : '.ko'}`,
    stamp(ok ? pick(OK_WORDS) : pick(KO_WORDS), ok),
    h('div.p-points', signed(res.points || 0), h('small', ' pts')),
    res.streak >= 3 ? h('div.p-streak', `🔥 Série de ${res.streak} !`) : null,
    res.tags && res.tags.length ? h('div.p-tags', res.tags.join(' · ')) : null,
    opts.extra || null,
  );
}

// ───── Questions ─────
function questionsView(s, p, base) {
  const it = p.item;
  const me = p.me || {};
  let key = `${base}|q|${p.index}|${p.stage}|${me.answered ? 1 : 0}`;
  if (it.type === 'order') key += `|${(app.local[`order-${s.roundIndex}-${p.index}`] || []).length}`;
  return { key, build: (fresh) => buildQuestion(s, p, fresh), update: () => {} };
}

function buildQuestion(s, p, fresh) {
  const it = p.item;
  const me = p.me || {};
  const target = it.target ? playerById(s, it.target) : null;
  const head = h('div.p-qhead', h('span', `${s.round.emoji} ${p.index + 1}/${p.total}`), it.difficultyLabel && !['vote', 'predict', 'predictNumber', 'estimate', 'order'].includes(it.type) ? h('span.p-diff', it.difficultyLabel) : null);
  const qText = h('div.p-q', it.q);
  const extras = [];
  if (it.visual) extras.push(h('div.q-visual.small', it.visual));
  if (it.chart) extras.push(chart(it.chart, { height: 300 }));

  if (p.stage === 'reveal') {
    const res = me.result;
    if (fresh && res) { if (res.correct || res.points > 0) { sfx.good(); confetti(30, { y: 0.8, x: 0.5 }); } else if (!res.missing) sfx.bad(); }
    let answerText = null;
    const rv = p.reveal || {};
    if (it.type === 'mcq') answerText = `Bonne réponse : ${LETTERS[rv.answer]} — ${it.options[rv.answer]}`;
    if (it.type === 'predict' && rv.answer !== undefined) answerText = `${target ? target.name : '?'} a répondu : ${it.options[rv.answer]}`;
    if (it.type === 'number' || it.type === 'estimate') answerText = `Réponse : ${fmtNum(rv.answer)} ${it.unit || ''}`;
    if (it.type === 'predictNumber' && !rv.cancelled) answerText = `${target ? target.name : '?'} a répondu : ${fmtNum(rv.answer)} ${it.unit || ''}`;
    if (it.type === 'order' && rv.ordered) answerText = `Ordre : ${rv.ordered.join(' › ')}`;
    if (it.type === 'vote' && rv.elected) answerText = `Élu(e) : ${rv.elected.map((id) => playerById(s, id).name).join(', ')}`;
    let banner;
    if (me.isTarget && res && it.type === 'predictNumber') banner = h('div.p-result.neutral', h('div.p-result-big', '🪞'), h('p', `Merci pour ta transparence : +${res.points || 0} pts`));
    else if (me.isTarget && res) banner = h('div.p-result.neutral', h('div.p-result-big', '🪞'), h('p', `Tes collègues te connaissent… ${res.points ? `+${res.points} pts` : 'mal !'}`));
    else if (it.type === 'vote' && res) banner = resultBanner(res, { ok: res.correct, extra: h('p', res.correct ? 'Tu as voté avec la majorité 🤝' : 'Minorité… tu pensais différemment') });
    else banner = resultBanner(res);
    return h('div.p-question', head, qText, banner, answerText ? h('div.p-answer', answerText) : null, it.chart ? chart(it.chart, { height: 300 }) : null, rv.explain ? h('div.explain', h('span.explain-icon', '📎'), rv.explain) : null);
  }

  if (me.answered) {
    let mine = '';
    if (it.type === 'mcq' || it.type === 'predict') mine = `${LETTERS[me.value]} — ${it.options[me.value]}`;
    else if (it.type === 'vote') mine = playerById(s, me.value).name;
    else if (it.type === 'order') mine = me.value.map((i) => it.items.find((x) => x.id === i).label).join(' › ');
    else mine = `${fmtNum(me.value)} ${it.unit || ''}${me.risk ? ' 🎲 (pari ×2)' : ''}`;
    return h('div.p-question', head, qText, waiting(null, h('div.p-mine', 'Ta réponse : ', h('strong', mine))));
  }

  let input;
  if (it.type === 'mcq' || it.type === 'predict') {
    input = h(`div.p-options${it.options.length === 2 ? '.two' : ''}`, it.options.map((o, i) => {
      const disabled = me.disabled === i;
      return h(`button.p-opt${disabled ? '.disabled' : ''}`, { style: { '--c': OPTION_COLORS[i] }, disabled, onclick: () => { sfx.click(); act({ type: 'answer', value: i }); } },
        h('span.opt-letter', LETTERS[i]), h('span', disabled ? '🧾 Pièce manquante' : o));
    }));
  } else if (it.type === 'vote') {
    input = h('div.p-vote', it.options.map((id) => {
      const pl = playerById(s, id);
      return h('button.p-vote-btn', { onclick: () => { sfx.click(); act({ type: 'answer', value: id }); } }, h('span.p-vote-av', pl.avatar), h('span', pl.name));
    }));
  } else if (['number', 'estimate', 'predictNumber'].includes(it.type)) {
    const field = h('input.input.p-num', { 'data-keep': `num-${p.index}`, inputmode: it.type === 'estimate' ? 'text' : 'decimal', placeholder: it.type === 'estimate' ? 'ex : 3,5M · 12 000 · 2 milliards' : 'Ta réponse', autocomplete: 'off', enterkeyhint: 'send' });
    const risk = it.allowRisk ? h('label.toggle.risk', h('input', { type: 'checkbox', 'data-keep': `risk-${p.index}` }), h('span', '🎲 Pari ×2 (tiers de tête : ×2 · sinon −50)')) : null;
    const send = () => {
      const v = field.value.trim();
      if (!v) return;
      act({ type: 'answer', value: v, risk: risk ? risk.querySelector('input').checked : false });
    };
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input = h('div.p-numwrap', h('div.p-numrow', field, it.unit ? h('span.p-unit', it.unit) : null), risk, h('button.btn.btn-gold.btn-big.btn-block', { onclick: send }, 'Valider'));
    if (fresh) setTimeout(() => field.focus(), 80);
  } else if (it.type === 'order') {
    const k = `order-${s.roundIndex}-${p.index}`;
    app.local[k] = app.local[k] || [];
    const seq = app.local[k];
    const redraw = () => app.rerender();
    input = h('div.p-order',
      h('div.p-order-seq', it.items.map((_, i) => h('div.p-slot', seq[i] !== undefined ? `${i + 1}. ${it.items.find((x) => x.id === seq[i]).label}` : `${i + 1}. …`))),
      h('div.p-order-items', it.items.filter((x) => !seq.includes(x.id)).map((x) => h('button.btn.btn-ghost', { onclick: () => { seq.push(x.id); sfx.click(); if (seq.length === it.items.length) act({ type: 'answer', value: seq.slice() }); else redraw(); } }, x.label))),
      seq.length ? h('button.btn.btn-small.btn-ghost', { onclick: () => { app.local[k] = []; redraw(); } }, '↺ Recommencer') : null,
    );
  }
  const preface = it.type === 'predict' || it.type === 'predictNumber'
    ? h(`div.p-banner${me.isTarget ? '.gold' : ''}`, me.isTarget
      ? (it.type === 'predictNumber' ? '🪞 C’est sur TOI ! Donne ton VRAI chiffre (vérifie si tu peux) : tes collègues doivent l’estimer.' : '🪞 C’est sur TOI ! Réponds honnêtement… tes collègues doivent deviner.')
      : (it.type === 'predictNumber' ? `🪞 Estime le chiffre de ${target ? target.name : '?'} !` : `🪞 Que va répondre ${target ? target.name : '?'} ?`))
    : it.type === 'vote' ? h('div.p-banner', '🗳️ Vote pour un collègue (tu marques si tu votes comme la majorité)') : null;
  return h('div.p-question', head, preface, qText, extras, input);
}

// ───── Menteur ─────
function menteurView(s, p, base) {
  const me = p.me || {};
  const votes = me.votes || {};
  const key = `${base}|m|${p.stage}|${p.pleadIdx}|${p.revealIdx}|${JSON.stringify(votes)}`;
  return { key, build: (fresh) => buildMenteur(s, p, fresh) };
}

function secretCard(s, me, compact) {
  if (!me || me.spectator) return null;
  const r = me.roleInfo;
  return h(`div.secret${compact ? '.compact' : ''}${r.lying ? '.lie' : '.truth'}`,
    h('div.secret-head', h('span.secret-emoji', r.emoji), h('span', `Ton rôle : ${r.name}`)),
    h('div.secret-statement', `« ${me.statement} »`),
    compact ? null : h('div.secret-mission', r.mission),
    me.targetName ? h('div.secret-target', `🎯 Ta cible à faire accuser : ${me.targetName}`) : null,
  );
}

function buildMenteur(s, p, fresh) {
  const me = p.me || {};
  if (p.stage === 'brief') {
    if (fresh) sfx.reveal();
    if (me.spectator) return h('div.p-menteur', h('div.p-banner', '🧑‍⚖️ Tu fais partie du JURY'), h('p.p-hint', `${p.order.length} collègues vont plaider. Écoute, pose des questions… et démasque les menteurs (+25 pts par bon verdict).`));
    return h('div.p-menteur', h('div.p-banner.gold', '🤫 TOP SECRET — ne montre pas ton écran'), secretCard(s, me), h('p.p-hint', 'Prépare ton histoire : tu vas devoir plaider à l’oral.'));
  }
  if (p.stage === 'plead' || p.stage === 'vote') {
    const eligible = p.order.filter((id, i) => id !== s.me.id && (p.stage === 'vote' || i <= p.pleadIdx));
    const votes = me.votes || {};
    const pleader = p.pleader ? playerById(s, p.pleader) : null;
    return h('div.p-menteur',
      pleader ? h('div.p-banner', `🎤 ${pleader.name} plaide : « ${p.statements[pleader.id]} »`) : h('div.p-banner.gold', '🗳️ Dernier moment pour voter !'),
      p.pleader === s.me.id ? h('div.p-banner.gold', '🎙️ C’est TON tour : convaincs-les !') : null,
      h('div.vote-list', eligible.slice().reverse().map((id) => {
        const pl = playerById(s, id);
        const v = votes[id];
        return h(`div.vote-item${id === p.pleader ? '.current' : ''}`,
          h('div.vote-who', avatar(pl), h('div', h('strong', pl.name), h('small', `« ${p.statements[id]} »`))),
          h('div.vote-btns',
            h(`button.btn.btn-small${v === 'truth' ? '.btn-green' : '.btn-ghost'}`, { onclick: () => { sfx.click(); act({ type: 'vote', target: id, value: 'truth' }); } }, '😇 Vérité'),
            h(`button.btn.btn-small${v === 'lie' ? '.btn-danger' : '.btn-ghost'}`, { onclick: () => { sfx.click(); act({ type: 'vote', target: id, value: 'lie' }); } }, '😈 Mensonge'),
          ));
      })),
      eligible.length ? null : h('p.p-hint', 'Les votes s’ouvrent après la première plaidoirie.'),
      secretCard(s, me, true),
    );
  }
  // révélation
  const mine = (p.revealed || []).find((r) => r.id === s.me.id);
  const last = p.revealed[p.revealed.length - 1];
  const lastP = last ? playerById(s, last.id) : null;
  if (fresh && mine && last && last.id === s.me.id) (mine.points > 0 ? sfx.good : sfx.bad)();
  return h('div.p-menteur',
    last ? card(h('div.p-reveal', avatar(lastP, { size: 'lg' }), h('strong', lastP.name), stamp(last.roleInfo.lying ? 'MENSONGE' : 'VÉRITÉ', !last.roleInfo.lying, { small: true }), h('div', `${last.roleInfo.emoji} ${last.roleInfo.name}`), h('div.muted', `${last.believed.length} l’ont cru · ${last.doubted.length} ont douté`))) : null,
    mine ? h('div.p-result.neutral', h('p', `Ton rôle de ${mine.roleInfo.name} t’a rapporté ${signed(mine.points)} pts`), mine.fooled ? h('p', `🗡️ ${mine.fooled} collègue(s) berné(s)`) : null) : null,
    p.detective && p.detective[s.me.id] ? h('div.p-result.ok', h('p', `🕵️ Flair de détective : ${signed(p.detective[s.me.id])} pts`)) : null,
  );
}

// ───── Réaction ─────
function reactionView(s, p, base) {
  const me = p.me || {};
  const key = `${base}|r|${p.index}|${p.stage}|${me.answer ? 1 : 0}`;
  return { key, build: (fresh) => buildReaction(s, p, fresh), update: () => {} };
}

function sendReact(start, value, extra = {}) {
  const ms = Math.round(performance.now() - start);
  act({ type: 'react', value, ms, ...extra });
}

function buildReaction(s, p, fresh) {
  const g = p.game;
  const me = p.me || {};
  if (p.stage === 'ready') {
    return h('div.p-rx', h('div.rx-title', `⚡ ${g.title}`), h('div.rx-instr', g.instruction), h('div.rx-count', { 'data-countdown': '' }, '3'));
  }
  if (p.stage === 'reveal') {
    const r = me.result;
    if (fresh && r) (r.ok ? sfx.good : sfx.bad)();
    return h('div.p-rx', !r ? h('div.p-result.neutral', h('p', 'Pas de réponse !')) : r.early
      ? h('div.p-result.ko', h('div.p-result-big', '🟥'), h('p', 'FAUX DÉPART !'), h('div.p-points', signed(r.points)))
      : h(`div.p-result${r.ok ? '.ok' : '.ko'}`, stamp(r.ok ? (r.rank === 1 ? 'LE PLUS RAPIDE' : 'VALIDÉ') : 'RATÉ', r.ok), r.ms ? h('p', `${r.ms} ms${r.rank ? ` · #${r.rank}` : ''}`) : null, h('div.p-points', signed(r.points))));
  }
  if (me.answer) return h('div.p-rx', waiting(me.answer.early ? '🟥 Trop tôt…' : `Envoyé en ${me.answer.ms} ms !`));
  const start = performance.now();
  switch (g.type) {
    case 'signal': {
      let green = false;
      const pad = h('button.rx-signal', 'Attends le vert…');
      const timer = setTimeout(() => {
        if (!pad.isConnected) return;
        green = true;
        pad.classList.add('go');
        pad.textContent = 'CLIQUE !';
        pad.dataset.t = String(performance.now());
      }, g.delay);
      pad.addEventListener('pointerdown', () => {
        if (pad.dataset.sent) return;
        pad.dataset.sent = '1';
        if (!green) { clearTimeout(timer); pad.classList.add('early'); pad.textContent = '🟥 FAUX DÉPART'; act({ type: 'react', early: true, ms: 0 }); return; }
        sendReact(Number(pad.dataset.t), 'go');
      });
      return h('div.p-rx', h('div.rx-instr', g.instruction), pad);
    }
    case 'intrus':
    case 'ecart':
    case 'doublon':
      return h('div.p-rx', h('div.rx-instr', g.instruction), h(`div.rx-grid.play${g.text ? '.text' : ''}`, { style: { '--cols': g.cols } },
        g.grid.map((x, i) => h('button', { onclick: (e) => { e.currentTarget.classList.add('picked'); sendReact(start, i); } }, x))));
    case 'count':
      return h('div.p-rx', h('div.rx-instr', g.instruction), h('div.rx-grid.small', { style: { '--cols': g.cols } }, g.grid.map((x) => h('span', x))),
        h('div.p-options', g.options.map((o, i) => h('button.p-opt', { style: { '--c': OPTION_COLORS[i] }, onclick: () => sendReact(start, o) }, o))));
    case 'flash':
      return h('div.p-rx', h('div.rx-word', g.instruction), h('div.p-options', g.options.map((o, i) => h('button.p-opt', { style: { '--c': OPTION_COLORS[i] }, onclick: () => sendReact(start, o) }, o))));
    case 'stroop':
      return h('div.p-rx', h('div.rx-instr', g.instruction), h('div.rx-stroop', { style: { color: g.ink } }, g.word),
        h('div.p-options', g.options.map((o) => h('button.p-opt.stroop-opt', { onclick: () => sendReact(start, o) }, o))));
    case 'type': {
      const field = h('input.input.p-num', { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'Tape ici…', enterkeyhint: 'send' });
      const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      field.addEventListener('input', () => { if (norm(field.value) === norm(g.word)) sendReact(start, field.value); });
      field.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendReact(start, field.value); });
      setTimeout(() => field.focus(), 30);
      return h('div.p-rx', h('div.rx-word', g.word), field);
    }
    case 'memory': {
      const wrap = h('div.p-rx');
      const seqEl = h('div.rx-seq', g.sequence.map((i) => h('span', g.symbols[i])));
      wrap.append(h('div.rx-instr', 'Mémorise !'), seqEl);
      setTimeout(() => {
        if (!wrap.isConnected) return;
        const typed = [];
        const show = h('div.rx-seq.input', g.sequence.map(() => h('span', '·')));
        const t0 = performance.now();
        const pad = h('div.rx-pad', g.symbols.map((sym, i) => h('button', { onclick: () => {
          typed.push(i);
          show.children[typed.length - 1].textContent = sym;
          sfx.click();
          if (typed.length === g.sequence.length) sendReact(t0, typed);
        } }, sym)));
        wrap.replaceChildren(h('div.rx-instr', 'À toi ! Reproduis la séquence'), show, pad);
      }, g.showMs);
      return wrap;
    }
    default:
      return h('div.p-rx', 'Mini-jeu inconnu');
  }
}

// ───── Deviner un mot ─────
function motView(s, p, base) {
  const me = p.me || {};
  const role = me.isDescriber ? 'desc' : me.isTeammate ? 'mate' : 'opp';
  const key = `${base}|w|${p.turn}|${p.stage}|${role}|${me.isDescriber && p.word ? p.word.mot : ''}|${me.claimed ? 1 : 0}`;
  const isGuessing = p.stage === 'play' && !me.isDescriber;
  return {
    key,
    build: (fresh) => buildMot(s, p, fresh),
    update: isGuessing ? (st) => updateMot(st) : undefined,
  };
}

function feedEl(s, p) {
  return h('div.feed.p-feed', p.feed.slice(-8).map((f) => h('span.feed-item', avatar(playerById(s, f.pid), { size: 'sm' }), f.text)));
}

function wordsEl(s, p) {
  return h('div.words-done', p.words.map((w) => h(`span.word-done.${w.status}`, { found: '✅', stolen: '🦹', passed: '⏭', carton: '🟥', timeout: '⌛' }[w.status] + ' ' + w.mot)));
}

function updateMot(s) {
  const p = s.play;
  const f = document.getElementById('mot-feed');
  const w = document.getElementById('mot-words');
  if (f) f.replaceChildren(feedEl(s, p));
  if (w) w.replaceChildren(wordsEl(s, p));
}

function buildMot(s, p, fresh) {
  const me = p.me || {};
  const d = playerById(s, p.describer);
  if (p.stage === 'ready') {
    if (me.isDescriber) return h('div.p-mot', h('div.p-banner.gold', '🎙️ C’est TOI qui fais deviner !'), h('p.p-hint', 'Décris les mots à l’oral, sans prononcer les mots interdits. Appuie sur GO quand tu es prêt(e).'), h('button.btn.btn-gold.btn-huge', { onclick: () => act({ type: 'start' }) }, 'GO ! ⏱️'));
    return h('div.p-mot', h('div.p-banner', `🎙️ ${d.name} va faire deviner`), h('div.p-hint', me.isTeammate ? '✅ Tu es dans son équipe : tape tes propositions à toute vitesse !' : '🦹 Tu es adversaire : si tu trouves avant son équipe, tu VOLES les points !'));
  }
  if (p.stage === 'turnEnd') {
    return h('div.p-mot', h('div.p-banner', `⏱️ Fin du tour de ${d.name}`), h('div.words-recap', p.words.map((w) => h(`div.word-recap.${w.status}`, h('strong', w.mot), h('small', `interdits : ${w.interdits.join(', ')}`)))),
      !me.isDescriber && !me.isTeammate && !me.claimed ? h('button.btn.btn-ghost', { onclick: () => act({ type: 'claim' }) }, '🚩 Il/elle a dit un mot interdit !') : null);
  }
  if (me.isDescriber) {
    if (!p.word) return waiting('Chargement du mot…');
    if (fresh && p.words.length) sfx.good();
    return h('div.p-mot',
      h('div.word-card', h('div.word-cat', p.word.cat), h('div.word-main', p.word.mot), h('div.word-forbidden', p.word.interdits.map((x) => h('span', `❌ ${x}`)))),
      h('div.mot-actions', h('div.mot-timer.small', h('span', { 'data-countdown': '' }, '')), h('button.btn.btn-ghost', { onclick: () => act({ type: 'pass' }) }, '⏭ Passer (−10)')),
      h('div#mot-feed', feedEl(s, p)), h('div#mot-words', wordsEl(s, p)),
    );
  }
  const field = h('input.input.p-num', { 'data-keep': 'guess', placeholder: me.isTeammate ? 'Ta proposition…' : 'Vole le mot…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send' });
  const send = () => { const v = field.value.trim(); if (!v) return; act({ type: 'guess', text: v }); field.value = ''; field.focus(); };
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  setTimeout(() => field.focus(), 50);
  return h('div.p-mot',
    h(`div.p-banner${me.isTeammate ? '' : '.red'}`, me.isTeammate ? `✅ Devine le mot de ${d.name} !` : `🦹 ${d.name} parle à son équipe : vole-lui ses mots !`),
    h('div.mot-actions', h('div.mot-timer.small', h('span', { 'data-countdown': '' }, '')), h('span.muted', `Catégorie : ${p.wordCat || '?'}`)),
    h('div.p-guess', field, h('button.btn.btn-gold', { onclick: send }, 'Envoyer')),
    h('div#mot-feed', feedEl(s, p)), h('div#mot-words', wordsEl(s, p)),
    !me.isTeammate ? h('button.btn.btn-ghost.btn-small', { disabled: me.claimed, onclick: () => act({ type: 'claim' }) }, me.claimed ? '🚩 Réclamation envoyée' : '🚩 Mot interdit prononcé ! (réclamer)') : null,
  );
}

// ───── Bluff ─────
function bluffView(s, p, base) {
  const me = p.me || {};
  const key = `${base}|b|${p.manche}|${p.stage}|${me.answer}|${me.target}|${me.double}|${me.locked}|${me.peek ? me.peek.answer : ''}`;
  return { key, build: (fresh) => buildBluff(s, p, fresh) };
}

function buildBluff(s, p, fresh) {
  const me = p.me || {};
  if (me.spectator) return waiting('Tu observes cette manche depuis les tribunes.');
  const c = me.card;
  const info = [];
  if (c.know !== undefined) info.push(h('div.card-info.gold', `🔑 La vraie réponse est : ${LETTERS[c.know]} — ${p.q.options[c.know]}`));
  if (c.wrong !== undefined) info.push(h('div.card-info', `🃏 Cette réponse est FAUSSE : ${LETTERS[c.wrong]} — ${p.q.options[c.wrong]}`));
  if (c.decoy !== undefined) info.push(h('div.card-info.red', `🎭 Ton leurre (faux) : ${LETTERS[c.decoy]} — ${p.q.options[c.decoy]}. Fais-le choisir aux autres !`));
  const cardEl = h('div.bluff-card', h('div.bc-emoji', c.emoji), h('div.bc-name', c.name), h('div.bc-desc', c.desc), info);
  if (p.stage === 'reveal') {
    const d = me.delta || 0;
    if (fresh) (d > 0 ? sfx.good : d < 0 ? sfx.bad : sfx.click)();
    return h('div.p-bluff',
      h('div.p-answer', `Bonne réponse : ${LETTERS[p.answer]} — ${p.q.options[p.answer]}`),
      h(`div.p-result${d > 0 ? '.ok' : d < 0 ? '.ko' : '.neutral'}`, h('div.p-points', signed(d), h('small', ' pts'))),
      h('div.bluff-log.small', (p.log || []).map((l) => h('div.log-line', l))),
    );
  }
  const others = s.players.filter((x) => x.id !== s.me.id);
  const targetPicker = c.target && (p.stage === 'discuss' || p.stage === 'act')
    ? h('div.p-target', h('div.join-label', { cards: '', discuss: '🎯 Choisis ta cible (modifiable)', act: '🎯 Ta cible' }[p.stage] || '🎯 Cible'),
      h('div.p-players', others.map((o) => h(`button.chip-btn${me.target === o.id ? '.on' : ''}`, { onclick: () => act({ type: 'target', target: o.id }) }, avatar(o), o.name))))
    : null;
  const doubleToggle = c.id === 'doubleur' && (p.stage === 'discuss' || p.stage === 'act')
    ? h(`button.btn${me.double ? '.btn-gold' : '.btn-ghost'}`, { onclick: () => act({ type: 'double', on: !me.double }) }, me.double ? '✖️2 ACTIVÉ (re-cliquer pour annuler)' : '✖️2 Activer le quitte ou double')
    : null;
  const peek = me.peek ? h('div.card-info', `👀 ${playerById(s, me.peek.target).name} a choisi : ${me.peek.answer !== undefined ? LETTERS[me.peek.answer] + ' — ' + p.q.options[me.peek.answer] : 'pas encore…'}`) : null;
  if (p.stage === 'cards' || p.stage === 'discuss') {
    return h('div.p-bluff', h('div.p-banner.gold', p.stage === 'cards' ? '🃏 Ta carte secrète' : '🗣️ Discussion : bluffe, négocie, trahis'), cardEl, h('div.p-q.small', p.q.q), targetPicker, doubleToggle);
  }
  // act
  return h('div.p-bluff',
    h('div.p-q.small', p.q.q),
    h('div.p-options', p.q.options.map((o, i) => h(`button.p-opt${me.answer === i ? '.chosen' : ''}`, { style: { '--c': OPTION_COLORS[i] }, disabled: me.locked, onclick: () => act({ type: 'answer', value: i }) }, h('span.opt-letter', LETTERS[i]), h('span', o)))),
    me.answer !== undefined && !me.locked ? h('button.btn.btn-gold.btn-block', { onclick: () => act({ type: 'lock' }) }, '🔒 Verrouiller ma réponse') : null,
    me.locked ? h('div.p-hint', '🔒 Réponse verrouillée. Advienne que pourra.') : null,
    peek, targetPicker, doubleToggle,
    h('details.p-rules', h('summary', `${c.emoji} Ma carte : ${c.name}`), h('p', c.desc), info),
  );
}

// ───── Enchères ─────
function encheresView(s, p, base) {
  const me = p.me || {};
  const key = `${base}|e|${p.index}|${p.stage}|${me.bid !== undefined ? 1 : 0}|${me.blocked ? 1 : 0}|${me.answer !== undefined ? 1 : 0}|${me.hasHint ? 1 : 0}`;
  return {
    key,
    build: (fresh) => buildEncheres(s, p, fresh),
    update: p.stage === 'bid' && me.bid === undefined ? () => {} : undefined,
  };
}

function buildEncheres(s, p, fresh) {
  const me = p.me || {};
  const lot = p.lot;
  const wallet = h('div.wallet', h('span', '🪙'), h('strong', fmt(me.coins)), h('small', 'Audit Coins'), me.multiplier > 1 ? h('span.mult', '×2 actif') : null);
  const lotEl = lot ? h(`div.lot-card.small${lot.final ? '.final' : ''}`, h('div.lot-type', `${lot.emoji} ${lot.label}`), h('div.lot-title', lot.titre), h('div.lot-text', lot.texte), lot.cat ? h('div.lot-cat', `Catégorie : ${lot.cat} · ${'🌶️'.repeat(lot.d || 1)}`) : null) : null;
  const hint = me.hint ? h('div.card-info.gold', h('strong', '🔎 Ton indice — la question sera : '), me.hint.q, h('ul', me.hint.options.map((o, i) => h('li', `${LETTERS[i]}. ${o}`)))) : null;
  const winner = p.winner ? playerById(s, p.winner) : null;
  switch (p.stage) {
    case 'present':
      return h('div.p-ench', wallet, lotEl, hint, h('p.p-hint', 'Les enchères vont s’ouvrir…'));
    case 'bid': {
      if (me.blocked) return h('div.p-ench', wallet, lotEl, h('div.p-banner.red', '⛔ Tu es bloqué(e) pour ce lot. Accès VPN révoqué.'));
      if (me.bid !== undefined) return h('div.p-ench', wallet, lotEl, waiting(me.bid ? `Enchère secrète : 🪙 ${fmt(me.bid)}` : 'Tu passes ton tour.'));
      const custom = h('input.input.p-num', { 'data-keep': 'bid', inputmode: 'numeric', placeholder: 'Montant libre' });
      const bid = (amount) => { sfx.coin(); act({ type: 'bid', amount }); };
      const options = [0, 100, 200, 500, 1000].filter((v) => v <= me.coins);
      return h('div.p-ench', wallet, lotEl, hint,
        h('div.bid-buttons', options.map((v) => h(`button.btn${v ? '.btn-gold' : '.btn-ghost'}`, { onclick: () => bid(v) }, v ? `🪙 ${fmt(v)}` : 'Passer')),
          me.coins > 0 ? h('button.btn.btn-danger', { onclick: () => bid(me.coins) }, `🔥 TAPIS (${fmt(me.coins)})`) : null),
        h('div.p-guess', custom, h('button.btn.btn-ghost', { onclick: () => { const v = Number(String(custom.value).replace(/\s/g, '')); if (Number.isFinite(v) && v >= 0) bid(Math.min(v, me.coins)); } }, 'Miser')),
        h('p.p-hint', 'Le plus offrant remporte le lot. Égalité : avantage au moins bien classé.'),
      );
    }
    case 'bids':
      if (fresh && me.isWinner) { sfx.fanfare(); confetti(50); }
      return h('div.p-ench', wallet, lotEl, h(`div.p-banner${me.isWinner ? '.gold' : ''}`, me.isWinner ? `🔨 Adjugé ! Tu remportes le lot pour 🪙 ${fmt(p.winBid)}` : winner ? `🔨 ${winner.name} remporte le lot (🪙 ${fmt(p.winBid)})` : 'Aucune enchère.'));
    case 'answer':
      if (me.answer !== undefined) return h('div.p-ench', wallet, waiting(me.isWinner ? 'Réponse envoyée… tout ou rien !' : null));
      return h('div.p-ench',
        h(`div.p-banner${me.isWinner ? '.gold' : ''}`, me.isWinner ? `🎤 C’est À TOI ! Mise : 🪙 ${fmt(p.winBid)}${me.multiplier > 1 ? ' · ×2 actif' : ''}` : winner ? `${winner.name} joue gros. Réponds aussi (+30 pts si juste)` : 'Réponds pour +60 pts'),
        h('div.p-q', p.question.q),
        h('div.p-options', p.question.options.map((o, i) => h('button.p-opt', { style: { '--c': OPTION_COLORS[i] }, onclick: () => { sfx.click(); act({ type: 'answer', value: i }); } }, h('span.opt-letter', LETTERS[i]), h('span', o)))));
    case 'choose':
      if (!me.isWinner) return h('div.p-ench', wallet, waiting(`${winner ? winner.name : '?'} choisit sa victime…`));
      return h('div.p-ench', h('div.p-banner.gold', `${lot.emoji} ${lot.label} : fais ton choix`), h('div.p-choices', (p.choices || []).map((c) => h('button.btn.btn-ghost.btn-block', { onclick: () => act({ type: 'choose', value: c.value }) }, `${c.avatar || ''} ${c.label}${c.points ? ` (+${c.points})` : ''}${c.score !== undefined ? ` · ${fmt(c.score)} pts` : ''}`))));
    case 'result': {
      const o = p.outcome || {};
      const d = o.delta ? o.delta[s.me.id] : undefined;
      if (fresh && d) (d > 0 ? sfx.good : sfx.bad)();
      return h('div.p-ench', wallet, h('div.outcome.small', o.text), d !== undefined ? h(`div.p-result${d > 0 ? '.ok' : '.ko'}`, h('div.p-points', signed(d), h('small', ' pts'))) : null, o.info ? h('div.explain', h('span.explain-icon', '📎'), o.info) : null);
    }
    case 'final':
      return h('div.p-ench', h('div.p-banner', '💱 Conversion de tes coins restants'), h('div.p-points', `+${fmt((p.conversion || {})[s.me.id] || 0)} pts`));
    default:
      return h('div.p-ench', wallet);
  }
}

// ───────────── Classement d'épreuve ─────────────
function roundEnd(s, fresh) {
  const me = s.me;
  const row = (s.leaderboard || []).find((r) => r.id === me.id) || {};
  const delta = (row.prevRank || row.rank) - row.rank;
  const lr = s.lastRound || {};
  const isBest = lr.best && lr.best.id === me.id;
  const isWorst = lr.worst && lr.worst.id === me.id;
  if (fresh) { if (isBest) { sfx.fanfare(); confetti(120); } else if (delta > 0) sfx.good(); }
  const top = (s.leaderboard || []).slice(0, 5);
  return h('div.p-end',
    h('div.p-rank-big', row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`),
    h('div.p-rank-label', `${fmt(row.score)} pts`),
    h('div.p-deltas',
      h(`span.lb-badge${row.gain >= 0 ? '.up' : '.down'}`, `📈 ${signed(row.gain)} pts`),
      delta > 0 ? h('span.lb-badge.hot', `🔥 +${delta} place${delta > 1 ? 's' : ''}`) : delta < 0 ? h('span.lb-badge.down', `💀 ${delta} place${delta < -1 ? 's' : ''}`) : h('span.lb-badge', '= même place'),
    ),
    isBest ? h('div.p-banner.gold', `⭐ JOUEUR DE LA MANCHE ! ${lr.best.quip}`) : null,
    isWorst ? h('div.p-banner', `🐌 Boulet de la manche… ${lr.worst.quip}`) : null,
    lr.team && lr.team.winner.members.includes(me.id) ? h('div.p-banner.green', `🏅 Ton équipe ${lr.team.winner.name} gagne : +${lr.team.bonus} pts de bonus`) : null,
    h('div.p-mini-lb', top.map((r) => { const p = playerById(s, r.id); return h(`div.p-mini-row${r.id === me.id ? '.me' : ''}`, h('span', `${r.rank}.`), h('span', `${p.avatar} ${p.name}`), h('strong', fmt(r.score))); }),
      top.some((r) => r.id === me.id) ? null : h('div.p-mini-row.me', h('span', `${row.rank}.`), h('span', `${me.avatar} ${me.name}`), h('strong', fmt(row.score)))),
  );
}

// ───────────── Événement ─────────────
function eventView(s) {
  const e = s.event || {};
  const it = e.interactive;
  const key = `event|${s.roundIndex}|${e.id}|${e.stage}|${it && it.myAnswer !== undefined ? 1 : 0}`;
  return { key, build: (fresh) => buildEvent(s, fresh) };
}

function buildEvent(s, fresh) {
  const e = s.event || {};
  const me = s.me;
  const it = e.interactive;
  const targeted = (e.targets || []).includes(me.id);
  const d = (e.deltas || {})[me.id];
  if (fresh) sfx.siren();
  const parts = [h('div.p-ev-emoji', e.emoji), h('h2.p-ev-title', e.titre), h('p.p-ev-text', e.texte)];
  if (targeted && e.stage !== 'interactive') parts.push(h('div.p-banner.gold', '🎯 C’est toi qui es visé(e) !'));
  if (it && e.stage === 'interactive') {
    if (it.kind === 'defi' && it.players.includes(me.id)) {
      if (it.myAnswer !== undefined) parts.push(waiting());
      else parts.push(h('div.p-q', it.q), h('div.p-options', it.options.map((o, i) => h('button.p-opt', { style: { '--c': OPTION_COLORS[i] }, onclick: () => act({ type: 'answer', value: i }) }, h('span.opt-letter', LETTERS[i]), h('span', o)))));
    } else if (it.kind === 'don' && it.chooser === me.id) {
      parts.push(h('div.p-banner.gold', `🎁 Choisis qui reçoit ${it.amount} pts`), h('div.p-choices', s.players.filter((p) => p.id !== me.id).map((p) => h('button.btn.btn-ghost.btn-block', { onclick: () => act({ type: 'give', target: p.id }) }, `${p.avatar} ${p.name} · ${fmt(p.score)} pts`))));
    } else {
      parts.push(waiting('Le destin est en train de se jouer…'));
    }
  }
  if (it && it.kind === 'defi' && e.stage === 'done') parts.push(h('div.p-answer', `Réponse : ${it.options[it.answer]}`));
  if (d) parts.push(h(`div.p-result${d > 0 ? '.ok' : '.ko'}`, h('div.p-points', signed(d), h('small', ' pts'))));
  return h('div.p-event', parts);
}

// ───────────── Finale ─────────────
function finalView(s, fresh) {
  const f = s.final;
  const me = s.me;
  const mine = f.ranking.find((r) => r.id === me.id) || {};
  const champ = playerById(s, f.ranking[0].id);
  const trophies = f.trophies.filter((t) => t.id === me.id);
  if (fresh) { setTimeout(() => sfx.fanfare(), 1500); if (mine.rank <= 3) setTimeout(() => confetti(200), 1800); }
  return h('div.p-final',
    h('div.p-final-kicker', `🏆 Champion : ${champ.avatar} ${champ.name}`),
    h('div.p-rank-big', mine.rank === 1 ? '👑' : mine.rank === 2 ? '🥈' : mine.rank === 3 ? '🥉' : `#${mine.rank}`),
    h('div.p-rank-label', `${fmt(mine.score)} pts`),
    mine.rank === 1 ? h('blockquote.champ-quote', `« ${mine.quote} »`) : null,
    card(h('div.p-stats',
      h('div', h('strong', mine.roundWins || 0), h('small', 'épreuves gagnées')),
      h('div', h('strong', mine.accuracy !== null && mine.accuracy !== undefined ? `${mine.accuracy} %` : '–'), h('small', 'réussite')),
      h('div', h('strong', mine.bestStreak ? `🔥${mine.bestStreak}` : '–'), h('small', 'meilleure série')),
      h('div', h('strong', mine.betrayals || 0), h('small', 'trahisons')),
    )),
    trophies.length ? card(h('div.join-label', '🎖️ Tes trophées'), trophies.map((t) => h('div.p-trophy', h('span', t.emoji), h('div', h('strong', t.title), h('small', t.detail))))) : null,
    mine.titles && mine.titles.length ? card(h('div.join-label', '🏅 Tes titres honorifiques'), h('div.p-titles', mine.titles.map((t) => h('span.badge', t)))) : null,
    card(h('div.join-label', '📊 Tes points par épreuve'), h('div.p-rounds', (f.rounds || []).map((r) => h('div.p-round-row', h('span', `${r.emoji} ${r.name}`), h('strong', signed((mine.pointsByRound || {})[r.roundId] || 0)))))),
    (() => {
      const gi = f.grades && s.me.profile ? f.grades.findIndex((g) => g.key === s.me.profile.grade) : -1;
      if (gi < 0) return null;
      const g = f.grades[gi];
      return card(h('div.join-label', '🏢 Choc des générations'), h('p', `${gi === 0 ? '🏆 ' : ''}Les ${g.label.toLowerCase()} terminent ${gi === 0 ? '1ers' : `${gi + 1}es`} sur ${f.grades.length} grades (${fmt(g.avg)} pts de moyenne).`));
    })(),
    h('div.summary.small', f.summary.map((l) => h('p', l))),
  );
}

export { avatarRow };
