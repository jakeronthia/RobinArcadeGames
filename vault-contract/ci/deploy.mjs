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
  const gas = r.receipts_outcome.reduce((g, o) => g + BigInt(o.outcome.gas_burnt), BigInt(r.transaction_outcome.outcome.gas_burnt));
  return { val, logs, tx: r.transaction.hash, tgas: Number(gas / 10n ** 12n) };
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
  await call(vault, vault, 'new', { token, burn_to: BURN, ticket: (10n * ONE).toString(), epoch_secs: 86400, week_days: 7, goal: 300 });
  for (const a of [vault, BURN]) await call(MAIN, token, 'register', { account_id: a });
  Object.assign(result, { token, vault, burn_to: BURN, ticket: (10n * ONE).toString(), decimals: 18, epoch_secs: 86400, week_days: 7, goal: 300 });
  say('production config', await view(vault, 'config'));
  // ---- fast test vault: 2-minute days, 2-day weeks ----
  const tv = await sub('testvault', '2.6'); await (await acct(tv)).deployContract(W('robin_vault.wasm'));
  await call(tv, tv, 'new', { token, burn_to: BURN, ticket: (10n * ONE).toString(), epoch_secs: 120, week_days: 2, goal: 1 });
  await call(MAIN, token, 'register', { account_id: tv });
  const p1 = await sub('p1', '0.5'), p2 = await sub('p2', '0.5');
  for (const p of [p1, p2]) { await call(p, token, 'faucet', {}); say(p, 'balance', await view(token, 'ft_balance_of', { account_id: p })); }
  // wait for the start of a fresh test day so everything fits inside it
  let cfg = await view(tv, 'config'); const now = () => Math.floor(Date.now() / 1000);
  const left = 120 - (now() % 120); if (left < 75) { say('waiting', left, 's for a fresh test day'); await sleep((left + 3) * 1000); }
  cfg = await view(tv, 'config'); const day = cfg.today; say('test day', day, 'hero of week', cfg.hero_of_week);
  const bm = bestMoves(day, cfg.hero_of_week); say('bot defense', bm.rp, 'target', bm.target, 'moves', bm.moves.length, 'chars');
  const supply0 = BigInt(await view(token, 'ft_total_supply'));
  for (const p of [p1, p2]) { const r = await call(p, token, 'ft_transfer_call', { receiver_id: tv, amount: (10n * ONE).toString(), msg: '{"a":"ticket"}' }, '1', 150); say(p, 'ticket', r.logs.join(' | ')); }
  const burnBal1 = BigInt(await view(token, 'ft_balance_of', { account_id: BURN })); say('burn address after 2 tickets', burnBal1.toString());
  const chk = await view(tv, 'check', { day, moves: bm.moves }); say('free check', chk);
  const s1 = await call(p1, tv, 'submit', { day, moves: bm.moves }, '0', 300); say('p1 submit', s1.val, 'tx', s1.tx, 'Tgas', s1.tgas);
  const s2 = await call(p2, tv, 'submit', { day, moves: '0:g' }, '0', 300); say('p2 submit (no heroes)', s2.val);
  let cheat = 'accepted?!'; try { await call(p2, tv, 'submit', { day, moves: '0:p,0,2,11;50:p,5,1,0;50:g' }, '0', 300); } catch (e) { cheat = 'rejected: ' + (e.message.match(/panicked: ([^"]+)/) || [0, e.message.slice(0, 120)])[1]; } say('p2 forges the timing of its moves:', cheat);
  const fake = await call(p2, tv, 'submit', { day, moves: '0:p,5,0,0;0:p,5,1,0;0:p,5,2,0;0:p,5,3,0;0:g' }, '0', 300); say('p2 places heroes it cannot afford: the rules ignore them ->', fake.val);
  say('day', await view(tv, 'get_day', { day }));
  const wait = 120 - (now() % 120) + 4; say('waiting', wait, 's for the day to end'); await sleep(wait * 1000);
  const st = await call(p2, tv, 'settle_day', { day }); say('settled by p2', st.logs.join(' | '));
  const dayInfo = await view(tv, 'get_day', { day }); say('day after settle', dayInfo);
  if (dayInfo.winners > 0) { const b0 = BigInt(await view(token, 'ft_balance_of', { account_id: p1 })); await call(p1, tv, 'claim_day', { day }, '0', 100); const b1 = BigInt(await view(token, 'ft_balance_of', { account_id: p1 })); say('p1 claimed', (b1 - b0).toString()); }
  say('p1 player', await view(tv, 'get_player', { account_id: p1 }));
  const supply1 = BigInt(await view(token, 'ft_total_supply')); const burnBal = BigInt(await view(token, 'ft_balance_of', { account_id: BURN }));
  say('tokens at the burn address', burnBal.toString(), 'supply', supply1.toString(), 'vs', supply0.toString());
  say('test vault config', await view(tv, 'config'));
  result.e2e = { ok: true, testVault: tv, day, players: [p1, p2], botLives: bm.rp.lives, target: bm.target, cheat, burned: burnBal.toString(), winners: dayInfo.winners, share: dayInfo.share };
  // ---- lock the production contracts: no key can change them any more ----
  for (const id of [token, vault]) { const a = await acct(id); const keys = await a.getAccessKeys(); for (const k of keys) await a.deleteKey(k.public_key); say('locked', id, '(keys left:', (await a.getAccessKeys()).length + ')'); }
  result.locked = true;
} catch (e) { say('ERROR', e.stack || String(e)); result.error = String(e.message || e); }
result.log = log; fs.writeFileSync(OUT, JSON.stringify(result, null, 2)); say('wrote', OUT);
