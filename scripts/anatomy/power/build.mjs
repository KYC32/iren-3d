// =============================================================
// build.mjs — "전력 경로" 그림: 매켄지 데이터홀 세그먼트 1칸 = 2.5 MW 전력 블록 (anatomy 스킬 방식)
// -------------------------------------------------------------
// "물건이 곧 설명": 현장 변전소 → 34.5 kV(땅속) → 강압 변압기 → 480 V → 케이블 래더 → ATS·배전반
//   ← 2.5 MW 디젤 발전기(콘듀잇 12개) · ATS → MER(전기실) · ATS → 벽 → 홀 배전반 → 트레이 → 랙 PDU(277 V) → 공랭 B300 서버
// 정전이 되면 ATS 의 전환 접점이 계통(N)에서 발전기(E)로 넘어가고, 복전되면 되돌아옴 (둘러보기가 저절로 보여 줌)
// 배치·숫자의 근거는 model.mjs (제3자 현장 분석 스레드 + 사이트의 GPU 가정)
//
// 사용법: node scripts/anatomy/power/build.mjs           (그림 만들기)
//         node scripts/anatomy/power/build.mjs --audit   (+ 관통·끝점·칠하는 순서 검사)
//   → public/figures/power-block.ko.html / power-block.en.html (캠퍼스 패널 대화상자가 iframe 으로 엶)
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
import { BLOCK, AMPS, PHASE_V, EST, SOURCE, SITE, tourPlan, stateAt } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- 세계 배치 ----------
// 홀 바깥벽: 바깥면 y = 0, 두께 3. x ≤ 122 는 온전한 높이(46), 그 오른쪽은 허물어(단면) 홀 안의 랙 줄이 보이게
const WALL_T = 3;
const WALL = { t: WALL_T, h: 46, x0: -17, x1: 240, cut: 122, step: 132, mid: 30, low: 12 };   // low = 허문 벽 아랫부분(흡기 루버가 남음)
const HALL = { back: -46, floor: 1.5 };                        // 홀 바닥 뒤 끝 y = −46 (건물을 잘라 낸 단면 모형), 바닥 높이
const BASE = { x: -30, y: -56, w: 280, d: 178, r: 3 };         // 받침판 (모형 판): x −30..250, y −56..122
const SLAB = 3;                                                 // 마당 콘크리트 패드 두께 (30 cm)

// 장비 자리 (평면 = 바닥 사각형 {x, y, w, d, r})
const XF = { x: 2, y: 3, w: 24, d: 16, r: 0.6 };                // 변압기 탱크 (벽 가까이)
const XF_FRONT = { x: 3, y: 19, w: 22, d: 7, r: 0.5 };          // 변압기 앞 단자함 (34.5 kV 가 아래에서 들어옴)
const ATS = { x: 62, y: 0.5, w: 56, d: 15, r: 0.4 };             // ATS·배전반 줄 (벽에 붙음)
const ATS_Z = SLAB + 1, ATS_H = 23;                              // 받침 채널 1 위에 키 2.3 m
const SECTIONS = [62, 74, 88, 104, 118];                         // 칸 경계: 계통 인입 | ATS(창) | 배전 | 피더
const GEN = { x: -8, y: 84, w: 124, d: 28, r: 0.8 };             // 발전기 (앞 왼쪽): 기초 연료 탱크 + 방음 외함
const GEN_TANK = 10, GEN_BOX = 31;
const MER = { x: 176, y: 76, w: 60, d: 30, r: 0.5 };             // 전기실 (앞 오른쪽 모서리: 도랑 창·홀 안을 가리지 않는 자리)
const MER_H = 30;
const TRENCH = { x: 100, y: 17, w: 26, d: 65, pit: -3.6 };       // 발전기 → ATS 콘듀잇 도랑 (위에서 들여다보는 창, 발전기 오른쪽 끝 너머로 보이는 자리)
const HV_TRENCH = { x: -27, y: 12, w: 26, d: 9, pit: -3.6 };     // 변전소 → 변압기 34.5 kV 인입 도랑 (왼쪽 끝벽에서 관이 나옴 = 변전소 쪽 땅속)
const RACK0 = 146, RACK_W = 6, RACKS = 14;                       // 홀 안 랙 줄 (x 146..230), 앞면(+y)이 찬 통로·보는 쪽 (회사 사진처럼)
const RACK_Y = -32, RACK_D = 11.7, RACK_H = 22;                  // 랙 뒤 y = −32 → 앞 y = −20.3, 깊이 약 1.2 m, 키 2.2 m
const RPP = { x: 133, y: -32, w: 11, d: 11, r: 0.3 };            // 홀 배전반 (랙 줄 왼쪽 끝, 랙과 한 줄)
const TRAY = { y: -37.6, w: 5, z: 28 };                          // 전원 트레이 (뜨거운 통로 위, 랙 뒤)
const NET = { y: -13, w: 4, z: 31 };                             // 통신 케이블 사다리 (찬 통로 위 — 회사 사진의 천장 사다리)
const FAN = { x: 140, y: -45, w: 100, d: 1, top: 33 };           // 배기 팬 벽 (뜨거운 통로 끝 — 프린스조지 사진)
const AISLE = { cold: [-20.3, -WALL_T], hot: [-44, -32] };       // 찬 통로·뜨거운 통로 (바닥 색으로 구분)

const WIDTH = 1000;
const EXTREMES = [...k.boxCorners(BASE, -13, 0), [WALL.x0, -WALL.t, WALL.h], [WALL.cut, -WALL.t, WALL.h], [WALL.x0, 0, WALL.h], [GEN.x + 104, GEN.y + 14, 60]];
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

const W = workshop(P, { piece: "pw" });
const { R } = W;

// ---------- 작은 도구들 ----------
// 앞면(+y, y = Y) 위의 선 / 오른쪽 면(+x, x = X) 위의 선
const onFront = (Y, pts) => pts.map(([x, z]) => [x, Y, z]);
const onRight = (X, pts) => pts.map(([y, z]) => [X, y, z]);
const pathOf3 = (pts) => `M${pts.map((p) => at(p).map(r1).join(" ")).join("L")}`;
// 닫힌 사각 슬롯들 (환기구·루버): 앞면 Y 에서 x0..x1, z 아래부터 n 줄
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
// 앞면의 세로 이음선 (아래 모서리 → 위 모서리, 끝이 두 모서리에 닿음)
const frontSeams = (Y, xs, z0, z1) => xs.map((x) => seg([x, Y, z0], [x, Y, z1])).join("");
const rightSeams = (X, ys, z0, z1) => ys.map((y) => seg([X, y, z0], [X, y, z1])).join("");
// 단면 빗금: 사각형(u 0..w, v 0..h)을 45° 빗금으로 → toW(u, v) 가 3D 점을 돌려줌
function hatch(w, h, step, toW) {
  const out = [];
  for (let c = -h + step / 2; c < w; c += step) {
    const u0 = Math.max(0, c), v0 = u0 - c, u1 = Math.min(w, c + h), v1 = u1 - c;
    if (u1 - u0 > 0.05) out.push(seg(toW(u0, v0), toW(u1, v1)));
  }
  return out.join("");
}
// 단면 판(잘린 면): 색 칠한 사각형 + 빗금 (윤곽선 안쪽에서 끝남)
const cutFace = (corners, hatchD) => `<g class="pw-cutface"><path class="pw-cutfill" d="${poly(corners)}"/>${L(hatchD, { tone: "lo" })}<path class="pw-cutedge" d="${poly(corners)}"/></g>`;

// 직사각형에서 구멍(직사각형들)을 뺀 나머지 → 겹치지 않는 직사각형들 (x 로 자른 띠마다 y 구간을 나눔)
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

