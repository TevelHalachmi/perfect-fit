// App shell: owns the render loop, routes between screens, and translates
// core events into juice — sound, haptics, particles, shake, floating text.

import { Renderer } from './renderer.js';
import { createHud } from './hud.js';
import { attachInput } from './input.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { ParticleSystem } from './particles.js';
import { createHaptics } from './haptics.js';
import { getSkinStyle } from './skins.js';
import { createTitleScreen } from './screens/title.js';
import { createResultsScreen } from './screens/results.js';
import { createShopScreen } from './screens/shop-ui.js';
import { createSettingsScreen } from './screens/settings.js';
import { createProgressScreen } from './screens/progress.js';
import { createLeaderboardScreen } from './screens/leaderboard.js';
import { showBanner, MODIFIER_BANNERS } from './banners.js';
import { shapeById } from '../core/catalog.js';
import { TUNING } from '../core/constants.js';

const SIZE_TICKS = [0.5, 0.75, 0.9];
const INVERT_TICKS = [1.25, 1.15, 1.05]; // shrinking: crossings go downward

export class App {
  #core;
  #renderer;
  #hud;
  #screens;
  #audio;
  #effects;
  #particles;
  #haptics;
  #mode = 'title'; // canvas mode: 'title' | 'game'
  #lastResultSuccess = null;
  #lastRunMode = 'normal'; // what RETRY restarts (zen retries zen)
  #shopReturnTo = 'title';
  #popHidden = false;
  #ticksCrossed = 0;
  #moteTimer = 0;
  #zoom = 1;
  #last = 0;

