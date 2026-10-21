// =============================================================
// gpu.mjs — 부팅 그림의 두 번째 물건: GB300 기판 위 B300 GPU 1개 (분해도)
// -------------------------------------------------------------
// 실물 사진(GTC 2025 GB300 기판, Dell XE9712·HPE 트레이) 기준의 색과 구조:
//   검정 메인보드 → 검정 소켓 고정 틀 → GPU 모듈 기판 → 패키지 기판 → 인터포저 →
//   실리콘 다이 2개 + HBM3e 8개 → 회색 금속 뚜껑 → 구리 냉각판
//   냉각판의 이음쇠에서 검정 호스가 나와 퀵커넥터(UQD)로 매니폴드에 꽂힘.
//   파랑 = 냉각수 공급, 빨강 = 회수 (실물처럼 연결부 고리에만 색이 있음)
// 들어 올리면 냉각판(호스·플러그와 함께)이 먼저, 뚜껑이 나중에 떠서 층이 보이고,
// 부하가 오르면 다이가 데워집니다(WebGL 열 잉크). 실물은 뚜껑이 붙어 있어 떼지 못함 → 분해도.
// 단위: 1 = 1 mm.  x·y 가 바닥(+y 가 보는 쪽), z 가 위.  build.mjs 가 불러 씁니다.
// =============================================================
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { glCamera } from "../kit/gl.mjs";
import * as A from "../kit/audit.mjs";
import { workshop } from "./shop.mjs";

// ---------- 진실: GPU 한 개의 숫자 (제조사 공개 사양의 약값) ----------
export const GPU = { name: "B300", dies: 2, hbm: 8, hbmGb: 288, kw: 1.4 };

// ---------- 높이 (아래 → 위) ----------
const BENCH = { x: -104, y: -92, w: 220, d: 180, r: 6 };   // 전시용 받침대 (오른쪽은 회수 블록 자리만큼 넓음)
const BENCH_Z = -10, FOOT = 6;
const PZ = 5, PT = PZ + 2.4;      // 메인보드 아래·윗면 (받침 기둥 5 mm 위)
const FT = PT + 3.2;              // 소켓 고정 틀(볼스터) 윗면
const MT = PT + 2.6;              // GPU 모듈 기판 윗면 (소켓에 꽂힌 높이 포함)
const ST = MT + 1.4;              // 패키지 기판 윗면
const IT = ST + 0.6;              // 인터포저 윗면
const DT = IT + 1.0;              // 다이·HBM 윗면
const LT = DT + 1.4;              // 뚜껑 윗면
const PLATE_H = 10, PTOP = LT + PLATE_H;   // 구리 냉각판 윗면

// ---------- 평면 배치 ----------
const BOARD = { x: -86, y: -62, w: 172, d: 124, r: 3 };
const FRAME_OUT = { x: -56, y: -52, w: 112, d: 104 };       // 소켓 고정 틀 바깥
const FRAME_IN = { x: -46, y: -42, w: 92, d: 84 };          // 안쪽 구멍
const MOD = { x: -45, y: -41, w: 90, d: 82, r: 1.5 };       // GPU 모듈(SXM 퍽) 기판
const SUB = { x: -39, y: -37, w: 78, d: 74, r: 1.2 };       // 패키지 기판
const INTP = { x: -29, y: -34, w: 58, d: 68, r: 0.6 };      // 인터포저 (실리콘)
const DIES = [{ x: -27, y: -17, w: 26, d: 34, r: 0.6 }, { x: 1, y: -17, w: 26, d: 34, r: 0.6 }];
const HBM = [];
for (const x of [-26, -13, 2, 15]) for (const y of [-31, 20]) HBM.push({ x, y, w: 11, d: 11, r: 0.5 });
const LID = { x: -35, y: -35, w: 70, d: 70, r: 2 };         // 니켈 도금 뚜껑
const PLATE = { x: -54, y: -50, w: 108, d: 100, r: 3 };     // 구리 냉각판
const SCREWS = [[-51, -47], [51, -47], [-51, 47], [51, 47]]; // 냉각판 스프링 나사 = 틀 모서리 나사 구멍

