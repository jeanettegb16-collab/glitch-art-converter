import { useState, useRef, useEffect } from 'react';
import { Wand2, Loader, Download, Share2 } from 'lucide-react';

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { id: number; url: string }>(null);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'identify', userId: 1 }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'generation_complete' && msg.payload.id === result?.id) {
        setResult({ id: msg.payload.id, url: msg.payload.url });
        setLoading(false);
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [result?.id]);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width: 512, height: 512 }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ id: data.jobId, url: '' });
      } else {
        setError(data.error || 'Failed');
        setLoading(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Create an Image</h1>
      <p className="text-gray-400 mb-8">Describe what you want to see. Powered by Stable Diffusion via Hugging Face.</p>

      <div className="flex gap-3 mb-8">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="A cyberpunk city in neon rain..."
          className="flex-1 px-4 py-3 rounded-lg bg-surface-1 border border-surface-2 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
        />
        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="px-6 py-3 rounded-lg bg-accent text-surface-0 font-semibold hover:bg-accent/90 transition disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger border border-danger/20">{error}</div>}

      <div className="aspect-square max-h-[512px] bg-surface-1 rounded-xl border border-surface-2 flex items-center justify-center overflow-hidden">
        {result?.url ? (
          <img src={result.url} alt="Generated" className="w-full h-full object-contain" />
        ) : loading ? (
          <div className="text-center text-gray-400">
            <Loader size={48} className="animate-spin mx-auto mb-4" />
            <p>Generating your image...</p>
            <p className="text-sm mt-1">This takes 5–15 seconds</p>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
            <p>Your creation will appear here</p>
          </div>
        )}
      </div>

      {result?.url && (
        <div className="flex gap-3 mt-4 justify-center">
          <a href={result.url} download className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition">
            <Download size={16} /> Download
          </a>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition">
            <Share2 size={16} /> Share to Feed
          </button>
        </div>
      )}
    </div>
  );
}
