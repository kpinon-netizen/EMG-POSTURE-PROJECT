// Tap Brawl 3D view: renders the same 2D fight (same physics, same network messages) as a lit 3D scene with a moving camera.
// game.js feeds it the arena, the fighters, projectiles and particles every frame; it returns where to draw name tags.
// Three.js 0.160 is lazy-loaded from jsDelivr (needs internet). If it fails, Tap Brawl keeps drawing the classic 2D view.
(()=>{
"use strict";
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const K=0.04, VW=1200, VH=675;                         // 1 game pixel = 0.04 world units
const X=x=>(x-600)*K, Y=y=>(540-y)*K;
let T=null, R=null, scene=null, cam=null, state={loading:false,ready:false,failed:false}, CH={};
let skyU=null, hemi=null, sun=null, stage=null, stageId=null, stageKey=null, deco=null, fighters=new Map(), projPool=[], fxMesh=null, fxCol=null, FXN=400, grad=null;
const cam3={x:0,y:3,d:38,yaw:0,shake:0}, tmp={};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
const hash=str=>{ let h=2166136261; for(const c of str) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; };

async function init(canvas,characters){
  if(state.ready||state.loading) return; state.loading=true; CH=characters;
  try{
    T=await import(THREE_URL);
    R=new T.WebGLRenderer({canvas,antialias:true,alpha:false}); R.setPixelRatio(Math.min(devicePixelRatio||1,1.75)); R.shadowMap.enabled=true; R.shadowMap.type=T.PCFSoftShadowMap; R.toneMapping=T.ACESFilmicToneMapping; R.toneMappingExposure=1.05;
    scene=new T.Scene(); cam=new T.PerspectiveCamera(38,16/9,0.5,600);
    const d=new Uint8Array([70,150,255,255]); grad=new T.DataTexture(d,4,1,T.RedFormat); grad.minFilter=grad.magFilter=T.NearestFilter; grad.needsUpdate=true; // three tone steps for the toon look
    hemi=new T.HemisphereLight('#bcd4ff','#40384c',1.05); scene.add(hemi);
    sun=new T.DirectionalLight('#fff1d6',2.4); sun.position.set(-14,30,22); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=-34; sc.right=34; sc.top=22; sc.bottom=-18; sc.near=5; sc.far=90; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.04; scene.add(sun,sun.target);
    skyU={top:{value:new T.Color('#1b2440')},bot:{value:new T.Color('#3c2f5c')}};
    const sk=new T.Mesh(new T.SphereGeometry(300,24,12),new T.ShaderMaterial({uniforms:skyU,side:T.BackSide,depthWrite:false,fog:false,
      vertexShader:'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'uniform vec3 top,bot; varying vec3 p; void main(){ float h=clamp(p.y/260.0*0.5+0.55,0.0,1.0); gl_FragColor=vec4(mix(bot,top,pow(h,0.8)),1.0); }'}));
    sk.renderOrder=-1; sk.frustumCulled=false; scene.add(sk); tmp.sky=sk;
    const sph=new T.SphereGeometry(1,8,6); fxMesh=new T.InstancedMesh(sph,new T.MeshBasicMaterial({transparent:true,opacity:0.9,depthWrite:false}),FXN); fxMesh.count=0; fxMesh.frustumCulled=false; fxMesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(FXN*3),3); scene.add(fxMesh);
    state.ready=true;
  }catch(e){ state.failed=true; console.warn('Tap Brawl 3D unavailable',e); }
  state.loading=false;
}
const toon=(c,o={})=>new T.MeshToonMaterial({color:c,gradientMap:grad,...o});
function mesh(g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){ const me=new T.Mesh(g,m); me.position.set(x,y,z); me.scale.set(sx,sy,sz); me.castShadow=true; return me; }
const SPH=()=>tmp.sph||(tmp.sph=new T.SphereGeometry(1,16,12)), CON=()=>tmp.con||(tmp.con=new T.ConeGeometry(1,1,8)), BOX=()=>tmp.box||(tmp.box=new T.BoxGeometry(1,1,1)), CYL=()=>tmp.cyl||(tmp.cyl=new T.CylinderGeometry(1,1,1,10));
const outlineMat=()=>tmp.ol||(tmp.ol=new T.MeshBasicMaterial({color:'#101018',side:T.BackSide}));
function outlined(g,m,x,y,z,sx,sy,sz){ const grp=new T.Group(); grp.add(mesh(g,m,x,y,z,sx,sy,sz)); const o=new T.Mesh(g,outlineMat()); o.position.set(x,y,z); o.scale.set(sx*1.07,sy*1.07,sz*1.07); grp.add(o); return grp; }

/* ---------- fighters: small procedural creatures, one per roster entry, built from its colours and ear/tail style ---------- */
function buildCreature(ch){
  const root=new T.Group(), body=new T.Group(), m=toon(ch.body), mb=toon(ch.belly), ma=toon(ch.acc,ch.tail==='flame'?{emissive:ch.acc,emissiveIntensity:0.5}:{}), dark=toon(new T.Color(ch.body).multiplyScalar(0.7));
  root.add(body); const parts={body,feet:[],arms:[],tail:null,ears:[]};
  body.add(outlined(SPH(),m,0,1.0,0,0.62,0.66,0.6));                      // torso
  body.add(mesh(SPH(),mb,0.26,0.92,0,0.38,0.5,0.46));                     // belly
  body.add(outlined(SPH(),m,0.14,1.72,0,0.52,0.48,0.5));                  // head
  for(const z of [-0.2,0.2]){ body.add(mesh(SPH(),toon('#ffffff'),0.52,1.8,z,0.12,0.15,0.1)); body.add(mesh(SPH(),toon('#14141c'),0.6,1.8,z,0.07,0.1,0.06)); body.add(mesh(SPH(),ma,0.46,1.62,z*1.6,0.1,0.07,0.06)); } // eyes and cheeks
  for(const z of [-1,1]){ const a=mesh(SPH(),m,0.2,1.0,z*0.56,0.16,0.3,0.16); a.userData.z=z; body.add(a); parts.arms.push(a); const f=mesh(SPH(),dark,0.06,0.16,z*0.28,0.3,0.15,0.24); root.add(f); parts.feet.push(f); }
  const ear=(geo,mat,x,y,z,sx,sy,sz,rz=0,rx=0)=>{ const e=mesh(geo,mat,x,y,z,sx,sy,sz); e.rotation.z=rz; e.rotation.x=rx; body.add(e); parts.ears.push(e); return e; };
  switch(ch.ears){
    case 'pointy': ear(CON(),m,0.05,2.28,0.28,0.17,0.5,0.17,0.15,-0.25); ear(CON(),m,0.05,2.28,-0.28,0.17,0.5,0.17,0.15,0.25); break;
    case 'horns': ear(CON(),ma,0.1,2.22,0.26,0.13,0.45,0.13,-0.5,-0.3); ear(CON(),ma,0.1,2.22,-0.26,0.13,0.45,0.13,-0.5,0.3); break;
    case 'round': ear(SPH(),m,0.0,2.15,0.34,0.2,0.2,0.1); ear(SPH(),m,0.0,2.15,-0.34,0.2,0.2,0.1); break;
    case 'spikes': for(let i=0;i<3;i++) ear(CON(),ma,-0.12-i*0.04,2.2-i*0.12,0,0.1,0.34,0.1,0.5,0); break;
    case 'fin': ear(BOX(),ma,0.0,2.3,0,0.5,0.55,0.05,-0.15); break;
    case 'shell': body.add(mesh(SPH(),dark,-0.3,1.1,0,0.55,0.6,0.62)); break;
    case 'tuft': ear(CON(),ma,0.1,2.3,0,0.12,0.38,0.12,-0.2); break;
    case 'long': ear(BOX(),m,-0.05,2.5,0.2,0.14,0.8,0.1,0.18); ear(BOX(),m,-0.05,2.5,-0.2,0.14,0.8,0.1,0.18); break;
    case 'cap': { const cap=mesh(SPH(),ma,0.1,2.12,0,0.66,0.34,0.66); body.add(cap); for(const [x,z] of [[0.3,0.2],[0,-0.3],[-0.25,0.15]]) body.add(mesh(SPH(),toon('#fff6e6'),0.1+x,2.3,z,0.1,0.06,0.1)); break; }
  }
  const tail=new T.Group(); tail.position.set(-0.5,0.9,0); body.add(tail); parts.tail=tail;
  switch(ch.tail){
    case 'bolt': for(let i=0;i<3;i++){ const b=mesh(BOX(),ma,-0.1-i*0.22,0.15+(i%2?-0.2:0.2)*(i+1)*0.5,0,0.34,0.1,0.1); b.rotation.z=i%2?0.5:-0.5; tail.add(b); } break;
    case 'flame': tail.add(mesh(CON(),ma,-0.3,0.15,0,0.2,0.65,0.2)); tail.children[0].rotation.z=Math.PI/2+0.4; parts.flame=tail.children[0]; break;
    case 'flat': tail.add(mesh(BOX(),ma,-0.4,0,0,0.6,0.1,0.3)); break;
    case 'leaf': tail.add(mesh(SPH(),ma,-0.35,0.15,0,0.4,0.1,0.22)); break;
    case 'wing': for(const z of [-1,1]) tail.add(mesh(BOX(),ma,-0.25,0.1,z*0.3,0.5,0.06,0.25)); break;
    case 'puff': tail.add(mesh(SPH(),ma,-0.3,0.05,0,0.3,0.3,0.3)); break;
    case 'stub': tail.add(mesh(SPH(),ma,-0.2,0,0,0.15,0.15,0.15)); break;
  }
  const fx=new T.Group(); root.add(fx); parts.fx=fx;
  const cone=new T.Mesh(CON(),new T.MeshBasicMaterial({color:ch.acc,transparent:true,opacity:0.5,depthWrite:false})); cone.rotation.z=-Math.PI/2; cone.visible=false; fx.add(cone);
  const ring=new T.Mesh(new T.TorusGeometry(1,0.06,6,32),new T.MeshBasicMaterial({color:ch.acc,transparent:true,opacity:0.7,depthWrite:false})); ring.position.y=1.1; ring.visible=false; fx.add(ring);
  const streak=new T.Group(); for(let i=0;i<4;i++){ const s=new T.Mesh(BOX(),new T.MeshBasicMaterial({color:ch.acc,transparent:true,opacity:0.6})); s.position.set(-1.4-i*0.1,0.5+i*0.4,0); s.scale.set(1.6,0.06,0.06); streak.add(s); } streak.visible=false; fx.add(streak);
  const stars=new T.Group(); for(let i=0;i<3;i++) stars.add(mesh(new T.OctahedronGeometry(0.12),new T.MeshBasicMaterial({color:'#ffe45e'}),0,0,0)); stars.visible=false; stars.position.y=2.9; root.add(stars);
  parts.cone=cone; parts.ring=ring; parts.streak=streak; parts.stars=stars; root.userData=parts;
  return root;
}
function updateFighter(f,b,t){
  const P=f.userData, ch=CH[b.c], run=Math.abs(b.vx)>40&&b.ground, ph=t*14;
  f.position.set(X(b.x),Y(b.y),0);
  const ty=b.face>0?0:Math.PI; f.rotation.y+=(ty-f.rotation.y)*0.35;
  const air=!b.ground, sq=air?clamp(1+Math.abs(b.vy)/2400,1,1.18):1+0.04*Math.sin(t*3), stretch=air?1/Math.sqrt(sq):1;
  P.body.scale.set(stretch,sq,stretch); P.body.position.y=run?Math.abs(Math.sin(ph))*0.08:Math.sin(t*3)*0.03;
  P.body.rotation.z=run?-0.18:air?-clamp(b.vy/3500,-0.3,0.3):0; P.body.rotation.x=b.stun>0?0.35*Math.sin(t*20):0;
  P.feet.forEach((ft,i)=>{ ft.position.x=0.06+(run?Math.sin(ph+i*Math.PI)*0.3:0); ft.position.y=0.16+(air?0.12:run?Math.max(0,Math.sin(ph+i*Math.PI))*0.12:0); });
  P.arms.forEach(a=>{ a.rotation.z=run?Math.sin(ph+(a.userData.z>0?0:Math.PI))*0.7:0.1; if(b.atk>0&&b.atkType){ a.position.x=0.2+0.45; a.rotation.z=-1.2; } else a.position.x=0.2; });
  P.tail.rotation.z=Math.sin(t*5)*0.15+(run?0.2:0); if(P.flame){ const s=1+0.15*Math.sin(t*25); P.flame.scale.set(0.2*s,0.65*(1+0.1*Math.sin(t*20)),0.2*s); }
  P.ears.forEach((e,i)=>{ e.rotation.x+=(0)*0; });
  const at=b.atk>0?b.atkType:null, cone=at==='cone'||at===2, burst=at==='burst'||at===3, dash=at==='dash'||at===1;
  P.cone.visible=!!cone; if(cone){ const r=(ch.reach||90)*K; P.cone.position.set(0.7+r*0.5,1.1,0); P.cone.scale.set(r*0.55,r,r*0.55); }
  P.ring.visible=!!burst; if(burst){ const r=(ch.reach||80)*K*(0.7+0.3*Math.sin(t*30)); P.ring.scale.setScalar(r); P.ring.rotation.x=Math.PI/2; }
  P.streak.visible=!!dash; P.stars.visible=b.stun>0; if(b.stun>0) P.stars.children.forEach((s,i)=>{ const a=t*8+i*2.1; s.position.set(Math.cos(a)*0.5,0,Math.sin(a)*0.5); });
  f.visible=!(b.inv>0&&Math.sin(t*30)>0.3);
}
function syncFighters(list,t){
  const seen=new Set();
  for(const b of list){ if(b.out) continue; seen.add(b.key); let f=fighters.get(b.key);
    if(!f||f.userData.c!==b.c){ if(f) scene.remove(f); f=buildCreature(CH[b.c]); f.userData.c=b.c; fighters.set(b.key,f); scene.add(f); }
    updateFighter(f,b,t); }
  for(const [k,f] of fighters) if(!seen.has(k)){ scene.remove(f); fighters.delete(k); }
}

/* ---------- stage: floating islands with depth, trees, crystals, far mountains, weather ---------- */
function buildStage(A){
  if(stage){ scene.remove(stage); stage.traverse(o=>{ o.geometry&&o.geometry!==tmp.sph&&o.geometry!==tmp.box&&o.geometry!==tmp.con&&o.geometry!==tmp.cyl&&o.geometry.dispose?.(); }); }
  stage=new T.Group(); scene.add(stage); stageId=A.id; const rnd=rng(hash(A.id)); const parts=[];
  skyU.top.value.set(A.sky[0]); skyU.bot.value.set(A.sky[1]); scene.fog=new T.Fog(A.sky[1],70,230); scene.background=new T.Color(A.sky[1]);
  const night=A.deco==='stars'||A.deco==='snow'||A.deco==='embers';
  hemi.color.set(night?'#7f8fd0':'#d8ecff'); hemi.groundColor.set(A.hill); hemi.intensity=night?0.9:1.15; sun.color.set(A.deco==='sun'||A.deco==='embers'?'#ffb870':night?'#9db4ff':'#fff1d6'); sun.intensity=night?1.7:2.5;
  for(const p of A.plats){
    const g=new T.Group(), w=p.w*K, depth=p.main?7:4.2;
    if(p.main){
      g.add(mesh(BOX(),toon(A.top),0,0,0,w,0.28,depth)); g.children[0].position.y=-0.14;
      g.add(mesh(BOX(),toon(A.side),0,-0.7,0,w,0.9,depth));
      const rg=new T.CylinderGeometry(0.7071,0.22,1,4); rg.rotateY(Math.PI/4); const rock=mesh(rg,toon(A.under),0,-2.6,0,w,3.6,depth); g.add(rock);
      const under=new T.Mesh(new T.ConeGeometry(1,1,5),toon(A.under)); under.castShadow=true; under.position.set(0,-5.8,0); under.scale.set(w*0.22,2.8,depth*0.3); under.rotation.x=Math.PI; g.add(under);
      for(let i=0;i<Math.max(2,Math.floor(w/4));i++){ const x=(rnd()-0.5)*(w-2), z=(rnd()-0.5)*(depth-1.5), s=0.7+rnd()*0.9, tr=new T.Group();
        tr.add(mesh(CYL(),toon('#6b4a2f'),0,0.5*s,0,0.12*s,s,0.12*s)); tr.add(mesh(CON(),toon(new T.Color(A.top).multiplyScalar(0.75)),0,1.4*s,0,0.7*s,1.5*s,0.7*s)); tr.position.set(x,0,z); g.add(tr); }
      for(let i=0;i<4;i++){ const c=mesh(CON(),toon(A.float,{emissive:A.float,emissiveIntensity:0.15}),(rnd()-0.5)*w*0.9,-3.4-rnd()*2,(rnd()-0.5)*depth*0.7,0.3+rnd()*0.2,0.9+rnd()*0.8,0.3); c.rotation.x=Math.PI; g.add(c); }
    } else {
      g.add(mesh(BOX(),toon(A.top),0,0,0,w,0.1,depth)); g.children[0].position.y=-0.05;
      g.add(mesh(BOX(),toon(A.float),0,-0.28,0,w,0.3,depth));
      const glow=new T.Mesh(BOX(),new T.MeshBasicMaterial({color:A.top,transparent:true,opacity:0.55})); glow.position.set(0,-0.5,0); glow.scale.set(w*0.9,0.06,depth*0.9); g.add(glow);
      if(p.move) for(let k=0;k<3;k++){ const c=mesh(SPH(),toon('#ffffff',{transparent:true,opacity:0.7}),(k-1)*w*0.3,-0.65,0,0.55,0.22,0.55); g.add(c); }
    }
    g.userData={p}; parts.push(g); stage.add(g);
  }
  stage.userData.parts=parts;
  // far mountains and hills
  for(let layer=0;layer<3;layer++){ const col=new T.Color(A.hill).lerp(new T.Color(A.sky[1]),0.25+layer*0.2); for(let i=0;i<9;i++){ const m=mesh(CON(),toon(col),(i-4)*(18+layer*8)+rnd()*6,-6-layer*3,-45-layer*30,9+rnd()*8+layer*3,14+rnd()*14+layer*4,9+rnd()*6); m.castShadow=false; m.receiveShadow=false; stage.add(m); } }
  // deco: stars, sun, clouds, snow, embers
  deco={kind:A.deco,pts:null,clouds:[]};
  if(A.deco==='stars'){ const n=160, pos=new Float32Array(n*3); for(let i=0;i<n;i++){ pos[i*3]=(rnd()-0.5)*220; pos[i*3+1]=8+rnd()*60; pos[i*3+2]=-80-rnd()*60; } const gg=new T.BufferGeometry(); gg.setAttribute('position',new T.BufferAttribute(pos,3)); const pts=new T.Points(gg,new T.PointsMaterial({color:'#ffffff',size:1.2,fog:false})); stage.add(pts); }
  if(A.deco==='sun'){ const s=new T.Mesh(new T.CircleGeometry(14,32),new T.MeshBasicMaterial({color:'#ffecaa',fog:false})); s.position.set(0,12,-110); stage.add(s); }
  if(A.deco==='clouds'||A.deco==='sun'){ for(let i=0;i<9;i++){ const c=new T.Group(), s=1.5+rnd()*2; for(let k=0;k<4;k++) c.add(mesh(SPH(),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0.8,fog:false}),(k-1.5)*1.6*s,rnd()*0.8,rnd()*1,2.2*s,1.2*s,1.4*s)); c.position.set((rnd()-0.5)*160,4+rnd()*26,-20-rnd()*60); c.userData.sp=0.4+rnd()*0.8; stage.add(c); deco.clouds.push(c); } }
  if(A.deco==='snow'||A.deco==='embers'){ const n=260, pos=new Float32Array(n*3); for(let i=0;i<n;i++){ pos[i*3]=(rnd()-0.5)*70; pos[i*3+1]=rnd()*40; pos[i*3+2]=-12+rnd()*30; } const gg=new T.BufferGeometry(); gg.setAttribute('position',new T.BufferAttribute(pos,3)); deco.pts=new T.Points(gg,new T.PointsMaterial({color:A.deco==='snow'?'#ffffff':'#ffb060',size:A.deco==='snow'?0.22:0.3,transparent:true,opacity:0.85,fog:false})); stage.add(deco.pts); }
  stage.traverse(o=>{ if(o.isMesh&&o.castShadow!==false) o.receiveShadow=true; });
}
function updateStage(A,t,dt){
  for(const g of stage.userData.parts){ const p=g.userData.p; g.position.set(X(p.x+p.w/2),Y(p.y),0); if(!p.main) g.position.y+=Math.sin(t*1.3+p.x*0.01)*0.05; }
  for(const c of deco.clouds){ c.position.x+=c.userData.sp*dt; if(c.position.x>90) c.position.x=-90; }
  if(deco.pts){ const a=deco.pts.geometry.attributes.position, snow=deco.kind==='snow'; for(let i=0;i<a.count;i++){ let y=a.getY(i)+(snow?-2.2:3.2)*dt*(1+(i%3)*0.4); const x=a.getX(i)+Math.sin(t+i)*0.01; if(y<-6) y=40; if(y>40) y=-6; a.setY(i,y); a.setX(i,x); } a.needsUpdate=true; }
}

/* ---------- projectiles and particles ---------- */
function syncProjectiles(list){
  while(projPool.length<list.length){ const g=new T.Group(); g.add(new T.Mesh(SPH(),new T.MeshBasicMaterial({color:'#ffffff'}))); const halo=new T.Mesh(SPH(),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0.35,depthWrite:false})); halo.scale.setScalar(1.9); g.add(halo); scene.add(g); projPool.push(g); }
  projPool.forEach((g,i)=>{ const p=list[i]; g.visible=!!p; if(!p) return; g.position.set(X(p.x),Y(p.y)+0.0,0); g.scale.setScalar(Math.max(0.12,p.r*K*1.1)); const c=new T.Color(p.color); g.children[1].material.color.copy(c); g.children[0].material.color.set('#ffffff').lerp(c,0.25); });
}
function syncFx(list){
  const n=Math.min(FXN,list.length), m4=tmp.m4||(tmp.m4=new T.Matrix4()), c=tmp.c||(tmp.c=new T.Color());
  for(let i=0;i<n;i++){ const f=list[i], s=Math.max(0.03,f.r*K*(0.6+f.life)); m4.makeScale(s,s,s); m4.setPosition(X(f.x),Y(f.y),(i%5-2)*0.1); fxMesh.setMatrixAt(i,m4); c.set(f.color); fxMesh.setColorAt(i,c); }
  fxMesh.count=n; fxMesh.instanceMatrix.needsUpdate=true; if(fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate=true;
}

/* ---------- camera (follows the fight, tilts a little, shakes on hits) ---------- */
function updateCamera(list,t,dt){
  let sx=0,sy=0,n=0,minx=1e9,maxx=-1e9; for(const b of list){ if(b.out) continue; const x=X(b.x), y=Y(b.y); sx+=x; sy+=y; n++; minx=Math.min(minx,x); maxx=Math.max(maxx,x); }
  const tx=n?clamp(sx/n,-9,9):0, ty=n?clamp(sy/n+1.2,1.5,7):3, spread=n?maxx-minx:0, td=clamp(29+spread*0.42,30,44), k=1-Math.exp(-dt*3);
  cam3.x+=(tx-cam3.x)*k; cam3.y+=(ty-cam3.y)*k; cam3.d+=(td-cam3.d)*k; cam3.shake=Math.max(0,cam3.shake-dt*2.2);
  const yaw=0.17*Math.sin(t*0.35)+cam3.x*0.012, sh=cam3.shake*0.35;
  cam.position.set(cam3.x+Math.sin(yaw)*cam3.d+(Math.random()-0.5)*sh,cam3.y+4.5+(Math.random()-0.5)*sh,Math.cos(yaw)*cam3.d);
  cam.lookAt(cam3.x*0.9,cam3.y-0.8,0);
}
function labels(list){
  const out=[], v=tmp.v||(tmp.v=new T.Vector3());
  for(const b of list){ if(b.out) continue; v.set(X(b.x),Y(b.y)+2.9,0).project(cam); let sx=(v.x*0.5+0.5)*VW, sy=(-v.y*0.5+0.5)*VH, off=false;
    if(v.z>1||sx<26||sx>VW-26||sy<40||sy>VH-30){ off=true; sx=clamp(sx,30,VW-30); sy=clamp(sy,60,VH-60); }
    out.push({key:b.key,name:b.name,isMe:b.isMe,sx,sy,off,c:b.c}); }
  return out;
}

function render(st){
  if(!state.ready) return null;
  const rect=R.domElement.getBoundingClientRect(), w=Math.max(2,Math.round(rect.width)), h=Math.max(2,Math.round(rect.height));
  if(R.domElement.width!==Math.round(w*R.getPixelRatio())||R.domElement.height!==Math.round(h*R.getPixelRatio())){ R.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  if(!stage||stageId!==st.A.id||stageKey!==st.A) { buildStage(st.A); stageKey=st.A; }
  const dt=Math.min(0.05,st.dt||0.016);
  updateStage(st.A,st.t,dt); syncFighters(st.bodies,st.t); syncProjectiles(st.projs); syncFx(st.fx); updateCamera(st.bodies,st.t,dt);
  sun.target.position.set(cam3.x,cam3.y,0); sun.position.set(cam3.x-14,30,22);
  R.render(scene,cam); return labels(st.bodies);
}
window.Brawl3D={init,render,ready:()=>state.ready,failed:()=>state.failed,loading:()=>state.loading,shake:a=>{ cam3.shake=Math.max(cam3.shake,a||0.4); }};
})();
