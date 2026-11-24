// Eye control: webcam gaze tracking (WebGazer, runs in this browser) + "click where I look" with a foot tap.
// Talks to the page only through window.EMG and the 'emgtap' window event.
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const EMG=()=>window.EMG;
const WG_URL='https://cdn.jsdelivr.net/npm/webgazer@3.3.0/dist/webgazer.js';
const CLICKABLE='button, input[type=checkbox], select, .eye-target, [role=button]';
// 13 points: the 9-point grid plus 4 inner points, ordered as a snake so the eyes never jump far between dots
const CAL_PTS=[[8,10],[50,10],[92,10],[71,30],[29,30],[8,50],[50,50],[92,50],[71,70],[29,70],[8,90],[50,90],[92,90]];
const HITS_PER_DOT=3, SAMPLES_PER_HIT=8, SAMPLE_GAP=55, SETTLE=140; // samples are taken after the eyes have settled on the dot
const S={running:false,sm:null,raw:null,frames:0,fps:0,calib:null,check:null,hover:null,test:null,acc:null,lastRead:0,lastGaze:0,lost:false,bias:{x:0,y:0},med:[],fx:null,fy:null,lastPick:0,hist:[],r:90,cands:[],best:null,lastBest:null,dwell:{el:null,t0:0},lastDwellClick:0,forceDwell:false,candEls:new Set()};

/* One-Euro filter: heavy smoothing while the eyes rest on something, almost no lag while they move. */
class OneEuro{
  constructor(){ this.px=null; this.pr=null; this.dx=0; this.pt=0; }
  static a(c,dt){ const tau=1/(2*Math.PI*c); return 1/(1+tau/dt); }
  reset(){ this.px=null; }
  step(v,t,minC,beta){
    if(this.px==null){ this.px=v; this.pr=v; this.dx=0; this.pt=t; return v; }
    const dt=Math.max(0.004,Math.min(0.25,(t-this.pt)/1000)); this.pt=t;
    this.dx+=OneEuro.a(1,dt)*((v-this.pr)/dt-this.dx); this.pr=v;
    this.px+=OneEuro.a(minC+beta*Math.abs(this.dx),dt)*(v-this.px); return this.px;
  }
}
S.fx=new OneEuro(); S.fy=new OneEuro(); S.map={ax:1,bx:0,ay:1,by:0}; S.frame=null; S.quality={score:100,tips:[]}; loadMap();
const median=a=>{ const b=[...a].sort((x,y)=>x-y), n=b.length; return n%2?b[n>>1]:(b[n/2-1]+b[n/2])/2; };

function msg(t,err){ const m=$('eyMsg'); m.textContent=t; m.classList.toggle('err',!!err); }
function loadScript(src){ return new Promise((res,rej)=>{ if(window.webgazer) return res();
  const s=document.createElement('script'); s.src=src; s.onload=()=>res(); s.onerror=()=>rej(new Error('load failed')); document.head.appendChild(s); }); }

/* ---------- tracking ---------- */
async function start(){
  if(S.running) return;
  $('eyStart').disabled=true; msg('Loading the eye tracker. The first time takes a little while.');
  try{ await loadScript(WG_URL); }catch{ msg('Could not load the eye-tracking library. Check your internet connection.',true); $('eyStart').disabled=false; return; }
  try{
    webgazer.saveDataAcrossSessions(true); // calibration is kept in this browser for next time
    await webgazer.setRegression('ridge').setGazeListener(onGaze).begin();
    webgazer.removeMouseEventListeners(); // only deliberate calibration samples train the model
    // our own median + One-Euro filter replaces WebGazer's Kalman filter (less lag, less jitter); the face overlay is skipped to save CPU
    webgazer.showVideoPreview($('eyPreview').checked).showPredictionPoints(false).applyKalmanFilter(false);
    try{ webgazer.showFaceOverlay(false).showFaceFeedbackBox(false); }catch{}
  }catch(e){ msg(`The camera didn't start (${e?.message||e}). Allow camera access for this page and try again.`,true); $('eyStart').disabled=false; return; }
  S.fx.reset(); S.fy.reset(); S.med=[]; S.lastGaze=performance.now(); S.lost=false;
  adoptFs(); if(!S.frame) S.frame={...viewFrame(),w:innerWidth,h:innerHeight}; S.running=true; $('eyStop').disabled=false; $('eyCalib').disabled=false; $('eyTest').disabled=false;
  msg('Tracking. Calibrate now, or skip it if you calibrated before and the cursor already follows your eyes.');
}
function stop(){
  try{ webgazer.end(); }catch{}
  S.running=false; S.sm=null; S.raw=null; setHover(null); endCalib();
  $('eyStart').disabled=false; $('eyStop').disabled=true; $('eyCalib').disabled=true;
  msg('Eye tracking stopped and the camera is off.');
}
/* The model predicts in the window position it was trained in. If the window moved or went fullscreen since, shift predictions by the difference.
   After calibration an affine correction (scale + offset per axis, fitted from 5 check dots) removes systematic error, kept in the browser for next time. */
