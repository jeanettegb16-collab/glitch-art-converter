import { state, canvasAspect } from '../state/store';
import { EXPORT_MEM_BUDGET, WEBM_QUEUE_MAX, MIN_EXPORT_FPS, MAX_EXPORT_FPS } from '../constants';
import { mkCv, $ } from '../utils/canvas';
import { saveBlob } from '../utils/file';
import { WebMMuxer, gifEncode, apngEncode, zipStore } from '../encoders/index';
import { nearestColorIdx, medianCut, type RGB } from '../utils/color';
import { resetTimeline, setTL, setLastNow, exportTiming, rollStep, getTL } from '../render/timeline';
import { composeFrame, setViewMode, getViewMode } from '../render/compositor';
import { setStatus } from '../main';

// ═════════════════════════════════════════════════════════════════════
// WebCodecs video session
// ═════════════════════════════════════════════════════════════════════

interface WebmSession {
  add(canvas: HTMLCanvasElement, i: number): Promise<void>;
  finish(): Promise<Blob>;
  abort(): void;
}

async function webmSession(W: number, H: number, fps: number, bps: number): Promise<WebmSession | null> {
  if (!window.VideoEncoder || !window.VideoFrame) return null;
  const config: VideoEncoderConfig = {
    codec: 'vp09.00.10.08', width: W, height: H, bitrate: bps, framerate: fps,
  };
  try {
    const sup = await VideoEncoder.isConfigSupported(config);
    if (!sup.supported) return null;
  } catch { return null; }

  const muxer = new WebMMuxer({ width: W, height: H, fps, codec: 'V_VP9' });
  let err: DOMException | null = null, closed = false;
  const enc = new VideoEncoder({
    output: chunk => muxer.addVideoChunk(chunk as any),
    error: (e: DOMException) => { err = e; },
  });
  try { enc.configure(config); } catch { return null; }

  const perFrame = 1e6 / fps;
  return {
    async add(canvas: HTMLCanvasElement, i: number) {
      if (err) throw err;
      const vf = new VideoFrame(canvas, { timestamp: Math.round(i * perFrame) });
      enc.encode(vf, { keyFrame: i % (Math.round(fps) * 2) === 0 });
      vf.close();
      while (enc.encodeQueueSize > WEBM_QUEUE_MAX) {
        await new Promise(r => setTimeout(r, 5));
        if (err) throw err;
      }
    },
    async finish() {
      await enc.flush();
      if (err) throw err;
      closed = true;
      try { enc.close(); } catch {}
      return muxer.finalize();
    },
    abort() { if (closed) return; closed = true; try { enc.close(); } catch {} },
  };
}

// ═════════════════════════════════════════════════════════════════════
// Animation export — main entry
// ═════════════════════════════════════════════════════════════════════

