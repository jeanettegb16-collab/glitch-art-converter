import type { Request, Response } from 'express';

const stats = { conversions: 0, formats: {} as Record<string, number>, totalMs: 0 };

export function recordConversion(mode: string, ms: number): void {
  stats.conversions++;
  stats.formats[mode] = (stats.formats[mode] || 0) + 1;
  stats.totalMs += ms;
}

export function getStats(_req: Request, res: Response): void {
  res.json({
    conversions: stats.conversions,
    formats: stats.formats,
    avgProcessingMs: stats.conversions ? Math.round(stats.totalMs / stats.conversions) : 0,
  });
}
