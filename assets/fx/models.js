/* toon helpers */
const gm=new T.DataTexture(new Uint8Array([110,110,110,255,185,185,185,255,255,255,255,255]),3,1,T.RGBAFormat);gm.minFilter=gm.magFilter=T.NearestFilter;gm.needsUpdate=true;
const toon=(c,o={})=>new T.MeshToonMaterial(Object.assign({color:c,gradientMap:gm},o));
const OUT=new T.MeshBasicMaterial({color:0x1d1038,side:T.BackSide});
const SPH=new T.SphereGeometry(1,22,16),CYL=new T.CylinderGeometry(1,1,1,16),CONE=new T.ConeGeometry(1,1,16),BOX=new T.BoxGeometry(1,1,1),TOR=new T.TorusGeometry(1,.3,8,20),GEM=new T.OctahedronGeometry(1);
function part(geo,mat,x,y,z,sx=1,sy=1,sz=1,outline=true){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);
  if(outline){const o=new T.Mesh(geo,OUT);o.scale.setScalar(1.08);m.add(o)}return m}

/* ---------- cape ---------- */
function makeCape(c1,L,Wd){const geo=new T.PlaneGeometry(1,1,8,8);const uv=geo.attributes.uv,pos=geo.attributes.position,n=pos.count;
  const mesh=new T.Mesh(geo,toon(c1,{side:T.DoubleSide}));mesh.frustumCulled=false;
  const edge=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x1d1038,side:T.BackSide}));edge.scale.setScalar(1.0);
  let flap=0,op=0;
  function update(t,speed,vy,dt=0.016,open=0){flap+= (speed-flap)*Math.min(1,dt*6);op+=(open-op)*Math.min(1,dt*7);
    const droop=Math.max(-.15,0.62-flap*0.55+Math.max(0,-vy)*-0.035+Math.max(0,vy)*0.02)*(1-op*0.85);
    for(let i=0;i<n;i++){const u=1-uv.getY(i),v=uv.getX(i)*2-1;
      const wave=Math.sin(t*(8+flap*8)-u*5+v*.6)*u*(0.05+flap*0.12);
      const along=u*L*(1-op*0.2);let x=-along,y=-along*0.12-droop*u*u+wave*(1+op)+op*u*(0.3-v*v*0.22);const z=v*Wd*0.5*(1+u*0.3)*(1+op*1.25);
      y-=v*v*0.36*(1-u*0.25)*(1-op*0.9);x+=v*v*0.04;pos.setXYZ(i,x,y,z)}
    pos.needsUpdate=true;geo.computeVertexNormals()}
  update(0,0,0);return{mesh,update}}

/* ---------- dogs ---------- */
function legSet(body,mat,paw,spots,hip,len){const legs=[];for(const[lx,lz] of spots){const L=new T.Group();L.position.set(lx,hip,lz);
  L.add(part(CYL,mat,0,-len/2,0,0.1,len,0.1));L.add(part(SPH,paw,0.03,-len,0,0.12,0.08,0.12));body.add(L);legs.push(L)}return legs}
