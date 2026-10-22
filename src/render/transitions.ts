import { EXPORT_SEED, TR_NOISE_STEP, REF_HEIGHT } from '../constants';
import { mulberry, h01 } from '../utils/rng';
import { mkCv } from '../utils/canvas';
import { hexToRgb } from '../utils/color';

// ═════════════════════════════════════════════════════════════════════
// TRANSITIONS — visual effects when one image takes over from another.
// Deterministic per timeline step so preview == export.
// ═════════════════════════════════════════════════════════════════════

/** Auto-duration for a transition style (with optional RNG). */
export function autoDur(style: string, rng?: () => number): number {
  const R = rng || Math.random;
  switch (style) {
    case 'vroll': return 900 + R() * 500;
    case 'hslide': return 700 + R() * 350;
    case 'sync': return 950 + R() * 500;
    case 'blocks': return 750 + R() * 450;
    case 'crossfade': return 900 + R() * 400;
    case 'flash': return 520;
    case 'burst': return 620 + R() * 420;
    case 'hardcut': return 60;
    case 'peek': return 1100 + R() * 700;
    case 'subliminal': return 50 + R() * 100;
    case 'hold': return 1800 + R() * 1800;
    default: return 800;
  }
}

let _mixCv: HTMLCanvasElement | null = null;

/** Passive intrusion of image B through image A (continuous, per-tick). */
export function drawIntrusion(
  A: HTMLCanvasElement, B: HTMLCanvasElement,
  style: string, W: number, H: number, t: number,
  uiColor: string,
): HTMLCanvasElement {
  if (!_mixCv) _mixCv = mkCv(W, H);
  if (_mixCv.width !== W || _mixCv.height !== H) { _mixCv.width = W; _mixCv.height = H; }
  const f = _mixCv.getContext('2d')!;
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalAlpha = 1;
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, W, H);
  f.drawImage(A, 0, 0);

  const fi = Math.floor(t / 70), r = (k: number) => h01(fi, k);
  const s = H / REF_HEIGHT;
  const env = h01(Math.floor(t / 420), 7) > .68 ? 1 : .18;

  if (style === 'intrude') {
    const n = 2 + Math.floor(r(1) * 5);
    for (let i = 0; i < n; i++) {
      const sy = Math.floor(r(10 + i) * H);
      const sh = Math.max(3, Math.floor((8 + r(20 + i) * r(30 + i) * 95) * s));
      const dx = (r(40 + i) - .5) * env * W * .24;
      f.globalAlpha = .65 + .35 * r(50 + i);
      f.drawImage(B, 0, sy, W, sh, dx, sy, W, sh);
    }
    if (r(99) < .04) { f.globalAlpha = .35; f.drawImage(B, (r(98) - .5) * 6 * s, (r(97) - .5) * 6 * s); }
  } else {
    // ghost echo
    f.globalAlpha = .15 + r(2) * .10;
    f.drawImage(B, (r(3) - .5) * 4 * s, (r(4) - .5) * 4 * s);
  }
  f.globalAlpha = 1;
  return _mixCv;
}

/**
 * Blend two canvases A→B at progress p with the given transition style.
 * Returns a new canvas with the blended result.
 */
export function blendTransition(
  A: HTMLCanvasElement, B: HTMLCanvasElement,
  p: number, style: string,
  W: number, H: number, t: number,
  uiColor: string,
): HTMLCanvasElement {
  const F = mkCv(W, H), f = F.getContext('2d')!;
  const R = mulberry((((Math.floor(t / TR_NOISE_STEP) + 1) * 2654435761) ^ EXPORT_SEED) | 0);

  switch (style) {
    case 'vroll': {
      const ro = Math.round(p * H);
      f.drawImage(A, 0, ro);
      f.drawImage(B, 0, ro - H);
      f.fillStyle = '#040400';
      f.fillRect(0, ro - H * 0.03, W, H * 0.06);
      f.fillStyle = uiColor;
      f.globalAlpha = 0.6;
      f.fillRect(0, ro - 2, W, 2);
      f.globalAlpha = 1;
      break;
    }
    case 'hslide': {
      const xo = -Math.round(p * W);
      f.drawImage(A, xo, 0);
      f.drawImage(B, xo + W, 0);
      f.fillStyle = uiColor;
      f.globalAlpha = 0.7;
      f.fillRect(xo + W - 1, 0, 2, H);
      f.globalAlpha = 1;
      break;
    }
    case 'hardcut':
      f.drawImage(p < 0.5 ? A : B, 0, 0);
      break;
    case 'flash': {
      const peak = 1 - Math.abs(p - 0.5) * 2;
      f.drawImage(p < 0.5 ? A : B, 0, 0);
      f.globalCompositeOperation = 'lighter';
      f.globalAlpha = peak * 0.9;
      f.fillStyle = uiColor;
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'source-over';
      f.globalAlpha = 1;
      break;
    }
    case 'blocks': {
      const cols = 10, rows = 8, cw = Math.ceil(W / cols), chh = Math.ceil(H / rows);
      for (let by = 0; by < rows; by++) {
        for (let bx = 0; bx < cols; bx++) {
          const seed = ((bx * 73 + by * 151 + 7) * 2654435761) >>> 0;
          const thresh = seed / 4294967295;
          const src = p >= thresh ? B : A;
          f.drawImage(src, bx * cw, by * chh, cw, chh, bx * cw, by * chh, cw, chh);
        }
      }
      break;
    }
    case 'sync': {
      const y = Math.round(p * H);
      f.drawImage(B, 0, 0, W, y, 0, 0, W, y);
      f.drawImage(A, 0, y, W, H - y, 0, y, W, H - y);
      f.fillStyle = uiColor;
      f.globalAlpha = .9;
      f.fillRect(0, y - 4, W, 8);
      f.globalAlpha = 1;
      break;
    }
    case 'burst': {
      const drive = p < 0.5 ? { base: A, slices: B, k: p * 2 } : { base: B, slices: A, k: (1 - p) * 2 };
      f.drawImage(drive.base, 0, 0);
      const n = Math.floor(2 + drive.k * 18 + 8 * R());
      for (let i = 0; i < n; i++) {
        const sy = Math.floor(R() * H);
        const sh = Math.max(2, Math.floor(4 + R() * R() * 55));
        const dx = (R() - 0.5) * W * 0.18;
        f.drawImage(drive.slices, 0, sy, W, sh, dx, sy, W, sh);
      }
      break;
    }
    case 'subliminal':
      f.drawImage(B, (R() - .5) * W * .02, 0);
      break;
    case 'peek':
    case 'hold': {
      const edge = .14, k = p < edge ? 1 - p / edge : p > 1 - edge ? (p - (1 - edge)) / edge : 0;
      f.drawImage(B, 0, 0);
      const n = k > 0 ? Math.floor(2 + k * 16 + 6 * R()) : 0;
      for (let i = 0; i < n; i++) {
        const sy = Math.floor(R() * H), sh = Math.max(2, Math.floor(4 + R() * R() * 55));
        f.drawImage(A, 0, sy, W, sh, (R() - .5) * W * .18 * k, sy, W, sh);
      }
      break;
    }
    case 'crossfade':
    default:
      f.drawImage(A, 0, 0);
      f.globalAlpha = p;
      f.drawImage(B, 0, 0);
      f.globalAlpha = 1;
  }

  return F;
}
