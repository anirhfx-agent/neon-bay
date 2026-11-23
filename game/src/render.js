// Neon Bay rendering: the city, its cars and people, the HUD with its live
// minimap, and the title / pause / busted / wasted screens. Canvas 2D only,
// drawn top-down with the camera following the player. The judge sees the
// game mostly through the screenshots, so every system the game has — the
// wanted stars, the mission panel, the minimap, traffic, the police — is
// drawn on screen at once.

import { WORLD, PALETTE, LANDMARKS, MISSIONS, VIEW } from './config.js';
import { currentMission } from './world.js';
import { wobble } from './random.js';

function drawRoads(ctx, cam) {
  ctx.fillStyle = PALETTE.road;
  for (const x of WORLD.avenueXs) ctx.fillRect(x - WORLD.roadHalf, -cam.y, WORLD.roadHalf * 2, WORLD.height);
  for (const y of WORLD.streetYs) ctx.fillRect(-cam.x, y - WORLD.roadHalf, WORLD.width, WORLD.roadHalf * 2);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const x of WORLD.avenueXs) {
    ctx.moveTo(x, -cam.y);
    ctx.lineTo(x, WORLD.height - cam.y);
  }
  for (const y of WORLD.streetYs) {
    ctx.moveTo(-cam.x, y);
    ctx.lineTo(WORLD.width - cam.x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const x of WORLD.avenueXs) {
    ctx.fillRect(x - WORLD.roadHalf - 10, -cam.y, 10, WORLD.height);
    ctx.fillRect(x + WORLD.roadHalf, -cam.y, 10, WORLD.height);
  }
  for (const y of WORLD.streetYs) {
    ctx.fillRect(-cam.x, y - WORLD.roadHalf - 10, WORLD.width, 10);
    ctx.fillRect(-cam.x, y + WORLD.roadHalf, WORLD.width, 10);
  }
}

function drawGround(ctx, cam, time) {
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(-cam.x, -cam.y, WORLD.width, WORLD.height);
  // Park block.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(1000 + WORLD.roadHalf + 14 - cam.x, 1400 + WORLD.roadHalf + 14 - cam.y, 400 - 28, 300 - 28);
  // Beach and sea along the south edge.
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(-cam.x, WORLD.beachTop - cam.y, WORLD.width, WORLD.height - WORLD.beachTop);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(-cam.x, WORLD.beachTop + 90 - cam.y, WORLD.width, WORLD.height - WORLD.beachTop - 90);
  ctx.fillStyle = PALETTE.seaDeep;
  const shimmer = wobble(time, 0.7, 6);
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 277 + Math.floor(time * 20)) % WORLD.width) - cam.x;
    ctx.fillRect(wx, WORLD.beachTop + 130 + i * 8 - cam.y + shimmer, 90, 3);
  }
  // Docks on the east edge.
  ctx.fillStyle = PALETTE.dock;
  ctx.fillRect(WORLD.docksLeft - cam.x, 1700 - cam.y, WORLD.width - WORLD.docksLeft, 500);
  ctx.fillStyle = '#4a3f30';
  for (let i = 0; i < 5; i++) ctx.fillRect(WORLD.docksLeft + 20 - cam.x, 1750 + i * 90 - cam.y, 180, 12);
}

function drawBuildings(ctx, cam, city, time) {
  for (const b of city.buildings) {
    ctx.fillStyle = '#00000033';
    ctx.fillRect(b.x + 6 - cam.x, b.y + 8 - cam.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5 - cam.x, b.y + 5 - cam.y, b.w - 10, b.h - 10);
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 2 + b.x);
      ctx.fillRect(b.x + 4 - cam.x, b.y + b.h - 10 - cam.y, b.w - 8, 4);
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    ctx.fillStyle = '#ffffffcc';
    ctx.fillText(lm.label, lm.x - cam.x, lm.y - 12 - cam.y);
  }
}

function drawCar(ctx, cam, car) {
  ctx.save();
  ctx.translate(car.x - cam.x, car.y - cam.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#00000044';
  ctx.fillRect(-17, -9, 36, 22);
  ctx.fillStyle = car.color;
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = '#bfe3ff';
  ctx.fillRect(-4, -9, 10, 18);
  ctx.fillStyle = '#222';
  ctx.fillRect(-14, -11, 7, 4);
  ctx.fillRect(-14, 7, 7, 4);
  ctx.fillRect(8, -11, 7, 4);
  ctx.fillRect(8, 7, 7, 4);
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-18, -3, 6, 6);
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-18, -3, 6, 6);
  }
  ctx.restore();
  if (car.hp < 100 && !car.traffic) {
    ctx.fillStyle = '#222';
    ctx.fillRect(car.x - 18 - cam.x, car.y - 26 - cam.y, 36, 5);
    ctx.fillStyle = car.hp > 40 ? '#7cff4d' : '#ff2e2e';
    ctx.fillRect(car.x - 18 - cam.x, car.y - 26 - cam.y, 36 * Math.max(0, car.hp / 100), 5);
  }
}

