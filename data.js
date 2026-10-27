/* ============================================================
   ROBIN Arcade — site content
   To add a new game: put its HTML file in /games and add one
   entry to GAMES below. The homepage card, hover preview and
   game page are built from this list automatically.
   ============================================================ */

window.SITE = {
  token: {
    contract: 'robin-3.nearlytrade.near',
    pair: 'refv2-robin-3.nearlytrade.near:wrap.near:10000',
    chain: 'near',
    buyUrl: 'https://dexscreener.com/near/refv2-robin-3.nearlytrade.near:wrap.near:10000',
    swapUrl: 'https://app.ref.finance/',
    about: '[One or two lines about $ROBIN: what it is and why the arcade exists.]'
  },
  social: {
    x: 'https://x.com/RobinOnNear',
    telegram: 'https://t.me/ROBINonNEAR'
  }
};

window.GAMES = [
  {
    id: 'patrol',
    accent: '#ffc93c',
    badge: 'HOT',
    title: 'Ravenport Patrol',
    file: 'games/patrol.html',
    orient: 'landscape',
    blurb: 'Jump across rooftops and take the loot back, one wave at a time.',
    about: 'Thieves have taken over the rooftops. Jump across metal beams, dodge their shots and take the loot back one wave at a time. Switch heroes mid-run and finish the boss to clear the night.',
    shot: 'assets/shots/patrol.jpg',
    clip: 'assets/clips/patrol.mp4',
    pos: 'center',
    controls: [
      ['Move', '← → or A D', 'left and right pads'],
      ['Jump', '↑ W or Space', 'Jump button'],
      ['Throw nunchaku', 'X or J', 'Attack button'],
      ['Switch hero', 'C or K', 'Switch button'],
      ['Super move', 'V or L', 'Super button']
    ],
    best: function () { var b = JSON.parse(localStorage.getItem('ravenport3d-best') || 'null'); return b && b.score ? b.score : 0; }
  },
  {
    id: 'rush',
    accent: '#7fe3ff',
    badge: null,
    title: 'Ravenport Rush',
    file: 'games/rush.html',
    orient: 'landscape',
    blurb: 'Three lanes, endless rooftops. Dodge, slide and use each hero power.',
    about: 'An endless run across the Ravenport rooftops. Switch lanes, jump and slide under obstacles, grab coins and fire your hero power at the right moment.',
    shot: 'assets/shots/rush.jpg',
    clip: 'assets/clips/rush.mp4',
    pos: 'center 70%',
    controls: [
      ['Change lane', '← → or A D', 'swipe left or right'],
      ['Jump', '↑ W or Space', 'swipe up'],
      ['Slide', '↓ S', 'swipe down'],
      ['Hero power', 'E or Shift', 'power button']
    ],
    best: function () { var a = JSON.parse(localStorage.getItem('rush-scores') || '[]'); return a.reduce(function (m, s) { return Math.max(m, s.score || 0); }, 0); }
  },
  {
    id: 'brawl',
    accent: '#ff5a78',
    badge: null,
    title: 'Ravenport Brawl',
    file: 'games/brawl.html',
    orient: 'landscape',
    blurb: 'Top-down brawls against bots. Last hero standing wins the trophy.',
    about: 'Pick a hero and drop into a top-down arena against bots. Grab the loot, dodge the gas and use your super. Every win adds trophies to your hero.',
    shot: 'assets/shots/brawl.jpg',
    clip: 'assets/clips/brawl.mp4',
    pos: 'center',
    controls: [
      ['Move', 'W A S D or arrows', 'left stick'],
      ['Attack', 'Left click where you aim', 'attack stick'],
      ['Super', 'Right click, Space or E', 'super stick'],
      ['Pause', 'P or Esc', 'pause button']
    ],
    bestLabel: 'Trophies',
    best: function () { var p = JSON.parse(localStorage.getItem('brawl-prog') || 'null'); return p && p.troph ? p.troph.reduce(function (a, b) { return a + b; }, 0) : 0; }
  },
  {
    id: 'nightshift',
    accent: '#b37bff',
    badge: null,
    title: 'Night Shift',
    file: 'games/nightshift.html',
    orient: 'portrait',
    blurb: 'Hire the squad, catch thieves, collect the loot when you come back.',
    about: 'An idle game for your phone. Tap to catch thieves, hire the squad, unlock new districts and beat the master thieves. Your heroes keep patrolling while you are away.',
    shot: 'assets/shots/idle.jpg',
    clip: 'assets/clips/idle.mp4',
    pos: 'center 30%',
    controls: [
      ['Catch thieves', 'Click', 'tap the rooftops'],
      ['Upgrade the squad', 'Squad tab', 'Squad tab'],
      ['New districts', 'Map tab', 'Map tab']
    ],
    bestLabel: 'Coins earned',
    best: function () { var s = JSON.parse(localStorage.getItem('nightshift-save') || 'null'); return s && s.life ? Math.floor(s.life) : 0; }
  }
];

