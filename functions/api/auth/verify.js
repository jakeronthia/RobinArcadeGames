// POST /api/auth/verify { accountId, publicKey, signature, nonce, callbackUrl } -> { token, account }
import { json, bad, readJson, takeNonce, verifyNep413, isFullAccessKey, newSession, b64ToBytes, APP_RECIPIENT, SIGN_MESSAGE } from '../../../lib/core.js';
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const account = String(b.accountId || '').toLowerCase();
  if (!/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(account) || account.length < 2 || account.length > 64) return bad('Invalid NEAR account');
  if (!b.nonce || !(await takeNonce(env, b.nonce))) return bad('Sign-in expired, please try again', 401);
  let ok = false;
  try { ok = await verifyNep413({ publicKey: b.publicKey, signature: b.signature, message: SIGN_MESSAGE, nonce: b64ToBytes(b.nonce), recipient: APP_RECIPIENT, callbackUrl: b.callbackUrl || null }); } catch (e) { ok = false; }
  if (!ok) return bad('Signature check failed', 401);
  let full = false;
  try { full = await isFullAccessKey(env, account, b.publicKey); } catch (e) { return bad('NEAR network is busy, try again in a minute', 503); }
  if (!full) return bad('That key does not belong to ' + account, 401);
  const token = await newSession(env, account);
  return json({ token, account });
}
