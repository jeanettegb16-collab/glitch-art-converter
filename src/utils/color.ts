import { PALETTES } from '../constants';

export type RGB = [number, number, number];

/** Parse a hex color (#rrggbb) into an [r,g,b] triple. */
export function hexToRgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Mix a hex color toward white by t∈[0,1]. Returns an `rgb(r,g,b)` string. */
export function mixWhite(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Find the closest palette entry index using a weighted Euclidean distance. */
export function nearestColorIdx(r: number, g: number, b: number, pal: RGB[]): number {
  let best = Infinity, bi = 0;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i];
    const dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (d < best) { best = d; bi = i; }
  }
  return bi;
}

/**
 * Median-cut quantisation — divide `pixels` (flat [r,g,b,...]) into `n` buckets
 * and return the average colour of each bucket as [r,g,b].
 */
export function medianCut(pixels: number[], n: number): RGB[] {
  const avg = (b: number[][]): RGB => {
    let r = 0, g = 0, bl = 0;
    for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; }
    return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)];
  };

  const pts: number[][] = [];
  for (let i = 0; i < pixels.length; i += 3) pts.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  let buckets = [pts];

  while (buckets.length < n) {
    let wi = 0, mx = 0;
    buckets.forEach((b, i) => {
      let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
      for (const p of b) {
        if (p[0] < r0) r0 = p[0]; if (p[0] > r1) r1 = p[0];
        if (p[1] < g0) g0 = p[1]; if (p[1] > g1) g1 = p[1];
        if (p[2] < b0) b0 = p[2]; if (p[2] > b1) b1 = p[2];
      }
      const rr = Math.max(r1 - r0, g1 - g0, b1 - b0);
      if (rr > mx) { mx = rr; wi = i; }
    });
    const b = buckets[wi];
    let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
    for (const p of b) {
      if (p[0] < r0) r0 = p[0]; if (p[0] > r1) r1 = p[0];
      if (p[1] < g0) g0 = p[1]; if (p[1] > g1) g1 = p[1];
      if (p[2] < b0) b0 = p[2]; if (p[2] > b1) b1 = p[2];
    }
    const rr = r1 - r0, gr = g1 - g0, br = b1 - b0;
    const ch = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2;
    b.sort((a, c) => a[ch] - c[ch]);
    const mid = Math.floor(b.length / 2);
    buckets.splice(wi, 1, b.slice(0, mid), b.slice(mid));
    if (buckets.length >= n) break;
  }
  return buckets.filter(b => b.length).map(avg);
}

/** Resolve a palette name or auto-N spec into an [r,g,b][] array. */
export function resolvePalette(name: string): RGB[] | null {
  if (PALETTES[name]) return PALETTES[name].map(hexToRgb);
  return null;
}
