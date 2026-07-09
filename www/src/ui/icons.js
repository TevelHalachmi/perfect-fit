// Sprite icons (Twemoji SVGs, bundled in assets/icons — CC-BY 4.0).
// One look on every platform, instead of whatever the OS emoji font does.

export const icon = (name, cls = '') =>
  `<img class="icon${cls ? ` ${cls}` : ''}" src="assets/icons/${name}.svg" alt="" draggable="false">`;

// The core catalogs (upgrades, achievements) store platform-neutral emoji
// glyphs; the UI maps them to sprites here. Unknown glyphs fall back to text.
const EMOJI_ICON = {
  '🍼': 'bottle',
  '🎯': 'target',
  '📡': 'satellite',
  '🤖': 'robot',
  '🔟': 'ten',
  '🌊': 'wave',
  '😤': 'steam',
  '🌱': 'seedling',
  '🖐️': 'hand',
  '🔥': 'fire',
  '⚡': 'bolt',
  '🐷': 'pig',
  '💰': 'moneybag',
  '👗': 'dress',
  '🧺': 'basket',
  '🚀': 'rocket',
  '💥': 'collision',
  '🧈': 'butter',
  '🗓️': 'calendar',
  '📅': 'calendar-alt',
  '⚔️': 'swords',
  '🧘': 'zen',
  '📤': 'share',
  '🫱': 'hand-right',
  '🤗': 'hug',
  '👑': 'crown',
  '💖': 'heart-sparkle',
};

export const glyph = (emoji, cls = '') =>
  EMOJI_ICON[emoji] ? icon(EMOJI_ICON[emoji], cls) : `<span>${emoji}</span>`;
