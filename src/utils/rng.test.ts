import { describe, it, expect } from 'vitest';
import { mulberry, h01, clamp01, seedFor, ease } from './rng';

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const a = mulberry(42);
    const b = mulberry(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different output for different seeds', () => {
    const a = mulberry(1);
    const b = mulberry(2);
    let diffs = 0;
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) diffs++;
    }
    expect(diffs).toBe(100);
  });

  it('always returns values in [0, 1)', () => {
    const r = mulberry(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('h01', () => {
  it('is deterministic', () => {
    expect(h01(1, 2)).toBe(h01(1, 2));
    expect(h01(0, 0)).toBe(h01(0, 0));
  });

  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = h01(i, i * 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different values for different inputs', () => {
    expect(h01(1, 0)).not.toBe(h01(2, 0));
  });
});

describe('clamp01', () => {
  it('clamps below 0', () => expect(clamp01(-1)).toBe(0));
  it('clamps above 1', () => expect(clamp01(2)).toBe(1));
  it('passes through in-range values', () => expect(clamp01(0.5)).toBe(0.5));
});

describe('seedFor', () => {
  it('is deterministic', () => {
    expect(seedFor('layer1')).toBe(seedFor('layer1'));
  });

  it('returns unsigned 32-bit integers', () => {
    for (let i = 0; i < 10; i++) {
      const s = seedFor(i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xFFFFFFFF);
      expect(Number.isInteger(s)).toBe(true);
    }
  });
});

describe('ease', () => {
  it('linear: f(0.5) = 0.5', () => {
    expect(ease('linear', 0.5)).toBeCloseTo(0.5);
  });
  it('in: f(0.5) = 0.25', () => {
    expect(ease('in', 0.5)).toBeCloseTo(0.25);
  });
  it('out: f(0.5) = 0.75', () => {
    expect(ease('out', 0.5)).toBeCloseTo(0.75);
  });
  it('clamps input to [0,1]', () => {
    expect(ease('in', -1)).toBe(0);
    expect(ease('in', 2)).toBe(1);
  });
});
