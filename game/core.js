// THERMAL SOAR — pure game logic.
// No DOM, no Math.random, no Date.now. All randomness comes from a seeded PRNG,
// so every run with the same seed is identical (tests + screenshots).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_DEFAULT = 20261126;
export const LEG_COUNT = 7;
export const LEG_LENGTH = 2000;
export const TOTAL_DISTANCE = LEG_COUNT * LEG_LENGTH;
export const SUNSET_SECONDS = 600;
export const TOW_ALTITUDE = 300;
export const BASE_SPEED = 35; // m/s
export const BASE_SINK = 1.0; // m/s
export const CEILING = 1500; // m
export const LAND_ALTITUDE_MAX = 250; // m — must be at/below this to land
export const LAND_ZONE = 1500; // m past the strip before a missed approach

export const EVENTS = {
  'ridge-runner': { id: 'ridge-runner', name: 'Ridge Runner', desc: 'Ridge lift +1.0 m/s on ridge legs.' },
  'dust-devil': { id: 'dust-devil', name: 'Dust Devil', desc: 'A wild thermal: lift 5.5 m/s, radius 90 m. High risk, high reward.' },
  'cloud-street': { id: 'cloud-street', name: 'Cloud Street', desc: 'A street of cu: leg thermals +1 lift, +50 radius.' },
  'golden-hour': { id: 'golden-hour', name: 'Golden Hour', desc: 'Score x1.5 while the sun sets.' },
  'sunset-surge': { id: 'sunset-surge', name: 'Sunset Surge', desc: 'Final leg: thermal lift x2.' },
};

export const LEG_EVENTS = ['ridge-runner', 'dust-devil', 'cloud-street', 'ridge-runner', 'golden-hour', 'golden-hour', 'sunset-surge'];

export const LEG_NAMES = ['Dawn Valley', 'Meadow Run', 'Cloud Street', 'Ridge Crossing', 'Golden Valley', "Laras' Ridge", 'Sunset Final'];

export const REGULARS = [
  {
    id: 'mira', name: 'Mira', favoriteLeg: 2,
    tip: 'Thermals are strongest low — circle tight.',
    story: [
      'Mira learned to fly in this valley at sixteen.',
      'Her first solo ended in a wheat field — she still laughs about it.',
      'Today she flies the Meadow Run with a brand-new vario.',
    ],
  },
  {
    id: 'budi', name: 'Budi', favoriteLeg: 3,
    tip: 'Follow the cu line, never cross the blue gaps.',
    story: [
      'Budi chases cloud streets like highways.',
      'He once rode one street for 40 km without a single turn.',
      'He says the cu over Ridge Crossing never lies.',
    ],
  },
  {
    id: 'sari', name: 'Sari', favoriteLeg: 4,
    tip: 'Ridge lift hugs the slope — stay close.',
    story: [
      'Sari flies the Ridge Crossing every dawn.',
      'She knows every ridge by the shape of its shadow.',
      'Her landings are so soft the windsock never moves.',
    ],
  },
  {
    id: 'dedi', name: 'Dedi', favoriteLeg: 5,
    tip: 'Golden Hour pays double — fly the sunset.',
    story: [
      'Dedi is the valley’s sunset chaser.',
      'He times his final glide to the last ray of sun.',
      'Golden Hour is his favorite time to fly.',
    ],
  },
  {
    id: 'laras', name: 'Laras', favoriteLeg: 6,
    tip: 'Ridge Runner days: the slope is a highway.',
    story: [
      'Laras flies the ridge her grandmother named.',
      'She taught half the airfield to read ridge lift.',
      'Her advice: trust the wind, not the instruments.',
    ],
  },
  {
    id: 'harto', name: 'Pak Harto', favoriteLeg: 7,
    tip: 'Beat Vega’s 2500 and the day is yours.',
    story: [
      'Pak Harto has flown this valley for forty years.',
      'He has landed on every strip in every weather.',
      'He says the Sunset Final separates pilots from passengers.',
    ],
  },
];

export const RIVAL = { name: 'Vega', target: 2500, leg: 7 };

