// =============================================================
// gpu.mjs — 부팅 그림의 두 번째 물건: B300 GPU 모듈 (랙 트레이 안에 들어가는 GPU 1개를 크게)
// -------------------------------------------------------------
// 시험대 위에 GPU 모듈 기판(초록 PCB)이 놓여 있고, 가운데 패키지에 실리콘 다이 2개 + HBM3e 8개.
// 그 위를 덮는 구리 냉각판(파랑 = 냉각수 공급, 빨강 = 회수)이 들리면 다이가 보이고,
// 부하가 오르면 다이가 데워집니다(WebGL 열 잉크 — 랙 그림과 같은 규칙).
// 단위: 1 = 1 mm.  x·y 가 바닥, z 가 위.  build.mjs 가 불러 씁니다.
// =============================================================
import * as k from "../kit/iso-kit.mjs";
import { glCamera } from "../kit/gl.mjs";

// ---------- 진실: GPU 한 개의 숫자 (제조사 공개 사양의 약값) ----------
export const GPU = { name: "B300", dies: 2, hbm: 8, hbmGb: 288, kw: 1.4 };

// 그림은 가로로 넓어서(폭에 맞춰 배율이 정해짐) 정사각형이면 위아래가 비었음 → 높이 452 (배율은 560 때와 같은 1.709)
const W = 560, H = 452;
const BENCH = { x: -100, y: -78, w: 200, d: 156, r: 6 };
const BENCH_Z = -10, FOOT = 6;
const PCB = { x: -80, y: -58, w: 160, d: 116, r: 3 };
const STAND = 5;                       // 기판을 받치는 황동 스탠드오프 높이
const PZ = STAND, PT = PZ + 2.4;       // 기판 아래·윗면
const SUB = { x: -40, y: -33, w: 80, d: 66, r: 1.6 };   // 패키지 기판
const ST = PT + 1.8;                   // 패키지 윗면
const DIES = [{ x: -27, y: -17, w: 26, d: 34, r: 0.6 }, { x: 1, y: -17, w: 26, d: 34, r: 0.6 }];
const DT = ST + 1.2;                   // 다이 윗면
const HBM = [];
for (const die of DIES) for (const y of [-31, 20]) for (const dx of [1, 14]) HBM.push({ x: die.x + dx, y, w: 11, d: 11, r: 0.5 });
const PLATE = { x: -46, y: -38, w: 92, d: 76, r: 3 };   // 구리 냉각판
const PLATE_H = 9;
export const LIFT = 42;                // 냉각판이 들리는 높이
const PORTS = [{ x: -16, y: 2, cls: "rk-supply" }, { x: 16, y: 2, cls: "rk-return" }];

