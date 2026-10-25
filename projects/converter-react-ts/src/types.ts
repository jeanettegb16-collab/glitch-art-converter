// ══════════════════════════════════════════════════════════════════
// TYPES — mirrored from the original converter with minor React idioms
// ══════════════════════════════════════════════════════════════════

export interface Effects {
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
  sepia: number;
  grayscale: number;
  invert: number;
  posterize: number;
  threshold: number;
}

export interface GlyphCfg {
  cols: number;
  charset: number;
  color: string;
  glow: number;
  spread: number;
  contrast: number;
  brightness: number;
  gamma: number;
  sat: number;
  edge: number;
  dither: number;
  mirror: number;
}

export interface PixelCfg {
  block: number;
  palette: string;
  contrast: number;
  brightness: number;
  sat: number;
  dither: number;
  edge: number;
  grid: number;
  scan: number;
  noise: number;
}

export interface GlitchCfg {
  on: boolean;
  before: boolean;
  amt: number;
  spd: number;
  freq: number;
  fx: Record<string, number>;
  pg: { on: string[]; amt: number; seed: number; st: boolean };
  streakCol: 'analog' | 'phos';
}

export interface TextAnim {
  kind: string;
  dur: number;
  delay: number;
  ease: string;
  loop: boolean;
  hold: number;
  outKind: string;
  outDur: number;
  gap: number;
  seed: number;
}

export type LayerMode = 'glyph' | 'pixel' | 'image';

export type Layer =
  | { id: number; type: 'image'; name: string; visible: boolean; opacity: number; mode: LayerMode; inRoll: boolean; src?: string; _img?: HTMLImageElement | null; glyphCfg: GlyphCfg; pixelCfg: PixelCfg; effects: Effects; gl: GlitchCfg; trans: { style: string; dur: number; hold: number } }
  | { id: number; type: 'text'; name: string; visible: boolean; opacity: number; inRoll: boolean; content: string; size: number; color: string; x: number; y: number; align: string; anim: TextAnim; glow: number; effects: Effects; gl: GlitchCfg };

export interface AppState {
  layers: Layer[];
  selected: number;
  glitch: Omit<GlitchCfg, 'fx' | 'pg' | 'streakCol'> & { on: boolean };
  roll: { cur: number; nextSwap: number; on: boolean; style: string; every: number; dur: number };
  export: { fmt: 'webm' | 'gif' | 'apng' | 'zip'; frames: number; secs: number; width: number; bps: number; swapAt: number };
  ui: { color: string; glow: number; outName: string };
  canvas: { aspect: string };
}

export type Action =
  | { type: 'ADD_IMAGE'; image: HTMLImageElement; name?: string }
  | { type: 'ADD_TEXT'; text?: string }
  | { type: 'DELETE_LAYER' }
  | { type: 'SELECT_LAYER'; index: number }
  | { type: 'MOVE_LAYER'; direction: 'up' | 'down' }
  | { type: 'TOGGLE_VISIBLE'; id: number }
  | { type: 'UPDATE_LAYER'; id: number; patch: Partial<Layer> }
  | { type: 'UPDATE_EFFECTS'; id: number; patch: Partial<Effects> }
  | { type: 'SET_GLITCH_GLOBAL'; patch: Partial<AppState['glitch']> }
  | { type: 'SET_ROLL'; patch: Partial<AppState['roll']> }
  | { type: 'SET_EXPORT'; patch: Partial<AppState['export']> }
  | { type: 'SET_UI'; patch: Partial<AppState['ui']> }
  | { type: 'LOAD_PROJECT'; state: AppState }
  | { type: 'RESET_TIMELINE' };