function makeCorgi(){const g=new T.Group(),body=new T.Group();g.add(body);
  const O=toon(0xe8913f),Od=toon(0xc8702a),Wh=toon(0xfff3e2),Bk=toon(0x1a1420),Pk=toon(0xf4a3ae),Tg=toon(0xff6f8a),Gd=toon(0xffc93c),Br=toon(0x6b3a1c),MK=toon(0x111016),SH=new T.MeshBasicMaterial({color:0xffffff});
  // torso: deep chest, long back, round rear
  body.add(part(SPH,O,0.12,0.62,0,0.5,0.38,0.4));
  body.add(part(SPH,O,-0.38,0.64,0,0.4,0.36,0.38));
  body.add(part(SPH,Wh,0.06,0.42,0,0.48,0.2,0.3,false));                     // belly
  for(const[x,y,z,r] of[[0.4,0.66,0,.26],[0.46,0.52,0.1,.17],[0.46,0.52,-0.1,.17],[0.52,0.78,0,.18],[0.36,0.46,0,.18]])body.add(part(SPH,Wh,x,y,z,r,r,r*.9,false)); // fluffy chest
  for(const s of[-1,1])body.add(part(SPH,Wh,-0.58,0.58,s*0.16,0.17,0.2,0.14,false)); // white "corgi butt" patches
  // tail: fluffy stub with a white tip
  const tail=new T.Group();tail.position.set(-0.74,0.78,0);body.add(tail);
  tail.add(part(SPH,O,-0.06,0.03,0,0.14,0.12,0.12));tail.add(part(SPH,Wh,-0.16,0.06,0,0.08,0.07,0.07,false));
  // short sturdy legs with toes
  const legs=[];for(const[lx,lz,back] of[[0.36,0.2,0],[0.36,-0.2,0],[-0.42,0.21,1],[-0.42,-0.21,1]]){const L=new T.Group();L.position.set(lx,0.36,lz);
    L.add(part(SPH,back?O:Wh,0,-0.02,0,0.15,0.16,0.14));
    L.add(part(CYL,back?O:Wh,0,-0.17,0,0.11,0.22,0.11));
    L.add(part(SPH,Wh,0.04,-0.3,0,0.13,0.08,0.13));
    for(const tz of[-0.06,0,0.06])L.add(part(SPH,Wh,0.15,-0.31,tz,0.035,0.035,0.035,false));
    body.add(L);legs.push(L)}
  // head
  const head=new T.Group();head.position.set(0.68,1.02,0);body.add(head);
  head.add(part(SPH,O,0,0.02,0,0.36,0.33,0.35));
  for(const s of[-1,1])head.add(part(SPH,Wh,0.16,-0.1,s*0.2,0.17,0.15,0.14,false));  // fluffy cheeks
  head.add(part(SPH,Wh,0.3,-0.1,0,0.22,0.14,0.19));                                  // muzzle
  head.add(part(SPH,Wh,0.22,0.12,0,0.07,0.2,0.05,false));                            // white blaze
  const nose=part(SPH,Bk,0.5,-0.04,0,0.075,0.058,0.08,false);head.add(nose);
  head.add(part(SPH,SH,0.54,-0.01,0.03,0.018,0.014,0.018,false));                   // shiny nose
  const smile=new T.Mesh(new T.TorusGeometry(0.09,0.012,6,16,Math.PI),Bk);smile.rotation.set(0,Math.PI/2,Math.PI);smile.position.set(0.47,-0.15,0);head.add(smile);
  const tongue=part(SPH,Tg,0.47,-0.22,0,0.045,0.06,0.05,false);head.add(tongue);
  // hero mask: two cups around the eyes joined by a bridge, with points swept back
  for(const s of[-1,1]){const cup=part(SPH,MK,0.235,0.115,s*0.165,0.1,0.115,0.125,false);cup.rotation.y=s*-0.45;head.add(cup);
    const tip=part(CONE,MK,0.1,0.17,s*0.29,0.055,0.2,0.035,false);tip.rotation.set(s*1.25,0,-0.9);head.add(tip)}
  head.add(part(BOX,MK,0.31,0.135,0,0.06,0.07,0.17,false));
  // eyes: white, brown iris, pupil, two highlights
  for(const s of[-1,1]){const e=new T.Group();e.position.set(0.275,0.115,s*0.175);e.rotation.y=s*-0.45;head.add(e);
    e.add(part(SPH,Wh,0,0,0,0.07,0.08,0.05,false));
    e.add(part(SPH,Br,0.03,0,0,0.047,0.055,0.03,false));
    e.add(part(SPH,Bk,0.047,0,0,0.028,0.034,0.02,false));
    e.add(part(SPH,SH,0.062,0.022,0,0.013,0.013,0.008,false));
    e.add(part(SPH,SH,0.06,-0.016,0,0.007,0.007,0.005,false))}
  // big corgi ears with a fluffy inside
  for(const s of[-1,1]){const ear=new T.Group();ear.position.set(-0.05,0.3,s*0.16);ear.rotation.x=s*-0.3;head.add(ear);
    ear.add(part(CONE,O,0,0.12,0,0.16,0.4,0.11));
    const inn=part(CONE,Pk,0.06,0.09,0,0.09,0.27,0.05,false);ear.add(inn);
    ear.add(part(SPH,Wh,0.07,-0.02,0,0.06,0.07,0.04,false));
  }
  // golden collar, clasp and cape
  const collar=part(TOR,Gd,0.47,0.84,0,0.27,0.27,0.27,false);collar.rotation.y=Math.PI/2;collar.rotation.x=0.3;body.add(collar);
  const cape=makeCape(0x25212d,1.2,1.02);cape.mesh.position.set(0.42,1.06,0);body.add(cape.mesh);
  const clasp=new T.Mesh(new T.CylinderGeometry(0.085,0.085,0.035,20),Gd);clasp.rotation.z=Math.PI/2;clasp.position.set(0.66,0.88,0);body.add(clasp);
  const gem=part(SPH,new T.MeshBasicMaterial({color:0xfff1a8}),0.685,0.88,0,0.035,0.035,0.035,false);body.add(gem);
  return{g,body,legs,cape,head,mask:MK,h:1.12}}
/* shared detail helpers for the hero models */
const HL_M=new T.MeshBasicMaterial({color:0xffffff});
function heroEye(parent,x,y,z,ry,sz,irisCol){const e=new T.Group();e.position.set(x,y,z);e.rotation.y=ry;parent.add(e);
  e.add(part(SPH,toon(0xfff8ee),0,0,0,0.07*sz,0.08*sz,0.05*sz,false));
  e.add(part(SPH,toon(irisCol),0.03*sz,0,0,0.047*sz,0.055*sz,0.03*sz,false));
  e.add(part(SPH,toon(0x14101c),0.047*sz,0,0,0.028*sz,0.034*sz,0.02*sz,false));
  e.add(part(SPH,HL_M,0.062*sz,0.022*sz,0,0.013*sz,0.013*sz,0.008*sz,false));
  e.add(part(SPH,HL_M,0.06*sz,-0.016*sz,0,0.007*sz,0.007*sz,0.005*sz,false));return e}
function heroPaw(L,mat,toe,x,y,sx){L.add(part(SPH,mat,x,y,0,0.13*sx,0.08,0.13*sx));for(const tz of[-0.06,0,0.06])L.add(part(SPH,toe||mat,x+0.11*sx,y-0.01,tz*sx,0.035,0.035,0.035,false))}
function heroClasp(body,x,y,z){const c=new T.Mesh(new T.CylinderGeometry(0.085,0.085,0.035,20),toon(0xffc93c));c.rotation.z=Math.PI/2;c.position.set(x,y,z);body.add(c);
  body.add(part(SPH,new T.MeshBasicMaterial({color:0xfff1a8}),x+0.025,y,z,0.035,0.035,0.035,false))}

