// Lifetime badges. Each is a pure predicate over the save data and pays a
// one-time coin reward when it flips true. GameCore checks after every
// resolve/purchase/share — unlocks are append-only, so checks stay cheap.

import { TUNING as T } from './constants.js';
import { SHAPES, UPGRADES } from './catalog.js';

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_fit', name: "Baby's First Fit", icon: '🍼', desc: 'Land your first shape.', reward: 10,
    test: (d) => d.stats.perfects + d.stats.goods >= 1 },
  { id: 'perfect_10', name: 'Sharp Eye', icon: '🎯', desc: '10 lifetime PERFECTs.', reward: 25,
    test: (d) => d.totalPerfects >= 10 },
  { id: 'perfect_100', name: 'Laser Guided', icon: '📡', desc: '100 lifetime PERFECTs.', reward: 100,
    test: (d) => d.totalPerfects >= 100 },
  { id: 'perfect_500', name: 'Machine', icon: '🤖', desc: '500 PERFECTs. Are you OK?', reward: 300,
    test: (d) => d.totalPerfects >= 500 },
  { id: 'level_10', name: 'Double Digits', icon: '🔟', desc: 'Reach level 10.', reward: 30,
    test: (d) => d.bestLevel >= 10 },
  { id: 'level_20', name: 'Deep End', icon: '🌊', desc: 'Reach level 20.', reward: 75,
    test: (d) => d.bestLevel >= 20 },
  { id: 'level_30', name: 'No Fear', icon: '😤', desc: 'Reach level 30.', reward: 150,
    test: (d) => d.bestLevel >= 30 },
  { id: 'level_50', name: 'Touch Grass', icon: '🌱', desc: 'Reach level 50. Please.', reward: 400,
    test: (d) => d.bestLevel >= 50 },
  { id: 'streak_5', name: 'Warm Hands', icon: '🖐️', desc: 'Hit a 5-streak.', reward: 20,
    test: (d) => d.bestStreak >= 5 },
  { id: 'streak_10', name: 'On Fire', icon: '🔥', desc: 'Hit a 10-streak.', reward: 60,
    test: (d) => d.bestStreak >= 10 },
  { id: 'streak_20', name: 'Unstoppable', icon: '⚡', desc: 'A 20-streak. The shapes fear you.', reward: 200,
    test: (d) => d.bestStreak >= 20 },
  { id: 'rich_1k', name: 'Piggy Bank', icon: '🐷', desc: 'Earn 1,000 lifetime coins.', reward: 40,
    test: (d) => d.stats.coinsEarned >= 1000 },
  { id: 'rich_10k', name: 'Shape Tycoon', icon: '💰', desc: 'Earn 10,000 lifetime coins.', reward: 150,
    test: (d) => d.stats.coinsEarned >= 10000 },
  { id: 'first_skin', name: 'New Wardrobe', icon: '👗', desc: 'Buy your first skin.', reward: 25,
    test: (d) => d.ownedSkins.length >= 2 },
  { id: 'shape_collector', name: "Gotta Fit 'Em All", icon: '🧺', desc: 'Own all 12 shapes.', reward: 250,
    test: (d) => d.ownedShapes.length >= SHAPES.length },
  { id: 'maxed_out', name: 'Fully Loaded', icon: '🚀', desc: 'Max out any upgrade.', reward: 75,
    test: (d) => UPGRADES.some((u) => (d.upgrades[u.id] ?? 0) >= u.costs.length) },
  { id: 'serial_popper', name: 'Serial Popper', icon: '💥', desc: "Pop 50 shapes. It's not a strategy.", reward: 50,
    test: (d) => d.stats.pops >= 50 },
  { id: 'butterfingers', name: 'Butterfingers', icon: '🧈', desc: '25 false starts. Commit!', reward: 15,
    test: (d) => d.stats.falseStarts >= 25 },
  { id: 'daily_3', name: 'Regular', icon: '🗓️', desc: '3-day daily streak.', reward: 50,
    test: (d) => d.daily.bestStreak >= 3 },
  { id: 'daily_7', name: 'Devoted', icon: '📅', desc: '7-day daily streak.', reward: 150,
    test: (d) => d.daily.bestStreak >= 7 },
  { id: 'boss_10', name: 'Giant Slayer', icon: '⚔️', desc: 'Beat 10 bosses.', reward: 200,
    test: (d) => d.stats.bossesBeaten >= 10 },
  { id: 'zen_master', name: 'Inner Peace', icon: '🧘', desc: '100 Zen rounds. Breathe in…', reward: 100,
    test: (d) => d.stats.zenRounds >= 100 },
  { id: 'show_off', name: 'Show-Off', icon: '📤', desc: 'Share your first score card.', reward: 25,
    test: (d) => d.stats.shares >= 1 },
].map(Object.freeze));

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

// Newly earned entries (not yet in data.achievements). Caller records + pays.
export function checkAchievements(data) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (data.achievements.includes(a.id)) continue;
    if (a.test(data)) earned.push(a);
  }
  return earned;
}
