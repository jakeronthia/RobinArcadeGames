// GET /api/leaderboard?game=patrol[&week=w2915] -> { week, start, end, rows:[{rank, nick, account, value, verified}], me }
import { json, bad, auth, weekIndex, weekId, weekStart, GAME_RULES } from '../../lib/core.js';
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), game = url.searchParams.get('game');
  if (!GAME_RULES[game]) return bad('Unknown game');
  const cur = weekIndex();
  let wi = cur; const wq = url.searchParams.get('week');
  if (wq === 'last') wi = cur - 1; else if (/^w\d+$/.test(wq || '')) wi = Math.min(cur, +wq.slice(1));
  const week = weekId(wi);
  const { results } = await env.DB.prepare('SELECT s.account, s.value, s.verified, p.nick, p.hero FROM scores s JOIN players p ON p.account = s.account WHERE s.week = ? AND s.game = ? AND p.banned = 0 ORDER BY s.value DESC, s.updated ASC LIMIT 50').bind(week, game).all();
  const rows = (results || []).map((r, i) => ({ rank: i + 1, account: r.account, nick: r.nick || '', hero: r.hero || '', value: r.value, verified: !!r.verified }));
  let me = null; const who = await auth(request, env);
  if (who) {
    const m = await env.DB.prepare('SELECT value FROM scores WHERE week = ? AND game = ? AND account = ?').bind(week, game, who.account).first();
    if (m) { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores s JOIN players p ON p.account = s.account WHERE s.week = ? AND s.game = ? AND p.banned = 0 AND s.value > ?').bind(week, game, m.value).first(); me = { value: m.value, rank: r.n + 1 }; }
  }
  const paid = (await env.DB.prepare('SELECT rank, account FROM paid WHERE week = ? AND game = ?').bind(week, game).all()).results || [];
  return json({ week, current: wi === cur, start: weekStart(wi), end: weekStart(wi + 1), label: GAME_RULES[game].label, rows, me, paid }, 200, { 'cache-control': 'no-store' });
}
