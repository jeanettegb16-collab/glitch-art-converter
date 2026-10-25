import { useEffect, useState } from 'react';
import { Heart, Clock, Wand2, Loader } from 'lucide-react';

interface Generation {
  id: number;
  prompt: string;
  status: string;
  result_url: string | null;
  processing_ms: number | null;
  tagList?: string[];
}

export default function FeedPage() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/feed?page=${page}`)
      .then(r => r.json())
      .then(data => {
        setItems(prev => page === 1 ? data.items : [...prev, ...data.items]);
        setHasMore(data.items.length === 20);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Gallery Feed</h1>

      {items.length === 0 && !loading && (
        <div className="text-center py-20 text-gray-400">
          <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>No images yet. Be the first to create one!</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(g => (
          <div key={g.id} className="group bg-surface-1 rounded-xl overflow-hidden border border-surface-2 hover:border-accent/30 transition">
            <div className="aspect-square bg-surface-2 relative">
              {g.result_url ? (
                <img src={g.result_url} alt={g.prompt} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <Loader size={32} className="animate-spin" />
                </div>
              )}
              <button className="absolute top-3 right-3 p-2 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition hover:bg-black/60">
                <Heart size={16} className="text-white" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-300 line-clamp-2 mb-2">{g.prompt}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock size={12} /> {g.processing_ms ? `${g.processing_ms}ms` : 'pending'}</span>
                {g.tagList?.map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-surface-2 text-accent">{t}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-8">
          <button onClick={() => setPage(p => p + 1)} disabled={loading}
            className="px-6 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition disabled:opacity-50">
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
