import { $ } from '../engine/utils/canvas';

// ── Status (main.ts L34–36, as-is) ──
export function setStatus(m: string): void {
  ($('status') as HTMLElement).textContent = '> ' + m;
}
