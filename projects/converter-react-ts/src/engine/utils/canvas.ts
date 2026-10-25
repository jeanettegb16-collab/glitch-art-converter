/** Create an offscreen canvas of the given dimensions. */
export function mkCv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Concatenate multiple Uint8Array segments into one. */
export function concatU8(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

let _imgSeqId = 1;
const _imgIds = new WeakMap<HTMLImageElement, number>();

/** Stable numeric key for an image element (for cache invalidation). */
export function imgKey(im: HTMLImageElement | null): number {
  if (!im) return 0;
  if (!_imgIds.has(im)) _imgIds.set(im, _imgSeqId++);
  return _imgIds.get(im)!;
}

/** $(id) shortcut for getElementById. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
