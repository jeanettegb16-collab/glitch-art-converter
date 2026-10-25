import type { Request, Response } from 'express';

export function serveFile(req: Request, res: Response): void {
  // Not used in memory-only version, but documents the intent:
  // /download/:jobId returns pre-generated files from S3 / filesystem
  res.status(501).json({ error: 'Download via jobId not implemented in this demo' });
}
