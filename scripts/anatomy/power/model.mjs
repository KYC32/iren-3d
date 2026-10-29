// =============================================================
// model.mjs — 전력 블록 그림의 "진실": 숫자와 둘러보기 시간표 (그림·움직임·글이 모두 여기서 나옴)
// -------------------------------------------------------------
// 출처: 매켄지 현장을 분석한 X 스레드 (Ace-Kicker, 전기·기계 시공업자, 2026-10-01)
//   "매켄지 데이터홀 1개 = 똑같은 세그먼트 8칸, 1칸 = 자체 2.5 MW 전력 블록 (8 × 2.5 = 홀당 20 MW)"
//   경로: 현장 변전소 → 34.5 kV(땅속) → 강압 변압기 → 480 V → (케이블 래더) → ATS·배전반(발전기 백업)
//         → 홀 배전 → 랙 PDU(277 V) → 공랭 B300 서버. ATS → MER(전기실)도 있음
//   발전기 2.5 MW 는 480 V 에서 약 3,000 A → 콘듀잇 12개. 9/23 영상: 장비 설치·케이블 당김, 아직 종단·통전 전
// 제3자 관찰이라 회사 확인 사실이 아님 → 그림 아래에 그렇게 적음.
// GPU·랙 수는 사이트의 데이터홀 추정 가정(src/data/hallEstimate.js)을 그대로 씀 → 캠퍼스 패널의 숫자와 같음
// =============================================================
import { GPU_PROFILES } from "../../../src/data/hallEstimate.js";

export const SOURCE = {
  url: "https://x.com/AceKicker13/status/2105663078654202207",
  by: "Ace-Kicker (@AceKicker13)",
  posted: "2026-10-01",   // 스레드 게시일
  filmed: "2026-09-23",   // 드론·열화상 촬영일 (열 신호가 조용함 = 아직 통전 전)
};

// 회사 홈페이지(iren.com 매켄지·프린스조지 페이지)에 적힌 사양 — 공랭, 평균 PUE 1.1, 최대 랙 밀도 70 kW
//   홀 안 모습은 같은 페이지 사진(찬 통로·Dell 서버 앞면·뜨거운 통로의 배기 팬 벽)을 보고 그림
export const SITE = {
  pages: ["https://iren.com/data-centers/mackenzie", "https://iren.com/data-centers/prince-george"],
  pue: 1.1,
  rackMaxKw: 70,
};
// 매켄지 캠퍼스 (회사 홈페이지 매켄지 페이지: 전력 용량 80 MW · 부지 11 에이커) · 홀 수 4 는 제3자 관찰
//   홀 4개 × 8칸 × 2.5 MW = 80 MW → 제3자가 센 블록 크기가 회사가 밝힌 용량과 맞음
export const CAMPUS = { mw: 80, acres: 11, halls: 4 };

export const BLOCK = {
  mw: 2.5,              // 세그먼트 1칸 = 2.5 MW 전력 블록
  perHall: 8,           // 홀 1개 = 8칸 = 20 MW (매켄지 홀 4개 = 80 MW, 회사 발표 80 MW 와 맞음)
  hvKv: 34.5,           // 현장 변전소 → 변압기 1차 (kV)
  lvV: 480,             // 변압기 2차 (V, 3상 4선 480Y/277)
  genMw: 2.5,           // 세그먼트마다 디젤 발전기 1대
  genConduits: 12,      // 발전기 → ATS 콘듀잇 (관찰: 슬래브를 가로지르는 12개 다발)
};

// 3상 선전류 (A) = 전력 ÷ (√3 × 선간전압). 서버 전원은 역률 보정이 있어 역률 ≈ 1 로 봄
export const lineAmps = (mw, volts) => (mw * 1e6) / (Math.sqrt(3) * volts);
// 상전압 = 선간전압 ÷ √3 (480 V → 277 V: 서버가 이 전압을 바로 씀 → 홀 안에 2차 변압기가 필요 없음)
export const phaseVolts = (volts) => volts / Math.sqrt(3);

