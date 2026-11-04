/* ROBIN Arcade homepage: Ravenport rooftop at night, live in 3D.
   The squad stands around the $ROBIN coin; picking a hero flies the camera to them.
   Needs three.js r128 (global THREE as T), assets/fx/models.js and assets/fx/glow.js. */
(function () {
  var cv = document.getElementById('city3d');
  if (!cv || !window.THREE) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var R;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); } catch (e) { document.body.classList.add('no3d'); return; }
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  R.setClearColor(0x0a0712);
  var scene = new T.Scene();
  scene.fog = new T.FogExp2(0x1a1236, 0.032);
  var cam = new T.PerspectiveCamera(38, 1, 0.1, 200);
  var glow = makeGlow(R, { threshold: 0.9, strength: 1.0 });
  var aq = makeAutoQuality(R, glow, function () { resize(); });

  /* ---------- helpers ---------- */
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.anisotropy = 4; return t; }
  var lam = function (c, o) { return new T.MeshLambertMaterial(Object.assign({ color: c }, o || {})); };
  function box(w, h, d, m, x, y, z, p) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (p || scene).add(b); return b; }
  function cyl(r1, r2, h, m, x, y, z, p, s) { var b = new T.Mesh(new T.CylinderGeometry(r1, r2, h, s || 18), m); b.position.set(x, y, z); (p || scene).add(b); return b; }
  function halo(col, size, x, y, z, op, p) { var s = new T.Sprite(new T.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, opacity: op == null ? 0.8 : op, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); (p || scene).add(s); return s; }
  var blinkers = [];
  var rand = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(42);

  /* ---------- sky ---------- */
  var sky = new T.Mesh(new T.SphereGeometry(120, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x05030c) }, mid: { value: new T.Color(0x1d1240) }, low: { value: new T.Color(0x3a1d52) } },
    vertexShader: 'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,low;varying vec3 p;void main(){float h=p.y;vec3 c=mix(low,mid,smoothstep(-.05,.18,h));c=mix(c,top,smoothstep(.18,.6,h));gl_FragColor=vec4(c,1.);}' }));
  scene.add(sky);
  var starG = new T.BufferGeometry(), sp = [];
  for (var i = 0; i < 700; i++) { var a = rand() * Math.PI * 2, e = 0.15 + rand() * 1.3, r = 110; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  starG.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  scene.add(new T.Points(starG, new T.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 })));
  var moonT = canvasTex(256, 256, function (g, w) { var gr = g.createRadialGradient(118, 118, 20, 128, 128, 120); gr.addColorStop(0, '#f6efd6'); gr.addColorStop(1, '#cfc4a2'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,135,100,.35)'; [[90, 100, 18], [160, 80, 12], [150, 160, 22], [100, 170, 10]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill(); }); });
  var moon = new T.Sprite(new T.SpriteMaterial({ map: moonT, fog: false, color: 0xffffff })); moon.scale.set(9, 9, 1); moon.position.set(30, 34, -80); scene.add(moon);
  halo(0xffe9b0, 34, 30, 34, -81, 0.25);

  /* ---------- the city ---------- */
  var winT = [0.18, 0.3, 0.45].map(function (lit) { return canvasTex(64, 128, function (g, w, h) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (var y = 6; y < h; y += 12) for (var x = 5; x < w; x += 10) if (Math.random() < lit) { g.fillStyle = Math.random() < 0.8 ? '#ffb24a' : '#9fd8ff'; g.fillRect(x, y, 5, 7); } }); });
  var wallBase = [0x1c1538, 0x211a42, 0x17112e];
  for (var k = 0; k < 140; k++) {
    var x = (rand() - 0.5) * 120, z = -12 - rand() * 70;
    if (Math.abs(x) < 9 && z > -18) z -= 12;
    var w = 3 + rand() * 6, d = 3 + rand() * 6, h = 6 + rand() * 26 + (Math.abs(x) < 20 ? 0 : 8);
    var t = winT[k % 3].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(Math.max(1, w / 3), Math.max(1, h / 6));
    var m = new T.MeshLambertMaterial({ color: wallBase[k % 3], emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 });
    var b = box(w, h, d, m, x, h / 2 - 6, z);
    if (rand() < 0.18) { cyl(0.08, 0.08, 3, lam(0x2a2440), x, h - 4.5, z, null, 6); var bl = halo(0xff3355, 1.6, x, h - 3, z, 0.9); bl.userData.blink = rand() * 6; blinkers.push(bl); }
  }
  /* neon billboards with the games on the nearest buildings */
  var NEON = [['RAVENPORT RUSH', '#7fe3ff', -9.5, 9.5, -24, 0.25], ['BRAWL', '#ff5a78', 9.5, 11.5, -27, -0.25], ['NIGHT SHIFT', '#b37bff', -2, 14, -34, 0], ['ROBIN VENTURES', '#3ddc6a', 11.5, 6.2, -17, -0.45], ['PATROL', '#ffc93c', -12.5, 5.4, -16, 0.45]];
  var neons = [];
  NEON.forEach(function (n, i) {
    var tx = canvasTex(512, 128, function (g, w, h) { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h); g.font = '700 74px Fredoka, Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = n[1]; g.shadowBlur = 18; g.lineWidth = 6; g.strokeStyle = n[1]; g.strokeText(n[0], w / 2, h / 2 + 4); g.fillStyle = '#ffffff'; g.fillText(n[0], w / 2, h / 2 + 4); });
    var width = 7.5, sign = new T.Mesh(new T.PlaneGeometry(width, width / 4), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, color: 0xffffff }));
    sign.position.set(n[2], n[3], n[4]); sign.rotation.y = n[5]; scene.add(sign);
    var back = box(width + 0.6, width / 4 + 0.5, 0.25, lam(0x120c24), n[2], n[3], n[4] - 0.2); back.rotation.y = n[5];
    var hl = halo(new T.Color(n[1]), 9, n[2], n[3], n[4] + 0.3, 0.32);
    neons.push({ m: sign.material, h: hl, f: i % 2 ? 0 : rand() * 9 });
  });
  /* searchlights sweeping the sky */
  var beams = [];
  [[-22, -30], [24, -34]].forEach(function (p, i) {
    var g = new T.ConeGeometry(2.6, 60, 24, 1, true); g.translate(0, 30, 0);
    var mat = new T.MeshBasicMaterial({ color: i ? 0xb37bff : 0x7fe3ff, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    var c = new T.Mesh(g, mat); c.position.set(p[0], 0, p[1]); scene.add(c); beams.push(c);
  });

  /* ---------- the rooftop ---------- */
  var roofT = canvasTex(256, 256, function (g, w, h) { g.fillStyle = '#3b3266'; g.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { g.fillStyle = (x + y) / 32 % 2 ? '#352d5c' : '#3f356c'; g.fillRect(x + 1, y + 1, 30, 30); } });
  roofT.wrapS = roofT.wrapT = T.RepeatWrapping; roofT.repeat.set(5, 3);
  box(18, 1, 10, lam(0xffffff, { map: roofT }), 0, -0.5, -1.5);
  box(18, 8, 10, lam(0x1c1538), 0, -5, -1.5);
  var parM = lam(0x2b2350);
  box(18.4, 0.5, 0.4, parM, 0, 0.25, 3.5); box(18.4, 0.5, 0.4, parM, 0, 0.25, -6.5); box(0.4, 0.5, 10, parM, -9.2, 0.25, -1.5); box(0.4, 0.5, 10, parM, 9.2, 0.25, -1.5);
  var dark = lam(0x221c3a), steel = lam(0x6c6f88);
  // water tank
  var tank = new T.Group(); tank.position.set(-6.6, 0, -4.6); scene.add(tank);
  cyl(1.05, 1.05, 1.7, lam(0x7a5236), 0, 2.4, 0, tank); cyl(1.15, 0.1, 0.7, lam(0x5c3c26), 0, 3.6, 0, tank);
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(function (q) { box(0.1, 1.6, 0.1, dark, q[0], 0.8, q[1], tank); });
  // AC units and a vent
  [[6.4, -4.4], [7.6, -2.6]].forEach(function (q) { box(1.3, 0.8, 1, lam(0xb4b8c8), q[0], 0.4, q[1]); cyl(0.36, 0.36, 0.05, dark, q[0], 0.82, q[1]); });
  cyl(0.25, 0.25, 0.9, steel, -7.8, 0.45, 1.2);
  // antenna with a red light
  cyl(0.06, 0.08, 6, steel, 7.8, 3, -5.6, null, 6); var ant = halo(0xff3355, 1.6, 7.8, 6.05, -5.6, 1); ant.userData.blink = 0; blinkers.push(ant);
  // string lights across the roof
  var bulbs = [];
  [[-8.6, 3.2, -8.6, -6], [8.6, 3.2, 8.6, -6]].forEach(function (s) { cyl(0.05, 0.05, 3.2, dark, s[0], 1.6, s[1]); cyl(0.05, 0.05, 3.2, dark, s[2], 1.6, s[3]); });
  function stringLights(a, b, n) {
    var pts = [];
    for (var j = 0; j <= n; j++) { var t = j / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.6; pts.push(p); }
    var line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x1a1430 })); scene.add(line);
    pts.forEach(function (p, j) { if (j % 2) return; var c = [0xffd27a, 0xff6fa8, 0x7fe3ff, 0x3ddc6a][j / 2 % 4]; var bl = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: c })); bl.position.copy(p); scene.add(bl); bulbs.push(bl); });
  }
  stringLights(new T.Vector3(-8.6, 3.2, 3.2), new T.Vector3(8.6, 3.2, 3.2), 28);
  stringLights(new T.Vector3(-8.6, 3.2, -6), new T.Vector3(8.6, 3.2, -6), 28);
  stringLights(new T.Vector3(-8.6, 3.2, 3.2), new T.Vector3(-8.6, 3.2, -6), 14);

  /* ---------- the $ROBIN coin ---------- */
  var coinG = new T.Group(); coinG.position.set(0, 3.5, -2.6); scene.add(coinG);
  var face = new T.TextureLoader().load('assets/robin.jpg');
  // gold body, plus the picture on two upright discs so the dog always stands straight on both sides
  var coin = new T.Mesh(new T.CylinderGeometry(1.55, 1.55, 0.26, 64), new T.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.9, roughness: 0.3, emissive: 0x6a4600 }));
  coin.rotation.x = Math.PI / 2; coinG.add(coin);
  [1, -1].forEach(function (side) { var f = new T.Mesh(new T.CircleGeometry(1.42, 64), new T.MeshBasicMaterial({ map: face })); f.position.z = side * 0.135; if (side < 0) f.rotation.y = Math.PI; coinG.add(f); });
  var rim = new T.Mesh(new T.TorusGeometry(1.56, 0.1, 12, 64), new T.MeshStandardMaterial({ color: 0xffd966, metalness: 0.9, roughness: 0.25, emissive: 0x8a5a00 })); coinG.add(rim);
  halo(0xffc93c, 7, 0, 0, -0.4, 0.55, coinG);
  var beam = new T.Mesh(new T.CylinderGeometry(1.3, 2.4, 9, 32, 1, true), new T.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  beam.position.set(0, 4.5, -2.6); scene.add(beam);
  var ring = new T.Mesh(new T.RingGeometry(1.8, 2.3, 64), new T.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, -2.6); scene.add(ring);
  var gold = new T.PointLight(0xffc06a, 1.4, 12); gold.position.set(0, 3.2, -1.4); scene.add(gold);

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(0xa9a2ff, 0x1a1030, 0.7));
  var key = new T.DirectionalLight(0xdcd4ff, 0.55); key.position.set(-5, 10, 8); scene.add(key);
  var rimL = new T.DirectionalLight(0xff6fa8, 0.35); rimL.position.set(8, 4, -6); scene.add(rimL);

  /* ---------- the squad ---------- */
  var SQUAD = [['Spud', 'makeSpud'], ['Trey', 'makeTrey'], ['Atreus', 'makeBeagle'], ['Hoot', 'makeOwl'], ['Leonidas', 'makeCorgi'], ['Baller', 'makeBaller'], ['Frazzle', 'makeFrazzle'], ['Ilia', 'makeIlia'], ['Sir Plop', 'makePlop']];
  var squad = [];
  SQUAD.forEach(function (s, i) {
    var mk = window[s[1]]; if (!mk) return;
    var m = mk(), root = new T.Group(), yaw = new T.Group(); root.add(yaw); yaw.add(m.g);
    if (!m.faceCam) m.g.rotation.y = -Math.PI / 2;
    var size = new T.Box3().setFromObject(m.g).getSize(new T.Vector3()); m.g.scale.setScalar((s[0] === 'Sir Plop' ? 1.0 : 1.35) / size.y);
    var n = SQUAD.length, a = (i / (n - 1) - 0.5) * 2.3, rr = 4.4;
    root.position.set(Math.sin(a) * rr, 0, -2.6 + Math.cos(a) * rr * 0.62);
    yaw.rotation.y = -a * 0.35; scene.add(root);
    var spot = new T.Mesh(new T.CircleGeometry(0.55, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); spot.rotation.x = -Math.PI / 2; spot.position.y = 0.015; root.add(spot);
    var sel = new T.Mesh(new T.RingGeometry(0.55, 0.68, 40), new T.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0, depthWrite: false })); sel.rotation.x = -Math.PI / 2; sel.position.y = 0.03; root.add(sel);
    squad.push({ name: s[0], m: m, root: root, yaw: yaw, base: yaw.rotation.y, sel: sel, phase: i * 0.7, hop: 0 });
  });

  /* ---------- rain ---------- */
  var RN = reduce ? 0 : 1400, rg = new T.BufferGeometry(), rp = new Float32Array(RN * 6), rv = new Float32Array(RN);
  for (var q = 0; q < RN; q++) { var x0 = (rand() - 0.5) * 40, y0 = rand() * 22 - 2, z0 = (rand() - 0.5) * 30 - 2; rp.set([x0, y0, z0, x0 - 0.06, y0 - 0.5, z0], q * 6); rv[q] = 14 + rand() * 8; }
  rg.setAttribute('position', new T.BufferAttribute(rp, 3));
  var rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0x9aa6e8, transparent: true, opacity: 0.32 })); scene.add(rain);

  /* ---------- camera ---------- */
  var mouse = { x: 0, y: 0 }, focus = -1, camPos = new T.Vector3(), camLook = new T.Vector3(), wantPos = new T.Vector3(), wantLook = new T.Vector3();
  function basePose(t) {
    var portrait = W / H < 0.85;
    var dist = portrait ? 16 : 11.6, height = portrait ? 3.6 : 3.2;
    var sway = Math.sin(t * 0.12) * 0.6;
    wantPos.set(sway + mouse.x * 0.9, height + mouse.y * 0.4, dist);
    wantLook.set(mouse.x * 0.3, portrait ? 1.6 : 1.5, -2.2);
  }
  function focusPose() {
    var s = squad[focus], p = s.root.position;
    wantPos.set(p.x * 0.72, 1.55 + mouse.y * 0.15, p.z + 4.4); wantLook.set(p.x, 0.75, p.z);
  }
  var W = 1, H = 1;
  function resize() { var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); R.setSize(W, H, false); glow.setSize(W, H); cam.aspect = W / H; cam.fov = W / H < 0.85 ? 46 : 36;
    // leave room for the headline: the scene sits right of it on wide screens and below it on phones
    var wide = W / H > 1.15; cam.setViewOffset(W, H, wide ? -W * 0.17 : 0, wide ? 0 : -H * 0.1, W, H); cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(cv); resize();
  addEventListener('pointermove', function (e) { mouse.x = (e.clientX / innerWidth - 0.5) * 2; mouse.y = -(e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  /* picking a hero from the 3D scene */
  var ray = new T.Raycaster(), ndc = new T.Vector2(), downAt = null;
  cv.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', function (e) {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return; downAt = null;
    var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam);
    var hits = ray.intersectObjects(squad.map(function (s) { return s.root; }), true);
    if (!hits.length) { setFocus(-1); return; }
    var o = hits[0].object; while (o && !squad.some(function (s) { return s.root === o; })) o = o.parent;
    var idx = squad.findIndex(function (s) { return s.root === o; }); setFocus(idx === focus ? -1 : idx);
  });
  function setFocus(i) {
    focus = i; squad.forEach(function (s, k) { s.selTarget = k === i ? 0.9 : 0; });
    if (i >= 0) squad[i].hop = 1;
    document.dispatchEvent(new CustomEvent('city:focus', { detail: { index: i, name: i >= 0 ? squad[i].name : null } }));
    kick();
  }
  window.RobinCity = { focus: function (name) { var i = squad.findIndex(function (s) { return s.name === name; }); setFocus(i === focus ? -1 : i); }, names: SQUAD.map(function (s) { return s[0]; }),
    screenOf: function (i) { if (i < 0 || !squad[i]) return null; var v = squad[i].root.position.clone(); v.y += 1.55; v.project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; } };

  /* ---------- loop ---------- */
  var visible = true, running = false, last = performance.now(), clock = 0;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) kick(); }).observe(cv);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  var stillFrames = 0;
  function frame(now) {
    var real = Math.min(0.05, (now - last) / 1000); last = now; clock += reduce ? 0 : real;
    if (focus >= 0) focusPose(); else basePose(clock);
    var ease = Math.min(1, real * (focus >= 0 ? 3 : 2));
    if (!camPos.lengthSq()) { camPos.copy(wantPos); camLook.copy(wantLook); }
    camPos.lerp(wantPos, ease); camLook.lerp(wantLook, ease); cam.position.copy(camPos); cam.lookAt(camLook);
    coinG.rotation.y = clock * 0.9; coinG.position.y = 3.5 + Math.sin(clock * 1.6) * 0.18; ring.material.opacity = 0.25 + 0.12 * Math.sin(clock * 2.2);
    squad.forEach(function (s) {
      s.hop = Math.max(0, s.hop - real * 1.6);
      var hop = Math.sin(s.hop * Math.PI) * 0.6;
      s.m.g.position.y = Math.abs(Math.sin(clock * 2 + s.phase)) * 0.04 + hop;
      s.yaw.rotation.y = s.base + (s.hop > 0 ? (1 - s.hop) * Math.PI * 2 : 0) + Math.sin(clock * 0.7 + s.phase) * 0.12;
      if (s.m.cape && s.m.cape.update) s.m.cape.update(clock, 0.35, 0, real);
      s.sel.material.opacity += ((s.selTarget || 0) - s.sel.material.opacity) * Math.min(1, real * 8);
    });
    blinkers.forEach(function (b) { b.material.opacity = Math.sin(clock * 2.5 + (b.userData.blink || 0)) > 0.2 ? 1 : 0.08; });
    neons.forEach(function (n) { var on = n.f ? (Math.sin(clock * 17 + n.f) > -0.92 && Math.sin(clock * 1.3 + n.f) > -0.97 ? 1 : 0.25) : 1; n.m.opacity = on; n.h.material.opacity = 0.32 * on; });
    bulbs.forEach(function (b, i) { b.material.color.offsetHSL(0, 0, 0); b.visible = reduce || Math.sin(clock * 3 + i * 0.9) > -0.6; });
    beams.forEach(function (b, i) { b.rotation.z = Math.sin(clock * 0.25 + i * 2) * 0.55; b.rotation.x = Math.cos(clock * 0.2 + i) * 0.2 - 0.1; });
    if (RN) { var p = rain.geometry.attributes.position.array; for (var j = 0; j < RN; j++) { var o = j * 6, dy = rv[j] * real; p[o + 1] -= dy; p[o + 4] -= dy; p[o] -= dy * 0.12; p[o + 3] -= dy * 0.12; if (p[o + 4] < -1) { var nx = (Math.random() - 0.5) * 40, nz = (Math.random() - 0.5) * 30 - 2; p[o] = nx; p[o + 1] = 20; p[o + 2] = nz; p[o + 3] = nx - 0.06; p[o + 4] = 19.5; p[o + 5] = nz; } } rain.geometry.attributes.position.needsUpdate = true; }
    glow.render(scene, cam); aq.tick(real, true);
    document.dispatchEvent(new CustomEvent('city:frame'));
    if (reduce) { stillFrames++; if (stillFrames > 40 && focus < 0) { running = false; stillFrames = 0; return; } }
    if (visible && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  kick();
  document.body.classList.add('has3d');
})();
