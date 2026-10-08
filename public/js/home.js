// Écran d'accueil : créer une partie (MC) ou rejoindre avec un code.

import { h, fmt } from './lib.js';

let hof = null;

export function homeView() {
  if (hof === null) {
    hof = false;
    fetch('/api/halloffame').then((r) => r.json()).then((d) => { hof = d; const el = document.getElementById('hof'); if (el) el.replaceWith(hallOfFame()); }).catch(() => {});
  }
  const codeInput = h('input.input.code-input', { maxlength: 4, placeholder: 'CODE', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Code de la partie' });
  const go = () => {
    const c = codeInput.value.trim().toUpperCase();
    if (c.length === 4) location.href = `/play?code=${c}`;
    else codeInput.classList.add('shake');
    setTimeout(() => codeInput.classList.remove('shake'), 500);
  };
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const params = new URLSearchParams(location.search);
  if (params.get('code')) { location.replace(`/play?code=${params.get('code').toUpperCase()}`); }

  return h('div.home',
    h('div.home-hero',
      h('div.hero-badge', 'AUDIT GAMES 2026'),
      h('h1.hero-title', h('span', 'Les Olympiades'), h('span.hero-sub', 'du Cabinet')),
      h('p.hero-tag', '10 épreuves · des équipes qui changent sans cesse · du bluff, des trahisons, et un seul champion.'),
      h('div.hero-deco', '🏆 📊 ⚽ 🧾 ☕ 🟥 📎'),
    ),
    h('div.home-cards',
      h('div.home-card.card-host',
        h('div.card-emoji', '🎤'),
        h('h2', 'Maître de cérémonie'),
        h('p', 'Crée la partie, partage ton écran sur Teams / Discord / Zoom, et anime la soirée.'),
        h('a.btn.btn-gold.btn-big', { href: '/host' }, 'Créer une partie'),
      ),
      h('div.home-card.card-join',
        h('div.card-emoji', '🎮'),
        h('h2', 'Joueur'),
        h('p', 'Entre le code affiché à l’écran du MC.'),
        h('div.join-row', codeInput, h('button.btn.btn-green.btn-big', { onclick: go }, 'Rejoindre')),
      ),
    ),
    hallOfFame(),
    h('footer.home-foot', 'Aucune pièce justificative ne sera demandée. Le comité d’organisation décline toute responsabilité en cas de trahison.'),
  );
}

function hallOfFame() {
  if (!hof || !hof.players || !hof.players.length) return h('div#hof');
  return h('section#hof.hof',
    h('h3', '🏛️ Hall of Fame'),
    h('div.hof-list', hof.players.slice(0, 8).map((p, i) => h('div.hof-row',
      h('span.hof-rank', i === 0 ? '👑' : `#${i + 1}`),
      h('span.hof-av', p.avatar),
      h('span.hof-name', p.name),
      h('span.hof-stat', `🏆 ${p.wins}`),
      h('span.hof-stat', `🥉 ${p.podiums}`),
      h('span.hof-stat', `⭐ ${fmt(p.best)}`),
    ))),
  );
}
