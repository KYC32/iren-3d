// =============================================================
// build.mjs — "스위트워터 1" 그림: 이미 통전된 1.4 GW 변전소(뼈대)에서 1단계 액체냉각 홀까지 (anatomy 스킬 방식)
// -------------------------------------------------------------
// "물건이 곧 설명": 전기가 내려오는 계단을 그대로 세움
//   ERCOT 345 kV 송전선 → 인입 가대·애자 → 단로기 → 차단기 → 345 kV 모선 → 대형 변압기(345 → 138 kV) 2대 + 비워 둔 자리
//   → 138 kV 케이블(도랑) → 1차 변압기(138 → 34.5 kV) → 34.5 kV 케이블 → 홀: 34.5 kV 배전반 → 정류기(→ 800 V 직류) → 직류 배전반 → 800 V 버스웨이
//   → Vera Rubin 랙 (45 °C 물) → CDU → 벽 밖 배관 → 건식 냉각기만 (칠러 없음) → 펌프 → 다시 CDU
// 둘러보기: 부품을 차례로 짚은 뒤 ① 더운 오후 39 °C 에도 칠러 없이 ② 비워 둔 자리에 다음 단계가 붙는 모습(흐린 그림)
// 숫자·출처·시간표는 model.mjs (회사 자료 + NVIDIA 공개 발언). 홀 안 설계는 미공개 → 그림 표현
//
// 사용법: node scripts/anatomy/sweetwater/build.mjs           (그림 만들기)
//         node scripts/anatomy/sweetwater/build.mjs --audit   (+ 관통·끝점·칠하는 순서 검사)
//   → public/figures/sweetwater-1.ko.html / sweetwater-1.en.html (3D 스위트워터 1 화면에서 1단계 건물을 누르면 열림)
// 단위: 1 = 20 cm (변전소 설비는 실제보다 작게, 거리는 크게 줄인 모형). x = 오른쪽, y = 보는 쪽(+y), z = 위
// =============================================================
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { workshop, auditAll } from "../rack/shop.mjs";
import { figureTools, r1 } from "../shared/tools.mjs";
import { SITE, AMPS, SHARE, WATER, TEMP, SOURCES, DSX, DC_V, NO_CHILLER_MAX, COPPER, RUBIN, coolest, tourPlan, stateAt, scaleLadder } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

// ---------- 세계 배치 ----------
const BASE = { x: -46, y: -94, w: 346, d: 130, r: 3 };       // 받침판: x −46..300, y −94..36
const YARD = { x0: -40, x1: 190, y0: -88, y1: 22 };            // 변전소 자갈 마당 (울타리 안 · 앞쪽은 앞으로 더 들일 자리)
const GZ = 0.8;                                                 // 자갈 두께
const PH = [-62, -55, -48];                                     // 세 상(A·B·C)의 y (실제 간격보다 좁힘)
const LINE = { x0: -46, z: 40 };                                // 송전선 (받침판 왼쪽 끝 = ERCOT 쪽)
const GANTRY = { x: -34, y0: -70, y1: -40, z: 46 };             // 인입 가대 (기둥 2 + 들보)
const STRING = { z0: 44, len: 5.4 };                            // 매단 애자 (들보 → 아래)
const DS = { x: [-29, -25], z0: 8, z1: 15.4 };                  // 단로기 (애자 2 + 칼날)
const CB = { x0: -22, x1: -12, z: 9, r: 1.4, inX: -20.5, outX: -13.5 };   // 차단기 탱크 (가스 절연)
const BUS = { z: 32, r: 0.45, x0: CB.outX, x1: 140, posts: [-8, 2.5, 50.5, 98.5, 137.5] };  // 345 kV 모선 + 받침 자리 (패드 끝 띠 위 · 틈은 케이블 헤드 몫)
const XF = { w: 36, y: -66, d: 22, z0: 2.4, z1: 18, xs: [4, 52] };              // 대형 변압기 탱크 2대 (345 → 138 kV)
const SPARE = { x: 100, w: 36 };                                // 비워 둔 세 번째 자리 (다음 단계)
const TP = { x: 150, w: 26, y: -64, d: 18, z0: 2.2, z1: 13 };   // 1차 변압기 (138 → 34.5 kV)
const CTRL = { x: -36, y: -6, w: 24, d: 20, h: 12 };            // 제어동 (앞마당 왼쪽, 진입로 옆)
const MASTS = [[-38, -86], [62, -86], [142, -86]];              // 피뢰 기둥
const MAST_H = 54;
const TR1 = { x: 36, y: -38, w: 116, d: 6, pit: GZ - 2.8 };     // 138 kV 케이블 도랑 (변압기 앞)
const TR2 = { x: 179, y: -62, w: 9, d: 13, pit: GZ - 2.8 };      // 34.5 kV 케이블 도랑 (1차 변압기 오른쪽 → 울타리 → 홀)
// 홀 (오른쪽): 앞벽(y −3..0)을 낮게 허물고 지붕을 뗌
const HALL = { x0: 198, x1: 296, y0: -88, y1: -3, floor: 1.2 };
const WALL = { t: 3, low: 5 };
const SLAB = 1.6;                                               // 앞마당 콘크리트 패드

const WIDTH = 1000;
const EXTREMES = [...k.boxCorners(BASE, -13, 0), ...MASTS.map(([x, y]) => [x, y, MAST_H]), [GANTRY.x, GANTRY.y0, GANTRY.z]];
const AZ = 47, EL = 31;
const unit = k.fitProjection(EXTREMES, 1000, 1000, { pad: 0, azimuth: AZ, elevation: EL });
const box0 = EXTREMES.map((p) => k.iso(p, unit));
const aspect = (Math.max(...box0.map((p) => p[0])) - Math.min(...box0.map((p) => p[0]))) / (Math.max(...box0.map((p) => p[1])) - Math.min(...box0.map((p) => p[1])));
const HEIGHT = Math.round((WIDTH - 24) / aspect + 24);
const P = k.fitProjection(EXTREMES, WIDTH, HEIGHT, { pad: 12, azimuth: AZ, elevation: EL });

const W = workshop(P, { piece: "sw" });
const T = figureTools({ W, P, piece: "sw" });
const { R } = W;
const { at, L, Dt, seg, poly, pathOf3, frontSlots, rightSlots, frontSeams, rightSeams, frontRules, range, hatch, cutFace, minus, frames, lamp, cable, faceFlow, reach, teeGaps, fitting, turned, shedProfile, trenchWindow } = T;
const UP = (p) => G.frameAlong(p, [0, 0, 1]);                   // 위로 선 축
const DOWN = (p) => G.frameAlong(p, [0, 0, -1]);                // 아래로 매단 축

