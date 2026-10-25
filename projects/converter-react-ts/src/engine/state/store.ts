import type { AppState, Layer, ImageLayer, TextLayer } from '../types';
import { defaultGl } from './defaults';

let _lid = 1;
let _imgSeq = 1;

export const uid = (): number => _lid++;

/** The single source of truth. */
export const state: AppState = {
  layers: [],
  selected: -1,
  glitch: {
    on: true, before: false,
    amt: 50, spd: 50, freq: 40,
    fx: { rgb: 1, slice: 1, rowshift: 1, block: 1, roll: 0, noise: 1, flick: 1, wobble: 1, rain: 0, hold: 0, streak: 0, bars: 0, smear: 0 },
    pg: { on: [], amt: 5, seed: 42, st: false },
  },
  roll: {
    cur: 0, nextSwap: 0, startCur: 0, rng: null,
    on: true, style: 'burst', every: 5, dur: 0,
    intr: 0, transition: null,
  },
  export: { fmt: 'webm', frames: 40, secs: 6, width: 640, bps: 4, gifColors: 256, gifLossy: 0, swapAt: 40 },
  ui: { color: '#39ff14', glow: 130, outName: 'glitch-art' },
  canvas: { aspect: 'auto' },
};

/** Currently selected layer, or null. */
export function selLayer(): Layer | null {
  return state.layers[state.selected] || null;
}

/** Image layers participating in the roll swap. */
export function rollLayers(): ImageLayer[] {
  return state.layers.filter(l => l.type === 'image' && l.inRoll && l.visible) as ImageLayer[];
}

/** Create a new image layer. */
export function newImageLayer(img: HTMLImageElement, name?: string): ImageLayer {
  return {
    id: uid(), type: 'image', name: name || ('IMAGE ' + (++_imgSeq)),
    visible: true, opacity: 1, blend: 'source-over', inRoll: true,
    src: img.src, _img: img, mode: 'glyph',
    glyphCfg: { cols: 160, charset: 1, color: '#39ff14', glow: 10, spread: 1.5, contrast: 18, brightness: 0, gamma: 10, sat: 10, hue: 0, sharp: 0, post: 0, edge: 0, dither: 0, invert: 0, mirror: 0, vig: 0, grain: 0, scanR: 0, colorFromImage: 0 },
    pixelCfg: { block: 8, palette: 'full', contrast: 10, brightness: 0, sat: 10, dither: 0, edge: 0, grid: 0, scan: 0, noise: 0 },
    effects: { blur: 0, brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, invert: 0, posterize: 0, threshold: 0 },
    gl: defaultGl(true),
    trans: { style: '', dur: 0, hold: 0 },
    light: { on: false, black: 40, soft: 4, tones: 3, ceil: 56, shade: 30, detail: 45, grain: 0, clean: 35 },
    _gs: null, _lightCv: null, _lightKey: null,
  };
}

/** Create a new text layer. */
export function newTextLayer(txt?: string): TextLayer {
  return {
    id: uid(), type: 'text', name: 'TEXT ' + _lid,
    visible: true, opacity: 0.85, blend: 'lighter', inRoll: false,
    content: txt || 'HELLO', size: 64, color: '#39ff14',
    x: 0.5, y: 0.5, align: 'center',
    anim: { kind: 'fade', dur: 1400, delay: 200, ease: 'out', loop: false, hold: 2500, outKind: 'reverse', outDur: 900, gap: 500, loops: 0, unit: 'char', order: 'forward', soft: 0.35, seed: 7, cursor: 'off' },
    glow: 10, track: 0,
    effects: { blur: 0, brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, invert: 0, posterize: 0, threshold: 0 },
    gl: defaultGl(false),
    trans: { style: '', dur: 0, hold: 0 },
  };
}

/** Compute the canvas aspect ratio from project config or first image. */
export function canvasAspect(): number {
  const a = state.canvas.aspect;
  if (a && a !== 'auto') { const [x, y] = a.split(':').map(Number); return x / y; }
  const L = state.layers.find(l => l.type === 'image' && l._img) as ImageLayer | undefined;
  return L ? (L._img!.naturalWidth || L._img!.width) / (L._img!.naturalHeight || L._img!.height) : 16 / 9;
}
