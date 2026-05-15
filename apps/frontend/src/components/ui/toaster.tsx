'use client';

import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 end-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={cn(
            'flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5',
            t.variant === 'destructive' && 'border-destructive bg-destructive/5 text-destructive',
          )}
        >
          <div className="mt-0.5 shrink-0">
            {t.variant === 'destructive' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="flex-1 space-y-0.5">
            {t.title && <p className="text-sm font-semibold">{t.title}</p>}
            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
