/* ROBIN Arcade mini-game kit: one shell for the small arcade games.
   It builds the menu, HUD and game-over card, keeps the best score, draws the Ravenport night
   skyline and gives particles, pops and screen shake. A game only supplies its rules and drawing. */
(function () {
  'use strict';
  var CSS = "\
:root{--night:#0a0712;--panel:#1a1433;--line:#2e2650;--dim:#c9bfff;--mute:#8b83b8;--gold:#ffc93c;--gold-d:#b07a12;--pink:#ff3d8a;--sky:#7fe3ff;--green:#3ddc6a;--acc:#ffc93c;--display:'Fredoka','Trebuchet MS',system-ui,sans-serif;--body:'Nunito','Trebuchet MS',system-ui,sans-serif;color-scheme:dark}\
[hidden]{display:none!important}html,body{height:100%}\
body{margin:0;background:var(--night);color:#fff;font-family:var(--body);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}\
button{font:inherit;color:inherit}button:focus-visible{outline:3px solid var(--sky);outline-offset:2px}\
#cv{position:fixed;inset:0;width:100%;height:100%;display:block}\
#mHud{position:fixed;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:calc(env(safe-area-inset-top,0px) + 10px) max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));pointer-events:none;transition:opacity .3s}\
body:not(.playing) #mHud .pill{opacity:0}\
.pill{background:rgba(20,15,40,.86);border:2px solid var(--line);border-radius:16px;padding:5px 14px;min-height:44px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;transition:opacity .3s}\
.pill small{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--mute);line-height:1.1}\
.pill b{font-family:var(--display);font-size:22px;font-variant-numeric:tabular-nums;line-height:1.05}\
.pill.x b{color:var(--acc)}\
.sp{flex:1}\
.icon{pointer-events:auto;width:44px;height:44px;border-radius:50%;border:2px solid var(--line);background:rgba(20,15,40,.86);display:grid;place-items:center;cursor:pointer;padding:0;color:var(--dim)}\
.icon.off{color:var(--mute)}.icon.off .w{display:none}\
.ov{position:fixed;inset:0;display:grid;place-items:center;padding:20px;background:rgba(8,5,18,.55);backdrop-filter:blur(3px);transition:opacity .25s}\
.card{width:min(380px,100%);background:linear-gradient(180deg,#221a45,#150f2c);border:2px solid var(--line);border-radius:26px;padding:24px 22px 22px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.6);box-sizing:border-box}\
.tag{font-size:11px;font-weight:900;letter-spacing:.2em;color:var(--acc)}\
.card h1{font-family:var(--display);font-size:42px;line-height:1;margin:6px 0 10px;text-wrap:balance}\
.card p{margin:0 0 16px;color:var(--dim);font-size:15px;line-height:1.4;text-wrap:pretty}\
.go{border:0;border-radius:999px;background:var(--gold);color:#2a1a00;font-family:var(--display);font-weight:700;font-size:20px;padding:12px 34px;min-height:52px;min-width:200px;cursor:pointer;box-shadow:0 5px 0 var(--gold-d)}\
.go:active{transform:translateY(3px);box-shadow:0 2px 0 var(--gold-d)}\
.best{margin-top:14px;font-size:12px;font-weight:900;letter-spacing:.14em;color:var(--mute)}.best b{color:#fff;font-size:15px}\
.big{font-family:var(--display);font-size:76px;line-height:1;font-variant-numeric:tabular-nums;margin:4px 0 2px}\
.lbl{font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--mute);margin-bottom:12px}\
.nb{display:inline-block;margin:0 0 12px;padding:4px 12px;border-radius:999px;background:var(--pink);font-size:12px;font-weight:900;letter-spacing:.12em}\
.mis{margin:0 0 14px;padding:8px 12px;border-radius:14px;background:rgba(255,201,60,.1);border:1.5px solid rgba(255,201,60,.4);color:#ffe9a8;font-size:13px;font-weight:800;line-height:1.3}.mis b{color:var(--gold)}.mis.ok{background:rgba(61,220,106,.12);border-color:#3ddc6a;color:#bff5cf}\
.lvl{margin:-4px 0 14px;color:var(--dim);font-size:13px;font-weight:800;line-height:1.5}.lvl b{color:#fff}.lvl .st{color:var(--gold);letter-spacing:1px}.lvl .st i{font-style:normal;color:#4a4270}\
.pot{display:inline-block;margin-bottom:10px;padding:3px 10px;border-radius:999px;border:1.5px solid var(--gold);color:var(--gold);font-size:11px;font-weight:900;letter-spacing:.12em}\
.heroes{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 16px}\
.heroes button{width:54px;height:54px;border-radius:16px;border:2px solid var(--line);background:#120d28 center/84% no-repeat;cursor:pointer;padding:0}\
.heroes button[aria-pressed=true]{border-color:var(--acc);box-shadow:0 0 0 3px rgba(255,255,255,.08),0 0 18px var(--acc)}\
@media (max-height:520px){.card{padding:14px 18px}.card h1{font-size:30px}.big{font-size:52px}.card p{margin-bottom:10px}}";
  var HEROES = ['hoot', 'leonidas', 'atreus', 'trey', 'baller', 'frazzle', 'ilia', 'spud', 'sirplop'];
  var HNAME = { hoot: 'Hoot', leonidas: 'Leonidas', atreus: 'Atreus', trey: 'Trey', baller: 'Baller', frazzle: 'Frazzle', ilia: 'Ilia', spud: 'Spud', sirplop: 'Sir Plop' };
  var BASE = new URL('../', (document.currentScript && document.currentScript.src) || location.href).href; // -> assets/
  var imgs = {};
  function img(name) { if (!imgs[name]) { var i = new Image(); i.src = BASE + 'heroes/' + name + '.png'; imgs[name] = i; } return imgs[name]; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var INK = '#0a0716';

  var M = window.Mini = {
    W: 0, H: 0, u: 1, t: 0, state: 'menu', hero: 'hoot', best: 0, INK: INK, img: img, rng: rng, heroes: HEROES,
    init: function (o) {
      M.o = o; var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
      document.documentElement.style.setProperty('--acc', o.accent || '#ffc93c');
      var cv = M.cv = document.getElementById('cv'), ctx = M.ctx = cv.getContext('2d');
      try { M.best = +localStorage.getItem('mini-' + o.id + '-best') || 0; M.hero = localStorage.getItem('mini-hero') || 'hoot'; } catch (e) {}
      // one hero everywhere: the one you chose in the arcade is the one you play with
      var ORDER = ['leonidas', 'atreus', 'hoot', 'trey', 'baller', 'frazzle', 'ilia', 'spud', 'sirplop']; try { var ai = localStorage.getItem('rv-hero'); if (ai !== null && ORDER[+ai]) M.hero = ORDER[+ai]; } catch (e) {}
      var arcadeH = M.hero; if (HEROES.indexOf(M.hero) < 0) M.hero = 'hoot'; if (HEROES.indexOf(arcadeH) < 0) arcadeH = 'hoot'; if (o.hero) M.hero = o.hero;
      // the hero that earns XP here, and its level (1 to 3) from the arcade pass: higher levels get a small perk in every game
      M.xpHero = function () { return o.pickHero ? M.hero : (o.xpHero || arcadeH); };
      M.heroLv = function () { try { var P = JSON.parse(localStorage.getItem('rv-pass') || 'null'), xp = (P && P.heroes && P.heroes[M.xpHero()]) || 0; return xp >= 200 ? 3 : xp >= 60 ? 2 : 1; } catch (e) { return 1; } };
      function lvHtml() { var lv = M.heroLv(), perk = o.perks ? o.perks[lv - 1] : ''; return '<b>' + HNAME[M.xpHero()] + '</b> · level ' + lv + ' <span class="st">' + '\u2605'.repeat(lv) + '<i>' + '\u2605'.repeat(3 - lv) + '</i></span>' + (perk ? '<br>' + perk : ''); }
      // today's mission for this game, from the arcade pass
      function mission() { try { var d = new Date(), day = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), P = JSON.parse(localStorage.getItem('rv-pass') || 'null'); if (!P || P.day !== day) return null; return (P.missions || []).filter(function (m) { return m.type === 'score' && m.game === o.id; })[0] || null; } catch (e) { return null; } }
      function misHtml(score) { var m = mission(); if (!m) return ''; var ok = m.done || (score != null && score >= m.n); return '<div class="mis' + (ok ? ' ok' : '') + '">' + (ok ? 'MISSION DONE · ' : "TODAY'S MISSION · ") + m.text + (ok ? '' : ' · <b>+' + m.coins + ' coins</b>') + '</div>'; }
      M.misHtml = misHtml;
      var pot = /[?&]pot=1/.test(location.search);
      // HUD
      var hud = el('div', '', '<div class="pill"><small>' + (o.scoreLabel || 'SCORE') + '</small><b id="mScore">0</b></div><div class="pill x" id="mExtraP" hidden><small id="mExtraL"></small><b id="mExtra"></b></div><div class="sp"></div><button class="icon" id="mSnd" type="button" aria-label="Sound"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="w" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>'); hud.id = 'mHud'; document.body.appendChild(hud);
      // menu
      var menu = M.menu = el('div', 'ov'); menu.id = 'mMenu';
      var hs = ''; if (o.pickHero) { hs = '<div class="heroes" role="group" aria-label="Choose your hero">' + HEROES.map(function (h) { return '<button type="button" data-h="' + h + '" aria-label="' + HNAME[h] + '" aria-pressed="' + (h === M.hero) + '" style="background-image:url(' + BASE + 'heroes/' + h + '.png)"></button>'; }).join('') + '</div>'; }
      menu.innerHTML = '<div class="card">' + (pot ? '<div class="pot">PLAYING FOR THE POT</div><br>' : '') + '<div class="tag">ROBIN ARCADE</div><h1>' + o.title + '</h1><p>' + o.help + '</p><div id="mMis0">' + misHtml() + '</div>' + hs + '<div class="lvl" id="mLvl">' + lvHtml() + '</div><button class="go" id="mPlay" type="button">PLAY</button><div class="best">BEST <b id="mBest0">' + M.best + '</b></div></div>';
      document.body.appendChild(menu);
      var over = M.overEl = el('div', 'ov', '<div class="card"><div class="tag" id="mOverTag">GAME OVER</div><div class="big" id="mFinal">0</div><div class="lbl" id="mFinalL">' + (o.scoreLabel || 'SCORE') + '</div><div class="nb" id="mNew" hidden>NEW BEST!</div><p id="mLine" hidden></p><div id="mMis1"></div><div><button class="go" id="mAgain" type="button">PLAY AGAIN</button></div><div class="best">BEST <b id="mBest1">0</b></div></div>'); over.id = 'mOver'; over.hidden = true; document.body.appendChild(over);
      var $ = function (id) { return document.getElementById(id); }; M.$ = $;
      menu.querySelectorAll('.heroes button').forEach(function (b) { b.addEventListener('click', function () { M.hero = b.dataset.h; try { localStorage.setItem('mini-hero', M.hero); var oi = ORDER.indexOf(M.hero); if (oi >= 0) localStorage.setItem('rv-hero', oi); } catch (e) {} menu.querySelectorAll('.heroes button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); $('mLvl').innerHTML = lvHtml(); snd('click'); }); });
      HEROES.forEach(img);
      function begin() { if (M.state === 'play') return; if (window.SND) { SND.start(); } snd('start'); music(true); M.state = 'play'; M.scoreV = 0; $('mScore').textContent = '0'; M.extra(null); menu.hidden = true; over.hidden = true; document.body.classList.add('playing'); M.parts.length = 0; M.pops.length = 0; M.sh = 0; o.start && o.start(); }
      M.begin = begin;
      $('mPlay').addEventListener('click', begin); $('mAgain').addEventListener('click', begin);
      var sb = $('mSnd'); function sndUi() { sb.classList.toggle('off', !(window.SND && SND.on)); } sndUi();
      sb.addEventListener('click', function (e) { e.stopPropagation(); if (!window.SND) return; SND.start(); SND.toggle(); sndUi(); if (window.RobinMusic) RobinMusic.setOn(SND.on); });
      // input
      function pt(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
      cv.addEventListener('pointerdown', function (e) { if (M.state !== 'play') return; if (window.SND) SND.start(); var p = pt(e); o.down && o.down(p[0], p[1], e); });
      cv.addEventListener('pointermove', function (e) { if (M.state !== 'play') return; var p = pt(e); o.move && o.move(p[0], p[1], e); });
      addEventListener('pointerup', function (e) { if (M.state !== 'play') return; var p = pt(e); o.up && o.up(p[0], p[1], e); });
      addEventListener('keydown', function (e) { if (e.repeat) return; var k = e.key; if (M.state !== 'play') { if (k === 'Enter' || k === ' ') { var ae = document.activeElement; if (!ae || ae.tagName !== 'BUTTON') { e.preventDefault(); if (!M.lock) begin(); } } return; } if (k === ' ' || k.indexOf('Arrow') === 0) e.preventDefault(); o.key && o.key(k, e); });
      // size + loop
      function size() { var dpr = Math.min(2, window.devicePixelRatio || 1); M.W = cv.clientWidth; M.H = cv.clientHeight; cv.width = M.W * dpr | 0; cv.height = M.H * dpr | 0; M.dpr = dpr; M.u = Math.min(M.H / 640, M.W / 360); o.resize && o.resize(); }
      addEventListener('resize', size); size();
      var last = performance.now();
      function frame(now) { requestAnimationFrame(frame); var dt = Math.min(.033, (now - last) / 1000); last = now; if (document.hidden) return; M.t += dt;
        ctx.setTransform(M.dpr, 0, 0, M.dpr, 0, 0); ctx.save();
        if (M.sh > .01) { ctx.translate((Math.random() - .5) * M.sh * 14 * M.u, (Math.random() - .5) * M.sh * 14 * M.u); M.sh *= Math.pow(.02, dt); }
        if (M.state === 'play') o.update && o.update(dt); else o.idle && o.idle(dt);
        o.draw(ctx, M.W, M.H, dt); M.drawFx(ctx, dt); ctx.restore();
        if (M.fl > .01) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(.8, M.fl) + ')'; ctx.fillRect(0, 0, M.W, M.H); M.fl *= Math.pow(.004, dt); } }
      requestAnimationFrame(frame);
      function music(v) { if (!window.RobinMusic || !o.music) return; try { RobinMusic.setOn(!window.SND || SND.on); if (v) RobinMusic.play(BASE + 'music/' + o.music + '.mp3', { volume: .32 }); } catch (e) {} }
    },
    scoreV: 0,
    score: function (v) { M.scoreV = v; M.$('mScore').textContent = v.toLocaleString('en'); },
    add: function (n) { M.score(M.scoreV + n); },
    extra: function (label, v) { var p = M.$('mExtraP'); if (label == null) { p.hidden = true; return; } p.hidden = false; M.$('mExtraL').textContent = label; M.$('mExtra').textContent = v; },
    // end of a game: score is what counts for the record
    over: function (line, tag) { if (M.state !== 'play') return; M.state = 'over'; M.lock = true; var s = M.scoreV, nb = s > M.best; try { if (parent !== window) parent.postMessage({ rvScore: { id: M.o.id, score: s, best: nb && s > 0, hero: M.xpHero() } }, location.origin); } catch (e) {} if (nb) { M.best = s; try { localStorage.setItem('mini-' + M.o.id + '-best', s); } catch (e) {} }
      setTimeout(function () { M.lock = false; document.body.classList.remove('playing'); M.$('mFinal').textContent = s.toLocaleString('en'); M.$('mNew').hidden = !nb; M.$('mBest1').textContent = M.best.toLocaleString('en'); M.$('mBest0').textContent = M.best.toLocaleString('en'); M.$('mOverTag').textContent = tag || 'GAME OVER'; var l = M.$('mLine'); l.hidden = !line; l.textContent = line || ''; M.$('mMis1').innerHTML = M.misHtml(s); M.$('mMis0').innerHTML = M.misHtml(s); setTimeout(function () { M.$('mLvl').innerHTML = lvHtml(); }, 400); M.overEl.hidden = false; snd(nb && s > 0 ? 'win' : 'lose'); M.$('mAgain').focus({ preventScroll: true }); }, M.o.overDelay || 900); },
    // ---- juice ----
    parts: [], pops: [], sh: 0, fl: 0,
    shake: function (a) { M.sh = Math.max(M.sh, a); }, flash: function (a) { M.fl = Math.max(M.fl, a); },
    burst: function (x, y, col, n, sp, o) { o = o || {}; for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (sp || 160) * (.3 + Math.random()) * M.u; M.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0) * M.u, g: (o.g == null ? 500 : o.g) * M.u, r: (o.r || 4) * (.5 + Math.random()) * M.u, c: Array.isArray(col) ? col[i % col.length] : col, l: 0, m: (o.life || .7) * (.6 + Math.random() * .6), sq: o.sq, rot: Math.random() * 6, vr: (Math.random() - .5) * 12 }); } if (M.parts.length > 400) M.parts.splice(0, M.parts.length - 400); },
    pop: function (x, y, text, col, size) { M.pops.push({ x: x, y: y, s: text, c: col || '#fff', l: 0, z: size || 22 }); },
    drawFx: function (ctx, dt) { var i, p;
      for (i = M.parts.length - 1; i >= 0; i--) { p = M.parts[i]; p.l += dt; if (p.l > p.m) { M.parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; var k = 1 - p.l / p.m; ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.c;
        if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2); ctx.restore(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.4 + k * .6), 0, 6.283); ctx.fill(); } }
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (i = M.pops.length - 1; i >= 0; i--) { p = M.pops[i]; p.l += dt; if (p.l > .9) { M.pops.splice(i, 1); continue; } var e = Math.min(1, p.l / .12), sc = e < 1 ? .5 + e * .7 : 1.2 - Math.min(.2, (p.l - .12) * 2); ctx.globalAlpha = p.l > .6 ? 1 - (p.l - .6) / .3 : 1; ctx.font = '700 ' + (p.z * sc * M.u) + 'px Fredoka, sans-serif'; ctx.lineWidth = 5 * M.u; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(p.s, p.x, p.y - p.l * 46 * M.u); ctx.fillStyle = p.c; ctx.fillText(p.s, p.x, p.y - p.l * 46 * M.u); }
      ctx.globalAlpha = 1; },
    // ---- drawing helpers, comic ink look ----
    rr: function (ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
    ink: function (ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = (lw || 3) * M.u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); },
    drawHero: function (ctx, name, x, y, size, rot, flip, sx, sy) { var im = img(name); if (!im.complete || !im.naturalWidth) return; ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1); ctx.drawImage(im, -size / 2, -size / 2, size, size); ctx.restore(); },
    coin: function (ctx, x, y, r, spin) { var w = Math.abs(Math.cos(spin || 0)); ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(.18, w), 1); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fillStyle = '#ffc93c'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * .22); ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .58, 0, 6.283); ctx.fillStyle = '#ffe08a'; ctx.fill(); ctx.restore(); },
    // a thief of Ravenport: striped shirt, mask, beanie. s = height in px
    thief: function (ctx, x, y, s, o) { o = o || {}; var u = s / 100; ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(u * (o.flip ? -1 : 1), u); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
      if (o.sack !== false) { ctx.beginPath(); ctx.ellipse(-30, 12, 22, 26, -.3, 0, 6.283); ctx.fillStyle = '#b08a55'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffc93c'; ctx.font = '700 22px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', -31, 14); }
      M.rr(ctx, -24, -6, 48, 52, 16); ctx.fillStyle = '#f2efe6'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = '#23203a'; for (var i = 0; i < 4; i++) ctx.fillRect(-26, 2 + i * 14, 52, 7); ctx.restore(); M.rr(ctx, -24, -6, 48, 52, 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -28, 26, 0, 6.283); ctx.fillStyle = o.skin || '#e8b990'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -34, 26.5, Math.PI, 0); ctx.lineTo(27, -30); ctx.lineTo(-27, -30); ctx.closePath(); ctx.fillStyle = '#2a2740'; ctx.fill(); ctx.stroke();
      M.rr(ctx, -27, -34, 54, 16, 7); ctx.fillStyle = '#16142a'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-10, -26, 6.5, o.scared ? 7.5 : 5, 0, 0, 6.283); ctx.ellipse(10, -26, 6.5, o.scared ? 7.5 : 5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-9 + (o.look || 0) * 3, -26, 2.8, 0, 6.283); ctx.arc(11 + (o.look || 0) * 3, -26, 2.8, 0, 6.283); ctx.fill();
      ctx.beginPath(); if (o.scared) ctx.ellipse(0, -11, 5, 6, 0, 0, 6.283); else { ctx.moveTo(-8, -12); ctx.quadraticCurveTo(0, -5, 9, -13); } ctx.lineWidth = 3; ctx.stroke(); if (o.scared) { ctx.fillStyle = INK; ctx.fill(); }
      ctx.restore(); },
    // ---- Ravenport at night: parallax skyline, moon, rain ----
    sky: function (o) { o = o || {}; var r = rng(o.seed || 7), L = [], cols = ['#17133a', '#1f1949', '#2a215c'];
      for (var k = 0; k < 3; k++) { var b = [], x = 0; while (x < 1600) { var w = 46 + r() * 70, h = (70 + r() * 150) * (1 - k * .16) + k * 30, win = []; var cw = 9, ch = 12, nx = Math.floor((w - 10) / (cw + 6)), ny = Math.floor((h - 14) / (ch + 8)); for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) if (r() < .3) win.push([8 + i * (cw + 6), 12 + j * (ch + 8), r() < .16 ? 1 : 0]); b.push({ x: x, w: w, h: h, win: win, roof: r() < .35 ? 1 : r() < .2 ? 2 : 0 }); x += w + r() * 8; } L.push({ b: b, c: cols[k], sp: .12 + k * .16, span: x }); }
      var drops = []; for (var d = 0; d < 90; d++) drops.push([r(), r(), .5 + r() * .5]);
      return { L: L, drops: drops }; },
    drawSky: function (ctx, sky, scroll, o) { o = o || {}; var W = M.W, H = M.H, u = M.u, base = o.base == null ? H : o.base;
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070515'); g.addColorStop(.55, '#1c1548'); g.addColorStop(1, '#3a2466'); ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
      var mx = W * .78, my = H * .16; var mg = ctx.createRadialGradient(mx, my, 0, mx, my, 120 * u); mg.addColorStop(0, 'rgba(190,200,255,.35)'); mg.addColorStop(1, 'rgba(190,200,255,0)'); ctx.fillStyle = mg; ctx.fillRect(mx - 130 * u, my - 130 * u, 260 * u, 260 * u); ctx.beginPath(); ctx.arc(mx, my, 26 * u, 0, 6.283); ctx.fillStyle = '#e9ecff'; ctx.fill();
      for (var k = 0; k < 3; k++) { var L = sky.L[k], off = (scroll * L.sp) % L.span, y0 = base - (2 - k) * 26 * u * (o.lift == null ? 1 : o.lift);
        for (var pass = 0; pass < 2; pass++) for (var i = 0; i < L.b.length; i++) { var b = L.b[i], x = (b.x - off + pass * L.span) * u; if (x > W || x + b.w * u < 0) continue; var h = b.h * u, y = y0 - h; ctx.fillStyle = L.c; ctx.fillRect(x, y, b.w * u + 1, h + 400);
          if (b.roof === 1) ctx.fillRect(x + b.w * u * .2, y - 8 * u, b.w * u * .25, 9 * u); else if (b.roof === 2) { ctx.fillRect(x + b.w * u * .5, y - 22 * u, 2 * u, 22 * u); }
          for (var w = 0; w < b.win.length; w++) { var q = b.win[w]; ctx.fillStyle = q[2] ? 'rgba(127,227,255,' + (.35 + k * .2) + ')' : 'rgba(255,205,120,' + (.3 + k * .22) + ')'; ctx.fillRect(x + q[0] * u, y + q[1] * u, 9 * u, 12 * u); } } }
      if (o.rain !== false) { ctx.strokeStyle = 'rgba(170,190,255,.28)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); for (var d = 0; d < sky.drops.length; d++) { var p = sky.drops[d], yy = ((p[1] + M.t * (1.1 + p[2] * .7)) % 1) * (H + 40) - 20, xx = ((p[0] * 1.3 - yy / H * .16 - (o.wind || 0) * M.t * .2) % 1 + 1) % 1 * (W + 60) - 30; ctx.moveTo(xx, yy); ctx.lineTo(xx - 5 * u * p[2], yy + 16 * u * p[2]); } ctx.stroke(); } }
  };
  function snd(n, p) { if (window.SND) SND.play(n, p); }
  M.snd = snd;
})();
