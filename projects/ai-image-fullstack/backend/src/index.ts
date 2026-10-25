import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { setupWebSocket } from './services/websocket.js';
import { generateImage } from './services/huggingface.js';
import { listGenerations } from './db/queries.js';
import './db/index.js'; // initialize schema

const app = express();
const server = createServer(app);
setupWebSocket(server);

const PORT = +(process.env.PORT || 4000);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth mock (replace with passport-github in production)
app.post('/auth/github', (req, res) => {
  const { code } = req.body;
  // In production: exchange code with GitHub API
  res.json({ token: 'mock_jwt_' + code, user: { id: 1, name: 'Demo User' } });
});

// Generation
app.post('/generate', async (req, res) => {
  const { prompt, model, width, height } = req.body;
  if (!prompt) { res.status(400).json({ error: 'Prompt required' }); return; }
  try {
    const { id } = await generateImage(1, prompt, { model, width, height });
    res.json({ success: true, jobId: id, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/generations', (req, res) => {
  const page = +(req.query.page || 1);
  const perPage = +(req.query.perPage || 10);
  const result = listGenerations(1, page, perPage);
  res.json(result);
});

// Feed (public)
app.get('/feed', (req, res) => {
  const page = +(req.query.page || 1);
  const result = listGenerations(1, page, 20);
  res.json(result);
});

server.listen(PORT, () => console.log(`AI Image backend on :${PORT}`));
