import { describe, it, expect } from 'vitest';
import { crc32, pngChunk } from './apng';

describe('crc32', () => {
  it('computes CRC32 of empty array', () => {
    // CRC32 of empty input = 0x00000000
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('computes CRC32 of known data', () => {
    // "123456789" → standard CRC32 = 0xCBF43926
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xCBF43926);
  });

  it('is deterministic', () => {
    const data = new TextEncoder().encode('hello world');
    expect(crc32(data)).toBe(crc32(data));
  });
});

describe('pngChunk', () => {
  it('produces 12 + data.length bytes', () => {
    const data = new Uint8Array([1, 2, 3]);
    const chunk = pngChunk('IHDR', data);
    expect(chunk.length).toBe(12 + 3);
  });

  it('writes the type string at offset 4', () => {
    const chunk = pngChunk('IHDR', new Uint8Array(4));
    expect(String.fromCharCode(chunk[4], chunk[5], chunk[6], chunk[7])).toBe('IHDR');
  });

  it('writes the data length at offset 0 (big-endian)', () => {
    const data = new Uint8Array(256);
    const chunk = pngChunk('IDAT', data);
    const dv = new DataView(chunk.buffer);
    expect(dv.getUint32(0)).toBe(256);
  });

  it('writes a valid CRC at the end', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x0d]);
    const chunk = pngChunk('test', data);
    const dv = new DataView(chunk.buffer);
    const stored = dv.getUint32(8 + data.length);
    const computed = crc32(chunk.subarray(4, 8 + data.length));
    expect(stored).toBe(computed);
  });
});
