/* Corredor dos Concursos — motor raycasting em canvas puro (sem dependências). */
(() => {
'use strict';

const BANCAS = window.BANCAS;
const $ = id => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d');

const TS = 128;                       // tamanho das texturas
const CORES = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];
const ID_PILAR = 99;
let W = 640, H = 360;
let gCeil, gFloor;

/* ---------- utilidades ---------- */
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

let ac = null;
function beep(f, d, type) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f; g.gain.value = 0.07;
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + d);
  } catch (e) { /* sem áudio */ }
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem('corredor-concursos') || '{}'); } catch (e) { return {}; } },
  set(v) { try { localStorage.setItem('corredor-concursos', JSON.stringify(v)); } catch (e) { /* ignora */ } }
};

/* ---------- texturas ---------- */
function mkTex(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  fn(c.getContext('2d'));
  return c;
}
const texBrick = mkTex(g => {
  g.fillStyle = '#2b1b17'; g.fillRect(0, 0, TS, TS);
  for (let r = 0; r < 8; r++) {
    const off = (r % 2) * 16;
    for (let b = -1; b < 5; b++) {
      g.fillStyle = `hsl(14,36%,${38 + rnd() * 14}%)`;
      g.fillRect(b * 32 + off + 1, r * 16 + 1, 30, 14);
    }
  }
});
const texPilar = mkTex(g => {
  g.fillStyle = '#4b5d67'; g.fillRect(0, 0, TS, TS);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `rgba(255,255,255,${0.04 + (i % 2) * 0.06})`;
    g.fillRect(0, i * 16, TS, 16);
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 6, TS); g.fillRect(TS - 6, 0, 6, TS);
});
function texPorta(cor, txt) {
  return mkTex(g => {
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, TS, TS);
    g.fillStyle = cor; g.fillRect(6, 6, TS - 12, TS - 12);
    const gr = g.createLinearGradient(0, 0, 0, TS);
    gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = gr; g.fillRect(6, 6, TS - 12, TS - 12);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4; g.strokeRect(14, 14, TS - 28, TS - 28);
    g.fillStyle = '#fff';
    g.font = (txt.length > 1 ? 'bold 30px' : 'bold 88px') + ' system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, TS / 2, TS / 2 + 3, TS - 32);
  });
}

/* ---------- estado ---------- */
const S = {
  fase: 'menu',        // menu | jogo | transicao | fim
  bancaId: store.get().banca && BANCAS[store.get().banca] ? store.get().banca : 'cebraspe',
  qtd: 10,
  perguntas: [], idx: 0, score: 0, acertos: 0, erros: 0, erradas: [],
  atual: null,         // { q, opts }
  map: [], mw: 0, mh: 0, texs: {},
  p: { x: 0, y: 0, a: -Math.PI / 2 }
};

/* ---------- menu ---------- */
function montarMenu() {
  const best = store.get().best || {};
  const box = $('bancas');
  box.innerHTML = '';
  Object.entries(BANCAS).forEach(([id, b]) => {
    const el = document.createElement('button');
    el.className = 'banca' + (id === S.bancaId ? ' sel' : '');
    el.style.setProperty('--c', b.cor);
    el.innerHTML = `<b></b><small></small><div class="rec"></div>`;
    el.querySelector('b').textContent = b.nome;
    el.querySelector('small').textContent = b.descricao;
    el.querySelector('.rec').textContent = `${b.questoes.length} questões` + (best[id] != null ? ` · recorde ${best[id]}%` : '');
    el.onclick = () => { S.bancaId = id; montarMenu(); };
    box.appendChild(el);
  });
}
document.querySelectorAll('#qtd button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#qtd button').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    S.qtd = parseInt(btn.dataset.n, 10);
  };
});

/* ---------- fluxo do jogo ---------- */
function mostrar(id, on) { $(id).classList.toggle('hidden', !on); }

function iniciar() {
  const b = BANCAS[S.bancaId];
  const emb = shuffle(b.questoes);
  S.perguntas = (S.qtd > 0 ? emb.slice(0, S.qtd) : emb);
  S.idx = 0; S.score = 0; S.acertos = 0; S.erros = 0; S.erradas = [];
  const st = store.get(); st.banca = S.bancaId; store.set(st);
  mostrar('menu', false); mostrar('fim', false); mostrar('ultima', false);
  mostrar('hud', true); mostrar('touch', true);
  novaQuestao();
}

