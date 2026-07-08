// Vibration wrapper. navigator.vibrate covers Android (and is a silent
// no-op elsewhere); if the app runs inside Capacitor with the Haptics
// plugin installed, use it opportunistically. Never imported — only
// feature-detected — so the web build stays dependency-free.

export function createHaptics(core) {
  const enabled = () => core.getState().settings.haptics;

  function buzz(pattern) {
    if (!enabled()) return;
    try {
      const cap = window.Capacitor?.Plugins?.Haptics;
      if (cap?.impact) {
        cap.impact({ style: 'MEDIUM' }).catch?.(() => {});
        return;
      }
      navigator.vibrate?.(pattern);
    } catch {
      /* haptics are decorative */
    }
  }

  return {
    success: () => buzz(15),
    perfect: () => buzz([10, 40, 20]),
    fail: () => buzz(60),
    pop: () => buzz([20, 30, 40]),
    buy: () => buzz(10),
    tick: () => buzz(4),
  };
}
