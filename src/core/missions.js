// Daily missions: three per day, chosen from the template catalog by a
// seeded shuffle of the date key — everyone on Earth gets the same three.
// Progress is a pure reducer over gameplay facts; GameCore feeds it and
// pays completions instantly (auto-claim: no buttons, just a banner).

import { TUNING as T } from './constants.js';
import { hashStr32, createRng } from './rng.js';

// scope 'day'  → counters accumulate across all runs today
// scope 'run'  → high-water marks within a single run (max semantics, so
//                retrying a level can never double-count)
// Zen's gentler curve would trivialize run-scoped goals, so those accept
// normal+daily only (streaker is the exception — a streak is a streak).
export const MISSION_TEMPLATES = Object.freeze([
  { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Land 6 PERFECTs today', target: 6, reward: 60, scope: 'day' },
  { id: 'marathoner', name: 'Marathoner', desc: 'Fit 15 shapes today', target: 15, reward: 50, scope: 'day' },
  { id: 'climber', name: 'Climber', desc: 'Reach level 8 in one run', target: 8, reward: 60, scope: 'run' },
  { id: 'streaker', name: 'Streaker', desc: 'Hit a 6-streak', target: 6, reward: 55, scope: 'run' },
  { id: 'goldrush', name: 'Gold Rush', desc: 'Earn 250 coins from rounds today', target: 250, reward: 65, scope: 'day' },
  { id: 'flawless', name: 'Flawless Five', desc: 'Reach level 5 without missing', target: 5, reward: 70, scope: 'run' },
  { id: 'daily_devotee', name: 'Daily Devotee', desc: "Play today's Daily Challenge", target: 1, reward: 40, scope: 'day' },
  { id: 'variety_pack', name: 'Variety Pack', desc: 'Fit 3 different shapes today', target: 3, reward: 45, scope: 'day' },
  { id: 'tightrope', name: 'Tightrope Walker', desc: 'Land 8 GOODs today', target: 8, reward: 40, scope: 'day' },
  { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Beat a boss level', target: 1, reward: 80, scope: 'run' },
  { id: 'zen_soul', name: 'Zen Soul', desc: 'Fit 10 shapes in Zen mode today', target: 10, reward: 45, scope: 'day' },
].map(Object.freeze));

export const missionTemplateById = (id) => MISSION_TEMPLATES.find((t) => t.id === id);

// Deterministic three-for-the-day.
export function rotateMissions(dateKey) {
  const rng = createRng(hashStr32(`pf-missions:${dateKey}`));
  const pool = [...MISSION_TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, T.missions.perDay).map((t) => ({
    templateId: t.id,
    target: t.target,
    progress: 0,
    reward: t.reward,
    done: false,
    data: {},
  }));
}

// ev is one gameplay fact:
//   { type:'result', band, success, streak, nextLevel, coins, shapeId,
//     mode, missFree, bossBeaten }
//   { type:'daily-done' }
// Mutates the entries' progress and returns the newly completed ones.
export function missionEvent(list, ev) {
  const completed = [];
  for (const m of list) {
    if (m.done) continue;
    const t = missionTemplateById(m.templateId);
    if (!t) continue;

    if (t.scope === 'run' && ev.type === 'result') {
      const runMode = ev.mode === 'normal' || ev.mode === 'daily';
      if (m.templateId === 'streaker') {
        m.progress = Math.max(m.progress, ev.streak);
      } else if (!runMode) {
        continue;
      } else if (m.templateId === 'climber') {
        m.progress = Math.max(m.progress, ev.nextLevel);
      } else if (m.templateId === 'flawless') {
        if (ev.missFree) m.progress = Math.max(m.progress, ev.nextLevel);
      } else if (m.templateId === 'boss_slayer') {
        if (ev.bossBeaten) m.progress = m.target;
      }
    } else if (t.scope === 'day') {
      if (ev.type === 'daily-done') {
        if (m.templateId === 'daily_devotee') m.progress += 1;
      } else if (ev.type === 'result') {
        if (m.templateId === 'sharpshooter' && ev.band === 'perfect') m.progress += 1;
        else if (m.templateId === 'marathoner' && ev.success) m.progress += 1;
        else if (m.templateId === 'tightrope' && ev.band === 'good') m.progress += 1;
        else if (m.templateId === 'goldrush' && ev.coins > 0) m.progress += ev.coins;
        else if (m.templateId === 'zen_soul' && ev.mode === 'zen' && ev.success) m.progress += 1;
        else if (m.templateId === 'variety_pack' && ev.success) {
          const seen = Array.isArray(m.data.seen) ? m.data.seen : [];
          if (!seen.includes(ev.shapeId)) {
            seen.push(ev.shapeId);
            m.data.seen = seen;
          }
          m.progress = seen.length;
        }
      }
    }

    m.progress = Math.min(m.progress, m.target);
    if (m.progress >= m.target) {
      m.done = true;
      completed.push(m);
    }
  }
  return completed;
}