function makeBeagle(){const g=new T.Group(),body=new T.Group();g.add(body);
  const Tn=toon(0xc97a38),Bl=toon(0x2b2335),Wh=toon(0xfff3e2),Bk=toon(0x1a1420),Er=toon(0x8a4a22),Erd=toon(0x6a3418),Tg=toon(0xff6f8a),YM=toon(0xffd21f);
  // body: tan with the classic black saddle and white chest
  body.add(part(SPH,Tn,0.06,0.95,0,0.6,0.37,0.37));
  body.add(part(SPH,Bl,-0.12,1.07,0,0.48,0.26,0.385,false));
  body.add(part(SPH,Wh,0.2,0.82,0,0.42,0.24,0.31,false));
  for(const[x,y,z,r] of[[0.48,1.0,0,.2],[0.52,0.86,0.1,.15],[0.52,0.86,-0.1,.15]])body.add(part(SPH,Wh,x,y,z,r,r,r*.9,false));
  // longer legs with white socks and toes
  const legs=[];for(const[lx,lz] of[[0.36,0.2],[0.36,-0.2],[-0.36,0.2],[-0.36,-0.2]]){const L=new T.Group();L.position.set(lx,0.68,lz);
    L.add(part(SPH,Tn,0,-0.02,0,0.13,0.15,0.12));L.add(part(CYL,Tn,0,-0.22,0,0.09,0.32,0.09));L.add(part(CYL,Wh,0,-0.46,0,0.095,0.2,0.095));
    heroPaw(L,Wh,Wh,0.03,-0.58,1);body.add(L);legs.push(L)}
  // happy upright tail with a white tip
  const tail=new T.Group();tail.position.set(-0.58,1.12,0);tail.rotation.z=0.55;body.add(tail);
  tail.add(part(CYL,Tn,0,0.22,0,0.07,0.44,0.07));tail.add(part(SPH,Wh,0,0.5,0,0.1,0.13,0.1));
  // head
  const head=new T.Group();head.position.set(0.66,1.42,0);body.add(head);
  head.add(part(SPH,Tn,0,0.01,0,0.33,0.31,0.31));
  head.add(part(SPH,Wh,0.3,-0.11,0,0.24,0.15,0.18));
  head.add(part(SPH,Wh,0.2,0.08,0,0.13,0.21,0.065,false));
  for(const s of[-1,1])for(const[dy,dz] of[[-0.06,0.07],[-0.1,0.1],[-0.08,0.13]])head.add(part(SPH,toon(0xd9b9a0),0.43,dy,s*dz,0.012,0.012,0.012,false)); // freckles
  head.add(part(SPH,Bk,0.53,-0.07,0,0.078,0.062,0.078,false));head.add(part(SPH,HL_M,0.575,-0.04,0.03,0.018,0.014,0.018,false));
  const smile=new T.Mesh(new T.TorusGeometry(0.08,0.012,6,16,Math.PI),Bk);smile.rotation.set(0,Math.PI/2,Math.PI);smile.position.set(0.47,-0.17,0);head.add(smile);
  head.add(part(SPH,Tg,0.47,-0.23,0,0.04,0.055,0.045,false));
  // yellow mask: cups + bridge, softly rounded tips
  for(const s of[-1,1]){const cup=part(SPH,YM,0.225,0.075,s*0.165,0.1,0.11,0.125,false);cup.rotation.y=s*-0.45;head.add(cup);
    const tip=part(SPH,YM,0.12,0.1,s*0.27,0.09,0.05,0.05,false);tip.rotation.z=0.4;head.add(tip)}
  head.add(part(BOX,YM,0.3,0.09,0,0.06,0.065,0.17,false));
  for(const s of[-1,1])heroEye(head,0.268,0.075,s*0.175,s*-0.45,1,0x6b3a1c);
  // long droopy ears with darker tips
  for(const s of[-1,1]){const ear=new T.Group();ear.position.set(-0.02,0.08,s*0.29);ear.rotation.x=s*0.16;head.add(ear);
    ear.add(part(SPH,Er,0,-0.18,0,0.15,0.3,0.07));ear.add(part(SPH,Erd,0,-0.4,0,0.11,0.1,0.06,false))}
  const cape=makeCape(0x1f8a45,1.15,0.98);cape.mesh.position.set(0.38,1.36,0);body.add(cape.mesh);
  const collar=part(TOR,toon(0xffc93c),0.46,1.2,0,0.25,0.25,0.25,false);collar.rotation.y=Math.PI/2;collar.rotation.x=0.35;body.add(collar);
  heroClasp(body,0.64,1.24,0);
  return{g,body,legs,cape,head,tail,mask:YM,h:1.62}}

