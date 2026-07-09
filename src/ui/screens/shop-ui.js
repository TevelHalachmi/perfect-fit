// The shop: three tabs of cards (shapes / skins / upgrades) rendered from
// core.shop view models. All money logic stays in the core — this file
// only draws state and forwards taps.

import { drawShapeSprite } from '../draw-shape.js';
import { getSkinStyle } from '../skins.js';
import { icon, glyph as glyphIcon } from '../icons.js';

const PREVIEW_SIZE = 84;
const PREVIEW_DPR = 2;

export function createShopScreen(el, { core, audio, onBack }) {
  el.innerHTML = `
    <div class="shop-head">
      <button class="btn btn-ghost btn-small" id="shop-back">← BACK</button>
      <div class="shop-title">SHOP</div>
      <div class="hud-pill">${icon('coin')}<span id="shop-coins">0</span></div>
    </div>
    <div class="shop-tabs">
      <button class="tab-btn active" data-tab="shapes">SHAPES</button>
      <button class="tab-btn" data-tab="skins">SKINS</button>
      <button class="tab-btn" data-tab="upgrades">UPGRADES</button>
    </div>
    <div class="shop-scroll"><div class="shop-grid" id="shop-grid"></div></div>
  `;

  const grid = el.querySelector('#shop-grid');
  const coinsEl = el.querySelector('#shop-coins');
  let tab = 'shapes';
  let visible = false;

  el.querySelector('#shop-back').addEventListener('click', onBack);
  for (const btn of el.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      for (const b of el.querySelectorAll('.tab-btn')) b.classList.toggle('active', b === btn);
      render();
    });
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-btn');
    if (!btn || btn.disabled) return;
    const { id, action } = btn.dataset;
    if (action === 'buy') {
      if (!core.shop.buy(id)) {
        audio?.deny();
        btn.classList.remove('wiggle');
        void btn.offsetWidth;
        btn.classList.add('wiggle');
      }
    } else if (action === 'equip') {
      audio?.uiTap();
      core.shop.equip(id);
    }
  });

  // Re-render on anything that changes card state (only while open).
  const rerender = () => visible && render();
  core.events.on('coins:change', ({ coins }) => {
    coinsEl.textContent = String(coins);
    rerender();
  });
  core.events.on('shop:purchase', rerender);
  core.events.on('shop:unlock', rerender);
  core.events.on('equip:change', rerender);

  function cardButton(item) {
    if (item.kind === 'upgrade') {
      if (item.owned) return `<button class="card-btn owned" disabled>MAXED ✓</button>`;
      return priceButton(item);
    }
    if (item.equipped) return `<button class="card-btn equipped-btn" disabled>EQUIPPED ✓</button>`;
    if (item.owned)
      return `<button class="card-btn" data-action="equip" data-id="${item.id}">EQUIP</button>`;
    if (item.price == null)
      return `<button class="card-btn milestone" disabled>${icon('lock')} ${item.lockText}</button>`;
    return priceButton(item);
  }

  function priceButton(item) {
    const cls = item.canBuy.ok ? '' : ' cant-afford';
    return `<button class="card-btn${cls}" data-action="buy" data-id="${item.id}">
      ${icon('coin')}${item.price}</button>`;
  }

  function render() {
    const items = core.shop.listItems(tab);
    coinsEl.textContent = String(core.getState().coins);

    grid.innerHTML = items
      .map((item) => {
        const preview =
          item.kind === 'upgrade'
            ? `<div class="card-emoji">${glyphIcon(item.icon)}</div>`
            : `<canvas data-preview="${item.id}" width="${PREVIEW_SIZE * PREVIEW_DPR}" height="${PREVIEW_SIZE * PREVIEW_DPR}"></canvas>`;
        const pips =
          item.kind === 'upgrade'
            ? `<div class="upgrade-pips">${Array.from(
                { length: item.maxLevel },
                (_, i) => `<span class="pip${i < item.level ? ' filled' : ''}"></span>`
              ).join('')}</div>`
            : '';
        return `<div class="shop-card${item.equipped ? ' equipped' : ''}${item.owned ? '' : ' locked'}">
          ${preview}
          <div class="card-name">${item.name}</div>
          ${pips}
          <div class="card-desc">${item.desc}</div>
          ${cardButton(item)}
        </div>`;
      })
      .join('');

    // paint previews after the DOM lands
    for (const canvas of grid.querySelectorAll('canvas[data-preview]')) {
      paintPreview(canvas, canvas.dataset.preview);
    }
  }

  function paintPreview(canvas, id) {
    const ctx = canvas.getContext('2d');
    const s = PREVIEW_SIZE;
    ctx.setTransform(PREVIEW_DPR, 0, 0, PREVIEW_DPR, 0, 0);
    ctx.clearRect(0, 0, s, s);

    if (tab === 'skins') {
      const style = getSkinStyle(id);
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, style.bg[0]);
      g.addColorStop(1, style.bg[1]);
      ctx.fillStyle = g;
      roundRect(ctx, 2, 2, s - 4, s - 4, 14);
      ctx.fill();
      ctx.save();
      ctx.translate(s / 2, s / 2);
      drawShapeSprite(ctx, { shapeId: 'circle', r: s * 0.3, style, mood: 'idle', t: 1 });
      ctx.restore();
    } else {
      const style = getSkinStyle(core.getState().equippedSkin);
      ctx.save();
      ctx.translate(s / 2, s / 2);
      drawShapeSprite(ctx, { shapeId: id, r: s * 0.36, style, mood: 'idle', t: 1, blobSeed: 5 });
      ctx.restore();
    }
  }

  return {
    el,
    show() {
      visible = true;
      el.classList.remove('hidden');
      render();
    },
    hide() {
      visible = false;
      el.classList.add('hidden');
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
