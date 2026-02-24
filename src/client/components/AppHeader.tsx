import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '../store/useUiStore';
import useAppStore from '../store/useAppStore';

const AppHeader = () => {
  const { theme, toggleTheme } = useUiStore();
  const options = useAppStore((state) => state.options);
  const setOption = useAppStore((state) => state.setOption);

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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOption('bypassResources', !options.bypassResources)}
          className={`flex h-[34px] items-center gap-2 rounded-full px-4 text-[11px] font-bold uppercase tracking-wider transition-colors ${options.bypassResources
              ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
              : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          title="Bypass server hardware limits"
        >
          <span className="relative flex h-2 w-2">
            {options.bypassResources && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${options.bypassResources ? 'bg-red-500' : 'bg-slate-500'}`}
            ></span>
          </span>
          <span className="hidden sm:inline">Bypass Limits</span>
          <span className="inline sm:hidden">Bypass</span>
        </button>

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
      </div>
    </header>
  );
};

export default AppHeader;
