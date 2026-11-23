// Neon Bay boot and main loop.
// Owns the canvas, the fixed-step loop, the screens (title, playing, paused,
// busted, wasted), the browser save, and the deterministic screenshot mode.
// The world itself lives in world.js and knows nothing about the DOM.

import { VIEW } from './config.js';
import { createWorld, stepWorld, serializeSave, currentMission } from './world.js';
import { render, makeCamera, updateCamera } from './render.js';
import { makeInput, attachInput, attachMouse, takeActions } from './input.js';
import { makeAudio, unlockAudio, playEvent, playSiren, setEngine, stepMusic } from './audio.js';
import { setupShot } from './shots.js';

const STEP = 1 / 60;
const SAVE_KEY = 'neon-bay-save-v1';

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

function writeSave(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(world)));
  } catch (err) {
    // Private mode or no storage: the game still plays.
  }
}

export function boot() {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  // In shot mode the scene is staged once (shots.js) and then frozen: the
  // screenshot must show exactly the staged frame, not whatever the world
  // drifted into while the browser got around to capturing it.
  const isShot = !!shotName;
  const seedParam = Number(params.get('seed'));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : Math.floor(Math.random() * 1e9);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  const input = makeInput();
  attachInput(input, window);
  const cam = makeCamera();
  attachMouse(input, canvas, (sx, sy) => ({ x: sx + cam.x, y: sy + cam.y }));

  const audio = makeAudio();
  const saved = readSave();

  let world;
  let screen;
  if (shotName) {
    const shot = setupShot(shotName, seed);
    world = shot.world;
    screen = shot.screen;
    updateCamera(cam, world);
  } else {
    world = createWorld(seed, saved ?? {});
    screen = 'title';
    updateCamera(cam, world);
  }

  let last = performance.now();
  let acc = 0;
  let paints = 0;
  let saveTimer = 0;

  // Small read-only handle for the headless play-through test (and anyone
  // poking at the game from the console). It changes nothing in the game.
  window.__neon = {
    get screen() { return screen; },
    get world() { return world; },
  };

  window.addEventListener('keydown', () => unlockAudio(audio), { once: true });
  window.addEventListener('pagehide', () => writeSave(world));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) writeSave(world);
  });

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const acts = takeActions(input);

    if (acts.mute) audio.muted = !audio.muted;

    if (screen === 'title') {
      if (acts.enter) {
        world = createWorld(Math.floor(Math.random() * 1e9), {});
        screen = 'playing';
        updateCamera(cam, world);
      } else if (acts.cont && saved) {
        world = createWorld(seed, saved);
        screen = 'playing';
        updateCamera(cam, world);
      }
    } else if (screen === 'paused') {
      if (acts.pause || acts.enter) screen = 'playing';
    } else if (screen === 'playing') {
      if (acts.pause) {
        screen = 'paused';
      } else if (!isShot) {
        // Fixed steps; the enter/exit action applies to the first step only.
        acc += dt;
        let first = true;
        while (acc >= STEP) {
          const stepInput = first
            ? { ...input, action: acts.action }
            : { ...input, action: false };
          const events = stepWorld(world, stepInput, STEP);
          for (const ev of events) playEvent(audio, ev);
          if (events.some((ev) => ev.type === 'mission')) writeSave(world);
          first = false;
          acc -= STEP;
        }
        if (world.busted) screen = 'busted';
        else if (world.wasted) screen = 'wasted';
        saveTimer += dt;
        if (saveTimer > 5) {
          saveTimer = 0;
          writeSave(world);
        }
      }
    } else if (screen === 'busted' || screen === 'wasted') {
      // The world respawns on its own timer; return to play when it does.
      acc += dt;
      while (acc >= STEP) {
        stepWorld(world, { ...input, action: false }, STEP);
        acc -= STEP;
      }
      if (!world.busted && !world.wasted) screen = 'playing';
    }

    updateCamera(cam, world);
    render(ctx, world, cam, screen, { x: input.mouseX ?? 0, y: input.mouseY ?? 0 });

    // Sound follows the game state.
    if (screen === 'playing') {
      if (world.wanted.level > 0) playSiren(audio, world.time);
      setEngine(audio, !!world.player.car, Math.abs(world.player.car?.speed ?? 0) / 520);
      stepMusic(audio, dt, true);
    } else {
      setEngine(audio, false, 0);
      stepMusic(audio, dt, false);
    }

    paints += 1;
    if (shotName && paints >= 2 && !window.__shotReady) {
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
