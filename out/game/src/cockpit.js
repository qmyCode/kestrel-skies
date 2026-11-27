/** Kestrel Skies - Cockpit Instruments & HUD */

import { COLOURS } from './config.js';

/** Draw artificial horizon - small round gauge */
export function drawArtificialHorizon(ctx, x, y, radius, pitch, roll) {
  ctx.save();
  ctx.translate(x, y);

  // Background
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, COLOURS.instrumentFace);
  grad.addColorStop(1, '#050510');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Frame
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Clip to circle
  ctx.beginPath();
  ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
  ctx.clip();

  // Sky/Ground (rotated by roll)
  ctx.rotate(-roll);

  // Sky (blue)
  const skyGrad = ctx.createLinearGradient(0, -radius, 0, radius);
  skyGrad.addColorStop(0, '#003366');
  skyGrad.addColorStop(1, '#0066aa');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  // Horizon line offset by pitch
  const horizonY = -pitch * radius * 1.2;
  ctx.fillStyle = '#003366';
  ctx.fillRect(-radius, -radius, radius * 2, horizonY + radius);

  // Ground (brown)
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, radius);
  groundGrad.addColorStop(0, '#553322');
  groundGrad.addColorStop(1, '#332211');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(-radius, horizonY, radius * 2, radius - horizonY);

  // Pitch ladder lines (major only: ±30, ±60, ±90)
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);
  for (const deg of [-90, -60, -30, 30, 60, 90]) {
    const lineY = -deg * Math.PI / 180 * radius * 1.2;
    if (lineY > -radius && lineY < radius) {
      const width = radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(-width / 2, lineY);
      ctx.lineTo(width / 2, lineY);
      ctx.stroke();

      // Degree labels
      ctx.fillStyle = COLOURS.instrumentMark;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg > 0 ? '+' : ''}${deg}`, -width / 2 - 4, lineY);
    }
  }
  ctx.setLineDash([]);

  // Bank indicator (top arc) - outside clip
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -radius - 4, radius * 0.7, Math.PI, 0);
  ctx.stroke();

  // Bank tick marks (10, 20, 30, 45, 60)
  for (const deg of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const angle = deg * Math.PI / 180;
    const r1 = radius * 0.6;
    const r2 = radius * 0.85;
    const x1 = Math.sin(angle) * r1;
    const y1 = -Math.cos(angle) * r1 - radius - 4;
    const x2 = Math.sin(angle) * r2;
    const y2 = -Math.cos(angle) * r2 - radius - 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Bank pointer (triangle)
  const bankAngle = roll;
  const px = Math.sin(bankAngle) * radius * 0.75;
  const py = -Math.cos(bankAngle) * radius * 0.75 - radius - 4;
  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - 4, py + 6);
  ctx.lineTo(px + 4, py + 6);
  ctx.fill();

  ctx.restore();
}

/** Draw altimeter - small round gauge */
export function drawAltimeter(ctx, x, y, radius, altitude) {
  ctx.save();
  ctx.translate(x, y);

  // Background
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, COLOURS.instrumentFace);
  grad.addColorStop(1, '#050510');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Frame
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Tape on right side (arc from -90 to +90 deg)
  const centerAlt = Math.round(altitude / 10) * 10;
  const metersPerDeg = 5; // 5m per degree

  ctx.save();
  ctx.translate(0, 0);

  // Draw tape numbers at 30-degree intervals
  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = -3; i <= 3; i++) {
    const alt = centerAlt + i * 150;
    if (alt < 0) continue;
    const angle = i * 30 * Math.PI / 180;
    const r = radius * 0.7;
    const tx = Math.sin(angle) * r;
    const ty = -Math.cos(angle) * r;
    const label = alt.toString().padStart(4, '0');
    ctx.fillText(label, tx - 5, ty);

    // Tick mark
    ctx.strokeStyle = COLOURS.instrumentMark;
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    const r1 = radius * 0.55;
    const r2 = radius * 0.75;
    const x1 = Math.sin(angle) * r1;
    const y1 = -Math.cos(angle) * r1;
    const x2 = Math.sin(angle) * r2;
    const y2 = -Math.cos(angle) * r2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();

  // Needle (points to current altitude at top)
  ctx.strokeStyle = COLOURS.instrumentNeedle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 5);
  ctx.lineTo(0, -radius * 0.3);
  ctx.stroke();

  // Digital readout at bottom
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(altitude)}m`, 0, radius - 10);

  ctx.restore();
}

