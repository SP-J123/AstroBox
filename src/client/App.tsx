import type { CSSProperties } from 'react';
import AppHeader from './components/AppHeader';
import HeroInput from './components/HeroInput';
import MinimalOptions from './components/MinimalOptions';
import MediaPreviewCard from './components/MediaPreviewCard';
import DownloadDashboard from './components/DownloadDashboard';
import ToastViewport from './components/ToastViewport';
import { useUiStore } from './store/useUiStore';

const generateStars = (count: number) => Array.from({ length: count }).map(() => ({
  x: `${Math.floor(Math.random() * 100)}%`,
  y: `${Math.floor(Math.random() * 100)}%`,
  size: `${Math.random() > 0.8 ? 3 : Math.random() > 0.4 ? 2 : 1}px`,
  delay: `${(Math.random() * 5).toFixed(1)}s`
}));

const generateSparkles = (count: number) => Array.from({ length: count }).map(() => ({
  x: `${Math.floor(Math.random() * 100)}%`,
  y: `${Math.floor(Math.random() * 100)}%`,
  delay: `${(Math.random() * 5).toFixed(1)}s`
}));

const stars = generateStars(120);
const sparkles = generateSparkles(35);

const App = () => {
  const theme = useUiStore((state) => state.theme);

  return (
    <div className={`app-shell min-h-screen ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-layer ambient-gradient" />
        <div className="ambient-layer ambient-glow ambient-glow-a" />
        <div className="ambient-layer ambient-glow ambient-glow-b" />
        <div className="ambient-layer ambient-mist" />
        <div className="ambient-stars">
          {stars.map((star) => (
            <span
              key={`${star.x}-${star.y}`}
              className="ambient-star"
              style={{ '--x': star.x, '--y': star.y, '--size': star.size, '--delay': star.delay } as CSSProperties}
            />
          ))}
        </div>
        <div className="ambient-sparkles">
          {sparkles.map((sparkle) => (
            <span
              key={`${sparkle.x}-${sparkle.y}`}
              className="ambient-sparkle"
              style={{ '--x': sparkle.x, '--y': sparkle.y, '--delay': sparkle.delay } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="app-content mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <AppHeader />
        <HeroInput />
        <MinimalOptions />
        <div className="mt-8 space-y-6">
          <MediaPreviewCard />
          <DownloadDashboard />
        </div>
      </div>
      <ToastViewport />
    </div>
  );
};

export default App;
