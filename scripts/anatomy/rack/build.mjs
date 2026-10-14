// =============================================================
// build.mjs — 첫 화면 로딩 그림: GB300 NVL72 식 GPU 서버 랙 (anatomy 스킬 방식)
// -------------------------------------------------------------
// "물건이 곧 설명": 랙 1대 = 컴퓨트 트레이 18개 × GPU 4개 = GPU 72개, 약 130 kW.
// 트레이 하나를 당기면 GPU·CPU·냉각판이 보이고, 부하를 올리면 GPU 위에 열(WebGL 잉크)이 번집니다.
// 사이트의 "MW → GPU" 환산(hallEstimate.js)이 눈앞의 물건으로 보이는 게 목적입니다.
//
// 사용법: node scripts/anatomy/rack/build.mjs
//   → scripts/anatomy/rack/rack-light.html  (검수용 독립 페이지)
//   → src/boot/rack.html                    (index.html 에 끼워 넣는 조각: 스타일 + 무대 + 스크립트)
// 단위: 1 = 5 mm.  x = 랙 가로, y = 깊이(+y 가 보는 쪽 = 앞면), z = 위.
// =============================================================
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { glCamera } from "../kit/gl.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

// ---------- 진실: 랙 한 대의 숫자 (회사·제조사 공개 사양 기준, 전력은 약값) ----------
export const RACK = {
  name: "GB300 NVL72",
  gpus: 72, cpus: 36,
  computeTrays: 18, gpuPerTray: 4, cpuPerTray: 2,
  switchTrays: 9,
  kw: 130,                 // 랙 전체 ≈ 130 kW (액체냉각)
  gpuW: 1400,              // GPU 1개 최대 약 1.4 kW (GPU만)
};

// ---------- 세계 배치 ----------
const U = 8.9;                        // 1U = 44.45 mm
const W = 120, D = 240;               // 600 × 1200 mm
const X0 = -W / 2, X1 = W / 2, Y0 = -D / 2, Y1 = D / 2;   // Y1 = 앞면
const POST = 3;                       // 기둥 두께
const BASE_H = 4, CAP_H = 4;
const FOOT_H = 7;
// 아래부터: 전원 선반 2 → 컴퓨트 9 → 스위치 9 → 컴퓨트 9 → 전원 선반 2
const SHELF_U = 2;
const stack = [];
let z = BASE_H + 1;
const push = (kind, n, units) => { for (let i = 0; i < n; i++) { stack.push({ kind, z, h: units * U, index: stack.filter((s) => s.kind === kind).length + 1 }); z += units * U; } };
push("power", 2, SHELF_U);
push("compute", 9, 1);
push("switch", 9, 1);
push("compute", 9, 1);
push("power", 2, SHELF_U);
const TOP = z + 1;                    // 윗판 아래
const H = TOP + CAP_H;
const PULLED = stack.filter((s) => s.kind === "compute")[12]; // 위 묶음의 4번째 = 13번 트레이 (눈높이 위라 윗면이 잘 보임)
const STROKE = 150;                   // 트레이가 나오는 거리 (750 mm)
const TRAY_D = 200, TRAY_W = W - 2 * POST - 2; // 트레이 몸통
const FRONT_T = 1.6;                  // 앞판 두께

