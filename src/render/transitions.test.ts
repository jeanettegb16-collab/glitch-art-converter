import { describe, it, expect } from 'vitest';
import { autoDur } from './transitions';

describe('autoDur', () => {
  // Test with a fixed RNG so we get deterministic results
  const rng = () => 0.5;

  it('returns 520ms for flash (no randomness)', () => {
    expect(autoDur('flash')).toBe(520);
  });

  it('returns 60ms for hardcut (no randomness)', () => {
    expect(autoDur('hardcut')).toBe(60);
  });

  it('returns deterministic values with fixed RNG', () => {
    const v1 = autoDur('vroll', rng);
    const v2 = autoDur('vroll', rng);
    expect(v1).toBe(v2);
    expect(v1).toBe(900 + 0.5 * 500); // 1150
  });

  it('returns values within expected ranges for all styles', () => {
    const rng = () => Math.random();
    for (let i = 0; i < 100; i++) {
      const style = ['vroll', 'hslide', 'sync', 'blocks', 'crossfade', 'flash', 'burst', 'hardcut', 'peek', 'subliminal', 'hold'][i % 11];
      const dur = autoDur(style, rng);
      expect(dur).toBeGreaterThan(0);
      expect(dur).toBeLessThan(5000);
    }
  });

  it('falls back to 800ms for unknown styles', () => {
    expect(autoDur('nonexistent-style')).toBe(800);
  });

  it('uses Math.random when no RNG is provided', () => {
    const v1 = autoDur('burst');
    const v2 = autoDur('burst');
    // With Math.random, two calls will almost certainly differ
    expect(v1).not.toBe(v2);
  });
});
