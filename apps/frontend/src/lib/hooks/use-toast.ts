'use client';

import * as React from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

type ToastInput = Omit<Toast, 'id'>;

interface ToastState {
  toasts: Toast[];
}

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string };

let count = 0;
function genId() { return `toast-${++count}`; }

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 5) };
    case 'DISMISS':
      return { toasts: state.toasts.map((t) => t.id === action.id ? { ...t, _dismissed: true } as Toast : t) };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

export function toast(input: ToastInput) {
  const id = genId();
  const duration = input.duration ?? 4000;

  dispatch({ type: 'ADD', toast: { id, ...input } });

  setTimeout(() => {
    dispatch({ type: 'DISMISS', id });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 200);
  }, duration);

  return id;
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: 'DISMISS', id }),
  };
}