function makeOwl(){const g=new T.Group(),body=new T.Group();g.add(body);
  const B=toon(0x8a5a34),Bd=toon(0x5e3a1e),Bl=toon(0xe9d2a6),Bl2=toon(0xc49a62),F=toon(0xf0dcb4),Ey=toon(0xffa51f),Bk=toon(0x1a1420),Bq=toon(0xffc93c),Ft=toon(0xf2a531);
  body.add(part(SPH,B,0,0.64,0,0.46,0.55,0.44));
  body.add(part(SPH,Bl,0.17,0.56,0,0.32,0.42,0.34));
  // scalloped chest feathers
  for(const[y,zs] of[[0.78,[-0.12,0,0.12]],[0.62,[-0.18,-0.06,0.06,0.18]],[0.46,[-0.14,0,0.14]],[0.32,[-0.07,0.07]]])
    for(const z of zs){const f=part(SPH,Bl2,0.44-Math.abs(z)*0.5,y,z,0.035,0.07,0.07,false);f.rotation.x=0;body.add(f);body.add(part(SPH,Bd,0.455-Math.abs(z)*0.5,y-0.05,z,0.018,0.018,0.045,false))}
  const tl=part(CONE,Bd,-0.46,0.3,0,0.13,0.32,0.15);tl.rotation.z=1.1;body.add(tl);
  // feet with three talons
  const legs=[];for(const z of[0.15,-0.15]){const L=new T.Group();L.position.set(0.12,0.12,z);
    L.add(part(SPH,Ft,0.04,-0.05,0,0.11,0.05,0.08,false));
    for(const tz of[-0.06,0,0.06]){const t=part(CONE,Ft,0.16,-0.07,tz,0.03,0.12,0.03,false);t.rotation.z=-1.57;L.add(t)}
    body.add(L);legs.push(L)}
  // layered wings
  const wings=[];for(const s of[-1,1]){const w=new T.Group();w.position.set(-0.02,0.95,s*0.42);
    w.add(part(SPH,Bd,-0.06,-0.27,0,0.22,0.42,0.08));
    for(const[dy,dx] of[[-0.55,-0.1],[-0.6,0.02],[-0.52,-0.2]]){const f=part(SPH,B,dx,dy,s*0.02,0.07,0.16,0.05,false);w.add(f)}
    body.add(w);wings.push(w)}
  // head: big facial discs, framed eyes, brow tufts
  const head=new T.Group();head.position.set(0.05,1.2,0);body.add(head);
  head.add(part(SPH,B,0,0,0,0.4,0.36,0.4));
  for(const s of[-1,1]){const disc=part(SPH,F,0.25,0,s*0.16,0.13,0.21,0.19,false);head.add(disc);
    const rim=part(TOR,Bd,0.33,0.02,s*0.18,0.1,0.1,0.1,false);rim.rotation.y=Math.PI/2;head.add(rim);
    const e=new T.Group();e.position.set(0.34,0.02,s*0.18);head.add(e);
    e.add(part(SPH,Ey,0,0,0,0.04,0.095,0.095,false));e.add(part(SPH,Bk,0.03,0,0,0.02,0.055,0.055,false));
    e.add(part(SPH,HL_M,0.045,0.03,s*0.025,0.01,0.018,0.018,false));e.add(part(SPH,HL_M,0.045,-0.025,s*-0.02,0.006,0.01,0.01,false));
    const brow=part(SPH,Bd,0.3,0.14,s*0.16,0.05,0.03,0.12,false);brow.rotation.x=s*0.35;head.add(brow);
    const tf=part(CONE,B,-0.04,0.38,s*0.2,0.08,0.26,0.06);tf.rotation.x=s*-0.45;head.add(tf);
    const tf2=part(CONE,Bd,-0.1,0.33,s*0.25,0.05,0.18,0.04,false);tf2.rotation.x=s*-0.7;head.add(tf2)}
  const bk=part(CONE,Bq,0.42,-0.1,0,0.06,0.16,0.06,false);bk.rotation.z=-2.3;head.add(bk);
  const bk2=part(CONE,toon(0xd99a1c),0.4,-0.15,0,0.04,0.08,0.04,false);bk2.rotation.z=-2.0;head.add(bk2);
  const cape=makeCape(0x5a3a9a,0.95,0.9);cape.mesh.position.set(0.15,1.04,0);body.add(cape.mesh);
  heroClasp(body,0.38,0.95,0);
  return{g,body,legs,cape,head,wings,mask:F,h:1.45}}

function makeTrey(){const g=new T.Group(),body=new T.Group();g.add(body);const inner=new T.Group();inner.scale.setScalar(.55);inner.position.y=1.35*.55;body.add(inner);
  const GR=toon(0x2fd162),HI=toon(0x8af5a8),GD=toon(0xffc93c),W=toon(0xffffff),K=toon(0x10141a),SH=toon(0xff5a3c),PK=toon(0xff7a8a);
  const S=1.05,pts=[];
  for(let a=160;a>=-90;a-=10){const r=a*Math.PI/180;pts.push(new T.Vector3(.48*Math.cos(r)*S,(.62+.48*Math.sin(r))*S,0))}
  for(let a=90;a>=-160;a-=10){const r=a*Math.PI/180;pts.push(new T.Vector3(.56*Math.cos(r)*S,(-.42+.52*Math.sin(r))*S,0))}
  const curve=new T.CatmullRomCurve3(pts,false,'catmullrom',.4),R=.3;
  inner.add(new T.Mesh(new T.TubeGeometry(curve,160,R,18,false),GR));
  inner.add(new T.Mesh(new T.TubeGeometry(curve,160,R+.05,18,false),OUT));
  const sh=curve.getPoints(100).map(q=>new T.Vector3(q.x*.98,q.y*.98+.02,R*.86));
  inner.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sh),120,.045,6,false),HI));
  for(const q of[pts[0],pts[pts.length-1]])inner.add(part(SPH,GR,q.x,q.y,0,R,R,R));
  const head=new T.Group();head.position.set(.25*S,1.03*S,R*.72);head.rotation.z=-.5;inner.add(head);
  head.add(part(BOX,GD,0,.02,.06,.62,.2,.08));
  const eyes=[];for(const sd of[-1,1]){const e=new T.Group();e.position.set(sd*.15,.03,.13);
    e.add(part(SPH,W,0,0,0,.1,.12,.06,false));e.add(part(SPH,K,.01,0,.05,.05,.065,.03,false));e.add(part(SPH,W,.03,.04,.075,.016,.02,.01,false));head.add(e);eyes.push(e)}
  for(const sd of[-1,1]){const b=part(BOX,K,sd*.15,.2,.1,.15,.035,.03,false);b.rotation.z=sd*-.18;head.add(b)}
  const mouth=new T.Mesh(new T.TorusGeometry(.13,.03,8,20,Math.PI),K);mouth.rotation.z=Math.PI;mouth.rotation.y=.35;mouth.position.set(.47*S,-.73*S,R*.92);inner.add(mouth);
  const limb=(x,y,len)=>{const q=new T.Group();q.position.set(x,y,0);q.add(part(CYL,GR,0,-len/2,0,.07,len,.07));return q};
  const armL=limb(-.05*S,.12*S,.55);armL.rotation.z=-1.9;armL.add(part(SPH,W,0,-.6,0,.16,.15,.15));inner.add(armL);
  const armR=limb(.6*S,.58*S,.5);armR.rotation.z=1.7;armR.add(part(SPH,W,0,-.56,0,.16,.15,.15));inner.add(armR);
  const legs=[];for(const x of[-.22,.22]){const L=new T.Group();L.position.set(x*S,-.86*S,0);L.add(part(CYL,GR,0,-.12,0,.08,.26,.08));
    L.add(part(SPH,SH,.05,-.3,0,.18,.11,.14));L.add(part(SPH,W,.05,-.38,0,.17,.03,.13,false));inner.add(L);legs.push(L)}
  // detail pass: second eye glint, gloves with thumbs and cuffs, laces, tongue
  for(const e of eyes)e.add(part(SPH,HL_M,-.025,-.035,.075,.011,.013,.006,false));
  for(const[A,y] of[[armL,-.6],[armR,-.56]]){A.add(part(CYL,W,0,y+.13,0,.1,.07,.1));A.add(part(SPH,W,.11,y+.06,.05,.07,.065,.065))}
  for(const L of legs){for(const dy of[-.24,-.28])L.add(part(BOX,W,.07,dy,.11,.12,.018,.02,false));L.add(part(SPH,W,.17,-.27,0,.05,.04,.06,false))}
  inner.add(part(SPH,PK,.45*S,-.8*S,R*.93,.07,.045,.03,false));
  return{g,body,legs,head,arms:[armL,armR],eyes,mask:GD,bodyMat:GR,h:1.55,faceCam:true}}

