/** Kestrel Skies - Deterministic Screenshot Scenes */

import { createInitialState, step } from './flight.js';
import { generateTerrain, buildTerrainPolys, getRunway, getVolcanoIsland, getMainIsland } from './terrain.js';
import { generateRings, Ring } from './rings.js';
import { createCamera, CameraMode, renderFrame, projectPoint } from './render.js';
import { drawArtificialHorizon, drawAltimeter, drawAirspeed, drawHeading, drawThrottleGauge, drawFuelGauge, drawGMeter, drawHUD } from './cockpit.js';
import { AUTOPILOT, COLOURS, PLANE, GAMEPLAY, RENDER } from './config.js';

/** Shot scene definitions */
export const SHOT_SCENES = {
  cover: { name: '1-cover.jpg', setup: setupCover },
  cockpit: { name: '2-cockpit.jpg', setup: setupCockpit },
  chase: { name: '3-chase.jpg', setup: setupChase },
  approach: { name: '4-approach.jpg', setup: setupApproach },
};

/** Render a shot scene to canvas */
export function renderShot(canvas, shotName, seed = 1) {
  const scene = SHOT_SCENES[shotName];
  if (!scene) {
    console.warn(`Unknown shot: ${shotName}`);
    return false;
  }

  const ctx = canvas.getContext('2d');
  const width = 1280;
  const height = 800;
  canvas.width = width;
  canvas.height = height;

  // Generate deterministic world
  const terrain = generateTerrain(seed);
  const terrainPolys = buildTerrainPolys(terrain, 0, 0, 100, RENDER.maxTerrainPolys);
  const rings = generateRings('ringCircuit', terrain, seed);

  // Setup scene-specific state
  const { state, camera, cameraMode, missionBanner, time } = scene.setup(terrain, rings, seed);

  // Render frame
  renderFrame(ctx, state, terrain, terrainPolys, rings, null, camera, width, height, time, cameraMode);

  // Draw cockpit instruments if in cockpit mode
  if (cameraMode === CameraMode.COCKPIT) {
    drawCockpitInstruments(ctx, state, width, height);
  }

  // Draw HUD
  drawShotHUD(ctx, state, missionBanner, width, height, cameraMode);

  return true;
}

/** Setup cover shot: cockpit view, low over coast at golden hour */
function setupCover(terrain, rings, seed) {
  const auto = AUTOPILOT.cover;
  const state = createInitialState(terrain);
  Object.assign(state, auto);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.7;
  state.throttle = auto.throttle;

  // Simulate a few steps to settle
  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 0, y: 0 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);
  // Adjust camera for golden hour lighting
  camera.timeOfDay = 0.8;

  // Ring 3 of 8 dead ahead
  const ring3 = rings[2];
  if (ring3) {
    // Position plane to look at ring
    const dx = ring3.x - state.x;
    const dy = ring3.y - state.y;
    state.heading = Math.atan2(dy, dx);
    state.pitch = (ring3.altitude - state.altitude) / Math.sqrt(dx*dx + dy*dy);
  }

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'RING CIRCUIT - Ring 3 of 8',
    time: performance.now() / 1000,
  };
}

/** Setup cockpit shot: mid-turn over islands, banked */
function setupCockpit(terrain, rings, seed) {
  const auto = AUTOPILOT.cockpit;
  const state = createInitialState(terrain);
  Object.assign(state, auto);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.5;
  state.throttle = auto.throttle;
  state.roll = auto.roll; // Banked turn

  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 2, y: 1 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);

  // Checkpoint arrow (next ring)
  const nextRing = rings.find(r => !r.passed);

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'VOLCANO MAIL RUN - Checkpoint 3 of 5',
    time: performance.now() / 1000,
  };
}

