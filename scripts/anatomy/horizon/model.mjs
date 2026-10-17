// =============================================================
// model.mjs — Horizon 액체냉각 홀 그림의 "진실": 숫자·출처·둘러보기 시간표 (그림·움직임·글이 모두 여기서 나옴)
// -------------------------------------------------------------
// 회사 자료 (IREN 보도자료·SEC 공시):
//   · Horizon 1~4 = 차일드레스의 50 MW(IT) 직접 칩 액체냉각 AI 클라우드 4개, Microsoft 5년 $9.7bn 계약 (8-K 2026-08-13)
//   · Horizon 1 = 75 MW gross (IT 50 MW), 랙 밀도 200 kW 까지 설계 (2025-02 실적 자료·2025-03 월간 업데이트)
//   · 랙 밀도 130~200 kW, "Tier III 수준 동시 유지보수(concurrent maintainability)" (2025-11 Microsoft 계약 발표 자료)
//   · 냉각 설비 = 패키지 칠러 플랜트·칠러·건식 냉각기·냉각수 분배기(CDU), 백업 = UPS·디젤 발전기 (6-K 2025-01-21)
//   · Horizon 1 은 1차 변전소 6번에서 전력을 받음 (2025-02 월간 업데이트의 차일드레스 배치도, 2025-06 회사 영상: 중압 변압기 2대)
//   · GPU 서버 = Dell 이 공급하는 GB300 NVL72 (2026-08 10-K 첨부 금융 계약서), 발전기는 대기 배출 허가 대상 (같은 계약서)
// 홀 안·바깥 모습은 IREN 의 "Horizon 1 인도" 영상(2026-08-13 X 게시)을 보고 그림:
//   NVL72 랙 줄과 노란 광케이블, 구리 냉각판과 구리관, 통로 벽의 회색 전기반, 천장 케이블 트레이,
//   건물 옆을 따라가는 굵은 보온 배관, 핀 코일 냉각기와 유연 이음관
// 모르는 것(배관 방식·온도·CDU 위치 등)은 그림 표현이고, 계산은 아래 가정으로 함 → 그림 아래에 그렇게 적음
// =============================================================
import { GPU_PROFILES } from "../../../src/data/hallEstimate.js";

export const SOURCES = {
  delivered: "https://www.sec.gov/Archives/edgar/data/1878848/000114036126032638/ef20080141_ex99-1.htm",   // Horizon 1 인도 (8-K, 2026-08-13)
  design: "https://www.sec.gov/Archives/edgar/data/1878848/000187884825000011/irenfebmonthlyupdatevf.htm",  // 75 MW · 200 kW 랙 (2025-02 월간)
  tier: "https://www.sec.gov/Archives/edgar/data/1878848/000114036125040072/ef20058139_ex99-2.htm",          // 130~200 kW · Tier III (2025-11)
  plant: "https://www.sec.gov/Archives/edgar/data/1878848/000114036125001477/ny20037451x2_ex99-1.htm",       // 칠러·건식 냉각기·CDU·UPS·발전기 (2025-01)
  video: "https://x.com/IREN_Ltd/status/2087867677192929349",                                                   // Horizon 1 인도 영상 (2026-08-13)
};

// Horizon 1 칸 하나 (회사 수치)
export const HORIZON = {
  itMw: 50,              // IT 부하 (GPU 서버가 쓰는 전력)
  grossMw: 75,           // 전체 (냉각 설비·손실·여유 포함)
  rackKw: [130, 200],    // 회사가 밝힌 랙 밀도 범위
  gpusPerRack: 72,       // GB300 NVL72 = 랙 하나에 Blackwell Ultra GPU 72개 (한 NVLink 도메인)
  cpusPerRack: 36,       // Grace CPU 36개
  computeTrays: 18,      // 컴퓨트 트레이 18개 (트레이마다 GPU 4 + CPU 2)
  switchTrays: 9,        // NVLink 스위치 트레이 9개 (랙 가운데)
};

// GPU·랙 추정: 사이트의 데이터홀 가정(GPU 1개당 전체 2.0 kW) → 캠퍼스 패널의 숫자와 같음
const NVL = GPU_PROFILES.find((p) => p.id === "nvl72");
export const EST = (() => {
  const gpus = Math.round((HORIZON.itMw * 1000) / NVL.kwPerGpu);
  return { kwPerGpu: NVL.kwPerGpu, rackKw: NVL.gpusPerRack * NVL.kwPerGpu, gpus, racks: Math.ceil(gpus / NVL.gpusPerRack) };
})();

