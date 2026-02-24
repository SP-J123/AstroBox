import { create } from 'zustand';
import { applyTheme, getStoredTheme, type ThemeMode } from '../utils/theme';
import type { Toast, ToastVariant } from './types';

type UiState = {
  theme: ThemeMode;
  toasts: Toast[];
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  pushToast: (title: string, description?: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
};

const getId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`);

export const useUiStore = create<UiState>((set, get) => ({
  theme: getStoredTheme(),
  toasts: [],
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
  pushToast: (title, description, variant = 'info') => {
    const id = getId();
    set((state) => ({
      toasts: [...state.toasts, { id, title, description, variant }]
    }));
    window.setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));
