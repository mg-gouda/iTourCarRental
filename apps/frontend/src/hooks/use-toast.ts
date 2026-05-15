// Minimal shadcn-style toast hook
import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: React.ReactNode;
  duration?: number;
}

let toastIdCounter = 0;

// Module-level state so toasts work from anywhere
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toastStore: ToastItem[] = [];

function notify() {
  listeners.forEach((l) => l([...toastStore]));
}

export function toast(item: Omit<ToastItem, 'id'>) {
  const id = String(++toastIdCounter);
  const newToast: ToastItem = { ...item, id };
  toastStore = [...toastStore, newToast];
  notify();

  const duration = item.duration ?? 4000;
  if (duration > 0) {
    setTimeout(() => {
      toastStore = toastStore.filter((t) => t.id !== id);
      notify();
    }, duration);
  }

  return id;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>(toastStore);

  const subscribe = useCallback((listener: (t: ToastItem[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  // Re-render when store changes
  useState(() => {
    const unsub = subscribe(setToasts);
    return unsub;
  });

  const dismiss = useCallback((id: string) => {
    toastStore = toastStore.filter((t) => t.id !== id);
    notify();
  }, []);

  return { toasts, toast, dismiss };
}