// ---------- 0) 받침판 ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -13, 13, P)}"/>`];
  for (const [x, y] of k.corners(BASE, 10)) out.push(`<g class="pw-base">${k.solidSvg(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, -13, 4, P, 3), { tone: "lo" })}</g>`);
  const rx0 = Math.ceil((BASE.x + 10) / 10) * 10, rx1 = Math.floor((BASE.x + BASE.w - 10) / 10) * 10;
  const ticks = k.topTicks(rx0, rx1, 10, 5, BASE.y + BASE.d - 4, 0, [1.6, 3.2], P, "x");
  const inner = L(k.planOutline(k.insetPlan(BASE, 7), 0, P, 3), { tone: "faint" })
    + L(seg([rx0, BASE.y + BASE.d - 4, 0], [rx1, BASE.y + BASE.d - 4, 0]), { tone: "lo" })
    + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" });
  out.push(`<g class="pw-base">${k.solidSvg(k.slabOf(BASE, -9, 9, P, 4, 0.8), { tone: "lo", inner })}</g>`);
  const plate = { x0: 112, x1: 138, z0: -7, z1: -2 }, Y = BASE.y + BASE.d;
  out.push(`<g class="pw-steel">${k.solidSvg(k.slabOf({ x: plate.x0, y: Y, w: plate.x1 - plate.x0, d: 0.4, r: 0.2 }, plate.z0, plate.z1 - plate.z0, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(L([0, 1, 2].map((i) => seg([plate.x0 + 4, Y + 0.4, plate.z1 - 1.2 - i * 1.2], [plate.x0 + (i === 0 ? 20 : 15 - i * 2), Y + 0.4, plate.z1 - 1.2 - i * 1.2])).join(""), { tone: "lo", free: true }));
  out.push(Dt([[plate.x0 + 1.6, plate.z0 + 1], [plate.x1 - 1.6, plate.z0 + 1], [plate.x0 + 1.6, plate.z1 - 1], [plate.x1 - 1.6, plate.z1 - 1]].map(([x, z]) => at([x, Y + 0.4, z])), { size: 0.45, tone: "mid" }));
  // 기록: 받침판(도랑 자리를 뺀 조각들 + 도랑 바닥 아래). 그림은 맨 아래 층으로 먼저 칠함
  const holes = [TR1, TR2].map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.d, pit: t.pit }));
  minus({ x0: BASE.x, x1: BASE.x + BASE.w, y0: BASE.y, y1: BASE.y + BASE.d }, holes).forEach((r) => R.solid(A.box([r.x0, r.y0, -9], [r.x1, r.y1, 0], { name: "stand.base" })));
  holes.forEach((h) => R.solid(A.box([h.x0, h.y0, -9], [h.x1, h.y1, Math.min(0, h.pit) - 0.45], { name: "stand.base" })));
  return `<g data-info="base">${out.join("")}</g>`;
}
const BASE_SVG = base();

// 변전소 자갈 마당 (도랑 자리를 비워 조각으로, 윗면에 자갈 점) · 앞마당 콘크리트 패드 · 진입로
function grounds() {
  const holes = [TR1, TR2].map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.d }));
  // 도랑 자리를 뺀 조각들: y 띠로 나눔 → 이음선이 도랑 앞뒤 선의 연장에만 생기고 앞마당은 한 장
  const tr = (r) => ({ x0: r.y0, x1: r.y1, y0: r.x0, y1: r.x1 });     // x ↔ y 바꿔 minus 를 쓰고 되돌림
  minus(tr(YARD), holes.map(tr)).map(tr).forEach((p, i) => {
    const dots = [];
    for (let x = p.x0 + 2.5; x < p.x1 - 1; x += 5) for (let y = p.y0 + 2.5; y < p.y1 - 1; y += 5) dots.push(at([x + ((y * 7) % 3) * 0.6, y, GZ]));
    W.box(`gravel.${i}`, { x: p.x0, y: p.y0, w: p.x1 - p.x0, d: p.y1 - p.y0, r: 0.2 }, 0, GZ, { cls: "sw-gravel", tone: "lo", steps: 1, info: "yard", extra: Dt(dots, { size: 0.28, tone: "lo" }) });
  });
  // 앞마당 패드 (홀 앞: 건식 냉각기·배관) — 도랑 TR2 와는 겹치지 않음
  W.box("pad.front", { x: 192, y: 0, w: 106, d: 34, r: 0.3 }, 0, SLAB, { cls: "pw-concrete", tone: "lo", steps: 2, info: "pad",
    inner: L(seg([245, 0, SLAB], [245, 34, SLAB]) + seg([192, 17, SLAB], [298, 17, SLAB]), { tone: "faint" }) });
  // 진입로 (아스팔트 띠) — 마당 앞을 따라
  // 가운데 차선 = 칠한 면 (얇은 칠 조각, 선이 아님)
  const lane = range(-36, 182, 12).map((x) => `<path class="sw-lane" d="${poly([[x, 26.05, 0.4], [x + 6, 26.05, 0.4], [x + 6, 26.45, 0.4], [x, 26.45, 0.4]])}"/>`).join("");
  W.box("road", { x: -44, y: 22.5, w: 234, d: 7.5, r: 0.2 }, 0, 0.4, { cls: "sw-asphalt", tone: "lo", steps: 1, info: "road", inner: lane });
}
grounds();

// 울타리 (마당 앞·오른쪽): 기둥 + 위 난간 + 철망 빗금 (기둥과 난간 사이에서 끝남)
function fence() {
  const H = 9, step = 12, z0 = GZ;
  const front = range(YARD.x0 + 1, YARD.x1 - 1, step), side = range(YARD.y0 + 1, YARD.y1 - 1, step);
  front.forEach((x, i) => W.cyl(`fence.f${i}`, x, YARD.y1 - 0.5, 0.3, z0, H, { cls: "pw-steel", tone: "mid", info: "fence", stamp: "fpost" }));
  side.forEach((y, i) => W.cyl(`fence.s${i}`, YARD.x1 - 0.5, y, 0.3, z0, H, { cls: "pw-steel", tone: "mid", info: "fence", stamp: "fpost" }));
  // 철망: 앞면 칸마다 X 빗금, 오른쪽 면 칸마다 X 빗금 → 위 난간·아래 끝선에서 끝남
  const Y = YARD.y1 - 0.5, X = YARD.x1 - 0.5, mesh = [];
  for (let i = 0; i < front.length - 1; i++) { const a = front[i] + 0.3, b = front[i + 1] - 0.3; mesh.push(seg([a, Y, z0 + 0.5], [b, Y, z0 + H - 0.5]), seg([a, Y, z0 + H - 0.5], [b, Y, z0 + 0.5]), seg([a, Y, z0 + 0.5], [b, Y, z0 + 0.5]), seg([a, Y, z0 + H - 0.5], [b, Y, z0 + H - 0.5])); }
  for (let i = 0; i < side.length - 1; i++) { const a = side[i] + 0.3, b = side[i + 1] - 0.3; mesh.push(seg([X, a, z0 + 0.5], [X, b, z0 + H - 0.5]), seg([X, a, z0 + H - 0.5], [X, b, z0 + 0.5]), seg([X, a, z0 + 0.5], [X, b, z0 + 0.5]), seg([X, a, z0 + H - 0.5], [X, b, z0 + H - 0.5])); }
  W.put("fence.mesh", [YARD.x1 - 30, YARD.y1 - 0.5, z0 + H / 2], `<g class="sw-mesh">${L(mesh.join(""), { tone: "faint" })}</g>`,
    [R.solid(A.box([YARD.x0 + 1, YARD.y1 - 0.55, z0 + 0.5], [YARD.x1 - 1, YARD.y1 - 0.45, z0 + H - 0.5], { name: "fence.mesh" }))], { info: "fence", bias: 0.05 });
}
fence();

// ---------- 1) ERCOT 345 kV 송전선 → 인입 가대 → 매단 애자 ----------
// 가대: 철골 기둥 2개(앞면에 X 가새) + 들보, 들보에서 상마다 애자 줄이 내려오고 아래 끝 쇠붙이(공)에 전선이 물림
function gantry() {
  const z0 = GZ, { x, y0, y1, z } = GANTRY, colW = 2;
  for (const [y, nm] of [[y0, "a"], [y1 - colW, "b"]]) {
    const braces = [];
    for (let zz = z0 + 1; zz < z - 6; zz += 6) braces.push(seg([x - 1, y + colW, zz], [x + 1, y + colW, zz + 6]), seg([x + 1, y + colW, zz], [x - 1, y + colW, zz + 6]), seg([x - 1, y + colW, zz], [x + 1, y + colW, zz]));
    W.box(`gantry.col${nm}`, { x: x - 1, y, w: 2, d: colW, r: 0.05 }, z0, z - 2.4 - z0, { cls: "sw-lattice", tone: "mid", steps: 1, info: "gantry", stamp: "gcol", inner: L(braces.join(""), { tone: "lo" }) });
  }
  const beamBr = [];
  for (let yy = y0 + 2; yy < y1 - 4; yy += 4) beamBr.push(seg([x - 1, yy, z - 2.4], [x - 1, yy + 4, z]), seg([x - 1, yy, z], [x - 1, yy + 4, z - 2.4]));
  W.box("gantry.beam", { x: x - 1.2, y: y0 - 0.5, w: 2.4, d: y1 - y0 + 1, r: 0.05 }, z - 2.4, 2.4, { cls: "sw-lattice", tone: "mid", steps: 1, info: "gantry", inner: L(rightSeams(x + 1.2, [y0 + 2, y1 - 2], z - 2.4, z), { tone: "lo" }) });
  PH.forEach((y, i) => {
    const top = z - 2.4;
    turned(`string${i}`, DOWN([x, y, top]), shedProfile(STRING.len, 0.35, 1.1, 6), { cls: "sw-glass", info: "string", stamp: "string" });
    fitting(`string${i}.clamp`, [x, y, top - STRING.len - 0.5], 0.6, { cls: "pw-steel", info: "string" });
  });
}
gantry();
const CLAMP_Z = GANTRY.z - 2.4 - STRING.len - 0.5;              // 애자 줄 아래 쇠붙이 가운데 높이
PH.forEach((y, i) => {
  // 송전선: 받침판 끝(ERCOT 쪽)에서 애자 줄 아래 쇠붙이까지 (살짝 처짐)
  const c = [GANTRY.x, y, CLAMP_Z], e = reach(0.6, 0.3), z0 = LINE.z + 1.2;
  cable(`line${i}`, [[LINE.x0, y, z0], [LINE.x0 + 1.4, y, z0], [LINE.x0 + 7, y, LINE.z - 0.4], [c[0] - e, y, CLAMP_Z]], 0.3, { cls: "sw-conductor", flow: "pw", info: "line", bend: 6, maxLength: 8 });
  // 송전선은 받침판 끝 평면에서 잘라 보여 줌 (이어지는 철탑은 그림 밖) → 잘린 면이 전선 끝을 받음
  W.disc(`stand.cut.line${i}`, G.frameAlong([LINE.x0, y, z0], [-1, 0, 0]), 0, 0.08, 0.32, { cls: "sw-cut", tone: "mid", info: "line" });
});

// ---------- 2) 단로기 (애자 2 + 칼날) → 차단기 (가스 절연 탱크 + 부싱 2) ----------
const DS_TOP = DS.z1 + 0.6;                                     // 칼날 윗면
function switches() {
  PH.forEach((y, i) => {
    for (const [j, x] of DS.x.entries()) {
      W.box(`ds${i}.base${j}`, { x: x - 0.8, y: y - 0.8, w: 1.6, d: 1.6, r: 0.1 }, GZ, DS.z0 - GZ, { cls: "pw-steel", tone: "mid", steps: 1, info: "ds", stamp: "ds-base" });
      turned(`ds${i}.ins${j}`, UP([x, y, DS.z0]), shedProfile(DS.z1 - DS.z0, 0.4, 1.0, 5), { cls: "sw-porcelain", info: "ds", stamp: "ds-ins" });
    }
    W.box(`ds${i}.blade`, { x: DS.x[0] - 0.6, y: y - 0.35, w: DS.x[1] - DS.x[0] + 1.2, d: 0.7, r: 0.1 }, DS.z1, 0.6, { cls: "pw-tin", tone: "mid", steps: 1, info: "ds", stamp: "ds-blade" });
    // 차단기: 받침 다리 · 탱크(가로 원통) · 부싱 2 (들어옴 · 나감) · 부싱 위 단자
    W.box(`cb${i}.frame`, { x: CB.x0 + 1, y: y - 1.2, w: CB.x1 - CB.x0 - 2, d: 2.4, r: 0.1 }, GZ, CB.z - CB.r - GZ, { cls: "pw-steel", tone: "mid", steps: 1, info: "breaker", stamp: "cb-frame" });
    W.disc(`cb${i}.tank`, G.frameAlong([CB.x0, y, CB.z], [1, 0, 0]), 0, CB.x1 - CB.x0, CB.r, { cls: "sw-tank", tone: "mid", info: "breaker", stamp: "cb-tank" });
    for (const [j, bx] of [[0, CB.inX], [1, CB.outX]]) {
      turned(`cb${i}.bush${j}`, UP([bx, y, CB.z + CB.r - 0.1]), shedProfile(9, 0.45, 1.05, 7), { cls: "sw-porcelain", info: "breaker", stamp: "cb-bush" });
      W.box(`cb${i}.term${j}`, { x: bx - 0.5, y: y - 0.5, w: 1, d: 1, r: 0.1 }, CB.z + CB.r - 0.1 + 9, 0.5, { cls: "pw-tin", tone: "mid", steps: 1, info: "breaker", stamp: "cb-term" });
    }
    // 내려온 선: 애자 쇠붙이 → 단로기 왼쪽 끝 / 단로기 오른쪽 끝 → 차단기 들어오는 부싱 단자
    const e = reach(0.6, 0.25), cbTop = CB.z + CB.r - 0.1 + 9.5;
    cable(`drop${i}`, [[GANTRY.x, y, CLAMP_Z - e], [GANTRY.x, y, DS_TOP + 4], [DS.x[0] - 0.2, y, DS_TOP + 1.5], [DS.x[0] - 0.2, y, DS_TOP]], 0.25, { cls: "sw-conductor", flow: "pw", info: "ds", bend: 1.6, maxLength: 8 });
    cable(`jump${i}`, [[DS.x[1] + 0.2, y, DS_TOP], [DS.x[1] + 0.2, y, cbTop + 2.2], [CB.inX, y, cbTop + 2.2], [CB.inX, y, cbTop]], 0.25, { cls: "sw-conductor", flow: "pw", info: "breaker", bend: 1.2, maxLength: 8 });
  });
  // 조작함 (세 상의 차단기를 함께 여닫는 기구)
  W.box("cb.mech", { x: CB.x0 + 2, y: PH[0] - 6, w: 5, d: 3, r: 0.2 }, GZ, 6, { cls: "pw-grey", tone: "mid", steps: 1, info: "breaker",
    inner: L(frontSeams(PH[0] - 3, [CB.x0 + 4.5], GZ, GZ + 6), { tone: "lo" }) });
}
switches();
const CB_TOP = CB.z + CB.r - 0.1 + 9.5;                         // 차단기 부싱 단자 윗면

// ---------- 3) 345 kV 모선 (관형 알루미늄 3가닥) + 받침 애자 + T 이음쇠 ----------
// 모선은 차단기 나가는 부싱 바로 위에서 시작해 비워 둔 자리 너머까지 (다음 단계가 여기에 붙음)
const TEE_B = 0.8;                                              // 모선 이음쇠 공 반지름
const HV_X = XF.xs.map((x) => x + 4);                           // 변압기마다 345 kV 부싱 x
const BUSHV = { z0: XF.z1, len: 10.5 };                         // 345 kV 부싱 (탱크 윗면 → 위)
function bus345() {
  const z = BUS.z, x0 = BUS.x0, posts = BUS.posts;
  PH.forEach((y, i) => {
    // T 자리: 변압기 부싱 위 2곳 + 비워 둔 자리 1곳(다음 단계, 지금은 비어 있음)
    const tees = [...HV_X, SPARE.x + 4];
    const gaps = teeGaps(tees.map((x) => x - x0), TEE_B, BUS.r);
    cable(`bus${i}`, [[x0 + reach(TEE_B, BUS.r), y, z], [BUS.x1, y, z]], BUS.r, { cls: "sw-alu", flow: "pw", fw: 1.1, fillet: false, maxLength: 30, info: "bus345", gaps, touch: ["bpost*"] });
    fitting(`bus${i}.start`, [x0, y, z], TEE_B, { cls: "sw-alu", info: "bus345" });
    tees.forEach((x, j) => fitting(`bus${i}.tee${j}`, [x, y, z], TEE_B, { cls: "sw-alu", owner: `bus${i}`, info: "bus345" }));
    W.disc(`bus${i}.cap`, G.frameAlong([BUS.x1, y, z], [1, 0, 0]), 0, 0.5, BUS.r + 0.25, { cls: "sw-alu", tone: "mid", info: "bus345" });
    // 차단기 나가는 부싱 단자 → 모선 시작 공
    cable(`riser${i}`, [[CB.outX, y, CB_TOP], [CB.outX, y, z - reach(TEE_B, 0.25)]], 0.25, { cls: "sw-conductor", flow: "pw", info: "bus345", fillet: false, maxLength: 12 });
    // 받침: 철골 기둥 + 애자 (모선 밑면에 닿음)
    posts.forEach((px, j) => {
      const pz = px < XF.xs[0] - 3 ? GZ : XF.z0;                  // 패드 위에 선 받침은 패드 윗면에서 시작
      W.box(`bpost${i}.${j}`, { x: px - 0.7, y: y - 0.7, w: 1.4, d: 1.4, r: 0.1 }, pz, 20 - pz, { cls: "sw-lattice", tone: "mid", steps: 1, info: "bus345", stamp: `bpost${pz}` });
      turned(`bpost${i}.ins${j}`, UP([px, y, 20]), shedProfile(z - BUS.r - 20, 0.4, 1.0, 8), { cls: "sw-porcelain", info: "bus345", stamp: "bpost-ins" });
    });
  });
}
bus345();

// ---------- 4) 대형 변압기 2대 (345 → 138 kV) + 비워 둔 세 번째 자리 ----------
// 탱크 · 앞면 방열판 · 345 kV 부싱 3(왼쪽 끝, 모선 바로 밑) · 138 kV 부싱 3(오른쪽 끝) · 보존 탱크 · 제어함(이름판)
//   138 kV 는 부싱 → 케이블 헤드(받침대 위 애자) → 땅속 케이블 → 앞의 도랑 → 1차 변압기
const LV_X = (x) => x + 32, HEAD_X = (x) => x + 42;            // 138 kV 부싱 x · 케이블 헤드 x (패드 사이 틈 가운데)
const BUSLV = { len: 6 };
const HEAD = { stand: 11, len: 7 };                             // 케이블 헤드 받침대 높이 · 애자 길이
function transformer(id, x) {
  const { y, d, z0, z1, w } = XF, F = y + d;
  W.box(`${id}.pad`, { x: x - 3, y: y - 3, w: w + 6, d: d + 8, r: 0.3 }, GZ, z0 - GZ, { cls: "pw-concrete", tone: "lo", steps: 2, info: "xfmr", stamp: "xf-pad",
    inner: L(k.planOutline({ x: x - 2.2, y: y - 2.2, w: w + 4.4, d: d + 6.4, r: 0.2 }, z0, P, 2), { tone: "faint" }) });
  W.box(`${id}.tank`, { x, y, w, d, r: 0.6 }, z0, z1 - z0, { cls: "sw-xfmr", tone: "mid", steps: 2, bevel: 0.5, info: "xfmr", stamp: "xf-tank",
    inner: L(k.sideSeam({ x, y, w, d, r: 0.6 }, z1 - 1.4, P, 2), { tone: "lo" }) });
  // 방열판: 앞면에 얇은 판 11장 + 위아래 헤더
  for (let j = 0; j < 11; j++) W.box(`${id}.fin${j}`, { x: x + 2 + j * 2, y: F, w: 0.35, d: 4, r: 0.05 }, z0 + 2, 12, { cls: "sw-xfmr", tone: "mid", steps: 1, info: "xfmr-rad", stamp: "xf-fin" });
  for (const zz of [z0 + 1.5, z0 + 14.5]) W.disc(`${id}.hdr${zz}`, G.frameAlong([x + 1.6, F + 2, zz], [1, 0, 0]), 0, 21.2, 0.45, { cls: "sw-xfmr", tone: "mid", info: "xfmr-rad", stamp: `xf-hdr${zz}` });
  // 제어함 + 이름판 (그림에 넣는 유일한 글자)
  W.box(`${id}.box`, { x: x + 26, y: F, w: 7, d: 1.4, r: 0.15 }, z0 + 2, 9, { cls: "pw-grey", tone: "mid", steps: 1, info: "xfmr", stamp: id === "t1" ? undefined : "xf-box",
    inner: L(frontSeams(F + 1.4, [x + 29.5], z0 + 2, z0 + 11), { tone: "lo" }),
    extra: id === "t1" ? k.faceTextSvg(k.sideMatrix([x + 26.6, F + 1.4], z0 + 9.6, P, "left"), "345/138kV", { size: 0.95, tone: "hi" }) : "" });
  // 부싱: 받침 통(turret) + 갓 달린 애자 + 단자
  PH.forEach((py, i) => {
    W.cyl(`${id}.hvt${i}`, x + 4, py, 1.2, z1, 1.2, { cls: "sw-xfmr", tone: "mid", info: "xfmr-hv", stamp: "xf-hvt" });
    turned(`${id}.hv${i}`, UP([x + 4, py, z1 + 1.2]), shedProfile(BUSHV.len, 0.5, 1.15, 9), { cls: "sw-porcelain", info: "xfmr-hv", stamp: "xf-hv" });
    W.box(`${id}.hvterm${i}`, { x: x + 3.5, y: py - 0.5, w: 1, d: 1, r: 0.1 }, z1 + 1.2 + BUSHV.len, 0.5, { cls: "pw-tin", tone: "mid", steps: 1, info: "xfmr-hv", stamp: "xf-hvterm" });
    W.cyl(`${id}.lvt${i}`, LV_X(x), py, 0.9, z1, 1, { cls: "sw-xfmr", tone: "mid", info: "xfmr-lv", stamp: "xf-lvt" });
    turned(`${id}.lv${i}`, UP([LV_X(x), py, z1 + 1]), shedProfile(BUSLV.len, 0.4, 0.9, 5), { cls: "sw-porcelain", info: "xfmr-lv", stamp: "xf-lv" });
    W.box(`${id}.lvterm${i}`, { x: LV_X(x) - 0.45, y: py - 0.45, w: 0.9, d: 0.9, r: 0.1 }, z1 + 1 + BUSLV.len, 0.45, { cls: "pw-tin", tone: "mid", steps: 1, info: "xfmr-lv", stamp: "xf-lvterm" });
    // 케이블 헤드: 받침대 + 애자 + 단자 (138 kV 케이블이 아래로 땅속에 들어감)
    W.box(`${id}.hstand${i}`, { x: HEAD_X(x) - 0.8, y: py - 0.8, w: 1.6, d: 1.6, r: 0.1 }, GZ, HEAD.stand - GZ, { cls: "sw-lattice", tone: "mid", steps: 1, info: "head", stamp: "head-stand" });
    turned(`${id}.head${i}`, UP([HEAD_X(x), py, HEAD.stand]), shedProfile(HEAD.len, 0.42, 0.95, 5), { cls: "sw-porcelain", info: "head", stamp: "head-ins" });
    W.box(`${id}.hterm${i}`, { x: HEAD_X(x) - 0.45, y: py - 0.45, w: 0.9, d: 0.9, r: 0.1 }, HEAD.stand + HEAD.len, 0.45, { cls: "pw-tin", tone: "mid", steps: 1, info: "head", stamp: "head-term" });
    // 이어 주는 선: 345 kV 모선 T 이음쇠 → 부싱 단자 / 138 kV 부싱 단자 → 케이블 헤드 단자
    const hvTop = z1 + 1.2 + BUSHV.len + 0.5, lvTop = z1 + 1 + BUSLV.len + 0.45, hdTop = HEAD.stand + HEAD.len + 0.45;
    cable(`${id}.drop${i}`, [[x + 4, py, BUS.z - reach(TEE_B, 0.25)], [x + 4, py, hvTop]], 0.25, { cls: "sw-conductor", flow: "pw", info: "xfmr-hv", fillet: false, maxLength: 6 });
    cable(`${id}.lvj${i}`, [[LV_X(x), py, lvTop], [LV_X(x), py, lvTop + 1.2], [HEAD_X(x), py, lvTop + 1.2], [HEAD_X(x), py, hdTop]], 0.25, { cls: "sw-conductor", flow: "pw", info: "xfmr-lv", bend: 1.4, maxLength: 6 });
  });
  // 보존 탱크 (기름이 늘고 줄 자리) + 받침 2
  for (const bx of [x + 12, x + 24]) W.box(`${id}.cbr${bx}`, { x: bx - 0.5, y: y + 1.2, w: 1, d: 1.6, r: 0.1 }, z1, 3.8, { cls: "sw-xfmr", tone: "mid", steps: 1, info: "xfmr", stamp: "xf-cbr" });
  W.disc(`${id}.cons`, G.frameAlong([x + 9, y + 2, z1 + 5.4], [1, 0, 0]), 0, 18, 1.6, { cls: "sw-xfmr", tone: "mid", info: "xfmr-cons", stamp: "xf-cons" });
}
XF.xs.forEach((x, i) => transformer(`t${i + 1}`, x));

// 비워 둔 세 번째 자리: 기초 패드 · 기름받이 턱 · 미리 묻은 관 끝 3 (다음 단계 변압기가 여기에) + 흐린 다음 단계 그림
function spare() {
  const { x, w } = SPARE, { y, d, z0, z1 } = XF;
  W.box("spare.pad", { x: x - 3, y: y - 3, w: w + 6, d: d + 8, r: 0.3 }, GZ, z0 - GZ, { cls: "pw-concrete", tone: "lo", steps: 2, info: "spare", stamp: "xf-pad",
    inner: L(k.planOutline({ x: x - 2.2, y: y - 2.2, w: w + 4.4, d: d + 6.4, r: 0.2 }, z0, P, 2) + k.planOutline({ x, y, w, d, r: 0.6 }, z0, P, 2), { tone: "faint" }) });
  PH.forEach((py, i) => W.cyl(`spare.stub${i}`, HEAD_X(x), py, 0.7, GZ, 1.2, { cls: "sw-pvc", tone: "mid", info: "spare", stamp: "spare-stub" }));
  // 다음 단계 (흐린 그림): 탱크 · 부싱 3 · 모선에서 내려오는 선 — 둘러보기 '다음 단계' 장면에서만 드러남
  const ghost = k.solidSvg(k.slabOf({ x, y, w, d, r: 0.6 }, z0, z1 - z0, P, 2), { tone: "mid" })
    + PH.map((py) => k.solidSvg(k.cylinder(x + 4, py, 0.9, z1, BUSHV.len + 1.2, P, 16), { tone: "mid" }) + L(seg([x + 4, py, z1 + BUSHV.len + 1.2], [x + 4, py, BUS.z - TEE_B]), { tone: "mid" })).join("");
  W.put("spare.ghost", [x + w / 2, y + d / 2, (z0 + z1) / 2], `<g class="sw-ghost" aria-hidden="true">${ghost}</g>`,
    [R.solid(A.box([x, y, z0], [x + w, y + d, z1], { name: "spare.ghost", ground: true }))], { info: "spare", bias: 0.2 });
}
spare();

// 앞마당: 다음 단계 1차 변압기(138 → 34.5 kV) 자리 2곳 · 기초 패드 + 묻어 둔 관 끝 (흐린 그림은 '다음 단계' 장면에서만)
const FUTURE = { xs: [56, 100], y: -24, w: 26, d: 18 };
function futurePads() {
  FUTURE.xs.forEach((x, i) => {
    const { y, w, d } = FUTURE, z0 = TP.z0, z1 = TP.z1;
    W.box(`future${i}.pad`, { x: x - 2, y: y - 2, w: w + 4, d: d + 7, r: 0.3 }, GZ, z0 - GZ, { cls: "pw-concrete", tone: "lo", steps: 2, info: "future", stamp: "future-pad",
      inner: L(k.planOutline({ x, y, w, d, r: 0.5 }, z0, P, 2), { tone: "faint" }) });
    PH.forEach((_, j) => W.cyl(`future${i}.stub${j}`, x + 6 + j * 7, y - 0.4, 0.6, z0, 1, { cls: "sw-pvc", tone: "mid", info: "future", stamp: "future-stub" }));
    const ghost = k.solidSvg(k.slabOf({ x, y, w, d, r: 0.5 }, z0, z1 - z0, P, 2), { tone: "mid" })
      + [0, 1, 2].map((j) => k.solidSvg(k.cylinder(x + 3 + j * 4, y + 4, 0.7, z1, 5, P, 14), { tone: "mid" })).join("");
    W.put(`future${i}.ghost`, [x + w / 2, y + d / 2, (z0 + z1) / 2], `<g class="sw-ghost" aria-hidden="true">${ghost}</g>`,
      [R.solid(A.box([x, y, z0], [x + w, y + d, z1], { name: `future${i}.ghost`, ground: true }))], { info: "future", bias: 0.2 });
  });
}
futurePads();

// ---------- 5) 138 kV 케이블 도랑 (변압기 앞, 덮개를 떼어 냄) ----------
{
  const clip = trenchWindow("sw-tr1", TR1, GZ, "cable138");
  // 변압기마다 3가닥: 북쪽 벽(케이블 헤드 쪽)에서 들어와 동쪽 끝(1차 변압기 쪽)으로. T2 는 벽 가까운 줄, T1 은 먼 줄 (서로 엇갈리지 않게)
  XF.xs.forEach((x, t) => PH.forEach((_, j) => {
    const x0 = HEAD_X(x) - 1.2 + j * 1.2, lane = TR1.y + (t === 1 ? 1.0 : 3.7) + (2 - j) * 0.85, zc = TR1.pit + 0.5;
    cable(`c138.${t}${j}`, [[x0, TR1.y, zc], [x0, lane, zc], [TR1.x + TR1.w, lane, zc]], 0.32, { cls: "pw-black", flow: "pw", info: "cable138", bend: 0.9, maxLength: 30, clip, bundle: "c138", touch: ["stand.sw-tr1.floor"] });
  }));
}

// ---------- 6) 1차 변압기 (138 → 34.5 kV) + 138 kV 케이블 헤드 + 34.5 kV 케이블 상자 + 도랑 ----------
function primary() {
  const { x, y, w, d, z0, z1 } = TP, F = y + d;
  W.box("tp.pad", { x: x - 2, y: y - 2, w: w + 4, d: d + 7, r: 0.3 }, GZ, z0 - GZ, { cls: "pw-concrete", tone: "lo", steps: 2, info: "primary" });
  W.box("tp.tank", { x, y, w, d, r: 0.5 }, z0, z1 - z0, { cls: "sw-xfmr", tone: "mid", steps: 2, bevel: 0.4, info: "primary" });
  for (let j = 0; j < 8; j++) W.box(`tp.fin${j}`, { x: x + 2 + j * 2.2, y: F, w: 0.35, d: 3.2, r: 0.05 }, z0 + 1.6, 8, { cls: "sw-xfmr", tone: "mid", steps: 1, info: "primary", stamp: "tp-fin" });
  for (const zz of [z0 + 1.1, z0 + 10.1]) W.disc(`tp.hdr${zz}`, G.frameAlong([x + 1.6, F + 1.6, zz], [1, 0, 0]), 0, 16.6, 0.4, { cls: "sw-xfmr", tone: "mid", info: "primary", stamp: `tp-hdr${zz}` });
  PH.forEach((py, i) => {
    // 138 kV 부싱 (왼쪽 끝) ← 케이블 헤드 (변압기 왼쪽, 도랑 끝에서 올라온 케이블)
    turned(`tp.hv${i}`, UP([x + 3, py, z1]), shedProfile(6, 0.4, 0.9, 5), { cls: "sw-porcelain", info: "primary", stamp: "tp-hv" });
    W.box(`tp.hvterm${i}`, { x: x + 2.55, y: py - 0.45, w: 0.9, d: 0.9, r: 0.1 }, z1 + 6, 0.45, { cls: "pw-tin", tone: "mid", steps: 1, info: "primary", stamp: "tp-hvterm" });
    W.box(`tp.hstand${i}`, { x: x - 4.8, y: py - 0.8, w: 1.6, d: 1.6, r: 0.1 }, GZ, HEAD.stand - GZ, { cls: "sw-lattice", tone: "mid", steps: 1, info: "head", stamp: "head-stand" });
    turned(`tp.head${i}`, UP([x - 4, py, HEAD.stand]), shedProfile(HEAD.len, 0.42, 0.95, 5), { cls: "sw-porcelain", info: "head", stamp: "head-ins" });
    W.box(`tp.hterm${i}`, { x: x - 4.45, y: py - 0.45, w: 0.9, d: 0.9, r: 0.1 }, HEAD.stand + HEAD.len, 0.45, { cls: "pw-tin", tone: "mid", steps: 1, info: "head", stamp: "head-term" });
    const hdTop = HEAD.stand + HEAD.len + 0.45, hvTop = z1 + 6.45;
    cable(`tp.in${i}`, [[x - 4, py, hdTop], [x - 4, py, hdTop + 1.6], [x + 3, py, hdTop + 1.6], [x + 3, py, hvTop]], 0.25, { cls: "sw-conductor", flow: "pw", info: "primary", bend: 1.2, maxLength: 6 });
  });
  // 34.5 kV 케이블 상자 (오른쪽 끝면): 케이블이 아래로 나가 도랑으로
  W.box("tp.mvbox", { x: x + w, y: y + 2, w: 2.4, d: d - 4, r: 0.2 }, z0 + 2, 8, { cls: "pw-grey", tone: "mid", steps: 1, info: "primary-mv",
    inner: L(rightSeams(x + w + 2.4, [y + 2 + (d - 4) / 2], z0 + 2, z0 + 10), { tone: "lo" }) });
  const clip = trenchWindow("sw-tr2", TR2, GZ, "cable34");
  [0, 1, 2].forEach((j) => {
    const yy = TR2.y + 3 + j * 3.4, zc = TR2.pit + 0.55;
    cable(`c34.${j}`, [[TR2.x, yy, zc], [TR2.x + TR2.w, yy, zc]], 0.45, { cls: "pw-black", flow: "pw", info: "cable345", fillet: false, maxLength: 20, clip, bundle: "c34", touch: ["stand.sw-tr2.floor"] });
  });
}
primary();

// ---------- 7) 제어동 · 피뢰 기둥 ----------
function controlHouse() {
  const { x, y, w, d, h } = CTRL, z0 = GZ, Y = y + d, X = x + w;
  W.box("ctrl.slab", { x: x - 1, y: y - 1, w: w + 2, d: d + 2, r: 0.2 }, z0, 0.8, { cls: "pw-concrete", tone: "lo", steps: 1, info: "control" });
  W.box("ctrl.body", { x, y, w, d, r: 0.2 }, z0 + 0.8, h, { cls: "sw-house", tone: "mid", steps: 1, info: "control",
    inner: L(frontSeams(Y, range(x + 4, X - 4, 4), z0 + 0.8, z0 + 0.8 + h), { tone: "faint" }) + L(rightSlots(X, y + 4, y + 9, z0 + 6, 3, 1.2, 0.5), { tone: "lo" }) });
  W.box("ctrl.roof", { x: x - 0.6, y: y - 0.6, w: w + 1.2, d: d + 1.2, r: 0.2 }, z0 + 0.8 + h, 0.8, { cls: "sw-house", tone: "mid", steps: 1, info: "control" });
  W.box("ctrl.door", { x: x + 6, y: Y, w: 4.4, d: 0.3, r: 0.05 }, z0 + 0.8, 9.6, { cls: "pw-grey", tone: "mid", steps: 1, info: "control" });
  W.box("ctrl.handle", { x: x + 9.4, y: Y + 0.3, w: 0.5, d: 0.4, r: 0.05 }, z0 + 5, 1.2, { cls: "pw-steel", tone: "mid", steps: 1, info: "control" });
  W.box("ctrl.hvac", { x: X, y: y + 11, w: 2.6, d: 6, r: 0.2 }, z0 + 4, 6, { cls: "pw-grey", tone: "mid", steps: 1, info: "control",
    extra: L(k.sideRing([X + 2.6, y + 14, z0 + 7], 2, "x", P, 22), { tone: "lo" }) });
}
controlHouse();
MASTS.forEach(([x, y], i) => {
  W.box(`mast${i}.base`, { x: x - 1.4, y: y - 1.4, w: 2.8, d: 2.8, r: 0.2 }, GZ, 1, { cls: "pw-concrete", tone: "mid", steps: 1, info: "mast", stamp: "mast-base" });
  W.cyl(`mast${i}`, x, y, 0.5, GZ + 1, MAST_H - 3 - GZ - 1, { cls: "sw-lattice", tone: "mid", info: "mast", stamp: "mast" });
  W.cyl(`mast${i}.tip`, x, y, 0.18, MAST_H - 3, 3, { cls: "pw-steel", tone: "mid", info: "mast", stamp: "mast-tip" });
});

// ---------- 8) 1단계 홀 (지붕을 떼고 앞벽을 낮게 허묾) ----------
const RACK0 = 252, RACK_W = 3, RACKS = 12, RACK_Y = -59, RACK_D = 5.3, RACK_H = 11.2;   // Vera Rubin 랙 줄 (뒷면 +y)
const REAR = RACK_Y + RACK_D, RTOP = HALL.floor + RACK_H;                              // 뒷면 y = −53.7, 윗면 12.4
const SUP = { y: -49.4, z: 15.3, r: 0.45 }, RET = { y: -51, z: 16.8, r: 0.45 };        // 천장 2차 냉각수: 공급(앞·아래) · 회수(뒤·위) → 화면에서 둘 다 보임
const MANI_TOP = 11.6;                                                                 // 랙 매니폴드 윗면 (호스가 꽂히는 높이)
const HDR = { x0: 237, x1: 290 };                               // 천장 배관 (왼쪽 끝 = CDU 위 관이 붙는 곳)
const BUSW = { y: -57.5, z: 17.25, w: 1.2, h: 1.6, x0: 244, x1: 290 };                 // 버스웨이
const CDU = { xs: [238, 246], tags: ["a", "b"], y: -13, w: 6, d: 8, h: 11 };            // CDU 2대 (앞벽 가까이, 랙 줄 왼쪽), B 는 앞판을 뗌
const CDU_FRONT = CDU.y + CDU.d, CDU_TOP = HALL.floor + CDU.h;
const TEE_H = 0.6, TEE_R = 0.75;                                 // 천장 배관 T: 호스(0.15) · CDU 관(0.4)
function hallShell() {
  const { x0, x1, y0, y1, floor } = HALL;
  const tiles = [];
  for (let x = x0 + 8; x < x1 - 1; x += 8) tiles.push(seg([x, y0, floor], [x, y1, floor]));
  tiles.push(seg([x0, -30, floor], [x1, -30, floor]));
  W.box("hall.floor", { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.01 }, 0, floor, { cls: "pw-floor", tone: "lo", steps: 1, info: "hall", bias: -50,
    inner: L(tiles.join(""), { tone: "faint" }),
    extra: cutFace([[x1, y0, 0], [x1, y1, 0], [x1, y1, floor], [x1, y0, floor]], hatch(y1 - y0, floor, 2.2, (u, v) => [x1, y0 + u, v])) });
  const t = WALL.t, h = WALL.low;
  W.box("hall.wall", { x: x0, y: -t, w: x1 - x0, d: t, r: 0.01 }, 0, h, { cls: "pw-panel", tone: "lo", steps: 1, info: "wall",
    inner: L(frontSeams(0, range(x0 + 5, x1 - 5, 5), 0, h), { tone: "faint" }),
    extra: cutFace([[x0, -t, h], [x1, -t, h], [x1, 0, h], [x0, 0, h]], hatch(x1 - x0, t, 2.2, (u, v) => [x0 + u, -t + v, h]))
      + cutFace([[x1, -t, 0], [x1, 0, 0], [x1, 0, h], [x1, -t, h]], hatch(t, h, 2.2, (u, v) => [x1, -t + u, v])) });
}
hallShell();

// 홀 전기: 34.5 kV 배전반 3칸 → 정류기 2칸(34.5 kV 교류 → 800 V 직류) → 800 V 직류 배전반 2칸 → 800 V 버스웨이
//   NVIDIA DSX POD 의 800 V 직류 방식을 따라 그림 (회사는 홀 전기 방식을 밝히지 않음 → '회사 확인' 보기에선 하얗게)
//   (교류로 지었다면 홀 변압기(34.5 kV → 저압 교류) · 저압 배전반이 설 자리)
function hallPower() {
  const z0 = HALL.floor, sy = -63, sd = 10, Y = sy + sd, H = 15;
  const CY = -60;                                                 // 위로 잇는 케이블이 지나는 y (윗면 뒤쪽 · 앞쪽엔 정류기 팬)
  for (let i = 0; i < 3; i++) {
    const x = 201 + i * 6;
    W.box(`mvsg${i}`, { x: x + 0.05, y: sy, w: 5.9, d: sd, r: 0.15 }, z0, H, { cls: "pw-grey", tone: "mid", steps: 1, info: "mvsg", stamp: "mvsg",
      inner: L(frontSeams(Y, [], z0, z0 + H) + frontRules(Y, x + 0.6, x + 5.4, [z0 + 7.2]), { tone: "lo" }) });
    W.box(`mvsg${i}.relay`, { x: x + 1.2, y: Y, w: 2.4, d: 0.25, r: 0.05 }, z0 + 10.4, 2, { cls: "hz-screen", tone: "mid", steps: 1, info: "mvsg", stamp: "mvsg-relay" });
    W.box(`mvsg${i}.handle`, { x: x + 4.2, y: Y, w: 0.5, d: 0.4, r: 0.05 }, z0 + 3.4, 1.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "mvsg", stamp: "mvsg-handle" });
  }
  // 정류기 2칸: 몸통 · 앞문(아래쪽 흡기 루버) · 상태 화면 · 손잡이 · 윗면 배기 팬 (반도체 변환기의 열을 위로 빼냄)
  for (let i = 0; i < 2; i++) {
    const x = 222 + i * 6, fx = x + 3, fy = Y - 3.2, ftop = z0 + H + 0.5;   // 팬 가운데 (윗면 앞쪽) · 팬 윗면 높이
    W.box(`rect${i}`, { x: x + 0.05, y: sy, w: 5.9, d: sd, r: 0.15 }, z0, H, { cls: "hz-unit", tone: "mid", steps: 1, info: "rect", stamp: "rect" });
    W.box(`rect${i}.door`, { x: x + 0.45, y: Y, w: 5.1, d: 0.15, r: 0.03 }, z0 + 0.6, H - 1.2, { cls: "hz-unit", tone: "mid", steps: 1, info: "rect", stamp: "rect-door",
      inner: L(frontSlots(Y + 0.15, x + 1.2, x + 4.8, z0 + 1.4, 6, 1.0, 0.4), { tone: "lo" }) });
    W.box(`rect${i}.screen`, { x: x + 1.2, y: Y + 0.15, w: 2.2, d: 0.15, r: 0.04 }, z0 + 10.6, 1.6, { cls: "hz-screen", tone: "mid", steps: 1, info: "rect", stamp: "rect-screen" });
    W.box(`rect${i}.handle`, { x: x + 4.3, y: Y + 0.15, w: 0.5, d: 0.4, r: 0.05 }, z0 + 6.6, 1.8, { cls: "pw-steel", tone: "mid", steps: 1, info: "rect", stamp: "rect-handle" });
    // 팬: 테두리 통 + 고리 2 + 날개 4 (멈춘 그림 · 날개 끝이 두 고리에 닿음) + 축
    const rings = [1.5, 0.55].map((r) => k.planOutline({ x: fx - r, y: fy - r, w: r * 2, d: r * 2, r }, ftop, P, 6)).join("");
    const spokes = [0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2 + Math.PI / 4; return seg([fx + Math.cos(a) * 0.55, fy + Math.sin(a) * 0.55, ftop], [fx + Math.cos(a) * 1.5, fy + Math.sin(a) * 1.5, ftop]); }).join("");
    W.cyl(`rect${i}.fan`, fx, fy, 1.8, z0 + H, 0.5, { cls: "hz-unit", tone: "mid", info: "rect", stamp: "rect-fan", extra: L(rings + spokes, { tone: "lo" }) + Dt([at([fx, fy, ftop])], { size: 0.3, tone: "mid" }) });
  }
  // 800 V 직류 배전반 2칸: 위 칸 = 직류 차단기 3개 (두 극을 한 몸에) · 아래 칸 = 계기 창
  for (let i = 0; i < 2; i++) {
    const x = 237 + i * 6;
    W.box(`dcsb${i}`, { x: x + 0.05, y: sy, w: 5.9, d: sd, r: 0.15 }, z0, H, { cls: "pw-grey", tone: "mid", steps: 1, info: "dcsb", stamp: "dcsb",
      inner: L(frontRules(Y, x + 0.6, x + 5.4, [z0 + 7.2]), { tone: "lo" }) });
    for (let c = 0; c < 3; c++) W.box(`dcsb${i}.brk${c}`, { x: x + 1.05 + c * 1.45, y: Y, w: 0.9, d: 0.35, r: 0.08 }, z0 + 9.0, 2.8, { cls: "pw-dark", tone: "mid", steps: 1, info: "dcsb", stamp: "dcsb-brk" });
    W.box(`dcsb${i}.meter`, { x: x + 1.2, y: Y, w: 2.4, d: 0.25, r: 0.05 }, z0 + 4.0, 1.6, { cls: "hz-screen", tone: "mid", steps: 1, info: "dcsb", stamp: "dcsb-meter" });
  }
  // 위로 잇는 굵은 케이블: 배전반 → 정류기 A (34.5 kV 교류), 정류기 B → 직류 배전반 (800 V 직류), 직류 배전반 → 버스웨이
  //   케이블은 윗면의 글랜드(케이블 인입 판)로 들어감 → 끝이 부품 위에 앉음
  const GL = 0.3, gz = z0 + H + GL, run = gz + 2;                 // 글랜드 두께 · 케이블 끝 높이 · 위로 지나는 높이 (세운 토막 2 → 꺾임이 화면에서 접히지 않음)
  for (const [gx, info] of [[216, "mvsg"], [225, "rect"], [231, "rect"], [238.8, "dcsb"]])
    W.box(`hp.gland${gx}`, { x: gx - 0.55, y: CY - 0.55, w: 1.1, d: 1.1, r: 0.1 }, z0 + H, GL, { cls: "pw-dark", tone: "mid", steps: 1, info, stamp: "hp-gland" });
  cable("mv.in", [[216, CY, gz], [216, CY, run], [225, CY, run], [225, CY, gz]], 0.35, { flow: "pw", info: "mvsg", bend: 1.1, maxLength: 6 });
  cable("dc.in", [[231, CY, gz], [231, CY, run], [238.8, CY, run], [238.8, CY, gz]], 0.35, { flow: "pw", info: "dcsb", bend: 1.1, maxLength: 6 });
  W.box("hp.glandOut", { x: 246 - 0.55, y: BUSW.y - 0.55, w: 1.1, d: 1.1, r: 0.1 }, z0 + H, GL, { cls: "pw-dark", tone: "mid", steps: 1, info: "dcsb", stamp: "hp-gland" });
  cable("dc.out", [[246, BUSW.y, gz], [246, BUSW.y, BUSW.z]], 0.35, { flow: "pw", info: "busway", fillet: false, maxLength: 6 });
  // 버스웨이 (조각마다 흐름 점선)
  const pxPerX = Math.hypot(...[0, 1].map((i) => at([1, BUSW.y, BUSW.z])[i] - at([0, BUSW.y, BUSW.z])[i]));
  const joints = [BUSW.x0, 268, BUSW.x1];
  for (let s = 0; s < joints.length - 1; s++) {
    const a = joints[s], b = joints[s + 1], plan = { x: a, y: BUSW.y - BUSW.w / 2, w: b - a, d: BUSW.w, r: 0.08 }, Yb = BUSW.y + BUSW.w / 2;
    W.box(`busw.${s}`, plan, BUSW.z, BUSW.h, { cls: "hz-bus", tone: "mid", steps: 1, info: "busway", owner: "busw",
      inner: L(k.sideSeam(plan, BUSW.z + 0.4, P, 1) + k.sideSeam(plan, BUSW.z + BUSW.h - 0.4, P, 1), { tone: "faint" }),
      extra: `<path class="pw-flow" data-flow="pw" style="--d0:${r1((a - BUSW.x0) * pxPerX)}px" d="${pathOf3([[a, Yb, BUSW.z + BUSW.h / 2], [b, Yb, BUSW.z + BUSW.h / 2]])}"/>` });
  }
  W.box("busw.joint", { x: 267.6, y: BUSW.y - BUSW.w / 2 - 0.12, w: 0.8, d: BUSW.w + 0.24, r: 0.06 }, BUSW.z - 0.12, BUSW.h + 0.24, { cls: "hz-bus", tone: "mid", steps: 1, info: "busway", owner: "busw" });
  W.box("busw.post", { x: 244.4, y: BUSW.y - 0.3, w: 0.6, d: 0.6, r: 0.05 }, z0 + 15, BUSW.z - z0 - 15, { cls: "pw-steel", tone: "mid", steps: 1, info: "busway" });   // 직류 배전반 위 짧은 받침
}
hallPower();

// ---------- 9) Vera Rubin 랙 줄 (뒷면이 보는 쪽): 매니폴드 · 버스바 · 위 받침대 · 호스 · 탭오프 ----------
function rack(i, x0) {
  const z0 = HALL.floor, plan = { x: x0 + 0.03, y: RACK_Y, w: RACK_W - 0.06, d: RACK_D, r: 0.06 };
  const lines = range(z0 + 1.6, RTOP - 1.6, 0.6).map((z) => seg([x0 + 0.03, REAR, z], [x0 + RACK_W - 0.03, REAR, z]));
  W.box(`rack${i}`, plan, z0, RACK_H, { cls: "hz-rack", tone: "mid", steps: 1, info: "rack", stamp: "rack",
    inner: L(k.sideSeam(plan, RTOP - 0.4, P, 1) + k.sideSeam(plan, z0 + 0.4, P, 1), { tone: "lo" }) + L(lines.join(""), { tone: "lo" }) });
  // 매니폴드 (파랑 공급 · 빨강 회수) + 흐름 / 버스바
  for (const [side, mx, cls, flow] of [["s", 0.25, "hz-blue", "c"], ["r", 2.35, "hz-red", "w"]]) {
    const cx = x0 + mx + 0.2, run = side === "s" ? [[cx, REAR + 0.4, MANI_TOP], [cx, REAR + 0.4, z0 + 1]] : [[cx, REAR + 0.4, z0 + 1], [cx, REAR + 0.4, MANI_TOP]];
    W.box(`mani${side}${i}`, { x: x0 + mx, y: REAR, w: 0.4, d: 0.4, r: 0.06 }, z0 + 0.6, MANI_TOP - z0 - 0.6, { cls, tone: "mid", steps: 1, info: "manifold", stamp: `mani-${side}`,
      extra: faceFlow(flow, run, 0.5) });
  }
  W.box(`busbar${i}`, { x: x0 + 1.35, y: REAR, w: 0.3, d: 0.15, r: 0.03 }, z0 + 2.2, 7.6, { cls: "pw-copper", tone: "mid", steps: 1, info: "busbar", stamp: "busbar" });
  // 위 받침대: 기둥 + 팔 3 (공급 배관 · 회수 배관 · 버스웨이)
  const py = REAR - 0.9;
  W.box(`rpost${i}`, { x: x0 + 1.35, y: py, w: 0.3, d: 0.4, r: 0.03 }, RTOP, BUSW.z - RTOP, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rpost" });
  W.box(`rarmS${i}`, { x: x0 + 1.35, y: py, w: 0.3, d: SUP.y + 0.6 - py, r: 0.03 }, SUP.z - SUP.r - 0.25, 0.25, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rarmS" });
  W.box(`rarmR${i}`, { x: x0 + 1.35, y: py, w: 0.3, d: RET.y + 0.6 - py, r: 0.03 }, RET.z - RET.r - 0.25, 0.25, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rarmR" });
  W.box(`rarmB${i}`, { x: x0 + 1.35, y: BUSW.y - 0.8, w: 0.3, d: py + 0.4 - (BUSW.y - 0.8), r: 0.03 }, BUSW.z - 0.25, 0.25, { cls: "pw-steel", tone: "mid", steps: 1, info: "rack-post", stamp: "rarmB" });
  // 탭오프 → 코드 → 랙 위 인입구
  W.box(`tap${i}`, { x: x0 + 0.55, y: BUSW.y - 0.4, w: 0.8, d: 0.8, r: 0.08 }, BUSW.z - 1.4, 1.4, { cls: "hz-bus", tone: "mid", steps: 1, info: "tapoff", stamp: "tap" });
  W.box(`gland${i}`, { x: x0 + 0.65, y: BUSW.y - 0.3, w: 0.6, d: 0.6, r: 0.1 }, RTOP, 0.3, { cls: "pw-dark", tone: "mid", steps: 1, info: "tapoff", stamp: "gland" });
  cable(`cord${i}`, [[x0 + 0.95, BUSW.y, BUSW.z - 1.4], [x0 + 0.95, BUSW.y, RTOP + 0.3]], 0.14, { flow: "pw", info: "tapoff", fillet: false, maxLength: 6 });
  // 호스 (꺾임 1번): 공급 = 천장 공급관 T 뒤쪽 → 뒤로 → 아래로 공급 매니폴드 윗면 / 회수 = 회수 매니폴드 윗면 → 위로 → 앞으로 회수관 T 뒤쪽
  const sx = x0 + 0.45, rx = x0 + 2.55, my = REAR + 0.2;
  cable(`hoseS${i}`, [[sx, SUP.y - reach(TEE_H, 0.15), SUP.z], [sx, my, SUP.z], [sx, my, MANI_TOP]], 0.15, { cls: "hz-hoseS", flow: "c", info: "hose", bend: 0.6, maxLength: 4 });
  cable(`hoseR${i}`, [[rx, my, MANI_TOP], [rx, my, RET.z], [rx, RET.y - reach(TEE_H, 0.15), RET.z]], 0.15, { cls: "hz-hoseR", flow: "w", info: "hose", bend: 0.6, maxLength: 4 });
}
for (let i = 0; i < RACKS; i++) rack(i, RACK0 + i * RACK_W);

// 천장 2차 냉각수 배관 (공급·회수) + T 이음쇠 + 막음 캡
function tcs() {
  const supT = [...Array.from({ length: RACKS }, (_, i) => [RACK0 + i * RACK_W + 0.45, TEE_H]), ...CDU.xs.map((x) => [x + 4.5, TEE_R])];
  const retT = [...Array.from({ length: RACKS }, (_, i) => [RACK0 + i * RACK_W + 2.55, TEE_H]), ...CDU.xs.map((x) => [x + 1.5, TEE_R])];
  const gapsOf = (list, along) => list.map(([x, Rb]) => { const a0 = along(x), h = reach(Rb, SUP.r); return [a0 - h, a0 + h]; }).sort((p, q) => p[0] - q[0]);
  cable("tcs.sup", [[HDR.x0, SUP.y, SUP.z], [HDR.x1, SUP.y, SUP.z]], SUP.r, { cls: "hz-blue", flow: "c", fw: 0.9, fillet: false, maxLength: 20, info: "tcs", touch: ["rarm*"], gaps: gapsOf(supT, (x) => x - HDR.x0) });
  cable("tcs.ret", [[HDR.x1, RET.y, RET.z], [HDR.x0, RET.y, RET.z]], RET.r, { cls: "hz-red", flow: "w", fw: 0.9, fillet: false, maxLength: 20, info: "tcs", touch: ["rarm*"], gaps: gapsOf(retT, (x) => HDR.x1 - x) });
  supT.forEach(([x, Rb], j) => fitting(`tcs.teeS${j}`, [x, SUP.y, SUP.z], Rb, { cls: "hz-blue", owner: "tcs.sup", info: "tcs" }));
  retT.forEach(([x, Rb], j) => fitting(`tcs.teeR${j}`, [x, RET.y, RET.z], Rb, { cls: "hz-red", owner: "tcs.ret", info: "tcs" }));
  for (const [nm, H] of [["s", SUP], ["r", RET]]) {
    W.disc(`tcs.cap${nm}0`, G.frameAlong([HDR.x0 - 0.5, H.y, H.z], [1, 0, 0]), 0, 0.5, H.r + 0.2, { cls: nm === "s" ? "hz-blue" : "hz-red", tone: "mid", info: "tcs" });
    W.disc(`tcs.cap${nm}1`, G.frameAlong([HDR.x1, H.y, H.z], [1, 0, 0]), 0, 0.5, H.r + 0.2, { cls: nm === "s" ? "hz-blue" : "hz-red", tone: "mid", info: "tcs" });
  }
}
tcs();

// ---------- 10) CDU 2대 (A: 문 달림 · B: 앞판을 떼어 열교환기·펌프가 보임) + 위 관 ----------
const PORT = { sup: 1.3, ret: 2.5 };                              // 1차(시설 물) 관 x 자리 — 열교환기 앞면 (높이는 바깥 본관과 같음)
function cdu(i) {
  const x0 = CDU.xs[i], tag = CDU.tags[i], z0 = HALL.floor, Y = CDU_FRONT, open = tag === "b";
  if (!open) {
    W.box(`cdu${tag}`, { x: x0, y: CDU.y, w: CDU.w, d: CDU.d, r: 0.12 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu",
      inner: L(rightSlots(x0 + CDU.w, CDU.y + 1.5, Y - 1.5, z0 + 2, 5, 1, 0.4), { tone: "lo" }) });
    W.box(`cdu${tag}.door`, { x: x0 + 0.4, y: Y, w: CDU.w - 0.8, d: 0.15, r: 0.03 }, z0 + 0.6, CDU.h - 1.2, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu",
      inner: L(frontSlots(Y + 0.15, x0 + 1.2, x0 + CDU.w - 1.2, z0 + 1.4, 4, 0.8, 0.35), { tone: "lo" }) });
    W.box(`cdu${tag}.screen`, { x: x0 + 1.2, y: Y + 0.15, w: 2.2, d: 0.15, r: 0.04 }, z0 + 7, 1.6, { cls: "hz-screen", tone: "mid", steps: 1, info: "cdu" });
  } else {
    const back = Y - 2.6;
    W.box(`cdu${tag}.body`, { x: x0, y: CDU.y, w: CDU.w, d: back - CDU.y, r: 0.05 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-open" });
    W.box(`cdu${tag}.left`, { x: x0, y: back, w: 0.4, d: Y - back, r: 0.03 }, z0, CDU.h, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-open" });
    W.box(`cdu${tag}.floor`, { x: x0 + 0.4, y: back, w: CDU.w - 0.4, d: Y - back, r: 0.03 }, z0, 0.8, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-open" });
    W.box(`cdu${tag}.roof`, { x: x0 + 0.4, y: back, w: CDU.w - 0.4, d: Y - back, r: 0.03 }, CDU_TOP - 1.4, 1.4, { cls: "hz-cdu", tone: "mid", steps: 1, info: "cdu-open" });
    // 판형 열교환기 (판 가장자리 선) · 펌프 (몸통 + 앞으로 나온 모터)
    W.box(`cdu${tag}.hx`, { x: x0 + 0.8, y: back, w: 2.2, d: 1.6, r: 0.03 }, z0 + 1.4, 7.6, { cls: "hz-hx", tone: "mid", steps: 1, info: "cdu-hx",
      inner: L(frontSeams(back + 1.6, range(x0 + 1.0, x0 + 2.8, 0.2), z0 + 1.4, z0 + 9), { tone: "lo" }) });
    W.box(`cdu${tag}.pump`, { x: x0 + 3.5, y: back, w: 2.1, d: 0.9, r: 0.08 }, z0 + 1.6, 2.6, { cls: "hz-pump", tone: "mid", steps: 1, info: "cdu-pump" });
    W.disc(`cdu${tag}.motor`, G.frameAlong([x0 + 4.55, back + 0.9, z0 + 2.9], [0, 1, 0]), 0, 1.2, 0.9, { cls: "hz-pump", tone: "mid", info: "cdu-pump",
      extra: L(k.sideRing([x0 + 4.55, back + 2.1, z0 + 2.9], 0.5, "y", P, 14), { tone: "mid" }) });
    cable(`cdu${tag}.int`, [[x0 + 3.0, back + 0.45, z0 + 2.9], [x0 + 3.5, back + 0.45, z0 + 2.9]], 0.3, { cls: "hz-blue", flow: "c", info: "cdu-open", fillet: false, maxLength: 2 });
  }
  W.put(`cdu${tag}.lamp`, [x0 + 4.6, Y + 0.25, CDU_TOP - 0.9], lamp("hz-lamp", [x0 + 4.6, Y + 0.25, CDU_TOP - 0.9], 0.5, `data-cdu="${tag}"`),
    [R.solid(A.box([x0 + 4.1, Y + 0.15, CDU_TOP - 1.4], [x0 + 5.1, Y + 0.3, CDU_TOP - 0.4], { name: `cdu${tag}.lamp` }))], { info: "cdu", bias: 0.05 });
  // 위 관: 공급(CDU → 천장 공급 배관 T) · 회수(천장 회수 배관 T → CDU)
  const f = "";                                                  // 두 대 모두 늘 가동 (정비 장면 없음)
  cable(`cdu${tag}.rise`, [[x0 + 4.5, CDU.y + 4, CDU_TOP], [x0 + 4.5, CDU.y + 4, SUP.z], [x0 + 4.5, SUP.y + reach(TEE_R, 0.4), SUP.z]], 0.4, { cls: "hz-blue", flow: `c${f}`, info: "tcs-riser", bend: 1.1, maxLength: 12 });
  cable(`cdu${tag}.fall`, [[x0 + 1.5, RET.y + reach(TEE_R, 0.4), RET.z], [x0 + 1.5, CDU.y + 4, RET.z], [x0 + 1.5, CDU.y + 4, CDU_TOP]], 0.4, { cls: "hz-red", flow: `w${f}`, info: "tcs-riser", bend: 1.1, maxLength: 12 });
}
CDU.xs.forEach((_, i) => cdu(i));

// ---------- 11) 벽 밖 1차 배관 · 건식 냉각기(칠러 없음) · 배관에 붙은 펌프 2대 ----------
// 회수(데워진 물): CDU 앞 → 가지관 → 벽을 따라 +x → 엘보 → 마당 쪽 → 엘보 → 냉각기 오른쪽 끝 위 헤더
// 공급(식은 물): 냉각기 오른쪽 끝 아래 헤더 → 엘보 → 벽 쪽 (펌프 2대가 이 관에) → 엘보 → 벽을 따라 −x → CDU 가지관
const YS = { y: 4, z: 6, r: 0.9 }, YR = { y: 7.5, z: 9.2, r: 0.9 };   // 벽 밖 본관: 공급(식힌 물) · 회수(데워진 물)
const DC = { x: 204, y: 15, w: 66, d: 14, r: 0.4 };              // 건식 냉각기 (팬 5개)
const DC_FANS = [210.5, 223.5, 236.5, 249.5, 262.5];
const FAN_FRAMES = 6;                                             // 팬 날개 그림 수 (15° 씩)
const DC_IN = DC.y + 9, DC_OUT = DC.y + 4;                       // 냉각기 오른쪽 끝 헤더: 데워진 물이 들어오는 y · 식은 물이 나가는 y
const ELB = 1.2, TEE_Y = 1.1;                                     // 엘보 공 · 가지관 T 공
const PUMPS = [8, 14], PUMP_X = 281;                            // 공급관 위 펌프 자리 (y) · 펌프가 붙은 세로 토막의 x
function yard() {
  const E = reach(ELB, YS.r), step = (p, q, d) => { const v = G.sub3(q, p), l = G.len3(v); return G.add3(p, G.mul3(v, d / l)); };
  const run = (name, from, to, opts) => cable(name, [from, to], YS.r, { cls: "hz-alu", fw: 1.1, fillet: false, maxLength: 24, ...opts });
  const X0 = 237, DX = DC.x + DC.w + 1;                          // 왼쪽 막음 캡 x · 냉각기 헤더 앞면 x
  // 회수
  const R0 = [X0, YR.y, YR.z], F1 = [276, YR.y, YR.z], F2 = [276, DC_IN, YR.z], R3 = [DX, DC_IN, YR.z];
  const retT = CDU.xs.map((x) => x + PORT.ret - X0);
  run("yard.ret0", R0, step(F1, R0, E), { flow: "w", info: "yard-ret", owner: "yard.ret", gaps: teeGaps(retT, TEE_Y, YR.r), touch: ["ystand*"] });
  run("yard.ret1", step(F1, F2, E), step(F2, F1, E), { flow: "w", info: "yard-ret", owner: "yard.ret", touch: ["ystand*"] });
  run("yard.ret2", step(F2, R3, E), R3, { flow: "w", info: "yard-ret", owner: "yard.ret" });
  [F1, F2].forEach((c, j) => fitting(`yard.elbR${j}`, c, ELB, { info: "yard-ret" }));
  // 공급 (펌프 2대 자리는 비움 → 펌프 몸통이 관을 이음)
  const S0 = [DX, DC_OUT, YS.z], F3 = [PUMP_X, DC_OUT, YS.z], F4 = [PUMP_X, YS.y, YS.z], S3 = [X0, YS.y, YS.z];
  const legY0 = F3[1] - E, legY1 = F4[1] + E;                     // 펌프가 붙는 세로 토막 (y 큰 쪽 → 작은 쪽)
  const gapsP = PUMPS.map((py) => [legY0 - (py + 1.6), legY0 - (py - 1.6)]);
  run("yard.sup0", S0, step(F3, S0, E), { flow: "c", info: "yard-sup", owner: "yard.sup" });
  run("yard.sup1", [F3[0], legY0, YS.z], [F4[0], legY1, YS.z], { flow: "c", info: "pumps", owner: "yard.sup", gaps: gapsP, touch: ["ystand*"] });
  const supT = CDU.xs.map((x) => (F4[0] - E) - (x + PORT.sup));
  run("yard.sup2", step(F4, S3, E), S3, { flow: "c", info: "yard-sup", owner: "yard.sup", gaps: teeGaps(supT, TEE_Y, YS.r), touch: ["ystand*"] });
  [F3, F4].forEach((c, j) => fitting(`yard.elbS${j}`, c, ELB, { info: "yard-sup" }));
  W.disc("yard.capS", G.frameAlong([X0 - 0.5, YS.y, YS.z], [1, 0, 0]), 0, 0.5, YS.r + 0.2, { cls: "hz-alu", tone: "mid", info: "yard-sup" });
  W.disc("yard.capR", G.frameAlong([X0 - 0.5, YR.y, YR.z], [1, 0, 0]), 0, 0.5, YR.r + 0.2, { cls: "hz-alu", tone: "mid", info: "yard-ret" });
  // 받침 (낮은 콘크리트 · 강철)
  for (const x of [244, 262, 272]) {
    W.box(`ystandS${x}`, { x: x - 0.6, y: YS.y - 1.2, w: 1.2, d: 2.4, r: 0.1 }, SLAB, YS.z - YS.r - SLAB, { cls: "pw-concrete", tone: "mid", steps: 1, info: "yard-sup", stamp: "ystandS" });
    W.box(`ystandR${x}`, { x: x - 0.6, y: YR.y - 1.0, w: 1.2, d: 2.0, r: 0.1 }, SLAB, YR.z - YR.r - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "yard-ret", stamp: "ystandR" });
  }
  for (const y of [12.5, 22]) W.box(`ystandF${y}`, { x: 275, y: y - 0.6, w: 2, d: 1.2, r: 0.1 }, SLAB, YR.z - YR.r - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "yard-ret", stamp: "ystandF" });
  // 펌프 2대 (배관에 붙은 형): 몸통이 관을 잇고 위에 세운 모터 · 운전 표시등 (1대 예비)
  PUMPS.forEach((py, j) => {
    W.box(`pump${j}.casing`, { x: F3[0] - 1.3, y: py - 1.6, w: 2.6, d: 3.2, r: 0.3 }, YS.z - 1.3, 2.6, { cls: "hz-pump", tone: "mid", steps: 2, info: "pumps", stamp: "pump-casing", owner: "yard.sup" });
    W.box(`pump${j}.foot`, { x: F3[0] - 1.1, y: py - 1.2, w: 2.2, d: 2.4, r: 0.1 }, SLAB, YS.z - 1.3 - SLAB, { cls: "pw-steel", tone: "mid", steps: 1, info: "pumps", stamp: "pump-foot" });
    W.cyl(`pump${j}.motor`, F3[0], py, 1.1, YS.z + 1.3, 3.6, { cls: "hz-pump", tone: "mid", info: "pumps", stamp: "pump-motor",
      extra: L(k.planOutline({ x: F3[0] - 0.7, y: py - 0.7, w: 1.4, d: 1.4, r: 0.7 }, YS.z + 4.9, P, 4), { tone: "lo" }) });
    W.put(`pump${j}.lamp`, [F3[0] + 1.1, py, YS.z + 3.6], lamp("hz-pumplamp", [F3[0] + 1.1, py, YS.z + 3.6], 0.35, `data-pump="${j}"`),
      [R.solid(A.box([F3[0] + 1.05, py - 0.3, YS.z + 3.3], [F3[0] + 1.15, py + 0.3, YS.z + 3.9], { name: `pump${j}.lamp`, owner: `pump${j}.motor` }))], { info: "pumps", bias: 0.05 });
  });
  // CDU 마다 가지관 2개 (벽 위를 지나 CDU 앞 아래로) + T 이음쇠
  CDU.xs.forEach((x0, i) => {
    // 닫힌 A 는 문 앞면에서, 앞판을 뗀 B 는 안쪽 판형 열교환기 앞면에서 끝남
    const sx = x0 + PORT.sup, rx = x0 + PORT.ret, tag = CDU.tags[i], face = tag === "b" ? CDU_FRONT - 2.6 + 1.6 : CDU_FRONT + 0.15;
    cable(`branch.s${tag}`, [[sx, YS.y - reach(TEE_Y, 0.4), YS.z], [sx, face, YS.z]], 0.4, { cls: "hz-alu", flow: "c", info: "branch", fillet: false, maxLength: 6 });
    cable(`branch.r${tag}`, [[rx, face, YR.z], [rx, YR.y - reach(TEE_Y, 0.4), YR.z]], 0.4, { cls: "hz-alu", flow: "w", info: "branch", fillet: false, maxLength: 6 });
    fitting(`yard.teeS${tag}`, [sx, YS.y, YS.z], TEE_Y, { owner: "yard.sup", info: "branch" });
    fitting(`yard.teeR${tag}`, [rx, YR.y, YR.z], TEE_Y, { owner: "yard.ret", info: "branch" });
  });
}
yard();

// 건식 냉각기 (핀 코일 + 위로 부는 팬 5개 + 오른쪽 끝 헤더 상자 2) — 칠러 없음
function dryCooler() {
  const z0 = SLAB, zc0 = z0 + 4.4, zc1 = zc0 + 6.4, Y = DC.y + DC.d, X = DC.x + DC.w;
  for (const x of [DC.x + 0.3, DC.x + 22, DC.x + 44, X - 1.1]) for (const y of [DC.y + 0.3, Y - 1.1]) W.box(`dc.leg${x}${y}`, { x, y, w: 0.8, d: 0.8, r: 0.08 }, z0, zc0 - z0, { cls: "pw-steel", tone: "mid", steps: 1, info: "drycooler", stamp: "dc-leg" });
  W.box("dc.coil", DC, zc0, zc1 - zc0, { cls: "hz-coil", tone: "mid", steps: 1, info: "drycooler",
    inner: L(frontSeams(Y, range(DC.x + 0.8, X - 0.8, 0.8), zc0, zc1) + rightSeams(X, range(DC.y + 0.8, Y - 0.8, 0.8), zc0, zc1), { tone: "lo" }) });
  W.box("dc.deck", { x: DC.x, y: DC.y, w: DC.w, d: DC.d, r: 0.4 }, zc1, 0.8, { cls: "hz-unit", tone: "mid", steps: 1, info: "drycooler" });
  DC_FANS.forEach((cx, j) => {
    const cy = DC.y + DC.d / 2, fz = zc1 + 0.8, ztop = fz + 1.1;
    const rings = [2.9, 2.0, 1.1].map((r) => k.planOutline({ x: cx - r, y: cy - r, w: r * 2, d: r * 2, r }, ztop, P, 6)).join("");
    // 날개 4장은 90° 마다 같은 모양 → 15° 씩 돌린 6장이면 한 바퀴를 끊김 없이 보여 줌
    const spokesAt = (turn) => [0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2 + Math.PI / 4 + turn; return seg([cx + Math.cos(a) * 1.1, cy + Math.sin(a) * 1.1, ztop], [cx + Math.cos(a) * 2.9, cy + Math.sin(a) * 2.9, ztop]); }).join("");
    const blades = frames("fan", Array.from({ length: FAN_FRAMES }, (_, q) => L(spokesAt((q * Math.PI) / 2 / FAN_FRAMES), { tone: "mid" })));
    W.cyl(`dc.fan${j}`, cx, cy, 3.4, fz, 1.1, { cls: "hz-unit", tone: "mid", info: "dc-fan", stamp: "dc-fan", extra: L(rings, { tone: "lo" }) + blades + Dt([at([cx, cy, ztop])], { size: 0.35, tone: "mid" }) });
  });
  W.box("dc.hdrIn", { x: X, y: DC_IN - 2, w: 1, d: 4, r: 0.15 }, YR.z - 1.6, 3.2, { cls: "hz-alu", tone: "mid", steps: 1, info: "drycooler" });
  W.box("dc.hdrOut", { x: X, y: DC_OUT - 2, w: 1, d: 4, r: 0.15 }, YS.z - 1.6, 3.2, { cls: "hz-alu", tone: "mid", steps: 1, info: "drycooler" });
  W.box("dc.panel", { x: DC.x + 3, y: Y, w: 6, d: 0.4, r: 0.08 }, zc0 + 0.6, 5, { cls: "pw-dark", tone: "mid", steps: 1, info: "dc-panel" });
}
dryCooler();

// 바깥 기온계 (냉각기 앞 제어함 위, 더운 오후 장면에서 바늘이 움직임) — 45 °C 물 눈금도 함께
const T_MIN = 0, T_MAX = 50, NEEDLE = range(20, 40, 1);
const dialAngle = (t) => (Math.PI * 5) / 4 - ((t - T_MIN) / (T_MAX - T_MIN)) * (Math.PI * 3) / 2;
const THERMO = { x: DC.x + 6, y: DC.y + DC.d + 0.4, z: SLAB + 4.4 + 3.1, r: 1.9 };
function thermometer() {
  const { x, y, z, r } = THERMO, Yf = y + 0.5;
  const ticks = [];
  for (let t = T_MIN; t <= T_MAX; t += 5) { const a = dialAngle(t), r0 = r * (t % 10 === 0 ? 0.6 : 0.74); ticks.push(seg([x + Math.cos(a) * r0, Yf + 0.02, z + Math.sin(a) * r0], [x + Math.cos(a) * r * 0.86, Yf + 0.02, z + Math.sin(a) * r * 0.86])); }
  // 빨간 띠 = NO_CHILLER_MAX(40 °C) 이상: 여기부터는 바깥 공기만으로 45 °C 물을 못 만듦 (가정)
  const hot = range(NO_CHILLER_MAX, T_MAX, 1).map((t) => [x + Math.cos(dialAngle(t)) * r * 0.9, Yf + 0.02, z + Math.sin(dialAngle(t)) * r * 0.9]);
  const needles = NEEDLE.map((t) => { const a = dialAngle(t); return `<g class="hz-needle">${L(seg([x, Yf + 0.05, z], [x + Math.cos(a) * r * 0.8, Yf + 0.05, z + Math.sin(a) * r * 0.8]), { tone: "hi" })}</g>`; });
  W.disc("thermo.dial", G.frameAlong([x, y, z], [0, 1, 0]), 0, 0.5, r, { cls: "pw-steel", tone: "mid", info: "thermo",
    extra: `<path class="hz-hotarc" d="${pathOf3(hot)}"/>` + L(ticks.join(""), { tone: "lo" }) + frames("needle", needles) + Dt([at([x, Yf + 0.06, z])], { size: 0.3, tone: "hi" }) });
}
thermometer();

// ---------- '회사 확인' 보기: 구역 나눔 (부품 설명 키 data-info 기준) ----------
// 부품 하나하나가 아니라 구역 단위로 나눔 → 진한 것과 하얀 것이 바둑판처럼 섞이지 않음
//   confirmed = 회사 공시·사진으로 종류를 확인한 변전소 설비 (대수·간격·케이블 길은 그림) → 색 그대로
//   drawn     = 회사가 밝히지 않아 NVIDIA 공개 사양·일반 설계로 그린 홀 안·냉각 설비·다음 단계 자리 → 하얗게
//   neutral   = 모형 받침·도로 (어느 쪽도 아님)
const ZONE = {
  confirmed: ["line", "gantry", "string", "ds", "breaker", "bus345", "xfmr", "xfmr-rad", "xfmr-hv", "xfmr-lv", "xfmr-cons", "head", "cable138", "primary", "primary-mv", "cable34", "control", "mast", "yard", "fence"],
  drawn: ["hall", "wall", "mvsg", "rect", "dcsb", "busway", "tapoff", "rack", "manifold", "busbar", "rack-post", "hose", "tcs", "tcs-riser", "cdu", "cdu-open", "cdu-hx", "cdu-pump", "branch", "yard-sup", "yard-ret", "drycooler", "dc-fan", "dc-panel", "pumps", "thermo", "pad", "future", "spare"],
  neutral: ["base", "road"],
};
const zoneOf = (key) => (ZONE.confirmed.includes(key) ? "confirmed" : ZONE.drawn.includes(key) ? "drawn" : ZONE.neutral.includes(key) ? "neutral" : null);
// 표시 = 하얗게 칠할 부품 그림을 <g data-drawn> 으로 한 번 더 감쌈 (CSS 가 '회사 확인' 보기일 때만 이 안의 색을 하얗게 바꿈)
for (const item of R.items) {
  const key = /^<g data-info="([^"]+)">/.exec(item.svg)?.[1];
  if (key && zoneOf(key) === "drawn") item.svg = `<g data-drawn>${item.svg}</g>`;
}

// ---------- 그리기 (칠하는 순서 = 광선으로 잰 앞뒤) ----------
const body = W.render();

// 짚을 곳 (둘러보기 순서 = 전기가 내려오는 계단 → 열이 나가는 길). z = 그 부품을 볼 때의 확대 배율
const PART_STOPS = [
  { key: "line", p: [GANTRY.x - 3, PH[2], CLAMP_Z + 1], z: 2.4 },
  { key: "breaker", p: [CB.x0 + 5, PH[2], CB.z + 3], z: 2.6 },
  { key: "bus345", p: [HV_X[0] + 14, PH[2], BUS.z], z: 2.4 },
  { key: "xfmr", p: [XF.xs[0] + 16, XF.y + XF.d + 4, XF.z0 + 9], z: 2.2 },
  { key: "spare", p: [SPARE.x + 18, XF.y + XF.d + 2, XF.z0 + 1], z: 2.4 },
  { key: "cable138", p: [TR1.x + 74, TR1.y + 3, TR1.pit + 1], z: 2.8 },
  { key: "primary", p: [TP.x + 13, TP.y + TP.d + 2, TP.z0 + 6], z: 2.6 },
  { key: "cable34", p: [TR2.x + 4.5, TR2.y + 7, TR2.pit + 1], z: 3.0 },
  { key: "mvsg", p: [210, -53, HALL.floor + 10], z: 2.8 },
  { key: "rect", p: [228, -53, HALL.floor + 8], z: 2.8 },
  { key: "tapoff", p: [RACK0 + 3 * RACK_W + 0.95, BUSW.y, BUSW.z - 0.7], z: 3.4 },
  { key: "rack", p: [RACK0 + 6 * RACK_W, REAR, HALL.floor + 7], z: 2.8 },
  { key: "manifold", p: [RACK0 + 9 * RACK_W + 2.55, REAR + 0.4, 9], z: 3.6 },
  { key: "tcs", p: [RACK0 + 2 * RACK_W, SUP.y, SUP.z + 1], z: 2.8 },
  { key: "cdu-open", p: [CDU.xs[1] + 3, CDU_FRONT - 1, HALL.floor + 5], z: 3.2 },
  { key: "branch", p: [CDU.xs[1] + 2.6, 1.5, 9], z: 3.0 },
  { key: "drycooler", p: [DC.x + 33, DC.y + DC.d, SLAB + 8], z: 2.2 },
  { key: "pumps", p: [PUMP_X + 1.1, PUMPS[0], YS.z + 3], z: 3.0 },   // 식힌 물을 다시 CDU 로 → 고리가 닫힘
];
// 장면마다 짚을 곳: 온도계 → 팬 → 온도계 → 비워 둔 자리 (다음 단계가 붙는 모습, 조금 넓게)
const THERMO_P = [THERMO.x, THERMO.y + 0.6, THERMO.z];
const FAN_P = [DC_FANS[2], DC.y + DC.d / 2, SLAB + 12.7];
const SPARE_P = [SPARE.x + 4, -30, XF.z0];                        // 비워 둔 자리 + 앞마당 패드가 함께 보이는 곳
const PHASE_STOPS = [["warm", THERMO_P, 3.2], ["hot", FAN_P, 2.4], ["evening", THERMO_P, 3.2], ["grow", SPARE_P, 1.8], ["grown", SPARE_P, 1.8], ["settle", SPARE_P, 1.8]]
  .map(([phase, p, z]) => ({ key: `ph-${phase}`, phase, p, z }));
// 규모 사다리 (둘러보기 끝): 랙 1대를 크게 → 홀 한 토막 → 정류장 없음 = 전체 보기로 돌아옴 (스위트워터 1)
//   key 를 설명(INFO)에 없는 이름으로 둠 → 말풍선 대신 그림 오른쪽 위 이름표(이름 + 숫자 2개)가 뜸
//   홀은 넓게 보는 장면이라 조준 링을 끔 (aim: false)
const SCALE_STOPS = [
  { key: "scale-rack", phase: "rack", p: [RACK0 + 6 * RACK_W + RACK_W / 2, REAR, HALL.floor + 6], z: 8 },
  { key: "scale-hall", phase: "hall", p: [252, -40, 6], z: 2.1, aim: false },
];
const STOPS = [...PART_STOPS, ...PHASE_STOPS, ...SCALE_STOPS].map((s) => { const [x, y] = at(s.p); return { key: s.key, fx: +(x / WIDTH).toFixed(4), fy: +(y / HEIGHT).toFixed(4), z: s.z, ...(s.side ? { side: s.side } : {}), ...(s.aim === false ? { aim: false } : {}) }; });
const PHASE_STOP = Object.fromEntries([...PHASE_STOPS, ...SCALE_STOPS].map((s, i) => [s.phase, PART_STOPS.length + i]));
const PLAN = tourPlan(PART_STOPS.length);
// 팬 위로 데워진 공기가 올라가는 자리
const PUFFS = DC_FANS.map((cx) => at([cx, DC.y + DC.d / 2, SLAB + 4.4 + 6.4 + 0.8 + 1.1 + 1.2]).map(r1));

// ---------- 글 (한/영) ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const PCT = Math.round(SHARE * 100);
// 규모 사다리 이름표의 숫자 (model.mjs: 회사 자료 + 사이트의 Vera Rubin 추정 규칙)
const LADDER = Object.fromEntries(scaleLadder().map((s) => [s.id, s]));
const INFO = {
  base: ["모형 받침 · 앞 모서리 자: 작은 눈금 2 m, 큰 눈금 10 m (홀 안 설비 기준) · 변전소 설비는 실제보다 작게, 설비 사이 거리는 크게 줄여 그림", "Model base · edge ruler: 2 m ticks, 10 m majors (true for the hall equipment) · substation equipment is drawn smaller than life and the distances between items are heavily shortened"],
  yard: ["변전소 자갈 마당 · 감전·화재를 막으려 자갈을 깔고 울타리를 침 (회사 사진의 넓은 자갈 마당)", "Substation gravel yard · crushed rock and a fence for safety (the wide gravel yard in the company photos)"],
  fence: ["변전소 울타리", "Substation fence"],
  pad: ["홀 앞 콘크리트 패드 · 냉각 설비·배관 자리", "Concrete pad outside the hall · for the cooling plant and pipework"],
  road: ["진입로", "Access road"],
  line: [`ERCOT 345 kV 송전선 · 텍사스 전력망에서 들어옴 · 스위트워터 1 계통 연결 ${fmt(SITE.mw)} MW (회사) · 첫 단계 ${SITE.phase1Gross} MW만 보내도 한 가닥에 약 ${fmt(AMPS.hv)} A`, `ERCOT 345 kV line · arrives from the Texas grid · Sweetwater 1 grid connection ${fmt(SITE.mw)} MW (company) · phase 1's ${SITE.phase1Gross} MW alone is about ${fmt(AMPS.hv)} A per conductor`],
  gantry: ["인입 가대 · 송전선을 붙잡아 마당 안으로 끌어내림 (철골 격자)", "Dead-end gantry · anchors the line and brings it down into the yard (lattice steel)"],
  string: ["매단 애자 · 전선을 철골에서 떼어 붙잡음 · 갓이 비에 젖지 않는 길을 늘림", "Suspension insulators · hold the conductor off the steel · the sheds keep a dry path in the rain"],
  ds: ["단로기 · 칼날을 열어 눈에 보이게 끊음 (정비할 때 안전) · 전류가 흐를 때는 열지 않음", "Disconnect switch · opens a visible break for safe maintenance · never opened under load"],
  breaker: ["가스 차단기 · 사고 전류를 순식간에 끊음 (탱크 속 절연 가스) · 세 상을 한 조작함이 함께 여닫음 (회사: 차단기 조달)", "Gas circuit breaker · interrupts fault current in an instant inside an insulating-gas tank · one mechanism drives all three phases (company: circuit breakers procured)"],
  bus345: ["345 kV 모선 · 관 모양 알루미늄 3가닥 (상마다 1) · 변압기마다 T로 내려감 · 맨 오른쪽 T는 비워 둔 자리 몫", "345 kV bus · three aluminium tubes, one per phase · a tee drops to each transformer · the right-most tee waits for the empty bay"],
  xfmr: [`대형 변압기 (345 → 138 kV) · 회사: ${fmt(SITE.mw)} MW 대형 변전소 (345 kV/138 kV) · 그림은 2대 + 비워 둔 자리 1 (대수는 그림 표현)`, `Large power transformer (345 → 138 kV) · company: ${fmt(SITE.mw)} MW bulk substation (345 kV/138 kV) · two units and one empty bay drawn (count illustrative)`],
  "xfmr-rad": ["방열판 · 변압기 기름의 열을 바깥 공기로 버림", "Radiators · shed the transformer oil's heat to the air"],
  "xfmr-hv": ["345 kV 부싱 · 모선에서 내려온 선이 탱크 안 권선으로 들어감", "345 kV bushings · take the bus drops into the windings"],
  "xfmr-lv": ["138 kV 부싱 · 낮춘 전압이 나와 케이블 헤드로", "138 kV bushings · the stepped-down voltage leaves for the cable terminations"],
  "xfmr-cons": ["보존 탱크 · 기름이 데워져 늘어날 자리", "Conservator · room for the oil to expand as it warms"],
  head: ["케이블 헤드 · 공중 선을 땅속 케이블로 바꿔 줌", "Cable termination · turns the overhead conductor into underground cable"],
  spare: ["비워 둔 자리 · 기초 패드와 묻어 둔 관 끝이 미리 준비됨 → 다음 단계 변압기를 빨리 붙임 · 회사: '첫 단계가 다음 단계를 더 빨리 붙이는 뼈대' · 자리 모양은 그림 표현", "Empty bay · foundation pad and conduit stubs ready in advance, so the next phase's transformer goes in fast · company: 'the first phase creates the backbone for faster subsequent phases' · bay shape illustrative"],
  future: ["앞마당 빈 패드 · 다음 단계 1차 변압기 자리 (예시) · 묻어 둔 관 끝이 앞의 138 kV 도랑으로 이어질 자리", "Empty pads in the front yard · room for the next phase's primary transformers (example) · the conduit stubs would join the 138 kV trench"],
  cable138: [`138 kV 케이블 · 도랑을 잘라 보여 줌 · 대형 변전소 → 1차 변전소 · 첫 단계 ${SITE.phase1Gross} MW 면 상마다 약 ${fmt(AMPS.mv)} A`, `138 kV cables · trench cut open · bulk substation → primary substation · about ${fmt(AMPS.mv)} A per phase for phase 1's ${SITE.phase1Gross} MW`],
  primary: ["1차 변압기 (138 → 34.5 kV) · 회사: 1차 변전소 (138 kV/34.5 kV) · 건물로 보낼 전압을 만듦 (그림은 1대)", "Primary transformer (138 → 34.5 kV) · company: primary substations (138 kV/34.5 kV) · makes the voltage sent to the buildings (one unit drawn)"],
  "primary-mv": ["34.5 kV 케이블 상자 · 케이블이 아래로 나가 땅속으로", "34.5 kV cable box · the cables leave downward into the ground"],
  cable34: [`34.5 kV 케이블 · 도랑을 잘라 보여 줌 · 땅속으로 홀까지 · ${SITE.phase1Gross} MW 면 모두 합쳐 약 ${fmt(AMPS.dv)} A → 여러 회선으로 나눔`, `34.5 kV cables · trench cut open · underground to the hall · ${SITE.phase1Gross} MW is about ${fmt(AMPS.dv)} A in total, so it is split over many feeders`],
  control: ["제어동 · 보호 계전기·통신·축전지가 있는 흰 건물 (회사 사진)", "Control building · protection relays, communications and batteries (company photos)"],
  mast: ["피뢰 기둥 · 벼락을 먼저 받아 설비를 지킴", "Lightning mast · takes the strike before the equipment does"],
  hall: ["1단계 홀 (지붕을 뗌) · 회사: IT 200 MW 액체냉각 데이터센터 건설 중 · 홀 안 배치는 밝히지 않음 → 그림 표현", "Phase 1 hall (roof off) · company: 200 MW IT of liquid-cooled data centers under construction · interior not disclosed → illustrative"],
  wall: ["홀 벽 · 허물어 안을 보여 줌 (빗금 = 잘린 면)", "Hall wall · broken away to show inside (hatching = cut)"],
  mvsg: ["34.5 kV 배전반 · 땅속 케이블을 받아 정류기로 나눠 보냄 · 위 창 = 보호 계전기", "34.5 kV switchgear · takes the underground cables and feeds the rectifiers · upper windows = protection relays"],
  rect: [`정류기 (34.5 kV 교류 → ${DC_V} V 직류) · 위 팬 = 반도체 변환기의 열을 빼냄 · NVIDIA DSX POD는 랙에 ${DC_V} V 직류를 넣음 ('표준 입력 800 VDC') → 그 방식을 따라 그림 · 회사는 홀 전기 방식을 밝히지 않음 — 480 V 교류로 짓는 Vera Rubin 설계도 있음 (모양·대수는 그림 표현)`, `Rectifiers (34.5 kV AC → ${DC_V} V DC) · the top fans carry the power electronics' heat away · NVIDIA's DSX POD feeds ${DC_V} V DC to its racks ('standard input 800 VDC'), so the hall is drawn that way · the company hasn't said how the hall is powered — Vera Rubin designs on 480 V AC exist too (shape and count illustrative)`],
  dcsb: [`${DC_V} V 직류 배전반 · 직류 차단기로 버스웨이마다 나눠 보냄 · 아래 창 = 전압·전류 계기 (모양은 예시)`, `${DC_V} V DC switchboard · DC breakers feed each busway · lower window = voltage and current meter (illustrative)`],
  busway: [`${DC_V} V 직류 버스웨이 · 랙 위를 지나는 전원 통로 · IT ${SITE.phase1It} MW ÷ ${DC_V} V = 모두 합쳐 ${fmt(AMPS.dc)} A → 랙 줄마다 여러 갈래로 나눔 (모양은 예시) · NVIDIA: 줄 단위 ${DC_V} V 직류 버스웨이는 ${COPPER.vsVac} V 교류 배전보다 구리를 ${COPPER.cut * 100}% 적게 쓰고 같은 굵기로 전력을 ${COPPER.more * 100}% 더 보냄`, `${DC_V} V DC busway · the power run over the racks · ${SITE.phase1It} MW of IT at ${DC_V} V is ${fmt(AMPS.dc)} A in total, split over many runs row by row (illustrative) · NVIDIA: row-level ${DC_V} V DC busways use ${COPPER.cut * 100}% less copper than ${COPPER.vsVac} V AC distribution and carry ${COPPER.more * 100}% more power through the same conductor size`],
  tapoff: [`탭오프 · 버스웨이에서 랙 하나로 ${DC_V} V 직류를 내림`, `Tap-off · drops ${DC_V} V DC from the busway into one rack`],
  rack: ["Vera Rubin 랙 (뒷면) · 회사: 'NVIDIA Vera Rubin 같은 차세대 칩 구조를 위해 설계' · 랙 수·랙 전력은 밝히지 않음 (모양은 그림 표현)", "Vera Rubin rack (rear) · company: 'designed for next generation chip architectures, including the NVIDIA Vera Rubin' · rack count and power not disclosed (shape illustrative)"],
  manifold: [`랙 매니폴드 · 파랑 = 공급, 빨강 = 회수 · 칩 냉각판마다 물을 나눠 줌 · 들어가는 물이 ${WATER.supply} °C로 따뜻해도 됨 (NVIDIA)`, `Rack manifolds · blue = supply, red = return · feed every cold plate · the water going in can be as warm as ${WATER.supply} °C (NVIDIA)`],
  busbar: ["직류 버스바 · 랙 안 전원 막대 · 트레이마다 꽂혀 전원을 받음", "DC busbar · the rack's power spine · every tray plugs into it"],
  "rack-post": ["랙 위 받침대 · 배관·버스웨이를 받침 (그림 표현)", "Rack-top supports · carry the pipes and busway (illustrative)"],
  hose: ["랙 호스 · 천장 배관에서 내려와 매니폴드에 꽂힘", "Rack hoses · drop from the overhead pipes into the manifolds"],
  tcs: [`2차 냉각수 배관 (랙 쪽 고리) · CDU ↔ 랙만 도는 깨끗한 물 · 파랑 = 공급 (최대 ${WATER.supply} °C), 빨강 = 회수 (색은 설명용)`, `Rack-side loop (secondary) · clean coolant circulating only between CDUs and racks · blue = supply (up to ${WATER.supply} °C), red = return (colours for explanation)`],
  "tcs-riser": ["CDU 위 관 · 천장 배관과 이어짐", "CDU top pipes · tie into the overhead loop"],
  cdu: ["CDU A · 냉각수 분배기 · 가동 중 (대수는 그림 표현)", "CDU A · coolant distribution unit · running (count illustrative)"],
  "cdu-open": ["CDU B (앞판을 뗌) · 판형 열교환기가 랙 쪽 물의 열을 시설 물로 넘김 — 두 물은 섞이지 않음 · 펌프가 랙 쪽 물을 돌림", "CDU B (front removed) · a plate heat exchanger hands the rack loop's heat to the facility water — the two never mix · pumps drive the rack loop"],
  "cdu-hx": ["판형 열교환기 · 얇은 판 사이로 두 물이 번갈아 흘러 열만 건넴", "Plate heat exchanger · the two waters flow in alternate gaps and swap only heat"],
  "cdu-pump": ["순환 펌프 · 랙 쪽 물을 돌림", "Circulation pump · drives the rack loop"],
  branch: ["가지관 · CDU마다 1차 공급·회수 · 벽 위를 지나 CDU로 (벽은 허물어 보여 줌)", "Branches · each CDU's facility supply and return, over the wall (cut away)"],
  "yard-ret": ["1차 회수 배관 (데워진 물) · CDU에서 건식 냉각기로", "Facility return (warmed) · CDUs to the dry cooler"],
  "yard-sup": ["1차 공급 배관 (식힌 물) · 건식 냉각기에서 펌프를 거쳐 CDU로 · 칠러를 거치지 않음", "Facility supply (cooled) · dry cooler → pumps → CDUs · no chiller in the loop"],
  drycooler: [`건식 냉각기 · 큰 라디에이터처럼 바깥 공기로만 식힘 · 물을 증발시키지 않음 (NVIDIA: 냉각탑 대신 쓰면 ${DSX.gw} GW 규모에서 하루 물 ${fmt(DSX.litersPerDay / 1e4)}만 L 절약) · 물은 바깥 기온 + 약 ${WATER.approach} °C까지 식음 (가정) → 바깥 ${NO_CHILLER_MAX} °C 까지는 이것만으로 ${WATER.supply} °C 물 · NVIDIA: '알맞은 기후에서' — 가장 더운 때 기계식 냉각을 보탤지는 지역 기후가 정함 · 칠러는 그리지 않음 (냉각 설비 구성은 밝히지 않음)`, `Dry cooler · like a big radiator, outside air only · evaporates no water (NVIDIA: used instead of cooling towers it saves ${DSX.litersPerDay / 1e6} million liters a day at ${DSX.gw} GW scale) · cools the water to about ${WATER.approach} °C above the outdoor temperature (assumption) → ${WATER.supply} °C water on its own up to ${NO_CHILLER_MAX} °C outside · NVIDIA: 'in suitable climates' — local climate decides whether mechanical cooling is added in the hottest periods · no chiller drawn (cooling plant not disclosed)`],
  "dc-fan": ["냉각기 팬 · 더울수록 빨리 돌아 공기를 더 많이 보냄", "Cooler fans · spin faster the hotter it gets"],
  "dc-panel": ["냉각기 제어반 · 바깥 기온계가 붙어 있음", "Cooler control panel · with the outdoor thermometer"],
  pumps: ["1차 냉각수 펌프 2대 (1대 예비) · 식힌 물을 벽 쪽 공급 배관으로 CDU에 보냄 → 냉각수 고리가 닫힘 · 초록 등 = 가동", "Facility water pumps (one spare) · send the cooled water back along the supply main to the CDUs, closing the loop · green lamp = running"],
  thermo: [`바깥 기온 (예시) · 빨간 띠 = ${NO_CHILLER_MAX} °C 이상: 여기부터는 바깥 공기만으로 ${WATER.supply} °C 물을 못 만듦 (온도차 ${WATER.approach} °C 가정) → 이런 한낮엔 기계식 냉각을 보태야 할 수 있음 (NVIDIA: '알맞은 기후에서', 가장 더운 때는 지역 기후가 정함) · 서텍사스 무더운 여름 오후 예시 ${TEMP.hot} °C`, `Outdoor temperature (example) · red band = ${NO_CHILLER_MAX} °C and up, where outside air alone can no longer make ${WATER.supply} °C water (assuming a ${WATER.approach} °C approach) → such afternoons may need added mechanical cooling (NVIDIA: 'in suitable climates'; local climate decides for the hottest periods) · a hot West Texas summer afternoon, ${TEMP.hot} °C in this example`],
};
const PHASE_TEXT = {
  normal: [`평소 · 건식 냉각기만으로 냉각, 칠러 없음 · 랙에 들어가는 물은 ${WATER.supply} °C까지 따뜻해도 됨 (NVIDIA: Vera Rubin)`, `Normal · dry coolers alone, no chillers · the water going into the racks can be as warm as ${WATER.supply} °C (NVIDIA: Vera Rubin)`],
  warm: ["기온이 오름 · 냉각기 팬이 빨라짐", "Heating up · the cooler fans speed up"],
  hot: [`더운 오후 ${TEMP.hot} °C · 그래도 물은 약 ${coolest(TEMP.hot)} °C까지 식음 → ${WATER.supply} °C 아래라 칠러가 필요 없음 · NVIDIA 조건은 '알맞은 기후에서' — 바깥 ${NO_CHILLER_MAX} °C 이상인 한낮엔 기계식 냉각을 보태야 할 수 있음 (Horizon은 이때 칠러가 보탬)`, `Hot afternoon, ${TEMP.hot} °C · the water still cools to about ${coolest(TEMP.hot)} °C → below ${WATER.supply} °C, so no chiller is needed · NVIDIA's condition is 'in suitable climates' — above ${NO_CHILLER_MAX} °C outside, mechanical cooling may have to be added (at Horizon the chiller tops up here)`],
  evening: ["저녁 · 기온이 내려가 팬이 느려짐", "Evening · the air cools and the fans slow"],
  grow: ["다음 단계 · 비워 둔 자리에 대형 변압기, 앞마당 패드에 1차 변압기가 들어섬 · 흐린 그림 = 예시 (시기·규모는 밝히지 않음)", "Next phase · a large transformer fills the empty bay and primary transformers go on the front-yard pads · faint drawing = example (timing and size not disclosed)"],
  grown: [`첫 단계 ${SITE.phase1Gross} MW = 변전소 ${fmt(SITE.mw)} MW의 약 ${PCT}% · 회사: '첫 단계가 다음 단계를 더 빨리 붙이는 뼈대' · 스위트워터 1·2 = ${SITE.hubMw / 1000} GW 허브`, `Phase 1's ${SITE.phase1Gross} MW = about ${PCT}% of the ${fmt(SITE.mw)} MW substation · company: 'the first phase creates the backbone for faster subsequent phases' · Sweetwater 1 + 2 = a ${SITE.hubMw / 1000} GW hub`],
  settle: ["지금 모습으로 · 1단계 건설 중, 2027년 4분기 목표 (회사)", "Back to today · phase 1 under construction, targeted for Q4 2027 (company)"],
  rack: [`규모 ① 랙 1대 · Vera Rubin NVL72 = GPU ${RUBIN.gpusPerRack}개 (NVIDIA) · 랙 전력 약 ${RUBIN.rackKw.join("–")} kW (업계 추정 — NVIDIA는 발표하지 않음)`,
    `Scale ① one rack · Vera Rubin NVL72 = ${RUBIN.gpusPerRack} GPUs (NVIDIA) · about ${RUBIN.rackKw.join("–")} kW per rack (industry estimate — NVIDIA hasn't published it)`],
  hall: [`규모 ② 첫 단계 · IT ${SITE.phase1It} MW (회사) ÷ GPU 1개당 약 ${RUBIN.kwPerGpu.toFixed(1)} kW (추정) ≈ GPU ${fmt(LADDER.hall.nums[1].value)}개 · 랙 약 ${fmt(LADDER.hall.racks)}대 · 그림의 홀은 그중 한 토막`,
    `Scale ② phase 1 · ${SITE.phase1It} MW of IT (company) ÷ about ${RUBIN.kwPerGpu.toFixed(1)} kW per GPU (estimate) ≈ ${fmt(LADDER.hall.nums[1].value)} GPUs in about ${fmt(LADDER.hall.racks)} racks · the hall drawn here is one slice`],
  site: [`규모 ③ 스위트워터 1 · 계통 연결 ${fmt(SITE.mw)} MW · 부지 ${fmt(SITE.acres)} 에이커 (회사) · 첫 단계 ${SITE.phase1Gross} MW는 그중 약 ${PCT}% · 스위트워터 1·2 = ${SITE.hubMw / 1000} GW 허브`,
    `Scale ③ Sweetwater 1 · ${fmt(SITE.mw)} MW grid connection · ${fmt(SITE.acres)} acres (company) · phase 1's ${SITE.phase1Gross} MW is about ${PCT}% of it · Sweetwater 1 + 2 = a ${SITE.hubMw / 1000} GW hub`],
};
// '회사 확인' 보기의 아래 줄 (둘러보기는 멈추고 전체 모습을 보여 줌)
PHASE_TEXT.confirmed = ["회사 확인 보기 · 색 = 회사 공시·사진으로 확인한 변전소 설비 · 하양 = 회사가 밝히지 않아 그린 홀 안·냉각 설비·다음 단계 자리",
  "Company-confirmed view · colour = substation gear confirmed by filings and photos · white = hall interior, cooling plant and next-phase bays the company hasn't disclosed (drawn)"];