const SEAM_G=new T.TorusGeometry(1,.04,6,32),RIM_G=new T.TorusGeometry(1,.12,8,36);
function makeBaller(){const g=new T.Group(),body=new T.Group();g.add(body);const inn=new T.Group();inn.scale.setScalar(.65);body.add(inn);
  const BK=toon(0x1e1b24),WH=toon(0xffffff),OR=toon(0xff7a1a),BQ=toon(0xffa51f),K=new T.MeshBasicMaterial({color:0x111016}),GR=toon(0x3a3644);
  const add=m=>{inn.add(m);return m};
  add(part(SPH,BK,0,1.05,0,.62,.95,.58));add(part(SPH,WH,0,1.3,.26,.44,.48,.34));
  for(const sd of[-1,1]){const t=add(part(CONE,BK,sd*.33,1.98,0,.13,.44,.13));t.rotation.z=sd*-.35;t.add(part(CONE,WH,0,.32,0,.5,.3,.5,false))}
  const eyes=[];for(const sd of[-1,1]){const e=new T.Group();e.position.set(sd*.17,1.42,.57);inn.add(e);e.add(part(SPH,K,0,0,0,.06,.07,.04,false));e.add(part(SPH,WH,.02,.025,.025,.016,.016,.01,false));eyes.push(e)}
  const bk=add(part(CONE,BQ,0,1.27,.66,.07,.17,.05));bk.rotation.x=Math.PI*.62;
  for(const sd of[-1,1])add(part(SPH,WH,sd*.24,.74,.56,.11,.1,.1));
  const legs=[];for(const sd of[-1,1])legs.push(add(part(SPH,GR,sd*.22,.07,.12,.18,.08,.2)));
  const ball=new T.Group();ball.position.set(0,.66,.74);inn.add(ball);ball.add(part(SPH,OR,0,0,0,.3,.3,.3));
  for(const[rx,ry] of[[0,0],[Math.PI/2,0],[0,Math.PI/2]]){const r=new T.Mesh(SEAM_G,K);r.scale.setScalar(.302);r.rotation.set(rx,ry,0);ball.add(r)}
  // detail pass: brows, eye glints, wing tips hugging the ball, toes, chest feathers
  for(const sd of[-1,1]){const b=add(part(BOX,BK,sd*.17,1.55,.6,.15,.035,.03,false));b.rotation.z=sd*.25}
  for(const e of eyes)e.add(part(SPH,WH,-.015,-.02,.03,.008,.008,.005,false));
  for(const sd of[-1,1]){const w=add(part(SPH,BK,sd*.43,.78,.5,.11,.24,.1));w.rotation.z=sd*.5;add(part(SPH,GR,sd*.36,.6,.66,.06,.08,.06,false))}
  for(const sd of[-1,1])for(const tx of[-.07,0,.07])add(part(SPH,GR,sd*.22+tx,.06,.3,.045,.04,.05,false));
  for(const[x,y] of[[-.12,1.1],[.12,1.1],[0,1.0],[-.08,.92],[.08,.92]])add(part(SPH,toon(0xd9d4e6),x,y,.6,.035,.02,.012,false));
  return{g,body,legs,head:new T.Group(),eyes,ball,mask:OR,bodyMat:BK,h:1.45,faceCam:true}}
function makeFrazzle(){const g=new T.Group(),body=new T.Group();g.add(body);const inn=new T.Group();inn.scale.setScalar(.62);body.add(inn);
  const WH=toon(0xffffff),OR=toon(0xff8a2a),RD=toon(0xd8343a),RIM=new T.MeshBasicMaterial({color:0x111016}),K=new T.MeshBasicMaterial({color:0x111016}),FT=toon(0xffa51f);
  const add=m=>{inn.add(m);return m};
  add(part(SPH,WH,0,1.05,0,.78,.82,.7));
  const N=40,ga=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<N;i++){const y=1-(i/(N-1))*2,r=Math.sqrt(1-y*y),th=ga*i,x=Math.cos(th)*r,z=Math.sin(th)*r;if(z>.55&&y>-.3)continue;
    const sz=.17+((Math.sin(i*12.9898)*43758.5453)%1+1)%1*.09;add(part(SPH,WH,x*.78,1.05+y*.82,z*.7,sz,sz,sz))}
  for(const[x,y] of[[-.1,1.9],[.08,1.93],[.22,1.86]])add(part(SPH,WH,x,y,0,.13,.17,.13));
  const eyes=[];for(const sd of[-1,1]){const e=new T.Group();e.position.set(sd*.27,1.22,.6);inn.add(e);
    e.add(part(SPH,WH,0,0,0,.25,.27,.12,false));const rm=new T.Mesh(RIM_G,RIM);rm.scale.set(.27,.29,.27);rm.position.z=.06;e.add(rm);
    e.add(part(SPH,K,sd*-.03,-.02,.11,.055,.06,.03,false));eyes.push(e)}
  add(part(SPH,RD,0,.8,.62,.17,.15,.08));
  const top=add(part(CONE,OR,0,.95,.72,.13,.2,.07));top.rotation.x=Math.PI*.9;
  const low=add(part(CONE,OR,0,.64,.68,.1,.12,.05));low.rotation.x=Math.PI*.1;
  for(const sd of[-1,1])add(part(SPH,WH,sd*.55,.42,.42,.13,.15,.12));
  const legs=[];for(const sd of[-1,1])legs.push(add(part(SPH,FT,sd*.24,.08,.18,.17,.07,.2)));
  // detail pass: blush, eye glints, lashes, toes
  for(const sd of[-1,1])add(part(SPH,toon(0xffb3c7),sd*.52,.98,.52,.11,.06,.04,false));
  for(const e of eyes){const sd=e.position.x>0?1:-1;e.add(part(SPH,WH,sd*-.045,.0,.135,.016,.018,.008,false));
    for(const k of[-1,0,1]){const l=part(BOX,K,k*.08,.31,.06,.018,.07,.01,false);l.rotation.z=k*-.35;e.add(l)}}
  for(const sd of[-1,1])for(const tx of[-.08,0,.08])add(part(SPH,FT,sd*.24+tx,.06,.36,.05,.045,.06,false));
  return{g,body,legs,head:new T.Group(),eyes,mask:RIM,bodyMat:WH,h:1.3,faceCam:true,fluffy:true}}

