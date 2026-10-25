import { describe, it, expect } from 'vitest';
import { hexToRgb, nearestColorIdx, medianCut, mixWhite } from './color';

describe('hexToRgb', () => {
  it('parses #39ff14', () => {
    expect(hexToRgb('#39ff14')).toEqual([0x39, 0xff, 0x14]);
  });
  it('parses #000000', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
  });
  it('parses #ffffff', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
  });
});

describe('nearestColorIdx', () => {
  it('finds exact match', () => {
    const pal: [number, number, number][] = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    expect(nearestColorIdx(255, 0, 0, pal)).toBe(0);
    expect(nearestColorIdx(0, 255, 0, pal)).toBe(1);
    expect(nearestColorIdx(0, 0, 255, pal)).toBe(2);
  });

  it('finds closest when not exact', () => {
    const pal: [number, number, number][] = [[0, 0, 0], [255, 255, 255]];
    expect(nearestColorIdx(10, 10, 10, pal)).toBe(0);
    expect(nearestColorIdx(200, 200, 200, pal)).toBe(1);
  });

  it('returns 0 for empty-ish palette edge case', () => {
    const pal: [number, number, number][] = [[128, 128, 128]];
    expect(nearestColorIdx(0, 0, 0, pal)).toBe(0);
  });
});

describe('medianCut', () => {
  it('produces the requested number of colours', () => {
    const pixels: number[] = [];
    for (let r = 0; r < 256; r += 32)
      for (let g = 0; g < 256; g += 32)
        for (let b = 0; b < 256; b += 32)
          pixels.push(r, g, b);
    const result = medianCut(pixels, 8);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach(c => {
      expect(c.length).toBe(3);
      expect(c[0]).toBeGreaterThanOrEqual(0);
      expect(c[0]).toBeLessThanOrEqual(255);
    });
  });

  it('handles small input', () => {
    const result = medianCut([255, 0, 0, 0, 255, 0], 2);
    expect(result.length).toBe(2);
  });
});

describe('mixWhite', () => {
  it('returns white when t=1', () => {
    expect(mixWhite('#000000', 1)).toBe('rgb(255,255,255)');
  });
  it('returns original when t=0', () => {
    expect(mixWhite('#39ff14', 0)).toBe('rgb(57,255,20)');
  });
});