export const REFITS = [
  { id: 'long-wings', name: 'Long Wings', desc: 'Sink -0.2 m/s.', mods: { sink: -0.2 } },
  { id: 'vario', name: 'Vario', desc: 'Thermal lift +0.3, detect radius +100 m.', mods: { thermalLift: 0.3, thermalRadius: 100 } },
  { id: 'water-ballast', name: 'Water Ballast', desc: 'Speed +6 m/s, sink +0.3.', mods: { speed: 6, sink: 0.3 } },
  { id: 'flaps', name: 'Flaps', desc: 'Landing +100 pts, airbrake +0.5.', mods: { landingBonus: 100, airbrake: 0.5 } },
  { id: 'winglets', name: 'Winglets', desc: 'Sink -0.15, speed +2.', mods: { sink: -0.15, speed: 2 } },
  { id: 'oxygen', name: 'Oxygen', desc: 'Ceiling +500 m.', mods: { ceiling: 500 } },
  { id: 'solar-panel', name: 'Solar Panel', desc: 'Score +10%.', mods: { scoreMult: 0.1 } },
  { id: 'light-frame', name: 'Light Frame', desc: 'Sink -0.25.', mods: { sink: -0.25 } },
  { id: 'turbo-vario', name: 'Turbo Vario', desc: 'Thermal radius +150 m, lift +0.15.', mods: { thermalRadius: 150, thermalLift: 0.15 } },
  { id: 'airbrake-pro', name: 'Airbrake Pro', desc: 'Airbrake +1.0, landing +50.', mods: { airbrake: 1.0, landingBonus: 50 } },
  { id: 'carbon-spar', name: 'Carbon Spar', desc: 'Speed +3, sink -0.1.', mods: { speed: 3, sink: -0.1 } },
  { id: 'sunset-lens', name: 'Sunset Lens', desc: 'Golden Hour +0.5x.', mods: { goldenMult: 0.5 } },
];

