// Tuning, palette, city layout and the mission chain for Neon Bay.
// One file holds every number a designer would tweak, so the rest of the
// game reads plain words (WORLD.width, SPEEDS.run) instead of magic values.

export const WORLD = {
  width: 3200,
  height: 2400,
  // The road grid: avenues run north-south, streets east-west.
  avenueXs: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  streetYs: [200, 500, 800, 1100, 1400, 1700, 2000, 2200],
  roadHalf: 34,
  // Beach along the south edge, docks and port on the east edge.
  beachTop: 2200,
  docksLeft: 2900,
};

export const PALETTE = {
  grass: '#3f7a44',
  grassDark: '#356b3b',
  park: '#4d8a4a',
  road: '#3a3a40',
  roadLine: '#c8b45a',
  sidewalk: '#8d8d94',
  beach: '#e0c98f',
  sea: '#2b6cb0',
  seaDeep: '#1f4e79',
  dock: '#6b5b45',
  building: ['#b08968', '#7d7468', '#a67c52', '#8a7f8d', '#6f7f92', '#9c8a6d'],
  roof: ['#5a4a3a', '#4a4a55', '#6b5b45', '#3f5a6b'],
  neon: ['#ff2e88', '#00e5ff', '#ffe14d', '#7cff4d', '#ff7a1a'],
  player: '#ffd23f',
  police: '#1e5fd6',
  taxi: '#f5c518',
};

export const SPEEDS = {
  walk: 175,
  run: 265,
  carMax: 520,
  carAccel: 620,
  carBrake: 900,
  carReverseMax: 180,
  policeMax: 560,
  pedWalk: 55,
  bullet: 900,
};

export const COMBAT = {
  playerHealth: 100,
  healthRegen: 2.5,
  gunDamage: 34,
  gunCooldown: 0.22,
  gunRange: 520,
  copHealth: 60,
  targetHealth: 80,
  ramDamage: 25,
};

export const WANTED = {
  decayDelay: 9,
  decayStep: 4,
  stealParked: 0,
  stealDriven: 1,
  stealPolice: 2,
  shoot: 1,
  killCop: 2,
  max: 5,
};

// Landmarks, placed on the grid so the missions and the minimap can name them.
export const LANDMARKS = {
  safehouse: { x: 600, y: 200, label: 'Safehouse' },
  garage: { x: 1400, y: 800, label: "Rico's Garage" },
  bank: { x: 2200, y: 1400, label: 'Bay Bank' },
  hospital: { x: 1000, y: 1700, label: 'General Hospital' },
  policeHQ: { x: 1800, y: 500, label: 'Police HQ' },
  hotel: { x: 2600, y: 1100, label: 'Neon Hotel' },
  docks: { x: 3000, y: 2000, label: 'Docks' },
  port: { x: 3050, y: 800, label: 'Port' },
  park: { x: 1400, y: 1700, label: 'Palm Park' },
  beach: { x: 1600, y: 2300, label: 'Neon Beach' },
};

// The five-mission story chain for the fixer Mara Voss, then taxi work.
export const MISSIONS = [
  {
    id: 'steal-car',
    title: 'Hot Wheels',
    giver: 'Mara Voss',
    brief: 'Mara needs wheels. Steal any car and bring it to Rico’s Garage.',
    reward: 150,
    goal: 'car-at-garage',
  },
  {
    id: 'package-run',
    title: 'Package Run',
    giver: 'Mara Voss',
    brief: 'A package for the Docks. Get there in 75 seconds — the buyers wait for no one.',
    reward: 250,
    goal: 'reach-docks',
    timeLimit: 75,
  },
  {
    id: 'lose-heat',
    title: 'Cool Down',
    giver: 'Mara Voss',
    brief: 'You are at 2 stars. Lose the heat — stay out of sight until the wanted level clears.',
    reward: 200,
    goal: 'clear-wanted',
  },
  {
    id: 'payback',
    title: 'Payback',
    giver: 'Mara Voss',
    brief: 'A rat is hiding at the Port. Go there and deal with him. Watch your back.',
    reward: 350,
    goal: 'eliminate-target',
  },
  {
    id: 'bank-job',
    title: 'The Bank Job',
    giver: 'Mara Voss',
    brief: 'The big one. Reach Bay Bank, grab the cash, and get out. Then lose the cops.',
    reward: 800,
    goal: 'bank-escape',
  },
];

export const TAXI = {
  fare: 60,
  fareBonus: 40,
  pickupRadius: 90,
  dropoffRadius: 110,
};

// HUD and camera tuning.
export const VIEW = {
  width: 1280,
  height: 720,
  minimap: 168,
  cameraLerp: 0.12,
};
