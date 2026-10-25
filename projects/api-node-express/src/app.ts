import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { processImage, buildAsciiString, extractPalette, buildHistogram } from './adapters/processor.js';
import { serveFile } from './routes/download.js';
import { getStats } from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: +(process.env.UPLOAD_MAX_SIZE_MB || 50) * 1024 * 1024 },
});

// Prometheus-style metrics endpoint (for K8s/Docker)
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/metrics', getStats);

function parseConfig(body: any): Record<string, unknown> {
  if (!body) return {};
  if (typeof body.config === 'string') {
    try { return JSON.parse(body.config); } catch { return {}; }
  }
  if (typeof body.config === 'object' && body.config !== null) return body.config;
  return body;
}

// Upload → process return PNG
app.post('/process/:mode', upload.single('image'), async (req, res) => {
  const start = Date.now();
  if (!req.file) { res.status(400).json({ error: 'No image uploaded' }); return; }
  const mode = req.params.mode;
  const config = parseConfig(req.body);

  try {
    const result = await processImage(req.file.buffer, mode as string, config);
    res.set('X-Processing-Time', String(Date.now() - start));
    res.set('Content-Type', 'image/png');
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ASCII text output
app.post('/ascii', upload.single('image'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No image uploaded' }); return; }
  const config = parseConfig(req.body);
  try {
    const text = await buildAsciiString(req.file.buffer, config);
    res.json({ success: true, text });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