for (const [phase, text] of Object.entries(PHASE_TEXT)) INFO[`ph-${phase}`] = text;
// 숫자와 단위가 줄바꿈으로 갈라지지 않게 (40 °C · 800 V · 5,400만 L …) 사이 빈칸을 줄바꿈 없는 빈칸으로
//   부팅 그림(rack/build.mjs)과 같은 규칙에 °C 와 '만' 을 더함 · 말풍선·아래 줄·그림 아래 설명 모두
const nb = (s) => s.replace(/(\d만?) (?=[A-Za-z%°])/g, "$1 ");
for (const o of [INFO, PHASE_TEXT]) for (const key of Object.keys(o)) o[key] = o[key].map(nb);
// 구역이 정해지지 않은 설명 키가 있으면 빌드를 멈춤 (새 부품을 넣을 때 ZONE 에 같이 적을 것)
const unzoned = Object.keys(INFO).filter((key) => !key.startsWith("ph-") && !zoneOf(key));
if (unzoned.length) throw new Error(`'회사 확인' 보기 구역(ZONE)이 정해지지 않은 설명 키: ${unzoned.join(", ")}`);
// '회사 확인' 보기의 말풍선: 맨 앞(굵은 줄)에 회사 확인 / 그림 표현 을 붙임
const ZONE_TAG = { confirmed: ["회사 확인", "Company-confirmed"], drawn: ["그림 표현", "Drawn (not disclosed)"] };
const CONF_INFO = Object.fromEntries(Object.entries(INFO).map(([key, [ko, en]]) => {
  const tag = ZONE_TAG[zoneOf(key)];
  return [key, tag ? [`${tag[0]} · ${ko}`, `${tag[1]} · ${en}`] : [ko, en]];
}));
const ICON_IN = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const ICON_OUT = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const ICON_LAYERS = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>';
const ICON_CHECK = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/></svg>';
const zoomText = (ko) => ({
  in: ICON_IN + `<span>${ko ? "확대" : "Zoom"}</span>`, out: ICON_OUT + `<span>${ko ? "전체 보기" : "Full view"}</span>`,
  aria: ko ? ["스위트워터 1 그림: 345 kV 송전선에서 변전소·홀·랙까지 전기가 내려오는 길과 냉각수가 도는 길을 저절로 확대해 하나씩 짚고 더운 오후에도 칠러 없이 식는 모습과 비워 둔 자리에 다음 단계가 붙는 모습을 보여 준 뒤 랙 1대에서 첫 단계 홀, 스위트워터 1 전체로 넓혀 가며 규모를 보여 줍니다. + 키나 확대 단추로 직접 확대할 수 있습니다", "확대: 포인터나 화살표 키로 둘러보고 Esc로 전체 보기"]
    : ["Sweetwater 1: an automatic tour zooms down the power path from the 345 kV line through the substation to the hall and racks, then along the coolant loop, shows the hall cooling without chillers on a hot afternoon and the next phase filling the empty bay, then widens from one rack to the phase 1 hall and the whole of Sweetwater 1 to show the scale. Press + or the zoom button to zoom yourself", "Zoomed: look around with the pointer or arrow keys; Escape for the full view"],
  hint: ko ? "확대 중 · 부품을 가리키거나 탭하면 바로 옆에 설명이 뜹니다" : "zoomed · point at or tap a part to see what it is right beside it",
});

