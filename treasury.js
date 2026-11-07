/* Prize pool page: live jackpot, weekly pool, the two top 10s, your prizes. Reads the contract over RPC. */
(() => {
  const $ = id => document.getElementById(id), RV = window.RobinVault, VS = window.VaultSim;
  const W = [25, 18, 13, 10, 8, 7, 6, 5, 4, 4];
  let C = null, ME = null, cfg = null;
  const toast = t => { const el = document.createElement('div'); el.className = 'toast2'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 4200); };
  const T = x => RV.fmt(x) + ' tROBIN';
  const short = a => a.length > 22 ? a.slice(0, 10) + '…' + a.slice(-8) : a;
  const ago = s => { const d = Math.max(0, Math.floor(Date.now() / 1000) - s); return d < 60 ? d + 's ago' : d < 3600 ? Math.floor(d / 60) + 'm ago' : d < 86400 ? Math.floor(d / 3600) + 'h ago' : Math.floor(d / 86400) + 'd ago'; };
  const gameName = id => { const g = (window.GAMES || []).find(x => x.id === id); return g ? g.title : id; };
  const explorer = a => (C.network === 'mainnet' ? 'https://nearblocks.io/address/' : 'https://testnet.nearblocks.io/address/') + a;

  async function tx(label, receiver, method, args, deposit, tgas) {
    try { toast(label + '…'); const out = await RV.send(receiver, method, args, deposit, tgas); toast(label + ': done'); setTimeout(refresh, 1500); return out; }
    catch (e) { toast(label + ' failed: ' + String(e.message || e).slice(0, 140)); throw e; }
  }
  function board(el, list, pool, fmtV) {
    el.innerHTML = '';
    if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nobody yet this week: the first ten places are open.'; el.appendChild(li); return; }
    list.forEach((e, i) => { const li = document.createElement('li'); if (e.account === ME) li.className = 'me';
      li.innerHTML = '<b></b><span></span><em></em>'; li.children[0].textContent = short(e.account); li.children[1].textContent = fmtV(e.value); li.children[2].textContent = '≈ ' + RV.fmt(pool * BigInt(W[i]) / 100n); el.appendChild(li); });
  }
  async function refresh() {
    cfg = await RV.vaultView('config'); const week = cfg.week;
    const [w, feed] = await Promise.all([RV.vaultView('get_week', { week }), RV.vaultView('feed')]);
    const pool = BigInt(w.pool);
    $('cJack').textContent = T(cfg.jackpot); $('cJackS').textContent = '1 in ' + Number(cfg.odds_paid).toLocaleString('en') + ' on every game for the pot · ' + cfg.jackpots_won + ' won so far';
    $('cPool').textContent = T(w.pool); $('cPoolS').textContent = w.players + ' player' + (w.players === 1 ? '' : 's') + ' · ' + w.plays + ' games this week';
    $('cBurn').textContent = T(cfg.burned); $('cPlays').textContent = Number(cfg.plays_paid).toLocaleString('en'); $('cPlaysS').textContent = 'and ' + Number(cfg.plays_free).toLocaleString('en') + ' free rolls · ' + T(cfg.paid_out) + ' paid out';
    $('priceT').textContent = T(cfg.price); $('oddsP').textContent = Number(cfg.odds_paid).toLocaleString('en'); $('oddsF').textContent = Number(cfg.odds_free).toLocaleString('en'); $('freeN').textContent = cfg.free_per_day;
    const left = cfg.week_ends - Math.floor(Date.now() / 1000); $('ends').textContent = left > 86400 ? Math.floor(left / 86400) + 'd ' + Math.floor(left % 86400 / 3600) + 'h' : Math.floor(left / 3600) + 'h ' + Math.floor(left % 3600 / 60) + 'm';
    const tw = VS.daily(week); $('cupName').textContent = 'Defend the Vault · ' + tw.name; $('cupText').textContent = tw.text.replace(/ Keep \d+ vault or more\./, '') + ' Score = waves × 100 + vault left. The contract replays every defense before it counts.';
    board($('cup'), w.cup, pool * 6n / 10n, v => v + ' pts'); board($('active'), w.active, pool * 4n / 10n, v => v + ' game' + (v === 1 ? '' : 's'));
    const fd = $('feed'); fd.innerHTML = '';
    if (!feed.length) fd.innerHTML = '<p class="note">No games yet. Be the first.</p>';
    feed.forEach(f => { const won = BigInt(f.won) > 0n; const el = document.createElement('div'); el.className = 'fd' + (won ? ' win' : '');
      el.innerHTML = '<b></b><em></em><span></span><span></span>'; el.children[0].textContent = short(f.account); el.children[1].textContent = won ? 'JACKPOT ' + RV.fmt(f.won) : (f.paid ? 'for the pot' : 'free roll');
      el.children[2].textContent = gameName(f.game); el.children[3].textContent = ago(f.at); fd.appendChild(el); });
    if (week > 0) { const lw = await RV.vaultView('get_week', { week: week - 1 }); $('settleBtn').disabled = !ME || lw.settled || (BigInt(lw.pool) === 0n);
      $('settleNote').textContent = lw.settled ? 'Last week is closed: ' + lw.cup_shares.length + ' Cup and ' + lw.active_shares.length + ' activity prizes were paid out.' : (BigInt(lw.pool) > 0n ? 'Last week (' + T(lw.pool) + ') is waiting to be closed. Anyone can do it.' : 'Nothing to close for last week.'); }
    await refreshMe(week);
  }
  async function refreshMe(week) {
    renderRun();
    if (!ME) { $('youS').textContent = 'Sign in to see your games, rolls and prizes.'; $('claims').innerHTML = ''; badges(0); return; }
    const [bal, p, st] = await Promise.all([RV.tokenView('ft_balance_of', { account_id: ME }), RV.vaultView('get_player', { account_id: ME }), RV.vaultView('status', { account_id: ME })]);
    $('bal').textContent = T(bal); $('faucetBtn').hidden = BigInt(bal) >= 1000n * 10n ** 18n || C.network !== 'testnet';
    $('youS').textContent = st.plays_week + ' game' + (st.plays_week === 1 ? '' : 's') + ' for the pot this week · ' + st.credits + ' Cup entr' + (st.credits === 1 ? 'y' : 'ies') + ' ready · ' + st.free_left + ' free rolls left today' + (p.jackpots ? ' · jackpots won: ' + p.jackpots + ' (' + T(p.won) + ')' : '');
    const cl = $('claims'); cl.innerHTML = '';
    for (const c of st.claimable) { if (BigInt(c.amount) === 0n) continue; const el = document.createElement('div'); el.className = 'claim'; el.innerHTML = '<span>Week ' + c.week + ' prize · ' + T(c.amount) + '</span>';
      const b = document.createElement('button'); b.className = 'btn sm'; b.type = 'button'; b.textContent = 'Claim'; b.addEventListener('click', () => tx('Claiming', C.vault, 'claim', { week: c.week }, '0', 60)); el.appendChild(b); cl.appendChild(el); }
    badges(p.badges); renderRun(st.credits);
  }
  function badges(bits) { const box = $('badges'); box.innerHTML = ''; RV.BADGES.forEach(([bit, n, t], i) => { const got = (bits & bit) !== 0; const el = document.createElement('div'); el.className = 'bd' + (got ? ' got' : ''); el.innerHTML = '<i>' + (got ? '★' : (i + 1)) + '</i><b>' + n + '</b><span>' + t + '</span>'; box.appendChild(el); }); }
  function renderRun(credits) {
    const box = $('runBox'); let p = null; try { p = JSON.parse(localStorage.getItem('dtv-pending') || 'null'); } catch (e) {}
    if (!p || !cfg || p.week !== cfg.week || !p.moves) { box.hidden = true; return; } box.hidden = false;
    box.innerHTML = '<b>Your last Vault Cup defense: ' + p.score + ' points (' + p.waves + ' waves, ' + Math.max(0, p.lives) + ' vault left)</b><span class="note" id="chk">Checking it against the contract…</span>';
    const row = document.createElement('div'); row.className = 'row'; const s = document.createElement('button'); s.className = 'btn'; s.type = 'button';
    s.textContent = !ME ? 'Play instantly to send it' : credits > 0 ? 'Send it to the Cup' : 'Play Defend the Vault for the pot to send it';
    s.addEventListener('click', async () => { if (!ME) { $('guestBtn').click(); return; } if (!(credits > 0)) { location.href = 'game.html?g=vault'; return; }
      const out = await tx('Sending your defense', C.vault, 'submit', { week: p.week, moves: p.moves }, '0', 300); const v = RV.result(out); if (v) toast(v.rank ? 'Verified: ' + v.score + ' points, you are #' + v.rank + ' in the Cup!' : 'Verified: ' + v.score + ' points.'); });
    row.appendChild(s); box.appendChild(row);
    RV.vaultView('check', { week: p.week, moves: p.moves }).then(v => { $('chk').textContent = v.ok ? 'The contract agrees: ' + v.score + ' points.' : 'The contract cannot replay this defense.'; }).catch(() => { $('chk').textContent = 'Free check unavailable right now.'; });
  }
  function games() { const box = $('games'); box.innerHTML = ''; (window.GAMES || []).forEach(g => { const a = document.createElement('a'); a.href = 'game.html?g=' + g.id; a.innerHTML = '<img alt="" loading="lazy"><span></span>'; a.children[0].src = g.shot; a.children[1].textContent = g.title; box.appendChild(a); }); }

  const WHO0 = 'Play instantly with a free testnet account, or connect your NEAR wallet.';
  function paintWho() { const g = RV.guestId(); $('who').innerHTML = ME ? (g ? 'Guest account <b>' + ME + '</b> · kept on this device' : 'Playing as <b>' + ME + '</b>') : WHO0; $('connectBtn').textContent = ME ? 'Sign out' : 'Connect wallet'; $('guestBtn').hidden = !!ME || (C && C.network !== 'testnet'); }
  $('connectBtn').addEventListener('click', async () => { if (ME) { if (RV.guestId() && !confirm('Sign out of the guest account? Its key stays saved on this device, so you can come back with "Play instantly".')) return; await RV.signOut(); ME = null; paintWho(); $('bal').textContent = ''; $('faucetBtn').hidden = true; refresh(); return; } RV.signIn(); });
  $('guestBtn').addEventListener('click', async () => { const b = $('guestBtn'); b.disabled = true;
    try { let old = null; try { old = JSON.parse(localStorage.getItem('rv-guest-old') || 'null'); } catch (e) {}
      if (old && old.id) { localStorage.setItem('rv-guest', JSON.stringify(old)); localStorage.removeItem('rv-guest-old'); } else await RV.createGuest(t => { $('who').textContent = t; });
      ME = RV.guestId(); paintWho(); toast('Welcome, ' + ME + '! You have free tROBIN to play with.'); await refresh(); }
    catch (e) { toast('Could not create the account: ' + String(e.message || e).slice(0, 120)); paintWho(); } finally { b.disabled = false; } });
  $('faucetBtn').addEventListener('click', () => tx('Getting free tROBIN', C.token, 'faucet', {}, '0', 30));
  $('settleBtn').addEventListener('click', () => tx('Closing last week', C.vault, 'settle_week', { week: cfg.week - 1 }, '0', 80));

  (async () => { games();
    try { C = await RV.ready(); } catch (e) { $('offline').hidden = false; $('offline').textContent = 'The prize pool contract is being deployed. Come back in a few minutes.'; return; }
    $('net').textContent = C.network; $('net2').textContent = C.network; if (!C.locked) $('lockTag').hidden = true;
    $('addrNote').innerHTML = 'Prize pool contract: <a target="_blank" rel="noopener" href="' + explorer(C.vault) + '">' + C.vault + '</a> · token: <a target="_blank" rel="noopener" href="' + explorer(C.token) + '">' + C.token + '</a> · burn address: <a target="_blank" rel="noopener" href="' + explorer(C.burn_to) + '">' + C.burn_to.slice(0, 10) + '…</a>';
    if (RV.guestId()) ME = RV.guestId(); paintWho();
    try { await refresh(); } catch (e) { $('offline').hidden = false; $('offline').textContent = 'Could not reach NEAR right now: ' + e.message; }
    try { const { selector } = await RV.wallet(); const upd = async () => { ME = await RV.account(); paintWho(); try { await refresh(); } catch (e) {} };
      selector.store.observable.subscribe(() => upd()); await upd();
      if (new URLSearchParams(location.search).get('transactionHashes')) toast('Transaction confirmed');
      if (new URLSearchParams(location.search).get('submit') && !ME) toast('Press "Play instantly" or connect a wallet to send your defense');
    } catch (e) { if (!ME) $('who').textContent = 'Wallet unavailable: ' + String(e.message || e).slice(0, 100); }
    setInterval(() => refresh().catch(() => {}), 20000); })();
})();
