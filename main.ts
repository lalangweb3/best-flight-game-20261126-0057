// THERMAL SOAR — make.fun bundle entry.
// Boots the game into the #game-canvas element.
import { bootGame } from './game/game.js';

export const THERMAL_SOAR_VERSION = '1.0.0';

// Debug handle for automated checks (screenshots, tests).
if (typeof window !== 'undefined') {
  (window as unknown as { __thermalSoarVersion?: string }).__thermalSoarVersion = THERMAL_SOAR_VERSION;
}

export function startThermalSoar(canvasId: string): void {
  bootGame(canvasId);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootGame('game-canvas'));
  } else {
    bootGame('game-canvas');
  }
}
