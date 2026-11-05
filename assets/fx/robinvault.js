/* ROBIN Vault client: reads the contract over NEAR RPC and, on pages that need it, connects a wallet.
   Addresses come from assets/vault-deploy.json, written by the deploy pipeline. */
(function () {
  'use strict';
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const DEPLOY_URL = new URL('../vault-deploy.json', here).href;
  const RPCS = { testnet: ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org', 'https://neart.lava.build'], mainnet: ['https://free.rpc.fastnear.com', 'https://rpc.mainnet.near.org'] };
  let cfgP = null, rpcI = 0;
  const RV = {
    ready() { if (!cfgP) cfgP = fetch(DEPLOY_URL, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(c => { if (!c || !c.vault) throw new Error('The Vault is not deployed yet'); RV.cfg = c; return c; }); return cfgP; },
    today() { return Math.floor(Date.now() / 86400000); },
    async rpc(body) {
      const list = RPCS[(RV.cfg && RV.cfg.network) || 'testnet']; let err;
      for (let k = 0; k < list.length; k++) { const url = list[(rpcI + k) % list.length];
        try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ jsonrpc: '2.0', id: 'rv' }, body)) });
          const j = await r.json(); if (j.error) throw new Error(j.error.data || j.error.message || 'RPC error'); rpcI = (rpcI + k) % list.length; return j.result; } catch (e) { err = e; } }
      throw err;
    },
    async view(contract, method, args) {
      const res = await RV.rpc({ method: 'query', params: { request_type: 'call_function', finality: 'optimistic', account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args || {})) } });
      if (res.error) throw new Error(res.error);
      return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result)));
    },
    vaultView(method, args) { return RV.ready().then(c => RV.view(c.vault, method, args)); },
    tokenView(method, args) { return RV.ready().then(c => RV.view(c.token, method, args)); },
    fmt(raw, dec) { dec = dec == null ? (RV.cfg ? RV.cfg.decimals : 18) : dec; const s = BigInt(raw || 0).toString().padStart(dec + 1, '0'); const i = s.slice(0, -dec), f = s.slice(-dec).replace(/0+$/, '').slice(0, 2); return Number(i).toLocaleString('en') + (f ? '.' + f : ''); },
    // the moves the game records, in the compact form the contract parses
    encode(moves) { return moves.map(([t, a]) => t + ':' + (a[0] === 'place' ? 'p,' + a.slice(1).join(',') : a[0] === 'up' ? 'u,' + a.slice(1).join(',') : a[0] === 'sell' ? 's,' + a.slice(1).join(',') : 'g')).join(';'); },
    HEROES: ['Atreus', 'Frazzle', 'Hoot', 'Baller', 'Ilia', 'Leonidas'],
    BADGES: [[1, 'First defense', 'Sent a verified defense to the Vault'], [2, 'Vault safe', 'Cleared all 12 waves'], [4, 'Untouched', 'Cleared all 12 waves without losing any vault'],
      [8, 'Daily champion', 'Beat a daily target with a ticket'], [16, 'Seven nights', 'Beat the daily target 7 days in a row'], [32, 'Ritual', 'Bought a ticket'],
      [64, 'Voter', 'Voted a hero of the week'], [128, 'Vault Keeper', 'Most wins of the week']],

    /* ---------- wallet (loaded on demand) ---------- */
    async wallet() {
      if (RV._sel) return RV._sel; const c = await RV.ready();
      const V = '8.9.13';
      const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }, { setupHereWallet }] = await Promise.all([
        import('https://esm.sh/@near-wallet-selector/core@' + V), import('https://esm.sh/@near-wallet-selector/modal-ui@' + V),
        import('https://esm.sh/@near-wallet-selector/my-near-wallet@' + V), import('https://esm.sh/@near-wallet-selector/meteor-wallet@' + V),
        import('https://esm.sh/@near-wallet-selector/here-wallet@' + V)]);
      if (!document.getElementById('nws-css')) { const l = document.createElement('link'); l.id = 'nws-css'; l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/@near-wallet-selector/modal-ui@' + V + '/styles.css'; document.head.appendChild(l); }
      const selector = await setupWalletSelector({ network: c.network, modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet()] });
      const modal = setupModal(selector, { contractId: c.vault, theme: 'dark', description: 'Connect to play for the ROBIN Vault.' });
      RV._sel = { selector, modal }; return RV._sel;
    },
    /* ---------- guest accounts: a NEAR testnet account created on the spot, key kept on this device ---------- */
    guestId() { try { const g = JSON.parse(localStorage.getItem('rv-guest') || 'null'); return g && g.id ? g.id : null; } catch (e) { return null; } },
    async nearJs() { if (!RV._nj) RV._nj = import('https://esm.sh/near-api-js@4.0.4?bundle'); return RV._nj; },
    async guestAccount() {
      const id = RV.guestId(); if (!id) throw new Error('no guest account'); const c = await RV.ready(); const nj = await RV.nearJs();
      if (!RV._gnear) { const ks = new nj.keyStores.BrowserLocalStorageKeyStore(window.localStorage, 'robinvault:'); RV._gnear = await nj.connect({ networkId: c.network, nodeUrl: (RPCS[c.network] || RPCS.testnet)[0], keyStore: ks }); }
      return RV._gnear.account(id);
    },
    async createGuest(onStep) {
      const c = await RV.ready(); if (c.network !== 'testnet') throw new Error('guest accounts are for testnet only');
      const step = t => { try { onStep && onStep(t); } catch (e) {} };
      step('Creating your account…'); const nj = await RV.nearJs(); const kp = nj.KeyPair.fromRandom('ed25519');
      const r = await fetch(new URL('/api/guest', location.href).href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: kp.getPublicKey().toString() }) });
      const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error || ('guest service ' + r.status));
      const ks = new nj.keyStores.BrowserLocalStorageKeyStore(window.localStorage, 'robinvault:'); await ks.setKey(c.network, j.accountId, kp);
      localStorage.setItem('rv-guest', JSON.stringify({ id: j.accountId, at: Date.now() })); RV._gnear = null;
      step('Waiting for NEAR to confirm it…');
      for (let k = 0; k < 20; k++) { try { await RV.rpc({ method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: j.accountId } }); break; } catch (e) { await new Promise(res => setTimeout(res, 1500)); } }
      step('Getting your free tROBIN…'); try { await RV.send(c.token, 'faucet', {}, '0', 30); } catch (e) {}
      return j.accountId;
    },
    async account() {
      const g = RV.guestId(); if (g) return g;
      const { selector } = await RV.wallet(); const st = selector.store.getState(); const a = st.accounts && st.accounts.find(x => x.active) || (st.accounts || [])[0]; return a ? a.accountId : null;
    },
    async signIn() { const { modal } = await RV.wallet(); modal.show(); },
    async signOut() {
      if (RV.guestId()) { localStorage.setItem('rv-guest-old', localStorage.getItem('rv-guest')); localStorage.removeItem('rv-guest'); RV._gnear = null; return; }
      const { selector } = await RV.wallet(); const w = await selector.wallet(); await w.signOut();
    },
    async send(receiverId, methodName, args, deposit, tgas) {
      if (RV.guestId()) { const a = await RV.guestAccount(); return a.functionCall({ contractId: receiverId, methodName, args: args || {}, gas: BigInt(tgas || 100) * 10n ** 12n, attachedDeposit: BigInt(deposit || '0') }); }
      const { selector } = await RV.wallet(); const w = await selector.wallet();
      return w.signAndSendTransaction({ receiverId, actions: [{ type: 'FunctionCall', params: { methodName, args: args || {}, gas: String(BigInt(tgas || 100) * 10n ** 12n), deposit: String(deposit || '0') } }] });
    },
    result(outcome) { try { const v = outcome && outcome.status && outcome.status.SuccessValue; return v ? JSON.parse(atob(v)) : null; } catch (e) { return null; } }
  };
  window.RobinVault = RV;
})();
