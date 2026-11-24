// Tap Brawl: a small online platform fighter for the EMG Posture Lab.
// Move with the keyboard, attack by tapping your foot (the Foot tap tab's detector fires 'emgtap' events).
// Networking: MQTT over WebSocket. Each player simulates their own fighter and reports hits to the victim.
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const EMG=()=>window.EMG;

/* ---------- original roster ---------- */
const ROSTER=[
  {id:'voltail',name:'Voltail',type:'Electric',body:'#2bb3a6',belly:'#c9f2ec',acc:'#ffd94a',ears:'pointy',tail:'bolt',spd:1.15,wt:0.9,jmp:1.05,grav:1,move:'proj',dmg:6,kb:240,cd:0.3,proj:{v:950,r:8,life:0.65,n:1}},
  {id:'cindermaw',name:'Cindermaw',type:'Fire',body:'#e8602c',belly:'#ffd2a8',acc:'#ffb000',ears:'horns',tail:'flame',spd:0.95,wt:1.1,jmp:0.95,grav:1,move:'cone',dmg:12,kb:330,cd:0.5,reach:95},
  {id:'tidepup',name:'Tidepup',type:'Water',body:'#3a7bd5',belly:'#cfe3ff',acc:'#9fe0ff',ears:'round',tail:'flat',spd:1.0,wt:1.0,jmp:1.0,grav:1,move:'proj',dmg:9,kb:300,cd:0.45,proj:{v:620,r:14,life:0.9,n:1}},
  {id:'thornback',name:'Thornback',type:'Grass',body:'#4caf50',belly:'#e3f5c8',acc:'#2e7d32',ears:'spikes',tail:'leaf',spd:1.05,wt:0.95,jmp:1.0,grav:1,move:'proj',dmg:4,kb:200,cd:0.4,proj:{v:800,r:6,life:0.55,n:3}},
  {id:'frostfin',name:'Frostfin',type:'Ice',body:'#8fd3f4',belly:'#f4fbff',acc:'#3d8bd6',ears:'fin',tail:'stub',spd:0.95,wt:1.05,jmp:0.95,grav:1,move:'proj',dmg:8,kb:280,cd:0.42,proj:{v:700,r:10,life:0.8,n:1}},
  {id:'boulderbeak',name:'Boulderbeak',type:'Rock',body:'#8d6e63',belly:'#d7ccc8',acc:'#5d4037',ears:'shell',tail:'stub',spd:0.85,wt:1.35,jmp:0.85,grav:1.1,move:'dash',dmg:13,kb:340,cd:0.6,dash:700},
  {id:'gustling',name:'Gustling',type:'Wind',body:'#b39ddb',belly:'#ede7f6',acc:'#ffb74d',ears:'tuft',tail:'wing',spd:1.05,wt:0.8,jmp:1.2,grav:0.75,move:'burst',dmg:7,kb:300,cd:0.45,reach:85},
  {id:'shadebun',name:'Shadebun',type:'Shadow',body:'#5e4b8b',belly:'#c5b8e8',acc:'#ff5d8f',ears:'long',tail:'puff',spd:1.25,wt:0.85,jmp:1.1,grav:1,move:'dash',dmg:9,kb:270,cd:0.38,dash:900},
  {id:'mosscap',name:'Mosscap',type:'Spore',body:'#f2e2c4',belly:'#fff6e6',acc:'#d64545',ears:'cap',tail:'none',spd:0.9,wt:1.15,jmp:0.9,grav:1,move:'burst',dmg:9,kb:280,cd:0.55,reach:110},
];
const CH=Object.fromEntries(ROSTER.map(c=>[c.id,c]));
const MOVE_TXT={proj:'ranged shot',cone:'close-range blast',dash:'charging lunge',burst:'all-around burst'};

/* ---------- world ---------- */
const VIEW={w:1200,h:675};
const BLAST={l:-250,r:1450,t:-450,b:950};
// main:true platforms can't be dropped through. move:{amp,period} slides a platform sideways, timed by the wall clock so every player sees it in the same place.
const ARENAS=[
  {id:'sky',name:'Sky Ruins',desc:'Classic: one wide stage, three floating ledges',sky:['#1b2440','#3c2f5c'],hill:'#2a2750',top:'#8fd18b',side:'#5a6585',under:'#3d4660',float:'#c9d3e6',grip:1,deco:'stars',
    plats:[{x:250,y:500,w:700,main:true},{x:330,y:385,w:190},{x:680,y:385,w:190},{x:505,y:275,w:190}],spawn:[330,870,480,720],respawn:{x:600,y:120}},
  {id:'twin',name:'Twin Peaks',desc:'Two cliffs with a gap in the middle',sky:['#ff9a5a','#7a3b6e'],hill:'#5b2c55',top:'#f2c46d',side:'#8a5a44',under:'#5e3a2e',float:'#f6e2c0',grip:1,deco:'sun',
    plats:[{x:170,y:500,w:360,main:true},{x:670,y:500,w:360,main:true},{x:505,y:360,w:190}],spawn:[260,940,420,780],respawn:{x:600,y:120}},
  {id:'isles',name:'Floating Isles',desc:'Six small islands, no safe ground',sky:['#5ec8e8','#bfeaf5'],hill:'#8fcfb0',top:'#6fcf6b',side:'#7a8f5a',under:'#55663f',float:'#e9f5e0',grip:1,deco:'clouds',
    plats:[{x:200,y:470,w:200,main:true},{x:500,y:520,w:200,main:true},{x:800,y:470,w:200,main:true},{x:350,y:330,w:150},{x:700,y:330,w:150},{x:525,y:210,w:150}],spawn:[300,900,600,425],respawn:{x:600,y:100}},
  {id:'ferry',name:'Cloud Ferry',desc:'Two moving platforms glide over the stage',sky:['#2c3e70','#6a89cc'],hill:'#34497e',top:'#d8e2f5',side:'#8796bf',under:'#5c6a94',float:'#ffffff',grip:1,deco:'clouds',
    plats:[{x:380,y:510,w:440,main:true},{x:150,y:370,w:180,move:{amp:260,period:8}},{x:870,y:370,w:180,move:{amp:-260,period:8}}],spawn:[440,760,540,660],respawn:{x:600,y:120}},
  {id:'lake',name:'Frozen Lake',desc:'A huge slippery ice sheet. Hard to stop',sky:['#0f2a44','#5d8fb3'],hill:'#2d4f6e',top:'#e8f6ff',side:'#9ccbe6',under:'#5f8fb0',float:'#e8f6ff',grip:0.22,deco:'snow',
    plats:[{x:150,y:500,w:900,main:true},{x:450,y:370,w:300}],spawn:[250,950,450,750],respawn:{x:600,y:120}},
  {id:'tower',name:'Ember Tower',desc:'A small base and a tall climb',sky:['#2a0f0f','#6b2414'],hill:'#3d1510',top:'#ff9a3c',side:'#5a2b20',under:'#3a1a14',float:'#ffcf99',grip:1,deco:'embers',
    plats:[{x:450,y:520,w:300,main:true},{x:300,y:410,w:150},{x:750,y:410,w:150},{x:525,y:300,w:150},{x:330,y:190,w:130},{x:740,y:190,w:130}],spawn:[480,720,375,825],respawn:{x:600,y:100}},
];
const AR=Object.fromEntries(ARENAS.map(a=>[a.id,a]));
let A=null; // the active arena (with its own copy of the platforms)
function setArena(id){ const src=AR[id]||ARENAS[0]; A={...src,plats:src.plats.map(p=>({...p,x0:p.x,dx:0}))}; updatePlats(); markArena(); }
function updatePlats(){
  const t=Date.now()/1000;
  for(const p of A.plats) if(p.move){ const nx=p.x0+p.move.amp*(0.5-0.5*Math.cos(2*Math.PI*t/p.move.period)); p.dx=nx-p.x; p.x=nx; }
}

