import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });

  it('GET /metrics returns stats', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversions');
    expect(res.body).toHaveProperty('avgProcessingMs');
  });

  it('POST /process/pixel without image returns 400', async () => {
    const res = await request(app).post('/process/pixel').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No image uploaded');
  });

  it('POST /process/glyph without image returns 400', async () => {
    const res = await request(app).post('/process/glyph').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No image uploaded');
  });

  it('POST /ascii without image returns 400', async () => {
    const res = await request(app).post('/ascii').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No image uploaded');
  });
});
