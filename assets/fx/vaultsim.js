/* Defend the Vault: deterministic rules engine.
   Integer math only, fixed 30 ticks per second, seeded random numbers. The game uses it to play,
   and the ROBIN Vault contract runs the same rules in Rust to replay a submitted defense.
   Keep this file and vault-contract/sim/src/lib.rs in step: ci/simcheck.mjs compares them. */
(function (root) {
  'use strict';
  const CELL = 3000, TPS = 30, WAVES = 12, START_CASH = 150, START_LIVES = 20, COLS = 9, ROWS = 16;
  // rooftop cells a hero can stand on, one bit per column, row 0 is next to the vault
  const ROOF = [15, 6, 15, 447, 385, 509, 245, 509, 257, 383, 367, 383, 257, 509, 477, 252];
  // the street the thieves walk, in CELL units (x across, z towards the camera)
  const PATH = [[-9000, 27300], [-9000, 13500], [9000, 13500], [9000, 1500], [-9000, 1500], [-9000, -10500], [6000, -10500], [6000, -17700]];
  const SEG = []; let PATH_LEN = 0;
  for (let i = 1; i < PATH.length; i++) { const l = Math.abs(PATH[i][0] - PATH[i - 1][0]) + Math.abs(PATH[i][1] - PATH[i - 1][1]); SEG.push(l); PATH_LEN += l; }
  const cellX = c => (c - 4) * CELL, cellZ = r => r * CELL - 22500; // centre of a cell
  // thieves: hp, speed per tick, reward, vault damage, armor in permille
  const ENEMY = { thug: [40, 100, 6, 1, 0], runner: [26, 175, 6, 1, 0], shield: [120, 70, 12, 2, 300], acro: [55, 130, 9, 1, 0], boss: [950, 55, 90, 6, 0] };
  const KIND = ['thug', 'runner', 'shield', 'acro', 'boss'];
  // heroes: cost, range, damage, cooldown ticks, attack
  const HERO = [
    { id: 'atreus', cost: 50, range: 6900, dmg: 9, cd: 13, atk: 'nunchaku' },
    { id: 'frazzle', cost: 70, range: 6300, dmg: 4, cd: 38, atk: 'scream' },
    { id: 'hoot', cost: 85, range: 13800, dmg: 42, cd: 48, atk: 'feather' },
    { id: 'baller', cost: 95, range: 9000, dmg: 22, cd: 41, atk: 'ball' },
    { id: 'ilia', cost: 120, range: 5250, dmg: 30, cd: 45, atk: 'slam' },
    { id: 'leonidas', cost: 150, range: 8400, dmg: 70, cd: 33, atk: 'charge' }];
  const UPCOST = HERO.map(h => [0, Math.round(h.cost * 0.9), Math.round(h.cost * 1.5)]);
  const LVM = [1000, 1600, 2500], LVR = [1000, 1120, 1250];
  const DELAY = { nunchaku: 6, feather: 4, ball: 17, charge: 3 };

  function waveQueue(w) {
    const q = []; const n = 6 + w * 2;
    for (let i = 0; i < n; i++) {
      let k = 0; const r = (i * 37 + w * 11) % 10;
      if (w >= 2 && r < 3) k = 1; if (w >= 3 && r >= 8) k = 2; if (w >= 4 && r === 5) k = 3; if (w >= 7 && r === 6) k = 2;
      q.push([k, k === 1 ? 17 : 26]);
    }
    if (w === 5 || w === 10) q.push([4, 42]);
    if (w === 12) { q.push([4, 36]); q.push([4, 75]); }
    return q;
  }
  function posAt(d) {
    let i = 0; while (i < SEG.length - 1 && d > SEG[i]) { d -= SEG[i]; i++; }
    if (d > SEG[i]) d = SEG[i];
    const a = PATH[i], b = PATH[i + 1];
    const sx = Math.sign(b[0] - a[0]), sz = Math.sign(b[1] - a[1]);
    return [a[0] + sx * d, a[1] + sz * d, sx, sz];
  }
  const roofAt = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && ((ROOF[r] >> c) & 1) === 1;

  function create(seed, bonusHero, mods) {
    const M = mods || {}, HPM = M.hp || 1000, MAXH = M.heroes || 99;
    let rng = (seed >>> 0) || 0x9e3779b9;
    const S = { tick: 0, cash: M.cash || START_CASH, lives: START_LIVES, wave: 0, inWave: false, queue: [], qi: 0, spawnT: 0,
      towers: [], enemies: [], hits: [], kills: 0, over: false, win: false, nextId: 1, bonus: bonusHero == null ? -1 : bonusHero, ev: [] };
    function rand() { rng ^= rng << 13; rng >>>= 0; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0; return rng; }
    const towerAt = (c, r) => S.towers.find(t => t.c === c && t.r === r);
    const tRange = t => Math.trunc(HERO[t.h].range * LVR[t.lv] / 1000);
    const tDmg = t => Math.trunc(HERO[t.h].dmg * 1000 * LVM[t.lv] / 1000 * (t.h === S.bonus ? 1250 : 1000) / 1000);
    function hit(e, dmg) {
      if (e.dead) return; const real = Math.trunc(dmg * (1000 - e.armor) / 1000); e.hp -= real; S.ev.push(['hit', e.id, real]);
      if (e.hp <= 0) { e.dead = true; S.kills++; S.cash += e.cash; S.ev.push(['kill', e.id, e.cash]); }
    }
    function inRange(t, e, R) { const dx = e.x - t.x, dz = e.z - t.z; return dx * dx + dz * dz <= R * R; }
    function spawn(k) {
      const E = ENEMY[KIND[k]], w = S.wave; let hp = Math.trunc(E[0] * 1000 * (8 + 2 * w) / 10); if (w > 8) hp = Math.trunc(hp * 5 / 4); hp = Math.trunc(hp * HPM / 1000);
      const e = { id: S.nextId++, k, hp, max: hp, spd: E[1], cash: E[2], steal: E[3], armor: E[4], d: 0, x: 0, z: 0, slow: 0, slowK: 1000, stun: 0, dead: false };
      const p = posAt(0); e.x = p[0]; e.z = p[1]; S.enemies.push(e); S.ev.push(['spawn', e.id, k]);
    }
    // player actions: ['place',hero,c,r] ['up',c,r] ['sell',c,r] ['go']
    function act(a) {
      if (S.over) return false;
      if (a[0] === 'place') { const h = a[1], c = a[2], r = a[3]; if (!(h >= 0 && h < HERO.length) || !roofAt(c, r) || towerAt(c, r) || S.cash < HERO[h].cost || S.towers.length >= MAXH) return false;
        S.cash -= HERO[h].cost; S.towers.push({ h, c, r, x: cellX(c), z: cellZ(r), lv: 0, cd: 9, spent: HERO[h].cost, aim: 0 }); return true; }
      if (a[0] === 'up') { const t = towerAt(a[1], a[2]); if (!t || t.lv >= 2) return false; const cost = UPCOST[t.h][t.lv + 1]; if (S.cash < cost) return false; S.cash -= cost; t.spent += cost; t.lv++; return true; }
      if (a[0] === 'sell') { const t = towerAt(a[1], a[2]); if (!t) return false; S.cash += Math.trunc(t.spent * 6 / 10); S.towers.splice(S.towers.indexOf(t), 1); return true; }
      if (a[0] === 'go') { if (S.inWave || S.wave >= WAVES) return false; S.wave++; S.queue = waveQueue(S.wave); S.qi = 0; S.spawnT = 12; S.inWave = true; return true; }
      return false;
    }
    function step() {
      if (S.over || !S.inWave) return; S.ev = [];
      S.spawnT--; if (S.spawnT <= 0 && S.qi < S.queue.length) { const q = S.queue[S.qi++]; spawn(q[0]); S.spawnT = q[1]; }
      if (S.qi >= S.queue.length && !S.enemies.some(e => !e.dead)) {
        S.inWave = false; S.hits = []; const bonus = 20 + S.wave * 5; S.cash += bonus; S.ev.push(['clear', S.wave, bonus]);
        if (S.wave >= WAVES) { S.over = true; S.win = true; S.ev.push(['end', 1]); }
        S.tick++; return;
      }
      for (const e of S.enemies) {
        if (e.dead) continue; let sp = e.spd;
        if (e.slow > 0) { e.slow--; sp = Math.trunc(sp * e.slowK / 1000); }
        if (e.stun > 0) { e.stun--; sp = 0; }
        e.d += sp; const p = posAt(e.d); e.x = p[0]; e.z = p[1];
        if (e.d >= PATH_LEN) { e.dead = true; S.lives -= e.steal; S.ev.push(['leak', e.id, e.steal]);
          if (S.lives <= 0) { S.lives = 0; S.over = true; S.win = false; S.ev.push(['end', 0]); S.tick++; return; } }
      }
      for (const t of S.towers) {
        if (t.cd > 0) t.cd--; const R = tRange(t), H = HERO[t.h]; let tg = null; const list = [];
        for (const e of S.enemies) if (!e.dead && inRange(t, e, R)) list.push(e);
        for (const e of list) { if (!tg) tg = e; else if (H.atk === 'feather' ? e.hp > tg.hp : e.d > tg.d) tg = e; }
        if (tg) t.aim = tg.id;
        if (!tg || t.cd > 0) continue;
        t.cd = (t.lv === 2 && t.h === 0) ? 10 : H.cd; const D = tDmg(t);
        S.ev.push(['fire', S.towers.indexOf(t), tg.id, H.atk]);
        if (H.atk === 'scream') { const k = t.lv === 2 ? 350 : t.lv === 1 ? 480 : 580; for (const e of list) { if (e.slow < 48) e.slow = 48; e.slowK = k; hit(e, D); } }
        else if (H.atk === 'slam') { const st = t.lv === 0 ? 11 : t.lv === 1 ? 18 : 27; for (const e of list) { hit(e, D); if (e.stun < st) e.stun = st; } }
        else S.hits.push({ left: DELAY[H.atk], atk: H.atk, tg, D, lv: t.lv, x: tg.x, z: tg.z });
      }
      const keep = [];
      for (const h of S.hits) {
        if (--h.left > 0) { keep.push(h); continue; }
        if (h.atk === 'ball') { const px = h.tg.dead ? h.x : h.tg.x, pz = h.tg.dead ? h.z : h.tg.z, rad = h.lv === 2 ? 4455 : 3300;
          S.ev.push(['splash', px, pz, rad]); for (const e of S.enemies) if (!e.dead) { const dx = e.x - px, dz = e.z - pz; if (dx * dx + dz * dz < rad * rad) hit(e, h.D); } continue; }
        if (h.tg.dead) continue;
        if (h.atk === 'charge') { const crit = h.lv === 2 && rand() % 100 < 30; hit(h.tg, crit ? h.D * 2 : h.D); if (crit) S.ev.push(['crit', h.tg.id]); if (h.tg.stun < 9) h.tg.stun = 9; }
        else if (h.atk === 'feather') { hit(h.tg, h.D); if (h.lv === 2) { const nx = S.enemies.find(e => !e.dead && e !== h.tg && (e.x - h.tg.x) ** 2 + (e.z - h.tg.z) ** 2 < 4200 * 4200); if (nx) hit(nx, Math.trunc(h.D * 6 / 10)); } }
        else hit(h.tg, h.D);
      }
      S.hits = keep; S.enemies = S.enemies.filter(e => !e.dead); S.tick++;
    }
    return { S, act, step, rand };
  }
  // replay a list of [tick, action] pairs. While no wave runs the clock stands still, so every
  // action between waves carries the tick at which the previous wave ended.
  function replay(seed, bonusHero, actions, mods, maxTicks) {
    const g = create(seed, bonusHero, mods), S = g.S; let i = 0; const cap = maxTicks || 120000;
    while (!S.over && S.tick < cap) {
      while (i < actions.length && actions[i][0] === S.tick) { g.act(actions[i][1]); i++; }
      if (S.inWave) g.step();
      else { if (i >= actions.length) break; if (actions[i][0] !== S.tick) return { ok: false, why: 'bad tick', tick: S.tick }; }
    }
    return { ok: true, win: S.win, waves: S.win ? WAVES : Math.max(0, S.wave - 1), lives: S.lives, kills: S.kills, cash: S.cash, ticks: S.tick };
  }
  // the daily challenge: every day has its own seed, a twist and a target to beat
  const TWISTS = [
    { name: 'Armored night', text: 'Thieves have double health. Use at most 8 heroes. Keep 16 vault or more.', hp: 2000, heroes: 8, cash: 150, lives: 16 },
    { name: 'Skeleton crew', text: 'Thieves have 80% more health and only 6 heroes may join. Keep 18 vault or more.', hp: 1800, heroes: 6, cash: 150, lives: 18 },
    { name: 'Master heist', text: 'Thieves have 120% more health. Keep 12 vault or more.', hp: 2200, heroes: 10, cash: 150, lives: 12 }];
  function daily(day) { const t = TWISTS[day % TWISTS.length]; return { day, seed: Number((BigInt(day) * 2654435761n) & 0xffffffffn), mods: { hp: t.hp, heroes: t.heroes, cash: t.cash }, target: t.lives, name: t.name, text: t.text }; }
  const API = { create, daily, TWISTS, replay, waveQueue, posAt, roofAt, cellX, cellZ, CELL, TPS, WAVES, HERO, UPCOST, ENEMY, KIND, PATH, PATH_LEN, ROOF, COLS, ROWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.VaultSim = API;
})(typeof self !== 'undefined' ? self : this);