/* ---------- state ---------- */
const me={id:null,name:'',c:'voltail',body:null};
let dummy=null, projs=[], fx=[], remotes=new Map();
let client=null, base=null, phase='free', matchId=null, participants=[], phaseEnd=0, fightStart=0, winnerText='';
const keys={}; let jumpQ=false, downQ=false, lastSend=0, lastT=performance.now(), tapFlash=0;

const num=(v,d=0)=>{ v=+v; return Number.isFinite(v)?v:d; };
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
function msg(t,err){ const m=$('gMsg'); m.textContent=t; m.style.color=err?'var(--danger)':''; }

function prefs(save){
  const k='emgPosture.game';
  if(save){ try{ localStorage.setItem(k,JSON.stringify({id:me.id,name:$('gName').value,room:$('gRoom').value,c:me.c,a:A?.id})); }catch{} return; }
  let p={}; try{ p=JSON.parse(localStorage.getItem(k)||'{}'); }catch{}
  me.id=p.id||EMG().randCode(10); me.c=CH[p.c]?p.c:'voltail'; setArena(AR[p.a]?p.a:'sky');
  $('gName').value=p.name||EMG().name()||''; $('gRoom').value=p.room||('ARENA-'+EMG().randCode(6));
  prefs(true);
}

function spawnBody(c,x){ return {c,x,y:120,vx:0,vy:0,face:x>600?-1:1,dmg:0,stocks:3,ground:false,jumps:1,stun:0,atk:0,atkType:null,cd:0,inv:1.5,out:false,drop:0,plat:null,hitSet:new Set()}; }

/* ---------- physics ---------- */
function step(b,inp,dt){ // returns true if the body left the blast zone
  const ch=CH[b.c];
  b.cd=Math.max(0,b.cd-dt); b.inv=Math.max(0,b.inv-dt); b.drop=Math.max(0,b.drop-dt);
  if(b.atk>0){ b.atk-=dt; if(b.atk<=0){ b.atk=0; b.atkType=null; } }
  if(b.stun>0) b.stun-=dt;
  if(b.stun<=0){
    const dir=(inp.right?1:0)-(inp.left?1:0);
    const dashing=b.atkType==='dash'&&b.atk>0;
    if(dir&&!dashing) b.face=dir;
    if(!dashing) b.vx=approach(b.vx,dir*330*ch.spd,(b.ground?2600*A.grip:1400)*dt);
    if(inp.jumpPressed){ if(b.ground){ b.vy=-760*ch.jmp; b.ground=false; } else if(b.jumps>0){ b.vy=-700*ch.jmp; b.jumps--; } }
    if(inp.down&&!b.ground&&b.vy>-100) b.vy=Math.max(b.vy,820);
    if(inp.downPressed&&b.ground&&b.plat&&!b.plat.main){ b.drop=0.25; b.ground=false; }
  } else b.vx*=Math.pow(0.6,dt);
  b.vy=Math.min(b.vy+2000*ch.grav*dt,1100);
  if(b.ground&&b.plat?.dx) b.x+=b.plat.dx; // ride moving platforms
  const oy=b.y; b.x+=b.vx*dt; b.y+=b.vy*dt;
  b.ground=false; b.plat=null;
  if(b.vy>=0) for(const p of A.plats){
    if(!p.main&&b.drop>0) continue;
    if(b.x>p.x-6&&b.x<p.x+p.w+6&&oy<=p.y+0.5&&b.y>=p.y){ b.y=p.y; b.vy=0; b.ground=true; b.plat=p; b.jumps=1; break; }
  }
  return b.x<BLAST.l||b.x>BLAST.r||b.y>BLAST.b||b.y<BLAST.t;
}
function applyHit(b,h){
  window.Brawl3D?.shake(0.3);
  if(!b||b.out||b.inv>0) return;
  b.dmg=Math.min(999,b.dmg+h.dmg);
  const mag=(h.kb*0.55+b.dmg*h.kb*0.022)/CH[b.c].wt;
  b.vx=h.dx*mag; b.vy=-(mag*0.6+180); b.stun=Math.min(1.2,0.12+mag/2200); b.ground=false; b.atk=0; b.atkType=null;
  burst(b.x,b.y-26,'#fff',10,260);
}
function ko(b,isMe){
  window.Brawl3D?.shake(0.8);
  burst(Math.max(20,Math.min(VIEW.w-20,b.x)),Math.max(20,Math.min(VIEW.h-20,b.y)),CH[b.c].acc,30,600);
  if(isMe&&phase==='fight'){ b.stocks--; if(b.stocks<=0){ b.out=true; b.x=600; b.y=-2000; b.vx=b.vy=0; return; } }
  Object.assign(b,{x:A.respawn.x,y:A.respawn.y,vx:0,vy:0,dmg:0,stun:0,inv:2,ground:false,atk:0,atkType:null});
}
function burst(x,y,color,n,sp){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=sp*(0.3+Math.random()*0.7); fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.35+Math.random()*0.3,color,r:2+Math.random()*3}); } }