// ---------- 0) 받침판·땅 ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -13, 13, P)}"/>`];
  for (const [x, y] of k.corners(BASE, 10)) out.push(`<g class="pw-base">${k.solidSvg(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, -13, 4, P, 3), { tone: "lo" })}</g>`);
  // 판 위 가장자리 둘레의 홈 + 앞 모서리 자 (1 m 마다 작은 눈금, 5 m 마다 큰 눈금: 실제 비율이라는 표시)
  const ticks = k.topTicks(BASE.x + 10, BASE.x + BASE.w - 10, 10, 5, BASE.y + BASE.d - 4, 0, [1.6, 3.2], P, "x");
  const inner = L(k.planOutline(k.insetPlan(BASE, 7), 0, P, 3), { tone: "faint" })
    + L(seg([BASE.x + 10, BASE.y + BASE.d - 4, 0], [BASE.x + BASE.w - 10, BASE.y + BASE.d - 4, 0]), { tone: "lo" })
    + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" });
  out.push(`<g class="pw-base">${k.solidSvg(k.slabOf(BASE, -9, 9, P, 4, 0.8), { tone: "lo", inner })}</g>`);
  // 판 앞면의 이름표 (나사 4개 + 글줄 3개)
  const plate = { x0: 108, x1: 134, z0: -7, z1: -2 }, Y = BASE.y + BASE.d;
  out.push(`<g class="pw-steel">${k.solidSvg(k.slabOf({ x: plate.x0, y: Y, w: plate.x1 - plate.x0, d: 0.4, r: 0.2 }, plate.z0, plate.z1 - plate.z0, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(L([0, 1, 2].map((i) => seg([plate.x0 + 4, Y + 0.4, plate.z1 - 1.2 - i * 1.2], [plate.x0 + (i === 0 ? 20 : 15 - i * 2), Y + 0.4, plate.z1 - 1.2 - i * 1.2])).join(""), { tone: "lo", free: true }));
  out.push(Dt([[plate.x0 + 1.6, plate.z0 + 1], [plate.x1 - 1.6, plate.z0 + 1], [plate.x0 + 1.6, plate.z1 - 1], [plate.x1 - 1.6, plate.z1 - 1]].map(([x, z]) => at([x, Y + 0.4, z])), { size: 0.45, tone: "mid" }));
  // 기록할 모양: 받침판에서 도랑 두 곳을 뺀 조각들 + 도랑 바닥 아래 (도랑 속이 받침판 "뒤"로 계산되지 않게)
  const holes = [HV_TRENCH, TRENCH].map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.d, pit: t.pit }));
  const shapes = minus({ x0: BASE.x, x1: BASE.x + BASE.w, y0: BASE.y, y1: BASE.y + BASE.d }, holes).map((r) => R.solid(A.box([r.x0, r.y0, -9], [r.x1, r.y1, 0], { name: "stand.base" })))
    .concat(holes.map((h) => R.solid(A.box([h.x0, h.y0, -9], [h.x1, h.y1, h.pit - 0.45], { name: "stand.base" }))));   // 도랑 바닥판(얇은 판) 아래는 조금 띄움
  // 받침판 그림에는 도랑 구멍이 없음 → 정렬 목록에 넣지 않고 맨 아래 층으로 먼저 칠함 (모양은 검사용으로만 기록)
  return `<g data-info="base">${out.join("")}</g>`;
}
const BASE_SVG = base();

// 마당 콘크리트 패드: 도랑 자리를 비워 네 조각으로 (도랑 = 위에서 들여다보는 창)
function pads() {
  const yard = { x: 30, y: 0, x1: 240, y1: 114 };   // 발전기·ATS·MER 를 받치는 패드
  const T = TRENCH;
  const parts = [
    { x: yard.x, y: yard.y, w: T.x - yard.x, d: yard.y1 - yard.y },                         // 도랑 왼쪽
    { x: T.x + T.w, y: yard.y, w: yard.x1 - T.x - T.w, d: yard.y1 - yard.y },                // 도랑 오른쪽
    { x: T.x, y: yard.y, w: T.w, d: T.y - yard.y },                                            // 도랑 뒤 (ATS 밑)
    { x: T.x, y: T.y + T.d, w: T.w, d: yard.y1 - T.y - T.d },                                  // 도랑 앞 (발전기 밑)
  ];
  parts.forEach((p, i) => {
    // 신축 이음 (패드 윗면 가장자리에서 가장자리까지)
    const joints = [];
    if (i === 1) for (const x of [196]) joints.push(seg([x, p.y, SLAB], [x, p.y + p.d, SLAB]));
    if (i === 0 || i === 1) joints.push(seg([p.x, 58, SLAB], [p.x + p.w, 58, SLAB]));
    W.box(`pad.${i}`, { ...p, r: 0.3 }, 0, SLAB, { cls: "pw-concrete", tone: "lo", steps: 2, inner: L(joints.join(""), { tone: "faint" }), info: "pad" });
  });
  // 변압기 패드 (따로 부은 받침)
  W.box("pad.xf", { x: 0, y: 0.5, w: 30, d: 30, r: 0.4 }, 0, SLAB, { cls: "pw-concrete", tone: "lo", steps: 2, info: "pad" });
  // 34.5 kV 도랑 양옆 받침판 윗면은 그대로 (도랑은 받침판 위에 판 창)
}
pads();

// ---------- 1) 도랑 창 (속을 잘라 보여 줌): 안쪽 벽 2면 + 바닥 + 콘듀잇, 모두 창 윤곽으로 자름 ----------
// 위에서 볼 때 보이는 안쪽 벽은 −x 쪽(면이 +x 를 봄)과 −y 쪽(면이 +y 를 봄). 나머지 두 벽은 앞을 가리는 쪽이라
// 창 윤곽(윗면 높이)으로 자르기만 하면 정확히 가려짐 (평행 투영이라 "창 안에 보이는가" = "윤곽 안에 들어오는가")
const CLIPS = [];
function trenchWindow(id, T, top, info) {
  const PIT = T.pit;
  const rim = [[T.x, T.y, top], [T.x + T.w, T.y, top], [T.x + T.w, T.y + T.d, top], [T.x, T.y + T.d, top]];
  CLIPS.push(`<clipPath id="${id}"><path d="${poly(rim)}"/></clipPath>`);
  const clip = (svg) => `<g clip-path="url(#${id})">${svg}</g>`;
  // 바닥(흙) · 안쪽 벽 두 면(콘크리트/흙 단면)
  const floor = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y + T.d, PIT], [T.x, T.y + T.d, PIT]];
  const westWall = [[T.x, T.y, PIT], [T.x, T.y + T.d, PIT], [T.x, T.y + T.d, top], [T.x, T.y, top]];
  const northWall = [[T.x, T.y, PIT], [T.x + T.w, T.y, PIT], [T.x + T.w, T.y, top], [T.x, T.y, top]];
  // 패드 두께만큼은 콘크리트 단면(빗금), 그 아래는 흙
  const layers = top > 0.5 ? L(seg([T.x, T.y, 0], [T.x, T.y + T.d, 0]) + seg([T.x, T.y, 0], [T.x + T.w, T.y, 0]), { tone: "lo" })
    + L(hatch(T.d, top, 1.6, (u, v) => [T.x, T.y + u, v]) + hatch(T.w, top, 1.6, (u, v) => [T.x + u, T.y, v]), { tone: "faint" }) : "";
  const svg = `<g class="pw-soil"><path class="pw-soilfloor" d="${poly(floor)}"/><path class="pw-soilwall" d="${poly(westWall)}"/><path class="pw-soilwall2" d="${poly(northWall)}"/>${layers}${L(seg([T.x, T.y, PIT], [T.x, T.y + T.d, PIT]) + seg([T.x, T.y, PIT], [T.x + T.w, T.y, PIT]), { tone: "mid" })}</g>`;
  // 기록: 그린 것(바닥·보이는 안쪽 벽 두 면)을 얇은 판으로. 앞을 가리는 두 벽은 받침판·패드 조각이 맡음
  const shapes = [
    R.solid(A.box([T.x, T.y, PIT - 0.05], [T.x + T.w, T.y + T.d, PIT], { name: `stand.${id}.floor` })),
    R.solid(A.box([T.x - 0.05, T.y, PIT], [T.x, T.y + T.d, top], { name: `stand.${id}.west` })),
    R.solid(A.box([T.x, T.y - 0.05, PIT], [T.x + T.w, T.y, top], { name: `stand.${id}.north` })),
  ];
  W.put(`${id}.pit`, [T.x + T.w / 2, T.y + T.d / 2, PIT - 3], clip(svg), shapes, { info, bias: -20 });
  return clip;
}

// ---------- 2) 케이블·관 (흐름 점선 포함) ----------
// 흐름: 전류가 흐르는 동안 주황 점선이 경로를 따라 움직임 (조각마다 그 조각의 시작 위치로 무늬를 이어 붙여 끊김 없음)
//   flow = "hv" | "lv" | "gen" | "load" (움직임 코드가 상태에 따라 켬)
const DASH = 6;   // 점선 한 주기 (화면 단위)
function cable(name, points, r, { cls = "pw-black", tone = "mid", flow, bend, maxLength = 14, gaps = [], caps = true, bias = 0.02, owner, bundle, info, clip, fillet = true, touch } = {}) {
  const route = fillet ? G.fillet(points, Math.max(bend ?? r * 2.6, r * 2.6), 10, { P, tube: r }) : points;
  R.route(name, route, r, { gaps, owner: owner ?? name, bundle, touch, piece: "pw" });
  // 점 간격: 굽은 길은 촘촘히(곡선이 매끄럽게), 곧은 길은 성기게 (모양은 같고 파일만 작아짐)
  const spacing = fillet ? Math.max(0.5, Math.min(1.6, r)) : Math.max(4, r * 6);
  const pieces = tubePieces(route, r, P, { maxLength, spacing, gaps, caps });
  // 흐름 무늬: 경로를 같은 간격으로 다시 나눈 점들(dense)의 화면 길이 누적
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
      if (pts.length > 1) svg += `<path class="pw-flow" data-flow="${flow}" style="--d0:${r1(screenAt(chunk.from))}px" d="M${pts.map((p) => p.map(r1).join(" ")).join("L")}"/>`;
    }
    if (clip) svg = clip(svg);
    W.put(`${name}:${index}`, chunk.mid, svg, [A.tube(chunk.points, chunk.radii, { name, owner: owner ?? name, bundle, touch })], { bias, info, route: name, chunk: index });
  });
  return route;
}

// ---------- 3) 34.5 kV 인입 (받침판 왼쪽 끝 = 현장 변전소 쪽에서 땅속으로) ----------
{
  const T = HV_TRENCH;
  const clip = trenchWindow("pw-hv", T, 0, "hv");
  // 단심 케이블 3가닥이 각자 PVC 관 안에 (관만 보임). 관은 도랑 바닥 받침 위에
  [0, 1, 2].forEach((i) => {
    const y = T.y + 2.4 + i * 2.1, z = T.pit + 0.62;
    cable(`hv.duct${i}`, [[T.x, y, z], [T.x + T.w, y, z]], 0.6, { cls: "pw-pvc", tone: "mid", flow: "hv", maxLength: 60, caps: true, bundle: "hv", info: "hv", clip, fillet: false, touch: ["stand.pw-hv.floor"] });
  });
}

// ---------- 4) 홀 (바닥·벽·허문 단면) ----------
function hall() {
  // 홀 바닥 (오른쪽 끝 x = 240 은 단면)
  const floorPlan = { x: WALL.x0, y: HALL.back, w: WALL.x1 - WALL.x0, d: -WALL.t - HALL.back, r: 0.01 };
  const tiles = [];
  for (let x = 130; x < WALL.x1; x += 12) tiles.push(seg([x, HALL.back, HALL.floor], [x, -WALL.t, HALL.floor]));
  for (const y of [-12, -38]) tiles.push(seg([WALL.x0, y, HALL.floor], [WALL.x1, y, HALL.floor]));   // 바닥 안쪽에서만 (바닥 뒤 끝 y = −44)
  // 설명을 위해 바닥을 칠함: 찬 통로(서버 앞) = 옅은 파랑, 뜨거운 통로(서버 뒤) = 옅은 주황
  const inlay = (cls, x0, x1, [y0, y1]) => `<path class="${cls}" d="${poly([[x0, y0, HALL.floor], [x1, y0, HALL.floor], [x1, y1, HALL.floor], [x0, y1, HALL.floor]])}"/>`;
  W.box("hall.floor", floorPlan, 0, HALL.floor, { cls: "pw-floor", tone: "lo", steps: 1, info: "hall-floor", bias: -50,
    inner: inlay("pw-coldfloor", WALL.cut, WALL.x1, AISLE.cold) + inlay("pw-hotfloor", FAN.x, WALL.x1, AISLE.hot) + L(tiles.join(""), { tone: "faint" }),
    extra: cutFace([[WALL.x1, HALL.back, 0], [WALL.x1, -WALL.t, 0], [WALL.x1, -WALL.t, HALL.floor], [WALL.x1, HALL.back, HALL.floor]], hatch(-WALL.t - HALL.back, HALL.floor, 2.2, (u, v) => [WALL.x1, HALL.back + u, v])) });
}
hall();

// 바깥벽 (온전한 부분 + 허문 두 계단). 바깥면은 단열 금속 패널(세로 골)
function outerWall() {
  const Y = 0, t = WALL.t;
  const ribsIn = (x0, x1) => { const xs = []; for (let x = Math.ceil((x0 + 0.1) / 5) * 5; x < x1 - 0.1; x += 5) xs.push(x); return xs; };
  // 온전한 벽: 문 하나, 벽등 둘
  W.box("wall.full", { x: WALL.x0, y: -t, w: WALL.cut - WALL.x0, d: t, r: 0.01 }, 0, WALL.h, { cls: "pw-panel", tone: "lo", steps: 1, info: "wall",
    inner: L(frontSeams(Y, ribsIn(WALL.x0, WALL.cut), 0, WALL.h), { tone: "faint" }),
    extra: cutFace([[WALL.x0, -t, WALL.h], [WALL.cut, -t, WALL.h], [WALL.cut, 0, WALL.h], [WALL.x0, 0, WALL.h]], hatch(WALL.cut - WALL.x0, t, 2.2, (u, v) => [WALL.x0 + u, -t + v, WALL.h]))
      + cutFace([[WALL.cut, -t, WALL.mid], [WALL.cut, 0, WALL.mid], [WALL.cut, 0, WALL.h], [WALL.cut, -t, WALL.h]], hatch(t, WALL.h - WALL.mid, 2.2, (u, v) => [WALL.cut, -t + u, WALL.mid + v])) });
  W.box("wall.mid", { x: WALL.cut, y: -t, w: WALL.step - WALL.cut, d: t, r: 0.01 }, 0, WALL.mid, { cls: "pw-panel", tone: "lo", steps: 1, info: "wall",
    inner: L(frontSeams(Y, ribsIn(WALL.cut, WALL.step), 0, WALL.mid), { tone: "faint" }),
    extra: cutFace([[WALL.cut, -t, WALL.mid], [WALL.step, -t, WALL.mid], [WALL.step, 0, WALL.mid], [WALL.cut, 0, WALL.mid]], hatch(WALL.step - WALL.cut, t, 2.2, (u, v) => [WALL.cut + u, -t + v, WALL.mid]))
      + cutFace([[WALL.step, -t, WALL.low], [WALL.step, 0, WALL.low], [WALL.step, 0, WALL.mid], [WALL.step, -t, WALL.mid]], hatch(t, WALL.mid - WALL.low, 2.2, (u, v) => [WALL.step, -t + u, WALL.low + v])) });
  // 허문 벽 아랫부분 = 흡기 루버 줄 (10 단위마다 루버 판 하나: 틀 + 가로 슬롯 5줄)
  const louvers = [];
  for (let x = WALL.step + 4; x + 8 <= WALL.x1 - 2; x += 10) {
    louvers.push(pathOf3(onFront(Y, [[x, 1.6], [x + 8, 1.6], [x + 8, 10.6], [x, 10.6], [x, 1.6]])));
    louvers.push(frontSlots(Y, x + 0.7, x + 7.3, 2.5, 5, 1.6, 0.7));
  }
  W.box("wall.low", { x: WALL.step, y: -t, w: WALL.x1 - WALL.step, d: t, r: 0.01 }, 0, WALL.low, { cls: "pw-panel", tone: "lo", steps: 1, info: "intake",
    inner: L(louvers.join(""), { tone: "lo" }),
    extra: cutFace([[WALL.step, -t, WALL.low], [WALL.x1, -t, WALL.low], [WALL.x1, 0, WALL.low], [WALL.step, 0, WALL.low]], hatch(WALL.x1 - WALL.step, t, 2.2, (u, v) => [WALL.step + u, -t + v, WALL.low]))
      + cutFace([[WALL.x1, -t, 0], [WALL.x1, 0, 0], [WALL.x1, 0, WALL.low], [WALL.x1, -t, WALL.low]], hatch(t, WALL.low, 2.2, (u, v) => [WALL.x1, -t + u, v])) });
  // 사람 문 (변압기와 ATS 사이): 문틀 + 문짝 + 손잡이 + 작은 차양
  const D = { x: 38, w: 9, h: 21 };
  W.box("door.frame", { x: D.x - 0.6, y: 0, w: D.w + 1.2, d: 0.35, r: 0.05 }, SLAB, D.h + 0.6, { cls: "pw-grey", tone: "mid", steps: 1, info: "door" });
  W.box("door.leaf", { x: D.x, y: 0.35, w: D.w, d: 0.25, r: 0.05 }, SLAB, D.h, { cls: "pw-grey", tone: "mid", steps: 1, info: "door",
    inner: L(seg([D.x, 0.6, SLAB + 2], [D.x + D.w, 0.6, SLAB + 2]), { tone: "faint" }) });
  W.box("door.handle", { x: D.x + D.w - 2, y: 0.6, w: 1.2, d: 0.5, r: 0.1 }, SLAB + 9.5, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "door" });
  W.box("door.hood", { x: D.x - 2, y: 0, w: D.w + 4, d: 3.2, r: 0.1 }, SLAB + D.h + 1.4, 0.6, { cls: "pw-grey", tone: "mid", steps: 1, info: "door" });
  // 벽등 2개 (작은 상자 + 아래쪽 렌즈)
  for (const x of [52, 100]) {
    W.box(`lamp.${x}`, { x: x - 1.6, y: 0, w: 3.2, d: 1.4, r: 0.2 }, 41, 2.4, { cls: "pw-grey", tone: "mid", steps: 2, info: "lamp" });
  }
}
outerWall();

// ---------- 5) 변압기 (34.5 kV → 480 V) ----------
function transformer() {
  const z0 = SLAB, top = z0 + 21;
  // 탱크 + 오른쪽 방열판(냉각 핀) 10장 + 위아래 헤더
  W.box("xf.tank", XF, z0, 21, { cls: "pw-xfmr", tone: "mid", steps: 2, bevel: 0.5, info: "xfmr" });
  for (let i = 0; i < 10; i++) {
    const y = XF.y + 1.4 + i * 1.45;
    W.box(`xf.fin${i}`, { x: XF.x + XF.w, y, w: 3.6, d: 0.32, r: 0.05 }, z0 + 2.5, 15, { cls: "pw-xfmr", tone: "mid", steps: 1, info: "xfmr", stamp: "xf-fin" });
  }
  for (const zz of [z0 + 2.5 - 0.5, z0 + 17.5 + 0.5]) {
    const F = G.frameAlong([XF.x + XF.w + 1.8, XF.y + 0.8, zz], [0, 1, 0]);
    W.disc(`xf.header${zz}`, F, 0, 14.6, 0.45, { cls: "pw-xfmr", tone: "mid", info: "xfmr" });
  }
  // 앞 단자함 (문 두 짝, 손잡이, 자물쇠 고리)
  W.box("xf.front", XF_FRONT, z0, 17, { cls: "pw-xfmr", tone: "mid", steps: 2, info: "xfmr-hv",
    inner: L(frontSeams(XF_FRONT.y + XF_FRONT.d, [XF_FRONT.x + XF_FRONT.w / 2], z0, z0 + 17), { tone: "lo" }) });
  for (const x of [XF_FRONT.x + XF_FRONT.w / 2 - 2.2, XF_FRONT.x + XF_FRONT.w / 2 + 1.0]) W.box(`xf.handle${x}`, { x, y: XF_FRONT.y + XF_FRONT.d, w: 1.2, d: 0.5, r: 0.1 }, z0 + 8, 0.6, { cls: "pw-steel", tone: "mid", steps: 1, info: "xfmr-hv" });
  // 이름판 (34.5 kV / 480Y-277 V — 그림에 넣는 유일한 글자)
  const npY = XF_FRONT.y + XF_FRONT.d;
  W.box("xf.nameplate", { x: XF_FRONT.x + 2, y: npY, w: 7.5, d: 0.2, r: 0.05 }, z0 + 12, 3.2, { cls: "pw-steel", tone: "mid", steps: 1, crease: "none", info: "xfmr",
    extra: k.faceTextSvg(k.sideMatrix([XF_FRONT.x + 2.6, npY + 0.2], z0 + 14.1, P, "left"), "34.5kV/480V", { size: 1.05, tone: "hi" }) });
  // 윗면: 들어 올림 고리 4개, 압력 방출 밸브, 2차(480 V) 출구 목 (래더로 올라감)
  for (const [x, y] of k.corners(XF, 1.6)) W.box(`xf.lug${x}${y}`, { x: x - 0.7, y: y - 0.25, w: 1.4, d: 0.5, r: 0.1 }, top, 1.4, { cls: "pw-xfmr", tone: "mid", steps: 1, info: "xfmr", stamp: "xf-lug" });
  W.cyl("xf.prv", XF.x + 18, XF.y + 12, 0.9, top, 1.6, { cls: "pw-steel", tone: "mid", info: "xfmr" });
  W.box("xf.throat", { x: XF.x + 5, y: 3.6, w: 12, d: 5.4, r: 0.3 }, top, 4, { cls: "pw-xfmr", tone: "mid", steps: 2, info: "ladder" });
  // 접지: 탱크 아래 접지 패드 → 패드 모서리 접지봉
  W.cyl("xf.groundrod", 29, 28, 0.5, SLAB, 1.2, { cls: "pw-copper", tone: "mid", info: "ground" });
}
transformer();

// ---------- 6) 케이블 래더 (480 V: 변압기 위 → 벽을 따라 → ATS 위) ----------
const LADDER = { y0: 3.6, y1: 9, z: 36.5, x0: XF.x + 5, x1: 70 };
function ladder() {
  const { y0, y1, z } = LADDER;
  const riserTop = 34;
  // 위 꺾임 상자(변압기 목 위) · 내려가는 상자(ATS 위)
  W.box("ladder.elbow", { x: LADDER.x0, y: y0, w: 12, d: y1 - y0, r: 0.3 }, riserTop, 5.5, { cls: "pw-steel", tone: "mid", steps: 2, info: "ladder" });
  W.box("ladder.drop", { x: 62.5, y: y0, w: 10, d: y1 - y0, r: 0.3 }, ATS_Z + ATS_H + 4, 39.5 - (ATS_Z + ATS_H + 4), { cls: "pw-steel", tone: "mid", steps: 2, info: "ladder" });
  // 수직 래더 (변압기 목 → 위 꺾임 상자): 옆 레일 2 + 가로대 2, 케이블은 가로대 앞(+x)에 붙음
  for (const [y, nm] of [[y0, "a"], [y1 - 0.35, "b"]]) W.box(`ladder.vrail${nm}`, { x: 11.4, y, w: 2.4, d: 0.35, r: 0.05 }, SLAB + 25, riserTop - SLAB - 25, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder" });
  for (const zr of [SLAB + 26.4, SLAB + 29.2]) W.box(`ladder.vrung${zr}`, { x: 11.4, y: y0 + 0.35, w: 0.5, d: y1 - y0 - 0.7, r: 0.05 }, zr, 0.45, { cls: "pw-steel", tone: "lo", steps: 1, info: "ladder" });
  // 수평 래더: 옆 레일 2줄 + 가로대
  const xa = LADDER.x0 + 12, xb = 62.5;
  for (const [y, nm] of [[y0, "a"], [y1 - 0.35, "b"]]) W.box(`ladder.rail${nm}`, { x: xa, y, w: xb - xa, d: 0.35, r: 0.05 }, z, 1.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder" });
  for (let x = xa + 2; x < xb - 1; x += 3) W.box(`ladder.rung${x}`, { x, y: y0 + 0.35, w: 0.5, d: y1 - y0 - 0.7, r: 0.05 }, z, 0.4, { cls: "pw-steel", tone: "lo", steps: 1, info: "ladder", stamp: "rung" });
  // 벽 받침 (삼각 까치발) 3개
  for (const x of [28, 44, 58]) {
    W.box(`ladder.arm${x}`, { x: x - 0.3, y: 0, w: 0.6, d: y1 + 0.4, r: 0.05 }, z - 0.8, 0.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder", stamp: "arm" });
    W.box(`ladder.armplate${x}`, { x: x - 1, y: 0, w: 2, d: 0.3, r: 0.05 }, z - 5, 5, { cls: "pw-steel", tone: "mid", steps: 1, info: "ladder", stamp: "armplate" });
  }
  // 케이블 8가닥: 목 → 위 상자(세로), 위 상자 → 아래 상자(가로, 가로대 위), 아래 상자 → ATS 윗상자(세로)
  for (let i = 0; i < 6; i++) {
    const y = y0 + 0.85 + i * 0.68;
    cable(`lv.riser${i}`, [[12.8, y, SLAB + 25], [12.8, y, riserTop]], 0.3, { flow: "lv", bundle: "lv", info: "ladder", fillet: false, maxLength: 20 });
    cable(`lv.run${i}`, [[xa, y, z + 0.4 + 0.3], [xb, y, z + 0.4 + 0.3]], 0.3, { flow: "lv", bundle: "lv", info: "ladder", fillet: false, maxLength: 12, touch: ["ladder.rung*"] });
  }
}
ladder();

// ---------- 7) ATS·배전반 (회색 칸 4개, 둘째 칸은 문을 떼어 전환 접점이 보임) ----------
// 2칸(ATS)은 앞판을 떼어 낸 창. 창이 깊으면 안쪽이 오른쪽 옆판에 가려 보이지 않음
//   (평행 투영에서 안쪽 점은 깊이만큼 오른쪽으로 밀려 보임) → 장착판을 창 바로 뒤(y = 10.9)에 두고 접점을 그 앞에 붙임
const SW = { x0: SECTIONS[1], x1: SECTIONS[2], win: { x0: SECTIONS[1] + 1, x1: SECTIONS[2] - 0.8, z0: ATS_Z + 3.6, z1: ATS_Z + 18 }, plate: 10.9 };
const PIVOT = { y: 12.2, z: ATS_Z + 10.5 }, BLADE = { len: 3.4, w: 0.8, t: 0.45, up: 52 };   // 칼날: 축에서 앞쪽 위(+52° = N) / 앞쪽 아래(−52° = E)
const PHASE_X = [77.8, 80.2, 82.6];
function ats() {
  const z0 = ATS_Z, z1 = ATS_Z + ATS_H, Y = ATS.y + ATS.d;
  // 받침 채널
  W.box("ats.sill", { x: ATS.x - 0.5, y: ATS.y, w: ATS.w + 1, d: ATS.d + 0.4, r: 0.1 }, SLAB, 1, { cls: "pw-steel", tone: "mid", steps: 1, info: "ats" });
  // 1·3·4칸: 통짜 상자 + 문 (앞면 위에 얇은 판)
  const solidSection = (i, info) => {
    const x0 = SECTIONS[i], x1 = SECTIONS[i + 1];
    W.box(`ats.s${i}`, { x: x0, y: ATS.y, w: x1 - x0, d: ATS.d, r: 0.2 }, z0, ATS_H, { cls: "pw-grey", tone: "mid", steps: 1, info });
    // 문짝 (위아래 두 장) · 손잡이 · 경첩 점 · 아래 환기 슬롯
    const doors = [[z0 + 1.2, z0 + 11], [z0 + 11.6, z1 - 1.2]];
    doors.forEach(([a, b], j) => {
      W.box(`ats.s${i}.door${j}`, { x: x0 + 0.8, y: Y, w: x1 - x0 - 1.6, d: 0.25, r: 0.05 }, a, b - a, { cls: "pw-grey", tone: "mid", steps: 1, info,
        inner: j === 0 ? L(frontSlots(Y + 0.25, x0 + 2.2, x1 - 2.2, a + 1.2, 3, 1.3, 0.55), { tone: "lo" }) : "" });
      W.box(`ats.s${i}.handle${j}`, { x: x1 - 2.6, y: Y + 0.25, w: 0.6, d: 0.5, r: 0.1 }, (a + b) / 2 - 1.2, 2.4, { cls: "pw-steel", tone: "mid", steps: 1, info, stamp: "ats-handle" });
    });
    return { x0, x1 };
  };
  solidSection(0, "ats-in");
  const s2 = solidSection(2, "ats-dist");
  const s3 = solidSection(3, "ats-feed");
  // 배전 칸: 차단기 손잡이 (문 위 작은 막대 줄)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) W.box(`ats.brk${r}${c}`, { x: s2.x0 + 3 + c * 3.6, y: Y + 0.25, w: 1.6, d: 0.45, r: 0.1 }, z0 + 13.5 + r * 2.4, 0.9, { cls: "pw-dark", tone: "mid", steps: 1, info: "ats-dist", stamp: "brk" });
  // 계통·발전기 표시등 (1칸 윗문): 계통 있음(초록) · 발전기 있음(주황) — 움직임 코드가 켬
  const lampAt = (x) => at([x, Y + 0.3, z1 - 4]);
  W.put("ats.lamps", [SECTIONS[0] + 6, Y + 0.3, z1 - 4], `<g class="pw-lamps"><circle class="pw-lamp" data-lamp="n" cx="${r1(lampAt(SECTIONS[0] + 3.4)[0])}" cy="${r1(lampAt(SECTIONS[0] + 3.4)[1])}" r="1.15"/><circle class="pw-lamp" data-lamp="e" cx="${r1(lampAt(SECTIONS[0] + 6.4)[0])}" cy="${r1(lampAt(SECTIONS[0] + 6.4)[1])}" r="1.15"/></g>`,
    [R.solid(A.box([SECTIONS[0] + 2.4, Y + 0.25, z1 - 5], [SECTIONS[0] + 7.4, Y + 0.45, z1 - 3], { name: "ats.lamps" }))], { info: "ats-lamps", bias: 0.05 });
  // 2칸 (ATS): 뒤쪽 몸통 + 창 둘레(옆판 2·바닥·지붕) + 검정 장착판
  const { x0, x1 } = SW, w = SW.win, PY = SW.plate;
  W.box("ats.sw.body", { x: x0, y: ATS.y, w: x1 - x0, d: PY - 0.3 - ATS.y, r: 0.05 }, z0, ATS_H, { cls: "pw-grey", tone: "mid", steps: 1, info: "ats" });
  W.box("ats.sw.plate", { x: w.x0, y: PY - 0.3, w: w.x1 - w.x0, d: 0.3, r: 0.02 }, w.z0, w.z1 - w.z0, { cls: "pw-dark", tone: "lo", steps: 1, crease: "none", info: "ats" });
  W.box("ats.sw.left", { x: x0, y: PY - 0.3, w: w.x0 - x0, d: Y - PY + 0.3, r: 0.05 }, z0, ATS_H, { cls: "pw-grey", tone: "mid", steps: 1, info: "ats" });
  W.box("ats.sw.right", { x: w.x1, y: PY - 0.3, w: x1 - w.x1, d: Y - PY + 0.3, r: 0.05 }, z0, ATS_H, { cls: "pw-grey", tone: "mid", steps: 1, info: "ats" });
  W.box("ats.sw.floor", { x: w.x0, y: PY - 0.3, w: w.x1 - w.x0, d: Y - PY + 0.3, r: 0.05 }, z0, w.z0 - z0, { cls: "pw-grey", tone: "mid", steps: 1, info: "ats",
    inner: L(frontSlots(Y, w.x0 + 1, w.x1 - 1, z0 + 0.8, 2, 1.1, 0.45), { tone: "lo" }) });
  W.box("ats.sw.roof", { x: w.x0, y: PY - 0.3, w: w.x1 - w.x0, d: Y - PY + 0.3, r: 0.05 }, w.z1, z1 - w.z1, { cls: "pw-grey", tone: "mid", steps: 1, info: "ats",
    inner: L(seg([w.x0, Y, z1 - 2.2], [w.x1, Y, z1 - 2.2]), { tone: "lo" }) });
  // 상마다: 위 = 계통(N) 받이, 아래 = 발전기(E) 받이, 가운데 = 칼날 축받이 (모두 절연 받침 위 구리 덩어리)
  //   N 받이 위로 구리 막대(계통 인입 쪽), E 받이 아래로 구리 막대(바닥으로 올라온 발전기 콘듀잇 쪽)
  const tipY = PIVOT.y + BLADE.len * Math.cos((BLADE.up * Math.PI) / 180), lift = BLADE.len * Math.sin((BLADE.up * Math.PI) / 180);
  PHASE_X.forEach((x, i) => {
    for (const [zc, nm] of [[PIVOT.z + lift, "n"], [PIVOT.z - lift, "e"]]) {
      W.disc(`ats.ins.${nm}${i}`, G.frameAlong([x, PY, zc], [0, 1, 0]), 0, tipY - 0.6 - PY, 0.42, { cls: "pw-ins", tone: "mid", info: "ats-contact", owner: "ats.switch" });
      W.box(`ats.jaw.${nm}${i}`, { x: x - 0.55, y: tipY - 0.6, w: 1.1, d: 1.25, r: 0.1 }, zc - 0.6, 1.2, { cls: "pw-tin", tone: "mid", steps: 1, info: nm === "n" ? "ats-n" : "ats-e", owner: "ats.switch" });
      const [b0, b1] = nm === "n" ? [zc + 0.6, w.z1] : [w.z0, zc - 0.6];
      W.box(`ats.bus.${nm}${i}`, { x: x - 0.3, y: tipY - 0.3, w: 0.6, d: 0.55, r: 0.05 }, b0, b1 - b0, { cls: "pw-tin", tone: "mid", steps: 1, info: nm === "n" ? "ats-n" : "ats-e", owner: "ats.switch" });
    }
    W.disc(`ats.ins.p${i}`, G.frameAlong([x, PY, PIVOT.z], [0, 1, 0]), 0, PIVOT.y - 0.6 - PY, 0.4, { cls: "pw-ins", tone: "mid", info: "ats-contact", owner: "ats.switch" });
    for (const [dx, nm] of [[-0.62, "l"], [0.27, "r"]]) W.box(`ats.hinge${i}${nm}`, { x: x + dx, y: PIVOT.y - 0.6, w: 0.35, d: 1.2, r: 0.05 }, PIVOT.z - 0.6, 1.2, { cls: "pw-tin", tone: "mid", steps: 1, info: "ats-blade", owner: "ats.switch" });
  });
  // 왼쪽 조작기 (모터·수동 손잡이 자리): 세 상의 칼날을 함께 돌림
  W.box("ats.operator", { x: w.x0, y: PY, w: 1.8, d: 2.9, r: 0.2 }, PIVOT.z - 2.3, 4.6, { cls: "pw-dark", tone: "mid", steps: 1, info: "ats-operator", owner: "ats.switch",
    extra: L(k.sideRing([w.x0 + 0.9, PY + 2.9, PIVOT.z + 0.9], 0.45, "y", P, 14), { tone: "mid" }) });
  // 칼날: 각도별 그림 9장을 미리 만들어 두고 움직임 코드가 하나만 보여 줌 (0번 = N, 8번 = E)
  const STEPS = 9;
  const bladeShape = (deg) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const ux = [c, s], vx = [-s, c], hw = BLADE.w / 2;
    return [[-0.2 * ux[0] - hw * vx[0], -0.2 * ux[1] - hw * vx[1]], [BLADE.len * ux[0] - hw * vx[0], BLADE.len * ux[1] - hw * vx[1]], [BLADE.len * ux[0] + hw * vx[0], BLADE.len * ux[1] + hw * vx[1]], [-0.2 * ux[0] + hw * vx[0], -0.2 * ux[1] + hw * vx[1]]];
  };
  const bladeF = (x) => G.frameOf([x - BLADE.t / 2, PIVOT.y, PIVOT.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  PHASE_X.forEach((x, i) => {
    const frames = [];
    for (let s = 0; s < STEPS; s++) {
      const deg = BLADE.up - (2 * BLADE.up * s) / (STEPS - 1);
      frames.push(`<g data-blade="${s}"${s === 0 ? "" : ' style="display:none"'}><g class="pw-blade">${k.solidSvg(G.prismOf(bladeF(x), bladeShape(deg), 0, BLADE.t, P), { tone: "hi", lit: true })}</g></g>`);
    }
    const shape = R.solid(A.prism(bladeF(x), bladeShape(BLADE.up), 0, BLADE.t, { name: `ats.blade${i}`, owner: "ats.switch" }));
    W.put(`ats.blade${i}`, [x, PIVOT.y + 1, PIVOT.z + 1], frames.join(""), [shape], { info: "ats-blade", bias: 0.1 });
  });
  // 위 상자: 1칸 위 = 래더 케이블 받는 상자, 4칸 위 = 피더가 나가는 상자
  W.box("ats.pull", { x: 62.5, y: 2.2, w: 10, d: 10, r: 0.3 }, z1, 4, { cls: "pw-grey", tone: "mid", steps: 2, info: "ladder" });
  W.box("ats.feedtop", { x: s3.x0 + 1, y: 2.2, w: s3.x1 - s3.x0 - 2, d: 9, r: 0.3 }, z1, 2.5, { cls: "pw-grey", tone: "mid", steps: 2, info: "feeder" });
}
ats();

// ---------- 8) 홀 피더 (ATS 4칸 위 → 벽 관통 상자 → 홀 안 → 배전반) ----------
const HOOD = { x: 105, y: 0, w: 12, d: 3.2, z: 34, h: 6 };
function feeders() {
  W.box("feeder.hood", { x: HOOD.x, y: HOOD.y, w: HOOD.w, d: HOOD.d, r: 0.2 }, HOOD.z, HOOD.h, { cls: "pw-grey", tone: "mid", steps: 2, info: "feeder" });
  W.box("feeder.hoodlid", { x: HOOD.x - 0.4, y: HOOD.y, w: HOOD.w + 0.8, d: HOOD.d + 0.5, r: 0.2 }, HOOD.z + HOOD.h, 0.6, { cls: "pw-grey", tone: "mid", steps: 2, info: "feeder" });
  const top = ATS_Z + ATS_H + 2.5;
  for (let i = 0; i < 4; i++) {
    const x = 107 + i * 2.6;
    // 밖: 4칸 위 상자 → 위로 → 벽 쪽으로 고리 → 관통 상자 아래로 들어감
    cable(`feeder.out${i}`, [[x, 7.2, top], [x, 7.2, top + 2.2], [x, 1.6, top + 2.2], [x, 1.6, HOOD.z]], 0.42, { flow: "load", bundle: "feeder", info: "feeder", bend: 1.15, maxLength: 6 });
    // 안: 벽 안쪽 판 → 벽을 따라 오른쪽 → 배전반 위로 내려감
    const zi = HOOD.z + 3.4 - i * 0.9;
    cable(`feeder.in${i}`, [[x, -WALL.t - 0.4, zi], [x, -6 - i * 0.9, zi], [RPP.x + 4.8 - i * 1.1, -6 - i * 0.9, zi], [RPP.x + 4.8 - i * 1.1, RPP.y + 6, zi], [RPP.x + 4.8 - i * 1.1, RPP.y + 6, HALL.floor + 22]], 0.42, { flow: "load", bundle: "feeder-in", info: "feeder", bend: 1.8, maxLength: 8 });
  }
  W.box("feeder.inplate", { x: 105, y: -WALL.t - 0.4, w: 12, d: 0.4, r: 0.05 }, HOOD.z - 0.6, 5.2, { cls: "pw-grey", tone: "mid", steps: 1, info: "feeder" });
}
feeders();

// ---------- 9) 홀 안 (IREN 홈페이지의 매켄지·프린스조지 공랭 홀 사진 기준) ----------
// 흡기 루버(허문 벽 아래) → 찬 통로 → 랙 앞면(Dell 은색 서버, 녹색 광케이블) → 랙 → 뜨거운 통로 → 배기 팬 벽
// 전원: 홀 배전반 → 뜨거운 통로 위 전원 트레이 → 랙마다 코드 → 랙 뒤 PDU(277 V). 통신: 찬 통로 위 사다리
// 마지막 랙은 오른쪽 옆판을 떼어 서버 옆모습·뒤 PDU·전원 코드를 보여 줌
function hallPower() {
  const z0 = HALL.floor;
  W.box("rpp", RPP, z0, 22, { cls: "pw-grey", tone: "mid", steps: 1, info: "rpp",
    inner: L(frontSeams(RPP.y + RPP.d, [RPP.x + RPP.w / 2], z0, z0 + 22), { tone: "lo" }) });
  for (const x of [RPP.x + RPP.w / 2 - 1.6, RPP.x + RPP.w / 2 + 0.8]) W.box(`rpp.handle${x}`, { x, y: RPP.y + RPP.d, w: 0.8, d: 0.45, r: 0.1 }, z0 + 11, 2, { cls: "pw-steel", tone: "mid", steps: 1, info: "rpp" });
  // 전원 트레이 (랙 뒤, 뜨거운 통로 위): 레일 2 + 가로대 + 끝판
  const tx0 = RPP.x + RPP.w + 1, tx1 = RACK0 + RACK_W * RACKS - 1, ty = TRAY.y, tz = TRAY.z;
  W.box("tray.end", { x: tx1, y: ty, w: 0.3, d: TRAY.w, r: 0.05 }, tz, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "tray" });
  for (const [y, nm] of [[ty, "a"], [ty + TRAY.w - 0.3, "b"]]) W.box(`tray.rail${nm}`, { x: tx0, y, w: tx1 - tx0, d: 0.3, r: 0.05 }, tz, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "tray" });
  for (let x = tx0 + 1.5; x < tx1 - 0.5; x += 3) W.box(`tray.rung${x}`, { x, y: ty + 0.3, w: 0.45, d: TRAY.w - 0.6, r: 0.05 }, tz, 0.35, { cls: "pw-steel", tone: "lo", steps: 1, info: "tray", stamp: "trung" });
  // 분기 케이블 3가닥: 배전반 윗면 뒤쪽 → 위로 → 뒤로 → 트레이 왼쪽 끝으로 들어가 끝까지
  //   (먼 줄일수록 왼쪽에서 꺾어 서로 엇갈리지 않게)
  for (let i = 0; i < 3; i++) {
    const ly = ty + 1.5 + i * 1.0, xu = RPP.x + RPP.w - 3.2 + i * 1.0, yu = RPP.y + 1.5;
    cable(`branch.up${i}`, [[xu, yu, z0 + 22], [xu, yu, tz + 0.7], [xu, ly, tz + 0.7], [tx1, ly, tz + 0.7]], 0.35, { flow: "load", bundle: "branch", info: "tray", bend: 1.3, maxLength: 10, touch: ["tray.rung*"] });
  }
  // 통신 케이블 사다리 (찬 통로 위, 회사 사진의 천장 사다리): 레일 2 + 가로대 + 끝판 2 + 주황·파랑 케이블 묶음
  const nx0 = RACK0 - 4.5, nx1 = tx1;
  for (const x of [nx0, nx1]) W.box(`net.end${x}`, { x, y: NET.y, w: 0.3, d: NET.w, r: 0.05 }, NET.z, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "netlad" });
  for (const [y, nm] of [[NET.y, "a"], [NET.y + NET.w - 0.3, "b"]]) W.box(`net.rail${nm}`, { x: nx0 + 0.3, y, w: nx1 - nx0 - 0.3, d: 0.3, r: 0.05 }, NET.z, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "netlad" });
  for (let x = nx0 + 1.8; x < nx1 - 0.5; x += 3) W.box(`net.rung${x}`, { x, y: NET.y + 0.3, w: 0.45, d: NET.w - 0.6, r: 0.05 }, NET.z, 0.35, { cls: "pw-steel", tone: "lo", steps: 1, info: "netlad", stamp: "nrung" });
  for (const [y, r, cls] of [[NET.y + 1.25, 0.55, "pw-fiber-or"], [NET.y + 2.75, 0.5, "pw-fiber-bl"]]) cable(`net.cable${cls}`, [[nx0 + 0.3, y, NET.z + 0.35 + r], [nx1, y, NET.z + 0.35 + r]], r, { cls, tone: "mid", info: "netlad", fillet: false, maxLength: 30, touch: ["net.rung*"] });
  // 랙 14대 (같은 모양은 첫 랙만 그리고 나머지는 복사) + 배기 팬 벽
  for (let i = 0; i < RACKS; i++) rack(i, RACK0 + i * RACK_W);
  fanWall();
}
const SRV_H = 4.45, SRV_Z0 = HALL.floor + 1.6;   // 서버 1대 높이(약 10U)와 첫 서버 높이
function rack(i, x0) {
  const z0 = HALL.floor, Y = RACK_Y + RACK_D, top = z0 + RACK_H, open = i === RACKS - 1;
  // 위·아래 띠 (랙 문틀 자리): 앞면에서 오른쪽 옆면으로 돌아 윤곽선에서 끝나는 이음선
  const plan = { x: x0 + 0.05, y: RACK_Y, w: RACK_W - 0.1, d: RACK_D, r: 0.1 };
  const bands = L(k.sideSeam(plan, top - 1.1, P, 1) + k.sideSeam(plan, z0 + 1.1, P, 1), { tone: "lo" });
  if (!open) W.box(`rack${i}`, plan, z0, RACK_H, { cls: "pw-rack", tone: "mid", steps: 1, info: "rack", stamp: "rack-body", inner: bands });
  else openRack(x0);
  for (let s = 0; s < 4; s++) server(i, s, x0, SRV_Z0 + s * SRV_H);
  // 전원: 트레이 아래 드롭아웃 상자 → 코드 → 랙 윗면 뒤쪽 인입구 (PDU 는 랙 뒤 안쪽에 세로로)
  const yd = TRAY.y + 3.05;
  for (const [xc, nm] of [[x0 + 1.2, "a"], [x0 + RACK_W - 1.2, "b"]]) {
    W.box(`rack${i}.dropout${nm}`, { x: xc - 0.45, y: yd - 0.45, w: 0.9, d: 0.9, r: 0.15 }, TRAY.z - 0.6, 0.6, { cls: "pw-steel", tone: "mid", steps: 2, info: "pdu", stamp: "dropout" });
    W.box(`rack${i}.gland${nm}`, { x: xc - 0.55, y: RACK_Y + 0.25, w: 1.1, d: 1.1, r: 0.3 }, top, 0.5, { cls: "pw-dark", tone: "mid", steps: 2, info: "pdu", stamp: "gland" });
    cable(`drop${i}${nm}`, [[xc, yd, TRAY.z - 0.6], [xc, yd, top + 1.3], [xc, RACK_Y + 0.8, top + 1.3], [xc, RACK_Y + 0.8, top + 0.5]], 0.24, { flow: "load", bundle: `drop${i}`, info: "pdu", bend: 0.65, maxLength: 6 });
  }
  // 받침: 랙 위 뒤쪽 기둥·팔 = 전원 트레이, 앞쪽 기둥·팔 = 통신 사다리
  W.box(`rack${i}.post`, { x: x0 + RACK_W / 2 - 0.25, y: RACK_Y + 0.3, w: 0.5, d: 0.5, r: 0.05 }, top, TRAY.z - 0.5 - top, { cls: "pw-steel", tone: "mid", steps: 1, info: "tray", stamp: "tpost" });
  W.box(`rack${i}.arm`, { x: x0 + RACK_W / 2 - 0.25, y: TRAY.y, w: 0.5, d: RACK_Y + 0.8 - TRAY.y, r: 0.05 }, TRAY.z - 0.5, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "tray", stamp: "tarm" });
  W.box(`rack${i}.npost`, { x: x0 + RACK_W / 2 - 0.25, y: Y - 1.0, w: 0.5, d: 0.5, r: 0.05 }, top, NET.z - 0.5 - top, { cls: "pw-steel", tone: "mid", steps: 1, info: "netlad", stamp: "npost" });
  W.box(`rack${i}.narm`, { x: x0 + RACK_W / 2 - 0.25, y: Y - 1.0, w: 0.5, d: NET.y + NET.w - (Y - 1.0), r: 0.05 }, NET.z - 0.5, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "netlad", stamp: "narm" });
}
// 서버 1대 앞면 (Dell 은색): 위 = 타공 망, 아래 = 육각 무늬, 오른쪽 초록 LED, 맨 아래 녹색 광케이블 고리 3개
function server(i, s, x0, a) {
  const Y = RACK_Y + RACK_D, F = Y + 0.25, x = x0 + 0.55, w = 4.9, h = 4.2;
  const band = pathOf3(onFront(F, [[x + 0.3, a + 2.3], [x + w - 0.3, a + 2.3], [x + w - 0.3, a + 3.9], [x + 0.3, a + 3.9], [x + 0.3, a + 2.3]]));
  const hexes = [];
  for (let j = 0; j < 6; j++) {
    const cx = x + 0.62 + j * 0.74, cz = a + 1.4, r = 0.36, pts = [];
    for (let q = 0; q <= 6; q++) { const t = ((q % 6) * Math.PI) / 3; pts.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); }
    hexes.push(pathOf3(onFront(F, pts)));
  }
  const mesh = [];
  for (let c = 0; c < 11; c++) for (let rr = 0; rr < 2; rr++) mesh.push(at([x + 0.55 + c * 0.38, F, a + 2.75 + rr * 0.7]));
  const loops = [], ports = [];
  for (let f = 0; f < 3; f++) {
    const xa = x + 0.9 + f * 1.35, za = a + 0.72;
    loops.push(pathOf3(onFront(F + 0.05, [[xa, za], [xa, za - 0.3], [xa + 0.3, za - 0.46], [xa + 0.6, za - 0.3], [xa + 0.6, za]])));
    ports.push(at([xa, F + 0.05, za]), at([xa + 0.6, F + 0.05, za]));
  }
  W.box(`srv${i}.${s}`, { x, y: Y, w, d: 0.25, r: 0.05 }, a, h, { cls: "pw-silver", tone: "mid", steps: 1, info: "server", stamp: "srv",
    inner: L(band + hexes.join(""), { tone: "mid" }),
    extra: Dt(mesh, { size: 0.12, tone: "mid" }) + L(loops.join(""), { tone: "green" }) + Dt(ports, { size: 0.14, tone: "hi" })
      + `<g class="pw-leds">${Dt([at([x + w - 0.4, F, a + 3.1])], { size: 0.2, tone: "hi" })}</g>` });
}
// 마지막 랙: 오른쪽 옆판을 떼어 안을 보여 줌 (왼쪽 옆판·위·아래 판·오른쪽 기둥 2, 서버 몸통, 뒤 PDU 와 전원 코드)
function openRack(x0) {
  const z0 = HALL.floor, Y = RACK_Y + RACK_D, top = z0 + RACK_H;
  W.box("rackopen.side", { x: x0 + 0.05, y: RACK_Y, w: 0.3, d: RACK_D, r: 0.05 }, z0, RACK_H, { cls: "pw-rack", tone: "mid", steps: 1, info: "rack" });
  W.box("rackopen.top", { x: x0 + 0.35, y: RACK_Y, w: RACK_W - 0.4, d: RACK_D, r: 0.05 }, top - 0.8, 0.8, { cls: "pw-rack", tone: "mid", steps: 1, info: "rack" });
  W.box("rackopen.bottom", { x: x0 + 0.35, y: RACK_Y, w: RACK_W - 0.4, d: RACK_D, r: 0.05 }, z0, 0.8, { cls: "pw-rack", tone: "mid", steps: 1, info: "rack" });
  for (const [y, nm] of [[Y - 0.5, "f"], [RACK_Y, "r"]]) W.box(`rackopen.post${nm}`, { x: x0 + RACK_W - 0.55, y, w: 0.5, d: 0.5, r: 0.05 }, z0 + 0.8, RACK_H - 1.6, { cls: "pw-rack", tone: "mid", steps: 1, info: "rack" });
  // 서버 몸통 (옆면 환기 슬롯) — 앞면 판은 server() 가 그림
  for (let s = 0; s < 4; s++) {
    const a = SRV_Z0 + s * SRV_H;
    W.box(`rackopen.srv${s}`, { x: x0 + 0.55, y: RACK_Y + 2.2, w: 4.6, d: Y - (RACK_Y + 2.2), r: 0.05 }, a, 4.2, { cls: "pw-silver", tone: "mid", steps: 1, info: "server",
      inner: L(rightSlots(x0 + 5.15, RACK_Y + 3.8, Y - 1.6, a + 1.0, 3, 1.0, 0.4), { tone: "lo" }) });
  }
  // 뒤 PDU: 세로 띠, 오른쪽 면에 콘센트, 서버 뒤쪽 전원 공급기로 짧은 코드 4가닥
  const px0 = x0 + 4.0, px1 = x0 + 5.4, py0 = RACK_Y + 0.6, py1 = RACK_Y + 1.9;   // 옆 개구부 바로 안쪽, 폭 1.4 · 깊이 1.3
  const outlets = []; for (let j = 0; j < 12; j++) outlets.push(at([px1, (py0 + py1) / 2, z0 + 2.6 + j * 1.45]));
  W.box("pdu.open", { x: px0, y: py0, w: px1 - px0, d: py1 - py0, r: 0.05 }, z0 + 1.6, 19, { cls: "pw-pdu", tone: "mid", steps: 1, info: "pdu",
    extra: Dt(outlets, { size: 0.3, tone: "hi" }) });
  const cords = [];
  for (let s = 0; s < 4; s++) {
    const zo = z0 + 2.6 + (s * 3 + 1) * 1.45, zs = SRV_Z0 + s * SRV_H + 2.4;
    cords.push(k.wireSvg(at([px1, (py0 + py1) / 2, zo]), at([x0 + 5.15, RACK_Y + 3.0, zs]), { via: [at([px1, RACK_Y + 2.6, (zo + zs) / 2])], tone: "hi", size: 0.28 }));
  }
  W.put("pdu.cords", [x0 + 5.3, RACK_Y + 2.4, z0 + 12], `<g class="pw-cords">${cords.join("")}</g>`, [R.solid(A.box([x0 + 5.15, py0, z0 + 2], [px1 + 0.05, RACK_Y + 3.0, z0 + 20], { name: "pdu.cords" }))], { info: "pdu", bias: 0.06 });
}
// 배기 팬 벽 (뜨거운 통로 끝, 프린스조지 홀 사진): 흰 틀에 정사각 팬 20 × 6, 위·오른쪽 끝은 잘린 면
function fanWall() {
  const z0 = HALL.floor, Yf = FAN.y + FAN.d;
  const frames = [], rings = [], hubs = [];
  for (let c = 0; c < 20; c++) for (let r = 0; r < 6; r++) {
    const cx = FAN.x + 2.5 + c * 5, cz = z0 + 3 + r * 5;
    frames.push(pathOf3(onFront(Yf, [[cx - 2.2, cz - 2.2], [cx + 2.2, cz - 2.2], [cx + 2.2, cz + 2.2], [cx - 2.2, cz + 2.2], [cx - 2.2, cz - 2.2]])));
    rings.push(k.sideRing([cx, Yf, cz], 1.8, "y", P, 18));
    hubs.push(at([cx, Yf, cz]));
  }
  const X1 = FAN.x + FAN.w;
  W.box("fanwall", { x: FAN.x, y: FAN.y, w: FAN.w, d: FAN.d, r: 0.02 }, z0, FAN.top - z0, { cls: "pw-panel", tone: "lo", steps: 1, info: "fanwall",
    inner: L(frames.join(""), { tone: "lo" }) + L(rings.join(""), { tone: "mid" }),
    extra: Dt(hubs, { size: 0.32, tone: "mid" })
      + cutFace([[FAN.x, FAN.y, FAN.top], [X1, FAN.y, FAN.top], [X1, Yf, FAN.top], [FAN.x, Yf, FAN.top]], hatch(FAN.w, FAN.d, 2.2, (u, v) => [FAN.x + u, FAN.y + v, FAN.top]))
      + cutFace([[X1, FAN.y, z0], [X1, Yf, z0], [X1, Yf, FAN.top], [X1, FAN.y, FAN.top]], hatch(FAN.d, FAN.top - z0, 2.2, (u, v) => [X1, FAN.y + u, z0 + v])) });
}
hallPower();

// ---------- 10) 발전기 (2.5 MW 디젤: 기초 연료 탱크 + 방음 외함 + 지붕 소음기) ----------
function generator() {
  const z0 = SLAB, zt = z0 + GEN_TANK, zb = zt + GEN_BOX, Y = GEN.y + GEN.d, X = GEN.x + GEN.w;
  // 연료 탱크 (어두운 회색): 들어 올림 고리, 주유구, 레벨 게이지
  W.box("gen.tank", GEN, z0, GEN_TANK, { cls: "pw-tank", tone: "mid", steps: 2, info: "tank",
    inner: L(seg([GEN.x, Y, z0 + GEN_TANK - 1.2], [X, Y, z0 + GEN_TANK - 1.2]) + seg([X, GEN.y, z0 + GEN_TANK - 1.2], [X, Y, z0 + GEN_TANK - 1.2]), { tone: "lo" }) });
  for (const x of [GEN.x + 3, X - 6]) W.box(`gen.lug${x}`, { x, y: Y, w: 3, d: 0.6, r: 0.1 }, z0 + 2, 3, { cls: "pw-tank", tone: "mid", steps: 1, info: "tank", stamp: "glug" });
  W.box("gen.fill", { x: 70, y: Y, w: 4.5, d: 1.4, r: 0.2 }, z0 + 3.5, 4.5, { cls: "pw-tank", tone: "mid", steps: 2, info: "tank" });
  // 레벨 게이지: 탱크 앞면의 둥근 계기 (눈금 + 바늘)
  {
    const c = [58, Y + 0.3, z0 + 5.2], rr = 2.1;
    const F = G.frameAlong([c[0], Y, c[2]], [0, 1, 0]);
    const ticks = [];
    for (let j = 0; j <= 8; j++) { const a = Math.PI * (0.85 - j * 0.2125); const r0 = rr * (j % 4 === 0 ? 0.62 : 0.74); ticks.push(seg([c[0] + Math.cos(a) * r0, Y + 0.62, c[2] + Math.sin(a) * r0], [c[0] + Math.cos(a) * rr * 0.86, Y + 0.62, c[2] + Math.sin(a) * rr * 0.86])); }
    const needle = seg([c[0], Y + 0.64, c[2]], [c[0] + Math.cos(Math.PI * 0.3) * rr * 0.8, Y + 0.64, c[2] + Math.sin(Math.PI * 0.3) * rr * 0.8]);
    W.disc("gen.gauge", F, 0, 0.6, rr, { cls: "pw-steel", tone: "mid", info: "tank", extra: L(ticks.join(""), { tone: "lo" }) + L(needle, { tone: "hi" }) + Dt([at([c[0], Y + 0.64, c[2]])], { size: 0.35, tone: "hi" }) });
  }
  // 외함: 문 5짝(손잡이·경첩), 흡기 루버, 제어반 창, 비상정지 단추
  const doorX = [8, 31, 54, 77];
  W.box("gen.box", { x: GEN.x + 0.6, y: GEN.y + 0.6, w: GEN.w - 1.2, d: GEN.d - 1.2, r: 0.5 }, zt, GEN_BOX, { cls: "pw-gen", tone: "mid", steps: 2, bevel: 0.6, info: "gen",
    inner: L(frontSeams(Y - 0.6, doorX.flatMap((x) => [x, x + 18]), zt, zb), { tone: "lo" }) + L(rightSlots(X - 0.6, GEN.y + 3, Y - 3, zt + 3, 13, 2, 0.9), { tone: "lo" }) });
  doorX.forEach((x, j) => {
    W.box(`gen.handle${j}`, { x: x + 15.5, y: Y - 0.6, w: 0.8, d: 0.5, r: 0.1 }, zt + 13, 3, { cls: "pw-steel", tone: "mid", steps: 1, info: "gen", stamp: "ghandle" });
    W.box(`gen.louver${j}`, { x: x + 3, y: Y - 0.6, w: 12, d: 0.3, r: 0.05 }, zt + 19, 8, { cls: "pw-gen", tone: "mid", steps: 1, info: "gen-intake", stamp: "glouver",
      inner: L(frontSlots(Y - 0.3, x + 4, x + 14, zt + 20, 5, 1.4, 0.55), { tone: "lo" }) });
  });
  // 제어반: 작은 어두운 창 + 운전 표시등(움직임 코드가 켬) + 빨간 비상정지
  W.box("gen.panel", { x: 99, y: Y - 0.6, w: 8, d: 0.4, r: 0.1 }, zt + 15, 7, { cls: "pw-dark", tone: "mid", steps: 1, info: "gen-panel" });
  W.put("gen.runlamp", [104.5, Y - 0.15, zt + 20], `<circle class="pw-runlamp" cx="${r1(at([104.5, Y - 0.15, zt + 20.4])[0])}" cy="${r1(at([104.5, Y - 0.15, zt + 20.4])[1])}" r="0.85"/>`, [R.solid(A.box([103.8, Y - 0.2, zt + 19.7], [105.2, Y, zt + 21.1], { name: "gen.runlamp" }))], { info: "gen-panel", bias: 0.05 });
  {
    const F = G.frameAlong([110, Y - 0.6, zt + 17], [0, 1, 0]);
    W.disc("gen.estop.base", F, 0, 0.5, 1.1, { cls: "pw-yellow", tone: "mid", info: "gen-estop" });
    W.disc("gen.estop", F, 0.5, 1.3, 0.75, { cls: "pw-red", tone: "mid", info: "gen-estop" });
  }
  // 보조 회로 상자 (블록 히터·배터리 충전기 전원, 기동 신호): 오른쪽 끝면 아래 + 땅에서 올라오는 작은 관 2개
  W.box("gen.aux", { x: X - 0.6, y: GEN.y + 4, w: 1.2, d: 6, r: 0.2 }, zt + 2, 6, { cls: "pw-grey", tone: "mid", steps: 1, info: "gen-aux" });
  for (let j = 0; j < 2; j++) cable(`gen.auxconduit${j}`, [[X + 2.4, GEN.y + 5.5 + j * 3, SLAB], [X + 2.4, GEN.y + 5.5 + j * 3, zt + 3.4], [X + 0.6, GEN.y + 5.5 + j * 3, zt + 3.4]], 0.4, { cls: "pw-pvc", tone: "mid", info: "gen-aux", bend: 1.2, maxLength: 8, bundle: "aux" });
  // 지붕: 소음기(가로 원통) + 받침 2 + 배기 굴뚝(빗물 뚜껑)
  const SIL = { y: GEN.y + GEN.d / 2, z: zb + 4.4, r: 3.4, x0: 60, x1: 96 };
  for (const x of [SIL.x0 + 5, SIL.x1 - 7]) W.box(`gen.saddle${x}`, { x, y: SIL.y - 3, w: 2, d: 6, r: 0.1 }, zb, 1.4, { cls: "pw-steel", tone: "mid", steps: 1, info: "gen-stack", stamp: "saddle" });
  {
    const F = G.frameAlong([SIL.x0, SIL.y, SIL.z], [1, 0, 0]);
    const Ls = SIL.x1 - SIL.x0;
    W.disc("gen.silencer0", F, 0, 3, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.disc("gen.silencer.band0", F, 3, 3.6, SIL.r + 0.2, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.disc("gen.silencer1", F, 3.6, Ls - 3.6, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.disc("gen.silencer.band1", F, Ls - 3.6, Ls - 3, SIL.r + 0.2, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.disc("gen.silencer2", F, Ls - 3, Ls, SIL.r, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    // 굴뚝: 소음기 오른쪽 끝 → 위로
    W.disc("gen.stackbase", G.frameAlong([SIL.x1, SIL.y, SIL.z], [1, 0, 0]), 0, 2.4, 1.6, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.cyl("gen.stack", SIL.x1 + 3.4, SIL.y, 1.5, SIL.z - 1.5, 13, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
    W.cyl("gen.raincap", SIL.x1 + 3.4, SIL.y, 1.9, SIL.z + 11.5, 0.6, { cls: "pw-steel", tone: "mid", info: "gen-stack" });
  }
  // 지붕 들어 올림 고리 4개
  for (const [x, y] of k.corners({ x: GEN.x + 0.6, y: GEN.y + 0.6, w: GEN.w - 1.2, d: GEN.d - 1.2, r: 0.5 }, 2)) W.box(`gen.rooflug${x}${y}`, { x: x - 0.8, y: y - 0.3, w: 1.6, d: 0.6, r: 0.1 }, zb, 1.5, { cls: "pw-gen", tone: "mid", steps: 1, info: "gen", stamp: "rooflug" });
  return SIL;
}
const SIL = generator();
const STACK_TOP = [SIL.x1 + 3.4, SIL.y, SIL.z + 12.1];

// ---------- 11) 발전기 → ATS 콘듀잇 12개 (도랑 창 속) ----------
{
  const T = TRENCH;
  const clip = trenchWindow("pw-gen", T, SLAB, "conduits");
  // 12개를 한 줄로 (콘크리트 타설 전 바닥에 깐 모습: 위에서 하나하나 셀 수 있음), PVC 5인치
  //   발전기 쪽(+y)에서 ATS 쪽(−y)으로 전류가 흐름
  for (let c = 0; c < BLOCK.genConduits; c++) {
    const x = T.x + 1.4 + c * 1.55, z = T.pit + 0.62;
    cable(`gen.duct${c}`, [[x, T.y + T.d, z], [x, T.y, z]], 0.6, { cls: "pw-pvc", tone: "mid", flow: "gen", maxLength: 70, bundle: "gen-duct", info: "conduits", clip, fillet: false, touch: ["stand.pw-gen.floor"] });
  }
}

// ---------- 12) MER (전기실: 걸어 들어가는 방) ----------
function mer() {
  const z0 = SLAB, Y = MER.y + MER.d, X = MER.x + MER.w, zt = z0 + 1.5 + MER_H;
  W.box("mer.skid", { x: MER.x - 0.5, y: MER.y - 0.5, w: MER.w + 1, d: MER.d + 1, r: 0.2 }, z0, 1.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "mer" });
  const seams = []; for (let x = MER.x + 8; x < X - 1; x += 8) seams.push(x);
  W.box("mer.body", MER, z0 + 1.5, MER_H, { cls: "pw-mer", tone: "mid", steps: 2, info: "mer",
    inner: L(frontSeams(Y, seams, z0 + 1.5, zt), { tone: "faint" }) + L(rightSlots(X, MER.y + 4, MER.y + 12, z0 + 6, 4, 1.4, 0.6), { tone: "lo" }) });
  W.box("mer.roof", { x: MER.x - 1, y: MER.y - 1, w: MER.w + 2, d: MER.d + 2, r: 0.3 }, zt, 1.2, { cls: "pw-mer", tone: "mid", steps: 2, info: "mer" });
  // 문 + 손잡이 + 위 등 + 계단 받침 (철판 + 디딤 2단)
  const D = { x: MER.x + 10, w: 9, h: 20 };
  W.box("mer.door", { x: D.x, y: Y, w: D.w, d: 0.3, r: 0.05 }, z0 + 2.5, D.h, { cls: "pw-mer", tone: "mid", steps: 1, info: "mer-door" });
  W.box("mer.doorhandle", { x: D.x + D.w - 1.8, y: Y + 0.3, w: 1.1, d: 0.5, r: 0.1 }, z0 + 12, 0.5, { cls: "pw-steel", tone: "mid", steps: 1, info: "mer-door" });
  W.box("mer.light", { x: D.x + D.w / 2 - 1.3, y: Y, w: 2.6, d: 1.2, r: 0.2 }, z0 + D.h + 4.5, 1.6, { cls: "pw-grey", tone: "mid", steps: 2, info: "mer-door" });
  W.box("mer.landing", { x: D.x - 2, y: Y + 0.2, w: D.w + 4, d: 5, r: 0.1 }, z0 + 1.5, 1, { cls: "pw-steel", tone: "mid", steps: 1, info: "mer-door" });
  W.box("mer.step", { x: D.x - 1, y: Y + 5.2, w: D.w + 2, d: 2.4, r: 0.1 }, z0, 0.9, { cls: "pw-steel", tone: "mid", steps: 1, info: "mer-door" });
  // 오른쪽 끝면의 냉방기 (상자 + 팬 원)
  W.box("mer.hvac", { x: X, y: MER.y + 15, w: 3.4, d: 11, r: 0.3 }, z0 + 12, 12, { cls: "pw-grey", tone: "mid", steps: 2, info: "mer-hvac",
    extra: L(k.sideRing([X + 3.4, MER.y + 20.5, z0 + 18], 3.6, "x", P, 28) + k.sideRing([X + 3.4, MER.y + 20.5, z0 + 18], 1.1, "x", P, 16), { tone: "lo" }) });
  // ATS 에서 오는 굵은 검정 케이블 3가닥: 땅에서 올라와(받침 슬리브) 앞면 왼쪽 인입 상자로
  W.box("mer.entry", { x: MER.x + 2, y: Y, w: 6, d: 2.2, r: 0.2 }, z0 + 13, 5, { cls: "pw-grey", tone: "mid", steps: 2, info: "mer-feed" });
  W.box("mer.sleeve", { x: MER.x + 1.6, y: Y + 3.2, w: 6.8, d: 2.4, r: 0.3 }, z0, 1.2, { cls: "pw-concrete", tone: "mid", steps: 2, info: "mer-feed" });
  for (let j = 0; j < 3; j++) {
    const x = MER.x + 3.2 + j * 1.8;
    cable(`mer.feed${j}`, [[x, Y + 4.4, z0 + 1.2], [x, Y + 4.4, z0 + 8], [x, Y + 1.1, z0 + 11], [x, Y + 1.1, z0 + 13]], 0.5, { flow: "load", bundle: "mer", info: "mer-feed", bend: 1.6, maxLength: 6 });
  }
}
mer();

// ---------- 13) 보호 기둥 (노랑, 차량 충돌 방지) ----------
for (const [x, y, z] of [[-4, 33, 0], [33, 33, SLAB], [96, 22, SLAB], [130, 22, SLAB]]) {
  W.cyl(`bollard${x}${y}`, x, y, 1.1, z, 10, { cls: "pw-yellow", tone: "mid", info: "bollard", stamp: `bollard${z}` });
  W.cyl(`bollard.cap${x}${y}`, x, y, 1.15, z + 10, 0.5, { cls: "pw-yellow", tone: "mid", info: "bollard", stamp: "bcap" });
}

// ---------- 그리기 (칠하는 순서 = 광선으로 잰 앞뒤) ----------
const body = W.render();

// 짚을 곳 (둘러보기 순서 = 전기가 흐르는 순서). fx, fy = 그림 칸 안 비율
// z = 그 부품을 볼 때의 확대 배율 (작은 부품일수록 크게)
const PART_STOPS = [
  { key: "hv", p: [HV_TRENCH.x + 14, HV_TRENCH.y + 4.5, HV_TRENCH.pit + 1], z: 2.6 },
  { key: "xfmr", p: [XF.x + 12, XF.y + 9, SLAB + 12], z: 2.3 },
  { key: "ladder", p: [44, 6, LADDER.z + 1], z: 2.3 },
  { key: "ats-blade", p: [PHASE_X[1], PIVOT.y + 1.5, PIVOT.z], z: 4.2, side: "left" },
  { key: "gen", p: [60, GEN.y + GEN.d, SLAB + GEN_TANK + 14], z: 1.9 },
  { key: "conduits", p: [TRENCH.x + 8, TRENCH.y + 30, TRENCH.pit + 1], z: 2.5 },
  { key: "gen-aux", p: [GEN.x + GEN.w, GEN.y + 7, SLAB + GEN_TANK + 5], z: 3.2 },
  { key: "mer", p: [MER.x + 30, MER.y + MER.d, SLAB + 16], z: 2.2 },
  { key: "feeder", p: [111, 2, HOOD.z + 2], z: 2.8 },
  { key: "pdu", p: [RACK0 + 13 * RACK_W + 5.4, RACK_Y + 1.25, HALL.floor + 12], z: 3.6, side: "left" },
  { key: "server", p: [RACK0 + 7 * RACK_W + 3, RACK_Y + RACK_D + 0.25, SRV_Z0 + 2 * SRV_H + 2.6], z: 3.4 },
  { key: "intake", p: [186, 0, 6.5], z: 2.6 },
  { key: "fanwall", p: [214, FAN.y + FAN.d, 28], z: 2.6 },
];
// 정전 장면: 단계마다 짚을 곳 (말풍선에 그 단계 설명) — ATS 표시등 → 발전기 제어반(기동·배기) → 칼날 → 콘듀잇 …
const LAMP_P = [SECTIONS[0] + 4.9, ATS.y + ATS.d + 0.3, ATS_Z + ATS_H - 4];
const PANEL_P = [104.5, GEN.y + GEN.d, SLAB + GEN_TANK + 20.4];
const BLADE_P = [PHASE_X[1], PIVOT.y + 1.5, PIVOT.z];
const DUCT_P = [TRENCH.x + 10, TRENCH.y + 30, TRENCH.pit + 1];
const PHASE_STOPS = [["outage", LAMP_P], ["crank", PANEL_P], ["transfer", BLADE_P], ["gen", DUCT_P], ["restore", LAMP_P], ["retransfer", BLADE_P], ["cooldown", PANEL_P]]
  .map(([phase, p]) => ({ key: `ph-${phase}`, phase, p, z: 2.1, side: p === BLADE_P ? "left" : undefined }));
const STOPS = [...PART_STOPS, ...PHASE_STOPS].map((s) => { const [x, y] = at(s.p); return { key: s.key, fx: +(x / WIDTH).toFixed(4), fy: +(y / HEIGHT).toFixed(4), z: s.z, ...(s.side ? { side: s.side } : {}) }; });
const PHASE_STOP = Object.fromEntries(PHASE_STOPS.map((s, i) => [s.phase, PART_STOPS.length + i]));   // 단계 이름 → 짚을 곳 번호
const PLAN = tourPlan(PART_STOPS.length);
const puffAt = at(STACK_TOP);

// ---------- 글 (한/영) ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const A_HV = Math.round(AMPS.hv), A_LV = Math.round(AMPS.lv / 100) * 100, V_PH = Math.round(PHASE_V);
const RATIO = Math.round((BLOCK.hvKv * 1000) / BLOCK.lvV);   // 34,500 ÷ 480 ≈ 72 (전압비 = 전류비의 역수)
const INFO = {
  base: ["모형 받침 · 앞 모서리 자: 작은 눈금 1 m, 큰 눈금 5 m (실제 비율)", "Model base · edge ruler: 1 m ticks, 5 m majors (true scale)"],
  pad: ["세그먼트 패드 · 장비를 받치는 콘크리트, 아래로 콘듀잇이 지나감", "Segment pad · concrete under the gear; conduits run beneath it"],
  hv: [`34.5 kV 인입 · 현장 변전소에서 땅속 관으로 들어옴 · 2.5 MW 를 보내도 약 ${A_HV} A`, `34.5 kV feed · underground from the on-site substation · only about ${A_HV} A for 2.5 MW`],
  xfmr: [`강압 변압기 · 34.5 kV → 480 V (3상 480Y/277) · 전압이 1/${RATIO} 로 낮아지는 만큼 전류는 ${RATIO}배: 약 ${A_HV} A → ${fmt(A_LV)} A`, `Step-down transformer · 34.5 kV → 480 V (480Y/277) · voltage falls ${RATIO}×, so current rises ${RATIO}×: about ${A_HV} A → ${fmt(A_LV)} A`],
  "xfmr-hv": ["변압기 1차 단자함 · 34.5 kV 케이블이 아래에서 들어옴", "Primary compartment · the 34.5 kV cables enter from below"],
  ground: ["접지봉 · 변압기 탱크를 땅에 연결", "Ground rod · bonds the transformer tank to earth"],
  ladder: ["케이블 래더 · 변압기 위로 나온 480 V 케이블이 벽을 따라 ATS·배전반으로", "Cable ladder · 480 V leaves the transformer top and rides along the wall to the ATS"],
  ats: ["ATS·배전반 · 벽에 붙은 긴 회색 줄 (계통 인입 | ATS | 배전 | 피더)", "ATS / switchboard · the long grey lineup on the hall wall (incoming | ATS | distribution | feeders)"],
  "ats-in": ["계통 인입 칸 · 래더로 온 변압기 480 V 를 받음", "Incoming section · takes the transformer's 480 V from the ladder"],
  "ats-blade": ["ATS 전환 접점 · 평소엔 계통(위), 정전이면 발전기를 기동해 아래(발전기)로 넘기고 복전되면 되돌림", "ATS contacts · normally on the utility (up); on an outage it starts the generator and throws down to it, then back when power returns"],
  "ats-n": ["계통(N) 접점 · 변압기 쪽 전원", "Normal (N) contacts · the transformer side"],
  "ats-e": ["발전기(E) 접점 · 콘듀잇 12개로 온 발전기 전원", "Emergency (E) contacts · the generator side, via 12 conduits"],
  "ats-contact": ["절연 받침 · 접점을 뒤판에서 띄워 고정", "Insulator · holds a contact off the back panel"],
  "ats-operator": ["전환 조작기 · 축을 돌려 세 상의 접점을 한꺼번에 옮김", "Transfer operator · turns the shaft so all three phases move together"],
  "ats-lamps": ["전원 표시등 · 초록 = 계통 있음, 주황 = 발전기 준비", "Source lamps · green = utility available, amber = generator ready"],
  "ats-dist": ["배전 칸 · 차단기로 MER 등 하류에 나눠 보냄", "Distribution section · breakers feed the MER and other loads"],
  "ats-feed": ["피더 칸 · 홀로 가는 굵은 케이블이 위로 나감", "Feeder section · the heavy cables to the hall leave from the top"],
  gen: [`2.5 MW 디젤 발전기 · 480 V 에서 약 ${fmt(A_LV)} A · 세그먼트마다 1대`, `2.5 MW diesel generator · about ${fmt(A_LV)} A at 480 V · one per segment`],
  "gen-intake": ["흡기 루버 · 엔진과 라디에이터가 쓸 공기", "Intake louvers · air for the engine and radiator"],
  "gen-panel": ["발전기 제어반 · 초록 등 = 운전 중", "Generator controller · green lamp = running"],
  "gen-estop": ["비상정지 단추", "Emergency stop"],
  "gen-stack": ["배기 소음기·굴뚝 · 기동하면 배기가 나옴", "Exhaust silencer and stack · puffs when it starts"],
  "gen-aux": ["발전기 보조 회로 · 기동 신호·상태 감시·블록 히터·배터리 충전기 · 매켄지 겨울에도 바로 기동하도록 엔진을 데워 둠", "Generator auxiliaries · start signal, monitoring, block heater and battery charger · keeps the engine warm for a fast start in Mackenzie winters"],
  tank: ["기초 연료 탱크 · 발전기 밑에 디젤을 담음 (주유구·레벨 게이지)", "Sub-base fuel tank · diesel under the generator (fill box, level gauge)"],
  conduits: [`콘듀잇 ${BLOCK.genConduits}개 · 발전기 약 ${fmt(A_LV)} A 를 나눠 보내는 관 다발 (패드를 잘라 보여 줌)`, `${BLOCK.genConduits} conduits · the generator's ~${fmt(A_LV)} A split over a bundle (pad cut away)`],
  mer: ["MER (전기실) · 세그먼트의 하류 배전·제어·감시 · UPS 도 있을 것으로 추정", "MER (electrical room) · downstream distribution, controls and monitoring · likely a UPS"],
  "mer-door": ["MER 출입문·계단", "MER door and steps"],
  "mer-hvac": ["MER 냉방기 · 전기실 장비를 식힘", "MER air conditioner · keeps the gear cool"],
  "mer-feed": ["MER 전원 · ATS 에서 땅속으로 온 굵은 검정 케이블", "MER feed · heavy black cables from the ATS, underground"],
  feeder: ["홀 피더 · ATS 에서 벽 관통 상자를 지나 홀 배전반으로", "Hall feeders · from the ATS through the wall box to the hall panel"],
  wall: ["데이터홀 벽 · 오른쪽은 허물어 안을 보여 줌 (빗금 = 잘린 면)", "Data-hall wall · broken away on the right to show inside (hatching = cut)"],
  door: ["홀 출입문", "Hall door"],
  lamp: ["벽등", "Wall light"],
  hall: ["데이터홀 안 · 지붕을 떼어 냄 (실제 지붕엔 원통형 배기구가 줄지어 있음)", "Inside the data hall · roof removed (the real roof has rows of round exhaust stacks)"],
  "hall-floor": ["데이터홀 바닥 · 파랑 = 찬 통로(서버 앞), 주황 = 뜨거운 통로(서버 뒤) — 설명을 위해 칠한 색", "Hall floor · blue = cold aisle (server fronts), orange = hot aisle (server backs) — coloured for explanation"],
  intake: [`흡기 루버 · 바깥의 찬 공기가 루버·필터로 들어와 찬 통로로 · BC 의 서늘한 공기를 그대로 써서 평균 PUE ${SITE.pue} (회사 홈페이지)`, `Intake louvers · cool outside air enters through louvers and filters into the cold aisle · free air cooling, average PUE ${SITE.pue} (company website)`],
  fanwall: ["배기 팬 벽 · 서버를 지나며 데워진 공기를 뜨거운 통로에서 밖으로 내보냄 (프린스조지 홀 사진의 팬 벽)", "Exhaust fan wall · pulls the air warmed by the servers out of the hot aisle (as in the Prince George hall photo)"],
  netlad: ["통신 케이블 사다리 (찬 통로 위) · 서버 앞면의 광케이블로 이어짐 (매켄지 홀 사진)", "Network cable ladder over the cold aisle · feeds the fibre at the server fronts (as in the Mackenzie hall photos)"],
  rpp: ["홀 배전반 · 랙마다 전원을 나눔 (모양은 예시)", "Hall power panel · splits power to the racks (illustrative)"],
  tray: ["전원 트레이 (뜨거운 통로 위) · 홀 배전반에서 랙마다 전원 코드를 내림 (모양은 예시)", "Power tray over the hot aisle · drops a cord to each rack from the hall panel (illustrative)"],
  pdu: [`랙 PDU (랙 뒤) · 480 V 3상의 한 상(${V_PH} V)을 서버 전원 공급기에 바로 → 홀 안에 2차 변압기가 없음 · 이 랙은 옆판을 떼어 보여 줌`, `Rack PDU at the back · servers run on one phase of 480 V (${V_PH} V) directly, so no second transformer · side panel removed on this rack`],
  server: [`공랭 B300 GPU 서버 (Dell 은색 앞면, 녹색 광케이블) · 앞으로 찬 공기를 빨아들여 뒤로 내보냄 · 랙당 ${EST.serversPerRack}대 = GPU ${EST.gpusPerRack}개 (사이트 가정, 회사 사진의 랙에도 4대 안팎)`, `Air-cooled B300 GPU servers (Dell, silver fronts, green fibre) · pull cool air in at the front, push it out the back · ${EST.serversPerRack} per rack = ${EST.gpusPerRack} GPUs (site assumption; company photos show about four per rack)`],
  rack: [`랙 · 1대 약 ${EST.rackKw} kW (GPU ${EST.gpusPerRack}개 × ${EST.kwPerGpu.toFixed(1)} kW, 가정) — 회사가 밝힌 최대 랙 밀도 ${SITE.rackMaxKw} kW 안 · 이 블록 하나가 약 ${EST.racks}대(GPU 약 ${fmt(EST.gpus)}개, 추정) · 그림은 한 줄 일부`, `Rack · about ${EST.rackKw} kW each (${EST.gpusPerRack} GPUs × ${EST.kwPerGpu.toFixed(1)} kW, assumption) — within the company's stated ${SITE.rackMaxKw} kW maximum rack density · one block feeds about ${EST.racks} racks (~${fmt(EST.gpus)} GPUs, estimate) · drawing shows part of one row`],
  bollard: ["보호 기둥 · 차량 충돌 방지", "Bollard · vehicle protection"],
};
const PHASE_TEXT = {
  normal: [`계통 전력 · 34.5 kV 약 ${A_HV} A → 변압기 → 480 V 약 ${fmt(A_LV)} A`, `Utility power · 34.5 kV ≈ ${A_HV} A → transformer → 480 V ≈ ${fmt(A_LV)} A`],
  outage: ["정전 · ATS 가 계통 전압이 사라진 걸 확인하고 발전기에 기동 신호", "Outage · the ATS sees the utility drop and signals the generator to start"],
  crank: ["발전기 기동 중 · 전압·주파수가 설 때까지 (보통 10초 안팎)", "Generator starting · until voltage and frequency settle (typically ~10 s)"],
  transfer: ["전환 · 접점이 계통(N)에서 발전기(E)로", "Transfer · contacts move from utility (N) to generator (E)"],
  gen: [`발전기 전력 · 480 V 약 ${fmt(A_LV)} A · 콘듀잇 ${BLOCK.genConduits}개`, `Generator power · 480 V ≈ ${fmt(A_LV)} A · ${BLOCK.genConduits} conduits`],
  restore: ["복전 · 계통이 안정될 때까지 발전기로 버팀 (실제로는 몇 분)", "Utility back · stays on the generator until it is stable (minutes in practice)"],
  retransfer: ["되돌림 · 접점이 다시 계통(N)으로", "Retransfer · contacts back to the utility (N)"],
  cooldown: ["발전기 무부하 냉각 후 정지", "Generator cools down unloaded, then stops"],
};
for (const [phase, text] of Object.entries(PHASE_TEXT)) INFO[`ph-${phase}`] = text;
const ICON_IN = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const ICON_OUT = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const zoomText = (ko) => ({
  in: ICON_IN + `<span>${ko ? "확대" : "Zoom"}</span>`, out: ICON_OUT + `<span>${ko ? "전체 보기" : "Full view"}</span>`,
  aria: ko ? ["전력 블록 그림: 변전소에서 GPU 서버까지 전기가 흐르는 길을 저절로 확대해 하나씩 짚고, 정전 때 ATS 가 발전기로 넘어가는 모습을 보여 줍니다. + 키나 확대 단추로 직접 확대할 수 있습니다", "확대: 포인터나 화살표 키로 둘러보고, Esc 로 전체 보기"]
    : ["Power block: an automatic tour zooms along the path from the substation to the GPU servers, then shows the ATS moving to the generator during an outage. Press + or the zoom button to zoom yourself", "Zoomed: look around with the pointer or arrow keys; Escape for the full view"],
  hint: ko ? "확대 중 · 부품을 가리키거나 탭하면 바로 옆에 설명이 뜹니다" : "zoomed · point at or tap a part to see what it is right beside it",
});

