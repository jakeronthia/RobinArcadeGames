/* ROBIN Arcade sound engine.
   Every effect is built live in Web Audio (no downloads); only the district music is mp3.
   Used by the 3D home (room + city) and by the small arcade games (SND.play('name')). */
window.SND = (function () {
  var ctx = null, master, sfx, amb, mus, rev, on = true, started = false;
  var inCity = false, raining = true, lastCoin = 0, ducked = false, room = false;
  var WN = null, BN = null, rainG = null, roomG = null, lampG = null, cabG = null, cabPan = null, bedG = null, bedF = null;
  var TR = {}, TRACKS = ['home', 'patrol', 'rush', 'brawl', 'nightshift', 'tycoon', 'vault'];
  var MUSIC = 'assets/music/'; try { MUSIC = new URL('../music/', document.currentScript.src).href; } catch (e) {}
  try { on = localStorage.getItem('rv-sound') !== '0'; } catch (e) {}
  var R = Math.random;

  function mkNoise(sec, brown) { var b = ctx.createBuffer(2, ctx.sampleRate * sec, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), last = 0; for (var i = 0; i < d.length; i++) { var w = R() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = w * .6 + last * 3; } else d[i] = w; } } return b; }
  function mkImpulse(sec) { var n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), lp = 0; for (var i = 0; i < n; i++) { var k = 1 - i / n; lp += ((R() * 2 - 1) - lp) * (.25 + .6 * k); d[i] = lp * Math.pow(k, 3.2); } } return b; }
  function start() {
    if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; } started = true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(comp);
    sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
    mus = ctx.createGain(); mus.gain.value = 1; mus.connect(master);
    rev = ctx.createConvolver(); rev.buffer = mkImpulse(1.7); var rg = ctx.createGain(); rg.gain.value = .9; rev.connect(rg); rg.connect(master);
    var send = ctx.createGain(); send.gain.value = .22; sfx.connect(send); send.connect(rev);
    WN = mkNoise(2, false); BN = mkNoise(4, true);
    // rain over the city, with slow gusts
    rainG = ctx.createGain(); rainG.gain.value = 0; var gust = ctx.createGain(); gust.gain.value = 1; rainG.connect(gust); gust.connect(amb);
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .11; lg.gain.value = .22; lfo.connect(lg); lg.connect(gust.gain); lfo.start();
    [['highpass', 2600, .04], ['bandpass', 1200, .035], ['lowpass', 500, .08]].forEach(function (a) { var s = ctx.createBufferSource(); s.buffer = BN; s.loop = true; var fl = ctx.createBiquadFilter(); fl.type = a[0]; fl.frequency.value = a[1]; fl.Q.value = .6; var gg = ctx.createGain(); gg.gain.value = a[2]; s.connect(fl); fl.connect(gg); gg.connect(rainG); s.start(0, R() * 3); });
    // the arcade room: air, mains hum, rain behind the wall, the faulty lamp
    roomG = ctx.createGain(); roomG.gain.value = 0; roomG.connect(amb);
    (function () { var s = ctx.createBufferSource(); s.buffer = BN; s.loop = true; var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; var g = ctx.createGain(); g.gain.value = .11; s.connect(f); f.connect(g); g.connect(roomG); s.start(0, 1);
      [[100, .016], [200, .007], [300, .003]].forEach(function (h) { var o = ctx.createOscillator(); o.frequency.value = h[0]; var og = ctx.createGain(); og.gain.value = h[1]; o.connect(og); og.connect(roomG); o.start(); });
      lampG = ctx.createGain(); lampG.gain.value = 0; var lo = ctx.createOscillator(); lo.type = 'sawtooth'; lo.frequency.value = 100; var lf = ctx.createBiquadFilter(); lf.type = 'bandpass'; lf.frequency.value = 2600; lf.Q.value = 3; lo.connect(lf); lf.connect(lampG); lampG.connect(roomG); lo.start(); })();
    // the cabinet speaker: a small 8-bit attract tune that comes from where the cabinet stands
    cabG = ctx.createGain(); cabG.gain.value = 0; var spk = ctx.createBiquadFilter(); spk.type = 'bandpass'; spk.frequency.value = 1500; spk.Q.value = .45;
    cabG.connect(spk);
    try { cabPan = ctx.createPanner(); cabPan.panningModel = 'equalpower'; cabPan.distanceModel = 'inverse'; cabPan.refDistance = 2.2; cabPan.rolloffFactor = 1.3; setPos(cabPan, 0, 1.4, 0); spk.connect(cabPan); cabPan.connect(mus); var cs = ctx.createGain(); cs.gain.value = .5; cabPan.connect(cs); cs.connect(rev); } catch (e) { spk.connect(mus); }
    // one noise bed for the district you stop at
    bedG = ctx.createGain(); bedG.gain.value = 0; bedF = ctx.createBiquadFilter(); bedF.type = 'bandpass'; bedF.frequency.value = 600; bedF.Q.value = .7; var bs = ctx.createBufferSource(); bs.buffer = BN; bs.loop = true; bs.connect(bedF); bedF.connect(bedG); bedG.connect(amb); bs.start(0, 2);
    TRACKS.forEach(function (n) { var el = new Audio(MUSIC + n + '.mp3'); el.loop = true; el.preload = 'none'; var g = ctx.createGain(); g.gain.value = 0; try { ctx.createMediaElementSource(el).connect(g); g.connect(mus); } catch (e) {} TR[n] = { el: el, g: g, v: 0 }; });
    setInterval(tickSeq, 90); setInterval(tickDistrict, 500);
  }
  function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  function ramp(g, v, t) { if (!g || !ctx) return; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(v, ctx.currentTime, t || .6); }

  // ---------- building blocks ----------
  var K = 1; // loudness of the sound being built, so quiet clicks and big thuds sit at the same level
  var GAIN = { click: 3, ratchet: 2.6, hover: 3, open: 2.6, close: 2.8, paper: 2.2, pin: 2.6, neon: 2.2, flap: 5, point: 2.2, blip: 5, dial: 7, wrong: 3.5, swap: 7, tick: 3.5, pop: 3.5, whack: 2, thud: 2, match: 2.2, perfect: 1.6, confirm: 1.5, win: 1.4, hit: 1.5, safe: .7, warp: .75, unlock: .7, trophy: 1.1 };
  var EVG = { tycoon: 4, nightshift: 3, patrol: 2.2, rush: 1.6 };
  function tone(o) { var t = ctx.currentTime + (o.t || 0), os = ctx.createOscillator(), g = ctx.createGain(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t); if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.g * K, t + (o.a || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + o.dur); os.connect(g); g.connect(o.dest || sfx); os.start(t); os.stop(t + o.dur + .05); }
  function nz(o) { var t = ctx.currentTime + (o.t || 0), s = ctx.createBufferSource(); s.buffer = WN; s.loop = true; var fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f, t); if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur); fl.Q.value = o.q || 1;
    var g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.g * K, t + (o.a || .003)); g.gain.exponentialRampToValueAtTime(.0001, t + o.dur); s.connect(fl); fl.connect(g); g.connect(o.dest || sfx); s.start(t, R() * 1.5); s.stop(t + o.dur + .05); }
  function metal(o) { (o.p || [1, 2.76, 5.4, 8.93]).forEach(function (r, i) { tone({ f: o.f * r, t: o.t, dur: o.dur / (1 + i * .6), g: o.g / (1 + i * .8), dest: o.dest }); }); }
  function notes(arr, type, step, dur, g, t0) { arr.forEach(function (f, i) { if (f) tone({ type: type, t: (t0 || 0) + i * step, f: f, dur: dur, g: g }); }); }

  // ---------- the sounds ----------
  var FX = {
    // interface: real arcade hardware, not beeps
    click: function () { nz({ dur: .012, g: .22, type: 'highpass', f: 3500 }); tone({ f: 1500, f2: 700, dur: .03, g: .1 }); nz({ t: .055, dur: .01, g: .1, type: 'highpass', f: 4500 }); },
    ratchet: function () { nz({ dur: .014, g: .28, type: 'bandpass', f: 2400, q: 2 }); tone({ f: 190, f2: 90, dur: .07, g: .22 }); },
    hover: function () { tone({ f: 2100, dur: .03, g: .025 }); },
    open: function () { nz({ dur: .3, g: .1, type: 'bandpass', f: 500, f2: 2600, q: .8, a: .09 }); },
    close: function () { nz({ dur: .22, g: .08, type: 'bandpass', f: 2400, f2: 450, q: .8, a: .03 }); },
    coin: function (p) { p = p || 1; metal({ f: 1900 * p, dur: .45, g: .1, p: [1, 1.52, 2.4, 3.9] }); metal({ t: .07, f: 2540 * p, dur: .7, g: .12, p: [1, 1.5, 2.42] }); },
    start: function () { nz({ dur: .09, g: .16, type: 'bandpass', f: 3000, q: 3 }); metal({ t: .1, f: 2100, dur: .4, g: .1 }); tone({ t: .2, f: 120, f2: 70, dur: .12, g: .28 }); notes([659, 784, 988, 1319], 'square', .085, .16, .05, .42); },
    confirm: function () { notes([523, 659, 784, 1047], 'triangle', .06, .4, .09); },
    warp: function () { nz({ dur: 1.7, g: .35, type: 'bandpass', f: 250, f2: 5000, q: 1.4, a: 1.1 }); tone({ type: 'sawtooth', f: 90, f2: 900, dur: 1.5, g: .05, a: .9 }); tone({ t: 1.45, f: 160, f2: 38, dur: .9, g: .45, a: .02 }); },
    // the room objects
    safe: function () { for (var i = 0; i < 6; i++) { var t = i * .075 + R() * .02; nz({ t: t, dur: .012, g: .2, type: 'bandpass', f: 3200, q: 4 }); tone({ t: t, f: 900, dur: .02, g: .04 }); } tone({ t: .56, f: 95, f2: 42, dur: .5, g: .5 }); nz({ t: .56, dur: .25, g: .25, type: 'lowpass', f: 500 }); tone({ type: 'sawtooth', t: .78, f: 205, f2: 150, dur: .45, g: .02, a: .1 }); },
    trophy: function () { metal({ f: 1320, dur: 1.1, g: .1, p: [1, 2.32, 3.86, 5.9] }); metal({ t: .11, f: 1760, dur: .9, g: .08, p: [1, 2.3, 4.1] }); },
    paper: function () { for (var i = 0; i < 5; i++) nz({ t: i * .05 + R() * .02, dur: .06 + R() * .05, g: .06 + R() * .05, type: 'bandpass', f: 2500 + R() * 3000, q: .7, a: .01 }); },
    coins: function () { for (var i = 0; i < 7; i++) { var t = i * .075 + R() * .03; metal({ t: t, f: 2300 + R() * 1500, dur: .25, g: .07, p: [1, 1.5, 2.4] }); nz({ t: t, dur: .01, g: .09, type: 'highpass', f: 5000 }); } },
    pin: function () { tone({ f: 520, f2: 210, dur: .07, g: .28 }); nz({ dur: .01, g: .18, type: 'bandpass', f: 1800, q: 2 }); tone({ t: .004, f: 140, f2: 90, dur: .09, g: .18 }); },
    neon: function () { var d = ctx.createGain(); d.gain.value = 1; d.connect(sfx); for (var k = 0; k < 5; k++) { var t = k * .08 + R() * .03; tone({ type: 'sawtooth', t: t, f: 100, dur: .05, g: .03, dest: d }); nz({ t: t, dur: .04, g: .05, type: 'bandpass', f: 3200, q: 5, dest: d }); } nz({ t: .5, dur: 1.1, g: .035, type: 'bandpass', f: 3200, q: 6, a: .05 }); metal({ t: .5, f: 2600, dur: .5, g: .03, p: [1, 1.9, 3.1] }); },
    // small games
    flap: function () { nz({ dur: .13, g: .16, type: 'lowpass', f: 1400, f2: 300, a: .02 }); },
    point: function (p) { p = p || 1; tone({ type: 'triangle', f: 988 * p, dur: .12, g: .1 }); tone({ type: 'triangle', t: .07, f: 1319 * p, dur: .25, g: .1 }); },
    blip: function (p) { tone({ type: 'triangle', f: 660 * (p || 1), dur: .09, g: .09 }); },
    hit: function () { tone({ f: 170, f2: 50, dur: .25, g: .5 }); nz({ dur: .12, g: .3, type: 'lowpass', f: 1800 }); },
    thud: function (p) { tone({ f: 140 * (p || 1), f2: 60, dur: .16, g: .4 }); nz({ dur: .05, g: .18, type: 'bandpass', f: 900, q: 1 }); },
    perfect: function (p) { p = p || 1; notes([1047 * p, 1319 * p, 1568 * p, 2093 * p], 'sine', .045, .35, .07); metal({ t: .18, f: 3100, dur: .5, g: .03 }); },
    dial: function (p) { nz({ dur: .012, g: .2, type: 'bandpass', f: 3000 * (p || 1), q: 4 }); tone({ f: 800, dur: .02, g: .04 }); },
    unlock: function () { FX.safe(); notes([523, 784, 1047], 'triangle', .08, .4, .08, .9); },
    whack: function () { tone({ f: 260, f2: 80, dur: .12, g: .4 }); nz({ dur: .06, g: .3, type: 'bandpass', f: 1500, q: .8 }); tone({ type: 'square', t: .03, f: 880, f2: 1500, dur: .07, g: .03 }); },
    wrong: function () { tone({ type: 'sawtooth', f: 180, f2: 110, dur: .3, g: .09 }); tone({ type: 'sawtooth', f: 190, f2: 116, dur: .3, g: .09 }); },
    swap: function () { nz({ dur: .09, g: .08, type: 'bandpass', f: 1200, f2: 2600, q: 1.2, a: .02 }); },
    match: function (p) { p = p || 1; tone({ type: 'sine', f: 660 * p, dur: .3, g: .1 }); tone({ type: 'sine', t: .05, f: 990 * p, dur: .35, g: .08 }); metal({ t: .02, f: 2400 * p, dur: .3, g: .03 }); },
    win: function () { notes([523, 659, 784, 1047, 784, 1047, 1319], 'square', .11, .22, .05); notes([262, 0, 330, 0, 392, 0, 523], 'triangle', .11, .3, .09); },
    lose: function () { notes([392, 370, 330, 262, 196], 'triangle', .14, .3, .1); tone({ t: .7, f: 110, f2: 55, dur: .6, g: .2 }); },
    tick: function () { nz({ dur: .008, g: .12, type: 'highpass', f: 4000 }); },
    pop: function (p) { tone({ f: 420 * (p || 1), f2: 900 * (p || 1), dur: .07, g: .16 }); }
  };
  var OBJ = { prize: 'safe', hall: 'trophy', heroes: 'paper', token: 'coins', faq: 'pin', games: 'click' };
  function play(name, p) { if (!ctx || !on) return; if (ctx.state === 'suspended') ctx.resume(); var f = FX[name]; if (f) try { K = GAIN[name] || 1; f(p); } catch (e) {} K = 1; }

  // ---------- cabinet attract tune (8-bit, 4 bars, loops) ----------
  var seqI = 0, seqT = 0, STEP = 60 / 126 / 4;
  var N = function (m) { return m ? 440 * Math.pow(2, (m - 69) / 12) : 0; };
  var LEAD = [76, 0, 81, 0, 79, 76, 0, 72, 77, 0, 81, 0, 84, 81, 0, 77, 79, 0, 76, 0, 72, 76, 79, 0, 74, 0, 79, 0, 83, 0, 86, 83, 76, 0, 81, 0, 79, 76, 0, 72, 77, 0, 81, 84, 0, 81, 77, 0, 84, 0, 83, 0, 79, 0, 76, 0, 74, 76, 79, 83, 81, 0, 0, 0];
  var ROOTS = [45, 41, 48, 43], CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
  function tickSeq() { if (!ctx || !room || document.hidden) { seqT = 0; return; } var now = ctx.currentTime; if (seqT < now) seqT = now + .05;
    while (seqT < now + .25) { var i = seqI % 128, e = i >> 1, bar = (i >> 4) % 4, t = seqT - now;
      if (i % 2 === 0 && LEAD[e]) tone({ type: 'square', t: t, f: N(LEAD[e]), dur: STEP * 1.8, g: .05, dest: cabG });
      tone({ type: 'square', t: t, f: N(CH[bar][i % 3] + 12), dur: STEP * .8, g: .014, dest: cabG });
      if (i % 4 === 0) tone({ type: 'triangle', t: t, f: N(ROOTS[bar] + (i % 8 ? 12 : 0)), dur: STEP * 3, g: .09, dest: cabG });
      if (i % 8 === 0) tone({ t: t, f: 150, f2: 50, dur: .1, g: .1, dest: cabG });
      if (i % 4 === 2) nz({ t: t, dur: .03, g: .02, type: 'highpass', f: 6000, dest: cabG });
      seqT += STEP; seqI++; } }

  // ---------- district life while you are stopped at a game ----------
  var district = null, nextEv = 0;
  var BED = { rush: ['lowpass', 150, .28], brawl: ['bandpass', 950, .05], nightshift: ['bandpass', 420, .06], patrol: ['bandpass', 500, .03], tycoon: ['lowpass', 300, .05], vault: ['lowpass', 200, .1], skyhoot: ['bandpass', 380, .07], safecracker: ['lowpass', 220, .05], loottower: ['lowpass', 180, .12], wanted: ['bandpass', 700, .03], lootmatch: ['bandpass', 1400, .015] };
  var EV = {
    rush: function () { if (R() < .45) { [659, 523, 784].forEach(function (f, i) { tone({ t: i * .42, f: f, dur: 1.4, g: .035 }); tone({ t: i * .42, f: f * 2, dur: .7, g: .012 }); }); } else for (var i = 0; i < 6; i++) { tone({ t: i * .34, f: 95, f2: 55, dur: .1, g: .16 }); tone({ t: i * .34 + .09, f: 85, f2: 50, dur: .1, g: .12 }); nz({ t: i * .34, dur: .05, g: .03, type: 'bandpass', f: 2200, q: 2 }); } },
    brawl: function () { nz({ dur: 1.6, g: .09, type: 'bandpass', f: 1100, q: .5, a: .5 }); nz({ dur: 1.4, g: .05, type: 'bandpass', f: 2300, q: .7, a: .6 }); var t = .1 + R() * .4; tone({ t: t, f: 150, f2: 55, dur: .14, g: .2 }); nz({ t: t, dur: .05, g: .1, type: 'bandpass', f: 1300 }); if (R() < .4) metal({ t: .9, f: 1050, dur: 1.2, g: .03, p: [1, 2.4, 3.9] }); },
    patrol: function () { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(amb); var sr = ctx.createGain(); sr.gain.value = .4; lp.connect(sr); sr.connect(rev); for (var i = 0; i < 6; i++) tone({ t: i * .55, f: i % 2 ? 870 : 650, dur: .56, g: .012, a: .08, dest: lp }); },
    nightshift: function () { if (R() < .5) metal({ f: 620 + R() * 300, dur: 1.2, g: .02, p: [1, 2.9, 4.7] }); else nz({ dur: 2.2, g: .06, type: 'bandpass', f: 300, f2: 700, q: 2, a: 1 }); },
    tycoon: function () { if (R() < .35) { tone({ f: 110, f2: 80, dur: .08, g: .12 }); metal({ t: .08, f: 2200, dur: .9, g: .035, p: [1, 1.5, 2.6] }); } else { var n = 4 + (R() * 8 | 0); for (var i = 0; i < n; i++) nz({ t: i * (.07 + R() * .05), dur: .012, g: .03 + R() * .02, type: 'bandpass', f: 1800 + R() * 1400, q: 2 }); } },
    vault: function () { [0, .38, .76, 1.14].forEach(function (t, i) { tone({ t: t, f: 82, f2: 48, dur: .3, g: i % 2 ? .12 : .2 }); }); if (R() < .4) for (var i = 0; i < 8; i++) metal({ t: 1.5 + i * .12, f: 1500, dur: .14, g: .012, p: [1, 2.7] }); }
  };
  EV.skyhoot = function () { if (R() < .5) for (var i = 0; i < 4; i++) nz({ t: i * .19, dur: .13, g: .1, type: 'lowpass', f: 1300, f2: 300, a: .02 }); else { tone({ type: 'triangle', f: 988, dur: .12, g: .05 }); tone({ type: 'triangle', t: .07, f: 1319, dur: .25, g: .05 }); } };
  EV.safecracker = function () { for (var i = 0; i < 5; i++) { var t = i * .16 + R() * .03; nz({ t: t, dur: .012, g: .12, type: 'bandpass', f: 3000, q: 4 }); } if (R() < .4) { tone({ t: .95, f: 95, f2: 45, dur: .45, g: .25 }); notes([523, 784, 1047], 'triangle', .08, .4, .04, 1.15); } };
  EV.loottower = function () { tone({ type: 'sawtooth', f: 62, f2: 70, dur: 1.5, g: .03, a: .3 }); tone({ t: 1.3, f: 140, f2: 60, dur: .18, g: .3 }); nz({ t: 1.3, dur: .06, g: .12, type: 'bandpass', f: 900 }); };
  EV.wanted = function () { var t = R() * .3; tone({ t: t, f: 260, f2: 80, dur: .12, g: .22 }); nz({ t: t, dur: .06, g: .16, type: 'bandpass', f: 1500, q: .8 }); if (R() < .35) metal({ t: t + .5, f: 2900, dur: .5, g: .03, p: [1, 1.7, 2.9] }); };
  EV.lootmatch = function () { var p = 1 + (R() * 4 | 0) * .12; tone({ f: 660 * p, dur: .3, g: .06 }); tone({ t: .05, f: 990 * p, dur: .35, g: .05 }); metal({ t: .02, f: 2400 * p, dur: .3, g: .02 }); };
  function setDistrict(d) { if (d === district) return; district = d; var b = d && BED[d]; if (b) { bedF.type = b[0]; bedF.frequency.setTargetAtTime(b[1], ctx.currentTime, .3); } ramp(bedG, b ? b[2] : 0, .9); nextEv = performance.now() + 2500; }
  function tickDistrict() { if (!ctx || !on || !inCity || !district || document.hidden || ducked) return; var n = performance.now(); if (n < nextEv) return; nextEv = n + 5000 + R() * 6000; try { K = EVG[district] || 1; EV[district] && EV[district](); } catch (e) {} K = 1; }

  var lastL = 1, lastLampTick = 0;
  return {
    get on() { return on; }, get ready() { return !!ctx; },
    start: start, play: play,
    toggle: function () { on = !on; try { localStorage.setItem('rv-sound', on ? '1' : '0'); } catch (e) {} if (master) ramp(master, on ? 1 : 0, .15); return on; },
    // called every frame by the 3D home: o = { room, lamp, cab, cam: Vector3, fwd: Vector3 }
    update: function (o) { if (!ctx) return;
      if (o.room !== room) { room = o.room; ramp(roomG, room ? 1 : 0, room ? 1.2 : .5); if (!room) ramp(cabG, 0, .3); }
      if (!room) return;
      var L = Math.max(0, Math.min(1, o.lamp)); lampG.gain.setTargetAtTime(.02 * L, ctx.currentTime, .02); cabG.gain.setTargetAtTime(.55 * Math.max(.12, Math.min(1, o.cab)), ctx.currentTime, .15);
      var n = performance.now(); if (on && lastL - L > .3 && n - lastLampTick > 110) { lastLampTick = n; nz({ dur: .01, g: .1, type: 'bandpass', f: 4200, q: 3, dest: roomG }); tone({ f: 100, dur: .05, g: .05, type: 'sawtooth', dest: roomG }); } lastL = L;
      var l = ctx.listener, c = o.cam, f = o.fwd; if (c && f) { if (l.positionX) { var t = ctx.currentTime; l.positionX.setTargetAtTime(c.x, t, .05); l.positionY.setTargetAtTime(c.y, t, .05); l.positionZ.setTargetAtTime(c.z, t, .05); l.forwardX.setTargetAtTime(f.x, t, .05); l.forwardY.setTargetAtTime(f.y, t, .05); l.forwardZ.setTargetAtTime(f.z, t, .05); } else { l.setPosition(c.x, c.y, c.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); } } },
    object: function (key) { play('open'); var n = OBJ[key]; if (n) setTimeout(function () { play(n); }, 140); },
    duck: function (v) { ducked = v; ramp(mus, v ? .3 : 1, .35); ramp(amb, v ? .55 : 1, .35); },
    city: function (v) { if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); inCity = v; ramp(rainG, inCity && raining ? .5 : 0, 1.2); if (!v) { setDistrict(null); TRACKS.forEach(function (n) { ramp(TR[n] && TR[n].g, 0, .4); if (TR[n]) TR[n].v = 0; }); } },
    rain: function (v) { raining = v; ramp(rainG, inCity && raining ? .5 : 0, 1.2); },
    // mix: { trackName: weight }, crossfaded from the district weights
    mix: function (w, life) { if (!ctx || !inCity) return; var top = null; TRACKS.forEach(function (n) { var t = TR[n]; if (!t) return; var v = (w[n] || 0) * .3; if (n !== 'home' && (w[n] || 0) > .6) top = n; if (Math.abs(v - t.v) > .01) { t.v = v; ramp(t.g, v, .8); } if (v > .005 && t.el.paused) t.el.play().catch(function () {}); if (v <= .005 && !t.el.paused && t.g.gain.value < .01) t.el.pause(); }); setDistrict(life === undefined ? top : life); },
    coin: function (quiet) { if (!ctx || !on) return; var n = performance.now(); if (quiet && n - lastCoin < 110) return; lastCoin = n; var g = sfx.gain.value; if (quiet) { metal({ f: 2300 + R() * 500, dur: .3, g: .04, p: [1, 1.5, 2.4] }); } else FX.coin(); },
    tick: function () { play('click'); },
    buzz: function () { play('neon'); },
    honk: function () { if (!ctx || !on || !inCity) return; var d = sfx; try { var p = ctx.createStereoPanner(), s = R() < .5 ? -1 : 1; p.pan.setValueAtTime(-s * .9, ctx.currentTime); p.pan.linearRampToValueAtTime(s * .9, ctx.currentTime + 1.8); p.connect(sfx); d = p; } catch (e) {} nz({ dur: 1.9, g: .08, type: 'bandpass', f: 500, f2: 1500, q: .7, a: .9, dest: d }); nz({ dur: 1.9, g: .06, type: 'lowpass', f: 220, a: .9, dest: d }); },
    whoosh: function () { play('warp'); },
    thunder: function () { if (!ctx || !on || !inCity || !raining) return; var t0 = R() * .3; nz({ t: t0, dur: 4.5, g: .32, type: 'lowpass', f: 160 + R() * 80, a: .12, dest: amb }); nz({ t: t0 + .5 + R() * .6, dur: 3.2, g: .18, type: 'lowpass', f: 110, a: .5, dest: amb }); }
  };
})();
