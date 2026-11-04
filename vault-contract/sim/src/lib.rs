//! Defend the Vault rules engine, the Rust twin of assets/fx/vaultsim.js.
//! Integer math only, 30 ticks per second, so the contract reaches exactly the same result as the game.
#![cfg_attr(not(test), no_std)]
extern crate alloc;
use alloc::vec::Vec;

pub const CELL: i64 = 3000;
pub const WAVES: i64 = 12;
const COLS: i64 = 9;
const ROWS: i64 = 16;
const ROOF: [u32; 16] = [15, 6, 15, 447, 385, 509, 245, 509, 257, 383, 367, 383, 257, 509, 477, 252];
const PATH: [(i64, i64); 8] = [(-9000, 27300), (-9000, 13500), (9000, 13500), (9000, 1500), (-9000, 1500), (-9000, -10500), (6000, -10500), (6000, -17700)];
// hp, speed, reward, vault damage, armor permille
const ENEMY: [[i64; 5]; 5] = [[40, 100, 6, 1, 0], [26, 175, 6, 1, 0], [120, 70, 12, 2, 300], [55, 130, 9, 1, 0], [950, 55, 90, 6, 0]];
#[derive(Clone, Copy, PartialEq)]
enum Atk { Nunchaku, Scream, Feather, Ball, Slam, Charge }
// cost, range, damage, cooldown
const HERO: [(i64, i64, i64, i64, Atk); 6] = [
    (50, 6900, 9, 13, Atk::Nunchaku), (70, 6300, 4, 38, Atk::Scream), (85, 13800, 42, 48, Atk::Feather),
    (95, 9000, 22, 41, Atk::Ball), (120, 5250, 30, 45, Atk::Slam), (150, 8400, 70, 33, Atk::Charge)];
const UPCOST: [[i64; 3]; 6] = [[0, 45, 75], [0, 63, 105], [0, 77, 128], [0, 86, 143], [0, 108, 180], [0, 135, 225]];
const LVM: [i64; 3] = [1000, 1600, 2500];
const LVR: [i64; 3] = [1000, 1120, 1250];

pub struct Mods { pub hp: i64, pub heroes: usize, pub cash: i64 }
pub struct Daily { pub seed: u32, pub mods: Mods, pub target: i64 }
pub fn daily(day: u64) -> Daily {
    let seed = (day.wrapping_mul(2654435761)) as u32;
    let (hp, heroes, cash, target) = match day % 3 { 0 => (2000, 8, 150, 16), 1 => (1800, 6, 150, 18), _ => (2200, 10, 150, 12) };
    Daily { seed, mods: Mods { hp, heroes, cash }, target }
}

#[derive(Clone)]
pub enum Action { Place(i64, i64, i64), Up(i64, i64), Sell(i64, i64), Go }

struct Enemy { hp: i64, spd: i64, cash: i64, steal: i64, armor: i64, d: i64, x: i64, z: i64, slow: i64, slow_k: i64, stun: i64, dead: bool }
struct Tower { h: usize, c: i64, r: i64, x: i64, z: i64, lv: usize, cd: i64, spent: i64 }
#[derive(Clone, Copy)]
struct Hit { left: i64, atk: Atk, tg: usize, d: i64, lv: usize, x: i64, z: i64 }

fn seg_len() -> ([i64; 7], i64) { let mut s = [0i64; 7]; let mut t = 0; for i in 1..8 { let l = (PATH[i].0 - PATH[i - 1].0).abs() + (PATH[i].1 - PATH[i - 1].1).abs(); s[i - 1] = l; t += l; } (s, t) }
fn pos_at(seg: &[i64; 7], mut d: i64) -> (i64, i64) {
    let mut i = 0; while i < 6 && d > seg[i] { d -= seg[i]; i += 1; }
    if d > seg[i] { d = seg[i]; }
    let (a, b) = (PATH[i], PATH[i + 1]);
    (a.0 + (b.0 - a.0).signum() * d, a.1 + (b.1 - a.1).signum() * d)
}
fn roof_at(c: i64, r: i64) -> bool { c >= 0 && c < COLS && r >= 0 && r < ROWS && (ROOF[r as usize] >> c) & 1 == 1 }
fn wave_queue(w: i64) -> Vec<(usize, i64)> {
    let mut q = Vec::new(); let n = 6 + w * 2;
    for i in 0..n { let mut k = 0usize; let r = (i * 37 + w * 11) % 10;
        if w >= 2 && r < 3 { k = 1 } if w >= 3 && r >= 8 { k = 2 } if w >= 4 && r == 5 { k = 3 } if w >= 7 && r == 6 { k = 2 }
        q.push((k, if k == 1 { 17 } else { 26 })); }
    if w == 5 || w == 10 { q.push((4, 42)); }
    if w == 12 { q.push((4, 36)); q.push((4, 75)); }
    q
}

