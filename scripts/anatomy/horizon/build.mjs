// =============================================================
// build.mjs — "Horizon 액체냉각 홀" 그림: 차일드레스 Horizon 홀 한 토막 (anatomy 스킬 방식)
// -------------------------------------------------------------
// "물건이 곧 설명": 두 길이 랙에서 만남
//   전기  : 1차 변전소 6 → 중압(땅속) → 홀 변압기 A·B → 저압 케이블 → 배전반 A·B (← 디젤 발전기) → UPS·배터리
//           → 버스웨이(랙 위) → 탭오프 → GB300 NVL72 랙 전원 선반 → 직류 버스바 → GPU
//   냉각수: GPU 냉각판 → 트레이 구리관 → 랙 매니폴드 → 호스 → 천장 2차 배관 → CDU(열교환기·펌프)
//           → 벽 밖 1차 배관 → 건식 냉각기 → 칠러(더운 날만 보탬) → 펌프 → 다시 CDU
// 둘러보기: 부품을 차례로 짚은 뒤 ① 더운 오후에 칠러가 보태는 모습 ② CDU 하나를 정비해도 냉각이 계속되는 모습
// 숫자·출처·시간표는 model.mjs (회사 자료 + 사이트 가정)
//
// 사용법: node scripts/anatomy/horizon/build.mjs           (그림 만들기)
//         node scripts/anatomy/horizon/build.mjs --audit   (+ 관통·끝점·칠하는 순서 검사)
//   → public/figures/horizon-hall.ko.html / horizon-hall.en.html (3D 차일드레스 화면에서 Horizon 건물을 누르면 열림)
// 단위: 1 = 10 cm. x = 홀 벽을 따라 오른쪽, y = 벽에서 마당 쪽(+y 가 보는 쪽), z = 위
// =============================================================
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { workshop, auditAll } from "../rack/shop.mjs";
import { HORIZON, EST, FLOW, OVERHEAD_MW, WATER, SOURCES, TEMP, CAMPUS, MSFT, tourPlan, stateAt, scaleLadder } from "./model.mjs";
import { platesHtml, PLATE_BASIS } from "../shared/tools.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- 세계 배치 ----------
// 홀 바깥벽: 바깥면 y = 0, 두께 3. 왼쪽 끝만 온전한 높이(변압기 케이블이 들어오는 자리), 나머지는 허물어 홀 안이 보이게
//   CDU 앞(x 82..124)은 거의 바닥까지 허물어 냉각수 관이 벽을 지나 CDU 로 들어가는 모습이 보이게
const WALL_T = 3;
const WALL = { t: WALL_T, h: 46, x0: -20, x1: 254, full: 8, step: 18, mid: 30, low: 12, s0: 82, s1: 124, stub: 3.4 };
const HALL = { back: -48, floor: 1.5 };                       // 홀 바닥 뒤 끝 y = −48 (건물을 잘라 낸 단면 모형)
const BASE = { x: -34, y: -58, w: 300, d: 172, r: 3 };        // 받침판: x −34..266, y −58..114
const SLAB = 3;                                                // 마당 콘크리트 패드 두께 (30 cm)

// 전기 (왼쪽): 변압기 A·B (벽 앞), 중압 도랑 (변압기 앞), 발전기 (앞 왼쪽) + 발전기 관 도랑
const XA = { x: -31, y: 6, w: 16, d: 13, r: 0.6 }, XB = { x: -8, y: 6, w: 16, d: 13, r: 0.6 };
const XF_H = 19, XF_FRONT_D = 5;                               // 탱크 높이, 앞 단자함 깊이 (y 19..24)
const MV_TRENCH = { x: -30, y: 25.5, w: 40, d: 9, pit: SLAB - 3.6 }; // 중압 인입 도랑 (왼쪽 끝 = 1차 변전소 6 쪽 땅속, 깊이 36 cm 만 보여 줌)
const GEN = { x: -30, y: 80, w: 58, d: 24, r: 0.8 }, GEN_TANK = 8, GEN_BOX = 24;
const GT = { x: 34, y: 8, w: 14, d: 76, pit: SLAB - 3.6 };      // 발전기 → 배전반 관 도랑
// 전기실 (홀 안 왼쪽, 벽에서 먼 줄): 배전반 A(2칸)·B(2칸) · UPS · 배터리
const SB = { x: 20, y: -34, w: 9, d: 12, h: 23, n: 4 };       // 칸 x 20, 29 | 38, 47
// UPS A·B: 함마다 왼쪽 절반 = UPS(어두운 함·화면), 오른쪽 절반 = 배터리 칸(환기 슬롯·경고판) — 그림에서는 한 함으로 묶음
const UPS = { xs: [58.5, 68.5], y: -32, w: 9, d: 10, h: 20, r: 0.2 };
// CDU 3대 (벽 바로 안쪽, 앞면이 벽·보는 쪽): A 가동 · B 가동(앞판을 뗌) · C 대기
const CDU = { xs: [88, 100, 112], tags: ["a", "c", "b"], y: -16, w: 10, d: 12, h: 22 };
const cduX = (tag) => CDU.xs[CDU.tags.indexOf(tag)];      // 이름(a·b·c) → 왼쪽 끝 x
const PORT = { sup: 2.5, ret: 4.3, zr: 9, tcsR: 3, tcsS: 7, yR: -7.0, yS: -7.55 };   // 관 자리 (CDU 왼쪽 끝에서 x)
const HX = { x: 1.4, w: 4.0, y: -8.3, d: 2.8 };                 // B 의 열교환기 (앞면 y = −7.5)
// 랙 줄: GB300 NVL72 16대, 뒷면(+y)이 보는 쪽 (매니폴드·버스바가 뒤에 있음). 마지막 랙은 옆판을 뗌
const RACK0 = 126, RACK_W = 6, RACKS = 16;                     // x 126..222
const RACK_Y = -33, RACK_D = 10.7, RACK_H = 22.4;              // 앞 y = −33, 뒤 y = −22.3, 키 2.24 m
const RACK_TOP = HALL.floor + RACK_H;                          // 23.9
const CART = { x: 230, y: -16, w: 20, d: 10 };                 // 정비 카트 (꺼낸 컴퓨트 트레이)
// 천장 쪽: 2차 냉각수 공급(파랑)·회수(빨강) 배관, 버스웨이, 광케이블 트레이
const SUP = { y: -16.5, z: 28.5, r: 1.0 }, RET = { y: -19.5, z: 31.5, r: 1.0 };
const HDR = { x0: 90, x1: 223 };
// 버스웨이 A·B (랙 위 두 줄): 랙마다 양쪽에서 받음 → 한쪽 길을 정비해도 GPU 는 계속 (Tier III 수준 동시 유지보수)
const BUSES = [{ tag: "a", y: -30, x0: 60, joints: [60, 90, 116, 142, 168, 194, 222], tapX: 1.7 }, { tag: "b", y: -25, x0: 70, joints: [70, 90, 116, 142, 168, 194, 222], tapX: 3.9 }];
const BUS = { z: 30.5, w: 1.8, h: 2.4, y: BUSES[0].y };   // 공통 높이·폭 (y = 뒤쪽 줄, 랙 위 받침대 팔 길이 기준)
const FIB = { y: -42, z: 31, w: 4 };
// 이음쇠(공) 반지름: 호스(0.3)·CDU 관(0.6) → 천장 배관(1.0), 가지관(0.6) → 마당 배관(1.6), 펌프 관(0.8) → 공급 배관, 꺾이는 엘보
const TEE = { hose: 1.15, riser: 1.25, yard: 1.8, pump: 1.85, elbow: 1.9 };
// 마당 1차 냉각수 배관 (벽을 따라 받침 위): 공급(찬물, CDU 로) · 회수(데워진 물, 냉각기로)
const YS = { y: 5, z: 5.4, r: 1.6 }, YR = { y: 10, z: 9, r: 1.6 };
// 바깥 냉각 설비 (앞 오른쪽): 건식 냉각기 · 칠러 패키지(오른쪽 끝 = 펌프 칸) · 바깥 온도계
const DC = { x: 70, y: 58, w: 114, d: 24, r: 0.5 };            // 건식 냉각기 (팬 7개짜리 긴 코일 뱅크)
const CH = { x: 208, y: 58, w: 32, d: 24, r: 0.5 };
const PS = { x: 240, y: 58, w: 15, d: 24, r: 0.3 };
const THERMO = { x: 213, y: 84.6, z: 18.6, r: 2.6 };              // 칠러 앞면에 붙은 바깥 기온계

const WIDTH = 1000;
const EXTREMES = [...k.boxCorners(BASE, -13, 0), [WALL.x0, -WALL.t, WALL.h], [WALL.x0, 0, WALL.h], [HDR.x0, HALL.back, 36], [GEN.x + 50, GEN.y + 14, 52]];
const AZ = 47, EL = 31;
const unit = k.fitProjection(EXTREMES, 1000, 1000, { pad: 0, azimuth: AZ, elevation: EL });
const box0 = EXTREMES.map((p) => k.iso(p, unit));
const aspect = (Math.max(...box0.map((p) => p[0])) - Math.min(...box0.map((p) => p[0]))) / (Math.max(...box0.map((p) => p[1])) - Math.min(...box0.map((p) => p[1])));
const HEIGHT = Math.round((WIDTH - 24) / aspect + 24);
const P = k.fitProjection(EXTREMES, WIDTH, HEIGHT, { pad: 12, azimuth: AZ, elevation: EL });
const at = (p) => k.iso(p, P);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts) => `M${pts.map((p) => at(p).map(r1).join(" ")).join("L")}Z`;   // 3D 다각형 → 화면 경로 (닫힘)

const W = workshop(P, { piece: "hz" });
const { R } = W;