const MAPKEY='emgPosture.eyeMap';
function viewFrame(){ const bw=Math.max(0,(outerWidth-innerWidth)/2); return {ox:(window.screenX??window.screenLeft??0)+bw,oy:(window.screenY??window.screenTop??0)+Math.max(0,outerHeight-innerHeight-bw)}; }
function frameOff(){ if(!S.frame) return {x:0,y:0}; const f=viewFrame(); return {x:S.frame.ox-f.ox,y:S.frame.oy-f.oy}; }
const toTrain=(x,y)=>{ const o=frameOff(); return [x-o.x,y-o.y]; };
function loadMap(){ try{ const m=JSON.parse(localStorage.getItem(MAPKEY)||'null'); if(m){ if(m.map) S.map=m.map; if(m.bias) S.bias=m.bias; if(m.frame) S.frame=m.frame; if(m.acc!=null) S.acc=m.acc; } }catch{} }
function saveMap(){ try{ localStorage.setItem(MAPKEY,JSON.stringify({map:S.map,bias:S.bias,frame:S.frame,acc:S.acc})); }catch{} }
function saveMapSoon(){ clearTimeout(S.saveT); S.saveT=setTimeout(saveMap,1500); }
function onGaze(data){
  if(!data||!S.running) return;
  const now=performance.now(); S.frames++; S.lastGaze=now;
  if(S.lost){ S.lost=false; msg('Face found again.'); }
  const off=frameOff(); S.raw={x:data.x+off.x,y:data.y+off.y};
  // 1) median over the last ~170 ms (at least 3 samples) removes blink spikes without adding lag at low frame rates
  S.med.push({x:S.raw.x,y:S.raw.y,t:now}); while(S.med.length>3&&now-S.med[0].t>170) S.med.shift(); if(S.med.length>9) S.med.shift();
  const mx=median(S.med.map(p=>p.x)), my=median(S.med.map(p=>p.y));
  if(S.check) S.check.pts.push({x:mx,y:my,t:now}); // measured before any correction
  // 2) affine correction from the last calibration, then the small offset learned from clicks
  const W=innerWidth, H=innerHeight, bx=(S.map.ax*(mx/W)+S.map.bx)*W-S.bias.x, by=(S.map.ay*(my/H)+S.map.by)*H-S.bias.y;
  // 3) adaptive smoothing: the Smoothing setting (1 to 20) sets the resting cutoff
  const sv=Math.max(1,Math.min(20,+$('eySmooth').value||4)), minC=3.2/sv, beta=0.006;
  S.sm={x:Math.max(0,Math.min(innerWidth,S.fx.step(bx,now,minC,beta))),y:Math.max(0,Math.min(innerHeight,S.fy.step(by,now,minC,beta)))};
  S.hist.push({x:bx,y:by,t:now}); while(S.hist.length&&now-S.hist[0].t>900) S.hist.shift();
}
/* ---------- the gaze region ----------
   Eye trackers are never accurate to a pixel, so instead of one point the cursor is a region. Its radius grows with how much the gaze has been
   wandering over the last second and with the error measured at calibration, and shrinks when you fixate. Buttons are chosen by how much of the region they cover. */
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
function regionTarget(){
  const h=S.hist; if(h.length<4) return S.r;
  let mx=0,my=0; for(const p of h){ mx+=p.x; my+=p.y; } mx/=h.length; my/=h.length;
  let v=0; for(const p of h) v+=(p.x-mx)**2+(p.y-my)**2; const sd=Math.sqrt(v/h.length);
  const acc=S.acc??90, k=+($('eyRegionScale')?.value||1);
  return clampN(1.3*Math.sqrt(sd*sd+(0.6*acc)**2+28*28)*k,44*Math.min(1,k),200*Math.max(1,k));
}
function pickRegion(x,y,r){
  const root=document.fullscreenElement||document, out=[], circ=Math.PI*r*r;
  for(const c of root.querySelectorAll(CLICKABLE)){
    if(c.disabled||c.closest('.calib-layer')||!shown(c)) continue;
    const b=c.getBoundingClientRect(); if(b.right<x-r||b.left>x+r||b.bottom<y-r||b.top>y+r) continue;
    const x0=Math.max(b.left,x-r), x1=Math.min(b.right,x+r), y0=Math.max(b.top,y-r), y1=Math.min(b.bottom,y+r); if(x1<=x0||y1<=y0) continue;
    const N=6; let hit=0; for(let i=0;i<N;i++) for(let j=0;j<N;j++){ const px=x0+(i+0.5)*(x1-x0)/N, py=y0+(j+0.5)*(y1-y0)/N; if((px-x)**2+(py-y)**2<=r*r) hit++; }
    const ov=hit/(N*N)*(x1-x0)*(y1-y0); if(ov<=0) continue;
    const cover=ov/Math.min(b.width*b.height,circ), cd=Math.hypot(b.left+b.width/2-x,b.top+b.height/2-y), near=1-Math.min(1,cd/(r+Math.max(b.width,b.height)/2)), inside=x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
    out.push({el:c,cover,score:cover*0.6+near*0.35+(inside?0.25:0)+(c===S.lastBest?0.08:0)}); // the previous choice gets a small bonus so the highlight doesn't flicker
  }
  out.sort((a,b)=>b.score-a.score); return out.slice(0,8);
}
const regionOn=()=>!$('eyRegion')||$('eyRegion').checked;
function currentPick(){
  if(!S.sm) return null;
  if(regionOn()){ const l=pickRegion(S.sm.x,S.sm.y,S.r); S.cands=l; const b=l[0]&&l[0].score>=0.2?l[0].el:null; S.best=b; if(b) S.lastBest=b; return b; }
  S.cands=[]; S.best=pickTarget(S.sm.x,S.sm.y); return S.best;
}

