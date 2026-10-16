// =============================================================
// live.js — Horizon 액체냉각 홀 그림의 움직임 (build.mjs 가 자리표를 채워 shared/zoomer.js 뒤에 붙여 넣음)
//   둘러보기: 확대해 전기가 들어오는 길 → 열이 나가는 길 순서로 부품을 짚고(말풍선) → 전체 보기 →
//             ① 더운 오후: 온도계 바늘이 오르고 칠러가 돎 → 저녁에 멈춤
//             ② 동시 유지보수: 대기 CDU C 기동 → CDU B 밸브 4개를 닫아 떼어 냄 → 정비 → 복귀 → 처음으로
//   상태(기온·칠러·CDU·밸브·흐름)는 model.mjs 의 stateAt 을 빌드 때 그대로 넣어 계산 → 그림과 글이 어긋나지 않음
// =============================================================
const D=__DATA__, KO=__KO__, INFO=__INFO__, PH=__PHASE__, ZT=__ZOOM__;
const stateAt=__STATE__;
const stage=document.querySelector(".hz-stage");
const read=document.querySelector("[data-readout=horizon]");
const btn=document.querySelector("[data-zoom=hz]");
// 온도계 바늘 그림 (needles[i] = D.needle.min + i °C) · 밸브 손잡이 그림 (valves[단계] = B 밸브 4개)
const needles=[...stage.querySelectorAll("[data-needle]")];
const valves=Array.from({length:D.valves},(_,s)=>[...stage.querySelectorAll('[data-valve="'+s+'"]')]);
const puffs=stage.querySelector(".hz-puffs");
const still=matchMedia("(prefers-reduced-motion: reduce)");
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sm=(a,b,x)=>{const q=clamp((x-a)/(b-a),0,1);return q*q*(3-2*q);};
const PLAN=D.plan, STOPS=D.stops;
let clock=0,last=0,frame=0,visible=true,lastNeedle=0,lastValve=0,lastFlags="",dcClock=0,chClock=0;

// 그림 아래 줄 쓰기(say)와 확대(zoomer)는 ../shared/zoomer.js (build.mjs 가 이 파일 앞에 붙임)
const Z=zoomer(stage,{W:D.W,H:D.H,zoom:D.zoom,focus:D.focus,stops:STOPS});

// ---------- 팬 위 더운 공기 ----------
const NS="http://www.w3.org/2000/svg";
function puff(at,ch){
  if(still.matches)return;
  const c=document.createElementNS(NS,"circle");
  c.setAttribute("class","hz-puff");if(ch)c.setAttribute("data-ch","");
  c.setAttribute("cx",String(at[0]+(Math.random()-.5)*4));c.setAttribute("cy",String(at[1]-1));c.setAttribute("r",String(ch?1.8:1.5));
  c.style.setProperty("--dx",((Math.random()-.5)*6).toFixed(1)+"px");
  c.addEventListener("animationend",()=>c.remove());
  puffs.appendChild(c);
}

// ---------- 둘러보기 한 장면 ----------
function tourAt(t){
  const u=((t%PLAN.len)+PLAN.len)%PLAN.len;
  const s=stateAt(u,PLAN);
  const parts=u>=PLAN.stopsAt&&u<PLAN.zoomEnd;                // 부품을 차례로 짚는 구간
  const scene=u>=PLAN.at.warm&&u<PLAN.at.stop;                // 더운 오후 → 정비 장면
  const stop=parts?Math.min(D.parts-1,Math.floor((u-PLAN.stopsAt)/PLAN.stopLen)):scene?(D.phaseStop[s.phase]??-1):-1;
  return {u,zoomOn:parts||scene,stop,s};
}
function draw(s,dt){
  // 온도계 바늘: 1 °C 마다 한 장
  const ni=clamp(Math.round(s.temp)-D.needle.min,0,needles.length-1);
  if(ni!==lastNeedle&&needles[ni]){if(needles[lastNeedle])needles[lastNeedle].style.display="none";needles[ni].style.display="";lastNeedle=ni;}
  // B 밸브 손잡이: 열림(1) → 0번 그림, 닫힘(0) → 마지막 그림
  const vi=Math.round((1-s.valve)*(valves.length-1));
  if(vi!==lastValve){for(const g of valves[lastValve])g.style.display="none";for(const g of valves[vi])g.style.display="";lastValve=vi;}
  // 흐름·표시등 (속성 하나씩 켜고 끔 → CSS 가 점선을 움직이고 등 색을 바꿈)
  const on={pw:s.flow.power,water:s.flow.water,cdub:s.flow.cduB,cduc:s.flow.cduC,chill:s.chill>.5,lock:s.valve<.15,runb:s.cdu[1]>.5,runc:s.cdu[2]>.5};
  const flags=Object.keys(on).filter((key)=>on[key]).join(",");
  if(flags!==lastFlags){lastFlags=flags;for(const key of Object.keys(on))stage.toggleAttribute("data-"+key,on[key]);}
  // 더운 공기: 건식 냉각기 팬은 늘(더울수록 자주), 칠러 팬은 돌 때만
  dcClock+=dt;if(dcClock>1.1-(s.temp-20)/40){dcClock=0;puff(D.puffs.dc[Math.floor(Math.random()*D.puffs.dc.length)],false);}
  if(s.chill>.5){chClock+=dt;if(chClock>.45){chClock=0;puff(D.puffs.ch[Math.floor(Math.random()*D.puffs.ch.length)],true);}}else chClock=0;
  // 그림 아래 줄: 확대 중 말풍선을 못 띄웠으면 부품 설명, 직접 확대 중엔 쓰는 법, 그 밖엔 지금 장면
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
  draw(T.s,calm?0:dt);
  frame=visible?requestAnimationFrame(tick):0;
}
const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(tick);}};
for(const ev of ["pointermove","pointerdown"])stage.addEventListener(ev,Z.pointer);
stage.addEventListener("keydown",Z.key);
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible)run();});
// 화면 밖이면 멈춤
new IntersectionObserver(([e])=>{visible=e.isIntersecting&&!document.hidden;if(visible)run();}).observe(stage);
run();
// 검수용: 둘러보기 t 초 장면으로 바로 이동 / 상태 읽기 / 루프 멈춤
window.__hzSeek=(t)=>{clock=t;const T=tourAt(t);Z.tour(T.zoomOn,T.stop);Z.k=Z.on||Z.auto?1:0;Z.fx=Z.tfx;Z.fy=Z.tfy;Z.zc=Z.zt;Z.apply();draw(T.s,0);};
window.__hzState=()=>{const T=tourAt(clock);return {clock:+clock.toFixed(2),phase:T.s.phase,stop:T.stop,zoom:+Z.k.toFixed(3),flags:lastFlags,temp:+T.s.temp.toFixed(1),tip:stage.querySelector(".rk-tip").hasAttribute("data-on")?stage.querySelector(".rk-tip").textContent:""};};
window.__hzPlan=PLAN;
window.__hzStop=()=>{visible=false;if(frame)cancelAnimationFrame(frame);frame=0;};
