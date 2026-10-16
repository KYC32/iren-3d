// =============================================================
// live.js — 전력 블록 그림의 움직임 (build.mjs 가 자리표를 채워 페이지에 넣음, kit 없이 동작)
//   둘러보기: 확대해 전기가 흐르는 순서대로 부품을 짚고(청록 원 + 바로 옆 말풍선) → 전체 보기 →
//             정전 → 발전기 기동(배기) → ATS 접점이 발전기 쪽으로 → 복전 → 되돌림 → 처음으로
//   상태(계통·발전기·접점·흐름)는 model.mjs 의 stateAt 을 빌드 때 그대로 넣어 계산 → 그림과 글이 어긋나지 않음
// =============================================================
const D=__DATA__, KO=__KO__, INFO=__INFO__, PH=__PHASE__, ZT=__ZOOM__;
const stateAt=__STATE__;
const stage=document.querySelector(".pw-stage");
const read=document.querySelector("[data-readout=power]");
const btn=document.querySelector("[data-zoom=pw]");
// 칼날 그림: 각도 단계마다 세 상의 그림 묶음 (blades[단계] = [A상, B상, C상])
const blades=Array.from({length:9},(_,s)=>[...stage.querySelectorAll('[data-blade="'+s+'"]')]);
const puffs=stage.querySelector(".pw-puffs");
const still=matchMedia("(prefers-reduced-motion: reduce)");
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sm=(a,b,x)=>{const q=clamp((x-a)/(b-a),0,1);return q*q*(3-2*q);};
const PLAN=D.plan, STOPS=D.stops;
let clock=0,last=0,frame=0,visible=true,lastBlade=0,lastFlags="",lastPhase="",puffClock=0,genWas=0;

// 그림 아래 줄 쓰기(say)와 확대(zoomer)는 ../shared/zoomer.js (build.mjs 가 이 파일 앞에 붙임)
const Z=zoomer(stage,{W:D.W,H:D.H,zoom:D.zoom,focus:D.focus,stops:STOPS});

// ---------- 배기 연기 ----------
const NS="http://www.w3.org/2000/svg";
function puff(dark){
  if(still.matches)return;
  const c=document.createElementNS(NS,"circle");
  c.setAttribute("class","pw-puff");if(dark)c.setAttribute("data-dark","");
  c.setAttribute("cx",String(D.puff[0]+(Math.random()-.5)*1.2));c.setAttribute("cy",String(D.puff[1]-1));c.setAttribute("r",String(dark?2.2:1.7));
  c.style.setProperty("--dx",((Math.random()*6)+2).toFixed(1)+"px");
  c.addEventListener("animationend",()=>c.remove());
  puffs.appendChild(c);
}

// ---------- 둘러보기 한 장면 ----------
function tourAt(t){
  const u=((t%PLAN.len)+PLAN.len)%PLAN.len;
  const s=stateAt(u,PLAN);
  const parts=u>=PLAN.stopsAt&&u<PLAN.zoomEnd;                      // 부품을 차례로 짚는 구간
  const outage=u>=PLAN.at.outage&&u<PLAN.at.stop+1.5;               // 정전 → 복전 → 발전기 정지까지
  const stop=parts?Math.min(D.parts-1,Math.floor((u-PLAN.stopsAt)/PLAN.stopLen)):outage?(D.phaseStop[s.phase]??-1):-1;
  return {u,zoomOn:parts||outage,stop,s};
}
function draw(s,dt){
  // 접점 칼날: 9장 중 하나만 (+1 = 계통 N → 0번, −1 = 발전기 E → 8번)
  const bi=Math.round((1-s.blade)/2*(blades.length-1));   // +1(N) → 0번, −1(E) → 8번
  if(bi!==lastBlade){for(const g of blades[lastBlade])g.style.display="none";for(const g of blades[bi])g.style.display="";lastBlade=bi;}
  // 흐름·표시등 (속성 하나씩 켜고 끔 → CSS 가 점선을 움직임)
  const flags=[s.flow.hv?"hv":"",s.flow.lv?"lv":"",s.flow.gen?"gen":"",s.flow.load?"load":"",s.grid?"grid":"",s.gen>.98?"genready":"",s.gen>.05?"genrun":""].join(",");
  if(flags!==lastFlags){lastFlags=flags;for(const f of ["hv","lv","gen","load","grid","genready","genrun"])stage.toggleAttribute("data-"+f,flags.split(",").includes(f));}
  // 배기: 기동 순간 짙은 연기 몇 번, 도는 동안 옅은 연기
  if(s.gen>.02&&genWas<=.02){puff(true);setTimeout(()=>puff(true),180);setTimeout(()=>puff(true),420);}
  genWas=s.gen;
  if(s.gen>.3){puffClock+=dt;if(puffClock>.55){puffClock=0;puff(false);}}else puffClock=0;
  // 그림 아래 줄: 확대 중 말풍선을 못 띄웠으면 부품 설명, 직접 확대 중엔 쓰는 법, 그 밖엔 지금 단계
  const cap=Z.caption();
  say(read,cap||(Z.on?ZT.hint:PH[s.phase][KO?0:1]),!!cap,cap||Z.on?"":s.phase);
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/20):1/60;last=now;const calm=still.matches;
  // 직접 확대 중엔 둘러보기 시계를 멈춤 (끝나면 멈춘 곳부터 이어짐). 움직임 줄이기: 평소 상태로 정지
  if(!calm&&!Z.on)clock+=dt;
  const T=tourAt(calm?0:clock);
  if(!calm&&!Z.on)Z.tour(T.zoomOn,T.stop);else Z.tour(false,-1);
  Z.step(dt,calm);Z.apply();
  draw(T.s,dt);
  frame=visible?requestAnimationFrame(tick):0;
}
const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(tick);}};
for(const ev of ["pointermove","pointerdown"])stage.addEventListener(ev,Z.pointer);
stage.addEventListener("keydown",Z.key);
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible)run();});
// 화면 밖이면 멈춤
new IntersectionObserver(([e])=>{visible=e.isIntersecting&&!document.hidden;if(visible)run();}).observe(stage);
run();
// 검수용: 둘러보기 t 초 장면으로 바로 이동 / 상태 읽기
window.__pwSeek=(t)=>{clock=t;const T=tourAt(t);Z.tour(T.zoomOn,T.stop);Z.k=Z.on||Z.auto?1:0;Z.fx=Z.tfx;Z.fy=Z.tfy;Z.zc=Z.zt;Z.apply();draw(T.s,0);};
window.__pwState=()=>{const T=tourAt(clock);return {clock:+clock.toFixed(2),phase:T.s.phase,stop:T.stop,zoom:+Z.k.toFixed(3),flags:lastFlags,tip:stage.querySelector(".rk-tip").hasAttribute("data-on")?stage.querySelector(".rk-tip").textContent:""};};
window.__pwPlan=PLAN;
window.__pwStop=()=>{visible=false;if(frame)cancelAnimationFrame(frame);frame=0;};   // 검수용: 루프 멈춤 (장면 고정 캡처)
