/** Kestrel Skies - 3D Projection Renderer */

import { RENDER, COLOURS, WORLD_SIZE, PLANE } from './config.js';
import { mulberry32, randFloat, randInt, featureRNG, combineSeeds } from './random.js';

/** Camera modes */
export const CameraMode = {
  CHASE: 'chase',
  COCKPIT: 'cockpit',
};

/** Project 3D world point to 2D screen */
export function projectPoint(camera, point, canvasWidth, canvasHeight) {
  // Translate to camera space
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const dz = point.z - camera.z; // z = altitude

  // Rotate by camera heading (yaw)
  const cosH = Math.cos(-camera.heading);
  const sinH = Math.sin(-camera.heading);
  const rx = dx * cosH - dy * sinH;
  const ry = dx * sinH + dy * cosH;

  // Rotate by camera pitch
  const cosP = Math.cos(-camera.pitch);
  const sinP = Math.sin(-camera.pitch);
  const rz = ry * cosP - dz * sinP;
  const ry2 = ry * sinP + dz * cosP;

  // Roll rotation (around forward axis)
  const cosR = Math.cos(-camera.roll);
  const sinR = Math.sin(-camera.roll);
  const fx = rx * cosR - rz * sinR;
  const fz = rx * sinR + rz * cosR;

  // Perspective projection
  if (fz <= RENDER.nearPlane) return null;

  const scale = (canvasHeight / 2) / Math.tan(RENDER.fov / 2) / fz;
  const sx = canvasWidth / 2 + fx * scale;
  const sy = canvasHeight * RENDER.horizonY - fz * scale; // Note: screen Y is inverted

  return { x: sx, y: sy, z: fz, scale };
}

/** Project 3D point with camera roll only (for cockpit HUD elements) */
export function projectPointHUD(camera, point, canvasWidth, canvasHeight) {
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const dz = point.z - camera.z;

  const cosH = Math.cos(-camera.heading);
  const sinH = Math.sin(-camera.heading);
  const rx = dx * cosH - dy * sinH;
  const ry = dx * sinH + dy * cosH;

  const cosP = Math.cos(-camera.pitch);
  const sinP = Math.sin(-camera.pitch);
  const rz = ry * cosP - dz * sinP;
  const ry2 = ry * sinP + dz * cosP;

  if (rz <= RENDER.nearPlane) return null;

  const scale = (canvasHeight / 2) / Math.tan(RENDER.fov / 2) / rz;
  const sx = canvasWidth / 2 + rx * scale;
  const sy = canvasHeight * RENDER.horizonY - ry2 * scale;

  return { x: sx, y: sy, z: rz, scale };
}

/** Camera state for rendering */
export function createCamera(state, mode = CameraMode.COCKPIT) {
  const chaseDistance = 120;
  const chaseHeight = 20;

  if (mode === CameraMode.CHASE) {
    // Chase camera behind and above plane
    const heading = state.heading;
    const pitch = state.pitch * 0.3; // Smooth follow
    const roll = state.roll * 0.5;

    return {
      x: state.x - Math.cos(heading) * Math.cos(pitch) * chaseDistance,
      y: state.y - Math.sin(heading) * Math.cos(pitch) * chaseDistance,
      z: state.altitude + chaseHeight - Math.sin(pitch) * chaseDistance,
      heading,
      pitch,
      roll,
      mode,
    };
  } else {
    // Cockpit camera (at pilot eye position)
    return {
      x: state.x,
      y: state.y,
      z: state.altitude + 1.5, // Eye height
      heading: state.heading,
      pitch: state.pitch,
      roll: state.roll,
      mode,
    };
  }
}

/** Sky gradient */
export function drawSky(ctx, camera, canvasWidth, canvasHeight, timeOfDay = 0.5) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight * RENDER.horizonY);

  // Interpolate between day and golden hour
  const t = timeOfDay; // 0 = day, 1 = golden hour
  const zenith = lerpColour(COLOURS.skyZenith, COLOURS.skyGoldenZenith, t);
  const horizon = lerpColour(COLOURS.skyHorizon, COLOURS.skyGoldenHorizon, t);

  gradient.addColorStop(0, zenith);
  gradient.addColorStop(1, horizon);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight * RENDER.horizonY);
}

