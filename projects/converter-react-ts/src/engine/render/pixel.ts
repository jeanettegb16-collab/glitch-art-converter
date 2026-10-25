import type { PixelCfg, LightCfg } from '../types';
import { PALETTES } from '../constants';
import { hexToRgb, nearestColorIdx, medianCut, type RGB } from '../utils/color';
import { mkCv } from '../utils/canvas';
import { h01 } from '../utils/rng';
import { applyHardLight } from './effects';
import { VIEW_K } from './glyph';

// ═════════════════════════════════════════════════════════════════════
// PIXEL RENDER — image → blocky pixel art with optional palette + dithering
// ═════════════════════════════════════════════════════════════════════

/** Sample a palette from an image using median-cut quantisation. */
export function samplePalette(img: HTMLCanvasElement | HTMLImageElement, n: number): RGB[] {
  const sw = Math.min(img.width, 200), sh = Math.round(sw * img.height / img.width);
  const c = mkCv(sw, sh);
  c.getContext('2d')!.drawImage(img, 0, 0, sw, sh);
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, sw, sh).data;
  const total = sw * sh, step = Math.max(1, Math.floor(total / 8000));
  const pts: number[] = [];
  for (let i = 0; i < total; i += step) { const p = i * 4; if (d[p + 3] > 10) pts.push(d[p], d[p + 1], d[p + 2]); }
  return medianCut(pts, n);
}

/** Render an image as pixel art (blocky downscale + palette + dithering). */
export function renderPixels(
  src: HTMLCanvasElement | HTMLImageElement,
  cfg: PixelCfg,
  outCtx: CanvasRenderingContext2D,
  outW: number, outH: number,
  lc: LightCfg | null,
): { bx: number; by: number } {
  const bs = Math.max(1, cfg.block * VIEW_K);
  const bx = Math.max(1, Math.round(outW / bs)), by = Math.max(1, Math.round(outH / bs));
  const off = mkCv(bx, by);
  const c = off.getContext('2d', { willReadFrequently: true })!;
  c.filter = `contrast(${cfg.contrast / 10}) brightness(${1 + cfg.brightness / 100}) saturate(${cfg.sat / 10})`;
  c.drawImage(src, 0, 0, bx, by);
  c.filter = 'none';
  const d = c.getImageData(0, 0, bx, by).data;

  let palSrc: HTMLCanvasElement | HTMLImageElement = src;
  if (lc) {
    applyHardLight(d, bx, by, lc, Math.max(1, Math.round(Math.max(bx, by) / 80)), lc.clean > 0 ? Math.max(0, Math.round(lc.clean / 100 * 1.5)) : 0);
    const lit = mkCv(bx, by);
    lit.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(d), bx, by), 0, 0);
    palSrc = lit;
  }

  let pal: RGB[] | null = null;
  if (PALETTES[cfg.palette]) pal = PALETTES[cfg.palette].map(hexToRgb);
  else if (cfg.palette.startsWith('auto')) pal = samplePalette(palSrc, +cfg.palette.replace('auto', ''));

  const out = new Uint8ClampedArray(d);

  if (pal) {
    if (cfg.dither) {
      const buf = new Float32Array(d);
      for (let y = 0; y < by; y++) {
        for (let x = 0; x < bx; x++) {
          const idx = (y * bx + x) * 4;
          const r = Math.max(0, Math.min(255, buf[idx])), g = Math.max(0, Math.min(255, buf[idx + 1])), b = Math.max(0, Math.min(255, buf[idx + 2]));
          const [nr, ng, nb] = pal[nearestColorIdx(r, g, b, pal)];
          out[idx] = nr; out[idx + 1] = ng; out[idx + 2] = nb; out[idx + 3] = 255;
          const er = r - nr, eg = g - ng, eb = b - nb;
          [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]].forEach(([dx, dy, w]) => {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < bx && ny >= 0 && ny < by) { const ni = (ny * bx + nx) * 4; buf[ni] += er * w; buf[ni + 1] += eg * w; buf[ni + 2] += eb * w; }
          });
        }
      }
    } else {
      for (let i = 0; i < d.length; i += 4) {
        const [nr, ng, nb] = pal[nearestColorIdx(d[i], d[i + 1], d[i + 2], pal)];
        out[i] = nr; out[i + 1] = ng; out[i + 2] = nb; out[i + 3] = 255;
      }
    }
  }

  // Edge outline
  if (cfg.edge) {
    const L = (r: number, cc: number): number => { const j = (r * bx + cc) * 4; return out[j] * .299 + out[j + 1] * .587 + out[j + 2] * .114; };
    for (let y = 1; y < by - 1; y++) {
      for (let x = 1; x < bx - 1; x++) {
        const i = (y * bx + x) * 4;
        const diff = Math.abs(L(y, x) - L(y - 1, x)) + Math.abs(L(y, x) - L(y + 1, x)) + Math.abs(L(y, x) - L(y, x - 1)) + Math.abs(L(y, x) - L(y, x + 1));
        if (diff > 80) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; }
      }
    }
  }

  const srcCv = mkCv(bx, by);
  srcCv.getContext('2d')!.putImageData(new ImageData(out, bx, by), 0, 0);
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(srcCv, 0, 0, outW, outH);

  if (cfg.grid && bs >= 4) {
    outCtx.fillStyle = 'rgba(0,0,0,.35)';
    for (let x = 0; x < outW; x += bs) outCtx.fillRect(x, 0, 1, outH);
    for (let y = 0; y < outH; y += bs) outCtx.fillRect(0, y, outW, 1);
  }
  if (cfg.scan) {
    outCtx.fillStyle = 'rgba(0,0,0,.3)';
    for (let y = 0; y < outH; y += Math.max(2, bs >> 1)) outCtx.fillRect(0, y, outW, 1);
  }
  if (cfg.noise) {
    const nd = outCtx.getImageData(0, 0, outW, outH), dd = nd.data;
    for (let i = 0; i < dd.length; i += 4) { const n = (h01(i, 911) - .5) * 50; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; }
    outCtx.putImageData(nd, 0, 0);
  }

  return { bx, by };
}
