// Pointer + keyboard input, routed to the core. Tracks the initiating
// pointer so multi-touch can't double-trigger, and treats interruptions
// (lost pointer, backgrounded tab) as penalty-free aborts.

export function attachInput(canvas, core, hooks = {}) {
  let activePointer = null;

  const down = (e) => {
    e.preventDefault();
    hooks.onDown?.(); // audio unlock etc. — must run inside the gesture
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    core.beginHold();
  };

  const up = (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    core.endHold();
    hooks.onUp?.();
  };

  const cancel = (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    core.abortHold();
    hooks.onUp?.();
  };

  const interrupt = () => {
    activePointer = null;
    core.abortHold();
    hooks.onUp?.();
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', interrupt);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) interrupt();
  });

  // desktop: hold Space
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    e.preventDefault();
    hooks.onDown?.();
    core.beginHold();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    core.endHold();
    hooks.onUp?.();
  });
}