/* ---------- picking what to click ---------- */
function shown(el){ if(el.offsetParent===null) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; }
function pickTarget(x,y){
  let el=document.elementFromPoint(x,y); el=el?.closest?.(CLICKABLE)||null;
  if(el&&!el.disabled&&!el.closest('.calib-layer')) return el;
  if(!$('eySnap').checked) return null;
  let best=null, bd=Math.max(0,+$('eySnapR').value||90);
  for(const c of document.querySelectorAll(CLICKABLE)){
    if(c.disabled||c.closest('.calib-layer')||!shown(c)) continue;
    const r=c.getBoundingClientRect(), dx=Math.max(r.left-x,0,x-r.right), dy=Math.max(r.top-y,0,y-r.bottom), d=Math.hypot(dx,dy);
    if(d<bd){ bd=d; best=c; }
  }
  return best;
}
function setHover(el){ if(S.hover!==el){ S.hover?.classList.remove('gaze-hover'); S.hover?.style.removeProperty('--dwell'); S.hover=el; el?.classList.add('gaze-hover'); }
  const want=new Set(S.cands.filter(c=>c.cover>=0.06&&c.el!==el).map(c=>c.el)); for(const e of S.candEls) if(!want.has(e)) e.classList.remove('gaze-cand'); for(const e of want) e.classList.add('gaze-cand'); S.candEls=want; }
