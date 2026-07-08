// Procedural sound engine. Every effect is synthesized live with Web Audio
// — no audio files. Design notes:
//   · one AudioContext, created lazily and resumed inside user gestures
//     (mobile browsers refuse autoplay otherwise)
//   · master chain: voices → compressor → destination, so stacked effects
//     stay punchy without clipping
//   · the grow hum is ONE persistent voice that is gain-gated, never
//     recreated — pitch rides the shape's size
//   · every one-shot node is stop()ed and disconnected onended: no leaks
//   · a soft voice cap keeps pathological spam from stacking up

const VOICE_CAP = 16;

export class AudioEngine {
  #ctx = null;
  #master = null;
  #noiseBuffer = null;
  #hum = null; // { osc1, osc2, gain, filter, lfo, lfoGain }
  #voices = 0;
  #enabled = true;
  #humLevel = 0.11;

  setEnabled(on) {
    this.#enabled = on;
    if (!on) this.stopHum();
  }

  get enabled() {
    return this.#enabled;
  }

  get activeVoices() {
    return this.#voices;
  }

  // Call inside every pointerdown — creates/resumes the context legally.
  unlock() {
    if (!this.#ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.#ctx = new AC();
      this.#master = this.#ctx.createDynamicsCompressor();
      this.#master.threshold.value = -18;
      this.#master.ratio.value = 4;
      this.#master.knee.value = 12;
      this.#master.connect(this.#ctx.destination);

      const len = this.#ctx.sampleRate; // 1s of white noise, shared
      this.#noiseBuffer = this.#ctx.createBuffer(1, len, this.#ctx.sampleRate);
      const data = this.#noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
  }

  #ready() {
    return this.#enabled && this.#ctx && this.#ctx.state === 'running';
  }

