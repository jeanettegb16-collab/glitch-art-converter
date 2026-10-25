// ═════════════════════════════════════════════════════════════════════
// GIF encoder — zero-dependency GIF89a with LZW compression,
// animated NETSCAPE extension, and optional frame differencing.
// ═════════════════════════════════════════════════════════════════════

/**
 * Encode a sequence of palette-indexed frames as a GIF89a blob.
 *
 * @param frames  Array of Uint8Array, one per frame, each `w*h` palette indices.
 * @param w       Width in pixels.
 * @param h        Height in pixels.
 * @param delay   Frame delay in centiseconds (1/100 s).
 * @param pal     Flat palette: [r0,g0,b0, r1,g1,b1, ...].
 * @param bits     Bits per colour (e.g. 8 → 256 colours).
 * @param tol      Colour tolerance for frame differencing (0 = exact match).
 */
export function gifEncode(
  frames: Uint8Array[],
  w: number, h: number,
  delay: number,
  pal: Uint8Array,
  bits = 8,
  tol = 0,
): Uint8Array {
  const o: number[] = [];
  const w16 = (n: number) => o.push(n & 255, n >> 8 & 255);
  const CL = 1 << bits;
  const tIdx = CL - 1;          // transparent index = last colour
  const mc = bits;               // min code size for LZW
  const T2 = tol * tol;

  // Header
  o.push(71, 73, 70, 56, 57, 97); // GIF89a
  w16(w); w16(h);
  o.push(0xF0 | (bits - 1), 0, 0); // global colour table flag + size
  for (let i = 0; i < 3 * CL; i++) o.push(pal[i]);
  // NETSCAPE looping extension
  o.push(33, 255, 11);
  for (const ch of 'NETSCAPE2.0') o.push(ch.charCodeAt(0));
  o.push(3, 1, 0, 0, 0);

  let disp: Uint8Array | null = null;

  frames.forEach((px, k) => {
    let x0 = 0, y0 = 0, fw = w, fh = h;
    let data = px;
    let tr = 0;

    if (k === 0) {
      disp = Uint8Array.from(px);
    } else {
      const out = new Uint8Array(w * h);
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const i = px[p];
          const d = disp![p];
          let same = i === d;
          if (!same && T2 > 0) {
            const a = i * 3, c = d * 3;
            const dr = pal[a] - pal[c], dg = pal[a + 1] - pal[c + 1], db = pal[a + 2] - pal[c + 2];
            same = dr * dr + dg * dg + db * db <= T2;
          }
          if (same) {
            out[p] = tIdx;
          } else {
            out[p] = i;
            disp![p] = i;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      tr = 1;
      if (maxX < 0) { fw = 1; fh = 1; data = new Uint8Array([tIdx]); }
      else {
        x0 = minX; y0 = minY; fw = maxX - minX + 1; fh = maxY - minY + 1;
        data = new Uint8Array(fw * fh);
        for (let y = 0; y < fh; y++) data.set(out.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + fw), y * fw);
      }
    }

    // GCE
    o.push(33, 249, 4, tr ? 5 : 4);
    w16(delay);
    o.push(tr ? tIdx : 0, 0, 44);
    w16(x0); w16(y0); w16(fw); w16(fh);
    o.push(0, mc);

    // LZW
    const CC = 1 << mc, EOI = CC + 1;
    let dict = new Map<number, number>();
    let next = CC + 2, size = mc + 1;
    let cur = 0, nb = 0;
    const buf: number[] = [];
    const emit = (c: number) => {
      cur |= c << nb; nb += size;
      while (nb >= 8) { buf.push(cur & 255); cur >>= 8; nb -= 8; }
    };
    emit(CC);
    let p = data[0];
    for (let i = 1; i < data.length; i++) {
      const c = data[i], key = (p << 8) | c, v = dict.get(key);
      if (v !== undefined) { p = v; continue; }
      emit(p);
      if (next === 4096) {
        emit(CC); dict = new Map(); next = CC + 2; size = mc + 1;
      } else {
        if (next >= (1 << size)) size++;
        dict.set(key, next++);
      }
      p = c;
    }
    emit(p); emit(EOI);
    if (nb > 0) buf.push(cur & 255);

    // Sub-blocks
    for (let i = 0; i < buf.length; i += 255) {
      const n = Math.min(255, buf.length - i);
      o.push(n);
      for (let j = 0; j < n; j++) o.push(buf[i + j]);
    }
    o.push(0);
  });

  o.push(59); // trailer
  return new Uint8Array(o);
}
