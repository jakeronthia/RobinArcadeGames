/* ROBIN Arcade — shared helpers for every page */
(function () {
  var links = {
    buy: SITE.token.buyUrl,
    swap: SITE.token.swapUrl,
    x: SITE.social.x,
    telegram: SITE.social.telegram
  };
  function bindLinks(root) {
    (root || document).querySelectorAll('[data-link]').forEach(function (a) {
      var url = links[a.getAttribute('data-link')];
      if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    });
  }
  window.bindLinks = bindLinks;
  document.addEventListener('DOMContentLoaded', function () { bindLinks(); });
  if (document.readyState !== 'loading') bindLinks();

  window.copyText = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
    function fallback() {
      return new Promise(function (res) {
        var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); res();
      });
    }
  };

  window.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
  };
})();

/* ===== coin cursor, coin burst and coin sound ===== */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sound = true;
  try { sound = localStorage.getItem('arcade-sound') !== 'off'; } catch (e) {}

  var AC = null;
  function tone(f, at, dur, vol, type) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(AC.destination); o.start(at); o.stop(at + dur);
  }
  window.coinSound = function () {
    if (!sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var t = AC.currentTime;
      tone(988, t, 0.08, 0.05); tone(1319, t + 0.07, 0.32, 0.05);
    } catch (e) {}
  };

  window.coinBurst = function (x, y) {
    if (reduce) return;
    var n = 16, parts = [];
    for (var i = 0; i < n; i++) {
      var el = document.createElement('span'); el.className = 'burst-coin';
      document.body.appendChild(el);
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 260 + Math.random() * 300;
      parts.push({ el: el, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 360, vr: (Math.random() - 0.5) * 900, s: 0.7 + Math.random() * 0.6 });
    }
    var last = performance.now(), life = 0;
    (function step(now) {
      var dt = Math.min(0.04, (now - last) / 1000); last = now; life += dt;
      parts.forEach(function (p) {
        p.vy += 1100 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        p.el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + p.r + 'deg) scale(' + p.s + ',' + p.s * Math.abs(Math.cos(p.r / 40)) + ')';
        p.el.style.opacity = Math.max(0, 1 - life / 0.9);
      });
      if (life < 0.9) requestAnimationFrame(step); else parts.forEach(function (p) { p.el.remove(); });
    })(last);
  };

  function bang(e) {
    var r = e.currentTarget.getBoundingClientRect();
    var x = e.clientX || (r.left + r.width / 2), y = e.clientY || (r.top + r.height / 2);
    coinBurst(x, y); coinSound();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('a.card, a.btn, .btn, #playBtn, .chip-btn');
    if (!t) return;
    bang({ currentTarget: t, clientX: e.clientX, clientY: e.clientY });
    // internal page links: let the coins fly for a moment before leaving
    if (t.tagName === 'A' && !t.target && !t.hasAttribute('download') && /^(?!#|data:|javascript:|mailto:)/.test(t.getAttribute('href') || '#') && !e.metaKey && !e.ctrlKey && !e.shiftKey && !reduce) {
      e.preventDefault(); var href = t.href; setTimeout(function () { location.href = href; }, 320);
    }
  }, true);

  /* sound toggle in the header */
  function paint(b) {
    b.setAttribute('aria-pressed', sound ? 'true' : 'false');
    b.setAttribute('aria-label', 'Sound');
    b.querySelector('.wave').style.display = sound ? '' : 'none';
    b.querySelector('.mute').style.display = sound ? 'none' : '';
  }
  function setup() {
    document.querySelectorAll('.snd').forEach(function (b) {
      paint(b);
      b.addEventListener('click', function () {
        sound = !sound; try { localStorage.setItem('arcade-sound', sound ? 'on' : 'off'); } catch (e) {}
        document.querySelectorAll('.snd').forEach(paint); coinSound();
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();

/* ===== player profile (stored on this device) ===== */
(function () {
  function read() { try { return JSON.parse(localStorage.getItem('arcade-profile') || 'null'); } catch (e) { return null; } }
  window.getProfile = read;
  window.saveProfile = function (p) { try { localStorage.setItem('arcade-profile', JSON.stringify(p)); } catch (e) {} paintChip(); };
  window.heroByName = function (n) { return HEROES.filter(function (h) { return h.name === n; })[0] || HEROES[0]; };

  function paintChip() {
    document.querySelectorAll('.me').forEach(function (a) {
      var p = read(); a.innerHTML = '';
      if (p && p.name) {
        var h = heroByName(p.hero), img = document.createElement('img');
        img.src = h.img; img.alt = ''; img.style.background = h.col;
        var s = document.createElement('span'); s.textContent = p.name;
        a.append(img, s);
        if (p.holder) { var b = document.createElement('i'); b.className = 'holder-dot'; b.title = '$ROBIN holder'; a.appendChild(b); }
        a.setAttribute('aria-label', 'Your profile: ' + p.name);
      } else {
        a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg><span>Profile</span>';
        a.setAttribute('aria-label', 'Create your player profile');
      }
    });
  }
  window.paintChip = paintChip;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintChip); else paintChip();

  /* $ROBIN balance of a NEAR account, read-only, via public RPC */
  window.robinBalance = function (account) {
    var rpcs = ['https://free.rpc.fastnear.com', 'https://rpc.mainnet.near.org'];
    function call(rpc, method, args) {
      return fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        jsonrpc: '2.0', id: 'arcade', method: 'query',
        params: { request_type: 'call_function', finality: 'final', account_id: SITE.token.contract, method_name: method, args_base64: btoa(JSON.stringify(args)) }
      }) }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.result || !j.result.result) throw new Error((j.error && (j.error.cause && j.error.cause.name || j.error.message)) || 'No result');
        return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
      });
    }
    function tryRpc(i) {
      return Promise.all([call(rpcs[i], 'ft_balance_of', { account_id: account }), call(rpcs[i], 'ft_metadata', {})])
        .catch(function (e) { if (i + 1 < rpcs.length) return tryRpc(i + 1); throw e; });
    }
    return tryRpc(0).then(function (r) {
      var raw = r[0] || '0', dec = (r[1] && r[1].decimals) || 0;
      var whole = raw.length > dec ? raw.slice(0, raw.length - dec) : '0';
      var frac = (raw.length > dec ? raw.slice(raw.length - dec) : raw.padStart(dec, '0')).slice(0, 2);
      return { raw: raw, amount: Number(whole + '.' + (frac || '0')), symbol: (r[1] && r[1].symbol) || 'ROBIN' };
    });
  };
})();