function scanTargets(now){
  let el=null; if(clicksAllowed()) el=currentPick(); else { S.cands=[]; S.best=null; }
  setHover(el);
  const ms=clampN(+($('eyDwellMs')?.value)||1000,400,3000), dwellOn=($('eyDwell')?.checked||S.forceDwell)&&clicksAllowed();
  if(!dwellOn||!el){ S.dwell={el:null,t0:now}; return; }
  if(S.dwell.el!==el){ S.dwell={el,t0:now}; el.style.removeProperty('--dwell'); return; }
  const p=Math.min(1,(now-S.dwell.t0)/ms); el.style.setProperty('--dwell',p.toFixed(2));
  if(p>=1&&now-S.lastDwellClick>700){ S.lastDwellClick=now; S.dwell={el:null,t0:now}; el.style.removeProperty('--dwell'); activate(el); }
}
const flying=()=>!!window.SkyRace?.eyeSteering?.(); // Sky Race steers with the gaze, so taps there don't click buttons
function clicksAllowed(){ return S.running&&S.sm&&$('eyClick').checked&&!S.calib&&EMG().activeTab()!=='tabGame'&&!flying(); }

function eyeClick(){
  if(S.calib){ calibHit(); return; }
  if(!clicksAllowed()) return;
  activate(currentPick());
}
function activate(el){
  const cur=$('eyCursor'); cur.classList.add('flash'); setTimeout(()=>cur.classList.remove('flash'),150);
  const T=S.test;
  if(T?.running){
    if(el&&el===T.target){ const r=el.getBoundingClientRect(); T.errs.push(Math.hypot(S.sm.x-(r.left+r.width/2),S.sm.y-(r.top+r.height/2))); }
    else { T.miss++; showTest(); }
  }
  if(!el) return;
  driftFrom(el); learnFromClick(el);
  if(el.tagName==='SELECT') el.focus(); else el.click();
}
// A confident click on a small target also nudges the offset, so slow head drift corrects itself.
function driftFrom(el){
  if(!regionOn()||!S.sm||S.cands[0]?.el!==el||S.cands[0].cover<0.5) return; const r=el.getBoundingClientRect(); if(Math.max(r.width,r.height)>S.r*2) return;
  const ex=S.sm.x-(r.left+r.width/2), ey=S.sm.y-(r.top+r.height/2); if(Math.hypot(ex,ey)>S.r*0.8) return;
  S.bias={x:clampN(S.bias.x+ex*0.15,-innerWidth*0.15,innerWidth*0.15),y:clampN(S.bias.y+ey*0.15,-innerHeight*0.15,innerHeight*0.15)}; saveMapSoon();
}
// Every successful click is a free calibration sample: you were looking at that button, so teach the model where it is.
function learnFromClick(el){
  if(!$('eyLearn')?.checked) return;
  const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
  const dx=Math.max(r.left-S.sm.x,0,S.sm.x-r.right), dy=Math.max(r.top-S.sm.y,0,S.sm.y-r.bottom);
  if(Math.hypot(dx,dy)>Math.max(70,S.r*0.8)) return; // too far off: probably a wrong pick, don't learn from it
  const cx=Math.max(r.left,Math.min(r.right,S.sm.x*0.35+(r.left+r.width/2)*0.65)), cy=Math.max(r.top,Math.min(r.bottom,S.sm.y*0.35+(r.top+r.height/2)*0.65));
  const [tx,ty]=toTrain(cx,cy); for(let k=0;k<3;k++) setTimeout(()=>{ try{ webgazer.recordScreenPosition(tx,ty,'click'); }catch{} },k*50);
}

