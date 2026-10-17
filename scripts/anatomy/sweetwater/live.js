// =============================================================
// live.js — 스위트워터 1 그림의 움직임 (build.mjs 가 자리표를 채워 shared/zoomer.js 뒤에 붙여 넣음)
//   둘러보기: 확대해 전기가 내려오는 계단(345 → 138 → 34.5 kV → 홀 → 랙) → 열이 나가는 길 순서로 부품을 짚고(말풍선) →
//             ① 더운 오후: 온도계 바늘이 오르고 냉각기 팬이 빨라지지만 칠러는 없음 → 저녁에 느려짐
//             ② 다음 단계: 비워 둔 자리에 흐린 변압기가 나타났다 사라짐 → 처음으로
//   상태(기온·팬·다음 단계·흐름)는 model.mjs 의 stateAt 을 빌드 때 그대로 넣어 계산 → 그림과 글이 어긋나지 않음
//   보기: 전체 | 회사 확인 — '회사 확인'은 회사가 밝히지 않아 그린 구역(홀 안·냉각 설비·다음 단계 자리)을 하얗게 (주소 끝 #confirmed 로도 열림)
// =============================================================
const D=__DATA__, KO=__KO__, PH=__PHASE__, ZT=__ZOOM__;
const BASE_INFO=__INFO__, CONF_INFO=__CONFINFO__;   // 부품 설명: 전체 보기 / '회사 확인' 보기 (맨 앞에 회사 확인·그림 표현)
let INFO=BASE_INFO;                                  // 확대·말풍선 코드(zoomer.js)가 부를 때마다 이 이름을 찾음 → 보기를 바꾸면 설명도 바뀜
const stateAt=__STATE__;
const stage=document.querySelector(".sw-stage");
const read=document.querySelector("[data-readout=sweetwater]");
const btn=document.querySelector("[data-zoom=sw]");
const fig=document.querySelector(".sw-fig");
const viewBtns=[...document.querySelectorAll("[data-view-btn]")];
let view="all";
// 온도계 바늘 그림 (needles[i] = D.needle.min + i °C) · 팬 날개 그림 (fans[i] = 15° × i 돌린 날개, 팬 5개가 같은 번호를 씀)
const needles=[...stage.querySelectorAll("[data-needle]")];
const fans=Array.from({length:D.fan},(_,i)=>[...stage.querySelectorAll('[data-fan="'+i+'"]')]);
const puffs=stage.querySelector(".hz-puffs");
const still=matchMedia("(prefers-reduced-motion: reduce)");
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sm=(a,b,x)=>{const q=clamp((x-a)/(b-a),0,1);return q*q*(3-2*q);};
const PLAN=D.plan, STOPS=D.stops;
let clock=0,last=0,frame=0,visible=true,lastNeedle=0,lastFan=0,lastFlags="",lastFuture=-1,fanTurn=0,puffClock=0;

// 그림 아래 줄 쓰기(say)와 확대(zoomer)는 ../shared/zoomer.js (build.mjs 가 이 파일 앞에 붙임)
const Z=zoomer(stage,{W:D.W,H:D.H,zoom:D.zoom,focus:D.focus,stops:STOPS});

// ---------- 팬 위 데워진 공기 ----------
const NS="http://www.w3.org/2000/svg";
function puff(at){
  if(still.matches)return;
  const c=document.createElementNS(NS,"circle");
  c.setAttribute("class","hz-puff");
  c.setAttribute("cx",String(at[0]+(Math.random()-.5)*4));c.setAttribute("cy",String(at[1]-1));c.setAttribute("r","1.5");
  c.style.setProperty("--dx",((Math.random()-.5)*6).toFixed(1)+"px");
  c.addEventListener("animationend",()=>c.remove());
  puffs.appendChild(c);
}

