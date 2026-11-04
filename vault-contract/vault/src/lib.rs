//! ROBIN Vault: a treasury that only follows its rules.
//!
//! * A ticket for the daily Defend the Vault challenge costs `ticket` tokens: half is burned on the spot,
//!   40% goes to the day's pot and 10% to the weekly reserve.
//! * Players submit their moves, not a score. The contract replays the whole defense with the same rules
//!   as the game (crate `vault-sim`) and decides who beat the day's target.
//! * When the day is over anyone can settle it: the winners split the pot. No winner? The thieves "stole" it
//!   and the whole pot is burned.
//! * Every verified defense adds its waves to the weekly community goal. Goal reached: the reserve is shared
//!   by everyone who played that week. Missed: the reserve is burned.
//! * Holders lock tokens to vote the hero of the week, who hits 25% harder the following week. Locks come back
//!   when the week ends.
//! * Badges are soulbound flags on the player record.
//! There is no owner and no withdraw method.
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, is_promise_success, log, near, require, serde_json, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};

const GAS_FT: Gas = Gas::from_tgas(10);
const GAS_CB: Gas = Gas::from_tgas(8);
const HEROES: usize = 6;
pub const B_FIRST: u32 = 1; // first verified defense
pub const B_SAFE: u32 = 2; // cleared all 12 waves
pub const B_PERFECT: u32 = 4; // cleared with the vault untouched
pub const B_CHAMP: u32 = 8; // beat a daily target with a ticket
pub const B_STREAK: u32 = 16; // beat the daily target 7 days in a row
pub const B_RITUAL: u32 = 32; // bought a ticket
pub const B_VOTER: u32 = 64; // voted a hero of the week
pub const B_KEEPER: u32 = 128; // most wins in a week: Vault Keeper

#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct Day { pub pot: U128, pub tickets: u32, pub runs: u32, pub winners: u32, pub settled: bool, pub share: U128, pub burned: U128 }

#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct Week { pub reserve: U128, pub waves: u64, pub players: u32, pub settled: bool, pub goal_met: bool, pub share: U128, pub votes: Vec<U128>, pub keeper: Option<AccountId>, pub keeper_wins: u32 }

#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct Player { pub badges: u32, pub runs: u32, pub wins: u32, pub streak: u32, pub last_win_day: u64, pub best_lives: u32, pub days_to_claim: Vec<u64>, pub weeks_to_claim: Vec<u64>, pub locks: Vec<u64> }

#[near(serializers = [json])]
pub struct Verdict { pub ok: bool, pub win: bool, pub waves: i64, pub lives: i64, pub kills: i64, pub target: i64, pub winner: bool, pub ticket: bool, pub new_badges: u32 }

#[near(serializers = [json])]
pub struct Config { pub token: AccountId, pub burn_to: AccountId, pub ticket: U128, pub epoch_secs: u64, pub week_days: u64, pub goal: u64, pub today: u64, pub week: u64, pub hero_of_week: i64, pub burned: U128, pub paid: U128, pub tickets: u64, pub runs: u64 }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    token: AccountId, burn_to: AccountId, ticket: u128, epoch_secs: u64, week_days: u64, goal: u64,
    days: LookupMap<u64, Day>, weeks: LookupMap<u64, Week>, players: LookupMap<AccountId, Player>,
    flags: LookupMap<String, u32>, locks: LookupMap<String, (u8, u128)>,
    burned: u128, paid: u128, tickets: u64, runs: u64,
}

fn key(kind: &str, n: u64, a: &AccountId) -> String { format!("{}:{}:{}", kind, n, a) }

#[near]
impl Vault {
    #[init]
    pub fn new(token: AccountId, burn_to: AccountId, ticket: U128, epoch_secs: u64, week_days: u64, goal: u64) -> Self {
        require!(epoch_secs >= 60 && week_days >= 1 && ticket.0 > 0, "bad config");
        Self { token, burn_to, ticket: ticket.0, epoch_secs, week_days, goal,
            days: LookupMap::new(b"d".to_vec()), weeks: LookupMap::new(b"w".to_vec()), players: LookupMap::new(b"p".to_vec()),
            flags: LookupMap::new(b"f".to_vec()), locks: LookupMap::new(b"l".to_vec()), burned: 0, paid: 0, tickets: 0, runs: 0 }
    }