/** Draw airspeed indicator - small round gauge */
export function drawAirspeed(ctx, x, y, radius, airspeed, stallSpeed, maxSpeed) {
  ctx.save();
  ctx.translate(x, y);

  // Background
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, COLOURS.instrumentFace);
  grad.addColorStop(1, '#050510');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Frame
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Stall warning arc (red)
  const stallRatio = stallSpeed / maxSpeed;
  const stallAngle = stallRatio * 180; // degrees from bottom
  ctx.strokeStyle = COLOURS.hudWarning;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.85, Math.PI * 1.5, Math.PI * 1.5 + stallAngle * Math.PI / 180);
  ctx.stroke();

  // Tape numbers at 30-degree intervals (0 at bottom, increasing clockwise)
  const centerSpeed = Math.round(airspeed);
  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 6; i++) {
    const spd = i * 20;
    if (spd > maxSpeed + 10) continue;
    const angle = -Math.PI / 2 + i * 30 * Math.PI / 180;
    const r = radius * 0.7;
    const tx = Math.cos(angle) * r;
    const ty = Math.sin(angle) * r;
    ctx.fillStyle = spd < stallSpeed ? COLOURS.hudWarning : (spd < stallSpeed * 1.2 ? COLOURS.hudSecondary : COLOURS.instrumentMark);
    ctx.fillText(spd.toString().padStart(3, '0'), tx, ty);

    // Tick mark
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    const r1 = radius * 0.55;
    const r2 = radius * 0.8;
    const x1 = Math.cos(angle) * r1;
    const y1 = Math.sin(angle) * r1;
    const x2 = Math.cos(angle) * r2;
    const y2 = Math.sin(angle) * r2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Needle
  const needleAngle = -Math.PI / 2 + Math.min(airspeed, maxSpeed) / maxSpeed * Math.PI * 1.5;
  ctx.strokeStyle = COLOURS.instrumentNeedle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needleAngle) * radius * 0.7, Math.sin(needleAngle) * radius * 0.7);
  ctx.stroke();

  // Digital readout at bottom
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(airspeed)} kt`, 0, radius - 10);

  ctx.restore();
}

/** Draw heading indicator - slim horizontal tape at top */
export function drawHeadingTape(ctx, canvasWidth, canvasHeight, heading) {
  const tapeHeight = 36;
  const tapeWidth = canvasWidth * 0.6;
  const x = (canvasWidth - tapeWidth) / 2;
  const y = 10;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(x, y, tapeWidth, tapeHeight);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, tapeWidth, tapeHeight);

  // Heading tape - centered on current heading
  const deg = Math.round(heading * 180 / Math.PI) % 360;
  const pixelsPerDeg = tapeWidth / 60; // Show ±30 degrees

  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = canvasWidth / 2;
  const centerY = y + tapeHeight / 2;

  // Draw tick marks and labels for ±30 degrees
  for (let d = -30; d <= 30; d += 5) {
    const h = (deg + d + 360) % 360;
    const px = centerX + d * pixelsPerDeg;

    // Only draw if within tape bounds
    if (px < x || px > x + tapeWidth) continue;

    const isMajor = d % 15 === 0;
    ctx.strokeStyle = COLOURS.instrumentMark;
    ctx.lineWidth = isMajor ? 2 : 1;
    const tickH = isMajor ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(px, centerY + tickH / 2);
    ctx.lineTo(px, centerY + tapeHeight / 2);
    ctx.stroke();

    if (isMajor) {
      const label = h === 0 ? 'N' : (h === 90 ? 'E' : (h === 180 ? 'S' : (h === 270 ? 'W' : h.toString().padStart(3, '0'))));
      ctx.fillStyle = (h === 0 || h === 90 || h === 180 || h === 270) ? COLOURS.hudSecondary : COLOURS.instrumentMark;
      ctx.fillText(label, px, centerY - tickH / 2 - 2);
    }
  }

  // Center lubber line (fixed)
  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(centerX - 6, y);
  ctx.lineTo(centerX + 6, y);
  ctx.lineTo(centerX, y + 8);
  ctx.fill();

  ctx.restore();
}

/** Draw throttle gauge - slim vertical bar at right */
export function drawThrottleGauge(ctx, canvasWidth, canvasHeight, throttle) {
  const barWidth = 16;
  const barHeight = 180;
  const x = canvasWidth - 30;
  const y = (canvasHeight - barHeight) / 2;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);

  // Throttle bar
  const fillHeight = barHeight * throttle;
  const grad = ctx.createLinearGradient(0, y + barHeight, 0, y);
  grad.addColorStop(0, '#004422');
  grad.addColorStop(0.5, '#00aa44');
  grad.addColorStop(1, '#00ff88');
  ctx.fillStyle = grad;
  ctx.fillRect(x + 2, y + barHeight - fillHeight, barWidth - 4, fillHeight);

  // Tick marks (0, 25, 50, 75, 100%)
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const py = y + barHeight - (barHeight * i / 4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, py);
    ctx.lineTo(x, py);
    ctx.stroke();
    ctx.fillText(`${i * 25}%`, x - 4, py);
  }

  // Label
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THR', x + barWidth / 2, y - 6);

  ctx.restore();
}

/** Draw fuel gauge - slim vertical bar at right, below throttle */
export function drawFuelGauge(ctx, canvasWidth, canvasHeight, fuel, capacity) {
  const ratio = fuel / capacity;
  const barWidth = 16;
  const barHeight = 180;
  const x = canvasWidth - 30;
  const y = (canvasHeight + barHeight) / 2 + 10;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);

  // Fuel bar
  const fillHeight = barHeight * ratio;
  const grad = ctx.createLinearGradient(0, y + barHeight, 0, y);
  if (ratio < 0.2) {
    grad.addColorStop(0, '#440000');
    grad.addColorStop(1, '#ff0000');
  } else if (ratio < 0.5) {
    grad.addColorStop(0, '#443300');
    grad.addColorStop(1, '#ffaa00');
  } else {
    grad.addColorStop(0, '#003300');
    grad.addColorStop(1, '#00aa00');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x + 2, y + barHeight - fillHeight, barWidth - 4, fillHeight);

  // Tick marks (E, 1/4, 1/2, 3/4, F)
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labels = ['E', '1/4', '1/2', '3/4', 'F'];
  for (let i = 0; i <= 4; i++) {
    const py = y + barHeight - (barHeight * i / 4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, py);
    ctx.lineTo(x, py);
    ctx.stroke();
    ctx.fillText(labels[i], x - 4, py);
  }

  // Label
  ctx.fillStyle = ratio < 0.2 ? COLOURS.hudWarning : COLOURS.hudPrimary;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', x + barWidth / 2, y - 6);

  ctx.restore()
}

/** Draw G-meter - small round gauge */
export function drawGMeter(ctx, x, y, radius, gForce, maxG = 5) {
  ctx.save();
  ctx.translate(x, y);

  // Background
  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Arc (bottom half)
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 3, Math.PI, 2 * Math.PI);
  ctx.stroke();

  // Needle
  const angle = Math.PI + (gForce / maxG) * Math.PI;
  const clampedAngle = Math.max(Math.PI, Math.min(2 * Math.PI, angle));
  const nx = Math.cos(clampedAngle) * (radius - 8);
  const ny = Math.sin(clampedAngle) * (radius - 8);

  ctx.strokeStyle = gForce > 4 ? COLOURS.hudWarning : COLOURS.instrumentNeedle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(nx, ny);
  ctx.stroke();

  // Labels
  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('G', 0, -3);
  ctx.fillText('1', -radius + 8, 2);
  ctx.fillText(`${maxG}`, radius - 8, 2);

  // Digital
  ctx.fillStyle = gForce > 4 ? COLOURS.hudWarning : COLOURS.hudPrimary;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${gForce.toFixed(1)}G`, 0, radius + 12);

  ctx.restore();
}