// ---------- 페이지 ----------
const ASPECT = (WIDTH / HEIGHT).toFixed(3);
// '회사 확인' 보기의 "하얗게": 재료 색(.sw-xfmr 등)은 var(--fx-이름, 원래 색) 으로 바꿔 두고, 하얗게 칠할 부품을 감싼 <g data-drawn> 에 --fx-* 를 정함
//   → 재료 색이 모두 흰 모형 색으로 바뀜 (<use> 로 복사한 부품도 감싼 쪽에서 값을 물려받아 똑같이 바뀜)
//   반투명으로 하지 않음 → 겹친 부품이 비쳐 탁해 보이지 않음. 흐름 점선은 --fx-vis 로 숨김
const WHITE = { paper: "#fbfbfc", face: "#fdfdfd", top: "#ffffff", "shade-0": "#e6e9ed", "shade-1": "#ebeef1", "shade-2": "#f0f2f5", "shade-3": "#f5f7f8", "lit-top": "#ffffff", "lit-shade": "#eef0f3",
  hi: "#9aa2ab", mid: "#b2b9c1", lo: "#c7cdd3", faint: "#dce0e5", lit: "#9aa2ab", dot: "#b2b9c1", green: "#c7cdd3", red: "#c7cdd3", blue: "#c7cdd3" };
