# Image Processing API — Node.js + Express + Sharp

A production-oriented REST API for image manipulation: uploads, ASCII/palette/histogram generation, stats. Built for deployment to Docker or any Node host.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/process/:mode` | Upload image, process (glitch/pixel/glyph/palette/histogram), return PNG |
| POST | `/ascii` | Upload image, return ASCII text string |
| GET | `/metrics` | Conversion count, format breakdown, average processing time |
| GET | `/health` | Kubernetes-friendly health check |

## Architecture

```
src/
├── index.ts           # Express app, middleware, route wiring
├── types.ts           # ProcessRequest, ProcessResponse interfaces
├── adapters/
│   └── processor.ts   # Sharp-based image ops + palette quantisation
└── routes/
    ├── download.ts    # Placeholder: file download via jobId
    └── stats.ts       # In-memory metrics (replace with Redis for prod)
```

## Key design

- **Memory storage** (`multer.memoryStorage()`) — no temp files, directly pipe to Sharp
- **Palette extraction** uses median-cut (same algorithm as the converter frontend)
- **Stats** are in-memory for simplicity; swap for Redis/prometheus when scaling
- **Docker-ready** — health endpoint, environment-based config, no state on disk

## Getting started

```bash
npm install
cp .env.example .env
npm run dev        # tsx watch (auto-reload on changes)
npm run test       # vitest + supertest (integration tests)
```

## Deployment

```bash
npm run build      # tsc → dist/
node dist/index.js # production server
```

Dockerfile (example):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## License

MIT
