// Admin actions, protected by the ADMIN_KEY secret set in the Cloudflare project.
// GET  /api/admin?week=w2915            -> top 10 of every game for that week (default: last week)
// POST /api/admin { action, ... }        -> verify | remove | ban | unban | paid
import { json, bad, isAdmin, readJson, weekIndex, weekId, GAME_RULES } from '../../lib/core.js';
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return bad('Wrong admin key', 401);
  const url = new URL(request.url); const wq = url.searchParams.get('week');
  const week = /^w\d+$/.test(wq || '') ? wq : weekId(wq === 'current' ? weekIndex() : weekIndex() - 1);
  const out = {};
  for (const g of Object.keys(GAME_RULES)) {
    const { results } = await env.DB.prepare('SELECT s.account, s.value, s.runs, s.verified, s.updated, p.nick, p.banned FROM scores s JOIN players p ON p.account = s.account WHERE s.week = ? AND s.game = ? ORDER BY s.value DESC LIMIT 10').bind(week, g).all();
    const paid = (await env.DB.prepare('SELECT rank, account, note FROM paid WHERE week = ? AND game = ?').bind(week, g).all()).results || [];
    out[g] = { rows: results || [], paid };
  }
  return json({ week, games: out });
}
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return bad('Wrong admin key', 401);
  const b = await readJson(request), acct = String(b.account || '');
  if (b.action === 'verify') await env.DB.prepare('UPDATE scores SET verified = 1 WHERE week = ? AND game = ? AND account = ?').bind(b.week, b.game, acct).run();
  else if (b.action === 'remove') await env.DB.prepare('DELETE FROM scores WHERE week = ? AND game = ? AND account = ?').bind(b.week, b.game, acct).run();
  else if (b.action === 'ban') await env.DB.prepare('UPDATE players SET banned = 1 WHERE account = ?').bind(acct).run();
  else if (b.action === 'unban') await env.DB.prepare('UPDATE players SET banned = 0 WHERE account = ?').bind(acct).run();
  else if (b.action === 'paid') await env.DB.prepare('INSERT INTO paid (week, game, rank, account, note, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(week, game, rank) DO UPDATE SET account = excluded.account, note = excluded.note, at = excluded.at').bind(b.week, b.game, +b.rank, acct, String(b.note || '').slice(0, 200), Date.now()).run();
  else return bad('Unknown action');
  return json({ ok: true });
}