  #spawn(build, lifeSeconds) {
    if (!this.#ready() || this.#voices >= VOICE_CAP) return;
    this.#voices++;
    const done = () => {
      this.#voices--;
    };
    try {
      build(this.#ctx, this.#master);
      // voice bookkeeping is time-based; nodes clean themselves via onended
      setTimeout(done, Math.ceil(lifeSeconds * 1000));
    } catch {
      done();
    }
  }

  #osc(ctx, out, { type = 'sine', freq = 440, to = null, at, dur, gain = 0.2, decay, glide }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + (glide ?? dur));
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + (decay ?? dur));
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    return osc;
  }

  #noise(ctx, out, { at, dur, gain = 0.3, band = null, from = null, to = null, highpass = null }) {
    const src = ctx.createBufferSource();
    src.buffer = this.#noiseBuffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    let head = src;
    let filter = null;
    if (band || from) {
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(from ?? band, at);
      if (to) filter.frequency.exponentialRampToValueAtTime(to, at + dur);
      head.connect(filter);
      head = filter;
    } else if (highpass) {
      filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      head.connect(filter);
      head = filter;
    }
    head.connect(g).connect(out);
    src.start(at);
    src.stop(at + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      filter?.disconnect();
      g.disconnect();
    };
  }

  // ---------- the grow hum ----------

  startHum() {
    if (!this.#ready()) return;
    if (!this.#hum) {
      const ctx = this.#ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.3;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain).connect(osc1.frequency);
      osc1.connect(filter);
      osc2.connect(osc2Gain).connect(filter);
      filter.connect(gain).connect(this.#master);
      osc1.start();
      osc2.start();
      lfo.start();
      this.#hum = { osc1, osc2, gain, filter, lfo, lfoGain };
    }
    const t = this.#ctx.currentTime;
    this.#hum.gain.gain.cancelScheduledValues(t);
    this.#hum.gain.gain.setTargetAtTime(this.#humLevel, t, 0.03);
  }

  // size ∈ [0..~1.2], wobble ∈ [0..1] — called every frame while holding
  updateHum(size, wobble) {
    // the context resumes asynchronously on first gesture; catch up here
    if (!this.#hum && this.#ready()) this.startHum();
    if (!this.#hum || !this.#ready()) return;
    const t = this.#ctx.currentTime;
    const f = 120 + 400 * Math.pow(Math.max(0, size), 1.4);
    this.#hum.osc1.frequency.setTargetAtTime(f, t, 0.02);
    this.#hum.osc2.frequency.setTargetAtTime(f * 2, t, 0.02);
    this.#hum.filter.frequency.setTargetAtTime(800 + 1500 * size, t, 0.03);
    this.#hum.lfoGain.gain.setTargetAtTime(3 + 9 * wobble, t, 0.05);
  }

  stopHum() {
    if (!this.#hum || !this.#ctx) return;
    const t = this.#ctx.currentTime;
    this.#hum.gain.gain.cancelScheduledValues(t);
    this.#hum.gain.gain.setTargetAtTime(0, t, 0.02);
  }

  // ---------- one-shots ----------

  // Pentatonic ladder: the success melody climbs as your streak grows.
  #pentatonic(step) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880]; // C5 D5 E5 G5 A5
    const capped = Math.min(step, 10);
    const octave = Math.floor(capped / scale.length);
    return scale[capped % scale.length] * Math.pow(2, octave);
  }

  success(streak = 1) {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      // pop
      this.#osc(ctx, out, { type: 'sine', freq: 300, to: 120, at: t, dur: 0.12, gain: 0.5, glide: 0.09 });
      this.#noise(ctx, out, { at: t, dur: 0.05, gain: 0.18, band: 2000 });
      // rising chime arpeggio
      const root = this.#pentatonic(streak - 1);
      [1, 1.25, 1.5].forEach((mult, i) => {
        const at = t + 0.05 + i * 0.09;
        this.#osc(ctx, out, { type: 'triangle', freq: root * mult, at, dur: 0.4, gain: 0.16, decay: 0.35 });
        this.#osc(ctx, out, { type: 'sine', freq: root * mult * 2, at, dur: 0.3, gain: 0.05, decay: 0.28 });
      });
    }, 0.9);
  }

  perfect(streak = 1) {
    this.success(streak);
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      // maj7 sparkle on top + sub thump + glissando grains + shimmer
      const root = this.#pentatonic(streak - 1);
      this.#osc(ctx, out, { type: 'triangle', freq: root * 1.875, at: t + 0.32, dur: 0.5, gain: 0.14, decay: 0.45 });
      this.#osc(ctx, out, { type: 'sine', freq: 55, at: t, dur: 0.3, gain: 0.6, decay: 0.25 });
      for (let i = 0; i < 6; i++) {
        const at = t + 0.05 * i;
        const f = 1200 + (2000 * i) / 5;
        this.#osc(ctx, out, { type: 'sine', freq: f, at, dur: 0.12, gain: 0.11, decay: 0.11 });
      }
      this.#noise(ctx, out, { at: t + 0.05, dur: 0.5, gain: 0.06, highpass: 6000 });
    }, 1.0);
  }

  fail() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      const womp = ctx.createOscillator();
      womp.type = 'sawtooth';
      womp.frequency.setValueAtTime(220, t);
      womp.frequency.exponentialRampToValueAtTime(70, t + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      womp.connect(lp).connect(g).connect(out);
      womp.start(t);
      womp.stop(t + 0.5);
      womp.onended = () => {
        womp.disconnect();
        lp.disconnect();
        g.disconnect();
      };
      this.#noise(ctx, out, { at: t + 0.02, dur: 0.3, gain: 0.2, from: 1200, to: 300 });
    }, 0.6);
  }

  pop() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#noise(ctx, out, { at: t, dur: 0.09, gain: 0.65, band: 3200 });
      this.#osc(ctx, out, { type: 'sine', freq: 180, to: 50, at: t, dur: 0.2, gain: 0.6, glide: 0.15 });
      [900, 640, 420].forEach((f, i) => {
        this.#osc(ctx, out, { type: 'square', freq: f, at: t + 0.06 + i * 0.07, dur: 0.07, gain: 0.07 });
      });
    }, 0.5);
  }

  sizeTick(index) {
    const freqs = [660, 880, 1100];
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#osc(ctx, out, { type: 'sine', freq: freqs[index] ?? 660, at: t, dur: 0.05, gain: 0.15 });
    }, 0.1);
  }

  coinTick(pitchStep = 0) {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      const mult = Math.pow(2, Math.min(pitchStep, 12) / 24);
      this.#osc(ctx, out, { type: 'square', freq: 988 * mult, at: t, dur: 0.03, gain: 0.09 });
      this.#osc(ctx, out, { type: 'square', freq: 1319 * mult, at: t + 0.03, dur: 0.05, gain: 0.09 });
    }, 0.15);
  }

  uiTap() {
    this.#spawn((ctx, out) => {
      this.#osc(ctx, out, { type: 'sine', freq: 440, at: ctx.currentTime, dur: 0.04, gain: 0.12 });
    }, 0.1);
  }

  buy() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#osc(ctx, out, { type: 'triangle', freq: 523, at: t, dur: 0.09, gain: 0.2 });
      this.#osc(ctx, out, { type: 'triangle', freq: 784, at: t + 0.09, dur: 0.16, gain: 0.2, decay: 0.15 });
      this.#osc(ctx, out, { type: 'sine', freq: 1568, at: t + 0.15, dur: 0.2, gain: 0.08, decay: 0.18 });
    }, 0.5);
  }

  deny() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#osc(ctx, out, { type: 'square', freq: 160, at: t, dur: 0.07, gain: 0.1 });
      this.#osc(ctx, out, { type: 'square', freq: 140, at: t + 0.09, dur: 0.09, gain: 0.1 });
    }, 0.25);
  }

  levelUp() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#osc(ctx, out, { type: 'triangle', freq: 392, to: 784, at: t, dur: 0.16, gain: 0.15, glide: 0.15 });
    }, 0.3);
  }

  falseStart() {
    this.#spawn((ctx, out) => {
      const t = ctx.currentTime;
      this.#osc(ctx, out, { type: 'sine', freq: 340, to: 240, at: t, dur: 0.08, gain: 0.1, glide: 0.08 });
    }, 0.15);
  }
}
