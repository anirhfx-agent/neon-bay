// Neon Bay input: keyboard movement and driving, mouse aim and shooting,
// and the one-shot actions (enter a car, pause, mute). The world step reads
// this object every frame; the browser fills it from real events.

export function makeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    shoot: false,
    action: false,
    aimX: 0,
    aimY: 0,
    mouseSeen: false,
    // One-shot flags, consumed once by the step that reads them.
    pressedAction: false,
    pressedPause: false,
    pressedMute: false,
    pressedEnter: false,
    pressedContinue: false,
  };
}

const KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export function attachInput(input, target) {
  target.addEventListener('keydown', (event) => {
    const field = KEYS[event.code];
    if (field) {
      input[field] = true;
      event.preventDefault();
    }
    if (event.code === 'KeyE' && !event.repeat) input.pressedAction = true;
    if (event.code === 'KeyP' && !event.repeat) input.pressedPause = true;
    if (event.code === 'KeyM' && !event.repeat) input.pressedMute = true;
    if (event.code === 'Enter' && !event.repeat) input.pressedEnter = true;
    if (event.code === 'KeyC' && !event.repeat) input.pressedContinue = true;
  });
  target.addEventListener('keyup', (event) => {
    const field = KEYS[event.code];
    if (field) input[field] = false;
  });
  target.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.run = false;
  });
}

// Mouse position is in screen pixels; the caller converts it to world
// coordinates with the camera before the world step reads it.
export function attachMouse(input, canvas, toWorld) {
  canvas.addEventListener('mousemove', (event) => {
    input.mouseSeen = true;
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (event.clientY - rect.top) * (canvas.height / rect.height);
    const w = toWorld(sx, sy);
    input.aimX = w.x;
    input.aimY = w.y;
    input.mouseX = sx;
    input.mouseY = sy;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) input.shoot = true;
  });
  canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.shoot = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Hand the one-shot flags to the world step, then clear them.
export function takeActions(input) {
  const out = {
    action: input.pressedAction,
    pause: input.pressedPause,
    mute: input.pressedMute,
    enter: input.pressedEnter,
    cont: input.pressedContinue,
  };
  input.pressedAction = false;
  input.pressedPause = false;
  input.pressedMute = false;
  input.pressedEnter = false;
  input.pressedContinue = false;
  return out;
}
