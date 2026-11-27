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

  // Yaw: decompose into forward (along heading) and right (lateral)
  // Forward unit = (cosH, sinH); right unit = (sinH, -cosH)
  const cosH = Math.cos(camera.heading);
  const sinH = Math.sin(camera.heading);
  const forward = dx * cosH + dy * sinH;
  const right = dx * sinH - dy * cosH;

  // Pitch: rotate forward/up. camera.pitch is the elevation of the view
  // direction (negative pitch = looking down, as used by the shot scenes).
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);
  const depth = forward * cosP + dz * sinP;
  const up = -forward * sinP + dz * cosP;

  // Roll: rotate right/up in the screen plane
  const cosR = Math.cos(camera.roll);
  const sinR = Math.sin(camera.roll);
  const xr = right * cosR - up * sinR;
  const yr = right * sinR + up * cosR;

  // Perspective projection. Points at/behind the near plane keep their raw
  // (<= near) depth so callers can cull them via proj.z / proj.rawDepth.
  const focal = (canvasHeight / 2) / Math.tan(RENDER.fov / 2);
  const safeDepth = Math.max(depth, RENDER.nearPlane);
  const scale = focal / safeDepth;
  const sx = canvasWidth / 2 + xr * scale;
  const sy = canvasHeight / 2 - yr * scale;

  return { x: sx, y: sy, z: depth, scale, rawDepth: depth };
}

/** Camera state for rendering */
export function createCamera(state, mode = CameraMode.COCKPIT) {
  const chaseDistance = 100;
  const chaseHeight = 15;

  if (mode === CameraMode.CHASE) {
    // Chase camera behind and above plane
    const heading = state.heading;
    const pitch = state.pitch * 0.3;
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
      z: state.altitude + 1.5,
      heading: state.heading,
      pitch: state.pitch,
      roll: state.roll,
      mode,
    };
  }
}

/** Sky gradient - returns horizonY for other functions */
export function drawSky(ctx, camera, canvasWidth, canvasHeight, timeOfDay = 0.5) {
  // Horizon Y consistent with projectPoint: a distant point at camera
  // altitude projects to cy + focal * sin(pitch).
  const focal = (canvasHeight / 2) / Math.tan(RENDER.fov / 2);
  const horizonY = Math.max(0, Math.min(canvasHeight, canvasHeight / 2 + focal * Math.sin(camera.pitch)));

  const gradient = ctx.createLinearGradient(0, 0, 0, horizonY);

  const t = timeOfDay;
  const zenith = lerpColour(COLOURS.skyZenith, COLOURS.skyGoldenZenith, t);
  const horizon = lerpColour(COLOURS.skyHorizon, COLOURS.skyGoldenHorizon, t);

  gradient.addColorStop(0, zenith);
  gradient.addColorStop(1, horizon);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, horizonY);

  return horizonY;
}

