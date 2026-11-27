/** Kestrel Skies - Input Handling */

import { INPUT } from './config.js';

/** Input state */
export const InputState = {
  pitch: 0,          // -1 to 1 (pull back = pitch up)
  roll: 0,           // -1 to 1 (left = roll left)
  throttleUp: false,
  throttleDown: false,
  gearToggle: false,
  flapsUp: false,
  flapsDown: false,
  cameraToggle: false,
  pause: false,
  mute: false,
  screenshot: false,
  mouseActive: false,
  mouseX: 0,
  mouseY: 0,
  touchActive: false,
  touchX: 0,
  touchY: 0,
  touchStartX: 0,
  touchStartY: 0,
};

/** Key state tracking */
const keysPressed = new Set();
const keysJustPressed = new Set();
const keysJustReleased = new Set();

/** Initialize input handlers */
export function initInput(canvas) {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (!keysPressed.has(code)) {
      keysJustPressed.add(code);
    }
    keysPressed.add(code);
    e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    keysPressed.delete(code);
    keysJustReleased.add(code);
  });

  // Mouse - drag for stick
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      InputState.mouseActive = true;
      InputState.mouseX = e.clientX;
      InputState.mouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (InputState.mouseActive) {
      InputState.mouseX = e.clientX;
      InputState.mouseY = e.clientY;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      InputState.mouseActive = false;
      canvas.style.cursor = 'default';
    }
  });

  // Prevent context menu
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      InputState.touchActive = true;
      const touch = e.touches[0];
      InputState.touchStartX = touch.clientX;
      InputState.touchStartY = touch.clientY;
      InputState.touchX = touch.clientX;
      InputState.touchY = touch.clientY;
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (InputState.touchActive && e.touches.length === 1) {
      const touch = e.touches[0];
      InputState.touchX = touch.clientX;
      InputState.touchY = touch.clientY;
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    InputState.touchActive = false;
  });

  canvas.addEventListener('touchcancel', (e) => {
    InputState.touchActive = false;
  });

  // Focus handling - reset on blur
  window.addEventListener('blur', () => {
    keysPressed.clear();
    keysJustPressed.clear();
    keysJustReleased.clear();
    InputState.mouseActive = false;
    InputState.touchActive = false;
  });
}

/** Update input state (call each frame) */
export function updateInput(dt) {
  // Clear transient states
  keysJustPressed.clear();
  keysJustReleased.clear();
  InputState.gearToggle = false;
  InputState.flapsUp = false;
  InputState.flapsDown = false;
  InputState.cameraToggle = false;
  InputState.pause = false;
  InputState.mute = false;
  InputState.screenshot = false;

  // Keyboard - Pitch (W/Up = pitch up/nose up)
  let pitch = 0;
  if (isKeyDown('ArrowUp') || isKeyDown('KeyW')) pitch -= 1;
  if (isKeyDown('ArrowDown') || isKeyDown('KeyS')) pitch += 1;
  InputState.pitch = pitch;

  // Keyboard - Roll (A/Left = roll left, D/Right = roll right)
  let roll = 0;
  if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) roll -= 1;
  if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) roll += 1;
  InputState.roll = roll;

  // Keyboard - Throttle (Shift = up, Ctrl = down)
  InputState.throttleUp = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
  InputState.throttleDown = isKeyDown('ControlLeft') || isKeyDown('ControlRight');

  // Other keys (just pressed)
  InputState.gearToggle = isJustPressed('KeyG');
  InputState.flapsUp = isJustPressed('KeyF');
  InputState.flapsDown = isJustPressed('KeyV');
  InputState.cameraToggle = isJustPressed('KeyC');
  InputState.pause = isJustPressed('Escape') || isJustPressed('KeyP');
  InputState.mute = isJustPressed('KeyM');
  InputState.screenshot = isJustPressed('F12');

  // Mouse stick input
  if (InputState.mouseActive) {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (InputState.mouseX - centerX) / (rect.width / 2);
    const dy = (InputState.mouseY - centerY) / (rect.height / 2);

    // Apply deadzone
    const deadzone = INPUT.mouse.deadzone;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > deadzone) {
      const factor = (dist - deadzone) / (1 - deadzone) * INPUT.mouse.sensitivity * 100;
      InputState.roll = clamp((dx / dist) * factor, -1, 1);
      InputState.pitch = clamp((dy / dist) * factor, -1, 1);
    }
  }

  // Touch stick input
  if (InputState.touchActive) {
    const dx = (InputState.touchX - InputState.touchStartX) / window.innerWidth;
    const dy = (InputState.touchY - InputState.touchStartY) / window.innerHeight;

    const deadzone = INPUT.touch.deadzone || 0.05;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > deadzone) {
      const factor = (dist - deadzone) / (1 - deadzone) * INPUT.touch.sensitivity * 100;
      InputState.roll = clamp((dx / dist) * factor, -1, 1);
      InputState.pitch = clamp((dy / dist) * factor, -1, 1);
    }
  }

  // Auto-center mouse/touch when released (handled by event listeners)
}

function isKeyDown(code) {
  return keysPressed.has(code);
}

function isJustPressed(code) {
  return keysJustPressed.has(code);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Get the canvas element (set after init) */
let canvas = null;
export function setCanvas(c) {
  canvas = c;
}

/** Get current input state for flight model */
export function getFlightInput() {
  return {
    pitch: InputState.pitch,
    roll: InputState.roll,
    throttleUp: InputState.throttleUp,
    throttleDown: InputState.throttleDown,
    gearToggle: InputState.gearToggle,
    flapsUp: InputState.flapsUp,
    flapsDown: InputState.flapsDown,
  };
}

/** Check if a key was just pressed (for UI) */
export function wasKeyPressed(code) {
  return keysJustPressed.has(code);
}

/** Get control scheme text for display */
export function getControlSchemeText() {
  return [
    'PITCH: ↑/W (up)  ↓/S (down)',
    'ROLL:  ←/A (left)  →/D (right)',
    'THROTTLE: Shift (↑)  Ctrl (↓)',
    'CAMERA: C  |  PAUSE: Esc/P  |  MUTE: M',
    'GEAR: G  |  FLAPS: F/V  |  SCREENSHOT: F12',
    'MOUSE: Drag = Stick  |  TOUCH: Drag = Stick',
  ];
}