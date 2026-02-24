const THEME_KEY = 'ff-theme';

export type ThemeMode = 'dark' | 'light';

export function initTheme() {
  if (typeof window === 'undefined') return;
  const saved = (localStorage.getItem(THEME_KEY) as ThemeMode | null) || 'dark';
  applyTheme(saved);
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(THEME_KEY) as ThemeMode | null) || 'dark';
}