function makeIlia(){const g=new T.Group(),body=new T.Group();g.add(body);
  const SK=toon(0xf2c4a8),HR=toon(0x6b4a2e),HRL=toon(0x8a6342),TEE=toon(0x1c1c22),JN=toon(0x2a3550),SH=toon(0xf4f1ea),K=toon(0x14111b),W=toon(0xffffff),IR=toon(0x6f8a9a);
  const legs=[];for(const z of[.12,-.12]){const L=new T.Group();L.position.set(0,.4,z);L.add(part(CYL,JN,0,-.15,0,.1,.3,.1));L.add(part(SPH,SH,.05,-.33,0,.14,.07,.1));body.add(L);legs.push(L)}
  body.add(part(SPH,JN,0,.42,0,.22,.1,.2,false));
  body.add(part(SPH,TEE,0,.66,0,.3,.33,.25));
  body.add(part(CYL,SK,0,.98,0,.08,.1,.08,false));
  const arms=[];for(const z of[.31,-.31]){const A=new T.Group();A.position.set(0,.86,z);A.add(part(SPH,TEE,0,-.06,0,.11,.13,.11));
    A.add(part(CYL,SK,0,-.25,0,.065,.26,.065));A.add(part(SPH,SK,0,-.42,0,.08,.08,.08));body.add(A);arms.push(A)}
  const head=new T.Group();head.position.set(.02,1.28,0);body.add(head);
  head.add(part(SPH,SK,0,0,0,.4,.42,.38));
  for(const z of[.37,-.37])head.add(part(SPH,SK,-.02,-.02,z,.07,.1,.05,false));
  head.add(part(SPH,HR,-.05,.13,0,.42,.34,.4));
  const quiff=part(SPH,HRL,.2,.3,.03,.2,.13,.3);quiff.rotation.z=-.35;head.add(quiff);
  head.add(part(SPH,HR,-.2,-.02,0,.3,.34,.37,false));
  const eyes=[];for(const z of[.13,-.13]){const e=new T.Group();e.position.set(.35,.04,z);head.add(e);
    e.add(part(SPH,W,0,0,0,.03,.06,.07,false));e.add(part(SPH,IR,.02,0,0,.02,.04,.04,false));e.add(part(SPH,K,.03,0,0,.012,.022,.022,false));eyes.push(e);
    const br=part(BOX,HR,.36,.14,z,.03,.025,.11,false);br.rotation.x=z>0?-.12:.12;head.add(br)}
  head.add(part(SPH,SK,.4,-.04,0,.05,.05,.045,false));
  const sm=new T.Mesh(new T.TorusGeometry(.08,.014,6,16,Math.PI),K);sm.rotation.y=Math.PI/2;sm.rotation.x=Math.PI;sm.position.set(.37,-.15,0);head.add(sm);
  const cape=makeCape(0x1f6f8a,.95,.8);cape.mesh.position.set(-.06,.94,0);body.add(cape.mesh);
  // detail pass: eye glints, extra quiff strands, belt, cuffs, laces, hands, golden clasp
  for(const e of eyes)e.add(part(SPH,HL_M,.035,.015,0,.006,.012,.012,false));
  for(const[x,y,z,r] of[[.28,.34,-.08,.12],[.12,.36,.12,.12]]){const q=part(SPH,HRL,x,y,z,r*1.3,r*.6,r);q.rotation.z=-.4;head.add(q)}
  body.add(part(CYL,toon(0x3a2a1c),0,.5,0,.24,.05,.21,false));body.add(part(BOX,toon(0xffc93c),.22,.5,0,.03,.05,.07,false));
  for(const L of legs){L.add(part(BOX,K,.05,-.37,0,.28,.025,.2,false));L.add(part(BOX,toon(0x9aa2b8),.12,-.3,0,.02,.05,.08,false))}
  for(const A of arms){A.add(part(CYL,TEE,0,-.14,0,.085,.06,.085,false));A.add(part(SPH,SK,.05,-.43,0,.04,.04,.04,false))}
  heroClasp(body,.27,.9,0);
  return{g,body,legs,head,cape,eyes,limbs:arms,mask:TEE,h:1.62}}