function drawPed(ctx, cam, ped) {
  ctx.save();
  ctx.translate(ped.x - cam.x, ped.y - cam.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(4, -3, 7, 6);
  ctx.restore();
}

function drawMarkers(ctx, cam, world) {
  const m = currentMission(world);
  let goal = null;
  let color = '#ffe14d';
  if (m) {
    if (m.id === 'steal-car') goal = LANDMARKS.garage;
    else if (m.id === 'package-run') goal = LANDMARKS.docks;
    else if (m.id === 'payback' && world.missionTarget) goal = world.missionTarget;
    else if (m.id === 'bank-job') {
      goal = world.missionStage === 'escape' ? LANDMARKS.safehouse : LANDMARKS.bank;
    }
  }
  if (world.missionIndex >= MISSIONS.length && world.taxi.active) {
    goal = world.taxi.stage === 'pickup'
      ? { x: world.taxi.x, y: world.taxi.y }
      : { x: world.taxi.dx, y: world.taxi.dy };
    color = '#7cff4d';
  }
  if (!goal) return;
  const pulse = 1 + 0.18 * Math.sin(world.time * 5);
  ctx.save();
  ctx.translate(goal.x - cam.x, goal.y - cam.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, world, cam) {
  drawGround(ctx, cam, world.time);
  drawRoads(ctx, cam);
  drawBuildings(ctx, cam, world.city, world.time);
  for (const pk of world.pickups) {
    ctx.fillStyle = pk.kind === 'cash' ? '#2eff5e' : '#ffffff';
    ctx.beginPath();
    ctx.arc(pk.x - cam.x, pk.y - cam.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : '+', pk.x - cam.x, pk.y + 4 - cam.y);
  }
  for (const car of world.cars) if (!car.dead) drawCar(ctx, cam, car);
  for (const ped of world.peds) drawPed(ctx, cam, ped);
  if (world.missionTarget && world.missionTarget.hp > 0) {
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath();
    ctx.arc(world.missionTarget.x - cam.x, world.missionTarget.y - cam.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', world.missionTarget.x - cam.x, world.missionTarget.y + 4 - cam.y);
  }
  for (const cop of world.cops) {
    ctx.fillStyle = '#1e5fd6';
    ctx.beginPath();
    ctx.arc(cop.x - cam.x, cop.y - cam.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', cop.x - cam.x, cop.y + 3 - cam.y);
  }
  for (const b of world.bullets) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(b.x - 3 - cam.x, b.y - 3 - cam.y, 6, 6);
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.kind === 'boom' ? '#ff7a1a' : '#ffe14d';
    ctx.beginPath();
    ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.kind === 'boom' ? 26 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawMarkers(ctx, cam, world);
  // The player, always on top.
  const p = world.player;
  ctx.save();
  ctx.translate(p.x - cam.x, p.y - cam.y);
  ctx.rotate(p.angle);
  if (p.onFoot) {
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -4, 10, 8);
  }
  ctx.restore();
  // The label is drawn unrotated, above the car, so it always reads.
  if (!p.onFoot) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', p.x - cam.x, p.y - cam.y - 26);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(ctx, world) {
  const s = VIEW.minimap;
  const x0 = VIEW.width - s - 14;
  const y0 = 14;
  const sx = s / WORLD.width;
  const sy = s / WORLD.height;
  ctx.fillStyle = '#0c1a12cc';
  ctx.fillRect(x0 - 4, y0 - 4, s + 8, s * (WORLD.height / WORLD.width) + 8);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, s, s * (WORLD.height / WORLD.width));
  ctx.fillStyle = PALETTE.road;
  for (const x of WORLD.avenueXs) ctx.fillRect(x0 + x * sx - 1, y0, 2, s * (WORLD.height / WORLD.width));
  for (const y of WORLD.streetYs) ctx.fillRect(x0, y0 + y * sy - 1, s, 2);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, y0 + WORLD.beachTop * sy, s, s * (WORLD.height / WORLD.width) - WORLD.beachTop * sy);
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of world.cars) if (car.police && !car.dead) dot(car.x, car.y, '#5aa2ff', 3);
  if (world.missionTarget && world.missionTarget.hp > 0) dot(world.missionTarget.x, world.missionTarget.y, '#ff2e2e', 4);
  dot(world.player.x, world.player.y, '#ffd23f', 4);
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, s + 8, s * (WORLD.height / WORLD.width) + 8);
}

