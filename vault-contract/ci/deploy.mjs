// Deploys tROBIN + ROBIN Vault on testnet, runs an end-to-end ritual on a fast test vault, locks the keys
// of the production contracts and writes the addresses for the site. Run from GitHub Actions.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
import nearAPI from 'near-api-js';
const require = createRequire(import.meta.url);
const V = require('../../assets/fx/vaultsim.js'); const { play } = require('../tools/bot.js');
const { connect, keyStores, KeyPair, utils } = nearAPI;
const log = []; const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); log.push(s); };
const ROOT = path.resolve('../..'); const OUT = path.join(ROOT, 'assets/vault-deploy.json');
const ks = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const near = await connect({ networkId: 'testnet', nodeUrl: process.env.RPC || 'https://test.rpc.fastnear.com', keyStore: ks });
const MAIN = process.env.MAIN; // created by near-cli-rs with the faucet
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TG = n => BigInt(n) * 10n ** 12n; const ONE = 10n ** 18n;
const acct = id => near.account(id);
async function sub(name, near_) { const id = name + '.' + MAIN; const kp = KeyPair.fromRandom('ed25519'); await ks.setKey('testnet', id, kp);
  await (await acct(MAIN)).createAccount(id, kp.getPublicKey(), utils.format.parseNearAmount(near_)); say('created', id); return id; }
async function call(from, contractId, methodName, args, deposit = '0', gas = 100) {
  const a = await acct(from); const r = await a.functionCall({ contractId, methodName, args, gas: TG(gas), attachedDeposit: BigInt(deposit) });
  const fail = r.receipts_outcome.find(o => o.outcome.status.Failure); const logs = r.receipts_outcome.flatMap(o => o.outcome.logs);
  let val = null; try { const b = r.status.SuccessValue; if (b) val = JSON.parse(Buffer.from(b, 'base64').toString()); } catch (e) {}
  if (fail || r.status.Failure) throw new Error(methodName + ' failed: ' + JSON.stringify(fail ? fail.outcome.status.Failure : r.status.Failure));
  const burnt = r.receipts_outcome.reduce((g, o) => g + BigInt(o.outcome.gas_burnt), BigInt(r.transaction_outcome.outcome.gas_burnt));
  return { val, logs, tx: r.transaction.hash, tgas: Number(burnt / 10n ** 12n) };
}
const view = async (c, m, args = {}) => (await acct(MAIN)).viewFunction({ contractId: c, methodName: m, args });
const enc = acts => acts.map(([t, a]) => t + ':' + (a[0] === 'place' ? 'p,' + a.slice(1).join(',') : a[0] === 'up' ? 'u,' + a.slice(1).join(',') : a[0] === 'sell' ? 's,' + a.slice(1).join(',') : 'g')).join(';');
function bestMoves(day, bonus) { const d = V.daily(day); let best = null;
  for (const order of [[0,3,2,0,1,5,4,3,2,5],[5,3,2,0,4,1],[2,2,3,5,0,1],[0,3,2,5,1,4],[0,0,3,3,2,5]]) for (const upFirst of [0,3,4,5,6]) {
    const r = play(d.seed, bonus, { order, upFirst }, d.mods); const rp = V.replay(d.seed, bonus, r.acts, d.mods);
    if (!best || (rp.win && rp.lives > best.rp.lives) || (!best.rp.win && rp.win)) best = { acts: r.acts, rp }; }
  return { moves: enc(best.acts), rp: best.rp, target: d.target }; }
