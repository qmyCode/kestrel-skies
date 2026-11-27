/** Kestrel Skies - Terrain Generation: Archipelago with islands, volcano, runway, villages */

import { WORLD_SIZE, SEA_LEVEL, MAX_ALTITUDE, COLOURS } from './config.js';
import { mulberry32, randFloat, randInt, randChoice, randBool, fbm, featureRNG, combineSeeds } from './random.js';

// Terrain grid resolution
const GRID_SIZE = 256;                    // 256x256 heightfield
const GRID_STEP = (WORLD_SIZE * 2) / GRID_SIZE;

/** Island definition */
export class Island {
  constructor(x, y, radius, height, type = 'normal') {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.height = height;
    this.type = type;                     // 'normal', 'volcano', 'main'
    this.colour = type === 'volcano' ? COLOURS.volcanoRock : (type === 'main' ? COLOURS.grassLight : COLOURS.grassDark);
    this.beachColour = COLOURS.sand;
    this.forestPatches = [];
    this.villages = [];
  }
}

/** Village/settlement */
export class Village {
  constructor(x, y, island) {
    this.x = x;
    this.y = y;
    this.island = island;
    this.buildings = [];
    this.size = randInt(island.rng, 3, 8);
  }
}

/** Tree cluster */
export class TreeCluster {
  constructor(x, y, count, height) {
    this.x = x;
    this.y = y;
    this.count = count;
    this.height = height;
  }
}

/** Runway definition */
export class Runway {
  constructor(x, y, heading, length, width) {
    this.x = x;
    this.y = y;
    this.heading = heading;               // Radians
    this.length = length;
    this.width = width;
    // Threshold positions
    this.threshold1 = { x: x - Math.cos(heading) * length / 2, y: y - Math.sin(heading) * length / 2 };
    this.threshold2 = { x: x + Math.cos(heading) * length / 2, y: y + Math.sin(heading) * length / 2 };
  }

  /** Get nearest point on runway centerline */
  nearestPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const proj = dx * Math.cos(this.heading) + dy * Math.sin(this.heading);
    const clamped = Math.max(-this.length / 2, Math.min(this.length / 2, proj));
    return {
      x: this.x + Math.cos(this.heading) * clamped,
      y: this.y + Math.sin(this.heading) * clamped,
      distAlong: clamped,
      distPerp: Math.abs(dx * -Math.sin(this.heading) + dy * Math.cos(this.heading)),
    };
  }

  /** Check if position is on runway */
  onRunway(px, py, tolerance = 20) {
    const np = this.nearestPoint(px, py);
    return np.distPerp <= tolerance && Math.abs(np.distAlong) <= this.length / 2;
  }
}

