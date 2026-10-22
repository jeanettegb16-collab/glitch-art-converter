import type { Layer, ImageLayer } from '../types';
import { mkCv, imgKey } from '../utils/canvas';
import { defaultLight } from '../state/defaults';
import { state } from '../state/store';
import { renderGlyphs, setViewK, getFontRatio, resetFontRatio } from './glyph';
import { renderPixels } from './pixel';
import { renderTextLayer } from './text';
import { applyLayerEffects, lightSource } from './effects';
import { glitchBuffer } from './glitch';

// Font epoch — when the web font loads, drop cached glyph buffers
let _fontEpoch = 0;
export function getFontEpoch(): number { return _fontEpoch; }
export function bumpFontEpoch(): void { _fontEpoch++; resetFontRatio(); }

// Layer buffer cache: {buf, sig} per layer id
interface CacheEntry {
  buf: HTMLCanvasElement;
  sig: string | null;
}
const _lbCache = new Map<number, CacheEntry>();

/**
 * Render one layer into an offscreen buffer (cached when nothing changes).
 * Image layers are cached by a signature of all relevant config + the image key.
 * Text layers are redrawn every frame (they animate).
 */
export function renderLayerToBuffer(L: Layer, W: number, H: number, t: number): HTMLCanvasElement {
  let e = _lbCache.get(L.id);
  if (!e || e.buf.width !== W || e.buf.height !== H) {
    e = { buf: mkCv(W, H), sig: null };
    _lbCache.set(L.id, e);
  }
  const buf = e.buf;
  let sig: string | null = null;

  if (L.type === 'image') {
    if (!L._img) return buf;
    if (!L.light) L.light = defaultLight();
    sig = JSON.stringify([
      L.mode,
      L.mode === 'glyph' ? L.glyphCfg : L.mode === 'pixel' ? L.pixelCfg : 0,
      L.light, L.effects, imgKey(L._img), _fontEpoch,
    ]);
    if (e.sig === sig) return buf;
  }

  const c = buf.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  c.shadowBlur = 0;
  c.clearRect(0, 0, W, H);

  if (L.type === 'image') {
    const im = L._img!;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const sc = Math.min(W / iw, H / ih);
    const fw = Math.max(1, Math.round(iw * sc)), fh = Math.max(1, Math.round(ih * sc));
    const fx = Math.round((W - fw) / 2), fy = Math.round((H - fh) / 2);
    const lightInPixels = L.mode === 'pixel' && L.light.on;
    const SRC = L.light.on && !lightInPixels ? lightSource(L) : im;

    const draw = (cx2: CanvasRenderingContext2D) => {
      if (L.mode === 'glyph') renderGlyphs(SRC, L.glyphCfg, cx2, fw, fh);
      else if (L.mode === 'pixel') renderPixels(SRC, L.pixelCfg, cx2, fw, fh, lightInPixels ? L.light : null);
      else { cx2.imageSmoothingEnabled = true; cx2.imageSmoothingQuality = 'high'; cx2.drawImage(SRC, 0, 0, fw, fh); }
    };

    if (fw === W && fh === H && !fx && !fy) draw(c);
    else { const tmp = mkCv(fw, fh); draw(tmp.getContext('2d')!); c.drawImage(tmp, fx, fy); }
  } else {
    renderTextLayer(L, W, H, t, c);
  }

  if (L.effects) applyLayerEffects(buf, L.effects);
  e.sig = sig;

  // GC stale entries
  if (_lbCache.size > state.layers.length + 2) {
    for (const id of [..._lbCache.keys()]) {
      if (!state.layers.some(l => l.id === id)) _lbCache.delete(id);
    }
  }

  return buf;
}

/** Render a layer to buffer, then apply glitch → the final per-layer frame. */
export function layerFrame(L: Layer, W: number, H: number, t: number): HTMLCanvasElement {
  return glitchBuffer(L, renderLayerToBuffer(L, W, H, t), t);
}