/** Draw sun */
export function drawSun(ctx, camera, canvasWidth, canvasHeight, timeOfDay = 0.5) {
  // Sun position (moves across sky)
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2; // 0 = overhead, -PI/2 = east horizon
  const sunDist = 10000;
  const sunX = Math.cos(sunAngle) * sunDist;
  const sunY = Math.sin(sunAngle) * sunDist;
  const sunZ = 5000;

  const proj = projectPoint(camera, { x: sunX, y: sunY, z: sunZ }, canvasWidth, canvasHeight);
  if (!proj || proj.z < 0) return;

  const size = 80 / (proj.z / 1000);

  // Glow
  const glow = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, size * 3);
  glow.addColorStop(0, COLOURS.sunCore);
  glow.addColorStop(0.3, COLOURS.sunGlow);
  glow.addColorStop(1, 'rgba(255,170,0,0)');

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, size * 3, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = COLOURS.sunCore;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw clouds */
export function drawClouds(ctx, camera, canvasWidth, canvasHeight, time) {
  // Pre-generate cloud positions (deterministic)
  const cloudRng = mulberry32(0xC100D);
  const clouds = [];
  for (let i = 0; i < RENDER.cloudCount; i++) {
    clouds.push({
      x: randFloat(cloudRng, -WORLD_SIZE, WORLD_SIZE),
      y: randFloat(cloudRng, -WORLD_SIZE, WORLD_SIZE),
      z: RENDER.cloudLayerHeight + randFloat(cloudRng, -200, 200),
      size: randFloat(cloudRng, 100, 300),
      opacity: randFloat(cloudRng, 0.3, 0.7),
      drift: randFloat(cloudRng, -0.5, 0.5),
    });
  }

  // Draw clouds (far to near)
  const cloudData = clouds.map(c => {
    const proj = projectPoint(camera, {
      x: c.x + c.drift * time * 10,
      y: c.y,
      z: c.z
    }, canvasWidth, canvasHeight);
    return { ...c, proj };
  }).filter(c => c.proj && c.proj.z > 0);

  cloudData.sort((a, b) => b.proj.z - a.proj.z);

  for (const cloud of cloudData) {
    const proj = cloud.proj;
    const size = cloud.size * proj.scale;

    const alpha = cloud.opacity * (1 - Math.min(1, proj.z / 15000));
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLOURS.cloudLight;
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, size * 1.5, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = COLOURS.cloudShadow;
    ctx.beginPath();
    ctx.ellipse(proj.x + size * 0.1, proj.y + size * 0.1, size * 1.3, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/** Draw sea */
export function drawSea(ctx, camera, canvasWidth, canvasHeight, terrain) {
  const seaY = canvasHeight * RENDER.horizonY;
  const gradient = ctx.createLinearGradient(0, seaY, 0, canvasHeight);
  gradient.addColorStop(0, COLOURS.seaShallow);
  gradient.addColorStop(1, COLOURS.seaDeep);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, seaY, canvasWidth, canvasHeight - seaY);

  // Simple wave lines
  ctx.strokeStyle = 'rgba(170,220,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const y = seaY + (canvasHeight - seaY) * (i / 20) ** 1.5;
    const waveOffset = Math.sin((y / 50) + performance.now() / 1000) * 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < canvasWidth; x += 20) {
      const wx = x + Math.sin((x + y) / 100 + performance.now() / 2000) * 5;
      ctx.lineTo(wx, y + Math.sin(x / 50) * 2);
    }
    ctx.stroke();
  }
}

