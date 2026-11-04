// A simple greedy player used for tests: it scores rooftop cells by how much street they cover.
const V=require('../../assets/fx/vaultsim.js');
function coverage(c,r,R){let n=0;for(let d=0;d<V.PATH_LEN;d+=600){const p=V.posAt(d),dx=p[0]-V.cellX(c),dz=p[1]-V.cellZ(r);if(dx*dx+dz*dz<=R*R)n++}return n}
function play(seed,bonus,opts={},mods){const g=V.create(seed,bonus,mods),S=g.S,acts=[];const doA=a=>{if(g.act(a))acts.push([S.tick,a])};
  const cells=[];for(let r=0;r<V.ROWS;r++)for(let c=0;c<V.COLS;c++)if(V.roofAt(c,r))cells.push([c,r]);
  const order=opts.order||[0,3,2,0,1,5,4,3,2,5];let oi=0;
  while(!S.over&&S.tick<120000){
    if(!S.inWave){
      // spend: upgrade cheapest first when rich, else place next hero at best free cell
      for(let guard=0;guard<40;guard++){const h=order[oi%order.length];const H=V.HERO[h];
        const free=cells.filter(([c,r])=>!S.towers.some(t=>t.c===c&&t.r===r)).map(([c,r])=>[coverage(c,r,H.range),c,r]).sort((a,b)=>b[0]-a[0]);
        const ups=S.towers.filter(t=>t.lv<2).sort((a,b)=>V.UPCOST[a.h][a.lv+1]-V.UPCOST[b.h][b.lv+1]);
        if(opts.upFirst&&S.towers.length>=opts.upFirst&&ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){doA(['up',ups[0].c,ups[0].r]);continue}
        if(free.length&&S.cash>=H.cost&&S.towers.length<(opts.max||30)){doA(['place',h,free[0][1],free[0][2]]);oi++;continue}
        if(ups.length&&S.cash>=V.UPCOST[ups[0].h][ups[0].lv+1]){doA(['up',ups[0].c,ups[0].r]);continue}
        break}
      if(S.wave>=V.WAVES)break;doA(['go'])}
    else g.step()}
  return{acts,res:{win:S.win,wave:S.wave,lives:S.lives,kills:S.kills,cash:S.cash,ticks:S.tick}}}
module.exports={play};
if(require.main===module){for(const o of[{},{upFirst:6},{upFirst:8,max:14},{max:10,upFirst:10}]){const t=Date.now();const r=play(20260,-1,o);const rp=V.replay(20260,-1,r.acts);console.log(JSON.stringify(o),JSON.stringify(r.res),'acts',r.acts.length,'replay',JSON.stringify(rp),Date.now()-t,'ms')}}