export const FEATS = [
  { id: 'first-thermal', name: 'First Thermal', desc: 'Gain altitude inside a thermal.', check: (s) => s.stats.thermalGain > 0 },
  { id: 'thousand-club', name: '1000m Club', desc: 'Reach 1000 m.', check: (s) => s.stats.maxAltitude >= 1000 },
  { id: 'no-landing', name: 'No Landing', desc: 'Complete 2 gate legs in a row.', check: (s) => s.stats.gateStreak >= 2 },
  { id: 'thermal-master', name: 'Thermal Master', desc: 'Gain 300 m in a single thermal.', check: (s) => s.stats.bestThermalGain >= 300 },
  { id: 'ridge-rider', name: 'Ridge Rider', desc: 'Gain 100 m from ridge lift.', check: (s) => s.stats.ridgeGain >= 100 },
  { id: 'sunset-chaser', name: 'Sunset Chaser', desc: 'Reach the final leg.', check: (s) => s.legIndex >= 6 },
  { id: 'vega-beater', name: 'Vega Beater', desc: 'Beat Vega’s 2500 target on leg 7.', check: (s) => s.legScores[6] >= 2500 },
  { id: 'perfect-landing', name: 'Perfect Landing', desc: 'Land below 50 m at under 30 m/s.', check: (s) => s.stats.perfectLanding },
  { id: 'speed-demon', name: 'Speed Demon', desc: 'Reach 40 m/s.', check: (s) => s.stats.maxSpeed >= 40 },
  { id: 'cloud-surfer', name: 'Cloud Surfer', desc: 'Climb in a Cloud Street thermal.', check: (s) => s.stats.cloudStreetGain > 0 },
  { id: 'dust-devil-tamer', name: 'Dust Devil Tamer', desc: 'Gain 150 m in the Dust Devil.', check: (s) => s.stats.dustDevilGain >= 150 },
  { id: 'golden-glider', name: 'Golden Glider', desc: 'Score 1000+ in one Golden Hour leg.', check: (s) => s.legScores.some((v, i) => v >= 1000 && i >= 4) },
  { id: 'seven-legs', name: 'Seven Legs', desc: 'Complete all 7 legs.', check: (s) => s.stats.legsCompleted === 7 },
  { id: 'high-flyer', name: 'High Flyer', desc: 'Reach 1500 m.', check: (s) => s.stats.maxAltitude >= 1500 },
  { id: 'efficient', name: 'Efficient', desc: 'Finish a leg with 200 m+ in hand.', check: (s) => s.stats.efficientLeg },
  { id: 'regular-friend', name: 'Regular Friend', desc: 'Complete 3 favorite legs.', check: (s) => s.stats.favoriteLegs >= 3 },
  { id: 'refit-collector', name: 'Refit Collector', desc: 'Own 6 refits.', check: (s) => s.refits.length >= 6 },
  { id: 'thermal-soar', name: 'Thermal Soar', desc: 'Gain 2000 m total in thermals.', check: (s) => s.stats.thermalGain >= 2000 },
];

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const thermals = [];
  const perLeg = [1, 2, 1, 2, 1, 1, 1]; // 9 thermals total
  for (let leg = 0; leg < LEG_COUNT; leg++) {
    const start = leg * LEG_LENGTH;
    for (let j = 0; j < perLeg[leg]; j++) {
      const x = Math.round(start + 600 + rng() * 1200);
      let lift = 2.5 + rng() * 2;
      let radius = Math.round(120 + rng() * 80);
      let id = `th-${leg + 1}-${j + 1}`;
      let name = `Thermal ${leg + 1}.${j + 1}`;
      if (leg === 1 && j === 0) {
        lift = 5.5;
        radius = 90;
        id = 'dust-devil';
        name = 'Dust Devil';
      }
      if (LEG_EVENTS[leg] === 'cloud-street') {
        lift += 1;
        radius += 50;
      }
      thermals.push({ id, name, leg: leg + 1, x, radius, lift: Math.round(lift * 10) / 10 });
    }
  }
  const ridges = [];
  const ridgeLegs = [0, 1, 3, 4, 5]; // 5 ridge lines
  for (const leg of ridgeLegs) {
    const start = leg * LEG_LENGTH;
    const x0 = Math.round(start + 1000 + rng() * 600);
    const x1 = x0 + Math.round(600 + rng() * 300);
    ridges.push({ id: `ridge-${leg + 1}`, leg: leg + 1, x0, x1, lift: 1.5 });
  }
  const strips = [
    { id: 'meadow', name: 'Meadow Strip', x: 4000, leg: 2 },
    { id: 'ridge', name: 'Ridge Strip', x: 8000, leg: 4 },
    { id: 'sunset', name: 'Sunset Field', x: 14000, leg: 7 },
  ];
  const legs = [];
  for (let i = 0; i < LEG_COUNT; i++) {
    const startX = i * LEG_LENGTH;
    const isLand = i === 1 || i === 3 || i === 6;
    legs.push({
      index: i,
      name: LEG_NAMES[i],
      type: isLand ? 'land' : 'gate',
      startX,
      targetX: (i + 1) * LEG_LENGTH,
      event: LEG_EVENTS[i],
      strip: isLand ? strips.find((s) => s.leg === i + 1) : null,
    });
  }
  return { thermals, ridges, strips, legs };
}

export function createGame(seed = SEED_DEFAULT) {
  const world = buildWorld(seed);
  return {
    seed,
    status: 'title', // title | tow | flying | refit | won | gameover
    legIndex: 0,
    x: 0,
    altitude: 0,
    speed: 0,
    vspeed: 0,
    score: 0,
    timeLeft: SUNSET_SECONDS,
    towTime: 0,
    thermals: world.thermals,
    ridges: world.ridges,
    strips: world.strips,
    legs: world.legs,
    mods: { sink: 0, speed: 0, thermalLift: 0, ridgeLift: 0, thermalRadius: 0, ceiling: 0, scoreMult: 0, landingBonus: 0, airbrake: 0, goldenMult: 0 },
    refits: [],
    offered: [],
    feats: [],
    legScores: [0, 0, 0, 0, 0, 0, 0],
    stats: {
      maxAltitude: 0, maxSpeed: 0, thermalGain: 0, ridgeGain: 0,
      bestThermalGain: 0, currentThermalGain: 0, dustDevilGain: 0, cloudStreetGain: 0,
      gateStreak: 0, favoriteLegs: 0, legsCompleted: 0,
      perfectLanding: false, efficientLeg: false, distance: 0,
    },
    message: '',
    lastFeat: null,
  };
}

