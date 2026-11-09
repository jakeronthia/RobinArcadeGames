/* ROBIN Arcade post-processing: HDR scene target, mip-chain bloom, filmic tone curve, grade, lens and grain */
function makePost(renderer, opts) {
  opts = opts || {};
  const gl2 = renderer.capabilities.isWebGL2;
  const FT = (gl2 || renderer.extensions.get('OES_texture_half_float')) ? T.HalfFloatType : T.UnsignedByteType;
  const MS = gl2 && T.WebGLMultisampleRenderTarget ? T.WebGLMultisampleRenderTarget : T.WebGLRenderTarget;
  const base = new MS(2, 2, { type: FT, depthBuffer: true }); if (base.samples !== undefined) base.samples = 4;
  const N = 6, mips = [];
  for (let i = 0; i < N; i++) mips.push(new T.WebGLRenderTarget(2, 2, { type: FT, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter }));
  const nrmRT = new T.WebGLRenderTarget(2, 2, { depthBuffer: true }); nrmRT.depthTexture = new T.DepthTexture(2, 2); nrmRT.depthTexture.type = T.UnsignedIntType;
  const nrmMat = new T.MeshNormalMaterial(); let hideList = [], hideAge = 1e9;
  let dynList = [];
  function collectHidden(scene) { hideList = []; dynList = []; scene.traverse(o => { if (o.userData.inkDyn) dynList.push(o); const m = o.material; if (o.isSprite || o.isPoints || o.isLine || (o.userData.noInk && !o.userData.inkDyn) || (m && !Array.isArray(m) && (m.transparent || m.blending === T.AdditiveBlending || m.isShaderMaterial))) hideList.push(o); }); hideAge = 0; }
  const qs = new T.Scene(), qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
  const V = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const down = new T.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new T.Vector2() }, th: { value: opts.threshold || 1 }, first: { value: 0 } }, vertexShader: V, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D t;uniform vec2 px;uniform float th;uniform float first;varying vec2 v;
      vec3 s(vec2 o){return texture2D(t,v+o*px).rgb;}
      float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
      vec3 kw(vec3 c){return c/(1.+lum(c));}
      void main(){
        vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0,0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2)),j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
        vec3 o;
        if(first>.5){vec3 g0=(a+b+d+e)*.25,g1=(b+c+e+f)*.25,g2=(d+e+g+h)*.25,g3=(e+f+h+i)*.25,g4=(j+k+l+m)*.25;
          o=kw(g0)*.125+kw(g1)*.125+kw(g2)*.125+kw(g3)*.125+kw(g4)*.5; o=o/(1.-lum(o)+1e-4);
          float br=max(o.r,max(o.g,o.b));float kn=th*.5;float sq=clamp(br-th+kn,0.,2.*kn);sq=sq*sq/(4.*kn+1e-4);o*=max(sq,br-th)/max(br,1e-4);}
        else o=e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;
        gl_FragColor=vec4(max(o,0.),1.);}` });
  const up = new T.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new T.Vector2() }, r: { value: 1 } }, vertexShader: V, depthTest: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true,
    fragmentShader: `uniform sampler2D t;uniform vec2 px;uniform float r;varying vec2 v;
      void main(){vec2 d=px*r;vec3 c=texture2D(t,v).rgb*4.;
        c+=(texture2D(t,v+vec2(d.x,0)).rgb+texture2D(t,v-vec2(d.x,0)).rgb+texture2D(t,v+vec2(0,d.y)).rgb+texture2D(t,v-vec2(0,d.y)).rgb)*2.;
        c+=texture2D(t,v+d).rgb+texture2D(t,v-d).rgb+texture2D(t,v+vec2(d.x,-d.y)).rgb+texture2D(t,v+vec2(-d.x,d.y)).rgb;
        gl_FragColor=vec4(c/16.,1.);}` });
  const comp = new T.ShaderMaterial({ uniforms: { tn: { value: null }, td: { value: null }, ol: { value: 0 }, cn: { value: .5 }, cf: { value: 900 }, px: { value: new T.Vector2() }, t: { value: null }, b: { value: null }, k: { value: opts.strength || .6 }, ex: { value: opts.exposure || 1.2 }, tm: { value: 0 }, asp: { value: 1 }, fl: { value: 0 }, ca: { value: opts.ca == null ? 1 : opts.ca }, vig: { value: opts.vignette || .55 }, wet: { value: 0 } }, vertexShader: V, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D t;uniform sampler2D b;uniform sampler2D tn;uniform sampler2D td;uniform float k,ex,tm,asp,fl,ca,vig,wet,ol,cn,cf;uniform vec2 px;varying vec2 v;
      float lin(vec2 p){float d=texture2D(td,p).x;return (2.*cn*cf)/(cf+cn-(2.*d-1.)*(cf-cn));}
      vec3 nr(vec2 p){return texture2D(tn,p).xyz*2.-1.;}
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec2 q=v-.5; float r2=dot(q*vec2(asp,1.),q*vec2(asp,1.));
        vec2 off=q*r2*.006*ca;
        vec3 c=vec3(texture2D(t,v+off).r,texture2D(t,v).g,texture2D(t,v-off).b);
        vec3 bl=texture2D(b,v).rgb;
        c+=bl*k;
        c*=ex*(1.+fl*1.6); c+=vec3(.55,.6,.9)*fl*.12;
        c=aces(c);
        if(ol>.5){float dc=lin(v);vec2 o1=vec2(px.x,0.),o2=vec2(0.,px.y);
          float de=abs(lin(v+o1)+lin(v-o1)+lin(v+o2)+lin(v-o2)-4.*dc)/dc;
          vec3 n0=nr(v);float ne=max(max(1.-dot(n0,nr(v+o1)),1.-dot(n0,nr(v-o1))),max(1.-dot(n0,nr(v+o2)),1.-dot(n0,nr(v-o2))));
          float e=max(smoothstep(.05,.16,de),smoothstep(.18,.45,ne))*(1.-smoothstep(90.,300.,dc));
          c=mix(c,vec3(.07,.05,.13),e*.88);}
        float l=dot(c,vec3(.299,.587,.114));
        c=mix(c,c*vec3(.82,.9,1.18),(1.-smoothstep(0.,.5,l))*.7);
        c=mix(c,c*vec3(1.1,1.,.86),smoothstep(.5,1.,l)*.6);
        c=mix(vec3(l),c,1.12);
        c+=vec3(.012,.008,.03);
        c*=mix(1.-vig,1.,1.-smoothstep(.2,1.1,sqrt(r2)));
        c+=(h(v*vec2(1913.,1577.)+fract(tm))-.5)*.035;
        gl_FragColor=vec4(pow(max(c,0.),vec3(.97)),1.);}` });
  let w = 2, h = 2;
  function pass(mat, target, clear) { quad.material = mat; renderer.setRenderTarget(target); if (clear !== false) renderer.clear(); renderer.render(qs, qc); }
  const P = {
    on: true, comp,
    outline: !!opts.outline,
    setSize(W, H) { const pr = renderer.getPixelRatio(); w = Math.max(2, W * pr | 0); h = Math.max(2, H * pr | 0); base.setSize(w, h); nrmRT.setSize(w, h); comp.uniforms.px.value.set(Math.max(1, pr * .9) / w, Math.max(1, pr * .9) / h); let mw = w, mh = h; for (let i = 0; i < N; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); mips[i].setSize(mw, mh); } },
    render(scene, camera, o) {
      o = o || {};
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(base); renderer.clear(); renderer.render(scene, camera);
      if (this.on) {
        let src = base.texture, sw = w, sh = h;
        for (let i = 0; i < N; i++) { down.uniforms.t.value = src; down.uniforms.px.value.set(1 / sw, 1 / sh); down.uniforms.first.value = i === 0 ? 1 : 0; down.uniforms.th.value = o.threshold != null ? o.threshold : (opts.threshold || 1); pass(down, mips[i]); src = mips[i].texture; sw = mips[i].width; sh = mips[i].height; }
        for (let i = N - 1; i > 0; i--) { up.uniforms.t.value = mips[i].texture; up.uniforms.px.value.set(1 / mips[i].width, 1 / mips[i].height); up.uniforms.r.value = 1; pass(up, mips[i - 1], false); }
      }
      const doOl = this.outline && !o.noInk; comp.uniforms.ol.value = doOl ? 1 : 0;
      if (doOl) { if (++hideAge > 90) collectHidden(scene); const hl = hideList.concat(dynList.filter(x => x.userData.noInk)); const was = hl.map(x => x.visible); hl.forEach(x => x.visible = false);
        const ov = scene.overrideMaterial, bg = scene.background, fg = scene.fog; scene.overrideMaterial = nrmMat; scene.background = null; scene.fog = null;
        renderer.setRenderTarget(nrmRT); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
        scene.overrideMaterial = ov; scene.background = bg; scene.fog = fg; hl.forEach((x, i) => x.visible = was[i]);
        comp.uniforms.tn.value = nrmRT.texture; comp.uniforms.td.value = nrmRT.depthTexture; comp.uniforms.cn.value = camera.near; comp.uniforms.cf.value = camera.far; }
      comp.uniforms.t.value = base.texture; comp.uniforms.b.value = mips[0].texture; comp.uniforms.k.value = this.on ? (o.strength != null ? o.strength : (opts.strength || .6)) : 0;
      comp.uniforms.tm.value = performance.now() / 1000 % 100; comp.uniforms.asp.value = w / h; comp.uniforms.fl.value = o.flash || 0;
      if (o.exposure != null) comp.uniforms.ex.value = o.exposure;
      pass(comp, null);
      renderer.autoClear = ac;
    }
  };
  return P;
}