/** Generate the complete archipelago terrain */
export function generateTerrain(worldSeed = 12345) {
  const rng = mulberry32(worldSeed);
  const islands = [];
  const allTreeClusters = [];
  const allVillages = [];

  // --- Main Island (player starts here, has runway) ---
  const mainIsland = new Island(0, 0, 1200, 180, 'main');
  mainIsland.rng = featureRNG(worldSeed, 'main');
  islands.push(mainIsland);

  // Runway on main island (oriented roughly East-West, slightly angled)
  const runwayHeading = 0.15;             // ~8.6 degrees
  const runway = new Runway(0, -100, runwayHeading, 800, 30);

  // Main island villages
  for (let i = 0; i < 4; i++) {
    const angle = randFloat(mainIsland.rng, 0, Math.PI * 2);
    const dist = randFloat(mainIsland.rng, 300, 900);
    const vx = Math.cos(angle) * dist;
    const vy = Math.sin(angle) * dist;
    const village = new Village(vx, vy, mainIsland);
    village.rng = featureRNG(worldSeed, `village_main_${i}`);
    mainIsland.villages.push(village);
    allVillages.push(village);
  }

  // Main island forest patches
  for (let i = 0; i < 15; i++) {
    const angle = randFloat(mainIsland.rng, 0, Math.PI * 2);
    const dist = randFloat(mainIsland.rng, 200, 1000);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const h = getHeightAt(tx, ty, islands, worldSeed);
    if (h > 5 && h < 120) {
      const cluster = new TreeCluster(tx, ty, randInt(mainIsland.rng, 5, 15), h);
      mainIsland.forestPatches.push(cluster);
      allTreeClusters.push(cluster);
    }
  }

  // --- Volcano Island ---
  const volcanoIsland = new Island(3500, -2000, 800, 600, 'volcano');
  volcanoIsland.rng = featureRNG(worldSeed, 'volcano');
  islands.push(volcanoIsland);

  // Volcano villages (fewer, on lower slopes)
  for (let i = 0; i < 2; i++) {
    const angle = randFloat(volcanoIsland.rng, 0, Math.PI * 2);
    const dist = randFloat(volcanoIsland.rng, 400, 600);
    const vx = volcanoIsland.x + Math.cos(angle) * dist;
    const vy = volcanoIsland.y + Math.sin(angle) * dist;
    const village = new Village(vx, vy, volcanoIsland);
    village.rng = featureRNG(worldSeed, `village_volcano_${i}`);
    volcanoIsland.villages.push(village);
    allVillages.push(village);
  }

  // --- Satellite Islands ---
  const satellitePositions = [
    { x: -2800, y: 1500, r: 500, h: 120 },
    { x: 4000, y: 3000, r: 400, h: 100 },
    { x: -4000, y: -2500, r: 450, h: 110 },
    { x: 1500, y: 3500, r: 350, h: 90 },
    { x: -1000, y: -3500, r: 380, h: 95 },
    { x: 3000, y: 1000, r: 300, h: 80 },
    { x: -3500, y: 500, r: 420, h: 105 },
    { x: 500, y: -2000, r: 280, h: 70 },
  ];

  satellitePositions.forEach((pos, i) => {
    const island = new Island(pos.x, pos.y, pos.r, pos.h, 'normal');
    island.rng = featureRNG(worldSeed, `satellite_${i}`);
    islands.push(island);

    // Villages on larger satellites
    if (pos.r > 350) {
      const vCount = randInt(island.rng, 1, 2);
      for (let v = 0; v < vCount; v++) {
        const angle = randFloat(island.rng, 0, Math.PI * 2);
        const dist = randFloat(island.rng, 150, pos.r * 0.7);
        const vx = island.x + Math.cos(angle) * dist;
        const vy = island.y + Math.sin(angle) * dist;
        const village = new Village(vx, vy, island);
        village.rng = featureRNG(worldSeed, `village_sat_${i}_${v}`);
        island.villages.push(village);
        allVillages.push(village);
      }
    }

    // Forest patches
    const fCount = randInt(island.rng, 3, 8);
    for (let f = 0; f < fCount; f++) {
      const angle = randFloat(island.rng, 0, Math.PI * 2);
      const dist = randFloat(island.rng, 100, pos.r * 0.8);
      const tx = island.x + Math.cos(angle) * dist;
      const ty = island.y + Math.sin(angle) * dist;
      const h = getHeightAt(tx, ty, islands, worldSeed);
      if (h > 5 && h < 100) {
        const cluster = new TreeCluster(tx, ty, randInt(island.rng, 3, 10), h);
        island.forestPatches.push(cluster);
        allTreeClusters.push(cluster);
      }
    }
  });

  // --- Generate heightfield grid for rendering ---
  const heightfield = new Float32Array(GRID_SIZE * GRID_SIZE);
  const colourMap = new Uint32Array(GRID_SIZE * GRID_SIZE); // Packed RGBA

  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const wx = (gx - GRID_SIZE / 2) * GRID_STEP;
      const wy = (gz - GRID_SIZE / 2) * GRID_STEP;
      const h = getHeightAt(wx, wy, islands, worldSeed);
      heightfield[gz * GRID_SIZE + gx] = h;
      colourMap[gz * GRID_SIZE + gx] = packColour(getTerrainColour(wx, wy, h, islands));
    }
  }

  return {
    worldSeed,
    islands,
    runway,
    heightfield,
    colourMap,
    gridSize: GRID_SIZE,
    gridStep: GRID_STEP,
    worldSize: WORLD_SIZE,
    treeClusters: allTreeClusters,
    villages: allVillages,
    getHeightAt: (x, y) => getHeightAt(x, y, islands, worldSeed),
    getColourAt: (x, y) => getTerrainColour(x, y, getHeightAt(x, y, islands, worldSeed), islands),
  };
}

/** Get terrain height at world position */
function getHeightAt(x, y, islands, worldSeed) {
  let height = SEA_LEVEL;
  let maxContribution = 0;

  for (const island of islands) {
    const dx = x - island.x;
    const dy = y - island.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= island.radius * 1.5) continue; // Outside influence

    // Base island shape (cosine falloff)
    let factor = 0;
    if (dist < island.radius) {
      factor = Math.cos((dist / island.radius) * (Math.PI / 2));
    } else {
      // Beach/underwater transition
      factor = Math.max(0, Math.cos(((dist - island.radius) / (island.radius * 0.5)) * (Math.PI / 2))) * 0.3;
    }

    // Add noise detail
    const detailRng = featureRNG(worldSeed, `detail_${island.x}_${island.y}`);
    const noise = fbm(detailRng, x * 0.002, y * 0.002, 3, 0.5, 2) * 30;

    const contribution = factor * (island.height + noise);
    if (contribution > maxContribution) {
      maxContribution = contribution;
      height = contribution;
    }
  }

  // Sea floor
  if (height <= SEA_LEVEL) {
    const seaRng = featureRNG(worldSeed, 'seafloor');
    height = SEA_LEVEL + fbm(seaRng, x * 0.005, y * 0.005, 2, 0.5, 2) * 20 - 50;
  }

  return Math.max(-200, Math.min(MAX_ALTITUDE, height));
}

