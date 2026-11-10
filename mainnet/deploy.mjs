// ROBIN Vault on NEAR mainnet, with real $ROBIN. Run by hand from GitHub Actions (workflow "vault-mainnet").
// Nothing here runs on its own, and every step that spends money or cannot be undone needs its own typed confirmation.
//
//   MODE=check   reads the real token, the accounts and the built contract, prints the plan and the costs. Spends nothing.
//   MODE=deploy  creates the vault account, publishes the contract, sets the rules, seeds the jackpot.   CONFIRM="DEPLOY TO MAINNET"
//   MODE=play    one real paid play from the owner account, to see the whole path work.                    CONFIRM="PLAY ON MAINNET"
//   MODE=lock    removes every key from the vault account: nobody can change it again, not even you.      CONFIRM="LOCK FOREVER"
//
// Secrets (GitHub > Settings > Secrets): MAINNET_ACCOUNT_ID (the account that pays), MAINNET_PRIVATE_KEY (its full-access key).
import fs from 'node:fs'; import path from 'node:path';
import nearAPI from 'near-api-js';
const { connect, keyStores, KeyPair, utils } = nearAPI;

const E = process.env, MODE = E.MODE || 'check', CONFIRM = (E.CONFIRM || '').trim();
const MAIN = (E.MAINNET_ACCOUNT_ID || '').trim(), KEY = (E.MAINNET_PRIVATE_KEY || '').trim();
const TOKEN = (E.TOKEN || 'robin-3.nearlytrade.near').trim();
const VAULT = MAIN ? (E.VAULT_NAME || 'arcade').trim() + '.' + MAIN : '';
const BURN = (E.BURN_TO || '0'.repeat(64)).trim();
const ODDS_PAID = Number(E.ODDS_PAID || 2000), ODDS_FREE = Number(E.ODDS_FREE || 200000), FREE_PER_DAY = Number(E.FREE_PER_DAY || 10);
const ROOT = path.resolve('..'), OUT = path.join(ROOT, 'assets/vault-deploy.mainnet.json'), REPORT = path.join(ROOT, 'ci/mainnet.txt');
const log = []; const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); log.push(s); };
const stop = m => { say('STOP: ' + m); finish(1); };
function finish(code) { fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, '[' + new Date().toISOString() + '] mode ' + MODE + '\n' + log.join('\n') + '\n'); process.exit(code); }

const TG = n => BigInt(n) * 10n ** 12n;
const units = (h, dec) => { const [i, f = ''] = String(h).trim().split('.'); if (!/^\d+$/.test(i) || !/^\d*$/.test(f) || f.length > dec) throw new Error('bad amount: ' + h); return BigInt(i) * 10n ** BigInt(dec) + BigInt((f + '0'.repeat(dec)).slice(0, dec) || '0'); };
const human = (raw, dec) => { const s = BigInt(raw).toString().padStart(dec + 1, '0'); const f = s.slice(-dec).replace(/0+$/, '').slice(0, 4); return Number(s.slice(0, -dec)).toLocaleString('en') + (f ? '.' + f : ''); };
const nearH = y => utils.format.formatNearAmount(String(y), 3);
function findWasm(dir, f) { if (!fs.existsSync(dir)) return null; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const r = findWasm(p, f); if (r) return r; } else if (e.name === f && p.includes(path.sep + 'near')) return p; } return null; }

if (!MAIN) stop('set the secret MAINNET_ACCOUNT_ID (your NEAR mainnet account, for example yourname.near)');
if (!/^[a-z0-9._-]+\.near$/.test(MAIN)) stop('MAINNET_ACCOUNT_ID must be a named mainnet account ending in .near, got ' + MAIN);
const ks = new keyStores.InMemoryKeyStore(); let kp = null;
if (KEY) { try { kp = KeyPair.fromString(KEY); await ks.setKey('mainnet', MAIN, kp); await ks.setKey('mainnet', VAULT, kp); } catch (e) { stop('MAINNET_PRIVATE_KEY is not a valid NEAR key (it starts with ed25519:)'); } }
const near = await connect({ networkId: 'mainnet', nodeUrl: E.RPC || 'https://free.rpc.fastnear.com', keyStore: ks });
const acct = id => near.account(id);
const view = async (c, m, args = {}) => (await acct(MAIN)).viewFunction({ contractId: c, methodName: m, args });
const exists = async id => { try { return await (await acct(id)).state(); } catch (e) { return null; } };
async function call(from, contractId, methodName, args, deposit = '0', gas = 100) {
  const a = await acct(from); const r = await a.functionCall({ contractId, methodName, args, gas: TG(gas), attachedDeposit: BigInt(deposit) });
  const fail = r.receipts_outcome.find(o => o.outcome.status.Failure); const logs = r.receipts_outcome.flatMap(o => o.outcome.logs);
  if (fail || r.status.Failure) throw new Error(methodName + ' failed: ' + JSON.stringify(fail ? fail.outcome.status.Failure : r.status.Failure).slice(0, 400));
  return { logs, tx: r.transaction.hash };
}