// 들림: 냉각판은 호스·플러그와 함께 곧장 위로 60 mm, 뚜껑은 나중에 위로 32 mm (층 사이가 벌어져 다이·HBM 이 보임)
//   (뚜껑을 옆으로 비키게 해 봤더니 들린 냉각판 뒤로 숨어 버려서 수직으로 둠)
export const PLATE_LIFT = 60, LID_MOVE = [0, 0, 32];

// ---------- 냉각수 길: 이음쇠 → 호스 → 플러그 ↔ 소켓 → 매니폴드 ----------
// 호스는 화면을 가로지르는 방향(오른쪽 뒤)으로 뻗어야 굽은 곳이 납작하게 보이지 않음
const DIR = [0.788, -0.616, 0];                 // 바닥에서 오른쪽 뒤로 (화면 가로 방향)
const EZ = PTOP + 22;                           // 엘보(공) 중심 높이
const RB = 5.2, RR = 3.6, RBARB = 3.4, RF = 4.6, RH = 3.6;   // 엘보·라이저·바브·페룰·호스 반지름
const FERRULE = [9.5, 15.5];                    // 엘보 중심에서 페룰 구간 (축 거리)
const LINES = [
  // 냉각판의 대각선 두 모서리에 이음쇠 (실제 냉각판에서 흔한 배치):
  //   공급 = 뒤쪽 왼편 → 기판 뒤 블록,  회수 = 앞쪽 오른편 → 기판 오른쪽 블록
  //   화면에서 공급 호스는 위쪽(뒤), 회수 호스는 아래 오른쪽(앞)을 지나 서로 겹치지 않음
  //   (둘을 뒤쪽 양 끝에 두면 공급 플러그가 회수 이음쇠 바로 뒤에 와서 이어진 것처럼 보였음)
  { x: -40, y: -40, reach: 48.7, name: "supply", cls: "rk-supply", cap: [0, -1, 0] }, // 파랑
  { x: 40, y: 36, reach: 78.6, name: "return", cls: "rk-return", cap: [1, 0, 0] },     // 빨강 (멀리: 들린 빨강 플러그가 파랑 소켓과 화면에서 40 px 떨어지게)
].map((line) => {
  const elbow = [line.x, line.y, EZ];
  const along = (s) => G.add3(elbow, G.mul3(DIR, s));
  const start = along(FERRULE[1]);              // 호스 시작 (페룰 끝)
  const corner = along(line.reach);             // 꺾이는 곳 → 아래로 (reach = 엘보 중심에서 거리)
  return { ...line, elbow, along, start, corner, socket: [corner[0], corner[1]] };
});
// 소켓·플러그 높이 (매니폴드 위로 쌓임)
const MB = 5;                                   // 매니폴드 막대 윗면
const SOCK = [[MB, MB + 2.5, 5.4], [MB + 2.5, MB + 5.5, 6.0, "sleeve"], [MB + 5.5, MB + 8, 5.4]]; // [z0, z1, r]
const SK = MB + 8;                              // 소켓 윗면 = 플러그 아랫면
const PLUG = [[SK, SK + 3.5, 5.0, "knurl"], [SK + 3.5, SK + 7.5, 4.2], [SK + 7.5, SK + 9, 4.6], [SK + 9, SK + 10.5, 4.9, "ring"], [SK + 10.5, SK + 14, 4.6]];
const HOSE_END = SK + 14;                       // 호스가 플러그 위로 들어가는 높이
// 매니폴드 블록 (소켓마다 하나, 스테인리스). cap = 블록 옆면의 막힌 포트 방향
const BLOCKS = LINES.map((l) => ({ line: l, plan: { x: l.socket[0] - 8, y: l.socket[1] - 7, w: 16, d: 14, r: 2 } }));

