'use strict';
// 🏆 Les Olympiades du Cabinet — serveur temps réel (Express + Socket.IO)
// Lancement : npm install && npm start  ->  http://localhost:3000

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Game = require('./server/game');
const History = require('./server/history');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

const games = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  } while (games.has(code));
  return code;
}

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
// QR code servi en local (pas de dépendance à un CDN, pratique sur les réseaux d'entreprise)
app.get('/vendor/qrcode.js', (req, res) => res.sendFile(require.resolve('qrcode-generator/qrcode.js')));
app.get('/api/health', (req, res) => res.json({ ok: true, games: games.size }));
app.get('/api/halloffame', (req, res) => res.json(History.hallOfFame()));
app.get('/api/game/:code', (req, res) => {
  const g = games.get(String(req.params.code).toUpperCase());
  res.json(g ? { exists: true, phase: g.phase, players: g.activePlayers().length } : { exists: false });
});
app.get(['/host', '/tv', '/play'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
// Liens courts : /CODE -> écran joueur (ex : monjeu.onrender.com/ABCD)
app.get(/^\/([A-Za-z]{4})$/, (req, res) => res.redirect(`/play?code=${req.params[0].toUpperCase()}`));

io.on('connection', (socket) => {
  let game = null;
  let player = null;
  let role = null;

  const fail = (msg) => socket.emit('fail', msg);

  socket.on('host:create', (_, ack) => {
    const code = newCode();
    const g = new Game(code);
    games.set(code, g);
    console.log(`[${code}] nouvelle partie`);
    if (typeof ack === 'function') ack({ code, hostToken: g.hostToken });
  });

  socket.on('host:join', ({ code, hostToken } = {}) => {
    const g = games.get(String(code || '').toUpperCase());
    if (!g) return fail('Partie introuvable (elle a peut-être expiré).');
    if (g.hostToken !== hostToken) return fail('Accès MC refusé pour cette partie.');
    game = g; role = 'host';
    g.hostSockets.add(socket);
    socket.emit('joined', { role: 'host', code: g.code });
    g.broadcast();
  });

  socket.on('screen:join', ({ code } = {}) => {
    const g = games.get(String(code || '').toUpperCase());
    if (!g) return fail('Partie introuvable.');
    game = g; role = 'screen';
    g.screenSockets.add(socket);
    socket.emit('joined', { role: 'screen', code: g.code });
    g.broadcast();
  });

  socket.on('player:join', ({ code, name, avatar, token } = {}) => {
    const g = games.get(String(code || '').toUpperCase());
    if (!g) return fail('Code de partie inconnu. Vérifie auprès du MC !');
    const res = g.join(name, avatar, token);
    if (res.error) return fail(res.error);
    game = g; role = 'player'; player = res.player;
    player.sockets.add(socket);
    g.setConnected(player, true);
    socket.emit('joined', { role: 'player', code: g.code, token: player.token, id: player.id, rejoined: res.rejoined });
    if (res.rejoined) console.log(`[${g.code}] ${player.name} est de retour`);
    g.broadcast();
  });

  socket.on('player:action', (msg) => {
    if (!game || !player || player.kicked) return;
    try {
      if (game.playerAction(player, msg)) game.broadcast();
    } catch (err) {
      console.error(`[${game.code}] action joueur`, err);
    }
  });

  socket.on('host:action', (msg) => {
    if (!game || role !== 'host' || !msg) return;
    try {
      game.hostAction(msg);
      game.broadcast();
    } catch (err) {
      console.error(`[${game.code}] action MC`, err);
    }
  });

  socket.on('disconnect', () => {
    if (!game) return;
    if (role === 'host') game.hostSockets.delete(socket);
    if (role === 'screen') game.screenSockets.delete(socket);
    if (role === 'player' && player) {
      player.sockets.delete(socket);
      if (!player.sockets.size) {
        try { game.setConnected(player, false); } catch (err) { console.error(err); }
      }
    }
    game.broadcast();
  });
});

// Boucle de jeu : minuteurs + rafraîchissement régulier + ménage des parties abandonnées
let lastSync = 0;
setInterval(() => {
  const now = Date.now();
  const sync = now - lastSync > 5000;
  if (sync) lastSync = now;
  for (const [code, g] of games) {
    g.tick(now);
    if (sync && g.timer) g.broadcast();
    if (now - g.lastActivity > 6 * 3600 * 1000) {
      games.delete(code);
      console.log(`[${code}] partie expirée`);
    }
  }
}, 200);

server.listen(PORT, () => {
  console.log(`🏆 Les Olympiades du Cabinet — http://localhost:${PORT}`);
});

module.exports = { app, server, games };
