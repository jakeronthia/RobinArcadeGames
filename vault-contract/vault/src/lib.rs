//! ROBIN Arcade prize pool: pay a tiny fee per game, chase an instant jackpot and a weekly prize pool.
//!
//! * A paid play costs `price` tokens and is split by the contract: 50% to this week's prize pool, 30% to the
//!   jackpot, 15% burned on the spot, 5% to next week's pool.
//! * Every paid play rolls the instant jackpot (1 in `odds_paid`). Players with an account can also roll for
//!   free a few times a day, with far lower odds (1 in `odds_free`). The winner takes 90% of the jackpot, 10%
//!   stays as the seed of the next one.
//! * The weekly pool goes 60% to the Vault Cup (best Defend the Vault scores, replayed and verified on chain:
//!   players send their moves, not a score) and 40% to the most active players (paid plays, which cannot be
//!   faked). Ranks 1 to 10 get 25/18/13/10/8/7/6/5/4/4% of each part; unused shares roll into next week.
//! * Anyone can close a finished week. There is no owner and no withdraw method.
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, is_promise_success, log, near, require, serde_json, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};

const GAS_FT: Gas = Gas::from_tgas(10);
const GAS_CB: Gas = Gas::from_tgas(8);
const W: [u128; 10] = [25, 18, 13, 10, 8, 7, 6, 5, 4, 4];
const FEED: usize = 24;
pub const B_PLAYER: u32 = 1; // first paid play
pub const B_JACKPOT: u32 = 2; // won the jackpot
pub const B_CUP: u32 = 4; // top 10 of a Vault Cup
pub const B_ACTIVE: u32 = 8; // top 10 most active of a week
pub const B_PERFECT: u32 = 16; // Defend the Vault with the vault untouched
pub const B_SAFE: u32 = 32; // cleared all 12 waves
pub const B_REGULAR: u32 = 64; // 50 paid plays
pub const B_LUCKY: u32 = 128; // used a free roll

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Entry { pub account: AccountId, pub value: u32, pub at: u64 }

#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct Week { pub pool: U128, pub plays: u64, pub players: u32, pub cup: Vec<Entry>, pub active: Vec<Entry>, pub settled: bool, pub cup_shares: Vec<U128>, pub active_shares: Vec<U128> }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Play { pub account: AccountId, pub game: String, pub paid: bool, pub won: U128, pub at: u64 }

#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct Player { pub badges: u32, pub plays: u32, pub free_rolls: u32, pub jackpots: u32, pub won: U128, pub best_score: u32, pub weeks_to_claim: Vec<u64>, pub last: Option<Play> }

#[near(serializers = [json])]
pub struct Verdict { pub ok: bool, pub win: bool, pub waves: i64, pub lives: i64, pub kills: i64, pub score: u32, pub rank: u32, pub credits_left: u32, pub new_badges: u32 }

#[near(serializers = [json])]
pub struct Config { pub token: AccountId, pub burn_to: AccountId, pub price: U128, pub odds_paid: u64, pub odds_free: u64, pub free_per_day: u32, pub epoch_secs: u64, pub week_days: u64,
    pub today: u64, pub week: u64, pub week_ends: u64, pub jackpot: U128, pub jackpots_won: u32, pub burned: U128, pub paid_out: U128, pub plays_paid: u64, pub plays_free: u64 }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    token: AccountId, burn_to: AccountId, price: u128, odds_paid: u64, odds_free: u64, free_per_day: u32, epoch_secs: u64, week_days: u64,
    weeks: LookupMap<u64, Week>, players: LookupMap<AccountId, Player>, flags: LookupMap<String, u32>, claims: LookupMap<String, u128>,
    jackpot: u128, jackpots_won: u32, burned: u128, paid_out: u128, plays_paid: u64, plays_free: u64, feed: Vec<Play>, nonce: u64,
}

fn key(kind: &str, n: u64, a: &AccountId) -> String { format!("{}:{}:{}", kind, n, a) }
fn game_ok(g: &str) -> bool { !g.is_empty() && g.len() <= 16 && g.bytes().all(|b| b.is_ascii_lowercase()) }
/// keep a top-10 list sorted by value (higher first); ties keep the earlier entry ahead
fn rank_in(list: &mut Vec<Entry>, a: &AccountId, value: u32, at: u64) -> u32 {
    if let Some(i) = list.iter().position(|e| &e.account == a) { if value <= list[i].value { return i as u32 + 1; } list.remove(i); }
    let pos = list.iter().position(|e| value > e.value).unwrap_or(list.len());
    if pos >= 10 { return 0; }
    list.insert(pos, Entry { account: a.clone(), value, at }); list.truncate(10); pos as u32 + 1
}

