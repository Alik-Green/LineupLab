import { useCallback, useRef, useState } from 'react';
export function useHistory<T>(initial: T, limit = 200) {
  const [state, setState] = useState(initial);
  const past = useRef<T[]>([]); const future = useRef<T[]>([]);
  const [, force] = useState(0);
  const set = useCallback((next: T | ((prev: T) => T), record = true) => {
    setState(prev => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (record && JSON.stringify(value) !== JSON.stringify(prev)) { past.current.push(prev); if (past.current.length > limit) past.current.shift(); future.current = []; }
      return value;
    });
    force(n => n + 1);
  }, [limit]);
  const undo = useCallback(() => { setState(prev => { const old = past.current.pop(); if (old === undefined) return prev; future.current.push(prev); return old; }); force(n => n + 1); }, []);
  const redo = useCallback(() => { setState(prev => { const next = future.current.pop(); if (next === undefined) return prev; past.current.push(prev); return next; }); force(n => n + 1); }, []);
  const reset = useCallback((value: T) => { past.current = []; future.current = []; setState(value); force(n => n + 1); }, []);
  return { state, set, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
