// =============================================================
// zoomer.js — 그림 페이지들이 같이 쓰는 "확대 + 말풍선 + 아래 줄" 코드 (전력 블록·Horizon 홀)
//   각 그림의 build.mjs 가 이 파일을 그 그림의 live.js 앞에 붙여 페이지에 넣음 (kit 없이 동작)
//   여기 함수들은 live.js 가 만든 전역 이름(INFO·KO·ZT·btn·clamp·sm·run)을 "불릴 때" 씀
//   → 이 파일이 먼저 붙어도 괜찮음 (함수 안의 이름은 실행될 때 찾음)
// =============================================================
// 그림 아래 줄 쓰기 (cap = 부품 설명: 이름을 굵게)
const say=(el,text,cap,phase)=>{if(!el)return;const key=text+"|"+(cap?1:0)+"|"+(phase||"");if(el._t===key)return;el._t=key;
  if(cap){const i=text.indexOf(" · "),b=document.createElement("b");b.textContent=i<0?text:text.slice(0,i);el.replaceChildren(b,i<0?"":text.slice(i));el.setAttribute("data-cap","");}
  else{el.textContent=text;el.removeAttribute("data-cap");}
  if(phase)el.setAttribute("data-phase",phase);else el.removeAttribute("data-phase");};

// ---------- 확대 (부팅 그림의 zoomer 와 같은 방식) ----------
// 보이는 범위(viewBox)를 좁혀 크게: 돋보기 매핑이라 포인터가 가리키는 점이 확대 화면에서도 포인터 아래에 옴
function zoomer(st,{W,H,zoom,focus,stops}){
  const svgs=[...st.querySelectorAll(":scope>svg")], aimEl=st.querySelector(".rk-aim");
  const tipEl=st.querySelector(".rk-tip"), tipB=tipEl.querySelector("b"), tipS=tipEl.querySelector("span");
  let tipKey="", tipText="", tipShown=false;
  // 말풍선: 짚는 곳 바로 옆 (오른쪽 → 왼쪽 → 아래 → 위, 손가락이면 위부터). 어디에도 안 들어가면 그림 아래 줄로
  function tip(text,fx,fy,glide,touch,prefer){
    const Ws=st.clientWidth,Hs=st.clientHeight,x=fx*Ws,y=fy*Hs;
    const key=text?[text,x.toFixed(0),y.toFixed(0),Ws,Hs,touch?1:0,prefer||""].join("|"):"";
    if(key===tipKey)return;tipKey=key;
    if(!text){tipShown=false;tipEl.removeAttribute("data-on");return;}
    if(text!==tipText){tipText=text;const parts=text.split(" · ");tipB.textContent=parts[0];
      tipS.replaceChildren(...parts.slice(1).flatMap((p,i)=>i?[document.createElement("br"),p]:[p]));}
    const w=tipEl.offsetWidth,h=tipEl.offsetHeight,G=touch?40:28,M=6;
    const fits={right:x+G+w<=Ws-M,left:x-G-w>=M,bottom:y+G+h<=Hs-M,top:y-G-h>=M};
    const order=touch?["top","right","left","bottom"]:["right","left","bottom","top"];
    const side=(prefer?[prefer,...order.filter((k)=>k!==prefer)]:order).find((k)=>fits[k]);   // 짚는 곳이 정한 자리(prefer)부터
    tipShown=!!side;if(!side){tipEl.removeAttribute("data-on");return;}
    const across=side==="right"||side==="left";
    let left=side==="right"?x+G:side==="left"?x-G-w:x-w/2, top=across?y-h/2:side==="bottom"?y+G:y-G-h;
    left=clamp(left,M,Math.max(M,Ws-w-M));top=clamp(top,M,Math.max(M,Hs-h-M));
    const lead=across?clamp(y-top,10,h-10):clamp(x-left,12,w-12);
    const was=tipEl.hasAttribute("data-on");
    if(!was)tipEl.removeAttribute("data-glide");
    tipEl.setAttribute("data-side",side);
    tipEl.style.left=left.toFixed(0)+"px";tipEl.style.top=top.toFixed(0)+"px";tipEl.style.setProperty("--lead",lead.toFixed(0)+"px");
    if(!was)void tipEl.offsetWidth;
    tipEl.toggleAttribute("data-glide",!!glide);tipEl.setAttribute("data-on","");
  }
  const Z={on:false,auto:false,stop:null,autoInfo:"",k:0,fx:.5,fy:.5,tfx:.5,tfy:.5,info:"",box:"",px:null,py:null,keys:false,moved:true,shown:false,touch:false,zt:zoom,zc:zoom};
  const aimAt=(fx,fy,kind)=>{aimEl.style.left=(fx*100).toFixed(1)+"%";aimEl.style.top=(fy*100).toFixed(1)+"%";st.setAttribute("data-aim",kind);};
  Z.tour=(on,i)=>{
    if(Z.on)return;Z.auto=on;const s=on&&i>=0?stops[i]:null;
    if(s!==Z.stop){Z.stop=s;
      if(s){Z.tfx=s.fx;Z.tfy=s.fy;Z.zt=s.z||zoom;Z.autoInfo=INFO[s.key]?INFO[s.key][KO?0:1]:"";aimAt(s.fx,s.fy,"auto");}
      else{Z.autoInfo="";st.removeAttribute("data-aim");}}};
  Z.caption=()=>tipShown||Z.k<=.6?"":Z.on?Z.info:Z.auto&&Z.stop?Z.autoInfo:"";
  Z.rect=()=>{const s=1+(Z.zc-1)*sm(0,1,Z.k),w=W/s,h=H/s;return [Z.fx*(W-w),Z.fy*(H-h),w,h];};
  Z.pick=(x,y)=>{const el=document.elementFromPoint(x,y);const g=el&&el.closest?el.closest("[data-info]"):null;const key=g&&st.contains(g)?g.getAttribute("data-info"):"";Z.info=key&&INFO[key]?INFO[key][KO?0:1]:"";};
  Z.apply=()=>{
    const r=Z.rect(),box=r.map((n)=>n.toFixed(2)).join(" ");
    const shown=Z.on||Z.k>0;if(shown!==Z.shown){Z.shown=shown;st.toggleAttribute("data-zoom",shown);}
    if(box!==Z.box){Z.box=box;Z.moved=true;for(const s of svgs)s.setAttribute("viewBox",box);}
    if(Z.on&&Z.moved){if(Z.px!==null)Z.pick(Z.px,Z.py);else if(Z.keys){const b=st.getBoundingClientRect();Z.pick(b.left+Z.tfx*b.width,b.top+Z.tfy*b.height);}Z.moved=false;}
    if(Z.k>.6&&Z.on&&Z.info)tip(Z.info,Z.tfx,Z.tfy,Z.keys,Z.touch);
    else if(Z.k>.6&&!Z.on&&Z.auto&&Z.stop&&Z.autoInfo)tip(Z.autoInfo,Z.stop.fx,Z.stop.fy,true,false,Z.stop.side);
    else tip("");
    return r;};
  Z.set=(on)=>{
    if(Z.on===on)return;Z.on=on;
    if(on){Z.fx=Z.tfx=focus[0]/W;Z.fy=Z.tfy=focus[1]/H;Z.info="";Z.px=null;Z.keys=false;Z.zt=zoom;}
    Z.stop=null;Z.autoInfo="";st.removeAttribute("data-aim");
    st.style.touchAction=on?"none":"";
    btn.setAttribute("aria-pressed",String(on));btn.innerHTML=on?ZT.out:ZT.in;btn.removeAttribute("data-call");
    st.setAttribute("aria-label",ZT.aria[on?1:0]);run();};
  Z.step=(dt,calm)=>{const zk=Z.on||Z.auto?1:0;Z.k=calm?zk:Z.k+(zk-Z.k)*(1-Math.exp(-dt/.3));if(Math.abs(zk-Z.k)<.002)Z.k=zk;
    const zf=calm?1:1-Math.exp(-dt/(Z.on?.12:.35));Z.fx+=(Z.tfx-Z.fx)*zf;Z.fy+=(Z.tfy-Z.fy)*zf;
    Z.zc+=(Z.zt-Z.zc)*(calm?1:1-Math.exp(-dt/.45));};   // 배율도 천천히 바뀜
  Z.pointer=(e)=>{if(!Z.on)return false;const b=st.getBoundingClientRect();
    Z.tfx=clamp((e.clientX-b.left)/b.width,0,1);Z.tfy=clamp((e.clientY-b.top)/b.height,0,1);Z.touch=e.pointerType==="touch";
    Z.px=e.clientX;Z.py=e.clientY;Z.keys=false;Z.moved=true;st.removeAttribute("data-aim");run();return true;};
  st.addEventListener("pointerleave",(e)=>{if(Z.on&&!Z.keys&&e.pointerType!=="touch"){Z.px=null;Z.info="";run();}});
  Z.key=(e)=>{
    if(e.key==="+"||e.key==="="){e.preventDefault();Z.set(true);return true;}
    if((e.key==="-"||e.key==="Escape")&&Z.on){e.preventDefault();Z.set(false);return true;}
    if(!Z.on)return false;
    let dx=0,dy=0;if(e.key==="ArrowLeft")dx=-.05;if(e.key==="ArrowRight")dx=.05;if(e.key==="ArrowUp")dy=-.06;if(e.key==="ArrowDown")dy=.06;
    if(!dx&&!dy)return false;e.preventDefault();Z.tfx=clamp(Z.tfx+dx,0,1);Z.tfy=clamp(Z.tfy+dy,0,1);Z.px=null;Z.keys=true;Z.touch=false;Z.moved=true;
    aimAt(Z.tfx,Z.tfy,"");run();return true;};
  btn.addEventListener("click",()=>Z.set(!Z.on));
  st.addEventListener("dblclick",(e)=>{e.preventDefault();Z.set(!Z.on);});
  return Z;
}