// ---------- 작은 도구들 ----------
const onFront = (Y, pts) => pts.map(([x, z]) => [x, Y, z]);
const onRight = (X, pts) => pts.map(([y, z]) => [X, y, z]);
const pathOf3 = (pts) => `M${pts.map((p) => at(p).map(r1).join(" ")).join("L")}`;
function frontSlots(Y, x0, x1, z0, n, pitch, h) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = z0 + i * pitch, b = a + h; out.push(pathOf3(onFront(Y, [[x0, a], [x1, a], [x1, b], [x0, b], [x0, a]]))); }
  return out.join("");
}
function rightSlots(X, y0, y1, z0, n, pitch, h) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = z0 + i * pitch, b = a + h; out.push(pathOf3(onRight(X, [[y0, a], [y1, a], [y1, b], [y0, b], [y0, a]]))); }
  return out.join("");
}
const frontSeams = (Y, xs, z0, z1) => xs.map((x) => seg([x, Y, z0], [x, Y, z1])).join("");
const rightSeams = (X, ys, z0, z1) => ys.map((y) => seg([X, y, z0], [X, y, z1])).join("");
const frontRules = (Y, x0, x1, zs) => zs.map((z) => seg([x0, Y, z], [x1, Y, z])).join("");
const range = (a, b, step) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(3)); return out; };
// 단면 빗금: 사각형(u 0..w, v 0..h)을 45° 빗금으로 → toW(u, v) 가 3D 점을 돌려줌
function hatch(w, h, step, toW) {
  const out = [];
  for (let c = -h + step / 2; c < w; c += step) {
    const u0 = Math.max(0, c), v0 = u0 - c, u1 = Math.min(w, c + h), v1 = u1 - c;
    if (u1 - u0 > 0.05) out.push(seg(toW(u0, v0), toW(u1, v1)));
  }
  return out.join("");
}
const cutFace = (corners, hatchD) => `<g class="pw-cutface"><path class="pw-cutfill" d="${poly(corners)}"/>${L(hatchD, { tone: "lo" })}<path class="pw-cutedge" d="${poly(corners)}"/></g>`;
// 윗면을 자른 벽 (x0..x1, 높이 h): 윗면·오른쪽 끝면 단면
const wallTopCut = (x0, x1, h) => cutFace([[x0, -WALL.t, h], [x1, -WALL.t, h], [x1, 0, h], [x0, 0, h]], hatch(x1 - x0, WALL.t, 2.2, (u, v) => [x0 + u, -WALL.t + v, h]));
const wallEndCut = (x, z0, z1) => cutFace([[x, -WALL.t, z0], [x, 0, z0], [x, 0, z1], [x, -WALL.t, z1]], hatch(WALL.t, z1 - z0, 2.2, (u, v) => [x, -WALL.t + u, z0 + v]));
// 직사각형에서 구멍(직사각형들)을 뺀 나머지 → 겹치지 않는 직사각형들
function minus(rect, holes) {
  const xs = [...new Set([rect.x0, rect.x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= rect.x0 && x <= rect.x1).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
    const cuts = holes.filter((h) => h.x0 < mid && h.x1 > mid).map((h) => [Math.max(rect.y0, h.y0), Math.min(rect.y1, h.y1)]).sort((p, q) => p[0] - q[0]);
    let y = rect.y0;
    for (const [c0, c1] of cuts) { if (c0 > y) out.push({ x0: a, x1: b, y0: y, y1: c0 }); y = Math.max(y, c1); }
    if (y < rect.y1) out.push({ x0: a, x1: b, y0: y, y1: rect.y1 });
  }
  return out;
}
// 상태 그림 묶음: 같은 자리에 n 장을 그려 두고 움직임 코드가 하나만 보여 줌 (data-<kind>="i")
const frames = (kind, list) => list.map((svg, i) => `<g data-${kind}="${i}"${i === 0 ? "" : ' style="display:none"'}>${svg}</g>`).join("");
// 표시등 (원 하나, 색은 CSS 가 상태에 따라)
const lamp = (cls, p, r, attr = "") => { const [x, y] = at(p); return `<circle class="${cls}" ${attr} cx="${r1(x)}" cy="${r1(y)}" r="${r}"/>`; };

// ---------- 0) 받침판 ----------
const YARD = { x0: -33, x1: 262, y0: 0, y1: 108 };   // 마당 패드 (도랑 자리는 비움)
const HOLES = [MV_TRENCH, GT].map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.d, pit: t.pit }));
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -13, 13, P)}"/>`];
  for (const [x, y] of k.corners(BASE, 10)) out.push(`<g class="pw-base">${k.solidSvg(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, -13, 4, P, 3), { tone: "lo" })}</g>`);
  const rx0 = Math.ceil((BASE.x + 10) / 10) * 10, rx1 = Math.floor((BASE.x + BASE.w - 10) / 10) * 10;   // 자의 양 끝 = 큰·작은 눈금 자리
  const ticks = k.topTicks(rx0, rx1, 10, 5, BASE.y + BASE.d - 4, 0, [1.6, 3.2], P, "x");
  const inner = L(k.planOutline(k.insetPlan(BASE, 7), 0, P, 3), { tone: "faint" })
    + L(seg([rx0, BASE.y + BASE.d - 4, 0], [rx1, BASE.y + BASE.d - 4, 0]), { tone: "lo" })
    + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" });
  out.push(`<g class="pw-base">${k.solidSvg(k.slabOf(BASE, -9, 9, P, 4, 0.8), { tone: "lo", inner })}</g>`);
  // 판 앞면 이름표 (나사 4 + 글줄 3)
  const plate = { x0: 102, x1: 128, z0: -7, z1: -2 }, Y = BASE.y + BASE.d;
  out.push(`<g class="pw-steel">${k.solidSvg(k.slabOf({ x: plate.x0, y: Y, w: plate.x1 - plate.x0, d: 0.4, r: 0.2 }, plate.z0, plate.z1 - plate.z0, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(L([0, 1, 2].map((i) => seg([plate.x0 + 4, Y + 0.4, plate.z1 - 1.2 - i * 1.2], [plate.x0 + (i === 0 ? 20 : 15 - i * 2), Y + 0.4, plate.z1 - 1.2 - i * 1.2])).join(""), { tone: "lo", free: true }));
  out.push(Dt([[plate.x0 + 1.6, plate.z0 + 1], [plate.x1 - 1.6, plate.z0 + 1], [plate.x0 + 1.6, plate.z1 - 1], [plate.x1 - 1.6, plate.z1 - 1]].map(([x, z]) => at([x, Y + 0.4, z])), { size: 0.45, tone: "mid" }));
  // 기록: 받침판(도랑 자리를 뺀 조각들 + 도랑 바닥 아래). 그림은 맨 아래 층으로 먼저 칠함
  minus({ x0: BASE.x, x1: BASE.x + BASE.w, y0: BASE.y, y1: BASE.y + BASE.d }, HOLES).forEach((r) => R.solid(A.box([r.x0, r.y0, -9], [r.x1, r.y1, 0], { name: "stand.base" })));
  HOLES.forEach((h) => R.solid(A.box([h.x0, h.y0, -9], [h.x1, h.y1, h.pit - 0.45], { name: "stand.base" })));
  return `<g data-info="base">${out.join("")}</g>`;
}
const BASE_SVG = base();

// 마당 콘크리트 패드 (도랑 자리를 비워 조각으로)
function pads() {
  minus(YARD, HOLES).forEach((p, i) => {
    const joints = [];
    for (const x of [60, 120, 196]) if (x > p.x0 + 1 && x < p.x1 - 1) joints.push(seg([x, p.y0, SLAB], [x, p.y1, SLAB]));
    for (const y of [50]) if (y > p.y0 + 1 && y < p.y1 - 1) joints.push(seg([p.x0, y, SLAB], [p.x1, y, SLAB]));
    W.box(`pad.${i}`, { x: p.x0, y: p.y0, w: p.x1 - p.x0, d: p.y1 - p.y0, r: 0.3 }, 0, SLAB, { cls: "pw-concrete", tone: "lo", steps: 2, inner: L(joints.join(""), { tone: "faint" }), info: "pad" });
  });
}
pads();

// ---------- 1) 도랑 창 (속을 잘라 보여 줌): 바닥 + 안쪽 벽 2면, 모두 창 윤곽으로 자름 ----------
const CLIPS = [];
function trenchWindow(id, T, top, info) {
  const PIT = T.pit;
  const rim = [[T.x, T.y, top], [T.x + T.w, T.y, top], [T.x + T.w, T.y + T.d, top], [T.x, T.y + T.d, top]];
  CLIPS.push(`<clipPath id="${id}"><path d="${poly(rim)}"/></clipPath>`);
  const clip = (svg) => `<g clip-path="url(#${id})">${svg}</g>`;
  const floor = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y + T.d, PIT], [T.x, T.y + T.d, PIT]];
  const westWall = [[T.x, T.y, PIT], [T.x, T.y + T.d, PIT], [T.x, T.y + T.d, top], [T.x, T.y, top]];
  const northWall = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y, top], [T.x, T.y, top]];
  const layers = L(seg([T.x, T.y, 0], [T.x, T.y + T.d, 0]) + seg([T.x, T.y, 0], [T.x + T.w, T.y, 0]), { tone: "lo" })
    + L(hatch(T.d, top, 1.6, (u, v) => [T.x, T.y + u, v]) + hatch(T.w, top, 1.6, (u, v) => [T.x + u, T.y, v]), { tone: "faint" });
  const svg = `<g class="pw-soil"><path class="pw-soilfloor" d="${poly(floor)}"/><path class="pw-soilwall" d="${poly(westWall)}"/><path class="pw-soilwall2" d="${poly(northWall)}"/>${layers}${L(seg([T.x, T.y, PIT], [T.x, T.y + T.d, PIT]) + seg([T.x, T.y, PIT], [T.x + T.w, T.y, PIT]), { tone: "mid" })}</g>`;
  const shapes = [
    R.solid(A.box([T.x, T.y, PIT - 0.05], [T.x + T.w, T.y + T.d, PIT], { name: `stand.${id}.floor` })),
    R.solid(A.box([T.x - 0.05, T.y, PIT], [T.x, T.y + T.d, top], { name: `stand.${id}.west` })),
    R.solid(A.box([T.x, T.y - 0.05, PIT], [T.x + T.w, T.y, top], { name: `stand.${id}.north` })),
  ];
  // 앞을 가리는 두 벽(동·남)은 그리지 않음 (패드 조각이 가림) → 관 끝이 닿는 자리로만 따로 기록
  R.solid(A.box([T.x + T.w, T.y, PIT], [T.x + T.w + 0.05, T.y + T.d, top], { name: `stand.${id}.east` }));
  R.solid(A.box([T.x, T.y + T.d, PIT], [T.x + T.w, T.y + T.d + 0.05, top], { name: `stand.${id}.south` }));
  W.put(`${id}.pit`, [T.x + T.w / 2, T.y + T.d / 2, PIT - 3], clip(svg), shapes, { info, bias: -20 });
  return clip;
}

// ---------- 2) 케이블·관 (흐름 점선 포함) ----------
// 흐름 = "pw"(전류) | "c"(찬물) | "w"(데워진 물) | "cB"·"wB"·"cC"·"wC"(CDU B·C 쪽 가지: 그 CDU 가 돌 때만)
//   조각마다 그 조각의 시작 위치로 무늬를 이어 붙여 끊김 없음. fw = 흐름 선 굵기 (굵은 관일수록 굵게)
function cable(name, points, r, { cls = "pw-black", tone = "mid", flow, fw, bend, maxLength = 14, gaps = [], caps = true, bias = 0.02, owner, bundle, info, clip, fillet = true, touch } = {}) {
  const route = fillet ? G.fillet(points, Math.max(bend ?? r * 2.6, r * 2.6), 10, { P, tube: r }) : points;
  R.route(name, route, r, { gaps, owner: owner ?? name, bundle, touch, piece: "hz" });
  const spacing = fillet ? Math.max(0.5, Math.min(1.6, r)) : Math.max(4, r * 6);
  const pieces = tubePieces(route, r, P, { maxLength, spacing, gaps, caps });
  const dense = G.resample(route, spacing);
  const scr = [0];
  for (let i = 1; i < dense.length; i++) { const a = at(dense[i - 1]), b = at(dense[i]); scr.push(scr[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len3 = [0];
  for (let i = 1; i < dense.length; i++) len3.push(len3[i - 1] + G.len3(G.sub3(dense[i], dense[i - 1])));
  const screenAt = (s) => { let i = 1; while (i < len3.length - 1 && len3[i] < s) i++; const t = (s - len3[i - 1]) / Math.max(1e-9, len3[i] - len3[i - 1]); return scr[i - 1] + (scr[i] - scr[i - 1]) * Math.min(1, Math.max(0, t)); };
  pieces.forEach((chunk, index) => {
    let svg = W.wrap(cls, tubeSvg(chunk, { tone }));
    if (flow) {
      const pts = G.cut(dense, chunk.from, chunk.to).map(at);
      if (pts.length > 1) svg += `<path class="pw-flow" data-flow="${flow}" style="--d0:${r1(screenAt(chunk.from))}px${fw ? `;--fw:${fw}` : ""}" d="M${pts.map((p) => p.map(r1).join(" ")).join("L")}"/>`;
    }
    if (clip) svg = clip(svg);
    W.put(`${name}:${index}`, chunk.mid, svg, [A.tube(chunk.points, chunk.radii, { name, owner: owner ?? name, bundle, touch })], { bias, info, route: name, chunk: index });
  });
  return route;
}
// 이음쇠(공): 관이 갈라지는 T 자리나 꺾이는 엘보. 본관은 공 자리를 비우고(gap), 가지관은 공 표면에서 끝남
//   R ≥ √(본관² + 가지관²) 이면 두 관의 테두리가 서로 삐져나오지 않음 (kit 규칙)
function fitting(name, c, Rb, { cls = "hz-alu", owner, info } = {}) {
  const shape = R.solid(A.ball(c, Rb, { name, owner }));
  const steps = Math.max(12, Math.min(32, Math.ceil((2 * Math.PI * Rb * G.scaleOf(P)) / 3)));   // 화면에서 한 조각 ≈ 3 px
  W.put(name, c, W.wrap(cls, k.solidSvg(G.sphereOf(c, Rb, P, { steps }), { tone: "mid" })), [shape], { info });
}
const reach = (Rb, r) => Math.sqrt(Rb * Rb - r * r);    // 공 가운데에서 관 끝(테두리가 공 표면)까지
const teeGaps = (alongs, Rb, r) => alongs.map((s0) => [s0 - reach(Rb, r), s0 + reach(Rb, r)]);
// 상자 면 위의 흐름 선 (버스웨이·매니폴드처럼 관이 아닌 통로): 점들을 잇는 흐름 점선 하나
const faceFlow = (flow, pts, fw) => `<path class="pw-flow" data-flow="${flow}" style="--d0:0px${fw ? `;--fw:${fw}` : ""}" d="${pathOf3(pts)}"/>`;

// ---------- 3) 홀 (바닥·벽·허문 단면) ----------
function hall() {
  const floorPlan = { x: WALL.x0, y: HALL.back, w: WALL.x1 - WALL.x0, d: -WALL.t - HALL.back, r: 0.01 };
  const tiles = [];
  for (let x = WALL.x0 + 12; x < WALL.x1 - 1; x += 12) tiles.push(seg([x, HALL.back, HALL.floor], [x, -WALL.t, HALL.floor]));
  for (const y of [-36]) tiles.push(seg([WALL.x0, y, HALL.floor], [WALL.x1, y, HALL.floor]));
  // 노란 안전선 (랙 뒤 통로 가장자리 — 칠한 띠)
  const safety = `<path class="hz-safety" d="${poly([[RACK0 - 2, -21.2, HALL.floor], [WALL.x1, -21.2, HALL.floor], [WALL.x1, -20.5, HALL.floor], [RACK0 - 2, -20.5, HALL.floor]])}"/>`;
  W.box("hall.floor", floorPlan, 0, HALL.floor, { cls: "pw-floor", tone: "lo", steps: 1, info: "hall-floor", bias: -50,
    inner: L(tiles.join(""), { tone: "faint" }) + safety,
    extra: cutFace([[WALL.x1, HALL.back, 0], [WALL.x1, -WALL.t, 0], [WALL.x1, -WALL.t, HALL.floor], [WALL.x1, HALL.back, HALL.floor]], hatch(-WALL.t - HALL.back, HALL.floor, 2.2, (u, v) => [WALL.x1, HALL.back + u, v])) });
}
hall();

// 바깥벽: 온전한 부분(왼쪽 끝) → 계단 → 낮게 허문 벽 → CDU 앞은 거의 바닥까지 → 다시 낮게. 바깥면은 단열 금속 패널(세로 골)
function walls() {
  const t = WALL.t;
  const ribsIn = (x0, x1) => range(Math.ceil((x0 + 0.1) / 5) * 5, x1 - 0.1, 5);
  const piece = (name, x0, x1, h, info, extra, ribs = true) => W.box(name, { x: x0, y: -t, w: x1 - x0, d: t, r: 0.01 }, 0, h, { cls: "pw-panel", tone: "lo", steps: 1, info,
    inner: ribs ? L(frontSeams(0, ribsIn(x0, x1), 0, h), { tone: "faint" }) : "", extra });
  piece("wall.full", WALL.x0, WALL.full, WALL.h, "wall", wallTopCut(WALL.x0, WALL.full, WALL.h) + wallEndCut(WALL.full, WALL.mid, WALL.h));
  piece("wall.step", WALL.full, WALL.step, WALL.mid, "wall", wallTopCut(WALL.full, WALL.step, WALL.mid) + wallEndCut(WALL.step, WALL.low, WALL.mid));
  piece("wall.low", WALL.step, WALL.s0, WALL.low, "wall", wallTopCut(WALL.step, WALL.s0, WALL.low) + wallEndCut(WALL.s0, WALL.stub, WALL.low));
  piece("wall.stub", WALL.s0, WALL.s1, WALL.stub, "wall-stub", wallTopCut(WALL.s0, WALL.s1, WALL.stub), false);
  piece("wall.low2", WALL.s1, WALL.x1, WALL.low, "wall", wallTopCut(WALL.s1, WALL.x1, WALL.low) + wallEndCut(WALL.x1, 0, WALL.low));
}
walls();

// ---------- 4) 중압 인입 (받침판 왼쪽 끝 = 1차 변전소 6 쪽에서 땅속으로) ----------
{
  const T = MV_TRENCH;
  const clip = trenchWindow("hz-mv", T, SLAB, "mv");
  // 단심 케이블 6가닥(A 3 · B 3)이 각자 PVC 관 안에 (관만 보임). 관은 도랑 바닥 받침 위
  for (let i = 0; i < 6; i++) {
    const y = T.y + 1.25 + i * 1.32, z = T.pit + 0.57;
    cable(`mv.duct${i}`, [[T.x, y, z], [T.x + T.w, y, z]], 0.55, { cls: "pw-pvc", tone: "mid", flow: "pw", maxLength: 60, bundle: "mv", info: "mv", clip, fillet: false, touch: ["stand.hz-mv.floor"] });
  }
}

// ---------- 5) 홀 변압기 A·B (중압 → 저압) ----------
const THROAT = { y: 6.4, d: 4.6, w: 6 };   // 변압기 윗면 뒤쪽의 2차 출구 목 (저압 케이블이 위로 나감)
function transformer(id, X, throatX) {
  const z0 = SLAB, top = z0 + XF_H;
  W.box(`${id}.tank`, X, z0, XF_H, { cls: "pw-xfmr", tone: "mid", steps: 2, bevel: 0.5, info: "xfmr" });
  // 오른쪽 방열판 8장 + 위아래 헤더
  for (let i = 0; i < 8; i++) W.box(`${id}.fin${i}`, { x: X.x + X.w, y: X.y + 1.3 + i * 1.45, w: 3.2, d: 0.32, r: 0.05 }, z0 + 2.5, 13, { cls: "pw-xfmr", tone: "mid", steps: 1, info: "xfmr", stamp: "xf-fin" });
  for (const zz of [z0 + 2.0, z0 + 16.0]) W.disc(`${id}.header${zz}`, G.frameAlong([X.x + X.w + 1.6, X.y + 0.8, zz], [0, 1, 0]), 0, 10.9, 0.42, { cls: "pw-xfmr", tone: "mid", info: "xfmr", stamp: `xf-hdr${zz}` });
  // 앞 단자함 (문 두 짝·손잡이): 중압 케이블이 아래(도랑)에서 들어옴
  const F = { x: X.x + 1, y: X.y + X.d, w: X.w - 2, d: XF_FRONT_D, r: 0.5 };
  W.box(`${id}.front`, F, z0, 15, { cls: "pw-xfmr", tone: "mid", steps: 2, info: "xfmr-hv", stamp: "xf-front",
    inner: L(frontSeams(F.y + F.d, [F.x + F.w / 2], z0, z0 + 15), { tone: "lo" }) });
  for (const dx of [-2.2, 1.0]) W.box(`${id}.handle${dx}`, { x: F.x + F.w / 2 + dx, y: F.y + F.d, w: 1.2, d: 0.5, r: 0.1 }, z0 + 7, 0.6, { cls: "pw-steel", tone: "mid", steps: 1, info: "xfmr-hv", stamp: `xf-handle${dx}` });
  // 윗면: 들어 올림 고리 4개, 압력 방출 밸브, 2차 출구 목
  const inThroat = (x, y) => x > throatX - THROAT.w / 2 - 0.8 && x < throatX + THROAT.w / 2 + 0.8 && y > THROAT.y - 0.4 && y < THROAT.y + THROAT.d + 0.4;
  for (const [x, y] of k.corners(X, 1.6).filter(([x, y]) => !inThroat(x, y))) W.box(`${id}.lug${x}${y}`, { x: x - 0.7, y: y - 0.25, w: 1.4, d: 0.5, r: 0.1 }, top, 1.4, { cls: "pw-xfmr", tone: "mid", steps: 1, info: "xfmr", stamp: "xf-lug" });
  W.cyl(`${id}.prv`, X.x + 3, X.y + 10, 0.9, top, 1.6, { cls: "pw-steel", tone: "mid", info: "xfmr", stamp: "xf-prv" });
  W.box(`${id}.throat`, { x: throatX - THROAT.w / 2, y: THROAT.y, w: THROAT.w, d: THROAT.d, r: 0.3 }, top, 4, { cls: "pw-xfmr", tone: "mid", steps: 2, info: "ladder", stamp: "xf-throat" });
  W.cyl(`${id}.ground`, X.x + X.w + 2, X.y + X.d + 3, 0.5, SLAB, 1.2, { cls: "pw-copper", tone: "mid", info: "ground", stamp: "xf-ground" });
}
const XA_T = XA.x + 8, XB_T = 5;   // 출구 목 가운데 x (B 는 벽 관통 상자 바로 아래)
transformer("xa", XA, XA_T);
transformer("xb", XB, XB_T);

// ---------- 6) 저압 케이블: 변압기 목 → (A 는 래더로) → 벽 관통 상자 → 홀 안 → 배전반 A·B ----------
const LAD = { y0: THROAT.y, y1: THROAT.y + THROAT.d, z: 36.5 };
const ELBOW = { x: 2, w: 6, z: 34, h: 7 };   // 벽 관통 상자 (래더 끝, 벽에 붙음)
function lowVoltage() {
  const { y0, y1, z } = LAD, ztop = SLAB + XF_H + 4;   // 목 윗면
  // 벽 관통 상자: 벽 쪽 상자(x 2..8, y 0..6.4) + 래더 쪽 꺾임 상자(y 6.4..11)
  W.box("lv.wallbox", { x: ELBOW.x, y: 0, w: ELBOW.w, d: y0, r: 0.2 }, ELBOW.z + 1, ELBOW.h - 2, { cls: "pw-grey", tone: "mid", steps: 2, info: "lv-in" });
  W.box("lv.elbow", { x: ELBOW.x, y: y0, w: ELBOW.w, d: y1 - y0, r: 0.3 }, ELBOW.z, ELBOW.h, { cls: "pw-grey", tone: "mid", steps: 2, info: "ladder" });
  W.box("lv.inplate", { x: ELBOW.x, y: -WALL.t - 0.4, w: ELBOW.w, d: 0.4, r: 0.05 }, ELBOW.z, ELBOW.h, { cls: "pw-grey", tone: "mid", steps: 1, info: "lv-in" });
  // A: 세로 래더 (목 → 래더 높이) + 가로 래더 (→ 꺾임 상자 왼쪽 면)
  const vx = XA_T - 1.2;
  for (const [y, nm] of [[y0, "a"], [y1 - 0.35, "b"]]) W.box(`lad.vrail${nm}`, { x: vx, y, w: 2.4, d: 0.35, r: 0.05 }, ztop, z - ztop, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder" });
  for (const zr of [ztop + 3, ztop + 6.5]) W.box(`lad.vrung${zr}`, { x: vx, y: y0 + 0.35, w: 0.5, d: y1 - y0 - 0.7, r: 0.05 }, zr, 0.45, { cls: "pw-steel", tone: "lo", steps: 1, info: "ladder" });
  const xa = vx + 2.4, xb = ELBOW.x;
  for (const [y, nm] of [[y0, "a"], [y1 - 0.35, "b"]]) W.box(`lad.rail${nm}`, { x: xa, y, w: xb - xa, d: 0.35, r: 0.05 }, z, 1.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder" });
  for (let x = xa + 3; x < xb - 1; x += 3) W.box(`lad.rung${x}`, { x, y: y0 + 0.35, w: 0.5, d: y1 - y0 - 0.7, r: 0.05 }, z, 0.4, { cls: "pw-steel", tone: "lo", steps: 1, info: "ladder", stamp: "rung" });
  for (const x of [-12, 0]) {   // 벽 받침 (까치발)
    W.box(`lad.arm${x}`, { x: x - 0.3, y: 0, w: 0.6, d: y1 + 0.3, r: 0.05 }, z - 0.8, 0.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder", stamp: "lad-arm" });
    W.box(`lad.armplate${x}`, { x: x - 1, y: 0, w: 2, d: 0.3, r: 0.05 }, z - 5, 5, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder", stamp: "lad-armplate" });
  }
  // 케이블: A 3가닥 (목 → 위 → 래더 위 → 꺾임 상자), B 3가닥 (목 → 바로 위 꺾임 상자 밑면)
  for (let i = 0; i < 3; i++) {
    const y = y0 + 1.25 + i * 1.05;
    cable(`lv.a${i}`, [[vx + 1.5, y, ztop], [vx + 1.5, y, z + 0.7], [xb, y, z + 0.7]], 0.3, { flow: "pw", bundle: "lv-a", info: "ladder", bend: 1.2, maxLength: 10, touch: ["lad.rung*", "lad.vrung*"] });
    cable(`lv.b${i}`, [[XB_T - 1.6 + i * 1.6, y0 + 2.3, ztop], [XB_T - 1.6 + i * 1.6, y0 + 2.3, ELBOW.z]], 0.3, { flow: "pw", bundle: "lv-b", info: "ladder", fillet: false, maxLength: 12 });
  }
  // 홀 안: 관통 상자 안쪽 판 → 뒤로 → 배전반 위로 → 내려감 (깊이 줄마다 하나씩, 서로 엇갈리지 않게)
  for (let j = 0; j < 6; j++) {
    const x0 = ELBOW.x + 5.4 - j * 0.95, yj = -24.6 - j * 0.9, zi = ELBOW.z + 3.5;
    const xt = j < 3 ? 35 - j * 2 : 54 - (j - 3) * 2;   // A 둘째 칸 위 / B 둘째 칸 위 (칸 이음매를 피함)
    cable(`lv.in${j}`, [[x0, -WALL.t - 0.4, zi], [x0, yj, zi], [xt, yj, zi], [xt, yj, HALL.floor + SB.h]], 0.3, { flow: "pw", bundle: "lv-in", info: "lv-in", bend: 1.2, maxLength: 12 });
  }
}
lowVoltage();

// ---------- 7) 전기실: 배전반 A·B (각 2칸) · UPS · 배터리 ----------
function switchboards() {
  const z0 = HALL.floor, z1 = z0 + SB.h, Y = SB.y + SB.d;
  for (let i = 0; i < SB.n; i++) {
    const x0 = SB.x + i * SB.w + (i >= 2 ? 0.8 : 0), x1 = x0 + SB.w, info = i < 2 ? "sb-a" : "sb-b";
    W.box(`sb${i}`, { x: x0 + 0.05, y: SB.y, w: SB.w - 0.1, d: SB.d, r: 0.2 }, z0, SB.h, { cls: "pw-grey", tone: "mid", steps: 1, info, stamp: "sb-body" });
    // 문 두 짝 · 손잡이 · 아래 환기 슬롯 · 위 차단기 손잡이 줄
    [[z0 + 1.2, z0 + 10.5], [z0 + 11.1, z1 - 1.2]].forEach(([a, b], j) => {
      W.box(`sb${i}.door${j}`, { x: x0 + 0.7, y: Y, w: SB.w - 1.4, d: 0.25, r: 0.05 }, a, b - a, { cls: "pw-grey", tone: "mid", steps: 1, info, stamp: `sb-door${j}`,
        inner: j === 0 ? L(frontSlots(Y + 0.25, x0 + 2, x1 - 2, a + 1.2, 3, 1.3, 0.55), { tone: "lo" }) : "" });
      W.box(`sb${i}.handle${j}`, { x: x1 - 2.4, y: Y + 0.25, w: 0.6, d: 0.5, r: 0.1 }, (a + b) / 2 - 1.2, 2.4, { cls: "pw-steel", tone: "mid", steps: 1, info, stamp: "sb-handle" });
    });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) W.box(`sb${i}.brk${r}${c}`, { x: x0 + 1.6 + c * 2.2, y: Y + 0.25, w: 1.1, d: 0.45, r: 0.1 }, z0 + 13.5 + r * 2.4, 0.8, { cls: "pw-dark", tone: "mid", steps: 1, info, stamp: "brk" });
    // 칸 첫 칸마다 계량기 창 (어두운 창 + 초록 점)
    if (i % 2 === 0) W.box(`sb${i}.meter`, { x: x0 + 1.4, y: Y + 0.25, w: 3, d: 0.3, r: 0.1 }, z1 - 4.6, 2.2, { cls: "pw-dark", tone: "mid", steps: 1, info: "sb-meter", stamp: "sb-meter",
      extra: `<g class="pw-leds">${Dt([at([x0 + 3.6, Y + 0.55, z1 - 3.5])], { size: 0.22, tone: "hi" })}</g>` });
  }
}
switchboards();
function upsLine() {
  const z0 = HALL.floor, Y = UPS.y + UPS.d;
  UPS.xs.forEach((x, j) => {
    const tag = "ab"[j], half = UPS.w / 2;
    // 왼쪽 절반: UPS (어두운 함 · 화면 · 상태 띠 · 아래 환기 슬롯)
    W.box(`ups${tag}`, { x, y: UPS.y, w: half, d: UPS.d, r: UPS.r }, z0, UPS.h, { cls: "hz-ups", tone: "mid", steps: 1, info: "ups", stamp: "ups-body",
      inner: L(frontSlots(Y, x + 0.8, x + half - 0.8, z0 + 1.4, 4, 1.2, 0.5), { tone: "lo" }) });
    W.box(`ups${tag}.screen`, { x: x + 0.8, y: Y, w: 2.9, d: 0.3, r: 0.1 }, z0 + 13, 2.4, { cls: "hz-screen", tone: "mid", steps: 1, info: "ups", stamp: "ups-screen" });
    W.box(`ups${tag}.bar`, { x: x + 0.8, y: Y, w: 2.9, d: 0.3, r: 0.1 }, z0 + 11.4, 0.7, { cls: "hz-screen", tone: "mid", steps: 1, info: "ups", stamp: "ups-bar" });
    // 오른쪽 절반: 배터리 칸 (회색 · 환기 슬롯 · 노란 경고판)
    W.box(`bat${tag}`, { x: x + half, y: UPS.y, w: half, d: UPS.d, r: UPS.r }, z0, UPS.h, { cls: "pw-grey", tone: "mid", steps: 1, info: "battery", stamp: "bat-body",
      inner: L(frontSlots(Y, x + half + 0.8, x + UPS.w - 0.8, z0 + 2, 8, 1.6, 0.5), { tone: "lo" }) });
    W.box(`bat${tag}.sign`, { x: x + half + 1.1, y: Y, w: 2.3, d: 0.2, r: 0.05 }, z0 + 16.6, 1.8, { cls: "pw-yellow", tone: "mid", steps: 1, info: "battery", stamp: "bat-sign" });
  });
  // 배전반 → UPS (굵은 케이블, 배전반 둘째 칸 위에서 나와 UPS 위로): A 는 뒤 줄(y −31.2), B 는 앞 줄(y −24)
  const sbTop = HALL.floor + SB.h, [xa, xb] = UPS.xs;
  cable("ups.inA", [[36.5, -31.2, sbTop], [36.5, -31.2, sbTop + 2.8], [xa + 1.0, -31.2, sbTop + 2.8], [xa + 1.0, -31.2, z0 + UPS.h]], 0.45, { flow: "pw", info: "ups", bend: 1.6, maxLength: 8 });
  cable("ups.inB", [[56, -23.4, sbTop], [56, -23.4, sbTop + 4.2], [xb + 1.5, -23.4, sbTop + 4.2], [xb + 1.5, -23.4, z0 + UPS.h]], 0.45, { flow: "pw", info: "ups", bend: 2.0, maxLength: 8 });
  // UPS → 버스웨이 (세로로 올라감)
  BUSES.forEach((bus, j) => cable(`ups.out${bus.tag}`, [[UPS.xs[j] + 3, bus.y, z0 + UPS.h], [UPS.xs[j] + 3, bus.y, BUS.z]], 0.45, { flow: "pw", info: "busway", fillet: false, maxLength: 12 }));
}
upsLine();

// ---------- 8) 버스웨이 (랙 위를 지나는 굵은 전원 통로) + 받침 ----------
function busway() {
  const z = BUS.z, h = BUS.h;
  const pxPerX = Math.hypot(...[0, 1].map((i) => at([1, BUS.y, z])[i] - at([0, BUS.y, z])[i]));   // 화면에서 x 1 단위의 길이 (흐름 무늬 이어 붙이기)
  for (const bus of BUSES) {
    const y0 = bus.y - BUS.w / 2, Y = y0 + BUS.w;
    for (let s = 0; s < bus.joints.length - 1; s++) {
      const a = bus.joints[s], b = bus.joints[s + 1], plan = { x: a, y: y0, w: b - a, d: BUS.w, r: 0.1 };
      W.box(`bus${bus.tag}.${s}`, plan, z, h, { cls: "hz-bus", tone: "mid", steps: 1, info: "busway", owner: `bus${bus.tag}`,
        inner: L(k.sideSeam(plan, z + 0.5, P, 1) + k.sideSeam(plan, z + h - 0.5, P, 1), { tone: "faint" }),
        extra: `<path class="pw-flow" data-flow="pw" style="--d0:${r1((a - bus.x0) * pxPerX)}px" d="${pathOf3([[a, Y, z + h / 2], [b, Y, z + h / 2]])}"/>` });
    }
    for (const x of bus.joints.slice(1, -1)) W.box(`bus${bus.tag}.joint${x}`, { x: x - 0.7, y: y0 - 0.15, w: 1.4, d: BUS.w + 0.3, r: 0.1 }, z - 0.15, h + 0.3, { cls: "hz-bus", tone: "mid", steps: 1, info: "busway", stamp: "bus-joint", owner: `bus${bus.tag}` });
    // 받침: 바닥 기둥 (CDU 뒤) — 랙 위에서는 랙 위 받침대의 팔이 받침
    W.box(`bus${bus.tag}.post`, { x: 103.7, y: bus.y - 0.3, w: 0.6, d: 0.6, r: 0.05 }, HALL.floor, z - HALL.floor, { cls: "pw-steel", tone: "mid", steps: 1, info: "busway", stamp: "bus-post" });
    W.box(`bus${bus.tag}.foot`, { x: 102.5, y: bus.y - 1.2, w: 3, d: 2.4, r: 0.1 }, HALL.floor, 0.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "busway", stamp: "bus-foot" });
  }
  // A 줄은 UPS B 위를 지나감 → 그 함 위 기둥으로 받침
  W.box("busa.postUps", { x: UPS.xs[1] + 6.7, y: BUSES[0].y - 0.3, w: 0.6, d: 0.6, r: 0.05 }, HALL.floor + UPS.h, z - HALL.floor - UPS.h, { cls: "pw-steel", tone: "mid", steps: 1, info: "busway" });
}
busway();

// ---------- 9) 디젤 발전기 (기초 연료 탱크 + 방음 외함 + 지붕 소음기) + 관 도랑 ----------
function generator() {
  const z0 = SLAB, zt = z0 + GEN_TANK, zb = zt + GEN_BOX, Y = GEN.y + GEN.d, X = GEN.x + GEN.w;
  W.box("gen.tank", GEN, z0, GEN_TANK, { cls: "pw-tank", tone: "mid", steps: 2, info: "tank",
    inner: L(k.sideSeam(GEN, z0 + GEN_TANK - 1.2, P, 2), { tone: "lo" }) });
  for (const x of [GEN.x + 3, X - 6]) W.box(`gen.lug${x}`, { x, y: Y, w: 3, d: 0.6, r: 0.1 }, z0 + 2, 3, { cls: "pw-tank", tone: "mid", steps: 1, info: "tank", stamp: "glug" });
  W.box("gen.fill", { x: GEN.x + 30, y: Y, w: 4.5, d: 1.4, r: 0.2 }, z0 + 2.5, 4, { cls: "pw-tank", tone: "mid", steps: 2, info: "tank" });
  const doorX = [GEN.x + 4, GEN.x + 22, GEN.x + 40];
  W.box("gen.box", { x: GEN.x + 0.6, y: GEN.y + 0.6, w: GEN.w - 1.2, d: GEN.d - 1.2, r: 0.5 }, zt, GEN_BOX, { cls: "pw-gen", tone: "mid", steps: 2, bevel: 0.6, info: "gen",
    inner: L(frontSeams(Y - 0.6, doorX.flatMap((x) => [x, x + 15]), zt, zb), { tone: "lo" }) + L(rightSlots(X - 0.6, GEN.y + 3, Y - 3, zt + 3, 10, 2, 0.9), { tone: "lo" }) });
  doorX.forEach((x, j) => {
    W.box(`gen.handle${j}`, { x: x + 12.8, y: Y - 0.6, w: 0.8, d: 0.5, r: 0.1 }, zt + 11, 3, { cls: "pw-steel", tone: "mid", steps: 1, info: "gen", stamp: "ghandle" });
    W.box(`gen.louver${j}`, { x: x + 2.5, y: Y - 0.6, w: 10, d: 0.3, r: 0.05 }, zt + 15, 7, { cls: "pw-gen", tone: "mid", steps: 1, info: "gen", stamp: "glouver",
      inner: L(frontSlots(Y - 0.3, x + 3.3, x + 11.7, zt + 16, 4, 1.4, 0.55), { tone: "lo" }) });
  });
  W.box("gen.panel", { x: X - 8, y: Y - 0.6, w: 6, d: 0.4, r: 0.1 }, zt + 12, 6, { cls: "pw-dark", tone: "mid", steps: 1, info: "gen" });
  // 지붕: 소음기(가로 원통) + 받침 2 + 배기 굴뚝(빗물 뚜껑)
  const SIL = { y: GEN.y + GEN.d / 2, z: zb + 3.6, r: 2.8, x0: GEN.x + 18, x1: GEN.x + 46 };
  for (const x of [SIL.x0 + 4, SIL.x1 - 6]) W.box(`gen.saddle${x}`, { x, y: SIL.y - 2.5, w: 2, d: 5, r: 0.1 }, zb, 0.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "gen", stamp: "saddle" });
  const F = G.frameAlong([SIL.x0, SIL.y, SIL.z], [1, 0, 0]), Ls = SIL.x1 - SIL.x0;
  W.disc("gen.silencer0", F, 0, 2.6, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.disc("gen.silencer.band0", F, 2.6, 3.2, SIL.r + 0.2, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.disc("gen.silencer1", F, 3.2, Ls - 3.2, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.disc("gen.silencer.band1", F, Ls - 3.2, Ls - 2.6, SIL.r + 0.2, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.disc("gen.silencer2", F, Ls - 2.6, Ls, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.disc("gen.stackbase", G.frameAlong([SIL.x1, SIL.y, SIL.z], [1, 0, 0]), 0, 2.2, 1.4, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.cyl("gen.stack", SIL.x1 + 3.2, SIL.y, 1.3, SIL.z - 1.3, 10, { cls: "pw-steel", tone: "mid", info: "gen" });
  W.cyl("gen.raincap", SIL.x1 + 3.2, SIL.y, 1.7, SIL.z + 8.7, 0.5, { cls: "pw-steel", tone: "mid", info: "gen" });
  for (const [x, y] of k.corners({ x: GEN.x + 0.6, y: GEN.y + 0.6, w: GEN.w - 1.2, d: GEN.d - 1.2, r: 0.5 }, 2)) W.box(`gen.rooflug${x}${y}`, { x: x - 0.8, y: y - 0.3, w: 1.6, d: 0.6, r: 0.1 }, zb, 1.2, { cls: "pw-gen", tone: "mid", steps: 1, info: "gen", stamp: "rooflug" });
  // 발전기 → 배전반 관: 도랑 창 속 6가닥 (발전기 쪽 끝 → 벽 쪽 끝, 벽 밑으로 들어가 배전반 아래로)
  const clip = trenchWindow("hz-gen", GT, SLAB, "gen-conduits");
  for (let c = 0; c < 6; c++) {
    const x = GT.x + 1.5 + c * 1.8, z = GT.pit + 0.62;
    cable(`gen.duct${c}`, [[x, GT.y + GT.d, z], [x, GT.y, z]], 0.6, { cls: "pw-pvc", tone: "mid", maxLength: 80, bundle: "gen-duct", info: "gen-conduits", clip, fillet: false, touch: ["stand.hz-gen.floor"] });
  }
}
generator();

// ---------- 10) GB300 NVL72 랙 줄 (뒷면이 보는 쪽) ----------
// 뒷면: 위·아래 전원 선반(교류 → 약 50 V 직류), 가운데 세로 구리 버스바, 양쪽 모서리 매니폴드(파랑 = 공급, 빨강 = 회수)
//   트레이 27장 = 컴퓨트 18 (GPU 4 + CPU 2 씩) + NVLink 스위치 9 (가운데). 트레이마다 매니폴드에 퀵 커넥터 2개
const REAR = RACK_Y + RACK_D;                       // 뒷면 y = −22.3
const SLOTS = (() => {                              // 랙 안 칸 (아래 → 위): [이름, z0, z1]
  const out = [];
  const push = (kind, z0, n, h) => { for (let i = 0; i < n; i++) out.push([kind, +(z0 + i * h).toFixed(3), +(z0 + (i + 1) * h - 0.08).toFixed(3)]); return z0 + n * h; };
  let z = HALL.floor + 0.9;
  z = push("shelf", z, 3, 1.0); z += 0.2;
  z = push("tray", z, 8, 0.5); z += 0.2;
  z = push("switch", z, 9, 0.5); z += 0.2;
  z = push("tray", z, 10, 0.5); z += 0.3;
  push("shelf", z, 3, 1.0);
  return out;
})();
const MANI = { s: { x: 0.45, cls: "hz-blue", flow: "c" }, r: { x: 4.85, cls: "hz-red", flow: "w" }, w: 0.7, y0: REAR, y1: REAR + 0.8, z0: HALL.floor + 1.5, z1: RACK_TOP - 0.5 };
function rack(i, x0) {
  const z0 = HALL.floor, top = RACK_TOP, open = i === RACKS - 1;
  const plan = { x: x0 + 0.05, y: RACK_Y, w: RACK_W - 0.1, d: RACK_D, r: 0.1 };
  if (!open) {
    // 뒷면 칸 선 (칸 경계마다, 면의 왼쪽 끝 → 오른쪽 끝) + 전원 선반의 교류 입력 점 + 트레이 상태 LED
    const lines = [], inlets = [], leds = [];
    for (const [kind, a, b] of SLOTS) {
      lines.push(seg([x0 + 0.05, REAR, b + 0.04], [x0 + RACK_W - 0.05, REAR, b + 0.04]));
      if (kind === "shelf") for (const dx of [1.9, 4.1]) inlets.push(at([x0 + dx, REAR, (a + b) / 2]));
      if (kind === "tray" && Math.round(a * 10) % 3 === 0) leds.push(at([x0 + 2.2, REAR, (a + b) / 2]));
    }
    const bands = L(k.sideSeam(plan, top - 0.6, P, 1) + k.sideSeam(plan, z0 + 0.6, P, 1), { tone: "lo" });
    W.box(`rack${i}`, plan, z0, RACK_H, { cls: "hz-rack", tone: "mid", steps: 1, info: "rack", stamp: "rack-body",
      inner: bands + L(lines.join(""), { tone: "lo" }),
      extra: Dt(inlets, { size: 0.26, tone: "mid" }) + `<g class="pw-leds">${Dt(leds, { size: 0.16, tone: "hi" })}</g>` });
  } else openRack(x0);
  // 매니폴드 2개 (퀵 커넥터 점 = 트레이·스위치 칸마다) + 흐름(공급은 위 → 아래, 회수는 아래 → 위)
  for (const side of ["s", "r"]) {
    const m = MANI[side], M = MANI, mx = x0 + m.x;
    const qd = SLOTS.filter(([kind]) => kind !== "shelf").map(([, a, b]) => at([mx + M.w / 2, M.y1, (a + b) / 2]));
    const run = side === "s" ? [[mx + M.w / 2, M.y1, M.z1], [mx + M.w / 2, M.y1, M.z0]] : [[mx + M.w / 2, M.y1, M.z0], [mx + M.w / 2, M.y1, M.z1]];
    W.box(`mani${side}${i}`, { x: mx, y: M.y0, w: M.w, d: M.y1 - M.y0, r: 0.12 }, M.z0, M.z1 - M.z0, { cls: m.cls, tone: "mid", steps: 2, info: "manifold", stamp: `mani-${side}`,
      extra: Dt(qd, { size: 0.17, tone: "hi" }) + faceFlow(m.flow, run, 0.7) });
  }
  // 직류 버스바 (가운데 세로 구리 막대) — 트레이마다 꽂히는 자리 점
  const taps = SLOTS.filter(([kind]) => kind !== "shelf").map(([, a, b]) => at([x0 + 3, REAR + 0.3, (a + b) / 2]));
  W.box(`rack${i}.busbar`, { x: x0 + 2.7, y: REAR, w: 0.6, d: 0.3, r: 0.05 }, HALL.floor + 4.4, 15.4, { cls: "pw-copper", tone: "mid", steps: 1, info: "busbar", stamp: "busbar",
    extra: Dt(taps, { size: 0.12, tone: "hi" }) });
  // 랙 위 받침대: 뒤 모서리 기둥 + 아래 팔(공급 배관) + 위 팔(회수 배관·버스웨이)
  W.box(`rack${i}.post`, { x: x0 + 2.75, y: REAR - 0.9, w: 0.5, d: 0.5, r: 0.05 }, top, 30 - top, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rpost" });
  W.box(`rack${i}.armS`, { x: x0 + 2.75, y: REAR - 0.9, w: 0.5, d: SUP.y + 0.7 - (REAR - 0.9), r: 0.05 }, SUP.z - SUP.r - 0.5, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rarmS" });
  W.box(`rack${i}.armT`, { x: x0 + 2.75, y: BUSES[0].y - 0.9, w: 0.5, d: RET.y + 0.7 - (BUSES[0].y - 0.9), r: 0.05 }, 30, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rarmT" });
  // 버스웨이 탭오프 상자 A·B → 전원 코드 → 랙 위 인입구 (랙 하나가 두 갈래 전원을 받음)
  for (const bus of BUSES) {
    const tx = x0 + bus.tapX;
    W.box(`tap${bus.tag}${i}`, { x: tx - 0.7, y: bus.y - 0.6, w: 1.4, d: 1.2, r: 0.15 }, BUS.z - 2.5, 2.5, { cls: "hz-bus", tone: "mid", steps: 2, info: "tapoff", stamp: "tap" });
    W.box(`gland${bus.tag}${i}`, { x: tx - 0.5, y: bus.y - 0.5, w: 1.0, d: 1.0, r: 0.25 }, top, 0.5, { cls: "pw-dark", tone: "mid", steps: 2, info: "tapoff", stamp: "gland" });
    cable(`cord${bus.tag}${i}`, [[tx, bus.y, BUS.z - 2.5], [tx, bus.y, top + 0.5]], 0.24, { flow: "pw", info: "tapoff", fillet: false, maxLength: 8 });
  }
  // 광케이블 트레이 받침 (랙 앞 모서리)
  W.box(`rack${i}.fpost`, { x: x0 + 2.75, y: RACK_Y + 0.3, w: 0.5, d: 0.5, r: 0.05 }, top, FIB.z - 0.5 - top, { cls: "pw-steel", tone: "mid", steps: 1, info: "fibre", stamp: "fpost" });
  W.box(`rack${i}.farm`, { x: x0 + 2.75, y: FIB.y - 0.3, w: 0.5, d: RACK_Y + 0.8 - (FIB.y - 0.3), r: 0.05 }, FIB.z - 0.5, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "fibre", stamp: "farm" });
  // 호스 2가닥: 공급 배관 밑 → 내려와 → 뒤로 → 매니폴드 윗면 / 회수: 매니폴드 윗면 → 위 → 앞으로 → 회수 배관 밑
  const sx = x0 + MANI.s.x + MANI.w / 2, rx = x0 + MANI.r.x + MANI.w / 2, my = (MANI.y0 + MANI.y1) / 2;
  cable(`hoseS${i}`, [[sx, SUP.y, SUP.z - reach(TEE.hose, 0.3)], [sx, SUP.y, 25.4], [sx, my, 25.4], [sx, my, MANI.z1]], 0.3, { cls: "hz-hoseS", flow: "c", info: "hose", bend: 1.45, maxLength: 6 });
  cable(`hoseR${i}`, [[rx, my, MANI.z1], [rx, my, 24.6], [rx, RET.y, 27.0], [rx, RET.y, RET.z - reach(TEE.hose, 0.3)]], 0.3, { cls: "hz-hoseR", flow: "w", info: "hose", bend: 1.3, maxLength: 6 });   // 가운데 토막은 비스듬히 (화면에서 접히지 않게)
}
// 마지막 랙: 오른쪽 옆판을 떼어 안을 보여 줌 (트레이 27장 + 전원 선반 6, 왼쪽 옆판·위·아래 판·오른쪽 기둥 2)
function openRack(x0) {
  const z0 = HALL.floor, top = RACK_TOP;
  W.box("rackopen.side", { x: x0 + 0.05, y: RACK_Y, w: 0.3, d: RACK_D, r: 0.05 }, z0, RACK_H, { cls: "hz-rack", tone: "mid", steps: 1, info: "open-rack" });
  W.box("rackopen.top", { x: x0 + 0.35, y: RACK_Y, w: RACK_W - 0.4, d: RACK_D, r: 0.05 }, top - 0.8, 0.8, { cls: "hz-rack", tone: "mid", steps: 1, info: "open-rack" });
  W.box("rackopen.bottom", { x: x0 + 0.35, y: RACK_Y, w: RACK_W - 0.4, d: RACK_D, r: 0.05 }, z0, 0.8, { cls: "hz-rack", tone: "mid", steps: 1, info: "open-rack" });
  for (const [y, nm] of [[REAR - 0.5, "r"], [RACK_Y, "f"]]) W.box(`rackopen.post${nm}`, { x: x0 + RACK_W - 0.55, y, w: 0.5, d: 0.5, r: 0.05 }, z0 + 0.8, RACK_H - 1.6, { cls: "hz-rack", tone: "mid", steps: 1, info: "open-rack" });
  // 칸마다 판: 컴퓨트 트레이(은색) · NVLink 스위치(검정) · 전원 선반(회색). 옆면에 트레이 손잡이·환기 슬롯 선
  SLOTS.forEach(([kind, a, b], j) => {
    const cls = kind === "tray" ? "pw-silver" : kind === "switch" ? "pw-dark" : "pw-grey";
    const inner = kind === "shelf" ? L(rightSeams(x0 + 5.4, [RACK_Y + 2.6, RACK_Y + 5.2, RACK_Y + 7.8], a, b), { tone: "lo" }) : "";
    W.box(`rackopen.${kind}${j}`, { x: x0 + 0.5, y: RACK_Y + 0.3, w: 4.9, d: RACK_D - 0.3, r: 0.03 }, a, b - a, { cls, tone: "mid", steps: 1, info: kind === "tray" ? "open-tray" : kind === "switch" ? "open-switch" : "rack-psu", stamp: `open-${kind}`, inner });
  });
}
for (let i = 0; i < RACKS; i++) rack(i, RACK0 + i * RACK_W);

// 광케이블 트레이 (랙 앞 위, 회사 영상의 노란 광케이블): 레일 2 + 가로대 + 끝판 + 노란 묶음
function fibreTray() {
  const x0 = RACK0 - 2, x1 = RACK0 + RACK_W * RACKS;
  for (const x of [x0, x1 - 0.3]) W.box(`fib.end${x}`, { x, y: FIB.y, w: 0.3, d: FIB.w, r: 0.05 }, FIB.z, 2.2, { cls: "pw-steel", tone: "mid", steps: 1, info: "fibre" });
  for (const [y, nm] of [[FIB.y, "a"], [FIB.y + FIB.w - 0.3, "b"]]) W.box(`fib.rail${nm}`, { x: x0 + 0.3, y, w: x1 - x0 - 0.6, d: 0.3, r: 0.05 }, FIB.z, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "fibre" });
  for (let x = x0 + 1.8; x < x1 - 0.8; x += 3) W.box(`fib.rung${x}`, { x, y: FIB.y + 0.3, w: 0.45, d: FIB.w - 0.6, r: 0.05 }, FIB.z, 0.35, { cls: "pw-steel", tone: "lo", steps: 1, info: "fibre", stamp: "frung" });
  cable("fib.bundle", [[x0 + 0.3, FIB.y + FIB.w / 2, FIB.z + 0.35 + 0.7], [x1 - 0.3, FIB.y + FIB.w / 2, FIB.z + 0.35 + 0.7]], 0.7, { cls: "pw-yellow", tone: "mid", info: "fibre", fillet: false, maxLength: 34, touch: ["fib.rung*", "rack*"] });
}
fibreTray();

// ---------- 11) 천장 2차 냉각수 배관 (CDU ↔ 랙만 도는 깨끗한 물) ----------
// 공급(찬물): CDU → 공급 배관(파랑) → 호스 → 랙 공급 매니폴드 / 회수(데워진 물): 랙 회수 매니폴드 → 호스 → 회수 배관(빨강) → CDU
function tcsHeaders() {
  // T 자리: 랙마다 호스 1개 + CDU 마다 관 1개 (공급은 x0 쪽에서 재는 길이, 회수는 x1 쪽에서 재는 길이)
  const hoseX = (side) => Array.from({ length: RACKS }, (_, i) => RACK0 + i * RACK_W + MANI[side].x + MANI.w / 2);
  const supT = [...hoseX("s").map((x) => [x, TEE.hose]), ...CDU.xs.map((x0) => [x0 + PORT.tcsS, TEE.riser])];
  const retT = [...hoseX("r").map((x) => [x, TEE.hose]), ...CDU.xs.map((x0) => [x0 + PORT.tcsR, TEE.riser])];
  const gapsOf = (list, along) => list.map(([x, Rb]) => { const a0 = along(x), h = reach(Rb, SUP.r); return [a0 - h, a0 + h]; }).sort((p, q) => p[0] - q[0]);
  cable("tcs.sup", [[HDR.x0, SUP.y, SUP.z], [HDR.x1, SUP.y, SUP.z]], SUP.r, { cls: "hz-blue", flow: "c", fw: 1.3, fillet: false, maxLength: 26, info: "tcs", touch: ["rack*"], gaps: gapsOf(supT, (x) => x - HDR.x0) });
  cable("tcs.ret", [[HDR.x1, RET.y, RET.z], [HDR.x0, RET.y, RET.z]], RET.r, { cls: "hz-red", flow: "w", fw: 1.3, fillet: false, maxLength: 26, info: "tcs", touch: ["rack*"], gaps: gapsOf(retT, (x) => HDR.x1 - x) });
  supT.forEach(([x, Rb], j) => fitting(`tcs.teeS${j}`, [x, SUP.y, SUP.z], Rb, { cls: "hz-blue", owner: "tcs.sup", info: "tcs" }));
  retT.forEach(([x, Rb], j) => fitting(`tcs.teeR${j}`, [x, RET.y, RET.z], Rb, { cls: "hz-red", owner: "tcs.ret", info: "tcs" }));
  // 막음 플랜지 (양 끝) + 공기 빼기 밸브 (회수 배관 오른쪽 끝 위 = 가장 높은 곳)
  for (const [nm, H] of [["s", SUP], ["r", RET]]) {
    W.disc(`tcs.cap${nm}0`, G.frameAlong([HDR.x0 - 0.7, H.y, H.z], [1, 0, 0]), 0, 0.7, H.r + 0.35, { cls: nm === "s" ? "hz-blue" : "hz-red", tone: "mid", info: "tcs" });
    W.disc(`tcs.cap${nm}1`, G.frameAlong([HDR.x1, H.y, H.z], [1, 0, 0]), 0, 0.7, H.r + 0.35, { cls: nm === "s" ? "hz-blue" : "hz-red", tone: "mid", info: "tcs" });
  }
  W.cyl("tcs.vent", HDR.x1 - 5, RET.y, 0.32, RET.z + RET.r - 0.05, 1.3, { cls: "pw-steel", tone: "mid", info: "tcs-vent", owner: "tcs.ret" });
  W.cyl("tcs.ventcap", HDR.x1 - 5, RET.y, 0.5, RET.z + RET.r + 1.25, 0.4, { cls: "pw-red", tone: "mid", info: "tcs-vent", owner: "tcs.ret" });
}
tcsHeaders();

// ---------- 12) CDU 3대 (냉각수 분배기: 판형 열교환기 + 펌프) ----------
// A·C 는 문이 달린 모습, B 는 앞판을 떼어 속이 보임. 위 = 2차(랙 쪽) 관, 앞 아래 = 1차(시설 물) 관 (벽 밖에서 들어옴)
//   관마다 격리 밸브 (B 의 밸브 손잡이는 정비 장면에서 돌아가 닫힘)
const CDU_Z1 = HALL.floor + CDU.h, CDU_FRONT = CDU.y + CDU.d;    // 윗면 23.5, 앞면 y = −4
const VALVE_FRAMES = 5;
const alongAt = (route, p) => {   // 경로를 따라 점 p 에 가장 가까운 자리까지의 길이 (밸브가 덮는 구간을 비우는 데 씀)
  let best = 0, bestD = Infinity, s = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], ab = G.sub3(b, a), l = G.len3(ab);
    const t = Math.max(0, Math.min(1, (((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / Math.max(1e-9, l * l))));
    const q = G.add3(a, G.mul3(ab, t)), d = G.len3(G.sub3(q, p));
    if (d < bestD) { bestD = d; best = s + l * t; }
    s += l;
  }
  return best;
};
const tcsRoute = (x0) => ({
  sup: G.fillet([[x0 + PORT.tcsS, PORT.yS, CDU_Z1], [x0 + PORT.tcsS, PORT.yS, SUP.z], [x0 + PORT.tcsS, SUP.y + reach(TEE.riser, 0.6), SUP.z]], 1.6, 10, { P, tube: 0.6 }),
  ret: G.fillet([[x0 + PORT.tcsR, RET.y + reach(TEE.riser, 0.6), RET.z], [x0 + PORT.tcsR, PORT.yR, RET.z], [x0 + PORT.tcsR, PORT.yR, CDU_Z1]], 1.6, 10, { P, tube: 0.6 }),
});
// 밸브 손잡이 그림 (열림 → 닫힘 VALVE_FRAMES 장): 세운 관은 앞면(+y)에서 세로 → 가로, 눕힌 관(y 방향)은 위에서 y 방향 → x 방향
function leverFrames(center, axis, rv) {
  const back = axis === "z" ? [0, 0, 1] : [0, -1, 0];   // 열린 손잡이 방향: 세운 관은 위, 눕힌 관은 벽 쪽
  const out = [];
  for (let s = 0; s < VALVE_FRAMES; s++) {
    const ang = (Math.PI / 2) * (1 - s / (VALVE_FRAMES - 1));   // 90°(관과 나란함 = 열림) → 0°(가로질러 = 닫힘)
    const c = Math.cos(ang), sn = Math.sin(ang), Lr = 2.2, hw = 0.2;
    const shape = [[-hw * -sn, -hw * c], [Lr * c - hw * -sn, Lr * sn - hw * c], [Lr * c + hw * -sn, Lr * sn + hw * c], [hw * -sn, hw * c]];
    const F = axis === "z" ? G.frameOf([center[0], center[1] + rv, center[2]], [0, 1, 0], [1, 0, 0], back) : G.frameOf([center[0], center[1], center[2] + rv], [0, 0, 1], [1, 0, 0], back);
    out.push(`<g class="hz-lever">${k.solidSvg(G.prismOf(F, shape, 0, 0.25, P), { tone: "hi", lit: true })}</g>`);
  }
  const F0 = axis === "z" ? G.frameOf([center[0], center[1] + rv, center[2]], [0, 1, 0], [1, 0, 0], back) : G.frameOf([center[0], center[1], center[2] + rv], [0, 0, 1], [1, 0, 0], back);
  return { svg: out, shape: A.prism(F0, [[0.2, 0], [0.2, 2.2], [-0.2, 2.2], [-0.2, 0]], 0, 0.25, {}) };
}
function valve(name, center, axis, pipeR, live, owner) {
  const rv = pipeR + 0.35, F = G.frameAlong(G.sub3(center, axis === "z" ? [0, 0, 0.45] : [0, 0.45, 0]), axis === "z" ? [0, 0, 1] : [0, 1, 0]);
  W.disc(`${name}.body`, F, 0, 0.9, rv, { cls: "pw-steel", tone: "mid", info: "cdu-valve", stamp: `valve-${axis}${pipeR}`, owner });
  const lev = leverFrames(center, axis, rv);
  const shape = R.solid({ ...lev.shape, name: `${name}.lever`, owner });
  W.put(`${name}.lever`, G.add3(center, axis === "z" ? [0.8, rv + 0.2, 0.8] : [0.8, 0.8, rv + 0.2]), live ? frames("valve", lev.svg) : lev.svg[0], [shape], { info: "cdu-valve", bias: 0.08 });
}
function cdu(i) {
  const x0 = CDU.xs[i], z0 = HALL.floor, tag = CDU.tags[i], live = tag === "b", Y = CDU_FRONT;
  if (!live) {
    // 닫힌 CDU: 몸통 · 문(아래 환기 슬롯) · 화면 · 손잡이 · 상태등
    W.box(`cdu${tag}`, { x: x0, y: CDU.y, w: CDU.w, d: CDU.d, r: 0.2 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: `cdu-${tag}`, stamp: "cdu-body",
      inner: L(rightSlots(x0 + CDU.w, CDU.y + 2, CDU.y + 10, z0 + 3, 6, 1.4, 0.55), { tone: "lo" }) });
    W.box(`cdu${tag}.door`, { x: x0 + 0.6, y: Y, w: CDU.w - 1.2, d: 0.25, r: 0.05 }, z0 + 1, CDU.h - 2, { cls: "hz-cdu", tone: "mid", steps: 1, info: `cdu-${tag}`, stamp: "cdu-door",
      inner: L(frontSlots(Y + 0.25, x0 + 1.8, x0 + CDU.w - 1.8, z0 + 2.4, 5, 1.3, 0.55), { tone: "lo" }) });
    W.box(`cdu${tag}.screen`, { x: x0 + 1.8, y: Y + 0.25, w: 4.2, d: 0.25, r: 0.08 }, z0 + 13.5, 3, { cls: "hz-screen", tone: "mid", steps: 1, info: `cdu-${tag}`, stamp: "cdu-screen" });
    W.box(`cdu${tag}.handle`, { x: x0 + CDU.w - 2.2, y: Y + 0.25, w: 0.6, d: 0.5, r: 0.1 }, z0 + 9, 2.6, { cls: "pw-steel", tone: "mid", steps: 1, info: `cdu-${tag}`, stamp: "cdu-handle" });
    W.put(`cdu${tag}.lamp`, [x0 + 7.8, Y + 0.5, z0 + 18.5], lamp("hz-lamp", [x0 + 7.8, Y + 0.5, z0 + 18.5], 0.75, `data-cdu="${tag}"`),
      [R.solid(A.box([x0 + 7.0, Y + 0.25, z0 + 17.7], [x0 + 8.6, Y + 0.55, z0 + 19.3], { name: `cdu${tag}.lamp` }))], { info: `cdu-${tag}`, bias: 0.05 });
  } else {
    // 열린 CDU B: 앞판과 오른쪽 옆판을 뗌 (뒤 몸통 · 장착판 · 왼쪽 틀 · 바닥 · 지붕 — 지붕 앞면에 "B" 각인과 상태등)
    //   속 부품은 장착판(창에서 4.6 뒤)에 붙임: 창이 깊으면 평행 투영에서 속이 옆판 쪽으로 밀려 가려짐 (전력 그림 ATS 의 교훈)
    const back = HX.y - 0.3;
    W.box("cdub.body", { x: x0, y: CDU.y, w: CDU.w, d: back - CDU.y, r: 0.05 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-b" });
    W.box("cdub.plate", { x: x0 + 0.8, y: back, w: CDU.w - 0.8, d: 0.3, r: 0.02 }, z0 + 1.5, CDU.h - 4.5, { cls: "pw-dark", tone: "lo", steps: 1, crease: "none", info: "cdu-b" });
    W.box("cdub.left", { x: x0, y: back, w: 0.8, d: Y - back, r: 0.05 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-b" });
    W.box("cdub.floor", { x: x0 + 0.8, y: back + 0.3, w: CDU.w - 0.8, d: Y - back - 0.3, r: 0.05 }, z0, 1.5, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-b" });
    W.box("cdub.roof", { x: x0 + 0.8, y: back + 0.3, w: CDU.w - 0.8, d: Y - back - 0.3, r: 0.05 }, CDU_Z1 - 3, 3, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-b",
      extra: k.faceTextSvg(k.sideMatrix([x0 + 1.4, Y], CDU_Z1 - 0.8, P, "left"), "B", { size: 1.5, tone: "hi" }) });
    W.put("cdub.lamp", [x0 + 7.8, Y + 0.05, CDU_Z1 - 1.5], lamp("hz-lamp", [x0 + 7.8, Y + 0.05, CDU_Z1 - 1.5], 0.75, 'data-cdu="b"'),
      [R.solid(A.box([x0 + 7.0, Y, CDU_Z1 - 2.3], [x0 + 8.6, Y + 0.1, CDU_Z1 - 0.7], { name: "cdub.lamp" }))], { info: "cdu-b", bias: 0.05 });
    // 판형 열교환기: 얇은 판 묶음(앞면에 판 가장자리 선) + 양 끝 틀판 (볼트 머리 점)
    const hx0 = x0 + HX.x, hy1 = HX.y + HX.d, hz0 = z0 + 2.5, hz1 = z0 + 16;
    W.box("cdub.hx", { x: hx0 + 0.4, y: HX.y, w: HX.w - 0.8, d: HX.d, r: 0.05 }, hz0, hz1 - hz0, { cls: "hz-hx", tone: "mid", steps: 1, info: "cdu-hx",
      inner: L(frontSeams(hy1, range(hx0 + 0.7, hx0 + HX.w - 0.7, 0.3), hz0, hz1), { tone: "lo" }) });
    for (const [x, nm] of [[hx0, "0"], [hx0 + HX.w - 0.4, "1"]]) W.box(`cdub.hxend${nm}`, { x, y: HX.y, w: 0.4, d: HX.d + 0.2, r: 0.05 }, hz0 - 0.3, hz1 - hz0 + 0.6, { cls: "pw-steel", tone: "mid", steps: 1, info: "cdu-hx",
      extra: Dt([[0.2, hz0 + 0.3], [0.2, hz1 - 0.3]].map(([dx, z]) => at([x + dx, hy1 + 0.2, z])), { size: 0.22, tone: "mid" }) });
    // 펌프 2대 (위·아래): 몸통 + 앞으로 나온 모터(원통) + 모터 덮개 링
    const py0 = HX.y, py1 = HX.y + 1.5;                       // 펌프 몸통 앞뒤
    for (const [j, zc] of [[0, z0 + 5.5], [1, z0 + 11.5]]) {
      W.box(`cdub.pump${j}`, { x: x0 + 6.0, y: py0, w: 3.0, d: py1 - py0, r: 0.2 }, zc - 2, 4, { cls: "hz-pump", tone: "mid", steps: 2, info: "cdu-pump" });
      const F = G.frameAlong([x0 + 7.5, py1, zc], [0, 1, 0]);
      W.disc(`cdub.motor${j}`, F, 0, 1.6, 1.35, { cls: "hz-pump", tone: "mid", info: "cdu-pump" });
      W.disc(`cdub.fan${j}`, F, 1.6, 2.1, 1.42, { cls: "pw-dark", tone: "mid", info: "cdu-pump", extra: L(k.sideRing([x0 + 7.5, py1 + 2.1, zc], 0.85, "y", P, 16), { tone: "mid" }) });
    }
    // 안쪽 관: 2차 회수(지붕 → 열교환기 위) · 열교환기 → 펌프 · 아래 펌프 → 위 펌프 → 지붕(2차 공급)
    const pyc = (py0 + py1) / 2;
    cable("cdub.ret", [[x0 + PORT.tcsR, PORT.yR, CDU_Z1 - 3], [x0 + PORT.tcsR, PORT.yR, hz1]], 0.45, { cls: "hz-red", flow: "wB", info: "cdu-b", fillet: false, maxLength: 8 });
    for (const [j, zc] of [[0, z0 + 5.5], [1, z0 + 11.5]]) cable(`cdub.hx2p${j}`, [[hx0 + HX.w, pyc, zc], [x0 + 6.0, pyc, zc]], 0.4, { cls: "hz-blue", flow: "cB", info: "cdu-b", fillet: false, maxLength: 4 });
    cable("cdub.link", [[x0 + 8.4, pyc, z0 + 7.5], [x0 + 8.4, pyc, z0 + 9.5]], 0.4, { cls: "hz-blue", flow: "cB", info: "cdu-pump", fillet: false, maxLength: 4 });
    cable("cdub.sup", [[x0 + PORT.tcsS, PORT.yS, z0 + 13.5], [x0 + PORT.tcsS, PORT.yS, CDU_Z1 - 3]], 0.4, { cls: "hz-blue", flow: "cB", info: "cdu-b", fillet: false, maxLength: 8 });
  }
  // 위: 2차 관 (공급 = CDU → 공급 배관, 회수 = 회수 배관 → CDU) + 격리 밸브
  const f = tag === "a" ? "" : tag.toUpperCase(), rt = tcsRoute(x0);
  const vS = [x0 + PORT.tcsS, PORT.yS, CDU_Z1 + 2.1], vR = [x0 + PORT.tcsR, PORT.yR, CDU_Z1 + 2.9];
  const gS = alongAt(rt.sup, vS), gR = alongAt(rt.ret, vR);
  cable(`tcs.rise${tag}`, rt.sup, 0.6, { cls: "hz-blue", flow: `c${f}`, info: "tcs-riser", fillet: false, maxLength: 6, gaps: [[gS - 0.45, gS + 0.45]] });
  cable(`tcs.fall${tag}`, rt.ret, 0.6, { cls: "hz-red", flow: `w${f}`, info: "tcs-riser", fillet: false, maxLength: 6, gaps: [[gR - 0.45, gR + 0.45]] });
  valve(`cdu${tag}.vS`, vS, "z", 0.6, live, `tcs.rise${tag}`);
  valve(`cdu${tag}.vR`, vR, "z", 0.6, live, `tcs.fall${tag}`);
  return x0;
}
CDU.xs.forEach((_, i) => cdu(i));

// ---------- 13) 벽 밖 1차 냉각수 배관 (시설 물: CDU ↔ 바깥 냉각 설비) ----------
// 공급(찬물): 펌프 칸 → 오른쪽 끝에서 벽 쪽으로 → 벽을 따라 왼쪽 → CDU 마다 가지관 (벽을 지나 CDU 앞 아래로)
// 회수(데워진 물): CDU 앞 → 가지관 → 회수 배관 → 오른쪽 → 건식 냉각기 오른쪽 끝 → (냉각기 → 칠러) → 펌프
const YX0 = 86;                                            // 두 배관의 왼쪽 끝 (막음 캡)
const PUMP = { hx: 243.5, hr: 1.1, z: 6.8, ys: [64, 75], dx: 245.9, dz: 12.8, dr: 1.2 };
const DCX = { in: { y: 72, z: 17.5 }, out: { y: 64, z: 12.2 }, face: DC.x + DC.w + 1 };   // 건식 냉각기 오른쪽 끝 헤더 상자 앞면 x = 185
function yardPipes() {
  const E = reach(TEE.elbow, YS.r);                         // 엘보 공 가운데 → 관 끝
  const run = (name, from, to, opts) => cable(name, [from, to], YS.r, { cls: "hz-alu", fw: 1.6, fillet: false, maxLength: 30, owner: name.startsWith("yard.sup") ? "yard.sup" : "yard.ret", ...opts });
  const step = (p, q, d) => { const v = G.sub3(q, p), l = G.len3(v); return G.add3(p, G.mul3(v, d / l)); };   // p 에서 q 쪽으로 d 만큼
  // 공급(찬물): 펌프 토출관(펌프 2대가 T 로 붙음) → 엘보 E0 → +x → E1 → 벽 쪽 → E2 → 아래 → E3 → 벽을 따라 −x (CDU 가지관 T 3개)
  const S0 = [PUMP.dx, PS.y + PS.d - 2.5, PUMP.dz], E0 = [PUMP.dx, PS.y + 2, PUMP.dz], E1 = [258, PS.y + 2, PUMP.dz], E2 = [258, YS.y, PUMP.dz], E3 = [258, YS.y, YS.z], S5 = [YX0, YS.y, YS.z];
  const pumpT = PUMP.ys.map((py) => S0[1] - py);           // 토출관을 따라 잰 펌프 T 자리
  run("yard.sup0", S0, step(E0, S0, E), { flow: "c", info: "pumps", touch: ["ps.dstand*"], gaps: teeGaps(pumpT, TEE.pump, YS.r) });
  run("yard.sup1", step(E0, E1, E), step(E1, E0, E), { flow: "c", info: "yard-sup" });
  run("yard.sup2", step(E1, E2, E), step(E2, E1, E), { flow: "c", info: "yard-sup", touch: ["yard.standS*"] });
  run("yard.sup3", step(E2, E3, E), step(E3, E2, E), { flow: "c", info: "yard-sup" });
  const supT = CDU.xs.map((x0) => E3[0] - E - (x0 + PORT.sup));
  run("yard.sup4", step(E3, S5, E), S5, { flow: "c", info: "yard-sup", touch: ["yard.sleeper*"], gaps: teeGaps(supT.map((a0) => a0), TEE.yard, YS.r) });
  [E0, E1, E2, E3].forEach((c, j) => fitting(`yard.elbowS${j}`, c, TEE.elbow, { info: j === 0 ? "pumps" : "yard-sup" }));
  W.disc("yard.capP", G.frameAlong(S0, [0, 1, 0]), 0, 0.6, YS.r + 0.3, { cls: "hz-alu", tone: "mid", info: "pumps" });
  // 회수(데워진 물): 왼쪽 끝 → +x (CDU 가지관 T 3개) → F1 → 위 → F2 → 마당 쪽 → F3 → 냉각기 오른쪽 끝 헤더 (−x)
  const R0 = [YX0, YR.y, YR.z], F1 = [192, YR.y, YR.z], F2 = [192, YR.y, DCX.in.z], F3 = [192, DCX.in.y, DCX.in.z], R4 = [DCX.face, DCX.in.y, DCX.in.z];
  const retT = CDU.xs.map((x0) => x0 + PORT.ret - YX0);
  run("yard.ret0", R0, step(F1, R0, E), { flow: "w", info: "yard-ret", touch: ["yard.stand*"], gaps: teeGaps(retT, TEE.yard, YR.r) });
  run("yard.ret1", step(F1, F2, E), step(F2, F1, E), { flow: "w", info: "yard-ret" });
  run("yard.ret2", step(F2, F3, E), step(F3, F2, E), { flow: "w", info: "yard-ret", touch: ["yard.standR*"] });
  run("yard.ret3", step(F3, R4, E), R4, { flow: "w", info: "yard-ret" });
  [F1, F2, F3].forEach((c, j) => fitting(`yard.elbowR${j}`, c, TEE.elbow, { info: "yard-ret" }));
  // 건식 냉각기 → 칠러 (식은 물)
  cable("yard.dc2ch", [[DCX.face, DCX.out.y, DCX.out.z], [CH.x, DCX.out.y, DCX.out.z]], YS.r, { cls: "hz-alu", flow: "c", fw: 1.6, fillet: false, maxLength: 30, info: "yard-dc2ch" });
  // 막음 캡 (왼쪽 끝)
  W.disc("yard.capS", G.frameAlong([YX0 - 0.6, YS.y, YS.z], [1, 0, 0]), 0, 0.6, YS.r + 0.3, { cls: "hz-alu", tone: "mid", info: "yard-sup" });
  W.disc("yard.capR", G.frameAlong([YX0 - 0.6, YR.y, YR.z], [1, 0, 0]), 0, 0.6, YR.r + 0.3, { cls: "hz-alu", tone: "mid", info: "yard-ret" });
  // 받침: 공급 = 낮은 콘크리트 받침, 회수 = 강철 받침대 (높이 다름)
  for (const x of [134, 162, 214, 240]) {
    W.box(`yard.sleeper${x}`, { x: x - 0.8, y: YS.y - 2, w: 1.6, d: 4, r: 0.1 }, SLAB, YS.z - YS.r - SLAB, { cls: "pw-concrete", tone: "mid", steps: 1, info: "yard-sup", stamp: "sleeper" });
    if (x < 190) W.box(`yard.stand${x}`, { x: x - 0.8, y: YR.y - 1.6, w: 1.6, d: 3.2, r: 0.1 }, SLAB, YR.z - YR.r - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "yard-ret", stamp: "rstand" });
  }
  for (const y of [32, 52]) W.box(`yard.standR${y}`, { x: 190.4, y: y - 0.8, w: 3.2, d: 1.6, r: 0.1 }, SLAB, DCX.in.z - YR.r - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "yard-ret", stamp: "rstandR" });
  for (const y of [24, 46]) W.box(`yard.standS${y}`, { x: 256.4, y: y - 0.8, w: 3.2, d: 1.6, r: 0.1 }, SLAB, PUMP.dz - YS.r - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "yard-sup", stamp: "sstand" });
  // CDU 마다 가지관 2개 (벽을 지나감) + 격리 밸브 (벽 바로 밖)
  CDU.xs.forEach((x0, i) => {
    const tag = CDU.tags[i], f = tag === "a" ? "" : tag.toUpperCase(), live = tag === "b";
    const endY = live ? HX.y + HX.d : CDU_FRONT + 0.25;      // B 는 앞판이 없어 열교환기 앞면까지, A·C 는 문 앞면까지
    const sx = x0 + PORT.sup, rx = x0 + PORT.ret, vy = 1.6;
    const ys0 = YS.y - reach(TEE.yard, 0.6), yr1 = YR.y - reach(TEE.yard, 0.6);
    cable(`branch.s${tag}`, [[sx, ys0, YS.z], [sx, endY, YS.z]], 0.6, { cls: "hz-alu", flow: `c${f}`, info: "branch", fillet: false, maxLength: 8, gaps: [[ys0 - vy - 0.45, ys0 - vy + 0.45]] });
    cable(`branch.r${tag}`, [[rx, endY, PORT.zr], [rx, yr1, PORT.zr]], 0.6, { cls: "hz-alu", flow: `w${f}`, info: "branch", fillet: false, maxLength: 8, gaps: [[vy - endY - 0.45, vy - endY + 0.45]] });
    fitting(`yard.teeS${tag}`, [sx, YS.y, YS.z], TEE.yard, { owner: "yard.sup", info: "branch" });
    fitting(`yard.teeR${tag}`, [rx, YR.y, YR.z], TEE.yard, { owner: "yard.ret", info: "branch" });
    valve(`cdu${tag}.vFs`, [sx, vy, YS.z], "y", 0.6, live, `branch.s${tag}`);
    valve(`cdu${tag}.vFr`, [rx, vy, PORT.zr], "y", 0.6, live, `branch.r${tag}`);
  });
  // 정비 표지 (CDU B 를 떼어 낸 동안만 보임): 공급 밸브 손잡이에 매단 노란 꼬리표
  {
    const x = cduX("b") + PORT.sup + 2.0, y = 1.6, z = YS.z + 0.95 + 0.25;   // 닫힌 손잡이 끝 (+x 쪽)
    const tag = `<g class="hz-tag" aria-hidden="true">${L(seg([x, y, z], [x, y, z - 1.6]), { tone: "mid" })}<g class="pw-yellow">${k.solidSvg(k.slabOf({ x: x - 0.6, y: y - 0.05, w: 1.2, d: 0.1, r: 0.05 }, z - 3.2, 1.6, P, 1), { tone: "mid" })}</g></g>`;
    W.put("cdub.tag", [x, y, z - 2], tag, [R.solid(A.box([x - 0.6, y - 0.05, z - 3.2], [x + 0.6, y + 0.05, z - 1.6], { name: "cdub.tag", owner: "branch.sb", ground: true }))], { info: "cdu-tag", bias: 0.1 });
  }
}
yardPipes();

// ---------- 14) 건식 냉각기 (핀 코일 + 위로 부는 팬 4개) ----------
function dryCooler() {
  const z0 = SLAB, zc0 = z0 + 7, zc1 = zc0 + 10, Y = DC.y + DC.d, X = DC.x + DC.w;
  for (const x of [DC.x + 0.4, DC.x + 37.4, DC.x + 75.4, X - 1.6]) for (const y of [DC.y + 0.4, Y - 1.6]) W.box(`dc.leg${x}${y}`, { x, y, w: 1.2, d: 1.2, r: 0.1 }, z0, zc0 - z0, { cls: "pw-steel", tone: "mid", steps: 1, info: "drycooler", stamp: "dc-leg" });
  // 코일 상자: 앞면·오른쪽 면에 촘촘한 핀 선 (바깥 공기가 지나가는 얇은 알루미늄 판)
  W.box("dc.coil", DC, zc0, zc1 - zc0, { cls: "hz-coil", tone: "mid", steps: 1, info: "drycooler",
    inner: L(frontSeams(Y, range(DC.x + 1.2, X - 1.2, 1.2), zc0, zc1) + rightSeams(X, range(DC.y + 1.2, Y - 1.2, 1.2), zc0, zc1), { tone: "lo" }) });
  W.box("dc.deck", { x: DC.x, y: DC.y, w: DC.w, d: DC.d, r: 0.5 }, zc1, 1.2, { cls: "hz-unit", tone: "mid", steps: 1, info: "drycooler" });
  // 팬 4개: 둥근 통 + 보호망(동심원·살) + 가운데 축
  const FAN_R = 5.2, fz = zc1 + 1.2;
  DC_FANS.forEach((cx, j) => {
    const cy = DC.y + DC.d / 2, ztop = fz + 1.6;
    const rings = [4.4, 3.0, 1.6].map((r) => k.planOutline({ x: cx - r, y: cy - r, w: r * 2, d: r * 2, r }, ztop, P, 6)).join("");
    const spokes = [0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2 + Math.PI / 4; return seg([cx + Math.cos(a) * 1.6, cy + Math.sin(a) * 1.6, ztop], [cx + Math.cos(a) * 4.4, cy + Math.sin(a) * 4.4, ztop]); }).join("");
    W.cyl(`dc.fan${j}`, cx, cy, FAN_R, fz, 1.6, { cls: "hz-unit", tone: "mid", info: "dc-fan", stamp: "dc-fan",
      extra: L(rings + spokes, { tone: "lo" }) + Dt([at([cx, cy, ztop])], { size: 0.5, tone: "mid" }) });
  });
  // 오른쪽 끝 헤더 상자 2개 (위 = 데워진 물 들어옴, 아래 = 식은 물 나감)
  W.box("dc.hdrIn", { x: X, y: DCX.in.y - 3, w: 1, d: 6, r: 0.2 }, DCX.in.z - 2.4, 4.8, { cls: "hz-alu", tone: "mid", steps: 1, info: "drycooler" });
  W.box("dc.hdrOut", { x: X, y: DCX.out.y - 3, w: 1, d: 6, r: 0.2 }, DCX.out.z - 2.2, 4.4, { cls: "hz-alu", tone: "mid", steps: 1, info: "drycooler" });
  W.box("dc.panel", { x: X - 8, y: Y, w: 5, d: 0.5, r: 0.1 }, zc0 + 1.5, 4.6, { cls: "pw-grey", tone: "mid", steps: 1, info: "drycooler" });
}
const DC_FANS = [78, 94, 110, 126, 142, 158, 174];
dryCooler();

// ---------- 15) 칠러 패키지 (압축기·응축 코일·팬 3개 + 오른쪽 끝 펌프 칸) ----------
const CH_FANS = [214, 224, 234];
function chiller() {
  const z0 = SLAB, zb = z0 + 1.2, z1 = z0 + 21, Y = CH.y + CH.d, X = CH.x + CH.w;
  W.box("ch.base", { x: CH.x - 0.5, y: CH.y - 0.5, w: CH.w + PS.w + 0.5, d: CH.d + 1, r: 0.2 }, z0, 1.2, { cls: "pw-steel", tone: "mid", steps: 1, info: "chiller" });
  // 몸통: 위 절반 = 응축 코일(핀 선), 아래 절반 = 압축기 칸 문 2짝(루버) + 제어반
  const coil0 = zb + 9.6;
  W.box("ch.body", CH, zb, z1 - zb, { cls: "hz-unit", tone: "mid", steps: 1, info: "chiller",
    inner: L(frontRules(Y, CH.x, X, [coil0]) + frontSeams(Y, range(CH.x + 1, X - 1, 1), coil0, z1) + rightSeams(X, range(CH.y + 1, Y - 1, 1), coil0, z1) + seg([X, CH.y, coil0], [X, Y, coil0]), { tone: "lo" }) });
  for (const [x, w] of [[CH.x + 1, 10], [CH.x + 12, 10]]) W.box(`ch.door${x}`, { x, y: Y, w, d: 0.3, r: 0.05 }, zb + 0.8, 8, { cls: "hz-unit", tone: "mid", steps: 1, info: "ch-comp", stamp: "ch-door",
    inner: L(frontSlots(Y + 0.3, x + 1.2, x + w - 1.2, zb + 2, 4, 1.4, 0.55), { tone: "lo" }) });
  W.box("ch.panel", { x: X - 8.4, y: Y, w: 7, d: 0.4, r: 0.1 }, zb + 1, 7.8, { cls: "pw-dark", tone: "mid", steps: 1, info: "ch-panel" });
  W.box("ch.screen", { x: X - 7.6, y: Y + 0.4, w: 3.4, d: 0.2, r: 0.05 }, zb + 5, 2.2, { cls: "hz-screen", tone: "mid", steps: 1, info: "ch-panel" });
  W.put("ch.lamp", [X - 2.6, Y + 0.45, zb + 6.1], lamp("hz-chlamp", [X - 2.6, Y + 0.45, zb + 6.1], 0.8),
    [R.solid(A.box([X - 3.4, Y + 0.4, zb + 5.3], [X - 1.8, Y + 0.5, zb + 6.9], { name: "ch.lamp" }))], { info: "ch-panel", bias: 0.05 });
  CH_FANS.forEach((cx, j) => {
    const cy = CH.y + CH.d / 2, ztop = z1 + 1.4;
    const rings = [3.8, 2.5, 1.3].map((r) => k.planOutline({ x: cx - r, y: cy - r, w: r * 2, d: r * 2, r }, ztop, P, 6)).join("");
    const spokes = [0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2; return seg([cx + Math.cos(a) * 1.3, cy + Math.sin(a) * 1.3, ztop], [cx + Math.cos(a) * 3.8, cy + Math.sin(a) * 3.8, ztop]); }).join("");
    W.cyl(`ch.fan${j}`, cx, cy, 4.4, z1, 1.4, { cls: "hz-unit", tone: "mid", info: "ch-fan", stamp: "ch-fan",
      extra: L(rings + spokes, { tone: "lo" }) + Dt([at([cx, cy, ztop])], { size: 0.45, tone: "mid" }) });
  });
  // 펌프 칸 (지붕 없음): 흡입 헤더(칠러 → 펌프) · 펌프 2대(1대 예비) · 토출 헤더(→ 공급 배관)
  W.disc("ps.stub", G.frameAlong([X, 70, PUMP.z], [1, 0, 0]), 0, PUMP.hx - PUMP.hr - X, 0.9, { cls: "hz-alu", tone: "mid", info: "pumps" });
  W.disc("ps.suction", G.frameAlong([PUMP.hx, PS.y + 1.5, PUMP.z], [0, 1, 0]), 0, PS.d - 3, PUMP.hr, { cls: "hz-alu", tone: "mid", info: "pumps" });
  PUMP.ys.forEach((py, j) => {
    const vx0 = PUMP.hx + PUMP.hr, zc = PUMP.z - 0.8;
    W.box(`ps.ped${j}`, { x: vx0 + 0.4, y: py - 1, w: 1.8, d: 2, r: 0.1 }, zb, zc - 2.0 - zb, { cls: "pw-steel", tone: "mid", steps: 1, info: "pumps", stamp: "ps-ped" });
    W.disc(`ps.volute${j}`, G.frameAlong([vx0, py, zc], [1, 0, 0]), 0, 2.6, 2.0, { cls: "hz-pump", tone: "mid", info: "pumps", stamp: "ps-volute" });
    W.disc(`ps.coupling${j}`, G.frameAlong([vx0 + 2.6, py, zc], [1, 0, 0]), 0, 0.4, 0.8, { cls: "pw-steel", tone: "mid", info: "pumps", stamp: "ps-coupling" });
    W.disc(`ps.motor${j}`, G.frameAlong([vx0 + 3.0, py, zc], [1, 0, 0]), 0, 5, 1.5, { cls: "hz-pump", tone: "mid", info: "pumps", stamp: "ps-motor",
      extra: L(k.sideRing([vx0 + 8.0, py, zc], 0.8, "x", P, 14), { tone: "mid" }) });
    W.box(`ps.foot${j}`, { x: vx0 + 3.2, y: py - 1.2, w: 4.6, d: 2.4, r: 0.1 }, zb, zc - 1.5 - zb, { cls: "pw-steel", tone: "mid", steps: 1, info: "pumps", stamp: "ps-foot" });
    W.disc(`ps.riser${j}`, G.frameAlong([PUMP.dx, py, zc + 2.0], [0, 0, 1]), 0, PUMP.dz - reach(TEE.pump, 0.8) - (zc + 2.0), 0.8, { cls: "hz-alu", tone: "mid", info: "pumps", stamp: "ps-riser", owner: "yard.sup" });
    W.put(`ps.lamp${j}`, [vx0 + 5.5, py, zc + 1.55], lamp("hz-pumplamp", [vx0 + 5.5, py, zc + 1.55], 0.45, `data-pump="${j}"`), [R.solid(A.box([vx0 + 5.1, py - 0.4, zc + 1.45], [vx0 + 5.9, py + 0.4, zc + 1.6], { name: `ps.lamp${j}` }))], { info: "pumps", bias: 0.05 });
  });
  PUMP.ys.forEach((py, j) => fitting(`ps.tee${j}`, [PUMP.dx, py, PUMP.dz], TEE.pump, { owner: "yard.sup", info: "pumps" }));
  for (const y of [(PUMP.ys[0] + PUMP.ys[1]) / 2, PS.y + PS.d - 3.3]) W.box(`ps.dstand${y}`, { x: PUMP.dx - 0.6, y: y - 0.3, w: 1.2, d: 0.6, r: 0.05 }, zb, PUMP.dz - YS.r - zb, { cls: "pw-steel", tone: "mid", steps: 1, info: "pumps", stamp: "ps-dstand" });
}
chiller();

// ---------- 16) 바깥 온도계 (더운 오후 장면에서 바늘이 움직임) ----------
const T_MIN = 0, T_MAX = 50, NEEDLE = range(20, 40, 1);
const dialAngle = (t) => (Math.PI * 5) / 4 - ((t - T_MIN) / (T_MAX - T_MIN)) * (Math.PI * 3) / 2;   // 0 °C = 왼쪽 아래, 50 °C = 오른쪽 아래
function thermometer() {
  const { x, y, z, r } = THERMO, Yf = y + 0.6;
  W.box("thermo.bracket", { x: x - 0.6, y: CH.y + CH.d, w: 1.2, d: y - (CH.y + CH.d), r: 0.05 }, z - 0.6, 1.2, { cls: "pw-steel", tone: "mid", steps: 1, info: "thermo" });
  const ticks = [];
  for (let t = T_MIN; t <= T_MAX; t += 5) {
    const a = dialAngle(t), r0 = r * (t % 10 === 0 ? 0.62 : 0.74);
    ticks.push(seg([x + Math.cos(a) * r0, Yf + 0.02, z + Math.sin(a) * r0], [x + Math.cos(a) * r * 0.86, Yf + 0.02, z + Math.sin(a) * r * 0.86]));
  }
  // 35 °C 이상 = 빨간 띠 (칠러가 꼭 필요한 더위)
  const hot = range(35, 50, 1.5).map((t) => [x + Math.cos(dialAngle(t)) * r * 0.9, Yf + 0.02, z + Math.sin(dialAngle(t)) * r * 0.9]);
  const needles = NEEDLE.map((t) => { const a = dialAngle(t); return `<g class="hz-needle">${L(seg([x, Yf + 0.05, z], [x + Math.cos(a) * r * 0.8, Yf + 0.05, z + Math.sin(a) * r * 0.8]), { tone: "hi" })}</g>`; });
  W.disc("thermo.dial", G.frameAlong([x, y, z], [0, 1, 0]), 0, 0.6, r, { cls: "pw-steel", tone: "mid", info: "thermo",
    extra: `<path class="hz-hotarc" d="${pathOf3(hot)}"/>` + L(ticks.join(""), { tone: "lo" }) + frames("needle", needles) + Dt([at([x, Yf + 0.06, z])], { size: 0.35, tone: "hi" }) });
}
thermometer();

// ---------- 17) 정비 카트 + 꺼낸 컴퓨트 트레이 (덮개를 열어 냉각판이 보임) ----------
// 트레이 = GPU 4 + CPU 2 위에 구리 냉각판, 구리관으로 이어져 물이 칩 바로 위를 지남 (회사 영상의 냉각판·번호 매긴 고정쇠)
//   카트 위라 지금은 물이 흐르지 않음 (뒤쪽 퀵 커넥터 두 개로 랙 매니폴드에 꽂힘)
function cartAndTray() {
  const { x, y, w, d } = CART, z0 = HALL.floor, zt = z0 + 7.7, X = x + w;
  // 바퀴 4 · 기둥 4 · 아래 선반 · 위 선반 · 손잡이
  for (const [cx, cy] of [[x + 1, y + 1], [X - 1, y + 1], [x + 1, y + d - 1], [X - 1, y + d - 1]]) {
    W.disc(`cart.wheel${cx}${cy}`, G.frameAlong([cx, cy - 0.25, z0 + 0.65], [0, 1, 0]), 0, 0.5, 0.65, { cls: "pw-dark", tone: "mid", info: "cart", stamp: "cart-wheel" });
    W.box(`cart.fork${cx}${cy}`, { x: cx - 0.45, y: cy - 0.45, w: 0.9, d: 0.9, r: 0.1 }, z0 + 1.3, 0.3, { cls: "pw-steel", tone: "mid", steps: 1, info: "cart", stamp: "cart-fork" });
    W.box(`cart.post${cx}${cy}`, { x: cx - 0.3, y: cy - 0.3, w: 0.6, d: 0.6, r: 0.05 }, z0 + 1.6, zt - z0 - 1.6, { cls: "pw-steel", tone: "mid", steps: 1, info: "cart", stamp: "cart-post" });
  }
  W.box("cart.low", { x: x + 1.3, y: y + 1.3, w: w - 2.6, d: d - 2.6, r: 0.1 }, z0 + 3.2, 0.4, { cls: "pw-grey", tone: "mid", steps: 1, info: "cart" });
  W.box("cart.top", { x, y, w, d, r: 0.2 }, zt, 0.5, { cls: "pw-grey", tone: "mid", steps: 1, info: "cart" });
  for (const yy of [y + 0.6, y + d - 1.2]) W.box(`cart.hpost${yy}`, { x: X - 0.6, y: yy, w: 0.6, d: 0.6, r: 0.05 }, zt + 0.5, 4.6, { cls: "pw-steel", tone: "mid", steps: 1, info: "cart", stamp: "cart-hpost" });
  W.disc("cart.grip", G.frameAlong([X - 0.3, y + 0.3, zt + 5.4], [0, 1, 0]), 0, d - 0.6, 0.32, { cls: "pw-dark", tone: "mid", info: "cart" });
  // 트레이 차대 (뒤 = +x 끝) · 기판 · 뒤 받침(퀵 커넥터 2개)
  const T0 = { x: x + 1.0, y: y + 1.6, w: 15, d: 6.8 }, tz = zt + 0.5, tz1 = tz + 0.5;   // 실제보다 조금 크게 (설명용)
  W.box("tray.chassis", { ...T0, r: 0.1 }, tz, 0.5, { cls: "pw-silver", tone: "mid", steps: 1, info: "tray",
    inner: `<path class="hz-pcb" d="${poly([[T0.x + 0.5, T0.y + 0.4, tz1], [T0.x + T0.w - 1.4, T0.y + 0.4, tz1], [T0.x + T0.w - 1.4, T0.y + T0.d - 0.4, tz1], [T0.x + 0.5, T0.y + T0.d - 0.4, tz1]])}"/>` });
  const QB = { x: T0.x + T0.w - 1.0, y: T0.y + 0.6, w: 0.8, d: T0.d - 1.2 };
  W.box("tray.qdblock", { ...QB, r: 0.08 }, tz1, 1.0, { cls: "pw-dark", tone: "mid", steps: 1, info: "qd" });
  const QZ = tz1 + 0.55, QY = [T0.y + 1.7, T0.y + T0.d - 1.7];
  QY.forEach((qy, j) => W.disc(`tray.qd${j}`, G.frameAlong([QB.x + QB.w, qy, QZ], [1, 0, 0]), 0, 0.7, 0.32, { cls: j === 0 ? "hz-blue" : "hz-red", tone: "mid", info: "qd" }));
  // 냉각판: GPU 4 (큰 구리판 + 검정 고정쇠 + 나사 4) · CPU 2 (작은 구리판)
  const plates = [];
  const GP = 2.3, CP = 1.6;                                 // GPU·CPU 냉각판 한 변
  const gpuAt = [[T0.x + 1.4, QY[0] - GP / 2], [T0.x + 1.4, QY[1] - GP / 2], [T0.x + 7.4, QY[0] - GP / 2], [T0.x + 7.4, QY[1] - GP / 2]];
  gpuAt.forEach(([px, py], j) => {
    W.box(`tray.gpu${j}`, { x: px, y: py, w: GP, d: GP, r: 0.12 }, tz1, 0.5, { cls: "pw-copper", tone: "mid", steps: 1, info: "coldplate", owner: "tray.loop", stamp: "gpu-plate" });
    const screws = [[px + 0.35, py + 0.35], [px + GP - 0.35, py + 0.35], [px + 0.35, py + GP - 0.35], [px + GP - 0.35, py + GP - 0.35]].map(([sx, sy]) => at([sx, sy, tz1 + 0.7]));
    W.box(`tray.brk${j}`, { x: px + 0.15, y: py + 0.15, w: GP - 0.3, d: GP - 0.3, r: 0.15 }, tz1 + 0.5, 0.2, { cls: "pw-dark", tone: "mid", steps: 1, info: "coldplate", owner: "tray.loop", stamp: "gpu-bracket",
      extra: Dt(screws, { size: 0.15, tone: "hi" }) });
    plates.push([px + GP / 2, py + GP / 2]);
  });
  for (const [j, py] of [[0, QY[0] - CP / 2], [1, QY[1] - CP / 2]]) W.box(`tray.cpu${j}`, { x: T0.x + 4.6, y: py, w: CP, d: CP, r: 0.1 }, tz1, 0.45, { cls: "pw-copper", tone: "mid", steps: 1, info: "coldplate", owner: "tray.loop", stamp: "cpu-plate" });
  // 구리관: 들어오는 커넥터 → GPU·CPU 냉각판을 차례로 지나 → U 턴 → 나가는 커넥터 (판 속 미세 유로는 그리지 않음)
  W.hose("tray.loop", [[QB.x, QY[0], QZ], [T0.x + 0.8, QY[0], QZ], [T0.x + 0.8, QY[1], QZ], [QB.x, QY[1], QZ]], 0.2, { cls: "pw-copper", tone: "mid", bend: 0.8, maxLength: 4, owner: "tray.loop", info: "coldplate" });
}
cartAndTray();

// ---------- 18) 보호 기둥 (노랑) ----------
for (const [x, y] of [[126, 18], [200, 18], [252, 50], [262, 50]]) {
  W.cyl(`bollard${x}${y}`, x, y, 1.0, SLAB, 9, { cls: "pw-yellow", tone: "mid", info: "bollard", stamp: "bollard" });
  W.cyl(`bollard.cap${x}${y}`, x, y, 1.05, SLAB + 9, 0.5, { cls: "pw-yellow", tone: "mid", info: "bollard", stamp: "bcap" });
}

// ---------- 그리기 (칠하는 순서 = 광선으로 잰 앞뒤) ----------
const body = W.render();

// 짚을 곳 (둘러보기 순서 = 전기가 들어오는 길 → 열이 나가는 길). z = 그 부품을 볼 때의 확대 배율
const PART_STOPS = [
  { key: "mv", p: [MV_TRENCH.x + 18, MV_TRENCH.y + 4.5, MV_TRENCH.pit + 1], z: 2.6 },
  { key: "xfmr", p: [XA.x + 8, XA.y + XA.d, SLAB + 12], z: 2.4 },
  { key: "ladder", p: [-10, LAD.y0 + 2, LAD.z + 1], z: 2.6 },
  { key: "sb-a", p: [SB.x + 9, SB.y + SB.d, HALL.floor + 14], z: 2.6 },
  { key: "gen", p: [GEN.x + 22, GEN.y + GEN.d, SLAB + GEN_TANK + 12], z: 2.0 },
  { key: "ups", p: [UPS.xs[0] + 2.2, UPS.y + UPS.d, HALL.floor + 14], z: 2.8 },
  { key: "tapoff", p: [RACK0 + 3 * RACK_W + BUSES[1].tapX, BUSES[1].y, BUS.z - 1.2], z: 3.4 },
  { key: "rack", p: [RACK0 + 6 * RACK_W + 3, REAR, HALL.floor + 12], z: 2.8 },
  { key: "tray", p: [CART.x + 6, CART.y + 5, HALL.floor + 9], z: 4.2, side: "left" },
  { key: "manifold", p: [RACK0 + 9 * RACK_W + 5.2, MANI.y1, HALL.floor + 14], z: 3.6 },
  { key: "tcs", p: [RACK0 + 2 * RACK_W, SUP.y, SUP.z + 1.5], z: 2.8 },
  { key: "cdu-b", p: [cduX("b") + 5, CDU_FRONT, HALL.floor + 10], z: 3.2, side: "left" },
  { key: "branch", p: [cduX("b") + 3, 2, 7], z: 3.0 },
  { key: "drycooler", p: [DC.x + 30, DC.y + DC.d, SLAB + 12], z: 2.2 },
  { key: "chiller", p: [CH.x + 18, CH.y + CH.d, SLAB + 12], z: 2.2 },
  { key: "pumps", p: [PUMP.hx + PUMP.hr + 5.5, PUMP.ys[0], PUMP.z + 0.8], z: 3.0 },   // 식힌 물을 다시 CDU 로 → 냉각수 고리가 닫힘
];
// 장면마다 짚을 곳: 온도계 → 칠러 팬 → 온도계 → CDU C 상태등 → B 밸브 → B → B 밸브
const THERMO_P = [THERMO.x, THERMO.y + 0.8, THERMO.z];
const CHFAN_P = [CH_FANS[1], CH.y + CH.d / 2, SLAB + 22.4];
const CDUC_P = [cduX("c") + 7.8, CDU_FRONT + 0.5, HALL.floor + 18.5];
const VALVE_P = [cduX("b") + PORT.sup, 1.6, YS.z + 1];
const CDUB_P = [cduX("b") + 5, CDU_FRONT, HALL.floor + 10];
const PHASE_STOPS = [["warm", THERMO_P], ["chill", CHFAN_P], ["evening", THERMO_P], ["standby", CDUC_P], ["isolate", VALVE_P], ["maint", CDUB_P], ["restore", VALVE_P]]
  .map(([phase, p]) => ({ key: `ph-${phase}`, phase, p, z: p === THERMO_P ? 3.2 : p === CHFAN_P ? 2.6 : 3.2, side: p === CHFAN_P ? undefined : "left" }));   // CDU 장면은 말풍선을 왼쪽에 (오른쪽 CDU B 를 가리지 않게)
// 규모 사다리 (둘러보기 끝): 줄 끝의 옆판을 뗀 랙 1대를 크게 → 랙 줄 → 정류장 없음 = 전체 보기로 돌아옴 (차일드레스 캠퍼스)
//   key 를 설명(INFO)에 없는 이름으로 둠 → 말풍선 대신 그림 오른쪽 위 이름표(이름 + 숫자 2개)가 뜸
//   랙 줄은 넓게 보는 장면이라 조준 링을 끔 (aim: false)
const SCALE_STOPS = [
  { key: "scale-rack", phase: "rack", p: [RACK0 + RACKS * RACK_W, RACK_Y + RACK_D / 2, HALL.floor + RACK_H / 2], z: 6.5 },
  { key: "scale-hall", phase: "hall", p: [RACK0 + (RACKS / 2) * RACK_W, -24, 12], z: 1.7, aim: false },
];
const STOPS = [...PART_STOPS, ...PHASE_STOPS, ...SCALE_STOPS].map((s) => { const [x, y] = at(s.p); return { key: s.key, fx: +(x / WIDTH).toFixed(4), fy: +(y / HEIGHT).toFixed(4), z: s.z, ...(s.side ? { side: s.side } : {}), ...(s.aim === false ? { aim: false } : {}) }; });
const PHASE_STOP = Object.fromEntries([...PHASE_STOPS, ...SCALE_STOPS].map((s, i) => [s.phase, PART_STOPS.length + i]));
const PLAN = tourPlan(PART_STOPS.length);
// 더운 공기가 올라가는 자리 (팬 위): 건식 냉각기는 늘, 칠러는 돌 때만
const PUFFS = {
  dc: DC_FANS.map((cx) => at([cx, DC.y + DC.d / 2, SLAB + 7 + 10 + 1.2 + 1.6]).map(r1)),
  ch: CH_FANS.map((cx) => at([cx, CH.y + CH.d / 2, SLAB + 21 + 1.4]).map(r1)),
};

// ---------- 글 (한/영) ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
// 규모 사다리 이름표의 숫자 (model.mjs: 회사 자료 + 사이트의 NVL72 추정 규칙)
const LADDER = Object.fromEntries(scaleLadder().map((s) => [s.id, s]));
const PCT = Math.round((HORIZON.grossMw / CAMPUS.mw) * 100);   // Horizon 1 전체 75 MW ÷ 캠퍼스 750 MW
const L_RACK = fmt(FLOW.rack), L_HALL = fmt(Math.round(FLOW.hall / 1000) * 1000);
const INFO = {
  base: ["모형 받침 · 앞 모서리 자: 작은 눈금 1 m, 큰 눈금 5 m (실제 비율)", "Model base · edge ruler: 1 m ticks, 5 m majors (true scale)"],
  pad: ["마당 콘크리트 패드", "Yard concrete pad"],
  mv: ["중압 인입 · 차일드레스 1차 변전소 6번에서 땅속 관으로 (회사 배치도: Horizon 1 = 변전소 6) · 그 변전소에 Horizon 1 용 중압 변압기 2대 (회사 영상)", "Medium-voltage feed · underground from Childress Primary Substation 6 (company site plan: Horizon 1 = substation 6), where two MV transformers serve Horizon 1 (company video)"],
  xfmr: ["홀 변압기 A·B · 중압을 저압으로 낮춤 · 두 갈래(A·B)라 하나를 정비해도 전기는 계속 (모양은 그림 표현)", "Hall transformers A and B · step medium voltage down · two paths, so one can be serviced while power continues (shape illustrative)"],
  "xfmr-hv": ["변압기 앞 단자함 · 중압 케이블이 도랑에서 올라와 들어옴", "Transformer front compartment · the MV cables rise into it from the trench"],
  ground: ["접지봉", "Ground rod"],
  ladder: ["저압 케이블 · 변압기 위로 나와 래더를 타고 벽 관통 상자로", "Low-voltage cables · leave the transformer top and ride a ladder to the wall entry box"],
  "lv-in": ["벽 관통 · 저압 케이블이 홀 안으로 들어가 배전반 A·B 위로", "Wall entry · the low-voltage cables pass into the hall and over switchboards A and B"],
  "sb-a": ["배전반 A · 전원 A 길 (변압기 A → 배전반 A → UPS A → 버스웨이 A) · 회사 영상 속 통로 벽의 회색 전기반", "Switchboard A · power path A (transformer A → switchboard A → UPS A → busway A) · like the grey electrical lineup in the company video"],
  "sb-b": ["배전반 B · 전원 B 길 (변압기 B → 배전반 B → UPS B → 버스웨이 B) · 발전기 관도 땅속으로 배전반에 이어짐", "Switchboard B · power path B (transformer B → switchboard B → UPS B → busway B) · the generator conduits also arrive here underground"],
  "sb-meter": ["계량기 창 · 전력 사용량", "Meter window · power use"],
  ups: ["UPS A·B · 정전 순간부터 발전기가 설 때까지(10~15초) 배터리로 끊김 없이 전원을 이어 줌 · 함 오른쪽 절반이 배터리 칸 (회사: UPS 백업)", "UPS A and B · bridge the 10–15 s from the instant of an outage until the generator is up, with no break · battery section on the right of each cabinet (company: UPS back-up)"],
  battery: ["배터리 칸 · UPS의 에너지 저장 (그림에서는 UPS와 한 함)", "Battery section · the UPS energy store (drawn in the same cabinet as the UPS)"],
  busway: ["버스웨이 A·B · 랙 위를 지나는 두 갈래 전원 · 랙마다 양쪽에서 받아, 한쪽 길을 통째로 정비해도 GPU는 계속 (Tier III 수준 동시 유지보수, 모양은 예시)", "Busways A and B · two power runs over the racks · every rack takes both, so one whole path can be serviced while the GPUs run on (Tier III-equivalent concurrent maintainability; shape illustrative)"],
  tapoff: ["탭오프 A·B · 버스웨이마다 랙으로 전원을 내림 → 랙 위 인입구 2개", "Tap-offs A and B · each busway drops a feed into the rack → two top entries per rack"],
  gen: ["디젤 발전기 · 배전반 A·B로 들어오는 예비 전원 (땅속 관) · 정전 순간은 UPS 배터리가 메우고 10~15초 안에 기동해 이어받음 (회사: 디젤 발전기 백업 · Horizon 3 발전기는 가동 전 대기 배출 허가 대상 — 2026 금융 계약서)", "Diesel generator · the standby source into switchboards A and B (underground conduits) · the UPS batteries cover the first seconds, the generator starts and takes over within 10–15 s (company: diesel back-up; Horizon 3's generators need an air permit before operating — 2026 financing agreement)"],
  tank: ["기초 연료 탱크 · 발전기 밑에 디젤을 담음", "Sub-base fuel tank · diesel under the generator"],
  "gen-conduits": ["발전기 → 배전반 관 · 도랑을 잘라 보여 줌 (평소엔 대기)", "Generator → switchboard conduits · trench cut open (on standby normally)"],
  rack: [`GB300 NVL72 랙 (뒷면) · GPU ${HORIZON.gpusPerRack} + CPU ${HORIZON.cpusPerRack}이 한 NVLink 도메인 · 1대 약 ${EST.rackKw} kW (가정) — 회사 설계 범위 ${HORIZON.rackKw[0]}~${HORIZON.rackKw[1]} kW · Horizon 1칸 ≈ 랙 ${EST.racks}대 · GPU ${fmt(EST.gpus)}개 (추정) · 그림은 한 줄 일부`, `GB300 NVL72 rack (rear) · ${HORIZON.gpusPerRack} GPUs + ${HORIZON.cpusPerRack} CPUs in one NVLink domain · about ${EST.rackKw} kW each (assumption) — company design range ${HORIZON.rackKw[0]}–${HORIZON.rackKw[1]} kW · one Horizon ≈ ${EST.racks} racks · ${fmt(EST.gpus)} GPUs (estimate) · drawing shows part of one row`],
  manifold: [`랙 매니폴드 · 파랑 = 찬물 공급, 빨강 = 데워진 물 회수 · 트레이마다 퀵 커넥터 2개 (빼도 물이 새지 않음) · 랙 1대에 1분 약 ${L_RACK} L (물이 ${WATER.dT} °C 데워진다고 가정)`, `Rack manifolds · blue = cool supply, red = warm return · two quick disconnects per tray (dripless) · about ${L_RACK} L a minute per rack (assuming a ${WATER.dT} °C rise)`],
  busbar: ["직류 버스바 · 위·아래 전원 선반이 교류를 약 50 V 직류로 바꿔 이 구리 막대로 → 트레이마다 꽂혀 전원을 받음", "DC busbar · the power shelves turn AC into about 50 V DC on this copper bar; every tray plugs into it"],
  "rack-psu": ["전원 선반 · 랙 위·아래, 교류를 받아 직류로 바꿈", "Power shelves · top and bottom of the rack, AC in, DC out"],
  "rack-post": ["랙 위 받침대 · 배관·버스웨이를 받침 (모양은 예시)", "Rack-top supports · carry the pipes and busway (illustrative)"],
  fibre: ["광케이블 트레이 (노랑) · 랙 앞면의 네트워크로 (회사 영상의 노란 광케이블)", "Fibre tray (yellow) · to the network at the rack fronts (the yellow fibre in the company video)"],
  hose: ["랙 호스 · 천장 배관에서 내려와 매니폴드에 꽂힘", "Rack hoses · drop from the overhead pipes into the manifolds"],
  "open-rack": [`옆판을 뗀 랙 · 트레이 ${HORIZON.computeTrays + HORIZON.switchTrays}장 (컴퓨트 ${HORIZON.computeTrays} · NVLink 스위치 ${HORIZON.switchTrays}) + 위·아래 전원 선반`, `Rack with its side off · ${HORIZON.computeTrays + HORIZON.switchTrays} trays (${HORIZON.computeTrays} compute · ${HORIZON.switchTrays} NVLink switch) + power shelves top and bottom`],
  "open-tray": ["컴퓨트 트레이 · GPU 4 + CPU 2, 냉각판에 물이 지남", "Compute tray · 4 GPUs + 2 CPUs under cold plates"],
  "open-switch": ["NVLink 스위치 트레이 · 랙의 GPU 72개를 하나로 묶음 (랙 가운데)", "NVLink switch tray · ties all 72 GPUs into one domain (middle of the rack)"],
  tcs: ["2차 냉각수 배관 (랙 쪽 고리) · 깨끗한 물이 CDU ↔ 랙만 돎 · 파랑 = 공급, 빨강 = 회수 (색은 설명용)", "Rack-side loop (secondary) · clean coolant circulates only between CDUs and racks · blue = supply, red = return (colours for explanation)"],
  "tcs-vent": ["공기 빼기 밸브 · 배관 가장 높은 곳에서 공기를 빼 줌", "Air vent · bleeds air at the high point"],
  "tcs-riser": ["CDU 위 관 · 천장 배관과 이어짐 (밸브로 떼어 낼 수 있음)", "CDU top pipes · tie into the overhead loop (valves let it be isolated)"],
  "cdu-a": ["CDU A (가동) · 냉각수 분배기", "CDU A (running) · coolant distribution unit"],
  "cdu-b": ["CDU B (앞판을 뗌) · 판형 열교환기가 랙 쪽 물의 열을 시설 물로 넘김 — 두 물은 섞이지 않음 · 펌프가 랙 쪽 물을 돌림", "CDU B (front removed) · a plate heat exchanger hands the rack loop's heat to the facility water — the two never mix · pumps drive the rack loop"],
  "cdu-c": ["CDU C (대기) · 하나가 빠져도 되게 한 대 더 (N+1, 대수는 그림 표현)", "CDU C (standby) · one extra so any one can be out (N+1; count illustrative)"],
  "cdu-hx": ["판형 열교환기 · 얇은 판 사이로 두 물이 번갈아 흘러 열만 건넴", "Plate heat exchanger · the two waters flow in alternate gaps and swap only heat"],
  "cdu-pump": ["순환 펌프 · 랙 쪽 물을 돌림 (2대 중 1대 예비)", "Circulation pumps · drive the rack loop (one of two is spare)"],
  "cdu-valve": ["격리 밸브 · 닫으면 이 CDU만 배관에서 떼어 낼 수 있음 — 회사가 말한 'Tier III 수준 동시 유지보수'", "Isolation valve · close them to take just this CDU out of the loop — the 'Tier III-equivalent concurrent maintainability' the company describes"],
  "cdu-tag": ["정비 표지 · 밸브를 잠가 둔 표시", "Lock-out tag · the valve is locked shut"],
  "yard-sup": ["1차 공급 배관 (찬물) · 냉각 설비에서 CDU로 · 보온재 위 알루미늄 덮개 (회사 영상의 굵은 은색 관)", "Facility supply (cool) · plant to CDUs · aluminium-jacketed insulation (the big silver pipes in the company video)"],
  "yard-ret": ["1차 회수 배관 (데워진 물) · CDU에서 건식 냉각기로", "Facility return (warm) · CDUs to the dry cooler"],
  "yard-dc2ch": ["건식 냉각기 → 칠러 · 바깥 공기로 식힌 물이 칠러를 지남 (칠러가 꺼져 있으면 그냥 지나감)", "Dry cooler → chiller · the air-cooled water passes through the chiller (straight through when it is off)"],
  branch: [`가지관·밸브 · CDU마다 1차 공급·회수 · 벽을 지나 CDU로 (벽은 허물어 보여 줌) · Horizon 1칸 전체 물 약 ${L_HALL} L/분 (가정 기준)`, `Branches and valves · each CDU's facility supply and return, through the wall (cut away) · about ${L_HALL} L/min for a whole Horizon (on the same assumption)`],
  drycooler: ["건식 냉각기 · 핀 코일에 물을 흘리고 팬으로 바깥 공기를 불어 식힘 · 물을 증발시키지 않음 · 바깥 기온보다 조금 높은 온도까지만 식힘 (회사: 건식 냉각기)", "Dry cooler · water runs through finned coils while fans blow outside air across · evaporates no water · can only cool to a little above the outdoor temperature (company: dry coolers)"],
  "dc-fan": ["냉각기 팬 · 코일을 지나며 데워진 공기를 위로 내보냄", "Cooler fans · push the warmed air up and out"],
  chiller: ["칠러 패키지 · 압축기로 물을 바깥 기온보다 더 차갑게 · 더운 날에만 보탬 → 이때 냉각 전력이 늘어남 · 오른쪽 끝은 펌프 칸 (회사: 패키지 칠러 플랜트)", "Packaged chiller · compressors cool the water below the outdoor temperature · only helps on hot days, when cooling power rises · pump bay at the right end (company: packaged chiller plant)"],
  "ch-comp": ["압축기 칸 · 냉매를 압축해 열을 퍼 올림", "Compressor bay · compresses refrigerant to pump heat out"],
  "ch-panel": ["칠러 제어반 · 초록 등 = 칠러 가동", "Chiller controls · green lamp = chiller running"],
  "ch-fan": ["응축기 팬 · 칠러가 퍼 올린 열을 버림", "Condenser fans · reject the heat the chiller pumps out"],
  pumps: ["1차 냉각수 펌프 2대 (1대 예비) · 식힌 물을 벽 쪽 공급 배관으로 다시 CDU에 보냄 → 냉각수 고리가 닫힘 · 초록 등 = 가동", "Facility water pumps (one spare) · send the cooled water back along the supply main to the CDUs, closing the loop · green lamp = running"],
  thermo: [`바깥 기온 (예시) · 빨간 띠 = 35 °C 이상 · 차일드레스 여름 오후는 ${TEMP.hot} °C 안팎`, `Outdoor temperature (example) · red band = 35 °C and up · Childress summer afternoons reach about ${TEMP.hot} °C`],
  cart: ["정비 카트", "Service cart"],
  tray: ["꺼낸 컴퓨트 트레이 (덮개를 엶) · GPU 4 + CPU 2 위에 구리 냉각판, 구리관으로 이어져 물이 칩 바로 위를 지나며 열을 가져감 (회사 영상의 냉각판)", "Compute tray pulled for service (lid off) · copper cold plates over 4 GPUs + 2 CPUs, linked by copper tube so water carries the heat straight off the chips (the cold plates in the company video)"],
  qd: ["퀵 커넥터 (파랑 = 들어옴, 빨강 = 나감) · 랙에 밀어 넣으면 매니폴드에 꽂힘", "Quick disconnects (blue in, red out) · mate with the manifold when the tray slides in"],
  coldplate: ["냉각판 · 칩에 붙은 구리판 속 미세 유로로 물이 지남 (직접 칩 냉각) · 검정 고정쇠가 판을 칩에 눌러 붙임", "Cold plate · water runs through micro-channels in copper pressed onto the chip (direct-to-chip) · the black bracket clamps it down"],
  wall: ["홀 벽 · 허물어 안을 보여 줌 (빗금 = 잘린 면)", "Hall wall · broken away to show inside (hatching = cut)"],
  "wall-stub": ["CDU 앞 벽 · 거의 바닥까지 허물어 관이 벽을 지나는 모습을 보여 줌", "Wall at the CDUs · cut almost to the floor to show the pipes passing through"],
  "hall-floor": ["홀 바닥 · 노란 선 = 랙 뒤 통로", "Hall floor · the yellow line marks the rear service aisle"],
  bollard: ["보호 기둥", "Bollard"],
};
const PHASE_TEXT = {
  normal: [`평소 · 건식 냉각기만으로 냉각 · 랙 1대 열 약 ${EST.rackKw} kW → 냉각수 1분 약 ${L_RACK} L (${WATER.dT} °C 데워진다고 가정)`, `Normal · dry coolers alone · each rack's ~${EST.rackKw} kW of heat → about ${L_RACK} L of water a minute (assuming a ${WATER.dT} °C rise)`],
  warm: ["기온이 오름 · 바깥 공기가 더워지면 건식 냉각기만으로는 물이 덜 식음", "Heating up · as the outside air warms, the dry coolers alone can't cool the water as far"],
  chill: [`더운 오후 · 칠러가 보태 공급 물 온도를 지킴 → 냉각 전력이 늘어남 (전체 ${HORIZON.grossMw} MW 중 IT ${HORIZON.itMw} MW, 나머지 ${OVERHEAD_MW} MW가 냉각·손실·여유 몫)`, `Hot afternoon · the chiller tops up to hold the supply temperature, so cooling power rises (of ${HORIZON.grossMw} MW gross, ${HORIZON.itMw} MW is IT; the other ${OVERHEAD_MW} MW covers cooling, losses and margin)`],
  evening: ["저녁 · 기온이 내려가 칠러를 멈추고 다시 건식 냉각기만", "Evening · the air cools, the chiller stops, dry coolers carry on alone"],
  standby: ["정비 준비 · 대기 CDU C를 켬", "Before maintenance · standby CDU C starts"],
  isolate: ["CDU B 떼어 내기 · 위·앞 밸브 4개를 닫음", "Isolating CDU B · its four valves close"],
  maint: ["CDU B 정비 중에도 GPU 냉각은 그대로 · A·C가 담당 (회사: Tier III 수준 동시 유지보수 설계)", "GPUs stay cooled while CDU B is serviced · A and C carry the load (company: Tier III-equivalent concurrent maintainability)"],
  restore: ["CDU B 복귀 · 밸브를 열고 C는 다시 대기", "CDU B back · valves open, C returns to standby"],
  rack: [`규모 ① 랙 1대 · GB300 NVL72 = GPU ${HORIZON.gpusPerRack}개 (NVIDIA) · 랙 밀도 ${HORIZON.rackKw.join("–")} kW (회사 설계 범위) · 이 그림은 1대 약 ${EST.rackKw} kW로 가정`,
    `Scale ① one rack · GB300 NVL72 = ${HORIZON.gpusPerRack} GPUs (NVIDIA) · ${HORIZON.rackKw.join("–")} kW per rack (company design range) · this drawing assumes about ${EST.rackKw} kW`],
  hall: [`규모 ② Horizon 1 · IT ${HORIZON.itMw} MW (회사) ÷ GPU 1개당 약 ${EST.kwPerGpu.toFixed(1)} kW (추정) ≈ GPU ${fmt(LADDER.hall.nums[1].value)}개 · 랙 약 ${fmt(LADDER.hall.racks)}대 · 그림의 홀은 그중 한 토막`,
    `Scale ② Horizon 1 · ${HORIZON.itMw} MW of IT (company) ÷ about ${EST.kwPerGpu.toFixed(1)} kW per GPU (estimate) ≈ ${fmt(LADDER.hall.nums[1].value)} GPUs in about ${fmt(LADDER.hall.racks)} racks · the hall drawn here is one slice`],
  site: [`규모 ③ 차일드레스 캠퍼스 · 전력 ${fmt(CAMPUS.mw)} MW · 부지 ${fmt(CAMPUS.acres)} 에이커 (회사) · Horizon 1 전체 ${HORIZON.grossMw} MW는 그중 ${PCT}% · Horizon 1–${MSFT.halls} = IT ${MSFT.halls * HORIZON.itMw} MW · Microsoft ${MSFT.years}년 $${MSFT.usdBn}bn 계약`,
    `Scale ③ Childress campus · ${fmt(CAMPUS.mw)} MW of power · ${fmt(CAMPUS.acres)} acres (company) · Horizon 1's ${HORIZON.grossMw} MW gross is ${PCT}% of it · Horizon 1–${MSFT.halls} = ${MSFT.halls * HORIZON.itMw} MW of IT · Microsoft ${MSFT.years}-year $${MSFT.usdBn}bn contract`],
};
for (const [phase, text] of Object.entries(PHASE_TEXT)) INFO[`ph-${phase}`] = text;
const ICON_IN = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const ICON_OUT = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const zoomText = (ko) => ({
  in: ICON_IN + `<span>${ko ? "확대" : "Zoom"}</span>`, out: ICON_OUT + `<span>${ko ? "전체 보기" : "Full view"}</span>`,
  aria: ko ? ["Horizon 액체냉각 홀 그림: 전기가 들어오는 길과 냉각수가 도는 길을 저절로 확대해 하나씩 짚고 더운 오후에 칠러가 보태는 모습과 CDU 하나를 정비해도 냉각이 이어지는 모습을 보여 준 뒤 랙 1대에서 Horizon 1, 차일드레스 캠퍼스 전체로 넓혀 가며 규모를 보여 줍니다. + 키나 확대 단추로 직접 확대할 수 있습니다", "확대: 포인터나 화살표 키로 둘러보고 Esc로 전체 보기"]
    : ["Horizon liquid-cooled hall: an automatic tour zooms along the power path and the coolant loops, then shows the chiller helping on a hot afternoon and a CDU being serviced while cooling carries on, then widens from one rack to Horizon 1 and the whole Childress campus to show the scale. Press + or the zoom button to zoom yourself", "Zoomed: look around with the pointer or arrow keys; Escape for the full view"],
  hint: ko ? "확대 중 · 부품을 가리키거나 탭하면 바로 옆에 설명이 뜹니다" : "zoomed · point at or tap a part to see what it is right beside it",
});