try {
  // ---------- what is out there ----------
  const mainSt = await exists(MAIN); if (!mainSt) stop('the account ' + MAIN + ' does not exist on mainnet');
  let meta; try { meta = await view(TOKEN, 'ft_metadata'); } catch (e) { stop('cannot read the token ' + TOKEN + ': ' + String(e.message || e).slice(0, 160)); }
  const DEC = meta.decimals, SYM = meta.symbol; say('token', TOKEN, '=', meta.name, '(' + SYM + '),', DEC, 'decimals');
  let bounds = null; try { bounds = await view(TOKEN, 'storage_balance_bounds'); } catch (e) {}
  if (!bounds) stop('the token does not answer storage_balance_bounds: it cannot register the vault the standard way. Tell Claude, the vault needs another route for this token.');
  const REG = BigInt(bounds.min); say('registering an account on the token costs', nearH(REG), 'NEAR');
  const bal = async a => { try { return BigInt(await view(TOKEN, 'ft_balance_of', { account_id: a })); } catch (e) { return 0n; } };
  const registered = async a => { try { return !!(await view(TOKEN, 'storage_balance_of', { account_id: a })); } catch (e) { return false; } };
  const mainTok = await bal(MAIN), mainNear = BigInt(mainSt.amount);
  say('owner', MAIN, 'has', nearH(mainNear), 'NEAR and', human(mainTok, DEC), SYM);
  const vaultSt = await exists(VAULT); say('vault account', VAULT, vaultSt ? (vaultSt.code_hash === '1'.repeat(32) ? 'exists, no contract yet' : 'exists, contract already published') : 'does not exist yet');
  const wasmP = findWasm(path.join(ROOT, 'vault-contract/target'), 'robin_vault.wasm'); const wasm = wasmP ? fs.readFileSync(wasmP) : null;
  if (wasm) say('contract built:', wasm.length, 'bytes'); else say('contract not built in this run');
  // NEAR to park on the vault account: 1 NEAR per 100 kB of code, plus room for the data players will write
  const VAULT_NEAR = E.VAULT_NEAR ? utils.format.parseNearAmount(E.VAULT_NEAR) : String(BigInt(Math.ceil((wasm ? wasm.length : 230000) / 100000 * 10)) * 10n ** 23n + 2n * 10n ** 24n);
  const priceRaw = E.PRICE ? units(E.PRICE, DEC) : null, seedRaw = E.JACKPOT_SEED ? units(E.JACKPOT_SEED, DEC) : 0n;
  say('---------- the plan ----------');
  say('vault account:', VAULT, '| NEAR parked on it:', nearH(VAULT_NEAR), '(you get it back only if the account is deleted, and never after a lock)');
  if (priceRaw) { const p = priceRaw; say('price of a game for the pot:', human(p, DEC), SYM, '->', human(p / 2n, DEC), 'weekly pool,', human(p * 3n / 10n, DEC), 'jackpot,', human(p * 15n / 100n, DEC), 'burned,', human(p - p / 2n - p * 3n / 10n - p * 15n / 100n, DEC), 'next week'); }
  else say('price of a game for the pot: NOT SET (input "price", in ' + SYM + ')');
  say('jackpot odds: 1 in', ODDS_PAID, 'for a paid game, 1 in', ODDS_FREE, 'for a free roll,', FREE_PER_DAY, 'free rolls a day | weeks of 7 days, a winner takes 90% of the jackpot');
  say('jackpot you put in at the start:', human(seedRaw, DEC), SYM, '| burn address:', BURN);
  const need = BigInt(VAULT_NEAR) + REG * 2n + 3n * 10n ** 23n; say('NEAR needed in total, about:', nearH(need));
  const blockers = [];
  if (mainNear < need) blockers.push('not enough NEAR on ' + MAIN + ': needs about ' + nearH(need));
  if (seedRaw > mainTok) blockers.push('not enough ' + SYM + ' on ' + MAIN + ' for the jackpot seed');
  if (priceRaw != null && priceRaw < 100n) blockers.push('the price is too small for the contract (minimum 100 base units)');
  if (!(ODDS_PAID >= 1 && ODDS_FREE >= 1)) blockers.push('odds must be 1 or more');
  blockers.forEach(b => say('BLOCKER:', b));

  if (MODE === 'check') { say(blockers.length ? 'check finished: fix the blockers above first' : 'check finished: ready to deploy'); finish(0); }
  if (!kp) stop('set the secret MAINNET_PRIVATE_KEY to run mode ' + MODE);
  const keys = await (await acct(MAIN)).getAccessKeys(); if (!keys.some(k => k.public_key === kp.getPublicKey().toString() && k.access_key.permission === 'FullAccess')) stop('MAINNET_PRIVATE_KEY is not a full-access key of ' + MAIN);

  if (MODE === 'deploy') {
    if (CONFIRM !== 'DEPLOY TO MAINNET') stop('type exactly DEPLOY TO MAINNET in the confirm box');
    if (!priceRaw) stop('set the price'); if (blockers.length) stop('fix the blockers first'); if (!wasm) stop('the contract was not built');
    if (vaultSt && vaultSt.code_hash !== '1'.repeat(32)) stop(VAULT + ' already has a contract. Use another vault name, this script never overwrites one.');
    // 1. the burn address must be able to receive the token, or 15% of every play would fall back into the jackpot
    if (!(await registered(BURN))) { await call(MAIN, TOKEN, 'storage_deposit', { account_id: BURN, registration_only: true }, REG.toString(), 30); say('registered the burn address on the token'); }
    // 2. the vault account, controlled by the same key as the owner until it is locked
    if (!vaultSt) { await (await acct(MAIN)).createAccount(VAULT, kp.getPublicKey(), VAULT_NEAR); say('created', VAULT, 'with', nearH(VAULT_NEAR), 'NEAR'); }
    await (await acct(VAULT)).deployContract(wasm); say('published the contract,', wasm.length, 'bytes');
    await call(VAULT, VAULT, 'new', { token: TOKEN, burn_to: BURN, price: priceRaw.toString(), odds_paid: ODDS_PAID, odds_free: ODDS_FREE, free_per_day: FREE_PER_DAY, epoch_secs: 86400, week_days: 7 }); say('rules set');
    if (!(await registered(VAULT))) { await call(MAIN, TOKEN, 'storage_deposit', { account_id: VAULT, registration_only: true }, REG.toString(), 30); say('registered the vault on the token'); }
    // 3. the first jackpot
    if (seedRaw > 0n) { await call(MAIN, TOKEN, 'ft_transfer_call', { receiver_id: VAULT, amount: seedRaw.toString(), msg: '{"a":"jackpot"}' }, '1', 150); say('jackpot seeded with', human(seedRaw, DEC), SYM); }
    const cfg = await view(VAULT, 'config'); say('live config', cfg);
    if (BigInt(cfg.jackpot) !== seedRaw) say('WARNING: the jackpot on chain is', human(cfg.jackpot, DEC), 'and the seed was', human(seedRaw, DEC));
    fs.writeFileSync(OUT, JSON.stringify({ network: 'mainnet', built: new Date().toISOString(), main: MAIN, token: TOKEN, symbol: SYM, vault: VAULT, burn_to: BURN, price: priceRaw.toString(), decimals: DEC, epoch_secs: 86400, week_days: 7, odds_paid: ODDS_PAID, odds_free: ODDS_FREE, locked: false, log }, null, 2));
    say('wrote assets/vault-deploy.mainnet.json. The site still runs on testnet: look at mainnet with ?net=mainnet, then run the "switch" step.');
  }
  else if (MODE === 'play') {
    if (CONFIRM !== 'PLAY ON MAINNET') stop('type exactly PLAY ON MAINNET in the confirm box');
    const cfg = await view(VAULT, 'config'); const b0 = await bal(MAIN);
    const r = await call(MAIN, TOKEN, 'ft_transfer_call', { receiver_id: VAULT, amount: cfg.price, msg: '{"a":"play","g":"rush"}' }, '1', 200);
    const b1 = await bal(MAIN), c2 = await view(VAULT, 'config');
    say('paid play:', r.logs.filter(l => /JACKPOT|BURN|refused/.test(l)).join(' | ') || '(no logs)', '| your balance changed by', human((b1 > b0 ? b1 - b0 : b0 - b1), DEC), SYM, b1 > b0 ? 'up' : 'down');
    say('plays for the pot so far:', c2.plays_paid, '| jackpot now', human(c2.jackpot, DEC), SYM, '| burned so far', human(c2.burned, DEC), SYM, '| tx', r.tx);
    if (c2.plays_paid <= cfg.plays_paid) say('WARNING: the play was not counted');
  }
  else if (MODE === 'lock') {
    if (CONFIRM !== 'LOCK FOREVER') stop('type exactly LOCK FOREVER in the confirm box');
    if (!vaultSt || vaultSt.code_hash === '1'.repeat(32)) stop('there is no contract on ' + VAULT + ' to lock');
    const a = await acct(VAULT); for (const k of await a.getAccessKeys()) await a.deleteKey(k.public_key);
    const left = (await a.getAccessKeys()).length; say('locked', VAULT, '(keys left: ' + left + ')');
    if (fs.existsSync(OUT)) { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); j.locked = left === 0; j.locked_at = new Date().toISOString(); fs.writeFileSync(OUT, JSON.stringify(j, null, 2)); }
  }
  else stop('unknown mode ' + MODE);
  finish(0);
} catch (e) { say('ERROR', e.stack || String(e)); finish(1); }
