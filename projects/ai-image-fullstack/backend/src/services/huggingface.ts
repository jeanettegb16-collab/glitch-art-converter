import { createGeneration, setGenerationComplete, setGenerationFailed, getGeneration } from '../db/queries.js';

const HF_API = 'https://api-inference.huggingface.co/models';

/**
 * Call Hugging Face Inference API to generate an image from text.
 * Returns a buffer (PNG/JPEG).
 */
export async function generateImage(
  userId: number, prompt: string,
  opts: { model?: string; width?: number; height?: number } = {},
): Promise<{ id: number; blob: Buffer }> {
  const model = opts.model || 'stabilityai/stable-diffusion-2-1';
  const gen = createGeneration(userId, prompt, { model, width: opts.width, height: opts.height });

  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error('HF_API_TOKEN not configured');

  const start = Date.now();
  const body = JSON.stringify({
    inputs: prompt,
    parameters: { width: opts.width || 512, height: opts.height || 512, seed: Math.floor(Math.random() * 1e9) },
  });

  try {
    const res = await fetch(`${HF_API}/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      setGenerationFailed(gen.id);
      throw new Error(`HF API error: ${res.status} ${err}`);
    }

    const blob = Buffer.from(await res.arrayBuffer());
    const url = `data:image/png;base64,${blob.toString('base64')}`;
    setGenerationComplete(gen.id, url, Date.now() - start);
    return { id: gen.id, blob };
  } catch {
    setGenerationFailed(gen.id);
    throw;
  }
}

/**
 * Upvote existing generation.
 */
export function upvoteGeneration(generationId: number): void {
  const gen = getGeneration(generationId);
  if (!gen) throw new Error('Generation not found');
  // In a real app: increment a votes table
}
