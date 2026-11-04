use std::io::BufRead;
fn main() {
    for line in std::io::stdin().lock().lines() {
        let line = line.unwrap(); let mut f = line.splitn(6, ' ');
        let seed: u32 = f.next().unwrap().parse().unwrap(); let bonus: i64 = f.next().unwrap().parse().unwrap();
        let hp: i64 = f.next().unwrap().parse().unwrap(); let heroes: usize = f.next().unwrap().parse().unwrap(); let cash: i64 = f.next().unwrap().parse().unwrap();
        let acts = vault_sim::parse(f.next().unwrap_or("")).expect("parse");
        let o = vault_sim::replay(seed, bonus, &vault_sim::Mods { hp, heroes, cash }, &acts, 120000);
        println!("{} {} {} {} {} {} {}", o.ok as u8, o.win as u8, o.waves, o.lives, o.kills, o.cash, o.ticks);
    }
}