// ---------- 화면 맞추기: 들린 냉각판·호스까지 다 들어가게 (가로 560 기준, 세로는 내용에 맞춤) ----------
const W = 560, PAD = 14, CAM = { azimuth: 38, elevation: 32 };
const FIT = [
  ...k.boxCorners(BENCH, BENCH_Z - FOOT, 0),
  ...k.boxCorners(PLATE, LT + PLATE_LIFT, PTOP + PLATE_LIFT),
  ...k.boxCorners({ ...LID, x: LID.x + LID_MOVE[0], y: LID.y + LID_MOVE[1] }, ST + LID_MOVE[2], LT + LID_MOVE[2]),
  ...LINES.flatMap((l) => [[l.elbow[0], l.elbow[1], EZ + RB + PLATE_LIFT], [l.corner[0], l.corner[1], EZ + RH + PLATE_LIFT]]),
];
const H = (() => {
  const P0 = k.fitProjection(FIT, W, 2000, { pad: PAD, ...CAM });
  const ys = FIT.map((p) => k.iso(p, P0)[1]);
  return Math.ceil(Math.max(...ys) - Math.min(...ys) + 2 * PAD + 2);
})();
export const P = k.fitProjection(FIT, W, H, { pad: PAD, ...CAM });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const g = (cls, body) => `<g class="${cls}">${body}</g>`;

