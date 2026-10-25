import { EXPORT_SEED } from '../constants';

/**
 * Mulberry32 — a tiny, fast, seedable PRNG.
 * Returns a function producing floats in [0, 1).
 * Deterministic: same seed → same sequence, in any JS engine.
 */
export function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Integer hash to float [0,1) — used for per-pixel/per-cell randomness.
 * Deterministic across engines (only uses Math.imul and bitwise ops).
 */
export function h01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Clamp to [0,1]. */
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Deterministic seed from a layer id. */
export function seedFor(id: number | string): number {
  let h = EXPORT_SEED | 0;
  const q = String(id);
  for (let i = 0; i < q.length; i++) h = Math.imul(h ^ q.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Easing functions. */
export function ease(kind: string, p: number): number {
  p = Math.max(0, Math.min(1, p));
  if (kind === 'in') return p * p;
  if (kind === 'out') return 1 - (1 - p) * (1 - p);
  if (kind === 'inout') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}
