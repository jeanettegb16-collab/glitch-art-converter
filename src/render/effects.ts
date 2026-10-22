import type { Effects, LightCfg } from '../types';
import { DEFAULT_GLOW, MAX_LIGHT_IMG_DIM } from '../constants';
import { h01 } from '../utils/rng';
import { mkCv, imgKey } from '../utils/canvas';

// ═════════════════════════════════════════════════════════════════════
// HARD LIGHT — crush shadows to black, flatten lit planes to capped grey,
// keep detail as crisp texture.
// ═════════════════════════════════════════════════════════════════════

/** Separable box blur on a Float32Array. Returns a new array. */
export function boxBlurF(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[o + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) { tmp[o + x] = acc * inv; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc * inv; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}

/**
 * HARD LIGHT core: RGBA data in, flat grey tones out (in place).
 * detailR / cleanR are blur radii in pixels of the current grid.
 */
export function applyHardLight(
  d: Uint8ClampedArray, w: number, h: number,
  lc: LightCfg, detailR: number, cleanR: number,
): void {
  const n = w * h, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) / 255;
  const blur = lc.detail > 0 ? boxBlurF(lum, w, h, detailR) : lum;
  const base = cleanR > 0 ? boxBlurF(boxBlurF(lum, w, h, cleanR), w, h, cleanR) : lum;
  const k = lc.detail / 100 * 3.2;
  const t = lc.black / 100, knee = lc.soft / 100 * .25;
  const N = Math.max(2, lc.tones | 0), ce = lc.ceil / 100, sh = lc.shade / 100, gr = lc.grain / 100;

  for (let i = 0; i < n; i++) {
    const l = base[i] + k * (base[i] - blur[i]);
    let m = knee > 0 ? Math.min(1, Math.max(0, (l - (t - knee)) / (2 * knee))) : (l >= t ? 1 : 0);
    m = m * m * (3 - 2 * m);
    let o = 0;
    if (m > 0) {
      let v = Math.min(1, Math.max(0, (l - t) / (1 - t + 1e-6)));
      v = Math.round(v * (N - 1)) / (N - 1);
      o = ce * ((1 - sh) + sh * v);
      if (gr > 0) o += (h01(i, 3) - .5) * gr * .3 * ce;
      o *= m;
    }
    const g = Math.max(0, Math.min(255, o * 255)) | 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g;
  }
}

interface LightCache {
  key: string;
  cv: HTMLCanvasElement | null;
}

const lightCaches = new Map<number, LightCache>();

/** Returns a canvas with the hard-lit version of a layer's source image (cached). */
export function lightSource(layer: {
  _img: HTMLImageElement | null;
  light: LightCfg;
  _lightCv?: HTMLCanvasElement | null;
  _lightKey?: string | null;
  id: number;
}): HTMLCanvasElement {
  const im = layer._img;
  if (!im) return mkCv(1, 1);
  const lc = { ...layer.light };
  const key = imgKey(im) + JSON.stringify(lc);
  if (layer._lightKey === key && layer._lightCv) return layer._lightCv;

  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const sc = Math.min(1, MAX_LIGHT_IMG_DIM / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * sc)), h = Math.max(1, Math.round(ih * sc));
  const c = mkCv(w, h), x = c.getContext('2d')!;
  x.drawImage(im, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h);
  applyHardLight(id.data, w, h, lc, Math.max(2, Math.round(Math.max(w, h) / 200)), Math.round(lc.clean / 100 * 4));
  x.putImageData(id, 0, 0);
  layer._lightCv = c;
  layer._lightKey = key;
  return c;
}

// ═════════════════════════════════════════════════════════════════════
// PER-LAYER EFFECTS — CSS filter chain (GPU-accelerated)
// ═════════════════════════════════════════════════════════════════════

export function applyLayerEffects(buffer: HTMLCanvasElement, fx: Effects): void {
  const c = buffer.getContext('2d')!;
  const W = buffer.width, H = buffer.height;
  const parts: string[] = [];
  if (fx.blur > 0) parts.push(`blur(${fx.blur}px)`);
  if (fx.brightness !== 1) parts.push(`brightness(${fx.brightness})`);
  if (fx.contrast !== 1) parts.push(`contrast(${fx.contrast})`);
  if (fx.saturate !== 1) parts.push(`saturate(${fx.saturate})`);
  if (fx.hue) parts.push(`hue-rotate(${fx.hue}deg)`);
  if (fx.sepia) parts.push(`sepia(${fx.sepia})`);
  if (fx.grayscale) parts.push(`grayscale(${fx.grayscale})`);
  if (fx.invert) parts.push(`invert(${fx.invert})`);

  if (parts.length) {
    const tmp = mkCv(W, H);
    const tc = tmp.getContext('2d')!;
    tc.filter = parts.join(' ');
    tc.drawImage(buffer, 0, 0);
    c.clearRect(0, 0, W, H);
    c.drawImage(tmp, 0, 0);
  }

  if (fx.posterize >= 2 || fx.threshold > 0) {
    const id = c.getImageData(0, 0, W, H), d = id.data;
    if (fx.posterize >= 2) {
      const step = 255 / (fx.posterize - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(Math.round(d[i] / step) * step);
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
      }
    }
    if (fx.threshold > 0) {
      const t = fx.threshold * 255;
      for (let i = 0; i < d.length; i += 4) {
        const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
        const v = l > t ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    c.putImageData(id, 0, 0);
  }
}

export { DEFAULT_GLOW };
