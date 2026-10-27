// POST /api/run { game } -> { run }  (a ticket issued when a game starts; the score must come back with it)
import { json, bad, auth, readJson, randomHex, GAME_RULES } from '../../lib/core.js';
export async function onRequestPost({ request, env }) {
  const me = await auth(request, env); if (!me) return bad('Not signed in', 401);
  if (me.banned) return bad('This account cannot enter the leaderboard', 403);
  const { game } = await readJson(request);
  if (!GAME_RULES[game]) return bad('Unknown game');
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM runs WHERE account = ? AND started > ?').bind(me.account, now - 60000).first();
  if (recent && recent.n >= 6) return bad('Slow down a little', 429);
  const id = randomHex(16);
  await env.DB.prepare('INSERT INTO runs (id, account, game, started) VALUES (?, ?, ?, ?)').bind(id, me.account, game, now).run();
  await env.DB.prepare('DELETE FROM runs WHERE started < ?').bind(now - 2 * 864e5).run();
  return json({ run: id });
}
