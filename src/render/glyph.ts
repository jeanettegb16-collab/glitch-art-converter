import type { GlyphCfg, GlyphGrid } from '../types';
import { CHARSETS, MONO } from '../constants';
import { h01, clamp01 } from '../utils/rng';
import { mixWhite, hexToRgb } from '../utils/color';
import { mkCv } from '../utils/canvas';

// ═════════════════════════════════════════════════════════════════════
// GLYPH GRID — image → cells of luminance
// ═════════════════════════════════════════════════════════════════════

let _fontRatio: number | null = null;

/** Measure the aspect ratio (height/width) of the monospace font. */
export function getFontRatio(): number {
  if (_fontRatio) return _fontRatio;
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;visibility:hidden;font-family:var(--mono);font-size:100px;line-height:1;white-space:pre;';
  s.textContent = '█';
  document.body.appendChild(s);
  const r = s.getBoundingClientRect();
  document.body.removeChild(s);
  _fontRatio = r.height / r.width;
  return _fontRatio;
}

/** Reset font ratio (called when web font loads). */
export function resetFontRatio(): void { _fontRatio = null; }

/** Composition scale: canvas height / REF_HEIGHT — keeps sizes proportional at any resolution. */
export let VIEW_K = 1;
export function setViewK(k: number): void { VIEW_K = k; }

/**
 * Downsample an image to a grid of luminance values for ASCII conversion.
 * Applies contrast, gamma, edge detection, dithering, etc. per the config.
 */
export function buildGlyphGrid(src: HTMLCanvasElement | HTMLImageElement, cfg: GlyphCfg): GlyphGrid {
  const ratio = getFontRatio();
  const cols = Math.max(8, cfg.cols | 0);
  const rows = Math.max(1, Math.round((src.height / src.width) * cols / ratio));
  const off = mkCv(cols, rows);
  const c = off.getContext('2d', { willReadFrequently: true })!;

  let f = `contrast(${cfg.contrast / 10}) brightness(${1 + cfg.brightness / 100}) saturate(${cfg.sat / 10})`;
  if (cfg.hue) f += ` hue-rotate(${cfg.hue}deg)`;
  c.filter = f;
  if (cfg.mirror) { c.save(); c.scale(-1, 1); c.drawImage(src, -cols, 0, cols, rows); c.restore(); }
  else c.drawImage(src, 0, 0, cols, rows);
  c.filter = 'none';

  const d = c.getImageData(0, 0, cols, rows).data;

  // Gamma LUT
  if (Math.abs(cfg.gamma / 10 - 1) > 0.05) {
    const g = cfg.gamma / 10, lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.pow(i / 255, g) * 255);
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  }

  // Posterize
  if (cfg.post >= 2) {
    const step = 255 / (cfg.post - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(Math.round(d[i] / step) * step);
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
  }

  const lum = new Float32Array(cols * rows);

  // Edge detection (Sobel)
  if (cfg.edge) {
    const L = (y: number, x: number): number => { const i = (y * cols + x) * 4; return .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; };
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const gx = -L(y - 1, x - 1) + L(y - 1, x + 1) - 2 * L(y, x - 1) + 2 * L(y, x + 1) - L(y + 1, x - 1) + L(y + 1, x + 1);
        const gy = -L(y - 1, x - 1) - 2 * L(y - 1, x) - L(y - 1, x + 1) + L(y + 1, x - 1) + 2 * L(y + 1, x) + L(y + 1, x + 1);
        lum[y * cols + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    let m = 0;
    for (let i = 0; i < lum.length; i++) if (lum[i] > m) m = lum[i];
    if (m > 0) for (let i = 0; i < lum.length; i++) lum[i] = lum[i] / m * 255;
  } else {
    for (let i = 0; i < cols * rows; i++) { const p = i * 4; lum[i] = .299 * d[p] + .587 * d[p + 1] + .114 * d[p + 2]; }
  }

  // Vignette / grain / scanline reduction
  if (cfg.vig || cfg.grain || cfg.scanR) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let l = lum[i];
        if (cfg.vig) { const dx = x / cols - .5, dy = y / rows - .5; l *= 1 - Math.min(1, (dx * dx + dy * dy) * 2.2); }
        if (cfg.grain) l += (h01(i, 4242) - .5) * 60;
        if (cfg.scanR && y % 2) l *= .6;
        lum[i] = Math.max(0, Math.min(255, l));
      }
    }
  }

  const charset = CHARSETS[cfg.charset | 0];

  // Floyd-Steinberg dithering
  if (cfg.dither) {
    const step = 255 / (charset.length - 1), buf = new Float32Array(lum);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x, o = buf[idx], nw = Math.round(o / step) * step;
        buf[idx] = nw; const err = o - nw;
        if (x + 1 < cols) buf[idx + 1] += err * 7 / 16;
        if (y + 1 < rows) {
          if (x > 0) buf[idx + cols - 1] += err * 3 / 16;
          buf[idx + cols] += err * 5 / 16;
          if (x + 1 < cols) buf[idx + cols + 1] += err * 1 / 16;
        }
      }
    }
    lum.set(buf);
  }

  if (cfg.invert) for (let i = 0; i < lum.length; i++) lum[i] = 255 - lum[i];

  return { cols, rows, lum, data: d, charset };
}