/** Get terrain colour at world position */
function getTerrainColour(x, y, height, islands) {
  // Find dominant island
  let bestIsland = null;
  let bestFactor = 0;

  for (const island of islands) {
    const dx = x - island.x;
    const dy = y - island.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < island.radius * 1.2) {
      let factor = 1 - dist / (island.radius * 1.2);
      if (factor > bestFactor) {
        bestFactor = factor;
        bestIsland = island;
      }
    }
  }

  if (height <= SEA_LEVEL) {
    // Sea colour by depth
    const depth = SEA_LEVEL - height;
    const t = Math.min(1, depth / 100);
    return lerpColour(COLOURS.seaShallow, COLOURS.seaDeep, t);
  }

  if (bestIsland) {
    const dx = x - bestIsland.x;
    const dy = y - bestIsland.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radiusRatio = dist / bestIsland.radius;

    if (radiusRatio < 0.95) {
      // On island - altitude shading
      const altitudeRatio = Math.min(1, height / bestIsland.height);
      let baseColour = bestIsland.colour;
      if (bestIsland.type === 'volcano' && altitudeRatio > 0.7) {
        baseColour = COLOURS.lava;
      } else if (altitudeRatio > 0.8) {
        baseColour = COLOURS.rock;
      } else if (altitudeRatio > 0.5) {
        baseColour = COLOURS.forest;
      }
      return shadeColour(baseColour, 0.7 + altitudeRatio * 0.5);
    } else if (radiusRatio < 1.1) {
      // Beach
      return shadeColour(COLOURS.sand, 0.8 + Math.random() * 0.2);
    }
  }

  // Default sea
  return COLOURS.seaDeep;
}

/** Pack colour hex to Uint32 RGBA */
function packColour(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (255 << 24) | (r << 16) | (g << 8) | b;
}

/** Interpolate between two hex colours */
function lerpColour(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/** Shade a colour by factor */
function shadeColour(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const bl = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/** Build renderable terrain polygons (sorted by distance for painter's algorithm) */
export function buildTerrainPolys(terrain, cameraX, cameraY, cameraAlt, maxPolys = 8000) {
  const { heightfield, gridSize, gridStep, worldSize } = terrain;
  const polys = [];
  const cellSize = gridStep * 2;          // 2x2 grid cells = 125m
  const MAX_DIST = 7000;                  // Only keep terrain within this distance

  for (let gz = 0; gz < gridSize - 2; gz += 2) {
    for (let gx = 0; gx < gridSize - 2; gx += 2) {
      // Poly center = center of the 2x2 cell (at gx+1, gz+1 in grid coords)
      const wx = (gx + 1 - gridSize / 2) * gridStep;
      const wy = (gz + 1 - gridSize / 2) * gridStep;

      // Distance culling - only keep terrain within MAX_DIST
      const dx = wx - cameraX;
      const dy = wy - cameraY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > MAX_DIST) continue;

      // Corner heights for the 2x2 cell (corners at gx,gz; gx+2,gz; gx+2,gz+2; gx,gz+2)
      const h00 = heightfield[gz * gridSize + gx];
      const h10 = heightfield[gz * gridSize + gx + 2];
      const h01 = heightfield[(gz + 2) * gridSize + gx];
      const h11 = heightfield[(gz + 2) * gridSize + gx + 2];

      const avgHeight = (h00 + h10 + h01 + h11) / 4;
      // Colour at cell center (gx+1, gz+1)
      const colour = terrain.colourMap[(gz + 1) * gridSize + (gx + 1)];

      polys.push({
        x: wx,
        y: wy,
        size: cellSize,
        height: avgHeight,
        height00: h00,
        height10: h10,
        height01: h01,
        height11: h11,
        colour,
        dist,
      });
    }
  }

  // Sort by distance (NEAR to far for painter's algorithm - near drawn last/on top)
  // Distance culling already limits count; cap is safety net for edge cases
  polys.sort((a, b) => a.dist - b.dist);
  return polys.slice(0, maxPolys);
}

/** Get runway for missions */
export function getRunway(terrain) {
  return terrain.runway;
}

/** Get all villages for missions */
export function getVillages(terrain) {
  return terrain.villages;
}

/** Get all tree clusters */
export function getTreeClusters(terrain) {
  return terrain.treeClusters;
}

/** Get volcano island */
export function getVolcanoIsland(terrain) {
  return terrain.islands.find(i => i.type === 'volcano');
}

/** Get main island */
export function getMainIsland(terrain) {
  return terrain.islands.find(i => i.type === 'main');
}