function findWasm(dir, f) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const r = findWasm(p, f); if (r) return r; } else if (e.name === f && p.includes(path.sep + 'near')) return p; } return null; }
const W = f => { const p = findWasm(path.join(ROOT, 'vault-contract/target'), f); if (!p) throw new Error('wasm not built: ' + f); say('using', p, fs.statSync(p).size, 'bytes'); return fs.readFileSync(p); };
const BURN = '0'.repeat(64);
const result = { network: 'testnet', built: new Date().toISOString(), main: MAIN };
try {
  // ---- production contracts ----
  const token = await sub('robin', '2.1'), vault = await sub('vault', '2.7');
  await (await acct(token)).deployContract(W('robin_demo_token.wasm')); await call(token, token, 'new', {});
  await (await acct(vault)).deployContract(W('robin_vault.wasm'));
  const PRICE = ONE.toString();
  await call(vault, vault, 'new', { token, burn_to: BURN, price: PRICE, odds_paid: 2000, odds_free: 200000, free_per_day: 10, epoch_secs: 86400, week_days: 7 });
  for (const a of [vault, BURN]) await call(MAIN, token, 'register', { account_id: a });
  // seed the jackpot so the demo starts with something to win
  await call(MAIN, token, 'faucet', {});
  await call(MAIN, token, 'ft_transfer_call', { receiver_id: vault, amount: (200n * ONE).toString(), msg: '{"a":"jackpot"}' }, '1', 150);
  Object.assign(result, { token, vault, burn_to: BURN, price: PRICE, decimals: 18, epoch_secs: 86400, week_days: 7, odds_paid: 2000, odds_free: 200000 });
  say('production config', await view(vault, 'config'));
  // ---- fast test pool: 1-minute weeks, the jackpot always hits ----
  const tv = await sub('testvault', '2.6'); await (await acct(tv)).deployContract(W('robin_vault.wasm'));
  await call(tv, tv, 'new', { token, burn_to: BURN, price: PRICE, odds_paid: 1, odds_free: 1, free_per_day: 2, epoch_secs: 60, week_days: 1 });
  await call(MAIN, token, 'register', { account_id: tv });
  const p1 = await sub('p1', '0.5'), p2 = await sub('p2', '0.5');
  for (const p of [p1, p2]) { await call(p, token, 'faucet', {}); }
  const bal = async a => BigInt(await view(token, 'ft_balance_of', { account_id: a }));
  const now = () => Math.floor(Date.now() / 1000);
  let left = 60 - (now() % 60); if (left < 45) { say('waiting', left, 's for a fresh test week'); await sleep((left + 2) * 1000); }
  let cfg = await view(tv, 'config'); const week = cfg.week; say('test week', week);
  const bm = bestMoves(week, -1); say('bot defense for the cup', bm.rp);
  // p1 funds the test jackpot, then a paid play wins it at once (odds 1 in 1)
  await call(p1, token, 'ft_transfer_call', { receiver_id: tv, amount: (50n * ONE).toString(), msg: '{"a":"jackpot"}' }, '1', 150);
  const b0 = await bal(p1); const pl = await call(p1, token, 'ft_transfer_call', { receiver_id: tv, amount: PRICE, msg: '{"a":"play","g":"rush"}' }, '1', 200);
  const b1 = await bal(p1); say('p1 paid play in rush:', pl.logs.filter(l => /JACKPOT|BURN/.test(l)).join(' | '), '| balance change', ((b1 - b0) * 100n / ONE).toString(), '/100 tROBIN');
  // p2 pays for Defend the Vault and sends a defense to the cup
  await call(p2, token, 'ft_transfer_call', { receiver_id: tv, amount: PRICE, msg: '{"a":"play","g":"vault"}' }, '1', 200);
  say('p2 status', await view(tv, 'status', { account_id: p2 }));
  const sub1 = await call(p2, tv, 'submit', { week, moves: bm.moves }, '0', 300); say('p2 cup submit', sub1.val, 'Tgas', sub1.tgas);
  let noCredit = 'accepted?!'; try { await call(p2, tv, 'submit', { week, moves: bm.moves }, '0', 300); } catch (e) { noCredit = 'rejected: ' + (e.message.match(/panicked: ([^"]+)/) || [0, e.message.slice(0, 100)])[1]; } say('p2 submits again without paying:', noCredit);
  const fr = await call(p1, tv, 'free_roll', { game: 'patrol' }); say('p1 free roll', fr.val, fr.logs.join(' | '));
  say('test week', await view(tv, 'get_week', { week })); say('feed', (await view(tv, 'feed')).map(f => f.account.split('.')[0] + ':' + f.game + ':' + (f.paid ? 'paid' : 'free') + ':' + f.won).join(', '));
  const wait = 60 - (now() % 60) + 3; say('waiting', wait, 's for the test week to end'); await sleep(wait * 1000);
  const st = await call(p1, tv, 'settle_week', { week }); say('week closed:', st.logs.join(' | '));
  const w2 = await view(tv, 'get_week', { week }); say('shares cup', w2.cup_shares, 'active', w2.active_shares);
  const c0 = await bal(p2); await call(p2, tv, 'claim', { week }, '0', 100); const c1 = await bal(p2); say('p2 claimed', ((c1 - c0) * 1000n / ONE).toString(), '/1000 tROBIN');
  say('p2 player', await view(tv, 'get_player', { account_id: p2 }));
  say('tokens at the burn address', (await bal(BURN)).toString()); say('test pool config', await view(tv, 'config'));
  result.e2e = { ok: true, testVault: tv, week, jackpotDelta: (b1 - b0).toString(), cup: sub1.val, noCredit, claimed: (c1 - c0).toString() };
  // ---- lock the production contracts: no key can change them any more ----
  for (const id of [token, vault]) { const a = await acct(id); const keys = await a.getAccessKeys(); for (const k of keys) await a.deleteKey(k.public_key); say('locked', id, '(keys left:', (await a.getAccessKeys()).length + ')'); }
  result.locked = true;
} catch (e) { say('ERROR', e.stack || String(e)); result.error = String(e.message || e); }
result.log = log; fs.writeFileSync(OUT, JSON.stringify(result, null, 2)); say('wrote', OUT);
