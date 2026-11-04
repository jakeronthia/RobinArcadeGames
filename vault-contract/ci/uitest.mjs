// Opens the real site against the deployed testnet contracts and checks the Vault page and the wallet modal.
import { chromium } from 'playwright'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const root = '../..'; const srv = spawn('python3', ['-m', 'http.server', '8799'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500)); const out = []; const say = s => { console.log(s); out.push(s); };
const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') say('console ' + m.type() + ': ' + m.text().slice(0, 300)); });
pg.on('pageerror', e => say('pageerror: ' + String(e).slice(0, 300)));
try {
  await pg.goto('http://localhost:8799/treasury.html'); await pg.waitForTimeout(9000);
  say('counters: ' + JSON.stringify(await pg.evaluate(() => ['cBurn', 'cPot', 'cRes', 'cRuns', 'twName', 'who'].map(i => document.getElementById(i).textContent))));
  await pg.screenshot({ path: '../../ci/ui_treasury.png', fullPage: true });
  await pg.click('#connectBtn'); await pg.waitForTimeout(4000); await pg.screenshot({ path: '../../ci/ui_modal.png' });
  say('modal open: ' + await pg.evaluate(() => !!document.querySelector('#near-wallet-selector-modal .modal, .nws-modal-wrapper, .modal-overlay')));
  await pg.goto('http://localhost:8799/games/vault.html'); await pg.waitForTimeout(8000);
  say('game daily: ' + JSON.stringify(await pg.evaluate(() => [document.getElementById('dName').textContent, document.getElementById('dPot').textContent])));
} catch (e) { say('ERROR ' + e.message); }
await b.close(); srv.kill(); fs.writeFileSync('../../ci/ui.txt', out.join('\n'));
