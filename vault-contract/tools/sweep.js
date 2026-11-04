const V=require('../../assets/fx/vaultsim.js');
function playM(seed,mods,o){const g=V.create(seed,-1,mods),S=g.S;const cells=[];for(let r=0;r<V.ROWS;r++)for(let c=0;c<V.COLS;c++)if(V.roofAt(c,r))cells.push([c,r]);
  const cov=(c,r,R)=>{let n=0;for(let x=0;x<V.PATH_LEN;x+=600){const p=V.posAt(x),dx=p[0]-V.cellX(c),dz=p[1]-V.cellZ(r);if(dx*dx+dz*dz<=R*R)n++}return n};
  const order=o.order;let oi=0;
  while(!S.over&&S.tick<120000){if(!S.inWave){for(let k=0;k<40;k++){const h=order[oi%order.length],H=V.HERO[h];
      const free=cells.filter(([c,r])=>!S.towers.some(t=>t.c===c&&t.r===r)).map(([c,r])=>[cov(c,r,H.range),c,r]).sort((a,b)=>b[0]-a[0]);
      const ups=S.towers.filter(t=>t.lv<2).sort((a,b)=>V.UPCOST[a.h][a.lv+1]-V.UPCOST[b.h][b.lv+1]);
      if(o.up&&S.towers.length>=o.up&&ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){g.act(['up',ups[0].c,ups[0].r]);continue}
      if(free.length&&S.cash>=H.cost&&g.act(['place',h,free[0][1],free[0][2]])){oi++;continue}
      if(ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){g.act(['up',ups[0].c,ups[0].r]);continue}break}
      if(S.wave>=V.WAVES)break;g.act(['go'])}else g.step()}
  return S.win?S.lives:-S.wave}
const orders=[[0,3,2,5,1,4],[2,2,3,5,0,1],[5,3,2,0,4,1],[0,0,3,3,2,5],[1,3,5,2,0,4]];
for(const hp of [2200,2800,3400])for(const heroes of[5,6,8])for(const cash of[100,150]){const res=[];for(const order of orders)for(const up of[0,3,5]){res.push(playM(12345,{hp,heroes,cash},{order,up}))}
  res.sort((a,b)=>b-a);console.log(hp,heroes,cash,'best',res.slice(0,4).join(','),'median',res[res.length>>1])}
console.log('---');
for(const [hp,heroes,cash] of [[2000,8,150],[1800,6,150],[2200,10,150],[2000,7,150]])for(const seed of[1,99]){const res=[];for(const order of orders)for(const up of[0,3,5])res.push(playM(seed,{hp,heroes,cash},{order,up}));res.sort((a,b)=>b-a);console.log(hp,heroes,cash,seed,'best',res.slice(0,5).join(','),'median',res[res.length>>1])}
