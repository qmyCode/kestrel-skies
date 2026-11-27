/** Kestrel Skies - Flight Model */

import { PLANE, GAMEPLAY, WORLD_SIZE, SEA_LEVEL } from './config.js';

/** Initial flight state */
export function createInitialState(terrain) {
  const mainIsland = terrain.islands.find(i => i.type === 'main');
  const startX = mainIsland ? mainIsland.x : 0;
  const startY = mainIsland ? mainIsland.y - 500 : 0;
  const groundHeight = terrain.getHeightAt(startX, startY);

  return {
    // Position
    x: startX,
    y: startY,
    altitude: groundHeight + 150,         // Start 150m above ground

    // Velocity
    speed: 0,                             // m/s (airspeed)
    heading: 0,                           // Radians (0 = East, PI/2 = North)
    climbRate: 0,                         // m/s

    // Attitude
    pitch: 0,                             // Radians (nose up positive)
    roll: 0,                              // Radians (right wing down positive)

    // Controls
    throttle: 0,                          // 0 to 1
    pitchInput: 0,                        // -1 to 1
    rollInput: 0,                         // -1 to 1

    // Systems
    fuel: PLANE.fuelCapacity,             // Liters
    damage: 0,                            // 0 to 100
    engineRunning: true,

    // Derived
    groundSpeed: 0,
    airspeed: 0,
    verticalSpeed: 0,
    gForce: 1,
    aoa: 0,                               // Angle of attack (radians)
    stalled: false,
    onGround: false,
    gearDown: false,
    flaps: 0,                             // 0 to 1

    // Wind
    windX: 0,
    windY: 0,
    windSpeed: 0,
    windHeading: 0,
  };
}

