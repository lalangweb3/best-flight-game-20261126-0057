// THERMAL SOAR — core logic tests (Node, no DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32, createGame, startGame, step, chooseRefit, getLiftAt,
  EVENTS, LEG_EVENTS, REGULARS, RIVAL, REFITS, FEATS,
  LEG_COUNT, SUNSET_SECONDS, TOW_ALTITUDE, CEILING,
} from '../game/core.js';

function flyTo(s, seconds, input = {}) {
  const steps = Math.ceil(seconds / 0.05);
  for (let i = 0; i < steps; i++) step(s, input, 0.05);
}

function startFlying(s) {
  startGame(s);
  flyTo(s, 3, {});
  assert.equal(s.status, 'flying');
}

// Find an x where there is no lift for at least 250 m ahead.
function findLiftFreeX(s) {
  for (let x = 0; x < 14000 - 300; x += 25) {
    let ok = true;
    for (let dx = 0; dx <= 250; dx += 25) {
      if (getLiftAt(s, x + dx).total > 0) {
        ok = false;
        break;
      }
    }
    if (ok) return x;
  }
  throw new Error('no lift-free stretch found');
}

test('prng: same seed gives the same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const v = mulberry32(7)();
  assert.ok(v >= 0 && v < 1);
});

test('world: 9 thermals, 5 ridges, 3 strips, 7 legs', () => {
  const s = createGame();
  assert.equal(s.thermals.length, 9);
  assert.equal(s.ridges.length, 5);
  assert.equal(s.strips.length, 3);
  assert.equal(s.legs.length, LEG_COUNT);
});

test('catalogs: 5 events, 6 regulars, 12 refits, 18 feats', () => {
  assert.equal(Object.keys(EVENTS).length, 5);
  assert.equal(LEG_EVENTS.length, 7);
  assert.equal(REGULARS.length, 6);
  assert.equal(REFITS.length, 12);
  assert.equal(FEATS.length, 18);
});

test('tow launch: releases at 300 m into flying', () => {
  const s = createGame();
  startGame(s);
  assert.equal(s.status, 'tow');
  flyTo(s, 3, {});
  assert.equal(s.status, 'flying');
  assert.ok(s.altitude >= TOW_ALTITUDE - 10, `altitude ${s.altitude} should be near 300`);
});

test('thermal climb: circling inside a thermal gains altitude and unlocks First Thermal', () => {
  const s = createGame();
  startFlying(s);
  const th = s.thermals[0];
  s.x = th.x;
  s.altitude = 200;
  const before = s.altitude;
  flyTo(s, 10, { circle: true });
  assert.ok(s.altitude > before + 15, `altitude ${s.altitude} should exceed ${before + 15}`);
  assert.ok(s.feats.includes('first-thermal'));
});

test('glide sink: outside lift the glider loses altitude', () => {
  const s = createGame();
  startFlying(s);
  s.x = findLiftFreeX(s);
  s.altitude = 300;
  flyTo(s, 5, {});
  assert.ok(s.altitude < 297, `altitude ${s.altitude} should be below 297`);
});

test('ridge lift: near a ridge the glider climbs instead of sinking', () => {
  const s = createGame();
  startFlying(s);
  const r = s.ridges[0];
  s.x = (r.x0 + r.x1) / 2;
  s.altitude = 300;
  flyTo(s, 1, {});
  assert.ok(s.altitude > 300, `altitude ${s.altitude} should exceed 300`);
});

test('gate leg: crossing the target completes the leg and scores', () => {
  const s = createGame();
  startFlying(s);
  s.x = 1990;
  s.altitude = 300;
  const scoreBefore = s.score;
  flyTo(s, 1, {});
  assert.equal(s.status, 'refit');
  assert.equal(s.stats.legsCompleted, 1);
  assert.ok(s.legScores[0] > 0);
  assert.ok(s.score > scoreBefore);
});

test('landing leg: touching down on the strip completes the leg', () => {
  const s = createGame();
  startFlying(s);
  s.legIndex = 1;
  s.x = 3990;
  s.altitude = 100;
  s.speed = 25;
  let guard = 0;
  while (s.status === 'flying' && guard < 200) {
    step(s, {}, 0.05);
    guard += 1;
  }
  assert.equal(s.status, 'refit');
  assert.equal(s.stats.legsCompleted, 1);
  assert.ok(s.legScores[1] > 0);
});

