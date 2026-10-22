import { crc32 } from './apng';

// ═════════════════════════════════════════════════════════════════════
// ZIP encoder — zero-dependency "store" (no compression) ZIP builder.
// Used for exporting PNG sequences.
// ═════════════════════════════════════════════════════════════════════

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

/**
 * Build a ZIP archive containing the given files (stored, no compression).
 * Produces a valid .zip readable by any unzip tool.
 */
export function zipStore(files: ZipFile[]): Blob {
  const enc = new TextEncoder();
  const loc: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;

  files.forEach(f => {
    const nm = enc.encode(f.name);
    const crc = crc32(f.data);
    const len = f.data.length;

    // Local file header
    const lh = new Uint8Array(30 + nm.length), ldv = new DataView(lh.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);   // version needed
    ldv.setUint16(6, 0x0800, true); // flags (UTF-8 name)
    ldv.setUint16(8, 0, true);    // method = store
    ldv.setUint16(10, 0, true);   // mod time
    ldv.setUint16(12, 0x21, true); // mod date
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, len, true);
    ldv.setUint32(22, len, true);
    ldv.setUint16(26, nm.length, true);
    ldv.setUint16(28, 0, true);
    lh.set(nm, 30);

    // Central directory entry
    const ce = new Uint8Array(46 + nm.length), cdv = new DataView(ce.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0x21, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, len, true);
    cdv.setUint32(24, len, true);
    cdv.setUint16(28, nm.length, true);
    cdv.setUint32(42, off, true);
    ce.set(nm, 46);

    loc.push(lh, f.data);
    cen.push(ce);
    off += lh.length + len;
  });

  const cs = cen.reduce((x, y) => x + y.length, 0);
  const e = new Uint8Array(22), ev = new DataView(e.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cs, true);
  ev.setUint32(16, off, true);

  return new Blob([...loc, ...cen, e].map(u => u.buffer as ArrayBuffer), { type: 'application/zip' });
}