/** Step the flight model */
export function step(state, input, dt, terrain, missionWind = { x: 0, y: 0 }) {
  if (dt <= 0 || dt > 0.1) dt = 1/60;

  // --- Input handling ---
  state.pitchInput = clamp(input.pitch, -1, 1);
  state.rollInput = clamp(input.roll, -1, 1);

  // Throttle
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.5);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.5);
  state.throttle = clamp(state.throttle, 0, 1);

  // Flaps/gear (auto for landing)
  if (input.gearToggle) state.gearDown = !state.gearDown;
  if (input.flapsUp) state.flaps = Math.min(1, state.flaps + dt);
  if (input.flapsDown) state.flaps = Math.max(0, state.flaps - dt);

  // --- Wind ---
  state.windX = missionWind.x;
  state.windY = missionWind.y;
  state.windSpeed = Math.sqrt(state.windX * state.windX + state.windY * state.windY);
  state.windHeading = Math.atan2(state.windY, state.windX);

  // --- Aerodynamics ---
  const rho = 1.225 * (1 - state.altitude / 44300); // Air density (simplified)
  const wingArea = PLANE.wingArea * (1 + state.flaps * 0.3); // Flaps increase area
  const dragCoeff = PLANE.dragCoeff + state.flaps * 0.05 + (state.gearDown ? 0.03 : 0);
  const liftCoeffMax = PLANE.liftCoeff * (1 + state.flaps * 0.5);

  // Airspeed vector (relative to wind)
  const vx = state.speed * Math.cos(state.heading) - state.windX;
  const vy = state.speed * Math.sin(state.heading) - state.windY;
  state.airspeed = Math.sqrt(vx * vx + vy * vy);

  // Ground speed
  state.groundSpeed = state.speed;

  // Angle of attack (simplified: pitch minus flight path angle)
  const flightPathAngle = Math.atan2(state.climbRate, Math.max(1, state.speed));
  state.aoa = state.pitch - flightPathAngle;

  // Lift
  const liftCoeff = Math.min(liftCoeffMax, Math.max(-liftCoeffMax, state.aoa * 2 * Math.PI * 0.1));
  const lift = 0.5 * rho * state.airspeed * state.airspeed * wingArea * liftCoeff;

  // Drag
  const drag = 0.5 * rho * state.airspeed * state.airspeed * wingArea * dragCoeff;

  // Thrust
  const thrust = state.throttle * PLANE.maxThrust * (rho / 1.225) * (state.engineRunning ? 1 : 0);

  // --- Forces ---
  const mass = PLANE.mass;
  const weight = mass * 9.81;

  // Longitudinal (along velocity vector)
  const netForce = thrust - drag;
  const accel = netForce / mass;

  // Vertical (lift - weight)
  const loadFactor = lift / weight;
  state.gForce = Math.abs(loadFactor);
  const verticalAccel = (lift * Math.cos(state.roll) - weight) / mass;

  // --- Update velocity ---
  state.speed += accel * dt;
  state.speed = Math.max(0, Math.min(PLANE.maxSpeed * 1.2, state.speed));

  // Climb rate
  state.climbRate += verticalAccel * dt;
  state.climbRate = clamp(state.climbRate, -PLANE.maxSpeed, PLANE.maxSpeed);
  state.verticalSpeed = state.climbRate;

  // --- Stall logic ---
  const stallSpeed = PLANE.stallSpeed * Math.sqrt(1 / Math.max(0.5, Math.cos(state.roll))) * (1 - state.flaps * 0.2);
  state.stalled = state.airspeed < stallSpeed && state.altitude > terrain.getHeightAt(state.x, state.y) + 5;

  if (state.stalled) {
    // Stall: nose drops, roll control reduced, high sink rate
    state.pitch -= dt * 0.5;
    state.rollInput *= 0.3;
    state.climbRate -= dt * 15; // Rapid sink
    state.damage += dt * 2;     // Stress damage
  }

  // Stall warning
  const stallWarning = state.airspeed < stallSpeed * GAMEPLAY.stallWarningMargin && state.airspeed > 10;

  // --- Update attitude ---
  // Pitch: elevator effectiveness depends on airspeed
  const pitchAuthority = Math.min(1, state.airspeed / 30) * PLANE.pitchRate * Math.PI / 180;
  state.pitch += state.pitchInput * pitchAuthority * dt;

  // Roll: aileron effectiveness
  const rollAuthority = Math.min(1, state.airspeed / 25) * PLANE.rollRate * Math.PI / 180;
  // Adverse yaw / coordination (simplified)
  state.roll += state.rollInput * rollAuthority * dt;

  // Auto-leveling (stability)
  if (Math.abs(state.rollInput) < 0.1) {
    state.roll *= Math.pow(0.98, dt * 60);
  }
  if (Math.abs(state.pitchInput) < 0.1) {
    state.pitch *= Math.pow(0.99, dt * 60);
  }

  // Clamp attitude
  state.pitch = clamp(state.pitch, -Math.PI / 2, Math.PI / 2);
  state.roll = clamp(state.roll, -Math.PI, Math.PI);

  // --- Heading change from roll (banked turn) ---
  if (state.speed > 5) {
    const turnRate = 9.81 * Math.tan(state.roll) / state.speed; // Coordinated turn rate
    state.heading += turnRate * dt;
  }

  // Normalize heading
  state.heading = (state.heading + Math.PI * 2) % (Math.PI * 2);

  // --- Position update ---
  state.x += state.speed * Math.cos(state.heading) * dt;
  state.y += state.speed * Math.sin(state.heading) * dt;
  state.altitude += state.climbRate * dt;

  // --- Ground collision ---
  const groundHeight = terrain.getHeightAt(state.x, state.y);
  const agl = state.altitude - groundHeight;

  if (agl <= 0) {
    state.altitude = groundHeight;
    state.onGround = true;

    // Impact
    const impactSpeed = Math.sqrt(state.climbRate * state.climbRate + state.speed * state.speed * 0.1);
    if (impactSpeed > GAMEPLAY.crashSpeed) {
      state.damage += (impactSpeed - GAMEPLAY.crashSpeed) * 2;
      state.engineRunning = false;
    } else if (impactSpeed > 5) {
      state.damage += impactSpeed * 0.5;
    }

    // Friction on ground
    state.speed *= Math.pow(0.95, dt * 60);
    state.climbRate = 0;

    // Check for runway landing
    const runway = terrain.runway;
    if (runway && runway.onRunway(state.x, state.y, runway.width / 2)) {
      state.onRunway = true;
    }
  } else {
    state.onGround = false;
    state.onRunway = false;
  }

  // --- Fuel consumption ---
  const fuelBurn = PLANE.fuelBurnRate * state.throttle * (rho / 1.225) * dt;
  state.fuel = Math.max(0, state.fuel - fuelBurn);

  if (state.fuel <= 0) {
    state.engineRunning = false;
    state.throttle = 0;
  }

  // --- Damage ---
  if (state.damage > 0) {
    state.damage = Math.max(0, state.damage - dt * 0.5); // Slow repair
  }
  if (state.damage >= 100) {
    state.engineRunning = false;
    state.damage = 100;
  }

  // --- G-force damage ---
  if (state.gForce > GAMEPLAY.gLimit) {
    state.damage += (state.gForce - GAMEPLAY.gLimit) * 5 * dt;
  }

  // World bounds (wrap)
  const halfWorld = WORLD_SIZE;
  if (state.x > halfWorld) state.x -= halfWorld * 2;
  if (state.x < -halfWorld) state.x += halfWorld * 2;
  if (state.y > halfWorld) state.y -= halfWorld * 2;
  if (state.y < -halfWorld) state.y += halfWorld * 2;

  return {
    stalled: state.stalled,
    stallWarning,
    onGround: state.onGround,
    onRunway: state.onRunway,
    impactSpeed: state.onGround ? Math.sqrt(state.climbRate ** 2 + state.speed ** 2 * 0.1) : 0,
    agl,
    groundHeight,
  };
}

/** Check if landing is successful */
export function checkLanding(state, terrain) {
  if (!state.onGround || !state.onRunway) return { success: false, reason: 'Not on runway' };

  const runway = terrain.runway;
  const np = runway.nearestPoint(state.x, state.y);

  const descentOK = Math.abs(state.climbRate) <= GAMEPLAY.landingMaxDescentRate;
  const speedOK = state.speed <= GAMEPLAY.landingMaxSpeed;
  const bankOK = Math.abs(state.roll) * 180 / Math.PI <= GAMEPLAY.landingMaxBank;
  const alignedOK = Math.abs(np.distPerp) <= runway.width * 0.3;
  const headingOK = Math.abs(headingDiff(state.heading, runway.heading)) < Math.PI / 4;

  const success = descentOK && speedOK && bankOK && alignedOK && headingOK;

  return {
    success,
    descentRate: state.climbRate,
    speed: state.speed,
    bankAngle: state.roll * 180 / Math.PI,
    offset: np.distPerp,
    headingDiff: headingDiff(state.heading, runway.heading) * 180 / Math.PI,
    reason: success ? 'Perfect landing!' : 'Landing criteria not met',
  };
}

/** Heading difference normalized to [-PI, PI] */
function headingDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}