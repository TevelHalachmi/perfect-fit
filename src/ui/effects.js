// Screen-level juice: shake, white flash, slow-mo, squash-and-stretch and
// pooled floating texts. Updated with real dt; exposes a time scale the
// app applies to the core during celebrations.

const TEXT_POOL = 14;

export class Effects {
  #shakeMag = 0;
  #shakeX = 0;
  #shakeY = 0;
  #flash = 0;
  #slowTimer = 0;
  #squashT = Infinity;
  #texts = Array.from({ length: TEXT_POOL }, () => ({
    active: false, text: '', x: 0, y: 0, vy: 0, life: 0, ttl: 1, size: 22, color: '#fff', delay: 0,
  }));

  get timeScale() {
    return this.#slowTimer > 0 ? 0.25 : 1;
  }

  shake(mag = 6) {
    this.#shakeMag = Math.max(this.#shakeMag, mag);
  }

  flash(strength = 0.55) {
    this.#flash = Math.max(this.#flash, strength);
  }

  slowMo(seconds = 0.35) {
    this.#slowTimer = Math.max(this.#slowTimer, seconds);
  }

  squash() {
    this.#squashT = 0;
  }

  floatText(text, x, y, { size = 24, color = '#ffffff', ttl = 1.0, delay = 0 } = {}) {
    const slot = this.#texts.find((t) => !t.active);
    if (!slot) return;
    Object.assign(slot, { active: true, text, x, y, vy: -55, life: 0, ttl, size, color, delay });
  }

  update(dt) {
    this.#slowTimer = Math.max(0, this.#slowTimer - dt);
    this.#flash = Math.max(0, this.#flash - dt * 3.2);
    this.#shakeMag = Math.max(0, this.#shakeMag - dt * 26);
    if (this.#shakeMag > 0.01) {
      this.#shakeX = (Math.random() * 2 - 1) * this.#shakeMag;
      this.#shakeY = (Math.random() * 2 - 1) * this.#shakeMag;
    } else {
      this.#shakeX = 0;
      this.#shakeY = 0;
    }
    if (this.#squashT !== Infinity) {
      this.#squashT += dt;
      if (this.#squashT > 0.45) this.#squashT = Infinity;
    }
    for (const t of this.#texts) {
      if (!t.active) continue;
      if (t.delay > 0) {
        t.delay -= dt;
        continue;
      }
      t.life += dt;
      if (t.life >= t.ttl) t.active = false;
      t.y += t.vy * dt;
      t.vy *= 1 - 1.8 * dt;
    }
  }

  // fx bundle consumed by the renderer
  frame() {
    let squashX = 1;
    let squashY = 1;
    if (this.#squashT !== Infinity) {
      const k = Math.exp(-7 * this.#squashT) * Math.cos(16 * this.#squashT) * 0.26;
      squashX = 1 + k;
      squashY = 1 - k;
    }
    return {
      shakeX: this.#shakeX,
      shakeY: this.#shakeY,
      flash: this.#flash,
      squashX,
      squashY,
    };
  }

  drawTexts(ctx) {
    for (const t of this.#texts) {
      if (!t.active || t.delay > 0) continue;
      const k = t.life / t.ttl;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      const popScale = k < 0.18 ? 0.6 + (k / 0.18) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(t.x, t.y);
      ctx.scale(popScale, popScale);
      ctx.font = `900 ${t.size}px Nunito, "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, t.size * 0.16);
      ctx.strokeStyle = 'rgba(20,10,40,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
}