#[near]
impl Vault {
    #[init]
    pub fn new(token: AccountId, burn_to: AccountId, price: U128, odds_paid: u64, odds_free: u64, free_per_day: u32, epoch_secs: u64, week_days: u64) -> Self {
        require!(price.0 >= 100 && odds_paid >= 1 && odds_free >= 1 && epoch_secs >= 60 && week_days >= 1, "bad config");
        Self { token, burn_to, price: price.0, odds_paid, odds_free, free_per_day, epoch_secs, week_days,
            weeks: LookupMap::new(b"w".to_vec()), players: LookupMap::new(b"p".to_vec()), flags: LookupMap::new(b"f".to_vec()), claims: LookupMap::new(b"c".to_vec()),
            jackpot: 0, jackpots_won: 0, burned: 0, paid_out: 0, plays_paid: 0, plays_free: 0, feed: Vec::new(), nonce: 0 }
    }

    // ---------- time ----------
    fn now_s(&self) -> u64 { env::block_timestamp() / 1_000_000_000 }
    pub fn today(&self) -> u64 { self.now_s() / self.epoch_secs }
    fn week_now(&self) -> u64 { self.today() / self.week_days }
    fn week_mut(&mut self, w: u64) -> &mut Week { if self.weeks.get(&w).is_none() { self.weeks.insert(w, Week::default()); } self.weeks.get_mut(&w).unwrap() }
    fn player_mut(&mut self, a: &AccountId) -> &mut Player { if self.players.get(a).is_none() { self.players.insert(a.clone(), Player::default()); } self.players.get_mut(a).unwrap() }