/* ---------- attacks ---------- */
function doAttack(){
  const b=me.body; if(!b||b.out||b.stun>0||b.cd>0||phase==='countdown'||phase==='over') return;
  const ch=CH[b.c]; b.cd=ch.cd; b.hitSet=new Set();
  if(ch.move==='proj'){ const n=ch.proj.n;
    for(let i=0;i<n;i++){ const a=(i-(n-1)/2)*0.18; projs.push({x:b.x+b.face*30,y:b.y-30,vx:Math.cos(a)*ch.proj.v*b.face,vy:Math.sin(a)*ch.proj.v,r:ch.proj.r,life:ch.proj.life,c:b.c}); } }
  else if(ch.move==='dash'){ b.atk=0.22; b.atkType='dash'; b.vx=b.face*ch.dash; if(!b.ground) b.vy=Math.min(b.vy,-120); }
  else { b.atk=ch.move==='cone'?0.2:0.16; b.atkType=ch.move; }
}
function targets(){
  const t=[];
  for(const [id,r] of remotes){ if(r.o||r.i) continue; if(phase==='fight'&&!participants.includes(id)) continue; t.push({id,x:r.dx,y:r.dy}); }
  if(dummy) t.push({id:'dummy',x:dummy.x,y:dummy.y});
  return t;
}
function sendHit(t,h){
  burst(t.x,t.y-26,CH[me.c].acc,8,220);
  if(t.id==='dummy'){ applyHit(dummy,h); return; }
  client?.publish(`${base}/h/${t.id}`,JSON.stringify({...h,from:me.id,m:matchId}),{qos:1});
}
function circRect(px,py,r,cx,cy,hw,hh){ const dx=Math.max(Math.abs(px-cx)-hw,0), dy=Math.max(Math.abs(py-cy)-hh,0); return dx*dx+dy*dy<r*r; }
function meleeHits(b){
  if(!(b.atk>0)||!b.atkType) return; const ch=CH[b.c];
  for(const t of targets()){
    if(b.hitSet.has(t.id)) continue; const tx=t.x, ty=t.y-26; let hit;
    if(b.atkType==='burst') hit=Math.hypot(tx-b.x,ty-(b.y-26))<ch.reach+24;
    else if(b.atkType==='dash') hit=circRect(tx,ty,24,b.x+b.face*18,b.y-28,34,30);
    else hit=circRect(tx,ty,24,b.x+b.face*(22+ch.reach/2),b.y-28,ch.reach/2,30);
    if(hit){ b.hitSet.add(t.id); sendHit(t,{dmg:ch.dmg,kb:ch.kb,dx:b.atkType==='burst'?(Math.sign(tx-b.x)||b.face):b.face}); }
  }
}

