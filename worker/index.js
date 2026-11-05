// ROBIN Arcade worker: serves the static site and one small API for instant guest accounts on NEAR testnet.
// POST /api/guest {publicKey:"ed25519:..."} creates "robin-xxxxxxxx.testnet" with that key, funded by the
// NEAR testnet faucet. The private key never leaves the player's browser.
const FAUCET = 'https://helper.nearprotocol.com/account';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/guest') {
      if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
      let body = {}; try { body = await req.json(); } catch (e) {}
      const pk = String(body.publicKey || '');
      if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(pk)) return json({ ok: false, error: 'bad public key' }, 400);
      const rnd = crypto.getRandomValues(new Uint8Array(5)); const id = 'robin-' + Array.from(rnd, b => b.toString(36).padStart(2, '0')).join('').slice(0, 9) + '.testnet';
      try {
        const r = await fetch(FAUCET, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: pk }) });
        const t = await r.text();
        if (!r.ok) return json({ ok: false, error: 'faucet ' + r.status, detail: t.slice(0, 300) }, 502);
        return json({ ok: true, accountId: id });
      } catch (e) { return json({ ok: false, error: String(e) }, 502); }
    }
    return env.ASSETS.fetch(req);
  }
};
