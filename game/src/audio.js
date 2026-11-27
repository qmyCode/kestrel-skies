/** Kestrel Skies - Tiny WebAudio Engine */

let audioContext = null;
let masterGain = null;
let isMuted = false;
let audioUnlocked = false;

/** Audio buffers */
const buffers = {
  wind: null,
  ringChime: null,
  engine: null,
  stall: null,
  crash: null,
};

/** Source nodes for looping sounds */
const sources = {
  wind: null,
  engine: null,
};

/** Initialize audio context (must be called on user interaction) */
export function initAudio() {
  if (audioContext) return audioContext;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0.3;

    // Generate sounds programmatically
    generateSounds();

    return audioContext;
  } catch (e) {
    console.warn('WebAudio not available:', e);
    return null;
  }
}

/** Unlock audio on first user interaction */
export function unlockAudio() {
  if (audioUnlocked || !audioContext) return;
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      audioUnlocked = true;
      // Restart looping sounds
      if (sources.wind) playWind();
      if (sources.engine) playEngine();
    });
  } else {
    audioUnlocked = true;
  }
}

/** Generate all sounds programmatically */
function generateSounds() {
  if (!audioContext) return;

  // Wind noise
  buffers.wind = createWindBuffer(2.0);

  // Ring chime
  buffers.ringChime = createChimeBuffer();

  // Engine hum
  buffers.engine = createEngineBuffer(3.0);

  // Stall warning
  buffers.stall = createStallBuffer();

  // Crash
  buffers.crash = createCrashBuffer();
}

/** Create wind noise buffer */
function createWindBuffer(duration) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Band-limited noise
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.1;
    b6 = white * 0.115926;
  }
  return buffer;
}

/** Create ring chime buffer */
function createChimeBuffer() {
  const sampleRate = audioContext.sampleRate;
  const duration = 1.5;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const freqs = [880, 1320, 1760, 2640]; // A5, E6, A6, E7
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 3);
    let sample = 0;
    for (const f of freqs) {
      sample += Math.sin(2 * Math.PI * f * t) * env * 0.2;
    }
    data[i] = sample;
  }
  return buffer;
}

/** Create engine hum buffer */
function createEngineBuffer(duration) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const baseFreq = 80; // Propeller frequency
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Harmonic series for propeller sound
    let sample = 0;
    for (let h = 1; h <= 8; h++) {
      sample += Math.sin(2 * Math.PI * baseFreq * h * t) * (1 / h) * 0.1;
    }
    // Add some noise
    sample += (Math.random() * 2 - 1) * 0.02;
    data[i] = sample * 0.3;
  }
  return buffer;
}

/** Create stall warning buffer */
function createStallBuffer() {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.5;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Warbling tone
    const freq = 440 + Math.sin(t * 30) * 100;
    const env = Math.sin(t * 10) > 0 ? 1 : 0; // Pulsing
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
  }
  return buffer;
}

/** Create crash buffer */
function createCrashBuffer() {
  const sampleRate = audioContext.sampleRate;
  const duration = 1.0;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 5);
    // Noise burst with filtering
    const noise = (Math.random() * 2 - 1);
    data[i] = noise * env * 0.5;
  }
  return buffer;
}

/** Play wind sound (loops) */
export function playWind(speed = 0) {
  if (!audioContext || !buffers.wind || isMuted) return;

  stopWind();

  const source = audioContext.createBufferSource();
  source.buffer = buffers.wind;
  source.loop = true;

  const gain = audioContext.createGain();
  gain.gain.value = Math.min(0.4, 0.05 + speed * 0.003);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.5;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start(0);
  sources.wind = { source, gain, filter };
}

/** Stop wind */
export function stopWind() {
  if (sources.wind) {
    try { sources.wind.source.stop(); } catch {}
    sources.wind = null;
  }
}

/** Update wind volume based on speed */
export function updateWind(speed) {
  if (sources.wind && sources.wind.gain) {
    sources.wind.gain.gain.value = Math.min(0.4, 0.05 + speed * 0.003);
    sources.wind.filter.frequency.value = 500 + speed * 20;
  }
}

/** Play engine sound (loops) */
export function playEngine(throttle = 0) {
  if (!audioContext || !buffers.engine || isMuted) return;

  stopEngine();

  const source = audioContext.createBufferSource();
  source.buffer = buffers.engine;
  source.loop = true;

  const gain = audioContext.createGain();
  gain.gain.value = 0.1 + throttle * 0.3;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300 + throttle * 500;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.playbackRate.value = 0.7 + throttle * 0.6;
  source.start(0);
  sources.engine = { source, gain, filter };
}

/** Stop engine */
export function stopEngine() {
  if (sources.engine) {
    try { sources.engine.source.stop(); } catch {}
    sources.engine = null;
  }
}

/** Update engine sound */
export function updateEngine(throttle, rpm = 1) {
  if (sources.engine) {
    if (sources.engine.gain) {
      sources.engine.gain.gain.value = 0.1 + throttle * 0.3;
    }
    if (sources.engine.filter) {
      sources.engine.filter.frequency.value = 300 + throttle * 500;
    }
    if (sources.engine.source) {
      sources.engine.source.playbackRate.value = 0.7 + throttle * 0.6;
    }
  }
}

/** Play ring chime */
export function playRingChime() {
  if (!audioContext || !buffers.ringChime || isMuted) return;

  const source = audioContext.createBufferSource();
  source.buffer = buffers.ringChime;

  const gain = audioContext.createGain();
  gain.gain.value = 0.4;

  source.connect(gain);
  gain.connect(masterGain);
  source.start(0);
}

/** Play stall warning */
export function playStallWarning() {
  if (!audioContext || !buffers.stall || isMuted) return;

  const source = audioContext.createBufferSource();
  source.buffer = buffers.stall;

  const gain = audioContext.createGain();
  gain.gain.value = 0.5;

  source.connect(gain);
  gain.connect(masterGain);
  source.start(0);
}

/** Play crash sound */
export function playCrash() {
  if (!audioContext || !buffers.crash || isMuted) return;

  const source = audioContext.createBufferSource();
  source.buffer = buffers.crash;

  const gain = audioContext.createGain();
  gain.gain.value = 0.6;

  source.connect(gain);
  gain.connect(masterGain);
  source.start(0);
}

/** Toggle mute */
export function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3;
  }
  return isMuted;
}

/** Set master volume */
export function setVolume(vol) {
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : Math.max(0, Math.min(1, vol));
  }
}

/** Check if muted */
export function isMutedState() {
  return isMuted;
}

/** Cleanup */
export function cleanupAudio() {
  stopWind();
  stopEngine();
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
    masterGain = null;
  }
}