// ---------- 받침대 (밝은 회색, 기본 토큰) — 맨 아래라 따로 그림 ----------
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, BENCH_Z - FOOT, -BENCH_Z, P)}"/>`];
  const feet = k.corners(BENCH, 14).sort((a, b) => depth(...a) - depth(...b));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 6, BENCH_Z - FOOT, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.4, BENCH_Z - FOOT + 1.4, FOOT - 1.4, P, 20), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, BENCH_Z, -BENCH_Z, P, 6, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), 0, P, 6), { tone: "lo" }));
  // 앞쪽 눈금자 띠 (눈금은 띠 가장자리에서 자람)
  const strip = { x: BENCH.x + 18, y: BENCH.y + BENCH.d - 12, w: BENCH.w - 36, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(Dt(k.corners(BENCH, 8).map(([x, y]) => at([x, y, 0])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- 고정된 부분: 메인보드·전원부·소켓 틀·GPU 패키지·매니폴드 ----------
function fixed() {
  const W1 = workshop(P, { piece: "back" });
  const { box, cyl, disc, ghost } = W1;
  ghost(A.slab(BENCH, BENCH_Z, -BENCH_Z, { name: "stand.bench" }, 6));   // 받침대 = 바닥 (그림은 bench() 가 따로)
  // 받침 기둥(황동) → 메인보드(검정 PCB)
  for (const [x, y] of k.corners(BOARD, 7)) cyl("stand", x, y, 3, 0, PZ, { cls: "rk-brass", steps: 18, stamp: "stand", info: "stand" });
  // 흰 실크 인쇄: 소켓 자리 테두리 + 좌우 전원부 묶음 테두리 (닫힌 사각형이라 선 끝이 없음)
  const silkRects = [
    { x: FRAME_OUT.x - 1.5, y: FRAME_OUT.y - 1.5, w: FRAME_OUT.w + 3, d: FRAME_OUT.d + 3, r: 1 },
    { x: -85.5, y: -41.5, w: 28.5, d: 77, r: 1 },
    { x: 57, y: -41.5, w: 28.5, d: 77, r: 1 },
  ];
  const silk = L(silkRects.map((r) => k.planOutline(r, PT, P, 2)).join(""), { tone: "hi" });
  const holes = k.corners(BOARD, 7);
  // 기준점(피두셜): 조립 기계가 위치를 맞추는 동그란 구리 점 3개
  const FIDS = [[-56, 58], [56, -58], [84, 59]];
  box("board", BOARD, PZ, PT - PZ, {
    cls: "rk-pcb", steps: 3, bevel: 0.5, tone: "mid", info: "board",
    extra: silk + L(holes.map(([x, y]) => k.ring(x, y, 3.6, PT, P, 18)).join("") + FIDS.map(([x, y]) => k.ring(x, y, 1.6, PT, P, 14)).join(""), { tone: "lo" })
      + Dt([...holes, ...FIDS].map(([x, y]) => at([x, y, PT])), { size: 0.7, tone: "hi" }),
  });
  // 전원부(VRM): 좌우 2열 × 6행 인덕터(회색 금속, 윗면 각인) + 안쪽에 전력 칩(검정)
  const rows = [-40, -27, -14, -1, 12, 25];
  for (const side of [-1, 1]) {
    for (const y of rows) {
      for (const x0 of side < 0 ? [-84, -73] : [64, 75]) {
        const plan = { x: x0, y, w: 9, d: 9, r: 1 };
        box("choke", plan, PT, 5.5, {
          cls: "rk-choke", steps: 2, bevel: 0.3, stamp: "choke", info: "choke",
          extra: L(k.planOutline(k.insetPlan(plan, 2.2), PT + 5.5, P, 2), { tone: "lo" }) + L(k.lineOnTop([x0 + 3.4, y + 4.5], [x0 + 5.6, y + 4.5], PT + 5.5, P), { tone: "mid", free: true }),
        });
      }
      box("stage", { x: side < 0 ? -63.5 : 58.5, y: y + 1.5, w: 5, d: 6, r: 0.4 }, PT, 1.2, { cls: "rk-chip", steps: 2, stamp: "stage", info: "stage" });
    }
  }
  // 전원 컨트롤러 칩 2개 (작은 사각 칩, 1번 핀 점)
  for (const [x, y] of [[-82, 36], [70, -56]]) box("ctrl", { x, y, w: 6, d: 6, r: 0.4 }, PT, 0.9, { cls: "rk-chip", steps: 2, stamp: "ctrl", info: "ctrl", extra: Dt([at([x + 1.2, y + 1.2, PT + 0.9])], { size: 0.45, tone: "hi" }) });
  // NVLink 커넥터 (주황, 실물 색) — 메인보드 뒤 왼쪽 가장자리, 윗면에 검정 슬롯 2개
  const NV = { x: -84, y: -61, w: 24, d: 9, r: 0.8 };
  box("nvlink", NV, PT, 9, {
    cls: "rk-orange", steps: 2, bevel: 0.4, info: "nvlink",
    extra: g("rk-chip", S(k.slabOf({ x: NV.x + 2, y: NV.y + 2.5, w: 9, d: 4, r: 0.4 }, PT + 9, 0.3, P, 2), { tone: "mid", flat: true }) + S(k.slabOf({ x: NV.x + 13, y: NV.y + 2.5, w: 9, d: 4, r: 0.4 }, PT + 9, 0.3, P, 2), { tone: "mid", flat: true })),
  });
  // 전원 커넥터 (검정, 앞 오른쪽) — 윗면 핀 구멍 2 × 6
  const PWR = { x: 62, y: 44, w: 20, d: 9, r: 0.6 };
  box("power", PWR, PT, 7, {
    cls: "rk-chip", steps: 2, bevel: 0.3, info: "power",
    extra: Dt(Array.from({ length: 12 }, (_, i) => at([PWR.x + 2.6 + (i % 6) * 2.96, PWR.y + 3 + Math.floor(i / 6) * 3, PT + 7])), { size: 0.55, tone: "mid" }),
  });
  // 고분자 콘덴서 (은색 캔): 앞쪽 한 줄, 뒤쪽 짧은 한 줄
  for (let x = -40; x <= 40; x += 8) cyl("cap", x, 58.5, 2.4, PT, 5, { cls: "rk-steel", steps: 16, stamp: "cap", info: "cap", extra: L(k.ring(x, 58.5, 1.3, PT + 5, P, 12), { tone: "lo" }) });
  for (let x = -36; x <= 4; x += 8) cyl("cap", x, -58.5, 2.4, PT, 5, { cls: "rk-steel", steps: 16, stamp: "cap", info: "cap", extra: L(k.ring(x, -58.5, 1.3, PT + 5, P, 12), { tone: "lo" }) });
  // 적층 세라믹 콘덴서(MLCC) 줄: 소켓 틀 앞뒤로 촘촘히 (작은 갈색 칩)
  for (const y of [53.4, -54.2]) for (let x = -50; x <= 50; x += 4) box("mlcc.board", { x: x - 0.8, y, w: 1.6, d: 0.8, r: 0.15 }, PT, 0.5, { cls: "rk-mlcc", steps: 2, stamp: "mlcc-board", info: "mlcc" });
  // 흰 라벨 스티커 (글줄 3개)
  const label = { x: -84, y: 45, w: 22, d: 12, r: 0.8 };
  box("label", label, PT, 0.4, {
    cls: "rk-paper", steps: 2, tone: "hi", crease: "none", info: "label",
    extra: L([3.5, 6, 8.5].map((dy, i) => k.lineOnTop([label.x + 2.5, label.y + dy], [label.x + 2.5 + [15, 11, 13][i], label.y + dy], PT + 0.4, P)).join(""), { tone: "lo", free: true }),
  });
  // 소켓 고정 틀 (검정 양극산화 알루미늄): 막대 4개 + 모서리 나사 구멍 + 정렬 핀 2개
  const bars = [
    { x: FRAME_OUT.x, y: FRAME_OUT.y, w: FRAME_OUT.w, d: FRAME_IN.y - FRAME_OUT.y },
    { x: FRAME_OUT.x, y: FRAME_IN.y + FRAME_IN.d, w: FRAME_OUT.w, d: FRAME_OUT.y + FRAME_OUT.d - FRAME_IN.y - FRAME_IN.d },
    { x: FRAME_OUT.x, y: FRAME_IN.y, w: FRAME_IN.x - FRAME_OUT.x, d: FRAME_IN.d },
    { x: FRAME_IN.x + FRAME_IN.w, y: FRAME_IN.y, w: FRAME_OUT.x + FRAME_OUT.w - FRAME_IN.x - FRAME_IN.w, d: FRAME_IN.d },
  ].map((b) => ({ ...b, r: 0.6 }));
  bars.forEach((b, i) => {
    const holesOn = SCREWS.filter(([x, y]) => i < 2 && y > b.y && y < b.y + b.d);
    box("frame", b, PT, FT - PT, {
      cls: "rk-frame", steps: 2, bevel: 0.4, info: "frame",
      extra: holesOn.length ? L(holesOn.map(([x, y]) => k.ring(x, y, 2.2, FT, P, 16)).join(""), { tone: "lo" }) + Dt(holesOn.map(([x, y]) => at([x, y, FT])), { size: 0.55, tone: "mid" }) : "",
    });
  });
  for (const [x, y] of [[-36, -47], [36, 47]]) cyl("pin", x, y, 1.3, FT, 2.2, { cls: "rk-steel", steps: 14, stamp: "pin", info: "pin" });
  // GPU 모듈 기판(+ 양옆 콘덴서 줄) → 패키지 기판(+ 작은 콘덴서 줄) → 인터포저 → 다이 2개(주제) + HBM 8개
  box("module", MOD, PT, MT - PT, { cls: "rk-modpcb", steps: 2, bevel: 0.3, info: "module", extra: Dt(k.corners(MOD, 3).map(([x, y]) => at([x, y, MT])), { size: 0.5, tone: "hi" }) });
  for (const x of [-43.6, 41.6]) for (let y = -34; y <= 34; y += 5) box("mlcc.module", { x, y: y - 0.4, w: 2, d: 0.8, r: 0.15 }, MT, 0.5, { cls: "rk-mlcc", steps: 2, stamp: "mlcc-module", info: "mlcc" });
  box("substrate", SUB, MT, ST - MT, { cls: "rk-substrate", steps: 2, bevel: 0.3, info: "substrate" });
  for (const x of [-37.6, 35.6]) for (let y = -30; y <= 30; y += 7.5) box("mlcc", { x, y, w: 2, d: 1.2, r: 0.2 }, ST, 0.6, { cls: "rk-mlcc", steps: 2, stamp: "mlcc", info: "mlcc" });
  box("interposer", INTP, ST, IT - ST, { cls: "rk-interposer", steps: 2, info: "interposer" });
  for (const h of HBM) box("hbm", h, IT, DT - IT, {
    cls: "rk-hbm", steps: 2, bevel: 0.3, stamp: "hbm", info: "hbm",
    extra: L(k.planOutline(k.insetPlan(h, 1.8), DT, P, 2), { tone: "lo" }) + L([4.4, 6.6].map((dy) => k.lineOnTop([h.x + 3.2, h.y + dy], [h.x + 7.8, h.y + dy], DT, P)).join(""), { tone: "mid", free: true }),
  });
  DIES.forEach((die) => box("die", die, IT, DT - IT, { cls: "rk-die", steps: 2, bevel: 0.4, tone: "hi", lit: true, className: "rk-die-solid", info: "die" }));
  // 매니폴드 블록 (스테인리스) + 옆면 육각 마개 + 소켓(색 슬리브) — 받침대 위
  for (const { line, plan } of BLOCKS) {
    box(`manifold.${line.name}`, plan, 0, MB, {
      cls: "rk-steel", steps: 3, bevel: 0.6, info: "manifold",
      extra: Dt([[plan.x + 3, plan.y + 3], [plan.x + plan.w - 3, plan.y + plan.d - 3]].map(([x, y]) => at([x, y, MB])), { size: 0.6, tone: "mid" }),
    });
    const [cx, cy] = line.socket, d = line.cap;
    const face = [cx + d[0] * plan.w / 2, cy + d[1] * plan.d / 2, MB / 2];
    disc(`manifold.cap.${line.name}`, G.frameAlong(face, d), 0, 3, 2.3, { cls: "rk-steel", tone: "mid", info: "manifold" });
    for (const [z0, z1, r, kind] of SOCK) cyl(`socket.${line.name}`, cx, cy, r, z0, z1 - z0, { cls: kind === "sleeve" ? line.cls : "rk-steel", steps: 28, tone: kind === "sleeve" ? "hi" : "mid", info: `socket-${line.name}` });
  }
  return W1;
}

// ---------- 뚜껑 (앞쪽 SVG, 들림 2단계) ----------
function lidLayer() {
  const W2 = workshop(P, { piece: "lid" });
  W2.ghost(A.slab(SUB, MT, ST - MT, { name: "stand.substrate" }, 2));   // 뚜껑이 앉는 패키지 기판 (다른 층)
  // 레이저 각인: 글줄 3개 + 2D 코드 칸 + 1번 핀 표시 점
  const code = { x: 18, y: 16, w: 10, d: 10, r: 0.4 };
  const marks = L([[-27, 18, 24], [-27, 22, 18], [-27, 26, 21]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], LT, P)).join(""), { tone: "mid", free: true })
    + L(k.planOutline(code, LT, P, 2), { tone: "mid" })
    + Dt(Array.from({ length: 16 }, (_, i) => [code.x + 1.6 + (i % 4) * 2.3, code.y + 1.6 + Math.floor(i / 4) * 2.3]).filter((_, i) => (i * 7) % 3 !== 1).map(([x, y]) => at([x, y, LT])), { size: 0.45, tone: "hi" })
    + Dt([at([LID.x + 4, LID.y + LID.d - 4, LT])], { size: 0.9, tone: "hi" });
  W2.box("lid", LID, ST, LT - ST, { cls: "rk-lid", steps: 3, bevel: 0.6, tone: "mid", extra: marks, inner: L(k.sideSeam(LID, ST + 1, P, 3), { tone: "faint" }) });
  return W2;
}

// ---------- 냉각판 (앞쪽 SVG, 들림 1단계): 구리 판 + 스프링 나사 + 이음쇠 + 호스 + 플러그 ----------
function plateLayer() {
  const W3 = workshop(P, { piece: "plate" });
  const { box, cyl, disc, ball, hose, ghost } = W3;
  ghost(A.slab(LID, ST, LT - ST, { name: "stand.lid" }, 3));                     // 냉각판이 앉는 뚜껑 (다른 층)
  for (const line of LINES) ghost(A.cylinder(line.socket[0], line.socket[1], 5.4, MB, SK - MB, { name: `stand.socket.${line.name}` })); // 플러그가 앉는 소켓
  box("plate", PLATE, LT, PLATE_H, {
    cls: "rk-copper", steps: 4, bevel: 0.8, tone: "hi",
    inner: L(k.sideSeam(PLATE, LT + 3.5, P, 4), { tone: "faint" }),
    extra: L(k.planOutline(k.insetPlan(PLATE, 8), PTOP, P, 4), { tone: "lo" })
      + L([[-40, 36, 30], [-40, 40, 22]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], PTOP, P)).join(""), { tone: "lo", free: true }),
  });
  // 스프링 나사 (냉각판과 함께 들림)
  for (const [x, y] of SCREWS) cyl("screw", x, y, 2.6, PTOP, 2.4, { cls: "rk-steel", steps: 18, stamp: "screw", extra: L(k.ring(x, y, 1.1, PTOP + 2.4, P, 12), { tone: "lo" }) });
  for (const line of LINES) {
    const [x, y] = line.elbow;
    // 육각 너트 → 세운 관(라이저) → 엘보(공) → 바브 → 페룰(색 고리 없음: 색은 퀵커넥터 쪽)
    const own = `fitting.${line.name}`;   // 너트·라이저·엘보·바브·페룰은 한 이음쇠 (공에 꽂힌 관은 의도된 접합)
    cyl(`nut.${line.name}`, x, y, 6, PTOP, 3, { cls: "rk-steel", steps: 6, tone: "mid", owner: own });
    const riserTop = EZ - Math.sqrt(RB * RB - RR * RR);
    cyl(`riser.${line.name}`, x, y, RR, PTOP + 3, riserTop - PTOP - 3, { cls: "rk-steel", steps: 24, owner: own });
    ball(`elbow.${line.name}`, line.elbow, RB, { cls: "rk-steel", owner: own });
    const F = G.frameAlong(line.elbow, DIR);
    disc(`barb.${line.name}`, F, Math.sqrt(RB * RB - RBARB * RBARB), FERRULE[0], RBARB, { cls: "rk-steel", owner: own });
    disc(`ferrule.${line.name}`, F, FERRULE[0], FERRULE[1], RF, { cls: "rk-steel", tone: "hi", owner: own });
    // 검정 호스: 수평으로 오른쪽 뒤 → 아래로 꺾여 플러그 위로
    hose(`hose.${line.name}`, [line.start, line.corner, [line.corner[0], line.corner[1], HOSE_END]], RH, { cls: "rk-hose", tone: "mid", maxLength: 8 });
    // 퀵커넥터 플러그 (스테인리스 + 색 고리) — 소켓 바로 위에 꽂혀 있다가 함께 들림
    for (const [z0, z1, r, kind] of PLUG) {
      const knurl = kind === "knurl" ? L(k.knurl(line.socket[0], line.socket[1], r, z0 + 0.4, z1 - 0.4, 18, P), { tone: "lo" }) : "";
      cyl(`plug.${line.name}`, line.socket[0], line.socket[1], r, z0, z1 - z0, { cls: kind === "ring" ? line.cls : "rk-steel", steps: 28, tone: kind === "ring" ? "hi" : "mid", extra: knurl });
    }
  }
  return W3;
}