const P = k.fitProjection(
  [...k.boxCorners(BENCH, BENCH_Z - FOOT, 0), ...k.boxCorners(PLATE, DT + LIFT, DT + LIFT + PLATE_H + 30)],
  W, H, { pad: 14, azimuth: 38, elevation: 32 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const g = (cls, body) => `<g class="${cls}">${body}</g>`;

// ---------- 시험대 (밝은 회색, 기본 토큰) ----------
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, BENCH_Z - FOOT, -BENCH_Z, P)}"/>`];
  const feet = k.corners(BENCH, 14).sort((a, b) => depth(...a) - depth(...b));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 6, BENCH_Z - FOOT, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.4, BENCH_Z - FOOT + 1.4, FOOT - 1.4, P, 20), { tone: "mid" }));
  }
  out.push(S(slab(BENCH, BENCH_Z, -BENCH_Z, 6, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), 0, P, 6), { tone: "lo" }));
  // 앞쪽 눈금자 띠 (눈금은 띠 가장자리에서 자람)
  const strip = { x: BENCH.x + 16, y: BENCH.y + BENCH.d - 12, w: BENCH.w - 32, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(Dt(k.corners(BENCH, 8).map(([x, y]) => at([x, y, 0])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- 기판과 부품 (초록 PCB, 검은 칩, 황동 스탠드오프) ----------
function board() {
  const out = [];
  const stands = k.corners(PCB, 7).sort((a, b) => depth(...a) - depth(...b));
  for (const [x, y] of stands) out.push(g("rk-brass", S(k.cylinder(x, y, 3, 0, STAND, P, 18), { tone: "mid" })));
  out.push(g("rk-pcb", S(slab(PCB, PZ, PT - PZ, 3, 0.5), { tone: "mid" }) + L(k.planOutline(k.insetPlan(PCB, 3), PT, P, 3), { tone: "faint" })
    + Dt(k.corners(PCB, 7).map(([x, y]) => at([x, y, PT])), { size: 0.6, tone: "hi" })));
  // 기판 위 부품: 깊이 순서로 (먼 것부터)
  const items = [];
  // 전원부 인덕터: 좌우 가장자리 2열 × 5행
  for (const x0 of [-77, -66, 57, 68]) for (let i = 0; i < 5; i++) {
    const plan = { x: x0, y: -48 + i * 19, w: 9, d: 9, r: 1 };
    items.push({ d: depth(x0 + 4.5, plan.y + 4.5, PT), svg: g("rk-chip", S(slab(plan, PT, 5, 2, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(plan, 2), PT + 5, P, 2), { tone: "faint" })) });
  }
  // 콘덴서: 패키지 좌우 한 줄씩 (작은 원기둥, 윗면 금빛 점)
  for (const x of [-50, 50]) for (let i = 0; i < 9; i++) {
    const y = -40 + i * 10;
    items.push({ d: depth(x, y, PT), svg: g("rk-brass", S(k.cylinder(x, y, 1.8, PT, 3.2, P, 14), { tone: "hi" })) });
  }
  // 뒤쪽 가장자리 메자닌 커넥터 2개 (검정) + 앞쪽 라벨판 (흰 바탕 + 글줄 3개)
  for (const x of [-56, 14]) {
    const plan = { x, y: PCB.y + 4, w: 42, d: 8, r: 0.8 };
    items.push({ d: depth(x + 21, plan.y + 4, PT), svg: g("rk-chip", S(slab(plan, PT, 4, 2, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(plan, 1.4), PT + 4, P, 2), { tone: "faint" })) });
  }
  const label = { x: -36, y: PCB.y + PCB.d - 16, w: 30, d: 11, r: 0.8 };
  items.push({ d: depth(label.x + 15, label.y + 5, PT), svg: g("rk-paper", S(k.slabOf(label, PT, 0.6, P, 2), { tone: "hi", crease: "none" })
    + L([3.5, 6, 8.5].map((dy, i) => k.lineOnTop([label.x + 3, label.y + dy], [label.x + 3 + [22, 16, 19][i], label.y + dy], PT + 0.6, P)).join(""), { tone: "lo", free: true })) });
  items.sort((a, b) => a.d - b.d);
  out.push(...items.map((i) => i.svg));
  return out.join("");
}

// ---------- 패키지: 기판 위 짙은 패키지, 다이 2개(주제, lit), HBM 8개 ----------
function pack() {
  const out = [g("rk-substrate", S(slab(SUB, PT, ST - PT, 3, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(SUB, 2), ST, P, 3), { tone: "faint" }))];
  const items = [];
  for (const h of HBM) items.push({ d: depth(h.x + h.w / 2, h.y + h.d / 2, ST), svg: g("rk-chip", S(slab(h, ST, 1.4, 2, 0.3), { tone: "mid" }) + L(k.planOutline(k.insetPlan(h, 1.6), ST + 1.4, P, 2), { tone: "faint" })) });
  for (const die of DIES) items.push({ d: depth(die.x + die.w / 2, die.y + die.d / 2, ST), svg: g("rk-die", S(slab(die, ST, DT - ST, 2, 0.4), { tone: "hi", lit: true, className: "rk-die-solid" })) });
  items.sort((a, b) => a.d - b.d);
  out.push(...items.map((i) => i.svg));
  // 패키지 네 귀퉁이 정렬 점
  out.push(Dt(k.corners(SUB, 3).map(([x, y]) => at([x, y, ST])), { size: 0.45, tone: "hi" }));
  return out.join("");
}

// ---------- 냉각판 (앞쪽 SVG, 들림): 구리 블록 + 홈 + 스프링 나사 4개 + 공급·회수 포트와 커플러 ----------
function coldPlate() {
  const out = [];
  const z0 = DT;
  out.push(g("rk-copper", S(slab(PLATE, z0, PLATE_H, 4, 0.8), { tone: "hi", lit: true }) + L(k.planOutline(k.insetPlan(PLATE, 5), z0 + PLATE_H, P, 3), { tone: "faint" })
    + L(k.sideSeam(PLATE, z0 + 3, P, 4), { tone: "faint" })));
  // 스프링 나사: 귀퉁이 4개 (먼 것부터)
  const screws = k.corners(PLATE, 6).sort((a, b) => depth(...a) - depth(...b));
  for (const [x, y] of screws) out.push(g("rk-steel", S(k.cylinder(x, y, 3, z0 + PLATE_H, 2.2, P, 18), { tone: "mid" }) + L(k.ring(x, y, 1.2, z0 + PLATE_H + 2.2, P, 12), { tone: "lo" })));
  // 포트: 먼 것(공급)부터. 포트 → 커플러 → 짧은 호스 → 끝 캡
  const ports = [...PORTS].sort((a, b) => depth(a.x, a.y) - depth(b.x, b.y));
  for (const p of ports) {
    let z = z0 + PLATE_H;
    const parts = [];
    parts.push(S(k.cylinder(p.x, p.y, 4.6, z, 5, P, 24), { tone: "mid" })); z += 5;
    parts.push(S(k.cylinder(p.x, p.y, 6, z, 4.4, P, 28, 0.4), { tone: "hi" }) + L(k.knurl(p.x, p.y, 6, z, z + 4.4, 22, P), { tone: "lo" })); z += 4.4;
    parts.push(S(k.cylinder(p.x, p.y, 3.8, z, 12, P, 20), { tone: "mid", crease: "none" }) + L(k.sideArc(p.x, p.y, 3.8, z + 6, P, 14), { tone: "faint" })); z += 12;
    parts.push(S(k.cylinder(p.x, p.y, 5, z, 3, P, 22), { tone: "hi" }));
    out.push(g(p.cls, parts.join("")));
  }
  return out.join("");
}

export function gpuFigure() {
  const LABEL = `${GPU.name} GPU module on a test bench: a green board with two silicon dies and ${GPU.hbm} HBM3e stacks (${GPU.hbmGb} GB) under a copper liquid cold plate with blue supply and red return ports. The cold plate lifts to show the dies, which warm with load.`;
  const back = [bench(), board(), pack()];
  const backSvg = k.figureSvg({ width: W, height: H, label: LABEL, body: back, className: "rk-back" });
  const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rk-layer rk-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g data-part="plate">${coldPlate()}</g></svg>`;
  const lift = k.axisVector(P, [0, 0, 1]);
  const DATA = { W, H, camera: glCamera(P), lift: [lift[0], lift[1]], liftMax: LIFT, zDie: DT, dies: DIES.map((d) => [d.x, d.y, d.w, d.d]), gpu: GPU };
  const FRAGMENT = `
uniform float uLoad;
uniform float uFirst;
float uPx;
const float ZD=${DT.toFixed(2)};
const vec4 D0=vec4(${DATA.dies[0].join(",")}),D1=vec4(${DATA.dies[1].join(",")});
float boxDist(vec2 p,vec4 b){vec2 c=b.xy+b.zw*.5;vec2 q=abs(p-c)-b.zw*.5;return length(max(q,0.))+min(max(q.x,q.y),0.);}
// 다이 두 개: 윤곽선 안쪽 가장자리에서 끝나고, 가운데가 더 뜨거움(창백한 심)
float heatOf(vec2 p){float h=0.;for(int i=0;i<2;i++){vec4 b=i==0?D0:D1;float d=boxDist(p,b);float inside=1.-smoothstep(-.3-.7*uPx,-.3+.7*uPx,d);h+=inside*(.55+.45*(1.-smoothstep(-13.,-2.,d)));}return min(h,1.);}
vec3 paperOf(float e){vec3 c=mix(vec3(1.),vec3(1.,.93,.72),smoothstep(0.,.25,e));c=mix(c,vec3(1.,.70,.30),smoothstep(.2,.6,e));c=mix(c,vec3(.93,.42,.14),smoothstep(.55,.92,e));c=mix(c,vec3(1.,.9,.62),smoothstep(.93,1.,e));return c;}
vec4 inkFor(vec3 seen,float cover){vec3 ab=1.-seen;float a=max(max(ab.r,max(ab.g,ab.b)),cover);return vec4(vec3(a)-ab,a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.z;uPx=px;
  vec3 p=onFloor(vb,ZD);
  float e=heatOf(p.xy)*uLoad;
  if(e<.002){gl_FragColor=vec4(0.);return;}
  e=1.-exp(-2.4*e);
  vec4 ink=inkFor(paperOf(e),.94*smoothstep(.9,1.,e))*uFirst;
  float m=ink.a;
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  ink=max(ink+n*smoothstep(0.,1.5/255.,m),0.);ink.rgb=min(ink.rgb,vec3(ink.a));
  gl_FragColor=ink;
}`;
  return { backSvg, frontSvg, DATA, FRAGMENT };
}