export function startGame(state) {
  const fresh = createGame(state.seed);
  for (const k of Object.keys(fresh)) state[k] = fresh[k];
  state.status = 'tow';
  state.message = 'Tow launch — hold on tight!';
}

export function getLiftAt(state, x) {
  let thermal = 0;
  let ridge = 0;
  let thermalId = null;
  for (const t of state.thermals) {
    if (Math.abs(x - t.x) < t.radius + state.mods.thermalRadius) {
      if (t.lift > thermal) {
        thermal = t.lift;
        thermalId = t.id;
      }
    }
  }
  for (const r of state.ridges) {
    if (x >= r.x0 && x <= r.x1) ridge = Math.max(ridge, r.lift);
  }
  const legEvent = state.legs[state.legIndex] ? state.legs[state.legIndex].event : null;
  if (legEvent === 'sunset-surge') thermal *= 2;
  if (legEvent === 'ridge-runner' && ridge > 0) ridge += 1.0;
  return { thermal, ridge, thermalId, total: thermal + ridge };
}

export function inThermal(state, x) {
  return getLiftAt(state, x).thermal > 0;
}

export function nearRidge(state, x) {
  return getLiftAt(state, x).ridge > 0;
}

function checkFeats(state) {
  for (const f of FEATS) {
    if (!state.feats.includes(f.id) && f.check(state)) {
      state.feats.push(f.id);
      state.lastFeat = f;
    }
  }
}

function firstUnownedRefits(state, n) {
  return REFITS.filter((r) => !state.refits.includes(r.id)).slice(0, n);
}

function completeLeg(state, how) {
  const leg = state.legs[state.legIndex];
  let legScore = 500 + Math.round((leg.targetX - leg.startX) * 0.1) + Math.round(state.altitude) * 2;
  if (how === 'land') legScore += 200 + state.mods.landingBonus;
  if (how === 'land' && state.stats.perfectLanding) legScore += 150;
  const regular = REGULARS.find((r) => r.favoriteLeg === state.legIndex + 1);
  if (regular) {
    legScore = Math.round(legScore * 1.5);
    state.stats.favoriteLegs += 1;
    state.message = `${regular.name} cheers you on — favorite leg, +50%!`;
  }
  if (state.legIndex >= 4) legScore = Math.round(legScore * (1.5 + state.mods.goldenMult));
  if (state.mods.scoreMult) legScore = Math.round(legScore * (1 + state.mods.scoreMult));
  state.legScores[state.legIndex] = legScore;
  state.score += legScore;
  state.stats.legsCompleted += 1;
  if (how === 'gate') state.stats.gateStreak += 1;
  else state.stats.gateStreak = 0;
  if (state.altitude >= 200) state.stats.efficientLeg = true;
  state.stats.currentThermalGain = 0;
  checkFeats(state);
  if (state.legIndex === LEG_COUNT - 1) {
    state.status = 'won';
    const beat = legScore >= RIVAL.target;
    state.message = beat
      ? `You beat ${RIVAL.name}'s ${RIVAL.target} on the final leg!`
      : `Finished — ${RIVAL.name}'s target was ${RIVAL.target}.`;
    return;
  }
  state.status = 'refit';
  state.offered = firstUnownedRefits(state, 3);
  if (!regular) state.message = `Leg ${state.legIndex + 1} complete — ${legScore} pts. Choose a refit.`;
}

function fieldLanding(state, reason) {
  state.timeLeft -= 30;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.status = 'gameover';
    state.message = 'The sun has set. The day is over.';
    return;
  }
  state.stats.gateStreak = 0;
  state.stats.currentThermalGain = 0;
  state.x = state.legs[state.legIndex].startX;
  state.altitude = 0;
  state.speed = 0;
  state.vspeed = 0;
  state.towTime = 0;
  state.status = 'tow';
  state.message = `Field landing — ${reason} (-30 s). Tow again!`;
}

export function chooseRefit(state, refitId) {
  if (state.status !== 'refit') return false;
  const refit = state.offered.find((r) => r.id === refitId);
  if (!refit) return false;
  for (const k of Object.keys(refit.mods)) {
    state.mods[k] = (state.mods[k] || 0) + refit.mods[k];
  }
  state.refits.push(refit.id);
  state.legIndex += 1;
  state.x = state.legs[state.legIndex].startX;
  state.altitude = 0;
  state.speed = 0;
  state.vspeed = 0;
  state.towTime = 0;
  state.status = 'tow';
  state.message = `Tow launch — Leg ${state.legIndex + 1}: ${state.legs[state.legIndex].name}`;
  return true;
}