// ---------- Blender 사진 모드용 배치 (build.mjs 가 scripts/blender/boot-layout.json 으로 씀) ----------
// 그림과 같은 숫자·같은 투영으로 3D 장면을 세워 찍으면 사진이 그림과 픽셀 단위로 겹침 → 말풍선·부품 찾기를 그대로 씀
//   fixed() 안에 직접 적힌 작은 부품 숫자(전원부 줄·콘덴서 줄 등)는 scripts/blender/boot-photos.py 에 같은 값으로 옮겨 둠
export const LAYOUT = {
  W, H, proj: P, k: k.cameraOf(P).k, plateLift: PLATE_LIFT, lidMove: LID_MOVE,
  BENCH, BENCH_Z, FOOT, PZ, PT, FT, MT, ST, IT, DT, LT, PLATE_H, PTOP,
  BOARD, FRAME_OUT, FRAME_IN, MOD, SUB, INTP, DIES, HBM, LID, PLATE, SCREWS,
  LINES: LINES.map(({ x, y, reach, name, cap, elbow, start, corner, socket }) => ({ x, y, reach, name, cap, elbow, start, corner, socket })),
  DIR, EZ, RB, RR, RBARB, RF, RH, FERRULE, MB, SOCK, SK, PLUG, HOSE_END, BLOCKS: BLOCKS.map((b) => ({ name: b.line.name, ...b.plan })),
};