/* ===== installable app ===== */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}

/* ===== score card for X (1200x630) ===== */
window.makeScoreCard = function (g, score, label) {
  function load(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  var p = (window.getProfile && getProfile()) || {};
  var hero = heroByName(p.hero || 'Leonidas');
  return (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    return Promise.all([load(g.shot), load(hero.img), load('assets/robin.jpg')]);
  }).then(function (im) {
    var c = document.createElement('canvas'); c.width = 1200; c.height = 630; var x = c.getContext('2d');
    var acc = g.accent || '#ffc93c', disp = "700 {s}px Fredoka, 'Trebuchet MS', sans-serif";
    function font(s) { return disp.replace('{s}', s); }
    function rr(X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
    function outline(t, X, Y, fill, w) { x.lineJoin = 'round'; x.lineWidth = w || 12; x.strokeStyle = '#1d1038'; x.strokeText(t, X, Y); x.fillStyle = fill; x.fillText(t, X, Y); }
    x.fillStyle = '#0a0712'; x.fillRect(0, 0, 1200, 630);
    if (im[0]) { x.save(); x.globalAlpha = 0.35; var s = Math.max(1200 / im[0].width, 630 / im[0].height); x.drawImage(im[0], (1200 - im[0].width * s) / 2, (630 - im[0].height * s) / 2, im[0].width * s, im[0].height * s); x.restore(); }
    x.fillStyle = 'rgba(10,7,18,.55)'; x.fillRect(0, 0, 1200, 630);
    x.lineWidth = 10; x.strokeStyle = acc; rr(20, 20, 1160, 590, 36); x.stroke();
    // hero
    x.fillStyle = hero.col; x.beginPath(); x.arc(930, 330, 210, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#1d1038'; x.stroke();
    if (im[1]) x.drawImage(im[1], 730, 130, 400, 400);
    // texts
    x.textBaseline = 'alphabetic';
    x.font = "22px 'Press Start 2P', monospace"; x.fillStyle = acc; x.fillText('ROBIN ARCADE', 80, 110);
    x.font = font(64); outline(g.title, 80, 190, '#ffffff', 12);
    var has = +score > 0;
    x.font = "700 26px Nunito, sans-serif"; x.fillStyle = '#c9bfff'; x.fillText((has ? (label || 'Best score') : 'New challenger').toUpperCase(), 84, 270);
    x.font = font(has ? 150 : 130); outline(has ? Number(score).toLocaleString('en') : 'Ready!', 78, 410, acc, 16);
    x.font = "700 30px Nunito, sans-serif"; x.fillStyle = '#ffffff';
    x.fillText((p.name ? p.name + ' · ' : '') + hero.name, 84, 470);
    if (p.holder) { x.fillStyle = '#ffc93c'; rr(84, 492, 190, 44, 10); x.fill(); x.font = "16px 'Press Start 2P', monospace"; x.fillStyle = '#2a1a00'; x.fillText('HOLDER', 110, 522); }
    x.font = font(40); outline('Can you beat me?', 80, 580, '#ffc93c', 10);
    if (im[2]) { x.save(); x.beginPath(); x.arc(1110, 540, 48, 0, 7); x.clip(); x.drawImage(im[2], 1062, 492, 96, 96); x.restore(); x.lineWidth = 6; x.strokeStyle = '#ffc93c'; x.beginPath(); x.arc(1110, 540, 48, 0, 7); x.stroke(); }
    return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, url: c.toDataURL('image/png') }); }, 'image/png'); });
  });
};