export async function exportAnim(): Promise<void> {
  if (state._exporting) { setStatus('EXPORT ALREADY RUNNING'); return; }
  if (!state.layers.length) { setStatus('NOTHING TO EXPORT'); return; }

  const { fmt, fps, dt, N } = exportTiming();
  setStatus('EXPORT: PREPARING...');

  const W = +($('gifW') as HTMLInputElement).value;
  const H = Math.round(W / canvasAspect());
  if (fmt !== 'webm') {
    const need = W * H * 4 * N;
    if (need > EXPORT_MEM_BUDGET) {
      setStatus(`EXPORT TOO LARGE (${(need / 1048576).toFixed(0)} MB RAW) — LOWER WIDTH OR FRAMES`);
      return;
    }
  }

  state._exporting = true;

  // Save preview state
  const saved = {
    TL: 0, // will be set below
    gs: new Map(state.layers.map(L => [L, L._gs])),
    roll: { ...state.roll, transition: state.roll.transition },
  };
  saved.TL = 0; // placeholder, set from timeline module

  resetTimeline(false, true);
  const frames: Uint8ClampedArray[] = [];
  const exportCv = mkCv(W, H);
  let session: WebmSession | null = null, finished = false;

  try {
    if (fmt === 'webm') {
      session = await webmSession(W, H, Math.round(fps), +($('vidBps') as HTMLInputElement).value * 1e6);
      if (!session) { setStatus('WEBCODECS NOT AVAILABLE — TRY CHROME/EDGE'); return; }
    }

    for (let i = 0; i < N; i++) {
      const t = i * dt;
      rollStep(t);
      composeFrame(t, W, H, exportCv);
      if (session) await session.add(exportCv, i);
      else frames.push(exportCv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data);
      setStatus(`CAPTURING ${i + 1}/${N} (${fmt.toUpperCase()})`);
      await new Promise(r => setTimeout(r));
    }

    setStatus(`${fmt.toUpperCase()}: ENCODING...`);
    await new Promise(r => setTimeout(r, 20));

    let blob: Blob;
    const ext = fmt;

    if (fmt === 'webm') {
      blob = await session!.finish();
      finished = true;
    } else if (fmt === 'gif') {
      const samp: number[] = [];
      const step = Math.max(1, Math.floor(W * H * N / 15000));
      frames.forEach(f => { for (let p = 0; p < W * H; p += step) samp.push(f[p * 4], f[p * 4 + 1], f[p * 4 + 2]); });
      const bits = Math.round(Math.log2(+($('gifColors') as HTMLSelectElement).value || 256));
      const CL = 1 << bits;
      const real = medianCut(samp, CL - 1);
      const pal: RGB[] = real.slice();
      while (pal.length < CL) pal.push([0, 0, 0]);
      const pb = new Uint8Array(3 * CL);
      pal.forEach((cc, i) => pb.set(cc, i * 3));
      const cache = new Int16Array(32768).fill(-1);
      const idx = frames.map(f => {
        const o = new Uint8Array(W * H);
        for (let p = 0; p < W * H; p++) {
          const r = f[p * 4], g = f[p * 4 + 1], b = f[p * 4 + 2];
          const k = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
          let v = cache[k];
          if (v < 0) { v = cache[k] = nearestColorIdx(r, g, b, real); }
          o[p] = v;
        }
        return o;
      });
      blob = new Blob(
        [gifEncode(idx, W, H, Math.max(2, Math.round(dt / 10)), pb, bits, +($('gifLossy') as HTMLInputElement).value).buffer as ArrayBuffer],
        { type: 'image/gif' },
      );
    } else if (fmt === 'apng') {
      blob = await apngEncode(frames, W, H, dt);
    } else {
      const files: { name: string; data: Uint8Array }[] = [];
      const pre = state.ui.outName || 'glitch-art';
      for (let k = 0; k < frames.length; k++) {
        const c2 = mkCv(W, H);
        c2.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frames[k]), W, H), 0, 0);
        const pb = await new Promise<Blob>((resolve, reject) => c2.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png'));
        files.push({ name: pre + '_f' + String(k + 1).padStart(3, '0') + '.png', data: new Uint8Array(await pb.arrayBuffer()) });
      }
      blob = zipStore(files);
    }

    const size = blob.size / 1048576;
    await saveBlob(blob, ext, state.ui.outName || 'glitch-art');
    setStatus(`SAVED (${W}x${H}, ${size.toFixed(1)} MB, ${N} frames)`);
  } catch (err) {
    setStatus('EXPORT ERROR: ' + (err as Error).message);
    console.error(err);
  } finally {
    if (session && !finished) session.abort();
    // Restore preview state
    state.layers.forEach(L => { L._gs = saved.gs.has(L) ? saved.gs.get(L)! : null; });
    setLastNow(performance.now());
    state._exporting = false;
  }
}

export function savePng(): void {
  if (state._exporting) { setStatus('EXPORT RUNNING — TRY AGAIN WHEN DONE'); return; }
  if (!state.layers.length) { setStatus('NOTHING TO EXPORT'); return; }
  const cv = $('outCv') as HTMLCanvasElement;
  const oldMode = getViewMode();
  setViewMode('combined');
  composeFrame(getTL());
  cv.toBlob(b => {
    if (b) { saveBlob(b, 'png', state.ui.outName || 'glitch-art'); setStatus(`PNG ${cv.width}x${cv.height}`); }
  });
  setViewMode(oldMode);
  composeFrame(getTL());
}