// ---------- 둘러보기 한 장면 ----------
function tourAt(t){
  const u=((t%PLAN.len)+PLAN.len)%PLAN.len;
  const s=stateAt(u,PLAN);
  const parts=u>=PLAN.stopsAt&&u<PLAN.zoomEnd;                // 부품을 차례로 짚는 구간
  const scene=u>=PLAN.at.warm&&u<PLAN.at.stop;                // 더운 오후 → 다음 단계 장면
  const stop=parts?Math.min(D.parts-1,Math.floor((u-PLAN.stopsAt)/PLAN.stopLen)):scene?(D.phaseStop[s.phase]??-1):-1;
  return {u,zoomOn:parts||scene,stop,s};
}
function draw(s,dt){
  // 온도계 바늘: 1 °C 마다 한 장
  const ni=clamp(Math.round(s.temp)-D.needle.min,0,needles.length-1);
  if(ni!==lastNeedle&&needles[ni]){if(needles[lastNeedle])needles[lastNeedle].style.display="none";needles[ni].style.display="";lastNeedle=ni;}
  // 팬 날개: 더울수록 빨리 (1초에 8장 → 20장, 한 장 = 15°). 움직임 줄이기면 멈춤
  fanTurn+=dt*(8+12*(s.fan-.45)/.55);
  const fi=Math.floor(fanTurn)%fans.length;
  if(fi!==lastFan){for(const g of fans[lastFan])g.style.display="none";for(const g of fans[fi])g.style.display="";lastFan=fi;}
  // 다음 단계 흐린 그림: 0.01 씩만 고쳐 씀
  const fu=Math.round(s.future*100)/100;
  if(fu!==lastFuture){lastFuture=fu;stage.style.setProperty("--future",String(fu));}
  // 흐름 (속성 하나씩 켜고 끔 → CSS 가 점선을 움직임)
  const on={pw:s.flow.power,water:s.flow.water,future:s.flow.future};
  const flags=Object.keys(on).filter((key)=>on[key]).join(",");
  if(flags!==lastFlags){lastFlags=flags;for(const key of Object.keys(on))stage.toggleAttribute("data-"+key,on[key]);}
  // 데워진 공기: 팬이 빠를수록 자주
  puffClock+=dt;if(puffClock>1.25-.8*(s.fan-.45)/.55){puffClock=0;puff(D.puffs[Math.floor(Math.random()*D.puffs.length)]);}
  // 그림 아래 줄: 확대 중 말풍선을 못 띄웠으면 부품 설명, 직접 확대 중엔 쓰는 법, 그 밖엔 지금 장면 ('회사 확인' 보기면 그 보기 안내)
  const cap=Z.caption(), ph=view==="confirmed"?"confirmed":s.phase;
  say(read,cap||(Z.on?ZT.hint:PH[ph][KO?0:1]),!!cap,cap||Z.on?"":ph);
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/20):1/60;last=now;const calm=still.matches;
  // 직접 확대 중엔 둘러보기 시계를 멈춤 (끝나면 멈춘 곳부터 이어짐). 움직임 줄이기: 평소 상태로 정지
  // '회사 확인' 보기도 둘러보기를 멈추고 평소 모습 (직접 확대·말풍선은 됨)
  const hold=calm||view==="confirmed";
  if(!hold&&!Z.on)clock+=dt;
  const T=tourAt(hold?0:clock);
  if(!hold&&!Z.on)Z.tour(T.zoomOn,T.stop);else Z.tour(false,-1);
  Z.step(dt,calm);Z.apply();
  draw(T.s,hold?0:dt);
  frame=visible?requestAnimationFrame(tick):0;
}
const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(tick);}};
// ---------- 보기 바꾸기: 그림은 그대로, .sw-fig 의 data-view 만 바꿈 → CSS 가 하얗게 칠할 구역의 색과 글(제목 아래 줄·범례·설명)을 바꿈 ----------
function setView(v){
  if(v===view||(v!=="all"&&v!=="confirmed"))return;view=v;
  fig.setAttribute("data-view",v);
  for(const b of viewBtns)b.setAttribute("aria-pressed",String(b.getAttribute("data-view-btn")===v));
  INFO=v==="confirmed"?CONF_INFO:BASE_INFO;
  Z.tour(false,-1);clock=0;Z.moved=true;   // 둘러보기는 처음부터, 직접 확대 중이면 말풍선 설명을 새 보기로 다시 찾음
  try{history.replaceState(null,"",v==="confirmed"?"#confirmed":location.pathname+location.search);}catch(e){}   // 새로 고쳐도 같은 보기
  draw(tourAt(0).s,0);   // 아래 줄 글을 바로 바꿈 (화면 밖·숨은 탭이라 다음 그리기가 늦어도)
  run();
}
for(const b of viewBtns)b.addEventListener("click",()=>setView(b.getAttribute("data-view-btn")));
for(const ev of ["pointermove","pointerdown"])stage.addEventListener(ev,Z.pointer);
stage.addEventListener("keydown",Z.key);
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible)run();});
// 화면 밖이면 멈춤
new IntersectionObserver(([e])=>{visible=e.isIntersecting&&!document.hidden;if(visible)run();}).observe(stage);
if(/^#confirmed\b/.test(location.hash))setView("confirmed");   // 주소 끝이 #confirmed 면 '회사 확인' 보기로 시작
run();
// 검수용: 둘러보기 t 초 장면으로 바로 이동 / 상태 읽기 / 루프 멈춤 / 보기 바꾸기
window.__swSeek=(t)=>{clock=t;const T=tourAt(t);Z.tour(T.zoomOn,T.stop);Z.k=Z.on||Z.auto?1:0;Z.fx=Z.tfx;Z.fy=Z.tfy;Z.zc=Z.zt;Z.apply();draw(T.s,0);};
window.__swState=()=>{const T=tourAt(clock);return {clock:+clock.toFixed(2),view,phase:T.s.phase,stop:T.stop,zoom:+Z.k.toFixed(3),flags:lastFlags,temp:+T.s.temp.toFixed(1),fan:+T.s.fan.toFixed(2),future:+T.s.future.toFixed(2),tip:stage.querySelector(".rk-tip").hasAttribute("data-on")?stage.querySelector(".rk-tip").textContent:""};};
window.__swPlan=PLAN;
window.__swView=setView;
window.__swStop=()=>{visible=false;if(frame)cancelAnimationFrame(frame);frame=0;};