let _glyphScratch: HTMLCanvasElement | null = null;

/** Render an image as ASCII glyphs onto outCtx. */
export function renderGlyphs(
  src: HTMLCanvasElement | HTMLImageElement,
  cfg: GlyphCfg,
  outCtx: CanvasRenderingContext2D,
  outW: number, outH: number,
): { cols: number; rows: number } {
  const { cols, rows, lum, data, charset } = buildGlyphGrid(src, cfg);
  const cw = outW / cols, ch = outH / rows, glow = cfg.glow, k = Math.min(3, glow / 10);

  if (!_glyphScratch) _glyphScratch = mkCv(outW, outH);
  const g = _glyphScratch;
  if (g.width !== outW || g.height !== outH) { g.width = outW; g.height = outH; }
  const gc = g.getContext('2d')!;
  gc.setTransform(1, 0, 0, 1, 0, 0);
  gc.clearRect(0, 0, outW, outH);
  gc.font = `${ch}px ${MONO}`;
  gc.textBaseline = 'top';
  const core = glow > 0 && !cfg.colorFromImage ? mixWhite(cfg.color, Math.min(.55, .12 + k * .08)) : cfg.color;
  gc.fillStyle = core;
  const n = charset.length - 1;

  for (let gy = 0; gy < rows; gy++) {
    const yo = gy * ch;
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      const c1 = charset[Math.max(0, Math.min(n, Math.round(lum[i] / 255 * n)))];
      if (c1 === ' ') continue;
      if (cfg.colorFromImage) {
        const p = i * 4, r = data[p], g2 = data[p + 1], b = data[p + 2], m = Math.max(r, g2, b);
        if (m < 8) continue;
        const kk = Math.min(3, 255 / m);
        gc.fillStyle = `rgb(${r * kk | 0},${g2 * kk | 0},${b * kk | 0})`;
      }
      gc.fillText(c1, gx * cw, yo);
    }
  }

  if (glow > 0) {
    const sp = Math.max(.4, cfg.spread);
    outCtx.save();
    outCtx.globalCompositeOperation = 'lighter';
    [[sp * 8 * VIEW_K, .12 + k * .2], [sp * 3.2 * VIEW_K, .25 + k * .25], [sp * 1.2 * VIEW_K, .5 + k * .2]].forEach(([r, a]) => {
      outCtx.filter = `blur(${r.toFixed(1)}px)`;
      outCtx.globalAlpha = Math.min(1, a);
      outCtx.drawImage(g, 0, 0);
    });
    outCtx.restore();
  }
  outCtx.drawImage(g, 0, 0);
  return { cols, rows };
}

/** Build a plain ASCII text string from the glyph grid. */
export function buildAsciiString(src: HTMLCanvasElement | HTMLImageElement, cfg: GlyphCfg): string {
  const { cols, rows, lum, charset } = buildGlyphGrid(src, cfg);
  let s = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = lum[y * cols + x];
      s += charset[Math.max(0, Math.min(charset.length - 1, Math.round(l / 255 * (charset.length - 1))))];
    }
    s += '\n';
  }
  return s;
}