export function gpuFigure() {
  const LABEL = `${GPU.name} GPU in its socket on a black GB300 board: two silicon dies and ${GPU.hbm} HBM3e stacks (${GPU.hbmGb} GB) under a nickel lid and a copper liquid cold plate whose black hoses plug into a manifold through quick disconnects with blue supply and red return rings. The plate and then the lid lift to show the layers; the dies warm with load.`;
  const back = fixed(), lid = lidLayer(), plate = plateLayer();
  const backSvg = k.figureSvg({ width: W, height: H, label: LABEL, body: [bench(), back.render()], className: "rk-back" });
  const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rk-layer rk-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g data-part="lid">${lid.render()}</g><g data-part="plate">${plate.render()}</g></svg>`;
  const up = k.axisVector(P, [0, 0, 1]);        // 세계 +z 1 mm 의 화면 벡터 (냉각판 들림)
  const lidVec = k.axisVector(P, LID_MOVE);      // 뚜껑이 끝까지 비켜났을 때의 화면 이동
  // 기판 확대: 확대 배율, 처음 보는 곳(패키지 가운데의 화면 위치)
  const round1 = (n) => Math.round(n * 10) / 10;
  const DATA = {
    W, H, camera: glCamera(P), up: [up[0], up[1]], plateMax: PLATE_LIFT, lidVec: [lidVec[0], lidVec[1]], zDie: DT, dies: DIES.map((d) => [d.x, d.y, d.w, d.d]), gpu: GPU,
    zoom: 2.4, focus: at([0, 0, ST]).map(round1),
    // 자동 확대 둘러보기에서 차례로 짚을 부품 (전체 그림에서의 화면 위치 비율, 돋보기는 그 비율 자리에 그 부품을 보여 줌)
    stops: [["die", [14, 0, DT]], ["hbm", [20.5, 25.5, DT]], ["choke", [68.5, 29.5, PT + 5.5]], ["nvlink", [-72, -56.5, PT + 9]]]
      .map(([key, p]) => { const s = at(p); return { key, fx: +(s[0] / W).toFixed(3), fy: +(s[1] / H).toFixed(3) }; }),
  };
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
  return { backSvg, frontSvg, DATA, FRAGMENT, shops: { "gpu.back": back, "gpu.lid": lid, "gpu.plate": plate } };
}
