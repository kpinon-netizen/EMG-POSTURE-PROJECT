// Eye control: webcam gaze tracking (WebGazer, runs in this browser) + "click where I look" with a foot tap.
// Talks to the page only through window.EMG and the 'emgtap' window event.
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const EMG=()=>window.EMG;
const WG_URL='https://cdn.jsdelivr.net/npm/webgazer@3.3.0/dist/webgazer.js';
const CLICKABLE='button, input[type=checkbox], select, .eye-target, [role=button]';
// 13 points: the 9-point grid plus 4 inner points, ordered as a snake so the eyes never jump far between dots
const Z4=[0,0,0,0];
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
S.cond={}; S.pending=null; S.fx=new OneEuro(); S.fy=new OneEuro(); S.map=IDMAP(); S.ears=[]; S.hw=newHw(); S.head0=null; S.lam=null; S.rej=0; S.blinkAt=-1e9; S.head=null; S.frame=null; S.quality={score:100,tips:[]}; loadMap();
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
  if(S.pending){ const f=S.pending; S.pending=null; f(); }
  if(S.lam!=null) setLam(S.lam); // WebGazer starts from its own default every time
  if(S.acc==null){ const p=priors(); if(p) S.acc=p.acc; } // first region size comes from earlier calibrations
  S.fx.reset(); S.fy.reset(); S.med=[]; S.lastGaze=performance.now(); S.lost=false;
  adoptFs(); if(!S.frame) S.frame={...viewFrame(),w:innerWidth,h:innerHeight}; S.running=true; $('eyStop').disabled=false; $('eyCalib').disabled=false; $('eyTest').disabled=false;
  msg('Tracking. Calibrate now, or skip it if you calibrated before and the cursor already follows your eyes.');
}
function stop(){
  if(S.running&&curProfile()) saveProfile(curProfile(),true);
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
function loadMap(){ try{ const m=JSON.parse(localStorage.getItem(MAPKEY)||'null'); if(m){ if(m.map) S.map=m.map; if(m.bias) S.bias=m.bias; if(m.frame) S.frame=m.frame; if(m.acc!=null) S.acc=m.acc; if(m.lam!=null) S.lam=m.lam; if(m.head0) S.head0=m.head0; if(m.hw&&m.hw.x&&m.hw.y) S.hw=m.hw; } }catch{} }
function saveMap(){ try{ localStorage.setItem(MAPKEY,JSON.stringify({map:S.map,bias:S.bias,frame:S.frame,acc:S.acc,lam:S.lam,head0:S.head0,hw:S.hw})); }catch{} }
function saveMapSoon(){ clearTimeout(S.saveT); S.saveT=setTimeout(saveMap,1500); }
/* ---------- calibration memory ----------
   Every finished calibration is written to a log (accuracy, scale/offset fit, window size, light, face size, settings). The log is kept in the browser
   (and in "Back up all training"), so the next person starts from what earlier calibrations learned:
     - the first gaze region is sized from past accuracy instead of a fixed guess
     - the affine fit is blended with the typical fit from earlier good runs on a similar window (one odd check dot matters less)
     - if recent runs were rough on this window, calibration takes an extra pass per dot
     - the tips show the light and face distance of the best runs
   Each person can also keep a named profile: their own training samples + correction, restored in one click. */
const LOGKEY='emgPosture.eyeCalLog', PROFKEY='emgPosture.eyeProfiles', CURKEY='emgPosture.eyeProfile', MAXLOG=80, MAXPROF=4, MAXSAMP=420;
const lsGet=(k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); return v??d; }catch{ return d; } };
const lsSet=k=>v=>{ try{ localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v)); return true; }catch{ return false; } };
const getLog=()=>{ const l=lsGet(LOGKEY,[]); return Array.isArray(l)?l:[]; };
const curProfile=()=>localStorage.getItem(CURKEY)||'';
const winKey=()=>({w:innerWidth,h:innerHeight});
const sameWin=r=>r&&Math.abs(r.w-innerWidth)<=innerWidth*0.15&&Math.abs(r.h-innerHeight)<=innerHeight*0.15;
const goodRuns=()=>getLog().filter(r=>r.ok&&r.pct<10);
function priors(){
  const all=getLog().filter(r=>r.ok), win=all.filter(sameWin), use=win.length>=2?win:all;
  if(use.length<2) return null;
  const recent=use.slice(-6), good=use.filter(r=>r.pct<10);
  return {n:use.length,acc:median(recent.map(r=>r.acc)),pct:median(recent.map(r=>r.pct)),
    map:good.length>=3?{ax:median(good.map(r=>r.map.ax)),bx:median(good.map(r=>r.map.bx)),ay:median(good.map(r=>r.map.ay)),by:median(good.map(r=>r.map.by))}:null};
}
const hitsPerDot=()=>{ const p=priors(); return p&&p.pct>8?HITS_PER_DOT+1:HITS_PER_DOT; };
function logCalibration(rec){
  const l=getLog(); l.push({t:Date.now(),who:curProfile(),w:innerWidth,h:innerHeight,smooth:+$('eySmooth').value||4,auto:autoOn()?1:0,hits:hitsPerDot(),...S.cond,...rec});
  while(l.length>MAXLOG) l.shift(); lsSet(LOGKEY)(l); renderHist();
}
function renderHist(){
  const el=$('eyHist'); if(!el) return; const l=getLog().filter(r=>r.ok), p=priors(), best=l.filter(r=>r.pct<6);
  if(!l.length){ el.textContent='No calibrations recorded yet. Each one you finish is saved here and makes the next calibration better.'; return; }
  const last=l.slice(-5).reverse().map(r=>`${new Date(r.t).toLocaleDateString(undefined,{month:'short',day:'numeric'})} ${r.who||'default'}: ${r.pct.toFixed(1)}%`).join(' · ');
  let t=`${l.length} calibration${l.length>1?'s':''} recorded. Typical error ${p?p.pct.toFixed(1):'–'}% of window width. Latest: ${last}.`;
  if(best.length>=2&&best.every(r=>r.light!=null)) t+=` Your best runs had face brightness about ${Math.round(median(best.map(r=>r.light)))}/255 and face width about ${Math.round(100*median(best.map(r=>r.fw)))}% of the camera view.`;
  el.textContent=t;
}
function logCsv(){
  const cols=['t','who','w','h','acc','pct','raw','model','lam','rej','ax','bx','ay','by','light','fw','fps','smooth','auto','hits','ok'];
  const rows=getLog().map(r=>cols.map(c=>{ const v=c in r?r[c]:r.map?.[c]; return c==='t'?new Date(v).toISOString():v==null?'':String(v).replace(/[",\n]/g,' '); }).join(','));
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([cols.join(',')+'\n'+rows.join('\n')],{type:'text/csv'})); a.download='eye-calibration-log.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const b64=u8=>{ let s=''; for(let i=0;i<u8.length;i+=8192) s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192)); return btoa(s); };
const unb64=s=>{ const b=atob(s), u=new Uint8ClampedArray(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; };
function packEye(e){ const o={}; for(const [k,v] of Object.entries(e)){ if(v&&typeof v==='object'&&v.patch?.data){ const q={}; for(const [kk,vv] of Object.entries(v)) if(typeof vv==='number') q[kk]=vv; q.p=b64(new Uint8Array(v.patch.data)); o[k]=q; } else if(typeof v==='number') o[k]=v; } return o; }
function unpackEye(o){ const e={}; for(const [k,v] of Object.entries(o)){ if(v&&typeof v==='object'){ const q={}; for(const [kk,vv] of Object.entries(v)) if(kk!=='p') q[kk]=vv; q.patch={data:unb64(v.p)}; e[k]=q; } else e[k]=v; } return e; }
function profiles(){ const p=lsGet(PROFKEY,{}); return p&&typeof p==='object'&&!Array.isArray(p)?p:{}; }
function saveProfile(name,quiet){
  name=(name||curProfile()||'').trim(); if(!name||!window.webgazer) return false;
  let data=[]; try{ data=(webgazer.getRegression()[0].getData()||[]).filter(d=>d?.eyes&&d.eyes.left?.patch?.data&&d.eyes.right?.patch?.data).slice(-MAXSAMP).map(d=>({e:packEye(d.eyes),s:d.screenPos,ty:d.type})); }catch{}
  if(!data.length&&!S.acc){ return false; }
  const P=profiles(); P[name]={t:Date.now(),map:S.map,bias:S.bias,frame:S.frame,acc:S.acc,lam:S.lam,head0:S.head0,hw:S.hw,data};
  const names=Object.keys(P).sort((a,b)=>P[b].t-P[a].t); for(const n of names.slice(MAXPROF)) if(n!==name) delete P[n];
  let ok=lsSet(PROFKEY)(P);
  for(const n of Object.keys(P).sort((x,y)=>P[x].t-P[y].t)){ if(ok) break; if(n===name) continue; delete P[n]; ok=lsSet(PROFKEY)(P); }
  if(!ok){ if(!quiet) msg('The browser has no room to save this profile. Delete an old one first.',true); return false; }
  localStorage.setItem(CURKEY,name); renderProfiles(); return true;
}
function applyProfile(name){
  const p=profiles()[name]; if(!p) return false;
  S.map=p.map||IDMAP(); S.bias=p.bias||{x:0,y:0}; S.acc=p.acc??null; S.lam=p.lam??null; S.head0=p.head0||null; S.hw=p.hw&&p.hw.x?p.hw:newHw(); if(p.frame) S.frame=p.frame; saveMap();
  const entries=(p.data||[]).map(d=>({eyes:unpackEye(d.e),screenPos:d.s,type:d.ty}));
  const put=()=>{ try{ webgazer.clearData(); }catch{} try{ webgazer.getRegression()[0].setData(entries); }catch(e){ console.warn('profile data not applied',e); } if(S.lam!=null) setLam(S.lam); };
  if(S.running) put(); else S.pending=put;
  localStorage.setItem(CURKEY,name); S.fx.reset(); S.fy.reset(); S.med=[]; S.hist=[]; return true;
}
function newPerson(name){
  name=(name||'').trim(); if(!name) return;
  const p=priors();
  S.map=p?.map?{...IDMAP(),...p.map}:IDMAP(); S.bias={x:0,y:0}; S.acc=p?p.acc:null; S.lam=null; S.head0=null; S.hw=newHw(); S.frame=S.running?{...viewFrame(),w:innerWidth,h:innerHeight}:S.frame;
  const clr=()=>{ try{ webgazer.clearData(); }catch{} setLam(null); }; if(S.running) clr(); else S.pending=clr;
  localStorage.setItem(CURKEY,name); saveMap(); renderProfiles(); msg(`Profile "${name}" is new. Calibrate now. It starts from what ${p?p.n+' earlier calibrations':'the app'} learned.`);
}
function renderProfiles(){
  const sel=$('eyProf'); if(!sel) return; const P=profiles(), cur=curProfile();
  sel.replaceChildren(); const o0=document.createElement('option'); o0.value=''; o0.textContent=Object.keys(P).length?'Choose a saved person…':'No saved people yet'; sel.append(o0);
  for(const n of Object.keys(P).sort((a,b)=>P[b].t-P[a].t)){ const o=document.createElement('option'); o.value=n; o.textContent=`${n} (${P[n].acc!=null?Math.round(P[n].acc)+' px':'new'}, ${new Date(P[n].t).toLocaleDateString()})`; if(n===cur) o.selected=true; sel.append(o); }
  $('eyWho').textContent=cur?`Calibrating as: ${cur}`:'No person selected: calibration is saved as "default".';
}
window.addEventListener('pagehide',()=>{ if(S.running&&curProfile()) saveProfile(curProfile(),true); });
function onGaze(data){
  if(!data||!S.running) return;
  const now=performance.now(); S.frames++; S.lastGaze=now;
  if(S.lost){ S.lost=false; msg('Face found again.'); }
  // head pose and eyelids from the face landmarks
  const hd=headNow(); let blink=false; S.head=hd;
  if(hd){ const E=S.ears; E.push(hd.ear); if(E.length>120) E.shift();
    if(E.length>20){ const so=[...E].sort((a,b)=>a-b); blink=hd.ear<so[Math.floor(so.length*0.8)]*0.55; }
    if(blink){ if(!S.blinkT0) S.blinkT0=now; else if(now-S.blinkT0>350) blink=false; } else S.blinkT0=0; // eyes "closed" for more than a third of a second is not a blink: looking down narrows them
    if(S.prevHead){ const dt=Math.max(0.01,(now-S.prevHead.t)/1000); S.headSpd=Math.hypot(hd.x-S.prevHead.x,hd.y-S.prevHead.y)/dt; } S.prevHead={x:hd.x,y:hd.y,t:now}; }
  S.blink=blink; if(blink) S.blinkAt=now;
  const off=frameOff(); S.raw={x:data.x+off.x,y:data.y+off.y};
  if(blink||now-S.blinkAt<110) return; // an eyelid distorts the eye picture: keep the last good gaze
  // 1) median over the last ~170 ms (at least 3 samples) removes spikes without adding lag at low frame rates
  S.med.push({x:S.raw.x,y:S.raw.y,t:now}); while(S.med.length>3&&now-S.med[0].t>170) S.med.shift(); if(S.med.length>9) S.med.shift();
  const mx=median(S.med.map(p=>p.x)), my=median(S.med.map(p=>p.y));
  if(S.check){ let f=null; try{ f=data.eyeFeatures?webgazer.util.getEyeFeats(data.eyeFeatures):null; }catch{} S.check.pts.push({x:mx,y:my,t:now,f,hd}); } // measured before any correction
  // 2) correction fitted on the check dots, then the small head-movement term, then the offset learned from clicks
  const hv=hd&&S.head0?hvec(hd,S.head0):null; S.lastHv=hv; let hc=null; const hw=S.hw;
  if(hv&&hw&&hw.n>=8) hc=[clampN(dot(hw.x.w,hv),-0.08,0.08),clampN(dot(hw.y.w,hv),-0.08,0.08)]; S.lastHc=hc;
  const [bx,by]=pipeline(mx,my,hc);
  // 3) adaptive smoothing: the Smoothing setting (1 to 20) sets the resting cutoff
  const sv=Math.max(1,Math.min(20,+$('eySmooth').value||4)), minC=3.2/sv, beta=0.006;
  S.sm={x:Math.max(0,Math.min(innerWidth,S.fx.step(bx,now,minC,beta))),y:Math.max(0,Math.min(innerHeight,S.fy.step(by,now,minC,beta)))};
  S.hist.push({x:bx,y:by,t:now}); while(S.hist.length&&now-S.hist[0].t>900) S.hist.shift();
}
/* ---------- correction model, head pose and blinks ----------
   WebGazer predicts from the eye picture alone. Three measured corrections sit on top of it:
   1. After the 13 training dots, 9 check dots the model has never seen are measured. Candidate corrections (none, offset, per-axis scale+offset, full 2D affine, quadratic)
      are compared by leave-one-out error and the best simple one is kept. The accuracy shown is that held-out error, not the error on points it trained on.
   2. The ridge strength of WebGazer's regression is tuned on the same held-out frames (it ships with an almost zero value and over-fits a few hundred samples).
   3. Head position and turn are read from the face landmarks. A small per-axis model learns, from confident clicks, how much the gaze shifts when the head moves from where it was at calibration.
   Blinks (eye aspect ratio) and head movement are detected so such frames are never used for training or checking. */
function IDMAP(){ return {ax:1,bx:0,ay:1,by:0,cx:[0,0,0,0],cy:[0,0,0,0]}; }
function applyMap(M,u,v){ const cx=M.cx||Z4, cy=M.cy||Z4;
  return [M.ax*u+M.bx+cx[0]*v+cx[1]*u*v+cx[2]*u*u+cx[3]*v*v, M.ay*v+M.by+cy[0]*u+cy[1]*u*v+cy[2]*u*u+cy[3]*v*v]; }
const PHI=(u,v)=>[1,u,v,u*v,u*u,v*v];
const MODELS={offset:[[0],[0]],axis:[[0,1],[0,2]],affine:[[0,1,2],[0,1,2]],quad:[[0,1,2,3,4,5],[0,1,2,3,4,5]]};
const MODEL_LAM={offset:0.002,axis:0.004,affine:0.01,quad:0.04}, MODEL_MIN={offset:2,axis:3,affine:4,quad:7};
function solveLin(A,b){ // Gaussian elimination with partial pivoting
  const n=b.length, M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; if(p!==c){ const t=M[c]; M[c]=M[p]; M[p]=t; }
    const d=M[c][c]||1e-12; for(let r=c+1;r<n;r++){ const f=M[r][c]/d; if(f) for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
  const x=new Array(n).fill(0); for(let i=n-1;i>=0;i--){ let s=M[i][n]; for(let k=i+1;k<n;k++) s-=M[i][k]*x[k]; x[i]=s/(M[i][i]||1e-12); } return x;
}
function fitModel(pts,kind){
  if(kind==='none') return IDMAP();
  const idx=MODELS[kind], lam=MODEL_LAM[kind], co=[];
  for(let a=0;a<2;a++){ const I=idx[a], p=I.length, A=Array.from({length:p},()=>new Array(p).fill(0)), b=new Array(p).fill(0);
    for(const q of pts){ const f=PHI(q.u,q.v), x=I.map(i=>f[i]), y=a?q.tv-q.v:q.tu-q.u; for(let i=0;i<p;i++){ b[i]+=x[i]*y; for(let j=0;j<p;j++) A[i][j]+=x[i]*x[j]; } }
    for(let i=0;i<p;i++) if(I[i]!==0) A[i][i]+=lam*pts.length;
    const w=solveLin(A,b), full=new Array(6).fill(0); I.forEach((ix,j)=>{ full[ix]=w[j]; }); co.push(full); }
  const [x6,y6]=co; return {ax:1+x6[1],bx:x6[0],cx:[x6[2],x6[3],x6[4],x6[5]],ay:1+y6[2],by:y6[0],cy:[y6[1],y6[3],y6[4],y6[5]]};
}
function shrinkMap(M,s){ return {ax:1+(M.ax-1)*s,bx:M.bx*s,ay:1+(M.ay-1)*s,by:M.by*s,cx:(M.cx||Z4).map(v=>v*s),cy:(M.cy||Z4).map(v=>v*s)}; }
function fitCorrection(pts,W,H){
  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length, err=(M,q)=>{ const [u,v]=applyMap(M,q.u,q.v); return Math.hypot((u-q.tu)*W,(v-q.tv)*H); };
  const raw=mean(pts.map(q=>err(IDMAP(),q))), loo={none:raw}; let best='none';
  for(const k of ['offset','axis','affine','quad']){ if(pts.length<MODEL_MIN[k]+1) continue;
    loo[k]=mean(pts.map((q,i)=>err(fitModel(pts.filter((_,j)=>j!==i),k),q))); if(loo[k]<loo[best]*0.96) best=k; } // a simpler model wins unless a more complex one is clearly better
  return {map:best==='none'?IDMAP():shrinkMap(fitModel(pts,best),0.93),model:best,acc:loo[best],raw,loo};
}
/* ridge strength: solve the normal equations once, then try many strengths against the held-out check frames */
function scoreAffine(pred){ // how well a per-axis scale+offset could fix these predictions (pixels)
  const q=[]; pred.forEach((p,k)=>{ if(p) q.push([p[0],p[1],CHECK[k][0]/100*innerWidth,CHECK[k][1]/100*innerHeight]); }); if(q.length<4) return Infinity; let s=0;
  for(const [mi,ti] of [[0,2],[1,3]]){ const m=q.map(r=>r[mi]), t=q.map(r=>r[ti]), mm=m.reduce((a,v)=>a+v,0)/m.length, tm=t.reduce((a,v)=>a+v,0)/t.length; let sxx=0,sxy=0;
    for(let i=0;i<m.length;i++){ sxx+=(m[i]-mm)**2; sxy+=(m[i]-mm)*(t[i]-tm); } const a=sxx>1e-6?sxy/sxx:1; for(let i=0;i<m.length;i++) s+=(t[i]-tm-a*(m[i]-mm))**2; }
  return Math.sqrt(s/q.length);
}
function tuneRidge(res){
  const reg=webgazer.getRegression()[0], X=reg.eyeFeaturesClicks?.data, YX=reg.screenXClicksArray?.data, YY=reg.screenYClicksArray?.data;
  if(!X||X.length<30||!YX||!YY||!X[0]?.length) return null; const n=X.length, p=X[0].length;
  const XtX=Array.from({length:p},()=>new Float64Array(p)), bx=new Float64Array(p), by=new Float64Array(p);
  for(let r=0;r<n;r++){ const f=X[r], tx=YX[r][0], ty=YY[r][0]; for(let i=0;i<p;i++){ bx[i]+=f[i]*tx; by[i]+=f[i]*ty; const row=XtX[i]; for(let j=i;j<p;j++) row[j]+=f[i]*f[j]; } }
  for(let i=0;i<p;i++) for(let j=0;j<i;j++) XtX[i][j]=XtX[j][i];
  const off=frameOff(), out=[];
  for(const lam of [1e-5,1e-1,10,100,1e3,1e4,3e4,1e5,3e5,1e6,3e6,1e7]){
    const A=XtX.map((r,i)=>{ const q=Array.from(r); q[i]+=lam; return q; }), wx=solveLin(A,Array.from(bx)), wy=solveLin(A,Array.from(by));
    const pred=res.map(r=>{ if(!r||!r.fs||r.fs.length<3) return null; const xs=[], ys=[]; for(const f of r.fs){ let a=0,b=0; for(let i=0;i<p;i++){ a+=f[i]*wx[i]; b+=f[i]*wy[i]; } xs.push(a); ys.push(b); } return [median(xs)+off.x,median(ys)+off.y]; });
    out.push({lam,pred,score:scoreAffine(pred)}); }
  const best=Math.min(...out.map(o=>o.score)); if(!Number.isFinite(best)) return null;
  let pick=out[0]; for(const o of out) if(o.score<=best*1.03) pick=o; // the smoothest strength that is about as good as the best
  return {lam:pick.lam,pred:pick.pred,score:pick.score,base:out[0].score};
}
function setLam(l){ S.lam=l; try{ if(l!=null) webgazer.getRegression()[0].ridgeParameter=l; }catch{} }
/* head pose + eye openness from the 468 face landmarks */
function headNow(){
  try{ const P=window.webgazer?.getTracker?.()?.getPositions?.(); if(!P||P.length<400) return null;
    const v=document.getElementById('webgazerVideoFeed'), vw=v?.videoWidth||640, d=(i,j)=>Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);
    const a=P[33], b=P[263], nz=P[1], sc=d(33,263)||1, cx=(a[0]+b[0])/2, cy=(a[1]+b[1])/2;
    const el=(d(160,144)+d(158,153))/(2*(d(33,133)||1)), er=(d(387,373)+d(385,380))/(2*(d(263,362)||1));
    return {x:cx/vw,y:cy/vw,s:sc/vw,yw:(nz[0]-cx)/sc,pt:(nz[1]-cy)/sc,ear:(el+er)/2};
  }catch{ return null; }
}
const hvec=(h,b)=>[h.x-b.x,h.y-b.y,Math.log(h.s/b.s),h.yw-b.yw,h.pt-b.pt];
const dot=(a,b)=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
function newHw(){ const P=()=>Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>i===j?9:0)); return {x:{w:[0,0,0,0,0],P:P()},y:{w:[0,0,0,0,0],P:P()},n:0}; }
function rlsUpdate(R,h,y,lam=0.995){ // recursive least squares with forgetting
  const n=h.length, Ph=R.P.map(r=>dot(r,h)), den=lam+dot(h,Ph), K=Ph.map(v=>v/den), e=y-dot(R.w,h);
  for(let i=0;i<n;i++) R.w[i]+=K[i]*e;
  for(let i=0;i<n;i++) for(let j=0;j<n;j++) R.P[i][j]=Math.min(9,(R.P[i][j]-K[i]*Ph[j])/lam); // the cap stops it winding up when the head is still
}
/* the whole path from the raw prediction to a screen position (also run backwards when learning from a click) */
function pipeline(mx,my,hc){
  const W=innerWidth, H=innerHeight, [u,v]=applyMap(S.map,mx/W,my/H);
  return [clampN((u+(hc?hc[0]:0))*W-S.bias.x,-0.1*W,1.1*W),clampN((v+(hc?hc[1]:0))*H-S.bias.y,-0.1*H,1.1*H)];
}
function invertPipe(tx,ty,hc){ let r=[tx,ty]; for(let i=0;i<6;i++){ const p=pipeline(r[0],r[1],hc); r[0]+=tx-p[0]; r[1]+=ty-p[1]; } return r; }
const goodFrame=now=>S.running&&S.raw&&!S.lost&&now-S.lastGaze<220&&!S.blink&&now-(S.blinkAt||-1e9)>150&&(S.headSpd||0)<0.35;
/* record `n` good frames while the eyes rest on (x,y): blinks, lost faces and moving heads are skipped */
function collect(x,y,n,maxMs,settle,done){
  const t0=performance.now(); let got=0, last=0;
  const tick=()=>{ const now=performance.now();
    if(!S.running||!S.calib){ done(got); return; }
    if(now-t0>=settle&&now-last>=45){ last=now; if(goodFrame(now)){ try{ webgazer.recordScreenPosition(x,y,'click'); got++; }catch{} } else S.rej++; }
    if(got>=n||now-t0>=maxMs){ done(got); return; } setTimeout(tick,16); };
  setTimeout(tick,Math.min(settle,60));
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
  const hv=S.lastHv; if(hv&&S.hw&&Math.hypot(...hv)>0.004){ const hc=S.lastHc||[0,0], tx=r.left+r.width/2, ty=r.top+r.height/2;
    rlsUpdate(S.hw.x,hv,(tx-(S.sm.x-hc[0]*innerWidth))/innerWidth); rlsUpdate(S.hw.y,hv,(ty-(S.sm.y-hc[1]*innerHeight))/innerHeight); S.hw.n++; } // how far the gaze moves when the head does
  S.bias={x:clampN(S.bias.x+ex*0.15,-innerWidth*0.15,innerWidth*0.15),y:clampN(S.bias.y+ey*0.15,-innerHeight*0.15,innerHeight*0.15)}; saveMapSoon();
}
// Every successful click is a free calibration sample: you were looking at that button, so teach the model where it is.
function learnFromClick(el){
  if(!$('eyLearn')?.checked) return;
  const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
  const dx=Math.max(r.left-S.sm.x,0,S.sm.x-r.right), dy=Math.max(r.top-S.sm.y,0,S.sm.y-r.bottom);
  if(Math.hypot(dx,dy)>Math.max(70,S.r*0.8)) return; // too far off: probably a wrong pick, don't learn from it
  const cx=Math.max(r.left,Math.min(r.right,S.sm.x*0.35+(r.left+r.width/2)*0.65)), cy=Math.max(r.top,Math.min(r.bottom,S.sm.y*0.35+(r.top+r.height/2)*0.65));
  const [rx,ry]=invertPipe(cx,cy,S.lastHc), [tx,ty]=toTrain(rx,ry); for(let k=0;k<3;k++) setTimeout(()=>{ try{ webgazer.recordScreenPosition(tx,ty,'click'); }catch{} },k*50);
}

/* ---------- calibration ---------- */
const CHECK=[[50,50],[12,50],[88,50],[50,14],[50,86],[28,28],[72,28],[72,72],[28,72]], CHECK_MS=1600;
function calibrate(){
  if(!S.running){ msg('Start eye tracking first.',true); return; }
  const fr=viewFrame(), f=S.frame;
  if(f&&(Math.abs(f.ox-fr.ox)+Math.abs(f.oy-fr.oy)>40||Math.abs((f.w||innerWidth)-innerWidth)>120||Math.abs((f.h||innerHeight)-innerHeight)>120)){ try{ webgazer.clearData(); }catch{} setLam(null); } // data from another window layout would only confuse the model
  S.frame={...fr,w:innerWidth,h:innerHeight}; S.bias={x:0,y:0}; S.map=IDMAP(); S.hw=newHw(); S.head0=null; S.rej=0; S.med=[];
  S.calib={i:0,hits:0,phase:'ready',k:0,t0:performance.now(),okSince:0,fail:0}; $('eyCalibLayer').hidden=false; renderCalib(); readyPoll(S.calib);
}
const autoOn=()=>!!$('eyAuto')?.checked;
/* wait until the face is seen, lit and still before the first dot: calibrating on a bad picture wastes the whole run */
function readyPoll(c){
  if(S.calib!==c||c.phase!=='ready') return; const now=performance.now();
  const ok=!S.lost&&S.quality.score>=55&&!S.blink&&(S.headSpd||0)<0.2&&!!S.raw;
  if(ok){ if(!c.okSince) c.okSince=now; } else c.okSince=0;
  if((c.okSince&&now-c.okSince>1200)||now-c.t0>9000){ c.phase='dots'; c.i=0; c.hits=0; renderCalib(); return; }
  $('eyCalibText').textContent=`Getting ready… ${S.lost?"I can't see your face.":S.quality.tips[0]||'Sit the way you will use it, keep your head still and look at the screen.'} · Esc cancels`;
  c.timer=setTimeout(()=>readyPoll(c),250);
}
function renderCalib(){
  const L=$('eyCalibLayer'), c=S.calib;
  for(const d of [...L.querySelectorAll('.cal-dot')]) d.remove();
  if(c.phase==='ready') return;
  const pts=c.phase==='check'?[CHECK[c.k||0]]:CAL_PTS;
  pts.forEach(([px,py],i)=>{
    const d=document.createElement('button'); d.type='button'; d.className='cal-dot'+(c.phase==='check'||i===c.i?' current':i<c.i?' done':'');
    d.style.left=px+'%'; d.style.top=py+'%'; d.setAttribute('aria-label',`Calibration dot ${i+1}`);
    if(c.phase!=='check'&&i===c.i) d.onclick=calibHit;
    L.append(d);
  });
  $('eyCalibText').textContent=c.phase==='check'
    ?`Keep looking at the dot. Checking accuracy on points the model has not seen · ${(c.k||0)+1} of ${CHECK.length}`
    :autoOn()?`Look straight at the glowing dot. It advances by itself · dot ${c.i+1} of ${CAL_PTS.length} · Esc cancels`
    :`Look straight at the glowing dot and tap your foot, or click it. ${hitsPerDot()-c.hits} more for this dot · dot ${c.i+1} of ${CAL_PTS.length} · Esc cancels`;
  if(c.phase==='dots'&&autoOn()){ clearTimeout(c.timer); c.timer=setTimeout(()=>{ if(S.calib===c&&c.phase==='dots') calibHit(); },c.hits===0&&!c.fail?950:350); }
}
function calibHit(){
  const c=S.calib; if(!c||c.phase!=='dots'||c.busy) return;
  const [px,py]=CAL_PTS[c.i], x=innerWidth*px/100, y=innerHeight*py/100; c.busy=true;
  // sampling finishes before the next dot appears, so no sample is ever taken while the eyes are travelling
  collect(x,y,SAMPLES_PER_HIT,1500,SETTLE,got=>{
    c.busy=false; if(S.calib!==c||c.phase!=='dots') return;
    if(got<Math.ceil(SAMPLES_PER_HIT/2)&&c.fail<2){ c.fail++; renderCalib(); $('eyCalibText').textContent='I could not see your eyes clearly. Keep looking at the dot, face the camera and try not to blink.'; return; }
    c.fail=0; c.hits++;
    if(c.hits>=hitsPerDot()){ c.i++; c.hits=0; if(c.i>=CAL_PTS.length){ clearTimeout(c.timer); startCheck(); return; } }
    renderCalib(); });
}
function startCheck(){ const c=S.calib; c.phase='check'; c.k=0; S.check={pts:[],res:[],t0:performance.now()}; renderCalib(); stepCheck(); }
function stepCheck(){
  const c=S.calib; if(!c||!S.check) return; const k=c.k, t0=performance.now(); S.check.pts=[];
  setTimeout(()=>{
    if(!S.check||S.calib!==c) return;
    const pts=S.check.pts.filter(p=>p.t>t0+650); S.check.res[k]=pts.length>=3?{x:median(pts.map(p=>p.x)),y:median(pts.map(p=>p.y)),n:pts.length,fs:pts.filter(p=>p.f).map(p=>p.f).slice(-16),hd:pts.map(p=>p.hd).filter(Boolean)}:null;
    c.k++; if(c.k>=CHECK.length){ finishCheck(); return; } renderCalib(); stepCheck();
  },CHECK_MS);
}
function finishCheck(){
  const res=S.check.res, W=innerWidth, H=innerHeight; S.check=null;
  if(res.filter(r=>r&&r.n>=3).length<4||!res[0]){ S.fx.reset(); S.fy.reset(); S.med=[]; logCalibration({ok:0,acc:0,pct:0,map:S.map}); endCalib(); msg('Not enough gaze data during the check. Make sure your face is visible to the camera, then calibrate again.',true); return; }
  // 1) ridge strength tuned on frames the model never saw
  let lamInfo=null; try{ lamInfo=tuneRidge(res); }catch(e){ console.warn('ridge tuning skipped',e); }
  if(lamInfo){ setLam(lamInfo.lam); res.forEach((r,k)=>{ const p=lamInfo.pred[k]; if(r&&p){ r.x=p[0]; r.y=p[1]; } }); }
  // 2) the correction with the lowest leave-one-out error
  const pts=[]; res.forEach((r,k)=>{ if(r&&r.n>=3) pts.push({u:r.x/W,v:r.y/H,tu:CHECK[k][0]/100,tv:CHECK[k][1]/100}); });
  const fit=fitCorrection(pts,W,H); S.map=fit.map; S.bias={x:0,y:0};
  if(['none','offset','axis'].includes(fit.model)){ const pr=priors()?.map; if(pr){ const k=0.2; for(const q of ['ax','bx','ay','by']) S.map[q]=S.map[q]*(1-k)+pr[q]*k; } } // and a little toward the typical fit of earlier good runs
  // 3) where the head was: later head movement is measured against this
  const hds=res.flatMap(r=>r?.hd||[]); if(hds.length>=6) S.head0={x:median(hds.map(h=>h.x)),y:median(hds.map(h=>h.y)),s:median(hds.map(h=>h.s)),yw:median(hds.map(h=>h.yw)),pt:median(hds.map(h=>h.pt))}; else S.head0=null;
  S.hw=newHw();
  S.acc=fit.acc; S.fx.reset(); S.fy.reset(); S.med=[]; S.hist=[]; endCalib(); saveMap();
  const pct=S.acc/W*100, modelName={none:'none needed',offset:'offset',axis:'scale and offset per axis',affine:'full 2D (handles rotation)',quad:'curved (quadratic)'}[fit.model];
  logCalibration({ok:1,acc:Math.round(S.acc),pct:+pct.toFixed(2),raw:Math.round(fit.raw),model:fit.model,lam:S.lam,rej:S.rej,map:{...S.map}}); saveProfile(curProfile()||'default',true);
  $('eyAcc').textContent=`Last calibration: average error ${Math.round(S.acc)} px (${pct.toFixed(1)}% of the window width), measured on ${pts.length} points the model had never seen. Before correction it was ${Math.round(fit.raw)} px. Correction: ${modelName}.${S.rej?` ${S.rej} unclear frames (blinks, head movement) were skipped.`:''}`;
  msg(pct<4?'Calibration done. Excellent accuracy. Foot taps (or dwelling) now select where you look.'
    :pct<7?'Calibration done. Good accuracy. Selection works on the region you look at, and every click improves it.'
    :'Calibration done, but accuracy is rough. Better light on your face, a steadier head or calibrating again will help. The gaze region grows to make up for it.');
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
  const tips=[]; let score=100, sd=null; const cond={}; const h=S.hist;
  if(h.length>=4){ let mx=0,my=0; for(const p of h){ mx+=p.x; my+=p.y; } mx/=h.length; my/=h.length; let v=0; for(const p of h) v+=(p.x-mx)**2+(p.y-my)**2; sd=Math.sqrt(v/h.length); }
  if(S.fps&&S.fps<8){ score-=30; tips.push('The tracker is running slowly: close other tabs.'); }
  if(sd!=null&&sd>120){ score-=20; tips.push('Gaze is jumpy: keep your head steady and your face evenly lit.'); }
  try{
    const v=document.getElementById('webgazerVideoFeed');
    if(v&&v.videoWidth){ const c=S.qc||(S.qc=document.createElement('canvas')); c.width=32; c.height=24; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(v,0,0,32,24); const d=g.getImageData(0,0,32,24).data; let l=0; for(let i=0;i<d.length;i+=4) l+=0.3*d[i]+0.59*d[i+1]+0.11*d[i+2]; l/=d.length/4; cond.light=Math.round(l);
      if(l<55){ score-=25; tips.push('Too dark: light your face from the front.'); } else if(l>205){ score-=15; tips.push('Too bright or backlit: avoid a window behind you.'); }
      const pos=window.webgazer?.getTracker?.()?.getPositions?.();
      if(pos&&pos.length>10){ let x0=1e9,x1=-1e9; for(const p of pos){ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); } const fw=(x1-x0)/v.videoWidth, cx=(x0+x1)/2/v.videoWidth; cond.fw=+fw.toFixed(3);
        if(fw<0.2){ score-=15; tips.push('Move a little closer to the screen.'); } else if(fw>0.62){ score-=10; tips.push('Move back a little.'); }
        if(Math.abs(cx-0.5)>0.22){ score-=10; tips.push('Centre your face in the camera view.'); } } }
  }catch{}
  if(S.lost){ score=10; tips.unshift("Can't see your face."); }
  S.quality={score:Math.max(0,score),tips}; if(cond.light!=null||cond.fw!=null) S.cond={...S.cond,...cond}; S.cond.fps=S.fps;
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
function askName(q,d){ const n=prompt(q,d||''); return n&&n.trim()?n.trim().slice(0,40):''; }
$('eyProf').onchange=()=>{ const n=$('eyProf').value; if(!n) return; if(S.running&&curProfile()&&curProfile()!==n) saveProfile(curProfile(),true); applyProfile(n); renderProfiles(); msg(`Loaded ${n}'s calibration.${S.running?'':' It is applied when you start the camera.'}`); };
$('eyProfNew').onclick=()=>{ const n=askName('Name for the new person (their own calibration is saved under it):'); if(!n) return; if(S.running&&curProfile()) saveProfile(curProfile(),true); newPerson(n); };
$('eyProfSave').onclick=()=>{ const n=curProfile()||askName('Save the current calibration as:','default'); if(n&&saveProfile(n)) msg(`Saved "${n}".`); };
$('eyProfDel').onclick=()=>{ const n=$('eyProf').value||curProfile(); const P=profiles(); if(!n||!P[n]) return; if(!confirm(`Delete the saved calibration for "${n}"? The calibration history log is kept.`)) return; delete P[n]; lsSet(PROFKEY)(P); if(curProfile()===n) localStorage.removeItem(CURKEY); renderProfiles(); msg(`Deleted "${n}".`); };
$('eyLogCsv').onclick=logCsv;
renderProfiles(); renderHist();
$('eyStart').onclick=start;
$('eyStop').onclick=stop;
$('eyCalib').onclick=calibrate;
$('eyTest').onclick=startTest;
$('eyClear').onclick=()=>{ try{ window.webgazer?.clearData(); }catch{} try{ localStorage.removeItem('webgazerGlobalData'); }catch{} S.acc=null; S.bias={x:0,y:0}; S.map=IDMAP(); S.hw=newHw(); S.head0=null; S.lam=null; try{ localStorage.removeItem(MAPKEY); }catch{} $('eyAcc').textContent=''; msg('Saved calibration cleared. Calibrate again before using eye clicks.'); };
$('eyPreview').onchange=()=>{ if(S.running) webgazer.showVideoPreview($('eyPreview').checked); };
requestAnimationFrame(frame);
window.EyeControl={_m:{tuneRidge,setLam,headNow,goodFrame,fitCorrection,applyMap,fitModel,rlsUpdate,newHw,solveLin,IDMAP,hvec,pipeline,invertPipe},_state:()=>S,pickTarget,pickRegion,eyeClick,start,calibrate,adoptFs,
  running:()=>S.running, calibrating:()=>!!S.calib,
  forceDwell:on=>{ S.forceDwell=!!on; }, // the in-game menu turns dwell selection on so it works without a foot tap
  recenter:(cx,cy)=>{ if(!S.sm) return false; S.bias={x:clampN(S.bias.x+S.sm.x-cx,-innerWidth*0.15,innerWidth*0.15),y:clampN(S.bias.y+S.sm.y-cy,-innerHeight*0.15,innerHeight*0.15)}; S.fx.reset(); S.fy.reset(); S.med=[]; S.hist=[]; return true; }, // "I'm looking at the middle right now"
  quality:()=>S.quality,
  gaze:()=>S.running&&S.sm&&!S.calib?{x:S.sm.x,y:S.sm.y,r:regionOn()?S.r:18}:null}; // gaze is used by Sky Race steering
})();
