// The shop's contents. Pure data — prices, unlock rules and display copy.
// Rendering styles for skins live in the UI layer keyed by these ids.

// Prices are tuned for a weeks-long journey: the first unlocks land in the
// first sessions (the taste), the tail is a long, satisfying grind.
export const SHAPES = Object.freeze([
  { id: 'circle', name: 'Bloop', desc: 'Round and ready.', unlock: { type: 'free' } },
  { id: 'square', name: 'Boxy', desc: 'Perfectly stable. Allegedly.', unlock: { type: 'free' } },
  { id: 'triangle', name: 'Pointy', desc: 'Three corners of trouble.', unlock: { type: 'coins', price: 250 } },
  { id: 'hexagon', name: 'Hexa', desc: 'The bestagon.', unlock: { type: 'coins', price: 500 } },
  { id: 'pentagon', name: 'Penny', desc: 'Five sides, zero chill.', unlock: { type: 'coins', price: 900 } },
  { id: 'star', name: 'Twinkle', desc: 'Born to sparkle.', unlock: { type: 'coins', price: 1600 } },
  { id: 'blob', name: 'Blobbo', desc: 'Never the same twice.', unlock: { type: 'coins', price: 2800 } },
  { id: 'flower', name: 'Bloom', desc: 'Petal to the metal.', unlock: { type: 'coins', price: 4500 } },
  { id: 'diamond', name: 'Gem', desc: 'Reach level 12 to unlock.', unlock: { type: 'level', level: 12 } },
  { id: 'heart', name: 'Lovey', desc: 'Land 60 PERFECTs to unlock.', unlock: { type: 'perfects', count: 60 } },
  { id: 'crescent', name: 'Luna', desc: 'Reach level 18 to unlock.', unlock: { type: 'level', level: 18 } },
  { id: 'lightning', name: 'Zappy', desc: 'Reach level 26 to unlock.', unlock: { type: 'level', level: 26 } },
].map(Object.freeze));

export const SKINS = Object.freeze([
  { id: 'classic', name: 'Classic', desc: 'The original vibe.', price: 0 },
  { id: 'candy', name: 'Candy', desc: 'Sweet striped pops.', price: 800 },
  { id: 'ocean', name: 'Ocean', desc: 'Waves and bubbles.', price: 1500 },
  { id: 'neon', name: 'Neon', desc: 'Midnight arcade glow.', price: 2500 },
  { id: 'sunset', name: 'Sunset', desc: 'Golden hour, always.', price: 4000 },
  { id: 'galaxy', name: 'Galaxy', desc: 'A nebula of your own.', price: 6000 },
  { id: 'lava', name: 'Lava', desc: 'Do not touch. Too late.', price: 9000 },
  { id: 'gold', name: 'Gold', desc: 'For absolute legends.', price: 15000 },
].map(Object.freeze));

export const UPGRADES = Object.freeze([
  {
    id: 'steady',
    name: 'Steady Hands',
    desc: 'Your shape wobbles less.',
    icon: '🫱',
    costs: [500, 2000, 6000],
  },
  {
    id: 'zen',
    name: 'Zen Mode',
    desc: 'Your shape grows a little slower.',
    icon: '🧘',
    costs: [800, 2600, 7500],
  },
  {
    id: 'forgive',
    name: 'Forgiveness',
    desc: 'Wider PERFECT and GOOD windows.',
    icon: '🤗',
    costs: [1200, 3800, 9500],
  },
  {
    id: 'midas',
    name: 'Midas Touch',
    desc: 'Earn more coins from every round.',
    icon: '👑',
    costs: [1500, 4500, 9000, 16000],
  },
  {
    id: 'life',
    name: 'Extra Life',
    desc: 'One more heart every run.',
    icon: '💖',
    costs: [3500, 12000],
  },
].map(Object.freeze));

export const shapeById = (id) => SHAPES.find((s) => s.id === id);
export const skinById = (id) => SKINS.find((s) => s.id === id);
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

export const FREE_SHAPES = Object.freeze(SHAPES.filter((s) => s.unlock.type === 'free').map((s) => s.id));
export const FREE_SKINS = Object.freeze(SKINS.filter((s) => s.price === 0).map((s) => s.id));