// ---------- 페이지 ----------
const ASPECT = (WIDTH / HEIGHT).toFixed(3);
const CSS = (readFileSync(join(HERE, "..", "power", "power.css"), "utf8") + readFileSync(join(HERE, "horizon.css"), "utf8")).replaceAll("__ASPECT__", ASPECT);
const LIVE = readFileSync(join(HERE, "..", "shared", "zoomer.js"), "utf8") + readFileSync(join(HERE, "live.js"), "utf8");
const DATA = { W: WIDTH, H: HEIGHT, zoom: 2.4, focus: at([120, -10, 18]).map(r1), stops: STOPS, parts: PART_STOPS.length, phaseStop: PHASE_STOP, plan: PLAN, puffs: PUFFS, needle: { min: NEEDLE[0], n: NEEDLE.length }, valves: VALVE_FRAMES, plates: Object.keys(LADDER) };
const fill = (src, values) => src.replace(/__([A-Z]+)__/g, (all, name) => (name in values ? values[name] : all));
const a = (href, text) => `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;

// ---------- 규모 이름표 (둘러보기 끝: 랙 1대 → Horizon 1 → 차일드레스 캠퍼스) ----------
// 이름 + 숫자 2개 카드 3장 (만드는 법·모양은 shared/tools.mjs 의 platesHtml · horizon.css 의 .rk-plate — 스위트워터 1 그림과 같음)
function plates(ko) {
  const i = ko ? 0 : 1, by = (num) => PLATE_BASIS[num.basis][i];
  const { rack, hall, site } = LADDER;
  return platesHtml([
    ["rack", ko ? "GB300 NVL72 랙 1대" : "One GB300 NVL72 rack", [
      [fmt(rack.nums[0].value), `GPU · ${by(rack.nums[0])}`],
      [`${rack.nums[1].range.join("–")} kW`, `${ko ? "랙 밀도" : "rack density"} · ${by(rack.nums[1])}`]]],
    ["hall", "Horizon 1", [
      [`${hall.nums[0].value} MW`, `${ko ? "IT 전력" : "IT power"} · ${by(hall.nums[0])}`],
      [`≈ ${fmt(hall.nums[1].value)}`, ko ? `GPU · 추정 (랙 ≈ ${fmt(hall.racks)}대)` : `GPUs · estimate (≈ ${fmt(hall.racks)} racks)`]]],
    ["site", ko ? "차일드레스 캠퍼스" : "Childress campus", [
      [`${fmt(site.nums[0].value)} MW`, `${ko ? "전력 용량" : "power capacity"} · ${by(site.nums[0])}`],
      [`${fmt(site.nums[1].value)} ${ko ? "에이커" : "acres"}`, `${ko ? "부지" : "site"} · ${by(site.nums[1])}`]]],
  ]);
}

function page(ko) {
  const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: ko ? "차일드레스 Horizon 액체냉각 홀 한 토막의 모형" : "Model of a slice of a Childress Horizon liquid-cooled hall", body: `<defs>${CLIPS.join("")}</defs>${BASE_SVG}${body}<g class="hz-puffs" aria-hidden="true"></g>`, className: "pw-svg" });
  const title = ko ? "Horizon 액체냉각 홀 · 차일드레스" : "Horizon liquid-cooled hall · Childress";
  const sub = ko ? `Horizon 1칸 = ${HORIZON.grossMw} MW (IT ${HORIZON.itMw} MW) · 랙 약 ${EST.racks}대 · GPU 약 ${fmt(EST.gpus)}개 (추정) · 그림은 홀 한 토막` : `one Horizon = ${HORIZON.grossMw} MW (${HORIZON.itMw} MW IT) · about ${EST.racks} racks · ${fmt(EST.gpus)} GPUs (estimate) · drawing shows a slice of one hall`;
  const zt = zoomText(ko);
  const keys = ko
    ? [["hz-k-cold", "찬물"], ["hz-k-warm", "데워진 물"], ["pw-k-flow", "전류"], ["hz-k-lever", "밸브 손잡이 (움직이는 부분)"], ["pw-k-cut", "잘라 보여 준 면"]]
    : [["hz-k-cold", "cool water"], ["hz-k-warm", "warm water"], ["pw-k-flow", "current"], ["hz-k-lever", "valve levers (the moving part)"], ["pw-k-cut", "cut-away faces"]];
  const caption = ko
    ? `IREN 발표 기준: Horizon 1 = ${HORIZON.grossMw} MW(IT ${HORIZON.itMw} MW)·랙 밀도 200 kW까지 설계(${a(SOURCES.design, "2025-02 월간 업데이트")}), 랙 ${HORIZON.rackKw[0]}~${HORIZON.rackKw[1]} kW·Tier III 수준 동시 유지보수(${a(SOURCES.tier, "2025-11 계약 발표 자료")}), 냉각 설비 = 패키지 칠러 플랜트·칠러·건식 냉각기·냉각수 분배기(CDU)와 UPS·디젤 발전기 백업(${a(SOURCES.plant, "2025-01 공시")}), Horizon 1은 1차 변전소 6에서 전력을 받고 2026-08-13 Microsoft에 인도(${a(SOURCES.delivered, "8-K")}). 홀 안·바깥 모습은 회사의 ${a(SOURCES.video, "Horizon 1 인도 영상")}(NVL72 랙 줄·노란 광케이블·구리 냉각판·통로의 회색 전기반·건물을 따라가는 굵은 보온 배관·핀 코일 냉각기)을 보고 그림. 배관 방식(냉각기 → 칠러 직렬)·CDU 자리와 대수·변압기 모양·온도는 설명을 위한 그림 표현이고 지붕·벽을 잘라 냈으며 랙은 한 줄 일부만 그림. GPU·랙 수와 유량은 사이트 가정(GPU 1개당 ${EST.kwPerGpu.toFixed(1)} kW, 랙당 ${HORIZON.gpusPerRack}개, 물이 ${WATER.dT} °C 데워짐)으로 계산한 추정. 둘러보기 끝 규모 이름표의 차일드레스 ${fmt(CAMPUS.mw)} MW·${fmt(CAMPUS.acres)} 에이커는 ${a(SOURCES.campus, "회사 사이트")}, Horizon 1~${MSFT.halls}의 Microsoft ${MSFT.years}년 $${MSFT.usdBn}bn 계약은 ${a(SOURCES.tier, "2025-11 계약 발표 자료")} 기준. 기온 변화·정비 장면의 시간은 압축해서 보여 줌.`
    : `Per IREN: Horizon 1 = ${HORIZON.grossMw} MW gross (${HORIZON.itMw} MW IT), designed for up to 200 kW racks (${a(SOURCES.design, "Feb 2025 monthly update")}); ${HORIZON.rackKw[0]}–${HORIZON.rackKw[1]} kW racks and Tier III-equivalent concurrent maintainability (${a(SOURCES.tier, "Nov 2025 contract presentation")}); a packaged chiller plant, chillers, dry coolers and coolant distribution units (CDUs) with UPS and diesel generator back-up (${a(SOURCES.plant, "Jan 2025 filing")}); Horizon 1 is fed from Primary Substation 6 and was delivered to Microsoft on 2026-08-13 (${a(SOURCES.delivered, "8-K")}). The hall and yard are drawn from the company's ${a(SOURCES.video, "Horizon 1 delivery video")} (NVL72 rack rows, yellow fibre, copper cold plates, grey electrical lineups along the aisle, big insulated pipes along the buildings, finned-coil coolers). The piping arrangement (cooler → chiller in series), CDU placement and count, transformer shape and temperatures are illustrative; roof and walls are cut away and only part of one rack row is shown. GPU and rack counts and flow rates are estimates from the site's assumptions (${EST.kwPerGpu.toFixed(1)} kW per GPU, ${HORIZON.gpusPerRack} per rack, a ${WATER.dT} °C water rise). In the scale cards at the end of the tour, the Childress ${fmt(CAMPUS.mw)} MW and ${fmt(CAMPUS.acres)} acres are from the ${a(SOURCES.campus, "company website")} and the ${MSFT.years}-year $${MSFT.usdBn}bn Microsoft contract for Horizon 1–${MSFT.halls} from the ${a(SOURCES.tier, "Nov 2025 contract presentation")}. Weather and maintenance timing are compressed.`;
  return `<!doctype html><html lang="${ko ? "ko" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${k.ISO_CSS}${CSS}</style></head>
