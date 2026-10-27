// POST /api/score { game, value, run } -> { saved, best, rank }
import { json, bad, auth, readJson, weekId, GAME_RULES, RUN_LIMITS } from '../../lib/core.js';
export async function onRequestPost({ request, env }) {
  const me = await auth(request, env); if (!me) return bad('Not signed in', 401);
  if (me.banned) return bad('This account cannot enter the leaderboard', 403);
  const b = await readJson(request), rule = GAME_RULES[b.game];
  if (!rule) return bad('Unknown game');
  const value = Math.floor(Number(b.value));
  if (!Number.isFinite(value) || value < 0 || value > rule.max) return bad('Impossible score', 422);
  const now = Date.now();
  if (!rule.noRun) {
    const run = await env.DB.prepare('SELECT account, game, started, used FROM runs WHERE id = ?').bind(String(b.run || '')).first();
    if (!run || run.account !== me.account || run.game !== b.game) return bad('Unknown run', 422);
    if (run.used) return bad('Run already submitted', 409);
    const secs = (now - run.started) / 1000;
    if (secs > RUN_LIMITS.RUN_TTL / 1000) return bad('Run expired', 422);
    if (secs < rule.minSec && value > 0) return bad('Run too short', 422);
    if (rule.perSec && value > rule.perSec * Math.max(secs, 1)) return bad('Impossible score', 422);
    if (rule.perRun && value > rule.perRun) return bad('Impossible score', 422);
    await env.DB.prepare('UPDATE runs SET used = 1 WHERE id = ?').bind(String(b.run)).run();
  } else if (rule.perRun) {
    const prev = await env.DB.prepare('SELECT value, updated FROM scores WHERE week = ? AND game = ? AND account = ?').bind(weekId(), b.game, me.account).first();
    if (value - (rule.mode === 'sum' ? 0 : (prev ? prev.value : 0)) > rule.perRun) return bad('Impossible score', 422);
    if (prev && now - prev.updated < 20000) return bad('Slow down a little', 429);
  }
  const week = weekId();
  if (value > 0) {
    if (rule.mode === 'sum') {
      await env.DB.prepare('INSERT INTO scores (week, game, account, value, runs, updated) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(week, game, account) DO UPDATE SET value = value + excluded.value, runs = runs + 1, updated = excluded.updated, verified = 0')
        .bind(week, b.game, me.account, value, now).run();
    } else {
      await env.DB.prepare('INSERT INTO scores (week, game, account, value, runs, updated) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(week, game, account) DO UPDATE SET runs = runs + 1, value = MAX(value, excluded.value), verified = CASE WHEN excluded.value > value THEN 0 ELSE verified END, updated = CASE WHEN excluded.value > value THEN excluded.updated ELSE updated END')
        .bind(week, b.game, me.account, value, now).run();
    }
  }
  const mine = await env.DB.prepare('SELECT value FROM scores WHERE week = ? AND game = ? AND account = ?').bind(week, b.game, me.account).first();
  if (!mine) return json({ saved: false, best: 0, rank: null });
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores s JOIN players p ON p.account = s.account WHERE s.week = ? AND s.game = ? AND p.banned = 0 AND s.value > ?').bind(week, b.game, mine.value).first();
  return json({ saved: value > 0, best: mine.value, rank: (r ? r.n : 0) + 1 });
}
