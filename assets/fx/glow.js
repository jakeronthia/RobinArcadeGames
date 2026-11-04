/* ---------- glow (bloom) + automatic quality ---------- */
function makeGlow(renderer,opts){opts=opts||{};
  const gl2=renderer.capabilities.isWebGL2,RT=(gl2&&T.WebGLMultisampleRenderTarget)?T.WebGLMultisampleRenderTarget:T.WebGLRenderTarget;
  const base=new RT(2,2,{depthBuffer:true});if(base.samples!==undefined)base.samples=4;
  const a=new T.WebGLRenderTarget(2,2,{depthBuffer:false}),b=new T.WebGLRenderTarget(2,2,{depthBuffer:false});
  const qs=new T.Scene(),qc=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;qs.add(quad);
  const V='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const bright=new T.ShaderMaterial({uniforms:{t:{value:null},th:{value:opts.threshold||.8}},vertexShader:V,depthTest:false,depthWrite:false,
    fragmentShader:'uniform sampler2D t;uniform float th;varying vec2 v;void main(){vec3 c=texture2D(t,v).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,th+.18,l),1.);}'});
  const blur=new T.ShaderMaterial({uniforms:{t:{value:null},d:{value:new T.Vector2()}},vertexShader:V,depthTest:false,depthWrite:false,
    fragmentShader:'uniform sampler2D t;uniform vec2 d;varying vec2 v;void main(){vec3 s=texture2D(t,v).rgb*.227;s+=(texture2D(t,v+d*1.38).rgb+texture2D(t,v-d*1.38).rgb)*.316;s+=(texture2D(t,v+d*3.23).rgb+texture2D(t,v-d*3.23).rgb)*.07;gl_FragColor=vec4(s,1.);}'});
  const comp=new T.ShaderMaterial({uniforms:{t:{value:null},g:{value:null},k:{value:opts.strength||1.1}},vertexShader:V,depthTest:false,depthWrite:false,
    fragmentShader:'uniform sampler2D t;uniform sampler2D g;uniform float k;varying vec2 v;void main(){vec3 c=texture2D(t,v).rgb+texture2D(g,v).rgb*k;gl_FragColor=vec4(c,1.);}'});
  let w=2,h=2;
  function pass(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(qs,qc)}
  return{
    on:true,
    setSize(W,H){const pr=renderer.getPixelRatio();w=Math.max(2,W*pr|0);h=Math.max(2,H*pr|0);base.setSize(w,h);a.setSize(w/4|0,h/4|0);b.setSize(w/4|0,h/4|0)},
    render(scene,camera){
      if(!this.on){renderer.setRenderTarget(null);renderer.render(scene,camera);return}
      renderer.setRenderTarget(base);renderer.render(scene,camera);
      bright.uniforms.t.value=base.texture;pass(bright,a);
      for(let i=0;i<2;i++){blur.uniforms.t.value=a.texture;blur.uniforms.d.value.set((i+1)/(w/4),0);pass(blur,b);
        blur.uniforms.t.value=b.texture;blur.uniforms.d.value.set(0,(i+1)/(h/4));pass(blur,a)}
      comp.uniforms.t.value=base.texture;comp.uniforms.g.value=a.texture;pass(comp,null)}
  }}
/* watches frame time while playing; turns glow off, then lowers resolution, on slow devices */
function makeAutoQuality(renderer,glow,onChange){let acc=0,n=0,level=0,cool=3;
  return{tick(real,playing){if(!playing||level>=2)return;cool-=real;if(cool>0)return;acc+=real;n++;
    if(acc>=2){const avg=acc/n;acc=0;n=0;
      if(avg>1/38){level++;cool=2;if(level===1&&glow.on){glow.on=false}else{level=2;renderer.setPixelRatio(1)}onChange&&onChange(level)}}}}}
