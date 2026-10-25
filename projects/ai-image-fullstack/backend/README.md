# AI Image Generator — Fullstack Backend

Node.js + Express + SQLite + WebSocket + Hugging Face Inference API.

## Stack

- **Express 4** — HTTP API (REST)
- **better-sqlite3** — local SQLite, WAL mode
- **ws** — WebSocket server for live gallery updates
- **Hugging Face Inference API** — `stabilityai/stable-diffusion-2-1`
- **Sharp** — post-processing: thumbnail generation

## Database Schema

```sql
users (id, provider, provider_id, email, name, avatar_url)
generations (id, user_id, prompt, model, status, result_url, width, height, processing_ms, created_at)
tags (id, name)
generation_tags (generation_id, tag_id)
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/github` | — | OAuth callback → JWT token |
| POST | `/generate` | JWT | Queue AI image generation |
| GET | `/generations` | JWT | My generation history (paginated) |
| GET | `/feed` | — | Public gallery feed (paginated) |
| GET | `/health` | — | K8s health check |

## WebSocket Events

- `identify` → send `{ type: 'identify', userId: 1 }`
- `generation_complete` → broadcast when an image finishes

## Getting started

```bash
npm install
cp .env.example .env  # add HF_API_TOKEN
npm run db:migrate
npm run dev             # tsx watch
```

## Environment

```
PORT=4000
DB_PATH=./data/ai_image.db
HF_API_TOKEN=xxx
FRONTEND_URL=http://localhost:5173
```

## License

MIT
