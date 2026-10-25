import { describe, it, expect } from 'vitest';
import { state } from '../state/store';
import { exportFps } from './timeline';
import { MIN_EXPORT_FPS, MAX_EXPORT_FPS } from '../constants';

describe('exportFps', () => {
  it('returns the default 15 fps when no layers exist', () => {
    const origLayers = [...state.layers];
    state.layers = [];
    // When m=0, `m || 15` gives 15, clamped to [MIN, MAX] = 15
    expect(exportFps()).toBe(15);
    state.layers = origLayers;
  });

  it('returns the maximum FPS for high-speed glitch settings', () => {
    const origLayers = [...state.layers];
    state.layers = [{ gl: { on: true, spd: 100 } } as any];
    expect(exportFps()).toBe(MAX_EXPORT_FPS);
    state.layers = origLayers;
  });

  it('returns the default 15 fps when glitch is off', () => {
    const origLayers = [...state.layers];
    state.layers = [{ gl: { on: false } } as any];
    expect(exportFps()).toBe(15);
    state.layers = origLayers;
  });

  it('clamps to the valid range for all spd values', () => {
    const origLayers = [...state.layers];
    for (let spd = 0; spd <= 100; spd += 5) {
      state.layers = [{ gl: { on: true, spd } } as any];
      const fps = exportFps();
      expect(fps).toBeGreaterThanOrEqual(MIN_EXPORT_FPS);
      expect(fps).toBeLessThanOrEqual(MAX_EXPORT_FPS);
    }
    state.layers = origLayers;
  });

  it('takes the maximum spd across all layers', () => {
    const origLayers = [...state.layers];
    state.layers = [
      { gl: { on: true, spd: 20 } } as any,
      { gl: { on: true, spd: 80 } } as any,
      { gl: { on: false } } as any,
    ];
    // 4 + 80 * 0.26 = 24.8 → rounds to 25
    expect(exportFps()).toBe(25);
    state.layers = origLayers;
  });
});