/** Setup chase shot: chase view, plane model visible */
function setupChase(terrain, rings, seed) {
  const auto = AUTOPILOT.chase;
  const state = createInitialState(terrain);
  Object.assign(state, auto);
  state.cameraMode = 'chase';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.8;
  state.throttle = auto.throttle;

  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: -1, y: 0.5 });
  }

  const camera = createCamera(state, CameraMode.CHASE);

  return {
    state,
    camera,
    cameraMode: CameraMode.CHASE,
    missionBanner: 'RING CIRCUIT - Ring 5 of 8',
    time: performance.now() / 1000,
  };
}

/** Setup approach shot: cockpit, final approach to runway */
function setupApproach(terrain, rings, seed) {
  const auto = AUTOPILOT.approach;
  const state = createInitialState(terrain);
  Object.assign(state, auto);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.3;
  state.throttle = auto.throttle;
  state.gearDown = true;
  state.flaps = 1.0;

  const runway = terrain.runway;
  if (runway) {
    // Align with runway
    state.heading = runway.heading;
    // Position on final approach
    const dist = 1500;
    state.x = runway.x - Math.cos(runway.heading) * dist;
    state.y = runway.y - Math.sin(runway.heading) * dist;
    state.altitude = 60; // ~200ft AGL
    state.speed = 32; // Approach speed
  }

  for (let i = 0; i < 10; i++) {
    step(state, { pitch: -0.1, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 0, y: 0 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'FINAL APPROACH - Runway 09',
    time: performance.now() / 1000,
  };
}

/** Draw cockpit instruments for screenshots */
function drawCockpitInstruments(ctx, state, width, height) {
  const instSize = 140;
  const margin = 20;
  const bottomY = height - margin - instSize;
  const topY = margin;

  // Artificial Horizon (center)
  drawArtificialHorizon(ctx, width / 2, height / 2, 180, state.pitch, state.roll);

  // Altimeter (left)
  drawAltimeter(ctx, margin, topY, 80, 300, state.altitude);

  // Airspeed (left, below altimeter)
  drawAirspeed(ctx, margin, topY + 320, 80, 300, state.airspeed, PLANE.stallSpeed, PLANE.maxSpeed);

  // Heading (top center)
  drawHeading(ctx, width / 2, topY + 120, 100, state.heading);

  // Throttle (right)
  drawThrottleGauge(ctx, width - margin - 60, topY, 60, 300, state.throttle);

  // Fuel (right, below throttle)
  drawFuelGauge(ctx, width - margin - 60, topY + 320, 60, 300, state.fuel, PLANE.fuelCapacity);

  // G-meter (bottom right)
  drawGMeter(ctx, width - margin - 120, bottomY, 120, 120, 1 + Math.abs(Math.tan(state.roll)) * 2);
}

/** Draw HUD for screenshot */
function drawShotHUD(ctx, state, missionBanner, width, height, cameraMode) {
  ctx.save();

  // Big ALT/SPD/HDG top-left
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLOURS.hudPrimary;
  let y = 20;
  ctx.fillText(`ALT ${Math.round(state.altitude)}m`, 30, y); y += 36;
  ctx.fillText(`SPD ${Math.round(state.airspeed)} kt`, 30, y); y += 36;
  ctx.fillText(`HDG ${(Math.round(state.heading * 180 / Math.PI) % 360).toString().padStart(3, '0')}°`, 30, y); y += 36;

  // Mission banner
  if (missionBanner) {
    ctx.fillStyle = COLOURS.hudSecondary;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(missionBanner, 30, y);
  }

  // Camera mode indicator
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '14px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(cameraMode === CameraMode.COCKPIT ? 'COCKPIT VIEW' : 'CHASE VIEW', width - 30, height - 30);

  // Bottom info bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, height - 60, width, 60);
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Kestrel Skies  |  Kestrel K-7  |  make.fun best-flight-game-20261126-0057', 30, height - 10);

  ctx.restore();
}

/** Get all shot names */
export function getShotNames() {
  return Object.keys(SHOT_SCENES);
}