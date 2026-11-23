// Neon Bay world: the city, its people and cars, the wanted level, the
// police, the mission chain and the taxi jobs. Pure logic — no DOM, no
// canvas — so Node can run it headless for tests and the browser can render
// it. Every number comes from config.js; every random choice from the seed.

import { WORLD, PALETTE, SPEEDS, COMBAT, WANTED, LANDMARKS, MISSIONS, TAXI } from './config.js';
import { makeRng, intBetween, pick } from './random.js';

const TAU = Math.PI * 2;

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

// --- city generation -------------------------------------------------------

function buildCity(rng) {
  const buildings = [];
  const blocks = [];
  for (let ix = 0; ix < WORLD.avenueXs.length - 1; ix++) {
    for (let iy = 0; iy < WORLD.streetYs.length - 1; iy++) {
      const x0 = WORLD.avenueXs[ix] + WORLD.roadHalf + 14;
      const x1 = WORLD.avenueXs[ix + 1] - WORLD.roadHalf - 14;
      const y0 = WORLD.streetYs[iy] + WORLD.roadHalf + 14;
      const y1 = WORLD.streetYs[iy + 1] - WORLD.roadHalf - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      // The park block stays open; the beach strip stays open too.
      if (ix === 2 && iy === 4) continue;
      if (y0 >= WORLD.beachTop - 40) continue;
      blocks.push({ x0, y0, x1, y1 });
      const count = intBetween(rng, 1, 3);
      for (let b = 0; b < count; b++) {
        const w = intBetween(rng, 70, 150);
        const h = intBetween(rng, 60, 130);
        const bx = intBetween(rng, x0, Math.max(x0, x1 - w));
        const by = intBetween(rng, y0, Math.max(y0, y1 - h));
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, PALETTE.building),
          roof: pick(rng, PALETTE.roof),
          neon: rng() < 0.4 ? pick(rng, PALETTE.neon) : null,
          height: intBetween(rng, 1, 3),
        });
      }
    }
  }
  return { blocks, buildings };
}

function roadPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, WORLD.avenueXs), y: intBetween(rng, 100, WORLD.height - 100), axis: 'v' };
  }
  return { x: intBetween(rng, 100, WORLD.width - 100), y: pick(rng, WORLD.streetYs), axis: 'h' };
}

// --- world creation --------------------------------------------------------

export function createWorld(seed, opts = {}) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const world = {
    seed,
    rng,
    time: 0,
    city,
    cash: opts.cash ?? 120,
    missionIndex: opts.missionIndex ?? 0,
    missionStage: 'go',
    missionTimer: 0,
    missionTarget: null,
    taxi: { active: false, stage: 'idle', x: 0, y: 0, dx: 0, dy: 0, timer: 0, passenger: null },
    wanted: { level: 0, timer: 0 },
    player: {
      x: LANDMARKS.safehouse.x + 40, y: LANDMARKS.safehouse.y + 60,
      angle: Math.PI / 2, speed: 0, hp: COMBAT.playerHealth,
      onFoot: true, car: null, ammo: Infinity,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    pickups: [],
    particles: [],
    events: [],
    message: '',
    messageTimer: 0,
    busted: false,
    wasted: false,
    best: opts.best ?? 0,
    stats: { stolen: 0, shots: 0, fares: 0 },
  };
  spawnTraffic(world, 14);
  spawnParked(world, 8);
  spawnPeds(world, 26);
  spawnPickups(world, 10);
  world.shootCooldown = 0;
  world.respawnTimer = 0;
  startMission(world);
  return world;
}