<body class="iso pw-body" data-theme="light"><main class="pw-page">
<div class="rk-fig pw-fig">
  <div class="rk-head"><h2>${title} <small>${sub}</small></h2><button class="rk-zoom" type="button" data-zoom="hz" data-call aria-pressed="false">${zt.in}</button></div>
  <div class="rk-stage hz-stage" data-fig="horizon" tabindex="0" role="group" aria-label="${zt.aria[0]}">${svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')}<span class="rk-aim" aria-hidden="true"></span><div class="rk-tip"><b></b><span></span></div>${plates(ko)}</div>
  <div class="rk-read" data-readout="horizon">${PHASE_TEXT.normal[ko ? 0 : 1]}</div>
  <div class="pw-legend">${keys.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>
  <p class="pw-caption">${caption}</p>
</div></main>
<script>(function(){${fill(LIVE, { DATA: JSON.stringify(DATA), KO: ko ? "true" : "false", INFO: JSON.stringify(INFO), PHASE: JSON.stringify(PHASE_TEXT), ZOOM: JSON.stringify(zt), STATE: stateAt.toString() })}})();</script>
</body></html>`;
}
mkdirSync(join(ROOT, "public", "figures"), { recursive: true });
for (const ko of [true, false]) {
  const file = join(ROOT, "public", "figures", `horizon-hall.${ko ? "ko" : "en"}.html`);
  writeFileSync(file, page(ko));
  console.log(`wrote ${file.replace(ROOT + "/", "")} (${(readFileSync(file).length / 1024).toFixed(0)} KB) · ${R.items.length} items · ${WIDTH}×${HEIGHT}`);
}
// 검사 예외 (4배 확대로 직접 보고 판단한 것만):
//   cover: 밸브 손잡이 그림 5장 중 하나만 보이므로 기록 모양(열림 위치)보다 넓게 그려짐
//   allow: 엘보 공 속에서 만나는 두 토막 (겹치는 넓이 1.5 px² 이하)
//   crowd: 화면에서만 가까운 쌍 — 래더·트레이 안에서 나란한 케이블과 레일, 벽을 지나가는 관과 허문 벽(깊이로 7 이상),
//          옆 랙의 매니폴드 위로 보이는 호스 시작점(깊이 9), 멀리 뒤의 버스웨이 기둥, 바닥판(얇아서 막대로 취급),
//          도랑 벽에서 시작하는 중압 관과 그 벽을 이루는 가는 패드 조각, 열린 CDU B 안에서 서로 붙어 있는 관·열교환기 틀,
//          랙 위 인입구로 내려오는 탭오프 코드와 앞쪽 회수 배관(깊이 15), UPS 위에서 엇갈리는 입력·출력 케이블(깊이 11)
auditAll({ horizon: W }, { horizon: {
  cover: ["cdub.vS.lever", "cdub.vR.lever", "cdub.vFs.lever", "cdub.vFr.lever"],
  allow: [["yard.sup0*", "yard.sup1*"], ["yard.sup2*", "yard.sup1*"], ["yard.ret2*", "yard.ret3*"]],
  crowd: [["lv.a*", "lad.vrail*"], ["fib.bundle", "fib.rail*"], ["hoseS*", "manis*"], ["tcs.sup", "tcs.fall*"], ["lv.b*", "hall.floor"], ["tcs.fall*", "bus*"], ["tcs.rise*", "bus*"],
    ["branch.*", "wall.*"], ["yard.*", "wall.*"], ["yard.ret*", "dc.*"], ["yard.ret1", "yard.ret2"], ["yard.sup4", "yard.sup2"], ["yard.sup0", "ps.suction"], ["branch.rb", "cdub.hxend0"], ["mv.duct*", "pad.*"], ["cdub*", "cdub*"], ["cdub*", "hall.floor"], ["cord*", "tcs.ret"], ["ups.*", "ups.*"], ["ups.inA", "busa.*"]],
} });
