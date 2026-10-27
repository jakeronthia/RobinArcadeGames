// ROBIN Arcade server helpers (used by the Cloudflare Pages Functions in /functions).
// Nothing secret lives here: the admin key and database come from the Cloudflare project settings.

export const APP_RECIPIENT = 'ROBIN Arcade';
export const SIGN_MESSAGE = 'Sign in to ROBIN Arcade to enter the weekly leaderboard.';
const NONCE_TTL = 15 * 60 * 1000;           // a sign-in must finish within 15 minutes
const SESSION_TTL = 30 * 24 * 3600 * 1000;  // stay signed in for 30 days
const RUN_TTL = 6 * 3600 * 1000;            // a single run can last up to 6 hours

// Per-game rules. "best" keeps the highest single result of the week, "sum" adds every result up.
// perSec / perRun are generous ceilings: anything above is rejected as impossible.
export const GAME_RULES = {
  patrol:     { mode: 'best', minSec: 15, perSec: 1500, max: 5000000, label: 'Score' },
  rush:       { mode: 'best', minSec: 10, perSec: 1200, max: 5000000, label: 'Score' },
  brawl:      { mode: 'sum',  minSec: 20, perRun: 10,   max: 100000,  label: 'Trophies won' },
  nightshift: { mode: 'sum',  minSec: 0,  perRun: 50,   max: 1000,    label: 'Moon Badges earned', noRun: true },
  tycoon:     { mode: 'sum',  minSec: 0,  perRun: 1,    max: 500,     label: 'IPOs', noRun: true }
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
}
export const bad = (msg, status = 400) => json({ error: msg }, status);

// weeks start on Monday 00:00 UTC
export function weekIndex(ms = Date.now()) { return Math.floor((Math.floor(ms / 864e5) + 3) / 7); }
export function weekId(i = weekIndex()) { return 'w' + i; }
export function weekStart(i) { return (i * 7 - 3) * 864e5; }

export function randomHex(n = 32) { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
export function bytesToB64(b) { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58decode(str) {
  const bytes = [];
  for (const ch of str) {
    let carry = B58.indexOf(ch); if (carry < 0) throw new Error('bad base58');
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of str) { if (ch === '1') bytes.push(0); else break; }
  return new Uint8Array(bytes.reverse());
}

// NEP-413: the wallet signs sha256(borsh(tag, message, nonce, recipient, callbackUrl?))
function borshString(s) { const b = new TextEncoder().encode(s); const out = new Uint8Array(4 + b.length); new DataView(out.buffer).setUint32(0, b.length, true); out.set(b, 4); return out; }
function concat(parts) { const n = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
export function nep413Payload(message, nonce, recipient, callbackUrl) {
  const tag = new Uint8Array(4); new DataView(tag.buffer).setUint32(0, 2147484061, true);
  const cb = callbackUrl == null ? new Uint8Array([0]) : concat([new Uint8Array([1]), borshString(callbackUrl)]);
  return concat([tag, borshString(message), nonce, borshString(recipient), cb]);
}
export async function verifyNep413({ publicKey, signature, message, nonce, recipient, callbackUrl }) {
  if (!publicKey || !publicKey.startsWith('ed25519:')) return false;
  const pk = b58decode(publicKey.slice(8)); if (pk.length !== 32) return false;
  const sig = b64ToBytes(signature); if (sig.length !== 64) return false;
  const key = await crypto.subtle.importKey('raw', pk, { name: 'Ed25519' }, false, ['verify']);
  // wallets differ on whether the callback URL is part of the signed payload, so accept either
  for (const cb of callbackUrl ? [callbackUrl, null] : [null]) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', nep413Payload(message, nonce, recipient, cb)));
    if (await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, hash)) return true;
  }
  return false;
}

// the signing key must be a full-access key of that account on NEAR mainnet
export async function isFullAccessKey(env, account, publicKey) {
  const rpcs = (env.NEAR_RPC || 'https://free.rpc.fastnear.com,https://rpc.mainnet.near.org').split(',');
  for (const rpc of rpcs) {
    try {
      const r = await fetch(rpc.trim(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        jsonrpc: '2.0', id: 'arcade', method: 'query',
        params: { request_type: 'view_access_key', finality: 'final', account_id: account, public_key: publicKey } }) });
      const j = await r.json();
      if (j.result && j.result.permission) return j.result.permission === 'FullAccess';
      if (j.error || (j.result && j.result.error)) return false;
    } catch (e) { /* try the next RPC */ }
  }
  throw new Error('NEAR RPC unavailable');
}

export async function newNonce(env) {
  const nonce = new Uint8Array(32); crypto.getRandomValues(nonce);
  const b64 = bytesToB64(nonce), now = Date.now();
  await env.DB.prepare('INSERT INTO nonces (nonce, created) VALUES (?, ?)').bind(b64, now).run();
  await env.DB.prepare('DELETE FROM nonces WHERE created < ?').bind(now - NONCE_TTL).run();
  return b64;
}
export async function takeNonce(env, b64) {
  const row = await env.DB.prepare('SELECT created FROM nonces WHERE nonce = ?').bind(b64).first();
  if (!row) return false;
  await env.DB.prepare('DELETE FROM nonces WHERE nonce = ?').bind(b64).run();
  return Date.now() - row.created < NONCE_TTL;
}

export async function newSession(env, account) {
  const token = randomHex(32), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token, account, created) VALUES (?, ?, ?)').bind(token, account, now).run();
  await env.DB.prepare('INSERT INTO players (account, created) VALUES (?, ?) ON CONFLICT(account) DO NOTHING').bind(account, now).run();
  return token;
}
export async function auth(request, env) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare('SELECT s.account, s.created, p.banned FROM sessions s JOIN players p ON p.account = s.account WHERE s.token = ?').bind(token).first();
  if (!row || Date.now() - row.created > SESSION_TTL) return null;
  return { account: row.account, banned: !!row.banned };
}

export async function readJson(request) { try { return await request.json(); } catch (e) { return {}; } }
export const cleanNick = s => String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);
export const RUN_LIMITS = { RUN_TTL };
export const isAdmin = (request, env) => !!env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY;
