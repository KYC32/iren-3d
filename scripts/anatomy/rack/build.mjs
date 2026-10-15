// =============================================================
// build.mjs — 첫 화면 로딩 그림: GB300 NVL72 식 GPU 서버 랙 (anatomy 스킬 방식)
// -------------------------------------------------------------
// "물건이 곧 설명": 랙 1대 = 컴퓨트 트레이 18개 × GPU 4개 = GPU 72개, 약 130 kW.
// 트레이 하나를 당기면 GPU·CPU·냉각판이 보이고, 부하를 올리면 GPU 위에 열(WebGL 잉크)이 번집니다.
// 사이트의 "MW → GPU" 환산(hallEstimate.js)이 눈앞의 물건으로 보이는 게 목적입니다.
// 색은 실물 사진(IREN 이 들이는 Dell XE9712 GB300 NVL72, GTC 2025 GB300 기판·HPE 트레이) 기준:
//   검정 랙, 은색 컴퓨트 트레이, 검정 메인보드, 구리 냉각판, 검정 호스, 파랑/빨강은 냉각수 연결부 고리에만.
//
// 사용법: node scripts/anatomy/rack/build.mjs           (그림 만들기)
//         node scripts/anatomy/rack/build.mjs --audit   (+ 관통·끝점·칠하는 순서 검사 결과 출력)
//   → scripts/anatomy/rack/rack-light.html  (검수용 독립 페이지)
//   → src/boot/rack.html                    (index.html 에 끼워 넣는 조각: 스타일 + 무대 + 스크립트)
// 단위: 1 = 5 mm.  x = 랙 가로, y = 깊이(+y 가 보는 쪽 = 앞면), z = 위.
// =============================================================
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { glCamera } from "../kit/gl.mjs";
import { gpuFigure, GPU } from "./gpu.mjs";
import { workshop, auditAll } from "./shop.mjs";

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
  WIDTH, HEIGHT, { pad: 12, azimuth: 58, elevation: 26 },
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
// 트레이 앞판 한 장. 컴퓨트 = 은색 판금(Dell XE9712 사진), 스위치·전원 = 검정
function frontPlate(s, lit = false) {
  const out = [];
  const z0 = s.z + 0.4, h = s.h - 0.8;
  out.push(S(slab(FRONT_X0, Y1 - FRONT_T, FRONT_W, FRONT_T, z0, h, 0.5, 2), { tone: s.kind === "power" ? "mid" : "hi", crease: "faint", lit }));
  // 앞판 테두리 선 (앞면의 네 변: 윤곽에 닿음)
  const inset = 1.2;
  const rect = [[FRONT_X0 + inset, z0 + inset], [FRONT_X0 + FRONT_W - inset, z0 + inset], [FRONT_X0 + FRONT_W - inset, z0 + h - inset], [FRONT_X0 + inset, z0 + h - inset]];
  out.push(L(rect.map((a, i) => { const b = rect[(i + 1) % 4]; return k.segment([a[0], Y1, a[1]], [b[0], Y1, b[1]], P); }).join(""), { tone: "faint" }));
  if (s.kind === "compute") {
    // 양 끝 고정 나사(둥근 손잡이) 2개
    for (const x of [FRONT_X0 + 4.2, FRONT_X0 + FRONT_W - 4.2]) {
      const F = G.frameAlong([x, Y1, z0 + h / 2], [0, 1, 0]);
      out.push(`<g class="rk-steel">${S(G.disc(0, 1.1, 1.9, F, P, { bevel: 0.2, steps: 12 }), { tone: "mid" })}</g>`);
    }
    // 저장장치(E1.S) 칸 4개 + 네트워크 포트(OSFP, ConnectX-8) 4개: 검정 사각 구멍
    const dark = [];
    for (let i = 0; i < 4; i++) dark.push(S(slab(FRONT_X0 + 9 + i * 3.4, Y1, 2.5, 0.3, z0 + 1.3, h - 2.6, 0.2, 2), { tone: "mid", crease: "none", flat: true }));
    for (let i = 0; i < 4; i++) dark.push(S(slab(FRONT_X0 + 44 + i * 6.6, Y1, 5.4, 0.35, z0 + 2.0, h - 4.0, 0.3, 2), { tone: "mid", crease: "none", flat: true }));
    out.push(`<g class="rk-chip">${dark.join("")}</g>`);
    // 상태 LED 2개(초록) + 라벨 글줄
    out.push(`<g class="rk-led-g">${Dt([at([FRONT_X0 + 26, Y1 + 0.05, z0 + h / 2 - 1.2]), at([FRONT_X0 + 26, Y1 + 0.05, z0 + h / 2 + 1.2])], { size: 0.6, tone: "hi" })}</g>`);
    out.push(L(k.segment([FRONT_X0 + 76, Y1 + 0.05, z0 + h / 2 - 1.3], [FRONT_X0 + 98, Y1 + 0.05, z0 + h / 2 - 1.3], P), { tone: "lo", free: true }));
    out.push(L(k.segment([FRONT_X0 + 76, Y1 + 0.05, z0 + h / 2 + 1.3], [FRONT_X0 + 90, Y1 + 0.05, z0 + h / 2 + 1.3], P), { tone: "lo", free: true }));
    return `<g class="rk-silver">${out.join("")}</g>`;
  } else if (s.kind === "switch") {
    // NVLink 스위치 트레이: QSFP 포트 블록 2묶음(튀어나온 케이지) + LED
    for (const x of [FRONT_X0 + 10, FRONT_X0 + FRONT_W - 46]) out.push(S(slab(x, Y1, 36, 1.2, z0 + 1.6, h - 3.2, 0.3, 2), { tone: "mid", crease: "none" }));
    out.push(`<g class="rk-led-b">${Dt([at([FRONT_X0 + 52, Y1 + 0.05, z0 + h / 2]), at([FRONT_X0 + 56, Y1 + 0.05, z0 + h / 2])], { size: 0.6, tone: "hi" })}</g>`);
  } else {
    // 전원 선반: 흡기 구멍 격자 + 손잡이
    const pts = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) pts.push(at([FRONT_X0 + 18 + i * 4, Y1 + 0.05, z0 + 4 + j * 3.6]));
    out.push(Dt(pts, { size: 0.42, tone: "lo" }));
    for (const x of [FRONT_X0 + 5, FRONT_X0 + FRONT_W - 11]) out.push(S(slab(x, Y1, 6, 1.4, z0 + 3, h - 6, 0.6, 2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}
// 앞판들: 종류마다 처음 하나만 그리고 나머지는 <use> 로 높이만 옮겨 복사 (z 이동 = 화면 세로 이동이라 똑같음)
function fronts() {
  const up = k.axisVector(P, [0, 0, 1]), firstOf = {};
  return stack.filter((s) => s !== PULLED).map((s) => {
    const first = firstOf[s.kind];
    if (!first) { firstOf[s.kind] = s; return `<g data-info="front-${s.kind}"><g id="rk-front-${s.kind}">${frontPlate(s)}</g></g>`; }
    const dz = s.z - first.z;
    return `<g data-info="front-${s.kind}"><use href="#rk-front-${s.kind}" transform="translate(${(up[0] * dz).toFixed(2)} ${(up[1] * dz).toFixed(2)})"/></g>`;
  }).join("");
}

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
  out.push('<g class="rk-paper">');
  out.push(S(k.slabOf(label, TOP + CAP_H, 0.8, P, 3), { tone: "hi", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), TOP + CAP_H + 0.8, P, 3), { tone: "faint" }));
  out.push(L([[16, 40], [20, 28], [24, 44]].map(([dy, len]) => k.lineOnTop([label.x + 6, label.y + dy - 12], [label.x + 6 + len, label.y + dy - 12], TOP + CAP_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dt([at([label.x + 3, label.y + 3, TOP + CAP_H + 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, TOP + CAP_H + 0.8])], { size: 0.45, tone: "mid" }));
  out.push('</g>');
  out.push(Dt(k.corners({ x: X0, y: Y0, w: W, d: D, r: 2 }, 4).map(([x, y]) => at([x, y, TOP + CAP_H])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- 4) 뽑히는 컴퓨트 트레이 (주제): GB300 실물 배치 ----------
// 트레이 좌표: 앞판이 y = Y1 에, 몸통은 뒤로 TRAY_D 만큼. 나중에 translateAlong(P, [0, pull, 0]) 로 움직임
// 뒤 → 앞 (GTC 2025 GB300 기판 사진 순서): GPU 4개 한 줄 → 냉각수 매니폴드 막대 → CPU 2개 + 메모리 → NIC 4개 → 저장장치·포트 → 앞판
// 다 당겨도 뒤쪽 50(250 mm)은 랙 안에 남음 → 보이는 띠는 y = Y1 - STROKE(= -30) 부터 앞판까지
const TZ = PULLED.z + 0.8;             // 트레이 바닥 아래면
const TX0 = FRONT_X0 + 0.8, TW = FRONT_W - 1.6;
const TY0 = Y1 - TRAY_D;
const FLOOR_T = 1.2;
const TOPZ = TZ + FLOOR_T;             // 트레이 바닥 윗면
const BZ = TOPZ + 0.6, BT = BZ + 0.5;  // 메인보드 아래·윗면 (짧은 받침 위)
const GPU_H = 4.4;                     // GPU 냉각판 높이 (22 mm)
const GPUS = [-39, -13, 13, 39].map((cx, id) => ({ x: cx - 10.5, y: -28, w: 21, d: 24, r: 0.6, h: GPU_H, id, cx }));
const BAR = { x: -53, y: 6, w: 106, d: 4, r: 0.6 }, BAR_H = 2.8;   // 매니폴드 막대 (안에 공급·회수 두 칸)
const CPUS = [-26, 26].map((cx) => ({ x: cx - 8, y: 18, w: 16, d: 16, r: 0.6, h: 3.4, cx }));
const NICS = [-39, -13, 13, 39].map((cx) => ({ x: cx - 6, y: 48, w: 12, d: 10, r: 0.5, cx }));
const HR = 0.75;                       // 호스 반지름 (지름 7.5 mm)
const HZ_GPU = BT + 1.6, HZ_CPU = BT + 1.8;   // 호스 높이 (냉각판 옆면 가운데쯤). CPU 쪽은 조금 높게: 호스 끝 고리가 매니폴드 아래 윤곽에 걸치지 않게
// 냉각판마다 호스 2개: 왼쪽 = 공급(매니폴드 쪽 고리 파랑), 오른쪽 = 회수(빨강)
const PAIR = [{ dx: -4, cls: "rk-supply", name: "supply" }, { dx: 4, cls: "rk-return", name: "return" }];

// 트레이 몸통 (움직이는 작은 SVG, 열 잉크 아래)
function trayBody() {
  const T = workshop(P, { piece: "tray" });
  const { box, disc, hose, ghost } = T;
  // 판금 트레이 (은색): 바닥판 + 옆 레일 2개
  box("stand.floor", { x: TX0, y: TY0, w: TW, d: TRAY_D - FRONT_T, r: 0.6 }, TZ, FLOOR_T, { cls: "rk-silver", steps: 3, tone: "hi", crease: "lo", info: "tray" });
  for (const x of [TX0, TX0 + TW - 1.2]) box("stand.rail", { x, y: TY0, w: 1.2, d: TRAY_D - FRONT_T, r: 0.3 }, TOPZ, PULLED.h - 3.4, { cls: "rk-silver", steps: 2, tone: "mid", crease: "none", info: "tray" });
  // 메인보드 (검정 PCB, 짧은 받침 위) — 받침은 보이지 않아 모양만 기록
  const BOARD = { x: TX0 + 2, y: TY0 + 3, w: TW - 4, d: Y1 - FRONT_T - 2 - (TY0 + 3), r: 0.6 };
  for (const [x, y] of k.corners(BOARD, 3)) ghost(A.cylinder(x, y, 0.8, TOPZ, BZ - TOPZ, { name: "tray.standoff" }));
  box("board", BOARD, BZ, BT - BZ, { cls: "rk-pcb", steps: 3, tone: "mid", flat: true, info: "tray-board" });
  // GPU 4개: 구리 냉각판 (윗면 나사·홈은 열 잉크 위 SVG 에서) + 앞면 바브 2개
  for (const gp of GPUS) {
    box("gpu", gp, BT, gp.h, { cls: "rk-copper", steps: 3, bevel: 0.4, tone: "hi", crease: "lo", className: "rk-gpu", stamp: "gpu", info: "gpu-plate", inner: L(k.sideSeam(gp, BT + 1.0, P, 3), { tone: "faint" }) });
    for (const p of PAIR) disc("gpu.barb", G.frameAlong([gp.cx + p.dx, gp.y + gp.d, HZ_GPU], [0, 1, 0]), 0, 1.0, 0.95, { cls: "rk-steel", stamp: "barb-gpu", info: "fitting" });
  }
  // 매니폴드 막대 (스테인리스) + 양 끝 공급·회수 본선 (뒤쪽 퀵커넥터로 → 랙 매니폴드)
  box("bar", BAR, BT, BAR_H, {
    cls: "rk-steel", steps: 2, bevel: 0.3, owner: "bar", info: "manifold-bar",
    extra: Dt([-30, 0, 30].map((x) => at([x, BAR.y + BAR.d / 2, BT + BAR_H])), { size: 0.45, tone: "mid" }),
  });
  for (const gp of GPUS) for (const p of PAIR) {
    const x = gp.cx + p.dx;
    disc(`bar.fit.${p.name}`, G.frameAlong([x, BAR.y, HZ_GPU], [0, -1, 0]), 0, 1.0, 1.05, { cls: p.cls, tone: "hi", owner: "bar", stamp: `fitb-${p.name}`, info: `fitting-${p.name}` }); // 이음쇠 = 막대의 일부
    hose(`hose.gpu.${p.name}`, [[x, gp.y + gp.d + 1.0, HZ_GPU], [x, BAR.y - 1.0, HZ_GPU]], HR, { cls: "rk-hose", tone: "mid", maxLength: 12, stamp: "hose-gpu", info: "hose" });
  }
  for (const [x, p] of [[-51, PAIR[0]], [51, PAIR[1]]]) {
    disc(`bar.feed.${p.name}`, G.frameAlong([x, BAR.y, HZ_GPU], [0, -1, 0]), 0, 1.0, 1.05, { cls: p.cls, tone: "hi", owner: "bar", stamp: `fitb-${p.name}`, info: `fitting-${p.name}` });
    ghost(A.slab({ x: x - 2, y: TY0 + 2, w: 4, d: 4, r: 0.4 }, BT, 3, { name: `rear.uqd.${p.name}` }));  // 뒤쪽 퀵커넥터 (랙 안이라 안 보임)
    hose(`hose.feed.${p.name}`, [[x, BAR.y - 1.0, HZ_GPU], [x, TY0 + 6, HZ_GPU]], HR, { cls: "rk-hose", tone: "mid", maxLength: 20, stamp: "hose-feed", info: "hose-feed" });
  }
  // CPU 2개: 구리 냉각판 + 양옆 메모리(SOCAMM) 4개씩 + 매니폴드에서 오는 호스 2개
  for (const c of CPUS) {
    box("cpu", c, BT, c.h, { cls: "rk-copper", steps: 3, bevel: 0.4, tone: "mid", crease: "lo", stamp: "cpu", info: "cpu-plate", inner: L(k.sideSeam(c, BT + 0.9, P, 3), { tone: "faint" }), extra: L(k.planOutline(k.insetPlan(c, 2.4), BT + c.h, P, 3), { tone: "lo" }) });
    for (const dx of [-15.6, -12.4, 9.8, 13.0]) box("socamm", { x: c.cx + dx, y: c.y, w: 2.6, d: 16, r: 0.3 }, BT, 0.6, { cls: "rk-chip", steps: 2, stamp: "socamm", info: "socamm", extra: L(k.planOutline({ x: c.cx + dx + 0.5, y: c.y + 1.2, w: 1.6, d: 13.6, r: 0.2 }, BT + 0.6, P, 2), { tone: "lo" }) });
    for (const p of PAIR) {
      const x = c.cx + p.dx;
      disc(`bar.fit.${p.name}`, G.frameAlong([x, BAR.y + BAR.d, HZ_CPU], [0, 1, 0]), 0, 3.0, 1.05, { cls: p.cls, tone: "hi", owner: "bar", stamp: `fitf-${p.name}`, info: `fitting-${p.name}` }); // 앞쪽 이음쇠는 길게: 호스 끝이 막대 윤곽에 붙어 보이지 않게
      disc("cpu.barb", G.frameAlong([x, c.y, HZ_CPU], [0, -1, 0]), 0, 1.0, 0.95, { cls: "rk-steel", stamp: "barb-cpu", info: "fitting" });
      hose(`hose.cpu.${p.name}`, [[x, BAR.y + BAR.d + 3.0, HZ_CPU], [x, c.y - 1.0, HZ_CPU]], HR, { cls: "rk-hose", tone: "mid", maxLength: 12, stamp: "hose-cpu", info: "hose" });
    }
  }
  // NIC 4개 (ConnectX-8): 구리 틀 + 검정 칩
  for (const n of NICS) {
    box("nic", n, BT, 0.8, { cls: "rk-copper", steps: 2, tone: "mid", crease: "lo", stamp: "nic", info: "nic" });
    box("nic.chip", { x: n.cx - 3, y: n.y + 2.5, w: 6, d: 5, r: 0.3 }, BT + 0.8, 0.5, { cls: "rk-chip", steps: 2, tone: "mid", stamp: "nicchip", info: "nic" });
  }
  // 앞쪽: 저장장치(E1.S) 케이지 + OSFP 포트 케이지 4개 + 관리 칩(BMC) — 앞판 바로 뒤
  const E1S = { x: -48, y: 74, w: 18, d: 42, r: 0.5 };
  box("e1s.cage", E1S, BT, 5.4, { cls: "rk-chip", steps: 2, bevel: 0.3, info: "e1s", extra: L([1, 2, 3].map((i) => k.lineOnTop([E1S.x + i * E1S.w / 4, E1S.y], [E1S.x + i * E1S.w / 4, E1S.y + E1S.d], BT + 5.4, P)).join(""), { tone: "lo" }) }); // 칸 나눔 줄: 윤곽에서 윤곽까지
  for (let i = 0; i < 4; i++) box("osfp", { x: FRONT_X0 + 44 + i * 6.6, y: 100, w: 5.4, d: 16.8, r: 0.3 }, BT, 3.4, { cls: "rk-chip", steps: 2, bevel: 0.2, stamp: "osfp", info: "osfp" }); // 앞판 포트 구멍과 같은 x
  box("bmc", { x: 30, y: 80, w: 7, d: 7, r: 0.4 }, BT, 0.7, { cls: "rk-chip", steps: 2, info: "bmc", extra: Dt([at([31.2, 86, BT + 0.7])], { size: 0.4, tone: "hi" }) });
  return T;
}
// 열 잉크(캔버스) 위에 그려야 하는 것: GPU 냉각판 윗면의 홈·나사 (잉크가 덮으면 안 됨)
function trayTops() {
  const out = [];
  for (const gp of GPUS) {
    const top = BT + gp.h;
    out.push(`<g class="rk-copper" data-info="gpu-plate">${L(k.planOutline(k.insetPlan(gp, 2.2), top, P, 3), { tone: "lo" })}${Dt(k.corners(gp, 1.3).map(([x, y]) => at([x, y, top])), { size: 0.5, tone: "hi" })}${L(k.lineOnTop([gp.x + 5, gp.y + gp.d - 4.6], [gp.x + 14, gp.y + gp.d - 4.6], top, P), { tone: "lo", free: true })}</g>`);
  }
  return out.join("");
}
function trayFront() {
  return `<g data-info="faceplate">${frontPlate(PULLED, true)}</g>`;
}
// 트레이 몸통은 랙 앞면 밖(y > Y1)에 있는 부분만 보임 → 그 공간의 화면 껍질로 클립
const CLIP = hull(k.boxCorners({ x: TX0 - 1, y: Y1 - 0.2, w: TW + 2, d: STROKE + 6, r: 0 }, TZ - 1, TZ + PULLED.h + 1).map(at));
const clipPath = k.pathOf(CLIP, true);

// ---------- 5) 합치기 ----------
const LABEL = `${RACK.name} GPU rack: ${RACK.computeTrays} compute trays, ${RACK.switchTrays} NVLink switch trays and power shelves in a 19-inch rack. One compute tray slides out to show its ${RACK.gpuPerTray} GPUs, ${RACK.cpuPerTray} CPUs and liquid cold plates; heat on the GPUs rises with load.`;
// 색: 랙 골격·스위치·전원 앞판은 검정(.rk-metal), 컴퓨트 트레이 앞판·판금은 은색(.rk-silver), 빈 슬롯은 더 어둡게(.rk-cavity)
// 층 나누기 (아래 → 위): 정지한 랙(back) → 움직이는 트레이 몸통(tray, 작은 SVG) → 열 잉크(canvas) → 핀 줄·트레이 앞판(front)
//   움직이는 부분을 작은 SVG 로 떼어 두면, 트레이가 움직일 때 1,000개 넘는 랙 경로를 매 프레임 다시 그리지 않음
//   트레이는 랙 앞면 밖으로만 나오고 윗판과 화면에서 겹치지 않아, 랙 전체 위에 얹어도 그리는 순서가 맞음
const back = [
  `<g class="rk-metal"><g data-info="rack-base">${base()}</g><g data-info="rack">${rearFrame()}</g></g>`, `<g data-info="slot">${cavity()}</g>`,
  `<g class="rk-metal"><g data-info="rack">${sidePanel()}</g>${fronts()}<g data-info="rack">${frontFrame()}</g></g>`,
  `<g class="rk-metal" data-info="rack">${cap()}</g>`,
];
// 클립은 움직이는 그룹 "바깥"에: 안에 두면 트레이와 함께 움직여 몸통을 통째로 잘라 버림
const TRAY_SHOP = trayBody();
const tray = [`<clipPath id="rk-clip"><path d="${clipPath}"/></clipPath><g clip-path="url(#rk-clip)"><g data-part="tray-body">${TRAY_SHOP.render()}</g></g>`];
// 트레이 앞판은 열 잉크보다 위: 가까운 냉각판을 앞판이 가리는 곳에 잉크가 덮이지 않게
const front = [`<clipPath id="rk-clip-front"><path d="${clipPath}"/></clipPath><g clip-path="url(#rk-clip-front)"><g data-part="tray-fins">${trayTops()}</g></g>`,
  `<g data-part="tray-plate">${trayFront()}</g>`];
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: back, className: "rk-back" });
const layerSvg = (cls, body) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rk-layer ${cls}" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${body.join("")}</svg>`;
const traySvg = layerSvg("rk-tray", tray);
const frontSvg = layerSvg("rk-front", front);

// 페이지로 넘기는 숫자: 투영(이동 벡터), GPU 사각형(열 잉크 위치), 트레이 높이
const pullVec = k.axisVector(P, [0, 1, 0]);     // 세계 +y 1단위의 화면 벡터
const DATA = {
  W: WIDTH, H: HEIGHT, camera: glCamera(P), pull: pullVec, stroke: STROKE, // 이동 벡터는 반올림하지 않음: 150 단위 당기면 0.05 오차가 7px 로 커져 열 잉크가 냉각판에서 어긋남
  zTop: tenth(BT + GPU_H), zFloor: tenth(TOPZ), front: Y1,
  gpu: GPUS.map((g) => [g.x, g.y, g.w, g.d].map(tenth)), cpu: CPUS.map((c) => [c.x, c.y, c.w, c.d].map(tenth)),
  rack: RACK, tray: PULLED.index,
  zoom: 2.6, focus: at([0, Y1 + STROKE * 0.55, TOPZ + 2]).map(tenth),   // 트레이 확대: 배율, 처음 볼 곳(다 꺼낸 트레이 가운데)
};

const CSS = `
.rk-stage{position:relative;touch-action:pan-y;outline:none}
.rk-stage>svg,.rk-stage>canvas{display:block;width:100%;height:auto}
.rk-stage>.rk-layer{position:absolute;inset:0;height:100%!important;pointer-events:none}
.rk-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
/* 확대돼 있는 동안: 보이는 범위(viewBox) 밖의 그림이 칸 밖으로 넘치지 않게 자름 (kit 기본은 overflow:visible) */
.rk-stage[data-zoom]{overflow:hidden;border-radius:6px}
/* 트레이 확대: 트레이·앞판 층(평소엔 포인터를 통과시킴)의 칠해진 곳도 부품 찾기에 걸리게 */
.rk-stage[data-fig=rack][data-zoom]>svg.rk-layer>g{pointer-events:visiblePainted}
/* 키보드로 둘러볼 때 가리키는 곳을 보여 주는 조준 원 */
.rk-aim{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border:1.5px solid var(--anatomy-strong);border-radius:50%;box-shadow:0 0 0 2px var(--anatomy-card);pointer-events:none;opacity:0;transition:opacity .2s}
.rk-stage[data-aim] .rk-aim{opacity:1}
/* 색 토큰 세트: 그룹마다 kit 토큰을 바꿔 칠함 (모든 색이 토큰 → 선·면·명암 규칙은 그대로) */
.rk-metal{--anatomy-paper:#2f343b;--anatomy-face:#373d45;--anatomy-top:#4a515b;--anatomy-shade-0:#22262c;--anatomy-shade-1:#282c33;--anatomy-shade-2:#2e333a;--anatomy-shade-3:#353a42;--anatomy-lit-top:#5b6470;--anatomy-lit-shade:#3d434c;--anatomy-hi:#e3e8ee;--anatomy-mid:#9aa3ae;--anatomy-lo:#6f7884;--anatomy-faint:#525a65;--anatomy-lit:#ffffff;--anatomy-dot:#c9d1da}
.rk-cavity{--anatomy-paper:#16191d;--anatomy-face:#1b1e23;--anatomy-top:#22262c;--anatomy-shade-0:#101215;--anatomy-shade-1:#14161a;--anatomy-shade-2:#181b1f;--anatomy-shade-3:#1d2025;--anatomy-lo:#3a4049;--anatomy-faint:#2b3037;--anatomy-mid:#59616c;--anatomy-hi:#9aa3ae}
.rk-paper{--anatomy-paper:#fbfbfa;--anatomy-face:#ffffff;--anatomy-top:#ffffff;--anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;--anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-dot:#3a3a3e}
.rk-copper{--anatomy-paper:#c98757;--anatomy-face:#d39466;--anatomy-top:#e8b083;--anatomy-shade-0:#a3663d;--anatomy-shade-1:#b07047;--anatomy-shade-2:#bd7b51;--anatomy-shade-3:#c9875b;--anatomy-lit-top:#f2c49b;--anatomy-lit-shade:#cf9163;--anatomy-hi:#4b2612;--anatomy-mid:#875230;--anatomy-lo:#a46d45;--anatomy-faint:#bb8660;--anatomy-lit:#3a1c0b;--anatomy-dot:#5a3018}
.rk-supply{--anatomy-paper:#3c79d2;--anatomy-face:#4586dd;--anatomy-top:#6fa6ee;--anatomy-shade-0:#2a5ca8;--anatomy-shade-1:#3066b5;--anatomy-shade-2:#3670c2;--anatomy-shade-3:#3d7acd;--anatomy-hi:#0f2a52;--anatomy-mid:#1f4c8c;--anatomy-lo:#2c63b0;--anatomy-faint:#5f97e0}
.rk-return{--anatomy-paper:#d0533c;--anatomy-face:#da6149;--anatomy-top:#ef8468;--anatomy-shade-0:#a63a27;--anatomy-shade-1:#b54330;--anatomy-shade-2:#c24c38;--anatomy-shade-3:#cd5641;--anatomy-hi:#4a130a;--anatomy-mid:#8a2a1a;--anatomy-lo:#b03f2c;--anatomy-faint:#e2876f}
.rk-chip{--anatomy-paper:#2b2e34;--anatomy-face:#33363d;--anatomy-top:#41454d;--anatomy-shade-0:#1f2227;--anatomy-shade-1:#24272c;--anatomy-shade-2:#292c32;--anatomy-shade-3:#2f3238;--anatomy-hi:#e1e5ea;--anatomy-mid:#8d949e;--anatomy-lo:#626973;--anatomy-faint:#4a4f58}
.rk-pcb{--anatomy-paper:#24282d;--anatomy-face:#2a2e34;--anatomy-top:#30353c;--anatomy-shade-0:#191c20;--anatomy-shade-1:#1e2125;--anatomy-shade-2:#23262b;--anatomy-shade-3:#282c31;--anatomy-hi:#dde2e8;--anatomy-mid:#7c8590;--anatomy-lo:#5d6570;--anatomy-faint:#3d434b;--anatomy-dot:#d8b45c}
.rk-modpcb{--anatomy-paper:#1f2a2b;--anatomy-face:#243031;--anatomy-top:#2c393a;--anatomy-shade-0:#152021;--anatomy-shade-1:#192425;--anatomy-shade-2:#1d2829;--anatomy-shade-3:#212c2d;--anatomy-hi:#d6e2e2;--anatomy-mid:#7d8f90;--anatomy-lo:#546364;--anatomy-faint:#34403f;--anatomy-dot:#d8b45c}
.rk-frame{--anatomy-paper:#20242b;--anatomy-face:#262b33;--anatomy-top:#303642;--anatomy-shade-0:#15181e;--anatomy-shade-1:#191d23;--anatomy-shade-2:#1d2128;--anatomy-shade-3:#22262e;--anatomy-hi:#cfd7e2;--anatomy-mid:#7a8594;--anatomy-lo:#5a6474;--anatomy-faint:#3a424e;--anatomy-dot:#cfd7e2}
.rk-silver{--anatomy-paper:#c4c9d0;--anatomy-face:#ced3d9;--anatomy-top:#e2e6ea;--anatomy-shade-0:#9ba2ac;--anatomy-shade-1:#a7aeb7;--anatomy-shade-2:#b3b9c1;--anatomy-shade-3:#bec4cb;--anatomy-lit-top:#eef1f4;--anatomy-lit-shade:#c6ccd3;--anatomy-hi:#2a2f36;--anatomy-mid:#68707a;--anatomy-lo:#8a919b;--anatomy-faint:#a9b0b9;--anatomy-lit:#111418;--anatomy-dot:#3a3f46}
.rk-hose{--anatomy-paper:#2b2f35;--anatomy-face:#30353b;--anatomy-top:#555c66;--anatomy-shade-0:#121417;--anatomy-shade-1:#191c20;--anatomy-shade-2:#25292e;--anatomy-shade-3:#2b2f35;--anatomy-hi:#08090b;--anatomy-mid:#0c0d10;--anatomy-lo:#3a3f46;--anatomy-faint:#2b2f35}
.rk-lid{--anatomy-paper:#bfc4ca;--anatomy-face:#c9ced4;--anatomy-top:#dce0e4;--anatomy-shade-0:#9aa0a8;--anatomy-shade-1:#a5abb3;--anatomy-shade-2:#b0b6bd;--anatomy-shade-3:#bac0c6;--anatomy-lit-top:#e9ecef;--anatomy-hi:#2c3036;--anatomy-mid:#5f666f;--anatomy-lo:#8b929b;--anatomy-faint:#a9afb7;--anatomy-dot:#2c3036}
.rk-interposer{--anatomy-paper:#4b5563;--anatomy-face:#556070;--anatomy-top:#6b7686;--anatomy-shade-0:#363e4a;--anatomy-shade-1:#3c4451;--anatomy-shade-2:#434c59;--anatomy-shade-3:#4a5361;--anatomy-hi:#e6ebf2;--anatomy-mid:#9aa5b5;--anatomy-lo:#76818f;--anatomy-faint:#5d6878}
.rk-hbm{--anatomy-paper:#353a42;--anatomy-face:#3c424a;--anatomy-top:#4b525c;--anatomy-shade-0:#24282e;--anatomy-shade-1:#2a2e35;--anatomy-shade-2:#30353c;--anatomy-shade-3:#353a42;--anatomy-hi:#e1e5ea;--anatomy-mid:#8d949e;--anatomy-lo:#6a717b;--anatomy-faint:#4a5058}
.rk-mlcc{--anatomy-paper:#b89a6a;--anatomy-face:#c4a676;--anatomy-top:#d6bb8c;--anatomy-shade-0:#9a7e52;--anatomy-shade-1:#a5895c;--anatomy-shade-2:#ae9262;--anatomy-shade-3:#b79b6a;--anatomy-hi:#3b2c14;--anatomy-mid:#6e5631;--anatomy-lo:#94784d;--anatomy-faint:#c9ad80}
.rk-choke{--anatomy-paper:#4a4f57;--anatomy-face:#545a63;--anatomy-top:#6a717b;--anatomy-shade-0:#363a41;--anatomy-shade-1:#3c4148;--anatomy-shade-2:#43484f;--anatomy-shade-3:#4a4f57;--anatomy-hi:#e3e7ec;--anatomy-mid:#9aa1ab;--anatomy-lo:#7a818b;--anatomy-faint:#5c636c}
.rk-orange{--anatomy-paper:#e07b2e;--anatomy-face:#e8893c;--anatomy-top:#f4a564;--anatomy-shade-0:#b85e1c;--anatomy-shade-1:#c66620;--anatomy-shade-2:#d16e25;--anatomy-shade-3:#da7629;--anatomy-hi:#4a1f05;--anatomy-mid:#8a3f10;--anatomy-lo:#b35a1d;--anatomy-faint:#f0a060}
.rk-substrate{--anatomy-paper:#3a4a3f;--anatomy-face:#415246;--anatomy-top:#4f6355;--anatomy-shade-0:#2c3a31;--anatomy-shade-1:#314036;--anatomy-shade-2:#36463b;--anatomy-shade-3:#3c4d41;--anatomy-hi:#e3ece5;--anatomy-mid:#9db3a3;--anatomy-lo:#73897a;--anatomy-faint:#5b6f61;--anatomy-dot:#f0d27a}
.rk-die{--anatomy-paper:#8f9bb0;--anatomy-face:#9aa7bd;--anatomy-top:#b9c6dc;--anatomy-shade-0:#6f7a8e;--anatomy-shade-1:#788397;--anatomy-shade-2:#818ca1;--anatomy-shade-3:#8a96ab;--anatomy-lit-top:#cfdaee;--anatomy-lit-shade:#97a4ba;--anatomy-lit:#1d2533;--anatomy-hi:#1d2533;--anatomy-mid:#4a5568;--anatomy-lo:#6b7689;--anatomy-faint:#a3afc4}
.rk-brass{--anatomy-paper:#c9a54a;--anatomy-face:#d3b057;--anatomy-top:#ead07f;--anatomy-shade-0:#a5832e;--anatomy-shade-1:#b18d36;--anatomy-shade-2:#bd983f;--anatomy-shade-3:#c8a349;--anatomy-hi:#3f2e07;--anatomy-mid:#7d6118;--anatomy-lo:#a48530;--anatomy-faint:#c2a55a}
.rk-steel{--anatomy-paper:#aab2bd;--anatomy-top:#cfd5dd;--anatomy-shade-0:#8a929d;--anatomy-shade-1:#939ba6;--anatomy-shade-2:#9ca4af;--anatomy-shade-3:#a5adb8;--anatomy-hi:#262b33;--anatomy-mid:#5d6570;--anatomy-lo:#79818c}
.rk-led-g .iso-dots circle{fill:#22d36b;opacity:1}
.rk-led-b .iso-dots circle{fill:#4c9bff;opacity:1}
/* WebGL 이 없을 때: GPU 윗면이 부하만큼 데워진 색으로 (셰이더와 같은 잉크 색, 곱하기 혼합) */
.rk-stage:not([data-gl]) .rk-gpu>.iso-top,.rk-stage:not([data-gl]) .rk-die-solid>.iso-top{fill:color-mix(in srgb,var(--anatomy-top),#f0a640 calc(var(--rk-load,0)*70%))}
.rk-stage:not([data-gl]) .rk-gpu>.iso-shade{fill:color-mix(in srgb,var(--anatomy-shade-2),#e06a2a calc(var(--rk-load,0)*45%))}
.rk-ui{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-family:var(--anatomy-mono);font-size:11.5px;color:var(--anatomy-text)}
/* 두 칸은 같은 높이로 늘어나고(stretch), 칸 안은 세로 줄: 제목은 위, 그림은 아래로 붙여 수치 줄까지 양쪽이 나란히 */
.rk-pair{display:grid;grid-template-columns:1.12fr 1fr;gap:10px}
.rk-fig{min-width:0;display:flex;flex-direction:column}
.rk-fig>.rk-stage{width:100%;margin-top:auto}
.rk-fig h2{margin:0 0 2px;font:600 12px/1.4 var(--anatomy-mono);color:var(--anatomy-strong);letter-spacing:.02em}
.rk-fig h2 small{font-weight:400;color:var(--anatomy-muted)}
.rk-head{display:flex;align-items:flex-start;gap:8px}
.rk-head h2{flex:1;min-width:0}
.rk-zoom{flex:none;display:inline-flex;align-items:center;gap:6px;margin-top:-3px;border:0;border-radius:999px;padding:6px 13px 6px 10px;background:#16213a;color:#fff;font:600 12.5px/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.01em;cursor:pointer;box-shadow:0 2px 8px rgba(22,33,58,.22)}
.rk-zoom:hover{background:#24365c}
.rk-zoom:focus-visible{outline:2px solid #2ea88a;outline-offset:2px}
.rk-zoom[aria-pressed="true"]{background:#fff;color:#16213a;box-shadow:inset 0 0 0 1.5px #16213a}
/* 처음 보일 때 세 번 퍼지는 고리로 "눌러 보세요" 안내 (움직임 줄이기 설정이면 없음) */
.rk-zoom[data-call]{animation:rk-call 1.8s ease-out 1.5s 3}
@keyframes rk-call{0%{box-shadow:0 2px 8px rgba(22,33,58,.22),0 0 0 0 rgba(46,168,138,.6)}75%{box-shadow:0 2px 8px rgba(22,33,58,.22),0 0 0 12px rgba(46,168,138,0)}100%{box-shadow:0 2px 8px rgba(22,33,58,.22),0 0 0 0 rgba(46,168,138,0)}}
@media (prefers-reduced-motion:reduce){.rk-zoom[data-call]{animation:none}}
.rk-icon{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.rk-fig .rk-read{font:11px/1.4 var(--anatomy-mono);color:var(--anatomy-text);min-height:1.4em}
@media (max-width:767px){.rk-pair{grid-template-columns:1fr}}
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

// GPU 모듈 그림 (gpu.mjs)
const G2 = gpuFigure();

// 기판 확대에서 포인터 아래 부품의 이름·역할 (키 = gpu.mjs 의 info). [한국어, 영어]
const INFO = {
  board: ["메인보드 · GB300 컴퓨트 트레이의 검정 기판 (여러 층의 구리 배선)", "Main board · the black GB300 compute-tray PCB (many copper layers)"],
  stand: ["받침 기둥 · 기판을 바닥에서 띄워 고정", "Standoff · holds the board off the floor"],
  choke: ["전원부 인덕터 · 칩이 쓰는 1 V 안팎의 전기를 여러 상으로 나눠 만듦", "VRM inductor · one phase of the ~1 V supply for the chip"],
  stage: ["파워 스테이지 · 인덕터와 짝을 이루는 전원 스위칭 칩", "Power stage · the switching chip paired with each inductor"],
  ctrl: ["전원 컨트롤러 · 전원부 상들의 박자를 맞춤", "VRM controller · keeps the power phases in step"],
  cap: ["고분자 콘덴서 · 전원의 출렁임을 흡수", "Polymer capacitor · smooths the supply"],
  mlcc: ["적층 세라믹 콘덴서 · 칩 바로 옆에서 순간 전류를 공급", "Ceramic capacitor (MLCC) · instant current right next to the chip"],
  nvlink: ["NVLink 커넥터 · 랙 뒤 NVLink 스파인으로 GPU 72개를 하나로 연결", "NVLink connector · joins all 72 GPUs through the rack's NVLink spine"],
  power: ["전원 커넥터 · 트레이의 전원판에서 전기를 받음", "Power connector · takes power from the tray"],
  label: ["제품 라벨 · 일련번호와 바코드", "Product label · serial number and barcode"],
  frame: ["소켓 고정 틀 · 나사 4개로 냉각판을 눌러 고정", "Socket bolster · four screws clamp the cold plate down"],
  pin: ["정렬 핀 · 냉각판 자리를 맞춤", "Alignment pin · locates the cold plate"],
  module: ["GPU 모듈 기판 (SXM) · 소켓에 꽂혀 GPU만 따로 교체 가능", "GPU module (SXM) · socketed, so the GPU can be replaced on its own"],
  substrate: ["패키지 기판 · 칩의 수많은 단자를 기판 배선으로 넓혀 줌", "Package substrate · fans the chip's many pins out to the board"],
  interposer: ["인터포저 (CoWoS-L) · 다이와 HBM을 아주 촘촘한 배선으로 연결", "Interposer (CoWoS-L) · dense wiring between the dies and HBM"],
  die: ["GPU 다이 · 실리콘 2개가 10 TB/s 로 이어져 한 GPU처럼 동작 · 최대 1.4 kW", "GPU dies · two dies linked at 10 TB/s work as one GPU · up to 1.4 kW"],
  hbm: ["HBM3e 메모리 · 12단 적층 36 GB, 8개 합쳐 288 GB", "HBM3e · a 12-high stack of 36 GB; eight make 288 GB"],
  manifold: ["매니폴드 블록 · 냉각수를 나눠 보내는 스테인리스 블록", "Manifold block · stainless block that feeds the coolant"],
  "socket-supply": ["퀵커넥터 소켓 · 파랑 고리 = 냉각수 공급 (차가운 쪽)", "Quick-disconnect socket · blue ring = supply (cold side)"],
  "socket-return": ["퀵커넥터 소켓 · 빨강 고리 = 회수 (데워진 쪽)", "Quick-disconnect socket · red ring = return (warm side)"],
  // ---- 랙 그림 ----
  rack: ["GB300 NVL72 랙 · 액체냉각, 약 130 kW · GPU 72개가 한 덩어리로 동작", "GB300 NVL72 rack · liquid-cooled, about 130 kW · 72 GPUs work as one"],
  "rack-base": ["랙 받침과 바퀴", "Rack base and casters"],
  slot: ["빈 칸 · 꺼낸 트레이가 들어가는 자리", "Empty slot · where the pulled tray lives"],
  "front-compute": ["컴퓨트 트레이 · 랙에 18개, 1개에 GPU 4 + CPU 2", "Compute tray · 18 per rack, 4 GPUs + 2 CPUs each"],
  "front-switch": ["NVLink 스위치 트레이 · 9개가 GPU 72개를 모두 연결", "NVLink switch tray · nine of them connect all 72 GPUs"],
  "front-power": ["전원 선반 · 랙 전체에 전기를 공급", "Power shelf · supplies power to the rack"],
  tray: ["컴퓨트 트레이 (1U 서랍) · 은색 판금, 레일로 밀고 당김", "Compute tray (1U drawer) · sheet metal on rails"],
  "tray-board": ["메인보드 · GPU 4개와 CPU 2개가 한 기판에 (GB300)", "Main board · 4 GPUs and 2 CPUs on one board (GB300)"],
  "gpu-plate": ["B300 GPU (구리 냉각판 아래) · 1개 최대 1.4 kW", "B300 GPU under a copper cold plate · up to 1.4 kW each"],
  "cpu-plate": ["Grace CPU (구리 냉각판 아래) · Arm 코어 72개", "Grace CPU under a copper cold plate · 72 Arm cores"],
  socamm: ["CPU 메모리 (LPDDR5X 모듈) · Grace CPU 옆 저전력 메모리", "CPU memory (LPDDR5X modules) beside the Grace CPU"],
  "manifold-bar": ["냉각수 매니폴드 · 공급·회수 두 칸, 냉각판마다 호스 2개", "Coolant manifold · supply and return channels, two hoses per plate"],
  fitting: ["호스 이음쇠 · 냉각판에 호스를 연결", "Hose fitting · joins the hose to the cold plate"],
  "fitting-supply": ["매니폴드 연결부 · 파랑 고리 = 냉각수 공급", "Manifold fitting · blue ring = supply"],
  "fitting-return": ["매니폴드 연결부 · 빨강 고리 = 회수", "Manifold fitting · red ring = return"],
  hose: ["냉각수 호스 · 매니폴드와 냉각판을 잇는 검정 고무관", "Coolant hose · black rubber between the manifold and a cold plate"],
  "hose-feed": ["본선 호스 · 트레이 뒤 퀵커넥터로 랙 매니폴드에 연결", "Feed hose · to the rack manifold through quick disconnects at the back"],
  nic: ["ConnectX-8 네트워크 칩 · GPU마다 하나, 800 Gb/s", "ConnectX-8 SuperNIC · one per GPU, 800 Gb/s"],
  e1s: ["저장장치 칸 (E1.S SSD)", "Storage bays (E1.S SSDs)"],
  osfp: ["네트워크 포트 (OSFP) · 다른 랙과 연결", "Network ports (OSFP) · links to other racks"],
  bmc: ["관리 칩 (BMC) · 원격으로 서버 상태를 확인·관리", "Management chip (BMC) · remote monitoring"],
  faceplate: ["트레이 앞판 · 고정 나사·저장장치 칸·포트·상태 LED", "Tray front · thumbscrews, storage bays, ports, status LEDs"],
};
// 확대 단추 (lucide zoom-in / zoom-out 아이콘, 인라인 SVG)
const ICON_IN = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const ICON_OUT = '<svg class="rk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
const zoomLabel = (ko, on, what) => (on ? ICON_OUT : ICON_IN) + `<span>${on ? (ko ? "전체 보기" : "Full view") : what}</span>`;
const zoomText = (ko) => ({
  rack: {
    in: zoomLabel(ko, false, ko ? "트레이 확대" : "Zoom tray"), out: zoomLabel(ko, true),
    aria: ko ? ["GPU 랙 그림: 트레이가 저절로 나왔다 들어갑니다. + 키나 확대 단추로 트레이를 확대해 부품을 살펴볼 수 있습니다", "트레이 확대: 포인터나 화살표 키로 둘러보고, Esc 로 전체 보기"]
      : ["GPU rack: a compute tray slides out and back on its own. Press + or the zoom button to look at its parts", "Tray zoom: look around with the pointer or arrow keys; Escape for the full view"],
  },
  gpu: {
    in: zoomLabel(ko, false, ko ? "기판 확대" : "Zoom board"), out: zoomLabel(ko, true),
    aria: ko ? ["GPU 모듈 그림: 냉각판과 뚜껑이 저절로 들립니다. + 키나 확대 단추로 기판을 확대해 부품을 살펴볼 수 있습니다", "기판 확대: 포인터나 화살표 키로 둘러보고, Esc 로 전체 보기"]
      : ["GPU module: the cold plate and the lid lift on their own. Press + or the zoom button to look at the board", "Board zoom: look around with the pointer or arrow keys; Escape for the full view"],
  },
  hint: ko ? "확대 중 · 부품에 포인터를 올리거나 탭하면 설명이 나옵니다" : "zoomed · point at or tap a part to see what it is",
});

// 살아 움직이는 부분 (kit 없이 동작: 이동 벡터·좌표는 빌드 때 계산해 둠). 두 그림을 한 루프로
//   랙: 트레이 당김(pull) · 부하(load)   GPU 모듈: 냉각판 들림(lift) · 같은 부하
const LIVE = `
const D=__DATA__, D2=__DATA2__, KO=__KO__, INFO=__INFO__, ZT=__ZOOM__;
const stage=document.querySelector(".rk-stage[data-fig=rack]"), stage2=document.querySelector(".rk-stage[data-fig=gpu]");
const svg=stage.querySelector("svg.rk-back"), svg2=stage2.querySelector("svg.rk-back");
const trays=[...stage.querySelectorAll('[data-part^="tray-"]')], plate=stage2.querySelector('[data-part="plate"]'), lidG=stage2.querySelector('[data-part="lid"]');
const read1=document.querySelector("[data-readout=rack]"), read2=document.querySelector("[data-readout=gpu]");
const still=matchMedia("(prefers-reduced-motion: reduce)");
const layer=glLayer({canvas:stage.querySelector("canvas.rk-gl"),fragment:${JSON.stringify(FRAGMENT)},view:[D.W,D.H],camera:D.camera,uniforms:["uLoad","uPull","uFirst"]});
const layer2=glLayer({canvas:stage2.querySelector("canvas.rk-gl"),fragment:${JSON.stringify(G2.FRAGMENT)},view:[D2.W,D2.H],camera:D2.camera,uniforms:["uLoad","uFirst"]});
if(layer)stage.setAttribute("data-gl","");if(layer2)stage2.setAttribute("data-gl","");
const R=D.rack, G=D2.gpu, perTrayKw=R.kw/R.computeTrays;
let lastLv="",pull=0,target=0,lift=0,liftTarget=0,load={x:0,v:0},first={x:0,v:0},clock=0,time=0,last=0,frame=0,visible=true,touring=!still.matches;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sm=(a,b,x)=>{const q=clamp((x-a)/(b-a),0,1);return q*q*(3-2*q);};
// GPU 그림의 들림 0..1 → 냉각판 높이 mm (먼저 0~0.65) · 뚜껑 진행 0..1 (나중 0.35~1)
const plateOf=(u)=>D2.plateMax*sm(0,.65,u), lidOf=(u)=>sm(.35,1,u);
// 둘러보기 14초: 트레이 당김(0~3s) → 냉각판·뚜껑 들림(3~6s) → 부하 올림(5~9.5s) → 내림(9.5~11.5s) → 트레이 밀어 넣음(11~13.5s)
function tourAt(t){const u=t%14;const ramp=(a,b)=>clamp((u-a)/(b-a),0,1);
  return {pull:D.stroke*(ramp(0,3)-ramp(11,13.5)),lift:ramp(3,6)-ramp(9.5,11.5),load:u>5&&u<9.5?1:0};}
const say=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
// ---------- 확대 (두 그림 공용) ----------
// 보이는 범위(viewBox)를 좁혀 크게 보여 줌: SVG 라 확대해도 선명, 열 잉크도 같은 범위(uView·uOrigin)를 받아 따라옴
// 돋보기 방식: 전체 그림에서 포인터가 가리키는 점이 확대 화면에서도 포인터 바로 아래에 옴 → 겨눈 부품이 달아나지 않음
//   (포인터 비율 fx 일 때 보이는 범위의 왼쪽 = fx × (전체 폭 − 보이는 폭))
// 확대 중엔 포인터·탭·화살표 조준 원 아래 부품의 이름·역할(data-info → INFO)을 수치 줄에 보여 줌
function zoomer(st,{W,H,zoom,focus,btn,labels,hide}){
  const svgs=[...st.querySelectorAll(":scope>svg")], aimEl=st.querySelector(".rk-aim");
  const Z={on:false,k:0,fx:.5,fy:.5,tfx:.5,tfy:.5,info:"",box:"",px:null,py:null,keys:false,moved:true,shown:false};
  Z.rect=()=>{const s=1+(zoom-1)*sm(0,1,Z.k),w=W/s,h=H/s;return [Z.fx*(W-w),Z.fy*(H-h),w,h];};
  // 한 점 아래의 부품 설명 찾기
  Z.pick=(x,y)=>{const el=document.elementFromPoint(x,y);const g=el&&el.closest?el.closest("[data-info]"):null;const key=g&&st.contains(g)?g.getAttribute("data-info"):"";Z.info=key&&INFO[key]?INFO[key][KO?0:1]:"";};
  // 그리기 전에: 보이는 범위를 SVG 들에 적용하고, 움직였으면 부품을 다시 찾음
  Z.apply=()=>{
    const r=Z.rect(),box=r.map((n)=>n.toFixed(2)).join(" ");
    const shown=Z.on||Z.k>0;if(shown!==Z.shown){Z.shown=shown;st.toggleAttribute("data-zoom",shown);}   // 확대돼 있는 동안 칸 밖을 자름
    if(box!==Z.box){Z.box=box;Z.moved=true;for(const s of svgs)s.setAttribute("viewBox",box);if(hide)hide.style.opacity=String(1-sm(0,.6,Z.k));}
    if(Z.on&&Z.moved){if(Z.px!==null)Z.pick(Z.px,Z.py);else if(Z.keys){const b=st.getBoundingClientRect();Z.pick(b.left+Z.tfx*b.width,b.top+Z.tfy*b.height);}Z.moved=false;}
    return r;};
  Z.set=(on)=>{
    if(Z.on===on)return;Z.on=on;
    if(on){Z.fx=Z.tfx=focus[0]/W;Z.fy=Z.tfy=focus[1]/H;Z.info="";Z.px=null;Z.keys=false;}else st.removeAttribute("data-aim");
    st.style.touchAction=on?"none":"";
    if(btn){btn.setAttribute("aria-pressed",String(on));btn.innerHTML=on?labels.out:labels.in;}
    for(const b of document.querySelectorAll(".rk-zoom[data-call]"))b.removeAttribute("data-call");   // 한 번 써 보면 깜빡임 안내를 멈춤
    st.setAttribute("aria-label",labels.aria[on?1:0]);hold();};
  Z.step=(dt,calm)=>{const zk=Z.on?1:0;Z.k=calm?zk:Z.k+(zk-Z.k)*(1-Math.exp(-dt/.22));if(Math.abs(zk-Z.k)<.002)Z.k=zk;   // 확대 진행 0..1
    const zf=calm?1:1-Math.exp(-dt/.12);Z.fx+=(Z.tfx-Z.fx)*zf;Z.fy+=(Z.tfy-Z.fy)*zf;};                                  // 돋보기 위치
  // 확대 중 포인터: 돋보기 위치 + 그 아래 부품 (처리했으면 true)
  Z.pointer=(e)=>{if(!Z.on)return false;const b=st.getBoundingClientRect();
    Z.tfx=clamp((e.clientX-b.left)/b.width,0,1);Z.tfy=clamp((e.clientY-b.top)/b.height,0,1);
    Z.px=e.clientX;Z.py=e.clientY;Z.keys=false;Z.moved=true;st.removeAttribute("data-aim");hold();return true;};
  // 키: + / = 확대, - / Esc 전체 보기, 확대 중 화살표 = 조준 원 이동 (처리했으면 true)
  Z.key=(e)=>{
    if(e.key==="+"||e.key==="="){e.preventDefault();Z.set(true);return true;}
    if((e.key==="-"||e.key==="Escape")&&Z.on){e.preventDefault();Z.set(false);return true;}
    if(!Z.on)return false;
    let dx=0,dy=0;if(e.key==="ArrowLeft")dx=-.06;if(e.key==="ArrowRight")dx=.06;if(e.key==="ArrowUp")dy=-.06;if(e.key==="ArrowDown")dy=.06;
    if(!dx&&!dy)return false;e.preventDefault();Z.tfx=clamp(Z.tfx+dx,0,1);Z.tfy=clamp(Z.tfy+dy,0,1);Z.px=null;Z.keys=true;Z.moved=true;
    if(aimEl){aimEl.style.left=(Z.tfx*100).toFixed(1)+"%";aimEl.style.top=(Z.tfy*100).toFixed(1)+"%";st.setAttribute("data-aim","");}
    hold();return true;};
  if(btn)btn.addEventListener("click",()=>Z.set(!Z.on));
  st.addEventListener("dblclick",(e)=>{e.preventDefault();Z.set(!Z.on);});
  return Z;
}
const zoomGl=(r,cam)=>({uView:[r[2],r[3]],uOrigin:[cam.origin[0]-r[0],cam.origin[1]-r[1]]});   // 확대 범위를 셰이더에 알림
const Z1=zoomer(stage,{W:D.W,H:D.H,zoom:D.zoom,focus:D.focus,btn:document.querySelector("[data-zoom=rack]"),labels:ZT.rack});
const Z2=zoomer(stage2,{W:D2.W,H:D2.H,zoom:D2.zoom,focus:D2.focus,btn:document.querySelector("[data-zoom=gpu]"),labels:ZT.gpu,hide:stage2.querySelector("svg.rk-front")});
function draw(){
  const tr="translate("+(D.pull[0]*pull).toFixed(2)+" "+(D.pull[1]*pull).toFixed(2)+")";
  for(const t of trays){if(pull>.01)t.setAttribute("transform",tr);else t.removeAttribute("transform");}
  const pl=plateOf(lift), ld=lidOf(lift);
  const mv=(el,dx,dy)=>{if(Math.abs(dx)+Math.abs(dy)>.01)el.setAttribute("transform","translate("+dx.toFixed(2)+" "+dy.toFixed(2)+")");else el.removeAttribute("transform");};
  mv(plate,D2.up[0]*pl,D2.up[1]*pl);mv(lidG,D2.lidVec[0]*ld,D2.lidVec[1]*ld);
  const lv=load.x.toFixed(2);if(lv!==lastLv){lastLv=lv;if(!layer)stage.style.setProperty("--rk-load",lv);if(!layer2)stage2.style.setProperty("--rk-load",lv);} // WebGL 없을 때만 CSS 색으로
  const t=still.matches?0.8:time;
  const r1=Z1.apply(), r2=Z2.apply();   // 확대: 지금 보이는 범위 [x, y, 폭, 높이]
  if(layer){(load.x>1e-3&&pull>.5)?layer.draw({uLoad:load.x,uPull:pull,uFirst:first.x,...zoomGl(r1,D.camera)},t):layer.clear();}
  // 다이는 뚜껑이 비켜난 뒤(또는 기판 확대 중)에만 보임
  if(layer2){(load.x>1e-3&&(ld>.05||Z2.k>.5))?layer2.draw({uLoad:load.x,uFirst:first.x,...zoomGl(r2,D2.camera)},t):layer2.clear();}
  const out=pull/D.stroke, pOut=Math.round(out*100), pPl=Math.round(pl/D2.plateMax*100);
  // 수치 줄: 트레이가 얼마나 나왔는지 / 냉각판이 얼마나 들렸는지 + 지금 부하의 전력 (KO 면 한국어). 확대 중엔 부품 설명
  const trayText=KO?(out<.05?"트레이 "+D.tray+" · 장착됨":out<.98?"트레이 "+D.tray+" · "+pOut+"% 빠짐":"트레이 "+D.tray+" · 열림 · GPU "+R.gpuPerTray+" · CPU "+R.cpuPerTray)
    :(out<.05?"tray "+D.tray+" seated":out<.98?"tray "+D.tray+" · "+pOut+"% out":"tray "+D.tray+" open · "+R.gpuPerTray+" GPU · "+R.cpuPerTray+" CPU");
  const plateText=KO?(lift<.02?"냉각판 덮임":ld<.03?"냉각판 "+pPl+"% 들림":lift<.98?"뚜껑 들리는 중":"냉각판·뚜껑 들림 · 다이 "+G.dies+" · HBM3e "+G.hbm+" ("+G.hbmGb+" GB)")
    :(lift<.02?"cold plate on":ld<.03?"lifting plate "+pPl+"%":lift<.98?"lifting lid":"plate and lid off · "+G.dies+" dies · "+G.hbm+" HBM3e "+G.hbmGb+" GB");
  say(read1,Z1.on?(Z1.info||ZT.hint):trayText+" · "+(perTrayKw*load.x).toFixed(1)+" kW");
  say(read2,Z2.on?(Z2.info||ZT.hint):plateText+" · "+(G.kw*load.x).toFixed(2)+" kW");
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;time+=dt;const calm=still.matches;
  // 그림은 저절로 움직임(14초 둘러보기, 마우스로 조작하지 않음). 확대해 보는 동안만 그 자리에서 멈췄다가, 끝나면 멈춘 곳부터 이어짐
  const zoomed=Z1.on||Z2.on;touring=!calm&&!zoomed;
  let wantLoad=1;   // 확대 중·움직임 줄이기 설정에선 칩이 데워진 모습
  if(touring){clock+=dt;const t=tourAt(clock);target=t.pull;liftTarget=t.lift;wantLoad=t.load;}
  if(Z1.on)target=D.stroke;   // 트레이 확대 중엔 트레이를 끝까지 꺼내 둠
  pull=calm?target:pull+(target-pull)*(1-Math.exp(-dt/.6));if(Math.abs(target-pull)<.05)pull=target;
  lift=calm?liftTarget:lift+(liftTarget-lift)*(1-Math.exp(-dt/.6));if(Math.abs(liftTarget-lift)<.002)lift=liftTarget;
  Z1.step(dt,calm);Z2.step(dt,calm);
  settle(load,wantLoad,dt,1.8,calm);settle(first,(layer||layer2)?1:0,dt,.6,calm);
  draw();
  frame=visible?requestAnimationFrame(tick):0;
}
const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(tick);}};
const hold=()=>run();   // 확대·포인터 조작 뒤 루프를 깨움
// 포인터·키는 확대에만 씀 (평소엔 그림이 저절로 움직임): 확대 중 돋보기 위치·부품 찾기, + / - / Esc / 화살표
for(const ev of ["pointermove","pointerdown"]){stage.addEventListener(ev,Z1.pointer);stage2.addEventListener(ev,Z2.pointer);}
stage.addEventListener("keydown",Z1.key);stage2.addEventListener("keydown",Z2.key);
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible)run();});
if(still.matches){touring=false;target=pull=D.stroke;liftTarget=lift=1;load.x=1;first.x=(layer||layer2)?1:0;}   // 움직임 줄이기: 다 열린 정지 그림
draw();run();
window.__rackBusy=()=>Z1.on||Z2.on;   // 확대해 보는 중이면 부팅 화면이 저절로 넘어가지 않음
window.__rackState=()=>({clock:+clock.toFixed(2),load:+load.x.toFixed(3),pull:+pull.toFixed(1),zoom:[+Z1.k.toFixed(3),+Z2.k.toFixed(3)],on:[Z1.on,Z2.on],touring,info:[Z1.info,Z2.info]});   // 검수용 상태 읽기
window.__rackStop=()=>{visible=false;if(frame)cancelAnimationFrame(frame);frame=0;};
// 검수용: 둘러보기의 t 초 장면으로 바로 이동 (따라가는 값들을 목표에 붙여서 그 순간을 그림)
window.__rackSeek=(t)=>{clock=t;const s=tourAt(t);pull=target=s.pull;lift=liftTarget=s.lift;load.x=s.load;first.x=1;draw();};
`;

// 그림 칸 (ko = 한국어 부팅 화면용 / 아니면 영어 검수 페이지용). 설명은 칸(role=group)의 aria-label 한 곳에만 두고,
// 안쪽 SVG 의 영어 설명(role=img)은 낭독기에서 숨김 (같은 내용을 두 번 읽지 않게)
const quiet = (svg) => svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
const stageHtml = (ko) => `<div class="rk-stage" data-fig="rack" tabindex="0" role="group" aria-label="${zoomText(ko).rack.aria[0]}">${quiet(backSvg)}${traySvg}<canvas class="rk-layer rk-gl" aria-hidden="true"></canvas>${frontSvg}<span class="rk-aim" aria-hidden="true"></span></div>`;
const stage2Html = (ko) => `<div class="rk-stage" data-fig="gpu" tabindex="0" role="group" aria-label="${zoomText(ko).gpu.aria[0]}">${quiet(G2.backSvg)}<canvas class="rk-layer rk-gl" aria-hidden="true"></canvas>${G2.frontSvg}<span class="rk-aim" aria-hidden="true"></span></div>`;
// 확대 단추: 눈에 띄게 채운 단추 + 처음 몇 번 깜빡이는 안내(data-call, 한 번 쓰면 멈춤)
const zoomButton = (fig, ko) => `<button class="rk-zoom" type="button" data-zoom="${fig}" data-call aria-pressed="false">${zoomText(ko)[fig].in}</button>`;
const pairHtml = (ko) => `<div class="rk-pair">
  <div class="rk-fig"><div class="rk-head"><h2>${ko ? "랙" : "Rack"} · ${RACK.name} <small>${ko ? `GPU ${RACK.gpus}개 ≈ ${RACK.kw} kW` : `${RACK.gpus} GPUs ≈ ${RACK.kw} kW`}</small></h2>${zoomButton("rack", ko)}</div>${stageHtml(ko)}<div class="rk-read" data-readout="rack">${ko ? `트레이 ${PULLED.index} · 장착됨` : `tray ${PULLED.index} seated`} · 0.0 kW</div></div>
  <div class="rk-fig"><div class="rk-head"><h2>GPU · ${GPU.name} <small>${ko ? `트레이 속 GPU 1개 확대 · 다이 ${GPU.dies} · HBM3e ${GPU.hbm} (${GPU.hbmGb} GB) · ≈${GPU.kw} kW` : `one GPU from the tray · ${GPU.dies} dies · ${GPU.hbm} HBM3e (${GPU.hbmGb} GB) · ≈${GPU.kw} kW`}</small></h2>${zoomButton("gpu", ko)}</div>${stage2Html(ko)}<div class="rk-read" data-readout="gpu">${ko ? "냉각판 덮임" : "cold plate on"} · 0.00 kW</div></div>