export function step(state, input = {}, dt = 0.05) {
  const d = Math.min(Math.max(dt, 0), 0.1);
  if (state.status === 'title' || state.status === 'refit' || state.status === 'won' || state.status === 'gameover') return;
  state.timeLeft -= d;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.status = 'gameover';
    state.message = 'The sun has set. The day is over.';
    return;
  }

  if (state.status === 'tow') {
    state.towTime += d;
    state.altitude = Math.min(TOW_ALTITUDE, state.altitude + 120 * d);
    state.speed = BASE_SPEED;
    state.x += state.speed * d;
    if (state.towTime >= 2.5) {
      state.status = 'flying';
      state.message = `Leg ${state.legIndex + 1} — ${state.legs[state.legIndex].name}. Find lift!`;
    }
    return;
  }

  // flying
  const leg = state.legs[state.legIndex];
  let targetSpeed = BASE_SPEED + state.mods.speed;
  if (input.pitchUp) targetSpeed -= 10;
  if (input.pitchDown) targetSpeed += 12;
  if (input.circle) targetSpeed = 12;
  if (input.airbrake) targetSpeed -= 15;
  targetSpeed = Math.max(8, Math.min(60, targetSpeed));
  const dv = Math.max(-20 * d, Math.min(20 * d, targetSpeed - state.speed));
  state.speed += dv;

  let sink = BASE_SINK + state.mods.sink;
  if (input.airbrake) sink += 1.0 + state.mods.airbrake;
  if (input.pitchDown) sink += 0.5;
  if (input.pitchUp) sink += 0.2;
  if (input.circle) sink += 0.3;

  const lift = getLiftAt(state, state.x);
  let liftValue = lift.thermal + lift.ridge + state.mods.thermalLift + state.mods.ridgeLift;
  if (input.circle) liftValue += lift.thermal * 0.6;
  if (input.pitchUp) liftValue += lift.thermal * 0.3;

  state.vspeed = liftValue - sink;
  state.altitude += state.vspeed * d;
  const ceiling = CEILING + state.mods.ceiling;
  if (state.altitude > ceiling) state.altitude = ceiling;
  if (state.altitude < 0) state.altitude = 0;
  state.x += state.speed * d;
  state.stats.distance += state.speed * d;
  state.score += state.speed * d * 0.05;
  if (state.altitude > state.stats.maxAltitude) state.stats.maxAltitude = state.altitude;
  if (state.speed > state.stats.maxSpeed) state.stats.maxSpeed = state.speed;

  if (lift.thermal > 0 && state.vspeed > 0) {
    const g = state.vspeed * d;
    state.stats.thermalGain += g;
    state.stats.currentThermalGain += g;
    if (lift.thermalId === 'dust-devil') state.stats.dustDevilGain += g;
    if (leg.event === 'cloud-street') state.stats.cloudStreetGain += g;
    if (state.stats.currentThermalGain > state.stats.bestThermalGain) {
      state.stats.bestThermalGain = state.stats.currentThermalGain;
    }
  } else {
    state.stats.currentThermalGain = 0;
  }
  if (lift.ridge > 0 && state.vspeed > 0) state.stats.ridgeGain += state.vspeed * d;

  checkFeats(state);

  if (leg.type === 'gate') {
    if (state.x >= leg.targetX) completeLeg(state, 'gate');
  } else if (state.x >= leg.targetX && state.altitude <= LAND_ALTITUDE_MAX) {
    if (state.altitude <= 50 && state.speed <= 30) state.stats.perfectLanding = true;
    completeLeg(state, 'land');
  } else if (state.x >= leg.targetX + LAND_ZONE) {
    fieldLanding(state, 'Missed approach — overshot the strip.');
  }

  if (state.status === 'flying' && state.altitude <= 0) {
    state.altitude = 0;
    fieldLanding(state, 'Outlanding — ran out of sky.');
  }
}