function prepararOpcoes(q, banca) {
  if (banca.tipo === 'ce') {
    return [
      { txt: 'CERTO', rotulo: 'CERTO', letra: 'C', cor: '#2e7d32', ok: q.a === true },
      { txt: 'ERRADO', rotulo: 'ERRADO', letra: 'E', cor: '#c62828', ok: q.a === false }
    ];
  }
  return shuffle(q.o.map((txt, i) => ({ txt, ok: i === q.a })))
    .map((o, k) => Object.assign(o, { letra: 'ABCDE'[k], rotulo: 'ABCDE'[k], cor: CORES[k] }));
}

function novaQuestao() {
  if (S.idx >= S.perguntas.length) return fim();
  const banca = BANCAS[S.bancaId];
  const q = S.perguntas[S.idx];
  S.atual = { q, opts: prepararOpcoes(q, banca) };
  construirSala(S.atual.opts);

  $('hudBanca').textContent = banca.nome;
  $('hudBanca').style.borderColor = banca.cor;
  $('hudProg').textContent = `Questão ${S.idx + 1}/${S.perguntas.length}`;
  atualizarScore();
  $('topico').textContent = q.t;
  $('pergunta').textContent = q.q;
  const ol = $('opcoes');
  ol.innerHTML = '';
  S.atual.opts.forEach(o => {
    const li = document.createElement('li');
    const bd = document.createElement('span');
    bd.className = 'badge'; bd.style.background = o.cor; bd.textContent = o.letra;
    const tx = document.createElement('span');
    tx.textContent = banca.tipo === 'ce' ? (o.letra === 'C' ? 'Certo' : 'Errado') : o.txt;
    li.append(bd, tx);
    ol.appendChild(li);
  });
  S.fase = 'jogo';
  S.fadeIn = 1;
}

function atualizarScore() {
  $('hudScore').textContent = `Pontos: ${S.score}`;
}

function escolher(k) {
  if (S.fase !== 'jogo') return;
  const banca = BANCAS[S.bancaId];
  const { q, opts } = S.atual;
  const certa = opts.find(o => o.ok);
  const acertou = opts[k].ok;
  let delta = 0;
  if (acertou) { S.acertos++; delta = 1; beep(660, 0.12); setTimeout(() => beep(880, 0.18), 120); }
  else {
    S.erros++; beep(180, 0.3, 'sawtooth');
    if (banca.tipo === 'ce') delta = -1;
    S.erradas.push({ q: q.q, escolhida: opts[k], certa, e: q.e, t: q.t });
  }
  S.score += delta;
  atualizarScore();

  // resultado da questão fica num painel discreto, sem interromper o jogo
  const ul = $('ultima');
  ul.className = acertou ? 'ok' : 'no';
  $('ultTitulo').textContent = (acertou ? '✔ Correta' : '✘ Incorreta') +
    (delta > 0 ? ' (+1)' : delta < 0 ? ' (−1: na Cebraspe, erro anula acerto)' : '');
  $('ultGabarito').textContent = `Gabarito: ${certa.letra}) ${certa.txt}`;
  $('ultComentario').textContent = q.e;
  mostrar('ultima', true);

  S.fase = 'transicao'; S.trans = 0; S.porta = k;
}

function fim() {
  S.fase = 'fim';
  mostrar('hud', false); mostrar('touch', false);
  const banca = BANCAS[S.bancaId];
  const total = S.perguntas.length;
  const pct = Math.round((S.acertos / total) * 100);
  $('fimBanca').textContent = banca.nome;
  $('fimNota').textContent = `${pct}%`;
  $('fimStats').textContent = `${S.acertos} acertos · ${S.erros} erros · ${S.score} pontos` +
    (banca.tipo === 'ce' ? ' (erro anula acerto)' : '');
  const box = $('fimErros');
  box.innerHTML = '';
  S.erradas.forEach(r => {
    const d = document.createElement('div');
    d.className = 'erro';
    const t = document.createElement('div');
    t.textContent = `[${r.t}] ${r.q}`;
    const c = document.createElement('div');
    c.innerHTML = '<b>Você:</b> <span></span> · <b style="color:#4ade80">Gabarito:</b> <span></span>';
    const sp = c.querySelectorAll('span');
    sp[0].textContent = `${r.escolhida.letra}) ${r.escolhida.txt}`;
    sp[1].textContent = `${r.certa.letra}) ${r.certa.txt}`;
    const e = document.createElement('div');
    e.style.opacity = '.75'; e.textContent = r.e;
    d.append(t, c, e);
    box.appendChild(d);
  });
  const st = store.get(); st.best = st.best || {};
  if (st.best[S.bancaId] == null || pct > st.best[S.bancaId]) st.best[S.bancaId] = pct;
  store.set(st);
  mostrar('fim', true);
}

