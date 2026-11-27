/** Kestrel Skies - Deterministic Screenshot Scenes */

import { createInitialState, step } from './flight.js';
import { generateTerrain, buildTerrainPolys, getRunway, getVolcanoIsland, getMainIsland } from './terrain.js';
import { generateRings, Ring } from './rings.js';
import { createCamera, CameraMode, renderFrame } from './render.js';
import { drawCockpitPanel, drawHUD } from './cockpit.js';
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
  const rings = generateRings('ringCircuit', terrain, seed);

  // Setup scene-specific state
  const { state, camera, cameraMode, missionBanner, time } = scene.setup(terrain, rings, seed);

  // Build terrain polys at the ACTUAL camera position for this shot
  const terrainPolys = buildTerrainPolys(terrain, camera.x, camera.y, camera.z, RENDER.maxTerrainPolys);

  // Render frame
  renderFrame(ctx, state, terrain, terrainPolys, rings, null, camera, width, height, time, cameraMode);

  // Draw cockpit instruments if in cockpit mode
  if (cameraMode === CameraMode.COCKPIT) {
    drawCockpitPanel(ctx, state, width, height);
  }

  // Draw HUD
  drawShotHUD(ctx, state, missionBanner, width, height, cameraMode);

  return true;
}

/** Setup cover shot: cockpit view, low over coast at golden hour, ring dead ahead, runway visible */
function setupCover(terrain, rings, seed) {
  const mainIsland = getMainIsland(terrain);
  const runway = getRunway(terrain);
  const ring1 = rings[0];

  // Start near main island coast, heading toward ring 1
  const state = createInitialState(terrain);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.7;
  state.throttle = 0.65;

  // Position: at island coast (1200m from center), looking INLAND toward ring 1
  // Ring 1 is at mainIsland + (-800, -500), on the island
  // Place plane at coast on same ray as ring, looking toward island center
  const ringAngle = Math.atan2(ring1.y - mainIsland.y, ring1.x - mainIsland.x);
  const coastDist = 1200; // at island edge (radius 1200)
  state.x = mainIsland.x + Math.cos(ringAngle) * coastDist;
  state.y = mainIsland.y + Math.sin(ringAngle) * coastDist;
  state.altitude = 160; // slightly above island peak (180m)
  state.heading = ringAngle + Math.PI; // looking back TOWARD island center / ring1
  state.speed = 45;
  state.pitch = -0.15; // proper downward pitch for good horizon

  // Settle
  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 0, y: 0 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'RING CIRCUIT - Ring 1 of 8',
    time: 1000,
  };
}

/** Setup cockpit shot: mid-turn over islands, banked horizon, checkpoint arrow */
function setupCockpit(terrain, rings, seed) {
  const mainIsland = getMainIsland(terrain);

  // Position over main island, banked turn
  const state = createInitialState(terrain);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.55;
  state.throttle = 0.7;

  // Over main island (green terrain)
  state.x = mainIsland.x + 200;
  state.y = mainIsland.y - 100;
  state.altitude = 280;
  state.heading = 0.5;
  state.speed = 55;
  state.roll = 0.55; // ~31 degree bank
  state.pitch = -0.1; // slight downward pitch to see terrain

  // Settle
  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 1, y: 0.5 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'VOLCANO MAIL RUN - Checkpoint 2 of 5',
    time: 2000,
  };
}

/** Setup chase shot: chase view, Kestrel K-7 model visible, over green terrain with village and river, ring ahead */
function setupChase(terrain, rings, seed) {
  const mainIsland = getMainIsland(terrain);
  const ring1 = rings[0];

  // Position over main island (green terrain), looking toward ring 1
  const state = createInitialState(terrain);
  state.cameraMode = 'chase';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.8;
  state.throttle = 0.65;

  // Over main island, offset toward ring 1
  const ringAngle = Math.atan2(ring1.y - mainIsland.y, ring1.x - mainIsland.x);
  state.x = mainIsland.x + Math.cos(ringAngle) * 300;
  state.y = mainIsland.y + Math.sin(ringAngle) * 300;
  state.altitude = 220;
  state.heading = ringAngle;
  state.speed = 50;
  state.pitch = -0.35; // gives chase camera pitch ~ -0.1 (looking down at plane)
  state.roll = -0.15; // slight bank for visual interest

  // Settle
  for (let i = 0; i < 10; i++) {
    step(state, { pitch: 0, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 0, y: 0 });
  }

  const camera = createCamera(state, CameraMode.CHASE);

  return {
    state,
    camera,
    cameraMode: CameraMode.CHASE,
    missionBanner: 'RING CIRCUIT - Ring 1 of 8',
    time: 3000,
  };
}

/** Setup approach shot: cockpit view, final approach to runway, runway large and centred, low altitude */
function setupApproach(terrain, rings, seed) {
  const runway = getRunway(terrain);
  const mainIsland = getMainIsland(terrain);

  const state = createInitialState(terrain);
  state.cameraMode = 'cockpit';
  state.engineRunning = true;
  state.fuel = PLANE.fuelCapacity * 0.25;
  state.throttle = 0.35;
  state.gearDown = true;
  state.flaps = 1.0;

  // On final approach, aligned with runway centerline.
  // The runway is drawn at z~0 on a 180m island, so a low approach sees
  // the strip projected onto the sea in front of the island. Stage a
  // steep, high final instead: 350m short of the threshold at 170m,
  // pitched down at the strip, so the runway lies large on the island
  // slope in the centre of the frame. (700m+ out at 60-70m - the first
  // staging tried - makes the 30m-wide strip only ~40px across and
  // puts it on the water.)
  state.heading = runway.heading;
  const distFromThreshold = 350;
  const dist = runway.length / 2 + distFromThreshold; // from runway centre
  // Runway centerline: (runway.x, runway.y) + t * (cos, sin), t negative for approach
  state.x = runway.x - Math.cos(runway.heading) * dist;
  state.y = runway.y - Math.sin(runway.heading) * dist;
  state.altitude = 170;
  state.speed = 32; // Approach speed
  state.pitch = -0.28; // steep descent onto the strip

  // Settle
  for (let i = 0; i < 10; i++) {
    step(state, { pitch: -0.05, roll: 0, throttleUp: false, throttleDown: false }, 1/60, terrain, { x: 0, y: 0 });
  }

  const camera = createCamera(state, CameraMode.COCKPIT);

  return {
    state,
    camera,
    cameraMode: CameraMode.COCKPIT,
    missionBanner: 'FINAL APPROACH - Runway 09',
    time: 4000,
  };
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