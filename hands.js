// Hand gesture control for Sky Race free fly (optional, nothing to train).
// MediaPipe's pre-trained Hand Landmarker runs in this browser on your webcam (lazy-loaded from jsDelivr; the model file comes from Google's model storage).
// The video never leaves the page. Reads: hand position (steer), how open the fingers are (flap), thumb-to-finger pinch (bird call).
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const VER='0.10.14', BASE=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CONN=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const S={running:false,loading:false,lm:null,video:null,stream:null,raf:0,last:0,seen:0,visible:false,x:0.5,y:0.5,open:0,pinch:false,pinchT:0,roll:0,fps:0,frames:0,fpsT:0,neutral:{x:0.5,y:0.55},pts:null};
try{ const n=JSON.parse(localStorage.getItem('emgPosture.handNeutral')||'null'); if(n&&isFinite(n.x)&&isFinite(n.y)) S.neutral=n; }catch{}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function msg(t,err){ const m=$('rHandMsg'); if(!m) return; m.hidden=!t; m.textContent=t||''; m.classList.toggle('err',!!err); }

async function start(){
  if(S.running||S.loading) return true;
  S.loading=true; msg('Loading hand tracking. The first time takes a little while…');
  try{
    const mod=await import(BASE+'/vision_bundle.mjs');
    const fs=await mod.FilesetResolver.forVisionTasks(BASE+'/wasm');
    const mk=delegate=>mod.HandLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:MODEL,delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:0.5,minHandPresenceConfidence:0.5,minTrackingConfidence:0.5});
    try{ S.lm=await mk('GPU'); }catch{ S.lm=await mk('CPU'); }
  }catch(e){ S.loading=false; msg('Could not load the hand tracker. Check your internet connection.',true); return false; }
  try{
    S.stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
    const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.srcObject=S.stream; await v.play(); S.video=v;
  }catch(e){ S.loading=false; try{ S.lm?.close(); }catch{} S.lm=null; msg(`The camera didn't start (${e?.message||e}). Allow camera access for this page and try again.`,true); return false; }
  S.loading=false; S.running=true; S.seen=0; S.fpsT=performance.now(); S.frames=0;
  msg('Hand tracking is on. Open hand = flap, fist = glide. Move your hand up, down, left and right to steer. Pinch thumb and a finger for a bird call. Press N to set the neutral position.');
  loop(); return true;
}
function stop(){
  cancelAnimationFrame(S.raf); S.running=false; S.visible=false; S.pts=null;
  try{ S.stream?.getTracks().forEach(t=>t.stop()); }catch{} S.stream=null; S.video=null;
  try{ S.lm?.close(); }catch{} S.lm=null; msg('');
}
function loop(){
  if(!S.running) return; S.raf=requestAnimationFrame(loop);
  const now=performance.now(); if(now-S.last<33||!S.video||S.video.readyState<2) return; S.last=now;
  let res=null; try{ res=S.lm.detectForVideo(S.video,now); }catch{ return; }
  S.frames++; if(now-S.fpsT>1000){ S.fps=S.frames; S.frames=0; S.fpsT=now; }
  const L=res?.landmarks?.[0];
  if(!L){ if(now-S.seen>400){ S.visible=false; S.pts=null; } return; }
  S.seen=now; S.visible=true; S.pts=L;
  const size=Math.max(0.02,d(L[0],L[9]));
  const cx=(L[0].x+L[5].x+L[9].x+L[13].x+L[17].x)/5, cy=(L[0].y+L[5].y+L[9].y+L[13].y+L[17].y)/5;
  let ext=0; for(const [t,m] of [[8,5],[12,9],[16,13],[20,17]]) ext+=d(L[t],L[0])/Math.max(0.01,d(L[m],L[0]));
  ext/=4; const open=clamp((ext-1.2)/(1.85-1.2),0,1);                 // fingers curled into a fist ≈ 1.0–1.2, fully open ≈ 1.9 (tip distance / knuckle distance, from the wrist)
  const others=[[12,9],[16,13],[20,17]].every(([t,m])=>d(L[t],L[0])/Math.max(0.01,d(L[m],L[0]))>1.45);
  const pinch=others&&d(L[4],L[8])/size<0.32;                          // thumb touches the index finger while the other fingers stay out
  const a=S.visible&&S.x!=null?0.4:1;                                  // light smoothing
  S.x+=((1-cx)-S.x)*a; S.y+=(cy-S.y)*a; S.open+=(open-S.open)*0.45;    // mirrored: moving your hand to your right moves it right on screen
  S.roll=Math.atan2(-(L[9].x-L[0].x),-(L[9].y-L[0].y));
  if(pinch&&!S.pinch&&now-S.pinchT>1200){ S.pinchT=now; window.dispatchEvent(new CustomEvent('handpinch')); }
  S.pinch=pinch;
}
function setNeutral(){ if(!S.visible) return false; S.neutral={x:S.x,y:S.y}; try{ localStorage.setItem('emgPosture.handNeutral',JSON.stringify(S.neutral)); }catch{} return true; }
// where the hand is relative to the neutral spot: -1..1 on each axis (full deflection at about 28% of the frame sideways, 22% up or down)
function steer(){ if(!S.running||!S.visible) return null; return {x:clamp((S.x-S.neutral.x)/0.28,-1.2,1.2),y:clamp((S.y-S.neutral.y)/0.22,-1.2,1.2)}; }
// small camera inset with the hand skeleton, drawn on the game HUD
function drawPreview(g,x,y,w,h){
  if(!S.running) return;
  g.save(); g.beginPath(); g.roundRect(x,y,w,h,10); g.clip(); g.fillStyle='rgba(8,12,18,.65)'; g.fillRect(x,y,w,h);
  if(S.video&&S.video.readyState>=2){ g.globalAlpha=0.55; g.translate(x+w,y); g.scale(-1,1); g.drawImage(S.video,0,0,w,h); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.save(); g.beginPath(); g.roundRect(x,y,w,h,10); g.clip(); }
  else g.save();
  const P=(p)=>[x+(1-p.x)*w,y+p.y*h];
  if(S.pts){ g.strokeStyle=S.pinch?'#ffd24a':'#b9f0cf'; g.lineWidth=2; g.beginPath(); for(const [a,b] of CONN){ const A=P(S.pts[a]),B=P(S.pts[b]); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); } g.stroke();
    g.fillStyle='#fff'; for(const p of S.pts){ const q=P(p); g.beginPath(); g.arc(q[0],q[1],2,0,6.283); g.fill(); } }
  g.strokeStyle='rgba(255,255,255,.4)'; g.setLineDash([3,4]); g.beginPath(); const nx=x+S.neutral.x*w, ny=y+S.neutral.y*h; g.moveTo(nx-10,ny); g.lineTo(nx+10,ny); g.moveTo(nx,ny-10); g.lineTo(nx,ny+10); g.stroke(); g.setLineDash([]);
  g.restore();
  g.fillStyle='rgba(8,12,18,.7)'; g.fillRect(x,y+h-18,w,18); g.fillStyle=S.visible?'#fff':'#ff9a8a'; g.font='600 11px "DM Sans",system-ui'; g.textAlign='left';
  g.fillText(S.visible?`hand ${Math.round(S.open*100)}% open${S.pinch?' · pinch':''}`:'show your hand',x+6,y+h-5);
  g.restore();
}
window.HandControl={start,stop,setNeutral,steer,drawPreview,running:()=>S.running,loading:()=>S.loading,state:()=>({visible:S.visible,open:S.open,pinch:S.pinch,x:S.x,y:S.y,fps:S.fps}),_state:()=>S};
})();
