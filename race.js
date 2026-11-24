// Sky Race: a multiplayer 3D bird race for the EMG Posture Lab.
// Steer with the keyboard. Boost = how hard you flex (live level from the Flex intensity tab, 0–100%).
// Graphics: Three.js 0.160.0, lazy-loaded from jsDelivr the first time this tab opens.
// Networking: MQTT over WebSocket, like Tap Brawl. Each player simulates their own bird and publishes its state.
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const EMG=()=>window.EMG;
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
let T=null, loading=false, loadErr=null;

/* ---------- real birds ---------- */
// spd = cruise speed, acc = acceleration, hnd = handling, boost = extra speed per unit of flex, stam = stamina (bigger lasts longer)
const BIRDS=[
  {id:'peregrine',name:'Peregrine Falcon',sci:'Falco peregrinus',fact:'The fastest animal on Earth. In a hunting dive it goes faster than 320 km/h.',spd:1.12,acc:0.9,hnd:0.85,boost:1.1,stam:0.9,
    look:{size:1,body:'#5d6673',belly:'#efe6d6',head:'#2b3037',face:'#efe6d6',beak:'#f2c230',beakLen:0.22,beakR:0.07,beakDown:0.35,eye:'#111',ring:'#f2c230',
      wing:'#535c68',tip:'#262b31',span:2.5,chord:0.42,wingShape:'pointed',tail:'wedge',tailCol:'#4a525d',flap:5}},
  {id:'eagle',name:'Bald Eagle',sci:'Haliaeetus leucocephalus',fact:'Wingspan up to 2.3 m. It rides rising warm air for hours with hardly a flap.',spd:1.0,acc:0.8,hnd:0.8,boost:1.3,stam:1.05,
    look:{size:1.3,body:'#3d2b1f',belly:'#3a281c',head:'#f6f5ef',headR:0.21,beak:'#f2b632',beakLen:0.3,beakR:0.085,beakDown:0.4,eye:'#e3c03a',
      wing:'#3a291d',tip:'#1f150e',span:3.1,chord:0.55,wingShape:'broad',tail:'fan',tailCol:'#f6f5ef',flap:2.4}},
  {id:'hummingbird',name:'Ruby-throated Hummingbird',sci:'Archilochus colubris',fact:'Beats its wings about 50 times a second and can even fly backwards.',spd:0.9,acc:1.35,hnd:1.35,boost:0.95,stam:1.3,
    look:{size:0.62,body:'#2f9e5c',belly:'#dfe8dc',head:'#2f9e5c',throat:'#d3203b',beak:'#1b1b1b',beakLen:0.75,beakR:0.025,eye:'#111',metal:0.35,rough:0.3,
      wing:'#4a5650',tip:'#2b3230',span:1.6,chord:0.3,wingShape:'pointed',tail:'fork',tailCol:'#24382c',flap:22}},
  {id:'puffin',name:'Atlantic Puffin',sci:'Fratercula arctica',fact:'Flaps up to 400 times a minute and flies at around 80 km/h.',spd:0.97,acc:1.2,hnd:1.05,boost:1.0,stam:1.05,
    look:{size:0.8,body:'#1d1d23',belly:'#f4f4f4',head:'#1d1d23',face:'#ececec',beak:'#f06a1f',beakLen:0.26,beakR:0.08,beakTall:true,eye:'#111',feet:'#f06a1f',
      wing:'#1d1d23',tip:'#121216',span:1.8,chord:0.36,wingShape:'short',tail:'short',tailCol:'#1d1d23',flap:12}},
  {id:'macaw',name:'Scarlet Macaw',sci:'Ara macao',fact:'A rainforest parrot that flies long distances every day between its roost and feeding trees.',spd:0.98,acc:1.0,hnd:1.0,boost:1.2,stam:1.15,
    look:{size:1.05,body:'#d8262e',belly:'#d8262e',head:'#d8262e',face:'#f1ede6',beak:'#e9e2d0',beakLen:0.2,beakR:0.1,beakDown:0.6,eye:'#f3e9a8',
      wing:'#d8262e',band:'#f5c518',tip:'#1f5fbf',span:2.3,chord:0.4,wingShape:'pointed',tail:'long',tailCol:'#d8262e',tailTip:'#1f5fbf',flap:5}},
  {id:'owl',name:'Snowy Owl',sci:'Bubo scandiacus',fact:'One of the heaviest owls. Unlike most owls it hunts in daylight on the Arctic tundra.',spd:0.95,acc:0.95,hnd:1.0,boost:1.05,stam:1.1,tough:true,
    look:{size:1.1,body:'#f7f7f4',belly:'#ffffff',head:'#f7f7f4',headR:0.27,owl:true,beak:'#2a2a2a',beakLen:0.1,beakR:0.05,beakDown:0.5,eye:'#f2c51d',flecks:'#2d2d33',len:0.85,wid:1.2,
      wing:'#f2f2ee',tip:'#cfcfc8',span:2.4,chord:0.55,wingShape:'round',tail:'fan',tailCol:'#eeeeea',flap:3.2}},
  {id:'raven',name:'Common Raven',sci:'Corvus corax',fact:'One of the smartest birds. Ravens do rolls and even fly upside down for fun.',spd:1.0,acc:1.05,hnd:1.2,boost:1.0,stam:1.0,quick:true,
    look:{size:1.0,body:'#16171d',belly:'#1b1c23',head:'#16171d',beak:'#121215',beakLen:0.3,beakR:0.09,beakDown:0.15,eye:'#2a2a2a',rough:0.35,metal:0.25,
      wing:'#18191f',tip:'#0e0f13',span:2.4,chord:0.48,wingShape:'broad',tail:'wedge',tailCol:'#16171d',flap:3.5}},
  {id:'swallow',name:'Barn Swallow',sci:'Hirundo rustica',fact:'Catches insects in mid-air and migrates up to 10,000 km each year.',spd:1.02,acc:1.15,hnd:1.25,boost:0.95,stam:1.0,
    look:{size:0.72,body:'#1d3f8f',belly:'#f1d8b6',head:'#1d3f8f',throat:'#b5502b',beak:'#1a1a1a',beakLen:0.1,beakR:0.05,eye:'#111',metal:0.25,rough:0.4,
      wing:'#1c2f62',tip:'#11193a',span:2.0,chord:0.3,wingShape:'pointed',tail:'fork',tailCol:'#1c2f62',flap:7}},
  {id:'flamingo',name:'American Flamingo',sci:'Phoenicopterus ruber',fact:'Flies with its long neck stretched out in front and its legs trailing behind.',spd:1.06,acc:0.85,hnd:0.85,boost:1.1,stam:1.2,
    look:{size:1.15,body:'#f2788b',belly:'#f5909f',head:'#f2788b',neck:0.75,beak:'#f6d2d8',beakTip:'#1a1a1a',beakLen:0.28,beakR:0.06,beakDown:0.7,eye:'#f2d23a',legs:'#f06d84',
      wing:'#f06d84',tip:'#141414',span:2.6,chord:0.38,wingShape:'pointed',tail:'short',tailCol:'#f2788b',flap:4}},
];
const BD=Object.fromEntries(BIRDS.map(b=>[b.id,b]));

/* ---------- courses ---------- */
const smooth=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
const COURSES=[
  {id:'coast',name:'Coastal Cliffs',desc:'Sunny sea cliffs, green islands, wind turbines and floating rocks.',seed:11,
    sky:{top:'#2b74cf',hor:'#d3ecff',bot:'#a8d2ee'},sun:{dir:[-0.45,0.6,-0.55],col:'#fff1d6',i:3.0},hemi:['#cfe8ff','#4f6b3a',1.25],fog:['#c3e0f5',300,2600],
    water:{deep:'#0c4a78',shallow:'#2ba3b3'},size:5200,carve:{inner:40,outer:150,depth:42},trees:'round',clouds:{n:70,y:[150,420]},
    rock:'#857a6b',top:'#5da04a',obs:['rock','balloon','turbine','rock','storm','orbit'],
    pts:[[0,70,0],[260,85,-60],[520,120,20],[650,100,260],[560,60,500],[300,45,600],[40,80,560],[-220,130,640],[-480,110,450],[-560,70,180],[-420,50,-60],[-200,55,-90]],
    height:(n,x,z)=>{ const e=n.fbm(x*0.0016,z*0.0016)*1.4+0.3*n.ridge(x*0.005,z*0.005)-0.22, r=Math.hypot(x,z), m=1-smooth(1500,2400,r); return (e*300-10)*m-60*(1-m); },
    color:(h,ny,v,c)=>{ if(h<4) c.set('#e2d29e'); else if(ny<0.72||h>170) c.set(h>200?'#b3aa9c':'#8a8073'); else c.set('#5fa64c').lerp(c2.set('#3c7a37'),v); }},
  {id:'canyon',name:'Red Rock Canyon',desc:'Sunset run through narrow canyons, past stone pillars.',seed:23,
    sky:{top:'#3b4f9a',hor:'#ffb27a',bot:'#c77a52'},sun:{dir:[0.7,0.22,-0.45],col:'#ffc48a',i:3.2},hemi:['#ffd2b0','#6b3420',1.1],fog:['#e7a079',350,2400],
    water:null,size:5200,carve:{inner:34,outer:62,depth:45},trees:null,clouds:{n:25,y:[320,520]},
    rock:'#a65a35',top:'#c98d52',obs:['pillar','rock','pillar','balloon','orbit'],
    pts:[[0,60,0],[200,55,-120],[420,70,-60],[520,90,140],[400,60,320],[460,45,520],[260,70,640],[40,95,520],[-140,70,600],[-360,50,480],[-420,80,240],[-300,100,60],[-160,70,-80]],
    height:(n,x,z)=>{ let h=165+n.fbm(x*0.0022,z*0.0022)*90; const t=h/22, f=Math.floor(t); return (f+smooth(0.55,1,t-f))*22; },
    floor:(n,x,z)=>n.fbm(x*0.01,z*0.01)*8,
    color:(h,ny,v,c)=>{ const S=['#b5562f','#c8693a','#d98b55','#a94a2a','#e2a36b','#9c4426']; c.set(S[Math.abs(Math.floor(h/9))%S.length]);
      if(ny>0.93) c.lerp(c2.set(h>120?'#d0995d':'#a8643c'),0.7); c.offsetHSL(0,0,(v-0.5)*0.06); }},
  {id:'fjord',name:'Aurora Fjord',desc:'Night flight between snowy peaks under the northern lights.',seed:37,
    sky:{top:'#030914',hor:'#16314f',bot:'#0b1a2b'},sun:{dir:[0.3,0.5,0.6],col:'#b8cfff',i:1.6},hemi:['#5d7fb8','#1c2430',1.0],fog:['#14273d',260,2300],stars:true,aurora:true,
    water:{deep:'#04101e',shallow:'#0e2a40'},size:5600,carve:{inner:50,outer:200,depth:70},trees:'pine',clouds:{n:30,y:[60,200],dark:true},
    rock:'#bfe3ff',ice:true,top:'#ffffff',obs:['orbit','rock','storm','turbine','balloon','orbit'],
    pts:[[0,90,0],[300,120,-150],[620,160,-40],[760,130,260],[600,90,540],[300,70,700],[-60,110,760],[-400,170,620],[-620,140,320],[-560,100,40],[-300,80,-120]],
    height:(n,x,z)=>{ const b=n.ridge(x*0.0018,z*0.0018)*640-130+n.fbm(x*0.01,z*0.01)*30, ch=Math.abs(n.fbm(x*0.0012+5.3,z*0.0012-2.1)); return b-460*smooth(0.17,0.015,ch); }, // fjord arms carved into the mountains: this is where the water, boats and whales are
    color:(h,ny,v,c)=>{ if(h<3) c.set('#2a3838'); else if((ny>0.78&&h>50)||h>270) c.set('#eef4fb'); else if(h<70&&ny>0.7) c.set('#2d4a37'); else c.set('#4d5563').offsetHSL(0,0,(v-0.5)*0.08); }},
  {id:'usc',name:'USC Campus (real map)',desc:'The real University Park Campus, built from OpenStreetMap: named buildings, tree-lined paths, the Coliseum, and students who scatter when you swoop.',seed:53,usc:true,data:'USC_DATA',
    sky:{top:'#3f86d9',hor:'#dcefff',bot:'#b4d6ee'},sun:{dir:[-0.4,0.62,-0.5],col:'#fff1d6',i:3.0},hemi:['#d4e9ff','#8a8a74',1.3],fog:['#cfe3f2',700,4200],
    water:null,size:7000,lim:1500,mapE:1100,hz:0.45,carve:{inner:30,outer:60,depth:0},trees:null,clouds:{n:45,y:[240,520]},
    rock:'#9aa3b0',top:'#8bb36a',obs:['balloon','balloon'],
    pts:[[0,80,0],[330,95,-420],[780,105,-250],[880,95,250],[560,90,640],[0,100,600],[-520,95,640],[-900,105,250],[-820,95,-300],[-450,100,-560],[-200,85,-300]],
    height:()=>0,
    color:(h,ny,v,c)=>{ c.set('#a9a794').lerp(c2.set('#8f9279'),v*0.4); }},
  {id:'la',name:'Downtown Los Angeles (real map)',desc:'Downtown LA from OpenStreetMap: the real skyscrapers at their real heights, Pershing Square, the Cathedral and the Bradbury Building, with crowds on the sidewalks.',seed:61,usc:true,data:'LA_DATA',
    sky:{top:'#3a82d6',hor:'#e6e4da',bot:'#c4d3dc'},sun:{dir:[-0.45,0.6,-0.4],col:'#fff0d2',i:3.0},hemi:['#d4e6fa','#8a8a78',1.3],fog:['#d9e0e4',900,6500],
    water:null,size:8000,lim:1300,mapE:1300,hz:0.55,carve:{inner:30,outer:60,depth:0},trees:null,clouds:{n:50,y:[300,620]},
    rock:'#9aa3b0',top:'#8bb36a',obs:['balloon','balloon'],
    pts:[[0,180,0],[420,200,-420],[900,220,-150],[1000,190,380],[520,170,740],[0,200,600],[-500,190,720],[-1000,210,300],[-1000,200,-250],[-550,210,-640],[-200,190,-260]],
    height:()=>0,
    color:(h,ny,v,c)=>{ c.set('#a9a794').lerp(c2.set('#8f9279'),v*0.4); }},
];
const CO=Object.fromEntries(COURSES.map(c=>[c.id,c]));
let c2=null; // scratch color

/* ---------- constants ---------- */
const M=1200;         // track samples
const TUBE=32;        // soft course radius (m)
const GS=2.4;         // bird model scale
/* On real-map cities the bird is drawn at its real wingspan (times a visibility factor), so buildings and houses tower over it: peregrine 1 m, eagle 2 m, hummingbird 14 cm... The factor is 2.2 at "Small". */
const REAL_SPAN={peregrine:1.0,eagle:2.0,hummingbird:0.14,puffin:0.55,macaw:1.0,owl:1.5,raven:1.1,swallow:0.34,flamingo:1.5};
function cityBirdScale(r){ const L=BD[r.c].look; return Math.max(0.55,(REAL_SPAN[r.c]||1)*citySize()/0.55*2.2)/L.span; }
function citySize(){ return clamp(+($('rBirdSize')?.value)||0.55,0.3,1.3); }
const CITY_BIRD=0.55; // on the real-map cities the bird is smaller, so people, doors and benches look the right size next to it
const HIT_R=1.8;      // bird collision radius
const QUAL={high:{pr:1.75,shadow:2048,grid:300,trees:2400,cloud:1,aa:true,detail:true},medium:{pr:1.25,shadow:1024,grid:220,trees:1500,cloud:0.7,aa:true,detail:true},low:{pr:1,shadow:0,grid:150,trees:500,cloud:0.4,aa:false,detail:false}};
const BOT_NAMES=['Breeze','Comet','Dash','Echo','Flint','Gale','Nova','Pip','Skye','Zephyr'];

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
const wrapA=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };
const num=(v,d=0)=>{ v=+v; return Number.isFinite(v)?v:d; };
const ord=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');
const fmtT=s=>{ s=Math.max(0,s); const m=Math.floor(s/60); return `${m}:${(s-m*60).toFixed(2).padStart(5,'0')}`; };
function mulberry32(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeNoise(seed){
  const rnd=mulberry32(seed), P=new Uint8Array(512), G=new Float32Array(256);
  for(let i=0;i<256;i++){ P[i]=i; G[i]=rnd()*2-1; }
  for(let i=255;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=P[i]; P[i]=P[j]; P[j]=t; }
  for(let i=0;i<256;i++) P[i+256]=P[i];
  const h=(x,y)=>G[P[P[x&255]+(y&255)]], f=t=>t*t*(3-2*t);
  const n=(x,y)=>{ const xi=Math.floor(x), yi=Math.floor(y), u=f(x-xi), v=f(y-yi), a=h(xi,yi), b=h(xi+1,yi), c=h(xi,yi+1), d=h(xi+1,yi+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; };
  const fbm=(x,y,o=5)=>{ let s=0,a=0.5,fr=1; for(let i=0;i<o;i++){ s+=a*n(x*fr,y*fr); fr*=2.03; a*=0.5; } return s; };
  const ridge=(x,y,o=5)=>{ let s=0,a=0.5,fr=1; for(let i=0;i<o;i++){ s+=a*(1-Math.abs(n(x*fr,y*fr))); fr*=2.03; a*=0.5; } return s; };
  return {n,fbm,ridge};
}

/* ---------- state ---------- */
const me={id:null,name:'',c:'peregrine',course:'coast',r:null};
let W=null;                 // the built world (scene, track, terrain, obstacles)
let R=null;                 // renderer + camera
let racers=[];              // local sims: me + bots
let remotes=new Map();      // id -> remote player
let client=null, base=null;
let phase='free', matchId=null, participants=[], laps=3, goAt=0, raceT0=0, doneAt=0, firstFin=0, finMsgs=new Map();
const keys={}; let kbRamp=0, lastSend=0, lastT=performance.now(), shake=0, banner=null, lastQual=null;
const parts={pos:null,vel:null,life:null,col:null,n:0};
let mode='race', ctrl='all', camMode=0, hideHud=false; // mode: race | travel · ctrl: all | kb | eyes

function msg(t,err){ const m=$('rMsg'); m.textContent=t; m.style.color=err?'var(--danger)':''; }
function prefs(save){
  const k='emgPosture.race';
  if(save){ try{ localStorage.setItem(k,JSON.stringify({id:me.id,name:$('rName').value,room:$('rRoom').value,c:me.c,k:me.course,laps:$('rLaps').value,bots:$('rBots').value,
    kb:$('rKeyBoost').checked,as:$('rAssist').checked,inv:$('rInvert').checked,q:$('rQuality').value,
    md:mode,ct:ctrl,es:$('rEyeSens').value,snd:$('rSound').checked,tp:$('rTapPhoto').checked})); }catch{} return; }
  let p={}; try{ p=JSON.parse(localStorage.getItem(k)||'{}'); }catch{}
  me.id=typeof p.id==='string'&&/^[A-Z0-9]{6,12}$/.test(p.id)?p.id:EMG().randCode(10); me.c=BD[p.c]?p.c:'peregrine'; me.course=CO[p.k]?p.k:'coast';
  $('rName').value=p.name||EMG().name()||''; $('rRoom').value=p.room||('RACE-'+EMG().randCode(6));
  if(p.laps) $('rLaps').value=p.laps; if(p.bots) $('rBots').value=p.bots;
  if(p.kb!=null) $('rKeyBoost').checked=!!p.kb; if(p.as!=null) $('rAssist').checked=!!p.as; if(p.inv!=null) $('rInvert').checked=!!p.inv;
  if(QUAL[p.q]) $('rQuality').value=p.q;
  if(p.md==='travel'||p.md==='race') mode=p.md; if(['all','kb','eyes'].includes(p.ct)) ctrl=p.ct;
  $('rMode').value=mode; $('rControl').value=ctrl; if(p.es) $('rEyeSens').value=p.es;
  if(p.snd!=null) $('rSound').checked=!!p.snd; if(p.tp!=null) $('rTapPhoto').checked=!!p.tp;
  prefs(true);
}

/* ---------- loading three.js ---------- */
async function loadThree(){
  if(T||loading) return; loading=true; loadErr=null;
  try{ T=await import(THREE_URL); c2=new T.Color(); setupRenderer(); buildWorld(me.course); renderPreviews(); }
  catch(e){ loadErr='Could not load the 3D engine (Three.js). Check your internet connection, then reopen this tab. '+(e?.message||''); T=null; console.error(e); }
  loading=false;
}
function setupRenderer(){
  const canvas=$('raceCanvas'), q=QUAL[$('rQuality').value]||QUAL.medium;
  const renderer=new T.WebGLRenderer({canvas,antialias:q.aa,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const camera=new T.PerspectiveCamera(68,16/9,0.5,9000);
  R={renderer,camera,w:0,h:0,look:new T.Vector3(),fov:68};
  lastQual=$('rQuality').value;
}

/* ---------- materials & geometry helpers ---------- */
const matCache=new Map();
function mat(col,o={}){
  const key=JSON.stringify([col,o.r,o.m,o.flat,o.side,o.vc,o.e]);
  let m=matCache.get(key);
  if(!m){ m=new T.MeshStandardMaterial({color:col,roughness:o.r??0.75,metalness:o.m??0,flatShading:!!o.flat,side:o.side?T.DoubleSide:T.FrontSide,vertexColors:!!o.vc});
    if(o.e){ m.emissive=new T.Color(o.e); m.emissiveIntensity=o.ei??1; } matCache.set(key,m); }
  return m;
}
const SPH=()=>W?.sph||(W.sph=new T.SphereGeometry(1,20,14));
function ell(m,sx,sy,sz,x,y,z){ const me=new T.Mesh(SPH(),m); me.scale.set(sx,sy,sz); me.position.set(x,y,z); me.castShadow=true; return me; }
function shapeGeo(pts,colorAt){
  const s=new T.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]);
  const g=new T.ShapeGeometry(s); g.rotateX(Math.PI/2); // shape (x,y) -> world (x,0,y): y of the shape points forward
  if(colorAt){ const p=g.attributes.position, c=new Float32Array(p.count*3), col=new T.Color();
    for(let i=0;i<p.count;i++){ colorAt(p.getX(i),p.getZ(i),col); c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; }
    g.setAttribute('color',new T.BufferAttribute(c,3)); }
  g.computeVertexNormals(); return g;
}
const WING_IN=[[0,0.5],[0.45,0.45],[0.45,-0.6],[0,-0.7]];
const WING_OUT={
  pointed:[[0,0.45],[0.25,0.3],[0.55,-0.3],[0.38,-0.5],[0,-0.6]],
  broad:[[0,0.45],[0.4,0.4],[0.55,0.3],[0.48,0.18],[0.56,0.1],[0.48,0.0],[0.55,-0.08],[0.46,-0.18],[0.5,-0.26],[0.38,-0.45],[0,-0.6]],
  short:[[0,0.45],[0.3,0.3],[0.42,0.0],[0.3,-0.35],[0,-0.6]],
  round:[[0,0.45],[0.35,0.4],[0.5,0.1],[0.45,-0.25],[0.25,-0.5],[0,-0.6]],
};
const TAILS={
  wedge:[[-0.12,0],[0.12,0],[0.2,-0.45],[0,-0.55],[-0.2,-0.45]],
  fan:[[-0.1,0],[0.1,0],[0.28,-0.4],[0.15,-0.5],[0,-0.52],[-0.15,-0.5],[-0.28,-0.4]],
  fork:[[-0.08,0],[0.08,0],[0.16,-0.75],[0.11,-0.77],[0,-0.3],[-0.11,-0.77],[-0.16,-0.75]],
  short:[[-0.1,0],[0.1,0],[0.13,-0.22],[-0.13,-0.22]],
  long:[[-0.08,0],[0.08,0],[0.06,-1.0],[0,-1.08],[-0.06,-1.0]],
};

/* ---------- procedural bird models ---------- */
function buildBird(B){
  const L=B.look, root=new T.Group(), body=new T.Group(); root.add(body);
  const len=L.len??1, wid=L.wid??1, o={r:L.rough,m:L.metal};
  const mBody=mat(L.body,o), mBelly=mat(L.belly,o), mHead=mat(L.head,o);
  body.add(ell(mBody,0.3*wid,0.28*wid,0.72*len,0,0,0));
  body.add(ell(mBelly,0.27*wid,0.24*wid,0.62*len,0,-0.07*wid,0.03));
  if(L.flecks){ const r=mulberry32(5), fm=mat(L.flecks); for(let i=0;i<26;i++){ const a=r()*Math.PI*2, z=(r()-0.5)*1.1*len, y=Math.sin(a)*0.25, x=Math.cos(a)*0.28*wid;
    if(y<-0.1) continue; body.add(ell(fm,0.035,0.02,0.05,x*1.04,y*1.04+0.03,z*0.6)); } }
  const neck=L.neck??0, hr=L.headR??0.2, hz=0.58*len+neck+(L.owl?-0.1:0), hy=L.owl?0.16:0.1+neck*0.15;
  if(neck>0){ const nk=new T.Mesh(new T.CylinderGeometry(0.065,0.1,neck+0.25,10),mBody); nk.rotation.x=Math.PI/2-0.12; nk.position.set(0,hy*0.55,0.5*len+neck/2); nk.castShadow=true; body.add(nk); }
  const head=new T.Group(); head.position.set(0,hy,hz); body.add(head);
  head.add(ell(mHead,hr,hr*0.95,hr*1.05,0,0,0));
  if(L.face) head.add(ell(mat(L.face,o),hr*0.82,hr*0.72,hr*0.7,0,-hr*0.12,hr*0.42));
  if(L.throat) head.add(ell(mat(L.throat,{r:0.3,m:0.35}),hr*0.72,hr*0.55,hr*0.75,0,-hr*0.58,hr*0.22));
  const er=L.owl?hr*0.24:hr*0.17;
  for(const s of [-1,1]){
    const ex=L.owl?s*hr*0.4:s*hr*0.74, ez=L.owl?hr*0.86:hr*0.42, ey=hr*0.22;
    if(L.ring) head.add(ell(mat(L.ring),er*1.3,er*1.3,er*0.7,ex,ey,ez*0.97));
    head.add(ell(mat(L.eye,{r:0.15}),er,er,er*0.8,ex*1.03,ey,ez));
    if(L.owl||L.eye!=='#111') head.add(ell(mat('#050505',{r:0.1}),er*0.5,er*0.5,er*0.5,ex*1.03,ey,ez+er*0.55));
  }
  const bl=L.beakLen??0.25, br=L.beakR??0.07;
  const bg=new T.ConeGeometry(br,bl,12); bg.rotateX(Math.PI/2); bg.translate(0,0,bl/2);
  const beak=new T.Mesh(bg,mat(L.beak,{r:0.45})); beak.position.set(0,-hr*0.12,hr*0.88); beak.rotation.x=L.beakDown??0; beak.castShadow=true;
  if(L.beakTall) beak.scale.set(0.75,2.0,1);
  head.add(beak);
  if(L.beakTip){ const tg=new T.ConeGeometry(br*0.75,bl*0.55,10); tg.rotateX(Math.PI/2); tg.translate(0,0,bl*0.27); const tip=new T.Mesh(tg,mat(L.beakTip,{r:0.5})); tip.position.set(0,0,bl*0.8); tip.rotation.x=0.7; beak.add(tip); }
  // tail
  const tsh=TAILS[L.tail]||TAILS.short, tc1=new T.Color(L.tailCol), tc2=new T.Color(L.tailTip||L.tailCol);
  const tail=new T.Mesh(shapeGeo(tsh,(x,z,c)=>c.copy(tc1).lerp(tc2,clamp(-z,0,1))),mat('#ffffff',{vc:true,side:true,r:L.rough??0.75}));
  tail.position.set(0,0.04,-0.55*len); tail.castShadow=true; body.add(tail);
  // legs / feet
  if(L.legs){ const lm=mat(L.legs); for(const s of [-1,1]){ const lg=new T.Mesh(new T.CylinderGeometry(0.022,0.022,1.3,6),lm); lg.rotation.x=Math.PI/2; lg.position.set(s*0.06,-0.16,-0.95); lg.castShadow=true; body.add(lg); } }
  if(L.feet){ const fm=mat(L.feet); for(const s of [-1,1]) body.add(ell(fm,0.06,0.03,0.11,s*0.09,-0.2,-0.42)); }
  // wings: inner + outer section, each with a joint so they can flap
  const half=(L.span??2.2)/2, ch=L.chord??0.4;
  const cw=new T.Color(L.wing), cb=new T.Color(L.band||L.wing), ct=new T.Color(L.tip);
  const wcol=(f,c)=>{ if(L.band){ if(f<0.38) c.copy(cw); else if(f<0.62) c.copy(cb); else c.copy(ct); } else c.copy(cw).lerp(ct,clamp((f-0.35)/0.65,0,1)**1.5); };
  const wm=mat('#ffffff',{vc:true,side:true,r:L.rough??0.75,m:L.metal??0});
  const sc=(pts,sx)=>pts.map(([x,z])=>[x*sx,z*ch]);
  const gIn=shapeGeo(sc(WING_IN,half),(x,z,c)=>wcol(x/half,c)), gOut=shapeGeo(sc(WING_OUT[L.wingShape]||WING_OUT.pointed,half),(x,z,c)=>wcol(0.45+x/half,c));
  const wings=[];
  for(const s of [-1,1]){
    const pivot=new T.Group(); pivot.position.set(s*0.2*wid,0.1,0.08*len); pivot.scale.x=s; body.add(pivot);
    const inner=new T.Mesh(gIn,wm); inner.castShadow=true; pivot.add(inner);
    const elbow=new T.Group(); elbow.position.x=0.45*half; pivot.add(elbow);
    const outer=new T.Mesh(gOut,wm); outer.castShadow=true; elbow.add(outer);
    wings.push({pivot,elbow,s});
  }
  root.userData={wings,tail,body,flap:Math.min(L.flap,22),glide:L.flap<4,half,sc0:GS*(L.size??1)};
  root.scale.setScalar(GS*(L.size??1));
  return root;
}
function animBird(m,t,effort,phaseOff=0,dt){
  const u=m.userData;
  u.eff=dt!=null&&u.eff!=null?u.eff+(effort-u.eff)*Math.min(1,dt*5):effort; // effort eases in and out
  const e=clamp(u.eff,0,1), amp=u.glide?0.12+0.55*e:0.35+0.35*e, hz=u.flap*(0.6+0.6*e); u.hz=hz;
  let ph; if(dt!=null){ u.acc=(u.acc||0)+dt*hz; ph=(u.acc+phaseOff)*Math.PI*2; } else ph=(t*hz+phaseOff)*Math.PI*2; // accumulated phase: a changing rate can't make the wings jump
  const a=amp*Math.sin(ph)+0.08, a2=amp*0.7*Math.sin(ph-0.9);
  const fo=u.fold||0, fa=a*(1-fo)+(-1.15)*fo, fa2=a2*(1-fo)+0.95*fo;
  for(const w of u.wings){ w.pivot.rotation.z=w.s*fa; w.elbow.rotation.z=fa2; }
  u.body.position.y=-Math.sin(ph)*0.03*amp*(1-fo)+fo*Math.abs(Math.sin((u.walk||0)*2.6))*0.07;
  u.tail.rotation.x=Math.sin(t*1.3+phaseOff)*0.05;
}

/* ---------- world building ---------- */
function disposeWorld(){
  if(!W) return;
  W.scene.traverse(o=>{ if(o.geometry&&o.geometry!==W.sph) o.geometry.dispose(); if(o.material&&!Array.isArray(o.material)&&o.material.map) o.material.map.dispose(); });
  for(const m of W.ownMats) m.dispose();
  W=null;
}
function buildTrack(co){
  const curve=new T.CatmullRomCurve3(co.pts.map(p=>new T.Vector3(p[0],p[1],p[2])),true,'centripetal');
  const P=[],TG=[],S=[],U=[], up=new T.Vector3(0,1,0);
  for(let i=0;i<M;i++){ const u=i/M; P.push(curve.getPointAt(u)); TG.push(curve.getTangentAt(u).normalize()); }
  for(let i=0;i<M;i++){ const s=new T.Vector3().crossVectors(TG[i],up).normalize(); S.push(s); U.push(new T.Vector3().crossVectors(s,TG[i]).normalize()); }
  const len=curve.getLength();
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9; for(const p of P){ mnx=Math.min(mnx,p.x); mxx=Math.max(mxx,p.x); mnz=Math.min(mnz,p.z); mxz=Math.max(mxz,p.z); }
  return {curve,P,TG,S,U,len,seg:len/M,box:[mnx,mxx,mnz,mxz]};
}
function nearest(tr,pos,hint,win){
  let best=hint, bd=Infinity;
  for(let k=-win;k<=win;k++){ const i=((hint+k)%M+M)%M, p=tr.P[i], dx=p.x-pos.x, dy=p.y-pos.y, dz=p.z-pos.z, d=dx*dx+dy*dy+dz*dz; if(d<bd){ bd=d; best=i; } }
  return [best,Math.sqrt(bd)];
}
function buildWorld(id){
  disposeWorld();
  const co=CO[id]||COURSES[0], q=QUAL[$('rQuality').value]||QUAL.medium;
  const scene=new T.Scene();
  W={co,scene,ownMats:[],obs:[],rings:[],storms:[],sph:null,time:0,lms:[],solids:[],thermals:[],smokeSrc:[]};
  W.raceG=new T.Group(); W.travelG=new T.Group(); scene.add(W.raceG,W.travelG);
  scene.fog=new T.Fog(co.fog[0],co.fog[1],co.fog[2]);
  scene.background=new T.Color(co.fog[0]);
  R.renderer.shadowMap.enabled=q.shadow>0;
  R.scale=1; R.cap=1; R.ft=16.7; R.warm=90; R.adj=0; R.raised=0; R.fr=0;
  R.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.pr));
  const tr=W.tr=buildTrack(co);
  const sunDir=new T.Vector3(...co.sun.dir).normalize(); W.sunDir=sunDir;
  // lights
  const hemi=new T.HemisphereLight(co.hemi[0],co.hemi[1],co.hemi[2]); scene.add(hemi); W.hemi=hemi;
  const sun=new T.DirectionalLight(co.sun.col,co.sun.i); sun.position.copy(sunDir).multiplyScalar(400); scene.add(sun); scene.add(sun.target);
  if(q.shadow){ sun.castShadow=true; sun.shadow.mapSize.set(q.shadow,q.shadow); const sc=sun.shadow.camera; sc.left=-140; sc.right=140; sc.top=140; sc.bottom=-140; sc.near=10; sc.far=1200; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.6; }
  W.sun=sun;
  const flash=new T.PointLight('#cfe0ff',0,500,2); scene.add(flash); W.flash=flash;
  buildSky(co); buildTerrain(co,tr,co.usc?Object.assign({},q,{grid:72}):q); buildHorizon(co);
  if(co.water) buildWater(co);
  if(co.usc) buildUSC(co,q);
  buildLandmarks(co);
  buildClouds(co,q);
  buildCourseMarks(co,tr);
  buildObstacles(co,tr);
  buildTravel(co,q);
  buildParticles();
  buildHearts(co); applyModeVis(); renderJournal();
  if(!W.rain) buildRain(); applyEnv();
  // racers' models
  for(const r of racers) attachModel(r);
  for(const rm of remotes.values()) if(rm.r) attachModel(rm.r);
  markCourse();
}
function buildSky(co){
  const u={top:{value:new T.Color(co.sky.top)},hor:{value:new T.Color(co.sky.hor)},bot:{value:new T.Color(co.sky.bot)},sunDir:{value:W.sunDir},sunCol:{value:new T.Color(co.sun.col)},
    stars:{value:co.stars?1:0},aurora:{value:co.aurora?1:0},time:{value:0}};
  const m=new T.ShaderMaterial({uniforms:u,side:T.BackSide,depthWrite:false,fog:false,
    vertexShader:`varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 top,hor,bot,sunDir,sunCol; uniform float stars,aurora,time; varying vec3 vDir;
      float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d=normalize(vDir); float y=d.y;
        vec3 c= y>0.0 ? mix(hor,top,pow(clamp(y,0.0,1.0),0.5)) : mix(hor,bot,pow(clamp(-y*3.0,0.0,1.0),0.6));
        float s=max(dot(d,normalize(sunDir)),0.0);
        c+=sunCol*(pow(s,900.0)*8.0+pow(s,40.0)*0.35+pow(s,5.0)*0.12)*(1.0-0.6*stars);
        if(stars>0.02&&y>0.0){ vec3 q=floor(d*480.0); float h=hash(q); c+=vec3(0.9,0.95,1.0)*step(0.997,h)*(h-0.997)*300.0*smoothstep(0.0,0.3,y)*stars; }
        if(aurora>0.5&&y>0.03){ float a=0.0;
          for(int i=0;i<3;i++){ float fi=float(i); float band=sin(d.x*2.6+fi*1.7+time*0.05)*0.6+sin(d.z*4.2-time*0.07+fi)*0.35;
            float k=exp(-pow((y-0.3-0.07*fi-band*0.1)*13.0,2.0)); a+=k*(0.55+0.45*sin(d.x*35.0+d.z*28.0+time*0.5+fi*3.0)); }
          c+=mix(vec3(0.1,1.0,0.55),vec3(0.65,0.25,1.0),clamp(y*2.0-0.5,0.0,1.0))*a*0.5; }
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  W.ownMats.push(m); W.skyU=u;
  const sky=new T.Mesh(new T.SphereGeometry(6000,32,16),m); sky.frustumCulled=false; sky.renderOrder=-1; W.scene.add(sky); W.sky=sky;
}
function buildTerrain(co,tr,q){
  const N=q.grid, SIZE=co.size, half=SIZE/2, cell=SIZE/N, noise=makeNoise(co.seed); W.noise=noise;
  const samp=[]; for(let i=0;i<M;i+=3) samp.push(tr.P[i]);
  const H=new Float32Array((N+1)*(N+1)), c=co.carve, [bx0,bx1,bz0,bz1]=tr.box, reach=c.outer+20;
  for(let iz=0;iz<=N;iz++) for(let ix=0;ix<=N;ix++){
    const x=-half+ix*cell, z=-half+iz*cell; let h=co.height(noise,x,z);
    if(x>bx0-reach&&x<bx1+reach&&z>bz0-reach&&z<bz1+reach){
      let bd=Infinity, by=0; for(const p of samp){ const dx=p.x-x, dz=p.z-z, d=dx*dx+dz*dz; if(d<bd){ bd=d; by=p.y; } }
      bd=Math.sqrt(bd);
      if(bd<c.outer){ const floor=by-c.depth+(co.floor?co.floor(noise,x,z):0); h=lerp(Math.min(h,floor),h,smooth(c.inner,c.outer,bd)); }
    }
    H[iz*(N+1)+ix]=h;
  }
  W.hm={H,N,half,cell};
  const g=new T.PlaneGeometry(SIZE,SIZE,N,N); g.rotateX(-Math.PI/2);
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setY(i,H[i]);
  g.computeVertexNormals();
  const nrm=g.attributes.normal, col=new Float32Array(pos.count*3), cc=new T.Color();
  for(let i=0;i<pos.count;i++){ const v=noise.n(pos.getX(i)*0.02,pos.getZ(i)*0.02)*0.5+0.5; co.color(H[i],nrm.getY(i),v,cc); col[i*3]=cc.r; col[i*3+1]=cc.g; col[i*3+2]=cc.b; }
  g.setAttribute('color',new T.BufferAttribute(col,3));
  const m=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.95,metalness:0}); W.ownMats.push(m);
  if(q.detail){ // fine grain, patches and strata in the fragment shader: adds close-up detail without adding any triangles
    const strata=co.id==='canyon'?1.0:0.0;
    m.onBeforeCompile=sh=>{
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=position;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vWP;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        { float d=length(vWP-cameraPosition), fade=1.0-smoothstep(300.0,1500.0,d);
          float pat=vn(vWP.xz*0.012), grain=vn(vWP.xz*0.9)*0.6+vn(vWP.xz*3.7)*0.4;
          diffuseColor.rgb*=1.0+((pat-0.5)*0.42+(grain-0.5)*0.34)*fade;
          diffuseColor.rgb*=1.0+${strata.toFixed(1)}*(sin(vWP.y*1.3+vn(vWP.xz*0.05)*6.0)*0.07)*fade; }`);
    };
    m.customProgramCacheKey=()=>'terrainDetail'+strata;
  }
  const mesh=new T.Mesh(g,m); mesh.receiveShadow=true; mesh.castShadow=q.shadow>=2048; W.scene.add(mesh);
}
function buildHorizon(co){
  // two rings of far-away mountains hide the edge of the world; they tint toward the haze colour the further away they are
  const grp=new T.Group(), base=new T.Color(co.fog[0]), rock=new T.Color(co.stars?'#2c3f62':co.rock), noise=W.noise;
  const layers=[{R:3750,h:620*(co.hz??1),f:0.0019,ofs:11,mix:0.3},{R:3200,h:420*(co.hz??1),f:0.0030,ofs:57,mix:0.55}];
  const mt=new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide,depthWrite:false}); W.ownMats.push(mt);
  for(const L of layers){
    const seg=200, pos=new Float32Array((seg+1)*6), col=new Float32Array((seg+1)*6), idx=[], top=base.clone().lerp(rock,L.mix);
    for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2, cx=Math.cos(a), cz=Math.sin(a);
      const n=noise.ridge(cx*L.R*L.f+L.ofs,cz*L.R*L.f+L.ofs,4), hgt=Math.max(-40,n*L.h*1.35-110);
      pos.set([cx*L.R,hgt,cz*L.R],i*6); pos.set([cx*L.R,-250,cz*L.R],i*6+3);
      col.set([top.r,top.g,top.b],i*6); col.set([base.r,base.g,base.b],i*6+3);
      if(i<seg){ const k=i*2; idx.push(k,k+1,k+2,k+1,k+3,k+2); } }
    const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setAttribute('color',new T.BufferAttribute(col,3)); g.setIndex(idx);
    const m=new T.Mesh(g,mt); m.frustumCulled=false; m.renderOrder=-0.5; grp.add(m);
  }
  W.scene.add(grp); W.horizon=grp; W.horizonMat=mt; W.horizonBase=base.clone();
}
function heightAt(x,z){
  const {H,N,half,cell}=W.hm, fx=(x+half)/cell, fz=(z+half)/cell;
  if(fx<0||fz<0||fx>=N||fz>=N) return -200;
  const ix=Math.floor(fx), iz=Math.floor(fz), u=fx-ix, v=fz-iz, a=H[iz*(N+1)+ix], b=H[iz*(N+1)+ix+1], c=H[(iz+1)*(N+1)+ix], d=H[(iz+1)*(N+1)+ix+1];
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}
function groundAt(x,z){ let g=heightAt(x,z); if(W.co.water&&g<0.5) g=0.5; if(W.usc){ const b=bAt(x,z); if(b&&b.h>g) g=b.h; } return g; } // roofs count as ground
function buildWater(co){
  const DN=512, dd=new Uint8Array(DN*DN), hm=W.hm;
  for(let j=0;j<DN;j++) for(let i=0;i<DN;i++){ const h=heightAt(-hm.half+(i+0.5)/DN*hm.half*2,-hm.half+(j+0.5)/DN*hm.half*2); dd[j*DN+i]=clamp((h+60)/80*255,0,255); }
  const dTex=new T.DataTexture(dd,DN,DN,T.RedFormat,T.UnsignedByteType); dTex.magFilter=dTex.minFilter=T.LinearFilter; dTex.wrapS=dTex.wrapT=T.ClampToEdgeWrapping; dTex.unpackAlignment=1; dTex.needsUpdate=true; W.dTex=dTex;
  const u={dTex:{value:dTex},hh:{value:hm.half},time:{value:0},deep:{value:new T.Color(co.water.deep)},shallow:{value:new T.Color(co.water.shallow)},skyc:{value:new T.Color(co.sky.hor)},
    sunDir:{value:W.sunDir},sunCol:{value:new T.Color(co.sun.col)},fogC:{value:new T.Color(co.fog[0])},fogNear:{value:co.fog[1]},fogFar:{value:co.fog[2]},camPos:{value:new T.Vector3()}};
  const m=new T.ShaderMaterial({uniforms:u,
    vertexShader:`uniform float time; varying vec3 vW;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0);
        w.y+=sin(w.x*0.02+time*0.8)*1.1+sin(w.z*0.031-time*0.9)*0.8+sin((w.x+w.z)*0.05+time*1.4)*0.35;
        vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform vec3 deep,shallow,skyc,sunDir,sunCol,fogC,camPos; uniform float fogNear,fogFar,time,hh; uniform sampler2D dTex; varying vec3 vW;
      void main(){
        vec2 p=vW.xz;
        float dx=cos(p.x*0.02+time*0.8)*0.022+cos((p.x+p.y)*0.05+time*1.4)*0.018+cos(p.x*0.21+p.y*0.13+time*2.1)*0.05+cos(p.x*0.37-p.y*0.29-time*2.7)*0.035+cos(p.x*0.9+p.y*0.7+time*3.1)*0.02;
        float dz=cos(p.y*0.031-time*0.9)*0.025+cos((p.x+p.y)*0.05+time*1.4)*0.018+cos(p.y*0.23-p.x*0.11+time*1.9)*0.05+cos(p.y*0.41+p.x*0.33+time*2.3)*0.035+cos(p.y*0.8-p.x*0.6-time*2.9)*0.02;
        vec3 n=normalize(vec3(-dx,1.0,-dz)); vec3 v=normalize(camPos-vW);
        float fr=pow(1.0-max(dot(n,v),0.0),4.0);
        vec3 c=mix(shallow,deep,smoothstep(0.0,0.6,v.y));
        c=mix(c,skyc,clamp(fr*0.85+0.05,0.0,1.0));
        vec3 h=normalize(normalize(sunDir)+v); c+=sunCol*pow(max(dot(n,h),0.0),220.0)*3.0;
        vec2 uvh=(vW.xz+hh)/(hh*2.0); float inside=step(0.0,uvh.x)*step(uvh.x,1.0)*step(0.0,uvh.y)*step(uvh.y,1.0);
        float dep=-(texture2D(dTex,uvh).r*80.0-60.0);
        float dist=length(camPos-vW);
        c=mix(c+vec3(0.06,0.16,0.13),c,mix(1.0,smoothstep(0.0,16.0,dep),inside));
        float wob=sin(dep*2.4-time*1.5+sin(p.x*0.35+p.y*0.27)*1.6);
        float foam=smoothstep(2.6+wob*0.7,0.0,dep)*smoothstep(-0.6,0.1,dep)*inside*(0.65+0.35*sin(p.x*0.8+p.y*0.9+time))*(1.0-smoothstep(900.0,2200.0,dist));
        c=mix(c,vec3(0.96,0.99,1.0),clamp(foam,0.0,1.0)*0.9);
        float f=smoothstep(fogNear,fogFar,dist); c=mix(c,fogC,f);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  W.ownMats.push(m); W.waterU=u;
  const g=new T.PlaneGeometry(14000,14000,150,150); g.rotateX(-Math.PI/2);
  const water=new T.Mesh(g,m); water.frustumCulled=false; W.scene.add(water); W.water=water;
}
function buildTrees(co,q){
  const rnd=mulberry32(co.seed+7), pine=co.trees==='pine';
  const fol=pine?new T.ConeGeometry(3.2,11,7):new T.IcosahedronGeometry(4,1), trunk=new T.CylinderGeometry(0.5,0.7,4,6);
  fol.translate(0,pine?9:7.5,0); trunk.translate(0,2,0);
  const fm=mat(pine?'#1f3d2c':'#3f8a3a',{flat:true,r:0.9}), tm=mat('#5a3d27',{r:0.9});
  const iF=new T.InstancedMesh(fol,fm,Math.round(q.trees*1.6)), iT=new T.InstancedMesh(trunk,tm,Math.round(q.trees*1.6));
  const m4=new T.Matrix4(), qt=new T.Quaternion(), s=new T.Vector3(), p=new T.Vector3(), up=new T.Vector3(0,1,0), cc=new T.Color(); let n=0;
  const N=Math.round(q.trees*1.6), span=co.size*0.7; // spread over the whole land so travel mode has forests too
  for(let tries=0;tries<N*12&&n<N;tries++){
    let x=(rnd()-0.5)*span, z=(rnd()-0.5)*span;
    if(rnd()<0.65){ const tp=W.tr.P[Math.floor(rnd()*M)], ta=rnd()*6.283, tr2=50+rnd()*rnd()*330; x=tp.x+Math.cos(ta)*tr2; z=tp.z+Math.sin(ta)*tr2; } // most trees line the course
    const h=heightAt(x,z);
    if(W.lms.some(l=>(l.x-x)**2+(l.z-z)**2<75*75)) continue;
    if(h<6||h>(pine?200:140)) continue;
    const sl=Math.abs(heightAt(x+4,z)-h)+Math.abs(heightAt(x,z+4)-h); if(sl>3.2) continue;
    if(pine&&h>150&&rnd()<0.6) continue;
    let bd=Infinity, by=0; for(let i=0;i<M;i+=6){ const p=W.tr.P[i], dx=p.x-x, dz=p.z-z, d=dx*dx+dz*dz; if(d<bd){ bd=d; by=p.y; } }
    if(Math.sqrt(bd)<TUBE+40&&h+20>by-TUBE*0.7) continue;
    const k=0.7+rnd()*0.8; s.set(k,k*(0.8+rnd()*0.5),k); p.set(x,h-0.5,z); qt.setFromAxisAngle(up,rnd()*6.28);
    m4.compose(p,qt,s); iF.setMatrixAt(n,m4); iT.setMatrixAt(n,m4);
    cc.set(pine?'#1f3d2c':'#3f8a3a').offsetHSL((rnd()-0.5)*0.05,0,(rnd()-0.5)*0.12); iF.setColorAt(n,cc); n++;
  }
  iF.count=iT.count=n; iF.castShadow=true; iF.receiveShadow=true; W.scene.add(iF,iT);
}
function buildClouds(co,q){
  const rnd=mulberry32(co.seed+3), n=Math.round(co.clouds.n*q.cloud), per=7;
  const g=new T.IcosahedronGeometry(1,2);
  const m=new T.MeshStandardMaterial({color:co.clouds.dark?'#56657c':'#ffffff',roughness:1,metalness:0,emissive:co.clouds.dark?'#0c1522':'#8fa3b8',emissiveIntensity:co.clouds.dark?0.4:0.35,flatShading:false});
  W.ownMats.push(m);
  const im=new T.InstancedMesh(g,m,n*per), m4=new T.Matrix4(), qt=new T.Quaternion(), s=new T.Vector3(), p=new T.Vector3(), cc=new T.Color(), dk=new T.Color(co.clouds.dark?'#7d8aa3':'#8d9db8'); let k=0;
  for(let i=0;i<n;i++){
    const a=rnd()*Math.PI*2, r=200+rnd()*1700, cx=Math.cos(a)*r+100, cz=Math.sin(a)*r+300, cy=lerp(co.clouds.y[0],co.clouds.y[1],rnd()), sz=18+rnd()*30;
    for(let j=0;j<per;j++){ const t=(j/(per-1)-0.5);
      p.set(cx+t*sz*3.2+(rnd()-0.5)*sz,cy+(rnd()-0.3)*sz*0.4,cz+(rnd()-0.5)*sz*1.2); const kk=sz*(0.6+rnd()*0.6)*(1-Math.abs(t)*0.8);
      s.set(kk*1.3,kk*0.75,kk); m4.compose(p,qt,s); im.setMatrixAt(k,m4); cc.set('#ffffff').lerp(dk,clamp(0.5-(p.y-cy)/(sz*0.55),0,1)*0.55); im.setColorAt(k++,cc); }
  }
  im.count=k; W.scene.add(im); W.clouds=im;
}
function checkerTex(){
  const c=document.createElement('canvas'); c.width=256; c.height=16; const g=c.getContext('2d');
  for(let i=0;i<32;i++) for(let j=0;j<2;j++){ g.fillStyle=(i+j)%2?'#111':'#fff'; g.fillRect(i*8,j*8,8,8); }
  const t=new T.CanvasTexture(c); t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(4,1); t.colorSpace=T.SRGBColorSpace; return t;
}
function buildCourseMarks(co,tr){
  const night=!!co.stars;
  // course gates every ~80 m
  const step=Math.max(10,Math.round(80/tr.seg)), gates=[]; for(let i=step;i<M-step/2;i+=step) gates.push(i);
  const gm=new T.MeshStandardMaterial({color:night?'#7fe0ff':'#5fd0ff',emissive:night?'#4fc8ff':'#36b4ff',emissiveIntensity:night?1.6:0.9,roughness:0.4,transparent:true,opacity:0.85});
  W.ownMats.push(gm);
  const ig=new T.InstancedMesh(new T.TorusGeometry(TUBE*0.62,0.55,8,56),gm,gates.length), o=new T.Object3D();
  gates.forEach((i,k)=>{ o.position.copy(tr.P[i]); o.lookAt(tr.P[i].clone().add(tr.TG[i])); o.updateMatrix(); ig.setMatrixAt(k,o.matrix); });
  W.raceG.add(ig);
  // start / finish arch
  const sm=new T.MeshStandardMaterial({map:checkerTex(),roughness:0.6,emissive:'#ffffff',emissiveIntensity:0.15}); W.ownMats.push(sm);
  const start=new T.Mesh(new T.TorusGeometry(TUBE*0.75,1.6,10,64),sm); start.position.copy(tr.P[0]); start.lookAt(tr.P[0].clone().add(tr.TG[0])); W.raceG.add(start);
  const banner=new T.Mesh(new T.PlaneGeometry(26,5),new T.MeshBasicMaterial({map:textTex('START · FINISH','#ffffff','rgba(10,14,20,.8)'),transparent:true,side:T.DoubleSide,fog:false}));
  banner.position.copy(tr.P[0]).addScaledVector(tr.U[0],TUBE*0.75+4); banner.lookAt(banner.position.clone().sub(tr.TG[0])); W.raceG.add(banner);
  // golden updraft rings every ~320 m
  const rstep=Math.round(320/tr.seg), rm=new T.MeshStandardMaterial({color:'#ffd24a',emissive:'#ffb300',emissiveIntensity:1.4,roughness:0.3,metalness:0.4}); W.ownMats.push(rm);
  const dm=new T.MeshBasicMaterial({color:'#ffe9a0',transparent:true,opacity:0.18,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}); W.ownMats.push(dm);
  const rnd=mulberry32(co.seed+19);
  for(let i=Math.round(rstep*0.6);i<M-20;i+=rstep){
    const a=(rnd()-0.5)*TUBE*0.8, b=(rnd()-0.5)*TUBE*0.5, p=tr.P[i].clone().addScaledVector(tr.S[i],a).addScaledVector(tr.U[i],b);
    const g=new T.Group(); g.position.copy(p); g.lookAt(p.clone().add(tr.TG[i]));
    g.add(new T.Mesh(new T.TorusGeometry(6,0.55,10,40),rm)); g.add(new T.Mesh(new T.CircleGeometry(5.6,32),dm));
    W.raceG.add(g); W.rings.push({i,p,g});
  }
  // drifting wind motes that show the way
  const n=700, pos=new Float32Array(n*3), seeds=new Float32Array(n*3), r2=mulberry32(co.seed+5);
  for(let k=0;k<n;k++){ seeds[k*3]=r2()*M; seeds[k*3+1]=(r2()-0.5)*2; seeds[k*3+2]=(r2()-0.5)*2; }
  const pg=new T.BufferGeometry(); pg.setAttribute('position',new T.BufferAttribute(pos,3));
  const pm=new T.PointsMaterial({color:night?'#bfe8ff':'#ffffff',size:0.7,transparent:true,opacity:0.55,depthWrite:false,blending:T.AdditiveBlending}); W.ownMats.push(pm);
  const pts=new T.Points(pg,pm); pts.frustumCulled=false; W.raceG.add(pts); W.motes={pts,seeds,n};
}
function textTex(txt,fg,bg){
  const c=document.createElement('canvas'); c.width=512; c.height=96; const g=c.getContext('2d');
  if(bg){ g.fillStyle=bg; g.beginPath(); g.roundRect(4,4,504,88,20); g.fill(); }
  g.font='bold 56px "DM Sans",system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=fg; g.fillText(txt,256,50);
  const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; return t;
}

/* ---------- obstacles (placed from the course seed, moving ones timed by the wall clock so every player sees the same thing) ---------- */
function rockGeo(r,seed,capCol,baseCol){
  const g=new T.IcosahedronGeometry(r,1), p=g.attributes.position, rnd=mulberry32(seed), v=new T.Vector3();
  const cache=new Map();
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const k=`${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    let f=cache.get(k); if(f==null){ f=0.75+rnd()*0.45; cache.set(k,f); } v.multiplyScalar(f); if(v.y<0) v.y*=1.5; p.setXYZ(i,v.x,v.y,v.z); }
  const col=new Float32Array(p.count*3), c=new T.Color(), cb=new T.Color(baseCol), ct=new T.Color(capCol);
  for(let i=0;i<p.count;i++){ c.copy(cb); if(capCol&&p.getY(i)>r*0.35) c.copy(ct); c.offsetHSL(0,0,(rnd()-0.5)*0.08); col.set([c.r,c.g,c.b],i*3); }
  g.setAttribute('color',new T.BufferAttribute(col,3)); g.computeVertexNormals(); return g;
}
function buildObstacles(co,tr){
  const rnd=mulberry32(co.seed*7+1), step=Math.round(150/tr.seg);
  const rm=co.ice?mat('#ffffff',{vc:true,flat:true,r:0.25,m:0.1}):mat('#ffffff',{vc:true,flat:true,r:0.95});
  let k=0;
  for(let i=Math.round(0.08*M);i<0.95*M;i+=step+Math.floor(rnd()*step*0.5)){
    if(W.rings.some(r=>Math.abs(r.i-i)<15)) continue;
    const type=co.obs[k++%co.obs.length], P=tr.P[i], S=tr.S[i], U=tr.U[i], TG=tr.TG[i], ph=rnd()*Math.PI*2;
    const o={type,i,ph,spheres:[],cyl:null};
    if(type==='rock'){
      const r=6+rnd()*5, a=(rnd()<0.5?-1:1)*(4+rnd()*12), b=(rnd()-0.5)*14;
      o.c=P.clone().addScaledVector(S,a).addScaledVector(U,b); o.r=r;
      o.mesh=new T.Mesh(rockGeo(r,i,co.ice?null:co.top,co.rock),rm); o.mesh.position.copy(o.c); o.mesh.castShadow=true; o.mesh.receiveShadow=true;
      o.spheres=[{p:o.c,r:r*0.82}];
    } else if(type==='orbit'){
      o.r=4.5; o.rad=11+rnd()*5; o.period=6+rnd()*4; o.S=S; o.U=U; o.P=P;
      o.mesh=new T.Mesh(co.ice?new T.OctahedronGeometry(o.r,0):rockGeo(o.r,i,null,co.rock),co.ice?mat('#bfe8ff',{r:0.15,m:0.2,e:'#3f9fff',ei:0.6,flat:true}):rm);
      o.mesh.castShadow=true; o.c=new T.Vector3(); o.spheres=[{p:o.c,r:o.r*0.9}];
      o.mesh.scale.set(1,co.ice?1.8:1,1);
    } else if(type==='balloon'){
      o.base=P.clone().addScaledVector(S,(rnd()-0.5)*TUBE*0.9); o.period=8+rnd()*6; o.c=new T.Vector3(); o.basket=new T.Vector3();
      const cols=[['#e63946','#f1faee'],['#ffb703','#fb8500'],['#2a9d8f','#e9c46a'],['#7b2cbf','#ffd166']][Math.floor(rnd()*4)];
      const eg=new T.SphereGeometry(7,24,16), ep=eg.attributes.position, ec=new Float32Array(ep.count*3), ca=new T.Color(cols[0]), cb=new T.Color(cols[1]);
      for(let j=0;j<ep.count;j++){ const ang=Math.atan2(ep.getX(j),ep.getZ(j)), c=Math.floor((ang+Math.PI)/(Math.PI/6))%2?ca:cb; ec.set([c.r,c.g,c.b],j*3); if(ep.getY(j)<-3) ep.setY(j,ep.getY(j)*1.25); }
      eg.setAttribute('color',new T.BufferAttribute(ec,3)); eg.computeVertexNormals();
      const g=new T.Group(); const env=new T.Mesh(eg,mat('#ffffff',{vc:true,r:0.6})); env.scale.y=1.15; env.castShadow=true; g.add(env);
      const bk=new T.Mesh(new T.BoxGeometry(2.4,1.8,2.4),mat('#7a5230',{r:0.9})); bk.position.y=-12.5; bk.castShadow=true; g.add(bk);
      const lp=[]; for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) lp.push(x*1.1,-11.6,z*1.1,x*3.2,-6.8,z*3.2);
      const lg=new T.BufferGeometry(); lg.setAttribute('position',new T.Float32BufferAttribute(lp,3)); g.add(new T.LineSegments(lg,new T.LineBasicMaterial({color:'#3b2b1e'})));
      const fl=new T.Mesh(new T.ConeGeometry(0.6,1.6,8),new T.MeshBasicMaterial({color:'#ffb347'})); fl.position.y=-10.6; g.add(fl); o.flame=fl;
      o.mesh=g; o.r=8; o.spheres=[{p:o.c,r:7.6},{p:o.basket,r:1.9}];
    } else if(type==='turbine'){
      const side=rnd()<0.5?-1:1; o.hub=P.clone().addScaledVector(S,side*(TUBE*0.75)).addScaledVector(U,3); o.S=S; o.U=U; o.period=7+rnd()*3; o.blade=TUBE*0.8;
      const g=new T.Group(), wm=mat('#f3f5f7',{r:0.5}), gh=groundAt(o.hub.x,o.hub.z), tall=Math.max(4,o.hub.y-gh);
      const tw=new T.Mesh(new T.CylinderGeometry(0.9,1.5,tall,10),wm); tw.position.copy(o.hub); tw.position.y-=tall/2+2; tw.castShadow=true; g.add(tw);
      const rot=new T.Group(); rot.position.copy(o.hub); rot.matrixAutoUpdate=true;
      const basis=new T.Matrix4().makeBasis(S.clone().negate(),U,TG); // right-handed: local x = -S rot.quaternion.setFromRotationMatrix(basis); g.add(rot);
      const nac=new T.Mesh(new T.BoxGeometry(2.2,2.2,6),wm); nac.position.z=-2; nac.castShadow=true; rot.add(nac);
      const spin=new T.Group(); rot.add(spin); spin.add(new T.Mesh(new T.SphereGeometry(1.4,12,8),wm));
      for(let b=0;b<3;b++){ const bl=new T.Mesh(new T.BoxGeometry(o.blade,1.6,0.35),wm); bl.geometry.translate(o.blade/2,0,0); bl.rotation.z=b*2*Math.PI/3; bl.castShadow=true; spin.add(bl);
        const tipm=new T.Mesh(new T.BoxGeometry(3,1.62,0.37),mat('#e63946',{r:0.5})); tipm.position.set(o.blade-1.5,0,0); bl.add(tipm); }
      o.spin=spin; o.mesh=g;
      for(let b=0;b<3;b++) for(let j=0;j<5;j++) o.spheres.push({p:new T.Vector3(),r:1.7,b,j});
    } else if(type==='storm'){
      o.c=P.clone().addScaledVector(S,(rnd()-0.5)*14); o.r=22; o.next=0;
      const g=new T.Group(), sm=mat(co.ice?'#3a4658':'#4b505c',{r:1}), r2=mulberry32(i);
      for(let j=0;j<14;j++){ const s=8+r2()*9, m=ell(sm,s*1.3,s*0.8,s,(r2()-0.5)*30,(r2()-0.4)*14,(r2()-0.5)*30); m.castShadow=false; g.add(m); }
      g.position.copy(o.c); o.mesh=g;
      const bolt=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#e8f0ff',fog:false})); bolt.visible=false; W.scene.add(bolt); o.bolt=bolt;
      W.storms.push(o);
    } else if(type==='pillar'){
      const a=(rnd()<0.5?-1:1)*(rnd()*11), x=P.x+S.x*a, z=P.z+S.z*a, r=5+rnd()*3, gh=heightAt(x,z)-5, top=P.y+60+rnd()*40;
      const g=new T.CylinderGeometry(r*0.75,r*1.1,top-gh,9,6), pp=g.attributes.position, r3=mulberry32(i), col=new Float32Array(pp.count*3), c=new T.Color();
      const SC=['#b5562f','#c8693a','#d98b55','#a94a2a','#e2a36b'];
      for(let j=0;j<pp.count;j++){ const f=0.85+r3()*0.3; pp.setX(j,pp.getX(j)*f); pp.setZ(j,pp.getZ(j)*f); c.set(SC[Math.abs(Math.floor((pp.getY(j)+400)/7))%SC.length]); col.set([c.r,c.g,c.b],j*3); }
      g.setAttribute('color',new T.BufferAttribute(col,3)); g.computeVertexNormals();
      o.mesh=new T.Mesh(g,rm); o.mesh.position.set(x,(top+gh)/2,z); o.mesh.castShadow=true; o.mesh.receiveShadow=true;
      o.cyl={x,z,r:r*1.0,top}; o.c=new T.Vector3(x,P.y,z);
    }
    W.scene.add(o.mesh); W.obs.push(o);
  }
  updateObstacles(0);
}
function updateObstacles(dt){
  const t=Date.now()/1000;
  for(const o of W.obs){
    if(o.type==='orbit'){ const a=2*Math.PI*t/o.period+o.ph; o.c.copy(o.P).addScaledVector(o.S,Math.cos(a)*o.rad).addScaledVector(o.U,Math.sin(a)*o.rad); o.mesh.position.copy(o.c); o.mesh.rotation.set(t*0.7+o.ph,t*0.9,0); }
    else if(o.type==='balloon'){ const y=Math.sin(2*Math.PI*t/o.period+o.ph)*12; o.c.copy(o.base); o.c.y+=y; o.mesh.position.copy(o.c); o.basket.copy(o.c); o.basket.y-=12.5; o.flame.scale.setScalar(0.8+0.4*Math.abs(Math.sin(t*9+o.ph))); }
    else if(o.type==='turbine'){ const a=2*Math.PI*t/o.period+o.ph; o.spin.rotation.z=a;
      for(const s of o.spheres){ const ang=a+s.b*2*Math.PI/3, d=4+s.j*(o.blade-4)/4; s.p.copy(o.hub).addScaledVector(o.S,-Math.cos(ang)*d).addScaledVector(o.U,Math.sin(ang)*d); } }
    else if(o.type==='rock'){ o.mesh.rotation.y=t*0.05+o.ph; }
    else if(o.type==='storm'){ o.mesh.rotation.y=t*0.03; }
  }
}

/* ---------- particles, trails, speed lines ---------- */
function buildParticles(){
  const n=500, g=new T.BufferGeometry(); parts.pos=new Float32Array(n*3); parts.col=new Float32Array(n*3); parts.vel=new Float32Array(n*3); parts.life=new Float32Array(n); parts.n=n; parts.k=0;
  g.setAttribute('position',new T.BufferAttribute(parts.pos,3)); g.setAttribute('color',new T.BufferAttribute(parts.col,3));
  const m=new T.PointsMaterial({size:0.9,vertexColors:true,transparent:true,opacity:0.95,depthWrite:false}); W.ownMats.push(m);
  const p=new T.Points(g,m); p.frustumCulled=false; W.scene.add(p); parts.obj=p;
  for(let i=0;i<n;i++) parts.pos[i*3+1]=-9999;
  // speed lines live in camera space
  const ln=90, lg=new T.BufferGeometry(), lp=new Float32Array(ln*6);
  lg.setAttribute('position',new T.BufferAttribute(lp,3));
  const lm=new T.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}); W.ownMats.push(lm);
  const lines=new T.LineSegments(lg,lm); lines.frustumCulled=false;
  const rnd=Math.random; W.speed={lines,lp,ln,seeds:Array.from({length:ln},()=>({a:rnd()*6.28,r:5+rnd()*8,z:-rnd()*70}))};
  R.camera.clear(); R.camera.add(lines); W.scene.add(R.camera);
}
function burst(p,color,n,sp){
  const c=new T.Color(color);
  for(let j=0;j<n;j++){ const i=parts.k=(parts.k+1)%parts.n; parts.pos[i*3]=p.x; parts.pos[i*3+1]=p.y; parts.pos[i*3+2]=p.z;
    const u=Math.random()*2-1, a=Math.random()*6.28, s=Math.sqrt(1-u*u), v=sp*(0.3+Math.random()*0.7);
    parts.vel[i*3]=s*Math.cos(a)*v; parts.vel[i*3+1]=u*v; parts.vel[i*3+2]=s*Math.sin(a)*v; parts.life[i]=0.8+Math.random()*0.7;
    parts.col[i*3]=c.r; parts.col[i*3+1]=c.g; parts.col[i*3+2]=c.b; }
}
function updateParticles(dt){
  for(let i=0;i<parts.n;i++){ if(parts.life[i]<=0) continue; parts.life[i]-=dt;
    if(parts.life[i]<=0){ parts.pos[i*3+1]=-9999; continue; }
    parts.pos[i*3]+=parts.vel[i*3]*dt; parts.pos[i*3+1]+=parts.vel[i*3+1]*dt; parts.pos[i*3+2]+=parts.vel[i*3+2]*dt; parts.vel[i*3+1]-=6*dt;
    parts.vel[i*3]*=1-dt; parts.vel[i*3+2]*=1-dt; }
  parts.obj.geometry.attributes.position.needsUpdate=true; parts.obj.geometry.attributes.color.needsUpdate=true;
}
const TRAIL_N=34;
function makeTrail(color){
  const n=TRAIL_N, g=new T.BufferGeometry(), pos=new Float32Array(n*4*3), al=new Float32Array(n*4), idx=[];
  for(let r=0;r<2;r++) for(let i=0;i<n-1;i++){ const a=r*n*2+i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); }
  g.setIndex(idx); g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setAttribute('a',new T.BufferAttribute(al,1));
  const m=new T.ShaderMaterial({uniforms:{col:{value:new T.Color(color)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    vertexShader:`attribute float a; varying float vA; void main(){ vA=a; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 col; varying float vA; void main(){ gl_FragColor=vec4(col*vA,vA); }`});
  const mesh=new T.Mesh(g,m); mesh.frustumCulled=false;
  return {mesh,pos,al,hist:[],m};
}
function updateTrail(tr,model,alpha){
  const half=model.userData.half, n=TRAIL_N;
  const rec=tr.hist.length>=n?tr.hist.pop():[new T.Vector3(),new T.Vector3()]; // recycle the oldest point instead of allocating
  model.localToWorld(rec[0].set(half*0.98,0.1,-0.1)); model.localToWorld(rec[1].set(-half*0.98,0.1,-0.1)); tr.hist.unshift(rec);
  const w=0.22*model.scale.x, P=tr.pos, A=tr.al, last=tr.hist.length-1;
  for(let r=0;r<2;r++) for(let i=0;i<n;i++){
    const h=tr.hist[i<last?i:last][r], a=r*n*2+i*2, f=1-i/n, o=a*3;
    P[o]=h.x; P[o+1]=h.y+w*f; P[o+2]=h.z; P[o+3]=h.x; P[o+4]=h.y-w*f; P[o+5]=h.z;
    A[a]=A[a+1]=f*f*alpha;
  }
  tr.mesh.geometry.attributes.position.needsUpdate=true; tr.mesh.geometry.attributes.a.needsUpdate=true;
}
function nameSprite(name,color){
  const tex=textTex(name.slice(0,16),color,'rgba(10,14,20,.55)');
  const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,fog:false})); s.scale.set(6.5,1.22,1); return s;
}

/* ---------- racers ---------- */
function newRacer(o){
  const r={id:o.id,name:o.name,c:o.c,isMe:!!o.isMe,isBot:!!o.isBot,pos:new T.Vector3(),fwd:new T.Vector3(0,0,1),yaw:0,pitch:0,roll:0,v:30,stam:1,exhaust:false,boostVis:0,flex:0,
    idx:0,lap:0,cp:true,prog:0,tumble:0,inv:0,updraft:0,rocket:0,storm:false,off:false,offT:0,fin:null,wrong:0,lastRing:null,ai:o.ai||null,model:null,trail:null,label:null,phase:Math.random()*10};
  attachModel(r); return r;
}
function attachModel(r){
  if(!W) return;
  if(r.model) W.scene.remove(r.model); if(r.trail) W.scene.remove(r.trail.mesh); if(r.label) W.scene.remove(r.label);
  r.model=buildBird(BD[r.c]); if(W.co.usc) r.model.scale.setScalar(cityBirdScale(r)); W.scene.add(r.model);
  r.trail=makeTrail(r.isMe?'#b9f0cf':'#ffffff'); W.ownMats.push(r.trail.m); W.scene.add(r.trail.mesh);
  if(!r.isMe){ r.label=nameSprite(r.name||'?',r.isBot?'#ffe08a':'#ffffff'); W.scene.add(r.label); }
  r.trail.hist=[];
}
function removeRacer(r){ if(!W) return; W.scene.remove(r.model); W.scene.remove(r.trail.mesh); if(r.label) W.scene.remove(r.label); }
function placeAt(r,i,side=0,back=0){
  const tr=W.tr; i=((i-back)%M+M)%M;
  r.pos.copy(tr.P[i]).addScaledVector(tr.S[i],side).addScaledVector(tr.U[i],1);
  r.yaw=Math.atan2(tr.TG[i].x,tr.TG[i].z); r.pitch=Math.asin(clamp(tr.TG[i].y,-1,1)); r.roll=0; r.idx=i;
  r.fwd.copy(tr.TG[i]);
}
function respawn(r){ placeAt(r,r.idx); r.v=26; r.inv=2; r.tumble=0; r.off=false; r.offT=0; r.trail.hist=[]; if(r.isMe) banner={t:'Back on course',until:performance.now()+1200,c:'#b9f0cf'}; }
function hit(r,o,center){
  if(r.inv>0) return;
  const B=BD[r.c];
  r.v*=B.tough?0.6:0.35; r.tumble=B.quick?0.55:B.tough?0.6:0.9; r.inv=1.6;
  if(center){ const d=r.pos.clone().sub(center); const L=d.length()||1; r.pos.addScaledVector(d,3/L); }
  burst(r.pos,BD[r.c].look.body,26,9); burst(r.pos,'#ffffff',10,6);
  if(r.isMe){ shake=0.6; banner={t:o==='ground'?'Crash! Fly higher':'Bonk!',until:performance.now()+900,c:'#ff8a65'}; sfx('hit'); emote('ouch',1); }
}
function autoSteer(r,ahead,la=0,lb=0){
  const tr=W.tr, li=(r.idx+ahead)%M, P=tr.P[li], S=tr.S[li], U=tr.U[li];
  const dx=P.x+S.x*la+U.x*lb-r.pos.x, dy=P.y+S.y*la+U.y*lb-r.pos.y, dz=P.z+S.z*la+U.z*lb-r.pos.z, hz=Math.hypot(dx,dz);
  const yErr=wrapA(Math.atan2(dx,dz)-r.yaw), pErr=Math.atan2(dy,hz)-r.pitch;
  return {turn:clamp(-yErr*2.4,-1,1),pitch:clamp(pErr*2.6,-1,1)};
}
function stepRacer(r,inp,dt){
  const B=BD[r.c], tr=W.tr;
  r.updraft=Math.max(0,r.updraft-dt); r.rocket=Math.max(0,r.rocket-dt); r.tumble=Math.max(0,r.tumble-dt); r.inv=Math.max(0,r.inv-dt);
  // boost from flex, limited by stamina
  const L=clamp(inp.flex||0,0,1); r.flex=L;
  if(r.stam<=0.02) r.exhaust=true; else if(r.exhaust&&r.stam>0.35) r.exhaust=false;
  const use=r.exhaust?0:L;
  r.stam=clamp(r.stam-use*0.2/B.stam*dt+(use<0.12?0.17*B.stam:0.035)*dt,0,1);
  r.boostVis+=(use-r.boostVis)*Math.min(1,dt*8);
  let target=40*B.spd+34*B.boost*use+(r.updraft>0?16:0)+(r.rocket>0?24:0);
  if(r.storm) target*=0.6; if(r.off) target*=0.7; if(r.tumble>0) target*=0.5;
  r.v=approach(r.v,target,(target>r.v?11*B.acc:22)*dt);
  // steering
  let turn=clamp(inp.turn||0,-1,1), pitch=clamp(inp.pitch||0,-1,1);
  if(r.tumble>0){ turn*=0.2; pitch*=0.2; }
  const hnd=B.hnd*(1-0.22*r.boostVis);
  r.yaw=wrapA(r.yaw-turn*1.6*hnd*dt);
  r.pitch=clamp(r.pitch+pitch*1.2*hnd*dt,-0.85,0.85);
  if(inp.level) r.pitch*=1-Math.min(1,0.5*dt);
  r.roll+=(turn*0.8-r.roll)*Math.min(1,dt*5); if(r.tumble>0) r.roll+=dt*14;
  const cp=Math.cos(r.pitch); r.fwd.set(Math.sin(r.yaw)*cp,Math.sin(r.pitch),Math.cos(r.yaw)*cp);
  r.pos.addScaledVector(r.fwd,r.v*dt);
  if(W.usc&&uscPush(r,r.pos.y-r.fwd.y*r.v*dt)) hit(r,'bld',null);
  // ground and ceiling
  const gnd=groundAt(r.pos.x,r.pos.z);
  if(r.pos.y<gnd+2.2){ const hard=r.pos.y<gnd+1.2; r.pos.y=gnd+2.2; r.pitch=Math.max(r.pitch,0.3); if(hard) hit(r,'ground',null); }
  if(r.pos.y>650){ r.pos.y=650; r.pitch=Math.min(r.pitch,0); }
  // progress along the course
  const prev=r.idx, [i,d]=nearest(tr,r.pos,r.idx,28); r.idx=i;
  if(prev>M*0.85&&i<M*0.15){ if(r.cp){ r.lap++; r.cp=false; } } else if(prev<M*0.15&&i>M*0.85){ r.lap--; r.cp=true; }
  if(i>M*0.45&&i<M*0.55) r.cp=true;
  r.prog=r.lap+i/M;
  r.off=d>TUBE;
  if(r.off){ const c=tr.P[i], dir=c.clone().sub(r.pos).normalize(); r.pos.addScaledVector(dir,(d-TUBE)*1.6*dt); r.offT+=dt; } else r.offT=0;
  if(d>TUBE+110||r.offT>6) respawn(r);
  r.wrong=r.fwd.dot(tr.TG[i])<-0.2?r.wrong+dt:0;
  // obstacles
  r.storm=false;
  for(const o of W.obs){
    if(Math.abs(((o.i-i+M*1.5)%M)-M/2)>70) continue;
    if(o.type==='storm'){ if(r.pos.distanceTo(o.c)<o.r) r.storm=true; continue; }
    if(o.cyl){ const dx=r.pos.x-o.cyl.x, dz=r.pos.z-o.cyl.z; if(dx*dx+dz*dz<(o.cyl.r+HIT_R)**2&&r.pos.y<o.cyl.top) hit(r,o,new T.Vector3(o.cyl.x,r.pos.y,o.cyl.z)); continue; }
    for(const s of o.spheres) if(r.pos.distanceToSquared(s.p)<(s.r+HIT_R)**2){ hit(r,o,s.p); break; }
  }
  for(const ring of W.rings) if(ring!==r.lastRing&&r.pos.distanceToSquared(ring.p)<7.2*7.2){
    r.lastRing=ring; r.updraft=1.7; r.stam=Math.min(1,r.stam+0.25); burst(ring.p,'#ffd24a',20,10);
    if(r.isMe){ banner={t:'Updraft!',until:performance.now()+800,c:'#ffd24a'}; sfx('ring'); } }
  if(phase==='race'&&r.fin==null&&r.lap>laps){ r.fin=(performance.now()-raceT0)/1000; onFinish(r); }
}
function botInput(r,t,leader){
  const tr=W.tr, ai=r.ai, ahead=24;
  let la=Math.sin(t*0.23+ai.seed)*TUBE*0.3, lb=Math.sin(t*0.31+ai.seed*2)*TUBE*0.18;
  for(const o of W.obs){ const di=(o.i-r.idx+M)%M; if(di>70||o.type==='storm'&&ai.skill<0.95) continue;
    const ref=o.cyl?null:(o.c||o.hub); if(!o.cyl&&!ref) continue;
    const Po=tr.P[o.i], So=tr.S[o.i], Uo=tr.U[o.i], rx=(o.cyl?o.cyl.x:ref.x)-Po.x, ry=(o.cyl?Po.y:ref.y)-Po.y, rz=(o.cyl?o.cyl.z:ref.z)-Po.z;
    const oa=rx*So.x+ry*So.y+rz*So.z, ob=o.cyl?lb:rx*Uo.x+ry*Uo.y+rz*Uo.z, rr=(o.type==='turbine'?o.blade:o.type==='storm'?o.r:(o.r||o.cyl?.r||6))+7;
    let dx=la-oa, dy=lb-ob, dd=Math.hypot(dx,dy);
    if(o.type==='turbine'){ la=-Math.sign(oa)*TUBE*0.6; continue; }
    if(dd<rr){ if(dd<0.01){ dx=oa>0?-1:1; dy=0; dd=1; } la=oa+dx/dd*rr; lb=ob+dy/dd*rr; } }
  la=clamp(la,-TUBE*0.85,TUBE*0.85); lb=clamp(lb,-TUBE*0.6,TUBE*0.6);
  const st=autoSteer(r,ahead,la,lb);
  let flex=r.stam>0.3?clamp(0.45+0.35*Math.sin(t*0.4+ai.seed),0,1)*ai.skill:0;
  if(leader&&leader!==r){ const gap=r.prog-leader.prog; if(gap>0.08) flex*=0.4; else if(gap<-0.12) flex=Math.min(1,flex+0.35); }
  return {turn:st.turn,pitch:st.pitch,flex};
}

/* ---------- my input ---------- */
function myFlex(dt){
  const f=EMG().flex?EMG().flex():null; let L=0, src='none';
  if(f&&f.ready&&f.level!=null){ L=f.level; src=f.method==='rms'?'RMS curve':'ML'; }
  if(ctrl==='kb'){ L=0; src='none'; } // keyboard only: the muscle is ignored
  const kb=(ctrl==='kb'||(ctrl==='all'&&(mode==='travel'||$('rKeyBoost').checked)))&&keys[' '];
  kbRamp=kb?Math.min(1,kbRamp+dt*1.6):Math.max(0,kbRamp-dt*4);
  if(kbRamp>L){ L=kbRamp; src='keyboard'; }
  const hf=handFlex(); if(hf>L){ L=hf; src='hand'; }
  return {L,src,ready:!!f?.ready,trained:!!f?.trained};
}
let kbTurn=0, kbPitch=0;
function myInput(dt,fx){
  const r=me.r, inv=$('rInvert').checked?-1:1;
  let turn=0, pitch=0;
  if(ctrl!=='eyes'){ // keys ease in and out instead of snapping between full left and full right
    const tt=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0), tp=((keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0))*inv;
    kbTurn=approach(kbTurn,tt,dt*(tt?4.5:7)); kbPitch=approach(kbPitch,tp,dt*(tp?4:6)); turn=kbTurn; pitch=kbPitch;
  } else { kbTurn=0; kbPitch=0; }
  const gz=ctrl!=='kb'?gazeSteer():null; W.gz=gz; // keys win when both are used
  const hs=handActive()&&$('rHand').value==='both'?HandControl.steer():null;   // an open hand steers like a joystick (relative to the neutral spot)
  if(hs){ const f=v=>{ const a=Math.abs(v); return a<0.14?0:Math.sign(v)*clamp(((a-0.14)/0.86)**1.2,0,1); }; if(!turn) turn=f(hs.x); if(!pitch) pitch=-f(hs.y); }
  else if(gz){ if(!turn) turn=gz.turn; if(!pitch) pitch=gz.pitch; }
  if(follow&&mode==='travel'){ const rm=followTarget(); if(!rm){ follow=null; friendSig=''; } else if(Math.abs(kbTurn)>0.3||Math.abs(kbPitch)>0.3){ follow=null; friendSig=''; banner={t:'Flying solo',until:performance.now()+1200,c:'#ffffff'}; } else { const fi=followInput(r,rm); return {turn:fi.turn,pitch:fi.pitch,flex:Math.max(fx.L,fi.flex),level:false}; } }
  if(mode==='travel') return {turn,pitch,flex:fx.L,level:!pitch};
  const assist=$('rAssist').checked||r.off;
  if(assist){ const a=autoSteer(r,26); if(!turn) turn=a.turn*0.85; else turn=clamp(turn+a.turn*0.2,-1,1); if(!pitch) pitch=a.pitch*0.85; }
  if(r.fin!=null){ const a=autoSteer(r,26); turn=a.turn; pitch=a.pitch; }
  return {turn,pitch,flex:fx.L,level:!assist&&!pitch};
}

/* ---------- networking ---------- */
async function join(){
  const name=$('rName').value.trim(), room=$('rRoom').value.trim();
  if(!name){ msg('Enter your name first.',true); return; }
  if(!/^[A-Za-z0-9_-]{4,40}$/.test(room)){ msg('Room code must be 4–40 letters, numbers, - or _.',true); return; }
  me.name=name.slice(0,16); prefs(true); msg('Connecting…'); $('rJoin').disabled=true;
  try{ await EMG().loadMqtt(); }catch(e){ msg(e.message,true); $('rJoin').disabled=false; return; }
  base=`emgposture/v1/race/${room}`; clearRemotes();
  const c=mqtt.connect(EMG().broker(),{clientId:`sr_${me.id}_${EMG().randCode(4)}`,clean:true,connectTimeout:8000,reconnectPeriod:3000});
  client=c;
  c.on('connect',()=>{ c.subscribe([`${base}/s/+`,`${base}/c`,`${base}/e`],{qos:1}); joinSync=true; msg(`In room ${room}. Send the code to friends. When everyone is here, press Start race.`); });
  c.on('message',onMsg);
  c.on('error',e=>msg('Connection error: '+e.message,true));
  c.on('offline',()=>msg('Offline. Retrying…',true));
  $('rLeave').disabled=false; for(const i of ['rRoom','rNewRoom']) $(i).disabled=true;
}
function leave(){
  follow=null; warpTo=null;
  if(client){ client.end(true); client=null; }
  clearRemotes(); if(phase!=='free') backToFree();
  $('rJoin').disabled=false; $('rLeave').disabled=true; for(const i of ['rRoom','rNewRoom']) $(i).disabled=false;
  msg('You left the room. Start race plays against computer birds.');
}
function clearRemotes(){ for(const rm of remotes.values()) if(rm.r) removeRacer(rm.r); remotes.clear(); }
function onMsg(topic,buf){
  let m; try{ m=JSON.parse(buf.toString()); }catch{ return; }
  if(!m||typeof m!=='object') return;
  if(topic===`${base}/e`){ // emotes and calls from friends (shown as bubbles over their bird)
    const id=String(m.id||'').slice(0,16), rm=remotes.get(id); if(!rm||id===me.id) return; const e=String(m.e||'').slice(0,4); if(!e) return; rm.bub={e,until:performance.now()+2600}; if(m.t==='call') (W.ripples||(W.ripples=[])).push({t0:performance.now(),pan:rm.x<me.r.pos.x?-0.5:0.5,own:false}); return; }
  if(topic===`${base}/c`){
    if(m.type==='start'&&Array.isArray(m.ids)) startRace({m:String(m.m||'').slice(0,12),ids:m.ids.map(String).slice(0,12),k:CO[m.k]?m.k:me.course,laps:clamp(num(m.laps,3)|0,1,5),bots:0});
    else if(m.type==='env'||m.type==='found') onSharedMsg(m);
    else if(m.type==='course'&&CO[m.k]&&phase==='free'&&m.by!==me.id&&me.course!==m.k){ pickCourse(m.k,true); msg(`${String(m.n||'Someone').slice(0,16)} switched the course to ${CO[m.k].name}.`); }
    else if(m.type==='fin'&&m.m===matchId&&typeof m.id==='string') finMsgs.set(m.id.slice(0,12),{n:String(m.n||'?').slice(0,16),time:clamp(num(m.time),0,3600)});
    return;
  }
  const id=topic.split('/').pop(); if(id===me.id) return;
  let rm=remotes.get(id);
  const c=BD[m.c]?m.c:'peregrine', n=String(m.n||'?').slice(0,16);
  let fresh=false; if(!rm){ rm={id}; remotes.set(id,rm); fresh=!joinSync; }
  Object.assign(rm,{n,c,x:clamp(num(m.x),-5000,5000),y:clamp(num(m.y),-200,1000),z:clamp(num(m.z),-5000,5000),yw:num(m.yw),pt:clamp(num(m.pt),-1.5,1.5),rl:num(m.rl),v:clamp(num(m.v),0,200),
    b:clamp(num(m.b),0,1),g:num(m.g),l:num(m.l)|0,f:m.f==null?null:clamp(num(m.f),0,3600),mt:String(m.m||''),k:CO[m.k]?m.k:null,md:m.md==='travel'?'travel':'race',recv:performance.now()});
  if(joinSync&&rm.k&&phase==='free'){ joinSync=false; if(rm.k!==me.course){ pickCourse(rm.k,true); msg(`Joined ${rm.n}'s map: ${CO[rm.k].name}. Press T to fly to them.`); }
    if(rm.md==='travel'&&mode!=='travel'&&phase==='free') setMode('travel'); } // a newcomer lands on the same map and in the same mode as the room
  if(fresh) setTimeout(envShare,500+Math.random()*700); // people already here tell a newcomer what the sky is doing
  if(T&&W){
    if(!rm.r||rm.r.c!==c||rm.r.name!==n){ if(rm.r) removeRacer(rm.r); rm.r=newRacer({id,name:n,c}); rm.r.pos.set(rm.x,rm.y,rm.z); rm.r.yaw=rm.yw; }
  }
}
function publishState(){
  const r=me.r; if(!client?.connected||!r) return;
  const R2=v=>Math.round(v*100)/100, R1=v=>Math.round(v*10)/10;
  client.publish(`${base}/s/${me.id}`,JSON.stringify({n:me.name,c:me.c,x:R1(r.pos.x),y:R1(r.pos.y),z:R1(r.pos.z),yw:R2(r.yaw),pt:R2(r.pitch),rl:R2(r.roll),v:R1(r.v),b:R2(r.boostVis),
    g:Math.round(r.prog*1000)/1000,l:r.lap,f:r.fin,m:matchId||'',k:me.course,md:mode}),{qos:0});
}
/* ---------- travelling together ---------- */
let joinSync=false;
function sendEmote(e,t){ if(!client?.connected) return; client.publish(`${base}/e`,JSON.stringify({id:me.id,e,t:t||'emo'}),{qos:0}); me.bub={e,until:performance.now()+2600}; }
function friendsHere(){ return [...remotes.values()].filter(rm=>rm.r&&rm.k===me.course); }
function inviteLink(){ const room=$('rRoom').value.trim(); const u=location.protocol==='file:'?'':location.href.split('#')[0]; return `${u}#sr=${encodeURIComponent(room)}&course=${me.course}&mode=${mode}`; }
function drawFriends(g,Wv,Hv,now){
  const list=friendsHere(), cam=R.camera, p=me.r.pos; g.save(); g.textAlign='center'; g.textBaseline='middle';
  const bubble=(x,y,e)=>{ g.font='28px system-ui,"Apple Color Emoji","Segoe UI Emoji"'; g.fillStyle='rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(x-22,y-52,44,40,12); g.fill(); g.beginPath(); g.moveTo(x-6,y-13); g.lineTo(x+6,y-13); g.lineTo(x,y-5); g.fill(); g.fillStyle='#000'; g.fillText(e,x,y-31); };
  if(me.bub&&now<me.bub.until){ const v=sv('fm').copy(p).project(cam); if(v.z<1) bubble((v.x*0.5+0.5)*Wv,(-v.y*0.5+0.5)*Hv-30,me.bub.e); }
  for(const rm of list){ const r=rm.r, d=r.pos.distanceTo(p), col=BD[rm.c]?.look.body||'#fff', v=sv('fr').copy(r.pos); v.y+=3; v.project(cam); const on=v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1;
    if(on){ const x=(v.x*0.5+0.5)*Wv, y=(-v.y*0.5+0.5)*Hv, s=clamp(1.15-d/900,0.7,1.1); g.font=`700 ${Math.round(14*s)}px "DM Sans",system-ui`; const t=`${rm.n}  ${d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km'}`, w=g.measureText(t).width+22;
      g.fillStyle='rgba(12,18,28,0.72)'; g.beginPath(); g.roundRect(x-w/2,y-15,w,28,14); g.fill(); g.fillStyle=col; g.beginPath(); g.arc(x-w/2+11,y-1,5,0,6.283); g.fill(); g.fillStyle='#fff'; g.fillText(t,x+5,y-1);
      if(rm.bub&&now<rm.bub.until) bubble(x,y-18,rm.bub.e); }
    else { const dx=r.pos.x-p.x, dz=r.pos.z-p.z, f=cam.getWorldDirection(sv('fd')), rx=f.z, rz=-f.x, sx=dx*rx+dz*rz, sy=-(dx*f.x+dz*f.z), a=Math.atan2(sy,sx), m=44, cx=Wv/2, cy=Hv/2, k=Math.min((cx-m)/Math.max(0.01,Math.abs(Math.cos(a))),(cy-m)/Math.max(0.01,Math.abs(Math.sin(a)))), x=cx+Math.cos(a)*k, y=cy+Math.sin(a)*k;
      g.save(); g.translate(x,y); g.rotate(a); g.fillStyle=col; g.strokeStyle='rgba(0,0,0,0.5)'; g.lineWidth=3; g.beginPath(); g.moveTo(16,0); g.lineTo(-10,-12); g.lineTo(-4,0); g.lineTo(-10,12); g.closePath(); g.stroke(); g.fill(); g.restore();
      g.font='700 12px "DM Sans",system-ui'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,0.6)'; g.lineWidth=3; const t=`${rm.n} ${Math.round(d)} m`; g.strokeText(t,x,y+24); g.fillText(t,x,y+24); } }
  { const ft=followTarget(); if(ft){ g.font='700 15px "DM Sans",system-ui'; g.fillStyle='#b9f0cf'; g.fillText(`Following ${ft.n} · steer to take over`,Wv/2,Hv*0.17); } }
  const away=[...remotes.values()].filter(rm=>rm.k&&rm.k!==me.course);
  if(away.length){ g.font='600 12px "DM Sans",system-ui'; g.fillStyle='#ffd27f'; g.fillText(away.map(a=>`${a.n} is in ${CO[a.k].name}`).join(' · '),Wv/2,Hv-112); }
  g.restore();
}
function updateRemotes(dt,now){
  for(const [id,rm] of remotes){
    const age=(now-rm.recv)/1000;
    if(age>4){ if(rm.r) removeRacer(rm.r); remotes.delete(id); continue; }
    const r=rm.r; if(!r) continue;
    const cp=Math.cos(rm.pt), fx=Math.sin(rm.yw)*cp, fy=Math.sin(rm.pt), fz=Math.cos(rm.yw)*cp, e=Math.min(age,0.25)*rm.v;
    const tx=rm.x+fx*e, ty=rm.y+fy*e, tz=rm.z+fz*e;
    if(Math.hypot(tx-r.pos.x,ty-r.pos.y,tz-r.pos.z)>60) r.pos.set(tx,ty,tz);
    else { const k=Math.min(1,dt*10); r.pos.x+=(tx-r.pos.x)*k; r.pos.y+=(ty-r.pos.y)*k; r.pos.z+=(tz-r.pos.z)*k; }
    const k=Math.min(1,dt*10); r.yaw=wrapA(r.yaw+wrapA(rm.yw-r.yaw)*k); r.pitch+=(rm.pt-r.pitch)*k; r.roll+=(rm.rl-r.roll)*k;
    r.boostVis=rm.b; r.v=rm.v; r.prog=rm.g; r.lap=rm.l; r.fin=rm.mt===matchId?rm.f:null;
    if(r.model) r.model.visible=!rm.k||rm.k===me.course; // friends on another map are not drawn here
  }
}

/* ---------- race flow ---------- */
function startClicked(){
  if(mode!=='race'){ msg('Switch Mode to Race to start a race.',true); return; }
  if(!T||!W){ msg('The 3D world is still loading.',true); return; }
  if(phase==='countdown'||phase==='race'){ msg('A race is already running.'); return; }
  const n=+$('rLaps').value||3;
  if(client?.connected){
    const now=performance.now(), ids=[me.id,...[...remotes.entries()].filter(([,r])=>now-r.recv<3000).map(([id])=>id)];
    if(ids.length>=2){ client.publish(`${base}/c`,JSON.stringify({type:'start',m:EMG().randCode(6),ids,k:me.course,laps:n}),{qos:1}); return; }
    msg('Nobody else is in the room yet, so this race is against computer birds.');
  }
  startRace({m:'solo-'+EMG().randCode(4),ids:[me.id],k:me.course,laps:n,bots:+$('rBots').value||0});
}
function startRace(m){
  if(mode!=='race') setMode('race',true);
  if(m.k!==me.course){ me.course=m.k; prefs(true); buildWorld(m.k); }
  matchId=m.m; participants=m.ids; laps=m.laps; finMsgs.clear(); firstFin=0;
  for(const b of racers) if(!b.isMe) removeRacer(b);
  racers=[me.r];
  const rnd=mulberry32(Date.now()&0xffff), pool=BIRDS.filter(b=>b.id!==me.c);
  for(let k=0;k<m.bots;k++){ const B=pool[Math.floor(rnd()*pool.length)];
    racers.push(newRacer({id:'bot'+k,name:BOT_NAMES[(k*3+Math.floor(rnd()*10))%BOT_NAMES.length],c:B.id,isBot:true,ai:{skill:0.82+rnd()*0.2,seed:rnd()*100}})); }
  const order=[...participants].sort(), myIdx=order.indexOf(me.id), all=[...racers.filter(r=>r.isBot)];
  const slot=(s,r)=>{ placeAt(r,0,(s%2?1:-1)*7,10+Math.floor(s/2)*7); Object.assign(r,{v:0,lap:0,cp:true,fin:null,stam:1,exhaust:false,tumble:0,inv:0,updraft:0,rocket:0,lastRing:null}); r.trail.hist=[]; };
  const r=me.r;
  if(myIdx>=0) slot(myIdx,r); else { r.fin=null; }
  all.forEach((b,k)=>slot(order.length+k,b));
  phase='countdown'; goAt=performance.now()+4000; banner=null;
  msg(myIdx<0?'A race started without you. Fly around and watch; you can join the next one.':'Get ready! Hold a 45–75% flex when GO appears for a rocket start.');
}
function onFinish(r){
  if(!firstFin) firstFin=performance.now();
  if(r.isMe){ banner={t:`Finished ${ord(placeOf(r))}!`,until:performance.now()+3000,c:'#ffe45e'};
    if(client?.connected&&participants.includes(me.id)) client.publish(`${base}/c`,JSON.stringify({type:'fin',m:matchId,id:me.id,n:me.name,time:r.fin}),{qos:1}); }
}
function standings(){
  const list=[];
  const inRace=phase!=='free';
  if(!inRace||participants.includes(me.id)) list.push({id:me.id,n:me.name||'You',c:me.c,prog:me.r.prog,fin:me.r.fin,me:true});
  for(const r of racers) if(r.isBot) list.push({id:r.id,n:r.name,c:r.c,prog:r.prog,fin:r.fin,bot:true});
  for(const [id,rm] of remotes){ if(inRace&&!participants.includes(id)) continue; const f=finMsgs.get(id)?.time??(rm.mt===matchId?rm.f:null); list.push({id,n:rm.n,c:rm.c,prog:rm.g,fin:inRace?f:null}); }
  if(inRace) for(const id of participants) if(!list.some(x=>x.id===id)){ const f=finMsgs.get(id); if(f) list.push({id,n:f.n,c:'peregrine',prog:laps+1,fin:f.time}); }
  list.sort((a,b)=>(a.fin!=null)!==(b.fin!=null)?(a.fin!=null?-1:1):a.fin!=null?a.fin-b.fin:b.prog-a.prog);
  return list;
}
function placeOf(r){ const s=standings(); return s.findIndex(x=>x.id===r.id)+1; }
function checkRaceOver(now){
  const s=standings(), allDone=s.every(x=>x.fin!=null);
  const meDone=me.r.fin!=null||!participants.includes(me.id);
  if(allDone||(meDone&&firstFin&&now-firstFin>30000)||(firstFin&&now-firstFin>90000)){ phase='done'; doneAt=now+10000; W.final=s; }
}
function backToFree(){
  phase='free'; participants=[]; matchId=null;
  for(const b of racers) if(!b.isMe) removeRacer(b);
  racers=me.r?[me.r]:[];
  if(me.r){ me.r.fin=null; me.r.lap=0; me.r.cp=true; }
  msg(client?'Free flight. Press Start race when everyone has joined.':'Free flight. Press Start race to race computer birds.');
}

/* ---------- control schemes: keyboard / eyes / flex ---------- */
function gazeNow(){ const E=window.EyeControl; return E&&E.gaze?E.gaze():null; }
function eyeSteering(){ return ctrl!=='kb'&&EMG().activeTab()==='tabRace'&&!!window.EyeControl?.running?.()&&!menuOpen; }
// Gaze relative to the centre of the 3D view: outside a small dead zone, looking left/right turns and looking up/down climbs/dives.
function gazeSteer(){
  const g=gazeNow(); if(!g) return null;
  const rc=$('raceCanvas').getBoundingClientRect(); if(rc.width<10) return null;
  const sens=clamp(+$('rEyeSens').value||1,0.4,2.5), r=g.r||18, dead=clamp(Math.max(0.14,r/(rc.width/2)*0.7),0.14,0.3); // a wider gaze region (less certain gaze) widens the dead zone
  const nx=clamp((g.x-(rc.left+rc.width/2))/(rc.width/2),-1.3,1.3), ny=clamp((g.y-(rc.top+rc.height*0.46))/(rc.height/2),-1.3,1.3);
  const f=v=>{ const a=Math.abs(v); return a<dead?0:Math.sign(v)*clamp(((a-dead)/(1-dead))**1.25*sens,0,1); };
  if(gazeInHot()) return {turn:0,pitch:0,sx:g.x-rc.left,sy:g.y-rc.top,dead,r,hot:true}; // looking at the Menu button doesn't steer
  return {turn:f(nx),pitch:-f(ny),sx:g.x-rc.left,sy:g.y-rc.top,dead,r};
}

/* ---------- travel mode: places to discover ---------- */
// where = placement rule (see WHERE). t = journal line shown when you find it.
const LANDMARKS={
  coast:[
    {n:'Lighthouse Point',k:'lighthouse',where:'shore',t:'A striped lighthouse on the headland. Its lamp turns all night for the fishing boats.'},
    {n:'Harbour Village',k:'village',where:'shoreFlat',t:'Whitewashed cottages with red roofs. Smoke curls up from the chimneys.'},
    {n:'Old Windmill',k:'windmill',where:'hill',t:'A stone windmill on the hill, its sails turning in the sea breeze.'},
    {n:'Standing Stones',k:'stones',where:'hill',t:'A ring of ancient standing stones on a quiet hilltop.'},
    {n:'Sailing Bay',k:'boats',where:'deep',t:'Sailboats tack back and forth across the open bay.'},
  ],
  canyon:[
    {n:'Sun Arch',k:'arch',where:'top',t:'A natural stone arch, carved by wind and rain over thousands of years. Fly through it!'},
    {n:'Cliff Dwellings',k:'pueblo',where:'floorFlat',t:'Adobe homes stacked in terraces, with wooden beams poking out of the walls.'},
    {n:'Desert Camp',k:'camp',where:'floorFlat',t:'A few tents around a crackling campfire.'},
    {n:'Balanced Rock',k:'balanced',where:'top',t:'A huge boulder resting on a thin stone column. Nobody knows how long it will stay.'},
    {n:'Hoodoo Garden',k:'hoodoos',where:'top',t:'A forest of thin rock spires, each wearing a hard stone cap.'},
  ],
  la:[
    {n:'U.S. Bank Tower',k:'usc',by:'U.S. Bank Tower',t:'At 310 m it is the tallest building in California west of the Rockies, with its famous glass crown.'},
    {n:'Wilshire Grand Center',k:'usc',by:'Wilshire Grand Building',t:'The tallest building west of the Mississippi at 335 m, topped with a sail-shaped spire.'},
    {n:'Aon Center',k:'usc',by:'Aon Center',t:'A 263 m white tower from 1974, once the tallest in the city.'},
    {n:'Cathedral of Our Lady of the Angels',k:'usc',by:'Cathedral of Our Lady of the Angels',t:'The mother church of Los Angeles, finished in 2002 with huge sand-coloured walls.'},
    {n:'Bradbury Building',k:'usc',by:'Bradbury Building',t:'A 1893 landmark famous for its glowing atrium. Film fans know it from Blade Runner.'},
    {n:'The Broad',k:'usc',by:'The Broad Museum',t:'A contemporary art museum wrapped in a white lattice shell called the veil.'},
    {n:'Pershing Square',k:'usc',by:'@pl:Pershing Square',t:'The oldest public park in Los Angeles, with a purple bell tower.'},
    {n:'Grand Park',k:'usc',by:'@pl:Gloria Molina Grand Park',t:'A long green ribbon running from City Hall down toward the Music Center.'},
  ],
  usc:[
    {n:'Tommy Trojan',k:'usc',by:'@Tommy',t:'The bronze Trojan warrior, unveiled in 1930, is the heart of campus. Students gather at his feet before big games.'},
    {n:'Shumway Fountain',k:'usc',by:'@fo:Hahn Plaza',t:'The big tiered fountain in Hahn Plaza. Its jets are a favourite backdrop for photos, and it even appeared in the 1967 film The Graduate.'},
    {n:'Bovard Administration Building',k:'usc',by:'Bovard Administration Building',t:'USC\'s landmark building with its tall tower has looked over the campus since 1921.'},
    {n:'Leavey Library',k:'usc',by:'Leavey Library',t:'One of the busiest places to study on campus, packed with students at exam time.'},
    {n:'Galen Center',k:'usc',by:'Galen Center',t:'The indoor arena opened in 2006. Trojan basketball and volleyball play here.'},
    {n:'Los Angeles Memorial Coliseum',k:'usc',by:'@st:Los Angeles Memorial Coliseum',t:'Home of Trojan football. It hosted the Olympic Games in 1932 and 1984 and will host them again in 2028. Fly right into the bowl!'},
    {n:'School of Cinematic Arts',k:'usc',by:'School of Cinematic Arts - SCA',t:'Film students learn their craft here, in one of the first film schools in the country.'},
    {n:'Seeley G. Mudd Building',k:'usc',by:'Seeley G. Mudd Building',t:'One of the tallest buildings on campus. The view from above is worth the climb.'},
    {n:'Alumni Park',k:'usc',by:'@pl:Alumni Park',t:'A green lawn in the middle of campus where students relax between classes.'},
  ],
  fjord:[
    {n:'Fishing Village',k:'village',where:'shoreFlat',t:'Painted wooden houses by the water, windows glowing warm in the cold night.'},
    {n:'Stave Church',k:'church',where:'flatLow',t:'An old wooden church with stacked, steep roofs.'},
    {n:'Ice Arch',k:'icearch',where:'high',t:'A glowing arch of blue glacier ice high on the mountain.'},
    {n:'Summit Cairn',k:'cairn',where:'peak',t:'A pile of stones and a red flag mark the highest peak around.'},
    {n:'Northern Lighthouse',k:'lighthouse',where:'shore',t:'A lonely lighthouse sweeping its beam across the dark fjord.'},
  ],
};
const FLOCK={usc:{col:'#8f959c',n:4,size:1.2},la:{col:'#8f959c',n:5,size:1.2},coast:{col:'#f2f2ee',n:4,size:1.5},canyon:{col:'#2e2622',n:4,size:1.1},fjord:{col:'#dfe7f0',n:3,size:1.3}};
let found={};
function travelSave(){ try{ localStorage.setItem('emgPosture.travel',JSON.stringify({found})); }catch{} }
function travelLoad(){ try{ const p=JSON.parse(localStorage.getItem('emgPosture.travel')||'{}'); if(p.found&&typeof p.found==='object') for(const k of Object.keys(CO)) if(Array.isArray(p.found[k])) found[k]=p.found[k].filter(x=>typeof x==='string').slice(0,20); }catch{} }

function slope(x,z,r){ const h=heightAt(x,z); return Math.max(Math.abs(heightAt(x+r,z)-h),Math.abs(heightAt(x-r,z)-h),Math.abs(heightAt(x,z+r)-h),Math.abs(heightAt(x,z-r)-h)); }
function nearWater(x,z,d){ for(let k=0;k<8;k++){ const a=k*Math.PI/4; if(heightAt(x+Math.cos(a)*d,z+Math.sin(a)*d)<-1) return true; } return false; }
const WHERE={
  shore:(x,z,h)=>h>4&&h<45&&slope(x,z,14)<7&&nearWater(x,z,70),
  shoreFlat:(x,z,h)=>h>3&&h<35&&slope(x,z,30)<6&&nearWater(x,z,110),
  hill:(x,z,h)=>h>45&&h<190&&slope(x,z,20)<6,
  deep:(x,z,h)=>h<-14&&[[150,0],[-150,0],[0,150],[0,-150]].every(([a,b])=>heightAt(x+a,z+b)<-6),
  top:(x,z,h)=>h>195&&slope(x,z,30)<4,
  floorFlat:(x,z,h)=>h<160&&slope(x,z,25)<3,
  flatLow:(x,z,h)=>h>4&&h<80&&slope(x,z,25)<6,
  high:(x,z,h)=>h>170&&h<330&&slope(x,z,20)<14,
  peak:(x,z,h)=>h>260,
};
// second try for steep places like the fjord: same idea, looser limits
const LOOSE={
  shore:(x,z,h)=>h>2&&h<70&&slope(x,z,14)<16&&nearWater(x,z,130),
  shoreFlat:(x,z,h)=>h>2&&h<70&&slope(x,z,20)<14&&nearWater(x,z,150),
  flatLow:(x,z,h)=>h>3&&h<130&&slope(x,z,20)<12,
};
function spotFree(x,z,minTrack){
  for(let i=0;i<M;i+=6){ const p=W.tr.P[i]; if((p.x-x)**2+(p.z-z)**2<minTrack*minTrack) return false; }
  return W.lms.every(l=>(l.x-x)**2+(l.z-z)**2>420*420);
}
function findSpot(rnd,where){
  const ext=W.co.size*0.33, tests=[WHERE[where],LOOSE[where],(x,z,h)=>h>2&&slope(x,z,20)<8].filter(Boolean);
  for(const test of tests) for(let k=0;k<5000;k++){
    let x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z);
    if(!test(x,z,h)||!spotFree(x,z,where==='deep'?40:80)) continue;
    if(where==='peak'&&test===tests[0]){ for(let s=0;s<80;s++){ let bx=x,bz=z,bh=h; for(const [a,b] of [[8,0],[-8,0],[0,8],[0,-8]]){ const hh=heightAt(x+a,z+b); if(hh>bh){ bh=hh; bx=x+a; bz=z+b; } } if(bh===h) break; x=bx; z=bz; h=bh; } if(!spotFree(x,z,80)) continue; }
    return {x,z,h};
  }
  return null;
}

/* landmark models (sizes in metres; the bird is about 2–3 m across) */
function cyl(m,rt,rb,h,y0,seg=16){ const me=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),m); me.position.y=y0+h/2; me.castShadow=true; me.receiveShadow=true; return me; }
function box(m,w,h,d,x,y,z){ const me=new T.Mesh(new T.BoxGeometry(w,h,d),m); me.position.set(x,y,z); me.castShadow=true; me.receiveShadow=true; return me; }
function roof(m,w,h,d,y){ const g=new T.ConeGeometry(Math.SQRT1_2,1,4); g.rotateY(Math.PI/4); const me=new T.Mesh(g,m); me.scale.set(w,h,d); me.position.y=y+h/2; me.castShadow=true; return me; }
function strataGeo(geo,cols,seed,jit){
  const p=geo.attributes.position, r=mulberry32(seed), cache=new Map(), col=new Float32Array(p.count*3), c=new T.Color();
  for(let i=0;i<p.count;i++){ const k=`${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`; let f=cache.get(k); if(!f){ f=[(r()-0.5)*jit,(r()-0.5)*jit,(r()-0.5)*jit]; cache.set(k,f); }
    p.setXYZ(i,p.getX(i)+f[0],p.getY(i)+f[1]*0.5,p.getZ(i)+f[2]); c.set(cols[Math.abs(Math.floor((p.getY(i)+500)/3.2))%cols.length]); col.set([c.r,c.g,c.b],i*3); }
  geo.setAttribute('color',new T.BufferAttribute(col,3)); geo.computeVertexNormals(); return geo;
}
const ROCK_STRATA=['#b5562f','#c8693a','#d98b55','#a94a2a','#e2a36b'];
const LM_BUILD={
  lighthouse(L,rnd,night){
    const g=new T.Group(), white=mat('#f4f1ea',{r:0.6}), red=mat('#c8323a',{r:0.6});
    g.add(cyl(mat('#8d8a84',{flat:true,r:0.9}),6.5,7.5,5,-2,10));
    for(let k=0;k<6;k++) g.add(cyl(k%2?red:white,3.4-(k+1)*0.2,3.4-k*0.2,4.5,3+k*4.5));
    g.add(cyl(mat('#2a2d33',{r:0.5,m:0.5}),3.1,3.1,0.6,30));
    g.add(cyl(mat('#fff2b0',{e:'#ffd76a',ei:night?2.5:0.8,r:0.2}),1.7,1.7,3,30.6,12));
    g.add(cyl(red,0.05,2.5,2.6,33.6,12));
    const pivot=new T.Group(); pivot.position.y=32.1; g.add(pivot);
    const bm=new T.MeshBasicMaterial({color:'#fff6c8',transparent:true,opacity:night?0.2:0.06,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}); W.ownMats.push(bm);
    for(const s of [1,-1]){ const cg=new T.ConeGeometry(9,90,20,1,true); cg.translate(0,-45,0); cg.rotateZ(s*Math.PI/2); pivot.add(new T.Mesh(cg,bm)); }
    return {g,top:36,solid:4.2,anim:t=>{ pivot.rotation.y=t*0.7; }};
  },
  village(L,rnd,night){
    const g=new T.Group(), fj=W.co.id==='fjord';
    const walls=fj?['#8a2f2a','#c9a040','#3d5a6c','#e8e2d6','#6b2d2a']:['#f3efe6','#efe3c8','#e3ecef','#f2d9cb'];
    const roofs=fj?['#2f2f33','#3a3330']:['#b5442f','#9a3b2c','#3f5368'];
    const win=night?mat('#ffd27a',{e:'#ffb347',ei:1.8}):mat('#2b3a4a',{r:0.3,m:0.3}), chim=mat('#6d6862',{r:0.9});
    let n=0;
    for(let tries=0;tries<80&&n<11;tries++){
      const a=rnd()*Math.PI*2, d=8+rnd()*55, x=Math.cos(a)*d, z=Math.sin(a)*d, hh=heightAt(L.x+x,L.z+z);
      if(Math.abs(hh-L.y)>7||hh<1.2) continue;
      const w=6+rnd()*3, d2=6+rnd()*3, hgt=4+rnd()*2.5, house=new T.Group(); house.position.set(x,hh-L.y,z); house.rotation.y=Math.round(rnd()*4)*Math.PI/2+(rnd()-0.5)*0.3;
      house.add(box(mat(walls[Math.floor(rnd()*walls.length)],{r:0.85}),w,hgt+2,d2,0,hgt/2-1,0));
      house.add(roof(mat(roofs[Math.floor(rnd()*roofs.length)],{r:0.8,flat:true}),w*1.15,3+rnd()*1.5,d2*1.15,hgt));
      for(const s of [-1,1]) house.add(box(win,1,1.1,0.12,s*w*0.25,hgt*0.55,d2/2+0.03));
      if(rnd()<0.7){ house.add(box(chim,0.9,3,0.9,w*0.25,hgt+1.8,0)); W.smokeSrc.push(new T.Vector3(L.x+x,hh+hgt+3.4,L.z+z)); }
      g.add(house); n++;
    }
    return {g,top:14};
  },
  windmill(L,rnd){
    const g=new T.Group(); g.rotation.y=rnd()*Math.PI*2;
    g.add(cyl(mat('#e9e1cf',{r:0.85}),2.6,4,16,-1,12)); g.add(cyl(mat('#7a4a2e',{r:0.8,flat:true}),0.3,3.2,4,15,12));
    const sails=new T.Group(); sails.position.set(0,15.5,3.4); g.add(sails);
    const sm=mat('#d8cdb5',{r:0.9}), fm=mat('#5a3d27',{r:0.9});
    for(let k=0;k<4;k++){ const arm=new T.Group(); arm.rotation.z=k*Math.PI/2; sails.add(arm); arm.add(box(fm,0.4,12,0.4,0,6,0)); arm.add(box(sm,2.2,9,0.15,1.3,7,0.1)); }
    sails.add(new T.Mesh(new T.SphereGeometry(0.8,10,8),fm));
    return {g,top:22,solid:3.8,anim:t=>{ sails.rotation.z=t*1.1; }};
  },
  stones(L,rnd){
    const g=new T.Group(), sm=mat('#8f8c85',{flat:true,r:0.95});
    for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, h=4+rnd()*2.5, s=box(sm,1.8,h,1.1,Math.cos(a)*16,h/2-0.6,Math.sin(a)*16); s.rotation.set((rnd()-0.5)*0.12,-a,(rnd()-0.5)*0.12); g.add(s);
      if(k%3===0&&k<12){ const b=(k+1)/14*Math.PI*2, l=box(sm,1.2,0.9,7,Math.cos((a+b)/2)*16,h+0.2,Math.sin((a+b)/2)*16); l.rotation.y=-(a+b)/2; g.add(l); } }
    g.add(box(sm,4,1,2.4,0,0.2,0));
    return {g,top:8};
  },
  boats(L,rnd){
    const g=new T.Group(), boats=[];
    for(let k=0;k<7;k++){
      let c=null; for(let t=0;t<40&&!c;t++){ const cx=(rnd()-0.5)*320, cz=(rnd()-0.5)*320, rad=40+rnd()*80;
        if([0,1,2,3,4,5,6,7].every(j=>heightAt(L.x+cx+Math.cos(j*0.785)*rad,L.z+cz+Math.sin(j*0.785)*rad)<-4)) c={cx,cz,rad}; }
      if(!c) continue;
      const b=new T.Group(), hull=mat(['#f4f4f4','#2f4f6f','#9c3b2e'][k%3],{r:0.6});
      b.add(ell(hull,1.5,0.9,4.6,0,0.1,0)); b.add(box(mat('#a87a4f',{r:0.8}),2.2,0.2,6,0,0.8,0));
      b.add(cyl(mat('#5a3d27'),0.12,0.15,10,0.8,8)); const mast=b.children[2]; mast.position.z=0.8;
      const sc=rnd()<0.3?'#e9d8b0':rnd()<0.2?'#d9534f':'#fbfbf7', smat=mat(sc,{side:true,r:0.9});
      const sg=shapeGeo([[0,1.2],[0,10],[4.2,1.2]]); sg.rotateX(-Math.PI/2); sg.rotateY(Math.PI/2); const sail=new T.Mesh(sg,smat); sail.position.z=0.8; sail.castShadow=true; b.add(sail);
      const jg=shapeGeo([[0,1.2],[0,8.5],[-3,1.2]]); jg.rotateX(-Math.PI/2); jg.rotateY(Math.PI/2); const jib=new T.Mesh(jg,smat); jib.position.z=0.8; b.add(jib);
      b.scale.setScalar(1.2); g.add(b);
      boats.push({b,...c,w:(0.02+rnd()*0.03)*(rnd()<0.5?-1:1),ph:rnd()*6.28});
    }
    return {g,top:10,water:true,anim:t=>{ for(const o of boats){ const a=o.ph+t*o.w, x=o.cx+Math.cos(a)*o.rad, z=o.cz+Math.sin(a)*o.rad, wx=L.x+x, wz=L.z+z;
      const wy=Math.sin(wx*0.02+t*0.8)*1.1+Math.sin(wz*0.031-t*0.9)*0.8+Math.sin((wx+wz)*0.05+t*1.4)*0.35;
      o.b.position.set(x,wy+0.3,z); o.b.rotation.set(Math.sin(t*1.1+o.ph)*0.05,Math.atan2(-Math.sin(a)*o.w,Math.cos(a)*o.w),Math.sign(o.w)*0.12+Math.sin(t*0.9+o.ph)*0.04,'YXZ'); } }};
  },
  arch(L,rnd,night,ice){
    const g=new T.Group(); g.rotation.y=rnd()*Math.PI;
    const geo=strataGeo(new T.TorusGeometry(22,6.5,10,30,Math.PI),ice?['#dff4ff','#bfe6ff','#cdeeff']:ROCK_STRATA,Math.floor(rnd()*1e6),2.2);
    const m=ice?mat('#ffffff',{vc:true,flat:true,r:0.2,m:0.1,e:'#4aa0ff',ei:0.25}):mat('#ffffff',{vc:true,flat:true,r:0.95});
    const a=new T.Mesh(geo,m); a.position.y=-3; a.castShadow=true; a.receiveShadow=true; g.add(a);
    for(const s of [-1,1]){ const f=new T.Mesh(rockGeo(9,Math.floor(rnd()*1e6),null,ice?'#cfeeff':'#a65a35'),m); f.position.set(s*22,-2,0); f.scale.set(1,0.6,1); g.add(f); }
    return {g,top:32};
  },
  icearch(L,rnd,night){ return LM_BUILD.arch(L,rnd,night,true); },
  usc(L,rnd){ // a golden beam marks the place from far away; Tommy Trojan gets his statue
    const g=new T.Group(), bm=new T.MeshBasicMaterial({color:'#ffd24a',transparent:true,opacity:0.2,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}); W.ownMats.push(bm);
    const beam=new T.Mesh(new T.CylinderGeometry(1.2,1.6,90,12,1,true),bm); beam.position.y=45; if(L.n==='Tommy Trojan'||L.n==='Shumway Fountain'){ beam.scale.y=0.7; beam.position.y=43.5; } g.add(beam); // starts above the statue so you can see it
    const gem=new T.Mesh(new T.OctahedronGeometry(2.4,0),mat('#ffd24a',{e:'#ffb300',ei:1.2,r:0.3,m:0.4})); gem.position.y=94; g.add(gem);
    let jets=null;
    if(L.n==='Tommy Trojan'){ // Roger Noble Burnham's bronze warrior (1930): sword point-down in the right hand, Shield of Courage on the left arm, crested helmet, pleated skirt, greaves, on a tall pedestal with bronze relief panels
      const s=new T.Group(); s.scale.setScalar(1.55); g.add(s);
      const bz=mat('#5b4628',{r:0.42,m:0.6}), bz2=mat('#6f5a34',{r:0.38,m:0.65}), pat=mat('#4d6a58',{r:0.5,m:0.4}), st=mat('#d3cbb8',{r:0.85}), st2=mat('#bdb4a0',{r:0.9}), gold=mat('#d9b43a',{r:0.35,m:0.7});
      const ring=cyl(mat('#990000',{r:0.8}),4.6,4.6,0.05,0.02,40); s.add(ring); s.add(cyl(gold,4.75,4.75,0.04,0.0,40)); s.add(cyl(mat('#ddd3bd',{r:0.9}),4.1,4.1,0.06,0.05,40));      // cardinal and gold paving ring
      s.add(box(st2,3.8,0.3,3.8,0,0.2,0)); s.add(box(st,3.3,0.35,3.3,0,0.5,0)); s.add(box(st,2.7,1.9,2.7,0,1.65,0)); s.add(box(st2,3.0,0.18,3.0,0,2.7,0)); s.add(box(st,2.5,1.0,2.5,0,3.3,0)); s.add(box(st2,2.9,0.2,2.9,0,3.9,0));  // stepped plinth, die, cap
      for(const [rx,rz,ry] of [[0,1.37,0],[0,-1.37,0],[1.37,0,1.5708],[-1.37,0,1.5708]]){ const pn=box(bz2,1.7,1.15,0.08,0,0,0); pn.position.set(rx,1.75,rz); pn.rotation.y=ry; s.add(pn); const pl=box(gold,1.2,0.1,0.04,0,0,0); pl.position.set(rx+(rz?0:0.05*Math.sign(rx)),1.0,rz+(rz?0.05*Math.sign(rz):0)); pl.rotation.y=ry; s.add(pl); } // bronze relief panels + inscription plaques
      const y0=4.0, Y=h=>y0+h;
      for(const sx of [-1,1]){ const lx=sx*0.23; const lg=cyl(bz,0.15,0.2,1.05,y0+0.1,10); lg.position.x=lx; lg.position.z=sx>0?0.12:-0.04; s.add(lg);   // legs
        const gr=cyl(bz2,0.16,0.13,0.5,y0+0.08,10); gr.position.set(lx,gr.position.y,sx>0?0.12:-0.04); s.add(gr);                          // greaves
        s.add(box(bz,0.26,0.1,0.5,lx,Y(0.06),sx>0?0.22:0.0)); }                                                                          // sandals
      s.add(cyl(bz,0.4,0.52,0.5,Y(1.1),16)); for(let k=0;k<12;k++){ const a=k/12*6.283, pl=box(bz2,0.08,0.46,0.05,Math.sin(a)*0.5,Y(1.35),Math.cos(a)*0.5); pl.rotation.y=a; s.add(pl); } // pleated skirt
      s.add(cyl(gold,0.41,0.41,0.1,Y(1.55),16));                                                                                           // championship belt
      s.add(cyl(bz,0.5,0.4,0.85,Y(1.62),14)); s.add(ell(bz,0.62,0.4,0.42,0,Y(2.15),0.02)); s.add(ell(bz,0.17,0.17,0.17,-0.46,Y(2.2),0)); s.add(ell(bz,0.17,0.17,0.17,0.46,Y(2.2),0)); // torso, chest, shoulders
      s.add(cyl(bz,0.11,0.12,0.2,Y(2.35),8)); s.add(ell(bz,0.3,0.34,0.32,0,Y(2.58),0));                                                      // neck, head
      s.add(ell(pat,0.36,0.3,0.38,0,Y(2.72),0)); s.add(box(bz2,0.06,0.3,0.05,0,Y(2.45),0.34));  // helmet + nose guard
      for(let k=0;k<7;k++){ const z=-0.34+k*0.11, h=0.12+0.2*Math.sin((k+0.5)/7*Math.PI); s.add(box(pat,0.07,h+0.1,0.1,0,Y(2.95)+h*0.5,z)); }          // the mohawk crest
      const ra=cyl(bz,0.1,0.12,0.7,Y(1.55),8); ra.position.set(0.58,ra.position.y,0.06); ra.rotation.z=-0.12; s.add(ra);                         // right arm
      const sw=cyl(mat('#c9ccd0',{r:0.25,m:0.85}),0.025,0.045,1.7,Y(0.02),6); sw.position.set(0.66,Y(1.0),0.1); s.add(sw);                                 // the sword hangs point-down
      s.add(box(gold,0.48,0.07,0.08,0.66,Y(1.9),0.1)); s.add(ell(gold,0.1,0.1,0.1,0.66,Y(2.0),0.1));                                              // cross-guard and pommel
      const la=cyl(bz,0.1,0.12,0.6,Y(1.7),8); la.position.set(-0.56,la.position.y,0.16); la.rotation.x=-0.5; la.rotation.z=0.1; s.add(la);         // left arm bent forward
      const sh=cyl(bz2,0.62,0.62,0.09,Y(1.75),24); sh.rotation.x=Math.PI/2; sh.position.set(-0.7,Y(2.05),0.42); s.add(sh);                          // Shield of Courage
      const rim=cyl(gold,0.64,0.64,0.06,Y(1.75),24); rim.rotation.x=Math.PI/2; rim.position.set(-0.7,Y(2.05),0.44); s.add(rim); s.add(ell(bz,0.24,0.24,0.1,-0.7,Y(2.05),0.5)); }
    if(L.n==='Shumway Fountain'){ // the big multi-tier fountain in Hahn Plaza: wide stone basin, three stacked bowls and ringed jets
      const s=new T.Group(); s.scale.setScalar(1.4); g.add(s); const stn=mat('#d8d2c2',{r:0.85}), stn2=mat('#bdb6a3',{r:0.9}), wat=mat('#58b7d6',{r:0.15,m:0.1,e:'#1a6f92',ei:0.35}), foam=new T.MeshStandardMaterial({color:'#eef9fd',transparent:true,opacity:0.5,emissive:'#bfe8f5',emissiveIntensity:0.45,roughness:0.3}); W.ownMats.push(foam);
      s.add(cyl(stn2,4.6,4.8,0.25,0,24)); s.add(cyl(stn,4.3,4.4,0.7,0.2,24)); s.add(cyl(stn,4.55,4.55,0.14,0.86,24)); s.add(cyl(wat,4.15,4.15,0.05,0.82,24));   // steps, basin wall, coping, water
      s.add(cyl(stn,1.05,1.35,0.9,0.85,18)); s.add(cyl(stn,1.9,1.35,0.34,1.75,18)); s.add(cyl(wat,1.75,1.75,0.04,2.07,18));                                        // pedestal and lower bowl
      s.add(cyl(stn,0.4,0.55,1.1,2.05,12)); s.add(cyl(stn,1.2,0.5,0.28,3.1,16)); s.add(cyl(wat,1.1,1.1,0.04,3.37,16)); s.add(cyl(stn,0.22,0.3,0.9,3.35,10)); s.add(cyl(stn,0.6,0.25,0.2,4.2,12));      // upper bowls
      jets=[]; for(let k=0;k<16;k++){ const a=k/16*6.283, j=cyl(foam,0.012,0.035,0.85,0.9,6); j.position.set(Math.cos(a)*3.5,j.position.y,Math.sin(a)*3.5); s.add(j); jets.push(j); }   // ring of arching jets
      for(let k=0;k<8;k++){ const a=k/8*6.283, j=cyl(foam,0.015,0.04,1.2,2.1,6); j.position.set(Math.cos(a)*1.4,j.position.y+0.3,Math.sin(a)*1.4); j.rotation.z=-Math.cos(a)*0.25; j.rotation.x=Math.sin(a)*0.25; s.add(j); jets.push(j); }
      const top=cyl(foam,0.02,0.08,2.4,4.4,8); s.add(top); jets.push(top); }
    return {g,top:10,anim:t=>{ gem.rotation.y=t*1.5; beam.material.opacity=0.16+0.06*Math.sin(t*2); if(jets) jets.forEach((j,i)=>{ j.scale.y=0.82+0.22*Math.sin(t*5+i*0.9); }); }};
  },
  pueblo(L,rnd){
    const g=new T.Group(); g.rotation.y=rnd()*Math.PI*2;
    const ad=[mat('#c98b5a',{r:0.95}),mat('#b97a4c',{r:0.95}),mat('#d39a68',{r:0.95})], dark=mat('#2a1a12',{r:1}), wood=mat('#6b4a2e',{r:0.9});
    for(let k=0;k<3;k++){ const n=5-k; for(let i=0;i<n;i++){ const x=(i-(n-1)/2)*6.4, z=-k*5.5, y=k*4.5;
      g.add(box(ad[(i+k)%3],6.2,4.5,6,x,y+2.25,z));
      if((i+k)%2===0) g.add(box(dark,1.3,2.1,0.1,x,y+1.2,z+3.02));
      for(const s of [-1,1]) if(rnd()<0.5){ const v=box(wood,0.25,0.25,1.6,x+s*1.8,y+4,z+3.4); g.add(v); } } }
    for(let k=0;k<3;k++){ const lad=new T.Group(); lad.position.set(-6+k*6,k*4.5,3.5-k*5.5); for(const s of [-0.4,0.4]){ const r=box(wood,0.12,6,0.12,s,3,0); r.rotation.x=-0.25; lad.add(r); } g.add(lad); }
    return {g,top:16};
  },
  camp(L,rnd){
    const g=new T.Group(), cols=['#d9a441','#3f7d6e','#b5442f','#e6dcc5'];
    for(let k=0;k<4;k++){ const a=k/4*Math.PI*2+rnd()*0.4, t=new T.Mesh(new T.ConeGeometry(3,4.5,4),mat(cols[k],{r:0.9,flat:true})); t.position.set(Math.cos(a)*9,2.1,Math.sin(a)*9); t.rotation.y=rnd()*3; t.castShadow=true; g.add(t); }
    const wood=mat('#4a3020');
    for(const r of [0,1.2]){ const l=box(wood,0.4,0.4,2.6,0,0.2,0); l.rotation.y=r; g.add(l); }
    const fm=new T.MeshBasicMaterial({color:'#ffb347'}); W.ownMats.push(fm);
    const fire=new T.Mesh(new T.ConeGeometry(0.7,1.8,8),fm); fire.position.y=1; g.add(fire);
    const light=new T.PointLight('#ff9a50',0,60,2); light.position.y=2.5; g.add(light);
    W.smokeSrc.push(new T.Vector3(L.x,L.y+3,L.z));
    return {g,top:6,anim:t=>{ const f=0.85+0.3*Math.abs(Math.sin(t*11))*Math.abs(Math.sin(t*7.3)); fire.scale.set(f,f*1.1,f); light.intensity=600*f; }};
  },
  balanced(L,rnd){
    const g=new T.Group(), m=mat('#ffffff',{vc:true,flat:true,r:0.95});
    const col=new T.Mesh(strataGeo(new T.CylinderGeometry(2.2,3.6,20,9,6),ROCK_STRATA,Math.floor(rnd()*1e6),0.8),m); col.position.y=8; col.castShadow=true; g.add(col);
    const top=new T.Mesh(rockGeo(9,Math.floor(rnd()*1e6),null,'#9c4426'),m); top.position.y=24; top.scale.set(1.2,0.75,1); top.castShadow=true; g.add(top);
    return {g,top:32,solid:3.6,solidTop:18};
  },
  hoodoos(L,rnd){
    const g=new T.Group(), m=mat('#ffffff',{vc:true,flat:true,r:0.95}), cap=mat('#7d4a2e',{flat:true,r:0.95});
    for(let k=0;k<13;k++){ const a=rnd()*Math.PI*2, d=rnd()*42, x=Math.cos(a)*d, z=Math.sin(a)*d, h=14+rnd()*20, r=1.6+rnd()*1.6, hh=heightAt(L.x+x,L.z+z)-L.y;
      const s=new T.Mesh(strataGeo(new T.CylinderGeometry(r*0.7,r*1.3,h,8,6),ROCK_STRATA,k*31+7,0.7),m); s.position.set(x,hh+h/2-2,z); s.castShadow=true; g.add(s);
      g.add(ell(cap,r*1.3,r*0.6,r*1.3,x,hh+h-1.6,z)); }
    return {g,top:36};
  },
  church(L,rnd,night){
    const g=new T.Group(); g.rotation.y=rnd()*Math.PI*2;
    const wood=mat('#4a2e1e',{r:0.9}), sh=mat('#2b211b',{r:0.85,flat:true}), win=night?mat('#ffd27a',{e:'#ffb347',ei:1.6}):mat('#2b3a4a');
    g.add(box(wood,9,7,14,0,3.5,0)); g.add(roof(sh,11,5,16,7));
    g.add(box(wood,6,4,6,0,10.5,0)); g.add(roof(sh,8,3.5,8,12.5));
    g.add(box(wood,3,3,3,0,16.5,0)); g.add(roof(sh,4,7,4,18));
    for(const s of [-1,1]) for(const z of [-4,0,4]) g.add(box(win,0.12,1.6,0.9,s*4.53,4,z));
    return {g,top:26,solid:7,solidTop:18};
  },
  cairn(L,rnd){
    const g=new T.Group(), st=mat('#8a8f96',{flat:true,r:0.95});
    for(let k=0;k<6;k++){ const s=2.4-k*0.33; g.add(ell(st,s,s*0.55,s*0.9,(rnd()-0.5)*0.4,k*1.05+0.3,(rnd()-0.5)*0.4)); }
    g.add(cyl(mat('#5a3d27'),0.08,0.1,6,5));
    const fg=new T.PlaneGeometry(2.6,1.5); fg.translate(1.3,0,0); const flag=new T.Mesh(fg,mat('#d8262e',{side:true,r:0.8})); flag.position.y=10.2; g.add(flag);
    return {g,top:12,anim:t=>{ flag.rotation.y=Math.sin(t*2.1)*0.35+0.4; flag.scale.x=0.92+0.08*Math.sin(t*6); }};
  },
};
LM_BUILD.la=LM_BUILD.usc;
function buildLandmarks(co){
  W.lms=[]; W.smokeSrc=[]; W.solids=[];
  const list=LANDMARKS[co.id]||[], rnd=mulberry32(co.seed*13+5), night=!!co.stars;
  for(const def of list){
    const s=def.by?uscSpot(def.by):findSpot(rnd,def.where); if(!s) continue;
    const L={n:def.n,t:def.t,x:s.x,z:s.z,y:def.where==='deep'?0:s.h,found:(found[co.id]||[]).includes(def.n)};
    W.lms.push(L);
    const b=LM_BUILD[def.k](L,rnd,night);
    b.g.position.set(L.x,L.y,L.z); W.travelG.add(b.g);
    L.anim=b.anim||null; L.top=b.top; L.rad=def.where==='deep'?260:110;
    if(b.solid) W.solids.push({x:L.x,z:L.z,r:b.solid,top:L.y+(b.solidTop??b.top)});
    L.label=nameSprite(L.n,'#ffe9a0'); L.label.scale.set(16,3,1); L.label.position.set(L.x,L.y+b.top+10,L.z); L.label.visible=false; W.travelG.add(L.label);
  }
}

/* ambient life: flocks, rising warm air, chimney smoke */
function buildFlocks(co){
  const F=FLOCK[co.id]||FLOCK.coast, per=13, N=F.n*per, rnd=mulberry32(co.seed+41);
  const wg=shapeGeo([[0,0.3],[0.55,0.22],[1,-0.12],[0.45,-0.25],[0,-0.3]]);
  const wings=new T.InstancedMesh(wg,mat(F.col,{side:true,r:0.85}),N*2), bodies=new T.InstancedMesh(SPH(),mat(F.col,{r:0.85}),N);
  wings.frustumCulled=false; bodies.frustumCulled=false; wings.castShadow=true;
  const list=[], ext=co.size*0.3;
  for(let f=0;f<F.n;f++){
    const birds=[]; for(let j=0;j<per;j++) birds.push({o:new T.Vector3((rnd()-0.5)*26,(rnd()-0.5)*8,(rnd()-0.5)*26-j*0.6),ph:rnd()*10});
    list.push({hx:(rnd()-0.5)*2*ext,hz:(rnd()-0.5)*2*ext,R:150+rnd()*260,w:(0.035+rnd()*0.03)*(rnd()<0.5?-1:1),ph:rnd()*6.28,alt:45+rnd()*90,cy:null,birds});
  }
  W.flock={wings,bodies,list,size:F.size,o:new T.Object3D()}; W.travelG.add(wings,bodies);
}
function updateFlocks(t,dt){
  const F=W.flock, o=F.o; let k=0;
  for(const f of F.list){
    const a=f.ph+t*f.w, cx=f.hx+Math.cos(a)*f.R, cz=f.hz+Math.sin(a)*f.R*0.7, yaw=Math.atan2(-Math.sin(a)*f.w,Math.cos(a)*0.7*f.w);
    const want=Math.max(groundAt(cx,cz)+f.alt,(W.co.water?0:0)+f.alt)+Math.sin(t*0.3+f.ph)*15;
    f.cy=f.cy==null?want:f.cy+(want-f.cy)*Math.min(1,dt*0.6);
    const cs=Math.cos(yaw), sn=Math.sin(yaw);
    for(const b of f.birds){
      const ox=b.o.x+Math.sin(t*0.7+b.ph)*2, oz=b.o.z+Math.cos(t*0.5+b.ph)*2;
      const x=cx+ox*cs+oz*sn, z=cz-ox*sn+oz*cs, y=f.cy+b.o.y+Math.sin(t*0.9+b.ph)*1.5;
      const glide=Math.sin(t*0.45+b.ph)>0.35, ang=glide?0.12:0.1+Math.sin(t*9+b.ph*3)*0.6, s=F.size;
      o.position.set(x,y,z); o.rotation.set(0,yaw,0,'YXZ'); o.scale.set(0.16*s,0.14*s,0.5*s); o.updateMatrix(); F.bodies.setMatrixAt(k,o.matrix);
      o.rotation.set(0,yaw,ang,'YXZ'); o.scale.set(s,s,s); o.updateMatrix(); F.wings.setMatrixAt(k*2,o.matrix);
      o.rotation.set(0,yaw,-ang,'YXZ'); o.scale.set(-s,s,s); o.updateMatrix(); F.wings.setMatrixAt(k*2+1,o.matrix);
      k++;
    }
  }
  F.wings.instanceMatrix.needsUpdate=true; F.bodies.instanceMatrix.needsUpdate=true;
}
function softTex(){
  if(W.soft) return W.soft;
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'), gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.4,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return W.soft=new T.CanvasTexture(c);
}
function buildThermals(co){
  const rnd=mulberry32(co.seed+77), ext=co.size*0.3; W.thermals=[];
  for(let tries=0;tries<3000&&W.thermals.length<6;tries++){
    const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z);
    if(h<6||!spotFree(x,z,60)||W.thermals.some(q=>Math.hypot(q.x-x,q.z-z)<500)) continue;
    W.thermals.push({x,z,r:26,base:h,top:h+380});
  }
  const per=80, n=W.thermals.length*per, pos=new Float32Array(Math.max(1,n)*3), seeds=[];
  for(let i=0;i<n;i++) seeds.push({a:rnd()*6.28,r:rnd()*24,h:rnd(),s:0.03+rnd()*0.04});
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3));
  const m=new T.PointsMaterial({map:softTex(),color:co.stars?'#cfe8ff':'#fff1c8',size:2.2,transparent:true,opacity:co.stars?0.35:0.5,depthWrite:false,blending:T.AdditiveBlending}); W.ownMats.push(m);
  const p=new T.Points(g,m); p.frustumCulled=false; W.travelG.add(p); W.therm={p,seeds,per};
  // smoke from chimneys and campfires
  const sn=24, sp=new Float32Array(Math.max(1,W.smokeSrc.length*sn)*3), sg=new T.BufferGeometry(); sg.setAttribute('position',new T.BufferAttribute(sp,3));
  const sm=new T.PointsMaterial({map:softTex(),color:co.stars?'#8d97a6':'#e4e4e4',size:6,transparent:true,opacity:0.4,depthWrite:false}); W.ownMats.push(sm);
  const smoke=new T.Points(sg,sm); smoke.frustumCulled=false; W.travelG.add(smoke); W.smoke={p:smoke,n:sn};
}
function updateThermals(t){
  const H=W.therm; if(!H) return; const a=H.p.geometry.attributes.position.array;
  W.thermals.forEach((q,ti)=>{ for(let j=0;j<H.per;j++){ const s=H.seeds[ti*H.per+j], f=(s.h+t*s.s)%1, ang=s.a+t*0.6+f*4;
    a.set([q.x+Math.cos(ang)*s.r,q.base+f*(q.top-q.base),q.z+Math.sin(ang)*s.r],(ti*H.per+j)*3); } });
  H.p.geometry.attributes.position.needsUpdate=true;
  const S=W.smoke, b=S.p.geometry.attributes.position.array;
  W.smokeSrc.forEach((src,si)=>{ for(let j=0;j<S.n;j++){ const f=(t*0.12+j/S.n)%1; b.set([src.x+f*f*14+Math.sin(t+j)*0.8,src.y+f*26,src.z+f*5+Math.cos(t*0.7+j)*0.8],(si*S.n+j)*3); } });
  S.p.geometry.attributes.position.needsUpdate=true;
}
function buildScatter(co,q){
  // boulders everywhere, plus desert shrubs where there are no trees
  const rnd=mulberry32(co.seed+91), ext=co.size*0.36, n=Math.round(q.trees*0.5);
  const rg=new T.IcosahedronGeometry(1,0), rm=mat(co.ice?'#9aa3ad':co.rock,{flat:true,r:0.95});
  const im=new T.InstancedMesh(rg,rm,n), o=new T.Object3D(); let k=0;
  for(let tries=0;tries<n*8&&k<n;tries++){ const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z); if(h<2) continue;
    const s=0.8+rnd()*2.6; o.position.set(x,h+s*0.2,z); o.rotation.set(rnd()*3,rnd()*3,rnd()*3); o.scale.set(s*(0.8+rnd()*0.5),s*0.6,s); o.updateMatrix(); im.setMatrixAt(k++,o.matrix); }
  im.count=k; im.castShadow=true; im.receiveShadow=true; W.scene.add(im);
  if(false){ const sg=new T.IcosahedronGeometry(1.4,0), sm=mat('#6f7d3c',{flat:true,r:0.95}), ns=Math.round(q.trees*0.8), is=new T.InstancedMesh(sg,sm,ns), c=new T.Color(); k=0;
    for(let tries=0;tries<ns*8&&k<ns;tries++){ const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z); if(slope(x,z,4)>1.5) continue;
      const s=0.6+rnd()*0.9; o.position.set(x,h+0.4,z); o.rotation.set(0,rnd()*3,0); o.scale.set(s,s*0.7,s); o.updateMatrix(); is.setMatrixAt(k,o.matrix); c.set('#6f7d3c').offsetHSL((rnd()-0.5)*0.06,0,(rnd()-0.5)*0.1); is.setColorAt(k++,c); }
    is.count=k; is.castShadow=true; W.scene.add(is); }
}
function buildMapImg(co){
  if(co.usc) return;
  const n=128, E=co.size*0.36, c=document.createElement('canvas'); c.width=c.height=n;
  const g=c.getContext('2d'), img=g.createImageData(n,n), cc=new T.Color();
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){
    const x=-E+(i+0.5)/n*2*E, z=-E+(j+0.5)/n*2*E, h=heightAt(x,z);
    if(co.water&&h<0.5) cc.set(co.water.shallow).lerp(c2.set(co.water.deep),clamp(-h/30,0,1));
    else { const hx=heightAt(x+10,z)-h, hz=heightAt(x,z+10)-h, ny=1/Math.sqrt(1+(hx/10)**2+(hz/10)**2); co.color(h,ny,0.5,cc); cc.multiplyScalar(clamp(1-(hx+hz)*0.025,0.55,1.35)); }
    const hex=cc.getHex(), k=(j*n+i)*4; img.data[k]=hex>>16&255; img.data[k+1]=hex>>8&255; img.data[k+2]=hex&255; img.data[k+3]=255;
  }
  g.putImageData(img,0,0); W.mapImg=c;
}
function buildTravel(co,q){ buildFlocks(co); buildThermals(co); if(!co.usc){ buildScatter(co,q); buildNature(co,q); } buildMapImg(co); }
function applyModeVis(){
  if(!W) return; const tv=mode==='travel';
  W.raceG.visible=!tv; W.travelG.visible=tv;
  W.scene.fog.far=W.co.fog[2]*(tv?1.15:1);
}

/* ---------- travel flight ---------- */
function placeTravel(r){ placeAt(r,0,0,0); r.pos.y+=30; r.pitch=0; r.v=24; r.inv=1; r.trail.hist=[]; }
function stepTravel(r,inp,dt){
  const B=BD[r.c], co=W.co;
  r.inv=Math.max(0,r.inv-dt); r.tumble=0; r.updraft=Math.max(0,r.updraft-dt); r.stam=1; r.exhaust=false; r.off=false; r.wrong=0;
  const py=r.pos.y;
  // how hard you flap (flex) sets the airspeed you work toward; diving trades height for speed, climbing costs speed
  const L=clamp(inp.flex||0,0,1); r.flex=L; r.boostVis+=(L-r.boostVis)*Math.min(1,dt*5);
  const csp=W.co.usc?1.0:1, target=(15+48*L)*B.spd*csp;
  r.v+=(target-r.v)*Math.min(1,dt*(target>r.v?0.9*B.acc:0.35));
  r.v=clamp(r.v-Math.sin(r.pitch)*16*dt,9*csp,120);
  const turn=clamp(inp.turn||0,-1,1), pitch=clamp(inp.pitch||0,-1,1), hnd=B.hnd;
  r.yaw=wrapA(r.yaw-turn*1.25*hnd*dt);
  r.pitch=clamp(r.pitch+pitch*1.0*hnd*dt,-0.9,0.75);
  if(!pitch) r.pitch*=1-Math.min(1,0.9*dt);
  if(r.v<14*csp&&r.pitch>-0.3) r.pitch-=0.35*dt; // too slow: the nose drops
  r.roll+=(turn*0.7-r.roll)*Math.min(1,dt*3);
  const cp=Math.cos(r.pitch); r.fwd.set(Math.sin(r.yaw)*cp,Math.sin(r.pitch),Math.cos(r.yaw)*cp);
  r.pos.addScaledVector(r.fwd,r.v*dt);
  if(W.usc&&uscPush(r,py)&&r.isMe&&r.inv<=0) hurtMe('Bump! Buildings are solid');
  // warm rising air
  r.thermal=false;
  for(const q of W.thermals){ const dx=r.pos.x-q.x, dz=r.pos.z-q.z; if(dx*dx+dz*dz<q.r*q.r&&r.pos.y<q.top){ r.pos.y+=12*dt; r.thermal=true; } }
  // ground: a soft bounce instead of a crash
  const gnd=groundAt(r.pos.x,r.pos.z);
  if(r.pos.y<gnd+3){
    const dive=r.pitch; r.pos.y=gnd+3; r.pitch=Math.max(r.pitch,0.2);
    if(r.isMe&&r.inv<=0){ if(dive<-0.3&&r.v>22) hurtMe('Crash! Pull up sooner'); else { banner={t:'Pull up!',until:performance.now()+900,c:'#ffd27f'}; r.inv=1.2; emote('ouch',0.7); } } }
  if(r.pos.y>900){ r.pos.y=900; r.pitch=Math.min(r.pitch,0); }
  // edge of the world: the wind turns you back
  const lim=co.lim||co.size*0.36, ax=Math.max(Math.abs(r.pos.x),Math.abs(r.pos.z));
  r.edge=ax>lim;
  if(r.edge){ const want=Math.atan2(-r.pos.x,-r.pos.z); r.yaw=wrapA(r.yaw+wrapA(want-r.yaw)*Math.min(1,dt*0.9)); }
  if(ax>lim+250){ const k=(lim+250)/ax; r.pos.x*=k; r.pos.z*=k; }
  // solid things push you aside (no crashes in travel)
  let hitS=false;
  const push=(cx,cz,rad,top)=>{ const dx=r.pos.x-cx, dz=r.pos.z-cz, d=Math.hypot(dx,dz)||1; if(d<rad+(HIT_R*(W.co.usc?citySize()*0.7:1))&&r.pos.y<top){ hitS=true; r.pos.x=cx+dx/d*(rad+(HIT_R*(W.co.usc?citySize()*0.7:1))); r.pos.z=cz+dz/d*(rad+(HIT_R*(W.co.usc?citySize()*0.7:1))); } };
  r.storm=false;
  for(const o of W.obs){
    if(o.type==='storm'){ if(r.pos.distanceTo(o.c)<o.r) r.storm=true; continue; }
    if(o.cyl){ push(o.cyl.x,o.cyl.z,o.cyl.r,o.cyl.top); continue; }
    for(const s of o.spheres){ const d=r.pos.distanceTo(s.p); if(d<s.r+(HIT_R*(W.co.usc?citySize()*0.7:1))){ hitS=true; r.pos.sub(s.p).multiplyScalar((s.r+(HIT_R*(W.co.usc?citySize()*0.7:1)))/(d||1)).add(s.p); } }
  }
  for(const s of W.solids) push(s.x,s.z,s.r,s.top);
  if(hitS&&r.isMe&&r.inv<=0) hurtMe('Bonk!');
  r.idx=nearest(W.tr,r.pos,r.idx,28)[0];
}
function updateTravel(dt,t,now){
  for(const L of W.lms){
    if(L.anim) L.anim(t);
    const r=me.r, dx=r.pos.x-L.x, dz=r.pos.z-L.z, d=Math.hypot(dx,dz);
    L.label.visible=L.found&&d<900&&d>40;
    if(!L.found&&d<L.rad&&r.pos.y<L.y+260){
      L.found=true; (found[W.co.id]||(found[W.co.id]=[])).push(L.n); travelSave(); renderJournal();
      foundShare(L); W.card={n:L.n,t:L.t,until:now+7000}; chime(); setTimeout(()=>callNow(0.7),600);
      const all=W.lms.every(x=>x.found); if(all) banner={t:`You found every place in ${W.co.name}!`,until:now+5000,c:'#ffe45e'};
    }
  }
  updateFlocks(t,dt); updateThermals(t); updateHearts(dt,t,now);
}
function renderJournal(){
  const box=$('rJournal'); if(!box) return; box.replaceChildren();
  if(!W||!W.lms){ box.textContent='Loading…'; return; }
  const head=document.createElement('div'); head.textContent=`${W.co.name}: ${W.lms.filter(l=>l.found).length} of ${W.lms.length} places found`; head.style.color='var(--fg)'; box.append(head);
  for(const L of W.lms){ const d=document.createElement('div');
    if(L.found){ const b=document.createElement('b'); b.textContent='✓ '+L.n; d.append(b,document.createTextNode(' · '+L.t)); }
    else d.textContent='◆ An unexplored place. Follow the gold marker on the compass.';
    box.append(d); }
  renderMissions();
  const rs=document.createElement('button'); rs.textContent='Forget places found here'; rs.style.marginTop='8px';
  rs.onclick=()=>{ found[W.co.id]=[]; for(const L of W.lms) L.found=false; travelSave(); renderJournal(); }; box.append(rs);
}

/* ---------- photos ---------- */
let photoReq=false, lastPhoto=0;
function takePhoto(){ const now=performance.now(); if(!W||now-lastPhoto<1500) return; lastPhoto=now; photoReq=true; }
function savePhoto(){
  const src=$('raceCanvas'), c=document.createElement('canvas'); c.width=src.width; c.height=src.height;
  const g=c.getContext('2d'); g.drawImage(src,0,0);
  let place=W.co.name; if(mode==='travel'){ let bd=600; for(const L of W.lms){ const d=Math.hypot(me.r.pos.x-L.x,me.r.pos.z-L.z); if(L.found&&d<bd){ bd=d; place=`${L.n} · ${W.co.name}`; } } }
  const s=c.height/720; g.fillStyle='rgba(8,12,18,.55)'; g.fillRect(0,c.height-76*s,c.width,76*s);
  g.fillStyle='#fff'; g.font=`700 ${28*s}px "DM Sans",system-ui,sans-serif`; g.fillText(place,24*s,c.height-42*s);
  g.fillStyle='#cfd6e0'; g.font=`500 ${17*s}px "DM Sans",system-ui,sans-serif`; g.fillText(`Seen by a ${BD[me.c].name} · ${new Date().toLocaleString()}`,24*s,c.height-16*s);
  c.toBlob(b=>{ if(!b) return; const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`sky-${me.course}-${Date.now()}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); });
  W.flashT=performance.now(); banner={t:'Photo saved',until:performance.now()+1200,c:'#ffffff'};
}

/* ---------- sound: wind that follows speed and dives, surf and shore hiss, rustling trees, canyon and fjord echo,
   real-sounding bird calls (every species has its own), flap whooshes, thunder and race beeps ---------- */
const AU={ctx:null,master:null,conv:null,wet:null,L:null,pad:null,white:null,next:0,callAt:0,rem:0,course:null,gust:1,gustAt:0,lc:null,flapN:0};
// reverb character per place: coast is open air, the canyon throws echoes off its walls, the fjord is huge and cold
const SND={
  coast: {rev:1.3,mix:0.14,echo:[],       birds:['songbird','gull'],surf:1,  rustle:1,   howl:0,   pad:0},
  canyon:{rev:3.0,mix:0.38,echo:[0.42,0.95],birds:['raven','hawk'],  surf:0,  rustle:0.25,howl:1,   pad:0},
  fjord: {rev:4.0,mix:0.42,echo:[0.7],     birds:['owl'],            surf:0.7,rustle:0.3, howl:0.55,pad:1},
  usc:   {rev:1.0,mix:0.12,echo:[0.35],    birds:['songbird','raven'],surf:0,  rustle:1,   howl:0,   pad:0,city:1},
  la:    {rev:1.6,mix:0.2, echo:[0.5,0.9], birds:['raven','songbird'],surf:0,  rustle:0.4, howl:0.15,pad:0,city:2}};
const soundOn=()=>!!AU.ctx&&$('rSound').checked&&EMG().activeTab()==='tabRace'&&!!W&&!!me.r;

function noiseBuf(C,brown){ // 4 s of noise with a cross-faded seam so the loop never clicks
  const sr=C.sampleRate, len=sr*4, f=Math.floor(sr*0.15), x=new Float32Array(len+f); let l=0;
  for(let i=0;i<x.length;i++){ const w=Math.random()*2-1; if(brown){ l=(l+0.02*w)/1.02; x[i]=l*3.5; } else x[i]=w; }
  const b=C.createBuffer(1,len,sr), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=i<f?x[i]*(i/f)+x[len+i]*(1-i/f):x[i];
  return b;
}
function makeIR(C,p){
  const sr=C.sampleRate, n=Math.floor(sr*p.rev), b=C.createBuffer(2,n,sr);
  for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); let lp=0;
    for(let i=0;i<n;i++){ const t=i/n; lp+=(Math.random()*2-1-lp)*(0.6-0.5*t); d[i]=lp*Math.pow(1-t,2.4)*Math.min(1,i/(sr*0.02)); }
    for(const e of p.echo){ const s=Math.floor(e*sr*(1+ch*0.04)); for(let k=0;k<sr*0.05&&s+k<n;k++) d[s+k]+=(Math.random()*2-1)*0.55*Math.exp(-k/(sr*0.012))*(1-e/p.rev*0.5); } }
  return b;
}
function audioInit(){
  if(AU.ctx||!$('rSound').checked) return;
  try{
    const C=new (window.AudioContext||window.webkitAudioContext)();
    const comp=C.createDynamicsCompressor(); comp.threshold.value=-20; comp.ratio.value=4; comp.attack.value=0.01; comp.release.value=0.25;
    const master=C.createGain(); master.gain.value=0.9; master.connect(comp); comp.connect(C.destination);
    const conv=C.createConvolver(), wet=C.createGain(); conv.connect(wet); wet.connect(master);
    const brown=noiseBuf(C,true), white=noiseBuf(C,false);
    const layer=(buf,type,f,q,send=0.1)=>{ const s=C.createBufferSource(); s.buffer=buf; s.loop=true; s.start(0,Math.random()*3);
      const fl=C.createBiquadFilter(), g=C.createGain(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; g.gain.value=0;
      s.connect(fl); fl.connect(g); g.connect(master); if(send){ const sg=C.createGain(); sg.gain.value=send; g.connect(sg); sg.connect(conv); } return {f:fl,g}; };
    const L={low:layer(brown,'lowpass',260,0.7), mid:layer(brown,'bandpass',600,0.8), whistle:layer(white,'bandpass',1800,9,0.2),
      surf:layer(white,'lowpass',900,0.5,0.15), hiss:layer(white,'highpass',3000,0.5,0.1), rustle:layer(white,'bandpass',3200,0.6,0.1), howl:layer(brown,'bandpass',230,7,0.6), city:layer(brown,'bandpass',420,0.6,0.15)};
    const pad=C.createGain(); pad.gain.value=0; pad.connect(master); const ps=C.createGain(); ps.gain.value=0.7; pad.connect(ps); ps.connect(conv); // soft aurora chord
    for(const [f,dt] of [[110,-4],[164.8,3],[220,-2],[277.2,5]]){ const o=C.createOscillator(), og=C.createGain(); o.type='sine'; o.frequency.value=f; o.detune.value=dt; og.gain.value=0.25; o.connect(og); og.connect(pad); o.start(); }
    const now=performance.now();
    Object.assign(AU,{ctx:C,master,conv,wet,L,pad,white,next:now+2500,callAt:now+6000,rem:now+5000,course:null,gust:1,gustAt:0,lc:null,flapN:0}); warmReal();
  }catch(e){ console.warn('audio off',e); }
}
function tone(f0,f1,dur,vol,delay=0,send=0.25){
  const C=AU.ctx, t0=C.currentTime+delay, o=C.createOscillator(), g=C.createGain(), sg=C.createGain();
  o.type='sine'; o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);
  g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  sg.gain.value=send; o.connect(g); g.connect(AU.master); g.connect(sg); sg.connect(AU.conv); o.start(t0); o.stop(t0+dur+0.05);
}
function noiseBurst(freq,dur,vol,delay=0,type='bandpass',pan=0){
  const C=AU.ctx, t0=C.currentTime+delay, s=C.createBufferSource(), f=C.createBiquadFilter(), g=C.createGain();
  s.buffer=AU.white; f.type=type; f.frequency.value=freq; f.Q.value=type==='bandpass'?0.8:0.5;
  g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+Math.min(0.05,dur*0.3)); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t0,Math.random()*2); s.stop(t0+dur+0.05);
}
function chime(){ if(!AU.ctx||!$('rSound').checked) return; [784,988,1319].forEach((f,i)=>tone(f,f*1.01,0.7,0.07,i*0.12,0.5)); }
function sfx(name){
  if(!soundOn()) return;
  if(name==='ring'){ [660,880,1175].forEach((f,i)=>tone(f,f*1.005,0.5,0.05,i*0.07,0.4)); noiseBurst(1400,0.35,0.05); }
  else if(name==='hit'){ tone(160,45,0.4,0.45,0,0.15); noiseBurst(900,0.3,0.22); noiseBurst(3200,0.12,0.08); }
  else if(name==='beep') tone(660,660,0.2,0.12,0,0.1);
  else if(name==='go') tone(990,990,0.55,0.14,0,0.15);
}
function thunder(dist){
  if(!soundOn()) return; const d=clamp(dist/900,0,1), delay=0.1+d*2.0;
  noiseBurst(170,3.4-d,0.6*(1-d*0.6),delay,'lowpass'); noiseBurst(650,1.4,0.2*(1-d*0.7),delay+0.15,'lowpass'); if(d<0.5) noiseBurst(2400,0.18,0.18*(1-d),delay,'highpass');
}

/* one syllable: a sine/saw whose pitch follows `curve`, with optional vibrato and a formant filter */
function syl(dst,t0,dur,curve,o={}){
  const C=AU.ctx, osc=C.createOscillator(), g=C.createGain(), vol=o.vol??1, a=o.att??0.012;
  osc.type=o.wave||'sine'; osc.frequency.setValueCurveAtTime(Float32Array.from(curve),t0,dur);
  if(o.vib){ const lfo=C.createOscillator(), lg=C.createGain(); lfo.frequency.value=o.vib[0]; lg.gain.value=o.vib[1]; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0+dur+0.05); }
  let out=osc; if(o.band){ const f=C.createBiquadFilter(); f.type='bandpass'; f.frequency.value=o.band[0]; f.Q.value=o.band[1]; osc.connect(f); out=f; }
  g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  out.connect(g); g.connect(dst); osc.start(t0); osc.stop(t0+dur+0.05);
}
/* ---- bird voices ----
   Each species has its own synthesised call, built from what field guides and recordings describe (Audubon, Cornell, Vassar, xeno-canto notes):
   peregrine = harsh "kak-kak-kak" cackle (fundamental near 2 kHz) or a long "eechip" wail; bald eagle = weak, high, gull-like peal then a fast chitter;
   hummingbird = squeaky "chee-dit" chips and a noisy "zeep" plus a wing hum; puffin = low purring growl, pig-like grunt, "chainsaw" amplitude flutter;
   scarlet macaw = raucous "raaaak" screams; snowy owl = deep "hoo hoo" hoots or a rattling alarm; raven = deep gurgling croak that rises in pitch, hollow "wonk";
   barn swallow = fast twitter with a grating rattle; flamingo = goose-like falling honks. Exact pitches are my approximations (only the falcon's ~2 kHz is documented). */
const WAVES={};
function richWave(p){ const k=p.toFixed(2); if(WAVES[k]&&WAVES[k].c===AU.ctx) return WAVES[k].w; const n=26, re=new Float32Array(n), im=new Float32Array(n); for(let i=1;i<n;i++) im[i]=1/Math.pow(i,p); const w=AU.ctx.createPeriodicWave(re,im); WAVES[k]={w,c:AU.ctx}; return w; }
function voice(dst,t0,dur,curve,o={}){
  const C=AU.ctx, vol=o.vol??1, a=Math.min(o.att??0.012,dur*0.6), env=C.createGain(), mix=C.createGain(), osc=C.createOscillator();
  env.gain.setValueAtTime(0.0001,t0); env.gain.linearRampToValueAtTime(vol,t0+a); if(o.hold) env.gain.setValueAtTime(vol,t0+Math.max(a,dur*o.hold)); env.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  if(o.rich) osc.setPeriodicWave(richWave(o.rich)); else osc.type=o.wave||'sine';
  osc.frequency.setValueCurveAtTime(Float32Array.from(curve),t0,dur);
  if(o.vib){ const lfo=C.createOscillator(), lg=C.createGain(); lfo.frequency.value=o.vib[0]; lg.gain.value=o.vib[1]; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0+dur+0.05); }
  let src=osc;
  if(o.am){ const g=C.createGain(), l=C.createOscillator(), lg=C.createGain(); g.gain.value=1-o.am[1]/2; l.frequency.value=o.am[0]; lg.gain.value=o.am[1]/2; l.connect(lg); lg.connect(g.gain); l.start(t0); l.stop(t0+dur+0.05); osc.connect(g); src=g; } // flutter / gurgle
  if(o.formants){ for(const [f,q,gn] of o.formants){ const b=C.createBiquadFilter(), gg=C.createGain(); b.type='bandpass'; b.frequency.value=f; b.Q.value=q; gg.gain.value=gn; src.connect(b); b.connect(gg); gg.connect(mix); } } else src.connect(mix);
  if(o.noise&&AU.white){ const n=C.createBufferSource(), bf=C.createBiquadFilter(), ng=C.createGain(); n.buffer=AU.white; n.loop=true; bf.type='bandpass'; bf.frequency.value=o.noise[0]; bf.Q.value=o.noise[1]; ng.gain.value=o.noise[2]; n.connect(bf); bf.connect(ng); ng.connect(mix); n.start(t0,Math.random()*2); n.stop(t0+dur+0.05); }
  mix.connect(env); env.connect(dst); osc.start(t0); osc.stop(t0+dur+0.05);
}
const rr=(a,b)=>a+Math.random()*(b-a);
const FLAPV={owl:0.3,hummingbird:0.15,swallow:0.5,puffin:0.9,macaw:1,eagle:1.3,flamingo:1.2,raven:1.1,peregrine:0.9};   // wingbeat loudness: owls fly silently, eagles thump
const CALLV={peregrine:1.0,eagle:0.9,hummingbird:0.65,puffin:1.15,macaw:1.0,owl:1.15,raven:1.0,swallow:0.75,flamingo:1.05};   // loudness trim per species
const CALLS={
  songbird(d,t){ const n=3+Math.floor(Math.random()*5), base=rr(2600,4300); let x=0;
    for(let i=0;i<n;i++){ const du=rr(0.05,0.12), up=Math.random()<0.5, f=base*rr(0.85,1.25); syl(d,t+x,du,[f,f*(up?1.4:0.68),f*(up?1.12:0.82)],{vib:[rr(20,38),rr(40,90)],vol:rr(0.6,1)}); x+=du+rr(0.03,0.09); } },
  gull(d,t){ const n=3+Math.floor(Math.random()*2); for(let i=0;i<n;i++) syl(d,t+i*0.34,0.3,[1500-i*60,2400-i*80,1750-i*60,1150],{wave:'sawtooth',band:[1900,1.3],vib:[14,70],vol:0.55-i*0.06,att:0.03}); },
  hawk(d,t){ for(let i=0;i<4;i++) syl(d,t+i*0.2,0.17,[3500-i*80,3000-i*80],{wave:'triangle',vib:[30,40],vol:0.7,att:0.02}); },
  peregrine(d,t){
    if(Math.random()<0.7){ const n=7+Math.floor(Math.random()*5), f0=rr(1900,2200), gap=rr(0.105,0.125); // "kak-kak-kak": about eight harsh notes a second
      for(let i=0;i<n;i++){ const f=f0*(1-i*0.012); voice(d,t+i*gap,0.075,[f*1.18,f,f*0.88],{rich:0.7,vol:0.95,att:0.006,formants:[[2300,3,1],[4600,4,0.35]],noise:[3200,1.2,0.3]}); } }
    else { voice(d,t,0.58,[2300,3200,3050,2400],{rich:0.9,vol:0.9,att:0.05,vib:[9,60],formants:[[2800,2.5,1],[5600,5,0.3]]}); voice(d,t+0.66,0.13,[3000,2300],{rich:0.8,vol:0.8,att:0.01}); } // the long "eechip" wail
  },
  eagle(d,t){ const f=rr(0.93,1.07); // weak, high, gull-like peal then a fast chitter
    voice(d,t,0.36,[2900*f,4000*f,3350*f,2700*f],{wave:'triangle',vol:0.9,att:0.03,vib:[24,70],formants:[[3300,2.2,1],[6200,5,0.25]],noise:[4200,2,0.1]});
    const n=5+Math.floor(Math.random()*4); for(let i=0;i<n;i++) voice(d,t+0.44+i*0.095,0.066,[3550*f-i*40,2900*f],{wave:'triangle',vol:0.78-i*0.04,att:0.008,formants:[[3200,2.5,1]]});
    if(Math.random()<0.5) voice(d,t+1.35,0.3,[3100*f,3900*f,2900*f],{wave:'triangle',vol:0.7,att:0.03,vib:[22,60],formants:[[3300,2.2,1]]}); },
  hummingbird(d,t){ const r=Math.random();
    if(r<0.5){ for(let k=0;k<2;k++){ const o=t+k*0.46; voice(d,o,0.09,[5200,7600,6900],{vol:0.75,att:0.004,formants:[[6800,6,1]]}); voice(d,o+0.11,0.045,[7800,6000],{vol:0.65,att:0.003}); } } // squeaky "chee-dit"
    else if(r<0.8){ const n=8+Math.floor(Math.random()*6); for(let i=0;i<n;i++) voice(d,t+i*0.055,0.04,[rr(5600,8200),rr(5200,8600)],{vol:0.6,att:0.003}); }
    else voice(d,t,0.24,[6200,8800,7400],{vol:0.55,att:0.01,noise:[7500,2,1.3],formants:[[7500,4,1]]}); }, // noisy "zeep"
  puffin(d,t){ const n=1+Math.floor(Math.random()*3), du=rr(0.55,0.9); // low purring growl, like a chainsaw revving in the burrow
    for(let i=0;i<n;i++) voice(d,t+i*(du+0.14),du,[132,152,128,108],{rich:0.6,vol:1.0,att:0.07,hold:0.7,am:[rr(24,34),0.8],formants:[[300,2.5,1],[720,3,0.5]],noise:[420,1,0.2]}); },
  macaw(d,t){ const n=2+Math.floor(Math.random()*2); // raucous "raaaak" screams
    for(let i=0;i<n;i++) voice(d,t+i*rr(0.58,0.72),0.5,[820,1120,980,760],{rich:0.55,vol:1.0,att:0.025,hold:0.5,vib:[rr(14,22),50],formants:[[1500,1.6,1],[2900,2.5,0.7],[4300,3,0.35]],noise:[2500,0.8,0.5]});
    if(Math.random()<0.5) voice(d,t+n*0.65,0.12,[1200,800],{rich:0.6,vol:0.8,att:0.008,formants:[[1600,2,1]]}); },
  owl(d,t){
    if(Math.random()<0.7){ for(const [o,du] of [[0,0.5],[0.8,0.32],[1.22,0.46]]) voice(d,t+o,du,[395,382,330],{rich:2.6,vol:1.0,att:0.1,hold:0.55,am:[5,0.12],formants:[[400,3,1],[800,4,0.25]]}); } // deep "hoo ... hoo-hoo"
    else for(let i=0;i<6;i++) voice(d,t+i*0.085,0.06,[1350,900],{rich:0.8,vol:0.85,att:0.006,formants:[[1200,2.5,1]],noise:[2200,1,0.3]}); }, // rattling alarm
  raven(d,t){ const n=2+Math.floor(Math.random()*2); // deep gurgling croak that rises in pitch
    for(let i=0;i<n;i++){ const f=rr(0.9,1.1); voice(d,t+i*rr(0.55,0.75),0.44,[300*f,340*f,430*f,520*f],{rich:0.75,vol:1.0,att:0.03,hold:0.6,am:[rr(55,75),0.55],formants:[[900,2.2,1],[1700,3,0.5]],noise:[1200,1,0.25]}); }
    if(Math.random()<0.35) voice(d,t+1.6,0.17,[340,300],{wave:'triangle',vol:0.9,att:0.01,formants:[[620,5,1]]}); }, // hollow "wonk"
  swallow(d,t){ const n=14+Math.floor(Math.random()*8); let x=0; // fast twitter with a grating rattle
    for(let i=0;i<n;i++){ const f=rr(3200,5400), du=rr(0.035,0.07); voice(d,t+x,du,[f,f*rr(0.75,1.35),f*rr(0.8,1.2)],{vol:0.75,att:0.004,formants:[[4200,1.2,1]]}); x+=du+rr(0.01,0.03);
      if(i===Math.floor(n*0.6)){ voice(d,t+x,0.28,[900,800,900],{rich:0.7,vol:0.65,att:0.01,am:[42,0.9],formants:[[1400,2,1]],noise:[2000,1,0.2]}); x+=0.3; } } },
  flamingo(d,t){ const n=2+Math.floor(Math.random()*3); // goose-like falling honks
    for(let i=0;i<n;i++) voice(d,t+i*rr(0.3,0.38),0.27,[560,640,520,430],{rich:0.6,vol:1.0,att:0.03,hold:0.5,vib:[7,22],formants:[[900,4,1],[1800,3,0.5],[2700,4,0.25]],noise:[1500,1,0.15]}); }
};
function stopBirdSounds(){
  if(!AU.ctx) return; const C=AU.ctx, t=C.currentTime;
  for(const x of AU.live||[]) if(x.own){ try{ x.g.gain.cancelScheduledValues(t); x.g.gain.setTargetAtTime(0,t,0.02); }catch{} setTimeout(()=>{ try{ x.g.disconnect(); x.out.disconnect(); x.sg.disconnect(); }catch{} },200); }
  AU.live=(AU.live||[]).filter(x=>!x.own);
  if(AU.hum){ const h=AU.hum; try{ h.g.gain.cancelScheduledValues(t); h.g.gain.setTargetAtTime(0,t,0.03); }catch{} setTimeout(()=>{ try{ h.o.stop(); h.o.disconnect(); h.g.disconnect(); }catch{} },300); AU.hum=null; }
}
function callNow(vol=0.6,opt={}){ if(!AU.ctx||!me.r||!soundOn()) return; const prof=SND[W.co.id]||SND.coast; playCall(me.c,vol,0,0.2+prof.mix*0.6,true,opt); }
/* Reactions: a roar/scream when you surge forward, an "ouch" cry when you hit something. Same recordings, shaped by pitch bends, distortion and a short envelope. */
let _dist=null, _emoteAt=0;
function distCurve(){ if(_dist) return _dist; const n=1024, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(x*4.5); } return (_dist=c); }
function emote(kind,power=1){
  if(!AU.ctx||!me.r||!soundOn()) return; const now=performance.now(); if(now<_emoteAt) return; _emoteAt=now+(kind==='ouch'?500:900);
  const C=AU.ctx, t=C.currentTime+0.01, c=me.c, small=c==='hummingbird'||c==='swallow';
  const g=C.createGain(); g.gain.value=0; const sg=C.createGain(); sg.gain.value=0.35; g.connect(AU.master); g.connect(sg); sg.connect(AU.conv);
  (AU.live||(AU.live=[])).push({g,out:g,sg,own:true,until:now+4000});
  const R=REAL[c]; let dur=kind==='ouch'?0.5:1.5;
  if(R&&R!=='loading'){
    const want=kind==='ouch'?s=>s[1]-s[0]<=1.2:s=>s[1]-s[0]>=0.9; let L=R.segs.filter(want); if(!L.length) L=R.segs; const s=L[Math.floor(Math.random()*L.length)];
    const src=C.createBufferSource(); src.buffer=R.buf; let node=src;
    if(kind==='roar'){ const ws=C.createWaveShaper(); ws.curve=distCurve(); ws.oversample='2x'; const pre=C.createGain(); pre.gain.value=0.6; src.connect(pre); pre.connect(ws); const lp=C.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=small?7000:4200; ws.connect(lp); node=lp; }
    node.connect(g);
    dur=Math.min(kind==='ouch'?0.55:1.6,s[1]-s[0]);
    const base=kind==='roar'?(small?1.2:0.8):(small?1.3:1.0);
    if(kind==='roar'){ src.playbackRate.setValueAtTime(base*0.9,t); src.playbackRate.linearRampToValueAtTime(base*1.12,t+dur*0.35); src.playbackRate.linearRampToValueAtTime(base*0.82,t+dur); }
    else { src.playbackRate.setValueAtTime(base*1.55,t); src.playbackRate.exponentialRampToValueAtTime(base*0.8,t+dur*0.8); } // a yelp that drops
    src.start(t,s[0],Math.min(s[1]-s[0],dur*1.6));
    const peak=(kind==='roar'?1.25:1.1)*power*(CALLV[c]||1);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+0.04); g.gain.setValueAtTime(peak,t+dur*0.7); g.gain.linearRampToValueAtTime(0,t+dur+0.05);
  } else { g.gain.value=0.9*power*(CALLV[c]||1); if(CALLS[c]) CALLS[c](g,t); }
  if(kind==='roar') noiseBurst(500,0.5,0.05*power); else { noiseBurst(2600,0.12,0.07*power); tone(520,200,0.25,0.08*power,0,0.1); } // rushing air / a puff of feathers
  if(me.r) addRipple(0,true);
}
function hummingHum(t,now){ // a hummingbird's wings really do hum
  if(AU.hum&&me.c!=='hummingbird') stopBirdSounds();
  if(!AU.hum&&me.c==='hummingbird'){ const C=AU.ctx, o=C.createOscillator(), f=C.createBiquadFilter(), g=C.createGain(); o.type='sawtooth'; o.frequency.value=58; f.type='bandpass'; f.frequency.value=260; f.Q.value=1.2; g.gain.value=0; o.connect(f); f.connect(g); g.connect(AU.master); o.start(); AU.hum={o,g}; }
  if(AU.hum){ const u=me.r?.model?.userData, e=u?clamp(u.eff||0,0,1):0; AU.hum.g.gain.setTargetAtTime(me.c==='hummingbird'?0.05+0.06*e:0,t,0.15); AU.hum.o.frequency.setTargetAtTime(52+22*e,t,0.2); } }
function playCall(kind,vol,pan=0,send=0.3,own=false,opt={}){
  if(!AU.ctx||!CALLS[kind]) return;
  const C=AU.ctx, g=C.createGain(); g.gain.value=vol*(CALLV[kind]||1); let out=g;
  if(C.createStereoPanner){ const p=C.createStereoPanner(); p.pan.value=clamp(pan,-1,1); g.connect(p); out=p; }
  out.connect(AU.master); const sg=C.createGain(); sg.gain.value=send; out.connect(sg); sg.connect(AU.conv);
  (AU.live||(AU.live=[])).push({g,out,sg,own,until:performance.now()+6000}); // remembered so switching birds can silence your old bird's call
  if(!playRealCall(kind,g,C.currentTime+0.02,opt)) CALLS[kind](g,C.currentTime+0.02);
}
/* Recorded calls (sounds-data.js: short xeno-canto excerpts, one clip per species). They are decoded on first use; until then, or if the file is missing, the synthesised calls above play. */
const REAL={}, REAL_LAST={};
function decodeReal(kind){
  const D=window.BIRD_SND&&window.BIRD_SND[kind]; if(!D||!AU.ctx||REAL[kind]!==undefined) return; REAL[kind]='loading';
  try{ const b=atob(D.ogg.slice(D.ogg.indexOf(',')+1)), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i);
    AU.ctx.decodeAudioData(u.buffer).then(buf=>{ REAL[kind]={buf,segs:D.segs}; },()=>{ REAL[kind]=null; }); }catch{ REAL[kind]=null; }
}
function warmReal(){ decodeReal(me.c); let i=0; for(const k of Object.keys(window.BIRD_SND||{})) setTimeout(()=>decodeReal(k),400+(i++)*250); }
function playRealCall(kind,g,t,opt){
  const R=REAL[kind]; if(!R||R==='loading'){ if(R===undefined) decodeReal(kind); return false; }
  const segs=R.segs; let idx=[]; for(let i=0;i<segs.length;i++){ const d=segs[i][1]-segs[i][0]; if(opt&&opt.long?d>=1.0:d<=1.0) idx.push(i); } if(!idx.length) idx=segs.map((_,i)=>i); // tap = a short excerpt, hold = a long one
  let i=idx[Math.floor(Math.random()*idx.length)]; if(idx.length>1&&i===REAL_LAST[kind]) i=idx[(idx.indexOf(i)+1)%idx.length]; REAL_LAST[kind]=i;
  const [a,b]=segs[i], src=AU.ctx.createBufferSource(); src.buffer=R.buf; src.playbackRate.value=(opt&&opt.rate)||(0.97+Math.random()*0.08); src.connect(g); src.start(t,a,b-a); return true;
}
function audioTick(now){
  if(!AU.ctx) return;
  if(AU.live&&AU.live.length>40) AU.live=AU.live.filter(x=>x.until>now);
  const on=soundOn(), C=AU.ctx, t=C.currentTime, L=AU.L;
  if(!on){ for(const k in L) L[k].g.gain.setTargetAtTime(0,t,0.2); AU.pad.gain.setTargetAtTime(0,t,0.3); return; }
  if(C.state==='suspended') C.resume().catch(()=>{});
  const prof=SND[W.co.id]||SND.coast, r=me.r;
  if(AU.course!==W.co.id){ AU.course=W.co.id; AU.conv.buffer=makeIR(C,prof); AU.wet.gain.value=prof.mix; }
  const v=r.v, ground=heightAt(r.pos.x,r.pos.z), alt=r.pos.y-groundAt(r.pos.x,r.pos.z), sp=clamp((v-8)/80,0,1);
  if(now>AU.gustAt){ AU.gust=0.65+Math.random()*0.7; AU.gustAt=now+1800+Math.random()*3500; }
  const set=(n,val,tau=0.25)=>n.g.gain.setTargetAtTime(val,t,tau);
  set(L.low,(0.03+0.17*sp)*(0.8+0.2*AU.gust),0.5);
  set(L.mid,(0.02+0.12*sp)*AU.gust,1.0); L.mid.f.frequency.setTargetAtTime(380+v*9,t,0.3);
  set(L.whistle,0.004+0.045*sp*sp*(0.6+0.4*AU.gust),0.3); L.whistle.f.frequency.setTargetAtTime(1500+v*16-r.pitch*600,t,0.2); // dives raise the pitch
  const water=W.co.water&&ground<20?clamp(1-alt/160,0,1):0, swell=Math.pow(0.5+0.5*Math.sin(now/1700),1.6);
  set(L.surf,prof.surf*water*(0.05+0.13*swell),0.4); set(L.hiss,prof.surf*water*(0.01+0.035*swell+(alt<12?0.03:0))+(ENV.weather==='rain'?0.07:0),0.3);
  set(L.rustle,prof.rustle*clamp(1-alt/70,0,1)*(ground>6?1:0)*(0.015+0.04*sp),0.4);
  set(L.howl,prof.howl*(0.015+0.04*sp)*(0.6+0.4*Math.sin(now/3100)),0.6); L.howl.f.frequency.setTargetAtTime(190+60*Math.sin(now/5200)+v*2.5,t,0.5);
  set(L.city,(prof.city||0)*clamp(1-alt/170,0,1)*(0.03+0.02*Math.sin(now/2300)),0.6); // distant traffic and crowds
  AU.pad.gain.setTargetAtTime(prof.pad*0.028*(0.7+0.3*Math.sin(now/4300)),t,0.8);
  // birds of the place (low flying only)
  if(now>AU.next){ const low=clamp(1-alt/280,0,1); AU.next=now+(mode==='travel'?2500:4500)+Math.random()*5000/(0.4+low);
    if(alt<280&&Math.random()<0.35) playCall(me.c,0.08+0.12*low,rr(-0.8,0.8),0.25+prof.mix); } // only ever your own bird's voice, never other species
  // your own bird calls now and then
  if(now>AU.callAt){ AU.callAt=now+7000+Math.random()*8000; if(phase!=='countdown') callNow(0.55); }
  { const hi=r.flex>0.7; if(hi&&!AU.wasHi&&now>(AU.surgeAt||0)&&phase!=='countdown'){ AU.surgeAt=now+3500; emote('roar',0.6+0.4*r.flex); } if(r.flex<0.4) AU.wasHi=false; else if(hi) AU.wasHi=true; } // surging forward makes your bird roar
  hummingHum(t,now);
  // other birds: heard from the side they are on, quieter the further they are
  if(now>AU.rem){ AU.rem=now+3500+Math.random()*5000;
    const others=racers.filter(x=>!x.isMe).concat([...remotes.values()].map(x=>x.r).filter(Boolean));
    if(others.length){ const o=others[Math.floor(Math.random()*others.length)], dx=o.pos.x-r.pos.x, dy=o.pos.y-r.pos.y, dz=o.pos.z-r.pos.z, d=Math.hypot(dx,dy,dz);
      if(d<500) playCall(me.c,0.5/(1+d/80),(dx*Math.cos(r.yaw)-dz*Math.sin(r.yaw))/Math.max(1,Math.hypot(dx,dz)),0.25+prof.mix*0.5); } }
  // wing beats
  const u=r.model?.userData;
  if(u&&u.acc!=null){ const fl=Math.floor(u.acc); if(fl!==AU.flapN){ AU.flapN=fl; const step=u.hz>9?4:u.hz>6?2:1;
    if(fl%step===0&&(mode==='race'||r.flex>0.03)) noiseBurst(420+u.hz*20,0.13,(0.022+0.03*r.boostVis+0.012*clamp(u.eff||0,0,1))*(FLAPV[me.c]||1)); } }
  // race start beeps
  if(phase==='countdown'){ const s=Math.ceil((goAt-now)/1000); if(s!==AU.lc&&s>=1&&s<=3){ AU.lc=s; sfx('beep'); } }
  else if(phase==='race'){ if(AU.lc!=='go'){ AU.lc='go'; sfx('go'); } } else AU.lc=null;
}

/* ---------- travel HUD ---------- */
function drawTravelHud(g,Wv,Hv,now,fx){
  const r=me.r, co=W.co, nf=W.lms.filter(l=>l.found).length;
  panel(g,14,14,250,58); g.fillStyle='#fff'; g.font='700 17px "DM Sans",system-ui'; g.fillText(co.name,26,38);
  g.font='500 13px "DM Sans",system-ui'; g.fillStyle='#cfd6e0'; g.fillText(`${nf} of ${W.lms.length} places found${remotes.size?` · ${remotes.size} friend${remotes.size===1?'':'s'} flying`:''}`,26,60);
  // compass
  const cw=440, cx=Wv/2; panel(g,cx-cw/2,12,cw,44,0.4);
  const head=Math.atan2(r.fwd.x,-r.fwd.z), X=rel=>cx+rel/(Math.PI/2)*cw/2;
  g.save(); g.beginPath(); g.rect(cx-cw/2,12,cw,44); g.clip();
  g.textAlign='center';
  for(let deg=0;deg<360;deg+=15){ const rel=wrapA(deg*Math.PI/180-head); if(Math.abs(rel)>Math.PI/2) continue; const x=X(rel);
    const lab={0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SW',270:'W',315:'NW'}[deg];
    g.strokeStyle='rgba(255,255,255,.45)'; g.lineWidth=1; g.beginPath(); g.moveTo(x,14); g.lineTo(x,lab?22:18); g.stroke();
    if(lab){ g.font=(deg%90?'600 11px':'800 14px')+' system-ui'; g.fillStyle=deg===0?'#ff8a8a':'#fff'; g.fillText(lab,x,36); } }
  let next=null, nd=Infinity;
  for(const L of W.lms){ const dx=L.x-r.pos.x, dz=L.z-r.pos.z, d=Math.hypot(dx,dz), rel=wrapA(Math.atan2(dx,-dz)-head);
    if(!L.found&&d<nd){ nd=d; next={L,rel}; }
    if(Math.abs(rel)>Math.PI/2) continue; const x=X(rel);
    g.fillStyle=L.found?'#b9f0cf':'#ffd24a'; g.beginPath(); g.moveTo(x,40); g.lineTo(x+5,46); g.lineTo(x,52); g.lineTo(x-5,46); g.fill(); }
  if(MS&&!MS.done){ const s=MS.stops[MS.idx], rel=wrapA(Math.atan2(s.x-r.pos.x,-(s.z-r.pos.z))-head); g.fillStyle='#3ecf8e'; g.beginPath(); g.arc(X(clamp(rel,-Math.PI/2,Math.PI/2)),46,6,0,6.283); g.fill(); }
  g.restore();
  g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(cx,10); g.lineTo(cx,24); g.stroke();
  if(next){ g.font='600 13px "DM Sans",system-ui'; g.fillStyle='#ffd24a'; g.textAlign='center';
    const dir=Math.abs(next.rel)<0.25?'ahead':next.rel>0?'to your right':'to your left';
    g.fillText(`◆ Unexplored place ${nd>=1000?(nd/1000).toFixed(1)+' km':Math.round(nd)+' m'} ${dir}`,cx,74); }
  g.textAlign='left';
  if(window.HandControl?.running?.()) HandControl.drawPreview(g,14,82,156,117);
  drawRipples(g,Wv,Hv,now); drawFriends(g,Wv,Hv,now); drawHearts(g,Wv,Hv,now);
  drawMissionHud(g,Wv,Hv,now);
  // speed + height
  panel(g,14,Hv-74,200,60); g.fillStyle='#fff'; g.font='800 30px "DM Sans",system-ui'; g.fillText(Math.round(r.v*3.6),26,Hv-36);
  g.font='600 13px "DM Sans",system-ui'; g.fillStyle='#aab4c2'; g.fillText('km/h',26,Hv-20);
  g.fillStyle='#fff'; g.font='700 18px "DM Sans",system-ui'; g.fillText(`${Math.max(0,Math.round(r.pos.y-groundAt(r.pos.x,r.pos.z)))} m`,110,Hv-38);
  g.font='600 13px "DM Sans",system-ui'; g.fillStyle='#aab4c2'; g.fillText('above ground',110,Hv-20);
  // flap meter
  const mw=340, mx=(Wv-mw)/2, my=Hv-64; panel(g,mx-12,my-10,mw+24,56);
  g.fillStyle='#1a2230'; g.beginPath(); g.roundRect(mx,my+14,mw,14,7); g.fill();
  const gr=g.createLinearGradient(mx,0,mx+mw,0); gr.addColorStop(0,'#7fd3ff'); gr.addColorStop(1,'#3ecf8e');
  g.fillStyle=gr; g.beginPath(); g.roundRect(mx,my+14,Math.max(0.001,mw*r.flex),14,7); g.fill();
  g.font='700 13px "DM Sans",system-ui'; g.fillStyle='#fff'; g.fillText(r.flex<0.08?'GLIDING':`FLAPPING ${Math.round(r.flex*100)}%`,mx,my+8);
  g.textAlign='right'; g.font='500 12px "DM Sans",system-ui'; g.fillStyle=fx.src==='none'?'#ff9a8a':'#aab4c2';
  g.fillText(fx.src!=='none'?`from ${fx.src}`:ctrl==='kb'?'Hold Space to flap':fx.trained?'Flex model ready: connect a signal':'No flex model: press F to calibrate here',mx+mw,my+8);
  g.textAlign='left'; g.fillStyle='#aab4c2'; g.fillText(ctrl==='kb'?'Space flaps · let go to glide':'Flex to flap harder · relax to glide',mx,my+42);
  drawTravelMap(g,Wv-184,14,170);
  // messages
  g.textAlign='center';
  if(r.thermal){ g.font='700 18px "DM Sans",system-ui'; g.fillStyle='#ffe9a0'; g.fillText('Rising warm air: circle here to climb',Wv/2,Hv*0.24); }
  if(r.edge){ g.font='700 18px "DM Sans",system-ui'; g.fillStyle='#cfe0ff'; g.fillText('The wind turns you back toward the land',Wv/2,Hv*0.28); }
  const bn=W.usc?bAt(r.pos.x,r.pos.z):null;
  if(bn&&bn.name&&r.pos.y-bn.h<140){ g.font='600 15px "DM Sans",system-ui'; g.fillStyle='#ffffff'; g.fillText('Over '+bn.name,Wv/2,Hv*0.2); }
  if(banner&&now<banner.until){ g.font='800 30px "DM Sans",system-ui'; g.fillStyle=banner.c; g.strokeStyle='rgba(0,0,0,.45)'; g.lineWidth=5; g.strokeText(banner.t,Wv/2,Hv*0.34); g.fillText(banner.t,Wv/2,Hv*0.34); }
  if(W.card&&now<W.card.until){
    const a=clamp(Math.min((now-(W.card.until-7000))/400,(W.card.until-now)/600),0,1), bw=480, by=Hv*0.62;
    g.globalAlpha=a; panel(g,Wv/2-bw/2,by,bw,96,0.72);
    g.font='600 12px "DM Sans",system-ui'; g.fillStyle='#ffd24a'; g.fillText('NEW PLACE FOUND',Wv/2,by+24);
    g.font='800 24px "DM Sans",system-ui'; g.fillStyle='#fff'; g.fillText(W.card.n,Wv/2,by+52);
    g.font='500 14px "DM Sans",system-ui'; g.fillStyle='#cfd6e0'; wrapText(g,W.card.t,Wv/2,by+78,bw-40,18); g.globalAlpha=1;
  }
  g.textAlign='left';
}
function drawTravelMap(g,x,y,s){
  const E=W.co.mapE||W.co.size*0.36, P=(px,pz)=>[x+s/2+px/E*(s/2-4),y+s/2+pz/E*(s/2-4)];
  panel(g,x,y,s,s,0.4);
  if(W.mapImg){ g.globalAlpha=0.85; g.drawImage(W.mapImg,x+4,y+4,s-8,s-8); g.globalAlpha=1; }
  for(const L of W.lms){ const [a,b]=P(L.x,L.z); g.fillStyle=L.found?'#b9f0cf':'#ffd24a'; g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=1.5;
    g.beginPath(); g.moveTo(a,b-5); g.lineTo(a+5,b); g.lineTo(a,b+5); g.lineTo(a-5,b); g.closePath(); g.fill(); g.stroke(); }
  if(MS&&!MS.done){ const s=MS.stops[MS.idx], [a,b]=P(s.x,s.z); g.strokeStyle='#3ecf8e'; g.lineWidth=2.5; g.beginPath(); g.arc(a,b,7,0,6.283); g.stroke(); }
  for(const rm of remotes.values()) if(rm.r&&(!rm.k||rm.k===me.course)){ const [a,b]=P(rm.r.pos.x,rm.r.pos.z); g.fillStyle=BD[rm.c].look.body; g.beginPath(); g.arc(a,b,4,0,Math.PI*2); g.fill(); }
  const r=me.r, [a,b]=P(r.pos.x,r.pos.z); g.save(); g.translate(a,b); g.rotate(Math.atan2(r.fwd.z,r.fwd.x));
  g.fillStyle='#fff'; g.strokeStyle='#123'; g.lineWidth=1.5; g.beginPath(); g.moveTo(8,0); g.lineTo(-6,5); g.lineTo(-3,0); g.lineTo(-6,-5); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function drawGaze(g,w,h){
  if(ctrl==='kb') return;
  const gz=W.gz;
  if(!gz){ if(ctrl==='eyes'&&!window.EyeControl?.running?.()){ g.font='500 12px "DM Sans",system-ui'; g.fillStyle='rgba(255,255,255,.75)'; g.textAlign='center';
    g.fillText('Eye steering is off: press Start eye tracking (calibrate first on the Eye control tab)',w/2,h-100); g.textAlign='left'; } return; }
  const cx=w/2, cy=h*0.46;
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1.5; g.setLineDash([4,5]); g.beginPath(); g.ellipse(cx,cy,gz.dead*w/2,gz.dead*h/2,0,0,Math.PI*2); g.stroke(); g.setLineDash([]);
  const act=gz.turn||gz.pitch;
  if(act){ g.strokeStyle='rgba(159,220,255,.5)'; g.beginPath(); g.moveTo(cx,cy); g.lineTo(gz.sx,gz.sy); g.stroke(); }
  const rr=gz.r||18, gd=g.createRadialGradient(gz.sx,gz.sy,0,gz.sx,gz.sy,rr); gd.addColorStop(0,act?'rgba(185,240,207,.30)':'rgba(255,255,255,.22)'); gd.addColorStop(1,act?'rgba(185,240,207,.05)':'rgba(255,255,255,.04)'); g.fillStyle=gd; g.beginPath(); g.arc(gz.sx,gz.sy,rr,0,Math.PI*2); g.fill(); // the gaze is a region, not a point
  g.strokeStyle=act?'#b9f0cf':'rgba(255,255,255,.8)'; g.lineWidth=2; g.beginPath(); g.arc(gz.sx,gz.sy,rr,0,Math.PI*2); g.stroke();
  g.fillStyle=act?'#b9f0cf':'#fff'; g.beginPath(); g.arc(gz.sx,gz.sy,2.5,0,Math.PI*2); g.fill();
}

function setMode(m,force){
  if(m!=='race'&&m!=='travel') m='race';
  if(!force&&(phase==='countdown'||phase==='race')){ msg('Finish this race first, then switch modes.',true); $('rMode').value=mode; return; }
  mode=m; $('rMode').value=m; prefs(true); hearts=STARTH;
  if(!force&&phase!=='free') backToFree();
  if(!force){ for(const b of racers) if(!b.isMe) removeRacer(b); racers=me.r?[me.r]:[]; }
  applyModeUI(); applyModeVis();
  if(!force&&W&&me.r){ if(m==='travel') placeTravel(me.r); else { placeAt(me.r,0,0,20); me.r.v=30; } }
  if(!force) msg(m==='travel'?'Travel mode: no timer and no rivals. Explore and find the hidden places. Friends in your room fly with you.':'Race mode. Press Start race to race computer birds, or join a room to race friends.');
}
function applyModeUI(){
  const tv=mode==='travel';
  $('rRaceOpts').hidden=tv; $('rTravelOpts').hidden=!tv; $('rStart').hidden=tv;
  $('rHelpRace').hidden=tv; $('rHelpTravel').hidden=!tv; $('rJournalPanel').hidden=!tv; renderMissions();
  $('rEyeOpts').hidden=ctrl==='kb';
}

/* ---------- main loop ---------- */
function update(dt,now){
  const t=now/1000;
  if(!me.r) { me.r=newRacer({id:me.id,name:me.name,c:me.c,isMe:true}); placeAt(me.r,0,0,20); me.r.v=30; racers=[me.r]; if(mode==='travel') placeTravel(me.r); }
  const fx=myFlex(dt); W.fx=fx;
  if(W.usc){ updateUsc(dt,t); updateMission(dt,now); } else updateNature(dt,t);
  updateEnv(dt); updateRain(dt); updateTogether(now);
  updateFsUi(dt,now);
  if(keys.b&&callHoldAt&&now-callHoldAt>450&&now-callHoldLast>1400){ callHoldLast=now; interactCall(1.0,true); } // holding B keeps calling
  W.clouds.position.x=Math.sin(t*0.004)*260; W.clouds.position.z=Math.cos(t*0.003)*160;
  if(mode==='travel'){
    stepTravel(me.r,menuOpen?{turn:0,pitch:0,flex:0,level:true}:myInput(dt,fx),dt); updateTravel(dt,t,now);
    updateRemotes(dt,now); updateObstacles(dt); updateParticles(dt); stormBolts(now,dt);
    return;
  }
  if(phase==='countdown'){
    me.r.flex=fx.L; me.r.boostVis+=(fx.L-me.r.boostVis)*Math.min(1,dt*8);
    if(now>=goAt){ phase='race'; raceT0=now;
      for(const r of racers){
        if(r.isMe&&!participants.includes(me.id)) continue;
        const L=r.isMe?fx.L:(Math.random()<0.6?0.6:0.3);
        if(L>=0.45&&L<=0.75){ r.rocket=2.2; r.v=30; if(r.isMe) banner={t:'Rocket start!',until:now+1500,c:'#7fffb0'}; }
        else if(L>0.9){ r.tumble=0.7; if(r.isMe) banner={t:'Too hard! Stalled',until:now+1500,c:'#ff8a65'}; }
        else r.v=18;
      } }
  } else {
    for(const r of racers) if(r.isBot) stepRacer(r,botInput(r,t,me.r),dt);
  }
  if(phase!=='countdown'||!participants.includes(me.id)) stepRacer(me.r,myInput(dt,fx),dt); // spectators keep flying
  if(phase==='race') checkRaceOver(now);
  if(phase==='done'&&now>=doneAt) backToFree();
  updateRemotes(dt,now);
  updateObstacles(dt);
  updateParticles(dt);
  stormBolts(now,dt);
  // motes drift along the course
  const mo=W.motes, mp=mo.pts.geometry.attributes.position.array, tr=W.tr;
  for(let k=0;k<mo.n;k++){ let s=mo.seeds[k*3]+dt*6; if(s>=M) s-=M; mo.seeds[k*3]=s; const i=Math.floor(s);
    const p=tr.P[i], S=tr.S[i], U=tr.U[i], a=mo.seeds[k*3+1]*TUBE*0.9, b=mo.seeds[k*3+2]*TUBE*0.6;
    mp[k*3]=p.x+S.x*a+U.x*b; mp[k*3+1]=p.y+S.y*a+U.y*b; mp[k*3+2]=p.z+S.z*a+U.z*b; }
  mo.pts.geometry.attributes.position.needsUpdate=true;
}
function stormBolts(now,dt){
  // storms: random lightning
  W.flash.intensity*=Math.pow(0.002,dt);
  for(const s of W.storms){ if(s.bolt.visible&&now>s.boltOff) s.bolt.visible=false;
    if(now>s.next){ s.next=now+1500+Math.random()*4000; if(s.c.distanceTo(me.r.pos)<900){
      const pts=[], p=s.c.clone().add(new T.Vector3((Math.random()-0.5)*20,-4,(Math.random()-0.5)*20)); for(let j=0;j<9;j++){ pts.push(p.clone()); p.add(new T.Vector3((Math.random()-0.5)*8,-7,(Math.random()-0.5)*8)); }
      s.bolt.geometry.setFromPoints(pts); s.bolt.visible=true; s.boltOff=now+140; W.flash.position.copy(s.c); W.flash.intensity=3e4; thunder(s.c.distanceTo(me.r.pos)); } } }
}
function syncModel(r,t,dt){
  const m=r.model; m.position.copy(r.pos); m.rotation.set(-r.pitch,r.yaw,r.roll,'YXZ');
  const blink=r.inv>0&&r.tumble<=0?(Math.sin(t*30)>0):true; m.visible=blink;
  const u=m.userData;
  animBird(m,t,phase==='countdown'?0.2:0.25+0.75*Math.max(r.boostVis,(r.v-35)/60),r.phase,dt);
  m.updateMatrixWorld();
  updateTrail(r.trail,m,0.15+0.85*clamp(r.boostVis+(r.updraft>0?0.5:0),0,1));
  if(r.label){ r.label.position.copy(r.pos); r.label.position.y+=4.5; const d=r.pos.distanceTo(R.camera.position); r.label.material.opacity=clamp((d-12)/20,0,1); r.label.visible=d<700; }
}
const SC={}; const sv=n=>SC[n]||(SC[n]=new T.Vector3());
function render(dt,now){
  const t=now/1000, cv=$('raceCanvas'), rect=cv.getBoundingClientRect(), w=Math.max(1,Math.round(rect.width)), h=Math.max(1,Math.round(rect.height));
  const {renderer,camera}=R;
  if(w!==R.w||h!==R.h){ renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); R.w=w; R.h=h; }
  for(const r of racers) syncModel(r,t,dt);
  for(const rm of remotes.values()) if(rm.r) syncModel(rm.r,t,dt);
  // chase camera
  const tv=mode==='travel', r=me.r, k=1-Math.exp(-dt*(tv?3.5:6)), sk=W.co.usc?clamp(0.2+citySize()*0.45,0.4,0.9):1, back=((camMode===1?34:tv?15:13)+5*r.boostVis)*sk;
  const flat=sv('flat').set(Math.sin(r.yaw),0,Math.cos(r.yaw));
  const want=sv('want').copy(r.pos).addScaledVector(r.fwd,-back*0.75).addScaledVector(flat,-back*0.25); want.y+=(camMode===1?11:tv?4.8:4.2)*sk;
  if(camMode===2){ want.copy(r.pos).addScaledVector(sv('side').set(Math.cos(r.yaw),0,-Math.sin(r.yaw)),16*sk).addScaledVector(flat,5); want.y+=2.5; }
  if(phase==='done'||(r.fin!=null&&phase==='race')){ const a=t*0.3; want.copy(r.pos).add(sv('orb').set(Math.sin(a)*22,8,Math.cos(a)*22)); }
  if(camera.position.distanceTo(want)>150) camera.position.copy(want); else camera.position.lerp(want,k);
  if(W.usc){ for(let k=0;k<8;k++){ const b=bAt(camera.position.x,camera.position.z); if(!b||camera.position.y>b.h+0.5) break; camera.position.lerp(r.pos,0.3); } } // never film from inside a wall
  const g=(W.usc?heightAt(camera.position.x,camera.position.z):groundAt(camera.position.x,camera.position.z))+(W.usc?1.2:2); if(camera.position.y<g) camera.position.y=g;
  const look=sv('look').copy(r.pos).addScaledVector(r.fwd,camMode===2?2:10*sk); look.y+=1.5*sk; R.look.lerp(look,1-Math.exp(-dt*10));
  camera.lookAt(R.look);
  R.roll=(R.roll||0)+((r.tumble>0?0:-clamp(r.roll,-1,1)*0.28)-(R.roll||0))*(1-Math.exp(-dt*3)); camera.rotateZ(R.roll); // the horizon tilts a little into turns
  if(shake>0){ shake=Math.max(0,shake-dt); camera.position.x+=(Math.random()-0.5)*shake*1.5; camera.position.y+=(Math.random()-0.5)*shake*1.5; }
  const fov=(tv?62:66)+(tv?14:20)*r.boostVis+(r.updraft>0||r.rocket>0?6:0); R.fov+=(fov-R.fov)*Math.min(1,dt*4);
  if(Math.abs(camera.fov-R.fov)>0.05){ camera.fov=R.fov; camera.updateProjectionMatrix(); }
  // speed lines
  const sp=W.speed, lp=sp.lp, op=clamp(r.boostVis*1.2-0.15+(r.rocket>0?0.6:0),0,1)*0.35; sp.lines.material.opacity=op;
  if(op>0.01){ for(let j=0;j<sp.seeds.length;j++){ const s=sp.seeds[j]; s.z+=r.v*dt*1.6; if(s.z>-2){ s.z=-60-Math.random()*20; s.a=Math.random()*6.28; s.r=5+Math.random()*8; }
      const x=Math.cos(s.a)*s.r, y=Math.sin(s.a)*s.r*0.65, o=j*6; lp[o]=x; lp[o+1]=y; lp[o+2]=s.z; lp[o+3]=x; lp[o+4]=y; lp[o+5]=s.z-3-r.v*0.05; }
    sp.lines.geometry.attributes.position.needsUpdate=true; }
  // sky, water, sun follow the camera
  W.sky.position.copy(camera.position); W.skyU.time.value=t; W.horizon.position.set(camera.position.x,0,camera.position.z);
  adaptScale(dt,now);
  if(W.water){ W.waterU.time.value=t; W.waterU.camPos.value.copy(camera.position); W.water.position.x=Math.round(camera.position.x/70)*70; W.water.position.z=Math.round(camera.position.z/70)*70; }
  W.sun.position.copy(r.pos).addScaledVector(W.sunDir,500); W.sun.target.position.copy(r.pos); W.sun.target.updateMatrixWorld();
  { const sm=renderer.shadowMap; if(sm.enabled){ sm.autoUpdate=false; R.fr=(R.fr||0)+1; sm.needsUpdate=R.fr<6||R.fr%2===0; } } // the shadow pass (every building tile again) runs every other frame: shadows stay anchored to the world, half the cost
  renderer.render(W.scene,camera);
  if(photoReq){ photoReq=false; savePhoto(); }
  drawHud(now);
}
// Dynamic resolution: if frames get slow, render fewer pixels (the HUD stays sharp); creep back up when there is headroom.
function adaptScale(dt,now){
  if(R.warm>0){ R.warm--; return; }
  R.ft+=(dt*1000-R.ft)*0.06;
  const q=QUAL[$('rQuality').value]||QUAL.medium, apply=()=>R.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.pr)*R.scale);
  if(R.ft>25&&R.scale>0.55&&now-R.adj>1000){ if(now-R.raised<5000) R.cap=Math.max(0.55,R.scale-0.05); R.scale=Math.max(0.55,R.scale-0.1); R.adj=now; R.warm=20; apply(); }
  else if(R.ft<19&&R.scale<R.cap&&now-R.adj>5000){ R.scale=Math.min(R.cap,R.scale+0.05); R.adj=now; R.raised=now; R.warm=20; apply(); }
}
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  const visible=EMG().activeTab()==='tabRace';
  audioTick(now);
  if(visible&&!T&&!loading&&!loadErr) loadThree();
  if(visible&&T&&R&&lastQual!==$('rQuality').value){ lastQual=$('rQuality').value; buildWorld(me.course); }
  if(!T||!W){ if(visible) drawLoading(); return; }
  if(!visible&&!client&&phase==='free') return;
  update(dt,now);
  if(client&&now-lastSend>66){ lastSend=now; publishState(); }
  if(visible) render(dt,now);
}

/* ---------- HUD ---------- */
function hudCtx(){
  const cv=$('raceHud'), r=cv.getBoundingClientRect(), d=devicePixelRatio||1, Wd=Math.max(1,Math.round(r.width*d)), Hd=Math.max(1,Math.round(r.height*d));
  if(cv.width!==Wd||cv.height!==Hd){ cv.width=Wd; cv.height=Hd; }
  const g=cv.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,r.width,r.height); return [g,r.width,r.height];
}
function drawLoading(){
  const [g,w,h]=hudCtx(); g.fillStyle='#0b0e12'; g.fillRect(0,0,w,h);
  g.textAlign='center'; g.font='600 18px "DM Sans",system-ui'; g.fillStyle=loadErr?'#ff8a8a':'#e6e9ee';
  wrapText(g,loadErr||'Loading the 3D world…',w/2,h/2,w*0.8,24); g.textAlign='left';
}
function wrapText(g,txt,x,y,maxW,lh){ const words=txt.split(' '); let line='', lines=[]; for(const wd of words){ const t=line?line+' '+wd:wd; if(g.measureText(t).width>maxW&&line){ lines.push(line); line=wd; } else line=t; } lines.push(line); lines.forEach((l,i)=>g.fillText(l,x,y+(i-(lines.length-1)/2)*lh)); }
function panel(g,x,y,w,h,a=0.45){ g.fillStyle=`rgba(8,12,18,${a})`; g.beginPath(); g.roundRect(x,y,w,h,10); g.fill(); }
function drawHud(now){
  const [g,w,h]=hudCtx(), r=me.r, fx=W.fx||{L:0,src:'none'}, sc=clamp(w/1000,0.65,1.4);
  if(W.flashT&&now-W.flashT<300){ g.fillStyle=`rgba(255,255,255,${0.7*(1-(now-W.flashT)/300)})`; g.fillRect(0,0,w,h); }
  if(hideHud) return;
  g.save(); g.scale(sc,sc); const Wv=w/sc, Hv=h/sc; drawCalOverlay(g,Wv,Hv,now,fx);
  if(mode==='travel'){ drawTravelHud(g,Wv,Hv,now,fx); g.restore(); drawGaze(g,w,h); return; }
  const racing=phase!=='free', inIt=participants.includes(me.id);
  // standings (top-left)
  const st=standings();
  if(racing&&inIt){
    panel(g,14,14,210,82); g.fillStyle='#fff'; g.font='800 46px "DM Sans",system-ui'; g.fillText(ord(placeOf(r)),26,64);
    g.font='600 15px "DM Sans",system-ui'; g.fillStyle='#cfd6e0'; g.fillText(`of ${st.length}`,130,40);
    g.fillText(`Lap ${clamp(r.lap,1,laps)}/${laps}`,130,62);
    g.fillText(phase==='countdown'?'0:00.00':fmtT(r.fin??(now-raceT0)/1000),130,84);
  }
  const ly=racing&&inIt?108:14;
  if(st.length>1||racing){ panel(g,14,ly,210,10+st.length*20,0.35);
    st.forEach((s,i)=>{ const y=ly+20+i*20; g.fillStyle=BD[s.c]?.look.body||'#888'; g.beginPath(); g.arc(28,y-5,6,0,Math.PI*2); g.fill();
      g.font=(s.me?'700 ':'500 ')+'13px "DM Sans",system-ui'; g.fillStyle=s.me?'#b9f0cf':s.bot?'#ffe08a':'#e6e9ee';
      g.fillText(`${i+1}. ${s.n.slice(0,14)}`,40,y); g.textAlign='right'; g.fillStyle='#aab4c2';
      g.fillText(s.fin!=null?fmtT(s.fin):racing?`lap ${clamp(Math.floor(s.prog),1,laps)}`:'',214,y); g.textAlign='left'; }); }
  // speed (bottom-left)
  panel(g,14,Hv-74,150,60); g.fillStyle='#fff'; g.font='800 32px "DM Sans",system-ui'; g.fillText(Math.round(r.v*3.6),26,Hv-34);
  g.font='600 13px "DM Sans",system-ui'; g.fillStyle='#aab4c2'; g.fillText('km/h',26,Hv-20); g.fillText(BD[me.c].name.split(' ').pop(),90,Hv-20);
  // flex + stamina meter (bottom-centre)
  const mw=380, mx=(Wv-mw)/2, my=Hv-74; panel(g,mx-12,my-8,mw+24,68);
  g.fillStyle='#1a2230'; g.beginPath(); g.roundRect(mx,my+16,mw,18,9); g.fill();
  if(phase==='countdown'){ g.fillStyle='rgba(127,255,176,.28)'; g.fillRect(mx+mw*0.45,my+16,mw*0.3,18); }
  const gr=g.createLinearGradient(mx,0,mx+mw,0); gr.addColorStop(0,'#3ecf8e'); gr.addColorStop(0.6,'#f0c040'); gr.addColorStop(1,'#ff5d5d');
  g.fillStyle=r.exhaust?'#5a6170':gr; g.beginPath(); g.roundRect(mx,my+16,Math.max(0.001,mw*(phase==='countdown'?fx.L:r.flex)),18,9); g.fill();
  g.strokeStyle='rgba(255,255,255,.25)'; for(const q of [0.25,0.5,0.75]){ g.beginPath(); g.moveTo(mx+mw*q,my+16); g.lineTo(mx+mw*q,my+34); g.stroke(); }
  g.fillStyle='#2a3240'; g.fillRect(mx,my+40,mw,6); g.fillStyle=r.exhaust?'#ff5d5d':'#6fd39b'; g.fillRect(mx,my+40,mw*r.stam,6);
  g.font='700 13px "DM Sans",system-ui'; g.fillStyle='#fff';
  g.fillText(`FLEX ${Math.round((phase==='countdown'?fx.L:r.flex)*100)}%`,mx,my+10);
  g.textAlign='right'; g.fillStyle=fx.src==='none'?'#ff9a8a':'#aab4c2'; g.font='500 12px "DM Sans",system-ui';
  const kbOn=ctrl==='kb'||(ctrl==='all'&&$('rKeyBoost').checked);
  g.fillText(fx.src!=='none'?`boost from ${fx.src}`:ctrl==='kb'?'Hold Space to boost':(fx.trained?'Flex model ready: connect a signal':'No flex model: press F to calibrate here')+(kbOn?' · Space boosts':''),mx+mw,my+10);
  g.textAlign='left'; g.fillStyle='#aab4c2'; g.fillText(r.exhaust?'Exhausted. Relax to recover':'stamina',mx,my+58);
  // minimap (top-right)
  drawMinimap(g,Wv-184,14,170);
  // centre messages
  g.textAlign='center';
  if(phase==='countdown'){ const s=Math.ceil((goAt-now)/1000); g.font='900 110px "DM Sans",system-ui'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=6;
    if(s<=3){ g.strokeText(String(s),Wv/2,Hv*0.42); g.fillText(String(s),Wv/2,Hv*0.42); }
    g.font='600 18px "DM Sans",system-ui'; g.fillText('Hold a 45–75% flex at GO for a rocket start',Wv/2,Hv*0.42+44); }
  else if(phase==='race'&&now-raceT0<800){ g.font='900 100px "DM Sans",system-ui'; g.fillStyle='#ffe45e'; g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=6; g.strokeText('GO!',Wv/2,Hv*0.42); g.fillText('GO!',Wv/2,Hv*0.42); }
  if(banner&&now<banner.until){ g.font='800 34px "DM Sans",system-ui'; g.fillStyle=banner.c; g.strokeStyle='rgba(0,0,0,.45)'; g.lineWidth=5; g.strokeText(banner.t,Wv/2,Hv*0.3); g.fillText(banner.t,Wv/2,Hv*0.3); }
  if(r.wrong>1.2){ g.font='800 30px "DM Sans",system-ui'; g.fillStyle='#ff5d5d'; g.fillText('WRONG WAY',Wv/2,Hv*0.22); }
  else if(r.off&&phase!=='countdown'){ g.font='700 20px "DM Sans",system-ui'; g.fillStyle='#ffd27f'; g.fillText('Off course: fly back through the rings',Wv/2,Hv*0.22); }
  if(r.storm){ g.font='700 18px "DM Sans",system-ui'; g.fillStyle='#cfe0ff'; g.fillText('Storm cloud! Slowed down',Wv/2,Hv*0.26); }
  if(phase==='free'){ g.font='600 15px "DM Sans",system-ui'; g.fillStyle='rgba(255,255,255,.85)';
    g.fillText(client?`Free flight · ${remotes.size} other player${remotes.size===1?'':'s'} here · press Start race when everyone has joined`:'Free flight · press Start race to race computer birds, or join a room to race friends',Wv/2,Hv-96); }
  if(racing&&!inIt){ g.font='600 16px "DM Sans",system-ui'; g.fillStyle='#e6e9ee'; g.fillText('Watching this race. You can join the next one.',Wv/2,Hv*0.16); }
  // results
  if(phase==='done'&&W.final){ const F=W.final, bw=380, bh=70+F.length*28, bx=(Wv-bw)/2, by=Hv*0.18;
    panel(g,bx,by,bw,bh,0.75); g.font='800 26px "DM Sans",system-ui'; g.fillStyle='#ffe45e'; g.fillText('Results',Wv/2,by+38); g.textAlign='left';
    F.forEach((s,i)=>{ const y=by+72+i*28; g.font=(s.me?'700 ':'500 ')+'17px "DM Sans",system-ui'; g.fillStyle=s.me?'#b9f0cf':'#e6e9ee';
      g.fillText(`${ord(i+1)}  ${s.n.slice(0,16)}`,bx+24,y); g.textAlign='right'; g.fillText(s.fin!=null?fmtT(s.fin):'DNF',bx+bw-24,y); g.textAlign='left'; });
  }
  g.textAlign='left'; g.restore();
  drawGaze(g,w,h);
}
function drawMinimap(g,x,y,s){
  const tr=W.tr, [x0,x1,z0,z1]=tr.box, span=Math.max(x1-x0,z1-z0)*1.1, cx=(x0+x1)/2, cz=(z0+z1)/2;
  const P=(px,pz)=>[x+s/2+(px-cx)/span*s,y+s/2+(pz-cz)/span*s];
  panel(g,x,y,s,s,0.4);
  g.strokeStyle='rgba(255,255,255,.65)'; g.lineWidth=3; g.beginPath(); for(let i=0;i<=M;i+=6){ const p=tr.P[i%M], [a,b]=P(p.x,p.z); i?g.lineTo(a,b):g.moveTo(a,b); } g.stroke();
  const [sa,sb]=P(tr.P[0].x,tr.P[0].z); g.fillStyle='#fff'; g.fillRect(sa-4,sb-4,8,8);
  const dot=(p,col,rad)=>{ const [a,b]=P(p.x,p.z); g.fillStyle=col; g.beginPath(); g.arc(a,b,rad,0,Math.PI*2); g.fill(); };
  for(const r of racers) if(r.isBot) dot(r.pos,'#ffe08a',4);
  for(const rm of remotes.values()) if(rm.r) dot(rm.r.pos,BD[rm.c].look.body,5);
  dot(me.r.pos,'#6fd39b',6);
}

/* ---------- roster previews (rendered once with three.js) ---------- */
function renderPreviews(){
  try{
    const rr=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); rr.setSize(168,126,false); rr.toneMapping=T.ACESFilmicToneMapping;
    const sc=new T.Scene(); sc.add(new T.HemisphereLight('#ffffff','#556070',1.6)); const dl=new T.DirectionalLight('#ffffff',2.4); dl.position.set(3,5,4); sc.add(dl);
    const cam=new T.PerspectiveCamera(30,4/3,0.1,100);
    const saveW=W; W=W||{};
    for(const B of BIRDS){
      const m=buildBird(B); m.scale.setScalar(1); m.rotation.set(-0.15,Math.PI*0.78,0.15,'YXZ'); animBird(m,0.06,0.3,0); sc.add(m);
      const box=new T.Box3().setFromObject(m), c=box.getCenter(new T.Vector3()), sz=box.getSize(new T.Vector3()).length();
      cam.position.copy(c).add(new T.Vector3(0.25,0.35,1).normalize().multiplyScalar(sz*1.75)); cam.lookAt(c);
      rr.render(sc,cam);
      const img=document.querySelector(`#rRoster button[data-id="${B.id}"] .pv`);
      if(img){ const im=document.createElement('img'); im.className='pv'; im.alt=''; im.src=rr.domElement.toDataURL(); img.replaceWith(im); }
      sc.remove(m);
    }
    W=saveW; rr.dispose();
  }catch(e){ console.warn('preview render failed',e); }
}

/* ---------- UI ---------- */
function buildRoster(){
  const box=$('rRoster'); box.replaceChildren();
  for(const B of BIRDS){
    const b=document.createElement('button'); b.type='button'; b.dataset.id=B.id; b.title=`${B.name} (${B.sci})`;
    const pv=document.createElement('div'); pv.className='dot pv'; pv.style.background=B.look.body;
    const sp=document.createElement('span'); sp.textContent=B.name.replace('Ruby-throated ','');
    b.append(pv,sp); b.onclick=()=>pickBird(B.id); box.append(b);
  }
  markBird();
}
function markBird(){
  for(const b of $('rRoster').children) b.classList.toggle('sel',b.dataset.id===me.c);
  const B=BD[me.c], bar=v=>'●'.repeat(clamp(Math.round((v-0.7)*10),1,7))+'○'.repeat(7-clamp(Math.round((v-0.7)*10),1,7));
  $('rPick').textContent=`${B.name} (${B.sci})\n${B.fact}\nSpeed ${bar(B.spd)}  Boost ${bar(B.boost)}\nHandling ${bar(B.hnd)}  Accel ${bar(B.acc)}\nStamina ${bar(B.stam)}${B.tough?'  · shrugs off crashes':''}${B.quick?'  · recovers fast':''}`;
}
function pickBird(id){
  if(phase==='countdown'||phase==='race'){ msg('You can change birds after the race.',true); return; }
  stopBirdSounds(); // the old bird goes quiet at once: its call, its wing hum, anything still ringing
  me.c=id; prefs(true); markBird();
  if(me.r){ me.r.c=id; attachModel(me.r); }
  if(AU.ctx){ AU.callAt=performance.now()+9000; AU.surgeAt=performance.now()+3000; setTimeout(()=>{ if(me.c===id) callNow(0.8); },220); } // and the new bird introduces itself
}
function buildCourses(){
  const box=$('rCourses'); box.replaceChildren();
  for(const co of COURSES){
    const b=document.createElement('button'); b.type='button'; b.dataset.id=co.id; b.title=co.desc;
    const sw=document.createElement('div'); sw.className='sw'; sw.style.background=`linear-gradient(180deg,${co.sky.top},${co.sky.hor} 60%,${co.water?co.water.shallow:co.rock})`;
    const sp=document.createElement('span'); sp.textContent=co.name; b.append(sw,sp); b.onclick=()=>pickCourse(co.id); box.append(b);
  }
  markCourse();
}
function markCourse(){ for(const b of $('rCourses').children) b.classList.toggle('sel',b.dataset.id===me.course); $('rCourseInfo').textContent=`${CO[me.course].name}: ${CO[me.course].desc}`; }
function pickCourse(id,remote){
  if(phase==='countdown'||phase==='race'){ msg('You can change the course after the race.',true); return; }
  me.course=id; prefs(true); markCourse(); hearts=STARTH;
  if((id==='usc'||id==='la')&&!remote) msg(id==='usc'?'USC Campus: switch Mode to Travel and fly low over the paths. Names appear on buildings as you get close, and people scatter if you swoop down at them.':'Downtown Los Angeles: switch Mode to Travel. Weave between the towers, and swoop low over the sidewalks to startle the crowds.');
  if(T&&R){ buildWorld(id); if(me.r){ placeAt(me.r,0,0,20); me.r.v=30; me.r.lap=0; me.r.cp=true; if(mode==='travel') placeTravel(me.r); } }
  if(!remote&&client?.connected) client.publish(`${base}/c`,JSON.stringify({type:'course',k:id,by:me.id,n:me.name}),{qos:1});
}
function isTyping(e){ const t=e.target; return (t instanceof HTMLInputElement&&t.type!=='checkbox'&&t.type!=='range')||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement; }
window.addEventListener('keydown',e=>{
  if(EMG().activeTab()!=='tabRace'||isTyping(e)) return;
  const k=e.key.toLowerCase();
  if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
  audioInit();
  if(k==='r'&&!e.repeat&&me.r&&W&&phase!=='countdown'){ if(mode==='travel') placeTravel(me.r); else respawn(me.r); }
  if(k==='c'&&!e.repeat){ camMode=(camMode+1)%3; banner={t:['Chase camera','Wide camera','Side camera'][camMode],until:performance.now()+900,c:'#ffffff'}; }
  if(k==='h'&&!e.repeat) hideHud=!hideHud;
  if(k==='g'&&!e.repeat) toggleFs();
  if(k==='o'&&!e.repeat){ if(menuOpen) closeMenu(); else openMenu(); }
  if(k==='n'&&!e.repeat&&window.HandControl?.running?.()) HandControl.setNeutral();
  if(k==='t'&&!e.repeat&&mode==='travel') flyToFriend();
  if(k==='y'&&!e.repeat&&mode==='travel'){ if(follow) setFollow(null); else { const L=friendsHere(); if(!L.length) msg('No friend is on this map to follow.',true); else setFollow(L.reduce((a,b)=>me.r.pos.distanceTo(a.r.pos)<me.r.pos.distanceTo(b.r.pos)?a:b).id); } }
  if(/^[1-5]$/.test(k)&&!e.repeat&&client?.connected&&!e.ctrlKey&&!e.metaKey){ sendEmote(['👋','❤️','🎉','😮','📍'][+k-1]); }
  if(k==='b'&&!e.repeat&&phase!=='countdown'){ interactCall(0.85,false); callHoldAt=performance.now(); callHoldLast=callHoldAt; }
  if(k==='f'&&!e.repeat) calFlex();
  if(k==='m'&&!e.repeat&&mode==='travel'&&W&&W.usc){ if(MS&&!MS.done) stopMission(); else startMission(MISSIONS[W.co.id][0].id); }
  if(k==='p'&&!e.repeat) takePhoto();
  keys[k]=true;
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; if(e.key.toLowerCase()==='b') callHoldAt=0; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });

/* ---------- real-map cities: USC University Park Campus (usc-data.js) and downtown Los Angeles (la-data.js) ----------
   Both come from OpenStreetMap. Local metres: x east, z south. Buildings are solid (flying into a wall slides you out); roofs count as ground. */
let U=null, GR={x0:-1100,x1:1100,z0:-1100,z1:1300};
const UC={};
function gridAdd(rec){ for(let gx=Math.floor(rec.x0/U.CELL);gx<=Math.floor(rec.x1/U.CELL);gx++) for(let gz=Math.floor(rec.z0/U.CELL);gz<=Math.floor(rec.z1/U.CELL);gz++){ const k=gx*4096+gz; let l=U.grid.get(k); if(!l) U.grid.set(k,l=[]); l.push(rec); } }
/* ---- what the real buildings look like (researched) ----
   USC is Northern-Italian Romanesque Revival: brick walls with cream limestone trim, arched windows and doors, red clay-tile roofs, a few towers.
   Newer halls echo it (Wallis Annenberg Hall is brick and precast), the Cinematic Arts complex is Mediterranean/Italianate stucco and tile,
   the Von KleinSmid Center (now the Medicine Crow Center) is a white 1960s arcaded block with a globe-topped 51 m tower, and the Coliseum has its arched peristyle at the east end.
   Wall pattern k in the shader: 1 punched windows, 3 glass curtain wall, 4 brick + arched windows + stone trim, 5 modern ribbon windows, 6 stucco + small arched windows, 7 concrete with tall slots. */
const BRICK=['#a65a40','#b0684c','#a35a45','#b97a5c','#9c5640'], STUCCO=['#e6d9bb','#dcc3a0','#e8dcc6','#d9c9a8','#efe9d8'], TILEC=['#b5503a','#a8452f','#bb5a40'], SHINGLE=['#6f655c','#7b6e63','#5f6870','#6a5f58'];
const USC_STYLE={
  'Bovard Administration Building':{k:4,w:'#a9553f',roof:'tile',tw:[{w:9,dh:16,cap:'pyr',cc:'#5a7f6a',wc:'#a9553f',fin:1}]},
  'Edward L Doheny Junior Memorial Library':{k:4,w:'#a85a42',roof:'tile'},
  'Mudd Hall':{k:4,w:'#b0684c',roof:'tile',tw:[{w:5.5,dh:16,cap:'pyr',cc:'#b04a35',wc:'#b0684c'}]},
  'Taper Hall':{k:4,w:'#b97a5c',roof:'tile'}, 'Student Union':{k:4,w:'#a85a42',roof:'tile'}, 'Zumberge Hall':{k:4,w:'#b0684c',roof:'tile'},
  'Physical Education Building':{k:4,w:'#a35a45',roof:'tile'}, 'Heritage Hall':{k:4,w:'#b0684c',roof:'tile'},
  'Widney Alumni House':{k:6,w:'#efe9d8',roof:'gable',rc:'#5f6b5a'}, 'Allan Hancock Foundation':{k:6,w:'#e6d9bb',roof:'tile'},
  'Wallis Annenberg Hall':{k:4,w:'#a35a45',roof:'flat'}, 'Ronald Tutor Campus Center':{k:5,w:'#d8cfbf',roof:'flat'}, 'Galen Center':{k:5,w:'#cdb892',roof:'flat'},
  'Dr. Joseph Medicine Crow Center for International and Public Affairs':{k:6,w:'#ece6d8',roof:'flat',tw:[{w:7,dh:40,cap:'globe',wc:'#ece6d8'}],col:10},
  'Seeley G. Mudd Building':{k:7,w:'#d3cec1',roof:'flat'},
  SCA:{k:6,w:'#dcc3a0',roof:'tile'},
  'U.S. Bank Tower':{k:3,w:'#8fa6b8',tw:[{w:0.66,dh:9,cap:'flat',wc:'#c4dcea'},{w:0.46,dh:9,y:9,cap:'flat',wc:'#d2e6f2'},{w:0.26,dh:10,y:18,cap:'spire',sh:26,wc:'#e0eef6'}]},
  'Wilshire Grand Building':{k:3,w:'#a5b5c0',tw:[{w:0.55,dh:26,cap:'flat',wc:'#b9cad6'},{w:0.14,dh:14,y:26,cap:'spire',sh:52,wc:'#dfe8ee'}]},
  'Aon Center':{k:7,w:'#e4e2da'}, 'Bradbury Building':{k:4,w:'#a8613f',roof:'flat'},
  'Cathedral of Our Lady of the Angels':{k:0,w:'#d4bf98',roof:'flat'}, 'The Broad Museum':{k:0,w:'#f1f0ec',roof:'flat'}};
const hsh=i=>{ const x=Math.sin(i*12.9898+78.233)*43758.5453; return x-Math.floor(x); };
function obb(p,n){ // smallest rotated box around a footprint: u = long axis
  let best=null;
  for(let i=0;i<n;i++){ const j=(i+1)%n, ex=p[j*2]-p[i*2], ez=p[j*2+1]-p[i*2+1], l=Math.hypot(ex,ez); if(l<0.5) continue; const ux=ex/l, uz=ez/l; let s0=1e9,s1=-1e9,t0=1e9,t1=-1e9;
    for(let k=0;k<n;k++){ const s=p[k*2]*ux+p[k*2+1]*uz, t=-p[k*2]*uz+p[k*2+1]*ux; if(s<s0)s0=s; if(s>s1)s1=s; if(t<t0)t0=t; if(t>t1)t1=t; }
    const a=(s1-s0)*(t1-t0); if(!best||a<best.a) best={a,ux,uz,s0,s1,t0,t1}; }
  if(!best) return {ux:1,uz:0,cx:p[0],cz:p[1],hs:1,ht:1};
  let ux=best.ux, uz=best.uz, hs=(best.s1-best.s0)/2, ht=(best.t1-best.t0)/2; const cs=(best.s0+best.s1)/2, ct=(best.t0+best.t1)/2, cx=cs*ux-ct*uz, cz=cs*uz+ct*ux;
  if(hs<ht){ const t=ux; ux=-uz; uz=t; const q=hs; hs=ht; ht=q; }
  return {ux,uz,cx,cz,hs,ht};
}
let CITY_H=1;   // USC buildings are drawn 1.3x taller than the survey heights so the campus feels properly monumental next to a bird
function uscStyle(rec,i){
  const r=hsh(i), st=USC_STYLE[rec.name]||(/^School of Cinematic Arts/.test(rec.name)?USC_STYLE.SCA:null), h0=rec.h*CITY_H, ob=obb(rec.p,rec.n); rec.ob=ob; rec.hv=r;
  const rect=!rec.hl.length&&rec.n<=24&&rec.area/(4*ob.hs*ob.ht)>0.84&&rec.area>40;
  let kind=1, wc=null, roof='flat', rcol=null;
  if(st){ kind=st.k; wc=st.w; roof=st.roof||'flat'; rcol=st.rc; }
  else if(rec.g) kind=3;
  else if(rec.k==='p') kind=2;
  else if(rec.k==='o'||h0<5) kind=0;
  else if(rec.k==='u'){ if(h0>=30) kind=5; else if(r<0.5){ kind=4; wc=BRICK[Math.floor(r*10)%BRICK.length]; roof=h0<24?'tile':'flat'; } else if(r<0.78){ kind=6; wc=STUCCO[Math.floor(r*13)%STUCCO.length]; roof='tile'; } }
  else if(rec.k==='r'){ kind=r<0.45?6:1; roof='shingle'; }
  else if(rec.k==='c') kind=r<0.5?5:1;
  if(rec.c) wc=rec.c;
  if(!wc) wc=kind===3?GLASS_COLS[Math.floor(r*977)%GLASS_COLS.length]:WALL_COLS[rec.k][Math.floor(r*977)%WALL_COLS[rec.k].length];
  rec.rise=0; rec.rf=null;
  if(rect&&(roof==='tile'||roof==='shingle'||roof==='gable')&&!rec.g&&h0<26&&rec.rs!=='flat'){ const span=2*ob.ht;
    if(span>=5&&span<=36){ rec.rf=(roof==='gable'||(ob.hs/ob.ht>1.35&&r>0.4))?'gable':'hip'; rec.rise=clamp(ob.ht*0.5,1.3,5.5); } }
  rec.hw=h0; rec.h=h0+rec.rise*0.85; rec.kind=kind; rec.wc=wc; rec.st=st; rec.roofK=roof==='tile'?8:0;
  rec.rcol=rcol||(roof==='tile'?TILEC[Math.floor(r*31)%TILEC.length]:roof==='shingle'?SHINGLE[Math.floor(r*37)%SHINGLE.length]:rec.rc||(rec.g?'#9aa4ab':rec.k==='p'?'#9b9a90':'#8e8d87'));
}
function uscPrep(co){
  if(UC[co.id]){ U=UC[co.id]; GR=U.GR; return true; }
  const D=window[co.data]; if(!D) return false; CITY_H=co.id==='usc'?1.3:1;
  U={D,B:[],hs:CITY_H,grid:new Map(),CELL:32,people:null,cars:null,labels:null,stadia:[],GR:{x0:D.gr[0],x1:D.gr[1],z0:D.gr[2],z1:D.gr[3]}}; GR=U.GR; UC[co.id]=U;
  let bi=0;
  for(const b of D.b){
    let p=b.p.slice(), n=p.length/2, A=0;
    for(let i=0;i<n;i++){ const j=(i+1)%n; A+=p[i*2]*p[j*2+1]-p[j*2]*p[i*2+1]; }
    if(A<0){ const q=[]; for(let i=n-1;i>=0;i--) q.push(p[i*2],p[i*2+1]); p=q; A=-A; } // outer ring always counter-clockwise, so normals point outward
    const holes=(b.hl||[]).map(h=>{ const m=h.length/2; let a=0; for(let i=0;i<m;i++){ const j=(i+1)%m; a+=h[i*2]*h[j*2+1]-h[j*2]*h[i*2+1]; } let q=h; if(a>0){ q=[]; for(let i=m-1;i>=0;i--) q.push(h[i*2],h[i*2+1]); } return Float32Array.from(q); }); // courtyards run clockwise
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,cx=0,cz=0;
    for(let i=0;i<n;i++){ const x=p[i*2], z=p[i*2+1]; x0=Math.min(x0,x); x1=Math.max(x1,x); z0=Math.min(z0,z); z1=Math.max(z1,z); cx+=x; cz+=z; }
    let ar=A/2; for(const hh of holes){ const m=hh.length/2; let a=0; for(let i=0;i<m;i++){ const j=(i+1)%m; a+=hh[i*2]*hh[j*2+1]-hh[j*2]*hh[i*2+1]; } ar+=a/2; }
    const rec={p:Float32Array.from(p),n,hl:holes,h:b.h,k:b.k,name:b.n,c:b.c,rc:b.rc,rs:b.rs,area:Math.max(1,ar),x0,x1,z0,z1,cx:cx/n,cz:cz/n,g:b.k!=='p'&&((b.h>=46&&b.k!=='u')||b.h>=70)};
    uscStyle(rec,bi++); U.B.push(rec); gridAdd(rec);
  }
  U.byName=new Map(); for(const b of U.B) if(b.name&&(!U.byName.has(b.name)||U.byName.get(b.name).area<b.area)) U.byName.set(b.name,b);
  return true;
}
function pip(p,n,x,z){ let c=false; for(let i=0,j=n-1;i<n;j=i++){ const xi=p[i*2],zi=p[i*2+1],xj=p[j*2],zj=p[j*2+1]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi) c=!c; } return c; }
function bAt(x,z){ // tallest building covering this point (null on open ground; courtyards are open)
  const l=U.grid.get(Math.floor(x/U.CELL)*4096+Math.floor(z/U.CELL)); if(!l) return null; let best=null;
  for(const b of l){ if(x<b.x0||x>b.x1||z<b.z0||z>b.z1) continue; if((!best||b.h>best.h)&&pip(b.p,b.n,x,z)){ let hole=false; for(const hh of b.hl) if(pip(hh,hh.length/2,x,z)){ hole=true; break; } if(!hole) best=b; } }
  return best;
}
function uscPush(r,py){ // flying into a wall: slide out to the street (or into the courtyard), slower
  const b=bAt(r.pos.x,r.pos.z); if(!b||r.pos.y>=b.h-0.6||py>=b.h-0.8) return false;
  let bd=1e9,bx=r.pos.x,bz=r.pos.z; const x=r.pos.x, z=r.pos.z, rings=[b.p].concat(b.hl);
  for(const p of rings){ const n=p.length/2; for(let i=0,j=n-1;i<n;j=i++){ const ax=p[j*2],az=p[j*2+1],ex=p[i*2]-ax,ez=p[i*2+1]-az, l2=ex*ex+ez*ez||1, t=clamp(((x-ax)*ex+(z-az)*ez)/l2,0,1), qx=ax+ex*t, qz=az+ez*t, d=(x-qx)**2+(z-qz)**2; if(d<bd){ bd=d; bx=qx; bz=qz; } } }
  let ux=bx-x, uz=bz-z; const ul=Math.hypot(ux,uz); if(ul<0.01){ ux=Math.sin(r.yaw); uz=Math.cos(r.yaw); } else { ux/=ul; uz/=ul; }
  r.pos.x=bx+ux*2; r.pos.z=bz+uz*2; r.v*=0.55; return true;
}
function uscSpot(by){ // where a landmark stands: a building, a stadium or a named place
  let x,z,h=0;
  if(by==='@Tommy'){ const b=U.byName.get('Bovard Administration Building'), hp=U.D.pl['Hahn Plaza']; if(!b||!hp) return null; x=b.cx+(hp[0]-b.cx)*0.45; z=b.cz+(hp[1]-b.cz)*0.45; }
  else if(by.startsWith('@fo:')){ const q=U.D.pl[by.slice(4)]; if(!q||!U.D.fo.length) return null; let best=null,bd=1e12; for(const f of U.D.fo){ const d=Math.hypot(f[0]-q[0],f[1]-q[1]); if(d<bd){ bd=d; best=f; } } if(!best||bd>140) return null; x=best[0]; z=best[1]; }
  else if(by.startsWith('@st:')){ const s=U.stadia.find(q=>q.name===by.slice(4)); if(!s) return null; x=s.cx; z=s.cz; }
  else if(by.startsWith('@pl:')){ const q=U.D.pl[by.slice(4)]; if(!q) return null; x=q[0]; z=q[1]; }
  else { const b=U.byName.get(by); if(!b) return null; x=b.cx; z=b.cz; h=b.h; }
  return {x,z,h};
}

/* ---- paths for people and cars ---- */
function mkPath(flat){ const n=flat.length/2, cum=new Float32Array(n); for(let i=1;i<n;i++) cum[i]=cum[i-1]+Math.hypot(flat[i*2]-flat[i*2-2],flat[i*2+1]-flat[i*2-1]); return {p:flat,n,cum,len:cum[n-1]}; }
const _pa={x:0,z:0,dx:0,dz:1};
function pathAt(P,s){ let i=1; while(i<P.n-1&&P.cum[i]<s) i++; const a=P.cum[i-1], l=P.cum[i]-a||1, f=clamp((s-a)/l,0,1), x0=P.p[i*2-2],z0=P.p[i*2-1],x1=P.p[i*2],z1=P.p[i*2+1];
  _pa.x=x0+(x1-x0)*f; _pa.z=z0+(z1-z0)*f; _pa.dx=(x1-x0)/l; _pa.dz=(z1-z0)/l; return _pa; }
const inReg=(x,z,m=0)=>x>GR.x0+m&&x<GR.x1-m&&z>GR.z0+m&&z<GR.z1-m;
const walkPath=(flat,step,rnd,fn)=>{ const P=mkPath(flat); for(let s=step*rnd();s<P.len;s+=step){ const a=pathAt(P,s); fn(a.x,a.z,a.dx,a.dz); } };

/* ---- ground: roads, paths, lawns, pitches painted from the map data ---- */
const ROAD_W={motorway:24,primary:15,secondary:12,tertiary:9.5,residential:8,service:4.5,pedestrian:7,footway:2.4,steps:2.2};
function buildUscGround(q){
  const N=q.grid>=300?4096:q.grid>=220?3072:2048, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
  const sx=N/(GR.x1-GR.x0), sz=N/(GR.z1-GR.z0), ppm=(sx+sz)/2, X=x=>(x-GR.x0)*sx, Z=z=>(z-GR.z0)*sz, la=W.co.id==='la';
  g.fillStyle=la?'#a9a79d':'#bdbaa9'; g.fillRect(0,0,N,N);
  const poly=(p,col)=>{ g.fillStyle=col; g.beginPath(); for(let i=0;i<p.length;i+=2) i?g.lineTo(X(p[i]),Z(p[i+1])):g.moveTo(X(p[i]),Z(p[i+1])); g.closePath(); g.fill(); };
  const line=(p,w,col,dash)=>{ g.strokeStyle=col; g.lineWidth=Math.max(1,w*ppm); g.setLineDash(dash||[]); g.beginPath(); for(let i=0;i<p.length;i+=2) i?g.lineTo(X(p[i]),Z(p[i+1])):g.moveTo(X(p[i]),Z(p[i+1])); g.stroke(); };
  g.lineJoin='round'; g.lineCap='round';
  const AC={g:'#6f9549',p:'#5a9a58',t:'#b4654a',w:'#79b2d4'};
  for(const k of ['g','p','t','w']) for(const a of U.D.a) if(a.k===k) poly(a.p,AC[k]);
  { const rr2=mulberry32(5); for(const a of U.D.a){ if(a.k!=='g') continue; const n=a.p.length/2; let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(let i=0;i<n;i++){ x0=Math.min(x0,a.p[i*2]); x1=Math.max(x1,a.p[i*2]); z0=Math.min(z0,a.p[i*2+1]); z1=Math.max(z1,a.p[i*2+1]); }
    const cnt=Math.min(160,Math.floor((x1-x0)*(z1-z0)/900)); g.save(); g.beginPath(); for(let i=0;i<n;i++) i?g.lineTo(X(a.p[i*2]),Z(a.p[i*2+1])):g.moveTo(X(a.p[i*2]),Z(a.p[i*2+1])); g.closePath(); g.clip();
    const PAL=['rgba(38,82,28,0.20)','rgba(176,200,96,0.18)','rgba(120,150,60,0.18)','rgba(205,190,110,0.12)','rgba(24,64,30,0.16)']; // shade, sun-bleached, dry and clover patches
    for(let k=0;k<cnt*2;k++){ const x=x0+(x1-x0)*rr2(), z=z0+(z1-z0)*rr2(), r=1.5+rr2()*rr2()*10; g.fillStyle=PAL[Math.floor(rr2()*PAL.length)]; g.beginPath(); g.ellipse(X(x),Z(z),r*sx,r*sz*(0.6+rr2()*0.6),rr2()*3,0,6.283); g.fill(); }

    for(let k=0;k<cnt*0.25;k++){ const x=x0+(x1-x0)*rr2(), z=z0+(z1-z0)*rr2(); g.fillStyle=['rgba(244,217,78,0.35)','rgba(242,242,240,0.3)','rgba(233,138,168,0.3)','rgba(201,166,255,0.3)'][Math.floor(rr2()*4)]; g.beginPath(); g.arc(X(x),Z(z),Math.max(1.2,0.9*sx),0,6.283); g.fill(); }
    g.restore(); } }
  const order=['motorway','primary','secondary','tertiary','residential','service','pedestrian','footway','steps'];
  for(const t of ['primary','secondary','tertiary','residential']) for(const r of U.D.r) if(r.t===t) line(r.p,ROAD_W[t]+3.6,'#d3cfc0');   // sidewalk strip
  for(const t of ['primary','secondary','tertiary','residential']) for(const r of U.D.r) if(r.t===t) line(r.p,ROAD_W[t]+3.6-0.5,'#cac6b6',[0.5*ppm,6*ppm]); // paving joints
  for(const t of ['primary','secondary','tertiary','residential']) for(const r of U.D.r) if(r.t===t) line(r.p,ROAD_W[t]+0.8,'#9c998d'); // kerb
  for(const t of order) for(const r of U.D.r) if(r.t===t){
    const col=t==='motorway'?'#4a4d53':t==='service'?'#6e7176':t==='pedestrian'?'#ddd4bf':t==='footway'?'#e3dbc8':t==='steps'?'#cdc4ae':'#55585e'; line(r.p,ROAD_W[t],col); }
  for(const t of ['primary','secondary']) for(const r of U.D.r) if(r.t===t) line(r.p,0.3,'#e5cd6c',[5*ppm,5*ppm]);                          // centre line
  for(const r of U.D.r) if(r.t==='tertiary'||r.t==='residential') line(r.p,0.18,'#d8d8d0',[3*ppm,7*ppm]);                                    // lane dashes
  for(const r of U.D.r) if(r.t==='motorway') line(r.p,0.35,'#f0f0ea',[6*ppm,9*ppm]);
  g.lineJoin='round'; for(const b of U.B){ if(b.hw<4) continue; g.beginPath(); const p=b.p, n=b.n; for(let i=0;i<n;i++) i?g.lineTo(X(p[i*2]),Z(p[i*2+1])):g.moveTo(X(p[i*2]),Z(p[i*2+1])); g.closePath(); g.strokeStyle='rgba(30,26,20,0.15)'; g.lineWidth=7*ppm; g.stroke(); g.strokeStyle='rgba(30,26,20,0.22)'; g.lineWidth=2.6*ppm; g.stroke(); } // soft contact shadow around every building
  // crosswalks: a zebra at the end of every named street where it meets another road
  const ends=[]; for(const r of U.D.r) if(r.t==='primary'||r.t==='secondary'||r.t==='tertiary'||r.t==='residential'){ const n=r.p.length/2; ends.push([r.p[0],r.p[1],r.p[2]-r.p[0],r.p[3]-r.p[1],r.t],[r.p[n*2-2],r.p[n*2-1],r.p[n*2-4]-r.p[n*2-2],r.p[n*2-3]-r.p[n*2-1],r.t]); }
  g.setLineDash([]); g.fillStyle='rgba(240,240,232,0.85)';
  for(const [x,z,dx,dz,t] of ends){ const l=Math.hypot(dx,dz)||1, ux=dx/l, uz=dz/l, w=ROAD_W[t]; if(w<7) continue;
    for(let k=-w/2+0.6;k<w/2-0.4;k+=1.15){ const px=x+(-uz)*k+ux*4.2, pz=z+ux*k+uz*4.2; g.save(); g.translate(X(px),Z(pz)); g.rotate(Math.atan2(uz*sz,ux*sx)); g.fillRect(-1.5*ppm,-0.3*ppm,3*ppm,0.6*ppm); g.restore(); } }
  const tex=new T.CanvasTexture(c); tex.colorSpace=T.SRGBColorSpace; tex.anisotropy=Math.min(16,R.renderer.capabilities.getMaxAnisotropy()); tex.minFilter=T.LinearMipmapLinearFilter; tex.magFilter=T.LinearFilter; W.gnd={g,X,Z,sx,sz,tex};
  const pg=new T.PlaneGeometry(GR.x1-GR.x0,GR.z1-GR.z0); pg.rotateX(-Math.PI/2);
  const m=new T.MeshStandardMaterial({map:tex,roughness:0.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}); W.ownMats.push(m);
  m.onBeforeCompile=sh=>{ sh.uniforms.uTime=W.timeU; sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWPg;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWPg=(modelMatrix*vec4(position,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWPg; uniform float uTime;\nfloat h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }\nfloat fbm(vec2 p){ return vn(p)*0.5+vn(p*2.03+7.1)*0.25+vn(p*4.1+3.3)*0.125+vn(p*8.3+1.7)*0.0625; }').replace('#include <map_fragment>',`#include <map_fragment>
      { vec2 w=vWPg.xz; float dd=length(vWPg-cameraPosition), near=1.0-smoothstep(30.0,170.0,dd), lum=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11));
        float gr=step(diffuseColor.r+0.015,diffuseColor.g)*step(diffuseColor.b+0.03,diffuseColor.g), dark=1.0-smoothstep(0.25,0.4,lum), pav=smoothstep(0.55,0.7,lum)*(1.0-gr);
        // smooth multi-scale noise (no hard texel squares), branch-free and cheap: 2-octave tonal drift, fine blades faded in up close
        float close=1.0-smoothstep(5.0,70.0,dd), mid2=1.0-smoothstep(25.0,260.0,dd);
        float broad=vn(w*0.045)*0.65+vn(w*0.11+4.0)*0.35-0.5, mid=vn(w*0.35+11.0)*0.65+vn(w*0.8+2.0)*0.35-0.5, fine=vn(w*2.6+3.0)-0.5, blade=vn(w*vec2(11.0,15.0)+5.0)-0.5;
        diffuseColor.rgb*=1.0+(broad*0.22+mid*0.14)*mid2*(0.45+0.8*gr+0.35*dark+0.3*pav);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.06,1.03,0.86),gr*smoothstep(0.1,0.4,mid)*mid2*0.6);
        diffuseColor.rgb*=1.0+gr*close*(fine*0.3+blade*0.24)+(dark+pav)*close*fine*0.14;
        { vec2 f=fract(w/1.2); float j=1.0-smoothstep(0.0,0.03,min(min(f.x,1.0-f.x),min(f.y,1.0-f.y))); diffuseColor.rgb*=1.0-pav*near*0.16*j; diffuseColor.rgb*=1.0+pav*near*(h21(floor(w/1.2))-0.5)*0.07; }
        diffuseColor.rgb*=1.0+sin(w.x*0.9+w.y*0.4)*0.015*gr*near;
        float wat=step(diffuseColor.r+0.06,diffuseColor.b)*step(diffuseColor.g-0.03,diffuseColor.b); diffuseColor.rgb+=wat*near*(0.07*sin(w.x*2.3+w.y*1.9+uTime*1.6)+0.05*sin(w.x*5.1-w.y*3.7+uTime*2.4)); }`); };
  m.customProgramCacheKey=()=>'cityGround2';
  const mesh=new T.Mesh(pg,m); mesh.position.set((GR.x0+GR.x1)/2,0.25,(GR.z0+GR.z1)/2); mesh.receiveShadow=true; W.scene.add(mesh);
  const E=W.co.mapE, mp=document.createElement('canvas'); mp.width=mp.height=256; mp.getContext('2d').drawImage(c,X(-E),Z(-E),2*E*sx,2*E*sz,0,0,256,256); W.mapImg=mp; // minimap
}

/* ---- merged "extras": towers, crowns, colonnades, the Coliseum peristyle (one mesh, one draw call) ---- */
let XA=null; const XG={};
function xInit(){ XA={pos:[],nor:[],col:[]}; if(!XG.box){ _xm=new T.Matrix4(); _xq=new T.Quaternion(); _xe=new T.Euler(); _xs=new T.Vector3(); _xp=new T.Vector3(); _xc=new T.Color(); XG.box=new T.BoxGeometry(1,1,1); XG.cyl=new T.CylinderGeometry(0.5,0.5,1,10); XG.sph=new T.SphereGeometry(0.5,10,8); XG.sph8=new T.SphereGeometry(0.5,7,5); XG.cone=new T.ConeGeometry(0.5,1,8); const c=new T.ConeGeometry(0.7071,1,4); c.rotateY(Math.PI/4); XG.pyr=c; } }
let _xm,_xq,_xe,_xs,_xp,_xc;
function xAdd(kind,x,y,z,w,h,d,hex,rot){ const g=XG[kind].clone(); _xe.set(0,rot||0,0); _xq.setFromEuler(_xe); _xm.compose(_xp.set(x,y+h/2,z),_xq,_xs.set(w,h,d)); g.applyMatrix4(_xm); const n=g.index?g.toNonIndexed():g; _xc.set(hex);
  const P=n.attributes.position.array, N=n.attributes.normal.array; for(let i=0;i<P.length;i++){ XA.pos.push(P[i]); XA.nor.push(N[i]); } for(let i=0;i<P.length/3;i++) XA.col.push(_xc.r,_xc.g,_xc.b); g.dispose(); if(n!==g) n.dispose(); }
function xFlush(){ if(!XA||!XA.pos.length) return; const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(XA.pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(XA.nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(XA.col,3));
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:0.78,metalness:0.05}); W.ownMats.push(m); const mesh=new T.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; W.scene.add(mesh); XA=null; }
function solidAt(x,z,w,top){ const p=Float32Array.from([x-w/2,z-w/2,x+w/2,z-w/2,x+w/2,z+w/2,x-w/2,z+w/2]); const s={p,n:4,hl:[],h:top,hw:top,k:'o',name:'',area:w*w,x0:x-w/2,x1:x+w/2,z0:z-w/2,z1:z+w/2,cx:x,cz:z}; if(!U.solDone) gridAdd(s); }
/* Architectural layers on rectangular buildings (merged into the one "extras" mesh): stone base course, belt courses between floors, a projecting cornice with parapet, and a stepped rooftop block on mid and high rises. */
let _layerN=0;
function addLayers(b){
  const ob=b.ob; if(!ob||b.rf||b.hl.length||b.k==='o'&&b.h<10||b.h<9||b.area<260||_layerN>1100) return; if(b.area/(4*ob.hs*ob.ht)<0.86) return; if(/Coliseum|Stadium/i.test(b.name||'')||b.st&&(b.st.tw||b.st.col)) return;
  _layerN++; const rot=Math.atan2(-ob.uz,ob.ux), h=b.hw, A=new T.Color(b.wc), tr=A.clone().offsetHSL(0,-0.05,0.13).getStyle(), dk=A.clone().offsetHSL(0,0,-0.08).getStyle(), W2=2*ob.hs, D2=2*ob.ht;
  xAdd('box',ob.cx,0,ob.cz,W2+0.5,1.1,D2+0.5,dk,rot);                                                 // stone base course (water table)
  const fl=3.7, nF=Math.floor(h/fl); if(nF>=3){ for(const f of (nF>=6?[Math.round(nF/3),Math.round(nF*2/3)]:[Math.round(nF/2)])) xAdd('box',ob.cx,f*fl-0.15,ob.cz,W2+0.3,0.3,D2+0.3,tr,rot); } // belt courses
  xAdd('box',ob.cx,h-0.9,ob.cz,W2+1.2,0.9,D2+1.2,tr,rot);                                            // cornice
  xAdd('box',ob.cx,h,ob.cz,W2+0.4,0.7,D2+0.4,dk,rot);                                                // parapet slab
  if(h>=18&&W2>16&&D2>16){ const s=h>=40?0.55:0.7, ph=h>=40?6:3.4; xAdd('box',ob.cx,h+0.7,ob.cz,W2*s,ph,D2*s,A.clone().offsetHSL(0,0,-0.03).getStyle(),rot); xAdd('box',ob.cx,h+0.7+ph,ob.cz,W2*s+0.8,0.5,D2*s+0.8,tr,rot); } // rooftop step-back
}
function addTowers(b){ const st=b.st, ob=b.ob; let cx=ob.cx, cz=ob.cz; const inHole=(x,z)=>b.hl.some(hh=>pip(hh,hh.length/2,x,z)); if(!pip(b.p,b.n,cx,cz)||inHole(cx,cz)){ cx=b.cx; cz=b.cz; }
  const m=Math.min(ob.hs,ob.ht)*2, rot=Math.atan2(-ob.uz,ob.ux), cream='#d9cba8', gold='#d9b43a';
  for(const t of st.tw||[]){ const w=t.w<=1?m*t.w:t.w, y0=b.hw+(t.y||0), wc=t.wc||b.wc;
    xAdd('box',cx,y0,cz,w,t.dh,w,wc,rot); solidAt(cx,cz,w,y0+t.dh);
    if(t.cap==='pyr'){ xAdd('box',cx,y0+t.dh,cz,w+0.6,1.2,w+0.6,cream,rot); xAdd('pyr',cx,y0+t.dh+1.2,cz,w+0.3,w*1.15,w+0.3,t.cc||'#5a7f6a',rot); if(t.fin) xAdd('cyl',cx,y0+t.dh+1.2+w*1.15,cz,0.28,5,0.28,gold); }
    else if(t.cap==='globe'){ xAdd('box',cx,y0+t.dh,cz,w+0.8,1.0,w+0.8,cream,rot); xAdd('sph',cx,y0+t.dh+1.0,cz,w*0.7,w*0.7,w*0.7,gold); }
    else if(t.cap==='spire'){ xAdd('cyl',cx,y0+t.dh,cz,Math.max(0.5,w*0.12),t.sh,Math.max(0.5,w*0.12),'#d5d8dc'); } }
  if(st.col){ // arcade along the long side that faces the middle of campus
    const vx=-ob.uz, vz=ob.ux, sd=((vx*-ob.cx+vz*-ob.cz)>=0)?1:-1, nC=st.col, off=ob.ht+2.4;
    for(let k=0;k<nC;k++){ const a=-ob.hs+2+(2*ob.hs-4)*k/(nC-1), x=ob.cx+ob.ux*a+vx*sd*off, z=ob.cz+ob.uz*a+vz*sd*off; xAdd('box',x,0,z,1.0,Math.min(b.hw,9),1.0,'#f0ebde',rot); }
    xAdd('box',ob.cx+vx*sd*(ob.ht+1.2),Math.min(b.hw,9),ob.cz+vz*sd*(ob.ht+1.2),2*ob.hs-2,0.8,3.0,'#ece6d8',rot); }
}

/* ---- buildings: tiled merged meshes (culled and shadowed per tile); windows, arches, brick and glass are drawn in the shader ---- */
function wallMaterial(){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:0.86,metalness:0}); W.ownMats.push(m);
  m.onBeforeCompile=sh=>{
    W.nightU=W.nightU||{value:0}; sh.uniforms.uNight=W.nightU;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aUV; attribute float aKind; attribute float aH; varying vec2 vUV; varying float vKind; varying float vH; varying vec3 vWP;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvUV=aUV; vKind=aKind; vH=aH; vWP=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vUV; varying float vKind; varying float vH; varying vec3 vWP; uniform float uNight; float gW=0.0; vec3 gC=vec3(1.0,0.82,0.5);
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float archM(vec2 p,float r,float lo,float ay){ return max(step(abs(p.x),r)*step(lo,p.y)*step(p.y,ay), step(length(vec2(p.x,p.y-ay)),r)*step(ay,p.y)); }`)
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=gC*gW*uNight*0.8;')
    .replace('#include <color_fragment>',`#include <color_fragment>
      { float d=length(vWP-cameraPosition), fade=1.0-smoothstep(260.0,820.0,d), near=1.0-smoothstep(60.0,200.0,d), top=vH-vUV.y;
        vec3 trim=vec3(0.90,0.85,0.74);
        if(vKind>7.5){ float s=fract((vWP.x+vWP.z*0.4)/0.62); diffuseColor.rgb*=1.0-0.15*near*smoothstep(0.0,0.12,s)*(1.0-smoothstep(0.45,0.6,s)); diffuseColor.rgb*=1.0+(h21(floor(vWP.xz*0.45))-0.5)*0.13*near; }
        else if(vKind>6.5){ vec2 cs=vec2(2.7,3.6), c=fract(vUV/cs), id=floor(vUV/cs);
          float w=step(0.3,c.x)*step(c.x,0.62)*step(0.1,c.y)*step(c.y,0.9)*step(2.0,vUV.y)*step(1.0,top);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.12,0.16,0.21),w*0.85*fade); diffuseColor.rgb*=1.0-0.07*step(c.y,0.04)*fade;
          diffuseColor.rgb*=1.0+(h21(floor(vUV*0.5))-0.5)*0.08*near; gW=w*step(0.5,h21(id+5.0))*fade; }
        else if(vKind>5.5){ vec2 cs=vec2(4.4,4.6), c=fract(vUV/cs), id=floor(vUV/cs), p=vec2((c.x-0.5)*cs.x,(c.y-0.5)*cs.y);
          float win=archM(p,0.55,-0.85,0.35)*step(1.0,vUV.y)*step(1.4,top), ring=archM(p,0.72,-1.0,0.35)*step(1.0,vUV.y)*step(1.4,top)*(1.0-win);
          vec3 glass=mix(vec3(0.10,0.15,0.2),vec3(0.36,0.48,0.6),h21(id)*h21(id));
          diffuseColor.rgb=mix(diffuseColor.rgb,trim,ring*0.85*fade); diffuseColor.rgb=mix(diffuseColor.rgb,glass,win*0.9*fade);
          float shut=step(0.58,abs(p.x))*step(abs(p.x),0.9)*step(-0.8,p.y)*step(p.y,0.4)*step(1.0,vUV.y)*step(1.4,top); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.2,0.36,0.3),shut*0.85*fade);
          float aw=step(3.5,vUV.y)*step(vUV.y,4.05)*step(abs(p.x),1.0)*step(0.45,h21(vec2(id.x,3.3))); diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(0.6,0.04,0.04),vec3(1.0,0.8,0.1),step(0.5,fract(vUV.x/0.5))),aw*0.9*fade); // cardinal and gold awnings
          gW=win*step(0.55,h21(id+3.1))*fade; diffuseColor.rgb*=1.0+(h21(floor(vUV*1.3))-0.5)*0.07*near;                               // plaster
          diffuseColor.rgb=mix(diffuseColor.rgb,trim*0.9,0.6*step(vUV.y,0.9)); diffuseColor.rgb=mix(diffuseColor.rgb,trim,0.5*step(top,0.6)*step(0.0,top)); }
        else if(vKind>4.5){ vec2 cs=vec2(1.7,3.9), c=fract(vUV/cs), id=floor(vUV/cs);
          float w=step(0.04,c.x)*step(c.x,0.96)*step(0.3,c.y)*step(c.y,0.84)*step(1.3,vUV.y)*step(1.0,top);
          vec3 glass=mix(vec3(0.12,0.2,0.26),vec3(0.45,0.58,0.7),h21(vec2(id.y,floor(id.x/6.0)))*0.8);
          diffuseColor.rgb=mix(diffuseColor.rgb*0.94,glass,w*0.88*fade); diffuseColor.rgb*=1.0-0.12*step(c.y,0.3)*step(0.18,c.y)*fade;
          gW=w*step(0.5,h21(vec2(id.y,floor(id.x/3.0))))*fade; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.78,0.78,0.76),0.55*step(top,0.7)*step(0.0,top)); }
        else if(vKind>3.5){ vec2 cs=vec2(3.4,4.6), c=fract(vUV/cs), id=floor(vUV/cs), p=vec2((c.x-0.5)*cs.x,(c.y-0.5)*cs.y);
          float mortar=step(fract(vUV.y/0.27),0.12); diffuseColor.rgb*=1.0-0.11*mortar*near; diffuseColor.rgb*=1.0+(h21(floor(vec2(vUV.x/0.52,vUV.y/0.27)))-0.5)*0.12*near;
          float ok=step(1.3,vUV.y)*step(1.5,top), win=archM(p,0.75,-1.3,0.45)*ok, ring=archM(p,0.96,-1.5,0.45)*ok*(1.0-win);
          vec3 glass=mix(vec3(0.10,0.15,0.2),vec3(0.38,0.5,0.62),h21(id)*h21(id));
          diffuseColor.rgb=mix(diffuseColor.rgb,trim,ring*0.9*fade); diffuseColor.rgb=mix(diffuseColor.rgb,glass,win*0.92*fade);
          gW=win*step(0.55,h21(id+3.1))*fade; diffuseColor.rgb=mix(diffuseColor.rgb,trim*0.93,0.92*step(vUV.y,1.2));
          float door=step(0.8,h21(vec2(id.x*3.7,7.0)))*step(vUV.y,cs.y)*step(1.0,vUV.y), dm=archM(p,0.85,-2.3,0.2)*door*fade; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.22,0.13,0.09),dm*0.92); gW+=dm*0.3;                    // limestone plinth
          diffuseColor.rgb=mix(diffuseColor.rgb,trim,0.7*step(fract(vUV.y/cs.y),0.025)*step(2.0,vUV.y)); // string course
          diffuseColor.rgb=mix(diffuseColor.rgb,trim,0.85*step(top,0.8)*step(0.0,top)); }          // cornice
        else if(vKind>2.5){ vec2 cs=vec2(2.4,3.9), c=fract(vUV/cs), id=floor(vUV/cs);
          float w=step(0.06,c.x)*step(c.x,0.94)*step(0.1,c.y)*step(c.y,0.92)*step(2.0,vUV.y);
          float sky=smoothstep(0.0,1.0,vUV.y/vH);
          vec3 gl=mix(vec3(0.09,0.15,0.23),vec3(0.50,0.66,0.80),clamp(sky*0.65+h21(id)*0.28,0.0,1.0));
          gW=w*step(0.45,h21(id+1.7))*fade; float pw=mix(w*0.92,0.8,1.0-fade); diffuseColor.rgb=mix(diffuseColor.rgb*0.62,gl,pw);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.78,0.8,0.82),0.5*step(top,1.6)*step(0.0,top)); }
        else if(vKind>1.5){ vec2 c=vec2(fract(vUV.x/8.0),fract(vUV.y/3.2)); float w=step(0.08,c.x)*step(0.3,c.y)*step(c.y,0.82)*step(0.5,vUV.y);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.1,0.1,0.11),w*0.8*fade); diffuseColor.rgb*=1.0-0.25*step(c.y,0.14)*fade; }
        else if(vKind>0.5){ vec2 c=vec2(fract(vUV.x/3.4),fract(vUV.y/3.7)), id=vec2(floor(vUV.x/3.4),floor(vUV.y/3.7));
          float w=step(0.2,c.x)*step(c.x,0.8)*step(0.26,c.y)*step(c.y,0.8)*step(1.6,vUV.y)*step(1.0,top);
          float lit=h21(id); vec3 glass=mix(vec3(0.13,0.19,0.26),vec3(0.42,0.55,0.68),lit*lit);
          float sill=step(0.18,c.y)*step(c.y,0.26)*step(0.2,c.x)*step(c.x,0.8)*step(1.6,vUV.y);
          gW=w*step(0.5,lit)*fade; diffuseColor.rgb=mix(diffuseColor.rgb,glass,w*0.85*fade); diffuseColor.rgb*=1.0+0.12*sill*fade; diffuseColor.rgb*=1.0-0.1*step(c.y,0.05)*fade;
          diffuseColor.rgb*=1.0-0.22*step(vUV.y,1.5); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.9,0.86,0.78),0.4*step(top,0.7)*step(0.0,top));
          diffuseColor.rgb*=1.0+(h21(floor(vUV*0.25))-0.5)*0.12; }
        float roofP=step(vUV.x+vUV.y,0.0005);
        if(roofP>0.5&&vKind<7.5){ diffuseColor.rgb*=1.0+(h21(floor(vWP.xz*2.2))-0.5)*0.12*near+(h21(floor(vWP.xz*9.0))-0.5)*0.06*near; }
        else if(vKind>0.5&&vKind<7.5){ diffuseColor.rgb*=1.0-0.30*exp(-vUV.y*0.30)*(0.4+0.6*near)-0.10*exp(-max(top,0.0)*1.6)*near; diffuseColor.rgb*=1.0-0.06*near*h21(vec2(floor(vUV.x*1.9),1.0))*(1.0-clamp(vUV.y/max(vH,1.0),0.0,1.0)); } } `);
  };
  m.customProgramCacheKey=()=>'cityWalls4';
  return m;
}
const WALL_COLS={u:['#b0735a','#c08a68','#a8654d','#cfae86','#d6bf9c','#e2d9c6','#cfc7b6'],r:['#e8dcc6','#d6c3a3','#c9b79a','#e0d6c8','#d9cdb9'],p:['#b7b5ad','#a9a79f'],c:['#d2cdbf','#bdb9ac','#d9d2c0','#c7c2b3','#b9a58e','#a99b88'],o:['#cdc8ba','#bbb7aa']};
const GLASS_COLS=['#7d93a6','#8aa0b0','#9db0be','#6f8798','#a9a393','#7b8f8c','#93a3ad'];
function buildUscBuildings(q,rnd){
  const TS=320, tiles=new Map(), c=new T.Color(), props=[], ants=[];
  const tileOf=(x,z)=>{ const k=Math.floor(x/TS)*1024+Math.floor(z/TS); let t=tiles.get(k); if(!t) tiles.set(k,t={pos:[],nor:[],col:[],uv:[],kind:[],hh:[],idx:[],vc:0}); return t; };
  const tri=(S,a,b,cc,col,H,kd,hint)=>{ let ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=cc[0]-a[0],vy=cc[1]-a[1],vz=cc[2]-a[2], nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    if(nx*hint[0]+ny*hint[1]+nz*hint[2]<0){ const t=b; b=cc; cc=t; nx=-nx; ny=-ny; nz=-nz; } const l=Math.hypot(nx,ny,nz)||1;
    for(const v of [a,b,cc]){ S.pos.push(v[0],v[1],v[2]); S.nor.push(nx/l,ny/l,nz/l); S.col.push(col[0],col[1],col[2]); S.uv.push(0,0); S.kind.push(kd); S.hh.push(H); S.idx.push(S.vc++); } };
  const UP=[0,1,0];
  for(const b of U.B){
    const S=tileOf(b.cx,b.cz), h=b.hw, kd=b.kind;
    c.set(b.wc).offsetHSL(0,0,(b.hv-0.5)*0.05); const wcol=[c.r,c.g,c.b];
    c.set(b.rcol).offsetHSL(0,0,(b.hv-0.5)*0.06); const rcol=[c.r,c.g,c.b];
    const walls=(p,n)=>{ let u=0;
      for(let i=0;i<n;i++){ const j=(i+1)%n, ax=p[i*2], az=p[i*2+1], bx=p[j*2], bz=p[j*2+1], dx=bx-ax, dz=bz-az, L=Math.hypot(dx,dz)||1, nx=dz/L, nz=-dx/L, vc=S.vc;
        S.pos.push(ax,-1,az, bx,-1,bz, bx,h,bz, ax,h,az); for(let v=0;v<4;v++){ S.nor.push(nx,0,nz); S.col.push(wcol[0],wcol[1],wcol[2]); S.kind.push(kd); S.hh.push(h+1); }
        S.uv.push(u,0, u+L,0, u+L,h+1, u,h+1); S.idx.push(vc,vc+2,vc+1,vc,vc+3,vc+2); S.vc+=4; u+=L; } }; // wound so the front face looks outward
    walls(b.p,b.n); for(const hh of b.hl) walls(hh,hh.length/2);
    if(b.rf){ // pitched clay-tile or shingle roof on a rectangular footprint
      const ob=b.ob, vx=-ob.uz, vz=ob.ux, ov=0.55, hs=ob.hs, ht=ob.ht, rise=b.rise, P=(a,t,y)=>[ob.cx+ob.ux*a+vx*t,y,ob.cz+ob.uz*a+vz*t], H1=h+rise+1, rk=b.roofK;
      if(b.rf==='gable'){ const e1=P(-hs,-ht-ov,h), e2=P(hs,-ht-ov,h), e3=P(hs,ht+ov,h), e4=P(-hs,ht+ov,h), r1=P(-hs,0,h+rise), r2=P(hs,0,h+rise);
        tri(S,e1,e2,r2,rcol,H1,rk,UP); tri(S,e1,r2,r1,rcol,H1,rk,UP); tri(S,e4,e3,r2,rcol,H1,rk,UP); tri(S,e4,r2,r1,rcol,H1,rk,UP);
        tri(S,P(-hs,-ht,h),P(-hs,ht,h),r1,wcol,H1,0,[-ob.ux,0,-ob.uz]); tri(S,P(hs,-ht,h),P(hs,ht,h),r2,wcol,H1,0,[ob.ux,0,ob.uz]); }
      else { const sh=Math.min(ht*0.95,hs*0.45), e1=P(-hs-ov,-ht-ov,h), e2=P(hs+ov,-ht-ov,h), e3=P(hs+ov,ht+ov,h), e4=P(-hs-ov,ht+ov,h), r1=P(-hs+sh,0,h+rise), r2=P(hs-sh,0,h+rise);
        tri(S,e1,e2,r2,rcol,H1,rk,UP); tri(S,e1,r2,r1,rcol,H1,rk,UP); tri(S,e4,e3,r2,rcol,H1,rk,UP); tri(S,e4,r2,r1,rcol,H1,rk,UP); tri(S,e1,e4,r1,rcol,H1,rk,UP); tri(S,e2,e3,r2,rcol,H1,rk,UP); }
    } else { // flat roof (with courtyards cut out)
      const contour=[]; for(let i=0;i<b.n;i++) contour.push(new T.Vector2(b.p[i*2],b.p[i*2+1]));
      const hv=b.hl.map(hh=>{ const a=[]; for(let i=0;i<hh.length/2;i++) a.push(new T.Vector2(hh[i*2],hh[i*2+1])); return a; }), all=contour.concat(...hv), tris=T.ShapeUtils.triangulateShape(contour,hv), base=S.vc;
      for(const v of all){ S.pos.push(v.x,h,v.y); S.nor.push(0,1,0); S.col.push(rcol[0],rcol[1],rcol[2]); S.uv.push(0,0); S.kind.push(b.roofK); S.hh.push(h+1); S.vc++; }
      for(const t of tris){ const A=all[t[0]],B=all[t[1]],C=all[t[2]], cy=(B.y-A.y)*(C.x-A.x)-(B.x-A.x)*(C.y-A.y); if(cy>=0) S.idx.push(base+t[0],base+t[1],base+t[2]); else S.idx.push(base+t[0],base+t[2],base+t[1]); } // roofs face up
      if(b.area>260&&b.k!=='o'&&!b.hl.length&&!b.st){ const cnt=Math.min(5,1+Math.floor(b.area/700));
        for(let t=0;t<cnt;t++){ for(let tries=0;tries<8;tries++){ const x=b.x0+(b.x1-b.x0)*(0.2+rnd()*0.6), z=b.z0+(b.z1-b.z0)*(0.2+rnd()*0.6); if(pip(b.p,b.n,x,z)){ props.push([x,h,z,2+rnd()*3.5,1.2+rnd()*1.8,2+rnd()*3.5,rnd()*3]); break; } } }
        if(b.g&&pip(b.p,b.n,b.cx,b.cz)){ const w=Math.min(b.x1-b.x0,b.z1-b.z0), ch=3+Math.min(10,h*0.03); props.push([b.cx,h,b.cz,w*0.55,ch,w*0.55,0]); if(h>=130) ants.push([b.cx,h+ch,b.cz,22+h*0.1]); } }
    }
    if(b.st&&(b.st.tw||b.st.col)) addTowers(b);
    addLayers(b);
  }
  for(const S of tiles.values()){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(S.pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(S.nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(S.col,3));
    g.setAttribute('aUV',new T.Float32BufferAttribute(S.uv,2)); g.setAttribute('aKind',new T.Float32BufferAttribute(S.kind,1)); g.setAttribute('aH',new T.Float32BufferAttribute(S.hh,1)); g.setIndex(new T.BufferAttribute(S.vc>65535?new Uint32Array(S.idx):new Uint16Array(S.idx),1));
    g.computeBoundingSphere(); const mesh=new T.Mesh(g,W.wallMat||(W.wallMat=wallMaterial())); mesh.castShadow=true; mesh.receiveShadow=true; W.scene.add(mesh); }
  const im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat('#a7a9ad',{r:0.7,m:0.2}),props.length), o=new T.Object3D();
  props.forEach((a,i)=>{ o.position.set(a[0],a[1]+a[4]/2,a[2]); o.scale.set(a[3],a[4],a[5]); o.rotation.set(0,a[6],0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
  im.castShadow=false; W.scene.add(im);
  if(ants.length){ const am=new T.InstancedMesh(new T.CylinderGeometry(0.25,0.55,1,6),mat('#c9ccd0',{r:0.4,m:0.5}),ants.length); ants.forEach((a,i)=>{ o.position.set(a[0],a[1]+a[3]/2,a[2]); o.scale.set(1,a[3],1); o.rotation.set(0,0,0); o.updateMatrix(); am.setMatrixAt(i,o.matrix); }); W.scene.add(am); }
}

/* ---- stadium bowls (the Coliseum and BMO Stadium are open: fly in over the grass) ---- */
function bowlMesh(flat,H,innerF){
  const n=flat.length/2; let cx=0,cz=0; for(let i=0;i<n;i++){ cx+=flat[i*2]; cz+=flat[i*2+1]; } cx/=n; cz/=n;
  const rings=[[1,0],[1,H],[0.86,H*0.86],[0.7,H*0.45],[innerF,H*0.1],[innerF,0.3]], cols=['#dcd2bd','#cfc6b0','#baaf95','#a3463b','#8d8f86'];
  const pos=[],col=[],idx=[],uvs=[],kinds=[], c=new T.Color(); let vc=0; const cum=[0]; for(let i=0;i<n;i++){ const j=(i+1)%n; cum.push(cum[i]+Math.hypot(flat[j*2]-flat[i*2],flat[j*2+1]-flat[i*2+1])); }
  for(let s=0;s<cols.length;s++){ c.set(cols[s]); for(let i=0;i<=n;i++){ const k=i%n; for(const [f,y] of [rings[s],rings[s+1]]){ pos.push(cx+(flat[k*2]-cx)*f,y,cz+(flat[k*2+1]-cz)*f); col.push(c.r,c.g,c.b); uvs.push(cum[i]*f,y); kinds.push(s===0?1:0); } }
    for(let i=0;i<n;i++){ const a=vc+i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } vc+=(n+1)*2; }
  c.set('#4f9a4a'); pos.push(cx,0.3,cz); col.push(c.r,c.g,c.b); uvs.push(cx,cz); kinds.push(2); const fc=vc++;
  for(let i=0;i<=n;i++){ const k=i%n; pos.push(cx+(flat[k*2]-cx)*innerF,0.3,cz+(flat[k*2+1]-cz)*innerF); col.push(c.r,c.g,c.b); uvs.push(cx+(flat[k*2]-cx)*innerF,cz+(flat[k*2+1]-cz)*innerF); kinds.push(2); } for(let i=0;i<n;i++) idx.push(fc,fc+1+i,fc+2+i);
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('color',new T.Float32BufferAttribute(col,3)); g.setAttribute('aUV',new T.Float32BufferAttribute(uvs,2)); g.setAttribute('aKind',new T.Float32BufferAttribute(kinds,1)); g.setIndex(idx); g.computeVertexNormals();
  return {geo:g,cx,cz};
}
function stadiumMaterial(){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:0.9,side:T.DoubleSide}); W.ownMats.push(m); W.nightU=W.nightU||{value:0};
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aUV; attribute float aKind; varying vec2 vUV; varying float vKind; varying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvUV=aUV; vKind=aKind; vWP=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vUV; varying float vKind; varying vec3 vWP;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float archM(vec2 p,float r,float lo,float ay){ return max(step(abs(p.x),r)*step(lo,p.y)*step(p.y,ay), step(length(vec2(p.x,p.y-ay)),r)*step(ay,p.y)); }`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      { float d=length(vWP-cameraPosition), near=1.0-smoothstep(80.0,420.0,d);
        if(vKind>1.5){ diffuseColor.rgb*=1.0+0.07*sin(vUV.y*0.55)*near+(h21(floor(vUV*2.0))-0.5)*0.08*near; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.95),0.5*step(fract(vUV.x/4.57),0.014)*near); }
        else if(vKind>0.5){ vec2 cs=vec2(7.0,10.0), c=fract(vec2(vUV.x/cs.x,vUV.y/cs.y)), p=vec2((c.x-0.5)*cs.x,(c.y-0.5)*cs.y);
          float arch=archM(p,1.7,-4.2,1.4)*step(vUV.y,29.0)*step(1.5,vUV.y); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.2,0.16,0.13),arch*0.85); diffuseColor.rgb*=1.0-0.07*step(fract(vUV.x/7.0),0.03); }
        else { float rows=step(fract(vUV.y/0.9),0.14), aisle=step(fract(vUV.x/9.0),0.035), n=h21(floor(vec2(vUV.x/1.3,vUV.y/0.9)));
          diffuseColor.rgb*=1.0-0.14*rows*near; diffuseColor.rgb*=1.0+(n-0.5)*0.24*near; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.85,0.82,0.74),0.35*aisle*near); } }`); };
  m.customProgramCacheKey=()=>'stadium1'; return m;
}
function buildUscStadiums(){
  U.stadia=[]; const m=stadiumMaterial();
  for(const s of U.D.st){ const big=/Coliseum/.test(s.n), b=bowlMesh(s.p,big?30:17,big?0.55:0.62), mesh=new T.Mesh(b.geo,m); mesh.castShadow=true; mesh.receiveShadow=true; W.scene.add(mesh);
    U.stadia.push({name:s.n,cx:b.cx,cz:b.cz});
    if(big){ let mx=-1e9; for(let i=0;i<s.p.length/2;i++) mx=Math.max(mx,s.p[i*2]); const x=mx+6, z=b.cz, cr='#e4dac3'; // the arched peristyle and Olympic torch at the east end
      xAdd('box',x,0,z-27,8,27,9,cr); xAdd('box',x,0,z+27,8,27,9,cr); for(let k=-3;k<=3;k++) if(k) xAdd('box',x,0,z+k*7.5,2.2,19,2.2,cr);
      xAdd('box',x,19,z,8,3.2,64,cr); xAdd('box',x-0.6,22.2,z,6,2.2,26,cr); xAdd('box',x,0,z,4.4,40,4.4,cr); xAdd('cyl',x,40,z,6,2.6,6,'#4a4a4a'); xAdd('pyr',x,42.4,z,3.6,6,3.6,'#ff9a30');
      solidAt(x,z-27,8,27); solidAt(x,z+27,8,27); } }
}
/* ---- texture-based foliage and detailed street furniture, drawn only near the camera ----
   Trees are crossed painted-leaf cards (16 triangles instead of 80+), furniture are small merged kits with many parts.
   `makePool` keeps every item's matrix in a typed array and copies only the items within a radius of the camera into one instanced draw call. */
function makePool(geo,material,items,radius,colored){
  const n=items.length, N=Math.max(1,n), o=new T.Object3D(), mats=new Float32Array(N*16), cols=colored?new Float32Array(N*3):null, xz=new Float32Array(N*2), cc=new T.Color();
  items.forEach((it,i)=>{ o.position.set(it.x,it.y||0,it.z); o.rotation.set(0,it.ry||0,0); const s=it.s||1; o.scale.set(it.sx||s,it.sy||s,it.sz||s); o.updateMatrix(); o.matrix.toArray(mats,i*16); xz[i*2]=it.x; xz[i*2+1]=it.z;
    if(cols){ cc.set(it.col||'#ffffff'); cols[i*3]=cc.r; cols[i*3+1]=cc.g; cols[i*3+2]=cc.b; } });
  const mesh=new T.InstancedMesh(geo,material,N); mesh.count=0; mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if(cols){ mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(N*3),3); mesh.instanceColor.setUsage(T.DynamicDrawUsage); }
  W.scene.add(mesh);
  const P={mesh,n,lx:1e9,lz:1e9,update(cx,cz,force){ if(!force&&Math.abs(cx-P.lx)+Math.abs(cz-P.lz)<14) return; P.lx=cx; P.lz=cz;
    const r2=radius*radius, A=mesh.instanceMatrix.array, C=cols?mesh.instanceColor.array:null; let k=0;
    for(let i=0;i<n;i++){ const dx=xz[i*2]-cx, dz=xz[i*2+1]-cz; if(dx*dx+dz*dz>r2) continue; const a=i*16, b=k*16; for(let j=0;j<16;j++) A[b+j]=mats[a+j]; if(C){ C[k*3]=cols[i*3]; C[k*3+1]=cols[i*3+1]; C[k*3+2]=cols[i*3+2]; } k++; }
    mesh.count=k; mesh.instanceMatrix.needsUpdate=true; if(C) mesh.instanceColor.needsUpdate=true; }};
  (U.pools||(U.pools=[])).push(P); return P;
}
function kit(parts){ // parts: [shape,x,baseY,z,w,h,d,hex,rotY]
  const saved=XA; XA={pos:[],nor:[],col:[]}; for(const p of parts) xAdd(p[0],p[1],p[2],p[3],p[4],p[5],p[6],p[7],p[8]);
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(XA.pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(XA.nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(XA.col,3)); XA=saved; return g; }
const IRON='#2f3338', WOOD='#8a5a34', STONE='#cfc8b6';
function furnitureKits(){
  const K={};
  const bench=[['box',-0.78,0,0,0.07,0.46,0.5,IRON],['box',0.78,0,0,0.07,0.46,0.5,IRON],['box',-0.78,0.46,-0.26,0.06,0.55,0.05,IRON],['box',0.78,0.46,-0.26,0.06,0.55,0.05,IRON],['box',-0.82,0.6,-0.04,0.05,0.05,0.5,IRON],['box',0.82,0.6,-0.04,0.05,0.05,0.5,IRON]];
  for(const z of [-0.17,0,0.17]) bench.push(['box',0,0.43,z,1.7,0.04,0.12,WOOD]);
  for(const y of [0.6,0.74,0.88]) bench.push(['box',0,y,-0.27,1.7,0.1,0.035,WOOD]);
  K.bench=kit(bench);
  K.lamp=kit([['cyl',0,0,0,0.44,0.35,0.44,IRON],['cyl',0,0.35,0,0.24,0.35,0.24,IRON],['cyl',0,0.7,0,0.13,3.25,0.13,IRON],['cyl',0,3.9,0,0.3,0.1,0.3,IRON],['box',0,3.4,0,0.34,0.08,0.34,IRON],['box',0,4.55,0,0.46,0.08,0.46,IRON],['pyr',0,4.63,0,0.62,0.4,0.62,IRON],['sph8',0,5.05,0,0.14,0.14,0.14,IRON],['box',0.28,3.55,0,0.5,0.05,0.05,IRON]]);
  K.lampHead=kit([['box',0,3.98,0,0.34,0.56,0.34,'#fff3cf']]);
  K.bin=kit([['cyl',0,0,0,0.55,0.9,0.55,'#3e5a47'],['cyl',0,0.9,0,0.6,0.07,0.6,IRON],['cyl',0,0.97,0,0.2,0.07,0.2,IRON],['box',0,0.5,0.28,0.4,0.06,0.02,'#d9d9d9']]);
  const rack=[]; for(const x of [-0.9,-0.3,0.3,0.9]){ rack.push(['box',x,0,-0.25,0.04,0.85,0.04,'#9aa0a6'],['box',x,0,0.25,0.04,0.85,0.04,'#9aa0a6'],['box',x,0.82,0,0.04,0.04,0.54,'#9aa0a6']); } K.bike=kit(rack);
  K.planter=kit([['box',0,0,0,1.3,0.6,1.3,'#b9b2a2'],['box',0,0.58,0,1.16,0.05,1.16,'#4a3a2c'],['sph8',0,0.55,0,1.0,0.9,1.0,'#4f8a45'],['sph8',0.36,0.6,0.3,0.7,0.6,0.7,'#5a9a4c'],['sph8',-0.36,0.58,-0.26,0.6,0.55,0.6,'#3f7a3f'],['sph8',0.12,1.05,0.05,0.2,0.2,0.2,'#d94f6a'],['sph8',-0.2,0.95,0.22,0.18,0.18,0.18,'#f2c14e'],['sph8',0.3,0.95,-0.3,0.18,0.18,0.18,'#d94f6a']]);
  const tbl=[['cyl',0,0,0,0.5,0.03,0.5,IRON],['cyl',0,0.03,0,0.06,0.72,0.06,IRON],['cyl',0,0.74,0,0.95,0.04,0.95,'#d8d0c0'],['cyl',0,0.78,0,0.06,2.0,0.06,IRON],['cone',0,2.3,0,2.7,0.55,2.7,'#c63a2f'],['sph8',0,2.85,0,0.14,0.14,0.14,'#d9b43a']];
  for(const [dx,dz,ry] of [[0.85,0,0],[-0.85,0,0],[0,0.85,1.5708],[0,-0.85,1.5708]]) tbl.push(['box',dx,0.43,dz,0.42,0.04,0.42,IRON,ry],['box',dx+Math.sign(dx||0)*0.2,0.46,dz+Math.sign(dz||0)*0.2,dx?0.04:0.42,0.42,dx?0.42:0.04,IRON],['box',dx,0,dz,0.04,0.43,0.04,IRON]);
  K.table=kit(tbl);
  K.shelter=kit([['box',0,2.4,0,3.4,0.12,1.7,'#4b5a68'],['box',-1.6,0,-0.75,0.07,2.4,0.07,IRON],['box',1.6,0,-0.75,0.07,2.4,0.07,IRON],['box',-1.6,0,0.75,0.07,2.4,0.07,IRON],['box',1.6,0,0.75,0.07,2.4,0.07,IRON],['box',0,0.45,-0.78,3.2,1.95,0.04,'#9fc2d6'],['box',-1.62,0.45,0,0.04,1.95,1.5,'#9fc2d6'],['box',0,0.46,-0.45,2.4,0.06,0.4,WOOD],['box',1.9,0,0.5,0.1,2.6,0.1,IRON],['box',1.9,2.0,0.5,0.6,0.5,0.06,'#1f6fb5']]);
  const fo=[['cyl',0,0,0,2.3,0.14,2.3,'#bdb6a3'],['cyl',0,0.14,0,2.1,0.62,2.1,STONE],['cyl',0,0.74,0,2.2,0.1,2.2,'#d8d2c2'],['cyl',0,0.72,0,1.95,0.07,1.95,'#58b7d6'],['cyl',0,0.78,0,0.7,0.6,0.7,STONE],['cyl',0,1.35,0,1.25,0.16,1.25,STONE],['cyl',0,1.5,0,1.1,0.05,1.1,'#7fd0ea'],['cyl',0,1.5,0,0.22,0.8,0.22,STONE],['cyl',0,2.25,0,0.62,0.12,0.62,STONE],['cone',0,2.35,0,0.24,1.5,0.24,'#f2fbff']];
  for(let k=0;k<12;k++){ const a=k*0.5236; fo.push(['cone',Math.cos(a)*0.95,0.78,Math.sin(a)*0.95,0.05,0.85,0.05,'#f2fbff'],['cone',Math.cos(a)*0.45,1.55,Math.sin(a)*0.45,0.05,0.7,0.05,'#f2fbff']); }
  K.fountain=kit(fo);
  K.statue=kit([['box',0,0,0,1.9,0.3,1.9,'#b9b2a0'],['box',0,0.3,0,1.5,0.9,1.5,STONE],['box',0,1.2,0,1.75,0.16,1.75,'#bdb5a2'],['box',0,1.36,0,1.15,0.9,1.15,STONE],['box',0,2.26,0,1.4,0.14,1.4,'#bdb5a2'],['cyl',-0.14,2.4,0,0.16,0.8,0.16,'#6b5430'],['cyl',0.14,2.4,0,0.16,0.8,0.16,'#6b5430'],['cyl',0,3.15,0,0.5,0.34,0.5,'#6b5430'],['cyl',0,3.45,0,0.46,0.7,0.46,'#6b5430'],['sph8',0,4.28,0,0.34,0.36,0.34,'#6b5430'],['sph8',0,4.46,0,0.38,0.26,0.4,'#4d6a58'],['box',0,4.62,0,0.06,0.2,0.5,'#4d6a58'],['box',0.46,3.6,0.04,0.12,0.8,0.12,'#6b5430'],['box',-0.5,3.75,0.16,0.1,0.55,0.16,'#6b5430'],['cyl',0.52,2.9,0.06,0.05,1.2,0.05,'#c9ccd0'],['box',-0.62,3.5,0.3,0.06,0.62,0.62,'#7a6238']]);
  return K;
}
function leafTexture(rnd,jac){
  const c=document.createElement('canvas'); c.width=c.height=512; const g=c.getContext('2d'); g.scale(2,2);
  g.strokeStyle='#5a4130'; g.lineCap='round'; g.lineWidth=9; g.beginPath(); g.moveTo(128,256); g.quadraticCurveTo(126,200,128,128); g.stroke();
  g.lineWidth=4; for(const [x,y] of [[78,100],[178,96],[100,70],[156,66]]){ g.beginPath(); g.moveTo(128,168); g.quadraticCurveTo(128,130,x,y); g.stroke(); }
  const pal=jac?['#4f6f3a','#7a5aa0','#8f6fc0','#a584d6','#bda0e6','#d9c6f5']:['#2c6636','#3a7a42','#4a8e4e','#5fa457','#79b866','#92c77a']; // jacarandas blossom purple
  for(let i=0;i<300;i++){ const a=rnd()*6.283, d=Math.sqrt(rnd()), x=128+Math.cos(a)*d*100, y=88+Math.sin(a)*d*70, r=9+rnd()*18, hgt=1-(y-18)/140;
    g.fillStyle=pal[clamp(Math.floor(hgt*4.2+rnd()*1.8-0.4),0,5)]; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill(); }
  for(let i=0;i<700;i++){ const a=rnd()*6.283, d=Math.sqrt(rnd()), x=128+Math.cos(a)*d*108, y=88+Math.sin(a)*d*78; g.fillStyle=rnd()<0.5?'rgba(255,255,220,0.10)':'rgba(0,20,0,0.16)'; g.beginPath(); g.arc(x,y,1+rnd()*2,0,6.283); g.fill(); }
  g.globalCompositeOperation='destination-out'; for(let i=0;i<46;i++){ const a=rnd()*6.283, x=128+Math.cos(a)*(88+rnd()*22), y=88+Math.sin(a)*(60+rnd()*18); g.beginPath(); g.arc(x,y,3+rnd()*7,0,6.283); g.fill(); }
  return c;
}
function palmTexture(rnd){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); g.lineCap='round';
  g.strokeStyle='#8a6a46'; g.lineWidth=7; g.beginPath(); g.moveTo(64,256); g.quadraticCurveTo(58,190,66,112); g.stroke(); g.strokeStyle='rgba(60,40,20,0.35)'; g.lineWidth=2; for(let y=250;y>118;y-=9){ g.beginPath(); g.moveTo(59,y); g.lineTo(69,y-3); g.stroke(); }
  const frond=(cx,cy,ex,ey,bend,w)=>{ g.strokeStyle='#2f6b34'; g.lineWidth=w; g.beginPath(); g.moveTo(cx,cy); g.quadraticCurveTo((cx+ex)/2,(cy+ey)/2+bend,ex,ey); g.stroke(); g.lineWidth=1.6; g.strokeStyle='#4f9a48';
    for(let t=0.2;t<1;t+=0.07){ const x=(1-t)*(1-t)*cx+2*(1-t)*t*((cx+ex)/2)+t*t*ex, y=(1-t)*(1-t)*cy+2*(1-t)*t*((cy+ey)/2+bend)+t*t*ey; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(ex-cx)*0.05+3,y+13*(1-t*0.4)); g.moveTo(x,y); g.lineTo(x+(ex-cx)*0.05-3,y+13*(1-t*0.4)); g.stroke(); } };
  for(let k=0;k<9;k++){ const a=Math.PI+(k/8)*Math.PI*1.0-0.0; frond(66,112,66+Math.cos(a)*58,112+Math.sin(a)*34+14,-10+rnd()*8,3.2); }
  frond(66,112,66,52,0,3); frond(66,112,34,70,-6,3); frond(66,112,98,70,-6,3);
  g.translate(192,128); for(let k=0;k<13;k++){ const a=k*6.283/13+rnd()*0.2; g.save(); g.rotate(a); g.strokeStyle='#2f6b34'; g.lineWidth=3.4; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(26,-4,58,2); g.stroke(); g.strokeStyle='#559f4c'; g.lineWidth=1.5;
    for(let t=10;t<58;t+=4){ g.beginPath(); g.moveTo(t,0); g.lineTo(t+3,9); g.moveTo(t,0); g.lineTo(t+3,-9); g.stroke(); } g.restore(); }
  g.fillStyle='#6a4a2c'; g.beginPath(); g.arc(0,0,6,0,6.283); g.fill();
  return c;
}
function cardGeo(uv0,uv1,hy,hw,palm){ // three crossed vertical cards plus a horizontal canopy card, double-sided with one shared up-pointing normal
  const pos=[],nor=[],uv=[],col=[],idx=[]; let vc=0;
  const quad=(p,t,c)=>{ for(let i=0;i<4;i++){ pos.push(p[i][0],p[i][1],p[i][2]); nor.push(0,1,0); uv.push(t[i][0],t[i][1]); col.push(c[i],c[i],c[i]); } idx.push(vc,vc+1,vc+2,vc,vc+2,vc+3,vc,vc+2,vc+1,vc,vc+3,vc+2); vc+=4; };
  for(let k=0;k<3;k++){ const a=k*Math.PI/3, cx=Math.cos(a)*0.5, cz=-Math.sin(a)*0.5; quad([[-cx,0,-cz],[cx,0,cz],[cx,1,cz],[-cx,1,-cz]],[[uv0[0],0],[uv1[0],0],[uv1[0],1],[uv0[0],1]],[0.5,0.5,1,1]); }
  const e=hw; quad([[-e,hy,-e],[e,hy,-e],[e,hy,e],[-e,hy,e]],palm?[[0.5,0],[1,0],[1,1],[0.5,1]]:[[0.12,0.42],[0.88,0.42],[0.88,0.93],[0.12,0.93]],[1,1,1,1]);
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(nor,3)); g.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); g.setAttribute('color',new T.Float32BufferAttribute(col,3)); g.setIndex(idx); return g;
}
function buildUscTrees(q,rnd){
  const cap=q.trees>=2400?3200:q.trees>=1500?2000:800, round=[], palms=[], free=(x,z)=>inReg(x,z,10)&&!bAt(x,z);
  for(const [x,z] of U.D.tr) if(free(x,z)) round.push([x,z]);
  for(const r of U.D.r){
    if(r.t==='footway'||r.t==='pedestrian') walkPath(r.p,13,rnd,(x,z,dx,dz)=>{ if(rnd()<0.32){ const o=(rnd()<0.5?-1:1)*(3.2+rnd()*3.4); const px=x-dz*o, pz=z+dx*o; if(free(px,pz)) round.push([px,pz]); } });
    else if(r.t==='primary'||r.t==='secondary'||r.t==='tertiary') walkPath(r.p,20,rnd,(x,z,dx,dz)=>{ if(rnd()<0.5){ const o=(rnd()<0.5?-1:1)*(ROAD_W[r.t]/2+3.5); const px=x-dz*o, pz=z+dx*o; if(free(px,pz)) palms.push([px,pz]); } });
    else if(r.t==='residential') walkPath(r.p,18,rnd,(x,z,dx,dz)=>{ if(rnd()<0.5){ const o=(rnd()<0.5?-1:1)*(ROAD_W.residential/2+3.2); const px=x-dz*o, pz=z+dx*o; if(free(px,pz)) round.push([px,pz]); } });
  }
  for(const a of U.D.a){ if(a.k!=='g') continue; const n=a.p.length/2; let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(let i=0;i<n;i++){ x0=Math.min(x0,a.p[i*2]); x1=Math.max(x1,a.p[i*2]); z0=Math.min(z0,a.p[i*2+1]); z1=Math.max(z1,a.p[i*2+1]); }
    const cnt=Math.min(60,Math.floor((x1-x0)*(z1-z0)*0.5/360)); for(let t=0,k=0;t<cnt*6&&k<cnt;t++){ const x=x0+(x1-x0)*rnd(), z=z0+(z1-z0)*rnd(); if(pip(a.p,n,x,z)&&free(x,z)){ round.push([x,z]); k++; } } }
  const tr=[], trj=[], pl=[], cc=new T.Color();
  for(const [x,z] of round.slice(0,cap)){ const w=5+rnd()*4, hgt=w*(1.25+rnd()*0.4); cc.setRGB(0.82+rnd()*0.3,0.86+rnd()*0.26,0.78+rnd()*0.24); (rnd()<0.14?trj:tr).push({x,z,y:0.25,sx:w,sz:w,sy:hgt,ry:rnd()*3,col:'#'+cc.getHexString()}); }
  for(const [x,z] of palms.slice(0,Math.floor(cap*0.45))){ const hgt=9+rnd()*6; cc.setRGB(0.9+rnd()*0.2,0.92+rnd()*0.16,0.86+rnd()*0.2); pl.push({x,z,y:0.25,sx:hgt*0.75,sz:hgt*0.75,sy:hgt,ry:rnd()*3,col:'#'+cc.getHexString()}); }
  if(W.gnd){ const G=W.gnd; G.g.fillStyle='rgba(15,30,15,0.26)'; for(const t of tr){ G.g.beginPath(); G.g.ellipse(G.X(t.x+1.2),G.Z(t.z+1.0),t.sx*0.42*G.sx,t.sx*0.36*G.sz,0,0,6.283); G.g.fill(); }
    G.g.fillStyle='rgba(15,30,15,0.2)'; for(const t of pl){ G.g.beginPath(); G.g.ellipse(G.X(t.x+0.8),G.Z(t.z+0.7),t.sx*0.3*G.sx,t.sx*0.26*G.sz,0,0,6.283); G.g.fill(); } G.tex.needsUpdate=true; } // painted shadows under the trees
  const jt=new T.CanvasTexture(leafTexture(mulberry32(21),true)); jt.colorSpace=T.SRGBColorSpace; jt.anisotropy=4; const jm=new T.MeshLambertMaterial({map:jt,alphaTest:0.5,vertexColors:true}); W.ownMats.push(jm);
  const tt=new T.CanvasTexture(leafTexture(mulberry32(11))), pt=new T.CanvasTexture(palmTexture(mulberry32(12)));
  for(const t of [tt,pt]){ t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; }
  const tm=new T.MeshLambertMaterial({map:tt,alphaTest:0.5,vertexColors:true}), pm=new T.MeshLambertMaterial({map:pt,alphaTest:0.5,vertexColors:true}); W.ownMats.push(tm,pm);
  makePool(cardGeo([0,0],[1,1],0.66,0.4,false),tm,tr,640,true); makePool(cardGeo([0,0],[1,1],0.66,0.4,false),jm,trj,640,true); makePool(cardGeo([0,0],[0.5,1],0.9,0.45,true),pm,pl,640,true);
}

/* ---- street furniture (lamps, benches, bins, bike racks, planters, café tables, bus shelters, fountains, statues) ---- */
function bushTexture(rnd){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'), pal=['#2c6636','#3a7a42','#4a8e4e','#5fa457','#79b866'];
  for(let i=0;i<150;i++){ const a=rnd()*Math.PI, d=Math.sqrt(rnd()), x=64+Math.cos(a)*d*56, y=122-Math.sin(a)*d*96, r=8+rnd()*13; g.fillStyle=pal[clamp(Math.floor((1-y/122)*4.4+rnd()*1.4),0,4)]; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill(); }
  for(let i=0;i<18;i++){ const a=rnd()*Math.PI, d=Math.sqrt(rnd()), x=64+Math.cos(a)*d*50, y=118-Math.sin(a)*d*80; g.fillStyle=['#f4d94e','#f2f2f0','#e98aa8','#c9a6ff'][Math.floor(rnd()*4)]; g.beginPath(); g.arc(x,y,2.6,0,6.283); g.fill(); }
  g.globalCompositeOperation='destination-out'; g.fillRect(0,122,128,6); return c;
}
function buildUscProps(q,rnd){
  const free=(x,z)=>inReg(x,z,6)&&!bAt(x,z), cap=q.trees>=2400?1400:q.trees>=1500?800:300, lamps=[], benches=[], shelters=[], bins=[], planters=[], bikes=[], tables=[];
  for(const [x,z] of U.D.l) if(free(x,z)) lamps.push({x,z,y:0.25,ry:rnd()*6});
  for(const r of U.D.r){
    if(r.t==='primary'||r.t==='secondary'||r.t==='tertiary'||r.t==='residential'){ let sd=1; walkPath(r.p,r.t==='residential'?38:30,rnd,(x,z,dx,dz)=>{ sd=-sd; const off=sd*(ROAD_W[r.t]/2+1.4), px=x-dz*off, pz=z+dx*off; if(free(px,pz)) lamps.push({x:px,z:pz,y:0.25,ry:Math.atan2(dx,dz)}); }); }
    else if(r.t==='pedestrian'||r.t==='footway'){ const ped=r.t==='pedestrian';
      walkPath(r.p,ped?24:40,rnd,(x,z,dx,dz)=>{ const sd=rnd()<0.5?-1:1, o=ped?3.8:2.1, px=x-dz*sd*o, pz=z+dx*sd*o; if(!free(px,pz)) return; const yaw=Math.atan2(dx,dz); lamps.push({x:px,z:pz,y:0.25,ry:yaw});
        const q2=rnd(); if(q2<0.3) benches.push({x:px+dz*sd*0.9,z:pz-dx*sd*0.9,y:0.25,ry:yaw+(sd>0?Math.PI:0)}); else if(q2<0.42) bins.push({x:px-dz*sd*0.8,z:pz+dx*sd*0.8,y:0.25,ry:yaw}); else if(q2<0.5&&ped) planters.push({x:px-dz*sd*1.5,z:pz+dx*sd*1.5,y:0.25,ry:yaw}); }); }
  }
  for(const [x,z] of U.D.bn) if(free(x,z)) benches.push({x,z,y:0.25,ry:rnd()*6});
  for(const [x,z] of U.D.bs) if(free(x,z)) shelters.push({x,z,y:0.25,ry:rnd()*3.14});
  for(const [x,z] of U.D.bk) if(free(x,z)) bikes.push({x,z,y:0.25,ry:rnd()*3.14});
  for(const [x,z,n,kd] of U.D.poi){ if(kd==='b'||kd==='l') continue; for(let k=0;k<2;k++){ const a=rnd()*6.28, px=x+Math.cos(a)*(4+k*3.5), pz=z+Math.sin(a)*(4+k*3.5); if(free(px,pz)) tables.push({x:px,z:pz,y:0.25,ry:rnd()*3}); } }
  const mO=mat('#ffffff',{r:0.7,vc:true}), lamp=lamps.slice(0,cap), benchL=benches.slice(0,Math.floor(cap*0.4)), K=furnitureKits(), R_=300;
  makePool(K.lamp,mO,lamp,R_); makePool(K.bench,mO,benchL,R_*0.8); makePool(K.bin,mO,bins.slice(0,200),R_*0.7); makePool(K.bike,mO,bikes,R_*0.7); makePool(K.planter,mO,planters.slice(0,200),R_*0.7); makePool(K.table,mO,tables.slice(0,80),R_*0.8); makePool(K.shelter,mO,shelters.slice(0,200),R_);
  W.lampMat=new T.MeshStandardMaterial({vertexColors:true,roughness:0.4,emissive:'#ffd98a',emissiveIntensity:0.12}); W.ownMats.push(W.lampMat); makePool(K.lampHead,W.lampMat,lamp,R_);
  const fo=U.D.fo.filter(([x,z])=>free(x,z)).map(([x,z,r0])=>{ const r=clamp(r0,1.6,9); return {x,z,y:0.25,sx:r,sz:r,sy:clamp(r*0.7,0.9,2.4),ry:0}; }); makePool(K.fountain,mO,fo,600);
  const ar=U.D.art.filter(([x,z])=>free(x,z)).map(([x,z])=>({x,z,y:0.25,ry:rnd()*6})); makePool(K.statue,mO,ar,500);
  const bushes=[], bc=new T.Color(), addBush=(x,z)=>{ const sc=0.9+rnd()*1.1; bc.setRGB(0.85+rnd()*0.3,0.9+rnd()*0.2,0.8+rnd()*0.25); bushes.push({x,z,y:0.25,sx:2.3*sc,sz:2.3*sc,sy:1.7*sc,ry:rnd()*3,col:'#'+bc.getHexString()}); };
  for(const r of U.D.r){ if(r.t!=='footway'&&r.t!=='pedestrian') continue; walkPath(r.p,9,rnd,(x,z,dx,dz)=>{ if(rnd()<0.3){ const sd=rnd()<0.5?-1:1, o=(r.t==='pedestrian'?4.8:2.7)*sd, px=x-dz*o, pz=z+dx*o; if(free(px,pz)) addBush(px,pz); } }); }
  for(const b of U.B){ if(b.area<350||b.hw<6||b.k==='p') continue; const p=b.p, n=b.n; for(let i=0;i<n;i++){ const j=(i+1)%n, ax=p[i*2], az=p[i*2+1], ex=p[j*2]-ax, ez=p[j*2+1]-az, L=Math.hypot(ex,ez); if(L<8) continue; const nx=ez/L, nz=-ex/L;
      for(let t=2+rnd()*3;t<L-1;t+=5+rnd()*5){ if(rnd()<0.4){ const px=ax+ex/L*t+nx*1.5, pz=az+ez/L*t+nz*1.5; if(free(px,pz)) addBush(px,pz); } } } }
  const bt=new T.CanvasTexture(bushTexture(mulberry32(13))); bt.colorSpace=T.SRGBColorSpace; bt.anisotropy=4; const bm=new T.MeshLambertMaterial({map:bt,alphaTest:0.5,vertexColors:true}); W.ownMats.push(bm);
  makePool(cardGeo([0,0],[1,1],0.5,0.5,false),bm,bushes.slice(0,q.trees>=2400?1800:q.trees>=1500?1100:400),170,true);
}

/* ---- people (they run when a bird swoops close) and cars ---- */
function buildUscPeople(q,rnd){
  const paths=[], tot={v:0};
  for(const r of U.D.r){ const walk=r.t==='footway'||r.t==='pedestrian'||r.t==='steps', side=!walk&&(r.t==='primary'||r.t==='secondary'||r.t==='tertiary'||r.t==='residential');
    if(!walk&&!side) continue; if(!inReg(r.p[0],r.p[1],150)) continue; const P=mkPath(r.p); if(P.len<25) continue;
    P.w=P.len*(r.t==='pedestrian'?5:side?(W.co.id==='la'?1.6:0.35):1); P.side=side?ROAD_W[r.t]/2+1.3:0; tot.v+=P.w; paths.push(P); }
  if(!paths.length) return;
  const la=W.co.id==='la', N=q.trees>=2400?(la?520:340):q.trees>=1500?(la?340:230):(la?130:90), list=[];
  const pick=()=>{ let v=rnd()*tot.v; for(const P of paths){ v-=P.w; if(v<=0) return P; } return paths[0]; };
  const SH=la?['#222831','#2f6bb0','#f2f2ee','#d96b6b','#3f8a5a','#8a6bb8','#e08a2b','#6b7280','#1d2a22','#c9a227']:['#990000','#ffcc00','#990000','#ffcc00','#2f6bb0','#f2f2ee','#222831','#3f8a5a','#d96b6b','#8a6bb8','#e08a2b'], SK=['#f1c9a5','#d9a47c','#b97c52','#8d5a38','#5f3b25'], PN=['#2b3a55','#222831','#4a5b78','#8a7f6a','#d9d2c0','#1d1d1f'];
  const HR=['#1d1a18','#2b211a','#4a3322','#7a5a34','#c9a25a','#8a8a8a','#101010'], PK=['#990000','#222831','#2f6bb0','#3f8a5a','#ffcc00','#555b66','#8a4a2a'];
  for(let i=0;i<N;i++){ const P=pick(), stand=rnd()<0.12;
    list.push({path:P,s:rnd()*P.len,dir:rnd()<0.5?-1:1,sp:stand?0:1.0+rnd()*0.7,off:P.side?(rnd()<0.5?-1:1)*(P.side+rnd()*0.8):(rnd()-0.5)*(P.w>P.len*2?5:1.4),ph:rnd()*6.28,wk:0,fr:0,hop:0,yaw:rnd()*6.28,sh:SH[Math.floor(rnd()*SH.length)],sk:SK[Math.floor(rnd()*SK.length)],hr:HR[Math.floor(rnd()*HR.length)],pk:PK[Math.floor(rnd()*PK.length)],pn:PN[Math.floor(rnd()*PN.length)],x:0,z:0}); }
  const cyl_=(r0,r1,h,y)=>{ const g=new T.CylinderGeometry(r0,r1,h,6); g.translate(0,y,0); return g; };
  const hairGeo=new T.SphereGeometry(0.135,8,5,0,6.283,0,1.7); hairGeo.translate(0,1.54,0); const packGeo=new T.BoxGeometry(0.3,0.4,0.14); packGeo.translate(0,1.1,-0.23);
  const parts=[
    {g:cyl_(0.21,0.24,0.62,1.05),px:0,py:0,sw:0,c:'sh'},{g:(()=>{ const g=new T.SphereGeometry(0.125,8,6); g.translate(0,1.52,0); return g; })(),px:0,py:0,sw:0,c:'sk'},
    {g:cyl_(0.08,0.07,0.78,-0.39),px:-0.1,py:0.78,sw:1,c:'pn'},{g:cyl_(0.08,0.07,0.78,-0.39),px:0.1,py:0.78,sw:-1,c:'pn'},
    {g:cyl_(0.055,0.05,0.58,-0.29),px:-0.28,py:1.33,sw:-0.8,c:'sk'},{g:cyl_(0.055,0.05,0.58,-0.29),px:0.28,py:1.33,sw:0.8,c:'sk'},{g:hairGeo,px:0,py:0,sw:0,c:'hr'},{g:packGeo,px:0,py:0,sw:0,c:'pk'}];
  const cc=new T.Color();
  for(const pt of parts){ pt.mesh=new T.InstancedMesh(pt.g,mat('#ffffff',{r:0.85}),N); pt.mesh.frustumCulled=false; pt.mesh.castShadow=false;
    list.forEach((w,i)=>{ cc.set(w[pt.c]); pt.mesh.setColorAt(i,cc); }); W.scene.add(pt.mesh); }
  U.people={list,parts};
}
function carKit(){ const W_='#ffffff', DK='#15191f';
  return kit([['box',0,0.28,0,1.85,0.55,4.4,W_],['box',0,0.83,-0.25,1.6,0.46,2.3,DK],['box',0,1.28,-0.25,1.5,0.07,1.95,W_],['box',0,0.62,1.3,1.78,0.12,1.5,W_],
    ['box',-0.95,0.05,1.4,0.26,0.64,0.64,'#101010'],['box',0.95,0.05,1.4,0.26,0.64,0.64,'#101010'],['box',-0.95,0.05,-1.4,0.26,0.64,0.64,'#101010'],['box',0.95,0.05,-1.4,0.26,0.64,0.64,'#101010'],
    ['box',-0.6,0.5,2.2,0.34,0.14,0.05,'#fff6c8'],['box',0.6,0.5,2.2,0.34,0.14,0.05,'#fff6c8'],['box',-0.6,0.56,-2.2,0.34,0.12,0.05,'#c01818'],['box',0.6,0.56,-2.2,0.34,0.12,0.05,'#c01818'],['box',0,0.2,2.2,1.8,0.18,0.08,'#2a2d33'],['box',0,0.2,-2.2,1.8,0.18,0.08,'#2a2d33']]); }
function buildUscCars(q,rnd){
  const roads=[], tot={v:0}; for(const r of U.D.r){ if(!['primary','secondary','tertiary','residential'].includes(r.t)) continue; if(!inReg(r.p[0],r.p[1],50)) continue; const P=mkPath(r.p); if(P.len<60) continue; P.w=P.len*(r.t==='primary'?3:r.t==='secondary'?2:1); tot.v+=P.w; roads.push(P); }
  if(!roads.length) return;
  const la=W.co.id==='la', N=q.trees>=2400?(la?130:80):q.trees>=1500?(la?80:50):(la?30:20), list=[], CC=['#f2f2f0','#1d1f24','#8b8f96','#a31f26','#2d4f8a','#c9ccd2','#2b2f36','#d9b43a','#3d7a5a'];
  const pick=()=>{ let v=rnd()*tot.v; for(const P of roads){ v-=P.w; if(v<=0) return P; } return roads[0]; };
  for(let i=0;i<N;i++){ const P=pick(); list.push({path:P,s:rnd()*P.len,dir:rnd()<0.5?-1:1,sp:6+rnd()*7,col:CC[Math.floor(rnd()*CC.length)]}); }
  const cm=new T.MeshStandardMaterial({vertexColors:true,roughness:0.4,metalness:0.35}); W.ownMats.push(cm); const body=new T.InstancedMesh(carKit(),cm,N), cab=null, cc=new T.Color();
  list.forEach((c,i)=>{ cc.set(c.col); body.setColorAt(i,cc); }); body.frustumCulled=false; body.castShadow=false; W.scene.add(body); U.cars={list,body,cab};
}
function buildUscSkyline(rnd){ // downtown Los Angeles sits north-east of USC; a compressed version gives the horizon its famous shape
  const n=30, im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat('#9fb3c6',{r:0.35,m:0.3}),n), o=new T.Object3D(), dx=0.75, dz=-0.66, cx=dx*3200, cz=dz*3200;
  for(let i=0;i<n;i++){ const a=rnd()*6.28, d=Math.sqrt(rnd())*320, w=24+rnd()*40, h=i===0?210:50+rnd()*rnd()*170; o.position.set(cx+Math.cos(a)*d,h/2,cz+Math.sin(a)*d); o.scale.set(w,h,w*(0.7+rnd()*0.5)); o.rotation.set(0,rnd()*1.5,0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
  im.frustumCulled=false; W.scene.add(im);
}

/* ---- name labels: they appear on buildings, places and streets as you get close ---- */
const LBL_COL={b:'#ffd24a',p:'#7fe0a8',f:'#ff9a5a',a:'#c9a6ff',s:'#cfd8dc'};
function buildUscLabels(){
  const S=[], seen=new Map();
  for(const b of U.B){ if(!b.name||(b.area<150&&b.h<22)) continue; if(!inReg(b.cx,b.cz,0)) continue; S.push({x:b.cx,z:b.cz,y:b.h+1.5,t:b.name,k:'b',sub:bldSub(b),max:Math.min(520,150+Math.sqrt(b.area)*4+b.h*1.2)}); }
  for(const n in U.D.pl){ const q=U.D.pl[n]; S.push({x:q[0],z:q[1],y:7,t:n,k:'p',max:340}); }
  for(const [x,z,n,kd] of U.D.poi) S.push({x,z,y:7.5,t:n,k:'f',max:95});
  for(const [x,z,n] of U.D.art) if(n) S.push({x,z,y:5,t:n,k:'a',max:110});
  for(const r of U.D.r){ if(!r.n||!(r.t==='primary'||r.t==='secondary'||r.t==='tertiary'||r.t==='residential'||r.t==='pedestrian'||r.t==='motorway')) continue; const P=mkPath(r.p); if(P.len<60) continue; const last=seen.get(r.n)||[];
    const a=pathAt(P,P.len*0.5); if(last.some(q=>Math.hypot(q[0]-a.x,q[1]-a.z)<260)||!inReg(a.x,a.z,20)) continue; last.push([a.x,a.z]); seen.set(r.n,last);
    S.push({x:a.x,z:a.z,y:9,t:r.n,k:'s',max:190}); }
  const sprites=[], mats=[];
  for(let i=0;i<16;i++){ const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const tx=new T.CanvasTexture(cv); tx.colorSpace=T.SRGBColorSpace; tx.generateMipmaps=false; tx.minFilter=T.LinearFilter;
    const m=new T.SpriteMaterial({map:tx,transparent:true,depthWrite:false,fog:false}); W.ownMats.push(m); const sp=new T.Sprite(m); sp.center.set(0.5,0.1); sp.visible=false; sp.renderOrder=20; W.scene.add(sp); sprites.push({sp,cv,tx,m,id:-1}); }
  U.labels={S,pool:sprites,acc:1,cd:new T.Vector3()};
}
/* Labels are painted as signage that belongs to the thing they name, and their tail points at it:
   buildings = cardinal plaque with a gold rule and a "floors · height" line, streets = green street sign, places = park sign, cafés/art = small tags. */
function bldSub(b){ const hsK=U.hs||1, fl=Math.max(1,Math.round(b.hw/hsK/3.7)), kd={u:'University building',r:'Residence',c:'Campus building',p:'Parking',o:'Building'}[b.k]||'Building'; return `${kd} · ${fl} ${fl>1?'floors':'floor'} · ${Math.round(b.h/hsK)} m`; }
function paintLabel(s,src){
  const g=s.cv.getContext('2d'), W2=512, H2=128; g.clearRect(0,0,W2,H2); g.textBaseline='middle'; g.textAlign='center';
  const fit=(txt,px,wt,fam,max)=>{ let f=px; g.font=`${wt} ${f}px ${fam}`; const w=g.measureText(txt).width; if(w>max){ f=Math.max(13,f*max/w); g.font=`${wt} ${f}px ${fam}`; } return g.measureText(txt).width; };
  const SERIF='Fraunces,Georgia,"Times New Roman",serif', SANS='"DM Sans",system-ui,sans-serif';
  const plate=(x,y,w,h,r,fill,edge,edge2)=>{ g.save(); g.shadowColor='rgba(0,0,0,0.45)'; g.shadowBlur=12; g.shadowOffsetY=4; g.fillStyle=fill; g.beginPath(); g.roundRect(x,y,w,h,r); g.fill(); g.restore();
    if(edge){ g.strokeStyle=edge; g.lineWidth=3; g.beginPath(); g.roundRect(x+3,y+3,w-6,h-6,Math.max(2,r-3)); g.stroke(); } if(edge2){ g.strokeStyle=edge2; g.lineWidth=1.5; g.beginPath(); g.roundRect(x+8,y+8,w-16,h-16,Math.max(2,r-8)); g.stroke(); } };
  const tail=(col)=>{ g.fillStyle=col; g.beginPath(); g.moveTo(240,108); g.lineTo(272,108); g.lineTo(256,124); g.closePath(); g.fill(); };
  if(src.k==='b'){ // building plaque
    const gr=g.createLinearGradient(0,6,0,108); gr.addColorStop(0,'#a60f1a'); gr.addColorStop(1,'#6e0710');
    const tw=fit(src.t,34,'700',SERIF,430), w=Math.min(500,Math.max(300,tw+70)), x0=256-w/2; plate(x0,6,w,102,14,gr,'#ffcc00','rgba(255,204,0,0.35)'); tail('#6e0710');
    g.fillStyle='#fff7e0'; g.fillText(src.t,256,38); g.fillStyle='#ffcc00'; g.fillRect(256-34,60,68,2); g.beginPath(); g.arc(256,61,3.4,0,6.283); g.fill();
    fit(src.sub||'',17,'500',SANS,w-40); g.fillStyle='#f6d98a'; g.fillText((src.sub||'').toUpperCase(),256,86);
  } else if(src.k==='s'){ // street sign
    const tw=fit(src.t,30,'700',SANS,420), w=Math.min(480,tw+64), x0=256-w/2; plate(x0,26,w,58,6,'#0f6b45','#ffffff'); g.fillStyle='#fff'; g.fillText(src.t,256,56);
    g.fillStyle='#8c8f94'; g.fillRect(250,84,12,40);
  } else if(src.k==='p'){ // park / plaza sign
    const tw=fit(src.t,30,'700',SERIF,420), w=Math.min(480,tw+80), x0=256-w/2; plate(x0,20,w,70,35,'rgba(24,62,44,0.92)','#9be3b4'); tail('rgba(24,62,44,0.92)');
    g.fillStyle='#9be3b4'; g.beginPath(); g.arc(x0+30,55,6,0,6.283); g.fill(); g.fillStyle='#fff'; g.fillText(src.t,256+10,56);
  } else { // cafés, art, other places: a small tag
    const col=LBL_COL[src.k]||'#fff', tw=fit(src.t,26,'700',SANS,400), w=Math.min(460,tw+70), x0=256-w/2; plate(x0,30,w,52,26,'rgba(30,26,40,0.9)',col); tail('rgba(30,26,40,0.9)');
    g.fillStyle=col; g.beginPath(); g.arc(x0+26,56,6,0,6.283); g.fill(); g.fillStyle='#fff'; g.fillText(src.t,256+10,57);
  }
  s.tx.needsUpdate=true;
}
function updateLabels(dt){
  const Lb=U.labels; if(!Lb) return; const cam=R.camera, cp=cam.position; Lb.acc+=dt;
  if(Lb.acc>=0.25){ Lb.acc=0; const f=cam.getWorldDirection(Lb.cd), cand=[];
    for(let i=0;i<Lb.S.length;i++){ const s=Lb.S[i], dx=s.x-cp.x, dz=s.z-cp.z, dy=s.y-cp.y, d2=dx*dx+dz*dz+dy*dy; if(d2>s.max*s.max) continue; const d=Math.sqrt(d2);
      if(d>45&&(dx*f.x+dy*f.y+dz*f.z)/d<0.3) continue; cand.push([d/s.max,i]); }
    cand.sort((a,b)=>a[0]-b[0]); const want=new Set(cand.slice(0,Lb.pool.length).map(c=>c[1]));
    for(const p of Lb.pool) if(p.id>=0&&!want.has(p.id)){ p.id=-1; p.sp.visible=false; }
    const have=new Set(Lb.pool.map(p=>p.id));
    for(const id of want){ if(have.has(id)) continue; const p=Lb.pool.find(q=>q.id<0); if(!p) break; p.id=id; paintLabel(p,Lb.S[id]); p.sp.position.set(Lb.S[id].x,Lb.S[id].y,Lb.S[id].z); p.sp.visible=true; } }
  for(const p of Lb.pool){ if(p.id<0) continue; const s=Lb.S[p.id], d=Math.hypot(s.x-cp.x,s.y-cp.y,s.z-cp.z), h=clamp(d*0.07,3.4,s.k==='b'?13:9)*(s.k==='s'?0.85:1);
    p.sp.scale.set(h*4,h,1); p.m.opacity=clamp((1-d/s.max)*3,0,1)*clamp((d-14)/14,0,1); }
}

function buildUSC(co,q){
  if(!uscPrep(co)){ msg(`The map data for ${co.name} did not load (${co.data}.js).`,true); return; }
  W.usc=true; const rnd=mulberry32(co.seed);
  _layerN=0; U.people=null; U.cars=null; U.labels=null; U.pigeons=null; U.bikes=null; U.flags=null; U.pools=[]; W.timeU={value:0}; W.nightU=W.nightU||{value:0}; U.m4=new T.Matrix4(); U.l4=new T.Matrix4(); U.o=new T.Matrix4();
  xInit(); buildUscGround(q); buildUscBuildings(q,rnd); buildUscStadiums(); buildUscTrees(q,rnd); buildUscProps(q,rnd); buildUscPeople(q,rnd); buildUscCars(q,rnd); buildUscPigeons(q,rnd); buildUscBikes(q,rnd); buildUscFlags(); if(co.id==='usc') buildUscSkyline(rnd); buildUscLabels(); xFlush(); U.solDone=true; buildRain(); buildMissionRings(); applyEnv();
}
function updateUsc(dt,t){
  const cam=R.camera.position; for(const Pl of U.pools||[]) Pl.update(cam.x,cam.z);
  const P=U.people, br=me.r, bp=br?br.pos:cam;
  if(P){ const M=U.m4, Lm=U.l4, O=U.o, n=P.list.length, bx=bp.x, bz=bp.z, sr=12+0.34*(br?br.v:0), low=bp.y<46;
    for(let i=0;i<n;i++){ const w=P.list[i], dxc=(w.x||0)-cam.x, dzc=(w.z||0)-cam.z;
      if(w.x!==0&&dxc*dxc+dzc*dzc>420*420) continue;
      if(low&&w.x!==0&&w.fr<=0){ const ex=w.x-bx, ez=w.z-bz; if(ex*ex+ez*ez<sr*sr){ const a0=pathAt(w.path,w.s); w.dir=(a0.dx*ex+a0.dz*ez)>=0?1:-1; w.fr=3+Math.random()*2.5; w.hop=0.4; } } // startled: run away along the path
      let speed=w.sp; if(w.fr>0){ w.fr-=dt; speed=4.9; } else if(w.greet>0){ w.greet-=dt; speed=0; w.yaw=Math.atan2(bx-w.x,bz-w.z); } if(w.hop>0) w.hop-=dt;
      if(speed>0){ w.s+=w.dir*speed*dt; w.wk+=speed*dt; if(w.s<0||w.s>w.path.len){ w.dir=-w.dir; w.s=clamp(w.s,0,w.path.len); } }
      const a=pathAt(w.path,w.s); if(speed>0) w.yaw=Math.atan2(a.dx*w.dir,a.dz*w.dir);
      const x=a.x-a.dz*w.off, z=a.z+a.dx*w.off, run=w.fr>0||w.greet>0, sw=speed>0?Math.sin(w.ph+w.wk*(run?2.2:3.1))*(run?1.15:0.6):0, bob=Math.abs(sw)*0.05+(w.hop>0?Math.sin(w.hop/0.4*3.1416)*0.38:0);
      w.x=x; w.z=z; M.makeRotationY(w.yaw); M.setPosition(x,0.25+bob,z);
      for(const pt of P.parts){ if(pt.sw){ Lm.makeRotationX(run&&Math.abs(pt.px)>0.2?-2.3-sw*pt.sw*0.35+(w.greet>0?0.35*Math.sin(t*9+i):0):sw*pt.sw); Lm.setPosition(pt.px,pt.py,0); O.multiplyMatrices(M,Lm); pt.mesh.setMatrixAt(i,O); } else pt.mesh.setMatrixAt(i,M); } }
    for(const pt of P.parts) pt.mesh.instanceMatrix.needsUpdate=true; }
  const C=U.cars;
  if(C){ const M=U.m4, Lm=U.l4, O=U.o;
    C.list.forEach((c,i)=>{ c.s+=c.dir*c.sp*dt; if(c.s<0||c.s>c.path.len){ c.dir=-c.dir; c.s=clamp(c.s,0,c.path.len); }
      if(c.px!==undefined&&(c.px-cam.x)**2+(c.pz-cam.z)**2>450*450) return;
      const a=pathAt(c.path,c.s), hx=a.dx*c.dir, hz=a.dz*c.dir; c.px=a.x; c.pz=a.z; // drive on the right-hand side: right = (-hz, hx)
      M.makeRotationY(Math.atan2(hx,hz)); M.setPosition(a.x-hz*2.0,0.28,a.z+hx*2.0); C.body.setMatrixAt(i,M); });
    C.body.instanceMatrix.needsUpdate=true; }
  updateCampusLife(dt,t,cam,bp);
  updateLabels(dt);
}


/* ---------- time of day and weather (city maps) ---------- */
const ENV={mode:'native',weather:'clear',hour:12,acc:9};
const TOD_HOURS={morning:8,noon:12,golden:17.8,dusk:19.4,night:23};
const TOD_KEYS=[ // hour, sky top, horizon, bottom, hemisphere sky, hemisphere ground, hemisphere intensity, fog
  [0,'#040816','#10182f','#080c18','#34508f','#1a2038',1.0,'#16203f'],[5,'#050a1c','#1a2447','#0a0f1e','#34508f','#1a2038',1.0,'#18244a'],
  [6.3,'#3a4f86','#f0a07a','#5a4a58','#7a86b0','#4a4048',0.8,'#c89a8a'],[8,'#5a8fd0','#f2dcc0','#cdbfae','#cfdcf0','#8a8068',1.15,'#e6dccb'],
  [12,'#3f86d9','#dcefff','#b4d6ee','#d4e9ff','#8a8a74',1.3,'#cfe3f2'],[16,'#4585d0','#e6eef2','#bcd0e0','#d6e4f4','#8a8470',1.25,'#d8e4ea'],
  [18,'#4a6fb8','#ffc890','#b88a6a','#e0b890','#6a5a4a',1.0,'#f0c8a0'],[19.3,'#25356e','#e0775a','#4a3a52','#8a7aa0','#3a3040',1.0,'#9a7088'],
  [20.5,'#0a1230','#2a2f5a','#10162a','#34508f','#1a2038',0.95,'#1f2a52'],[24,'#040816','#10182f','#080c18','#34508f','#1a2038',1.0,'#16203f']];
const WX={clear:{oc:0,near:700,far:4200},overcast:{oc:0.55,near:500,far:3200},rain:{oc:0.8,near:120,far:1700},fog:{oc:0.6,near:20,far:650}};
const _ec=[0,0,0,0,0,0,0].map(()=>null); let _eg=null, _sc=null;
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
function applyEnv(){
  if(!W||!W.skyU) return;
  if(!_eg){ _eg=new T.Color(); _sc=[new T.Color(),new T.Color(),new T.Color(),new T.Color(),new T.Color(),new T.Color()]; }
  const wx=WX[ENV.weather]||WX.clear, grey=wx.oc, co=W.co, sf=W.scene.fog, tv=mode==='travel'?1.15:1;
  const sync=(hor,fog,sunC)=>{ const wu=W.waterU; if(wu){ wu.skyc.value.copy(hor); wu.fogC.value.copy(fog); wu.sunCol.value.copy(sunC); wu.fogNear.value=sf.near; wu.fogFar.value=sf.far; }
    if(W.horizonMat&&W.horizonBase){ const b=W.horizonBase; W.horizonMat.color.setRGB(Math.min(3,fog.r/Math.max(0.02,b.r)),Math.min(3,fog.g/Math.max(0.02,b.g)),Math.min(3,fog.b/Math.max(0.02,b.b))); } };
  if(!W.usc&&ENV.mode==='native'){ // the map's own sky, only the weather applies
    W.skyU.top.value.set(co.sky.top); W.skyU.hor.value.set(co.sky.hor); W.skyU.bot.value.set(co.sky.bot); W.skyU.stars.value=co.stars?1:0;
    W.sunDir.set(...co.sun.dir).normalize(); W.skyU.sunCol.value.set(co.sun.col); W.sun.color.set(co.sun.col); W.sun.intensity=co.sun.i*(1-0.65*grey);
    if(W.hemi){ W.hemi.color.set(co.hemi[0]); W.hemi.groundColor.set(co.hemi[1]); W.hemi.intensity=co.hemi[2]*(1+0.12*grey); }
    const clear=ENV.weather==='clear'; sf.color.set(co.fog[0]); if(!clear){ const l=(sf.color.r+sf.color.g+sf.color.b)/3; sf.color.lerp(_eg.setRGB(l,l,l),grey*0.6); }
    sf.near=clear?co.fog[1]:Math.min(co.fog[1],wx.near); sf.far=(clear?co.fog[2]:Math.min(co.fog[2],wx.far))*tv; W.scene.background.copy(sf.color);
    ENV.night=co.stars?1:0; if(W.glowMat) W.glowMat.emissiveIntensity=co.stars?2.2:0.2; sync(W.skyU.hor.value,sf.color,W.skyU.sunCol.value); return;
  }
  const h=ENV.mode==='native'?12:ENV.hour; let i=1; while(i<TOD_KEYS.length-1&&TOD_KEYS[i][0]<h) i++;
  const A=TOD_KEYS[i-1], B=TOD_KEYS[i], f=clamp((h-A[0])/(B[0]-A[0]),0,1);
  const mix=(k,out)=>{ out.set(A[k]).lerp(_eg.set(B[k]),f); const l=(out.r+out.g+out.b)/3; _eg.setRGB(l*0.92,l*0.95,l*1.0); out.lerp(_eg,grey); return out; };
  const top=mix(2-1,_sc[0]), hor=mix(2,_sc[1]), bot=mix(3,_sc[2]), hs=mix(4,_sc[3]), hg=mix(5,_sc[4]), fog=mix(7,_sc[5]);
  const a=(h-6)/12*Math.PI, el=Math.sin(a), dayf=sstep(0.0,0.35,el), nf=1-sstep(-0.05,0.12,el);
  const dir=W.sunDir; if(el>0.02) dir.set(Math.cos(a)*0.9,Math.max(el,0.06),-0.35).normalize(); else dir.set(0.35,0.6,0.3).normalize();
  W.skyU.top.value.copy(top); W.skyU.hor.value.copy(hor); W.skyU.bot.value.copy(bot); W.skyU.stars.value=Math.max(nf*(1-grey*0.8),co.stars?1:0);
  const sunC=W.skyU.sunCol.value; sunC.set('#ff8f4f').lerp(_eg.set('#fff1d6'),clamp(el*2.2,0,1)); if(nf>0.5) sunC.set('#9db4ff');
  W.sun.color.copy(sunC); W.sun.intensity=(3.0*dayf+1.4*nf)*(1-0.65*grey);
  if(W.hemi){ W.hemi.color.copy(hs); W.hemi.groundColor.copy(hg); W.hemi.intensity=(A[6]+(B[6]-A[6])*f)*(1+0.12*grey); }
  sf.color.copy(fog); sf.near=wx.near; sf.far=wx.far*tv; W.scene.background.copy(fog);
  const night=1-sstep(-0.02,0.22,el); if(W.nightU) W.nightU.value=night*(1-0.25*grey); if(W.lampMat) W.lampMat.emissiveIntensity=0.12+2.6*night; if(W.glowMat) W.glowMat.emissiveIntensity=0.2+2.2*night;
  ENV.night=night; sync(hor,fog,sunC);
}
function envSet(mode,wx,save){
  ENV.mode=(mode in TOD_HOURS)||mode==='cycle'||mode==='native'?mode:'native'; ENV.weather=WX[wx]?wx:'clear'; if(ENV.mode!=='cycle') ENV.hour=TOD_HOURS[ENV.mode]??12;
  if($('rTod')) $('rTod').value=ENV.mode; if($('rWeather')) $('rWeather').value=ENV.weather; applyEnv();
  if(save){ try{ localStorage.setItem('emgPosture.env2',JSON.stringify({m:ENV.mode,w:ENV.weather,h:ENV.hour})); }catch{} }
}
function envLoad(){ try{ const p=JSON.parse(localStorage.getItem('emgPosture.env2')||'{}'); if(p.m) ENV.mode=p.m; if(p.w) ENV.weather=p.w; if(typeof p.h==='number') ENV.hour=p.h; }catch{} envSet(ENV.mode,ENV.weather); if(ENV.mode==='cycle'&&typeof ENV.hour!=='number') ENV.hour=12; }
function updateEnv(dt){
  if(ENV.mode==='cycle'){ ENV.hour=(ENV.hour+dt*0.0667)%24; ENV.acc+=dt; if(ENV.acc>0.3){ ENV.acc=0; applyEnv(); if(Math.floor(ENV.hour*4)%8===0) try{ localStorage.setItem('emgPosture.env2',JSON.stringify({m:ENV.mode,w:ENV.weather,h:ENV.hour})); }catch{} } }
}
function buildRain(){
  const n=1500, pos=new Float32Array(n*6), seed=new Float32Array(n*3); for(let i=0;i<n;i++){ seed[i*3]=(Math.random()-0.5)*130; seed[i*3+1]=Math.random()*70; seed[i*3+2]=(Math.random()-0.5)*130; }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); const m=new T.LineBasicMaterial({color:'#d4e4ff',transparent:true,opacity:0.5,fog:false,depthWrite:false}); W.ownMats.push(m);
  const l=new T.LineSegments(g,m); l.frustumCulled=false; l.visible=false; l.renderOrder=15; W.scene.add(l); W.rain={l,seed,pos,n,g};
}
function updateRain(dt){
  const Rn=W.rain; if(!Rn) return; const on=ENV.weather==='rain'; Rn.l.visible=on; if(!on) return;
  const c=R.camera.position, v=34, p=Rn.pos, s=Rn.seed; Rn.l.position.set(c.x,c.y-30,c.z);
  for(let i=0;i<Rn.n;i++){ let y=s[i*3+1]-v*dt; if(y<0) y+=70; s[i*3+1]=y; const x=s[i*3], z=s[i*3+2], k=i*6; p[k]=x; p[k+1]=y; p[k+2]=z; p[k+3]=x-0.7; p[k+4]=y+2.2; p[k+5]=z-0.3; }
  Rn.g.attributes.position.needsUpdate=true;
}

/* ---------- missions (travel mode, city maps): fly through glowing rings, beat the medal times ---------- */
const MISSIONS={
  usc:[{id:'tour',name:'Trojan Tour',desc:'Fly through the ring over each landmark, in order.',stops:['Tommy Trojan','Bovard Administration Building','Leavey Library','Galen Center','Los Angeles Memorial Coliseum'],medals:[200,280,400]},
       {id:'hoops',name:'Street Run',desc:'Weave through 10 rings above the main road.',hoops:10,medals:[100,140,210]}],
  la:[{id:'tour',name:'Skyscraper Tour',desc:'Circle five of the best-known buildings downtown.',stops:['U.S. Bank Tower','Wilshire Grand Center','Aon Center','Cathedral of Our Lady of the Angels','Bradbury Building'],medals:[240,330,460]},
      {id:'hoops',name:'Downtown Run',desc:'Weave through 10 rings above a main street.',hoops:10,medals:[100,140,210]}]};
let MS=null; const MEDAL=['🥇 Gold','🥈 Silver','🥉 Bronze'];
function missionBest(){ try{ return JSON.parse(localStorage.getItem('emgPosture.missions')||'{}'); }catch{ return {}; } }
function buildMissionRings(){
  const mk=(col,op)=>{ const m=new T.MeshBasicMaterial({color:col,transparent:true,opacity:op,fog:false,depthWrite:false,side:T.DoubleSide}); W.ownMats.push(m); const g=new T.Mesh(new T.TorusGeometry(1,0.07,8,36),m); g.visible=false; g.renderOrder=12; W.scene.add(g); return g; };
  W.mring={cur:mk('#3ecf8e',0.9),next:mk('#bff0d6',0.35)};
}
function missionStops(def){
  const out=[];
  if(def.stops){ for(const n of def.stops){ const L=W.lms.find(l=>l.n===n); if(L) out.push({x:L.x,z:L.z,y:Math.max(L.y+30,50),r:30,label:n,ry:0}); } }
  else { let best=null; for(const r of U.D.r){ if(r.t!=='primary'&&r.t!=='secondary') continue; if(!inReg(r.p[0],r.p[1],160)) continue; const P=mkPath(r.p); if(!best||P.len>best.len) best=P; }
    if(best){ const n=def.hoops; for(let i=0;i<n;i++){ const s=best.len*(0.08+0.84*i/(n-1)), a=pathAt(best,s), x=a.x, z=a.z, b=bAt(x,z); out.push({x,z,y:Math.max(groundAt(x,z)+26,(b?b.h:0)+14),r:14,label:`Ring ${i+1}`,ry:Math.atan2(a.dx,a.dz)}); } } }
  for(let i=0;i<out.length;i++){ const n=out[i+1]||out[i-1]; if(!out[i].ry&&n) out[i].ry=Math.atan2(n.x-out[i].x,n.z-out[i].z); }
  return out;
}
function startMission(id){
  if(mode!=='travel'||!W||!W.usc){ msg('Missions run in Travel mode on a city map.',true); return; }
  const def=(MISSIONS[W.co.id]||[]).find(m=>m.id===id); if(!def) return; const stops=missionStops(def); if(stops.length<2){ msg('That mission could not be set up here.',true); return; }
  MS={def,stops,idx:0,t0:performance.now(),done:false,medal:-1,time:0}; banner={t:`${def.name}: go!`,until:performance.now()+1600,c:'#b9f0cf'}; renderMissions();
}
function stopMission(){ MS=null; if(W&&W.mring){ W.mring.cur.visible=false; W.mring.next.visible=false; } renderMissions(); }
function updateMission(dt,now){
  const rg=W.mring; if(!rg) return; if(!MS||MS.done||mode!=='travel'){ rg.cur.visible=false; rg.next.visible=false; return; }
  const r=me.r, s=MS.stops[MS.idx], t=Math.sin(now/260)*0.05+1;
  const d=Math.hypot(r.pos.x-s.x,r.pos.y-s.y,r.pos.z-s.z);
  if(d<s.r){ MS.idx++; chime();
    if(MS.idx>=MS.stops.length){ MS.done=true; MS.time=(now-MS.t0)/1000; const m=MS.def.medals; MS.medal=MS.time<=m[0]?0:MS.time<=m[1]?1:MS.time<=m[2]?2:-1;
      const all=missionBest(), key=W.co.id+':'+MS.def.id, prev=all[key]; if(!prev||MS.time<prev.t){ all[key]={t:+MS.time.toFixed(2),m:MS.medal}; try{ localStorage.setItem('emgPosture.missions',JSON.stringify(all)); }catch{} }
      banner={t:`${MS.def.name} done in ${fmtT(MS.time)}${MS.medal>=0?' · '+MEDAL[MS.medal]:''}`,until:now+5000,c:'#ffe45e'}; rg.cur.visible=false; rg.next.visible=false; renderMissions(); return; }
    banner={t:`${MS.idx}/${MS.stops.length}`,until:now+700,c:'#b9f0cf'}; }
  const c=MS.stops[MS.idx], nx=MS.stops[MS.idx+1];
  rg.cur.visible=true; rg.cur.position.set(c.x,c.y,c.z); rg.cur.rotation.set(0,c.ry,0); rg.cur.scale.setScalar(c.r*t);
  if(nx){ rg.next.visible=true; rg.next.position.set(nx.x,nx.y,nx.z); rg.next.rotation.set(0,nx.ry,0); rg.next.scale.setScalar(nx.r); } else rg.next.visible=false;
}
function renderMissions(){
  const box=$('rMissions'), pn=$('rMissionPanel'); if(!box||!pn) return; box.replaceChildren();
  const list=W&&W.usc?(MISSIONS[W.co.id]||[]):[]; pn.hidden=mode!=='travel'||!list.length; if(pn.hidden) return;
  const best=missionBest();
  for(const m of list){ const d=document.createElement('div'); d.style.margin='6px 0'; const b=best[W.co.id+':'+m.id];
    const t=document.createElement('b'); t.textContent=m.name; d.append(t,document.createTextNode(` · ${m.desc} Gold ${fmtT(m.medals[0]).slice(0,-3)}. ${b?`Best ${fmtT(b.t)}${b.m>=0?' '+MEDAL[b.m]:''}.`:'Not flown yet.'} `));
    const bt=document.createElement('button'); bt.textContent=MS&&MS.def===m&&!MS.done?'Restart':'Start'; bt.onclick=()=>startMission(m.id); d.append(bt); box.append(d); }
  if(MS){ const s=document.createElement('button'); s.textContent='Stop mission'; s.onclick=stopMission; box.append(s); }
}
function drawMissionHud(g,Wv,Hv,now){
  if(!MS) return; const r=me.r, bw=300, x=Wv/2-bw/2, y=96, s=MS.stops[Math.min(MS.idx,MS.stops.length-1)];
  panel(g,x,y,bw,MS.done?64:70,0.55); g.textAlign='center'; g.fillStyle='#b9f0cf'; g.font='700 13px "DM Sans",system-ui'; g.fillText(MS.def.name.toUpperCase(),Wv/2,y+18);
  if(MS.done){ g.fillStyle='#ffe45e'; g.font='800 20px "DM Sans",system-ui'; g.fillText(`${fmtT(MS.time)}${MS.medal>=0?'  '+MEDAL[MS.medal]:''}`,Wv/2,y+44); g.font='500 12px "DM Sans",system-ui'; g.fillStyle='#cfd6e0'; g.fillText('Press M to fly it again',Wv/2,y+60); g.textAlign='left'; return; }
  const d=Math.hypot(r.pos.x-s.x,r.pos.y-s.y,r.pos.z-s.z), m=MS.def.medals, el=(now-MS.t0)/1000;
  g.fillStyle='#fff'; g.font='700 17px "DM Sans",system-ui'; g.fillText(`${s.label}  ·  ${d>=1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'}`,Wv/2,y+42);
  g.font='600 13px "DM Sans",system-ui'; g.fillStyle=el<=m[0]?'#ffe45e':el<=m[1]?'#dfe6ee':el<=m[2]?'#e0a070':'#ff9a8a'; g.fillText(`${fmtT(el)}   ·   stop ${MS.idx+1}/${MS.stops.length}`,Wv/2,y+60); g.textAlign='left';
}

/* ---------- flex calibration inside the game (uses the Flex intensity tab's guided routine) ---------- */
function calFlex(){
  const F=window.EMG?.flexCal; if(!F){ msg('Flex calibration is not available.',true); return; }
  if(F.state()){ F.stop(); msg('Calibration stopped.'); return; }
  if(document.fullscreenElement) { /* the routine speaks and beeps; the overlay is drawn on the game view */ }
  F.start(); msg(F.state()?'Calibrating: follow the cues on the game view. It takes about a minute.':'Connect the ESP32 or start the demo signal first.',!F.state());
}
function drawCalOverlay(g,Wv,Hv,now,fx){
  const C=window.EMG?.flexCal?.state(); if(!C) return; const el=now/1000-C.t0-C.lead, tot=C.plan.length*C.dur, bw=420, x=Wv/2-bw/2, y=Hv*0.44;
  panel(g,x-14,y-30,bw+28,130,0.7); g.textAlign='center'; g.fillStyle='#b9f0cf'; g.font='700 13px "DM Sans",system-ui'; g.fillText('FLEX CALIBRATION',Wv/2,y-8);
  const tgt=el<0?0:C.plan[Math.min(C.plan.length-1,Math.floor(el/C.dur))], left=el<0?-el:C.dur-(el%C.dur);
  g.fillStyle='#fff'; g.font='800 24px "DM Sans",system-ui'; g.fillText(el<0?`Get ready. Relax… ${Math.ceil(-el)}`:tgt===0?'Relax':`Flex to ${Math.round(tgt*100)}%`,Wv/2,y+28);
  g.fillStyle='#1a2230'; g.beginPath(); g.roundRect(x,y+44,bw,18,9); g.fill();
  g.fillStyle='rgba(127,255,176,.35)'; g.fillRect(x+bw*Math.max(0,tgt-0.06),y+44,bw*0.12,18);
  const gr=g.createLinearGradient(x,0,x+bw,0); gr.addColorStop(0,'#3ecf8e'); gr.addColorStop(0.6,'#f0c040'); gr.addColorStop(1,'#ff5d5d'); g.fillStyle=gr; g.beginPath(); g.roundRect(x,y+44,Math.max(0.001,bw*(fx.L||0)),18,9); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.moveTo(x+bw*tgt,y+40); g.lineTo(x+bw*tgt,y+66); g.stroke();
  g.fillStyle='#aab4c2'; g.font='500 12px "DM Sans",system-ui'; g.fillText(`${Math.max(0,Math.ceil(left))} s in this step · step ${Math.max(1,Math.min(C.plan.length,Math.floor(Math.max(0,el)/C.dur)+1))}/${C.plan.length} · press F to cancel`,Wv/2,y+86);
  g.fillStyle='#2a3240'; g.fillRect(x,y+94,bw,5); g.fillStyle='#6fd39b'; g.fillRect(x,y+94,bw*clamp(el/tot,0,1),5); g.textAlign='left';
}

/* ---------- fullscreen, the eye-friendly menu and hand gestures ----------
   In fullscreen only the game view is visible, so everything an eye user needs lives inside it: a big "Menu" button in the corner (look at it for a second, or tap
   while looking at it) opens a full-screen menu of large buttons. While the menu is open steering stops and gaze selects buttons by region, with dwell clicking switched on. */
let menuOpen=false, menuDwell=0;
const fsOn=()=>document.fullscreenElement===$('rWrap');
function toggleFs(){ const el=$('rWrap'); if(document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.({navigationUI:'hide'}).catch(()=>{}); }
function menuAvail(){ return EMG().activeTab()==='tabRace'&&(mode==='travel'||phase==='free'); }
function gazeInHot(){ if(!fsOn()||!window.EyeControl?.running?.()) return false; const g=gazeNow(); if(!g) return false;
  const b=$('rMenuBtn').getBoundingClientRect(), dx=Math.max(b.left-g.x,0,g.x-b.right), dy=Math.max(b.top-g.y,0,g.y-b.bottom); return Math.hypot(dx,dy)<Math.max(30,(g.r||80)*0.5); }
function openMenu(){ if(!menuAvail()) return; menuOpen=true; $('rMenu').hidden=false; window.EyeControl?.forceDwell?.(true); refreshMenu(); }
function closeMenu(){ menuOpen=false; $('rMenu').hidden=true; window.EyeControl?.forceDwell?.(false); }
const TODS=['native','noon','morning','golden','dusk','night','cycle'], WXS=['clear','overcast','rain','fog'];
function refreshMenu(){
  const set=(id,t,sub)=>{ const b=$(id); b.replaceChildren(document.createTextNode(t)); if(sub){ const s=document.createElement('small'); s.textContent=sub; b.append(s); } };
  const first=W&&W.usc?(MISSIONS[W.co.id]||[])[0]:null, hv=$('rHand').value;
  set('rmCam','Camera',['Chase','Wide','Side'][camMode]); set('rmMission',MS&&!MS.done?'Stop mission':'Start mission',first?first.name:'city maps only');
  set('rmTod','Time of day',ENV.mode); set('rmWx','Weather',ENV.weather); set('rmHand','Hand gestures',hv==='off'?'off':hv==='both'?'steer + flap':'flap only'); set('rmNeutral','Hand neutral','set where centre is');
  set('rmSound','Sound',$('rSound').checked?'on':'off'); set('rmHud','HUD',hideHud?'hidden':'shown'); set('rmAuto','Dwell click',$('eyDwell')?.checked?'on':'off');
  set('rmResume','Resume','back to flying'); set('rmExit','Exit fullscreen'); set('rmEyeCal','Calibrate eyes','13 dots'); set('rmCenter','Re-center gaze','look at the middle'); set('rmFlex','Calibrate flex'); set('rmCall','Bird call'); set('rmPhoto','Photo');
}
function wireFsUi(){
  const on=(id,fn)=>{ $(id).onclick=()=>{ fn(); if(menuOpen) refreshMenu(); }; };
  on('rmResume',closeMenu); on('rmExit',()=>{ closeMenu(); document.exitFullscreen?.(); });
  on('rmCam',()=>{ camMode=(camMode+1)%3; });
  on('rmMission',()=>{ if(MS&&!MS.done){ stopMission(); } else if(W&&W.usc&&mode==='travel'){ closeMenu(); startMission(MISSIONS[W.co.id][0].id); } else banner={t:'Missions run on the USC and LA maps',until:performance.now()+1800,c:'#ffd27f'}; });
  on('rmTod',()=>{ envSet(TODS[(TODS.indexOf(ENV.mode)+1)%TODS.length],ENV.weather,true); }); on('rmWx',()=>{ envSet(ENV.mode,WXS[(WXS.indexOf(ENV.weather)+1)%WXS.length],true); });
  on('rmEyeCal',()=>{ const E=window.EyeControl; closeMenu(); if(E?.running()) E.calibrate(); else banner={t:'Start eye tracking first',until:performance.now()+1800,c:'#ffd27f'}; });
  on('rmCenter',()=>{ closeMenu(); banner={t:'Look at the middle of the screen',until:performance.now()+1900,c:'#b9f0cf'}; setTimeout(()=>{ const rc=$('raceCanvas').getBoundingClientRect(); if(window.EyeControl?.recenter?.(rc.left+rc.width/2,rc.top+rc.height*0.46)) banner={t:'Gaze re-centered',until:performance.now()+1200,c:'#b9f0cf'}; },1900); });
  on('rmHand',()=>{ const s=$('rHand'); s.value={off:'both',both:'flap',flap:'off'}[s.value]; s.onchange(); });
  on('rmNeutral',()=>{ closeMenu(); banner={t:'Hold your hand in the neutral spot',until:performance.now()+1700,c:'#b9f0cf'}; setTimeout(()=>{ if(window.HandControl?.setNeutral()) banner={t:'Neutral set',until:performance.now()+1000,c:'#b9f0cf'}; },1700); });
  on('rmFlex',()=>{ closeMenu(); calFlex(); }); on('rmCall',()=>interactCall(0.85,false)); on('rmPhoto',()=>{ closeMenu(); setTimeout(takePhoto,400); });
  on('rmSound',()=>{ $('rSound').checked=!$('rSound').checked; prefs(true); }); on('rmHud',()=>{ hideHud=!hideHud; }); on('rmAuto',()=>{ $('eyDwell').checked=!$('eyDwell').checked; });
  $('rFull').onclick=toggleFs;
  document.addEventListener('fullscreenchange',()=>{ const on_=fsOn(); $('rFull').textContent=on_?'Exit fullscreen':'Fullscreen (G)'; if(!on_) closeMenu();
    if(on_) banner={t:window.EyeControl?.running?.()?'Look at ☰ Menu in the corner for a second to open the menu':'Fullscreen · press O for the menu, G to exit',until:performance.now()+3200,c:'#ffffff'}; });
  window.addEventListener('handpinch',()=>{ if(mode==='travel'&&EMG().activeTab()==='tabRace') interactCall(0.85,false); });
  $('rHand').onchange=async()=>{ const v=$('rHand').value, H=window.HandControl; $('rHandRow').hidden=v==='off';
    if(!H){ $('rHand').value='off'; $('rHandRow').hidden=true; msg('Hand tracking is not available.',true); return; }
    if(v==='off'){ H.stop(); return; }
    if(!H.running()){ const ok=await H.start(); if(!ok){ $('rHand').value='off'; $('rHandRow').hidden=true; } } };
  $('rHandNeutral').onclick=()=>{ if(window.HandControl?.setNeutral()) msg('Neutral set where your hand is now.'); else msg('Show your hand to the camera first.',true); };
  $('rHandStop').onclick=()=>{ $('rHand').value='off'; $('rHand').onchange(); };
}
function updateFsUi(dt,now){
  $('rWrap').classList.toggle('eye-on',!!window.EyeControl?.running?.());
  const btn=$('rMenuBtn'); if(!fsOn()||menuOpen||!menuAvail()){ menuDwell=0; btn.style.removeProperty('--dwell'); return; }
  if(gazeInHot()) menuDwell+=dt; else menuDwell=Math.max(0,menuDwell-dt*2);
  btn.style.setProperty('--dwell',clamp(menuDwell,0,1).toFixed(2)); if(menuDwell>=1){ menuDwell=0; openMenu(); }
}
const handActive=()=>mode==='travel'&&ctrl!=='kb'&&$('rHand').value!=='off'&&!!window.HandControl?.running?.();
function handFlex(){ if(!handActive()) return 0; const s=HandControl.state(); return s.visible?clamp((s.open-0.08)/0.8,0,1)*0.9:0; }  // fist = glide, open hand = flap

/* ---------- interactive bird calls ----------
   B (tap = short call, hold = long calls), a click on the view, a hard flex or a hand pinch make your bird call. Shift lowers and Ctrl raises the pitch.
   Other birds answer from the side they are on, people on the ground look up and wave, and pigeons scatter. */
let callHoldAt=0, callHoldLast=0;
function addRipple(pan,own){ (W.ripples||(W.ripples=[])).push({t0:performance.now(),pan,own}); if(W.ripples.length>12) W.ripples.shift(); }
function interactCall(vol=0.85,long=false){
  if(!AU.ctx||!me.r||!soundOn()) return;
  callNow(vol*(0.75+0.5*(me.r.flex||0)),{long,rate:keys.shift?0.8:keys.control?1.25:undefined}); addRipple(0,true); sendEmote('📣','call'); scheduleReplies(); callReact(long);
}
function scheduleReplies(){
  const prof=SND[W.co.id]||SND.coast, others=[...remotes.values()].map(x=>x.r).filter(Boolean).concat(racers.filter(x=>!x.isMe)), n=1+Math.floor(Math.random()*2);
  for(let i=0;i<n;i++){
    const delay=900+Math.random()*1700+i*850, near=others.length&&Math.random()<0.5?others[Math.floor(Math.random()*others.length)]:null;
    const kind=me.c, pan=rr(-0.9,0.9), vol=0.14+Math.random()*0.2;
    setTimeout(()=>{ if(!soundOn()||phase==='countdown') return; playCall(kind,vol,pan,0.35+prof.mix); addRipple(pan,false); },delay);
  }
}
function callReact(long){
  if(!W||!W.usc||!me.r) return; const p=me.r.pos, R2=(long?60:42)**2;
  if(U.people) for(const w of U.people.list){ const dx=(w.x||0)-p.x, dz=(w.z||0)-p.z; if(w.x!==0&&dx*dx+dz*dz<R2&&p.y<70&&w.fr<=0) w.greet=2.2+Math.random()*1.2; } // people look up and wave
  scatterPigeons(p.x,p.z,long?70:50);
}
function drawRipples(g,Wv,Hv,now){
  const L=W.ripples; if(!L||!L.length) return; W.ripples=L.filter(r=>now-r.t0<1500);
  for(const r of W.ripples){ const a=(now-r.t0)/1500;
    if(r.own){ const v=sv('rp').copy(me.r.pos).project(R.camera); if(v.z>1) continue; const x=(v.x*0.5+0.5)*Wv, y=(-v.y*0.5+0.5)*Hv; g.lineWidth=2.5;
      for(let k=0;k<3;k++){ const aa=a-k*0.12; if(aa<0) continue; g.strokeStyle=`rgba(255,255,255,${0.6*(1-aa)})`; g.beginPath(); g.arc(x,y-6,20+aa*160,0,Math.PI*2); g.stroke(); } }
    else { const side=r.pan<0?-1:1, x=side<0?34:Wv-34, y=Hv*0.5; g.lineWidth=3; for(let k=0;k<3;k++){ const aa=a*1.3-k*0.15; if(aa<0||aa>1) continue; g.strokeStyle=`rgba(255,226,140,${0.8*(1-aa)})`; g.beginPath(); g.arc(x,y,10+aa*40,side<0?-0.9:Math.PI-0.9,side<0?0.9:Math.PI+0.9,side>0); g.stroke(); } }
  }
}

/* ---------- life on campus: pigeons that scatter, cyclists, flags ---------- */
let _og=null;
function buildUscPigeons(q,rnd){
  const pts=[]; for(const n in U.D.pl){ const p=U.D.pl[n]; for(let i=0;i<7;i++) pts.push([p[0]+(rnd()-0.5)*40,p[1]+(rnd()-0.5)*40]); }
  for(const r of U.D.r){ if(r.t!=='pedestrian') continue; walkPath(r.p,70,rnd,(x,z)=>{ if(rnd()<0.5) for(let i=0;i<3;i++) pts.push([x+(rnd()-0.5)*8,z+(rnd()-0.5)*8]); }); }
  const N=q.trees>=2400?90:q.trees>=1500?60:24, list=[]; for(let a=0;a<900&&list.length<N&&pts.length;a++){ const p=pts[Math.floor(rnd()*pts.length)]; if(!inReg(p[0],p[1],10)||bAt(p[0],p[1])) continue; list.push({hx:p[0],hz:p[1],x:p[0],z:p[1],y:0,vx:0,vz:0,st:0,t:0,ph:rnd()*6.28,yaw:rnd()*6.28,tx:0,tz:0}); }
  if(!list.length) return; _og=new T.Object3D();
  const geo=kit([['sph8',0,0.08,0,0.26,0.2,0.42,'#8b929c'],['sph8',0,0.26,0.19,0.14,0.14,0.14,'#5f6772'],['sph8',0,0.2,0.13,0.17,0.1,0.1,'#3f9b86'],['box',0,0.1,-0.28,0.12,0.03,0.2,'#5f6772'],['box',-0.15,0.15,0,0.05,0.03,0.3,'#737b86'],['box',0.15,0.15,0,0.05,0.03,0.3,'#737b86'],['box',0,0.25,0.29,0.03,0.03,0.06,'#d9b070']]);
  const m=new T.InstancedMesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:0.8}),list.length), cc=new T.Color(); W.ownMats.push(m.material);
  list.forEach((p,i)=>{ cc.setRGB(0.8+rnd()*0.35,0.8+rnd()*0.35,0.8+rnd()*0.35); m.setColorAt(i,cc); }); m.frustumCulled=false; W.scene.add(m); U.pigeons={list,m};
}
function startlePigeon(p,fx,fz){ const dx=p.x-fx, dz=p.z-fz, l=Math.hypot(dx,dz)||1; p.vx=dx/l*5+(Math.random()-0.5)*3; p.vz=dz/l*5+(Math.random()-0.5)*3; p.st=1; p.t=0; p.tx=p.hx+(Math.random()-0.5)*26; p.tz=p.hz+(Math.random()-0.5)*26; if(bAt(p.tx,p.tz)||!inReg(p.tx,p.tz,10)){ p.tx=p.hx; p.tz=p.hz; } }
function scatterPigeons(x,z,r){ if(!U||!U.pigeons) return; let n=0; for(const p of U.pigeons.list) if(p.st===0&&(p.x-x)**2+(p.z-z)**2<r*r){ startlePigeon(p,x,z); n++; } if(n&&AU.ctx&&soundOn()) noiseBurst(2400,0.35,0.05+Math.min(0.06,n*0.004)); } // wing clatter
function updatePigeons(dt,t,cam,bp){
  const G=U.pigeons; if(!G) return; const o=_og;
  for(let i=0;i<G.list.length;i++){ const p=G.list[i], dxc=p.x-cam.x, dzc=p.z-cam.z; if(dxc*dxc+dzc*dzc>260*260) continue;
    if(p.st===0){ const dx=p.x-bp.x, dz=p.z-bp.z; if(dx*dx+dz*dz<15*15&&bp.y<32) startlePigeon(p,bp.x,bp.z); }
    let flap=1, peck=0;
    if(p.st===1){ p.t+=dt; const k=p.t; flap=1+0.22*Math.sin(t*45);
      if(k<1.2){ p.y=Math.min(9,k*6); } else if(k<4){ p.y=8+Math.sin(k*2)*0.6; p.vx+=(p.tx-p.x)*0.2*dt; p.vz+=(p.tz-p.z)*0.2*dt; const sp=Math.hypot(p.vx,p.vz)||1, mx=5.5; if(sp>mx){ p.vx*=mx/sp; p.vz*=mx/sp; } }
      else { p.y=Math.max(0,8*(1-(k-4)/1.6)); p.vx+=(p.tx-p.x)*0.8*dt; p.vz+=(p.tz-p.z)*0.8*dt; p.vx*=0.96; p.vz*=0.96; if(k>5.6){ p.st=0; p.y=0; p.x=p.tx; p.z=p.tz; p.hx=p.x; p.hz=p.z; p.vx=p.vz=0; } }
      p.x+=p.vx*dt; p.z+=p.vz*dt; if(Math.abs(p.vx)+Math.abs(p.vz)>0.5) p.yaw=Math.atan2(p.vx,p.vz); }
    else peck=Math.max(0,Math.sin(t*2.2+p.ph))*0.5;
    o.position.set(p.x,0.25+p.y+(p.st===0?Math.abs(Math.sin(t*3+p.ph))*0.012:0),p.z); o.rotation.set(peck,p.yaw,0,'YXZ'); o.scale.set(1,flap,1); o.updateMatrix(); G.m.setMatrixAt(i,o.matrix);
  }
  G.m.instanceMatrix.needsUpdate=true;
}
function bikeKit(){ return kit([['box',0,0.04,0.55,0.05,0.62,0.62,'#202020'],['box',0,0.04,-0.55,0.05,0.62,0.62,'#202020'],['box',0,0.34,0,0.05,0.05,1.1,'#444a52'],['box',0,0.34,0.32,0.05,0.5,0.05,'#444a52'],['box',0,0.68,-0.1,0.3,0.55,0.2,'#ffffff'],['sph8',0,1.36,-0.05,0.22,0.24,0.22,'#e8c9a8'],['box',0,0.6,0.2,0.22,0.08,0.5,'#2b3a55'],['box',0,1.0,0.3,0.06,0.06,0.3,'#444a52']]); }
function buildUscBikes(q,rnd){
  const paths=[]; for(const r of U.D.r){ if(!(r.t==='pedestrian'||r.t==='footway'||r.t==='residential')||!inReg(r.p[0],r.p[1],120)) continue; const P=mkPath(r.p); if(P.len>=90) paths.push(P); }
  if(!paths.length) return; const N=q.trees>=2400?26:q.trees>=1500?16:6, list=[], CC=['#c0392b','#2f6bb0','#f2f2ee','#3f8a5a','#e08a2b','#8a6bb8','#ffcc00'];
  for(let i=0;i<N;i++){ const P=paths[Math.floor(rnd()*paths.length)]; list.push({path:P,s:rnd()*P.len,dir:rnd()<0.5?-1:1,sp:3.8+rnd()*2.4,col:CC[Math.floor(rnd()*CC.length)]}); }
  const m=new T.InstancedMesh(bikeKit(),new T.MeshStandardMaterial({vertexColors:true,roughness:0.6}),N), cc=new T.Color(); W.ownMats.push(m.material); list.forEach((b,i)=>{ cc.set(b.col); m.setColorAt(i,cc); }); m.frustumCulled=false; W.scene.add(m); U.bikes={list,m};
}
function buildUscFlags(){
  if(W.co.id!=='usc') return; const rnd=mulberry32(77), spots=[]; // [x,z,baseY,poleLen,flagW]
  const bv=U.byName.get('Bovard Administration Building'), hp=U.D.pl['Hahn Plaza'];
  if(bv) spots.push([bv.cx+9,bv.cz+6,bv.hw,9,3.0]); if(hp) spots.push([hp[0]+10,hp[1]+6,0,10,3.0],[hp[0]-10,hp[1]-6,0,10,3.0]);
  // a flag on the roof of nearly every real building (kept near the roof edge, away from towers)
  for(const b of U.B){ if(b.area<380||b.k==='p'||b.h<8||!inReg(b.cx,b.cz,6)||b.name==='') continue; const ob=b.ob; if(!ob) continue;
    for(const sgn of (b.area>2500?[-1,1]:[1])){ const x=ob.cx+ob.ux*ob.hs*0.75*sgn-(-ob.uz)*ob.ht*0.55*sgn, z=ob.cz+ob.uz*ob.hs*0.75*sgn-(ob.ux)*ob.ht*0.55*sgn; if(pip(b.p,b.n,x,z)&&!b.hl.some(hh=>pip(hh,hh.length/2,x,z))) spots.push([x,z,b.h,5+Math.min(5,b.h*0.05),2.4]); } }
  // cardinal and gold street banners on poles along the main walks and roads
  for(const r of U.D.r){ if(r.t!=='pedestrian'&&r.t!=='tertiary'&&r.t!=='secondary'&&r.t!=='primary') continue;
    walkPath(r.p,r.t==='pedestrian'?36:55,rnd,(x,z,dx,dz)=>{ const sd=rnd()<0.5?-1:1, o=(r.t==='pedestrian'?5.6:ROAD_W[r.t]/2+2.0)*sd, px=x-dz*o, pz=z+dx*o; if(inReg(px,pz,10)&&!bAt(px,pz)) spots.push([px,pz,0,6.5,1.7]); }); }
  if(spots.length>420) spots.length=420;
  const n=spots.length; if(!n) return;
  const pole=new T.InstancedMesh(new T.CylinderGeometry(0.06,0.09,1,5),mat('#c9ccd0',{r:0.4,m:0.5}),n);
  const cg=new T.PlaneGeometry(1,0.62,10,3); cg.translate(0.5,0,0); // pole edge at x = 0, waves toward the tip
  const cv=document.createElement('canvas'); cv.width=256; cv.height=160; const g=cv.getContext('2d'); g.fillStyle='#990000'; g.fillRect(0,0,256,160); g.fillStyle='#ffcc00'; g.fillRect(0,0,256,12); g.fillRect(0,148,256,12);
  g.fillStyle='#ffcc00'; g.font='700 92px Georgia,serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SC',128,84); g.strokeStyle='#ffcc00'; g.lineWidth=3; g.strokeRect(10,22,236,116);
  const tx=new T.CanvasTexture(cv); tx.colorSpace=T.SRGBColorSpace; tx.anisotropy=4;
  const cm=new T.MeshStandardMaterial({map:tx,roughness:0.75,side:T.DoubleSide}); W.ownMats.push(cm);
  cm.onBeforeCompile=sh=>{ sh.uniforms.uTime=W.timeU; sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>','#include <begin_vertex>\n float wv=position.x; float ph=instanceMatrix[3].x*0.37+instanceMatrix[3].z*0.23; transformed.z+=sin(wv*7.0-uTime*4.5+ph)*0.09*wv; transformed.y+=sin(wv*5.0-uTime*3.1+ph)*0.03*wv;'); };
  cm.customProgramCacheKey=()=>'trojanFlag';
  const cloth=new T.InstancedMesh(cg,cm,n), o=new T.Object3D();
  spots.forEach(([x,z,y0,pl,fw],i)=>{ const yaw=0.5+Math.sin(x*0.013+z*0.017)*0.5;
    o.position.set(x,y0+pl/2,z); o.rotation.set(0,0,0); o.scale.set(1,pl,1); o.updateMatrix(); pole.setMatrixAt(i,o.matrix);
    o.position.set(x,y0+pl-fw*0.62*0.55,z); o.rotation.set(0,yaw,0); o.scale.set(fw,fw,fw); o.updateMatrix(); cloth.setMatrixAt(i,o.matrix); });
  pole.frustumCulled=false; cloth.frustumCulled=false; W.scene.add(pole,cloth); U.flags=[pole,cloth];
}
function updateCampusLife(dt,t,cam,bp){
  updatePigeons(dt,t,cam,bp);
  const B=U.bikes; if(B){ const M=U.m4;
    B.list.forEach((b,i)=>{ b.s+=b.dir*b.sp*dt; if(b.s<0||b.s>b.path.len){ b.dir=-b.dir; b.s=clamp(b.s,0,b.path.len); }
      if(b.px!==undefined&&(b.px-cam.x)**2+(b.pz-cam.z)**2>330*330) return; const a=pathAt(b.path,b.s), hx=a.dx*b.dir, hz=a.dz*b.dir; b.px=a.x; b.pz=a.z;
      M.makeRotationY(Math.atan2(hx,hz)); M.setPosition(a.x-hz*0.9,0.28,a.z+hx*0.9); B.m.setMatrixAt(i,M); }); B.m.instanceMatrix.needsUpdate=true; }
  if(W.timeU) W.timeU.value=t;
}

/* ================= nature maps (Coastal Cliffs, Red Rock Canyon, Aurora Fjord) =================
   Same idea as the USC map: everything is painted or instanced, and only what is near the bird is drawn.
   Painted-card trees, grass and flowers; cacti and hoodoos; villages with solid houses, jetties and moored boats; sailing boats and ferries that wander the water;
   leaping dolphins and surfacing whales; sheep, deer, bighorn, mustangs and reindeer that run when a bird swoops; waterfalls; falling snow and blowing dust;
   dust devils; place labels for villages and peaks. Time of day and weather work here too (see applyEnv). */
function natPool(geo,material,items,radius,colored){
  const n=items.length, N=Math.max(1,n), o=new T.Object3D(), mats=new Float32Array(N*16), cols=colored?new Float32Array(N*3):null, xz=new Float32Array(N*2), cc=new T.Color();
  items.forEach((it,i)=>{ o.position.set(it.x,it.y||0,it.z); o.rotation.set(0,it.ry||0,0); const s=it.s||1; o.scale.set(it.sx||s,it.sy||s,it.sz||s); o.updateMatrix(); o.matrix.toArray(mats,i*16); xz[i*2]=it.x; xz[i*2+1]=it.z;
    if(cols){ cc.set(it.col||'#ffffff'); cols[i*3]=cc.r; cols[i*3+1]=cc.g; cols[i*3+2]=cc.b; } });
  const mesh=new T.InstancedMesh(geo,material,N); mesh.count=0; mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if(cols){ mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(N*3),3); mesh.instanceColor.setUsage(T.DynamicDrawUsage); }
  W.scene.add(mesh);
  const P={mesh,n,lx:1e9,lz:1e9,update(cx,cz,force){ if(!force&&Math.abs(cx-P.lx)+Math.abs(cz-P.lz)<14) return; P.lx=cx; P.lz=cz;
    const r2=radius*radius, A=mesh.instanceMatrix.array, C=cols?mesh.instanceColor.array:null; let k=0;
    for(let i=0;i<n;i++){ const dx=xz[i*2]-cx, dz=xz[i*2+1]-cz; if(dx*dx+dz*dz>r2) continue; const a=i*16, b=k*16; for(let j=0;j<16;j++) A[b+j]=mats[a+j]; if(C){ C[k*3]=cols[i*3]; C[k*3+1]=cols[i*3+1]; C[k*3+2]=cols[i*3+2]; } k++; }
    mesh.count=k; mesh.instanceMatrix.needsUpdate=true; if(C) mesh.instanceColor.needsUpdate=true; }};
  W.nat.pools.push(P); return P;
}
function pineTexture(rnd,snow){
  const c=document.createElement('canvas'); c.width=256; c.height=512; const g=c.getContext('2d');
  g.fillStyle='#4a3626'; g.fillRect(121,430,14,82);
  const pal=snow?['#1c3a2c','#264a37','#2f5a43','#3a6b50']:['#1b3a26','#24492f','#2d5a38','#3a6c43'], tiers=11;
  for(let i=0;i<tiers;i++){ const t=i/(tiers-1), y=440-t*400, w=(1-t)*105+14, h=70-t*20;
    for(let k=0;k<28;k++){ const x=128+(rnd()<0.5?-1:1)*rnd()*w, yy=y-rnd()*h*0.6+rnd()*10; g.fillStyle=pal[Math.floor(rnd()*pal.length)];
      g.beginPath(); g.moveTo(128+(x-128)*0.15,y-h); g.lineTo(x-15,yy+16); g.lineTo(x+15,yy+16); g.closePath(); g.fill(); }
    if(snow){ g.fillStyle='rgba(245,250,255,0.88)'; for(let k=0;k<14;k++){ const x=128+(rnd()<0.5?-1:1)*rnd()*w*0.9; g.beginPath(); g.ellipse(x,y-h*0.25+rnd()*8,10+rnd()*10,3+rnd()*2,0,0,6.283); g.fill(); } } }
  return c;
}
function grassTexture(rnd,pal,flowers){
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d'); g.lineCap='round';
  for(let i=0;i<46;i++){ const x=8+rnd()*112, h=18+rnd()*40, lean=(rnd()-0.5)*26; g.strokeStyle=pal[Math.floor(rnd()*pal.length)]; g.lineWidth=2+rnd()*2.2; g.beginPath(); g.moveTo(x,64); g.quadraticCurveTo(x+lean*0.3,64-h*0.55,x+lean,64-h); g.stroke(); }
  if(flowers) for(let i=0;i<9;i++){ g.fillStyle=flowers[Math.floor(rnd()*flowers.length)]; g.beginPath(); g.arc(10+rnd()*108,10+rnd()*30,2.6+rnd()*1.6,0,6.283); g.fill(); }
  return c;
}
function agaveTexture(rnd){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  for(let k=0;k<15;k++){ const a=-Math.PI*0.5+(k/14-0.5)*2.5, L=44+rnd()*20; g.fillStyle=['#5b8f6a','#6aa077','#4d8060'][k%3]; g.save(); g.translate(64,124); g.rotate(a+Math.PI/2); g.beginPath(); g.moveTo(-5,0); g.quadraticCurveTo(0,-L*0.6,0,-L); g.quadraticCurveTo(0,-L*0.6,5,0); g.fill(); g.restore(); }
  return c;
}
function natKits(){
  xInit(); const K={};
  // buildings: walls + roof + door + windows, colours baked into the vertices; the body and the (glowing) window kits share one placement
  const house=(w,d,h,wall,roof,rh,trim)=>{ const P=[['box',0,-2,0,w+0.4,2,d+0.4,'#7d776c'],['box',0,0,0,w,h,d,wall],['pyr',0,h,0,w*1.22,rh,d*1.2,roof],['box',w*0.25,h,-d*0.2,0.9,rh*0.9,0.9,trim||'#6e5f55'],['box',0,0,d/2+0.04,1.1,h*0.62,0.12,'#4a3426'],['box',-w/2-0.05,0,0,0.1,0.01,0.1,wall]];
    return P; };
  const wins=(w,d,h)=>{ const P=[]; for(const sx of [-1,1]) P.push(['box',sx*w*0.28,h*0.36,d/2+0.07,0.8,h*0.34,0.1,'#ffd98a']); P.push(['box',w/2+0.07,h*0.36,0,0.1,h*0.34,0.8,'#ffd98a'],['box',-w/2-0.07,h*0.36,0,0.1,h*0.34,0.8,'#ffd98a']); return P; };
  const dark=(w,d,h)=>{ const P=[]; for(const sx of [-1,1]) P.push(['box',sx*w*0.28,h*0.36,d/2+0.07,0.8,h*0.34,0.1,'#3a4650']); P.push(['box',w/2+0.07,h*0.36,0,0.1,h*0.34,0.8,'#3a4650'],['box',-w/2-0.07,h*0.36,0,0.1,h*0.34,0.8,'#3a4650']); return P; };
  K.houses={
    coast:[[8,6,4.2,'#f3efe6','#b8553a',2.6],[7,6.5,4.6,'#efe6d2','#3c6f9a',2.4],[9,6,4,'#e6c98e','#8c4a38',2.8],[6.5,6,5.2,'#f6f1e8','#a73f3a',2.6]].map(a=>({body:kit(house(...a).concat(dark(a[0],a[1],a[2]))),glow:null,h:a[2]+a[5]})),
    fjord:[[8,6,4.4,'#a8322e','#2c3138',2.2],[7,6,4.2,'#e2b43e','#2f343a',2.2],[8.5,6.5,4.6,'#ecece4','#3a3f46',2.4],[6.5,5.5,4.4,'#3d6f8e','#2c3138',2.2]].map(a=>({body:kit(house(...a)),glow:kit(wins(a[0],a[1],a[2])),h:a[2]+a[5]})),
    canyon:[[8,6,4.6,'#a9825a','#6b4a30',1.4],[7,6,5.4,'#b89368','#5d422b',1.2],[10,7,4.4,'#9c7a58','#6b4a30',1.6]].map(a=>({body:kit(house(...a).concat(dark(a[0],a[1],a[2]))),glow:null,h:a[2]+a[5]}))};
  K.church=kit([['box',0,0,0,8,6,14,'#efece4'],['pyr',0,6,0,9.4,4,15,'#8a4a3a'],['box',0,6,-6,3.4,9,3.4,'#efece4'],['pyr',0,15,-6,4.4,6.5,4.4,'#8a4a3a'],['box',0,0,7.05,1.6,3.4,0.12,'#5a4030']]);
  // boats
  K.sail=kit([['box',0,0,0,1.8,0.9,6.2,'#f5f2ea'],['box',0,0.9,-0.4,1.2,0.35,2.6,'#e4dccb'],['cyl',0,0.9,0.4,0.12,8,0.12,'#c8c4b8'],['box',0,2.2,-1.0,0.06,5.6,3.2,'#ffffff'],['box',0,2.0,1.6,0.06,4.4,1.6,'#f2dcc0'],['box',0,-0.3,0,1.2,0.5,5.4,'#2a4a6a']]);
  K.trawler=kit([['box',0,0,0,3.6,1.5,10,'#2f4a66'],['box',0,1.5,2.6,2.8,2.2,3.2,'#f1efe8'],['box',0,3.7,2.6,3,0.25,3.4,'#c9323a'],['cyl',0,1.5,-1.8,0.25,6,0.25,'#555a60'],['box',0,2.8,-3.4,0.2,0.2,3.8,'#555a60'],['box',0,1.6,3.6,2.4,0.9,0.2,'#ffd98a']]);
  K.ferry=kit([['box',0,0,0,12,3.2,44,'#e8edf2'],['box',0,3.2,2,10.4,3.4,32,'#f4f6f8'],['box',0,6.6,6,9,3,16,'#dfe5ea'],['box',0,9.6,8,6.5,2.6,8,'#cfd8e0'],['cyl',0,9.6,-8,2.4,5,2.4,'#c9323a'],['box',0,-0.6,0,10,1.2,42,'#23384e'],['box',0,4.2,10.2,10.6,0.9,0.2,'#ffd98a'],['box',0,4.2,-6.2,10.6,0.9,0.2,'#ffd98a'],['box',0,7.5,13.8,8,0.9,0.2,'#ffd98a']]);
  K.skiff=kit([['box',0,0,0,1.3,0.55,3.6,'#c9323a'],['box',0,0.55,-0.2,0.9,0.22,1.4,'#e8e2d4']]);
  // animals: bodies are boxes and legs; heading is +z
  const quad=(body,leg,len,h,head)=>kit([['box',0,h*0.55,0,len*0.34,h*0.4,len,body],['box',0,h*0.7,len*0.52,len*0.18,h*0.3,len*0.26,head||body],['box',0,h*0.95,len*0.6,len*0.12,h*0.12,len*0.12,head||body],...[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>['box',a*len*0.12,0,b*len*0.34,len*0.07,h*0.6,len*0.07,leg])]);
  K.sheep=kit([['box',0,0.36,0,0.62,0.55,0.95,'#efece4'],['box',0,0.46,0.55,0.26,0.3,0.3,'#3a3430'],...[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>['box',a*0.2,0,b*0.3,0.08,0.38,0.08,'#3a3430'])]);
  K.deer=quad('#9a6a44','#5a3f2a',1.5,1.15,'#a9794f');
  K.bighorn=kit([['box',0,0.6,0,0.62,0.7,1.35,'#9a7a5c'],['box',0,0.85,0.8,0.3,0.4,0.42,'#a98a6a'],['box',-0.2,1.12,0.78,0.1,0.34,0.5,'#e8e0d0'],['box',0.2,1.12,0.78,0.1,0.34,0.5,'#e8e0d0'],...[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>['box',a*0.18,0,b*0.46,0.1,0.65,0.1,'#6b5440'])]);
  K.horse=quad('#7a4a2c','#3a2a20',2.2,1.7,'#6a3f26');
  K.reindeer=kit([['box',0,0.72,0,0.7,0.78,1.5,'#b9b0a2'],['box',0,1.0,0.95,0.3,0.55,0.5,'#c8bfb0'],['box',-0.18,1.55,0.95,0.07,0.7,0.07,'#6b5a48'],['box',0.18,1.55,0.95,0.07,0.7,0.07,'#6b5a48'],['box',-0.3,1.95,0.95,0.3,0.07,0.07,'#6b5a48'],['box',0.3,1.95,0.95,0.3,0.07,0.07,'#6b5a48'],...[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>['box',a*0.2,0,b*0.5,0.1,0.75,0.1,'#6b5a48'])]);
  K.seal=kit([['sph',0,0.1,0,0.9,0.7,2.0,'#7b7f86'],['sph',0,0.3,1.0,0.5,0.45,0.55,'#868a91']]);
  K.dolphin=kit([['sph',0,0,0,0.9,0.9,3.4,'#6e7f8d'],['sph',0,-0.1,1.7,0.42,0.4,0.9,'#7e8f9d'],['box',0,0.5,-0.3,0.08,0.7,0.6,'#5a6975'],['box',0,0,-1.9,1.4,0.1,0.55,'#5a6975']]);
  K.whale=kit([['sph',0,0,0,4.4,3.8,15,'#2f3a46'],['sph',0,-0.5,5.6,3.6,3,6,'#3d4a58'],['sph',0,-0.7,-8.2,1.8,1.6,5,'#2a343f'],['box',0,0.4,-11,6.5,0.4,2.6,'#252e38'],['box',0,2.0,1.5,0.3,1.4,1.6,'#2a343f']]);
  // plants
  K.saguaro=kit([['cyl',0,0,0,1.1,8,1.1,'#477f4a'],['sph',0,8,0,1.1,0.9,1.1,'#4a8450'],['box',1.2,3.0,0,1.6,0.7,0.7,'#477f4a'],['cyl',1.9,3.0,0,0.7,3.4,0.7,'#4a8450'],['box',-1.1,4.6,0,1.4,0.7,0.7,'#477f4a'],['cyl',-1.7,4.6,0,0.7,2.6,0.7,'#4a8450']]);
  K.barrel=kit([['sph',0,0,0,1.1,1.0,1.1,'#5a8e52'],['sph',0,0.85,0,0.35,0.15,0.35,'#d8c24a']]);
  K.hoodoo=kit([['cyl',0,0,0,3.4,6,3.4,'#b5562f'],['cyl',0,6,0,2.4,5,2.4,'#c8693a'],['cyl',0,11,0,3.0,3.2,3.0,'#a94a2a'],['sph8',0,13.8,0,4.2,1.4,4.2,'#8a3a22']]);
  K.deadtree=kit([['cyl',0,0,0,0.5,5,0.5,'#6b5a48'],['box',0.9,3.2,0,1.8,0.22,0.22,'#6b5a48'],['box',-0.8,4.1,0,1.6,0.2,0.2,'#6b5a48']]);
  K.pole=kit([['cyl',0,0,0,0.32,13,0.32,'#5a4632'],['box',0,12,0,3.4,0.2,0.2,'#5a4632']]);
  K.tower=kit([['cyl',-2.4,0,-2.4,0.4,15,0.4,'#6a5640'],['cyl',2.4,0,-2.4,0.4,15,0.4,'#6a5640'],['cyl',-2.4,0,2.4,0.4,15,0.4,'#6a5640'],['cyl',2.4,0,2.4,0.4,15,0.4,'#6a5640'],['cyl',0,15,0,6.4,5,6.4,'#8a6a46'],['cone',0,20,0,7.2,2.4,7.2,'#4a3a2a']]);
  K.windpump=kit([['box',0,0,0,0.3,10,0.3,'#7a7e84'],['cyl',0,10,0,3,0.2,3,'#9aa0a6'],['box',0,10,0,0.2,3,0.2,'#b9bec4']]);
  K.cairn=kit([['sph8',0,0,0,2.2,1,2.2,'#8a8f95'],['sph8',0,0.8,0,1.5,0.9,1.5,'#9aa0a6']]);
  K.jetty=kit([['box',0,0,0,2.6,0.5,1,'#6b4a30']]);
  K.rowboat=kit([['box',0,0,0,1.1,0.4,2.6,'#2f5f8a'],['box',0,0.4,0,0.9,0.12,2.2,'#d8c49a']]);
  return K;
}
function wideLabel(name,col){
  const c=document.createElement('canvas'); c.width=640; c.height=112; const g=c.getContext('2d'); g.fillStyle='rgba(10,14,20,.6)'; g.beginPath(); g.roundRect(4,4,632,104,24); g.fill();
  let fs=58; g.font=`bold ${fs}px "DM Sans",system-ui,sans-serif`; while(g.measureText(name).width>590&&fs>26){ fs-=3; g.font=`bold ${fs}px "DM Sans",system-ui,sans-serif`; }
  g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=col; g.fillText(name,320,58);
  const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; return new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false,fog:false}));
}
function natPlaceNames(id){
  return {coast:{v:['Saltmarsh','Gull Cove','Pebble Quay','Little Skerry','Marram Bay','Tern Harbour'],p:['Cliff Head','Windward Tor','Gorse Down','Kestrel Hill']},
    canyon:{v:['Dry Wash Junction','Red Flats','Copper Gulch','Windmill Ranch'],p:['Anvil Mesa','Cinder Butte','Rattler Peak','Sunrise Mesa','Echo Spire']},
    fjord:{v:['Nordvik','Skjerhamn','Lysbotn','Havnes','Kaldfjord'],p:['Jotun Peak','Frostspire','Blue Horn','Storfjell','Ravnsnout']}}[id];
}
function buildNature(co,q){
  const rnd=mulberry32(co.seed*7+3), K=natKits(), id=co.id, ext=co.size*0.34, hi=q.trees>=2400, mid=q.trees>=1500;
  const N=W.nat={pools:[],anim:[],fauna:[],boats:[],cet:[],falls:[],labels:[],houses:0,K}, scale=hi?1:mid?0.65:0.3;
  const free=(x,z,m=26)=>{ for(let i=0;i<M;i+=8){ const p=W.tr.P[i]; if((p.x-x)**2+(p.z-z)**2<m*m&&heightAt(x,z)+18>p.y-TUBE) return false; } return true; };
  const lmFree=(x,z)=>W.lms.every(l=>(l.x-x)**2+(l.z-z)**2>60*60);
  const sample=(test,n,tries)=>{ const out=[]; for(let t=0;t<tries&&out.length<n;t++){ const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z); if(test(x,z,h)) out.push({x,z,h}); } return out; };
  const gaussCol=(base,j)=>{ const c=new T.Color(base); c.offsetHSL((rnd()-0.5)*j,0,(rnd()-0.5)*j*2); return '#'+c.getHexString(); };
  const lamb=tex=>{ const t=new T.CanvasTexture(tex); t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; const m=new T.MeshLambertMaterial({map:t,alphaTest:0.5,vertexColors:true}); W.ownMats.push(m); return m; };
  const kitMat=mat('#ffffff',{r:0.8,vc:true,flat:true});

  /* ---- vegetation: painted cards, drawn only near the bird ---- */
  const trees=[], bushes=[], grass=[], flowers=[], extra=[];
  const treeOK=(x,z,h,lo,hiH)=>{ if(h<lo||h>hiH) return false; if(slope(x,z,4)>2.4) return false; return free(x,z,TUBE+30)&&lmFree(x,z); };
  if(id==='coast'){
    for(const s of sample((x,z,h)=>treeOK(x,z,h,5,150),Math.round(3000*scale),42000)){ const w=7+rnd()*6; trees.push({x:s.x,z:s.z,y:s.h-0.3,sx:w,sz:w,sy:w*(1.05+rnd()*0.3),ry:rnd()*3,col:gaussCol('#d8e6c8',0.12)}); }
    for(const s of sample((x,z,h)=>h>2&&h<120&&slope(x,z,4)<3,Math.round(2400*scale),30000)){ const w=2.6+rnd()*2.2; bushes.push({x:s.x,z:s.z,y:s.h-0.1,sx:w,sz:w,sy:w*0.75,ry:rnd()*3,col:gaussCol('#e6f0d4',0.15)}); }
    for(const s of sample((x,z,h)=>h>1.5&&h<170&&slope(x,z,4)<4,Math.round(5200*scale),40000)){ const w=1.6+rnd()*1.6; grass.push({x:s.x,z:s.z,y:s.h-0.05,sx:w,sz:w,sy:w*(0.55+rnd()*0.4),ry:rnd()*3,col:gaussCol('#e4f0cc',0.14)}); }
    for(const s of sample((x,z,h)=>h>2&&h<90&&slope(x,z,4)<3,Math.round(2600*scale),30000)){ const w=1.4+rnd()*1.0; flowers.push({x:s.x,z:s.z,y:s.h,sx:w,sz:w,sy:w*0.6,ry:rnd()*3,col:'#ffffff'}); }
  } else if(id==='fjord'){
    for(const s of sample((x,z,h)=>treeOK(x,z,h,4,170)&&(h<120||rnd()<0.3),Math.round(3800*scale),50000)){ const w=5+rnd()*4.5; trees.push({x:s.x,z:s.z,y:s.h-0.4,sx:w,sz:w,sy:w*(1.9+rnd()*0.7),ry:rnd()*3,col:gaussCol('#e0e8e4',0.1)}); }
    for(const s of sample((x,z,h)=>h>3&&h<140&&slope(x,z,4)<3.5,Math.round(1800*scale),24000)){ const w=2.4+rnd()*2; bushes.push({x:s.x,z:s.z,y:s.h-0.1,sx:w,sz:w,sy:w*0.7,ry:rnd()*3,col:gaussCol('#cfd9d8',0.1)}); }
    for(const s of sample((x,z,h)=>h>3&&h<110&&slope(x,z,4)<4,Math.round(2400*scale),30000)){ const w=1.5+rnd()*1.3; grass.push({x:s.x,z:s.z,y:s.h-0.05,sx:w,sz:w,sy:w*0.5,ry:rnd()*3,col:gaussCol('#dfe8e4',0.1)}); }
  } else { // canyon: scrub on the floor and mesa tops, cacti, juniper
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<2.6&&free(x,z,TUBE+16)&&lmFree(x,z),Math.round(2200*scale),50000)){ const w=3+rnd()*2.6; bushes.push({x:s.x,z:s.z,y:s.h-0.1,sx:w,sz:w,sy:w*0.6,ry:rnd()*3,col:gaussCol('#c8c98e',0.14)}); }
    for(const s of sample((x,z,h)=>h>20&&h<150&&slope(x,z,4)<2.4&&free(x,z,TUBE+30)&&lmFree(x,z),Math.round(900*scale),40000)){ const w=5+rnd()*3; trees.push({x:s.x,z:s.z,y:s.h-0.3,sx:w,sz:w,sy:w*1.1,ry:rnd()*3,col:gaussCol('#cfd8b4',0.1)}); } // juniper
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<3.4,Math.round(5200*scale),40000)){ const w=1.5+rnd()*1.5; grass.push({x:s.x,z:s.z,y:s.h-0.05,sx:w,sz:w,sy:w*(0.45+rnd()*0.3),ry:rnd()*3,col:gaussCol('#d8cc9a',0.12)}); }
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<3,Math.round(900*scale),20000)){ const w=1.4+rnd()*1.2; flowers.push({x:s.x,z:s.z,y:s.h,sx:w,sz:w,sy:w,ry:rnd()*3,col:'#ffffff'}); } // agave
  }
  const gm=(pal,fl)=>lamb(grassTexture(mulberry32(co.seed+5),pal,fl));
  if(id==='coast'){
    const lt=lamb(leafTexture(mulberry32(co.seed+1),false)), bt=lamb(bushTexture(mulberry32(co.seed+2)));
    natPool(cardGeo([0,0],[1,1],0.66,0.4,false),lt,trees,hi?820:600,true); natPool(cardGeo([0,0],[1,1],0.5,0.5,false),bt,bushes,200,true);
    natPool(cardGeo([0,0],[1,1],0.5,0.5,false),gm(['#4f8a3a','#6aa347','#86b95a','#5f9a42'],null),grass,130,true);
    natPool(cardGeo([0,0],[1,1],0.5,0.5,false),gm(['#4f8a3a','#6aa347','#86b95a'],['#f4d94e','#ffffff','#e98aa8','#c9a6ff','#ff9a5a']),flowers,100,true);
  } else if(id==='fjord'){
    const pt=lamb(pineTexture(mulberry32(co.seed+1),true)), bt=lamb(bushTexture(mulberry32(co.seed+2)));
    natPool(cardGeo([0,0],[1,1],0.001,0.0005,false),pt,trees,hi?900:650,true); natPool(cardGeo([0,0],[1,1],0.5,0.5,false),bt,bushes,200,true);
    natPool(cardGeo([0,0],[1,1],0.5,0.5,false),gm(['#6b8a6a','#8aa48a','#a9bfa8','#dfe8e4'],null),grass,120,true);
  } else {
    const jt=lamb(leafTexture(mulberry32(co.seed+1),false)), bt=lamb(bushTexture(mulberry32(co.seed+2))), ag=lamb(agaveTexture(mulberry32(co.seed+3)));
    natPool(cardGeo([0,0],[1,1],0.66,0.4,false),jt,trees,hi?800:600,true); natPool(cardGeo([0,0],[1,1],0.5,0.5,false),bt,bushes,220,true);
    natPool(cardGeo([0,0],[1,1],0.5,0.5,false),gm(['#b9a85e','#cdbb6e','#a5964e','#d8c97c'],null),grass,130,true);
    natPool(cardGeo([0,0],[1,1],0.5,0.5,false),ag,flowers,110,true);
    // saguaro, barrel cacti, dead trees, hoodoo spires along the rims
    const sag=[], bar=[], dead=[], hoo=[];
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<2.8&&free(x,z,TUBE+16)&&lmFree(x,z),Math.round(520*scale),40000)){ const k=0.8+rnd()*0.9; sag.push({x:s.x,z:s.z,y:s.h-0.3,s:k,ry:rnd()*6}); }
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<3,Math.round(700*scale),30000)) bar.push({x:s.x,z:s.z,y:s.h-0.1,s:0.8+rnd()*0.8,ry:rnd()*6});
    for(const s of sample((x,z,h)=>h>20&&slope(x,z,4)<3&&free(x,z,TUBE+14),Math.round(160*scale),30000)) dead.push({x:s.x,z:s.z,y:s.h-0.2,s:0.8+rnd()*0.7,ry:rnd()*6});
    for(const s of sample((x,z,h)=>h>180&&slope(x,z,10)<5&&free(x,z,TUBE+20)&&lmFree(x,z),Math.round(260*scale),50000)){ const k=0.7+rnd()*1.1; hoo.push({x:s.x,z:s.z,y:s.h-0.5,s:k,ry:rnd()*6}); }
    natPool(K.saguaro,kitMat,sag,620,false); natPool(K.barrel,kitMat,bar,260,false); natPool(K.deadtree,kitMat,dead,420,false); natPool(K.hoodoo,kitMat,hoo,900,false);
    for(const s of hoo) if(s.s>1.3) W.solids.push({x:s.x,z:s.z,r:2.6*s.s,top:s.y+13*s.s});
  }

  /* ---- villages: solid houses, church, jetty with moored boats, place labels ---- */
  const names=natPlaceNames(id), usedNames=new Set(), pick=a=>{ for(let t=0;t<20;t++){ const n=a[Math.floor(rnd()*a.length)]; if(!usedNames.has(n)){ usedNames.add(n); return n; } } return a[0]; };
  const style=K.houses[id], placed={}; style.forEach((_,i)=>placed[i]=[]);
  const label=(name,x,y,z,col)=>{ const s=wideLabel(name,col); s.scale.set(20,3.6,1); s.position.set(x,y,z); s.visible=false; W.travelG.add(s); N.labels.push({s,x,z,name}); };
  const nVill={coast:4,fjord:4,canyon:2}[id], vkind={coast:'shoreFlat',fjord:'shoreFlat',canyon:'floorFlat'}[id];
  for(let v=0;v<nVill;v++){
    const c=findSpot(rnd,vkind); if(!c) continue; if(!free(c.x,c.z,TUBE+50)) continue;
    const count=Math.round((id==='canyon'?9:16+rnd()*10)*(0.6+0.4*scale)), R=34+count*2.2, base=rnd()*Math.PI, mine=[];
    for(let t=0;t<count*14&&mine.length<count;t++){
      const a=rnd()*6.283, r=Math.sqrt(rnd())*R, x=c.x+Math.cos(a)*r, z=c.z+Math.sin(a)*r, h=heightAt(x,z);
      if(h<(co.water?2.2:8)||slope(x,z,6)>4.5||!free(x,z,TUBE+30)||mine.some(m=>(m.x-x)**2+(m.z-z)**2<11*11)) continue;
      mine.push({x,z,h});
    }
    const baseSt=Math.floor(rnd()*style.length);
    for(const m of mine){ const si=(baseSt+Math.floor(rnd()*style.length))%style.length, sc=0.85+rnd()*0.4, ry=base+(rnd()<0.5?0:Math.PI/2)+(rnd()-0.5)*0.25;
      placed[si].push({x:m.x,z:m.z,y:m.h-0.2,sx:sc,sz:sc,sy:0.9+rnd()*0.25,ry}); if(N.houses<110){ N.houses++; W.solids.push({x:m.x,z:m.z,r:5.2*sc,top:m.h+style[si].h*1.1}); } }
    if(mine.length&&id==='fjord'&&v<2){ const m=mine[0]; (placed.church||(placed.church=[])).push({x:c.x,z:c.z,y:heightAt(c.x,c.z)-0.2,s:1.1,ry:base}); W.solids.push({x:c.x,z:c.z,r:7,top:heightAt(c.x,c.z)+22}); }
    if(co.water){ // jetty into the nearest water, with a few boats moored beside it
      let bestA=null; for(let k=0;k<16&&bestA===null;k++){ const a=k*Math.PI/8; let ok=false; for(let d=14;d<=90;d+=6) if(heightAt(c.x+Math.cos(a)*d,c.z+Math.sin(a)*d)<0.2){ ok=true; break; } if(ok) bestA=a; }
      if(bestA!==null){ let d0=0; while(d0<140&&heightAt(c.x+Math.cos(bestA)*d0,c.z+Math.sin(bestA)*d0)>0.4) d0+=3; const len=Math.min(50,d0+16), jx=c.x+Math.cos(bestA)*(len/2), jz=c.z+Math.sin(bestA)*(len/2);
        (N.jet||(N.jet=[])).push({x:jx,z:jz,y:1.1,sx:1,sy:1,sz:len,ry:Math.PI/2-bestA});
        for(let k=0;k<3+Math.floor(rnd()*3);k++){ const side=k%2?1:-1, dd=d0+2+k*5, px=c.x+Math.cos(bestA)*dd-Math.sin(bestA)*side*4.5, pz=c.z+Math.sin(bestA)*dd+Math.cos(bestA)*side*4.5; if(heightAt(px,pz)<0.2) N.boats.push({kind:'moored',type:rnd()<0.5?'skiff':'trawler',x:px,z:pz,a:Math.PI/2-bestA+(rnd()-0.5)*0.3,sp:0,ph:rnd()*6}); } }
    }
    const vn=pick(names.v); label(vn,c.x,heightAt(c.x,c.z)+46,c.z,'#ffe9a0');
  }
  style.forEach((st,i)=>{ const items=placed[i]; if(!items.length) return; natPool(st.body,kitMat,items,950,false); if(st.glow){ if(!W.glowMat){ W.glowMat=new T.MeshStandardMaterial({vertexColors:true,roughness:0.5,emissive:'#ffcf7a',emissiveIntensity:id==='fjord'?2.2:0.2}); W.ownMats.push(W.glowMat); } natPool(st.glow,W.glowMat,items,950,false); } });
  if(placed.church) natPool(K.church,kitMat,placed.church,1100,false);
  if(N.jet) natPool(K.jetty,kitMat,N.jet,900,false);
  if(id==='canyon'){ // ranch: water tower and windmill pumps near the settlements; power poles on the mesa
    const tow=[], pump=[], pole=[];
    for(const s of sample((x,z,h)=>h>20&&h<150&&slope(x,z,20)<3&&free(x,z,TUBE+60)&&lmFree(x,z),4,20000)){ tow.push({x:s.x,z:s.z,y:s.h-0.3,s:1,ry:rnd()*6}); W.solids.push({x:s.x,z:s.z,r:3.8,top:s.h+22}); for(let k=0;k<2;k++) pump.push({x:s.x+(rnd()-0.5)*50,z:s.z+(rnd()-0.5)*50,y:heightAt(s.x,s.z),s:1,ry:rnd()*6}); label(pick(names.v),s.x,s.h+52,s.z,'#ffe9a0'); }
    const a=sample((x,z,h)=>h>180&&slope(x,z,20)<3&&free(x,z,TUBE+30),1,20000)[0];
    if(a){ const ang=rnd()*6.28; for(let k=0;k<26;k++){ const x=a.x+Math.cos(ang)*k*42, z=a.z+Math.sin(ang)*k*42, h=heightAt(x,z); if(h>150&&slope(x,z,6)<5) pole.push({x,z,y:h-0.2,s:1,ry:ang}); } }
    natPool(K.tower,kitMat,tow,1100,false); natPool(K.windpump,kitMat,pump.map(p=>({...p,y:p.y})),700,false); natPool(K.pole,kitMat,pole,900,false);
  }
  if(id==='fjord'||id==='coast'){ for(const s of sample((x,z,h)=>h>1&&h<5&&slope(x,z,6)<3&&nearWater(x,z,30),Math.round(70*scale),20000)) (N.seals||(N.seals=[])).push({x:s.x,z:s.z,y:s.h+0.1,s:0.9+rnd()*0.6,ry:rnd()*6}); if(N.seals) natPool(K.seal,kitMat,N.seals,500,false); }

  /* ---- peaks and the summit cairn: labelled with their real height ---- */
  { const pk=[]; for(let t=0;t<9000;t++){ const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z); if(h<(id==='coast'?90:id==='canyon'?200:260)) continue; if(heightAt(x+30,z)>h||heightAt(x-30,z)>h||heightAt(x,z+30)>h||heightAt(x,z-30)>h) continue; if(pk.some(p=>(p.x-x)**2+(p.z-z)**2<500*500)) continue; pk.push({x,z,h}); if(pk.length>=14) break; }
    pk.sort((a,b)=>b.h-a.h); const cairns=[]; for(const p of pk.slice(0,5)){ label(`${pick(names.p)} ${Math.round(p.h)} m`,p.x,p.h+28,p.z,'#cfe3ff'); if(id==='fjord'&&p.h>260) cairns.push({x:p.x,z:p.z,y:p.h-0.4,s:1.2,ry:0}); }
    if(cairns.length) natPool(K.cairn,kitMat,cairns,1200,false); }

  /* ---- wildlife: instanced, wanders around its home, runs from a bird that swoops close ---- */
  const species=(kind,geo,n,test,sp,rad)=>{ const items=[]; for(const s of sample(test,Math.round(n*(0.5+0.5*scale)),9000)){ const herd=1+Math.floor(rnd()*4); for(let k=0;k<herd;k++){ const a=rnd()*6.283, r=rnd()*14, x=s.x+Math.cos(a)*r, z=s.z+Math.sin(a)*r; if(heightAt(x,z)<1.5) continue; items.push({kind,x,z,hx:s.x,hz:s.z,a:rnd()*6.283,sp:sp*(0.7+rnd()*0.6),fl:0,ph:rnd()*6,rad,go:0,wt:rnd()*4}); } }
    if(!items.length) return; const mesh=new T.InstancedMesh(geo,kitMat,items.length); mesh.count=0; mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.castShadow=false; W.scene.add(mesh); N.fauna.push({mesh,items,sc:kind==='horse'?1:1}); };
  if(id==='coast'){ species('sheep',K.sheep,16,(x,z,h)=>h>25&&h<150&&slope(x,z,6)<3.2,0.8,40); species('deer',K.deer,7,(x,z,h)=>h>12&&h<90&&slope(x,z,6)<3,1.2,70); }
  if(id==='canyon'){ species('bighorn',K.bighorn,12,(x,z,h)=>h>20&&slope(x,z,6)<4.2,1,60); species('horse',K.horse,6,(x,z,h)=>h>20&&h<150&&slope(x,z,10)<2.6,2.4,160); species('deer',K.deer,5,(x,z,h)=>h>20&&h<150&&slope(x,z,6)<3,1.2,70); }
  if(id==='fjord'){ species('reindeer',K.reindeer,14,(x,z,h)=>h>10&&h<160&&slope(x,z,6)<4,1.1,80); }

  /* ---- sea life: sailing boats, trawlers, ferries, leaping dolphins, surfacing whales ---- */
  if(co.water){
    const water=()=>{ for(let pass=0;pass<2;pass++) for(let t=0;t<1500;t++){ const x=(rnd()-0.5)*2*ext*0.9, z=(rnd()-0.5)*2*ext*0.9, lim=pass?-3:-10, nb=pass?-1:-4; if(heightAt(x,z)<lim&&[[50,0],[-50,0],[0,50],[0,-50]].every(([a,b])=>heightAt(x+a,z+b)<nb)) return {x,z}; } return null; };
    const boatSet={coast:[['sail',9],['trawler',4]],fjord:[['trawler',5],['ferry',1],['skiff',4]]}[id];
    for(const [type,n] of boatSet) for(let k=0;k<Math.max(1,Math.round(n*(0.6+0.4*scale)));k++){ const w=water(); if(w) N.boats.push({kind:'sail',type,x:w.x,z:w.z,a:rnd()*6.283,sp:type==='ferry'?5.5:type==='sail'?3.2:2.6,ph:rnd()*6}); }
    const types={}; for(const b of N.boats) (types[b.type]||(types[b.type]=[])).push(b);
    N.boatMeshes=Object.entries(types).map(([type,list])=>{ const mesh=new T.InstancedMesh(K[type],type==='ferry'?kitMat:kitMat,list.length); mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); W.scene.add(mesh); return {mesh,list}; });
    const cetKind=id==='coast'?'dolphin':'whale', nCet=id==='coast'?4:3;
    for(let k=0;k<nCet;k++){ const w=water(); if(w) N.cet.push({kind:cetKind,x:w.x,z:w.z,a:rnd()*6.283,t:rnd()*14,per:cetKind==='dolphin'?3.4:9,rest:cetKind==='dolphin'?6+rnd()*7:12+rnd()*10,n:cetKind==='dolphin'?3:1,s:cetKind==='dolphin'?1:1}); }
    if(N.cet.length){ const cnt=N.cet.reduce((s,c)=>s+c.n,0); N.cetMesh=new T.InstancedMesh(K[cetKind],kitMat,cnt); N.cetMesh.frustumCulled=false; N.cetMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); N.cetMesh.count=0; W.scene.add(N.cetMesh); }
  }

  /* ---- waterfalls (steep slopes above the water) ---- */
  if(id!=='canyon'){
    const U2={time:{value:0},fogC:{value:new T.Color(co.fog[0])},fogNear:{value:co.fog[1]},fogFar:{value:co.fog[2]},camPos:{value:new T.Vector3()},tint:{value:new T.Color(id==='fjord'?'#bfe0ff':'#ffffff')}};
    const fm=new T.ShaderMaterial({uniforms:U2,transparent:true,depthWrite:false,side:T.DoubleSide,
      vertexShader:`varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader:`uniform float time,fogNear,fogFar; uniform vec3 fogC,camPos,tint; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y); }
        void main(){ float edge=smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x); float s=vn(vec2(vUv.x*14.0,vUv.y*26.0+time*5.0))*0.6+vn(vec2(vUv.x*34.0,vUv.y*60.0+time*8.0))*0.4;
          float a=edge*(0.35+0.65*s)*smoothstep(0.0,0.05,vUv.y)*0.85; vec3 c=mix(tint,vec3(1.0),s*0.6);
          float d=length(camPos-vW); c=mix(c,fogC,smoothstep(fogNear,fogNear+(fogFar-fogNear),d)); gl_FragColor=vec4(c,a*(1.0-smoothstep(fogFar*0.5,fogFar,d))); }`});
    W.ownMats.push(fm); N.fallU=U2;
    let nf=0; for(let t=0;t<30000&&nf<(id==='fjord'?9:4);t++){ const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext, h=heightAt(x,z); if(h<60||h>300) continue;
      const gx=heightAt(x+10,z)-heightAt(x-10,z), gz=heightAt(x,z+10)-heightAt(x,z-10), gl=Math.hypot(gx,gz); if(gl<2) continue; const dx=-gx/gl, dz=-gz/gl; // downhill
      const hb=heightAt(x+dx*16,z+dz*16); if(h-hb<32||hb<-1) continue; if(!nearWater(x+dx*16,z+dz*16,160)) continue; if(!free(x,z,TUBE+20)) continue;
      const top=h-2, bot=Math.max(hb-1,0.5), g=new T.PlaneGeometry(7+rnd()*5,top-bot,1,1), me2=new T.Mesh(g,fm); me2.position.set(x+dx*6,(top+bot)/2,z+dz*6); me2.rotation.y=Math.atan2(dx,dz); me2.frustumCulled=false; W.travelG.add(me2); nf++; }
  }

  /* ---- falling snow (fjord) and blowing dust (canyon): drawn entirely on the GPU around the camera ---- */
  if(id==='fjord'||id==='canyon'){
    const n=id==='fjord'?1600:900, seed=new Float32Array(n*3); for(let i=0;i<n*3;i++) seed[i]=rnd();
    const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3)); g.setAttribute('seed',new T.BufferAttribute(seed,3));
    const au={time:{value:0},cam:{value:new T.Vector3()},size:{value:id==='fjord'?1.5:4},col:{value:new T.Color(id==='fjord'?'#ffffff':'#d9b78a')},vel:{value:id==='fjord'?new T.Vector3(1.2,-2.4,0.6):new T.Vector3(9,-0.3,3)},alpha:{value:id==='fjord'?0.85:0.22},box:{value:id==='fjord'?90:150}};
    const am=new T.ShaderMaterial({uniforms:au,transparent:true,depthWrite:false,
      vertexShader:`uniform float time,size,box; uniform vec3 cam,vel; attribute vec3 seed; varying float vA;
        void main(){ vec3 p=seed*box*2.0+vel*time+vec3(sin(time*0.7+seed.x*20.0)*1.5,0.0,cos(time*0.6+seed.z*20.0)*1.5); p=mod(p-cam+box,box*2.0)-box; vec4 mv=viewMatrix*vec4(cam+p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=min(size*(260.0/-mv.z),7.0); vA=1.0-smoothstep(box*0.5,box,length(p)); }`,
      fragmentShader:`uniform vec3 col; uniform float alpha; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(col,alpha*vA*(1.0-d*1.6)); }`});
    W.ownMats.push(am); const pts=new T.Points(g,am); pts.frustumCulled=false; pts.renderOrder=14; W.scene.add(pts); N.air=au;
  }
  /* ---- dust devils (canyon) ---- */
  if(id==='canyon'){
    const dm=new T.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform float time; varying vec2 vUv; void main(){ float s=0.5+0.5*sin(vUv.x*28.0+vUv.y*9.0-time*5.0); float a=(0.18+0.5*s)*smoothstep(0.0,0.08,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*0.55; gl_FragColor=vec4(0.82,0.66,0.46,a); }`});
    W.ownMats.push(dm); N.devU=dm;
    for(const s of sample((x,z,h)=>h>20&&h<100&&slope(x,z,10)<3,3,9000)){ const m=new T.Mesh(new T.CylinderGeometry(14,2.2,70,18,1,true),dm); m.position.set(s.x,s.h+35,s.z); m.frustumCulled=false; W.travelG.add(m); N.anim.push({m,x:s.x,z:s.z,a:rnd()*6.283,ph:rnd()*9}); }
  }
  xFlush(); XA=null;
}
function updateNature(dt,t){
  const N=W.nat; if(!N) return; const cam=R.camera.position, br=me.r, bp=br?br.pos:cam;
  for(const P of N.pools) P.update(cam.x,cam.z);
  if(N.fallU){ N.fallU.time.value=t; N.fallU.camPos.value.copy(cam); N.fallU.fogC.value.copy(W.scene.fog.color); N.fallU.fogNear.value=W.scene.fog.near; N.fallU.fogFar.value=W.scene.fog.far; }
  if(N.air){ N.air.time.value=t; N.air.cam.value.copy(cam); const rainy=ENV.weather==='rain'||ENV.weather==='fog'; N.air.alpha.value=(W.co.id==='fjord'?0.85:0.22)*(rainy&&W.co.id==='canyon'?0.3:1); }
  if(N.devU) N.devU.uniforms.time.value=t;
  for(const d of N.anim){ d.a+=dt*0.04; d.x+=Math.cos(d.a)*dt*5; d.z+=Math.sin(d.a)*dt*5; const h=heightAt(d.x,d.z); if(h<15||h>120||Math.abs(d.x)>W.co.size*0.32||Math.abs(d.z)>W.co.size*0.32) d.a+=3.14; d.m.position.set(d.x,h+35,d.z); d.m.rotation.y=t*2+d.ph; }
  // land animals: only the ones near the camera are simulated and drawn
  const M4=new T.Matrix4(), Q=new T.Quaternion(), E=new T.Euler(), S3=new T.Vector3(), P3=new T.Vector3(), low=bp.y<70, sr=16+0.3*(br?br.v:0);
  for(const F of N.fauna){ let k=0; const A=F.mesh.instanceMatrix.array;
    for(const a of F.items){ const dxc=a.x-cam.x, dzc=a.z-cam.z; if(dxc*dxc+dzc*dzc>380*380) continue;
      const ex=a.x-bp.x, ez=a.z-bp.z;
      if(low&&a.fl<=0&&ex*ex+ez*ez<sr*sr){ a.a=Math.atan2(ex,ez); a.fl=3+Math.random()*2.5; }
      let spd=0; if(a.fl>0){ a.fl-=dt; spd=a.sp*4.2; } else { a.wt-=dt; if(a.wt<0){ a.wt=2+Math.random()*5; a.go=Math.random()<0.55?1:0; a.a+=(Math.random()-0.5)*2.2; const hx=a.hx-a.x, hz=a.hz-a.z; if(hx*hx+hz*hz>a.rad*a.rad) a.a=Math.atan2(hx,hz); } spd=a.go?a.sp*0.7:0; }
      const nx=a.x+Math.sin(a.a)*spd*dt, nz=a.z+Math.cos(a.a)*spd*dt, nh=heightAt(nx,nz);
      if(nh>1.2&&slope(nx,nz,3)<2.6){ a.x=nx; a.z=nz; } else { a.a+=1.6; a.fl=Math.max(0,a.fl-0.5); }
      a.ph+=dt*(spd>0?(a.fl>0?14:6):0); const y=heightAt(a.x,a.z), bob=spd>0?Math.abs(Math.sin(a.ph))*0.12*(a.fl>0?1.6:1):0;
      E.set(spd>0?Math.sin(a.ph)*0.04:0,a.a,0); Q.setFromEuler(E); P3.set(a.x,y+bob,a.z); S3.set(1,1,1); M4.compose(P3,Q,S3); M4.toArray(A,k*16); k++; }
    F.mesh.count=k; F.mesh.instanceMatrix.needsUpdate=true; }
  // boats wander the water, turning away from land
  for(const B of N.boats){ if(B.kind==='moored'){ B.ph+=dt; continue; } const nx=B.x+Math.sin(B.a)*B.sp*dt, nz=B.z+Math.cos(B.a)*B.sp*dt;
    const ax=B.x+Math.sin(B.a)*60, az=B.z+Math.cos(B.a)*60;
    if(heightAt(ax,az)>-1.5||Math.abs(ax)>W.co.size*0.34||Math.abs(az)>W.co.size*0.34){ B.a+=dt*0.7; } else { B.x=nx; B.z=nz; B.a+=Math.sin(t*0.1+B.ph)*dt*0.03; }
    B.ph+=dt; }
  if(N.boatMeshes) for(const {mesh,list} of N.boatMeshes){ const A=mesh.instanceMatrix.array; list.forEach((B,i)=>{ const bob=Math.sin(B.ph*1.3)*0.35+0.4; E.set(Math.sin(B.ph*0.9)*0.04,B.a,Math.sin(B.ph*1.1)*0.05); Q.setFromEuler(E); P3.set(B.x,bob+(B.type==='ferry'?0.4:0),B.z); S3.set(1,1,1); M4.compose(P3,Q,S3); M4.toArray(A,i*16); }); mesh.instanceMatrix.needsUpdate=true; }
  if(N.cetMesh){ let k=0; const A=N.cetMesh.instanceMatrix.array;
    for(const c of N.cet){ c.t+=dt; const cyc=c.per+c.rest; if(c.t>cyc){ c.t-=cyc; c.a+=(Math.random()-0.5)*1.4; c.x+=Math.sin(c.a)*40; c.z+=Math.cos(c.a)*40; if(heightAt(c.x,c.z)>-10){ c.a+=3.14; c.x+=Math.sin(c.a)*80; c.z+=Math.cos(c.a)*80; } }
      if(c.t>c.per) continue; const p=c.t/c.per, big=c.kind==='whale';
      for(let j=0;j<c.n;j++){ const off=j*(big?0:5), lat=(j-1)*3.2, d=(p*(big?40:34))-18+off*0.4, y=Math.sin(p*Math.PI)*(big?4.5:5.2)-(big?2.6:1.2), slopeA=Math.cos(p*Math.PI)*(big?0.25:0.6);
        E.set(-slopeA,c.a,0); Q.setFromEuler(E); P3.set(c.x+Math.sin(c.a)*d+Math.cos(c.a)*lat,y,c.z+Math.cos(c.a)*d-Math.sin(c.a)*lat); S3.set(1,1,1); M4.compose(P3,Q,S3); M4.toArray(A,k*16); k++; } }
    N.cetMesh.count=k; N.cetMesh.instanceMatrix.needsUpdate=true; }
  for(const L of N.labels){ const d=Math.hypot(L.x-bp.x,L.z-bp.z); L.s.visible=d<1100&&d>45; }
}

/* ================= travelling together, part 2 =================
   Everyone in a room shares the sky (time of day and weather) and the discoveries; a friend's map and mode are adopted when you join;
   you can fly to any friend (even on another map), follow one in formation, and see everyone in a list. */
let follow=null, warpTo=null, warpUntil=0, friendSig='', friendT=0;
function envShare(){ if(!client?.connected) return; client.publish(`${base}/c`,JSON.stringify({type:'env',m:ENV.mode,w:ENV.weather,h:Math.round(ENV.hour*100)/100,by:me.id,nm:me.name}),{qos:1}); }
function foundShare(L){ if(!client?.connected||!W) return; client.publish(`${base}/c`,JSON.stringify({type:'found',k:W.co.id,n:L.n,by:me.id,nm:me.name}),{qos:1}); }
function onSharedMsg(m){
  if(!m||m.by===me.id) return; const nm=String(m.nm||'A friend').slice(0,16);
  if(m.type==='env'){ const md=String(m.m||'native'), wx=String(m.w||'clear'); if(md===ENV.mode&&wx===ENV.weather&&md!=='cycle') return; ENV.hour=clamp(num(m.h,12),0,24); envSet(md,wx,true); msg(`${nm} set the sky: ${md==='native'?"the map's own light":md}, ${wx}.`); }
  else if(m.type==='found'&&W&&m.k===W.co.id){ const n=String(m.n||'').slice(0,60), L=W.lms.find(l=>l.n===n); if(L&&!L.found){ L.found=true; (found[W.co.id]||(found[W.co.id]=[])).push(L.n); travelSave(); renderJournal(); banner={t:`${nm} found ${L.n}`,until:performance.now()+3500,c:'#ffe9a0'}; chime(); } }
}
function followTarget(){ if(!follow) return null; const rm=remotes.get(follow); return rm&&rm.r&&rm.k===me.course?rm:null; }
function setFollow(id){
  if(!id||follow===id){ follow=null; banner={t:'Flying solo',until:performance.now()+1200,c:'#ffffff'}; friendSig=''; return; }
  const rm=remotes.get(id); if(!rm||!rm.r||rm.k!==me.course){ msg(rm?`${rm.n} is on a different map. Use Go to their map first.`:'That friend left.',true); return; }
  follow=id; friendSig=''; banner={t:`Following ${rm.n}`,until:performance.now()+1800,c:'#b9f0cf'}; msg(`Following ${rm.n} in formation. Steer to take over.`);
}
function followInput(r,rm){ // fly beside and slightly behind a friend: match their speed, close the gap when you fall back
  const f=rm.r, B=BD[r.c], fy=f.yaw, rx=Math.cos(fy), rz=-Math.sin(fy), fwx=Math.sin(fy), fwz=Math.cos(fy);
  const tx=f.pos.x-fwx*14+rx*7, ty=f.pos.y+1.2, tz=f.pos.z-fwz*14+rz*7, dx=tx-r.pos.x, dy=ty-r.pos.y, dz=tz-r.pos.z, hz=Math.hypot(dx,dz), dist=Math.hypot(hz,dy);
  const des=hz>12?Math.atan2(dx,dz):fy, yErr=wrapA(des-r.yaw), pErr=(hz>12?Math.atan2(dy,hz):f.pitch)-r.pitch;
  const L=clamp(((f.v/B.spd)-15)/48+(dist-6)/55,0,1);
  return {turn:clamp(-yErr*2.2,-1,1),pitch:clamp(pErr*2.4,-1,1),flex:L};
}
function flyToRm(rm){ const f=rm.r, m2=me.r; if(!f||!m2) return; m2.pos.set(f.pos.x-Math.sin(f.yaw)*10+4,f.pos.y+1,f.pos.z-Math.cos(f.yaw)*10); m2.yaw=f.yaw; m2.v=Math.max(m2.v,f.v); m2.inv=1.5; banner={t:`Flying with ${rm.n}`,until:performance.now()+1500,c:'#b9f0cf'}; }
function flyToFriend(id){
  let rm=id?remotes.get(id):null;
  if(!rm){ const L=friendsHere(); if(L.length){ const p=me.r.pos; rm=L.reduce((a,b)=>p.distanceTo(a.r.pos)<p.distanceTo(b.r.pos)?a:b); } else rm=[...remotes.values()].find(x=>x.k&&x.k!==me.course)||null; }
  if(!rm){ msg('Nobody else is in this room yet.',true); return; }
  if(rm.k&&rm.k!==me.course){ if(phase==='countdown'||phase==='race'){ msg('Finish the race first.',true); return; } warpTo=rm.id; warpUntil=performance.now()+8000; pickCourse(rm.k,true); msg(`Flying to ${rm.n} on ${CO[rm.k].name}.`); return; }
  flyToRm(rm);
}
function updateTogether(now){
  if(warpTo){ const rm=remotes.get(warpTo); if(rm&&rm.r&&rm.k===me.course&&me.r){ warpTo=null; flyToRm(rm); } else if(now>warpUntil) warpTo=null; }
  if(now-friendT<500) return; friendT=now; renderFriends();
}
function renderFriends(){
  const pn=$('rFriendPanel'), box=$('rFriends'); if(!pn||!box) return; const on=!!client?.connected; pn.hidden=!on; if(!on) return;
  const list=[...remotes.values()].filter(rm=>rm.n).sort((a,b)=>a.n.localeCompare(b.n)), sig=list.map(r=>r.id+':'+(r.k||'')+':'+(follow===r.id?1:0)+':'+(r.k&&r.k!==me.course?1:0)).join('|');
  if(sig!==friendSig){ friendSig=sig; box.replaceChildren();
    if(!list.length){ box.textContent='Nobody else is here yet. Copy the invite link and send it.'; }
    for(const rm of list){ const row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap';
      const dot=document.createElement('span'); dot.style.cssText=`width:10px;height:10px;border-radius:50%;background:${BD[rm.c]?.look.body||'#fff'};display:inline-block`; const nm=document.createElement('b'); nm.textContent=rm.n;
      const info=document.createElement('span'); info.dataset.d=rm.id; info.style.opacity='0.8';
      const away=rm.k&&rm.k!==me.course;
      const fly=document.createElement('button'); fly.textContent=away?'Go to their map':'Fly to'; fly.dataset.act='fly'; fly.dataset.id=rm.id;
      const fol=document.createElement('button'); fol.textContent=follow===rm.id?'Stop following':'Follow'; fol.dataset.act='follow'; fol.dataset.id=rm.id; if(away) fol.disabled=true;
      row.append(dot,nm,info,fly,fol); box.append(row); } }
  for(const rm of list){ const el=[...box.querySelectorAll('[data-d]')].find(x=>x.dataset.d===rm.id); if(!el||!me.r) continue; const here=!rm.k||rm.k===me.course; const d=here&&rm.r?me.r.pos.distanceTo(rm.r.pos):null;
    el.textContent=here?(d==null?'':(d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km')):`on ${CO[rm.k]?.name||'another map'}`; }
}

/* ================= hearts (travel mode): hit something and lose a heart, float through a heart to get one back ================= */
const MAXH=5, STARTH=3; let hearts=STARTH, hurtFlash=0, pendingRespawn=false, heartGeoC=null;
const lifeOn=()=>mode==='travel'&&!!$('rHearts')?.checked;
function hurtMe(txt){
  const r=me.r, now=performance.now(); r.inv=1.5; shake=0.5; sfx('hit'); emote('ouch',0.9); hurtFlash=now+450;
  if(!lifeOn()){ banner={t:txt,until:now+800,c:'#ffd27f'}; return; }
  hearts=Math.max(0,hearts-1); if(W&&T) burst(r.pos,'#ff5a6a',22,16);
  if(hearts>0) banner={t:`${txt}   −1 ♥`,until:now+1400,c:'#ff8a8a'};
  else { banner={t:'Out of hearts! Back to the start with 3',until:now+2600,c:'#ff6a6a'}; pendingRespawn=true; }
}
function heartGeo(){
  if(heartGeoC) return heartGeoC; const s=new T.Shape();
  s.moveTo(0,-1.0); s.bezierCurveTo(-0.2,-0.7,-1.2,-0.2,-1.15,0.45); s.bezierCurveTo(-1.1,1.05,-0.2,1.1,0,0.55); s.bezierCurveTo(0.2,1.1,1.1,1.05,1.15,0.45); s.bezierCurveTo(1.2,-0.2,0.2,-0.7,0,-1.0);
  const g=new T.ExtrudeGeometry(s,{depth:0.5,bevelEnabled:true,bevelSize:0.12,bevelThickness:0.12,bevelSegments:2,curveSegments:10}); g.center(); heartGeoC=g; return g;
}
function buildHearts(co){
  const rnd=mulberry32(co.seed*31+9), ext=(co.lim||co.size*0.3)*0.85, want=co.usc?18:14, list=[]; W.hearts=list;
  const mt=new T.MeshStandardMaterial({color:'#ff3b4d',emissive:'#ff1f3a',emissiveIntensity:0.95,roughness:0.35}); W.ownMats.push(mt);
  const sc=co.usc?1.5:2.6;
  for(let t=0;t<5000&&list.length<want;t++){
    const x=(rnd()-0.5)*2*ext, z=(rnd()-0.5)*2*ext; if(list.some(h=>(h.x-x)**2+(h.z-z)**2<150*150)) continue;
    const y=Math.max(groundAt(x,z),0.5)+(co.usc?14:18)+rnd()*(co.usc?18:40); if(y>420) continue;
    const g=new T.Group(), m=new T.Mesh(heartGeo(),mt); m.scale.setScalar(sc); g.add(m);
    const glow=new T.Sprite(new T.SpriteMaterial({map:softTex(),color:'#ff4a66',transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false})); glow.scale.setScalar(sc*6); g.add(glow);
    g.position.set(x,y,z); W.travelG.add(g); list.push({g,m,x,y,z,gone:0,ph:rnd()*6});
  }
}
function updateHearts(dt,t,now){
  if(pendingRespawn){ pendingRespawn=false; hearts=STARTH; placeTravel(me.r); }
  const H=W.hearts; if(!H) return; const r=me.r, on=lifeOn(), rad=W.usc?7+citySize()*4:11;
  for(const h of H){
    if(h.gone>now){ h.g.visible=false; continue; } h.g.visible=on;
    h.m.rotation.y=t*2+h.ph; h.g.position.y=h.y+Math.sin(t*1.6+h.ph)*0.9;
    if(on&&hearts<MAXH&&r.pos.distanceTo(h.g.position)<rad){ hearts++; h.gone=now+45000; chime(); burst(h.g.position,'#ff7a90',26,12); banner={t:`+1 ♥   ${hearts} of ${MAXH}`,until:now+1300,c:'#ff9aab'}; }
  }
}
function drawHearts(g,Wv,Hv,now){
  if(!lifeOn()) return;
  const sz=14, gap=9, w=MAXH*(sz*2+gap)-gap, x0=Wv/2-w/2+sz, y=102;
  for(let i=0;i<MAXH;i++){ const cx=x0+i*(sz*2+gap), full=i<hearts;
    g.beginPath(); g.moveTo(cx,y+sz*0.9); g.bezierCurveTo(cx-sz*1.5,y-sz*0.1,cx-sz*0.9,y-sz*1.2,cx,y-sz*0.4); g.bezierCurveTo(cx+sz*0.9,y-sz*1.2,cx+sz*1.5,y-sz*0.1,cx,y+sz*0.9);
    g.fillStyle=full?'#ff4b5f':'rgba(8,12,18,0.45)'; g.fill(); g.lineWidth=2; g.strokeStyle=full?'#ffffff':'rgba(255,255,255,0.45)'; g.stroke(); }
  if(hearts<MAXH&&W.hearts){ let best=null, bd=Infinity; for(const h of W.hearts){ if(h.gone>now) continue; const d=Math.hypot(h.x-me.r.pos.x,h.z-me.r.pos.z); if(d<bd){ bd=d; best=h; } }
    if(best){ g.font='600 12px "DM Sans",system-ui'; g.textAlign='center'; g.fillStyle='#ffb3be'; g.fillText(`Heart ${bd>=1000?(bd/1000).toFixed(1)+' km':Math.round(bd)+' m'} away`,Wv/2,y+sz+22); g.textAlign='left'; } }
  if(now<hurtFlash){ const a=clamp((hurtFlash-now)/450,0,1)*0.4, gr=g.createRadialGradient(Wv/2,Hv/2,Math.min(Wv,Hv)*0.25,Wv/2,Hv/2,Math.max(Wv,Hv)*0.7); gr.addColorStop(0,'rgba(255,30,40,0)'); gr.addColorStop(1,`rgba(255,30,40,${a})`); g.fillStyle=gr; g.fillRect(0,0,Wv,Hv); }
}

function init(){
  try{ document.fonts?.load('700 16px "DM Sans"'); document.fonts?.load('500 14px "DM Sans"'); }catch{}
  prefs(); buildRoster(); buildCourses();
  $('rJoin').onclick=join; $('rLeave').onclick=leave; $('rStart').onclick=startClicked;
  $('rNewRoom').onclick=()=>{ $('rRoom').value='RACE-'+EMG().randCode(6); prefs(true); };
  if($('rInvite')) $('rInvite').onclick=()=>{ if(!client){ msg('Join a room first, then copy the invite link.',true); return; } const l=inviteLink(); navigator.clipboard.writeText(l).then(()=>msg('Invite link copied. Friends who open it land in this room and on this map.'),()=>msg('Copy failed. Room code: '+$('rRoom').value,true)); };
  { const hp=new URLSearchParams(location.hash.slice(1)); const sr=hp.get('sr'); if(sr&&/^[A-Za-z0-9_-]{4,40}$/.test(sr)){ $('rRoom').value=sr; const kc=hp.get('course'); if(CO[kc]) me.course=kc; if(hp.get('mode')==='travel') setTimeout(()=>{ try{ setMode('travel'); }catch{} },0); msg('Invite loaded: room '+sr+'. Enter your name and press Join to fly together.'); if($('rName').value.trim()) setTimeout(()=>{ try{ join(); }catch{} },800); } }
  $('rCopy').onclick=()=>navigator.clipboard.writeText($('rRoom').value).then(()=>msg('Room code copied. Send it to the people you want to race.'),()=>msg('Copy failed. Select the code and copy it by hand.',true));
  $('rName').onchange=()=>{ me.name=$('rName').value.trim().slice(0,16); prefs(true); };
  for(const id of ['rLaps','rBots','rKeyBoost','rAssist','rInvert','rQuality','rEyeSens','rSound','rTapPhoto']) $(id).addEventListener('change',()=>prefs(true));
  $('rMode').onchange=()=>setMode($('rMode').value);
  if($('rHearts')){ try{ const v=localStorage.getItem('emgPosture.hearts'); if(v!=null) $('rHearts').checked=v==='1'; }catch{} $('rHearts').onchange=()=>{ try{ localStorage.setItem('emgPosture.hearts',$('rHearts').checked?'1':'0'); }catch{} hearts=STARTH; };
  }
  $('rTod').onchange=$('rWeather').onchange=()=>{ envSet($('rTod').value,$('rWeather').value,true); envShare(); };
  if($('rFriends')) $('rFriends').addEventListener('click',e=>{ const b=e.target.closest('button[data-act]'); if(!b) return; if(b.dataset.act==='fly') flyToFriend(b.dataset.id); else setFollow(b.dataset.id); friendSig=''; });
  $('rCalFlex').onclick=calFlex; envLoad(); wireFsUi();
  $('rControl').onchange=()=>{ ctrl=$('rControl').value; prefs(true); applyModeUI();
    msg(ctrl==='kb'?'Keyboard only: arrows or WASD steer, Space boosts or flaps. Your muscle and eyes are ignored.'
      :ctrl==='eyes'?'Hands-free: look where you want to go and flex your calf for speed. Start eye tracking below.'
      :'Keyboard, eyes and flex all work together. Keys win over eyes while you press them.'); };
  $('rEyeStart').onclick=async()=>{ const E=window.EyeControl; if(!E){ msg('Eye control is not available.',true); return; }
    if(E.running()){ msg('Eye tracking is already on. Look left/right of the centre to turn, up/down to climb or dive.'); return; }
    msg('Starting the camera…'); await E.start();
    msg(E.running()?'Eye tracking on. If the ring does not follow your eyes, press Calibrate eyes.':'The camera did not start. See the Eye control tab for details.',!E.running()); };
  $('rEyeCal').onclick=()=>{ const E=window.EyeControl; if(!E?.running()){ msg('Start eye tracking first.',true); return; } E.calibrate(); };
  window.addEventListener('emgtap',()=>{ if(EMG().activeTab()!=='tabRace') return; if(!menuOpen&&menuAvail()&&gazeInHot()){ openMenu(); return; } if(menuOpen) return; if(mode==='travel'&&$('rTapPhoto').checked&&!window.EyeControl?.calibrating?.()) takePhoto(); });
  $('rWrap').addEventListener('pointerdown',audioInit);
  $('rWrap').addEventListener('pointerdown',e=>{ if(mode==='travel'&&e.button===0&&!e.target.closest('button,#rMenu')) interactCall(0.8,false); }); // click the view to call
  const bs=$('rBirdSize'); if(bs){ try{ const v=localStorage.getItem('emgPosture.birdSize'); if(v&&[...bs.options].some(o=>o.value===v)) bs.value=v; }catch{}
    bs.onchange=()=>{ try{ localStorage.setItem('emgPosture.birdSize',bs.value); }catch{} const f=r=>{ if(r&&r.model&&W&&W.co.usc) r.model.scale.setScalar(cityBirdScale(r)); }; for(const r of racers) f(r); for(const rm of remotes.values()) f(rm.r); }; }
  travelLoad(); applyModeUI();
  me.name=$('rName').value.trim().slice(0,16);
  requestAnimationFrame(loop);
}
init();
window.SkyRace={life:{get:()=>hearts,set:v=>{ hearts=v; },hurt:hurtMe},BIRDS,COURSES,LANDMARKS,_state:()=>({me,racers,remotes,phase,W,R,laps,participants,mode,ctrl}),startRace,startClicked,pickCourse,pickBird,stepRacer,stepTravel,standings,setMode,eyeSteering,takePhoto,usc:()=>({U,bAt,groundAt}),mission:()=>MS,env:()=>ENV,real:()=>Object.fromEntries(Object.entries(REAL).map(([k,v])=>[k,v&&v.buf?+v.buf.duration.toFixed(1):v]))};
})();
