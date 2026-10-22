import { describe, it, expect } from 'vitest';
import { ebmlVint, ebmlUint, ebmlFloat, ebmlStr, ebmlElement, ebmlID, WebMMuxer } from './webm';

describe('ebmlVint', () => {
  it('encodes 0', () => {
    const r = ebmlVint(0);
    expect(r.length).toBe(1);
    // Vint for 0: 0x80 (data byte with marker)
    expect(r[0] & 0x80).toBeTruthy();
  });

  it('encodes small values in 1 byte', () => {
    const r = ebmlVint(42);
    expect(r.length).toBe(1);
    expect(r[0] & 0x80).toBeTruthy();
  });

  it('encodes larger values in multiple bytes', () => {
    const r = ebmlVint(300);
    expect(r.length).toBe(2);
  });

  it('encodes very large values', () => {
    const r = ebmlVint(1000000);
    expect(r.length).toBe(3);
  });
});

describe('ebmlUint', () => {
  it('encodes 0 as single zero byte', () => {
    expect(ebmlUint(0)).toEqual(new Uint8Array([0]));
  });
  it('encodes 1', () => {
    expect(ebmlUint(1)).toEqual(new Uint8Array([1]));
  });
  it('encodes 256 as two bytes big-endian', () => {
    expect(ebmlUint(256)).toEqual(new Uint8Array([1, 0]));
  });
  it('encodes 65535', () => {
    expect(ebmlUint(65535)).toEqual(new Uint8Array([255, 255]));
  });
});

describe('ebmlFloat', () => {
  it('encodes a float64 as 8 bytes', () => {
    const r = ebmlFloat(3.14);
    expect(r.length).toBe(8);
    const dv = new DataView(r.buffer);
    expect(dv.getFloat64(0)).toBeCloseTo(3.14);
  });
  it('encodes 0.0', () => {
    expect(ebmlFloat(0)).toEqual(new Uint8Array(8));
  });
});

describe('ebmlStr', () => {
  it('encodes ASCII string', () => {
    expect(Array.from(ebmlStr('hello'))).toEqual([104, 101, 108, 108, 111]);
  });
  it('encodes empty string', () => {
    expect(ebmlStr('').length).toBe(0);
  });
});

describe('ebmlElement', () => {
  it('produces ID + size + payload', () => {
    const payload = ebmlStr('test');
    const el = ebmlElement(0x4286, payload);
    // The element should be longer than the payload (has ID + size prefix)
    expect(el.length).toBeGreaterThan(payload.length);
    // The payload should be at the end
    expect(Array.from(el.subarray(el.length - payload.length))).toEqual(Array.from(payload));
  });
});

describe('WebMMuxer', () => {
  it('produces a blob with correct MIME type', () => {
    const muxer = new WebMMuxer({ width: 320, height: 240, fps: 30 });
    // Simulate a keyframe
    const fakeChunk = {
      timestamp: 0,
      type: 'key' as const,
      byteLength: 4,
      copyTo: (dst: Uint8Array) => { dst[0] = 0x1f; dst[1] = 0x43; dst[2] = 0xb6; dst[3] = 0x75; },
    };
    muxer.addVideoChunk(fakeChunk);
    const blob = muxer.finalize();
    expect(blob.type).toBe('video/webm');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('tracks duration from timestamps', () => {
    const muxer = new WebMMuxer({ width: 64, height: 64, fps: 10 });
    // Add frames at 0ms and 1000ms
    for (let i = 0; i < 2; i++) {
      muxer.addVideoChunk({
        timestamp: i * 1000000, // 0 and 1000 ms
        type: i === 0 ? 'key' : 'delta',
        byteLength: 4,
        copyTo: (dst: Uint8Array) => { dst.fill(0); },
      });
    }
    expect(muxer.durationMs).toBe(1000);
  });
});
