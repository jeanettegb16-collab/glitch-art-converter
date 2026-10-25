import type {
  Effects, GlyphCfg, PixelCfg, GlitchCfg, LightCfg, TextAnim, Layer,
  ImageLayer, TextLayer,
} from '../types';
import { ANIM_DEFAULT, LIGHT_PRESETS } from '../constants';

/** Fill missing keys in-place (preserves object references for UI binding). */
export function fillDefaults<T extends object>(obj: T, defs: object): T {
  for (const k in defs) if ((obj as any)[k] === undefined) (obj as any)[k] = (defs as any)[k];
  return obj;
}

export function defaultEffects(): Effects {
  return { blur: 0, brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, invert: 0, posterize: 0, threshold: 0 };
}

export function defaultGlyphCfg(): GlyphCfg {
  return { cols: 160, charset: 1, color: '#39ff14', glow: 10, spread: 1.5, contrast: 18, brightness: 0, gamma: 10, sat: 10, hue: 0, sharp: 0, post: 0, edge: 0, dither: 0, invert: 0, mirror: 0, vig: 0, grain: 0, scanR: 0, colorFromImage: 0 };
}

export function defaultPixelCfg(): PixelCfg {
  return { block: 8, palette: 'full', contrast: 10, brightness: 0, sat: 10, dither: 0, edge: 0, grid: 0, scan: 0, noise: 0 };
}

export function defaultLight(): LightCfg {
  return { on: false, black: 40, soft: 4, tones: 3, ceil: 56, shade: 30, detail: 45, grain: 0, clean: 35 };
}

export function defaultGl(on: boolean): GlitchCfg {
  return {
    on: !!on, before: false, amt: 50, spd: 50, freq: 40,
    fx: { rgb: 1, slice: 1, rowshift: 1, block: 1, roll: 0, noise: 1, flick: 1, wobble: 1, rain: 0, hold: 0, streak: 0, bars: 0, smear: 0 },
    pg: { on: [], amt: 5, seed: 42, st: false },
    streakCol: 'analog',
  };
}

export function normAnim(a: Partial<TextAnim> | null): TextAnim {
  return { ...ANIM_DEFAULT, ...(a || {}) };
}

/** Fix up a layer loaded from a legacy project: ensure all glitch/light/trans fields exist. */
export function fixLayer(L: Layer, globalGlitch?: GlitchCfg): void {
  const gl = L.gl;
  if (!gl) {
    const g = globalGlitch ? JSON.parse(JSON.stringify(globalGlitch)) : defaultGl(true);
    (L as ImageLayer | TextLayer).gl = { on: true, before: !!g.before, amt: g.amt, spd: g.spd, freq: g.freq, fx: g.fx, pg: g.pg, streakCol: g.streakCol || 'analog' };
  }
  L.gl.fx = fillDefaults(L.gl.fx || {} as any, defaultGl(true).fx) as any;
  L.gl.pg = fillDefaults(L.gl.pg || {} as any, { on: [], amt: 5, seed: 42, st: false }) as any;
  if (L.type === 'image') {
    L.light = fillDefaults(L.light || {} as any, defaultLight()) as any;
  }
  if (!L.gl.streakCol) L.gl.streakCol = 'analog';
  if (!L.trans) L.trans = { style: '', dur: 0, hold: 0 };
}

export { LIGHT_PRESETS };