/** Draw cockpit instrument panel - bottom strip */
export function drawCockpitPanel(ctx, state, canvasWidth, canvasHeight) {
  const panelHeight = Math.round(canvasHeight * 0.22);
  const panelY = canvasHeight - panelHeight;
  const gaugeRadius = 55;
  const spacing = 20;

  ctx.save();

  // Panel background
  const grad = ctx.createLinearGradient(0, panelY, 0, canvasHeight);
  grad.addColorStop(0, 'rgba(20,20,35,0.95)');
  grad.addColorStop(1, 'rgba(5,5,15,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, panelY, canvasWidth, panelHeight);

  // Panel top border
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, panelY);
  ctx.lineTo(canvasWidth, panelY);
  ctx.stroke();

  // Gauge positions (centered vertically in panel)
  const gaugeY = panelY + panelHeight / 2;
  const leftStart = 60;
  const rightEnd = canvasWidth - 60;

  // Left group: Artificial Horizon, Altimeter, Airspeed
  let gx = leftStart;
  drawArtificialHorizon(ctx, gx, gaugeY, gaugeRadius, state.pitch, state.roll);
  gx += gaugeRadius * 2 + spacing;
  drawAltimeter(ctx, gx, gaugeY, gaugeRadius, state.altitude);
  gx += gaugeRadius * 2 + spacing;
  drawAirspeed(ctx, gx, gaugeY, gaugeRadius, state.airspeed, 28, 85);

  // Right group: Throttle, Fuel, G-meter
  drawThrottleGauge(ctx, canvasWidth, canvasHeight, state.throttle);
  drawFuelGauge(ctx, canvasWidth, canvasHeight, state.fuel, 120);

  const gMeterX = canvasWidth - 100;
  drawGMeter(ctx, gMeterX, gaugeY, 50, 1 + Math.abs(Math.tan(state.roll)) * 2);

  ctx.restore();
}