pub struct Outcome { pub ok: bool, pub win: bool, pub waves: i64, pub lives: i64, pub kills: i64, pub cash: i64, pub ticks: i64 }

pub struct Game {
    tick: i64, cash: i64, lives: i64, wave: i64, in_wave: bool, queue: Vec<(usize, i64)>, qi: usize, spawn_t: i64,
    towers: Vec<Tower>, enemies: Vec<Enemy>, hits: Vec<Hit>, kills: i64, over: bool, win: bool, bonus: i64, rng: u32,
    hpm: i64, maxh: usize, seg: [i64; 7], path_len: i64, scratch: Vec<usize>,
}
impl Game {
    pub fn new(seed: u32, bonus: i64, m: &Mods) -> Self {
        let (seg, path_len) = seg_len();
        Game { tick: 0, cash: m.cash, lives: 20, wave: 0, in_wave: false, queue: Vec::new(), qi: 0, spawn_t: 0, towers: Vec::new(), enemies: Vec::new(), hits: Vec::new(),
            kills: 0, over: false, win: false, bonus, rng: if seed == 0 { 0x9e3779b9 } else { seed }, hpm: m.hp, maxh: m.heroes, seg, path_len, scratch: Vec::new() }
    }
    fn rand(&mut self) -> u32 { let mut x = self.rng; x ^= x << 13; x ^= x >> 17; x ^= x << 5; self.rng = x; x }
    fn tower_at(&self, c: i64, r: i64) -> Option<usize> { self.towers.iter().position(|t| t.c == c && t.r == r) }
    fn hit(&mut self, i: usize, dmg: i64) {
        let e = &mut self.enemies[i]; if e.dead { return; }
        let real = dmg * (1000 - e.armor) / 1000; e.hp -= real;
        if e.hp <= 0 { e.dead = true; self.kills += 1; self.cash += e.cash; }
    }
    pub fn act(&mut self, a: &Action) -> bool {
        if self.over { return false; }
        match *a {
            Action::Place(h, c, r) => {
                if h < 0 || h >= 6 || !roof_at(c, r) || self.tower_at(c, r).is_some() || self.cash < HERO[h as usize].0 || self.towers.len() >= self.maxh { return false; }
                let h = h as usize; self.cash -= HERO[h].0;
                self.towers.push(Tower { h, c, r, x: (c - 4) * CELL, z: r * CELL - 22500, lv: 0, cd: 9, spent: HERO[h].0 }); true }
            Action::Up(c, r) => { match self.tower_at(c, r) { Some(i) => { let t = &self.towers[i]; if t.lv >= 2 { return false; } let cost = UPCOST[t.h][t.lv + 1]; if self.cash < cost { return false; }
                self.cash -= cost; let t = &mut self.towers[i]; t.spent += cost; t.lv += 1; true } None => false } }
            Action::Sell(c, r) => { match self.tower_at(c, r) { Some(i) => { self.cash += self.towers[i].spent * 6 / 10; self.towers.remove(i); true } None => false } }
            Action::Go => { if self.in_wave || self.wave >= WAVES { return false; } self.wave += 1; self.queue = wave_queue(self.wave); self.qi = 0; self.spawn_t = 12; self.in_wave = true; true }
        }
    }
    fn spawn(&mut self, k: usize) {
        let e = ENEMY[k]; let w = self.wave; let mut hp = e[0] * 1000 * (8 + 2 * w) / 10; if w > 8 { hp = hp * 5 / 4; } hp = hp * self.hpm / 1000;
        let (x, z) = pos_at(&self.seg, 0);
        self.enemies.push(Enemy { hp, spd: e[1], cash: e[2], steal: e[3], armor: e[4], d: 0, x, z, slow: 0, slow_k: 1000, stun: 0, dead: false });
    }
    pub fn step(&mut self) {
        if self.over || !self.in_wave { return; }
        self.spawn_t -= 1;
        if self.spawn_t <= 0 && self.qi < self.queue.len() { let (k, gap) = self.queue[self.qi]; self.qi += 1; self.spawn(k); self.spawn_t = gap; }
        if self.qi >= self.queue.len() && !self.enemies.iter().any(|e| !e.dead) {
            self.in_wave = false; self.hits.clear(); self.cash += 20 + self.wave * 5;
            if self.wave >= WAVES { self.over = true; self.win = true; }
            self.tick += 1; return;
        }
        for i in 0..self.enemies.len() {
            let seg = self.seg; let path_len = self.path_len;
            let e = &mut self.enemies[i]; if e.dead { continue; }
            let mut sp = e.spd;
            if e.slow > 0 { e.slow -= 1; sp = sp * e.slow_k / 1000; }
            if e.stun > 0 { e.stun -= 1; sp = 0; }
            e.d += sp; let (x, z) = pos_at(&seg, e.d); e.x = x; e.z = z;
            if e.d >= path_len { e.dead = true; self.lives -= e.steal;
                if self.lives <= 0 { self.lives = 0; self.over = true; self.win = false; self.tick += 1; return; } }
        }
        for ti in 0..self.towers.len() {
            if self.towers[ti].cd > 0 { self.towers[ti].cd -= 1; }
            if self.towers[ti].cd > 0 { continue; }
            let (h, lv, tx, tz) = { let t = &self.towers[ti]; (t.h, t.lv, t.x, t.z) };
            let (_, range, dmg, cd, atk) = HERO[h]; let r = range * LVR[lv] / 1000;
            let mut list = core::mem::take(&mut self.scratch); list.clear();
            for (i, e) in self.enemies.iter().enumerate() { if !e.dead { let dx = e.x - tx; let dz = e.z - tz; if dx * dx + dz * dz <= r * r { list.push(i); } } }
            let mut tg: Option<usize> = None;
            for &i in &list { match tg { None => tg = Some(i), Some(j) => { let better = if atk == Atk::Feather { self.enemies[i].hp > self.enemies[j].hp } else { self.enemies[i].d > self.enemies[j].d }; if better { tg = Some(i); } } } }
            let tg = match tg { Some(t) => t, None => { self.scratch = list; continue } };
            self.towers[ti].cd = if lv == 2 && h == 0 { 10 } else { cd };
            let dd = dmg * 1000 * LVM[lv] / 1000 * (if h as i64 == self.bonus { 1250 } else { 1000 }) / 1000;
            match atk {
                Atk::Scream => { let k = if lv == 2 { 350 } else if lv == 1 { 480 } else { 580 }; for &i in &list { { let e = &mut self.enemies[i]; if e.slow < 48 { e.slow = 48; } e.slow_k = k; } self.hit(i, dd); } }
                Atk::Slam => { let st = if lv == 0 { 11 } else if lv == 1 { 18 } else { 27 }; for &i in &list { self.hit(i, dd); let e = &mut self.enemies[i]; if e.stun < st { e.stun = st; } } }
                _ => { let left = match atk { Atk::Nunchaku => 6, Atk::Feather => 4, Atk::Ball => 17, _ => 3 }; let (x, z) = (self.enemies[tg].x, self.enemies[tg].z);
                    self.hits.push(Hit { left, atk, tg, d: dd, lv, x, z }); }
            }
            self.scratch = list;
        }
        let mut hits = core::mem::take(&mut self.hits); let mut kept = 0usize;
        for hi in 0..hits.len() {
            hits[hi].left -= 1; if hits[hi].left > 0 { hits.swap(kept, hi); kept += 1; continue; }
            let h = hits[hi];
            if h.atk == Atk::Ball {
                let gone = h.tg == usize::MAX || self.enemies[h.tg].dead; let (px, pz) = if gone { (h.x, h.z) } else { (self.enemies[h.tg].x, self.enemies[h.tg].z) }; let rad: i64 = if h.lv == 2 { 4455 } else { 3300 };
                for i in 0..self.enemies.len() { if !self.enemies[i].dead { let dx = self.enemies[i].x - px; let dz = self.enemies[i].z - pz; if dx * dx + dz * dz < rad * rad { self.hit(i, h.d); } } }
                continue;
            }
            if h.tg == usize::MAX || self.enemies[h.tg].dead { continue; }
            match h.atk {
                Atk::Charge => { let crit = h.lv == 2 && self.rand() % 100 < 30; self.hit(h.tg, if crit { h.d * 2 } else { h.d }); let e = &mut self.enemies[h.tg]; if e.stun < 9 { e.stun = 9; } }
                Atk::Feather => { self.hit(h.tg, h.d); if h.lv == 2 { let (tx, tz) = (self.enemies[h.tg].x, self.enemies[h.tg].z);
                    let nx = (0..self.enemies.len()).find(|&i| { let e = &self.enemies[i]; !e.dead && i != h.tg && (e.x - tx) * (e.x - tx) + (e.z - tz) * (e.z - tz) < 4200 * 4200 });
                    if let Some(n) = nx { self.hit(n, h.d * 6 / 10); } } }
                _ => self.hit(h.tg, h.d),
            }
        }
        hits.truncate(kept);
        // drop dead thieves and re-point pending hits at the survivors
        if self.enemies.iter().any(|e| e.dead) {
            let mut remap: Vec<usize> = Vec::with_capacity(self.enemies.len()); let mut n = 0usize;
            for e in &self.enemies { if e.dead { remap.push(usize::MAX) } else { remap.push(n); n += 1; } }
            for h in hits.iter_mut() { if h.tg != usize::MAX { h.tg = remap[h.tg]; } }
            self.enemies.retain(|e| !e.dead);
        }
        self.hits = hits; self.tick += 1;
    }
    pub fn outcome(&self, ok: bool) -> Outcome { Outcome { ok, win: self.win, waves: if self.win { WAVES } else { core::cmp::max(0, self.wave - 1) }, lives: self.lives, kills: self.kills, cash: self.cash, ticks: self.tick } }
}