  constructor({ core, canvas, net = null }) {
    this.#core = core;
    this.#renderer = new Renderer(canvas);
    this.#audio = new AudioEngine();
    this.#audio.setEnabled(core.getState().settings.sound);
    this.#audio.setMusicEnabled(core.getState().settings.music !== false);
    this.#effects = new Effects();
    this.#particles = new ParticleSystem();
    this.#haptics = createHaptics(core);
    this.#hud = createHud(document.getElementById('hud'), core, {
      onQuit: () => core.quitRun(),
    });

    this.#screens = {
      title: createTitleScreen(document.getElementById('screen-title'), {
        core,
        net,
        onPlay: () => this.startGame(),
        onDaily: () => this.startDaily(),
        onZen: () => this.startGame({ mode: 'zen' }),
        onShop: () => this.openShop('title'),
        onProgress: () => this.openProgress('title'),
        onSettings: () => this.showScreen('settings'),
        onLeaderboard: () => {
          this.#shopReturnTo = 'title';
          this.showScreen('leaderboard');
        },
      }),
      leaderboard: createLeaderboardScreen(document.getElementById('screen-leaderboard'), {
        core,
        net: net ?? { enabled: false, onStatus: () => () => {}, leaderboard: async () => null },
        onBack: () => this.showScreen(this.#shopReturnTo),
      }),
      results: createResultsScreen(document.getElementById('screen-results'), {
        core,
        audio: this.#audio,
        onRetry: () => this.startGame({ mode: this.#lastRunMode }),
        onShop: () => this.openShop('results'),
        onHome: () => this.showTitle(),
      }),
      progress: createProgressScreen(document.getElementById('screen-progress'), {
        core,
        onBack: () => this.showScreen(this.#shopReturnTo),
      }),
      shop: createShopScreen(document.getElementById('screen-shop'), {
        core,
        audio: this.#audio,
        onBack: () => this.showScreen(this.#shopReturnTo),
      }),
      settings: createSettingsScreen(document.getElementById('screen-settings'), {
        core,
        onBack: () => this.showTitle(),
      }),
    };

    // Audio must wake inside a user gesture — any gesture.
    attachInput(canvas, core, { onDown: () => this.#audio.unlock() });
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        this.#audio.unlock();
        if (!btn.classList.contains('card-btn')) this.#audio.uiTap();
      },
      { capture: true }
    );

    this.#wireEvents();
  }

  // Player position on screen right now (bursts and popups spawn there).
  // Mirrors the renderer's boss camera zoom so effects land on the sprite.
  #playerPos() {
    const m = this.#renderer.metrics;
    const view = this.#core.getRoundView();
    if (!view) return { x: m.cx, y: m.cy, r: m.R };
    const R = m.R * (view.boss ? TUNING.boss.visualScale : 1);
    return {
      x: m.cx + view.wobbleX * R,
      y: m.cy + view.wobbleY * R,
      r: R * view.size,
    };
  }

  #skinStyle() {
    return getSkinStyle(this.#core.getState().equippedSkin);
  }

  #wireEvents() {
    const events = this.#core.events;

    events.on('hold:start', () => {
      this.#ticksCrossed = 0;
      this.#audio.startHum();
    });

    events.on('round:result', (r) => {
      this.#lastResultSuccess = r.success;
      this.#audio.stopHum();
      const { x, y, r: pr } = this.#playerPos();
      const style = this.#skinStyle();

      if (r.success) {
        this.#effects.squash();
        const perfect = r.band === 'perfect';
        this.#effects.ring(x, y, pr * 2.3, style.glow, { width: perfect ? 9 : 6 });
        if (perfect) this.#effects.ring(x, y, pr * 3.1, '#ffffff', { ttl: 0.7, width: 4, delay: 0.07 });
        this.#particles.burst({
          x, y,
          colors: style.particles,
          count: perfect ? 90 : 45,
          speed: perfect ? [180, 540] : [120, 420],
          kind: 'confetti',
        });
        this.#effects.floatText(
          perfect ? `PERFECT! ${r.accuracy}%` : `${r.accuracy}%`,
          x, y - pr - 34,
          { size: perfect ? 30 : 24, color: perfect ? '#ffd166' : '#ffffff' }
        );
        if (r.coins > 0) {
          this.#effects.floatText(`+${r.coins}`, x, y - pr - 4, {
            size: 22, color: '#ffd166', delay: 0.22,
          });
        }
        if (perfect) {
          this.#effects.flash(0.45);
          this.#effects.slowMo(0.35);
          this.#effects.shake(3);
          this.#audio.perfect(r.streak);
          this.#haptics.perfect();
        } else {
          this.#audio.success(r.streak);
          this.#haptics.success();
        }
      } else if (r.band !== 'pop') {
        this.#effects.shake(7);
        this.#effects.danger(0.5);
        this.#audio.fail();
        this.#haptics.fail();
        this.#particles.burst({
          x, y,
          colors: [style.shape[0], style.shape[1], style.shapeEdge],
          count: 26,
          speed: [80, 300],
          kind: 'shard',
        });
        const taunt = r.nearMiss
          ? `SO CLOSE! ${r.accuracy}%`
          : r.direction === 'small'
            ? 'TOO SHY!'
            : 'TOO GREEDY!';
        this.#effects.floatText(taunt, x, y - pr - 30, { size: 26, color: '#ff6b6b', ttl: 1.2 });
      }

      if (r.bossBeaten) {
        const { x, y, r: pr } = this.#playerPos();
        this.#audio.bossWin();
        this.#effects.floatText(`💰 +${r.chestCoins}`, x, y - pr - 64, {
          size: 28,
          color: '#ffd166',
          delay: 0.4,
          ttl: 1.3,
        });
      }

      if (r.newModifier && MODIFIER_BANNERS[r.newModifier]) {
        showBanner(MODIFIER_BANNERS[r.newModifier], 'pink');
      }
    });

    events.on('round:boss', () => {
      showBanner('⚔️ BOSS LEVEL!', 'red');
      this.#audio.bossSting();
      this.#effects.shake(4);
    });

    events.on('mission:complete', ({ name, reward }) => {
      showBanner(`🎯 MISSION: ${name.toUpperCase()} +${reward}`, '');
      this.#audio.buy();
    });

    events.on('achievement:unlock', ({ name, reward }) => {
      showBanner(`🏅 ${name.toUpperCase()} +${reward}`, 'gold');
      this.#audio.levelUp();
    });

    events.on('round:pop', () => {
      const { x, y } = this.#playerPos();
      const style = this.#skinStyle();
      this.#popHidden = true;
      this.#audio.stopHum();
      this.#audio.pop();
      this.#haptics.pop();
      this.#effects.shake(12);
      this.#effects.flash(0.25);
      this.#effects.danger(0.65);
      this.#effects.floatText('POP!', x, y - 20, { size: 34, color: '#ff6b6b', ttl: 1.1 });
      this.#particles.burst({
        x, y,
        colors: [style.shape[0], style.shape[1], style.shapeEdge, '#ffffff'],
        count: 70,
        speed: [200, 620],
        kind: 'shard',
        gravity: 900,
      });
    });

    events.on('round:falseStart', () => {
      this.#audio.stopHum();
      this.#audio.falseStart();
    });

    events.on('run:end', (result) => {
      this.#audio.stopHum();
      this.#audio.stopPad();
      this.#audio.startMusic(); // the lullaby returns while you lick wounds
      this.#hud.hide();
      this.#screens.results.show(result);
    });

    events.on('shop:purchase', () => {
      this.#audio.buy();
      this.#haptics.buy();
    });

    events.on('shop:unlock', ({ id }) => {
      const shape = shapeById(id);
      if (shape) showBanner(`✨ UNLOCKED: ${shape.name.toUpperCase()}!`, 'gold');
      this.#audio.levelUp();
    });

    events.on('settings:change', ({ key, value }) => {
      if (key === 'sound') this.#audio.setEnabled(value);
      if (key === 'music') this.#audio.setMusicEnabled(value);
    });

    events.on('level:change', ({ level }) => {
      if (level > 1 && this.#mode === 'game') {
        const m = this.#renderer.metrics;
        this.#effects.floatText(`LEVEL ${level}`, m.cx, m.cy - m.R * 1.45, {
          size: 22,
          color: '#c9bfe8',
          ttl: 0.9,
        });
      }
    });
  }

  // ---------- navigation ----------

  showScreen(name, payload) {
    for (const [key, screen] of Object.entries(this.#screens)) {
      if (key !== name) screen.hide();
    }
    if (name) this.#screens[name].show(payload);
  }

  showTitle() {
    this.#audio.stopPad();
    this.#audio.startMusic();
    this.#core.toTitle();
    this.#mode = 'title';
    this.#hud.hide();
    this.showScreen('title');
  }

  startGame({ mode = 'normal' } = {}) {
    if (mode === 'daily') {
      this.startDaily();
      return;
    }
    this.showScreen(null);
    this.#mode = 'game';
    this.#lastResultSuccess = null;
    this.#lastRunMode = mode;
    this.#popHidden = false;
    this.#audio.stopMusic();
    this.#core.startRun({ mode });
    if (mode === 'zen') this.#audio.startPad();
    this.#hud.show();
  }

  startDaily() {
    if (!this.#core.startDaily()) return; // locked — button state explains why
    this.showScreen(null);
    this.#mode = 'game';
    this.#lastResultSuccess = null;
    this.#lastRunMode = 'daily';
    this.#popHidden = false;
    this.#audio.stopMusic();
    this.#hud.show();
  }

  openShop(returnTo) {
    this.#shopReturnTo = returnTo;
    this.showScreen('shop');
  }

  openProgress(returnTo) {
    this.#shopReturnTo = returnTo;
    this.showScreen('progress');
  }

  // ---------- loop ----------

  start() {
    this.showTitle();
    this.#last = performance.now();
    requestAnimationFrame(this.#frame);
  }

  get counters() {
    return {
      particles: this.#particles.activeCount,
      particlePool: this.#particles.poolSize,
      audioVoices: this.#audio.activeVoices,
    };
  }

  #frame = (now) => {
    const dt = Math.min((now - this.#last) / 1000, 0.05);
    this.#last = now;

    this.#core.tick(dt * this.#effects.timeScale);
    this.#effects.update(dt);
    this.#particles.update(dt);

    const state = this.#core.getState();
    const t = now / 1000;

    if (this.#mode === 'title') {
      this.#renderer.draw({
        mode: 'title',
        shapeId: state.equippedShape,
        skinId: state.equippedSkin,
        t,
        fx: this.#effects.frame(),
        particles: this.#particles,
        drawTexts: (ctx) => this.#effects.drawTexts(ctx),
      });
    } else {
      const view = this.#core.getRoundView();
      if (state.phase === 'roundIdle') this.#popHidden = false;

      this.#audio.updatePad();
      this.#audio.updateMusic();
      if (view?.holding) {
        const wobbleNorm = Math.min(1, (Math.abs(view.wobbleX) + Math.abs(view.wobbleY)) / 0.06);
        this.#audio.updateHum(view.size, wobbleNorm);
        const inverted = view.modifiers.includes('invert');
        const ticks = inverted ? INVERT_TICKS : SIZE_TICKS;
        while (
          this.#ticksCrossed < ticks.length &&
          (inverted ? view.size <= ticks[this.#ticksCrossed] : view.size >= ticks[this.#ticksCrossed])
        ) {
          this.#audio.sizeTick(this.#ticksCrossed);
          this.#haptics.tick();
          this.#ticksCrossed++;
        }
      }

      // rising motes while holding; embers when the streak burns
      this.#moteTimer -= dt;
      const style = this.#skinStyle();
      if (this.#moteTimer <= 0 && view && (view.holding || state.streak >= 5)) {
        this.#moteTimer = view.holding ? 0.07 : 0.16;
        const { x, y, r } = this.#playerPos();
        this.#particles.burst({
          x: x + (Math.random() - 0.5) * r * 1.6,
          y: y + r * (0.55 + Math.random() * 0.3),
          colors: state.streak >= 5 ? ['#ffd166', '#ff8f5e', style.glow] : [style.glow, '#ffffff'],
          count: 1,
          speed: [10, 34],
          angle: -Math.PI / 2,
          spread: 0.9,
          gravity: -70,
          ttl: [0.5, 1.0],
          size: [2, 4.5],
          kind: 'mote',
        });
      }

      // camera eases in while you hold, back out when you let go
      const zoomTarget = view?.holding ? 1 + 0.035 * Math.min(1, view.size) : 1;
      this.#zoom += (zoomTarget - this.#zoom) * Math.min(1, dt * 7);

      const mood =
        state.phase === 'holding'
          ? 'strain'
          : state.phase === 'resolving' || state.phase === 'gameover'
            ? this.#lastResultSuccess
              ? 'happy'
              : 'dead'
            : 'idle';

      this.#renderer.draw({
        mode: 'game',
        view,
        skinId: state.equippedSkin,
        level: state.level,
        mood,
        moodIntensity: view ? Math.max(0, Math.min(1, (view.ratio - 0.75) * 2.2)) : 0,
        t,
        fx: this.#effects.frame(),
        breathe: state.phase === 'roundIdle',
        zoom: this.#zoom,
        hidePlayer: this.#popHidden,
        particles: this.#particles,
        drawTexts: (ctx) => this.#effects.drawTexts(ctx),
      });
    }
    requestAnimationFrame(this.#frame);
  };
}
