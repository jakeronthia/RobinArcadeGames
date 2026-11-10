/* ROBIN Arcade pass: one progression over every game.
   Level and XP from playing anything, three missions a day that send you to different games,
   and arcade coins (picked up flying through the city, or won with missions) to spend on flight trails.
   Everything lives in this browser (localStorage). Arcade coins are not $ROBIN and have no value outside the arcade. */
window.PASS = (function () {
  var KEY = 'rv-pass', S = null, subs = [];
  var TITLES = { patrol: 'Ravenport Patrol', rush: 'Ravenport Rush', brawl: 'Ravenport Brawl', nightshift: 'Night Shift', tycoon: 'ROBIN Ventures', vault: 'Defend the Vault', skyhoot: 'Sky Hoot', safecracker: 'Safe Cracker', loottower: 'Loot Tower', wanted: 'Wanted!', lootmatch: 'Loot Match' };
  var OLD = ['patrol', 'rush', 'brawl', 'nightshift', 'tycoon', 'vault'];
  var GOALS = [['skyhoot', 8, 'Pass 8 gaps in Sky Hoot'], ['safecracker', 15, 'Score 15 in Safe Cracker'], ['loottower', 12, 'Score 12 in Loot Tower'], ['wanted', 20, 'Score 20 in Wanted!'], ['lootmatch', 1500, 'Score 1,500 in Loot Match']];
  var TRAILS = [{ id: 'gold', name: 'Gold', cost: 0, css: '#ffc93c', rgb: [1.8, 1.4, .5] }, { id: 'cyan', name: 'Ice', cost: 40, css: '#7fe3ff', rgb: [.5, 1.5, 1.9] }, { id: 'pink', name: 'Neon pink', cost: 80, css: '#ff3d8a', rgb: [1.9, .5, 1.2] }, { id: 'green', name: 'Emerald', cost: 120, css: '#3ddc6a', rgb: [.5, 1.8, .7] }, { id: 'rainbow', name: 'Rainbow', cost: 200, css: 'linear-gradient(90deg,#ff3d8a,#ffc93c,#3ddc6a,#7fe3ff,#b37bff)', rgb: null }];
  var HEROES = [['leonidas', 'Leonidas'], ['atreus', 'Atreus'], ['hoot', 'Hoot'], ['trey', 'Trey'], ['baller', 'Baller'], ['frazzle', 'Frazzle'], ['ilia', 'Ilia'], ['spud', 'Spud'], ['sirplop', 'Sir Plop']];
  var HL = [0, 60, 200]; // hero XP needed for level 1, 2, 3
  function heroLv(xp) { return xp >= HL[2] ? 3 : xp >= HL[1] ? 2 : 1; }
  function arcadeHero() { try { var i = localStorage.getItem('rv-hero'); return HEROES[i === null ? 2 : +i] ? HEROES[i === null ? 2 : +i][0] : 'hoot'; } catch (e) { return 'hoot'; } }
  function heroXp(id, n, out) { if (!S.heroes) S.heroes = {}; var known = HEROES.filter(function (h) { return h[0] === id; })[0]; if (!known) return; var b = S.heroes[id] || 0, a = b + n; S.heroes[id] = a; if (heroLv(a) > heroLv(b)) { S.coins += 30; out.push({ kind: 'hero', hero: known[1], level: heroLv(a), coins: 30 }); } }
  function today() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function daily(day) { var r = rng(day * 2654435761), g = OLD[Math.floor(r() * OLD.length)], goal = GOALS[Math.floor(r() * GOALS.length)], third = r() < .5;
    return [{ id: 'play', type: 'play', game: g, n: 1, p: 0, text: 'Play ' + TITLES[g], coins: 15, xp: 30 },
      { id: 'score', type: 'score', game: goal[0], n: goal[1], p: 0, text: goal[2], coins: 25, xp: 50 },
      third ? { id: 'coins', type: 'coins', n: 25, p: 0, text: 'Collect 25 coins flying through the city', coins: 15, xp: 30 } : { id: 'tour', type: 'tour', n: 3, p: 0, seen: [], text: 'Play 3 different games', coins: 20, xp: 40 }]; }
  function load() { try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
    if (!S || typeof S !== 'object') S = { xp: 0, coins: 0, day: 0, missions: [], cityToday: 0, owned: ['gold'], trail: 'gold', plays: 0 };
    if (!Array.isArray(S.owned)) S.owned = ['gold']; if (!S.heroes || typeof S.heroes !== 'object') S.heroes = {}; if (S.day !== today()) { S.day = today(); S.missions = daily(S.day); S.cityToday = 0; save(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function levelOf(xp) { var l = 1, need = 100, left = xp; while (left >= need) { left -= need; l++; need = 100 + (l - 1) * 50; } return { level: l, into: left, need: need }; }
  function grant(xp, coins, out, why) { var before = levelOf(S.xp).level; S.xp += xp || 0; S.coins += coins || 0; var after = levelOf(S.xp).level; if (why) out.push({ kind: 'mission', text: why, xp: xp, coins: coins }); if (after > before) { S.coins += 20; out.push({ kind: 'level', level: after, coins: 20 }); } }
  function step(m, v, out, absolute) { if (m.done) return; m.p = Math.min(m.n, absolute ? Math.max(m.p, v) : m.p + v); if (m.p >= m.n) { m.done = true; grant(m.xp, m.coins, out, m.text); } }
  load();
  return {
    titles: TITLES, trails: TRAILS, arcadeHero: arcadeHero,
    // every hero has three levels of its own, earned by playing with that hero
    heroes: function () { load(); return HEROES.map(function (h) { var xp = S.heroes[h[0]] || 0, lv = heroLv(xp); return { id: h[0], name: h[1], xp: xp, level: lv, from: HL[lv - 1], next: lv < 3 ? HL[lv] : null }; }); },
    heroLevel: function (id) { load(); return heroLv(S.heroes[id] || 0); },
    get: function () { load(); var l = levelOf(S.xp); return { xp: S.xp, coins: S.coins, level: l.level, into: l.into, need: l.need, missions: S.missions, trail: S.trail, owned: S.owned.slice(), plays: S.plays }; },
    onChange: function (f) { subs.push(f); },
    // what happened: 'play' {game}, 'score' {game, score, best}, 'coin'. Returns what it earned you, to show as a toast.
    event: function (type, d) { load(); d = d || {}; var out = [];
      var hero = d.hero || arcadeHero();
      if (type === 'play') { S.plays++; grant(15, 0, out); heroXp(hero, 15, out); S.missions.forEach(function (m) { if (m.type === 'play' && m.game === d.game) step(m, 1, out); if (m.type === 'tour' && !m.done && m.seen.indexOf(d.game) < 0) { m.seen.push(d.game); step(m, 1, out); } }); }
      else if (type === 'score') { if (d.best) { grant(25, 0, out); heroXp(hero, 25, out); } S.missions.forEach(function (m) { if (m.type === 'score' && m.game === d.game) step(m, d.score, out, true); }); }
      else if (type === 'coin') { if (S.cityToday < 60) { S.cityToday++; S.coins++; heroXp(hero, 1, out); } S.missions.forEach(function (m) { if (m.type === 'coins') step(m, 1, out); }); }
      save(); return out; },
    buy: function (id) { load(); var t = TRAILS.filter(function (x) { return x.id === id; })[0]; if (!t) return false; if (S.owned.indexOf(id) < 0) { if (S.coins < t.cost) return false; S.coins -= t.cost; S.owned.push(id); } S.trail = id; save(); return true; },
    trail: function () { load(); return TRAILS.filter(function (x) { return x.id === S.trail; })[0] || TRAILS[0]; }
  };
})();