/* ---------- networking ---------- */
async function join(){
  const name=$('gName').value.trim(), room=$('gRoom').value.trim();
  if(!name){ msg('Enter your name first.',true); return; }
  if(!/^[A-Za-z0-9_-]{4,40}$/.test(room)){ msg('Room code must be 4–40 letters, numbers, - or _.',true); return; }
  me.name=name.slice(0,16); prefs(true); msg('Connecting…'); $('gJoin').disabled=true;
  try{ await EMG().loadMqtt(); }catch(e){ msg(e.message,true); $('gJoin').disabled=false; return; }
  base=`emgposture/v1/game/${room}`; remotes.clear();
  const c=mqtt.connect(EMG().broker(),{clientId:`tb_${me.id}_${EMG().randCode(4)}`,clean:true,connectTimeout:8000,reconnectPeriod:3000});
  client=c;
  c.on('connect',()=>{ c.subscribe([`${base}/s/+`,`${base}/h/${me.id}`,`${base}/c`],{qos:1}); msg(`In arena ${room}. Send the room code to friends, then press Start match.`); });
  c.on('message',onMsg);
  c.on('error',e=>msg('Connection error: '+e.message,true));
  c.on('offline',()=>msg('Offline. Retrying…',true));
  $('gLeave').disabled=false; $('gStartMatch').disabled=false; for(const i of ['gRoom','gNewRoom']) $(i).disabled=true;
}
function leave(){
  if(client){ client.end(true); client=null; }
  remotes.clear(); if(phase!=='free') backToFree();
  $('gJoin').disabled=false; $('gLeave').disabled=true; $('gStartMatch').disabled=true; for(const i of ['gRoom','gNewRoom']) $(i).disabled=false;
  msg('You left the arena. Practice mode.');
}
function onMsg(topic,buf){
  let m; try{ m=JSON.parse(buf.toString()); }catch{ return; }
  if(!m||typeof m!=='object') return;
  if(topic===`${base}/c`){
    if(m.type==='start'&&Array.isArray(m.ids)) startMatch(m);
    else if(m.type==='arena'&&AR[m.a]&&phase==='free'&&m.by!==me.id&&A.id!==m.a){ setArena(m.a); prefs(true); msg(`${String(m.n||'Someone').slice(0,16)} switched the arena to ${AR[m.a].name}.`); }
    return;
  }
  const parts=topic.split('/'), kind=parts[parts.length-2], id=parts[parts.length-1];
  if(kind==='s'){
    if(id===me.id) return;
    let r=remotes.get(id); if(!r){ r={dx:num(m.x,600),dy:num(m.y,120)}; remotes.set(id,r); }
    Object.assign(r,{n:String(m.n||'?').slice(0,16),c:CH[m.c]?m.c:'voltail',x:num(m.x,600),y:num(m.y,120),vx:num(m.vx),vy:num(m.vy),f:m.f<0?-1:1,
      d:Math.max(0,num(m.d)),s:Math.max(0,num(m.s,3)),o:!!m.o,st:!!m.st,a:num(m.a),i:!!m.i,
      p:Array.isArray(m.p)?m.p.slice(0,12).filter(a=>Array.isArray(a)).map(a=>[num(a[0]),num(a[1]),Math.min(20,num(a[2],6))]):[],recv:performance.now()});
  } else if(kind==='h'&&id===me.id){
    if(phase==='fight'&&m.m!==matchId) return;
    applyHit(me.body,{dmg:Math.min(30,Math.max(0,num(m.dmg))),kb:Math.min(500,Math.max(0,num(m.kb))),dx:m.dx<0?-1:1});
  }
}
function publishState(){
  if(!client?.connected) return; const b=me.body;
  client.publish(`${base}/s/${me.id}`,JSON.stringify({n:me.name,c:me.c,x:Math.round(b.x),y:Math.round(b.y),vx:Math.round(b.vx),vy:Math.round(b.vy),f:b.face,
    d:Math.round(b.dmg),s:b.stocks,o:b.out?1:0,st:b.stun>0?1:0,a:b.atk>0?({dash:1,cone:2,burst:3}[b.atkType]||0):0,i:b.inv>0?1:0,
    p:projs.map(p=>[Math.round(p.x),Math.round(p.y),p.r])}),{qos:0});
}
function startMatch(m){
  matchId=String(m.m||''); participants=m.ids.map(String).slice(0,8);
  if(AR[m.a]) setArena(m.a);
  const idx=participants.indexOf(me.id);
  me.body=spawnBody(me.c,A.spawn[Math.max(0,idx)%A.spawn.length]); me.body.inv=0;
  if(idx<0){ me.body.out=true; me.body.y=-2000; }
  projs=[]; dummy=null; phase='countdown'; phaseEnd=performance.now()+3000; winnerText='';
  msg(idx<0?'A match started without you. You are watching; you can play in the next one.':'Match starting!');
}
function backToFree(){
  phase='free'; participants=[]; matchId=null;
  me.body=spawnBody(me.c,me.body?.x>0&&me.body.x<1200?me.body.x:450);
  if(client) msg('Free play. Press Start match when everyone has joined.');
}
function checkWinner(now){
  const alive=participants.filter(id=>{ if(id===me.id) return !me.body.out; const r=remotes.get(id); return r&&now-r.recv<3000&&!r.o; });
  if(alive.length<=1){
    phase='over'; phaseEnd=now+6000;
    winnerText=!alive.length?'Draw!':alive[0]===me.id?'You win!':`${remotes.get(alive[0]).n} wins!`;
  }
}

/* ---------- main loop ---------- */
function update(dt,now){
  updatePlats();
  if(!me.body) me.body=spawnBody(me.c,A.spawn[0]);
  if(phase==='free'&&$('gDummy').checked&&!dummy){ dummy=spawnBody(me.c==='mosscap'?'boulderbeak':'mosscap',A.spawn[1]); dummy.face=-1; }
  if(dummy&&(phase!=='free'||!$('gDummy').checked)) dummy=null;
  if(phase==='countdown'&&now>=phaseEnd){ phase='fight'; fightStart=now; }
  if(phase==='over'&&now>=phaseEnd) backToFree();
  const inp=phase==='countdown'?{}:{left:keys.a||keys.arrowleft,right:keys.d||keys.arrowright,down:keys.s||keys.arrowdown,jumpPressed:jumpQ,downPressed:downQ};
  jumpQ=false; downQ=false;
  const b=me.body;
  if(!b.out){ if(step(b,inp,dt)) ko(b,true); meleeHits(b); }
  if(dummy&&step(dummy,{},dt)) ko(dummy,false);
  for(const p of projs){
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    for(const t of targets()) if(Math.hypot(p.x-t.x,p.y-(t.y-26))<p.r+24){ const ch=CH[p.c]; sendHit(t,{dmg:ch.dmg,kb:ch.kb,dx:p.vx<0?-1:1}); p.life=0; break; }
  }
  projs=projs.filter(p=>p.life>0);
  for(const [id,r] of remotes){
    const age=(now-r.recv)/1000; if(age>3){ remotes.delete(id); continue; }
    const tx=r.x+r.vx*Math.min(age,0.1), ty=r.y+r.vy*Math.min(age,0.1), k=Math.min(1,dt*18);
    if(Math.abs(tx-r.dx)>250||Math.abs(ty-r.dy)>250){ r.dx=tx; r.dy=ty; } else { r.dx+=(tx-r.dx)*k; r.dy+=(ty-r.dy)*k; }
  }
  if(phase==='fight') checkWinner(now);
  for(const f of fx){ f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=600*dt; f.life-=dt; }
  fx=fx.filter(f=>f.life>0);
}
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  const visible=EMG().activeTab()==='tabGame';
  if(!visible&&!client) return;
  update(dt,now);
  if(client&&now-lastSend>50){ lastSend=now; publishState(); }
  if(visible) draw(now/1000,now);
}

