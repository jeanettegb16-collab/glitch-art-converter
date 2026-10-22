/** Saved blob output target (File System Access API or download fallback). */
interface OutDir {
  dir: FileSystemDirectoryHandle | null;
  live: boolean;
}

export const OUT: OutDir = { dir: null, live: false };

export async function ensureDir(): Promise<void> {
  if (!OUT.dir) return;
  try {
    const dir = OUT.dir as any;
    const o = { mode: 'readwrite' };
    let p = await dir.queryPermission(o);
    if (p !== 'granted') p = await dir.requestPermission(o);
    OUT.live = p === 'granted';
  } catch { OUT.live = false; }
}

/** Save a blob to the configured directory (if available) or trigger a download. */
export async function saveBlob(blob: Blob, ext: string, outName: string): Promise<void> {
  await ensureDir();
  const name = outName + '_' + Date.now() + '.' + ext;
  if (OUT.dir && OUT.live) {
    try {
      const fh = await OUT.dir.getFileHandle(name, { create: true });
      const wr = await fh.createWritable();
      await wr.write(blob);
      await wr.close();
      return;
    } catch { /* fall through to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
