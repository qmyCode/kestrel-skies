/** Kestrel Skies - Main Game Loop & Screen Management */

import { WORLD_SIZE, PLANE, GAMEPLAY, MISSIONS, COLOURS, INPUT } from './config.js';
import { generateTerrain, buildTerrainPolys } from './terrain.js';
import { createInitialState, step, checkLanding } from './flight.js';
import { generateRings, checkRingPass, getRingProgress, resetRings } from './rings.js';
import { createMission, getMissionIds, getMissionConfig } from './missions.js';
import { initInput, updateInput, getFlightInput, wasKeyPressed, getControlSchemeText } from './input.js';
import { createCamera, CameraMode, renderFrame } from './render.js';
import { drawArtificialHorizon, drawAltimeter, drawAirspeed, drawHeading, drawThrottleGauge, drawFuelGauge, drawGMeter, drawHUD, drawBriefing, drawMissionEnd, drawPause } from './cockpit.js';
import { initAudio, unlockAudio, playWind, updateWind, playEngine, updateEngine, playRingChime, playStallWarning, playCrash, toggleMute, isMutedState, cleanupAudio } from './audio.js';
import { renderShot, getShotNames, SHOT_SCENES } from './shots.js';

// --- Game State ---
const GameState = {
  TITLE: 'title',
  MISSION_SELECT: 'missionSelect',
  BRIEFING: 'briefing',
  PLAYING: 'playing',
  PAUSED: 'paused',
  MISSION_END: 'missionEnd',
  SHOT: 'shot',
};

let canvas = null;
let ctx = null;
let currentState = GameState.TITLE;
let selectedMissionIndex = 0;
let mission = null;
let terrain = null;
let terrainPolys = null;
let rings = null;
let flightState = null;
let camera = null;
let cameraMode = CameraMode.COCKPIT;
let lastTime = 0;
let animFrameId = null;
let seed = 12345;
let screenshotMode = false;

// --- DOM Elements ---
const statusLine = document.getElementById('aria-status');

// --- Initialize ---
export async function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  // Handle ?shot= query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const shotParam = urlParams.get('shot');
  const seedParam = parseInt(urlParams.get('seed') || '1', 10);
  if (shotParam && SHOT_SCENES[shotParam]) {
    screenshotMode = true;
    seed = seedParam;
    canvas.width = 1280;
    canvas.height = 800;
    renderScreenshot(shotParam, seedParam);
    return;
  }

  // Normal game
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  initInput(canvas);
  initAudio();

  // Generate world
  terrain = generateTerrain(seed);
  terrainPolys = buildTerrainPolys(terrain, 0, 0, 100);
  flightState = createInitialState(terrain);
  rings = generateRings('ringCircuit', terrain, seed);

  // Start with title screen
  setState(GameState.TITLE);
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  if (screenshotMode) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function setState(newState) {
  currentState = newState;
  updateStatus();
}

function updateStatus() {
  if (statusLine) {
    const messages = {
      [GameState.TITLE]: 'Kestrel Skies - Title Screen',
      [GameState.MISSION_SELECT]: 'Mission Select',
      [GameState.BRIEFING]: 'Mission Briefing',
      [GameState.PLAYING]: 'Flying',
      [GameState.PAUSED]: 'Paused',
      [GameState.MISSION_END]: 'Mission Complete',
    };
    statusLine.textContent = messages[currentState] || currentState;
  }
}

function renderScreenshot(shotName, seed) {
  const success = renderShot(canvas, shotName, seed);
  if (success) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = SHOT_SCENES[shotName].name;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);
  }
  setState(GameState.SHOT);
}

// --- Game Loop ---
function gameLoop(time) {
  const dt = Math.min((time - lastTime) / 1000, 1/30);
  lastTime = time;

  updateInput(dt);
  unlockAudio();

  handleGlobalInput();

  switch (currentState) {
    case GameState.TITLE:
      drawTitleScreen();
      break;
    case GameState.MISSION_SELECT:
      handleMissionSelectInput();
      drawMissionSelect();
      break;
    case GameState.BRIEFING:
      handleBriefingInput();
      drawBriefingScreen();
      break;
    case GameState.PLAYING:
      updateGameplay(dt);
      drawGameplay();
      break;
    case GameState.PAUSED:
      drawGameplay();
      drawPause(ctx, canvas.width, canvas.height);
      break;
    case GameState.MISSION_END:
      handleMissionEndInput();
      drawMissionEndScreen();
      break;
    case GameState.SHOT:
      break;
  }

  animFrameId = requestAnimationFrame(gameLoop);
}