function voltarMenu() {
  S.fase = 'menu';
  if (document.pointerLockElement) document.exitPointerLock();
  mostrar('hud', false); mostrar('touch', false); mostrar('fim', false);
  montarMenu();
  mostrar('menu', true);
}

$('btnJogar').onclick = () => { beep(440, 0.08); iniciar(); };
$('btnRepetir').onclick = iniciar;
$('btnVoltar').onclick = voltarMenu;
$('btnMenu').onclick = voltarMenu;

/* ---------- mapa ---------- */
function construirSala(opts) {
  const n = opts.length;
  const mw = 3 * n + 4, mh = 12;
  const m = [];
  for (let y = 0; y < mh; y++) {
    m.push([]);
    for (let x = 0; x < mw; x++) m[y].push(x === 0 || y === 0 || x === mw - 1 || y === mh - 1 ? 1 : 0);
  }
  S.texs = { 1: texBrick };
  S.texs[ID_PILAR] = texPilar;
  opts.forEach((o, k) => {
    m[0][3 + 3 * k] = 2 + k;
    S.texs[2 + k] = texPorta(o.cor, o.rotulo || o.letra);
  });
  // pilares decorativos (longe do caminho central)
  [[2, 5], [mw - 3, 5], [2, 8], [mw - 3, 8]].forEach(([x, y]) => { m[y][x] = ID_PILAR; });
  S.map = m; S.mw = mw; S.mh = mh;
  S.p.x = mw / 2; S.p.y = mh - 1.5; S.p.a = -Math.PI / 2;
}
function tile(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (ty < 0 || ty >= S.mh || tx < 0 || tx >= S.mw) return 1;
  return S.map[ty][tx];
}

/* ---------- entrada ---------- */
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (S.fase === 'jogo' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('click', () => {
  if (S.fase === 'jogo' && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* opcional */ } }
});
addEventListener('mousemove', e => {
  if (S.fase === 'jogo' && document.pointerLockElement === canvas) S.p.a += e.movementX * 0.0028;
});
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { keys[k] = false; }));
});

/* ---------- movimento ---------- */
function tentarMover(nx, ny) {
  const r = 0.28;
  const pts = [[nx - r, ny - r], [nx + r, ny - r], [nx - r, ny + r], [nx + r, ny + r]];
  for (const [x, y] of pts) {
    const id = tile(x, y);
    if (id > 0) {
      // só conta como escolha se o centro do jogador estiver alinhado com a porta
      if (id >= 2 && id < ID_PILAR && Math.floor(nx) === Math.floor(x)) escolher(id - 2);
      return;
    }
  }
  S.p.x = nx; S.p.y = ny;
}
function atualizar(dt) {
  const mv = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const tn = (keys.ArrowRight || keys.KeyE ? 1 : 0) - (keys.ArrowLeft || keys.KeyQ ? 1 : 0);
  const p = S.p;
  p.a += tn * 2.4 * dt;
  const dx = Math.cos(p.a), dy = Math.sin(p.a);
  let vx = dx * mv - dy * st, vy = dy * mv + dx * st;
  const len = Math.hypot(vx, vy);
  if (len > 1) { vx /= len; vy /= len; }
  const sp = 3.4;
  tentarMover(p.x + vx * sp * dt, p.y);
  if (S.fase === 'jogo') tentarMover(S.p.x, S.p.y + vy * sp * dt);
}

/* ---------- renderização (raycasting) ---------- */
function redimensionar() {
  W = 640;
  H = Math.max(240, Math.min(480, Math.round(W * innerHeight / innerWidth)));
  canvas.width = W; canvas.height = H;
  gCeil = ctx.createLinearGradient(0, 0, 0, H / 2);
  gCeil.addColorStop(0, '#0d1220'); gCeil.addColorStop(1, '#2a3550');
  gFloor = ctx.createLinearGradient(0, H / 2, 0, H);
  gFloor.addColorStop(0, '#15171c'); gFloor.addColorStop(1, '#3a342e');
}
addEventListener('resize', redimensionar);

