import { describe, it, expect } from 'vitest';
import { PALETTES, CHARSETS, CHARSET_NAMES, colorBtns, COLOR_SET } from './constants';

describe('PALETTES', () => {
  // The README says "13 palettes" referring to the named preset palettes.
  // Auto-palette variants (auto32/auto16/auto8/auto4) and "full" mode are separate features, not presets.
  it('has exactly 13 named preset palettes', () => {
    const presetKeys = Object.keys(PALETTES);
    expect(presetKeys.length).toBe(13);
  });

  it('has all expected preset keys', () => {
    const expected = ['pico8', 'cga', 'vboy', 'vapor', 'cyber', 'sepia', 'ice', 'gameboy', 'mono', 'crt', 'amber', 'nes', 'c64'];
    const actual = Object.keys(PALETTES);
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it('all palette values are arrays of valid hex color strings', () => {
    for (const [name, colors] of Object.entries(PALETTES)) {
      expect(Array.isArray(colors)).toBe(true);
      colors.forEach(c => {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    }
  });

  it('NES palette has 64 entries (standard NES palette)', () => {
    expect(PALETTES.nes.length).toBe(64);
  });
});

describe('CHARSETS', () => {
  it('has exactly 19 character sets matching the README count', () => {
    expect(CHARSETS.length).toBe(19);
    expect(CHARSET_NAMES.length).toBe(19);
  });

  it('each charset has a corresponding name', () => {
    CHARSETS.forEach((_, i) => {
      expect(CHARSET_NAMES[i]).toBeDefined();
      expect(typeof CHARSET_NAMES[i]).toBe('string');
      expect(CHARSET_NAMES[i]!.length).toBeGreaterThan(0);
    });
  });
});

describe('colorBtns', () => {
  it('marks the current color as active', () => {
    const html = colorBtns('#39ff14');
    expect(html).toContain('class="cbtn active"');
    expect(html).toContain('data-c="#39ff14"');
  });

  it('does not mark other colors as active', () => {
    const html = colorBtns('#39ff14');
    // The first button is #39ff14 and should be active, all others should not have 'active' class
    const nonActiveButtons = html.match(/class="cbtn(?! active)"/g);
    expect(nonActiveButtons).not.toBeNull();
    expect(nonActiveButtons!.length).toBe(COLOR_SET.length - 1);
  });

  it('passes extra attributes through', () => {
    const html = colorBtns('', 'data-ui="1"');
    expect(html).toContain('data-ui="1"');
  });
});
