/** Kestrel Skies - Game Configuration Constants */

// World
export const WORLD_SIZE = 8000;           // World spans -WORLD_SIZE to +WORLD_SIZE
export const SEA_LEVEL = 0;
export const MAX_ALTITUDE = 3000;

// Plane Performance (Kestrel K-7)
export const PLANE = {
  mass: 800,                              // kg
  wingArea: 16,                           // m^2
  maxThrust: 3500,                        // N
  dragCoeff: 0.025,                       // Parasite drag
  liftCoeff: 1.2,                         // Max lift coefficient
  stallSpeed: 28,                         // m/s (clean)
  maxSpeed: 85,                           // m/s (level flight)
  climbRate: 6,                           // m/s at Vy
  rollRate: 90,                           // deg/s max
  pitchRate: 45,                          // deg/s max
  fuelCapacity: 120,                      // liters
  fuelBurnRate: 0.8,                      // L/s at full throttle
  damageThreshold: 15,                    // m/s impact speed for damage
};

// Colours (hex strings for Canvas)
export const COLOURS = {
  // Sky gradients (day)
  skyZenith: '#002244',
  skyHorizon: '#4488bb',
  skyGoldenZenith: '#151a30',
  skyGoldenHorizon: '#dd6622',
  // Sea
  seaDeep: '#001a33',
  seaShallow: '#004477',
  seaFoam: '#aaddff',
  // Terrain
  sand: '#e8d4b9',
  grassLight: '#4a7c2e',
  grassDark: '#2d5a1a',
  forest: '#1a4a12',
  rock: '#555555',
  volcanoRock: '#3a2a2a',
  lava: '#ff4400',
  // Runway
  runwaySurface: '#444444',
  runwayMarking: '#ffffff',
  runwayEdge: '#ffff00',
  // Rings
  ringGlow: '#00ffff',
  ringCore: '#ffffff',
  ringPassed: '#00ff88',
  // UI
  hudPrimary: '#00ffcc',
  hudSecondary: '#ffff00',
  hudWarning: '#ff4444',
  hudDim: '#668888',
  cockpitFrame: '#1a1a2e',
  instrumentFace: '#0a0a1a',
  instrumentMark: '#00ffcc',
  instrumentNeedle: '#ff3333',
  // Plane (chase view)
  fuselage: '#cc3333',
  wing: '#aa2222',
  tail: '#992222',
  propBlur: '#444444',
  // Clouds
  cloudLight: '#e8e8f0',
  cloudShadow: '#b8b8d0',
  // Sun
  sunCore: '#ffff88',
  sunGlow: '#ffaa00',
};

// Rendering
export const RENDER = {
  fov: Math.PI / 3,                       // 60 degrees
  nearPlane: 1,
  farPlane: 12000,
  horizonY: 0.4,                          // Fraction of canvas height
  maxTerrainPolys: 2000,
  cloudCount: 40,
  cloudLayerHeight: 1200,
};

// Missions
export const MISSIONS = {
  ringCircuit: {
    id: 'ringCircuit',
    name: 'Ring Circuit',
    description: 'Fly through all 8 rings in order. Precision flying rewarded.',
    ringCount: 8,
    timeLimit: 300,                       // seconds
    fuelMultiplier: 1.0,
    windStrength: 0,
  },
  volcanoMailRun: {
    id: 'volcanoMailRun',
    name: 'Volcano Mail Run',
    description: 'Hit 5 checkpoints around the volcano, then land on the runway.',
    checkpointCount: 5,
    timeLimit: 480,
    fuelMultiplier: 1.2,
    windStrength: 2,
  },
  stormPatrol: {
    id: 'stormPatrol',
    name: 'Storm Patrol',
    description: 'Navigate 6 rings in heavy crosswinds with limited fuel.',
    ringCount: 6,
    timeLimit: 240,
    fuelMultiplier: 0.7,
    windStrength: 8,
  },
};

// Input
export const INPUT = {
  keyboard: {
    pitchUp: ['ArrowUp', 'KeyW'],
    pitchDown: ['ArrowDown', 'KeyS'],
    rollLeft: ['ArrowLeft', 'KeyA'],
    rollRight: ['ArrowRight', 'KeyD'],
    throttleUp: ['ShiftLeft', 'ShiftRight'],
    throttleDown: ['ControlLeft', 'ControlRight'],
    cameraToggle: ['KeyC'],
    pause: ['Escape', 'KeyP'],
    mute: ['KeyM'],
    screenshot: ['KeyF12'],
  },
  mouse: {
    sensitivity: 0.003,
    deadzone: 0.05,
  },
  touch: {
    sensitivity: 0.005,
  },
};

// Gameplay
export const GAMEPLAY = {
  ringRadius: 60,
  ringAltitudeVariance: 150,
  checkpointRadius: 100,
  runwayLength: 800,
  runwayWidth: 30,
  landingMaxDescentRate: 3,              // m/s
  landingMaxSpeed: 35,                   // m/s
  landingMaxBank: 10,                    // degrees
  crashSpeed: 20,                        // m/s impact = crash
  stallWarningMargin: 1.2,               // x stall speed
  gLimit: 4.5,                           // Max G before damage
};

// Autopilot for screenshots
export const AUTOPILOT = {
  cover: { x: -500, y: 200, altitude: 120, speed: 45, heading: 0.5, pitch: -0.05, roll: 0, throttle: 0.6 },
  cockpit: { x: 1200, y: -800, altitude: 300, speed: 50, heading: 2.2, pitch: 0, roll: 0.6, throttle: 0.7 },
  chase: { x: -2000, y: 1500, altitude: 250, speed: 55, heading: 1.0, pitch: 0.02, roll: -0.1, throttle: 0.65 },
  approach: { x: 2500, y: 0, altitude: 60, speed: 32, heading: 3.14, pitch: -0.08, roll: 0, throttle: 0.35 },
};