function makeSpud(){const g=new T.Group(),body=new T.Group();g.add(body);const inn=new T.Group();inn.scale.setScalar(.62);body.add(inn);
  const P=toon(0xe6b84a),PD=toon(0x9a6a2a),BR=toon(0x8a4f12),W=toon(0xffffff),RIMM=new T.MeshBasicMaterial({color:0x111016}),K=new T.MeshBasicMaterial({color:0x111016}),GY=toon(0x8a8a8a);
  inn.add(part(SPH,P,0,1.2,0,.62,.82,.55));
  for(let i=0;i<28;i++){const a=(i*2.399)%6.283,yy=((i*.618)%1)*1.4-.7;const r=Math.sqrt(Math.max(0,1-yy*yy));const x=Math.cos(a)*r,z=Math.sin(a)*r;if(z<-.2)continue;
    inn.add(part(SPH,PD,x*.62,1.2+yy*.82,z*.55,.022,.022,.014,false))}
  inn.add(part(SPH,PD,-.24,.95,.47,.13,.035,.04,false));inn.add(part(SPH,PD,.08,.45,.42,.12,.03,.04,false));
  const eyes=[];for(const sd of[-1,1]){const e=new T.Group();e.position.set(sd*.22,1.44,.45);inn.add(e);
    e.add(part(SPH,W,0,0,0,.2,.21,.1,false));const rm=new T.Mesh(RIM_G,RIMM);rm.scale.set(.2,.21,.2);rm.position.z=.05;e.add(rm);
    e.add(part(SPH,GY,0,.02,.09,.075,.08,.03,false));eyes.push(e);
    const br=part(BOX,K,sd*.22,1.74,.44,.2,.035,.03,false);br.rotation.z=-sd*.28;inn.add(br)}
  const fr=new T.Mesh(new T.TorusGeometry(.08,.016,6,16,Math.PI),K);fr.position.set(0,1.07,.54);inn.add(fr);
  const arms=[];for(const sd of[-1,1]){const A=new T.Group();A.position.set(sd*.56,1.2,.12);A.add(part(CYL,BR,0,-.2,0,.06,.42,.06));A.add(part(SPH,BR,0,-.44,.03,.095,.09,.09));inn.add(A);arms.push(A)}
  const legs=[];for(const sd of[-1,1]){const L=new T.Group();L.position.set(sd*.22,.48,0);
    const th=part(CYL,BR,sd*.06,-.12,0,.055,.27,.055);th.rotation.z=sd*.45;L.add(th);
    const sh=part(CYL,BR,sd*.1,-.34,0,.055,.24,.055);sh.rotation.z=-sd*.3;L.add(sh);
    L.add(part(SPH,BR,sd*.15,-.46,.07,.1,.05,.14));inn.add(L);legs.push(L)}
  // detail pass: eye glints, worried sweat drop, three-finger hands, toes
  for(const e of eyes)e.add(part(SPH,HL_M,.025,.05,.12,.022,.024,.01,false));
  inn.add(part(SPH,toon(0x8fd8ff),.5,1.66,.36,.05,.08,.04,false));inn.add(part(SPH,HL_M,.51,1.68,.4,.012,.02,.01,false));
  for(const A of arms)for(const k of[-1,0,1])A.add(part(SPH,BR,k*.05,-.53,.05,.03,.05,.03,false));
  for(const L of legs){const sd=L.position.x>0?1:-1;for(const tz of[-.06,0,.06])L.add(part(SPH,BR,sd*.15,-.47,.17+tz*.3,.035,.03,.035,false))}
  return{g,body,legs,head:new T.Group(),eyes,limbs:arms,mask:RIMM,bodyMat:P,h:1.35,faceCam:true}}

const GLOW_TEX=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,2,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c)})();
function makePlop(){const g=new T.Group(),body=new T.Group();g.add(body);const inn=new T.Group();inn.scale.setScalar(1.05);body.add(inn);
  const DARK=toon(0x12101e),NF=new T.MeshBasicMaterial({color:0x7dffb8}),NB=new T.MeshBasicMaterial({color:0x7dffb8,side:T.BackSide});NB.color=NF.color;
  const LAU=new T.MeshBasicMaterial({color:0x7dffb8});
  const neon=(geo,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(geo,DARK);m.position.set(x,y,z);m.scale.set(sx,sy,sz);const o=new T.Mesh(geo,NB);o.scale.setScalar(1.09);m.add(o);inn.add(m);return m};
  neon(SPH,0,.32,0,.6,.26,.58);neon(SPH,0,.62,0,.46,.23,.44);neon(SPH,0,.88,0,.31,.18,.3);
  const tip=neon(CONE,.03,1.1,0,.15,.3,.15);tip.rotation.z=-.35;
  for(const[y,r] of[[.47,.5],[.77,.36]]){const t=new T.Mesh(TOR,NF);t.rotation.x=Math.PI/2;t.position.y=y;t.scale.set(r,r,r*1.4);inn.add(t)}
  const eyes=[];for(const sd of[-1,1]){const e=new T.Group();e.position.set(sd*.13,.66,.41);inn.add(e);
    const w=new T.Mesh(SPH,DARK);w.scale.set(.075,.08,.04);e.add(w);const rim=new T.Mesh(TOR,NF);rim.scale.set(.08,.085,.08);rim.position.z=.01;e.add(rim);
    const p=new T.Mesh(SPH,NF);p.scale.set(.03,.033,.02);p.position.set(sd*-.01,-.01,.035);e.add(p);eyes.push(e)}
  const sm=new T.Mesh(new T.TorusGeometry(.08,.014,6,16,Math.PI),NF);sm.rotation.z=Math.PI;sm.position.set(0,.55,.44);inn.add(sm);
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;if(Math.abs(Math.sin(a/2))<.12)continue;const lf=new T.Mesh(SPH,LAU);lf.scale.set(.085,.03,.035);
    lf.position.set(Math.sin(a)*.33,1.0+Math.cos(a)*.03,Math.cos(a)*.31);lf.rotation.y=a+Math.PI/2;lf.rotation.z=.6;inn.add(lf)}
  const arms=[];for(const sd of[-1,1]){const A=new T.Group();A.position.set(sd*.46,.62,0);const s=new T.Mesh(CYL,NF);s.scale.set(.025,.24,.025);s.position.y=-.1;s.rotation.z=sd*.7;A.add(s);
    const h=new T.Mesh(SPH,DARK);h.scale.setScalar(.06);h.position.set(sd*.09,-.2,0);const ho=new T.Mesh(SPH,NB);ho.scale.setScalar(1.2);h.add(ho);A.add(h);inn.add(A);arms.push(A)}
  const legs=[];for(const sd of[-1,1]){const L=new T.Group();L.position.set(sd*.17,.08,.05);const f=new T.Mesh(SPH,DARK);f.scale.set(.11,.05,.13);f.position.y=-.03;const fo=new T.Mesh(SPH,NB);fo.scale.setScalar(1.15);f.add(fo);L.add(f);inn.add(L);legs.push(L)}
  const halo=new T.Sprite(new T.SpriteMaterial({map:GLOW_TEX,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));halo.material.color=NF.color;halo.scale.set(2.6,2.6,1);halo.position.y=.7;inn.add(halo);
  // detail pass: bright eye glints and a sheen on the top swirl
  for(const e of eyes)e.add(part(SPH,HL_M,.02,.03,.04,.012,.014,.008,false));
  const sheen=new T.Mesh(new T.TorusGeometry(.2,.012,6,18,Math.PI*.6),HL_M);sheen.position.set(-.05,.92,.2);sheen.rotation.set(-.6,0,2.2);inn.add(sheen);
  return{g,body,legs,head:new T.Group(),eyes,limbs:arms,mask:LAU,bodyMat:NF,h:1.3,faceCam:true,neon:true}}


