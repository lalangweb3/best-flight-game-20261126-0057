// THERMAL SOAR — browser layer: canvas rendering, input, audio.
// Imports pure logic from core.js; this file owns the DOM only.

import {
  createGame, startGame, step, chooseRefit, getLiftAt,
  EVENTS, mulberry32,
  LEG_COUNT, TOTAL_DISTANCE, SUNSET_SECONDS, CEILING,
} from './core.js';

const PX_PER_M = 0.35;
const ALT_PX = 0.22;
const GROUND_Y = 440;
const VIEW_W = 1280;
const VIEW_H = 480;

const state = createGame();
const input = { pitchUp: false, pitchDown: false, circle: false, airbrake: false };
let speedMul = 1;
let booted = false;
let muted = false;
let audioCtx = null;
let lastVarioBeep = 0;
let lastToastFeat = null;
let lastStatus = 'title';
let prevStatus = 'title';

let canvas = null;
let ctx = null;
let decor = null;

function buildDecor() {
  const rng = mulberry32(777);
  const far = [];
  const near = [];
  for (let x = 0; x <= TOTAL_DISTANCE + 2000; x += 700) far.push({ x, h: 120 + rng() * 180 });
  for (let x = 0; x <= TOTAL_DISTANCE + 2000; x += 450) near.push({ x, h: 60 + rng() * 120 });
  const clouds = [];
  for (let i = 0; i < 14; i++) clouds.push({ x: rng() * TOTAL_DISTANCE, y: 50 + rng() * 130, w: 120 + rng() * 160 });
  return { far, near, clouds };
}

function sx(wx, cam) {
  return (wx - cam) * PX_PER_M;
}

function ay(alt) {
  return GROUND_Y - alt * ALT_PX;
}

