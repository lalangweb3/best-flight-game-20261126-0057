// scripts/shot.js — Playwright headless: real gameplay + 4 screenshots (<256 KiB each).
// Serves the project over HTTP, plays leg 1 (thermal climb, ridge lift, gate),
// picks a refit, then lands leg 2 on Meadow Strip. Exits 0 only if every
// assertion passes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');

let playwright = null;
try {
  playwright = require('playwright');
} catch {
  try {
    playwright = require('/home/hatch/muse-web3-bot/node_modules/playwright');
  } catch (e) {
    console.error('PLAYWRIGHT NOT FOUND: ' + e.message);
    process.exit(2);
  }
}
const { chromium } = playwright;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(ROOT, urlPath === '/' ? 'game/index.html' : urlPath);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getState(page) {
  return page.evaluate(() => {
    const h = window.__thermalSoar;
    const s = h.state;
    return {
      status: s.status,
      legIndex: s.legIndex,
      x: s.x,
      altitude: s.altitude,
      speed: s.speed,
      vspeed: s.vspeed,
      score: s.score,
      timeLeft: s.timeLeft,
      legsCompleted: s.stats.legsCompleted,
      thermalGain: s.stats.thermalGain,
      feats: s.feats.length,
      thermals: s.thermals.map((t) => ({ x: t.x, radius: t.radius, lift: t.lift, id: t.id })),
      ridges: s.ridges.map((r) => ({ x0: r.x0, x1: r.x1, lift: r.lift })),
      strips: s.strips.map((st) => ({ x: st.x, name: st.name })),
    };
  });
}

function nearestThermal(s) {
  let best = null;
  let bestD = 1e9;
  for (const t of s.thermals) {
    const d = Math.abs(s.x - t.x);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return { t: best, d: bestD };
}

async function setInput(page, patch) {
  await page.evaluate((p) => window.__thermalSoar.setInput(p), patch);
}

async function main() {
  const fails = [];
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 480 } });
  page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE-ERROR: ' + m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/game/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__thermalSoar, null, { timeout: 15000 });

  // 01 — title screen with the quantified pitch
  await page.screenshot({ path: path.join(SHOTS, '01-title.png') });
  console.log('SHOT 01-title done');

  await page.click('#start-btn');
  await page.waitForFunction(() => window.__thermalSoar.state.status === 'flying', null, { timeout: 15000 });
  await page.evaluate(() => window.__thermalSoar.setSpeed(6));

  let tookThermal = false;
  let tookRidge = false;
  let thermalStartAlt = null;
  let thermalPeak = 0;

  // --- Leg 1: climb in a thermal, ride the ridge, reach the gate ---
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const s = await getState(page);
    if (s.status === 'refit') break;
    if (s.status === 'won' || s.status === 'gameover') {
      fails.push('leg 1 ended with status ' + s.status);
      break;
    }
    if (s.status === 'tow') {
      await sleep(200);
      continue;
    }
    const { t, d } = nearestThermal(s);
    const inTh = t && d < t.radius;
    if (inTh) {
      if (thermalStartAlt === null) thermalStartAlt = s.altitude;
      thermalPeak = Math.max(thermalPeak, s.altitude);
      await setInput(page, { circle: true, pitchUp: true, pitchDown: false, airbrake: false });
      if (!tookThermal && thermalPeak - thermalStartAlt >= 50) {
        await page.screenshot({ path: path.join(SHOTS, '02-thermal.png') });
        console.log('SHOT 02-thermal done alt=' + Math.round(s.altitude));
        tookThermal = true;
      }
    } else {
      thermalStartAlt = null;
      await setInput(page, { circle: false, pitchUp: false, pitchDown: s.altitude > 260, airbrake: false });
    }
    if (!tookRidge) {
      const onRidge = await page.evaluate(() => {
        const h = window.__thermalSoar;
        return h.core.getLiftAt(h.state, h.state.x).ridge > 0;
      });
      if (onRidge) {
        await page.screenshot({ path: path.join(SHOTS, '03-ridge.png') });
        console.log('SHOT 03-ridge done');
        tookRidge = true;
      }
    }
    await sleep(200);
  }
  const s1 = await getState(page);
  console.log('LEG1 status=' + s1.status + ' legsCompleted=' + s1.legsCompleted + ' score=' + Math.round(s1.score));
  if (s1.status !== 'refit') {
    fails.push('leg 1 did not complete (status ' + s1.status + ')');
  } else {
    // pick the first refit card (Long Wings)
    await page.click('.refit-card >> nth=0');
    await page.waitForFunction(() => window.__thermalSoar.state.status === 'flying', null, { timeout: 15000 });

    // --- Leg 2: glide, stay low, land on Meadow Strip ---
    const t1 = Date.now();
    let landed = false;
    while (Date.now() - t1 < 150000) {
      const s = await getState(page);
      if (s.status === 'refit') {
        landed = true;
        break;
      }
      if (s.status === 'won' || s.status === 'gameover') {
        fails.push('leg 2 ended with status ' + s.status);
        break;
      }
      if (s.status === 'tow') {
        await sleep(200);
        continue;
      }
      const strip = s.strips[0]; // Meadow Strip at 4000
      const { t, d } = nearestThermal(s);
      const inTh = t && d < t.radius;
      const distToStrip = strip.x - s.x;
      if (distToStrip < 1600 && distToStrip > 0) {
        // descend to land
        await setInput(page, { circle: false, pitchUp: false, pitchDown: true, airbrake: true });
      } else if (inTh && s.altitude < 180) {
        await setInput(page, { circle: true, pitchUp: true, pitchDown: false, airbrake: false });
      } else {
        await setInput(page, { circle: false, pitchUp: false, pitchDown: s.altitude > 300, airbrake: false });
      }
      await sleep(200);
    }
    const s2 = await getState(page);
    console.log('LEG2 status=' + s2.status + ' legsCompleted=' + s2.legsCompleted + ' score=' + Math.round(s2.score));
    if (landed) {
      await sleep(600);
      await page.screenshot({ path: path.join(SHOTS, '04-landing.png') });
      console.log('SHOT 04-landing done');
    } else {
      fails.push('leg 2 did not land (status ' + s2.status + ')');
    }
  }

  const final = await getState(page);
  if (final.thermalGain < 50) fails.push('thermalGain ' + Math.round(final.thermalGain) + ' < 50');
  if (final.legsCompleted < 2) fails.push('legsCompleted ' + final.legsCompleted + ' < 2');
  if (final.score <= 0) fails.push('score <= 0');
  if (!tookThermal) fails.push('no thermal screenshot');
  if (!tookRidge) fails.push('no ridge screenshot');

  const files = ['01-title.png', '02-thermal.png', '03-ridge.png', '04-landing.png'];
  for (const f of files) {
    const p = path.join(SHOTS, f);
    if (!fs.existsSync(p)) {
      fails.push('missing ' + f);
      continue;
    }
    const size = fs.statSync(p).size;
    console.log('SIZE ' + f + ' ' + Math.round(size / 1024) + ' KiB');
    if (size > 256 * 1024) fails.push(f + ' over 256 KiB');
  }

  await browser.close();
  server.close();
  if (fails.length) {
    console.log('FAIL: ' + fails.join(' | '));
    process.exit(1);
  }
  console.log('ALL SHOTS OK');
}

main().catch((e) => {
  console.error('SHOT ERROR: ' + (e && e.message));
  process.exit(1);
});