/* ---------- enemies ---------- */
function stripeTex(a,b){const c=document.createElement('canvas');c.width=8;c.height=32;const x=c.getContext('2d');x.fillStyle=a;x.fillRect(0,0,8,32);x.fillStyle=b;x.fillRect(0,0,8,8);x.fillRect(0,16,8,8);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1,2.5);t.magFilter=T.NearestFilter;return t}
const TEX_THUG=stripeTex('#e6e1ea','#17141f'),TEX_GUN=stripeTex('#e6e1ea','#6e1b2a'),TEX_ACRO=stripeTex('#e6e1ea','#1d6a6a'),TEX_SHIELD=stripeTex('#cfd3dc','#3a3f55'),TEX_SNIPE=stripeTex('#c9cfb8','#2a3a24');
const SACK_TEX=(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');x.fillStyle='#c39c62';x.fillRect(0,0,128,64);
  x.fillStyle='#5e3f1c';x.font='bold 36px Georgia,serif';x.textAlign='center';x.textBaseline='middle';x.fillText('$',32,34);x.fillText('$',96,34);return new T.CanvasTexture(c)})();
const SACK_M=toon(0xffffff,{map:SACK_TEX}),ROPE_M=toon(0x9c7a44),GOLD_SACK=toon(0xffc93c,{map:SACK_TEX,emissive:0x5a3a00});
function makeGoon(kind){const g=new T.Group(),body=new T.Group();g.add(body);const gun=kind==='gun'||kind==='sniper';
  const TX={gun:TEX_GUN,acro:TEX_ACRO,shield:TEX_SHIELD,sniper:TEX_SNIPE}[kind]||TEX_THUG,BC={gun:0x6e1b2a,acro:0x1d6a6a,shield:0x3a3f55,sniper:0x2a3a24}[kind]||0x221f2b;
  const Sh=toon(0xffffff,{map:TX}),Sk=toon(0xdcae86),Bk=toon(0x14111b),Bn=toon(BC),Pn=toon(0x2a2838),Wt=toon(0xf4f1ea);
  body.add(part(CYL,Pn,0,0.25,0,0.34,0.32,0.32,false));
  body.add(part(SPH,Sh,0,0.64,0,0.46,0.42,0.42));
  body.add(part(SPH,Sk,0.08,1.12,0,0.32,0.3,0.3));
  body.add(part(SPH,Bn,0.03,1.26,0,0.33,0.23,0.32));
  const band=part(TOR,Bn,0.05,1.2,0,0.31,0.31,0.31,false);band.rotation.x=Math.PI/2;body.add(band);
  body.add(part(SPH,Bn,-0.02,1.5,0,0.08,0.08,0.08,false));
  body.add(part(BOX,Bk,0.34,1.13,0,0.06,0.12,0.52,false));
  for(const s of[-1,1]){body.add(part(SPH,Wt,0.37,1.13,s*0.11,0.025,0.04,0.045,false));body.add(part(SPH,Bk,0.395,1.13,s*0.11,0.012,0.02,0.02,false));
    body.add(part(SPH,Sk,0.22,0.62,s*0.45,0.1,0.1,0.1,false))}
  body.add(part(SPH,Sk,0.4,1.05,0,0.06,0.05,0.06,false));
  const feet=[];for(const s of[-1,1]){const f=part(SPH,Bk,0.08,0.08,s*0.2,0.2,0.09,0.14);body.add(f);feet.push(f)}
  let barrel=null;
  if(kind==='sniper')body.add(part(SPH,new T.MeshBasicMaterial({color:0xff3355}),0.41,1.14,0.11,0.045,0.045,0.045,false));
  if(gun){const Lg=kind==='sniper';body.add(part(BOX,toon(0x3a3d4a),0.5,0.62,0.4,Lg?0.5:0.28,0.12,0.1));barrel=part(CYL,toon(0x5b6275),Lg?1.05:0.72,0.66,0.4,0.05,Lg?0.75:0.22,0.05);barrel.rotation.z=Math.PI/2;body.add(barrel)}
  else if(kind==='shield'){body.add(part(BOX,toon(0x8a95b5),0.62,0.72,0,0.1,0.95,0.82));body.add(part(BOX,toon(0xc9952a),0.68,0.72,0,0.02,0.18,0.6,false))}
  else if(kind==='acro'){}
  else{body.add(part(SPH,kind==='runner'?GOLD_SACK:SACK_M,-0.52,0.86,0,0.34,0.38,0.34));body.add(part(SPH,ROPE_M,-0.5,1.24,0,0.09,0.08,0.09,false))}
  return{g,body,feet,barrel,mats:[Sh,Bn,Sk]}}