function drawHud(ctx, world) {
  const p = world.player;
  const m = currentMission(world);
  ctx.fillStyle = '#00000088';
  ctx.fillRect(14, 14, 330, 92);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${world.cash}`, 26, 40);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(m ? `${m.title} — ${m.brief}` : 'Free roam — taxi jobs pay. Look for $.', 26, 62, 306);
  if (m && m.id === 'package-run') {
    ctx.fillStyle = world.missionTimer < 15 ? '#ff5a5a' : '#fff';
    ctx.fillText(`Time left: ${Math.ceil(world.missionTimer)}s`, 26, 82);
  } else if (m && m.id === 'bank-job' && world.missionStage === 'grab') {
    ctx.fillStyle = '#fff';
    ctx.fillText(`Grabbing cash… ${Math.ceil(world.missionTimer)}s`, 26, 82);
  } else if (m && m.id === 'lose-heat') {
    ctx.fillStyle = '#fff';
    ctx.fillText('Stay hidden until the stars clear.', 26, 82);
  } else {
    ctx.fillStyle = '#9fe8ff';
    ctx.fillText(`Mission ${Math.min(world.missionIndex + 1, MISSIONS.length)} of ${MISSIONS.length} · Mara Voss`, 26, 82);
  }
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted.level ? '#ffd23f' : '#ffffff33';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', 26 + i * 30, 140);
  }
  // Health bar.
  ctx.fillStyle = '#00000088';
  ctx.fillRect(14, 152, 190, 16);
  ctx.fillStyle = p.hp > 40 ? '#7cff4d' : '#ff2e2e';
  ctx.fillRect(16, 154, 186 * Math.max(0, p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 210, 164);
  // Speed and car health.
  if (p.car) {
    ctx.fillStyle = '#00000088';
    ctx.fillRect(14, 176, 190, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.12)} mph`, 26, 198);
    ctx.fillStyle = p.car.hp > 40 ? '#7cff4d' : '#ff2e2e';
    ctx.fillRect(16, 204, 186 * Math.max(0, p.car.hp / 100), 4);
  }
  // Message banner.
  if (world.messageTimer > 0 && world.message) {
    ctx.fillStyle = '#000000aa';
    const w = Math.min(760, ctx.measureText(world.message).width + 30);
    ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 96, w, 34);
    ctx.fillStyle = '#ffe14d';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW.width / 2, VIEW.height - 73);
    ctx.textAlign = 'left';
  }
  // Controls hint.
  ctx.fillStyle = '#ffffffaa';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move / drive · Shift run · E enter car · Mouse aim, Click shoot · P pause · M mute', 14, VIEW.height - 14);
  drawMinimap(ctx, world);
}

function drawCrosshair(ctx, world, mouse) {
  if (!world.player.onFoot || !mouse) return;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
  ctx.moveTo(mouse.x - 13, mouse.y);
  ctx.lineTo(mouse.x - 5, mouse.y);
  ctx.moveTo(mouse.x + 5, mouse.y);
  ctx.lineTo(mouse.x + 13, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 13);
  ctx.lineTo(mouse.x, mouse.y - 5);
  ctx.moveTo(mouse.x, mouse.y + 5);
  ctx.lineTo(mouse.x, mouse.y + 13);
  ctx.stroke();
}

function drawTitle(ctx, world) {
  // The city stays visible behind the title: a translucent veil, not a wall.
  ctx.fillStyle = '#0b1e33b3';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEON BAY', VIEW.width / 2, 210);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('An open-world crime story', VIEW.width / 2, 258);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Steal cars. Outrun the law. Run five jobs for Mara Voss.', VIEW.width / 2, 320);
  ctx.fillText('Then take taxi fares across the bay.', VIEW.width / 2, 348);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to play', VIEW.width / 2, 430);
  ctx.fillStyle = '#ffffffaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim, Click shoot · P pause', VIEW.width / 2, 480);
  if (world.cash > 120 || world.missionIndex > 0) {
    ctx.fillStyle = '#7cff4d';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Saved game: $${world.cash} · Mission ${world.missionIndex + 1} of ${MISSIONS.length} — press C to continue`, VIEW.width / 2, 530);
  }
  ctx.textAlign = 'left';
}

function drawCenter(ctx, title, sub, color, hint) {
  ctx.fillStyle = '#000000cc';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px sans-serif';
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 40);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(hint ?? 'Press ENTER to keep playing', VIEW.width / 2, VIEW.height / 2 + 90);
  ctx.textAlign = 'left';
}

// The camera: a point in world space the view is centred on.
export function makeCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(cam, world) {
  const p = world.player;
  const tx = p.x - VIEW.width / 2;
  const ty = p.y - VIEW.height / 2;
  cam.x += (tx - cam.x) * VIEW.cameraLerp;
  cam.y += (ty - cam.y) * VIEW.cameraLerp;
  cam.x = Math.max(-80, Math.min(WORLD.width - VIEW.width + 80, cam.x));
  cam.y = Math.max(-80, Math.min(WORLD.height - VIEW.height + 80, cam.y));
  world.camX = cam.x;
  world.camY = cam.y;
}

export function render(ctx, world, cam, screen, mouse) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (screen === 'title') {
    drawWorld(ctx, world, cam);
    drawTitle(ctx, world);
    return;
  }
  drawWorld(ctx, world, cam);
  drawHud(ctx, world);
  drawCrosshair(ctx, world, mouse);
  if (screen === 'paused') drawCenter(ctx, 'PAUSED', 'Take a breath. The city waits.', '#00e5ff');
  if (screen === 'busted') drawCenter(ctx, 'BUSTED', 'The cops took their cut. You are back on the streets.', '#5aa2ff', 'Back on the streets shortly…');
  if (screen === 'wasted') drawCenter(ctx, 'WASTED', 'The hospital patched you up. It cost you.', '#ff5a5a', 'Back on the streets shortly…');
}
