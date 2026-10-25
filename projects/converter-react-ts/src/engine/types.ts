// ═════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS — the contract for every module
// ═════════════════════════════════════════════════════════════════════

/** Per-layer CSS filter chain (GPU-accelerated). */
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

/** Glyph (ASCII) rendering configuration for an image layer. */
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
  hue: number;
  sharp: number;
  post: number;
  edge: number;
  dither: number;
  invert: number;
  mirror: number;
  vig: number;
  grain: number;
  scanR: number;
  colorFromImage: number;
}

/** Pixel-art rendering configuration for an image layer. */
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

/** Hard-light illumination configuration. */
export interface LightCfg {
  on: boolean;
  black: number;
  soft: number;
  tones: number;
  ceil: number;
  shade: number;
  detail: number;
  grain: number;
  clean: number;
}

/** Glitch effect flags. */
export interface GlitchFx {
  rgb: number;
  slice: number;
  rowshift: number;
  block: number;
  roll: number;
  noise: number;
  flick: number;
  wobble: number;
  rain: number;
  hold: number;
  streak: number;
  bars: number;
  smear: number;
}

/** Advanced pixel-stack glitch configuration. */
export interface PixelGlitchCfg {
  on: string[];
  amt: number;
  seed: number;
  st: boolean;
}

/** Full per-layer glitch configuration. */
export interface GlitchCfg {
  on: boolean;
  before: boolean;
  amt: number;
  spd: number;
  freq: number;
  fx: GlitchFx;
  pg: PixelGlitchCfg;
  streakCol: 'analog' | 'phos';
}

/** Roll-swap transition settings for a layer. */
export interface TransCfg {
  style: string;
  dur: number;
  hold: number;
}

/** Text animation configuration. */
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
  loops: number;
  unit: string;
  order: string;
  soft: number;
  seed: number;
  cursor: string;
}

/** Rendering mode for an image layer. */
export type LayerMode = 'glyph' | 'pixel' | 'image';

/** Base properties shared by all layer types. */
export interface BaseLayer {
  id: number;
  type: 'image' | 'text';
  name: string;
  visible: boolean;
  opacity: number;
  blend: GlobalCompositeOperation;
  inRoll: boolean;
  effects: Effects;
  gl: GlitchCfg;
  trans: TransCfg;
  _gs?: GlitchState | null;
  _broken?: boolean;
}

/** Image layer with glyph/pixel/image rendering modes. */
export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  _img: HTMLImageElement | null;
  mode: LayerMode;
  glyphCfg: GlyphCfg;
  pixelCfg: PixelCfg;
  light: LightCfg;
  // Runtime caches (not serialised)
  _lightCv?: HTMLCanvasElement | null;
  _lightKey?: string | null;
}

/** Text layer with animation. */
export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  size: number;
  color: string;
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
  anim: TextAnim;
  glow: number;
  track: number;
}

/** Union of all layer types. */
export type Layer = ImageLayer | TextLayer;

/** Roll-swap transition state. */
export interface RollTransition {
  fromId: number;
  toId: number;
  t0: number;
  dur: number;
  style: string;
  keep: boolean;
}

/** Roll-swap subsystem state. */
export interface RollState {
  cur: number;
  nextSwap: number;
  startCur: number;
  rng: (() => number) | null;
  on: boolean;
  style: string;
  every: number;
  dur: number;
  intr: number;
  transition: RollTransition | null;
}

/** Export subsystem state. */
export interface ExportState {
  fmt: 'webm' | 'gif' | 'apng' | 'zip';
  frames: number;
  secs: number;
  width: number;
  bps: number;
  gifColors: number;
  gifLossy: number;
  swapAt: number;
}

/** UI state. */
export interface UiState {
  color: string;
  glow: number;
  outName: string;
}

/** Canvas state. */
export interface CanvasState {
  aspect: string;
}

/** Master (global) glitch state. */
export interface MasterGlitchState {
  on: boolean;
  before: boolean;
  amt: number;
  spd: number;
  freq: number;
  fx: GlitchFx;
  pg: PixelGlitchCfg;
}

/** The single source of truth for the entire application. */
export interface AppState {
  layers: Layer[];
  selected: number;
  glitch: MasterGlitchState;
  roll: RollState;
  export: ExportState;
  ui: UiState;
  canvas: CanvasState;
  _exporting?: boolean;
}

/** Runtime glitch state per layer (step-based, seeded RNG). */
export interface GlitchState {
  step: number;
  rng: () => number;
  fn: number;
  nextBurst: number;
  burstEnd: number;
  roll: number;
  bars: Bar[];
  drops: Drop[] | null;
  out: HTMLCanvasElement | null;
  base: HTMLCanvasElement | null;
  gR: HTMLCanvasElement | null;
  gC: HTMLCanvasElement | null;
}

interface Bar {
  x: number;
  y: number;
  len: number;
  ttl: number;
  h: number;
  c: string;
}

interface Drop {
  on: boolean;
  y: number;
  v: number;
  l: number;
}

/** Glyph grid output from buildGlyphGrid. */
export interface GlyphGrid {
  cols: number;
  rows: number;
  lum: Float32Array;
  data: Uint8ClampedArray;
  charset: string;
}

/** Timing for export frame sampling. */
export interface ExportTiming {
  fmt: string;
  fps: number;
  dt: number;
  N: number;
  D: number;
}

/** Output format for an exported animation. */
export type ExportFormat = 'webm' | 'gif' | 'apng' | 'zip';