// ---------- 페이지 ----------
const CSS = readFileSync(join(HERE, "power.css"), "utf8").replaceAll("__ASPECT__", (WIDTH / HEIGHT).toFixed(3));   // 그림 가로:세로 비율을 CSS 에 넘김
// 움직임 코드 = 공용 확대·말풍선(shared/zoomer.js) + 이 그림의 움직임(live.js)
const LIVE = readFileSync(join(HERE, "..", "shared", "zoomer.js"), "utf8") + readFileSync(join(HERE, "live.js"), "utf8");
const DATA = { W: WIDTH, H: HEIGHT, zoom: 2.4, focus: at([90, 10, 20]).map(r1), stops: STOPS, parts: PART_STOPS.length, phaseStop: PHASE_STOP, plan: PLAN, puff: puffAt.map(r1) };

// 자리표(__이름__) 채우기: 함수로 바꿔 넣어야 값 속의 $ 기호가 특수 문자로 해석되지 않음
const fill = (src, values) => src.replace(/__([A-Z]+)__/g, (all, name) => (name in values ? values[name] : all));

function page(ko) {
  const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: ko ? "매켄지 데이터홀 세그먼트 1칸(2.5 MW 전력 블록)의 전력 경로 모형" : "Model of one Mackenzie data-hall segment (a 2.5 MW power block)", body: `<defs>${CLIPS.join("")}</defs>${BASE_SVG}${body}<g class="pw-puffs" aria-hidden="true"></g>`, className: "pw-svg" });
  const title = ko ? `전력 경로 · 매켄지 세그먼트 1칸 = ${BLOCK.mw} MW` : `Power path · one Mackenzie segment = ${BLOCK.mw} MW`;
  const sub = ko ? `홀 1개 = ${BLOCK.perHall}칸 = ${BLOCK.mw * BLOCK.perHall} MW · 이 블록 ≈ 랙 ${EST.racks}대 · GPU ${fmt(EST.gpus)}개 (추정)` : `one hall = ${BLOCK.perHall} segments = ${BLOCK.mw * BLOCK.perHall} MW · this block ≈ ${EST.racks} racks · ${fmt(EST.gpus)} GPUs (estimate)`;
  const zt = zoomText(ko);
  const keys = ko
    ? [["pw-k-flow", "전류가 흐르는 길"], ["pw-k-lit", "ATS 전환 접점 (움직이는 부분)"], ["pw-k-cold", "찬 통로 (서버 앞)"], ["pw-k-hot", "뜨거운 통로 (서버 뒤)"], ["pw-k-cut", "잘라 보여 준 면"]]
    : [["pw-k-flow", "current flowing"], ["pw-k-lit", "ATS contacts (the moving part)"], ["pw-k-cold", "cold aisle (server fronts)"], ["pw-k-hot", "hot aisle (server backs)"], ["pw-k-cut", "cut-away faces"]];
  const caption = ko
    ? `배치·전압·발전기 2.5 MW·콘듀잇 ${BLOCK.genConduits}개·MER 은 매켄지 현장을 분석한 제3자 스레드(<a href="${SOURCE.url}" target="_blank" rel="noreferrer">${SOURCE.by}, ${SOURCE.posted}</a>, ${SOURCE.filmed} 드론 영상) 기준이며 회사가 확인한 내용이 아닙니다. 홀 안은 IREN 홈페이지의 <a href="${SITE.pages[0]}" target="_blank" rel="noreferrer">매켄지</a>·<a href="${SITE.pages[1]}" target="_blank" rel="noreferrer">프린스조지</a> 공랭 홀 사진을 보고 그림(흡기 → 찬 통로 → 랙 앞면 → 뜨거운 통로 → 배기 팬 벽, 평균 PUE ${SITE.pue}·최대 랙 밀도 ${SITE.rackMaxKw} kW 는 같은 페이지). 설명을 위해 지붕·벽을 잘라 냈고, 랙은 한 줄 일부만, 통로 바닥 색·케이블 가닥 수·홀 배전반과 트레이 모양은 그림 표현. GPU·랙 수는 사이트 가정(GPU 1개당 ${EST.kwPerGpu.toFixed(1)} kW, 랙당 ${EST.gpusPerRack}개)으로 계산한 추정. 정전·전환 시간은 압축해서 보여 줌. ${SOURCE.filmed} 영상 기준 이 칸들은 장비 설치·케이블 당김까지 — 다음은 종단 → 시험 → 로드뱅크 시운전 → 가동.`
    : `Layout, voltages, the 2.5 MW generator, the ${BLOCK.genConduits} conduits and the MER follow a third-party analysis of the Mackenzie site (<a href="${SOURCE.url}" target="_blank" rel="noreferrer">${SOURCE.by}, ${SOURCE.posted}</a>, drone footage of ${SOURCE.filmed}); not company-confirmed. The hall interior is drawn from IREN's own <a href="${SITE.pages[0]}" target="_blank" rel="noreferrer">Mackenzie</a> and <a href="${SITE.pages[1]}" target="_blank" rel="noreferrer">Prince George</a> air-cooled hall photos (intake → cold aisle → rack fronts → hot aisle → exhaust fan wall; average PUE ${SITE.pue} and ${SITE.rackMaxKw} kW maximum rack density from the same pages). Roof and walls are cut away for explanation, only part of one rack row is shown, and aisle floor colours, cable counts, the hall panel and trays are illustrative. GPU and rack counts are estimates from the site's assumptions (${EST.kwPerGpu.toFixed(1)} kW per GPU, ${EST.gpusPerRack} per rack). Outage timing is compressed. As of the ${SOURCE.filmed} footage these segments had gear set and cables pulled — next: termination → testing → load-bank commissioning → live.`;
  return `<!doctype html><html lang="${ko ? "ko" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${k.ISO_CSS}${CSS}</style></head>
<body class="iso pw-body" data-theme="light"><main class="pw-page">
<div class="rk-fig pw-fig">
  <div class="rk-head"><h2>${title} <small>${sub}</small></h2><button class="rk-zoom" type="button" data-zoom="pw" data-call aria-pressed="false">${zt.in}</button></div>
  <div class="rk-stage pw-stage" data-fig="power" tabindex="0" role="group" aria-label="${zt.aria[0]}">${svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')}<span class="rk-aim" aria-hidden="true"></span><div class="rk-tip"><b></b><span></span></div></div>
  <div class="rk-read" data-readout="power">${PHASE_TEXT.normal[ko ? 0 : 1]}</div>
  <div class="pw-legend">${keys.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>
  <p class="pw-caption">${caption}</p>
</div></main>
<script>(function(){${fill(LIVE, { DATA: JSON.stringify(DATA), KO: ko ? "true" : "false", INFO: JSON.stringify(INFO), PHASE: JSON.stringify(PHASE_TEXT), ZOOM: JSON.stringify(zt), STATE: stateAt.toString() })}})();</script>
</body></html>`;
}
mkdirSync(join(ROOT, "public", "figures"), { recursive: true });
for (const ko of [true, false]) {
  const file = join(ROOT, "public", "figures", `power-block.${ko ? "ko" : "en"}.html`);
  writeFileSync(file, page(ko));
  console.log(`wrote ${file.replace(ROOT + "/", "")} (${(readFileSync(file).length / 1024).toFixed(0)} KB) · ${R.items.length} items · ${WIDTH}×${HEIGHT}`);
}
// 검사 예외 (4배 확대로 직접 보고 판단한 것만):
//   cover: 칼날 그림 9장 중 하나만 보이므로 기록 모양(N 위치)보다 넓게 그려짐
//   crowd: 래더·트레이·통신 사다리 안에서 나란히 눕거나 끝나는 케이블과 레일, 이웃 랙의 PDU 코드끼리, 발전기 끝 보조관과 도랑 벽(깊이로 31 떨어짐),
//          ATS 위 피더 시작점과 얇은 홀 바닥판(깊이로 55 떨어짐 — 바닥판이 얇아 막대로 취급됨)
auditAll({ power: W }, { power: {
  cover: ["ats.blade0", "ats.blade1", "ats.blade2"],
  crowd: [["lv.run*", "ladder.rail*"], ["net.cable*", "net.rail*"], ["drop*", "pdu*"], ["drop*", "drop*"], ["branch.up*", "tray.rail*"], ["gen.auxconduit*", "stand.pw-gen.*"], ["feeder.out*", "hall.floor"]],
} });