</div>`;

const gl = readFileSync(join(HERE, "..", "kit", "gl.mjs"), "utf8").replace(/^export\s+(const|function)/gm, "$1").replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
// 실행 스크립트: WebGL 도구 + 움직임 루프 (언어만 다르게 두 벌)
const liveScriptFor = (ko) => gl + "\n" + LIVE.replace("__DATA__", JSON.stringify(DATA)).replace("__DATA2__", JSON.stringify(G2.DATA)).replace("__KO__", ko ? "true" : "false")
  .replace("__INFO__", JSON.stringify(INFO)).replace("__ZOOM__", JSON.stringify(zoomText(ko)));

// 검수용 독립 페이지 (영어)
writeFileSync(join(HERE, "rack-light.html"), k.pageHtml({ title: `${RACK.name} rack + ${GPU.name}`, theme: "light", body: `<style>${CSS}</style><div class="iso-plate" style="padding:18px">${pairHtml(false)}</div>`, script: liveScriptFor(false), width: 1100 }));

// 앱에 끼워 넣는 조각 (index.html 의 <!-- rack --> 자리에)
// 두 그림의 가로:세로 비율을 CSS 변수로 넘김 → index.html 이 화면 높이에 맞춰 그림 크기를 정할 때 씀 (숫자를 손으로 맞출 필요 없음)
const ASPECT = `.rk-wrap{--rk-a1:${(WIDTH / HEIGHT).toFixed(3)};--rk-a2:${(G2.DATA.W / G2.DATA.H).toFixed(3)}}`;
const fragment = `<style>${k.ISO_CSS}${CSS}${ASPECT}</style>
<div class="iso rk-wrap" data-theme="light">
  ${pairHtml(true)}
  <div class="rk-ui"><span class="rk-hint">저절로 움직입니다 · 확대 단추로 부품 살펴보기</span><button class="rk-go" type="button" data-boot-go>건너뛰기 →</button></div>
</div>
<script>(function(){${liveScriptFor(true)}})();</script>`;
writeFileSync(join(ROOT, "src", "boot", "rack.html"), fragment);
console.log(`wrote rack-light.html (${(readFileSync(join(HERE, "rack-light.html")).length / 1024).toFixed(0)} KB) and src/boot/rack.html (${(fragment.length / 1024).toFixed(0)} KB)`);

// 검사 (node build.mjs --audit): 각 층의 관통·끝점·지지·칠하는 순서
auditAll({ "rack.tray": TRAY_SHOP, ...G2.shops });