function desenhar() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = gCeil; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = gFloor; ctx.fillRect(0, H / 2, W, H / 2);

  const p = S.p;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  const plX = -dirY * 0.66, plY = dirX * 0.66;
  const escala = 0.5625 * W;

  for (let x = 0; x < W; x++) {
    const camX = 2 * x / W - 1;
    const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
    let mx = Math.floor(p.x), my = Math.floor(p.y);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (p.x - mx) * ddx; } else { stepX = 1; sdx = (mx + 1 - p.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (p.y - my) * ddy; } else { stepY = 1; sdy = (my + 1 - p.y) * ddy; }
    let side = 0, id = 0, guard = 0;
    while (!id && guard++ < 64) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; } else { sdy += ddy; my += stepY; side = 1; }
      id = (my < 0 || my >= S.mh || mx < 0 || mx >= S.mw) ? 1 : S.map[my][mx];
    }
    let perp = side === 0 ? sdx - ddx : sdy - ddy;
    if (perp < 0.05) perp = 0.05;
    const lh = Math.floor(escala / perp);
    const top = Math.floor(H / 2 - lh / 2);
    let wx = side === 0 ? p.y + perp * rdy : p.x + perp * rdx;
    wx -= Math.floor(wx);
    let tx = Math.floor(wx * TS);
    // espelha só quando a direção da tela é oposta à do eixo da textura (evita letras invertidas)
    if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) tx = TS - 1 - tx;
    const tex = S.texs[id] || texBrick;
    ctx.drawImage(tex, tx, 0, 1, TS, x, top, 1, lh);
    const porta = id >= 2 && id < ID_PILAR;
    const sombra = Math.min(0.88, perp / (porta ? 26 : 13) + (side ? 0.22 : 0));
    if (sombra > 0.01) { ctx.fillStyle = `rgba(0,0,0,${sombra.toFixed(3)})`; ctx.fillRect(x, top, 1, lh); }
  }
  minimapa();
}

function minimapa() {
  const s = 6, ox = W - S.mw * s - 8, oy = H - S.mh * s - 8;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#05070b'; ctx.fillRect(ox - 3, oy - 3, S.mw * s + 6, S.mh * s + 6);
  for (let y = 0; y < S.mh; y++) for (let x = 0; x < S.mw; x++) {
    const id = S.map[y][x];
    if (!id) continue;
    ctx.fillStyle = id === 1 ? '#6d4c41' : id === ID_PILAR ? '#78909c' : (S.atual ? S.atual.opts[id - 2].cor : '#fff');
    ctx.fillRect(ox + x * s, oy + y * s, s, s);
  }
  ctx.globalAlpha = 1;
  const px = ox + S.p.x * s, py = oy + S.p.y * s;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(S.p.a) * 8, py + Math.sin(S.p.a) * 8); ctx.stroke();
}

/* ---------- loop ---------- */
let ultimo = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - ultimo) / 1000);
  ultimo = t;
  let fade = 0;
  if (S.fase === 'jogo') {
    atualizar(dt);
    if (S.fadeIn > 0) { S.fadeIn = Math.max(0, S.fadeIn - dt * 2.5); fade = S.fadeIn; }
  } else if (S.fase === 'transicao') {
    // caminha pela porta escolhida enquanto a tela escurece
    const alvoX = 3 + 3 * S.porta + 0.5;
    S.p.x += (alvoX - S.p.x) * Math.min(1, dt * 7);
    if (S.p.y > 1.02) S.p.y = Math.max(1.02, S.p.y - 2.2 * dt);
    S.trans += dt;
    fade = Math.min(1, S.trans / 0.45);
    if (S.trans >= 0.45) { S.idx++; novaQuestao(); fade = 1; }
  }
  if (S.fase === 'jogo' || S.fase === 'transicao') {
    desenhar();
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
  requestAnimationFrame(loop);
}

redimensionar();
montarMenu();
// sala de fundo para o menu não ficar preto
construirSala([{ cor: CORES[0], letra: 'A', txt: '' }, { cor: CORES[1], letra: 'B', txt: '' }, { cor: CORES[2], letra: 'C', txt: '' }]);
S.atual = null;
desenhar();
requestAnimationFrame(loop);
})();
