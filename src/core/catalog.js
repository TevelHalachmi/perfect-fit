// The shop's contents. Pure data — prices, unlock rules and display copy.
// Rendering styles for skins live in the UI layer keyed by these ids.

export const SHAPES = Object.freeze([
  { id: 'circle', name: 'Bloop', desc: 'Round and ready.', unlock: { type: 'free' } },
  { id: 'square', name: 'Boxy', desc: 'Perfectly stable. Allegedly.', unlock: { type: 'free' } },
  { id: 'triangle', name: 'Pointy', desc: 'Three corners of trouble.', unlock: { type: 'coins', price: 100 } },
  { id: 'hexagon', name: 'Hexa', desc: 'The bestagon.', unlock: { type: 'coins', price: 150 } },
  { id: 'pentagon', name: 'Penny', desc: 'Five sides, zero chill.', unlock: { type: 'coins', price: 250 } },
  { id: 'star', name: 'Twinkle', desc: 'Born to sparkle.', unlock: { type: 'coins', price: 400 } },
  { id: 'blob', name: 'Blobbo', desc: 'Never the same twice.', unlock: { type: 'coins', price: 600 } },
  { id: 'flower', name: 'Bloom', desc: 'Petal to the metal.', unlock: { type: 'coins', price: 900 } },
  { id: 'diamond', name: 'Gem', desc: 'Reach level 8 to unlock.', unlock: { type: 'level', level: 8 } },
  { id: 'heart', name: 'Lovey', desc: 'Land 25 PERFECTs to unlock.', unlock: { type: 'perfects', count: 25 } },
  { id: 'crescent', name: 'Luna', desc: 'Reach level 15 to unlock.', unlock: { type: 'level', level: 15 } },
  { id: 'lightning', name: 'Zappy', desc: 'Reach level 22 to unlock.', unlock: { type: 'level', level: 22 } },
].map(Object.freeze));

export const SKINS = Object.freeze([
  { id: 'classic', name: 'Classic', desc: 'The original vibe.', price: 0 },
  { id: 'candy', name: 'Candy', desc: 'Sweet pastel pops.', price: 200 },
  { id: 'ocean', name: 'Ocean', desc: 'Deep blue calm.', price: 350 },
  { id: 'neon', name: 'Neon', desc: 'Midnight arcade glow.', price: 500 },
  { id: 'sunset', name: 'Sunset', desc: 'Golden hour, always.', price: 650 },
  { id: 'galaxy', name: 'Galaxy', desc: 'Shapes among the stars.', price: 800 },
  { id: 'lava', name: 'Lava', desc: 'Do not touch. Too late.', price: 1000 },
  { id: 'gold', name: 'Gold', desc: 'For absolute legends.', price: 1500 },
].map(Object.freeze));

export const UPGRADES = Object.freeze([
  {
    id: 'steady',
    name: 'Steady Hands',
    desc: 'Your shape wobbles less.',
    icon: '🫱',
    costs: [150, 400, 900],
  },
  {
    id: 'zen',
    name: 'Zen Mode',
    desc: 'Your shape grows a little slower.',
    icon: '🧘',
    costs: [200, 500, 1100],
  },
  {
    id: 'forgive',
    name: 'Forgiveness',
    desc: 'Wider PERFECT and GOOD windows.',
    icon: '🤗',
    costs: [250, 600, 1300],
  },
  {
    id: 'midas',
    name: 'Midas Touch',
    desc: 'Earn more coins from every round.',
    icon: '👑',
    costs: [300, 700, 1200, 2000],
  },
  {
    id: 'life',
    name: 'Extra Life',
    desc: 'One more heart every run.',
    icon: '💖',
    costs: [500, 1500],
  },
].map(Object.freeze));

export const shapeById = (id) => SHAPES.find((s) => s.id === id);
export const skinById = (id) => SKINS.find((s) => s.id === id);
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

export const FREE_SHAPES = Object.freeze(SHAPES.filter((s) => s.unlock.type === 'free').map((s) => s.id));
export const FREE_SKINS = Object.freeze(SKINS.filter((s) => s.price === 0).map((s) => s.id));