/* ---------- calibration ---------- */
const CHECK=[[50,50],[12,50],[88,50],[50,14],[50,86]];
function calibrate(){
  if(!S.running){ msg('Start eye tracking first.',true); return; }
  const fr=viewFrame(), f=S.frame;
  if(f&&(Math.abs(f.ox-fr.ox)+Math.abs(f.oy-fr.oy)>40||Math.abs((f.w||innerWidth)-innerWidth)>120||Math.abs((f.h||innerHeight)-innerHeight)>120)){ try{ webgazer.clearData(); }catch{} } // data from another window layout would only confuse the model
  S.frame={...fr,w:innerWidth,h:innerHeight}; S.bias={x:0,y:0}; S.map={ax:1,bx:0,ay:1,by:0};
  S.calib={i:0,hits:0,phase:'dots',k:0}; $('eyCalibLayer').hidden=false; renderCalib();
}
const autoOn=()=>!!$('eyAuto')?.checked;
function renderCalib(){
  const L=$('eyCalibLayer'), c=S.calib;
  for(const d of [...L.querySelectorAll('.cal-dot')]) d.remove();
  const pts=c.phase==='check'?[CHECK[c.k||0]]:CAL_PTS;
  pts.forEach(([px,py],i)=>{
    const d=document.createElement('button'); d.type='button'; d.className='cal-dot'+(c.phase==='check'||i===c.i?' current':i<c.i?' done':'');
    d.style.left=px+'%'; d.style.top=py+'%'; d.setAttribute('aria-label',`Calibration dot ${i+1}`);
    if(c.phase!=='check'&&i===c.i) d.onclick=calibHit;
    L.append(d);
  });
  $('eyCalibText').textContent=c.phase==='check'
    ?`Keep looking at the dot. Checking accuracy · point ${(c.k||0)+1} of ${CHECK.length}`
    :autoOn()?`Look straight at the glowing dot. It advances by itself · dot ${c.i+1} of ${CAL_PTS.length} · Esc cancels`
    :`Look straight at the glowing dot and tap your foot, or click it. ${HITS_PER_DOT-c.hits} more for this dot · dot ${c.i+1} of ${CAL_PTS.length} · Esc cancels`;
  if(c.phase==='dots'&&autoOn()){ clearTimeout(c.timer); c.timer=setTimeout(()=>{ if(S.calib===c&&c.phase==='dots') calibHit(); },c.hits===0?950:450); }
}
function calibHit(){
  const c=S.calib; if(!c||c.phase!=='dots') return;
  const [px,py]=CAL_PTS[c.i], x=innerWidth*px/100, y=innerHeight*py/100;
  // wait for the eyes to settle after the tap, then take several frames while you keep looking
  for(let k=0;k<SAMPLES_PER_HIT;k++) setTimeout(()=>{ try{ webgazer.recordScreenPosition(x,y,'click'); }catch{} },SETTLE+k*SAMPLE_GAP);
  c.hits++;
  if(c.hits>=HITS_PER_DOT){ c.i++; c.hits=0; if(c.i>=CAL_PTS.length){ clearTimeout(c.timer); startCheck(); return; } }
  renderCalib();
}
function startCheck(){ const c=S.calib; c.phase='check'; c.k=0; S.check={pts:[],res:[],t0:performance.now()}; renderCalib(); stepCheck(); }
function stepCheck(){
  const c=S.calib; if(!c||!S.check) return; const k=c.k, t0=performance.now(); S.check.pts=[];
  setTimeout(()=>{
    if(!S.check||S.calib!==c) return;
    const pts=S.check.pts.filter(p=>p.t>t0+650); S.check.res[k]=pts.length>=3?{x:median(pts.map(p=>p.x)),y:median(pts.map(p=>p.y))}:null;
    c.k++; if(c.k>=CHECK.length){ finishCheck(); return; } renderCalib(); stepCheck();
  },1500);
}
function fitAxis(m,t){ // least squares t = a*m + b, with the scale kept within a sensible range
  const n=m.length, mm=m.reduce((a,v)=>a+v,0)/n, tm=t.reduce((a,v)=>a+v,0)/n; let sxx=0,sxy=0; for(let i=0;i<n;i++){ sxx+=(m[i]-mm)**2; sxy+=(m[i]-mm)*(t[i]-tm); }
  const a=clampN(sxx>1e-5?sxy/sxx:1,0.75,1.35); return {a,b:tm-a*mm};
}
function finishCheck(){
  const res=S.check.res, W=innerWidth, H=innerHeight; S.check=null;
  if(res.filter(Boolean).length<3||!res[0]){ S.fx.reset(); S.fy.reset(); S.med=[]; endCalib(); msg('No gaze data during the check. Make sure your face is visible to the camera, then calibrate again.',true); return; }
  const xi=[0,1,2].filter(i=>res[i]), yi=[0,3,4].filter(i=>res[i]);
  const fx=xi.length>=2?fitAxis(xi.map(i=>res[i].x/W),xi.map(i=>CHECK[i][0]/100)):{a:1,b:0.5-res[0].x/W}, fy=yi.length>=2?fitAxis(yi.map(i=>res[i].y/H),yi.map(i=>CHECK[i][1]/100)):{a:1,b:0.5-res[0].y/H};
  S.map={ax:1+(fx.a-1)*0.85,bx:clampN(fx.b*0.85,-0.2,0.2),ay:1+(fy.a-1)*0.85,by:clampN(fy.b*0.85,-0.2,0.2)}; S.bias={x:0,y:0}; // blended toward the fit so one bad dot can't throw the mapping off
  let err=0,n=0; for(let i=0;i<CHECK.length;i++){ if(!res[i]) continue; const cx=(S.map.ax*(res[i].x/W)+S.map.bx)*W, cy=(S.map.ay*(res[i].y/H)+S.map.by)*H; err+=Math.hypot(cx-CHECK[i][0]/100*W,cy-CHECK[i][1]/100*H); n++; }
  S.acc=err/n; S.fx.reset(); S.fy.reset(); S.med=[]; S.hist=[]; endCalib(); saveMap();
  const pct=S.acc/W*100;
  $('eyAcc').textContent=`Last calibration: average error ${Math.round(S.acc)} px after correction (${pct.toFixed(1)}% of the window width), checked at 5 points. Scale correction ${fx.a.toFixed(2)}× / ${fy.a.toFixed(2)}×.`;
  msg(pct<6?'Calibration done. Excellent accuracy. Foot taps (or dwelling) now select where you look.'
    :pct<10?'Calibration done. Good accuracy. Selection works on the region you look at, and every click improves it.'
    :'Calibration done, but accuracy is rough. Better lighting on your face, a steadier head or calibrating again will help. The gaze region grows to make up for it.');
}
function endCalib(){ if(S.calib) clearTimeout(S.calib.timer); S.calib=null; $('eyCalibLayer').hidden=true; }
/* In fullscreen only the fullscreen element and its children are drawn, so the gaze region, the calibration screen and the camera preview move inside it. */
function adoptFs(){ const host=document.fullscreenElement||document.body;
  for(const id of ['eyCursor','eyCalibLayer','webgazerVideoContainer']){ const n=document.getElementById(id); if(n&&n.parentNode!==host) host.appendChild(n); }
  if(S.test?.running&&S.test.target){ const A=$('eyArena'), b=S.test.target; b.style.left=Math.round(10+Math.random()*Math.max(0,A.clientWidth-90))+'px'; b.style.top=Math.round(10+Math.random()*Math.max(0,A.clientHeight-90))+'px'; } }
