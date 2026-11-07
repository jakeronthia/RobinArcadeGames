// 1) runs worker/index.js locally against the real NEAR faucet; 2) plays the guest flow in a real browser on testnet.
import { chromium } from 'playwright'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const out = []; const say = s => { console.log(s); out.push(String(s)); };
const worker = (await import('../../worker/index.js')).default;
const assets = { fetch: async () => new Response('asset') };
// worker check with a throwaway key (any valid base58 32-byte key)
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const enc58 = b => { let n = BigInt('0x' + Buffer.from(b).toString('hex')); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } return s; };
const r = await worker.fetch(new Request('http://x/api/guest', { method: 'POST', body: JSON.stringify({ publicKey: 'ed25519:' + enc58(crypto.getRandomValues(new Uint8Array(32))) }) }), { ASSETS: assets });
say('worker /api/guest -> ' + r.status + ' ' + await r.text());
say('worker static -> ' + await (await worker.fetch(new Request('http://x/index.html'), { ASSETS: assets })).text());
// browser flow, /api/guest answered by the same worker code
const srv = spawn('python3', ['-m', 'http.server', '8799'], { cwd: '../..', stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
pg.on('console', m => { if (m.type() === 'error') say('console error: ' + m.text().slice(0, 300)); }); pg.on('pageerror', e => say('pageerror: ' + String(e).slice(0, 300)));
await pg.route('**/api/guest', async route => { const res = await worker.fetch(new Request('http://x/api/guest', { method: 'POST', body: route.request().postData() }), { ASSETS: assets }); route.fulfill({ status: res.status, body: await res.text(), contentType: 'application/json' }); });
const txt = id => pg.evaluate(i => document.getElementById(i).textContent, id);
try {
  await pg.goto('http://localhost:8799/game.html?g=rush'); await pg.waitForTimeout(3000);
  await pg.click('#playBtn'); await pg.waitForTimeout(5000);
  say('jackpot before: ' + await txt('jpAmt'));
  await pg.click('#chAcct .btn');
  for (let k = 0; k < 40 && !(await txt('chAcct')).includes('Playing as'); k++) await pg.waitForTimeout(1500);
  say('account: ' + await txt('chAcct')); await pg.waitForTimeout(4000);
  await pg.click('#potCard');
  for (let k = 0; k < 30 && await pg.evaluate(() => document.getElementById('chRes').hidden); k++) await pg.waitForTimeout(1500);
  say('result: ' + await txt('chRes') + ' | note: ' + await txt('potNote'));
  await pg.screenshot({ path: '../../ci/ui_guest.png', fullPage: false });
  await pg.goto('http://localhost:8799/treasury.html'); await pg.waitForTimeout(8000);
  say('pool page: jackpot ' + await txt('cJack') + ' | you: ' + await txt('youS') + ' | feed: ' + (await txt('feed')).slice(0, 160));
  await pg.screenshot({ path: '../../ci/ui_treasury.png', fullPage: true });
} catch (e) { say('ERROR ' + e.message); }
await b.close(); srv.kill(); fs.mkdirSync('../../ci', { recursive: true }); fs.writeFileSync('../../ci/guest.txt', out.join('\n'));