export const AMPS = {
  hv: lineAmps(BLOCK.mw, BLOCK.hvKv * 1000),   // ≈ 42 A
  lv: lineAmps(BLOCK.mw, BLOCK.lvV),           // ≈ 3,007 A
};
export const PHASE_V = phaseVolts(BLOCK.lvV);  // ≈ 277 V

// GPU·랙 추정 (사이트 가정: 공랭 HGX Blackwell = GPU 1개당 전체 2.0 kW, 랙 1개 = 서버 4대 × 8 = GPU 32개)
const HGX = GPU_PROFILES.find((p) => p.id === "hgx-blackwell");
export const EST = (() => {
  const gpus = Math.round((BLOCK.mw * 1000) / HGX.kwPerGpu);
  return { kwPerGpu: HGX.kwPerGpu, gpusPerRack: HGX.gpusPerRack, serversPerRack: HGX.gpusPerRack / 8, rackKw: HGX.gpusPerRack * HGX.kwPerGpu, gpus, racks: Math.ceil(gpus / HGX.gpusPerRack) };
})();

// ---------- 규모 사다리 (둘러보기 끝: 랙 1대 → 전력 블록 1칸 → 매켄지 캠퍼스) ----------
// 오른쪽 위 이름표 3장에 들어가는 숫자. 숫자마다 근거(basis)를 붙임 → 이름표에 작게 "회사 / 제3자 관찰 / 추정" 표시
//   company = 회사 홈페이지 · observed = 제3자 현장 관찰(위 SOURCE) · estimate = 사이트 가정으로 계산한 추정
export function scaleLadder() {
  return [
    { id: "rack", nums: [{ value: EST.gpusPerRack, basis: "estimate" }, { value: SITE.rackMaxKw, basis: "company" }] },
    { id: "hall", nums: [{ value: BLOCK.mw, basis: "observed" }, { value: EST.gpus, basis: "estimate" }], racks: EST.racks },
    { id: "site", nums: [{ value: CAMPUS.mw, basis: "company" }, { value: CAMPUS.acres, basis: "company" }] },
  ];
}

// ---------- 9/23 관찰 (data/observations.json 의 진척 항목: 홀마다 센 장비 개수) ----------
// 홀 4개 × 8칸 = 32칸을 캠퍼스 전체로 더함 → 그림의 진하게/흐리게와 말풍선 숫자가 여기서 나옴
const KINDS = ["pads", "transformers", "generators", "mer", "ats"];
export function obsTotals(obs) {
  const sum = (key) => obs.halls.reduce((n, h) => n + h[key], 0);
  return {
    segments: obs.halls.length * obs.segments_per_hall,
    halls: obs.halls.length,
    ...Object.fromEntries(KINDS.map((key) => [key, sum(key)])),
    pulledHalls: obs.halls.filter((h) => h.cabling === "pulled").length,   // 케이블을 당겨 놓은 홀 수
  };
}
// 1칸 그림은 32칸 중 "대부분"의 모습 → 절반을 넘게 설치된 장비만 진하게 (딱 절반은 대부분이 아님)
export const looksInstalled = (count, total) => count * 2 > total;
// 말풍선용 홀별 개수: "1홀 8, 2홀 6, …" / "H1 8, H2 6, …" (말풍선은 " · " 에서 줄을 바꾸므로 쉼표로 이음)
export const hallCounts = (obs, key, ko) => obs.halls.map((h) => (ko ? `${h.name}홀 ${h[key]}` : `H${h.name} ${h[key]}`)).join(", ");

// ---------- 둘러보기 시간표 (초) ----------
// 확대해 부품을 차례로 짚은 뒤(말풍선) 전체로 돌아와 정전 → 발전기 기동 → 전환 → 복전 → 되돌림을 보여 줌
//   (실제 시간은 압축: 발전기는 보통 10초 안팎에 전압·주파수가 서고, 복전 뒤 되돌림은 몇 분 기다리는 게 보통)
export const T = {
  stopsAt: 3.2,      // 확대 시작 (처음 몇 초는 전체 모형을 보여 줌)
  stopLen: 2.6,      // 부품 한 곳을 짚는 시간
  outage: 0,         // (아래 tourPlan 이 정함) 정전 순간
  obsStopsAt: 1.6,   // 9/23 보기: 확대 시작
  obsStopLen: 3.4,   // 9/23 보기: 장비 한 곳 (개수까지 읽을 시간이라 조금 김)
  obsHold: 5,        // 9/23 보기: 다 짚은 뒤 전체 보기로 쉬는 시간
};
export const PHASES = ["normal", "outage", "crank", "transfer", "gen", "restore", "retransfer", "cooldown", "rack", "hall", "site"];