const WHITE_VARS = Object.entries(WHITE).map(([name, color]) => `--fx-${name}:${color};--anatomy-${name}:${color}`).join(";");
const CONF_CSS = `.sw-fig[data-view=confirmed] [data-drawn]{${WHITE_VARS};--fx-cut:#f3f5f7;--fx-vis:hidden}`
  + `.sw-stage .pw-flow{visibility:var(--fx-vis,visible)}`
  + `.sw-fig[data-view=confirmed] [data-drawn] :is(.hz-lamp,.hz-pumplamp){fill:#eef0f3!important;stroke:#c7cdd3!important}`
  + `.sw-fig[data-view=confirmed] [data-drawn] .hz-needle .iso-line{stroke:#b2b9c1!important}`
  + `.sw-fig[data-view=confirmed] [data-drawn] .hz-hotarc{stroke:#dce0e5!important}`
  + `.sw-fig[data-view=confirmed] .hz-puffs{display:none}`
  + `.sw-fig:not([data-view=confirmed]) .sw-only-conf,.sw-fig[data-view=confirmed] .sw-only-all{display:none!important}`;
const CSS = ["power/power.css", "horizon/horizon.css", "sweetwater/sweetwater.css"].map((f) => readFileSync(join(HERE, "..", f), "utf8")).join("").replaceAll("__ASPECT__", ASPECT)
  .replace(/--anatomy-([a-z0-9-]+):([^;}]+)/g, (all, name, color) => `--anatomy-${name}:var(--fx-${name},${color})`) + CONF_CSS;
