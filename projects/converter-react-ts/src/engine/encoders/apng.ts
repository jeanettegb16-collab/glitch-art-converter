// ═════════════════════════════════════════════════════════════════════
// APNG encoder — zero-dependency animated PNG using the CompressionStream API.
// ═════════════════════════════════════════════════════════════════════

// CRC32 table (used for PNG chunk integrity)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** Compute CRC32 of a Uint8Array (IEEE polynomial). */
export function crc32(u8: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Build a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC. */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const o = new Uint8Array(12 + data.length);
  const dv = new DataView(o.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  o.set(data, 8);
  dv.setUint32(8 + data.length, crc32(o.subarray(4, 8 + data.length)));
  return o;
}

/** Deflate raw bytes using the browser's CompressionStream. */
export async function deflateZ(u8: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await new Response(
      new Blob([u8.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('deflate'))
    ).arrayBuffer()
  );
}

/**
 * Encode a sequence of RGBA frames as an APNG blob.
 * Each frame is a Uint8Array of length w*h*4.
 */
export async function apngEncode(
  frames: Uint8ClampedArray[],
  w: number, h: number,
  delayMs: number,
): Promise<Blob> {
  const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
  const rb = w * 4 + 1;

  // IHDR
  const ih = new Uint8Array(13), iv = new DataView(ih.buffer);
  iv.setUint32(0, w); iv.setUint32(4, h); ih[8] = 8; ih[9] = 6;
  parts.push(pngChunk('IHDR', ih));

  // acTL (animation control)
  const ac = new Uint8Array(8), av = new DataView(ac.buffer);
  av.setUint32(0, frames.length); av.setUint32(4, 0);
  parts.push(pngChunk('acTL', ac));

  let seq = 0;
  for (let i = 0; i < frames.length; i++) {
    // fcTL (frame control)
    const fc = new Uint8Array(26), fv = new DataView(fc.buffer);
    fv.setUint32(0, seq++);
    fv.setUint32(4, w); fv.setUint32(8, h); fv.setUint32(12, 0); fv.setUint32(16, 0);
    fv.setUint16(20, Math.max(1, Math.round(delayMs))); fv.setUint16(22, 1000);
    fc[24] = 0; fc[25] = 0;
    parts.push(pngChunk('fcTL', fc));

    // Raw frame data with filter byte
    const raw = new Uint8Array(rb * h);
    for (let y = 0; y < h; y++) raw.set(frames[i].subarray(y * w * 4, (y + 1) * w * 4), y * rb + 1);
    const z = await deflateZ(raw);

    if (i === 0) {
      parts.push(pngChunk('IDAT', z));
    } else {
      const d = new Uint8Array(4 + z.length);
      new DataView(d.buffer).setUint32(0, seq++);
      d.set(z, 4);
      parts.push(pngChunk('fdAT', d));
    }
  }

  parts.push(pngChunk('IEND', new Uint8Array(0)));
  return new Blob(parts.map(p => p.buffer as ArrayBuffer), { type: 'image/png' });
}