// 둘러보기 계획: 짚을 곳 수(n)를 받아 시간표를 만듦 → { len, zoomEnd, at: { outage, crank, ready, back, retransfer, stop, rack, hall, site, end } }
//   발전기가 멈춘 뒤에는 규모 장면 3개: 랙 1대(확대) → 전력 블록 1칸(홀 안) → 매켄지 캠퍼스(전체 보기)
export function tourPlan(n) {
  const zoomEnd = T.stopsAt + n * T.stopLen;          // 마지막 부품까지
  const outage = zoomEnd + 2.2;                        // 전체 보기로 돌아온 뒤 정전
  const at = {
    outage,
    crank: outage + 1.2,        // ATS 가 계통 전압이 사라진 걸 확인하고 기동 신호
    ready: outage + 4.6,        // 발전기 전압·주파수 확립 → 전환 시작
    xfer: 0.5,                  // 전환 접점이 움직이는 시간
    back: outage + 10.5,        // 복전
    retransfer: outage + 14.5,  // 복전이 안정된 걸 확인하고 되돌림
    stop: outage + 18,          // 무부하 냉각 뒤 정지
  };
  at.rack = at.stop + 1.5;      // 규모 ① 랙 1대 (발전기가 다 멈춘 뒤)
  at.hall = at.rack + 3.6;      // 규모 ② 전력 블록 1칸
  at.site = at.hall + 3.6;      // 규모 ③ 매켄지 캠퍼스 (전체 보기)
  at.end = at.site + 4.4;       // 규모 장면 끝 → 잠깐 평소 모습 뒤 처음으로
  return { len: at.end + 2.4, zoomEnd, stopsAt: T.stopsAt, stopLen: T.stopLen, at };
}

// t 초의 상태 (계통 있음? · 발전기 회전 0..1 · 전환 접점 +1=계통(N) / −1=발전기(E) · 단계 이름)
export function stateAt(t, plan) {
  const a = plan.at;
  const ramp = (x, x0, x1) => Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const grid = !(t >= a.outage && t < a.back);
  // 발전기: 기동 신호 뒤 1.6초 동안 돌기 시작해 확립, 정지 명령 뒤 1.5초에 멈춤
  const gen = t < a.crank ? 0 : t < a.stop ? ramp(t, a.crank, a.crank + 1.6) : 1 - ramp(t, a.stop, a.stop + 1.5);
  // 전환 접점: 계통(+1) → 발전기(−1) → 계통(+1)
  const blade = t < a.ready ? 1 : t < a.retransfer ? 1 - 2 * ramp(t, a.ready, a.ready + a.xfer) : -1 + 2 * ramp(t, a.retransfer, a.retransfer + a.xfer);
  const phase = t < a.outage ? "normal" : t < a.crank ? "outage" : t < a.ready ? "crank" : t < a.ready + a.xfer ? "transfer"
    : t < a.back ? "gen" : t < a.retransfer ? "restore" : t < a.retransfer + a.xfer ? "retransfer" : t < a.rack ? "cooldown"
    : t < a.hall ? "rack" : t < a.site ? "hall" : t < a.end ? "site" : "normal";
  // 전류가 흐르는 길: 계통 쪽(34.5 kV·래더)은 접점이 N 이고 계통이 있을 때, 발전기 콘듀잇은 접점이 E 이고 발전기가 돌 때
  const onN = blade > 0.98 && grid, onE = blade < -0.98 && gen > 0.98;
  return { grid, gen, blade, phase, flow: { hv: onN, lv: onN, gen: onE, load: onN || onE } };
}