    fn ft(&self, to: &AccountId, amount: u128, memo: &str) -> Promise {
        Promise::new(self.token.clone()).function_call("ft_transfer", serde_json::json!({"receiver_id": to, "amount": U128(amount), "memo": memo}).to_string().into_bytes(), NearToken::from_yoctonear(1), GAS_FT)
    }
    fn burn(&mut self, amount: u128, why: &str) { if amount == 0 { return; } self.burned += amount; log!("BURN {} {}", amount, why); self.ft(&self.burn_to.clone(), amount, why).then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_burned(U128(amount))); }
    fn roll(&mut self, a: &AccountId, odds: u64) -> bool {
        self.nonce += 1; let mut seed = env::random_seed(); seed.extend_from_slice(a.as_bytes()); seed.extend_from_slice(&self.nonce.to_le_bytes());
        let h = env::sha256(&seed); let mut b = [0u8; 8]; b.copy_from_slice(&h[..8]); u64::from_le_bytes(b) % odds == 0
    }
    /// pays the jackpot to `a` if the roll wins; returns the amount won
    fn try_jackpot(&mut self, a: &AccountId, odds: u64) -> u128 {
        if self.jackpot == 0 || !self.roll(a, odds) { return 0; }
        let win = self.jackpot * 9 / 10; self.jackpot -= win; self.jackpots_won += 1; self.paid_out += win;
        log!("JACKPOT {} won {}", a, win);
        self.ft(a, win, "ROBIN Arcade jackpot").then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_jackpot(a.clone(), U128(win)));
        let p = self.player_mut(a); p.jackpots += 1; p.won = U128(p.won.0 + win); p.badges |= B_JACKPOT;
        win
    }
    fn record(&mut self, a: &AccountId, game: String, paid: bool, won: u128) {
        let play = Play { account: a.clone(), game, paid, won: U128(won), at: self.now_s() };
        self.player_mut(a).last = Some(play.clone());
        self.feed.insert(0, play); self.feed.truncate(FEED);
    }

    // ---------- tokens in ----------
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.token, "only the ROBIN token");
        let m: serde_json::Value = serde_json::from_str(&msg).unwrap_or(serde_json::Value::Null);
        let action = m.get("a").and_then(|v| v.as_str()).unwrap_or("");
        let week = self.week_now();
        match action {
            "play" => {
                let game = m.get("g").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if amount.0 < self.price || !game_ok(&game) { log!("play refused"); return PromiseOrValue::Value(amount); }
                let price = self.price; let pool = price / 2; let jack = price * 3 / 10; let burn = price * 15 / 100; let next = price - pool - jack - burn;
                self.plays_paid += 1; self.jackpot += jack;
                { let w = self.week_mut(week); w.pool = U128(w.pool.0 + pool); w.plays += 1; }
                { let w = self.week_mut(week + 1); w.pool = U128(w.pool.0 + next); }
                self.burn(burn, "play");
                // weekly activity ranking and Vault Cup credits
                let pk = key("pl", week, &sender_id); let n = self.flags.get(&pk).cloned().unwrap_or(0) + 1; self.flags.insert(pk, n);
                if n == 1 { self.week_mut(week).players += 1; }
                let now = self.now_s(); { let w = self.week_mut(week); rank_in(&mut w.active, &sender_id, n, now); }
                if game == "vault" { let ck = key("cr", week, &sender_id); let c = self.flags.get(&ck).cloned().unwrap_or(0) + 1; self.flags.insert(ck, c); }
                { let p = self.player_mut(&sender_id); p.plays += 1; p.badges |= B_PLAYER; if p.plays >= 50 { p.badges |= B_REGULAR; } }
                let won = self.try_jackpot(&sender_id, self.odds_paid);
                self.record(&sender_id, game, true, won);
                PromiseOrValue::Value(U128(amount.0 - price))
            }
            "jackpot" => { self.jackpot += amount.0; log!("JACKPOT FUNDED {}", amount.0); PromiseOrValue::Value(U128(0)) }
            "pool" => { let w = self.week_mut(week); w.pool = U128(w.pool.0 + amount.0); PromiseOrValue::Value(U128(0)) }
            _ => PromiseOrValue::Value(amount),
        }
    }

    /// A free jackpot roll for players who play without paying: far lower odds, a few per day.
    pub fn free_roll(&mut self, game: String) -> U128 {
        let a = env::predecessor_account_id(); require!(game_ok(&game), "bad game");
        let k = key("fr", self.today(), &a); let n = self.flags.get(&k).cloned().unwrap_or(0);
        require!(n < self.free_per_day, "no free rolls left today");
        self.flags.insert(k, n + 1); self.plays_free += 1;
        { let p = self.player_mut(&a); p.free_rolls += 1; p.badges |= B_LUCKY; }
        let won = self.try_jackpot(&a, self.odds_free); self.record(&a, game, false, won); U128(won)
    }

    /// Send a Defend the Vault defense for this week's Vault Cup. Uses one paid Defend the Vault play.
    pub fn submit(&mut self, week: u64, moves: String) -> Verdict {
        let a = env::predecessor_account_id(); require!(week == self.week_now(), "you can only submit this week's cup");
        require!(moves.len() <= 20000, "too many moves");
        let ck = key("cr", week, &a); let credits = self.flags.get(&ck).cloned().unwrap_or(0);
        require!(credits > 0, "play Defend the Vault for the pot first");
        let acts = vault_sim::parse(&moves).unwrap_or_else(|| env::panic_str("cannot read the moves"));
        let dl = vault_sim::daily(week); let o = vault_sim::replay(dl.seed, -1, &dl.mods, &acts, 120000);
        require!(o.ok, "this defense does not follow the rules");
        self.flags.insert(ck, credits - 1);
        let score = (o.waves * 100 + o.lives.max(0)) as u32;
        let now = self.now_s(); let rank = { let w = self.week_mut(week); rank_in(&mut w.cup, &a, score, now) };
        let p = self.player_mut(&a); let before = p.badges;
        if o.win { p.badges |= B_SAFE; if o.lives == 20 { p.badges |= B_PERFECT; } }
        if score > p.best_score { p.best_score = score; }
        let nb = p.badges & !before;
        Verdict { ok: true, win: o.win, waves: o.waves, lives: o.lives, kills: o.kills, score, rank, credits_left: credits - 1, new_badges: nb }
    }

    /// Close a finished week: the Vault Cup and the most active players share the pool by rank.
    pub fn settle_week(&mut self, week: u64) {
        require!(week < self.week_now(), "the week is not over yet");
        let w = self.weeks.get(&week).cloned().unwrap_or_default(); require!(!w.settled, "already settled");
        let total = w.pool.0; let cup_part = total * 6 / 10; let act_part = total - cup_part; let mut left = total;
        let mut w2 = w.clone(); w2.settled = true;
        for (list, part, shares, badge) in [(&w.cup, cup_part, &mut w2.cup_shares, B_CUP), (&w.active, act_part, &mut w2.active_shares, B_ACTIVE)] {
            for (i, e) in list.iter().enumerate() {
                let s = part * W[i] / 100; shares.push(U128(s)); left -= s;
                let k = key("cl", week, &e.account); let prev = self.claims.get(&k).cloned().unwrap_or(0); self.claims.insert(k, prev + s);
                let p = self.players.get_mut(&e.account); if let Some(p) = p { p.badges |= badge; if !p.weeks_to_claim.contains(&week) { p.weeks_to_claim.push(week); } }
            }
        }
        self.weeks.insert(week, w2);
        if left > 0 { let nw = self.week_now(); let x = self.week_mut(nw); x.pool = U128(x.pool.0 + left); }
        log!("WEEK {} settled, {} rolls over", week, left);
    }
    pub fn claim(&mut self, week: u64) -> Promise {
        let a = env::predecessor_account_id(); let k = key("cl", week, &a); let amt = self.claims.get(&k).cloned().unwrap_or(0);
        require!(amt > 0, "nothing to claim"); self.claims.remove(&k); self.paid_out += amt;
        if let Some(p) = self.players.get_mut(&a) { p.weeks_to_claim.retain(|x| *x != week); }
        self.ft(&a, amt, "ROBIN Arcade weekly prize").then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_claim(a, week, U128(amt)))
    }

    #[private]
    pub fn on_burned(&mut self, amount: U128) { if !is_promise_success() { self.burned -= amount.0; self.jackpot += amount.0; log!("burn failed, moved to the jackpot"); } }
    #[private]
    pub fn on_jackpot(&mut self, to: AccountId, amount: U128) { if !is_promise_success() { self.jackpot += amount.0; self.paid_out -= amount.0; log!("jackpot payment to {} failed, back in the jackpot", to); } }
    #[private]
    pub fn on_claim(&mut self, to: AccountId, week: u64, amount: U128) { if !is_promise_success() { self.paid_out -= amount.0; self.claims.insert(key("cl", week, &to), amount.0); log!("claim failed, try again"); } }

    // ---------- views ----------
    pub fn config(&self) -> Config {
        let t = self.today(); let wk = t / self.week_days;
        Config { token: self.token.clone(), burn_to: self.burn_to.clone(), price: U128(self.price), odds_paid: self.odds_paid, odds_free: self.odds_free, free_per_day: self.free_per_day,
            epoch_secs: self.epoch_secs, week_days: self.week_days, today: t, week: wk, week_ends: (wk + 1) * self.week_days * self.epoch_secs,
            jackpot: U128(self.jackpot), jackpots_won: self.jackpots_won, burned: U128(self.burned), paid_out: U128(self.paid_out), plays_paid: self.plays_paid, plays_free: self.plays_free }
    }
    pub fn get_week(&self, week: u64) -> Week { self.weeks.get(&week).cloned().unwrap_or_default() }
    pub fn get_player(&self, account_id: AccountId) -> Player { self.players.get(&account_id).cloned().unwrap_or_default() }
    pub fn feed(&self) -> Vec<Play> { self.feed.clone() }
    pub fn status(&self, account_id: AccountId) -> serde_json::Value {
        let wk = self.week_now(); let day = self.today();
        let claimable: Vec<serde_json::Value> = self.players.get(&account_id).map(|p| p.weeks_to_claim.iter().map(|w| serde_json::json!({"week": w, "amount": U128(self.claims.get(&key("cl", *w, &account_id)).cloned().unwrap_or(0))})).collect()).unwrap_or_default();
        serde_json::json!({
            "credits": self.flags.get(&key("cr", wk, &account_id)).cloned().unwrap_or(0),
            "plays_week": self.flags.get(&key("pl", wk, &account_id)).cloned().unwrap_or(0),
            "free_left": self.free_per_day.saturating_sub(self.flags.get(&key("fr", day, &account_id)).cloned().unwrap_or(0)),
            "claimable": claimable,
        })
    }
    /// Check a defense against this week's cup without sending it (free view call).
    pub fn check(&self, week: u64, moves: String) -> Verdict {
        let acts = vault_sim::parse(&moves).unwrap_or_else(|| env::panic_str("cannot read the moves"));
        let dl = vault_sim::daily(week); let o = vault_sim::replay(dl.seed, -1, &dl.mods, &acts, 120000);
        Verdict { ok: o.ok, win: o.win, waves: o.waves, lives: o.lives, kills: o.kills, score: if o.ok { (o.waves * 100 + o.lives.max(0)) as u32 } else { 0 }, rank: 0, credits_left: 0, new_badges: 0 }
    }
}