/** Draw sun */
export function drawSun(ctx, camera, canvasWidth, canvasHeight, timeOfDay = 0.5) {
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
  const sunDist = 10000;
  const sunX = Math.cos(sunAngle) * sunDist;
  const sunY = Math.sin(sunAngle) * sunDist;
  const sunZ = 5000;

  const proj = projectPoint(camera, { x: sunX, y: sunY, z: sunZ }, canvasWidth, canvasHeight);
  if (!proj || proj.z < 0) return;

  const size = 80 / (proj.z / 1000);

  const glow = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, size * 3);
  glow.addColorStop(0, COLOURS.sunCore);
  glow.addColorStop(0.3, COLOURS.sunGlow);
  glow.addColorStop(1, 'rgba(255,170,0,0)');

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, size * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOURS.sunCore;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw clouds */
export function drawClouds(ctx, camera, canvasWidth, canvasHeight, time) {
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

    const alpha = cloud.opacity * 0.6 * (1 - Math.min(1, proj.z / 15000));
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLOURS.cloudLight;
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, size * 1.5, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(proj.x - size * 0.5, proj.y + size * 0.12, size * 0.9, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(proj.x + size * 0.55, proj.y + size * 0.1, size * 0.8, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = COLOURS.cloudShadow;
    ctx.beginPath();
    ctx.ellipse(proj.x + size * 0.1, proj.y + size * 0.22, size * 1.3, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/** Draw terrain polygons */
export function drawTerrain(ctx, camera, canvasWidth, canvasHeight, terrain, terrainPolys, horizonY) {
  // horizonY parameter kept for compatibility (no longer used for culling)

  for (const poly of terrainPolys) {
    if (poly.height < 0) continue; // underwater: the sea surface covers it
    const proj = projectPoint(camera, {
      x: poly.x,
      y: poly.y,
      z: poly.height
    }, canvasWidth, canvasHeight);

    if (!proj) continue;

    // Don't cull by rawDepth - terrain below camera has negative fz but should still draw
    // (projection uses max(fz, nearPlane) for perspective depth)
    // Only cull if too small on screen
    const size = poly.size * proj.scale;
    if (size < 0.5) continue;

    // Colour with altitude shading (unpack RGB from packed Uint32 RGBA)
    const altitudeRatio = Math.min(1, Math.max(0, poly.height / 600));
    const packed = poly.colour;
    const r = (packed >> 16) & 0xFF;
    const g = (packed >> 8) & 0xFF;
    const b = packed & 0xFF;
    const baseColour = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const shadedColour = shadeColour(baseColour, 0.85 + altitudeRatio * 0.3);

    // Distance fog
    const fogFactor = Math.min(1, proj.z / 10000);
    const fogColour = lerpColour(shadedColour, COLOURS.skyHorizon, fogFactor * 0.4);

    ctx.fillStyle = fogColour;
    ctx.beginPath();

    // Draw as quad (4 corners) - half must be WORLD size, not screen size
    const half = poly.size / 2;
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

/** Draw sea */
export function drawSea(ctx, camera, canvasWidth, canvasHeight, terrain, horizonY) {
  const seaY = horizonY;
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

/** Draw runway */
export function drawRunway(ctx, camera, canvasWidth, canvasHeight, runway) {
  if (!runway) return;

  const hw = runway.width / 2;
  const hl = runway.length / 2;
  const cosH = Math.cos(runway.heading);
  const sinH = Math.sin(runway.heading);

  const corners = [
    { x: runway.x - cosH * hl - sinH * hw, y: runway.y - sinH * hl + cosH * hw, z: 0.1 },
    { x: runway.x + cosH * hl - sinH * hw, y: runway.y + sinH * hl + cosH * hw, z: 0.1 },
    { x: runway.x + cosH * hl + sinH * hw, y: runway.y + sinH * hl - cosH * hw, z: 0.1 },
    { x: runway.x - cosH * hl + sinH * hw, y: runway.y - sinH * hl - cosH * hw, z: 0.1 },
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
  const center1 = projectPoint(camera, { x: runway.x - cosH * hl, y: runway.y - sinH * hl, z: 0.2 }, canvasWidth, canvasHeight);
  const center2 = projectPoint(camera, { x: runway.x + cosH * hl, y: runway.y + sinH * hl, z: 0.2 }, canvasWidth, canvasHeight);
  if (center1 && center2 && center1.z > 0 && center2.z > 0) {
    ctx.setLineDash([20 * center1.scale, 15 * center1.scale]);
    ctx.beginPath();
    ctx.moveTo(center1.x, center1.y);
    ctx.lineTo(center2.x, center2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Threshold markings
  for (let i = 0; i < 2; i++) {
    const endX = i === 0 ? runway.x - cosH * hl : runway.x + cosH * hl;
    const endY = i === 0 ? runway.y - sinH * hl : runway.y + sinH * hl;
    const p1 = projectPoint(camera, { x: endX - sinH * hw, y: endY + cosH * hw, z: 0.2 }, canvasWidth, canvasHeight);
    const p2 = projectPoint(camera, { x: endX + sinH * hw, y: endY - cosH * hw, z: 0.2 }, canvasWidth, canvasHeight);
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

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = Math.max(1, 2 * proj.scale);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Draw Kestrel K-7 aircraft in chase view - screen-space rear three-quarter illustration.
 *  Chase camera sits behind and above the plane, so the fuselage length projects
 *  vertically on screen: tail at the bottom (near viewer), nose at the top (far).
 *  Drawn as single smooth shapes - no stacked slices. */
export function drawPlaneModel(ctx, camera, canvasWidth, canvasHeight, state) {
  if (!state.engineRunning) return;

  ctx.save();

  const cx = canvasWidth * 0.5;
  const cy = canvasHeight * 0.62;
  const pitchOffset = state.pitch * 60;

  // Bank the whole drawing by the plane's roll
  ctx.translate(cx, cy + pitchOffset);
  ctx.rotate(state.roll * 0.9);
  ctx.translate(-cx, -(cy + pitchOffset));
  ctx.translate(0, pitchOffset);

  const ORANGE = '#E86C00';
  const ORANGE_DARK = '#B84C00';
  const ORANGE_LIGHT = '#FF8C20';
  const CREAM = '#F5E8D0';
  const GLASS_DARK = '#14142a';
  const GLASS_LIGHT = '#4a5a8a';
  const OUTLINE = 'rgba(20,10,0,0.45)';
  const outline = () => { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };

  // Key vertical stations (relative to cy)
  const noseY = cy - 88;      // far end
  const wingY = cy + 6;       // main wing line
  const tailY = cy + 62;      // near end (tail cone)

  // === PROPELLER DISC (at the nose, far end - small translucent disc) ===
  ctx.save();
  ctx.fillStyle = 'rgba(50,50,60,0.28)';
  ctx.beginPath();
  ctx.arc(cx, noseY - 4, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,50,0.35)';
  ctx.lineWidth = 2;
  const ba = (performance.now() / 40) % Math.PI;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(ba) * 28, noseY - 4 - Math.sin(ba) * 28);
  ctx.lineTo(cx + Math.cos(ba) * 28, noseY - 4 + Math.sin(ba) * 28);
  ctx.stroke();
  ctx.restore();

  // === MAIN WING ===
  const wSpan = 340, wRootHalf = 30;
  const wingGrad = ctx.createLinearGradient(cx - wSpan / 2, 0, cx + wSpan / 2, 0);
  wingGrad.addColorStop(0, ORANGE_DARK);
  wingGrad.addColorStop(0.5, ORANGE);
  wingGrad.addColorStop(1, ORANGE_DARK);
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(cx - wSpan / 2, wingY - 12);
  ctx.lineTo(cx - wRootHalf, wingY - 6);
  ctx.lineTo(cx + wRootHalf, wingY - 6);
  ctx.lineTo(cx + wSpan / 2, wingY - 12);
  ctx.lineTo(cx + wSpan / 2 - 16, wingY + 14);
  ctx.lineTo(cx - wSpan / 2 + 16, wingY + 14);
  ctx.closePath();
  ctx.fill();
  outline(); ctx.stroke();
  // Cream trailing edge strip
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - wSpan / 2 + 18, wingY + 11);
  ctx.lineTo(cx + wSpan / 2 - 18, wingY + 11);
  ctx.stroke();

  // === FUSELAGE (one smooth tapered body, tail bottom -> nose top) ===
  const fuseGrad = ctx.createLinearGradient(0, tailY, 0, noseY);
  fuseGrad.addColorStop(0, ORANGE_DARK);
  fuseGrad.addColorStop(0.45, ORANGE);
  fuseGrad.addColorStop(0.8, ORANGE_LIGHT);
  fuseGrad.addColorStop(1, CREAM);
  ctx.fillStyle = fuseGrad;
  ctx.beginPath();
  ctx.moveTo(cx, noseY - 6);
  ctx.bezierCurveTo(cx + 17, noseY + 4, cx + 26, wingY - 34, cx + 30, wingY + 2);
  ctx.bezierCurveTo(cx + 32, wingY + 26, cx + 20, tailY - 8, cx + 11, tailY + 8);
  ctx.quadraticCurveTo(cx, tailY + 14, cx - 11, tailY + 8);
  ctx.bezierCurveTo(cx - 20, tailY - 8, cx - 32, wingY + 26, cx - 30, wingY + 2);
  ctx.bezierCurveTo(cx - 26, wingY - 34, cx - 17, noseY + 4, cx, noseY - 6);
  ctx.closePath();
  ctx.fill();
  outline(); ctx.stroke();
  // Cream cheatline along the fuselage side
  ctx.strokeStyle = 'rgba(245,232,208,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 24, wingY + 16);
  ctx.quadraticCurveTo(cx - 26, wingY - 14, cx - 15, noseY + 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 24, wingY + 16);
  ctx.quadraticCurveTo(cx + 26, wingY - 14, cx + 15, noseY + 16);
  ctx.stroke();

  // === CANOPY (dark glass, on top of fuselage ahead of the wing) ===
  const canY = noseY + 34;
  const canGrad = ctx.createRadialGradient(cx - 5, canY - 7, 2, cx, canY, 22);
  canGrad.addColorStop(0, GLASS_LIGHT);
  canGrad.addColorStop(1, GLASS_DARK);
  ctx.fillStyle = canGrad;
  ctx.beginPath();
  ctx.ellipse(cx, canY, 16, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(); ctx.stroke();

  // === VERTICAL FIN (rises from the tail cone, drawn over the fuselage so its stripes read) ===
  // Fin is at the tail (bottom); it projects as a centre strip running up
  // the rear fuselage. Draw it first so the fuselage overlaps its base.
  const finGrad = ctx.createLinearGradient(0, tailY - 58, 0, tailY + 8);
  finGrad.addColorStop(0, ORANGE_LIGHT);
  finGrad.addColorStop(1, ORANGE_DARK);
  ctx.fillStyle = finGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 7, tailY + 8);
  ctx.lineTo(cx - 10, tailY - 34);
  ctx.quadraticCurveTo(cx - 9, tailY - 56, cx, tailY - 58);
  ctx.quadraticCurveTo(cx + 9, tailY - 56, cx + 10, tailY - 34);
  ctx.lineTo(cx + 7, tailY + 8);
  ctx.closePath();
  ctx.fill();
  outline(); ctx.stroke();
  // Fin stripes (cream)
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 3;
  for (const t of [0.3, 0.52, 0.74]) {
    const y = tailY + 8 - 66 * t;
    const w = 9 - 2 * t;
    ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.lineTo(cx + w, y); ctx.stroke();
  }

  // === TAILPLANE (small horizontal stabiliser at the tail, nearest viewer) ===
  const tpSpan = 132;
  const tpGrad = ctx.createLinearGradient(cx - tpSpan / 2, 0, cx + tpSpan / 2, 0);
  tpGrad.addColorStop(0, ORANGE_DARK);
  tpGrad.addColorStop(0.5, ORANGE_LIGHT);
  tpGrad.addColorStop(1, ORANGE_DARK);
  ctx.fillStyle = tpGrad;
  ctx.beginPath();
  ctx.moveTo(cx - tpSpan / 2, tailY + 2);
  ctx.lineTo(cx - 14, tailY - 4);
  ctx.lineTo(cx + 14, tailY - 4);
  ctx.lineTo(cx + tpSpan / 2, tailY + 2);
  ctx.lineTo(cx + tpSpan / 2 - 12, tailY + 16);
  ctx.lineTo(cx - tpSpan / 2 + 12, tailY + 16);
  ctx.closePath();
  ctx.fill();
  outline(); ctx.stroke();

  ctx.restore();
}


/** Draw villages */
export function drawVillages(ctx, camera, canvasWidth, canvasHeight, villages, terrain) {
  for (const village of villages) {
    for (let i = 0; i < village.size; i++) {
      const bx = village.x + (Math.sin(i * 1.7) * 20);
      const by = village.y + (Math.cos(i * 2.3) * 20);
      const bh = terrain.getHeightAt(bx, by);

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
export function drawTrees(ctx, camera, canvasWidth, canvasHeight, clusters, terrain) {
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const angle = (i / cluster.count) * Math.PI * 2;
      const dist = 15 + (i % 3) * 5;
      const tx = cluster.x + Math.cos(angle) * dist;
      const ty = cluster.y + Math.sin(angle) * dist;
      const tz = terrain.getHeightAt(tx, ty) + 10 + (i % 5) * 5;

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

  // Sky - returns horizonY
  const horizonY = drawSky(ctx, camera, canvasWidth, canvasHeight, 0.18);

  // Sun
  drawSun(ctx, camera, canvasWidth, canvasHeight, 0.18);

  // Clouds
  drawClouds(ctx, camera, canvasWidth, canvasHeight, time);

  // Sea (drawn before terrain so terrain covers it)
  drawSea(ctx, camera, canvasWidth, canvasHeight, terrain, horizonY);

  // Terrain (covers sea where land exists)
  drawTerrain(ctx, camera, canvasWidth, canvasHeight, terrain, terrainPolys, horizonY);

  // Runway
  drawRunway(ctx, camera, canvasWidth, canvasHeight, terrain.runway);

  // Villages
  drawVillages(ctx, camera, canvasWidth, canvasHeight, terrain.villages, terrain);

  // Trees
  drawTrees(ctx, camera, canvasWidth, canvasHeight, terrain.treeClusters, terrain);

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