// ══════════════════════════════════════════════════════════════════
// DETERMINISM TEST — the core claim of the project:
// "Same timeline position → same pixels, in preview and export."
//
// The pipeline's determinism rests on three pillars:
// 1. Seeded PRNG (mulberry32) → same random choices every time
// 2. Hash-based per-cell noise (h01) → same noise pattern  
// 3. Deterministic colour quantisation (medianCut) + nearest-neighbour lookup
//
// We test the pure components here (no Canvas 2D needed).
// The canvas operations themselves are standard browser APIs with
// no internal randomness — once seeded, the outputs are fixed.
// ══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { h01, mulberry, seedFor } from '../utils/rng';
import { medianCut, nearestColorIdx } from '../utils/color';

describe('Mulberry32 determinism', () => {
  it('produces identical sequences with the same seed', () => {
    const a = mulberry(42);
    const b = mulberry(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences with different seeds', () => {
    const a = mulberry(42);
    const b = mulberry(43);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('never returns NaN or outside [0,1)', () => {
    const r = mulberry(0xDEADBEEF);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('h01 determinism', () => {
  it('returns the same value for the same inputs', () => {
    expect(h01(1, 2)).toBe(h01(1, 2));
    expect(h01(0, 0)).toBe(h01(0, 0));
    expect(h01(999, 42)).toBe(h01(999, 42));
  });

  it('returns different values for different inputs', () => {
    expect(h01(1, 0)).not.toBe(h01(2, 0));
    expect(h01(1, 0)).not.toBe(h01(1, 1));
  });
});

describe('seedFor determinism', () => {
  it('produces the same seed for the same layer id', () => {
    expect(seedFor(1)).toBe(seedFor(1));
    expect(seedFor('layer-abc')).toBe(seedFor('layer-abc'));
  });

  it('produces different seeds for different ids', () => {
    expect(seedFor(1)).not.toBe(seedFor(2));
    expect(seedFor('a')).not.toBe(seedFor('b'));
  });

  it('always returns a 32-bit unsigned integer', () => {
    for (let i = 0; i < 10; i++) {
      const s = seedFor(i);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xFFFFFFFF);
    }
  });
});

describe('medianCut determinism', () => {
  it('returns identical results for identical input', () => {
    const pixels: number[] = [];
    for (let i = 0; i < 256; i++) pixels.push(i, i, i);
    const a = medianCut(pixels, 4);
    const b = medianCut(pixels, 4);
    expect(a).toEqual(b);
  });

  it('returns the requested number of colours', () => {
    const pixels = Array.from({ length: 1000 }, (_, i) => [i % 256, (i * 3) % 256, (i * 7) % 256]).flat();
    expect(medianCut(pixels, 8).length).toBe(8);
  });
});

describe('nearestColorIdx determinism', () => {
  it('returns the same index for the same RGB and palette', () => {
    const pal: [number, number, number][] = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
    expect(nearestColorIdx(10, 10, 10, pal)).toBe(nearestColorIdx(10, 10, 10, pal));
    expect(nearestColorIdx(255, 255, 255, pal)).toBe(1);
    expect(nearestColorIdx(250, 0, 0, pal)).toBe(2);
  });
});

describe('End-to-end seeded stream determinism', () => {
  it('replaying a glitch step produces identical RNG state', () => {
    const seed = seedFor(42);
    const r1 = mulberry(seed);
    const r2 = mulberry(seed);
    // Simulate one "glitch step" worth of random draws
    const draws = 50;
    const seq1 = Array.from({ length: draws }, () => r1());
    const seq2 = Array.from({ length: draws }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  it('h01 produces consistent per-pixel noise for the same coordinates', () => {
    const noise = (x: number, y: number, t: number) => h01(y * 1000 + x, t);
    const a = noise(10, 20, 55);
    const b = noise(10, 20, 55);
    const c = noise(11, 20, 55);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
