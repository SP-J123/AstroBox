import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useUiStore } from '../store/useUiStore';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info
};

const ToastViewport = () => {
  const { toasts, removeToast } = useUiStore();

  return (
    <div className="fixed right-6 top-6 z-50 flex w-80 flex-col gap-3" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.variant];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'glass-card flex items-start gap-3 border border-white/10 p-4',
                toast.variant === 'success' && 'border-emerald-400/30',
                toast.variant === 'error' && 'border-rose-400/40'
              )}
            >
              <Icon className={cn('mt-1 h-5 w-5', toast.variant === 'error' ? 'text-rose-300' : toast.variant === 'success' ? 'text-emerald-300' : 'text-electric')} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-50">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs text-slate-300">{toast.description}</p> : null}
              </div>
              <button
                className="text-xs text-slate-500 transition hover:text-slate-200"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastViewport;