/* ---------- drawing ---------- */
function shade(hex,amt){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
  const f=v=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function ell(g,x,y,rx,ry,rot=0){ g.beginPath(); g.ellipse(x,y,rx,ry,rot,0,Math.PI*2); g.fill(); }
function poly(g,pts){ g.beginPath(); g.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) g.lineTo(pts[i],pts[i+1]); g.closePath(); g.fill(); }
// x,y = feet position; drawn facing right, mirrored by face
function drawFighter(g,ch,x,y,face,t,o={}){
  g.save(); g.translate(x,y); g.scale(face,1);
  if(o.alpha!=null) g.globalAlpha=o.alpha;
  const bob=o.run?Math.sin(t*18)*2:Math.sin(t*3)*1, cy=-26+bob;
  // tail
  g.fillStyle=ch.acc;
  if(ch.tail==='bolt') poly(g,[-20,cy+4,-40,cy-8,-32,cy-10,-50,cy-30,-30,cy-16,-38,cy-14,-22,cy-2]);
  else if(ch.tail==='flame'){ g.fillStyle=ch.body; ell(g,-30,cy+8,14,6,-0.4); g.fillStyle=ch.acc; ell(g,-44,cy+1+Math.sin(t*20)*1.5,7,10+Math.sin(t*25)*2); g.fillStyle='#fff3b0'; ell(g,-44,cy+4,3,5); }
  else if(ch.tail==='flat'){ g.fillStyle=shade(ch.body,-0.2); ell(g,-32,cy+12,16,6,0.2); }
  else if(ch.tail==='leaf'){ ell(g,-32,cy-4,14,6,-0.7); }
  else if(ch.tail==='stub'){ g.fillStyle=shade(ch.body,-0.15); ell(g,-26,cy+8,7,6); }
  else if(ch.tail==='puff'){ g.fillStyle='#f5f0ff'; ell(g,-26,cy+6,8,8); }
  // feet + body
  g.fillStyle=shade(ch.body,-0.3); ell(g,-11,-4,9,5); ell(g,11,-4,9,5);
  g.fillStyle=ch.body; ell(g,0,cy,26,24);
  g.fillStyle=ch.belly; ell(g,5,cy+6,15,14);
  // head features
  g.fillStyle=ch.acc;
  if(ch.ears==='pointy'){ g.fillStyle=ch.body; poly(g,[-12,cy-16,-16,cy-44,-2,cy-21]); poly(g,[2,cy-21,6,cy-46,14,cy-17]); g.fillStyle=ch.acc; poly(g,[-15,cy-38,-16,cy-44,-11,cy-37]); poly(g,[5,cy-40,6,cy-46,9,cy-40]); }
  else if(ch.ears==='horns'){ poly(g,[-10,cy-20,-18,cy-38,-4,cy-23]); poly(g,[4,cy-23,8,cy-40,13,cy-19]); }
  else if(ch.ears==='round'){ g.fillStyle=ch.body; ell(g,-12,cy-20,7,7); ell(g,8,cy-22,7,7); g.fillStyle=ch.belly; ell(g,-12,cy-20,3.5,3.5); ell(g,8,cy-22,3.5,3.5); }
  else if(ch.ears==='spikes'){ for(let i=0;i<5;i++){ const a=Math.PI*(0.55+i*0.16); const bx=Math.cos(a)*24, by=cy-Math.sin(a)*22; poly(g,[bx-6,by+2,bx+Math.cos(a)*14,by-Math.sin(a)*14,bx+6,by+4]); } }
  else if(ch.ears==='fin'){ poly(g,[-14,cy-20,-4,cy-42,6,cy-23]); }
  else if(ch.ears==='shell'){ g.strokeStyle=ch.acc; g.lineWidth=3; for(const dx of [-14,-4,6]){ g.beginPath(); g.ellipse(dx,cy,6,22,0,-Math.PI/2.2,Math.PI/2.2); g.stroke(); } }
  else if(ch.ears==='tuft'){ g.fillStyle=shade(ch.body,-0.2); poly(g,[-14,cy-18,-20,cy-34,-6,cy-22]); poly(g,[4,cy-22,8,cy-36,14,cy-18]); }
  else if(ch.ears==='long'){ g.fillStyle=ch.body; ell(g,-8,cy-36,5,17,-0.25); ell(g,4,cy-38,5,17,0.15); g.fillStyle=ch.acc; ell(g,-8,cy-36,2,11,-0.25); ell(g,4,cy-38,2,11,0.15); }
  else if(ch.ears==='cap'){ g.beginPath(); g.ellipse(0,cy-12,32,22,0,Math.PI,0); g.fill(); g.fillStyle='#fff'; ell(g,-14,cy-22,4,3); ell(g,4,cy-28,5,3.5); ell(g,18,cy-18,3,2.5); }
  if(ch.tail==='wing'){ g.fillStyle=shade(ch.body,-0.15); ell(g,-6,cy+2,12,16,0.5); }
  // eye + mouth
  g.fillStyle='#fff'; ell(g,12,cy-7,7,8); g.fillStyle='#1b1b24'; ell(g,14,cy-6,3.6,4.6); g.fillStyle='#fff'; ell(g,15,cy-8,1.3,1.3);
  if(ch.ears==='tuft'){ g.fillStyle=ch.acc; poly(g,[22,cy-2,32,cy+2,22,cy+5]); }
  else { g.strokeStyle='#1b1b24'; g.lineWidth=1.6; g.beginPath(); g.arc(20,cy+4,4,0.2,Math.PI*0.8); g.stroke(); }
  g.restore();
}
function drawAttack(g,ch,x,y,face,type,t){
  g.save(); g.globalAlpha=0.6; g.fillStyle=ch.acc; g.strokeStyle=ch.acc;
  if(type==='cone'||type===2){ g.beginPath(); g.moveTo(x+face*16,y-28); g.lineTo(x+face*(22+ch.reach),y-58); g.lineTo(x+face*(22+ch.reach),y+2); g.closePath(); g.fill(); }
  else if(type==='burst'||type===3){ g.lineWidth=6; g.beginPath(); g.arc(x,y-26,(ch.reach||80)*(0.7+0.3*Math.sin(t*30)),0,Math.PI*2); g.stroke(); }
  else if(type==='dash'||type===1){ g.lineWidth=3; for(let i=0;i<4;i++){ const yy=y-12-i*11; g.beginPath(); g.moveTo(x-face*30,yy); g.lineTo(x-face*70,yy); g.stroke(); } }
  g.restore();
}
function dmgColor(d){ return d<40?'#ffffff':d<80?'#ffe082':d<120?'#ffb74d':d<160?'#ff7043':'#e53935'; }
function drawBody(g,b,name,t,isMe){
  const ch=CH[b.c], sx=Math.max(24,Math.min(VIEW.w-24,b.x)), sy=Math.max(60,Math.min(VIEW.h-10,b.y));
  if(sx!==b.x||sy!==b.y){ g.fillStyle='rgba(255,255,255,.15)'; g.beginPath(); g.arc(sx,sy-26,26,0,Math.PI*2); g.fill(); drawFighter(g,ch,sx,sy-8,b.face,t,{alpha:0.8}); return; }
  if(b.atkType&&b.atk>0) drawAttack(g,ch,b.x,b.y,b.face,b.atkType,t);
  const alpha=b.inv>0?0.45+0.4*Math.sin(t*30):1;
  drawFighter(g,ch,b.x,b.y,b.face,t,{run:Math.abs(b.vx)>40&&b.ground,alpha});
  if(b.stun>0){ g.fillStyle='#ffe45e'; for(let i=0;i<3;i++){ const a=t*8+i*2.1; ell(g,b.x+Math.cos(a)*18,b.y-64+Math.sin(a)*5,3,3); } }
  g.font='bold 14px system-ui'; g.textAlign='center'; g.fillStyle=isMe?'#7fd0ff':'#ffffff'; g.fillText(name,b.x,b.y-74); g.textAlign='left';
}
function drawStage(g,ar,t){
  const sky=g.createLinearGradient(0,0,0,VIEW.h); sky.addColorStop(0,ar.sky[0]); sky.addColorStop(1,ar.sky[1]); g.fillStyle=sky; g.fillRect(0,0,VIEW.w,VIEW.h);
  if(ar.deco==='stars'){ g.fillStyle='rgba(255,255,255,.5)'; for(let i=0;i<40;i++) ell(g,(i*137.5)%VIEW.w,(i*71.3)%320,1.2,1.2); }
  if(ar.deco==='sun'){ g.fillStyle='rgba(255,236,170,.85)'; ell(g,600,300,90,90); }
  if(ar.deco==='clouds'){ g.fillStyle='rgba(255,255,255,.55)'; for(let i=0;i<6;i++){ const x=((i*230+t*12*(1+i%3))%1500)-150, y=60+(i*53)%200; ell(g,x,y,70,22); ell(g,x+40,y-12,45,20); } }
  g.fillStyle=ar.hill; g.beginPath(); g.moveTo(0,VIEW.h); for(let x=0;x<=VIEW.w;x+=60) g.lineTo(x,560-40*Math.sin(x/170)-20*Math.sin(x/53)); g.lineTo(VIEW.w,VIEW.h); g.fill();
  for(const p of ar.plats){
    if(p.main){ g.fillStyle=ar.under; g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(p.x+p.w,p.y); g.lineTo(p.x+p.w-Math.min(60,p.w/4),p.y+110); g.lineTo(p.x+Math.min(60,p.w/4),p.y+110); g.fill();
      g.fillStyle=ar.side; g.fillRect(p.x,p.y,p.w,22); g.fillStyle=ar.top; g.fillRect(p.x,p.y,p.w,6); }
    else { g.fillStyle=ar.float; g.fillRect(p.x,p.y,p.w,10); g.fillStyle=ar.top; g.fillRect(p.x,p.y,p.w,4);
      if(p.move){ g.fillStyle='rgba(255,255,255,.35)'; for(let k=0;k<3;k++) ell(g,p.x+30+k*60,p.y+16,18,6); } }
  }
  if(ar.deco==='snow'){ g.fillStyle='rgba(255,255,255,.8)'; for(let i=0;i<60;i++){ const x=(i*97+Math.sin(t+i)*20)%VIEW.w, y=(i*61+t*40*(1+i%3))%VIEW.h; ell(g,x,y,2,2); } }
  if(ar.deco==='embers'){ for(let i=0;i<40;i++){ const x=(i*131+Math.sin(t*2+i)*15)%VIEW.w, y=VIEW.h-((i*83+t*60*(1+i%2))%VIEW.h); g.fillStyle=i%2?'rgba(255,154,60,.8)':'rgba(255,210,120,.7)'; ell(g,x,y,2.2,2.2); } }
}
let use3d=(()=>{ try{ return localStorage.getItem('emgPosture.brawl3d')!=='0'; }catch{ return true; } })(), lastDraw=0;
function bodies3d(){
  const list=[];
  for(const [id,r] of remotes) if(!r.o) list.push({key:id,c:r.c,x:r.dx,y:r.dy,face:r.f,vx:r.vx||0,vy:r.vy||0,ground:Math.abs(r.vy||0)<1,inv:r.i?1:0,stun:r.st?1:0,atk:r.a?1:0,atkType:r.a||null,name:r.n,isMe:false,out:false});
  if(dummy) list.push({key:'dummy',c:dummy.c,x:dummy.x,y:dummy.y,face:dummy.face,vx:dummy.vx,vy:dummy.vy,ground:dummy.ground,inv:dummy.inv,stun:dummy.stun,atk:dummy.atk,atkType:dummy.atkType,name:'Dummy',isMe:false,out:!!dummy.out});
  const m=me.body; list.push({key:'me',c:m.c,x:m.x,y:m.y,face:m.face,vx:m.vx,vy:m.vy,ground:m.ground,inv:m.inv,stun:m.stun,atk:m.atk,atkType:m.atkType,name:me.name||'You',isMe:true,out:m.out});
  return list;
}
function draw3d(g,W,H,s,t,now){
  const B=window.Brawl3D; if(!use3d||!B) return false;
  if(!B.ready()&&!B.failed()&&!B.loading()) B.init($('gameGL'),CH);
  const wrap=$('gameWrap'); if(!B.ready()){ wrap.classList.remove('is3d'); return false; }
  const dt=lastDraw?Math.min(0.05,(now-lastDraw)/1000):0.016; lastDraw=now;
  const pl=projs.map(p=>({x:p.x,y:p.y,r:p.r,color:CH[p.c].acc}));
  for(const r of remotes.values()) for(const p of r.p) pl.push({x:p[0],y:p[1],r:p[2],color:CH[r.c].acc});
  const labels=B.render({A,t,dt,bodies:bodies3d(),projs:pl,fx});
  wrap.classList.add('is3d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); g.setTransform(s,0,0,s,0,0);
  for(const l of labels||[]){ g.font='bold 15px "DM Sans",system-ui'; g.textAlign='center'; g.lineWidth=4; g.strokeStyle='rgba(0,0,0,.55)';
    if(l.off){ g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.arc(l.sx,l.sy,16,0,Math.PI*2); g.fill(); g.fillStyle=CH[l.c].acc; g.beginPath(); g.arc(l.sx,l.sy,7,0,Math.PI*2); g.fill(); }
    g.strokeText(l.name,l.sx,l.sy-(l.off?24:0)); g.fillStyle=l.isMe?'#7fd0ff':'#ffffff'; g.fillText(l.name,l.sx,l.sy-(l.off?24:0)); }
  g.textAlign='left'; drawHud(g,t,now); return true;
}
function draw(t,now){
  const cv=$('gameCanvas'), rect=cv.getBoundingClientRect(), d=devicePixelRatio||1;
  const W=Math.max(1,Math.round(rect.width*d)), H=Math.max(1,Math.round(rect.height*d));
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  const g=cv.getContext('2d'), s=W/VIEW.w; g.setTransform(s,0,0,s,0,0);
  if(draw3d(g,W,H,s,t,now)) return;
  $('gameWrap').classList.remove('is3d');
  drawStage(g,A,t);
  // projectiles
  const drawProj=(x,y,r,color)=>{ g.fillStyle=color; g.globalAlpha=0.35; ell(g,x,y,r*1.8,r*1.8); g.globalAlpha=1; ell(g,x,y,r,r); g.fillStyle='#fff'; ell(g,x,y,r*0.4,r*0.4); };
  for(const p of projs) drawProj(p.x,p.y,p.r,CH[p.c].acc);
  for(const r of remotes.values()) for(const p of r.p) drawProj(p[0],p[1],p[2],CH[r.c].acc);
  // fighters
  for(const r of remotes.values()){ if(r.o) continue;
    const fake={c:r.c,x:r.dx,y:r.dy,face:r.f,vx:r.vx,ground:Math.abs(r.vy)<1,inv:r.i?1:0,stun:r.st?1:0,atk:r.a?1:0,atkType:r.a||null};
    drawBody(g,fake,r.n,t,false); }
  if(dummy) drawBody(g,dummy,'Dummy',t,false);
  if(!me.body.out) drawBody(g,me.body,me.name||'You',t,true);
  for(const f of fx){ g.globalAlpha=Math.max(0,f.life*2); g.fillStyle=f.color; ell(g,f.x,f.y,f.r,f.r); } g.globalAlpha=1;
  drawHud(g,t,now);
}
function drawHud(g,t,now){
  // damage panels
  const list=[];
  const inMatch=phase!=='free';
  const ids=inMatch?participants:[me.id,...remotes.keys()];
  for(const id of ids){
    if(id===me.id) list.push({n:me.name||'You',c:me.c,d:me.body.dmg,s:me.body.stocks,o:me.body.out,me:true});
    else { const r=remotes.get(id); if(r) list.push({n:r.n,c:r.c,d:r.d,s:r.s,o:r.o}); }
  }
  if(dummy) list.push({n:'Dummy',c:dummy.c,d:dummy.dmg,s:0,o:false});
  const pw=170, gap=12, x0=(VIEW.w-(list.length*pw+(list.length-1)*gap))/2;
  list.forEach((p,i)=>{
    const x=x0+i*(pw+gap), y=600;
    g.fillStyle=p.me?'rgba(127,208,255,.18)':'rgba(0,0,0,.35)'; g.fillRect(x,y,pw,64);
    g.save(); g.translate(x+30,y+56); g.scale(0.7,0.7); drawFighter(g,CH[p.c],0,0,1,t,{alpha:p.o?0.35:1}); g.restore();
    g.fillStyle='#e6e9ee'; g.font='12px system-ui'; g.fillText(p.n.slice(0,14),x+62,y+16);
    g.font='bold 28px system-ui'; g.fillStyle=p.o?'#777':dmgColor(p.d); g.fillText(p.o?'OUT':`${Math.round(p.d)}%`,x+62,y+46);
    if(inMatch&&!p.o){ g.fillStyle=CH[p.c].acc; for(let k=0;k<p.s;k++) ell(g,x+66+k*14,y+56,4.5,4.5); }
  });
  // top-left: foot tap status
  const ready=EMG().tapReady(), flash=now-tapFlash<200;
  g.fillStyle=flash?'#3ecf8e':ready?'rgba(62,207,142,.25)':'rgba(255,255,255,.1)'; g.beginPath(); g.arc(28,28,10,0,Math.PI*2); g.fill();
  g.font='13px system-ui'; g.fillStyle=ready?'#c8f5df':'#aab2c0';
  g.fillText(ready?'Foot tap ready: tap to attack':'Foot tap off: train the Foot tap model and connect a signal'+($('gKeyAtk').checked?' (J key works)':''),46,33);
  // centre banners
  g.textAlign='center';
  if(phase==='countdown'){ g.font='bold 120px system-ui'; g.fillStyle='#fff'; g.fillText(String(Math.max(1,Math.ceil((phaseEnd-now)/1000))),VIEW.w/2,260); }
  else if(phase==='fight'&&now-fightStart<700){ g.font='bold 110px system-ui'; g.fillStyle='#ffe45e'; g.fillText('GO!',VIEW.w/2,260); }
  else if(phase==='over'){ g.font='bold 80px system-ui'; g.fillStyle='#ffe45e'; g.fillText(winnerText,VIEW.w/2,250); g.font='16px system-ui'; g.fillStyle='#e6e9ee'; g.fillText('Back to free play in a moment',VIEW.w/2,285); }
  else if(phase==='free'){ g.font='15px system-ui'; g.fillStyle='rgba(230,233,238,.8)';
    g.fillText(client?`Free play · ${remotes.size} other player${remotes.size===1?'':'s'} here · press Start match when everyone has joined`:'Practice mode · join an arena to fight friends',VIEW.w/2,70); }
  if(me.body.out&&phase==='fight'){ g.font='18px system-ui'; g.fillStyle='#e6e9ee'; g.fillText(participants.includes(me.id)?'You are out. Watching the rest of the match.':'Watching this match.',VIEW.w/2,110); }
  g.textAlign='left';
}

/* ---------- UI ---------- */
function buildRoster(){
  const box=$('gRoster'); box.replaceChildren();
  for(const ch of ROSTER){
    const b=document.createElement('button'); b.type='button'; b.dataset.id=ch.id; b.title=`${ch.name}: ${ch.type}, ${MOVE_TXT[ch.move]}`;
    const cv=document.createElement('canvas'); cv.width=128; cv.height=104;
    const sp=document.createElement('span'); sp.textContent=ch.name;
    b.append(cv,sp); b.onclick=()=>pick(ch.id); box.append(b);
    const g=cv.getContext('2d'); g.scale(2,2); g.translate(32,50); g.scale(0.7,0.7); drawFighter(g,ch,0,0,1,0);
  }
  markPick();
}
function markPick(){
  for(const b of $('gRoster').children) b.classList.toggle('sel',b.dataset.id===me.c);
  const ch=CH[me.c], bar=v=>'●'.repeat(Math.round(v*4))+'○'.repeat(Math.max(0,6-Math.round(v*4)));
  $('gPick').textContent=`${ch.name} · ${ch.type} type · attack: ${MOVE_TXT[ch.move]}\nSpeed ${bar(ch.spd)}  Weight ${bar(ch.wt)}  Jump ${bar(ch.jmp)}`;
}
function buildArenas(){
  const box=$('gArenas'); box.replaceChildren();
  for(const ar of ARENAS){
    const b=document.createElement('button'); b.type='button'; b.dataset.id=ar.id; b.title=ar.desc;
    const cv=document.createElement('canvas'); cv.width=240; cv.height=135;
    const sp=document.createElement('span'); sp.textContent=ar.name;
    b.append(cv,sp); b.onclick=()=>pickArena(ar.id); box.append(b);
    const g=cv.getContext('2d'); g.scale(240/VIEW.w,135/VIEW.h); drawStage(g,ar,0);
  }
  markArena();
}
function markArena(){
  const box=$('gArenas'); if(!box||!A) return;
  for(const b of box.children) b.classList.toggle('sel',b.dataset.id===A.id);
  const ga=$('gArenaInfo'); if(ga) ga.textContent=`${A.name}: ${A.desc}`;
}
function pickArena(id){
  if(phase!=='free'){ msg('You can change the arena after the match.',true); return; }
  setArena(id); prefs(true); dummy=null;
  me.body=spawnBody(me.c,A.spawn[0]);
  if(client?.connected){ client.publish(`${base}/c`,JSON.stringify({type:'arena',a:id,by:me.id,n:me.name}),{qos:1}); msg(`Arena set to ${A.name} for everyone in the room.`); }
}
function pick(id){
  if(phase!=='free'){ msg('You can change fighters after the match.',true); return; }
  me.c=id; if(me.body) me.body.c=id; dummy=null; prefs(true); markPick();
}
function isTyping(e){ const t=e.target; return (t instanceof HTMLInputElement&&t.type!=='checkbox')||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement; }
window.addEventListener('keydown',e=>{
  if(EMG().activeTab()!=='tabGame'||isTyping(e)) return;
  const k=e.key.toLowerCase();
  if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
  if(!e.repeat){
    if(k==='w'||k==='arrowup'||k===' ') jumpQ=true;
    if(k==='s'||k==='arrowdown') downQ=true;
    if(k==='j'&&$('gKeyAtk').checked) doAttack();
  }
  keys[k]=true;
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
window.addEventListener('emgtap',()=>{ tapFlash=performance.now(); if(EMG().activeTab()==='tabGame') doAttack(); });

function init(){
  prefs(); buildRoster(); buildArenas();
  $('gJoin').onclick=join; $('gLeave').onclick=leave;
  $('gNewRoom').onclick=()=>{ $('gRoom').value='ARENA-'+EMG().randCode(6); prefs(true); };
  $('gCopy').onclick=()=>navigator.clipboard.writeText($('gRoom').value).then(()=>msg('Room code copied. Send it to the people you want to play with.'),()=>msg('Copy failed. Select the code and copy it by hand.',true));
  $('gName').onchange=()=>{ me.name=$('gName').value.trim().slice(0,16); prefs(true); };
  $('gStartMatch').onclick=()=>{
    if(!client?.connected){ msg('Not connected yet.',true); return; }
    if(phase==='countdown'||phase==='fight'){ msg('A match is already running.'); return; }
    const now=performance.now(), ids=[me.id,...[...remotes.entries()].filter(([,r])=>now-r.recv<3000).map(([id])=>id)];
    if(ids.length<2){ msg('You need at least one other player in the arena. Send them the room code.',true); return; }
    client.publish(`${base}/c`,JSON.stringify({type:'start',m:EMG().randCode(6),ids,a:A.id}),{qos:1});
  };
  const v3=$('gView3d'); if(v3){ v3.checked=use3d; v3.onchange=()=>{ use3d=v3.checked; try{ localStorage.setItem('emgPosture.brawl3d',use3d?'1':'0'); }catch{} }; }
  me.name=$('gName').value.trim().slice(0,16);
  me.body=spawnBody(me.c,A.spawn[0]);
  requestAnimationFrame(loop);
}
init();
window.TapBrawl={ROSTER,ARENAS,step,applyHit,spawnBody,doAttack,pickArena,_state:()=>({me,dummy,projs,phase,remotes,arena:A})}; // for testing
})();