const WIDTH = 640, HEIGHT = 560;
const P = k.fitProjection(
  [...k.boxCorners({ x: X0, y: Y0, w: W, d: D, r: 2 }, -FOOT_H, H), [X0 + 4, Y1 + STROKE + 4, PULLED.z], [X1 - 4, Y1 + STROKE + 4, PULLED.z]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 58, elevation: 26 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const slab = (x, y, w, d, z0, h, r = 0.6, steps = 3, bevel = 0) => k.slabOf({ x, y, w, d, r }, z0, h, P, steps, bevel);
const tenth = (n) => Math.round(n * 10) / 10;

// 화면 점들의 볼록 껍질 (트레이 몸통의 클립 영역용)
function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ---------- 1) 받침: 캐스터·높이조절 발·바닥판 ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: X0, y: Y0, w: W, d: D, r: 2 }, -FOOT_H, BASE_H, P)}"/>`];
  const feet = k.corners({ x: X0, y: Y0, w: W, d: D, r: 2 }, 9).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 4.2, -FOOT_H, 1.4, P, 24), { tone: "lo" }));            // 캐스터 바퀴 자리(디스크)
    out.push(S(k.cylinder(x, y, 2.4, -FOOT_H + 1.4, FOOT_H - 1.4, P, 20), { tone: "lo", crease: "none" })); // 발 나사
    out.push(S(slab(x - 3, y - 3, 6, 6, -1.2, 1.2, 1), { tone: "lo" }));                 // 발 받침 블록
  }
  out.push(S(slab(X0, Y0, W, D, 0, BASE_H, 2, 4, 0.8), { tone: "lo" }));                 // 바닥판
  out.push(L(k.planOutline(k.insetPlan({ x: X0, y: Y0, w: W, d: D, r: 2 }, 6), BASE_H, P, 3), { tone: "faint" }));
  const screws = k.corners({ x: X0, y: Y0, w: W, d: D, r: 2 }, 4);
  out.push(Dt(screws.map(([x, y]) => at([x, y, BASE_H])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- 2) 골격: 기둥 4개, 옆판, 뒷판 ----------
function post(x, y) { return S(slab(x, y, POST, POST, BASE_H, TOP - BASE_H, 0.5, 2), { tone: "mid", crease: "none" }); }
function rearFrame() {
  const out = [post(X0, Y0), post(X1 - POST, Y0)];
  out.push(S(slab(X0 + POST, Y0, W - 2 * POST, 1.2, BASE_H, TOP - BASE_H, 0.3, 2), { tone: "lo", crease: "none" })); // 뒷판
  // 뒤쪽 전원 배선 덕트(수직) 두 개
  for (const x of [X0 + 10, X1 - 14]) out.push(S(slab(x, Y0 + 1.2, 4, 3, BASE_H, TOP - BASE_H - 4, 0.6, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}
function sidePanel() {
  const out = [];
  const plan = { x: X1 - 2, y: Y0 + POST, w: 2, d: D - 2 * POST, r: 0.3 };
  // 가운데 수평 이음선은 판의 앞뒤 세로 모서리(실루엣)까지 닿아야 함 → slab 의 inner 로
  const seamZ = BASE_H + (TOP - BASE_H) / 2;
  const seam = k.segment([X1, Y0 + POST, seamZ], [X1, Y1 - POST, seamZ], P);
  out.push(S(k.slabOf(plan, BASE_H, TOP - BASE_H, P, 2), { tone: "mid", crease: "none", inner: L(seam, { tone: "faint" }) }));
  // 환기 슬롯: 닫힌 사각 윤곽 (끝이 없는 선) — 위·아래 각 5개
  const slots = [];
  for (const zBand of [BASE_H + 22, TOP - 40]) for (let i = 0; i < 5; i++) {
    const y0 = Y0 + 30 + i * 36, y1 = y0 + 22, za = zBand, zb = zBand + 2.4;
    slots.push(k.segment([X1, y0, za], [X1, y1, za], P), k.segment([X1, y1, za], [X1, y1, zb], P), k.segment([X1, y1, zb], [X1, y0, zb], P), k.segment([X1, y0, zb], [X1, y0, za], P));
  }
  out.push(L(slots.join(""), { tone: "lo" }));
  // 옆판 고정 나사 (네 귀퉁이 + 가운데)
  const dots = [[Y0 + 8, BASE_H + 6], [Y1 - 8, BASE_H + 6], [Y0 + 8, TOP - 6], [Y1 - 8, TOP - 6], [Y0 + 8, seamZ + 3], [Y1 - 8, seamZ + 3]].map(([y, zz]) => at([X1, y, zz]));
  out.push(Dt(dots, { size: 0.45, tone: "mid" }));
  return out.join("");
}

// ---------- 3) 트레이 앞면들 (정적) ----------
const FRONT_X0 = X0 + POST + 1, FRONT_W = W - 2 * POST - 2;
function frontPlate(s, lit = false) {
  const out = [];
  const z0 = s.z + 0.4, h = s.h - 0.8;
  out.push(S(slab(FRONT_X0, Y1 - FRONT_T, FRONT_W, FRONT_T, z0, h, 0.5, 2), { tone: s.kind === "power" ? "mid" : "hi", crease: "faint", lit }));
  // 앞판 테두리 선 (앞면의 네 변: 윤곽에 닿음)
  const inset = 1.2;
  const rect = [[FRONT_X0 + inset, z0 + inset], [FRONT_X0 + FRONT_W - inset, z0 + inset], [FRONT_X0 + FRONT_W - inset, z0 + h - inset], [FRONT_X0 + inset, z0 + h - inset]];
  out.push(L(rect.map((a, i) => { const b = rect[(i + 1) % 4]; return k.segment([a[0], Y1, a[1]], [b[0], Y1, b[1]], P); }).join(""), { tone: "faint" }));
  if (s.kind === "compute") {
    // 양쪽 손잡이(분리 레버) + 상태 LED 2개 + 가운데 라벨 홈
    for (const x of [FRONT_X0 + 6, FRONT_X0 + FRONT_W - 14]) out.push(S(slab(x, Y1, 8, 1.6, z0 + 2.2, h - 4.4, 0.6, 2), { tone: "mid", crease: "none" }));
    out.push(Dt([at([FRONT_X0 + 20, Y1 + 0.05, z0 + h / 2]), at([FRONT_X0 + 24, Y1 + 0.05, z0 + h / 2])], { size: 0.55, tone: "hi" }));
    out.push(L(k.segment([FRONT_X0 + 40, Y1 + 0.05, z0 + h / 2 - 1.5], [FRONT_X0 + 74, Y1 + 0.05, z0 + h / 2 - 1.5], P), { tone: "lo", free: true })); // 라벨 글줄
    out.push(L(k.segment([FRONT_X0 + 40, Y1 + 0.05, z0 + h / 2 + 1.5], [FRONT_X0 + 62, Y1 + 0.05, z0 + h / 2 + 1.5], P), { tone: "lo", free: true }));
  } else if (s.kind === "switch") {
    // NVLink 스위치 트레이: QSFP 포트 블록 2묶음(튀어나온 케이지) + LED
    for (const x of [FRONT_X0 + 10, FRONT_X0 + FRONT_W - 46]) out.push(S(slab(x, Y1, 36, 1.2, z0 + 1.6, h - 3.2, 0.3, 2), { tone: "mid", crease: "none" }));
    out.push(Dt([at([FRONT_X0 + 52, Y1 + 0.05, z0 + h / 2]), at([FRONT_X0 + 56, Y1 + 0.05, z0 + h / 2])], { size: 0.5, tone: "hi" }));
  } else {
    // 전원 선반: 흡기 구멍 격자 + 손잡이
    const pts = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) pts.push(at([FRONT_X0 + 18 + i * 4, Y1 + 0.05, z0 + 4 + j * 3.6]));
    out.push(Dt(pts, { size: 0.42, tone: "lo" }));
    for (const x of [FRONT_X0 + 5, FRONT_X0 + FRONT_W - 11]) out.push(S(slab(x, Y1, 6, 1.4, z0 + 3, h - 6, 0.6, 2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}
function fronts() { return stack.filter((s) => s !== PULLED).map((s) => frontPlate(s)).join(""); }

// 뽑힌 트레이의 빈 슬롯: 어두운 안쪽 (토큰을 바꾼 그룹)
function cavity() {
  const z0 = PULLED.z, h = PULLED.h;
  const out = [];
  out.push(S(slab(FRONT_X0, Y0 + 2, FRONT_W, Y1 - Y0 - 2, z0, 0.6, 0.3, 2), { tone: "lo", crease: "none" }));                  // 슬롯 바닥(레일 판)
  out.push(S(slab(FRONT_X0, Y0 + 2, FRONT_W, 2, z0, h, 0.3, 2), { tone: "lo", crease: "none" }));                               // 뒤 벽(미드플레인)
  for (const x of [FRONT_X0, FRONT_X0 + FRONT_W - 1]) out.push(S(slab(x, Y0 + 2, 1, Y1 - Y0 - 3, z0, h - 0.6, 0.2, 2), { tone: "lo", crease: "none" })); // 옆 벽(레일)
  return `<g class="rk-cavity">${out.join("")}</g>`;
}

function frontFrame() {
  const out = [post(X0, Y1 - POST), post(X1 - POST, Y1 - POST)];
  // 기둥 앞면의 19인치 마운트 구멍 (각 U 마다 3개 중 1개만 — 점 밀도 절제)
  const pts = [];
  for (const s of stack) for (const x of [X0 + 1.5, X1 - 1.5]) pts.push(at([x, Y1 + 0.05, s.z + s.h / 2]));
  out.push(Dt(pts, { size: 0.4, tone: "lo" }));
  return out.join("");
}
function cap() {
  const out = [S(slab(X0, Y0, W, D, TOP, CAP_H, 2, 4, 0.8), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan({ x: X0, y: Y0, w: W, d: D, r: 2 }, 5), TOP + CAP_H, P, 3), { tone: "faint" }));
  // 케이블 통과구 2개 (닫힌 윤곽) + 라벨판
  for (const x of [X0 + 14, X1 - 44]) out.push(L(k.planOutline({ x, y: Y0 + 12, w: 30, d: 10, r: 2 }, TOP + CAP_H, P, 3), { tone: "lo" }));
  const label = { x: X0 + 30, y: Y1 - 26, w: 60, d: 16, r: 1.2 };
  out.push(S(k.slabOf(label, TOP + CAP_H, 0.8, P, 3), { tone: "hi", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), TOP + CAP_H + 0.8, P, 3), { tone: "faint" }));
  out.push(L([[16, 40], [20, 28], [24, 44]].map(([dy, len]) => k.lineOnTop([label.x + 6, label.y + dy - 12], [label.x + 6 + len, label.y + dy - 12], TOP + CAP_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dt([at([label.x + 3, label.y + 3, TOP + CAP_H + 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, TOP + CAP_H + 0.8])], { size: 0.45, tone: "mid" }));
  out.push(Dt(k.corners({ x: X0, y: Y0, w: W, d: D, r: 2 }, 4).map(([x, y]) => at([x, y, TOP + CAP_H])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- 4) 뽑히는 컴퓨트 트레이 (주제, lit) ----------
// 트레이 좌표: 앞판이 y = Y1 에, 몸통은 뒤로 TRAY_D 만큼. 나중에 translateAlong(P, [0, pull, 0]) 로 움직임
const TZ = PULLED.z + 0.8;             // 트레이 바닥 아래면
const TX0 = FRONT_X0 + 0.8, TW = FRONT_W - 1.6;
const TY0 = Y1 - TRAY_D;
const FLOOR_T = 1.2;
const TOPZ = TZ + FLOOR_T;             // 부품이 놓이는 바닥 윗면
// 부품 배치 (트레이 안 좌표, y 는 앞판에서 뒤로 갈수록 작아짐)
const GPU = [];                        // 히트싱크 4개: [x, y, w, d, h]
for (const [i, x] of [TX0 + 10, TX0 + TW / 2 + 4].entries()) for (const yy of [Y1 - 54, Y1 - 100]) GPU.push({ x, y: yy, w: 34, d: 38, h: 5.2, id: GPU.length });
const CPU = [TX0 + 12, TX0 + TW / 2 + 8].map((x) => ({ x, y: Y1 - 150, w: 24, d: 24, h: 3.6 }));
const MANIFOLD = [{ x: TX0 + TW / 2 - 4, y: TY0 + 6, w: 2.4, d: TRAY_D - 24 }, { x: TX0 + TW / 2 + 1.6, y: TY0 + 6, w: 2.4, d: TRAY_D - 24 }]; // 냉각수 공급·회수 관 (중앙)
function trayBody() {
  const out = [];
  out.push(S(slab(TX0, TY0, TW, TRAY_D - FRONT_T, TZ, FLOOR_T, 0.6, 3), { tone: "hi", crease: "lo" }));                      // 바닥판
  for (const x of [TX0, TX0 + TW - 1.2]) out.push(S(slab(x, TY0, 1.2, TRAY_D - FRONT_T, TZ, PULLED.h - 2.2, 0.3, 2), { tone: "mid", crease: "none" })); // 옆 레일
  out.push(S(slab(TX0 + 1.2, TY0, TW - 2.4, 2, TZ, PULLED.h - 2.6, 0.3, 2), { tone: "mid", crease: "none" }));                   // 뒤판(미드플레인 커넥터 자리)
  // 뒤판의 NVLink 커넥터 6개 (작은 블록)
  for (let i = 0; i < 6; i++) out.push(S(slab(TX0 + 8 + i * 16, TY0 + 2, 10, 2.4, TOPZ + 0.6, 3.4, 0.3, 2), { tone: "lo", crease: "none" }));
  // 냉각수 관 2줄 + 앞쪽 퀵커넥터 2개
  for (const m of MANIFOLD) out.push(S(slab(m.x, m.y, m.w, m.d, TOPZ, 2.4, 1.1, 3), { tone: "mid", crease: "none" }));
  for (const m of MANIFOLD) out.push(S(k.cylinder(m.x + m.w / 2, m.y + m.d + 3, 1.9, TOPZ, 2.8, P, 16), { tone: "mid" }));
  // CPU 2개 (낮은 블록, 윗면 홈 1줄)
  for (const c of CPU) {
    out.push(S(slab(c.x, c.y, c.w, c.d, TOPZ, c.h, 0.6, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(L(k.planOutline(k.insetPlan({ x: c.x, y: c.y, w: c.w, d: c.d, r: 0.6 }, 3), TOPZ + c.h, P, 2), { tone: "faint" }));
  }
  // 냉각판 다리: 관에서 각 GPU·CPU 로 가는 짧은 가지 (관 옆면에서 시작해 블록 옆면에서 끝남)
  for (const g of GPU) {
    const fromX = g.x < TX0 + TW / 2 ? MANIFOLD[0].x : MANIFOLD[1].x + MANIFOLD[1].w;
    const toX = g.x < TX0 + TW / 2 ? g.x + g.w : g.x;
    out.push(S(slab(Math.min(fromX, toX), g.y + g.d / 2 - 1, Math.abs(toX - fromX), 2, TOPZ, 1.6, 0.8, 2), { tone: "mid", crease: "none" }));
  }
  // GPU 히트싱크 4개: 블록 + 핀 줄(윗면을 가로지르는 선, 양 끝이 윤곽에 닿음)
  for (const g of GPU) out.push(S(slab(g.x, g.y, g.w, g.d, TOPZ, g.h, 0.6, 3, 0.5), { tone: "hi", crease: "lo", className: "rk-gpu" }));
  return out.join("");
}
// 핀 줄은 열 잉크(캔버스) 위에 그려져야 하므로 앞쪽 SVG 로
function trayFins() {
  const out = [];
  for (const g of GPU) {
    const lines = [];
    for (let yy = g.y + 2.2; yy < g.y + g.d - 1.5; yy += 2.2) lines.push(k.lineOnTop([g.x, yy], [g.x + g.w, yy], TOPZ + g.h, P));
    out.push(L(lines.join(""), { tone: "lo" }));
  }
  return out.join("");
}
function trayFront() {
  const out = [frontPlate(PULLED, true)];
  return out.join("");
}
// 트레이 몸통은 랙 앞면 밖(y > Y1)에 있는 부분만 보임 → 그 공간의 화면 껍질로 클립
const CLIP = hull(k.boxCorners({ x: TX0 - 1, y: Y1 - 0.2, w: TW + 2, d: STROKE + 6, r: 0 }, TZ - 1, TZ + PULLED.h + 1).map(at));
const clipPath = k.pathOf(CLIP, true);

// ---------- 5) 합치기 ----------
const LABEL = `${RACK.name} GPU rack: ${RACK.computeTrays} compute trays, ${RACK.switchTrays} NVLink switch trays and power shelves in a 19-inch rack. One compute tray slides out to show its ${RACK.gpuPerTray} GPUs, ${RACK.cpuPerTray} CPUs and liquid cold plates; heat on the GPUs rises with load.`;
const back = [
  base(), rearFrame(), cavity(), sidePanel(), fronts(), frontFrame(),
  `<clipPath id="rk-clip"><path d="${clipPath}"/></clipPath>`,
  // 클립은 움직이는 그룹 "바깥"에: 안에 두면 트레이와 함께 움직여 몸통을 통째로 잘라 버림
  `<g clip-path="url(#rk-clip)"><g data-part="tray-body">${trayBody()}</g></g><g data-part="tray-plate">${trayFront()}</g>`,
  cap(),
];
const front = [`<clipPath id="rk-clip-front"><path d="${clipPath}"/></clipPath><g clip-path="url(#rk-clip-front)"><g data-part="tray-fins">${trayFins()}</g></g>`];
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: back, className: "rk-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rk-layer rk-front" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${front.join("")}</svg>`;

// 페이지로 넘기는 숫자: 투영(이동 벡터), GPU 사각형(열 잉크 위치), 트레이 높이
const pullVec = k.axisVector(P, [0, 1, 0]);     // 세계 +y 1단위의 화면 벡터
const DATA = {
  W: WIDTH, H: HEIGHT, camera: glCamera(P), pull: [tenth(pullVec[0]), tenth(pullVec[1])], stroke: STROKE,
  zTop: tenth(TOPZ + GPU[0].h), zFloor: tenth(TOPZ), front: Y1,
  gpu: GPU.map((g) => [g.x, g.y, g.w, g.d].map(tenth)), cpu: CPU.map((c) => [c.x, c.y, c.w, c.d].map(tenth)),
  rack: RACK, tray: PULLED.index,
};

const CSS = `
.rk-stage{position:relative;touch-action:pan-y;outline:none}
.rk-stage>svg,.rk-stage>canvas{display:block;width:100%;height:auto}
.rk-stage>.rk-layer{position:absolute;inset:0;height:100%!important;pointer-events:none}
.rk-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.rk-cavity{--anatomy-paper:#d9d8d4;--anatomy-face:#dddcd8;--anatomy-top:#e2e1dd;--anatomy-shade-0:#c3c2be;--anatomy-shade-1:#cbcac6;--anatomy-shade-2:#d2d1cd;--anatomy-shade-3:#d8d7d3;--anatomy-lo:#a6a5a1;--anatomy-faint:#bdbcb8}
/* WebGL 이 없을 때: GPU 윗면이 부하만큼 데워진 색으로 (셰이더와 같은 잉크 색, 곱하기 혼합) */
.rk-stage:not([data-gl]) .rk-gpu>.iso-top{fill:color-mix(in srgb,var(--anatomy-top),#f0a640 calc(var(--rk-load,0)*70%))}
.rk-stage:not([data-gl]) .rk-gpu>.iso-shade{fill:color-mix(in srgb,var(--anatomy-shade-2),#e06a2a calc(var(--rk-load,0)*45%))}
.rk-ui{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;font-family:var(--anatomy-mono);font-size:11.5px;color:var(--anatomy-text)}
.rk-ui b{color:var(--anatomy-strong);font-weight:600}
.rk-ui .rk-go{margin-left:auto;white-space:nowrap;flex:none;border:1px solid var(--anatomy-muted);background:var(--anatomy-face);color:var(--anatomy-strong);border-radius:999px;padding:6px 12px;font:inherit;cursor:pointer}
.rk-ui .rk-go[disabled]{opacity:.55;cursor:default}
`;

// 열 잉크 셰이더 (라이트 테마, 종이 위 잉크): GPU 네 개 윗면에 부하만큼 데워진 색, 냉각판 다리 쪽으로 식어 감
const FRAGMENT = `
uniform float uLoad;      // 0..1 부하
uniform float uPull;      // 트레이가 나온 거리 (세계 단위, +y)
uniform float uFirst;     // 처음 켜질 때 0→1 (잉크를 통째로 페이드)
float uPx;                // 이 픽셀의 세계 단위 크기 (main 에서 채움)
const float ZTOP=${DATA.zTop.toFixed(1)};
const float FRONT=${DATA.front.toFixed(1)};
const vec4 G0=vec4(${DATA.gpu[0].join(",")}),G1=vec4(${DATA.gpu[1].join(",")}),G2=vec4(${DATA.gpu[2].join(",")}),G3=vec4(${DATA.gpu[3].join(",")});
float boxDist(vec2 p,vec4 b){vec2 c=b.xy+b.zw*.5;vec2 q=abs(p-c)-b.zw*.5;return length(max(q,0.))+min(max(q.x,q.y),0.);}
// 한 블록의 열: 안쪽은 1, 가장자리에서 핀 밖으로 조금 새어 나가며 0 으로. 네 블록을 합침
float heatOf(vec2 p){
  float h=0.;
  vec4 B[4];B[0]=G0;B[1]=G1;B[2]=G2;B[3]=G3;
  // 잉크는 핀 블록 윗면 안에서만: 윤곽선(0.6px)의 안쪽 가장자리(0.3)에서 끝남. 빈 바닥으로 번지는 '후광'은 종이 위에서 얼룩으로 읽혀 두지 않음
  for(int i=0;i<4;i++){float d=boxDist(p,B[i]);float inside=1.-smoothstep(-.3-.7*uPx,-.3+.7*uPx,d);h+=inside*(.62+.38*(1.-smoothstep(-16.,-4.,d)));}
  return min(h,1.);
}
// 종이 위에 보일 색: 흰 종이 → 옅은 노랑 → 주황 → 짙은 주황 (뜨거운 몸체는 어두운 빨강→주황→노랑 순서, 여기선 식은 쪽이 옅음)
vec3 paperOf(float e){
  vec3 c=mix(vec3(1.),vec3(1.,.93,.72),smoothstep(0.,.25,e));
  c=mix(c,vec3(1.,.70,.30),smoothstep(.2,.6,e));
  c=mix(c,vec3(.93,.42,.14),smoothstep(.55,1.,e));
  return c;
}
vec4 inkFor(vec3 seen,float cover){vec3 ab=1.-seen;float a=max(max(ab.r,max(ab.g,ab.b)),cover);return vec4(vec3(a)-ab,a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.z;uPx=px;
  vec3 p=onFloor(vb,ZTOP);
  vec2 q=p.xy-vec2(0.,uPull);                      // 트레이 좌표로 (트레이가 +y 로 나간 만큼 되돌림)
  float outside=smoothstep(FRONT-.7*px,FRONT+.7*px,p.y); // 랙 앞면 밖에 있는 부분만 (안쪽은 랙이 가림)
  float e=heatOf(q)*uLoad*outside;
  if(e<.002){gl_FragColor=vec4(0.);return;}
  e=1.-exp(-2.2*e);
  vec4 ink=inkFor(paperOf(e),.0);
  ink*=uFirst;
  float m=ink.a;
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  ink=max(ink+n*smoothstep(0.,1.5/255.,m),0.);
  ink.rgb=min(ink.rgb,vec3(ink.a));
  gl_FragColor=ink;
}`;

// 살아 움직이는 부분 (kit 없이 동작: 이동 벡터·좌표는 빌드 때 계산해 둠)
const LIVE = `
const D=__DATA__;
const stage=document.querySelector(".rk-stage");
const svg=stage.querySelector("svg.rk-back");
const trays=[...stage.querySelectorAll('[data-part^="tray-"]')];
const readout=stage.parentElement.querySelector("[data-readout]")||document.querySelector("[data-readout]");
const still=matchMedia("(prefers-reduced-motion: reduce)");
const canvas=stage.querySelector("canvas.rk-gl");
const layer=glLayer({canvas,fragment:${JSON.stringify(FRAGMENT)},view:[D.W,D.H],camera:D.camera,uniforms:["uLoad","uPull","uFirst"]});
if(layer)stage.setAttribute("data-gl","");
const R=D.rack, perTrayKw=R.kw/R.computeTrays;
let pull=0,target=0,load={x:0,v:0},first={x:0,v:0},clock=0,last=0,frame=0,visible=true,touring=!still.matches,idle=0,touched=false;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// 둘러보기: 트레이를 천천히 당겨(0~1.6s) 부하를 올렸다가(2.6~4.5s) 내리고 밀어 넣음, 7.5초 주기
function tourAt(t){const u=t%7.5;return {pull:u<1.6?D.stroke*(u/1.6):u<5.4?D.stroke:u<6.6?D.stroke*(1-(u-5.4)/1.2):0,load:u>2.4&&u<4.8?1:0};}
function say(text){if(readout&&readout.textContent!==text)readout.textContent=text;}
function draw(){
  const tr="translate("+(D.pull[0]*pull).toFixed(2)+" "+(D.pull[1]*pull).toFixed(2)+")";
  for(const t of trays){if(pull>.01)t.setAttribute("transform",tr);else t.removeAttribute("transform");}
  stage.style.setProperty("--rk-load",load.x.toFixed(3));
  if(layer){(load.x>1e-3&&pull>.5)?layer.draw({uLoad:load.x,uPull:pull,uFirst:first.x},still.matches?0.8:clock):layer.clear();}
  const out=pull/D.stroke;
  const kw=perTrayKw*load.x;
  say((out<.05?"tray "+D.tray+" seated":out<.98?"tray "+D.tray+" · "+Math.round(out*100)+"% out":"tray "+D.tray+" open · "+R.gpuPerTray+" GPU · "+R.cpuPerTray+" CPU")+" · load "+Math.round(load.x*100)+"% · "+kw.toFixed(1)+" kW");
  stage.setAttribute("aria-valuenow",String(Math.round(out*100)));
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;clock+=dt;const calm=still.matches;
  let wantLoad=0;
  if(touring){const t=tourAt(clock);target=t.pull;wantLoad=t.load;}else wantLoad=pull>D.stroke*.6?1:0;
  pull=calm?target:pull+(target-pull)*(1-Math.exp(-dt/.32));if(Math.abs(target-pull)<.05)pull=target;
  const a=settle(load,wantLoad,dt,.9,calm);
  const b=settle(first,layer?1:0,dt,.6,calm);
  draw();
  frame=visible?requestAnimationFrame(tick):0;
}
const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(tick);}};
const steer=(next)=>{touched=true;touring=false;target=clamp(next,0,D.stroke);clearTimeout(idle);idle=setTimeout(()=>{touring=!still.matches;clock=0;},4000);run();};
stage.addEventListener("pointermove",(e)=>{const b=svg.getBoundingClientRect();const share=clamp(((e.clientX-b.left)/b.width-.2)/.6,0,1);steer(share*D.stroke);});
stage.addEventListener("pointerdown",(e)=>{const b=svg.getBoundingClientRect();const share=clamp(((e.clientX-b.left)/b.width-.2)/.6,0,1);steer(share*D.stroke);});
stage.addEventListener("keydown",(e)=>{let to=null;if(e.key==="ArrowRight"||e.key==="ArrowUp")to=target+D.stroke/4;if(e.key==="ArrowLeft"||e.key==="ArrowDown")to=target-D.stroke/4;if(e.key==="Home")to=0;if(e.key==="End")to=D.stroke;if(to===null)return;e.preventDefault();steer(to);});
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible)run();});
if(still.matches){touring=false;target=D.stroke;pull=D.stroke;load.x=1;first.x=layer?1:0;}
draw();run();
window.__rackTouched=()=>touched;
window.__rackStop=()=>{visible=false;if(frame)cancelAnimationFrame(frame);frame=0;};
`;

const stageHtml = `<div class="rk-stage" tabindex="0" role="slider" aria-label="GPU rack: move the pointer or press the arrow keys to slide the compute tray out" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${backSvg}<canvas class="rk-layer rk-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

// 검수용 독립 페이지 (카드·범례·설명 포함)
const card = k.plateHtml({
  fig: "Fig 1", title: `${RACK.name} rack`, hint: "Hover or use arrow keys to pull the tray",
  readout: `tray ${PULLED.index} seated · load 0% · 0.0 kW`,
  keys: [{ mark: "lit", label: `One compute tray: ${RACK.gpuPerTray} GPUs, ${RACK.cpuPerTray} CPUs on liquid cold plates` }, { mark: "raised", label: `${RACK.computeTrays} compute + ${RACK.switchTrays} switch trays, power shelves top and bottom` }],
  caption: `One ${RACK.name} rack holds ${RACK.gpus} GPUs on ${RACK.computeTrays} trays and draws about ${RACK.kw} kW, which is why a 50 MW hall is roughly 350 racks and why the heat has to leave through liquid. Pull a tray and raise the load to see the GPUs warm.`,
  body: stageHtml,
});
const gl = readFileSync(join(HERE, "..", "kit", "gl.mjs"), "utf8").replace(/^export\s+(const|function)/gm, "$1").replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
const liveScript = gl + "\n" + LIVE.replace("__DATA__", JSON.stringify(DATA));
writeFileSync(join(HERE, "rack-light.html"), k.pageHtml({ title: `${RACK.name} rack`, theme: "light", body: `<style>${CSS}</style>${card}`, script: liveScript, width: 700 }));

// 앱에 끼워 넣는 조각: 스타일 + 무대 + 읽기값 줄 + 스크립트 (index.html 의 <!-- rack --> 자리에)
const fragment = `<style>${k.ISO_CSS}${CSS}</style>
<div class="iso rk-wrap" data-theme="light">
  ${stageHtml}
  <div class="rk-ui"><span data-readout>tray ${PULLED.index} seated · load 0% · 0.0 kW</span><button class="rk-go" type="button" disabled data-boot-go>불러오는 중…</button></div>
</div>
<script>(function(){${liveScript}})();</script>`;
writeFileSync(join(ROOT, "src", "boot", "rack.html"), fragment);
console.log(`wrote rack-light.html (${(readFileSync(join(HERE, "rack-light.html")).length / 1024).toFixed(0)} KB) and src/boot/rack.html (${(fragment.length / 1024).toFixed(0)} KB)`);
