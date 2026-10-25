import { MIN_EXPORT_FPS, MAX_EXPORT_FPS, TL_MAX_DT, ROLL_SEED } from '../constants';
import { mulberry } from '../utils/rng';
import { state, rollLayers } from '../state/store';
import { $ } from '../utils/canvas';
import { syncOn } from './compositor';
import { composeFrame } from './compositor';
import { autoDur } from './transitions';
import { TEMP_STYLES, PASSIVE_STYLES } from '../constants';

export type { ExportTiming } from '../types';

// ═════════════════════════════════════════════════════════════════════
// TIMELINE — one clock for everything animated.
// The preview plays it; the exporter samples it offline;
// both reset from the same start, so a frame at time t is identical.
// ═════════════════════════════════════════════════════════════════════

export let TL = 0;
export function getTL(): number { return TL; }
export function setTL(v: number): void { TL = v; }

let _lastNow = performance.now();
export function getLastNow(): number { return _lastNow; }
export function setLastNow(v: number): void { _lastNow = v; }

export function exportTiming() {
  const fmt = ($('animFmt') as HTMLSelectElement).value;
  let fps = exportFps(), dt = 1000 / fps, N: number;
  if (fmt === 'webm') N = Math.max(2, Math.round(+($('vidSecs') as HTMLInputElement).value * fps));
  else {
    N = +($('gifFrames') as HTMLInputElement).value;
    if (fmt === 'gif') { dt = Math.max(20, Math.round(dt / 10) * 10); fps = 1000 / dt; }
  }
  return { fmt, fps, dt, N, D: N * dt };
}

function rollHold(rl: ReturnType<typeof rollLayers>): number {
  const L = rl[state.roll.cur % rl.length];
  return ((L && L.trans && L.trans.hold > 0 ? L.trans.hold : state.roll.every) * 1000);
}

export function exportFps(): number {
  let m = 0;
  state.layers.forEach(L => { if (L.gl && L.gl.on) m = Math.max(m, 4 + L.gl.spd * .26); });
  return Math.max(MIN_EXPORT_FPS, Math.min(MAX_EXPORT_FPS, Math.round(m || 15)));
}

export function resetTimeline(keepCur = true, forExport = false): void {
  const r = state.roll;
  if (keepCur) r.startCur = r.cur;
  else r.cur = r.startCur || 0;
  r.transition = null;
  r.intr = 0;
  r.nextSwap = (forExport || syncOn()) ? -1 : 0;
  r.rng = mulberry(ROLL_SEED);
  TL = 0;
  state.layers.forEach(L => { L._gs = null; });
}

export function replayAnim(): void { resetTimeline(true); }

export function startRollTransition(now: number, t0?: number): void {
  const rl = rollLayers();
  if (rl.length < 2) return;
  const curIdx = state.roll.cur % rl.length;
  const cur = rl[curIdx];
  const next = rl[(curIdx + 1) % rl.length];

  // fixLayer is called at module init but just to be safe
  const T = next.trans;
  if (PASSIVE_STYLES.has(T.style || state.roll.style)) { state.roll.intr = (state.roll.intr || 0) + 1; return; }

  state.roll.transition = {
    fromId: cur.id, toId: next.id,
    t0: t0 != null ? t0 : TL,
    dur: 0, style: T.style || state.roll.style,
    keep: false,
  };
  const tr = state.roll.transition!;
  const temp = TEMP_STYLES.has(tr.style);
  tr.keep = temp;
  tr.dur = T.dur > 0 ? T.dur : (!temp && state.roll.dur > 0 ? state.roll.dur : autoDur(tr.style, state.roll.rng || undefined));
}

export function rollStep(t: number): void {
  const rl = rollLayers();
  if (rl.length > 1 && !state.roll.transition) {
    if (state.roll.nextSwap <= 0) {
      state.roll.nextSwap = t + (state.roll.nextSwap < 0 ? exportTiming().D * (+($('exSwapAt') as HTMLInputElement).value) / 100 : rollHold(rl));
    }
    if (state.roll.on !== false && t >= state.roll.nextSwap) {
      if (PASSIVE_STYLES.has(state.roll.style)) { state.roll.intr = (state.roll.intr || 0) + 1; state.roll.nextSwap = t + rollHold(rl); }
      else startRollTransition(t, t);
    }
  }
  if (state.roll.transition) {
    const tr = state.roll.transition;
    if (t >= tr.t0 + tr.dur) {
      if (!tr.keep) state.roll.cur = (state.roll.cur + 1) % rl.length;
      state.roll.transition = null;
      state.roll.nextSwap = t + rollHold(rl);
    }
  }
}

let _lastDimSig = '';

export function tick(): void {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dReal = now - _lastNow;
  _lastNow = now;
  if (state._exporting) return;

  if (!state.layers.length) {
    const cv = $('outCv') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const wrap = document.getElementById('outputWrap')!.getBoundingClientRect();
    const w = Math.max(64, Math.floor(wrap.width)), h = Math.max(64, Math.floor(wrap.height));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    ctx.fillStyle = '#040400';
    ctx.fillRect(0, 0, cv.width, cv.height);
    return;
  }

  TL += Math.min(dReal, TL_MAX_DT);
  if (syncOn() && TL >= exportTiming().D) resetTimeline(false);
  const t = TL;

  rollStep(t);
  composeFrame(t);

  const cv = $('outCv') as HTMLCanvasElement;
  const sig = cv.width + 'x' + cv.height;
  if (sig !== _lastDimSig) { _lastDimSig = sig; ($('dimInfo') as HTMLElement).textContent = sig; }
}
