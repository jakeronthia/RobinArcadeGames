// POST /api/auth/nonce -> a fresh one-time nonce for the NEAR sign-in message
import { json, newNonce, APP_RECIPIENT, SIGN_MESSAGE } from '../../../lib/core.js';
export async function onRequestPost({ env }) {
  return json({ nonce: await newNonce(env), message: SIGN_MESSAGE, recipient: APP_RECIPIENT });
}
