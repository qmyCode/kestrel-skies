/** Kestrel Skies - Seeded RNG (mulberry32) and hash helpers */

/**
 * Mulberry32 - fast, good quality seeded PRNG
 * @param {number} seed - 32-bit unsigned integer seed
 * @returns {() => number} Function returning next random float [0, 1)
 */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded RNG from a string seed (hashes the string)
 * @param {string} str - Seed string
 * @returns {() => number} RNG function
 */
export function rngFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return mulberry32(hash >>> 0);
}

/**
 * Create an RNG from a numeric seed
 * @param {number} seed - Numeric seed
 * @returns {() => number} RNG function
 */
export function rngFromNumber(seed) {
  return mulberry32(seed >>> 0);
}

/**
 * Random integer in [min, max] inclusive
 * @param {() => number} rng - RNG function
 * @param {number} min - Minimum (inclusive)
 * @param {number} max - Maximum (inclusive)
 * @returns {number}
 */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Random float in [min, max)
 * @param {() => number} rng - RNG function
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number}
 */
export function randFloat(rng, min, max) {
  return min + rng() * (max - min);
}

/**
 * Random element from array
 * @param {() => number} rng - RNG function
 * @param {Array} arr - Array to pick from
 * @returns {*} Random element
 */
export function randChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Random boolean with probability p
 * @param {() => number} rng - RNG function
 * @param {number} p - Probability of true [0, 1]
 * @returns {boolean}
 */
export function randBool(rng, p = 0.5) {
  return rng() < p;
}

/**
 * Gaussian/normal distribution via Box-Muller transform
 * @param {() => number} rng - RNG function
 * @param {number} mean - Mean (default 0)
 * @param {number} stdDev - Standard deviation (default 1)
 * @returns {number}
 */
export function randGaussian(rng, mean = 0, stdDev = 1) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Shuffle array in place (Fisher-Yates)
 * @param {() => number} rng - RNG function
 * @param {Array} arr - Array to shuffle
 * @returns {Array} The shuffled array (same reference)
 */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Hash a string to a 32-bit integer (FNV-1a)
 * @param {string} str - String to hash
 * @returns {number} 32-bit hash
 */
export function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Hash multiple values into a seed
 * @param {...(string|number)} args - Values to combine
 * @returns {number} Combined seed
 */
export function combineSeeds(...args) {
  let seed = 0x9e3779b9;
  for (const arg of args) {
    const val = typeof arg === 'string' ? hashString(arg) : (arg >>> 0);
    seed ^= val + 0x9e3779b9 + (seed << 6) + (seed >>> 2);
  }
  return seed >>> 0;
}

/**
 * Deterministic noise function (value noise)
 * @param {() => number} rng - RNG function (will be advanced)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} scale - Scale factor
 * @returns {number} Noise value [-1, 1]
 */
export function noise2D(rng, x, y, scale = 1) {
  // Simple value noise using hashed grid coordinates
  const x0 = Math.floor(x * scale);
  const y0 = Math.floor(y * scale);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = x * scale - x0;
  const sy = y * scale - y0;

  // Smoothstep
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);

  // Hash grid corners
  const h00 = (rngFromNumber(combineSeeds(x0, y0))() - 0.5) * 2;
  const h10 = (rngFromNumber(combineSeeds(x1, y0))() - 0.5) * 2;
  const h01 = (rngFromNumber(combineSeeds(x0, y1))() - 0.5) * 2;
  const h11 = (rngFromNumber(combineSeeds(x1, y1))() - 0.5) * 2;

  // Bilinear interpolation
  const a = h00 + (h10 - h00) * u;
  const b = h01 + (h11 - h01) * u;
  return a + (b - a) * v;
}

/**
 * Fractal Brownian Motion (fBm) noise
 * @param {() => number} rng - Base RNG
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} octaves - Number of octaves
 * @param {number} persistence - Amplitude decay per octave
 * @param {number} lacunarity - Frequency multiplier per octave
 * @returns {number} Noise value [-1, 1]
 */
export function fbm(rng, x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(rng, x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Create a deterministic RNG for a specific world feature
 * @param {number} worldSeed - World seed
 * @param {string} feature - Feature name
 * @returns {() => number} RNG for that feature
 */
export function featureRNG(worldSeed, feature) {
  return rngFromNumber(combineSeeds(worldSeed, feature));
}