/** Draw terrain polygons */
export function drawTerrain(ctx, camera, canvasWidth, canvasHeight, terrain, terrainPolys) {
  const horizonY = canvasHeight * RENDER.horizonY;

  for (const poly of terrainPolys) {
    const proj = projectPoint(camera, {
      x: poly.x,
      y: poly.y,
      z: poly.height
    }, canvasWidth, canvasHeight);

    if (!proj || proj.z <= 0) continue;

    // Skip if behind horizon
    if (proj.y < horizonY - 50) continue;

    const size = poly.size * proj.scale;
    if (size < 1) continue;

    // Colour with altitude shading
    const altitudeRatio = Math.min(1, Math.max(0, poly.height / 600));
    const baseColour = `#${poly.colour.toString(16).padStart(6, '0')}`;
    const shadedColour = shadeColour(baseColour, 0.6 + altitudeRatio * 0.5);

    // Distance fog
    const fogFactor = Math.min(1, proj.z / 8000);
    const fogColour = lerpColour(shadedColour, timeOfDay > 0.5 ? COLOURS.skyGoldenHorizon : COLOURS.skyHorizon, fogFactor * 0.5);

    ctx.fillStyle = fogColour;
    ctx.beginPath();

    // Draw as quad (4 corners)
    const half = size / 2;
    const corners = [
      { x: poly.x - half, y: poly.y - half, z: poly.height00 },
      { x: poly.x + half, y: poly.y - half, z: poly.height10 },
      { x: poly.x + half, y: poly.y + half, z: poly.height11 },
      { x: poly.x - half, y: poly.y + half, z: poly.height01 },
    ];

    let first = true;
    for (const corner of corners) {
      const cp = projectPoint(camera, corner, canvasWidth, canvasHeight);
      if (cp && cp.z > 0) {
        if (first) {
          ctx.moveTo(cp.x, cp.y);
          first = false;
        } else {
          ctx.lineTo(cp.x, cp.y);
        }
      }
    }

    if (!first) {
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Draw runway */
export function drawRunway(ctx, camera, canvasWidth, canvasHeight, runway) {
  if (!runway) return;

  // Runway corners
  const hw = runway.width / 2;
  const hl = runway.length / 2;
  const cosH = Math.cos(runway.heading);
  const sinH = Math.sin(runway.heading);

  const corners = [
    { x: runway.x - cosH * hl - sinH * hw, y: runway.y - sinH * hl + cosH * hw, z: 0 },
    { x: runway.x + cosH * hl - sinH * hw, y: runway.y + sinH * hl + cosH * hw, z: 0 },
    { x: runway.x + cosH * hl + sinH * hw, y: runway.y + sinH * hl - cosH * hw, z: 0 },
    { x: runway.x - cosH * hl + sinH * hw, y: runway.y - sinH * hl - cosH * hw, z: 0 },
  ];

  const projected = corners.map(c => projectPoint(camera, c, canvasWidth, canvasHeight)).filter(p => p && p.z > 0);

  if (projected.length < 3) return;

  // Runway surface
  ctx.fillStyle = COLOURS.runwaySurface;
  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < projected.length; i++) {
    ctx.lineTo(projected[i].x, projected[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Runway markings
  ctx.strokeStyle = COLOURS.runwayMarking;
  ctx.lineWidth = Math.max(1, 3 * projected[0].scale);

  // Centerline
  const center1 = projectPoint(camera, { x: runway.x - cosH * hl, y: runway.y - sinH * hl, z: 0.1 }, canvasWidth, canvasHeight);
  const center2 = projectPoint(camera, { x: runway.x + cosH * hl, y: runway.y + sinH * hl, z: 0.1 }, canvasWidth, canvasHeight);
  if (center1 && center2 && center1.z > 0 && center2.z > 0) {
    ctx.setLineDash([20 * center1.scale, 15 * center1.scale]);
    ctx.beginPath();
    ctx.moveTo(center1.x, center1.y);
    ctx.lineTo(center2.x, center2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Threshold markings
  for (const end of [runway.x - cosH * hl, runway.x + cosH * hl]) {
    const p1 = projectPoint(camera, { x: end - sinH * hw, y: (end === runway.x - cosH * hl ? runway.y - sinH * hl : runway.y + sinH * hl) + cosH * hw, z: 0.1 }, canvasWidth, canvasHeight);
    const p2 = projectPoint(camera, { x: end + sinH * hw, y: (end === runway.x - cosH * hl ? runway.y - sinH * hl : runway.y + sinH * hl) - cosH * hw, z: 0.1 }, canvasWidth, canvasHeight);
    if (p1 && p2 && p1.z > 0 && p2.z > 0) {
      ctx.lineWidth = Math.max(2, 5 * p1.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Edge lights
  ctx.fillStyle = COLOURS.runwayEdge;
  for (const corner of corners) {
    const proj = projectPoint(camera, { ...corner, z: 1 }, canvasWidth, canvasHeight);
    if (proj && proj.z > 0) {
      const r = Math.max(2, 4 * proj.scale);
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draw rings */
export function drawRings(ctx, camera, canvasWidth, canvasHeight, rings, time) {
  for (const ring of rings) {
    if (ring.passed) continue;

    const proj = projectPoint(camera, { x: ring.x, y: ring.y, z: ring.altitude }, canvasWidth, canvasHeight);
    if (!proj || proj.z <= 0) continue;

    const radius = ring.radius * proj.scale;
    if (radius < 2) continue;

    // Pulsing glow
    const pulse = Math.sin(time * 3 + ring.glowPhase) * 0.3 + 0.7;
    const glowAlpha = pulse * (1 - Math.min(1, proj.z / 10000));

    // Outer glow
    const glowGrad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, radius * 1.5);
    glowGrad.addColorStop(0, `rgba(0,255,255,${glowAlpha * 0.5})`);
    glowGrad.addColorStop(0.5, `rgba(0,255,255,${glowAlpha * 0.2})`);
    glowGrad.addColorStop(1, 'rgba(0,255,255,0)');

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Ring torus (two circles)
    ctx.lineWidth = Math.max(2, 4 * proj.scale);
    ctx.strokeStyle = ring.colour;
    ctx.globalAlpha = 0.9 * (1 - Math.min(1, proj.z / 12000));
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = ring.coreColour;
    ctx.lineWidth = Math.max(1, 2 * proj.scale);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Ring number
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(10, 14 * proj.scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${ring.index + 1}`, proj.x, proj.y);
  }

  // Passed rings (faded)
  for (const ring of rings) {
    if (!ring.passed) continue;

    const proj = projectPoint(camera, { x: ring.x, y: ring.y, z: ring.altitude }, canvasWidth, canvasHeight);
    if (!proj || proj.z <= 0) continue;

    const radius = ring.radius * proj.scale;
    if (radius < 2) continue;

    ctx.strokeStyle = ring.passed ? '#00ff88' : ring.colour;
    ctx.lineWidth = Math.max(1, 2 * proj.scale);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Draw plane model (chase view) */
export function drawPlaneModel(ctx, camera, canvasWidth, canvasHeight, state) {
  // Plane in camera space (local coordinates)
  const planeLength = 8;
  const wingSpan = 10;
  const tailHeight = 2;

  // Local vertices (plane coordinates: x=forward, y=right, z=up)
  const vertices = [
    // Fuselage
    { x: planeLength, y: 0, z: 0 },      // Nose
    { x: -planeLength * 0.8, y: 0, z: 0 }, // Tail
    // Wings
    { x: -planeLength * 0.2, y: -wingSpan, z: 0 }, // Left tip
    { x: -planeLength * 0.2, y: wingSpan, z: 0 },  // Right tip
    // Tail fin
    { x: -planeLength * 0.7, y: 0, z: tailHeight },
    // Propeller (blur disk)
    { x: planeLength * 1.1, y: 0, z: 0 },
  ];

  // Transform to world
  const cosH = Math.cos(state.heading);
  const sinH = Math.sin(state.heading);
  const cosP = Math.cos(state.pitch);
  const sinP = Math.sin(state.pitch);
  const cosR = Math.cos(state.roll);
  const sinR = Math.sin(state.roll);

  const worldVerts = vertices.map(v => {
    // Roll
    let x = v.x;
    let y = v.y * cosR - v.z * sinR;
    let z = v.y * sinR + v.z * cosR;
    // Pitch
    const y2 = y;
    y = y2 * cosP - z * sinP;
    z = y2 * sinP + z * cosP;
    // Heading
    const x2 = x;
    x = x2 * cosH - y * sinH;
    y = x2 * sinH + y * cosH;
    // Translate
    return { x: x + state.x, y: y + state.y, z: z + state.altitude };
  });

  // Project all vertices
  const projVerts = worldVerts.map(v => projectPoint(camera, v, canvasWidth, canvasHeight)).filter(p => p && p.z > 0);

  if (projVerts.length < 4) return;

  // Draw fuselage
  const nose = projVerts[0];
  const tail = projVerts[1];
  if (nose && tail) {
    ctx.strokeStyle = COLOURS.fuselage;
    ctx.lineWidth = Math.max(2, 4 * nose.scale);
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
  }

  // Draw wings
  const leftTip = projVerts[2];
  const rightTip = projVerts[3];
  if (leftTip && rightTip) {
    ctx.strokeStyle = COLOURS.wing;
    ctx.lineWidth = Math.max(2, 3 * leftTip.scale);
    ctx.beginPath();
    ctx.moveTo(leftTip.x, leftTip.y);
    ctx.lineTo(rightTip.x, rightTip.y);
    ctx.stroke();
  }

  // Draw tail fin
  const tailFin = projVerts[4];
  if (tail && tailFin) {
    ctx.strokeStyle = COLOURS.tail;
    ctx.lineWidth = Math.max(1, 2 * tail.scale);
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(tailFin.x, tailFin.y);
    ctx.stroke();
  }

  // Propeller blur
  const prop = projVerts[5];
  if (prop && state.engineRunning && state.throttle > 0.1) {
    const propRadius = 15 * prop.scale * (0.5 + state.throttle * 0.5);
    const grad = ctx.createRadialGradient(prop.x, prop.y, 0, prop.x, prop.y, propRadius);
    grad.addColorStop(0, 'rgba(68,68,68,0.4)');
    grad.addColorStop(1, 'rgba(68,68,68,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, propRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw villages */
export function drawVillages(ctx, camera, canvasWidth, canvasHeight, villages) {
  for (const village of villages) {
    for (let i = 0; i < village.size; i++) {
      const bx = village.x + (Math.sin(i * 1.7) * 20);
      const by = village.y + (Math.cos(i * 2.3) * 20);
      const bh = camera.terrain ? camera.terrain.getHeightAt(bx, by) : 0;

      const proj = projectPoint(camera, { x: bx, y: by, z: bh + 5 }, canvasWidth, canvasHeight);
      if (!proj || proj.z <= 0) continue;

      const size = Math.max(2, 8 * proj.scale);
      ctx.fillStyle = '#886644';
      ctx.fillRect(proj.x - size/2, proj.y - size, size, size);
      // Roof
      ctx.fillStyle = '#aa3333';
      ctx.beginPath();
      ctx.moveTo(proj.x - size/2, proj.y - size);
      ctx.lineTo(proj.x, proj.y - size * 1.5);
      ctx.lineTo(proj.x + size/2, proj.y - size);
      ctx.fill();
    }
  }
}

/** Draw tree clusters */
export function drawTrees(ctx, camera, canvasWidth, canvasHeight, clusters) {
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const angle = (i / cluster.count) * Math.PI * 2;
      const dist = 15 + (i % 3) * 5;
      const tx = cluster.x + Math.cos(angle) * dist;
      const ty = cluster.y + Math.sin(angle) * dist;
      const tz = cluster.height + 10 + (i % 5) * 5;

      const proj = projectPoint(camera, { x: tx, y: ty, z: tz }, canvasWidth, canvasHeight);
      if (!proj || proj.z <= 0) continue;

      const size = Math.max(1, 12 * proj.scale);
      // Trunk
      ctx.fillStyle = '#443322';
      ctx.fillRect(proj.x - size * 0.1, proj.y, size * 0.2, size);
      // Canopy
      ctx.fillStyle = '#1a4a12';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y - size * 0.5, size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Main render function */
export function renderFrame(ctx, state, terrain, terrainPolys, rings, mission, camera, canvasWidth, canvasHeight, time, cameraMode) {
  // Clear
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Sky
  drawSky(ctx, camera, canvasWidth, canvasHeight, 0.3); // Slight golden hour

  // Sun
  drawSun(ctx, camera, canvasWidth, canvasHeight, 0.3);

  // Clouds
  drawClouds(ctx, camera, canvasWidth, canvasHeight, time);

  // Sea
  drawSea(ctx, camera, canvasWidth, canvasHeight, terrain);

  // Terrain
  drawTerrain(ctx, camera, canvasWidth, canvasHeight, terrain, terrainPolys);

  // Runway
  drawRunway(ctx, camera, canvasWidth, canvasHeight, terrain.runway);

  // Villages
  drawVillages(ctx, camera, canvasWidth, canvasHeight, terrain.villages);

  // Trees
  drawTrees(ctx, camera, canvasWidth, canvasHeight, terrain.treeClusters);

  // Rings
  drawRings(ctx, camera, canvasWidth, canvasHeight, rings, time);

  // Plane model (chase view only)
  if (cameraMode === CameraMode.CHASE) {
    drawPlaneModel(ctx, camera, canvasWidth, canvasHeight, state);
  }
}

// Colour utilities
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

function shadeColour(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const bl = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}