// GET /api/me -> who am I;  POST /api/me { nick, hero } -> save my public nickname
import { json, bad, auth, readJson, cleanNick } from '../../lib/core.js';
export async function onRequestGet({ request, env }) {
  const me = await auth(request, env); if (!me) return bad('Not signed in', 401);
  const p = await env.DB.prepare('SELECT nick, hero, banned FROM players WHERE account = ?').bind(me.account).first();
  return json({ account: me.account, nick: p ? p.nick : '', hero: p ? p.hero : '', banned: !!(p && p.banned) });
}
export async function onRequestPost({ request, env }) {
  const me = await auth(request, env); if (!me) return bad('Not signed in', 401);
  const b = await readJson(request);
  await env.DB.prepare('UPDATE players SET nick = ?, hero = ? WHERE account = ?').bind(cleanNick(b.nick), String(b.hero || '').slice(0, 20), me.account).run();
  return json({ ok: true });
}
