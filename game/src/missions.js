/** Kestrel Skies - Mission System */

import { MISSIONS, GAMEPLAY } from './config.js';
import { generateRings, checkRingPass, getRingProgress, resetRings, calculateTotalRingScore } from './rings.js';
import { checkLanding } from './flight.js';

/** Mission state */
export class Mission {
  constructor(id, terrain, seed = 12345) {
    this.id = id;
    this.config = MISSIONS[id];
    this.terrain = terrain;
    this.seed = seed;

    this.state = 'briefing'; // 'briefing', 'active', 'completed', 'failed', 'landed'
    this.startTime = 0;
    this.endTime = 0;
    this.elapsedTime = 0;

    this.rings = generateRings(id, terrain, seed);
    this.currentRingIndex = 0;
    this.checkpointsPassed = 0;
    this.totalScore = 0;
    this.ringScores = [];

    this.objectiveText = this.getInitialObjective();
    this.messages = [];
    this.messageTimer = 0;

    // Wind for this mission
    this.wind = { x: 0, y: 0 };
    this.generateWind();
  }

  /** Generate mission-specific wind */
  generateWind() {
    const strength = this.config.windStrength;
    if (strength > 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wind.x = Math.cos(angle) * strength;
      this.wind.y = Math.sin(angle) * strength;
    }
  }

  /** Get initial objective text */
  getInitialObjective() {
    switch (this.id) {
      case 'ringCircuit':
        return `RING CIRCUIT - Ring 1 of ${this.config.ringCount}`;
      case 'volcanoMailRun':
        return `VOLCANO MAIL RUN - Checkpoint 1 of ${this.config.checkpointCount}`;
      case 'stormPatrol':
        return `STORM PATROL - Ring 1 of ${this.config.ringCount}`;
      default:
        return 'MISSION START';
    }
  }

  /** Start the mission */
  start() {
    this.state = 'active';
    this.startTime = performance.now() / 1000;
    this.elapsedTime = 0;
    this.addMessage('Mission started. Good luck!', 3);
  }

  /** Update mission state */
  update(state, dt) {
    if (this.state !== 'active') return;

    this.elapsedTime = (performance.now() / 1000) - this.startTime;

    // Update message timer
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
    }

    // Check time limit
    if (this.elapsedTime > this.config.timeLimit) {
      this.fail('Time limit exceeded!');
      return;
    }

    // Check fuel
    if (state.fuel <= 0 && state.altitude > this.terrain.getHeightAt(state.x, state.y) + 50) {
      this.fail('Fuel exhausted!');
      return;
    }

