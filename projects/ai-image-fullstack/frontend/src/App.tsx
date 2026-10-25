import { Routes, Route, Link } from 'react-router-dom';
import { Sparkles, Image, GitHub } from 'lucide-react';
import FeedPage from './pages/FeedPage';
import GeneratePage from './pages/GeneratePage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-2 bg-surface-1/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-accent font-bold text-lg">
            <Sparkles size={20} /> AI Image
          </Link>
          <nav className="flex gap-4 ml-auto items-center">
            <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition">
              <Image size={16} /> Gallery
            </Link>
            <Link to="/generate" className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition">
              <Sparkles size={16} /> Create
            </Link>
            <button className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition">
              <GitHub size={16} /> Sign In
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/generate" element={<GeneratePage />} />
        </Routes>
      </main>
    </div>
  );
}
