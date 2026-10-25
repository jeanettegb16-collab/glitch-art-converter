import type { Layer, ImageLayer } from '../types';
import { REF_HEIGHT } from '../constants';
import { state, selLayer, rollLayers, canvasAspect } from '../state/store';
import { TEMP_STYLES, PASSIVE_STYLES } from '../constants';
import { $, mkCv } from '../utils/canvas';
import { setViewK } from './glyph';
import { layerFrame } from './layer-buffer';
import { blendTransition, drawIntrusion } from './transitions';

export type ViewMode = 'combined' | 'solo';
export let VIEW_MODE: ViewMode = 'combined';

export function setViewMode(m: ViewMode): void { VIEW_MODE = m; }
export function getViewMode(): ViewMode { return VIEW_MODE; }

export function syncOn(): boolean {
  const e = $('syncPrev') as HTMLInputElement | null;
  return !e || e.checked;
}

interface RollState {
  cur: ImageLayer;
  next: ImageLayer | null;
  tr: { fromId: number; toId: number; t0: number; dur: number; style: string; keep: boolean } | null;
  passive?: boolean;
}

export function getRollState(): RollState | null {
  const rl = rollLayers();
  if (!rl.length) return null;
  const curIdx = state.roll.cur % rl.length;
  const curL = rl[curIdx];
  const tr = state.roll.transition;
  if (tr) {
    const nextIdx = (curIdx + 1) % rl.length;
    return { cur: curL, next: rl[nextIdx], tr };
  }
  if (PASSIVE_STYLES.has(state.roll.style) && rl.length > 1) {
    const n = rl.length, off = 1 + ((state.roll.intr || 0) % (n - 1));
    return { cur: curL, next: rl[(curIdx + off) % n], tr: null, passive: true };
  }
  return { cur: curL, next: null, tr: null };
}

/**
 * Compose a single frame at time t onto the target canvas (or the main canvas).
 * When W0/H0 are provided, renders at that exact size (export mode).
 * Otherwise fits the project aspect ratio into the preview window.
 */
export function composeFrame(
  t: number, W0?: number, H0?: number, targetCv?: HTMLCanvasElement,
): void {
  let W: number, H: number;
  if (W0) { W = W0; H = H0!; }
  else {
    const wrap = document.getElementById('outputWrap')!.getBoundingClientRect();
    const A = canvasAspect();
    const mw = Math.max(64, Math.floor(wrap.width)), mh = Math.max(64, Math.floor(wrap.height));
    let fw, fh;
    if (mw / mh > A) { fh = mh; fw = Math.max(64, Math.floor(fh * A)); }
    else { fw = mw; fh = Math.max(64, Math.floor(fw / A)); }
    if (syncOn()) {
      W = Math.max(16, +($('gifW') as HTMLInputElement).value || 640);
      H = Math.max(16, Math.round(W / A));
      const cv = $('outCv') as HTMLCanvasElement;
      cv.style.width = fw + 'px';
      cv.style.height = fh + 'px';
    } else {
      W = fw; H = fh;
      const cv = $('outCv') as HTMLCanvasElement;
      cv.style.width = ''; cv.style.height = '';
    }
  }

  setViewK(H / REF_HEIGHT);
  const cvs = targetCv || $('outCv') as HTMLCanvasElement;
  const cxt = cvs.getContext('2d')!;
  if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
  cxt.clearRect(0, 0, W, H);
  cxt.fillStyle = '#040400';
  cxt.fillRect(0, 0, W, H);

  // Solo mode: just the selected layer
  if (!targetCv && !W0 && VIEW_MODE === 'solo') {
    const SL = selLayer();
    if (SL) {
      cxt.globalAlpha = 1;
      cxt.globalCompositeOperation = 'source-over';
      cxt.drawImage(layerFrame(SL, W, H, t), 0, 0);
    }
    return;
  }

  const rs = getRollState();
  const layerBufs = new Map<number, HTMLCanvasElement>();

  for (const L of state.layers) {
    if (!L.visible) continue;
    if (L.type === 'image' && L.inRoll) {
      if (rs && (L.id === rs.cur.id || (rs.next && L.id === rs.next.id))) {
        // computed for roll blend below
      } else continue;
    }
    layerBufs.set(L.id, layerFrame(L, W, H, t));
  }

  // Draw roll result first (bottom layer)
  if (rs) {
    let rollFrame: HTMLCanvasElement;
    if (rs.next && rs.tr) {
      const A = layerBufs.get(rs.cur.id) || layerFrame(rs.cur, W, H, t);
      const B = layerBufs.get(rs.next.id) || layerFrame(rs.next, W, H, t);
      const p = Math.min(1, (t - rs.tr.t0) / rs.tr.dur);
      rollFrame = blendTransition(A, B, p, rs.tr.style, W, H, t, state.ui.color);
    } else if (rs.passive) {
      const A = layerBufs.get(rs.cur.id) || layerFrame(rs.cur, W, H, t);
      const B = layerBufs.get(rs.next!.id) || layerFrame(rs.next!, W, H, t);
      rollFrame = drawIntrusion(A, B, state.roll.style, W, H, t, state.ui.color);
    } else {
      rollFrame = layerBufs.get(rs.cur.id) || layerFrame(rs.cur, W, H, t);
    }
    const own = rs.next && rs.tr && (t - rs.tr.t0) / rs.tr.dur >= .5 && !rs.tr.keep ? rs.next : rs.cur;
    cxt.globalAlpha = own.opacity;
    cxt.globalCompositeOperation = own.blend;
    cxt.drawImage(rollFrame, 0, 0);
  }

  // Then non-roll layers
  for (const L of state.layers) {
    if (!L.visible) continue;
    if (L.type === 'image' && L.inRoll) continue;
    const buf = layerBufs.get(L.id);
    if (!buf) continue;
    cxt.globalAlpha = L.opacity;
    cxt.globalCompositeOperation = L.blend;
    cxt.drawImage(buf, 0, 0);
  }
  cxt.globalAlpha = 1;
  cxt.globalCompositeOperation = 'source-over';
}
