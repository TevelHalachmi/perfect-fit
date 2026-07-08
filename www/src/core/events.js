// Minimal typed-string event emitter. on() returns an unsubscribe function
// so screens can tear their listeners down without leaking.

export function createEmitter() {
  const listeners = new Map(); // type -> Set<fn>

  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      const set = listeners.get(type);
      set.add(fn);
      return () => {
        set.delete(fn);
        if (set.size === 0) listeners.delete(type);
      };
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      // copy so a listener unsubscribing mid-emit can't skip others
      for (const fn of [...set]) fn(payload);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}
