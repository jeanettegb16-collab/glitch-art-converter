import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface Client { ws: WebSocket; userId?: number }
const clients = new Set<Client>();

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: Client = { ws };
    clients.add(client);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'identify' && msg.userId) {
          client.userId = msg.userId;
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => clients.delete(client));
  });
}

export function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const { ws } of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }
}

export function notifyUser(userId: number, type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const c of clients) {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(message);
    }
  }
}