/* ===== NEAR sign-in (NEP-413 signed message via MyNearWallet) + API ===== */
(function () {
  window.getSession = function () { try { return JSON.parse(localStorage.getItem('arcade-session') || 'null'); } catch (e) { return null; } };
  window.setSession = function (s) { try { if (s) localStorage.setItem('arcade-session', JSON.stringify(s)); else localStorage.removeItem('arcade-session'); } catch (e) {} };
  window.api = function (path, opts) {
    opts = opts || {}; var s = getSession(), h = { 'content-type': 'application/json' };
    if (s) h.authorization = 'Bearer ' + s.token;
    return fetch('api/' + path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: Object.assign(h, opts.headers || {}), body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('json') < 0) throw new Error('offline');
        return r.json().then(function (j) { if (r.status === 401 && s && !opts.headers) setSession(null); if (!r.ok) throw new Error(j.error || 'error'); return j; });
      });
  };
  var WALLET = 'https://app.mynearwallet.com';
  window.nearSignIn = function () {
    return api('auth/nonce', { method: 'POST' }).then(function (n) {
      var cb = location.origin + location.pathname;
      try { sessionStorage.setItem('near-signin', JSON.stringify({ nonce: n.nonce, cb: cb })); } catch (e) {}
      var u = new URL(WALLET + '/sign-message');
      u.searchParams.set('message', n.message); u.searchParams.set('nonce', n.nonce);
      u.searchParams.set('recipient', n.recipient); u.searchParams.set('callbackUrl', cb);
      location.href = u.toString();
    });
  };
  /* call on page load: finishes a sign-in when the wallet sends the player back */
  window.nearFinishSignIn = function () {
    var p = new URLSearchParams((location.hash || '').slice(1));
    var q = new URLSearchParams(location.search);
    function g(k) { return p.get(k) || q.get(k); }
    var pending = null; try { pending = JSON.parse(sessionStorage.getItem('near-signin') || 'null'); } catch (e) {}
    if (!pending || !(g('signature') || g('error') || g('errorCode'))) return Promise.resolve(null);
    try { sessionStorage.removeItem('near-signin'); } catch (e) {}
    history.replaceState(null, '', location.pathname);
    if (!g('signature')) return Promise.reject(new Error('The wallet did not sign the message.'));
    return api('auth/verify', { body: { accountId: g('accountId'), publicKey: g('publicKey'), signature: g('signature'), nonce: pending.nonce, callbackUrl: pending.cb } })
      .then(function (r) { setSession({ token: r.token, account: r.account }); return r; });
  };
})();
