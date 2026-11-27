/** Kestrel Skies - Cockpit Instruments & HUD */

import { COLOURS } from './config.js';

/** Draw artificial horizon */
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

  // Sky/Ground (rotated by roll)
  ctx.rotate(-roll);

  // Sky (blue)
  const skyGrad = ctx.createLinearGradient(0, -radius, 0, radius);
  skyGrad.addColorStop(0, '#004488');
  skyGrad.addColorStop(1, '#0088cc');
  ctx.fillStyle = skyGrad;
  ctx.beginPath();
  ctx.moveTo(-radius, -radius);
  ctx.lineTo(radius, -radius);
  ctx.lineTo(radius, radius);
  ctx.lineTo(-radius, radius);
  ctx.closePath();
  ctx.clip();

  // Horizon line offset by pitch
  const horizonY = -pitch * radius * 1.5;
  ctx.fillStyle = '#004488';
  ctx.fillRect(-radius, -radius, radius * 2, horizonY + radius);

  // Ground (brown)
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, radius);
  groundGrad.addColorStop(0, '#553322');
  groundGrad.addColorStop(1, '#332211');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(-radius, horizonY, radius * 2, radius - horizonY);

  // Pitch ladder lines
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 5]);
  for (let deg = -90; deg <= 90; deg += 10) {
    if (deg === 0) continue;
    const lineY = -deg * Math.PI / 180 * radius * 1.5;
    if (lineY > -radius && lineY < radius) {
      const width = deg % 30 === 0 ? radius * 0.8 : radius * 0.4;
      ctx.beginPath();
      ctx.moveTo(-width / 2, lineY);
      ctx.lineTo(width / 2, lineY);
      ctx.stroke();

      // Degree labels
      if (deg % 30 === 0) {
        ctx.fillStyle = COLOURS.instrumentMark;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg > 0 ? '+' : ''}${deg}`, -width / 2 - 5, lineY);
      }
    }
  }
  ctx.setLineDash([]);

  // Bank indicator (top arc)
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -radius - 5, radius * 0.8, Math.PI, 0);
  ctx.stroke();

  // Bank tick marks
  for (let deg = -60; deg <= 60; deg += 10) {
    const angle = deg * Math.PI / 180;
    const r1 = radius * 0.7;
    const r2 = radius * 0.9;
    const x1 = Math.sin(angle) * r1;
    const y1 = -Math.cos(angle) * r1 - radius - 5;
    const x2 = Math.sin(angle) * r2;
    const y2 = -Math.cos(angle) * r2 - radius - 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Bank pointer (triangle)
  const bankAngle = roll;
  const px = Math.sin(bankAngle) * radius * 0.8;
  const py = -Math.cos(bankAngle) * radius * 0.8 - radius - 5;
  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - 5, py + 8);
  ctx.lineTo(px + 5, py + 8);
  ctx.fill();

  ctx.restore();
}

/** Draw altimeter */
export function drawAltimeter(ctx, x, y, width, height, altitude, targetAltitude = null) {
  ctx.save();
  ctx.translate(x, y);

  // Background
  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Tape
  const tapeHeight = height - 20;
  const centerY = height / 2;
  const metersPerPixel = 10; // 10m per pixel on tape
  const centerAlt = Math.round(altitude / 10) * 10;

  ctx.save();
  ctx.translate(width / 2, centerY);
  ctx.beginPath();
  ctx.rect(-width / 2 + 2, -tapeHeight / 2, width - 4, tapeHeight);
  ctx.clip();

  // Draw tape numbers
  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = -10; i <= 10; i++) {
    const alt = centerAlt + i * 50;
    if (alt < 0) continue;
    const y = -i * 50 / metersPerPixel;
    const label = alt.toString().padStart(5, '0');
    ctx.fillText(label, width / 2 - 10, y);

    // Tick marks
    ctx.strokeStyle = COLOURS.instrumentMark;
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 10, y);
    ctx.lineTo(-width / 2 + (i % 2 === 0 ? 30 : 20), y);
    ctx.stroke();
  }

  ctx.restore();

  // Center indicator (current altitude)
  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 5, centerY - 15);
  ctx.lineTo(width / 2 + 15, centerY);
  ctx.lineTo(width / 2 - 5, centerY + 15);
  ctx.fill();

  // Current altitude digital readout
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(altitude)}m`, width / 2, height - 12);

  // Target altitude bug
  if (targetAltitude !== null) {
    const bugY = centerY - (targetAltitude - centerAlt) / metersPerPixel;
    if (bugY > 10 && bugY < height - 10) {
      ctx.fillStyle = COLOURS.hudSecondary;
      ctx.beginPath();
      ctx.moveTo(5, bugY);
      ctx.lineTo(20, bugY - 5);
      ctx.lineTo(20, bugY + 5);
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Draw airspeed indicator */
export function drawAirspeed(ctx, x, y, width, height, airspeed, stallSpeed, maxSpeed) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  const tapeHeight = height - 20;
  const centerY = height / 2;
  const ktsPerPixel = 2;
  const centerSpeed = Math.round(airspeed);

  ctx.save();
  ctx.translate(width / 2, centerY);
  ctx.beginPath();
  ctx.rect(-width / 2 + 2, -tapeHeight / 2, width - 4, tapeHeight);
  ctx.clip();

  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = -10; i <= 10; i++) {
    const spd = centerSpeed + i * 10;
    if (spd < 0 || spd > maxSpeed + 20) continue;
    const y = -i * 10 / ktsPerPixel;

    // Colour coding
    if (spd < stallSpeed) ctx.fillStyle = COLOURS.hudWarning;
    else if (spd < stallSpeed * 1.2) ctx.fillStyle = COLOURS.hudSecondary;
    else ctx.fillStyle = COLOURS.instrumentMark;

    const label = spd.toString().padStart(3, '0');
    ctx.fillText(label, width / 2 - 10, y);

    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 10, y);
    ctx.lineTo(-width / 2 + (i % 2 === 0 ? 30 : 20), y);
    ctx.stroke();
  }

  ctx.restore();

  // Center indicator
  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 5, centerY - 15);
  ctx.lineTo(width / 2 + 15, centerY);
  ctx.lineTo(width / 2 - 5, centerY + 15);
  ctx.fill();

  // Digital readout
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(airspeed)} kt`, width / 2, height - 12);

  // Stall warning bar
  if (airspeed < stallSpeed * 1.3) {
    ctx.fillStyle = 'rgba(255,68,68,0.3)';
    const stallY = centerY - (stallSpeed * 1.1 - centerSpeed) / ktsPerPixel;
    ctx.fillRect(0, Math.min(stallY, centerY), width, Math.abs(stallY - centerY));
  }

  ctx.restore();
}

/** Draw heading indicator / compass */
export function drawHeading(ctx, x, y, radius, heading) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Compass rose (rotated by heading)
  ctx.rotate(-heading);

  const labels = ['N', '03', '06', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const isCardinal = i % 3 === 0;
    const r1 = radius * (isCardinal ? 0.7 : 0.8);
    const r2 = radius * 0.95;
    const x1 = Math.sin(angle) * r1;
    const y1 = -Math.cos(angle) * r1;
    const x2 = Math.sin(angle) * r2;
    const y2 = -Math.cos(angle) * r2;

    ctx.strokeStyle = COLOURS.instrumentMark;
    ctx.lineWidth = isCardinal ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (isCardinal) {
      const label = labels[i];
      const lx = Math.sin(angle) * radius * 0.5;
      const ly = -Math.cos(angle) * radius * 0.5;
      ctx.fillStyle = isCardinal && (label === 'N' || label === 'S' || label === 'E' || label === 'W') ? COLOURS.hudSecondary : COLOURS.instrumentMark;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);
    }
  }

  // Lubber line (fixed at top)
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOURS.instrumentNeedle;
  ctx.beginPath();
  ctx.moveTo(0, -radius - 5);
  ctx.lineTo(-8, -radius + 5);
  ctx.lineTo(8, -radius + 5);
  ctx.fill();

  // Digital heading
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const deg = Math.round(heading * 180 / Math.PI) % 360;
  ctx.fillText(`${deg.toString().padStart(3, '0')}°`, 0, radius + 20);

  ctx.restore();
}

/** Draw throttle gauge */
export function drawThrottleGauge(ctx, x, y, width, height, throttle) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Throttle bar
  const barHeight = (height - 20) * throttle;
  const grad = ctx.createLinearGradient(0, height - 10, 0, 10);
  grad.addColorStop(0, '#004422');
  grad.addColorStop(0.5, '#00aa44');
  grad.addColorStop(1, '#00ff88');
  ctx.fillStyle = grad;
  ctx.fillRect(5, height - 10 - barHeight, width - 10, barHeight);

  // Tick marks
  ctx.strokeStyle = COLOURS.instrumentMark;
  for (let i = 0; i <= 10; i++) {
    const y = height - 10 - (height - 20) * i / 10;
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(width - 10, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = COLOURS.hudPrimary;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`THR ${Math.round(throttle * 100)}%`, width / 2, height - 2);

  ctx.restore();
}

/** Draw fuel gauge */
export function drawFuelGauge(ctx, x, y, width, height, fuel, capacity) {
  ctx.save();
  ctx.translate(x, y);

  const ratio = fuel / capacity;

  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Fuel bar
  const barHeight = (height - 20) * ratio;
  const grad = ctx.createLinearGradient(0, height - 10, 0, 10);
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
  ctx.fillRect(5, height - 10 - barHeight, width - 10, barHeight);

  // Tick marks
  ctx.strokeStyle = COLOURS.instrumentMark;
  for (let i = 0; i <= 4; i++) {
    const y = height - 10 - (height - 20) * i / 4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - 10, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = ratio < 0.2 ? COLOURS.hudWarning : COLOURS.hudPrimary;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`FUEL ${Math.round(fuel)}/${capacity}L`, width / 2, height - 2);

  ctx.restore();
}

/** Draw G-meter */
export function drawGMeter(ctx, x, y, width, height, gForce, maxG = 5) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOURS.instrumentFace;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  // Arc
  ctx.strokeStyle = COLOURS.instrumentMark;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(width / 2, height, width / 2 - 4, Math.PI, 0);
  ctx.stroke();

  // Needle
  const angle = Math.PI + (gForce / maxG) * Math.PI;
  angle = Math.max(Math.PI, Math.min(2 * Math.PI, angle));
  const nx = width / 2 + Math.cos(angle) * (width / 2 - 12);
  const ny = height + Math.sin(angle) * (width / 2 - 12);

  ctx.strokeStyle = gForce > 4 ? COLOURS.hudWarning : COLOURS.instrumentNeedle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, height);
  ctx.lineTo(nx, ny);
  ctx.stroke();

  // Labels
  ctx.fillStyle = COLOURS.instrumentMark;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('G', width / 2, height - 5);
  ctx.fillText('1', 10, height - 5);
  ctx.fillText(`${maxG}`, width - 10, height - 5);

  // Digital
  ctx.fillStyle = gForce > 4 ? COLOURS.hudWarning : COLOURS.hudPrimary;
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`${gForce.toFixed(1)}G`, width / 2, height + 18);

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

  // Top-left: Big numbers
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

  // Bottom-right: Fuel & Damage
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = '16px monospace';
  let by = canvasHeight - padding;

  const fuelPct = (state.fuel / state.fuelCapacity) * 100;
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