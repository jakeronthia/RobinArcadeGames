/* ROBIN Arcade music player: gapless looping tracks with fades, unlocked by the first tap or key. */
(function () {
  'use strict';
  const BASE = new URL('../sfx/', (document.currentScript && document.currentScript.src) || location.href).href;
  let ctx = null, master = null, src = null, srcGain = null, curUrl = null, on = true, vol = 0.5, wanted = null;
  const cache = {};
  // exact loop lengths (32 bars each); MP3 adds encoder delay that some browsers keep, so loop points are set by hand
  const LEN = { home: 32 * 240 / 104, patrol: 32 * 240 / 128, rush: 32 * 240 / 142, brawl: 32 * 240 / 132, nightshift: 32 * 240 / 84, tycoon: 32 * 240 / 112, vault: 32 * 240 / 118 };
  const LAME_DELAY = 1105 / 44100;
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination); return ctx;
  }
  function load(url) {
    if (!cache[url]) cache[url] = fetch(url).then(r => { if (!r.ok) throw new Error('music ' + r.status); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => ensure().decodeAudioData(b, res, rej)));
    return cache[url];
  }
  function fade(g, to, secs) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(to, t + secs); }
  function stopSrc(secs) { if (!src) return; const s = src, g = srcGain; src = null; srcGain = null; try { fade(g, 0, secs || .6); s.stop(ctx.currentTime + (secs || .6) + .05); } catch (e) {} }
  let busy = false;
  async function start() {
    if (busy) return; busy = true; try { await start1(); } finally { busy = false; } if (wanted && on && curUrl !== wanted && ctx && ctx.state === 'running') start();
  }
  async function start1() {
    if (!wanted || !on || !ensure()) return;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
    if (ctx.state !== 'running') return; // waits for a user gesture
    if (src && curUrl === wanted) return;
    const url = wanted; let buf; try { buf = await load(url); } catch (e) { return; }
    if (url !== wanted || !on) return;
    stopSrc(.8); const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.loop = true;
    const nm = (url.match(/([a-z]+)\.mp3/) || [])[1], L = LEN[nm];
    if (L && buf.duration > L) { const off = buf.duration - L > .012 ? LAME_DELAY : 0; s.loopStart = off; s.loopEnd = off + L; } g.gain.value = 0; s.connect(g).connect(master); s.start(0, s.loopStart || 0);
    src = s; srcGain = g; curUrl = url; fade(g, vol, 1.6);
  }
  function unlock() { if (!ensure()) return; ctx.resume().then(start, start); }
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on && wanted) ctx.resume().then(start, start); });
  // short jingles and effects shared by every game; big moments duck the music for a second
  const SFX = { click: [.5, 0], coin: [.6, 0], start: [.7, 1.2], win: [.75, 2], lose: [.7, 1.8], levelup: [.6, .6], buy: [.6, 0], boss: [.8, 1.4], power: [.6, .4] };
  window.RobinSfx = {
    play(name, vol) {
      const d = SFX[name]; if (!d || !ensure()) return; if (ctx.state === 'suspended') ctx.resume();
      load(BASE + name + '.mp3').then(buf => { if (ctx.state !== 'running') return; const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = (vol == null ? 1 : vol) * d[0]; s.connect(g).connect(ctx.destination); s.start(); if (d[1] && master) window.RobinMusic.duck(.35, d[1]); }).catch(() => {});
    },
    preload() { Object.keys(SFX).forEach(n => load(BASE + n + '.mp3').catch(() => {})); }
  };
  window.RobinMusic = {
    play(url, opts) { if (opts && opts.volume != null) vol = opts.volume; if (url !== wanted) { wanted = url; if (curUrl !== url) stopSrc(.8), curUrl = null; } start(); },
    setOn(b) { on = !!b; if (!on) stopSrc(.5); else start(); },
    setVolume(v) { vol = v; if (srcGain) fade(srcGain, vol, .3); },
    duck(level, secs) { if (!master || !ctx) return; fade(master, level, .15); setTimeout(() => fade(master, 1, .6), (secs || 1) * 1000); },
    stop() { wanted = null; stopSrc(.6); },
    get on() { return on; },
    state() { return { url: curUrl, playing: !!src, ctx: ctx ? ctx.state : 'none', loop: src ? [src.loopStart, src.loopEnd] : null }; }
  };
})();