// ---------- 열 → 물: 냉각수가 얼마나 흘러야 하나 ----------
// 전기는 결국 모두 열이 됨 → 랙 1대가 쓰는 전력 ≈ 물이 가져가야 할 열
// 유량(kg/s) = 열(kW) ÷ (물의 비열 4.18 kJ/kg·°C × 데워지는 온도 ΔT)
//   ΔT 는 공개되지 않음 → 10 °C 로 가정 (직접 칩 냉각에서 흔한 설계 범위). 1 kg ≈ 1 L
export const WATER = { cp: 4.18, dT: 10 };
export const litersPerMin = (kw, dT = WATER.dT) => (kw / (WATER.cp * dT)) * 60;
export const FLOW = {
  rack: litersPerMin(EST.rackKw),                 // 랙 1대 ≈ 207 L/분
  hall: litersPerMin(HORIZON.itMw * 1000),        // Horizon 1칸 전체 ≈ 72,000 L/분
};
// 75 MW 와 50 MW 의 차이 = 냉각 설비(칠러·펌프·팬)·전력 손실·여유
export const OVERHEAD_MW = HORIZON.grossMw - HORIZON.itMw;

// ---------- 둘러보기 시간표 (초) ----------
// 확대해 부품을 차례로 짚은 뒤(말풍선) 전체로 돌아와
//   ① 더운 오후: 바깥 기온이 오르면 건식 냉각기만으로는 물이 덜 식어 칠러가 보탬 → 저녁에 멈춤
//   ② 동시 유지보수: 대기 CDU C 를 켜고 → CDU B 의 밸브를 닫아 떼어 냄 → 정비 중에도 냉각 계속 → 복귀
// (실제 시간은 압축: 기온 변화는 몇 시간, 정비는 몇 시간~며칠)
export const T = { stopsAt: 3.2, stopLen: 2.6 };
export const TEMP = { cool: 22, hot: 39 };   // 바깥 기온 예시 (°C): 아침·저녁 / 차일드레스 여름 오후
export const PHASES = ["normal", "warm", "chill", "evening", "standby", "isolate", "maint", "restore"];

export function tourPlan(n) {
  const zoomEnd = T.stopsAt + n * T.stopLen;   // 마지막 부품까지
  const warm = zoomEnd + 2.2;                   // 전체 보기로 돌아온 뒤 기온이 오르기 시작
  const at = {
    warm,
    chill: warm + 3.2,          // 칠러 기동 (기온이 충분히 오른 뒤)
    evening: warm + 9.4,        // 기온이 내려가기 시작
    chillOff: warm + 11.4,      // 칠러 정지
    standby: warm + 14.4,       // 대기 CDU C 기동
    isolate: warm + 16.4,       // CDU B 밸브 닫기 시작
    maint: warm + 17.6,         // B 격리 완료 → 정비 중
    restore: warm + 24.0,       // B 밸브 다시 열기
    back: warm + 26.4,          // C 다시 대기
  };
  at.stop = at.back + 1.6;
  return { len: at.stop + 3, zoomEnd, stopsAt: T.stopsAt, stopLen: T.stopLen, at };
}

// t 초의 상태: 바깥 기온 · 칠러 0..1 · CDU 펌프(A·B·C) 0..1 · B 밸브 열림 0..1 · 단계 이름 · 흐름
export function stateAt(t, plan) {
  const a = plan.at;
  const ramp = (x, x0, x1) => Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const ease = (q) => q * q * (3 - 2 * q);
  // 바깥 기온: 아침 22 °C → 오후 39 °C → 저녁 다시 22 °C
  const hot = t < a.evening ? ease(ramp(t, a.warm, a.warm + 3)) : 1 - ease(ramp(t, a.evening, a.evening + 3));
  const temp = 22 + (39 - 22) * hot;
  // 칠러: 기동 1.2초에 걸쳐 돌기 시작, 정지 1초에 걸쳐 멈춤
  const chill = t < a.chillOff ? ramp(t, a.chill, a.chill + 1.2) : 1 - ramp(t, a.chillOff, a.chillOff + 1);
  // CDU: 평소 A·B 가동, C 대기 → 정비 때 C 가동, B 멈춤
  const c = t < a.back ? ramp(t, a.standby, a.standby + 1.2) : 1 - ramp(t, a.back, a.back + 1);
  const valve = t < a.restore ? 1 - ramp(t, a.isolate, a.maint) : ramp(t, a.restore, a.restore + 1.2);   // B 밸브 열림
  const b = Math.min(valve, t < a.restore ? 1 - ramp(t, a.isolate, a.isolate + 0.6) : ramp(t, a.restore + 0.6, a.restore + 1.4));
  const phase = t < a.warm ? "normal" : t < a.chill ? "warm" : t < a.evening ? "chill" : t < a.standby ? "evening"
    : t < a.isolate ? "standby" : t < a.maint ? "isolate" : t < a.restore ? "maint" : t < a.stop ? "restore" : "normal";
  return { temp, chill, cdu: [1, b, c], valve, phase, flow: { power: true, water: true, cduA: true, cduB: b > 0.5, cduC: c > 0.5, chill: chill > 0.9 } };
}