test('refit: choosing Long Wings applies its modifier and starts the next leg', () => {
  const s = createGame();
  startFlying(s);
  s.x = 1990;
  flyTo(s, 1, {});
  assert.equal(s.status, 'refit');
  assert.equal(s.offered[0].id, 'long-wings');
  assert.equal(chooseRefit(s, 'long-wings'), true);
  assert.equal(s.mods.sink, -0.2);
  assert.ok(s.refits.includes('long-wings'));
  assert.equal(s.legIndex, 1);
  assert.equal(s.status, 'tow');
});

test('refit: invalid choices are rejected', () => {
  const s = createGame();
  assert.equal(chooseRefit(s, 'long-wings'), false); // not in refit status
  startFlying(s);
  s.x = 1990;
  flyTo(s, 1, {});
  assert.equal(chooseRefit(s, 'no-such-refit'), false);
  assert.equal(chooseRefit(s, 'oxygen'), false); // not offered (only first 3 unowned)
});

test('sunset: time running out ends the day', () => {
  const s = createGame();
  startFlying(s);
  s.timeLeft = 0.05;
  step(s, {}, 0.1);
  assert.equal(s.status, 'gameover');
});

test('outlanding: running out of sky restarts the leg with a time penalty', () => {
  const s = createGame();
  startFlying(s);
  s.x = findLiftFreeX(s);
  s.altitude = 5;
  let guard = 0;
  while (s.status === 'flying' && guard < 400) {
    step(s, {}, 0.05);
    guard += 1;
  }
  assert.equal(s.status, 'tow');
  assert.equal(s.x, 0);
  assert.ok(s.timeLeft < SUNSET_SECONDS - 25);
});

test('regular bonus: completing Mira’s favorite leg scores +50%', () => {
  const s = createGame();
  startFlying(s);
  s.legIndex = 1;
  s.x = 3999;
  s.altitude = 100;
  s.speed = 35;
  step(s, {}, 0.05);
  assert.equal(s.status, 'refit');
  assert.equal(s.legScores[1], 1650);
});

test('score: distance flown adds points', () => {
  const s = createGame();
  startFlying(s);
  const before = s.score;
  flyTo(s, 10, {});
  assert.ok(s.score > before + 10, `score ${s.score} should exceed ${before + 10}`);
});

test('airbrake: descending with the airbrake loses more altitude', () => {
  const gap = findLiftFreeX(createGame());
  const a = createGame();
  startFlying(a);
  a.x = gap;
  a.altitude = 300;
  const b = createGame();
  startFlying(b);
  b.x = gap;
  b.altitude = 300;
  flyTo(a, 5, { airbrake: true });
  flyTo(b, 5, {});
  assert.ok(a.altitude < b.altitude - 3, `airbrake alt ${a.altitude} vs glide ${b.altitude}`);
});

test('dust devil: the wild thermal exists with lift 5.5 and radius 90', () => {
  const s = createGame();
  const dd = s.thermals.find((t) => t.id === 'dust-devil');
  assert.ok(dd);
  assert.equal(dd.lift, 5.5);
  assert.equal(dd.radius, 90);
});

test('cloud street: leg 3 thermals are boosted', () => {
  const s = createGame();
  const leg3 = s.thermals.filter((t) => t.leg === 3);
  assert.equal(leg3.length, 1);
  assert.ok(leg3[0].lift >= 3.5, `leg 3 thermal lift ${leg3[0].lift}`);
});

test('ceiling: altitude is capped at 1500 m', () => {
  const s = createGame();
  startFlying(s);
  const th = s.thermals[0];
  s.x = th.x;
  s.altitude = 1499;
  flyTo(s, 2, { circle: true });
  assert.ok(s.altitude <= CEILING, `altitude ${s.altitude} exceeds ceiling`);
  assert.ok(s.altitude >= 1499, `altitude ${s.altitude} should stay near the ceiling`);
});

test('rival: Vega waits on leg 7 with a 2500 target', () => {
  assert.equal(RIVAL.name, 'Vega');
  assert.equal(RIVAL.target, 2500);
  assert.equal(RIVAL.leg, 7);
});