document.addEventListener('fullscreenchange',()=>{ adoptFs(); setTimeout(()=>{ if(!S.running||!S.frame) return; const fr=viewFrame(); if(Math.abs(S.frame.ox-fr.ox)+Math.abs(S.frame.oy-fr.oy)>40||Math.abs((S.frame.w||innerWidth)-innerWidth)>120) msg('The window changed (fullscreen or moved). Gaze is shifted to match; calibrate again here for the best accuracy.'); },400); });

/* ---------- target practice ---------- */
function startTest(){
  if(!S.running){ msg('Start eye tracking first.',true); return; }
  S.test={running:true,n:10,i:0,miss:0,times:[],errs:[],target:null,t0:0};
  $('eyResults').innerHTML=''; nextTarget();
}
function nextTarget(){
  const T=S.test; if(T.i>=T.n){ finishTest(); return; }
  const A=$('eyArena'), size=70, w=A.clientWidth, h=A.clientHeight;
  const b=document.createElement('button'); b.type='button'; b.className='eye-target'; b.textContent=String(T.i+1);
  b.style.left=Math.round(10+Math.random()*Math.max(0,w-size-20))+'px'; b.style.top=Math.round(10+Math.random()*Math.max(0,h-size-20))+'px';
  b.onclick=()=>hitTarget(b);
  A.replaceChildren(b); T.target=b; T.t0=performance.now(); showTest();
}
function hitTarget(b){ const T=S.test; if(!T?.running||b!==T.target) return; T.times.push((performance.now()-T.t0)/1000); T.i++; nextTarget(); }
function showTest(){ const T=S.test; if(!T) return; const t=T.running?`Target ${Math.min(T.i+1,T.n)} of ${T.n} · misses ${T.miss}`:'Done'; $('eyTestInfo').textContent=t; $('eyArena').dataset.info=t; }
function finishTest(){
  const T=S.test; T.running=false; T.target=null;
  $('eyArena').innerHTML='<div class="small">Test finished. Start again to retry.</div>';
  const avgT=T.times.reduce((a,b)=>a+b,0)/Math.max(1,T.times.length), avgE=T.errs.length?T.errs.reduce((a,b)=>a+b,0)/T.errs.length:null;
  const acc=T.n/(T.n+T.miss)*100;
  $('eyResults').innerHTML=`<table><tr><th style="text-align:left">Result</th><th>Value</th></tr>
    <tr><td style="text-align:left">Targets hit</td><td>${T.n}</td></tr>
    <tr><td style="text-align:left">Missed taps (clicked nothing or the wrong thing)</td><td>${T.miss}</td></tr>
    <tr><td style="text-align:left">Click accuracy</td><td>${acc.toFixed(0)}%</td></tr>
    <tr><td style="text-align:left">Average time per target</td><td>${avgT.toFixed(2)} s</td></tr>
    <tr><td style="text-align:left">Average gaze distance from target centre at click</td><td>${avgE==null?'–':Math.round(avgE)+' px'}</td></tr></table>`;
  showTest();
}