/// Replay a defense: actions carry the tick they were made at; between waves the clock stands still.
pub fn replay(seed: u32, bonus: i64, mods: &Mods, actions: &[(i64, Action)], max_ticks: i64) -> Outcome {
    let mut g = Game::new(seed, bonus, mods); let mut i = 0;
    while !g.over && g.tick < max_ticks {
        while i < actions.len() && actions[i].0 == g.tick { let a = actions[i].1.clone(); g.act(&a); i += 1; }
        if g.in_wave { g.step(); } else { if i >= actions.len() { break; } if actions[i].0 != g.tick { return g.outcome(false); } }
    }
    g.outcome(true)
}

/// Parse the compact text form the game submits: "t:p,h,c,r;t:u,c,r;t:s,c,r;t:g"
pub fn parse(s: &str) -> Option<Vec<(i64, Action)>> {
    let mut out = Vec::new(); if s.is_empty() { return Some(out); }
    for part in s.split(';') {
        let (t, rest) = part.split_once(':')?; let t: i64 = t.parse().ok()?; let mut f = rest.split(',');
        let kind = f.next()?; let mut n = || -> Option<i64> { f.next()?.parse().ok() };
        let a = match kind { "p" => Action::Place(n()?, n()?, n()?), "u" => Action::Up(n()?, n()?), "s" => Action::Sell(n()?, n()?), "g" => Action::Go, _ => return None };
        out.push((t, a)); if out.len() > 2000 { return None; }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_defense_loses() { let d = daily(20396); let o = replay(d.seed, -1, &d.mods, &parse("0:g").unwrap(), 200000); assert!(o.ok && !o.win); }
}
