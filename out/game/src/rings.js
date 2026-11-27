/** Kestrel Skies - Ring Course System */

import { WORLD_SIZE, GAMEPLAY, MISSIONS } from './config.js';
import { mulberry32, randFloat, randInt, featureRNG, combineSeeds } from './random.js';

/** Ring definition */
export class Ring {
  constructor(index, x, y, altitude, radius, missionId) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.altitude = altitude;
    this.radius = radius;
    this.missionId = missionId;
    this.passed = false;
    this.passTime = 0;
    this.glowPhase = 0;
    this.colour = '#00ffff';
    this.coreColour = '#ffffff';
  }
}

/** Generate ring course for a mission */
export function generateRings(missionId, terrain, seed = 12345) {
  const rings = [];
  const rng = mulberry32(seed);

  if (missionId === 'ringCircuit') {
    return generateRingCircuit(rng, terrain);
  } else if (missionId === 'volcanoMailRun') {
    return generateVolcanoCheckpoints(rng, terrain);
  } else if (missionId === 'stormPatrol') {
    return generateStormPatrol(rng, terrain);
  }

  return rings;
}

/** Ring Circuit: 8 rings in a scenic loop around the archipelago */
function generateRingCircuit(rng, terrain) {
  const rings = [];
  const mainIsland = terrain.islands.find(i => i.type === 'main');
  const volcanoIsland = terrain.islands.find(i => i.type === 'volcano');

  // Define waypoints for the circuit
  const waypoints = [
    { x: mainIsland.x - 800, y: mainIsland.y - 500, alt: 150 },  // Start near runway
    { x: mainIsland.x - 1500, y: mainIsland.y + 500, alt: 200 },  // North of main
    { x: -1000, y: 2000, alt: 250 },                               // Between islands
    { x: -2500, y: 1800, alt: 180 },                               // Near satellite
    { x: -3000, y: 500, alt: 220 },                                // West satellite
    { x: 1000, y: -1500, alt: 200 },                               // South approach
    { x: volcanoIsland.x - 500, y: volcanoIsland.y, alt: 350 },   // Volcano flank
    { x: volcanoIsland.x + 800, y: volcanoIsland.y - 500, alt: 300 }, // Volcano far side
  ];

  // Add some variance
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const variance = GAMEPLAY.ringAltitudeVariance;
    const x = wp.x + randFloat(rng, -100, 100);
    const y = wp.y + randFloat(rng, -100, 100);
    const altitude = wp.alt + randFloat(rng, -variance, variance);
    const radius = GAMEPLAY.ringRadius + randFloat(rng, -10, 10);

    const ring = new Ring(i, x, y, altitude, radius, 'ringCircuit');
    ring.glowPhase = randFloat(rng, 0, Math.PI * 2);
    rings.push(ring);
  }

  return rings;
}

/** Volcano Mail Run: Checkpoints around volcano, then land */
function generateVolcanoCheckpoints(rng, terrain) {
  const rings = [];
  const volcanoIsland = terrain.islands.find(i => i.type === 'volcano');
  const mainIsland = terrain.islands.find(i => i.type === 'main');

  // Checkpoints around volcano
  const checkpointAngles = [0, Math.PI * 0.4, Math.PI * 0.8, Math.PI * 1.3, Math.PI * 1.8];
  const checkpointRadius = 1000;

  for (let i = 0; i < checkpointAngles.length; i++) {
    const angle = checkpointAngles[i] + randFloat(rng, -0.2, 0.2);
    const x = volcanoIsland.x + Math.cos(angle) * checkpointRadius;
    const y = volcanoIsland.y + Math.sin(angle) * checkpointRadius;
    const groundH = terrain.getHeightAt(x, y);
    const altitude = groundH + 150 + randFloat(rng, -50, 100);
    const radius = GAMEPLAY.checkpointRadius;

    const ring = new Ring(i, x, y, altitude, radius, 'volcanoMailRun');
    ring.colour = '#ffaa00';
    ring.coreColour = '#ffff88';
    ring.glowPhase = randFloat(rng, 0, Math.PI * 2);
    rings.push(ring);
  }

  // Final "ring" is the runway threshold (handled separately in mission)
  return rings;
}

