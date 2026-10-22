import { concatU8 } from '../utils/canvas';

// ═════════════════════════════════════════════════════════════════════
// EBML / WebM muxer — zero-dependency Matroska container for VP9 frames
// ═════════════════════════════════════════════════════════════════════

/** Encode an EBML element ID. */
export function ebmlID(id: number): Uint8Array {
  const bytes: number[] = [];
  let v = id;
  while (v > 0) { bytes.unshift(v & 0xFF); v = Math.floor(v / 256); }
  return new Uint8Array(bytes);
}

/** Encode a variable-size unsigned integer (EBML Vint). */
export function ebmlVint(n: number): Uint8Array {
  let len = 1;
  while (len < 8 && n >= Math.pow(2, 7 * len) - 1) len++;
  const out = new Uint8Array(len);
  out[0] = 1 << (8 - len);
  for (let i = len - 1; i >= 0; i--) { out[i] |= n & 0xFF; n = Math.floor(n / 256); }
  return out;
}

export const ebmlSize = ebmlVint;

/** Encode a fixed-size unsigned integer as big-endian bytes. */
export function ebmlUint(n: number): Uint8Array {
  if (n === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  while (n > 0) { bytes.unshift(n & 0xFF); n = Math.floor(n / 256); }
  return new Uint8Array(bytes);
}

/** Encode a float64 as 8 bytes (big-endian, per EBML spec). */
export function ebmlFloat(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return b;
}

export function ebmlStr(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Build a complete EBML element: ID + size + payload. */
export function ebmlElement(id: number, data: Uint8Array): Uint8Array {
  const idB = ebmlID(id);
  const sizeB = ebmlSize(data.length);
  return concatU8(idB, sizeB, data);
}

/** Encoded video chunk (VP9) metadata. */
export interface EncodedChunk {
  timestamp: number;       // microseconds
  type: 'key' | 'delta';
  byteLength: number;
  copyTo: (dst: Uint8Array) => void;
}

/** Block within a cluster. */
interface Block {
  relTime: number;
  data: Uint8Array;
  keyframe: boolean;
}

interface Cluster {
  timecode: number;
  blocks: Block[];
}

/**
 * Minimal WebM muxer — produces a valid .webm file from VP9 encoded chunks.
 * No external dependencies. Creates its own EBML header, Segment Info,
 * Tracks, and Clusters with SimpleBlock entries.
 */
export class WebMMuxer {
  width: number;
  height: number;
  fps: number;
  codecId: string;
  trackId = 1;
  clusters: Cluster[] = [];
  currentCluster: Cluster | null = null;
  durationMs = 0;

  constructor(opts: { width: number; height: number; fps?: number; codec?: string }) {
    this.width = opts.width;
    this.height = opts.height;
    this.fps = opts.fps ?? 30;
    this.codecId = opts.codec ?? 'V_VP9';
  }

  addVideoChunk(chunk: EncodedChunk): void {
    const tsMs = Math.round(chunk.timestamp / 1000);
    this.durationMs = Math.max(this.durationMs, tsMs);
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const keyframe = chunk.type === 'key';

    if (!this.currentCluster || (tsMs - this.currentCluster.timecode) > 1000 || keyframe) {
      this.currentCluster = { timecode: tsMs, blocks: [] };
      this.clusters.push(this.currentCluster);
    }
    this.currentCluster.blocks.push({
      relTime: tsMs - this.currentCluster.timecode,
      data,
      keyframe,
    });
  }

  finalize(): Blob {
    const ebmlHeader = ebmlElement(0x1A45DFA3, concatU8(
      ebmlElement(0x4286, ebmlUint(1)),
      ebmlElement(0x42F7, ebmlUint(1)),
      ebmlElement(0x42F2, ebmlUint(4)),
      ebmlElement(0x42F3, ebmlUint(8)),
      ebmlElement(0x4282, ebmlStr('webm')),
      ebmlElement(0x4287, ebmlUint(2)),
      ebmlElement(0x4285, ebmlUint(2)),
    ));

    const info = ebmlElement(0x1549A966, concatU8(
      ebmlElement(0x2AD7B1, ebmlUint(1000000)),
      ebmlElement(0x4489, ebmlFloat(this.durationMs)),
      ebmlElement(0x4D80, ebmlStr('glitch-art')),
      ebmlElement(0x5741, ebmlStr('glitch-art')),
    ));

    const track = ebmlElement(0xAE, concatU8(
      ebmlElement(0xD7, ebmlUint(this.trackId)),
      ebmlElement(0x73C5, ebmlUint(this.trackId)),
      ebmlElement(0x83, ebmlUint(1)),
      ebmlElement(0x86, ebmlStr(this.codecId)),
      ebmlElement(0xE0, concatU8(
        ebmlElement(0xB0, ebmlUint(this.width)),
        ebmlElement(0xBA, ebmlUint(this.height)),
      )),
    ));
    const tracks = ebmlElement(0x1654AE6B, track);

    const clusterEls = this.clusters.map(cl => {
      const blocks = cl.blocks.map(b => {
        const trackVint = ebmlVint(this.trackId);
        const header = new Uint8Array(trackVint.length + 3);
        header.set(trackVint, 0);
        new DataView(header.buffer).setInt16(trackVint.length, b.relTime);
        header[trackVint.length + 2] = b.keyframe ? 0x80 : 0x00;
        return ebmlElement(0xA3, concatU8(header, b.data));
      });
      return ebmlElement(0x1F43B675, concatU8(ebmlElement(0xE7, ebmlUint(cl.timecode)), ...blocks));
    });

    const segment = ebmlElement(0x18538067, concatU8(info, tracks, ...clusterEls));
    return new Blob([concatU8(ebmlHeader, segment).buffer as ArrayBuffer], { type: 'video/webm' });
  }
}