function spawnTraffic(world, n) {
  const colors = ['#d64545', '#4a90d9', '#e8e8e8', '#3a3a3a', '#7fb069', '#d9a441'];
  for (let i = 0; i < n; i++) {
    const p = roadPoint(world.rng);
    world.cars.push({
      x: p.x, y: p.y,
      angle: p.axis === 'v' ? (world.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (world.rng() < 0.5 ? 0 : Math.PI),
      speed: intBetween(world.rng, 90, 170),
      color: pick(world.rng, colors),
      hp: 100, traffic: true, police: false, parked: false, driver: true,
      axis: p.axis, line: p.axis === 'v' ? p.x : p.y, dir: world.rng() < 0.5 ? 1 : -1,
    });
  }
}

function spawnParked(world, n) {
  const colors = ['#c9a227', '#5b8c5a', '#8d6b9e', '#b0b7c3', '#a34d2d'];
  for (let i = 0; i < n; i++) {
    const p = roadPoint(world.rng);
    const off = (world.rng() < 0.5 ? -1 : 1) * (WORLD.roadHalf - 8);
    world.cars.push({
      x: p.axis === 'v' ? p.x + off : p.x,
      y: p.axis === 'v' ? p.y : p.y + off,
      angle: p.axis === 'v' ? (world.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (world.rng() < 0.5 ? 0 : Math.PI),
      speed: 0, color: pick(world.rng, colors), hp: 100,
      traffic: false, police: false, parked: true, driver: false, axis: p.axis, line: 0, dir: 1,
    });
  }
}

function spawnPeds(world, n) {
  const shirts = ['#e4572e', '#17bebb', '#f3a712', '#76b041', '#e5e5e5', '#9b5de5'];
  for (let i = 0; i < n; i++) {
    const p = roadPoint(world.rng);
    world.peds.push({
      x: p.x + intBetween(world.rng, -50, 50),
      y: p.y + intBetween(world.rng, -50, 50),
      angle: world.rng() * TAU,
      speed: intBetween(world.rng, 35, SPEEDS.pedWalk),
      color: pick(world.rng, shirts),
      tx: p.x, ty: p.y, wait: 0, flee: 0,
    });
  }
}

function spawnPickups(world, n) {
  for (let i = 0; i < n; i++) {
    const p = roadPoint(world.rng);
    world.pickups.push({
      x: p.x + intBetween(world.rng, -30, 30),
      y: p.y + intBetween(world.rng, -30, 30),
      kind: world.rng() < 0.6 ? 'cash' : 'health',
      amount: world.rng() < 0.6 ? intBetween(world.rng, 20, 60) : 30,
    });
  }
}

// --- collisions ------------------------------------------------------------

function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

function pushOutOfBuildings(city, p, r) {
  const b = hitsBuilding(city, p.x, p.y, r);
  if (!b) return false;
  const dxl = p.x + r - b.x;
  const dxr = b.x + b.w - (p.x - r);
  const dyt = p.y + r - b.y;
  const dyb = b.y + b.h - (p.y - r);
  const m = Math.min(dxl, dxr, dyt, dyb);
  if (m === dxl) p.x = b.x - r;
  else if (m === dxr) p.x = b.x + b.w + r;
  else if (m === dyt) p.y = b.y - r;
  else p.y = b.y + b.h + r;
  return true;
}

// --- wanted level ----------------------------------------------------------

export function addWanted(world, stars) {
  world.wanted.level = Math.min(WANTED.max, world.wanted.level + stars);
  world.wanted.timer = WANTED.decayDelay;
}

function decayWanted(world, dt) {
  if (world.wanted.level === 0) return;
  world.wanted.timer -= dt;
  if (world.wanted.timer <= 0) {
    world.wanted.level -= 1;
    world.wanted.timer = WANTED.decayStep;
    if (world.wanted.level === 0) world.events.push({ type: 'clear' });
  }
}

// --- police ------------------------------------------------------------------

function spawnPolice(world) {
  const p = world.player;
  const want = world.wanted.level;
  const policeCars = world.cars.filter((c) => c.police).length;
  const wantCars = Math.min(want, 4);
  for (let i = policeCars; i < wantCars; i++) {
    const a = world.rng() * TAU;
    const x = clamp(p.x + Math.cos(a) * 700, 80, WORLD.width - 80);
    const y = clamp(p.y + Math.sin(a) * 500, 80, WORLD.height - 80);
    world.cars.push({
      x, y, angle: angleTo(x, y, p.x, p.y), speed: 0,
      color: PALETTE.police, hp: 100, traffic: false, police: true, parked: false,
      axis: 'v', line: 0, dir: 1,
    });
    world.events.push({ type: 'siren' });
  }
  if (want >= 3) {
    const wantCops = Math.min((want - 2) * 2, 6);
    while (world.cops.length < wantCops) {
      const a = world.rng() * TAU;
      world.cops.push({
        x: clamp(p.x + Math.cos(a) * 420, 40, WORLD.width - 40),
        y: clamp(p.y + Math.sin(a) * 420, 40, WORLD.height - 40),
        angle: 0, hp: COMBAT.copHealth,
      });
    }
  }
}

function stepPolice(world, dt) {
  const p = world.player;
  for (const car of world.cars) {
    if (!car.police) continue;
    const target = p.car ?? p;
    const d = dist(car.x, car.y, target.x, target.y);
    const want = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(want, car.angle), -2.4 * dt, 2.4 * dt);
    car.speed = Math.min(SPEEDS.policeMax, car.speed + 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (hitsBuilding(world.city, car.x, car.y, 16)) {
      car.angle += Math.PI / 2;
      car.speed *= 0.4;
    }
    if (d < 46) {
      if (p.car) {
        p.car.hp -= COMBAT.ramDamage * dt;
        world.events.push({ type: 'crash' });
        if (p.car.hp <= 0) explodeCar(world, p.car);
      } else {
        // A police car clipping the player on foot hurts and shoves them;
        // it does not arrest — only a foot cop on top of the player does.
        p.hp -= 30 * dt;
        const push = angleTo(car.x, car.y, p.x, p.y);
        p.x += Math.cos(push) * 60 * dt;
        p.y += Math.sin(push) * 60 * dt;
      }
    }
  }
  for (const cop of world.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = want;
    const sp = SPEEDS.run * 0.92;
    cop.x += Math.cos(want) * sp * dt;
    cop.y += Math.sin(want) * sp * dt;
    pushOutOfBuildings(world.city, cop, 12);
    if (d < 26 && p.onFoot && world.wanted.level > 0) bustPlayer(world);
    else if (d < 70 && p.onFoot) p.hp -= 10 * dt;
  }
  world.cops = world.cops.filter((c) => c.hp > 0);
}

function explodeCar(world, car) {
  world.particles.push({ x: car.x, y: car.y, kind: 'boom', life: 0.9, max: 0.9 });
  world.events.push({ type: 'boom' });
  car.dead = true;
  if (world.player.car === car) {
    world.player.car = null;
    world.player.onFoot = true;
    world.player.x = car.x + 30;
    world.player.y = car.y;
    world.player.hp -= 25;
  }
}

function bustPlayer(world) {
  if (world.busted || world.wasted) return;
  world.busted = true;
  const lost = Math.floor(world.cash * 0.1);
  world.cash -= lost;
  world.events.push({ type: 'busted', lost });
}

function wastePlayer(world) {
  if (world.busted || world.wasted) return;
  world.wasted = true;
  const lost = Math.floor(world.cash * 0.1);
  world.cash -= lost;
  world.events.push({ type: 'wasted', lost });
}

function respawn(world) {
  const p = world.player;
  p.x = LANDMARKS.safehouse.x + 40;
  p.y = LANDMARKS.safehouse.y + 60;
  p.hp = COMBAT.playerHealth;
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
  world.wanted.level = 0;
  world.wanted.timer = 0;
  world.cops = [];
  world.cars = world.cars.filter((c) => !c.police);
  world.busted = false;
  world.wasted = false;
  world.message = 'Back on the streets. Mara is waiting.';
  world.messageTimer = 4;
}

// --- player actions ----------------------------------------------------------

export function enterNearestCar(world) {
  const p = world.player;
  if (!p.onFoot) return false;
  let best = null;
  let bestD = 70;
  for (const car of world.cars) {
    if (car.dead || car.police) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return false;
  p.car = best;
  p.onFoot = false;
  best.parked = false;
  best.traffic = false;
  if (best.driver) {
    addWanted(world, WANTED.stealDriven);
    world.stats.stolen += 1;
    world.message = 'You jacked a ride. The cops noticed.';
    world.messageTimer = 3;
  }
  world.events.push({ type: 'enter' });
  return true;
}

export function exitCar(world) {
  const p = world.player;
  if (p.onFoot || !p.car) return false;
  const car = p.car;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.speed = 0;
  return true;
}

export function shootAt(world, tx, ty) {
  const p = world.player;
  if (!p.onFoot) return false;
  if (world.shootCooldown > 0) return false;
  world.shootCooldown = COMBAT.gunCooldown;
  const a = angleTo(p.x, p.y, tx, ty);
  p.angle = a;
  world.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, angle: a, life: COMBAT.gunRange / SPEEDS.bullet });
  world.stats.shots += 1;
  world.events.push({ type: 'shot' });
  addWanted(world, WANTED.shoot);
  return true;
}

// --- missions ------------------------------------------------------------------

export function currentMission(world) {
  return MISSIONS[world.missionIndex] ?? null;
}

function setMessage(world, text, seconds = 4) {
  world.message = text;
  world.messageTimer = seconds;
}

function completeMission(world) {
  const m = currentMission(world);
  if (!m) return;
  world.cash += m.reward;
  world.events.push({ type: 'mission', reward: m.reward });
  setMessage(world, `Mission complete: ${m.title} — +$${m.reward}`, 5);
  world.missionIndex += 1;
  world.missionStage = 'go';
  world.missionTimer = 0;
  world.missionTarget = null;
  if (world.missionIndex >= MISSIONS.length) {
    setMessage(world, 'Story complete. Taxi jobs pay from here on — look for the $ marker.', 6);
    offerTaxi(world);
  } else {
    startMission(world);
  }
}

export function startMission(world) {
  const m = currentMission(world);
  if (!m) return;
  if (m.id === 'package-run') world.missionTimer = m.timeLimit;
  if (m.id === 'lose-heat') addWanted(world, 2);
  if (m.id === 'payback') {
    world.missionTarget = {
      x: LANDMARKS.port.x, y: LANDMARKS.port.y,
      hp: COMBAT.targetHealth, angle: 0,
    };
  }
  if (m.id === 'bank-job') world.missionStage = 'go-bank';
  setMessage(world, `${m.giver}: ${m.brief}`, 6);
}

function stepMission(world, dt) {
  const m = currentMission(world);
  if (!m) return;
  const p = world.player;
  if (m.id === 'steal-car') {
    if (p.car && dist(p.car.x, p.car.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110) {
      completeMission(world);
    }
  } else if (m.id === 'package-run') {
    world.missionTimer -= dt;
    if (dist(p.x, p.y, LANDMARKS.docks.x, LANDMARKS.docks.y) < 130) {
      completeMission(world);
    } else if (world.missionTimer <= 0) {
      setMessage(world, 'Too slow — the buyers walked. Mara gives you another shot.', 5);
      world.missionTimer = m.timeLimit;
    }
  } else if (m.id === 'lose-heat') {
    if (world.wanted.level === 0) completeMission(world);
  } else if (m.id === 'payback') {
    const t = world.missionTarget;
    if (t && t.hp <= 0) completeMission(world);
  } else if (m.id === 'bank-job') {
    if (world.missionStage === 'go-bank') {
      if (dist(p.x, p.y, LANDMARKS.bank.x, LANDMARKS.bank.y) < 120) {
        world.missionStage = 'grab';
        world.missionTimer = 3;
        setMessage(world, 'Grab the cash — hold on for 3 seconds!', 3);
      }
    } else if (world.missionStage === 'grab') {
      world.missionTimer -= dt;
      if (world.missionTimer <= 0) {
        world.cash += 400;
        addWanted(world, 3);
        world.missionStage = 'escape';
        setMessage(world, 'Cash grabbed! Get back to the Safehouse and lose the cops.', 5);
      }
    } else if (world.missionStage === 'escape') {
      if (dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 130 && world.wanted.level === 0) {
        completeMission(world);
      }
    }
  }
}

export function offerTaxi(world) {
  const t = world.taxi;
  const p = roadPoint(world.rng);
  t.active = true;
  t.stage = 'pickup';
  t.x = p.x;
  t.y = p.y;
  t.timer = 0;
  t.passenger = { x: p.x, y: p.y, color: '#f3a712' };
  setMessage(world, 'Taxi job: pick up the passenger at the $ marker.', 4);
}

function stepTaxi(world, dt) {
  const t = world.taxi;
  if (!t.active) return;
  const p = world.player;
  if (t.stage === 'pickup') {
    if (p.car && dist(p.x, p.y, t.x, t.y) < TAXI.pickupRadius) {
      t.stage = 'dropoff';
      const d = roadPoint(world.rng);
      t.dx = d.x;
      t.dy = d.y;
      t.timer = 0;
      setMessage(world, 'Passenger aboard. Drop them at the flag.', 3);
    }
  } else if (t.stage === 'dropoff') {
    t.timer += dt;
    if (p.car && dist(p.x, p.y, t.dx, t.dy) < TAXI.dropoffRadius) {
      const fast = t.timer < 45;
      const fare = TAXI.fare + (fast ? TAXI.fareBonus : 0);
      world.cash += fare;
      world.stats.fares += 1;
      world.events.push({ type: 'fare', fare });
      setMessage(world, `Fare collected: +$${fare}${fast ? ' (fast bonus!)' : ''}`, 4);
      t.active = false;
      t.stage = 'idle';
      offerTaxi(world);
    }
  }
}

// --- traffic and pedestrians --------------------------------------------------

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (!car.traffic || car.dead) continue;
    if (car.axis === 'v') {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = car.line;
      if (car.y < 90 || car.y > WORLD.height - 90) {
        car.dir *= -1;
        car.line = WORLD.avenueXs[intBetween(world.rng, 0, WORLD.avenueXs.length - 1)];
        car.x = car.line;
      } else if (world.rng() < 0.002) {
        car.axis = 'h';
        car.line = WORLD.streetYs[intBetween(world.rng, 0, WORLD.streetYs.length - 1)];
        car.y = car.line;
      }
    } else {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = car.line;
      if (car.x < 90 || car.x > WORLD.width - 90) {
        car.dir *= -1;
        car.line = WORLD.streetYs[intBetween(world.rng, 0, WORLD.streetYs.length - 1)];
        car.y = car.line;
      } else if (world.rng() < 0.002) {
        car.axis = 'v';
        car.line = WORLD.avenueXs[intBetween(world.rng, 0, WORLD.avenueXs.length - 1)];
        car.x = car.line;
      }
    }
  }
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = angleTo(world.player.x, world.player.y, ped.x, ped.y);
      ped.x += Math.cos(a) * SPEEDS.pedWalk * 1.6 * dt;
      ped.y += Math.sin(a) * SPEEDS.pedWalk * 1.6 * dt;
    } else if (ped.wait > 0) {
      ped.wait -= dt;
    } else {
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const p = roadPoint(world.rng);
        ped.tx = p.x;
        ped.ty = p.y;
        ped.wait = world.rng() * 2;
      } else {
        const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
    }
    ped.x = clamp(ped.x, 30, WORLD.width - 30);
    ped.y = clamp(ped.y, 30, WORLD.height - 30);
    pushOutOfBuildings(world.city, ped, 10);
  }
}

function stepBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += Math.cos(b.angle) * SPEEDS.bullet * dt;
    b.y += Math.sin(b.angle) * SPEEDS.bullet * dt;
    b.life -= dt;
    // Hit the mission target.
    const t = world.missionTarget;
    if (t && t.hp > 0 && dist(b.x, b.y, t.x, t.y) < 20) {
      t.hp -= COMBAT.gunDamage;
      b.life = 0;
      world.particles.push({ x: b.x, y: b.y, kind: 'hit', life: 0.3, max: 0.3 });
    }
    for (const cop of world.cops) {
      if (cop.hp > 0 && dist(b.x, b.y, cop.x, cop.y) < 18) {
        cop.hp -= COMBAT.gunDamage;
        b.life = 0;
        addWanted(world, WANTED.killCop);
        world.particles.push({ x: b.x, y: b.y, kind: 'hit', life: 0.3, max: 0.3 });
      }
    }
    for (const ped of world.peds) {
      if (dist(b.x, b.y, ped.x, ped.y) < 16) {
        ped.flee = 4;
        b.life = 0;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
}

// --- the main step -------------------------------------------------------------

export function stepWorld(world, input, dt) {
  world.time += dt;
  world.events = [];
  if (world.shootCooldown > 0) world.shootCooldown -= dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.busted || world.wasted) {
    world.respawnTimer = (world.respawnTimer ?? 0) + dt;
    if (world.respawnTimer > 2.2) {
      world.respawnTimer = 0;
      respawn(world);
    }
    return world.events;
  }

  const p = world.player;
  // Health regen on foot, slow.
  if (p.onFoot && p.hp < COMBAT.playerHealth) {
    p.hp = Math.min(COMBAT.playerHealth, p.hp + COMBAT.healthRegen * dt);
  }

  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const sp = input.run ? SPEEDS.run : SPEEDS.walk;
      p.angle = Math.atan2(my / len, mx / len);
      p.x += (mx / len) * sp * dt;
      p.y += (my / len) * sp * dt;
      p.speed = sp;
    } else {
      p.speed = 0;
    }
    p.x = clamp(p.x, 20, WORLD.width - 20);
    p.y = clamp(p.y, 20, WORLD.height - 20);
    pushOutOfBuildings(world.city, p, 14);
    if (input.mouseSeen && mx === 0 && my === 0) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (input.shoot) shootAt(world, input.aimX, input.aimY);
    if (input.action) enterNearestCar(world);
  } else if (p.car) {
    const car = p.car;
    const forward = input.up ? 1 : input.down ? -0.55 : 0;
    if (forward !== 0) {
      car.speed += forward * SPEEDS.carAccel * dt;
      if (forward < 0) car.speed = Math.max(-SPEEDS.carReverseMax, car.speed);
      else car.speed = Math.min(SPEEDS.carMax, car.speed);
    } else {
      car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (Math.abs(car.speed) > 12) {
      car.angle += steer * 1.9 * dt * Math.sign(car.speed);
    }
    const before = car.speed;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = hitsBuilding(world.city, car.x, car.y, 17);
    if (hit) {
      pushOutOfBuildings(world.city, car, 17);
      if (Math.abs(before) > 260) {
        car.hp -= 18;
        p.hp -= 8;
        world.events.push({ type: 'crash' });
        world.particles.push({ x: car.x, y: car.y, kind: 'hit', life: 0.4, max: 0.4 });
      }
      car.speed *= -0.35;
    }
    car.x = clamp(car.x, 24, WORLD.width - 24);
    car.y = clamp(car.y, 24, WORLD.height - 24);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    if (car.hp <= 0) explodeCar(world, car);
    if (input.action) exitCar(world);
  }

  // Pickups.
  for (const pk of world.pickups) {
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      if (pk.kind === 'cash') {
        world.cash += pk.amount;
        world.events.push({ type: 'pickup', kind: 'cash', amount: pk.amount });
      } else {
        p.hp = Math.min(COMBAT.playerHealth, p.hp + pk.amount);
        world.events.push({ type: 'pickup', kind: 'health', amount: pk.amount });
      }
      pk.taken = true;
    }
  }
  world.pickups = world.pickups.filter((pk) => !pk.taken);
  if (world.pickups.length < 8 && world.rng() < 0.01) {
    const pt = roadPoint(world.rng);
    world.pickups.push({
      x: pt.x, y: pt.y,
      kind: world.rng() < 0.6 ? 'cash' : 'health',
      amount: intBetween(world.rng, 20, 60),
    });
  }

  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepBullets(world, dt);
  spawnPolice(world);
  stepPolice(world, dt);
  decayWanted(world, dt);
  stepMission(world, dt);
  stepTaxi(world, dt);

  for (const pt of world.particles) pt.life -= dt;
  world.particles = world.particles.filter((pt) => pt.life > 0);

  if (p.hp <= 0) wastePlayer(world);
  if (world.cash > world.best) world.best = world.cash;
  return world.events;
}

// --- save / load ---------------------------------------------------------------

export function serializeSave(world) {
  return {
    cash: world.cash,
    missionIndex: world.missionIndex,
    best: world.best,
  };
}