function camX() {
  const maxCam = TOTAL_DISTANCE - VIEW_W / PX_PER_M;
  return Math.max(0, Math.min(maxCam, state.x - 300));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function ensureAudio() {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

function blip(freq = 880, dur = 0.08, type = 'sine', vol = 0.05) {
  if (muted || !audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    // audio is best-effort
  }
}

function drawRidgeLayer(peaks, color, cam) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, GROUND_Y);
  for (const p of peaks) {
    const x = sx(p.x, cam);
    if (x < -200 || x > VIEW_W + 200) continue;
    ctx.lineTo(x, GROUND_Y - p.h);
  }
  ctx.lineTo(VIEW_W + 10, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function render(t) {
  const cam = camX();
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.55, '#8a3b6e');
  sky.addColorStop(1, '#ff9a5a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // sun — descends as the sunset timer runs out
  const frac = 1 - state.timeLeft / SUNSET_SECONDS;
  const sunX = 1120;
  const sunY = 70 + frac * 300;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
  glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 180, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 180, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255, 220, 235, 0.35)';
  for (const c of decor.clouds) {
    const cx = sx(c.x, cam);
    if (cx < -300 || cx > VIEW_W + 300) continue;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.w / 2, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + c.w * 0.25, c.y + 8, c.w / 3, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // mountains
  drawRidgeLayer(decor.far, '#4a2a6e', cam);
  drawRidgeLayer(decor.near, '#33204f', cam);
  // ground
  const gnd = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
  gnd.addColorStop(0, '#3d5a2e');
  gnd.addColorStop(1, '#1d2f16');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
  // ridge lines
  for (const r of state.ridges) {
    const x0 = sx(r.x0, cam);
    const x1 = sx(r.x1, cam);
    const xm = (x0 + x1) / 2;
    if (x1 < -50 || x0 > VIEW_W + 50) continue;
    ctx.fillStyle = '#6b4a2f';
    ctx.beginPath();
    ctx.moveTo(x0, GROUND_Y);
    ctx.lineTo(xm, GROUND_Y - 110);
    ctx.lineTo(x1, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, GROUND_Y);
    ctx.lineTo(xm, GROUND_Y - 110);
    ctx.stroke();
    if (state.x >= r.x0 && state.x <= r.x1) {
      ctx.fillStyle = '#ffe27a';
      ctx.font = 'bold 15px system-ui';
      ctx.fillText('RIDGE LIFT', xm - 42, GROUND_Y - 122);
    }
  }
  // thermals
  for (const th of state.thermals) {
    const x0 = sx(th.x - th.radius, cam);
    const w = th.radius * 2 * PX_PER_M;
    if (x0 + w < -50 || x0 > VIEW_W + 50) continue;
    const grad = ctx.createLinearGradient(0, ay(0), 0, ay(380));
    grad.addColorStop(0, 'rgba(255, 214, 120, 0.30)');
    grad.addColorStop(1, 'rgba(255, 214, 120, 0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, ay(380), w, GROUND_Y - ay(380));
    ctx.strokeStyle = 'rgba(255, 220, 140, 0.5)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x0, ay(380), w, GROUND_Y - ay(380));
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`THERMAL +${th.lift}`, x0 + 6, ay(380) + 18);
    // birds circling the thermal
    ctx.strokeStyle = '#2b1055';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.6 + i * 2.1;
      const bx = sx(th.x + Math.cos(a) * th.radius * 0.55, cam);
      const by = ay(150) + Math.sin(t * 0.9 + i) * 40;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by);
      ctx.lineTo(bx, by - 5);
      ctx.lineTo(bx + 7, by);
      ctx.stroke();
    }
    // rising dust
    ctx.fillStyle = 'rgba(255, 240, 200, 0.6)';
    for (let i = 0; i < 6; i++) {
      const py = (t * 28 + i * 53) % 320;
      const px = sx(th.x + Math.sin(t * 0.7 + i * 1.3) * th.radius * 0.6, cam);
      ctx.beginPath();
      ctx.arc(px, ay(py), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // grass strips
  for (const s of state.strips) {
    const x0 = sx(s.x - 200, cam);
    if (x0 + 160 < -50 || x0 > VIEW_W + 50) continue;
    ctx.fillStyle = '#3f7d3a';
    ctx.fillRect(x0, GROUND_Y - 6, 140, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + 10, GROUND_Y - 4, 120, 2);
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(s.name.toUpperCase(), x0, GROUND_Y - 16);
    // windsock
    const wx = x0 + 150;
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, GROUND_Y - 6);
    ctx.lineTo(wx, GROUND_Y - 40);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(wx, GROUND_Y - 40);
    ctx.lineTo(wx + 22 + Math.sin(t * 1.5) * 4, GROUND_Y - 34);
    ctx.lineTo(wx, GROUND_Y - 28);
    ctx.closePath();
    ctx.fill();
  }
  // turnpoint gates
  state.legs.forEach((leg, i) => {
    if (leg.type !== 'gate') return;
    const gx = sx(leg.targetX, cam);
    if (gx < -50 || gx > VIEW_W + 50) return;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y - 170);
    ctx.lineTo(gx, GROUND_Y);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#ffb347';
      ctx.fillRect(gx - 30 + k * 10, GROUND_Y - 190, 10, 18);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(`LEG ${i + 1}`, gx - 24, GROUND_Y - 198);
  });
  // tow plane + rope
  if (state.status === 'tow') {
    const gx = sx(state.x, cam);
    const gy = ay(state.altitude);
    const px = gx + 70;
    const py = gy - 24;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.ellipse(px, py, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 4, py - 12, 8, 12);
  }
  // glider
  const gx = sx(state.x, cam);
  const gy = ay(state.altitude);
  if (gx > -60 && gx < VIEW_W + 60 && gy > -40 && gy < VIEW_H + 40) {
    const pitch = Math.max(-0.5, Math.min(0.5, -state.vspeed / 40)) + (input.circle ? 0.3 : 0);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(pitch);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, -5, 18, 0);
    ctx.quadraticCurveTo(0, 4, -16, 0);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -1);
    ctx.lineTo(-8, -18);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-20, -8);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(16, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function updateHUD() {
  setText('hud-alt', Math.round(state.altitude));
  setText('hud-spd', Math.round(state.speed * 3.6));
  setText('hud-vs', (state.vspeed >= 0 ? '+' : '') + state.vspeed.toFixed(1));
  setText('hud-leg', `LEG ${Math.min(state.legIndex + 1, LEG_COUNT)}/${LEG_COUNT} — ${state.legs[state.legIndex].name}`);
  const ev = state.legs[state.legIndex].event;
  setText('hud-event', ev ? `EVENT: ${EVENTS[ev].name}` : '—');
  setText('hud-score', Math.round(state.score));
  setText('hud-time', fmtTime(state.timeLeft));
  setText('hud-feats', `${state.feats.length}/18`);
  const liftEl = document.getElementById('hud-lift');
  if (liftEl) {
    const lift = getLiftAt(state, state.x);
    if (state.status === 'flying' && lift.thermal > 0 && state.vspeed > 0) {
      liftEl.textContent = `THERMAL +${state.vspeed.toFixed(1)} m/s — circle to climb!`;
    } else if (state.status === 'flying' && lift.ridge > 0 && state.vspeed > 0) {
      liftEl.textContent = `RIDGE LIFT +${state.vspeed.toFixed(1)} m/s`;
    } else if (state.status === 'flying' && state.altitude < 120) {
      liftEl.textContent = 'LOW — find a thermal!';
    } else {
      liftEl.textContent = '';
    }
  }
  const msgEl = document.getElementById('hud-msg');
  if (msgEl) msgEl.textContent = state.message || '';
}

function populateRefits() {
  const titleEl = document.getElementById('refit-title');
  const scoreEl = document.getElementById('refit-score');
  const cardsEl = document.getElementById('refit-cards');
  if (titleEl) titleEl.textContent = `Leg ${state.legIndex + 1} complete!`;
  if (scoreEl) scoreEl.textContent = `Leg score ${state.legScores[state.legIndex]} pts · Total ${Math.round(state.score)} pts · ${state.message}`;
  if (!cardsEl) return;
  cardsEl.innerHTML = '';
  for (const r of state.offered) {
    const b = document.createElement('button');
    b.className = 'refit-card';
    b.dataset.refit = r.id;
    const h = document.createElement('h3');
    h.textContent = r.name;
    const p = document.createElement('p');
    p.textContent = r.desc;
    b.appendChild(h);
    b.appendChild(p);
    b.addEventListener('click', () => {
      ensureAudio();
      blip(660, 0.12);
      chooseRefit(state, r.id);
    });
    cardsEl.appendChild(b);
  }
}

function populateEnd() {
  const t = document.getElementById('end-title');
  const s = document.getElementById('end-score');
  const f = document.getElementById('end-feats');
  const won = state.status === 'won';
  if (t) t.textContent = won ? 'SUNSET — You flew all 7 legs!' : 'The sun has set';
  if (s) s.textContent = `Score ${Math.round(state.score)} · Legs ${state.stats.legsCompleted}/7 · Distance ${Math.round(state.stats.distance)} m`;
  if (f) f.textContent = `Feats ${state.feats.length}/18: ${state.feats.join(', ') || 'none yet'}`;
}

function syncOverlays() {
  if (state.status === lastStatus) return;
  lastStatus = state.status;
  const title = document.getElementById('title-screen');
  const refit = document.getElementById('refit-screen');
  const end = document.getElementById('end-screen');
  if (title) title.classList.toggle('hidden', state.status !== 'title');
  if (refit) {
    refit.classList.toggle('hidden', state.status !== 'refit');
    if (state.status === 'refit') populateRefits();
  }
  if (end) {
    end.classList.toggle('hidden', !(state.status === 'won' || state.status === 'gameover'));
    if (state.status === 'won' || state.status === 'gameover') populateEnd();
  }
}

function startBtn() {
  ensureAudio();
  blip(880, 0.1);
  startGame(state);
}

function bindInput() {
  const keymap = {
    ArrowUp: 'pitchUp', KeyW: 'pitchUp',
    ArrowDown: 'pitchDown', KeyS: 'pitchDown',
    ArrowLeft: 'circle', KeyA: 'circle',
    ArrowRight: 'circle', KeyD: 'circle',
    Space: 'airbrake',
  };
  window.addEventListener('keydown', (e) => {
    const k = keymap[e.code];
    if (k) {
      input[k] = true;
      e.preventDefault();
      ensureAudio();
    }
    if (e.code === 'KeyM') muted = !muted;
    if (e.code === 'Enter') {
      if (state.status === 'title') startBtn();
      else if (state.status === 'refit' && state.offered[0]) chooseRefit(state, state.offered[0].id);
      else if (state.status === 'won' || state.status === 'gameover') startBtn();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = keymap[e.code];
    if (k) input[k] = false;
  });
  canvas.addEventListener('mousedown', () => {
    input.circle = true;
    ensureAudio();
  });
  window.addEventListener('mouseup', () => {
    input.circle = false;
  });
  const startEl = document.getElementById('start-btn');
  if (startEl) startEl.addEventListener('click', startBtn);
  const restartEl = document.getElementById('restart-btn');
  if (restartEl) restartEl.addEventListener('click', startBtn);
}

let lastNow = 0;

function loop(now) {
  requestAnimationFrame(loop);
  if (!lastNow) lastNow = now;
  const rawDt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  const dt = rawDt * speedMul;
  const n = Math.max(1, Math.ceil(dt / 0.05));
  const h = dt / n;
  for (let i = 0; i < n; i++) step(state, input, h);
  render(now / 1000);
  updateHUD();
  syncOverlays();
  if (state.status !== prevStatus) {
    if (state.status === 'flying') blip(990, 0.1);
    if (state.status === 'refit') blip(660, 0.15);
    if (state.status === 'won') {
      blip(880, 0.12);
      blip(1320, 0.18);
    }
    if (state.status === 'gameover') blip(220, 0.3);
    prevStatus = state.status;
  }
  if (state.status === 'flying' && state.vspeed > 1) {
    const interval = Math.max(0.18, 1.1 - state.vspeed * 0.18);
    if (now - lastVarioBeep > interval * 1000) {
      blip(600 + state.vspeed * 140, 0.05, 'square', 0.025);
      lastVarioBeep = now;
    }
  }
  if (state.lastFeat && state.lastFeat !== lastToastFeat) {
    lastToastFeat = state.lastFeat;
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = `Feat unlocked: ${state.lastFeat.name} — ${state.lastFeat.desc}`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3500);
      blip(1320, 0.12);
    }
  }
}

export function bootGame(canvasId) {
  if (booted) return;
  booted = true;
  canvas = document.getElementById(canvasId);
  ctx = canvas.getContext('2d');
  decor = buildDecor();
  bindInput();
  window.__thermalSoar = {
    get state() {
      return state;
    },
    setInput(p) {
      Object.assign(input, p);
    },
    setSpeed(n) {
      speedMul = n;
    },
    start() {
      startBtn();
    },
    chooseRefit(id) {
      return chooseRefit(state, id);
    },
    core: { getLiftAt },
    version: '1.0.0',
  };
  requestAnimationFrame(loop);
}
