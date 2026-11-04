const V=require('../../assets/fx/vaultsim.js'),{play}=require('./bot.js');
for(let day=20396;day<20402;day++){const d=V.daily(day);let best=null;
  for(const o of[{},{upFirst:6},{upFirst:4},{upFirst:3},{upFirst:5}]){const g=V.create(d.seed,-1,d.mods);const r=playM(d,o);if(!best||r.lives>best.lives||(r.win&&!best.win))best=r}
  console.log(day,d.name,'target',d.target,JSON.stringify(best))}
function playM(d,o){// bot with mods
  const g=V.create(d.seed,-1,d.mods),S=g.S;const cells=[];for(let r=0;r<V.ROWS;r++)for(let c=0;c<V.COLS;c++)if(V.roofAt(c,r))cells.push([c,r]);
  const cov=(c,r,R)=>{let n=0;for(let x=0;x<V.PATH_LEN;x+=600){const p=V.posAt(x),dx=p[0]-V.cellX(c),dz=p[1]-V.cellZ(r);if(dx*dx+dz*dz<=R*R)n++}return n};
  const order=[0,3,2,5,1,4,3,5,2,0];let oi=0;
  while(!S.over&&S.tick<120000){if(!S.inWave){for(let k=0;k<40;k++){const h=order[oi%order.length],H=V.HERO[h];
      const free=cells.filter(([c,r])=>!S.towers.some(t=>t.c===c&&t.r===r)).map(([c,r])=>[cov(c,r,H.range),c,r]).sort((a,b)=>b[0]-a[0]);
      const ups=S.towers.filter(t=>t.lv<2).sort((a,b)=>V.UPCOST[a.h][a.lv+1]-V.UPCOST[b.h][b.lv+1]);
      if(o.upFirst&&S.towers.length>=o.upFirst&&ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){g.act(['up',ups[0].c,ups[0].r]);continue}
      if(free.length&&S.cash>=H.cost&&g.act(['place',h,free[0][1],free[0][2]])){oi++;continue}
      if(ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){g.act(['up',ups[0].c,ups[0].r]);continue}break}
      if(S.wave>=V.WAVES)break;g.act(['go'])}else g.step()}
  return{o,win:S.win,wave:S.wave,lives:S.lives}}