/* ---------- tracking quality: brightness, face size and position, frame rate, jitter ---------- */
function qualityTick(){
  const tips=[]; let score=100, sd=null; const h=S.hist;
  if(h.length>=4){ let mx=0,my=0; for(const p of h){ mx+=p.x; my+=p.y; } mx/=h.length; my/=h.length; let v=0; for(const p of h) v+=(p.x-mx)**2+(p.y-my)**2; sd=Math.sqrt(v/h.length); }
  if(S.fps&&S.fps<8){ score-=30; tips.push('The tracker is running slowly: close other tabs.'); }
  if(sd!=null&&sd>120){ score-=20; tips.push('Gaze is jumpy: keep your head steady and your face evenly lit.'); }
  try{
    const v=document.getElementById('webgazerVideoFeed');
    if(v&&v.videoWidth){ const c=S.qc||(S.qc=document.createElement('canvas')); c.width=32; c.height=24; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(v,0,0,32,24); const d=g.getImageData(0,0,32,24).data; let l=0; for(let i=0;i<d.length;i+=4) l+=0.3*d[i]+0.59*d[i+1]+0.11*d[i+2]; l/=d.length/4;
      if(l<55){ score-=25; tips.push('Too dark: light your face from the front.'); } else if(l>205){ score-=15; tips.push('Too bright or backlit: avoid a window behind you.'); }
      const pos=window.webgazer?.getTracker?.()?.getPositions?.();
      if(pos&&pos.length>10){ let x0=1e9,x1=-1e9; for(const p of pos){ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); } const fw=(x1-x0)/v.videoWidth, cx=(x0+x1)/2/v.videoWidth;
        if(fw<0.2){ score-=15; tips.push('Move a little closer to the screen.'); } else if(fw>0.62){ score-=10; tips.push('Move back a little.'); }
        if(Math.abs(cx-0.5)>0.22){ score-=10; tips.push('Centre your face in the camera view.'); } } }
  }catch{}
  if(S.lost){ score=10; tips.unshift("Can't see your face."); }
  S.quality={score:Math.max(0,score),tips};
}
/* ---------- loop + wiring ---------- */
function frame(now){
  requestAnimationFrame(frame);
  const cur=$('eyCursor'), on=S.running&&S.sm&&$('eyCursorOn').checked&&!S.calib&&!flying();
  cur.hidden=!on;
  if(S.running) S.r+=(regionTarget()-S.r)*0.12;
  if(on){ cur.style.transform=`translate(${Math.round(S.sm.x-100)}px,${Math.round(S.sm.y-100)}px) scale(${(regionOn()?S.r:18)/100})`; cur.classList.toggle('locked',!!S.best); }
  if(now-S.lastPick>70){ S.lastPick=now; scanTargets(now); } // scanning every button each frame made the page laggy
  if(S.running&&!S.lost&&!S.calib&&S.lastGaze&&now-S.lastGaze>2000){ S.lost=true; msg("Can't see your face. Check the lighting and that nothing covers the camera.",true); }
  if(now-S.lastRead>1000){ S.fps=S.frames; S.frames=0; S.lastRead=now; }
  if(now-(S.qT||0)>1500){ S.qT=now; if(S.running) qualityTick(); }
  if(EMG().activeTab()==='tabEyes'){
    $('eyXY').textContent=S.sm?`${Math.round(S.sm.x)}, ${Math.round(S.sm.y)} · region ±${Math.round(S.r)} px`:'–';
    $('eyFps').textContent=S.running?String(S.fps):'–';
    const q=S.quality; $('eyQuality').textContent=S.running?`Tracking quality: ${q.score>=75?'good':q.score>=50?'fair':'poor'} (${q.score}%)${q.tips.length?' · '+q.tips.join(' '):''}`:'';
    $('eyErr').textContent=S.acc==null?'–':`${Math.round(S.acc)} px`;
    const ready=EMG().tapReady(); $('eyTapS').textContent=ready?'Ready':'Off';
    $('eyTap').textContent=ready?'Foot tap is ready.':'Foot tap is off: train a model on the Foot tap tab and connect a signal. Until then, click calibration dots with the mouse or turn on the K key.';
  }
}
function isTyping(e){ const t=e.target; return (t instanceof HTMLInputElement&&t.type!=='checkbox')||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement; }
window.addEventListener('emgtap',eyeClick);
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.calib){ S.check=null; endCalib(); msg('Calibration cancelled.'); return; }
  if(e.key.toLowerCase()==='k'&&!e.repeat&&$('eyKey').checked&&!isTyping(e)) eyeClick();
});
$('eyStart').onclick=start;
$('eyStop').onclick=stop;
$('eyCalib').onclick=calibrate;
$('eyTest').onclick=startTest;
$('eyClear').onclick=()=>{ try{ window.webgazer?.clearData(); }catch{} try{ localStorage.removeItem('webgazerGlobalData'); }catch{} S.acc=null; S.bias={x:0,y:0}; S.map={ax:1,bx:0,ay:1,by:0}; try{ localStorage.removeItem(MAPKEY); }catch{} $('eyAcc').textContent=''; msg('Saved calibration cleared. Calibrate again before using eye clicks.'); };
$('eyPreview').onchange=()=>{ if(S.running) webgazer.showVideoPreview($('eyPreview').checked); };
requestAnimationFrame(frame);
window.EyeControl={_state:()=>S,pickTarget,pickRegion,eyeClick,start,calibrate,adoptFs,
  running:()=>S.running, calibrating:()=>!!S.calib,
  forceDwell:on=>{ S.forceDwell=!!on; }, // the in-game menu turns dwell selection on so it works without a foot tap
  recenter:(cx,cy)=>{ if(!S.sm) return false; S.bias={x:clampN(S.bias.x+S.sm.x-cx,-innerWidth*0.15,innerWidth*0.15),y:clampN(S.bias.y+S.sm.y-cy,-innerHeight*0.15,innerHeight*0.15)}; S.fx.reset(); S.fy.reset(); S.med=[]; S.hist=[]; return true; }, // "I'm looking at the middle right now"
  quality:()=>S.quality,
  gaze:()=>S.running&&S.sm&&!S.calib?{x:S.sm.x,y:S.sm.y,r:regionOn()?S.r:18}:null}; // gaze is used by Sky Race steering
})();
