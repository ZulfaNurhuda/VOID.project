import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useErrorStore } from '@/store/errorStore';

export function ErrorDisplay() {
  const { errors, clearErrors } = useErrorStore();

  useEffect(() => {
    if (errors.length === 0) return;
    const timer = setTimeout(clearErrors, 5000);
    return () => clearTimeout(timer);
  }, [errors, clearErrors]);

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {errors.map((error, i) => (
        <div
          key={i}
          role="alert"
          className="flex items-start justify-between gap-3 bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-3 text-sm shadow-lg"
        >
          <span className="leading-snug">{error}</span>
          <button
            onClick={clearErrors}
            className="shrink-0 mt-0.5 text-red-400 hover:text-red-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