window.GAMES.push({
    id: 'tycoon',
    accent: '#3ddc6a',
    badge: 'NEW',
    title: 'ROBIN Ventures',
    file: 'games/tycoon.html',
    orient: 'portrait',
    blurb: 'Grow a garage startup into a listed company, from CentRobin to PetaRobin.',
    about: 'An idle tycoon about building a startup. Start in a garage with a dusty laptop earning CentRobin, upgrade through 25 machines all the way to a Dyson swarm while your office grows from garage to orbit, hire the squad as managers and raise funding rounds until you ring the bell on the Ravenport Stock Exchange. Every IPO gives you Founder shares for your next startup.',
    shot: 'assets/shots/tycoon.jpg',
    clip: 'assets/clips/tycoon.mp4',
    pos: 'center 35%',
    controls: [
      ['Run a machine', 'Click', 'tap the office or a machine'],
      ['Grow', 'Buy machines and hire', 'Machines and Team tabs'],
      ['Go public', 'Funding tab', 'raise rounds, then ring the bell']
    ],
    bestLabel: 'IPOs',
    best: function () { var s = JSON.parse(localStorage.getItem('robin-ventures') || 'null'); return s && s.ipos ? s.ipos : 0; }
});

window.HEROES = [
  { name: 'Leonidas', power: 'Charge', desc: 'Bursts forward and smashes through everything.', img: 'assets/heroes/leonidas.png', col: '#3a2f5c' },
  { name: 'Atreus', power: 'Nunchaku', desc: 'Clears every obstacle in his lane.', img: 'assets/heroes/atreus.png', col: '#1f4a35' },
  { name: 'Hoot', power: 'Flight', desc: 'Soars over trains and barriers.', img: 'assets/heroes/hoot.png', col: '#3a2a66' },
  { name: 'Trey', power: 'Triple jump', desc: 'Jumps three times in the air.', img: 'assets/heroes/trey.png', col: '#4a3f1a' },
  { name: 'Baller', power: 'Magnet ball', desc: 'Pulls in every coin nearby.', img: 'assets/heroes/baller.png', col: '#5a2f12' },
  { name: 'Frazzle', power: 'Scream', desc: 'Shatters obstacles and slows time.', img: 'assets/heroes/frazzle.png', col: '#5a2440' },
  { name: 'Ilia', power: 'Slam', desc: 'Slams the ground and clears every lane.', img: 'assets/heroes/ilia.png', col: '#16485a' },
  { name: 'Spud', power: 'Tiny Spud', desc: 'Shrinks so small that everything sails over him.', img: 'assets/heroes/spud.png', col: '#4a2f1a' },
  { name: 'Sir Plop', power: 'Slip n Slide', desc: 'Slides on his own goo through every obstacle.', img: 'assets/heroes/sirplop.png', col: '#2a1f4a' }
];

/* ============================================================
   Daily challenge: one per day (UTC), picked in order.
   Add or edit freely: game = id from GAMES.
   ============================================================ */
window.CHALLENGES = [
  { game: 'rush', hero: 'Spud', text: 'Run 800 m with Spud' },
  { game: 'patrol', hero: 'Hoot', text: 'Clear wave 5 on Normal with Hoot' },
  { game: 'brawl', hero: 'Baller', text: 'Win a Loot Grab match as Baller' },
  { game: 'nightshift', hero: 'Leonidas', text: 'Open The Docks before the next master thief' },
  { game: 'rush', hero: 'Trey', text: 'Use your hero power 3 times in one run with Trey' },
  { game: 'brawl', hero: 'Frazzle', text: 'Win a Showdown as Frazzle' },
  { game: 'patrol', hero: 'Sir Plop', text: 'Beat a boss on Nightmare with Sir Plop' },
  { game: 'rush', hero: 'Ilia', text: 'Collect 300 coins in one run with Ilia' },
  { game: 'nightshift', hero: 'Atreus', text: 'Catch a master thief in under 20 seconds' },
  { game: 'tycoon', hero: 'Sir Plop', text: 'Close your Series A in ROBIN Ventures' }
];

/* ============================================================
   Hall of Fame: add a line each week, newest first. Example:
   { week: 'Week 1', name: 'nickname', game: 'Ravenport Rush', score: '12,400', hero: 'Spud' },
   ============================================================ */
window.HALL = [];

/* ============================================================
   Weekly leaderboard prizes: shown for the top 3 of every game.
   Write the real prizes here, e.g. '50,000 $ROBIN'.
   ============================================================ */
window.PRIZES = ['[1st prize]', '[2nd prize]', '[3rd prize]'];