    // ---------- time ----------
    pub fn today(&self) -> u64 { env::block_timestamp() / 1_000_000_000 / self.epoch_secs }
    fn week_of(&self, day: u64) -> u64 { day / self.week_days }
    /// The hero voted last week (index in Defend the Vault order), or -1.
    pub fn hero_for_day(&self, day: u64) -> i64 {
        let w = self.week_of(day); if w == 0 { return -1; }
        match self.weeks.get(&(w - 1)) { Some(wk) => { let mut best = -1i64; let mut top = 0u128; for (i, v) in wk.votes.iter().enumerate() { if v.0 > top { top = v.0; best = i as i64; } } best } None => -1 }
    }

    fn day_mut(&mut self, d: u64) -> &mut Day { if self.days.get(&d).is_none() { self.days.insert(d, Day::default()); } self.days.get_mut(&d).unwrap() }
    fn week_mut(&mut self, w: u64) -> &mut Week { if self.weeks.get(&w).is_none() { self.weeks.insert(w, Week { votes: vec![U128(0); HEROES], ..Default::default() }); } self.weeks.get_mut(&w).unwrap() }
    fn player_mut(&mut self, a: &AccountId) -> &mut Player { if self.players.get(a).is_none() { self.players.insert(a.clone(), Player::default()); } self.players.get_mut(a).unwrap() }