function handleGlobalInput() {
  // Pause / Back
  if (wasKeyPressed('Escape') || wasKeyPressed('KeyP')) {
    if (currentState === GameState.PLAYING) {
      setState(GameState.PAUSED);
    } else if (currentState === GameState.PAUSED) {
      setState(GameState.PLAYING);
    } else if (currentState === GameState.MISSION_END) {
      setState(GameState.MISSION_SELECT);
    } else if (currentState === GameState.BRIEFING) {
      setState(GameState.MISSION_SELECT);
    }
    return;
  }

  // Mute
  if (wasKeyPressed('KeyM')) {
    toggleMute();
  }

  // Camera toggle
  if (wasKeyPressed('KeyC')) {
    cameraMode = cameraMode === CameraMode.COCKPIT ? CameraMode.CHASE : CameraMode.COCKPIT;
    flightState.cameraMode = cameraMode;
  }

  // Screenshot (F12)
  if (wasKeyPressed('F12')) {
    takeScreenshot();
  }
}

// --- Title Screen ---
function drawTitleScreen() {
  ctx.fillStyle = '#000011';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple starfield
  ctx.fillStyle = '#ffffff';
  const starRng = mulberry32(0x57A05);
  for (let i = 0; i < 200; i++) {
    const x = starRng() * canvas.width;
    const y = starRng() * canvas.height * 0.6;
    const size = starRng() * 1.5 + 0.5;
    ctx.globalAlpha = starRng() * 0.5 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KESTREL SKIES', canvas.width / 2, canvas.height / 2 - 100);

  ctx.fillStyle = COLOURS.hudSecondary;
  ctx.font = '20px monospace';
  ctx.fillText('A Tropical Archipelago Flight Game', canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '16px monospace';
  ctx.fillText('Press ENTER to Start', canvas.width / 2, canvas.height / 2 + 40);

  // Version/badge
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('make.fun best-flight-game-20261126-0057', canvas.width - 20, canvas.height - 20);
}

function handleTitleInput() {
  if (wasKeyPressed('Enter') || wasKeyPressed('Space')) {
    setState(GameState.MISSION_SELECT);
  }
}

// Add title input handling to gameLoop
const originalGameLoop = gameLoop;
const gameLoopWrapper = function(time) {
  if (currentState === GameState.TITLE) handleTitleInput();
  originalGameLoop(time);
};

// --- Mission Select ---
function drawMissionSelect() {
  ctx.fillStyle = '#000022';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('SELECT MISSION', canvas.width / 2, 60);

  const missionIds = getMissionIds();
  const startY = 160;
  const spacing = 100;

  for (let i = 0; i < missionIds.length; i++) {
    const config = getMissionConfig(missionIds[i]);
    const y = startY + i * spacing;
    const selected = i === selectedMissionIndex;

    // Background
    if (selected) {
      ctx.fillStyle = 'rgba(0,255,204,0.1)';
      ctx.fillRect(canvas.width / 2 - 300, y - 10, 600, 80);
      ctx.strokeStyle = COLOURS.hudPrimary;
      ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width / 2 - 300, y - 10, 600, 80);
    }

    // Mission name
    ctx.fillStyle = selected ? COLOURS.hudPrimary : COLOURS.hudSecondary;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(config.name, canvas.width / 2, y);

    // Description
    ctx.fillStyle = COLOURS.hudDim;
    ctx.font = '14px monospace';
    ctx.fillText(config.description, canvas.width / 2, y + 30);

    // Stats
    ctx.font = '12px monospace';
    ctx.fillText(`Time: ${config.timeLimit}s  |  Fuel: ${Math.round(config.fuelMultiplier * 100)}%  |  Wind: ${config.windStrength}m/s`, canvas.width / 2, y + 50);
  }

  // Controls hint
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '14px monospace';
  ctx.fillText('↑/↓ to select  |  ENTER to brief  |  ESC to go back', canvas.width / 2, canvas.height - 40);
}

function handleMissionSelectInput() {
  if (wasKeyPressed('ArrowUp') || wasKeyPressed('KeyW')) {
    selectedMissionIndex = (selectedMissionIndex - 1 + 3) % 3;
  }
  if (wasKeyPressed('ArrowDown') || wasKeyPressed('KeyS')) {
    selectedMissionIndex = (selectedMissionIndex + 1) % 3;
  }
  if (wasKeyPressed('Enter') || wasKeyPressed('Space')) {
    startMission(selectedMissionIndex);
  }
}

// --- Start Mission ---
function startMission(index) {
  const missionIds = getMissionIds();
  const missionId = missionIds[index];
  seed = 12345 + index * 1000;

  // Regenerate world with mission seed
  terrain = generateTerrain(seed);
  terrainPolys = buildTerrainPolys(terrain, 0, 0, 100);

  // Create flight state
  flightState = createInitialState(terrain);
  flightState.cameraMode = cameraMode;

  // Generate rings for this mission
  rings = generateRings(missionId, terrain, seed);

  // Create mission
  mission = createMission(missionId, terrain, seed);
  mission.start();

  setState(GameState.BRIEFING);
}

// --- Briefing Screen ---
function drawBriefingScreen() {
  if (mission) {
    drawBriefing(ctx, mission, canvas.width, canvas.height);
  }
}

function handleBriefingInput() {
  if (wasKeyPressed('Enter') || wasKeyPressed('Space') || wasKeyPressed('Escape')) {
    setState(GameState.PLAYING);
    lastTime = performance.now();
  }
}

// --- Gameplay Update ---
function updateGameplay(dt) {
  if (!mission || mission.state !== 'active') return;

  // Update mission
  mission.update(flightState, dt);

  // Get input
  const input = getFlightInput();

  // Step flight model
  const wind = mission.getWind();
  const result = step(flightState, input, dt, terrain, wind);

  // Audio
  if (flightState.engineRunning) {
    playEngine(flightState.throttle);
    updateEngine(flightState.throttle);
    playWind(flightState.speed);
    updateWind(flightState.speed);
  } else {
    stopEngine();
    stopWind();
  }

  // Ring pass detection
  if (mission.id === 'ringCircuit' || mission.id === 'stormPatrol') {
    const progress = getRingProgress(rings);
    if (progress.next && checkRingPass(flightState, progress.next, dt)) {
      playRingChime();
    }
  } else if (mission.id === 'volcanoMailRun') {
    const progress = getRingProgress(rings);
    if (progress.next && checkRingPass(flightState, progress.next, dt)) {
      playRingChime();
    }
  }

  // Stall warning
  if (result.stallWarning && !flightState._stallWarned) {
    playStallWarning();
    flightState._stallWarned = true;
  } else if (!result.stallWarning) {
    flightState._stallWarned = false;
  }

  // Crash detection
  if (result.onGround && result.impactSpeed > GAMEPLAY.crashSpeed && !flightState._crashed) {
    playCrash();
    flightState._crashed = true;
    if (mission.state === 'active') {
      mission.fail(`Crashed at ${Math.round(result.impactSpeed)} m/s`);
    }
  }

  // Update camera
  camera = createCamera(flightState, cameraMode);

  // Rebuild terrain polys periodically (for distance)
  if (Math.random() < 0.02) {
    terrainPolys = buildTerrainPolys(terrain, flightState.x, flightState.y, flightState.altitude);
  }
}

// --- Gameplay Draw ---
function drawGameplay() {
  if (!terrain || !camera) return;

  // Ensure terrain polys cover current view
  if (!terrainPolys || terrainPolys.length === 0) {
    terrainPolys = buildTerrainPolys(terrain, flightState.x, flightState.y, flightState.altitude);
  }

  // Render 3D world
  renderFrame(ctx, flightState, terrain, terrainPolys, rings, mission, camera, canvas.width, canvas.height, performance.now() / 1000, cameraMode);

  // Cockpit instruments (cockpit mode only)
  if (cameraMode === CameraMode.COCKPIT) {
    drawArtificialHorizon(ctx, canvas.width / 2, canvas.height / 2, 180, flightState.pitch, flightState.roll);
    drawAltimeter(ctx, 20, 20, 80, 300, flightState.altitude);
    drawAirspeed(ctx, 20, 340, 80, 300, flightState.airspeed, PLANE.stallSpeed, PLANE.maxSpeed);
    drawHeading(ctx, canvas.width / 2, 140, 100, flightState.heading);
    drawThrottleGauge(ctx, canvas.width - 80, 20, 60, 300, flightState.throttle);
    drawFuelGauge(ctx, canvas.width - 80, 340, 60, 300, flightState.fuel, PLANE.fuelCapacity);
    drawGMeter(ctx, canvas.width - 140, canvas.height - 140, 120, 120, 1 + Math.abs(Math.tan(flightState.roll)) * 2);
  }

  // HUD (always)
  drawHUD(ctx, flightState, mission, canvas.width, canvas.height);
}

// --- Mission End Screen ---
function drawMissionEndScreen() {
  if (mission) {
    drawMissionEnd(ctx, mission, canvas.width, canvas.height);
  }
}

function handleMissionEndInput() {
  if (wasKeyPressed('KeyR')) {
    // Retry same mission
    startMission(selectedMissionIndex);
  } else if (wasKeyPressed('Escape')) {
    setState(GameState.MISSION_SELECT);
  }
}

// --- Screenshot ---
function takeScreenshot() {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kestrel-skies-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.9);
}

// Mulberry32 for title screen stars
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { GameState, currentState, flightState, mission, terrain, rings, camera, cameraMode };