/** Storm Patrol: Rings in turbulent conditions */
function generateStormPatrol(rng, terrain) {
  const rings = [];
  const mainIsland = terrain.islands.find(i => i.type === 'main');

  // Scattered rings in a wider area with more altitude variance
  for (let i = 0; i < 6; i++) {
    const angle = randFloat(rng, 0, Math.PI * 2);
    const dist = randFloat(rng, 1000, 3500);
    const x = mainIsland.x + Math.cos(angle) * dist;
    const y = mainIsland.y + Math.sin(angle) * dist;
    const groundH = terrain.getHeightAt(x, y);
    const altitude = groundH + 100 + randFloat(rng, 50, 300);
    const radius = GAMEPLAY.ringRadius - 5; // Smaller rings = harder

    const ring = new Ring(i, x, y, altitude, radius, 'stormPatrol');
    ring.colour = '#ff4488';
    ring.coreColour = '#ff88cc';
    ring.glowPhase = randFloat(rng, 0, Math.PI * 2);
    rings.push(ring);
  }

  // Sort by distance from start for logical progression
  const startX = mainIsland.x - 500;
  const startY = mainIsland.y;
  rings.sort((a, b) => {
    const da = (a.x - startX) ** 2 + (a.y - startY) ** 2;
    const db = (b.x - startX) ** 2 + (b.y - startY) ** 2;
    return da - db;
  });

  // Re-index
  rings.forEach((r, i) => r.index = i);

  return rings;
}

/** Check if plane passes through a ring */
export function checkRingPass(state, ring, dt) {
  if (ring.passed) return false;

  // Distance to ring center horizontally
  const dx = state.x - ring.x;
  const dy = state.y - ring.y;
  const horizDist = Math.sqrt(dx * dx + dy * dy);

  // Vertical distance
  const vertDist = Math.abs(state.altitude - ring.altitude);

  // Must be within radius horizontally AND within vertical tolerance
  const verticalTolerance = ring.radius * 0.8;

  if (horizDist <= ring.radius && vertDist <= verticalTolerance) {
    // Check if moving roughly through the ring (not just hovering)
    const velX = state.speed * Math.cos(state.heading);
    const velY = state.speed * Math.sin(state.heading);
    const dot = (dx * velX + dy * velY) / (horizDist * state.speed + 0.001);

    // Moving towards or through the ring
    if (dot > -0.5 || horizDist < ring.radius * 0.3) {
      ring.passed = true;
      ring.passTime = performance.now ? performance.now() / 1000 : Date.now() / 1000;
      return true;
    }
  }

  return false;
}

/** Get next unpassed ring */
export function getNextRing(rings) {
  return rings.find(r => !r.passed);
}

/** Get ring progress */
export function getRingProgress(rings) {
  const total = rings.length;
  const passed = rings.filter(r => r.passed).length;
  return { passed, total, next: getNextRing(rings) };
}

/** Score for ring passage (time-based bonus) */
export function calculateRingScore(ring, state, missionStartTime) {
  if (!ring.passed) return 0;

  const timeTaken = ring.passTime - missionStartTime;
  const baseScore = 1000;
  const timeBonus = Math.max(0, 500 - timeTaken * 5); // Faster = more bonus
  const precisionBonus = Math.max(0, 200 - Math.abs(state.altitude - ring.altitude) * 2);

  return Math.round(baseScore + timeBonus + precisionBonus);
}

/** Total mission score from rings */
export function calculateTotalRingScore(rings, missionStartTime) {
  let total = 0;
  for (const ring of rings) {
    if (ring.passed) {
      total += calculateRingScore(ring, {}, missionStartTime); // State not needed for total
    }
  }
  return total;
}

/** Reset all rings */
export function resetRings(rings) {
  for (const ring of rings) {
    ring.passed = false;
    ring.passTime = 0;
  }
}