    fn burn(&mut self, amount: u128, why: &str) {
        if amount == 0 { return; }
        self.burned += amount; log!("BURN {} ({})", amount, why);
        Promise::new(self.token.clone())
            .function_call("ft_transfer".into(), serde_json::json!({"receiver_id": self.burn_to, "amount": U128(amount), "memo": why}).to_string().into_bytes(), NearToken::from_yoctonear(1), GAS_FT)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_burned(U128(amount)));
    }
    fn pay(&mut self, to: AccountId, amount: u128, what: String) -> Promise {
        self.paid += amount;
        Promise::new(self.token.clone())
            .function_call("ft_transfer".into(), serde_json::json!({"receiver_id": to, "amount": U128(amount), "memo": what}).to_string().into_bytes(), NearToken::from_yoctonear(1), GAS_FT)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_paid(to, U128(amount), what))
    }

    // ---------- tokens in: tickets, votes, donations ----------
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.token, "only the ROBIN token");
        let m: serde_json::Value = serde_json::from_str(&msg).unwrap_or(serde_json::Value::Null);
        let action = m.get("a").and_then(|v| v.as_str()).unwrap_or("");
        let today = self.today(); let week = self.week_of(today);
        match action {
            "ticket" => {
                let k = key("t", today, &sender_id);
                if amount.0 < self.ticket || self.flags.get(&k).is_some() { log!("ticket refused"); return PromiseOrValue::Value(amount); }
                self.flags.insert(k, 1); self.tickets += 1;
                let burn = self.ticket / 2; let pot = self.ticket * 4 / 10; let reserve = self.ticket - burn - pot;
                { let d = self.day_mut(today); d.pot = U128(d.pot.0 + pot); d.tickets += 1; }
                { let w = self.week_mut(week); w.reserve = U128(w.reserve.0 + reserve); }
                self.player_mut(&sender_id).badges |= B_RITUAL;
                self.burn(burn, "ticket");
                PromiseOrValue::Value(U128(amount.0 - self.ticket))
            }
            "vote" => {
                let h = m.get("h").and_then(|v| v.as_u64()).unwrap_or(99) as usize;
                if h >= HEROES { return PromiseOrValue::Value(amount); }
                let k = key("v", week, &sender_id);
                let (hh, prev) = self.locks.get(&k).cloned().unwrap_or((h as u8, 0));
                if prev > 0 && hh as usize != h { log!("already voting another hero this week"); return PromiseOrValue::Value(amount); }
                self.locks.insert(k, (h as u8, prev + amount.0));
                { let w = self.week_mut(week); w.votes[h] = U128(w.votes[h].0 + amount.0); }
                let p = self.player_mut(&sender_id); p.badges |= B_VOTER; if !p.locks.contains(&week) { p.locks.push(week); }
                PromiseOrValue::Value(U128(0))
            }
            "fund" => { let w = self.week_mut(week); w.reserve = U128(w.reserve.0 + amount.0); PromiseOrValue::Value(U128(0)) }
            _ => PromiseOrValue::Value(amount),
        }
    }

    // ---------- the defense ----------
    /// Submit today's defense as a list of moves. Free to everyone; only ticket holders can win the pot.
    pub fn submit(&mut self, day: u64, moves: String) -> Verdict {
        let a = env::predecessor_account_id(); let today = self.today();
        require!(day == today, "you can only submit today's challenge");
        require!(moves.len() <= 20000, "too many moves");
        let acts = vault_sim::parse(&moves).unwrap_or_else(|| env::panic_str("cannot read the moves"));
        let dl = vault_sim::daily(day); let bonus = self.hero_for_day(day);
        let o = vault_sim::replay(dl.seed, bonus, &dl.mods, &acts, 120000);
        require!(o.ok, "this defense does not follow the rules");
        self.runs += 1;
        let ticket = self.flags.get(&key("t", day, &a)).is_some();
        let week = self.week_of(day);
        // community goal: only your best defense of the day counts
        let bk = key("b", day, &a); let prev = *self.flags.get(&bk).unwrap_or(&0) as u64; let waves = o.waves as u64;
        if waves > prev { self.flags.insert(bk, waves as u32); let add = waves - prev; let w = self.week_mut(week); w.waves += add; }
        let pk = key("pw", week, &a); if self.flags.get(&pk).is_none() { self.flags.insert(pk, 1); self.week_mut(week).players += 1; }
        { self.day_mut(day).runs += 1; }
        let beat = o.win && o.lives >= dl.target;
        let wk = key("w", day, &a); let mut winner = self.flags.get(&wk).is_some();
        let mut kw = 0u32;
        if beat && ticket && !winner {
            winner = true; self.flags.insert(wk, 1); self.day_mut(day).winners += 1;
            let kk = key("kw", week, &a); kw = self.flags.get(&kk).cloned().unwrap_or(0) + 1; self.flags.insert(kk, kw);
        }
        let p = self.player_mut(&a); let before = p.badges; p.runs += 1; p.badges |= B_FIRST;
        if o.win { p.badges |= B_SAFE; if o.lives == 20 { p.badges |= B_PERFECT; } if o.lives as u32 > p.best_lives { p.best_lives = o.lives as u32; } }
        if kw > 0 {
            p.badges |= B_CHAMP; p.wins += 1; if !p.days_to_claim.contains(&day) { p.days_to_claim.push(day); }
            p.streak = if p.last_win_day + 1 == day { p.streak + 1 } else { 1 }; p.last_win_day = day; if p.streak >= 7 { p.badges |= B_STREAK; }
        }
        let new_badges = p.badges & !before;
        if kw > 0 { let w = self.week_mut(week); if kw > w.keeper_wins { w.keeper_wins = kw; w.keeper = Some(a.clone()); } }
        Verdict { ok: true, win: o.win, waves: o.waves, lives: o.lives, kills: o.kills, target: dl.target, winner, ticket, new_badges }
    }

    // ---------- rituals anyone can run ----------
    /// Close a finished day: winners share the pot, or the thieves take it and it is burned.
    pub fn settle_day(&mut self, day: u64) {
        require!(day < self.today(), "the day is not over yet");
        let d = self.days.get(&day).cloned().unwrap_or_default(); require!(!d.settled, "already settled");
        let week = self.week_of(self.today());
        let mut d2 = d.clone(); d2.settled = true;
        if d.winners > 0 { let share = d.pot.0 / d.winners as u128; let rest = d.pot.0 - share * d.winners as u128; d2.share = U128(share);
            if rest > 0 { let w = self.week_mut(week); w.reserve = U128(w.reserve.0 + rest); } self.days.insert(day, d2); log!("DAY {} settled: {} winners get {} each", day, d.winners, share); }
        else { d2.burned = d.pot; self.days.insert(day, d2); self.burn(d.pot.0, "no winner, the thieves took the pot"); }
    }
    /// Close a finished week: goal met shares the reserve with every player, missed burns it. The keeper gets a badge.
    pub fn settle_week(&mut self, week: u64) {
        require!(week < self.week_of(self.today()), "the week is not over yet");
        let w = self.weeks.get(&week).cloned().unwrap_or(Week { votes: vec![U128(0); HEROES], ..Default::default() }); require!(!w.settled, "already settled");
        let mut w2 = w.clone(); w2.settled = true;
        if let Some(k) = w.keeper.clone() { self.player_mut(&k).badges |= B_KEEPER; }
        if w.waves >= self.goal && w.players > 0 { w2.goal_met = true; w2.share = U128(w.reserve.0 / w.players as u128); self.weeks.insert(week, w2); log!("WEEK {} goal met", week); }
        else { self.weeks.insert(week, w2); self.burn(w.reserve.0, "community goal missed"); }
    }

    // ---------- tokens out ----------
    pub fn claim_day(&mut self, day: u64) -> Promise {
        let a = env::predecessor_account_id(); let d = self.days.get(&day).cloned().unwrap_or_default();
        require!(d.settled, "settle the day first"); let k = key("w", day, &a);
        require!(self.flags.get(&k) == Some(&1), "nothing to claim"); self.flags.insert(k, 2);
        let p = self.player_mut(&a); p.days_to_claim.retain(|x| *x != day);
        self.pay(a, d.share.0, format!("day {}", day))
    }
    pub fn claim_week(&mut self, week: u64) -> Promise {
        let a = env::predecessor_account_id(); let w = self.weeks.get(&week).cloned().unwrap_or_default();
        require!(w.settled && w.goal_met, "no reward for this week"); let k = key("pw", week, &a);
        require!(self.flags.get(&k) == Some(&1), "nothing to claim"); self.flags.insert(k, 2);
        self.pay(a, w.share.0, format!("week {}", week))
    }
    pub fn unlock(&mut self, week: u64) -> Promise {
        let a = env::predecessor_account_id(); require!(week < self.week_of(self.today()), "votes stay locked until the week ends");
        let k = key("v", week, &a); let (_, amt) = self.locks.get(&k).cloned().unwrap_or((0, 0)); require!(amt > 0, "nothing locked");
        self.locks.remove(&k); let p = self.player_mut(&a); p.locks.retain(|x| *x != week);
        Promise::new(self.token.clone()).function_call("ft_transfer".into(), serde_json::json!({"receiver_id": a, "amount": U128(amt), "memo": "vote unlocked"}).to_string().into_bytes(), NearToken::from_yoctonear(1), GAS_FT)
    }

    #[private]
    pub fn on_burned(&mut self, amount: U128) { if !is_promise_success() { self.burned -= amount.0; log!("burn failed, tokens stay in the vault"); } }
    #[private]
    pub fn on_paid(&mut self, to: AccountId, amount: U128, what: String) {
        if !is_promise_success() { self.paid -= amount.0; log!("payment failed, it can be claimed again");
            if let Some(d) = what.strip_prefix("day ").and_then(|x| x.parse::<u64>().ok()) { self.flags.insert(key("w", d, &to), 1); self.player_mut(&to).days_to_claim.push(d); }
            if let Some(w) = what.strip_prefix("week ").and_then(|x| x.parse::<u64>().ok()) { self.flags.insert(key("pw", w, &to), 1); } }
    }

    // ---------- views ----------
    pub fn config(&self) -> Config { let t = self.today(); Config { token: self.token.clone(), burn_to: self.burn_to.clone(), ticket: U128(self.ticket), epoch_secs: self.epoch_secs, week_days: self.week_days, goal: self.goal, today: t, week: self.week_of(t), hero_of_week: self.hero_for_day(t), burned: U128(self.burned), paid: U128(self.paid), tickets: self.tickets, runs: self.runs } }
    pub fn get_day(&self, day: u64) -> Day { self.days.get(&day).cloned().unwrap_or_default() }
    pub fn get_week(&self, week: u64) -> Week { self.weeks.get(&week).cloned().unwrap_or(Week { votes: vec![U128(0); HEROES], ..Default::default() }) }
    pub fn get_player(&self, account_id: AccountId) -> Player { self.players.get(&account_id).cloned().unwrap_or_default() }
    pub fn status(&self, account_id: AccountId, day: u64) -> serde_json::Value {
        let week = self.week_of(day);
        serde_json::json!({
            "ticket": self.flags.get(&key("t", day, &account_id)).is_some(),
            "best_waves": self.flags.get(&key("b", day, &account_id)).cloned().unwrap_or(0),
            "winner": self.flags.get(&key("w", day, &account_id)).cloned().unwrap_or(0),
            "week_played": self.flags.get(&key("pw", week, &account_id)).cloned().unwrap_or(0),
            "week_wins": self.flags.get(&key("kw", week, &account_id)).cloned().unwrap_or(0),
            "vote": self.locks.get(&key("v", week, &account_id)).map(|(h, a)| serde_json::json!({"hero": h, "amount": U128(*a)})),
        })
    }
    /// Check a defense without sending it (free view call).
    pub fn check(&self, day: u64, moves: String) -> Verdict {
        let acts = vault_sim::parse(&moves).unwrap_or_else(|| env::panic_str("cannot read the moves"));
        let dl = vault_sim::daily(day); let o = vault_sim::replay(dl.seed, self.hero_for_day(day), &dl.mods, &acts, 120000);
        Verdict { ok: o.ok, win: o.win, waves: o.waves, lives: o.lives, kills: o.kills, target: dl.target, winner: false, ticket: false, new_badges: 0 }
    }
}
