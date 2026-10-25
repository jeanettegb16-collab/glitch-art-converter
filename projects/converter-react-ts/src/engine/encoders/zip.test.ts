import { describe, it, expect } from 'vitest';
import { zipStore } from './zip';

describe('zipStore', () => {
  it('produces a blob with correct MIME type', () => {
    const blob = zipStore([{ name: 'test.txt', data: new TextEncoder().encode('hello') }]);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a valid ZIP with local file header signature', async () => {
    const blob = zipStore([{ name: 'a.txt', data: new Uint8Array([1, 2, 3]) }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Local file header signature: 0x04034b50 (little-endian: 50 4b 03 04)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('produces a valid end-of-central-directory record', async () => {
    const files = [
      { name: 'frame_001.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
      { name: 'frame_002.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
    ];
    const blob = zipStore(files);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // EOCD signature: 0x06054b50 (little-endian: 50 4b 05 06)
    const eocdSig = [0x50, 0x4b, 0x05, 0x06];
    let found = false;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf[i] === eocdSig[0] && buf[i + 1] === eocdSig[1] && buf[i + 2] === eocdSig[2] && buf[i + 3] === eocdSig[3]) {
        found = true;
        // Check file count (at offset +8, 2 bytes LE)
        const count = buf[i + 8] | (buf[i + 9] << 8);
        expect(count).toBe(2);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('preserves file data uncompressed', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = zipStore([{ name: 'test.png', data }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // After the 30-byte local header + filename, the data should appear
    const nameLen = new TextEncoder().encode('test.png').length;
    const dataStart = 30 + nameLen;
    expect(Array.from(buf.subarray(dataStart, dataStart + data.length))).toEqual(Array.from(data));
  });
});