const LIVE = readFileSync(join(HERE, "..", "shared", "zoomer.js"), "utf8") + readFileSync(join(HERE, "live.js"), "utf8");
const DATA = { W: WIDTH, H: HEIGHT, zoom: 2.4, focus: at([130, -30, 15]).map(r1), stops: STOPS, parts: PART_STOPS.length, phaseStop: PHASE_STOP, plan: PLAN, puffs: PUFFS, needle: { min: NEEDLE[0], n: NEEDLE.length }, fan: FAN_FRAMES, plates: Object.keys(LADDER) };
const fill = (src, values) => src.replace(/__([A-Z]+)__/g, (all, name) => (name in values ? values[name] : all));
const a = (href, text) => `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;

// ---------- 규모 이름표 (둘러보기 끝: 랙 1대 → 첫 단계 홀 → 스위트워터 1) ----------
// NVIDIA DSX POD 소개 영상의 연출을 빌림: 장면마다 이름 + 숫자 2개. 숫자 옆 작은 글에 근거(회사 · NVIDIA 사양 · 추정)를 붙임
//   그림 오른쪽 위에 3장을 겹쳐 두고, 움직임 코드가 그림 칸의 data-plate 를 바꾸면 CSS 가 그 장만 보여 줌
const BASIS = { company: ["회사", "company"], nvidia: ["NVIDIA 사양", "NVIDIA spec"], estimate: ["업계 추정", "industry estimate"] };
function plates(ko) {
  const i = ko ? 0 : 1, by = (num) => BASIS[num.basis][i];
  const { rack, hall, site } = LADDER;
  const cards = [
    ["rack", ko ? "Vera Rubin NVL72 랙 1대" : "One Vera Rubin NVL72 rack", [
      [fmt(rack.nums[0].value), `GPU · ${by(rack.nums[0])}`],
      [`${rack.nums[1].range.join("–")} kW`, `${ko ? "랙 전력" : "rack power"} · ${by(rack.nums[1])}`]]],
    ["hall", ko ? "스위트워터 1 첫 단계" : "Sweetwater 1 phase 1", [
      [`${hall.nums[0].value} MW`, `${ko ? "IT 전력" : "IT power"} · ${by(hall.nums[0])}`],
      [`≈ ${fmt(hall.nums[1].value)}`, ko ? `GPU · 추정 (랙 ≈ ${fmt(hall.racks)}대)` : `GPUs · estimate (≈ ${fmt(hall.racks)} racks)`]]],
    ["site", ko ? "스위트워터 1" : "Sweetwater 1", [
      [`${fmt(site.nums[0].value)} MW`, `${ko ? "계통 연결" : "grid connection"} · ${by(site.nums[0])}`],
      [`${fmt(site.nums[1].value)} ${ko ? "에이커" : "acres"}`, `${ko ? "부지" : "site"} · ${by(site.nums[1])}`]]],
  ];
  return `<div class="sw-plates" aria-hidden="true">${cards.map(([id, name, nums]) =>
    `<div class="sw-plate" data-for="${id}"><b>${name}</b>${nums.map(([v, t]) => `<p><strong>${nb(v)}</strong><span>${t}</span></p>`).join("")}</div>`).join("")}</div>`;
}

function page(ko) {
  const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: ko ? "스위트워터 1 변전소와 1단계 액체냉각 홀 한 토막의 모형" : "Model of the Sweetwater 1 substation and a slice of the phase 1 liquid-cooled hall", body: `<defs>${T.clips.join("")}</defs>${BASE_SVG}${body}<g class="hz-puffs" aria-hidden="true"></g>`, className: "pw-svg" });
  const title = ko ? "스위트워터 1 · 변전소에서 액체냉각 홀까지" : "Sweetwater 1 · from substation to liquid-cooled hall";
  const sub = ko ? `계통 연결 ${fmt(SITE.mw)} MW (345 → 138 → 34.5 kV) · 첫 단계 ${SITE.phase1Gross} MW (IT ${SITE.phase1It} MW) 건설 중 · 홀 안은 그림 표현` : `${fmt(SITE.mw)} MW grid connection (345 → 138 → 34.5 kV) · phase 1 of ${SITE.phase1Gross} MW (${SITE.phase1It} MW IT) under construction · hall interior illustrative`;
  const zt = zoomText(ko);
  const keys = ko
    ? [["hz-k-cold", "공급 물 (식힌 물)"], ["hz-k-warm", "회수 물 (데워진 물)"], ["pw-k-flow", "전류"], ["sw-k-ghost", "다음 단계 (예시)"], ["pw-k-cut", "잘라 보여 준 면"]]
    : [["hz-k-cold", "supply water (cooled)"], ["hz-k-warm", "return water (warmed)"], ["pw-k-flow", "current"], ["sw-k-ghost", "next phase (example)"], ["pw-k-cut", "cut-away faces"]];
  const subConf = ko ? "회사 확인 보기 · 색 = 회사가 밝힌 설비 종류 (대수·간격은 그림) · 하양 = 회사가 밝히지 않아 그린 부분" : "Company-confirmed view · colour = equipment types the company disclosed (counts and spacing drawn) · white = drawn, not disclosed";
  const keysConf = ko
    ? [["sw-k-solid", "색 = 회사 공시·사진으로 확인한 변전소 설비"], ["sw-k-white", "하양 = 회사가 밝히지 않아 그린 부분"]]
    : [["sw-k-solid", "colour = substation gear confirmed by filings and photos"], ["sw-k-white", "white = drawn, not disclosed by the company"]];
  const captionConf = ko
    ? `회사 확인 보기: 색이 있는 부분은 회사 공시·사진으로 종류를 확인한 설비입니다 — 345 kV 송전선, 인입 가대·단로기·차단기·관형 모선, 대형 변압기(345/138 kV), 1차 변압기(138/34.5 kV), 제어동·피뢰 기둥·자갈 마당(${a(SOURCES.plant, "2025-01 공시")}, ${a(SOURCES.site, "회사 사진")}). 대수·간격·케이블 길은 그림입니다. 하얀 부분은 회사가 밝히지 않은 것입니다 — 홀 안 전기(${DC_V} V 직류)·랙·CDU·천장 배관과 벽 밖 배관·건식 냉각기·펌프는 NVIDIA가 공개한 Vera Rubin·DSX 사양(냉각수 최대 ${WATER.supply} °C·건식 냉각기, ${a(SOURCES.nvidia, "GTC Berlin 2026 보도자료")} · ${DC_V} V 직류, ${a(SOURCES.podBlog, "DSX POD")})과 일반적인 액체냉각 설계로 그렸고 비워 둔 자리·앞마당 패드는 '첫 단계가 다음 단계를 더 빨리 붙이는 뼈대'라는 회사 설명(${a(SOURCES.call, "FY26 3분기 실적 발표")})을 보여 주는 예시입니다. 홀이 있다는 것(IT ${SITE.phase1It} MW 액체냉각 데이터센터 건설 중)은 회사가 밝혔고 안의 모습만 그림입니다. 부품을 가리키면 말풍선 맨 위에 '회사 확인' 또는 '그림 표현'이 나옵니다. 비공식 · 투자 조언 아님.`
    : `Company-confirmed view: the coloured parts are equipment types confirmed by company filings and photos — the 345 kV line, dead-end gantry, disconnects, breakers and tubular bus, large transformers (345/138 kV), the primary transformer (138/34.5 kV), control building, lightning masts and gravel yard (${a(SOURCES.plant, "Jan 2025 filing")}, ${a(SOURCES.site, "company photos")}); counts, spacing and cable routes are drawn. The white parts are not disclosed — the hall's electrics (${DC_V} V DC), racks, CDUs and overhead loop, and the outside pipework, dry cooler and pumps are drawn from NVIDIA's public Vera Rubin and DSX specs (coolant up to ${WATER.supply} °C, dry coolers, ${a(SOURCES.nvidia, "GTC Berlin 2026 release")}; ${DC_V} V DC, ${a(SOURCES.podBlog, "DSX POD")}) and common liquid-cooling design, and the empty bay and front-yard pads illustrate the company's point that 'the first phase creates the backbone for faster subsequent phases' (${a(SOURCES.call, "Q3 FY26 results call")}). That the hall exists (${SITE.phase1It} MW IT of liquid-cooled data centers under construction) is disclosed; only its insides are drawn. Point at a part and the tip starts with 'Company-confirmed' or 'Drawn'. Unofficial · not investment advice.`;
  const viewBtn = (v, icon, label) => `<button type="button" data-view-btn="${v}" aria-pressed="${v === "all"}">${icon}<span>${label}</span></button>`;
  const caption = ko
    ? `IREN 발표 기준: 스위트워터 1 = 계통 연결 ${fmt(SITE.mw)} MW, 대형 변전소(345 kV/138 kV)와 1차 변전소(138 kV/34.5 kV)(${a(SOURCES.plant, "2025-01 공시")}) · 고압 변전소 2026-05-01 예정대로 통전(${a(SOURCES.energized, "보도자료")}), IT ${SITE.phase1It} MW 액체냉각 데이터센터 첫 단계 건설 중, 'NVIDIA Vera Rubin 같은 차세대 칩 구조를 위해 설계', '첫 단계가 다음 단계를 더 빨리 붙이는 뼈대'(${a(SOURCES.call, "FY26 3분기 실적 발표")}) · 첫 단계 ${SITE.phase1Gross} MW·2027년 4분기 목표, 스위트워터 1·2 = ${SITE.hubMw / 1000} GW 허브(ERCOT Batch Zero)(${a(SOURCES.batch, "2026-09 발표")}) · 마당 모습(${a(SOURCES.site, "회사 사진")}) · 스위트워터 캠퍼스가 NVIDIA DSX 구조의 대표 배치가 될 것으로 기대(${a(SOURCES.dsx, "2026-05 NVIDIA 공동 발표")}). NVIDIA: Vera Rubin은 닫힌 순환 액체냉각에 냉각수 최대 ${WATER.supply} °C · 알맞은 기후에서는 바깥 건식 냉각기가 물을 증발시키지 않고 열을 버림(${DSX.gw} GW 규모에서 냉각탑보다 하루 물 ${fmt(DSX.litersPerDay / 1e4)}만 L 절약) · 가장 더운 때 기계식 냉각을 보탤지는 지역 기후가 정함(${a(SOURCES.nvidia, "GTC Berlin 2026 보도자료")}, ${a(SOURCES.keynote, "기조연설 30:05")}). 홀 전기는 NVIDIA DSX POD(${a(SOURCES.pod, "2026-10-21 발표")})가 랙에 넣는 ${DC_V} V 직류 방식(${a(SOURCES.podBlog, "기술 블로그")}, ${a(SOURCES.keynotePod, "기조연설 30:42")})을 따라 정류기 → ${DC_V} V 버스웨이로 그렸지만 480 V 교류로 짓는 Vera Rubin 설계도 있어(${a(SOURCES.ac480, "슈나이더 일렉트릭")}) 추정입니다. NVIDIA는 줄 단위 ${DC_V} V 직류 버스웨이가 ${COPPER.vsVac} V 교류 배전보다 구리를 ${COPPER.cut * 100}% 적게 쓴다고 밝혔습니다(${a(SOURCES.copper, "기술 블로그 2025-05")}, ${a(SOURCES.podVideo, "DSX POD 영상")}). 홀 안 설계·냉각 설비 구성·대수·랙 사양은 회사가 밝히지 않아 위 사양을 바탕으로 한 그림 표현이고 냉각기·CDU 온도차 ${WATER.approach} °C(→ 바깥 ${NO_CHILLER_MAX} °C까지 칠러 없이)와 기온은 가정입니다. 둘러보기 끝의 규모 이름표에서 랙 전력 ${RUBIN.rackKw.join("–")} kW는 업계 추정(공급망 조사·SemiAnalysis)이고 GPU 수는 IT ${SITE.phase1It} MW를 GPU 1개당 약 ${RUBIN.kwPerGpu.toFixed(1)} kW로 나눈 추정입니다(이 사이트의 홀 추정과 같은 가정). 변전소 설비는 실제보다 작게, 거리는 크게 줄였습니다. 비공식 · 투자 조언 아님.`
    : `Per IREN: Sweetwater 1 = ${fmt(SITE.mw)} MW of grid connection, a bulk substation (345 kV/138 kV) and primary substations (138 kV/34.5 kV) (${a(SOURCES.plant, "Jan 2025 filing")}); the high-voltage substation was energized on schedule on 2026-05-01 (${a(SOURCES.energized, "release")}) and the initial ${SITE.phase1It} MW IT phase of liquid-cooled data centers is under construction, 'designed for next generation chip architectures, including the NVIDIA Vera Rubin', sequenced so that 'the first phase creates the backbone for faster subsequent phases' (${a(SOURCES.call, "Q3 FY26 results call")}); phase 1 = ${SITE.phase1Gross} MW targeted for Q4 2027, and Sweetwater 1 + 2 form a ${SITE.hubMw / 1000} GW hub (ERCOT Batch Zero) (${a(SOURCES.batch, "Sep 2026 release")}); yard as in the ${a(SOURCES.site, "company photos")}; the companies expect the Sweetwater campus to serve as a flagship deployment for NVIDIA's DSX architecture (${a(SOURCES.dsx, "May 2026 joint release with NVIDIA")}). NVIDIA: Vera Rubin uses closed-loop liquid cooling with coolant up to ${WATER.supply} °C; in suitable climates, outdoor dry coolers reject the heat without evaporating water (${DSX.litersPerDay / 1e6} million liters a day saved at ${DSX.gw} GW versus cooling towers), and local climate decides whether supplemental mechanical cooling is needed in the hottest periods (${a(SOURCES.nvidia, "GTC Berlin 2026 release")}, ${a(SOURCES.keynote, "keynote 30:05")}). The hall electrics follow the ${DC_V} V DC that NVIDIA's DSX POD (${a(SOURCES.pod, "announced 2026-10-21")}) feeds to its racks (${a(SOURCES.podBlog, "technical blog")}, ${a(SOURCES.keynotePod, "keynote 30:42")}), drawn as rectifiers and an ${DC_V} V busway, but Vera Rubin designs on 480 V AC exist too (${a(SOURCES.ac480, "Schneider Electric")}), so this is an estimate. NVIDIA says row-level ${DC_V} V DC busways use ${COPPER.cut * 100}% less copper than ${COPPER.vsVac} V AC distribution (${a(SOURCES.copper, "technical blog, May 2025")}, ${a(SOURCES.podVideo, "DSX POD video")}). The hall layout, cooling plant, unit counts and rack specs are not disclosed, so they are drawn from those specs; the ${WATER.approach} °C cooler + CDU approach (→ no chiller up to ${NO_CHILLER_MAX} °C outside) and the temperatures are assumptions. In the scale cards at the end of the tour, the ${RUBIN.rackKw.join("–")} kW rack power is an industry estimate (supply-chain checks, SemiAnalysis) and the GPU count divides ${SITE.phase1It} MW of IT by about ${RUBIN.kwPerGpu.toFixed(1)} kW per GPU (the same assumption as this site's hall estimates). Substation equipment is drawn smaller than life and distances heavily shortened. Unofficial · not investment advice.`;
  return `<!doctype html><html lang="${ko ? "ko" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${k.ISO_CSS}${CSS}</style></head>
<body class="iso pw-body" data-theme="light"><main class="pw-page">
<div class="rk-fig pw-fig sw-fig" data-view="all">
  <div class="rk-head"><h2>${title} <small class="sw-only-all">${nb(sub)}</small><small class="sw-only-conf">${nb(subConf)}</small></h2>
    <div class="pw-view" role="group" aria-label="${ko ? "보기" : "View"}">${viewBtn("all", ICON_LAYERS, ko ? "전체" : "All")}${viewBtn("confirmed", ICON_CHECK, ko ? "회사 확인" : "Company-confirmed")}</div>
    <button class="rk-zoom" type="button" data-zoom="sw" data-call aria-pressed="false">${zt.in}</button></div>
  <div class="rk-stage hz-stage sw-stage" data-fig="sweetwater" tabindex="0" role="group" aria-label="${zt.aria[0]}">${svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')}<span class="rk-aim" aria-hidden="true"></span><div class="rk-tip"><b></b><span></span></div>${plates(ko)}</div>
  <div class="rk-read" data-readout="sweetwater">${PHASE_TEXT.normal[ko ? 0 : 1]}</div>
  <div class="pw-legend sw-only-all">${keys.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>
  <div class="pw-legend sw-only-conf">${keysConf.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>
  <p class="pw-caption sw-only-all">${nb(caption)}</p>
  <p class="pw-caption sw-only-conf">${nb(captionConf)}</p>
</div></main>
<script>(function(){${fill(LIVE, { DATA: JSON.stringify(DATA), KO: ko ? "true" : "false", INFO: JSON.stringify(INFO), CONFINFO: JSON.stringify(CONF_INFO), PHASE: JSON.stringify(PHASE_TEXT), ZOOM: JSON.stringify(zt), STATE: stateAt.toString() })}})();</script>
</body></html>`;
}
mkdirSync(join(ROOT, "public", "figures"), { recursive: true });
for (const ko of [true, false]) {
  const file = join(ROOT, "public", "figures", `sweetwater-1.${ko ? "ko" : "en"}.html`);
  writeFileSync(file, page(ko));
  console.log(`wrote ${file.replace(ROOT + "/", "")} (${(readFileSync(file).length / 1024).toFixed(0)} KB) · ${R.items.length} items · ${WIDTH}×${HEIGHT}`);
}
// 검사 예외 (4배 확대로 직접 보고 판단한 것만)
//   crowd: 화면에서만 가까운 쌍 — 케이블 끝이 애자 위 단자에 닿는 연결(끝과 애자 테두리가 맞닿음),
//          세 상(相)이 대각선으로 겹쳐 보이는 변전소의 우연(깊이 9 이상 떨어짐), 얇은 판(자갈 띠·낮은 벽·냉각기 덮개)을 막대로 본 것,
//          엘보 공 속에서 만나는 두 토막
auditAll({ sweetwater: W }, { sweetwater: {
  cover: [],
  allow: [],
  crowd: [
    ["t1.drop*", "t1.hv*"], ["t2.drop*", "t2.hv*"], ["t1.lvj*", "t1.lv*"], ["t2.lvj*", "t2.lv*"], ["t1.lvj*", "t1.head*"], ["t2.lvj*", "t2.head*"],
    ["tp.in*", "tp.head*"], ["tp.in*", "tp.hv*"], ["drop*", "string*"], ["drop*", "ds*"], ["jump*", "ds*"], ["jump*", "cb*"], ["riser*", "cb*"], ["riser*", "ds*"],
    ["jump*", "riser*"], ["jump*", "bus*"], ["jump*", "bpost*"], ["jump*", "gantry*"], ["riser*", "gantry*"], ["bus*", "gantry*"],
    ["t1.lvj*", "bus*"], ["t2.lvj*", "bus*"], ["t1.lvj*", "bpost*"], ["t2.lvj*", "bpost*"], ["t1.drop*", "bpost*"], ["t2.drop*", "bpost*"], ["t1.lvj*", "mast*"], ["t2.lvj*", "mast*"],
    ["*", "gravel*"], ["yard.*", "hall.wall"], ["yard.*", "dc.*"], ["yard.ret*", "yard.ret*"],
  ],
} });
