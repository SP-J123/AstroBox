import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '../store/useUiStore';

const AppHeader = () => {
  const { theme, toggleTheme } = useUiStore();

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-card border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
            <path d="M12 7v5M10 10l2 2 2-2" stroke="#c7d2fe" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-50 drop-shadow-sm">AstroBox</h1>
          <p className="text-xs font-medium text-slate-400">Unrestricted media downloader</p>
        </div>
      </div>
      <button
        type="button"
        className={`theme-toggle ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
        onClick={toggleTheme}
        aria-label="Toggle theme"
        aria-pressed={theme === 'light'}
      >
        <span className="theme-toggle-icon">
          <Sun className="h-3.5 w-3.5" />
        </span>
        <span className="theme-toggle-icon">
          <Moon className="h-3.5 w-3.5" />
        </span>
        <span className="theme-toggle-thumb">
          {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </span>
      </button>
    </header>
  );
};

export default AppHeader;