/** Draw main HUD (always visible) */
export function drawHUD(ctx, state, mission, canvasWidth, canvasHeight) {
  const padding = 20;
  const lineHeight = 28;
  let y = padding;

  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Top-left: Big numbers (only in chase view or when not in cockpit)
  if (state.cameraMode !== 'cockpit') {
    ctx.fillStyle = COLOURS.hudPrimary;
    ctx.fillText(`ALT ${Math.round(state.altitude)}m`, padding, y);
    y += lineHeight;
    ctx.fillText(`SPD ${Math.round(state.airspeed)} kt`, padding, y);
    y += lineHeight;
    ctx.fillText(`HDG ${(Math.round(state.heading * 180 / Math.PI) % 360).toString().padStart(3, '0')}°`, padding, y);
    y += lineHeight;

    // Vertical speed
    const vs = state.verticalSpeed;
    ctx.fillStyle = vs > 0 ? COLOURS.hudSecondary : (vs < 0 ? COLOURS.hudWarning : COLOURS.hudPrimary);
    ctx.fillText(`V/S ${vs > 0 ? '+' : ''}${Math.round(vs * 100)} fpm`, padding, y);
    y += lineHeight;
  }

  // Stall warning
  if (state.stalled) {
    ctx.fillStyle = COLOURS.hudWarning;
    ctx.font = 'bold 24px monospace';
    ctx.fillText('⚠ STALL ⚠', padding, y);
    y += lineHeight + 5;
  } else if (state.stallWarning) {
    ctx.fillStyle = COLOURS.hudSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('⚠ Stall Warning', padding, y);
    y += lineHeight + 5;
  }

  // Mission objective
  if (mission && mission.state === 'active') {
    ctx.fillStyle = COLOURS.hudSecondary;
    ctx.font = '16px monospace';
    ctx.fillText(mission.objectiveText, padding, y);
    y += lineHeight;

    // Time remaining
    const timeRem = mission.getTimeRemaining();
    ctx.fillStyle = timeRem < 30 ? COLOURS.hudWarning : COLOURS.hudDim;
    ctx.fillText(`TIME ${Math.ceil(timeRem)}s`, padding, y);
    y += lineHeight;

    // Score
    ctx.fillStyle = COLOURS.hudPrimary;
    ctx.fillText(`SCORE ${mission.totalScore}`, padding, y);
    y += lineHeight;

    // Rings/Checkpoints
    const progress = mission.currentRingIndex;
    const total = mission.rings.length;
    ctx.fillText(`RINGS ${progress}/${total}`, padding, y);
  }

  // Messages (top center)
  if (mission && mission.messages.length > 0) {
    const msg = mission.messages[mission.messages.length - 1];
    ctx.fillStyle = COLOURS.hudSecondary;
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(msg.text, canvasWidth / 2, 30);
  }

  // Heading tape at top (always visible)
  drawHeadingTape(ctx, canvasWidth, canvasHeight, state.heading);

  // Bottom-right: Fuel & Damage (chase view only)
  if (state.cameraMode !== 'cockpit') {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '16px monospace';
    let by = canvasHeight - padding;

    const fuelPct = (state.fuel / 120) * 100;
    ctx.fillStyle = fuelPct < 20 ? COLOURS.hudWarning : COLOURS.hudPrimary;
    ctx.fillText(`FUEL ${Math.round(fuelPct)}%`, canvasWidth - padding, by);
    by -= lineHeight;

    if (state.damage > 0) {
      ctx.fillStyle = state.damage > 50 ? COLOURS.hudWarning : COLOURS.hudSecondary;
      ctx.fillText(`DMG ${Math.round(state.damage)}%`, canvasWidth - padding, by);
      by -= lineHeight;
    }

    // Camera mode indicator
    ctx.fillStyle = COLOURS.hudDim;
    ctx.font = '12px monospace';
    ctx.fillText(state.cameraMode === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', canvasWidth - padding, by);
  }

  // Control hint (bottom-left, small)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '11px monospace';
  ctx.fillText('W/S=Pitch  A/D=Roll  Shift/Ctrl=Throttle  C=Camera  M=Mute', padding, canvasHeight - 5);
}

/** Draw mission briefing screen */
export function drawBriefing(ctx, mission, canvasWidth, canvasHeight) {
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const centerX = canvasWidth / 2;
  let y = 80;

  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(mission.config.name, centerX, y);
  y += 50;

  ctx.fillStyle = COLOURS.hudSecondary;
  ctx.font = '18px monospace';
  ctx.fillText(mission.config.description, centerX, y);
  y += 40;

  // Details
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '16px monospace';
  ctx.fillText(`Time Limit: ${mission.config.timeLimit}s`, centerX, y); y += 28;
  ctx.fillText(`Fuel: ${Math.round(100 * mission.config.fuelMultiplier)}%`, centerX, y); y += 28;
  ctx.fillText(`Wind: ${mission.config.windStrength} m/s`, centerX, y); y += 40;

  // Controls reminder
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = '16px monospace';
  ctx.fillText('CONTROLS:', centerX, y); y += 30;
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '14px monospace';
  const controls = [
    'Pitch: ↑/W (up)  ↓/S (down)',
    'Roll:  ←/A (left)  →/D (right)',
    'Throttle: Shift (increase)  Ctrl (decrease)',
    'Camera: C  |  Pause: Esc/P  |  Mute: M',
    'Gear: G  |  Flaps: F/V',
  ];
  for (const line of controls) {
    ctx.fillText(line, centerX, y);
    y += 24;
  }

  y += 20;
  ctx.fillStyle = COLOURS.hudSecondary;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('PRESS ANY KEY TO START', centerX, y);
}

/** Draw mission complete/failed screen */
export function drawMissionEnd(ctx, mission, canvasWidth, canvasHeight) {
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const centerX = canvasWidth / 2;
  let y = 100;

  const success = mission.state === 'completed';
  ctx.fillStyle = success ? '#00ff88' : COLOURS.hudWarning;
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(success ? 'MISSION COMPLETE' : 'MISSION FAILED', centerX, y);
  y += 60;

  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = '24px monospace';
  ctx.fillText(`FINAL SCORE: ${mission.totalScore}`, centerX, y);
  y += 50;

  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '16px monospace';
  ctx.fillText(`Time: ${Math.round(mission.elapsedTime)}s`, centerX, y); y += 28;
  ctx.fillText(`Rings/Checkpoints: ${mission.checkpointsPassed}/${mission.rings.length}`, centerX, y); y += 28;

  if (mission.ringScores.length > 0) {
    ctx.fillText('Ring Scores:', centerX, y); y += 28;
    ctx.font = '14px monospace';
    for (let i = 0; i < mission.ringScores.length; i++) {
      ctx.fillText(`  Ring ${i + 1}: ${mission.ringScores[i]}`, centerX, y);
      y += 22;
    }
  }

  y += 30;
  ctx.fillStyle = COLOURS.hudSecondary;
  ctx.font = '18px monospace';
  ctx.fillText('Press R to Retry  |  ESC for Mission Select', centerX, y);
}

/** Draw pause overlay */
export function drawPause(ctx, canvasWidth, canvasHeight) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', canvasWidth / 2, canvasHeight / 2 - 20);

  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '18px monospace';
  ctx.fillText('Press ESC or P to Resume', canvasWidth / 2, canvasHeight / 2 + 40);
}