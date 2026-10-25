import { db } from './index.js';

export interface User {
  id: number;
  provider: string;
  provider_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface Generation {
  id: number;
  user_id: number;
  prompt: string;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_url: string | null;
  width: number;
  height: number;
  processing_ms: number | null;
  created_at: string;
}

const findUser = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?');
const createUser = db.prepare('INSERT INTO users (provider, provider_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?) RETURNING *');

export function getOrCreateUser(provider: string, providerId: string, profile: { email?: string; name?: string; avatar?: string }): User {
  const existing = findUser.get(provider, providerId) as User | undefined;
  if (existing) return existing;
  return createUser.get(provider, providerId, profile.email || null, profile.name || null, profile.avatar || null) as User;
}

const insertGen = db.prepare('INSERT INTO generations (user_id, prompt, model, width, height) VALUES (?, ?, ?, ?, ?) RETURNING *');
const getGen = db.prepare('SELECT * FROM generations WHERE id = ?');
const updateGenStatus = db.prepare('UPDATE generations SET status = ?, result_url = ?, processing_ms = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
const listGens = db.prepare('SELECT g.*, GROUP_CONCAT(t.name) as tags FROM generations g LEFT JOIN generation_tags gt ON g.id = gt.generation_id LEFT JOIN tags t ON gt.tag_id = t.id WHERE g.user_id = ? GROUP BY g.id ORDER BY g.created_at DESC LIMIT ? OFFSET ?');
const countGens = db.prepare('SELECT COUNT(*) as count FROM generations WHERE user_id = ?');

export function createGeneration(userId: number, prompt: string, opts: { model?: string; width?: number; height?: number } = {}): Generation {
  return insertGen.get(userId, prompt, opts.model || 'stable-diffusion', opts.width || 512, opts.height || 512) as Generation;
}

export function getGeneration(id: number): Generation | undefined {
  return getGen.get(id) as Generation | undefined;
}

export function setGenerationComplete(id: number, url: string, ms: number): void {
  updateGenStatus.run('completed', url, ms, id);
}

export function setGenerationFailed(id: number): void {
  db.prepare('UPDATE generations SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('failed', id);
}

export function listGenerations(userId: number, page = 1, perPage = 10): { items: Generation[]; total: number } {
  const items = listGens.all(userId, perPage, (page - 1) * perPage) as (Generation & { tags: string | null })[];
  const { count } = countGens.get(userId) as { count: number };
  return { items: items.map(({ tags, ...g }) => ({ ...g, tagList: tags ? tags.split(',') : [] }) as any), total: count };
}

// Tag helpers
export function addTag(generationId: number, tagName: string): void {
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const linkTag = db.prepare('INSERT OR IGNORE INTO generation_tags (generation_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name = ?))');
  insertTag.run(tagName);
  linkTag.run(generationId, tagName);
}
