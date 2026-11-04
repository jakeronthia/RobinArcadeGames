// Plays many games in the JS rules (bots plus random players) and checks the Rust twin agrees on every one.
const V=require('../../assets/fx/vaultsim.js'),{execFileSync}=require('child_process');
const enc=acts=>acts.map(([t,a])=>t+':'+(a[0]==='place'?'p,'+a.slice(1).join(','):a[0]==='up'?'u,'+a.slice(1).join(','):a[0]==='sell'?'s,'+a.slice(1).join(','):'g')).join(';');
let x=7;const rnd=()=>{x=(x*1103515245+12345)%2147483648;return x/2147483648};
function randomGame(seed,bonus,mods){const g=V.create(seed,bonus,mods),S=g.S,acts=[];const cells=[];for(let r=0;r<16;r++)for(let c=0;c<9;c++)if(V.roofAt(c,r))cells.push([c,r]);
  while(!S.over&&S.tick<120000){if(!S.inWave){const n=Math.floor(rnd()*6);for(let k=0;k<n;k++){const p=rnd();let a;
        if(p<.6){const cl=cells[Math.floor(rnd()*cells.length)];a=['place',Math.floor(rnd()*6),cl[0],cl[1]]}else if(p<.85&&S.towers.length){const t=S.towers[Math.floor(rnd()*S.towers.length)];a=['up',t.c,t.r]}else if(S.towers.length){const t=S.towers[Math.floor(rnd()*S.towers.length)];a=['sell',t.c,t.r]}else continue;
        if(g.act(a))acts.push([S.tick,a]);else if(rnd()<.2)acts.push([S.tick,a])}// some invalid actions too
      if(S.wave>=12)break;g.act(['go']);acts.push([S.tick,['go']])}else g.step()}
  return acts}
const lines=[],expect=[];
for(let i=0;i<300;i++){const day=20000+i,d=V.daily(day),bonus=i%7-1;const mods=i%5===0?{}:d.mods;const acts=randomGame(d.seed,bonus,mods);
  const r=V.replay(d.seed,bonus,acts,mods);const m={hp:mods.hp||1000,heroes:mods.heroes||99,cash:mods.cash||150};
  lines.push([d.seed,bonus,m.hp,m.heroes,m.cash,enc(acts)].join(' '));expect.push([r.ok?1:0,r.win?1:0,r.waves,r.lives,r.kills,r.cash,r.ticks].join(' '))}
const {play}=require('./bot.js');
for(let i=0;i<60;i++){const d=V.daily(21000+i),bonus=i%7-1,mods=i%2?d.mods:{};const r0=require('./bot.js').play(d.seed,bonus,{upFirst:i%6,order:[[0,3,2,0,1,5,4,3,2,5],[5,3,2,0,4,1],[2,2,3,5,0,1]][i%3]},mods);
  const acts=r0.acts;const r=V.replay(d.seed,bonus,acts,mods);const m={hp:mods.hp||1000,heroes:mods.heroes||99,cash:mods.cash||150};
  lines.push([d.seed,bonus,m.hp,m.heroes,m.cash,enc(acts)].join(' '));expect.push([r.ok?1:0,r.win?1:0,r.waves,r.lives,r.kills,r.cash,r.ticks].join(' '))}
const out=execFileSync(process.argv[2],{input:lines.join('\n')+'\n'}).toString().trim().split('\n');
let bad=0,wins=0;for(let i=0;i<expect.length;i++){const same=out[i]===expect[i]||(expect[i][0]==='0'&&out[i][0]==='0');if(!same){bad++;if(bad<5)console.log('MISMATCH',i,'js',expect[i],'rs',out[i])}if(expect[i].split(' ')[1]==='1')wins++}
console.log('games',expect.length,'wins',wins,'mismatches',bad);process.exit(bad?1:0)