    // Mission-specific logic
    switch (this.id) {
      case 'ringCircuit':
        this.updateRingCircuit(state, dt);
        break;
      case 'volcanoMailRun':
        this.updateVolcanoMailRun(state, dt);
        break;
      case 'stormPatrol':
        this.updateStormPatrol(state, dt);
        break;
    }
  }

  /** Ring Circuit: pass all rings in order */
  updateRingCircuit(state, dt) {
    const progress = getRingProgress(this.rings);
    this.currentRingIndex = progress.passed;
    this.objectiveText = `RING CIRCUIT - Ring ${progress.passed + 1} of ${this.config.ringCount}`;

    if (progress.next) {
      if (checkRingPass(state, progress.next, dt)) {
        this.checkpointsPassed++;
        const score = 1000 + Math.max(0, 500 - this.elapsedTime * 2);
        this.ringScores.push(score);
        this.totalScore += score;
        this.addMessage(`Ring ${progress.passed} passed! +${score}`, 2);

        if (progress.passed >= this.config.ringCount) {
          this.complete('All rings cleared!');
        }
      }
    }
  }

  /** Volcano Mail Run: checkpoints + landing */
  updateVolcanoMailRun(state, dt) {
    const progress = getRingProgress(this.rings);
    this.currentRingIndex = progress.passed;

    if (progress.next) {
      this.objectiveText = `VOLCANO MAIL RUN - Checkpoint ${progress.passed + 1} of ${this.config.checkpointCount}`;
      if (checkRingPass(state, progress.next, dt)) {
        this.checkpointsPassed++;
        const score = 1500 + Math.max(0, 300 - this.elapsedTime);
        this.ringScores.push(score);
        this.totalScore += score;
        this.addMessage(`Checkpoint ${progress.passed} reached! +${score}`, 2);

        if (progress.passed >= this.config.checkpointCount) {
          this.objectiveText = 'VOLCANO MAIL RUN - Return to base and LAND';
        }
      }
    } else {
      // All checkpoints done - need to land
      this.objectiveText = 'VOLCANO MAIL RUN - Land on the runway';

      const landing = checkLanding(state, this.terrain);
      if (landing.success) {
        const landingBonus = 5000;
        this.totalScore += landingBonus;
        this.addMessage(`Perfect landing! +${landingBonus}`, 3);
        this.complete('Mail delivered successfully!');
      } else if (state.onGround && state.onRunway) {
        this.addMessage(`Landing failed: ${landing.reason}`, 3);
      }
    }
  }

  /** Storm Patrol: rings in wind, low fuel */
  updateStormPatrol(state, dt) {
    const progress = getRingProgress(this.rings);
    this.currentRingIndex = progress.passed;
    this.objectiveText = `STORM PATROL - Ring ${progress.passed + 1} of ${this.config.ringCount}`;

    if (progress.next) {
      if (checkRingPass(state, progress.next, dt)) {
        this.checkpointsPassed++;
        const score = 1200 + Math.max(0, 400 - this.elapsedTime * 3);
        this.ringScores.push(score);
        this.totalScore += score;
        this.addMessage(`Ring ${progress.passed} cleared! +${score}`, 2);

        if (progress.passed >= this.config.ringCount) {
          this.complete('Storm patrol complete!');
        }
      }
    }
  }

  /** Complete mission successfully */
  complete(message) {
    this.state = 'completed';
    this.endTime = performance.now() / 1000;
    this.addMessage(message, 5);
    this.addMessage(`Final Score: ${this.totalScore}`, 5);
  }

  /** Fail mission */
  fail(message) {
    this.state = 'failed';
    this.endTime = performance.now() / 1000;
    this.addMessage(`MISSION FAILED: ${message}`, 5);
    this.addMessage(`Score: ${this.totalScore}`, 5);
  }

  /** Add a timed message */
  addMessage(text, duration = 3) {
    this.messages.push({ text, time: this.elapsedTime, duration });
    this.messageTimer = duration;
  }

  /** Get current messages */
  getMessages() {
    return this.messages.filter(m => this.elapsedTime - m.time < m.duration);
  }

  /** Get wind for flight model */
  getWind() {
    return this.wind;
  }

  /** Get time remaining */
  getTimeRemaining() {
    return Math.max(0, this.config.timeLimit - this.elapsedTime);
  }

  /** Get fuel multiplier for this mission */
  getFuelMultiplier() {
    return this.config.fuelMultiplier;
  }

  /** Reset mission for retry */
  reset() {
    this.state = 'briefing';
    this.startTime = 0;
    this.endTime = 0;
    this.elapsedTime = 0;
    this.currentRingIndex = 0;
    this.checkpointsPassed = 0;
    this.totalScore = 0;
    this.ringScores = [];
    this.messages = [];
    this.messageTimer = 0;
    resetRings(this.rings);
    this.objectiveText = this.getInitialObjective();
    this.generateWind();
  }

  /** Get summary for end screen */
  getSummary() {
    return {
      mission: this.config.name,
      state: this.state,
      time: this.elapsedTime,
      score: this.totalScore,
      ringsPassed: this.checkpointsPassed,
      ringsTotal: this.rings.length,
      ringScores: this.ringScores,
    };
  }
}

/** Create mission by ID */
export function createMission(id, terrain, seed) {
  return new Mission(id, terrain, seed);
}

/** Get all mission IDs */
export function getMissionIds() {
  return Object.keys(MISSIONS);
}

/** Get mission config */
export function getMissionConfig(id) {
  return MISSIONS[id];
}