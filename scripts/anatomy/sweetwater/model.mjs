// =============================================================
// model.mjs — 스위트워터 1 그림의 "진실": 숫자·출처·둘러보기 시간표 (그림·움직임·글이 모두 여기서 나옴)
// -------------------------------------------------------------
// 회사 자료 (IREN 보도자료·SEC 공시·홈페이지):
//   · 스위트워터 1 = 1,400 MW, 대형 변전소 345 kV/138 kV + 1차 변전소 138 kV/34.5 kV (6-K 2025-01-21, iren.com)
//   · 고압 변전소 2026-05-01 통전 (예정대로) — 통전 보도자료 · FY26 3분기 실적 발표 콜 (2026-05-07)
//   · 첫 단계 = IT 200 MW 액체냉각 데이터센터 건설 중, "Vera Rubin 같은 차세대 칩 구조를 위해 설계",
//     "첫 단계가 뒤 단계를 더 빨리 붙이는 뼈대" (2026-05 콜) / 300 MW(gross), 2027 Q4 납품 목표 (2026-09-08 발표)
//   · 스위트워터 1·2 = 2 GW 허브 (ERCOT Batch Zero 'Base Load' 조건부 편입, 2026-09-08)
// 회사 사진 (iren.com 스위트워터 갤러리): 넓은 자갈 마당의 개방형 변전소 — 철골 가대·관형 모선·지지 애자·
//   차단기 칸·대형 변압기 여러 대·흰 제어동·피뢰 기둥, 주변 풍력 발전기
// NVIDIA (CES 2026 기조연설, 보도): Vera Rubin 은 45 °C 물로 식힘 → "칠러가 필요 없음"
// 홀 안 설계(냉각 설비·대수·배치)는 회사가 밝히지 않음 → 위 사양을 바탕으로 한 그림 표현 (그림 아래에 적음)
// =============================================================

export const SOURCES = {
  plant: "https://www.sec.gov/Archives/edgar/data/1878848/000114036125001477/ny20037451x2_ex99-1.htm",   // 345/138 kV · 138/34.5 kV (2025-01 6-K)
  energized: "https://www.globenewswire.com/news-release/2026/05/01/3286213/0/en/iren-announces-successful-energization-of-sweetwater-1.html", // 통전 2026-05-01
  call: "https://www.sec.gov/Archives/edgar/data/1878848/000187884826000028/irentranscript.htm",         // 예정대로 통전 · IT 200 MW · Vera Rubin · 뼈대 (2026-05 콜)
  batch: "https://www.globenewswire.com/news-release/2026/09/08/3357498/0/en/iren-s-2gw-sweetwater-hub-included-as-base-load-in-ercot-batch-zero.html", // 300 MW · 2027 Q4
  site: "https://iren.com/data-centers/sweetwater",                                                       // 사진 · 1,400 MW · 1,700 에이커
  nvidia: "https://www.datacenterdynamics.com/en/news/vera-rubin-hot-water-cooling-reveal-triggers-hvac-share-drop", // 45 °C · 칠러 불필요 (보도)
};

export const SITE = {
  mw: 1400,            // 스위트워터 1 계통 연결 (gross)
  hubMw: 2000,         // 스위트워터 1 + 2 허브
  hvKv: 345,           // 송전 (ERCOT)
  mvKv: 138,           // 대형 변전소 → 1차 변전소
  dvKv: 34.5,          // 1차 변전소 → 건물
  phase1Gross: 300,    // 첫 단계 (gross MW)
  phase1It: 200,       // 첫 단계 (IT MW)
  acres: 1700,
};

// 3상 선전류 (A) = 전력 ÷ (√3 × 선간전압) — 첫 단계 300 MW 를 보낼 때
export const lineAmps = (mw, kv) => (mw * 1e6) / (Math.sqrt(3) * kv * 1000);
export const AMPS = {
  hv: lineAmps(SITE.phase1Gross, SITE.hvKv),   // ≈ 502 A
  mv: lineAmps(SITE.phase1Gross, SITE.mvKv),   // ≈ 1,255 A
  dv: lineAmps(SITE.phase1Gross, SITE.dvKv),   // ≈ 5,020 A (여러 피더로 나눔)
};
// 첫 단계가 변전소 용량에서 차지하는 몫
export const SHARE = SITE.phase1Gross / SITE.mw;   // ≈ 0.21

// ---------- 45 °C 물: 칠러 없이 되는 까닭 ----------
// 건식 냉각기는 바깥 공기로만 식히므로 물을 "바깥 기온 + 접근 온도차"까지만 내림
//   (접근 온도차 = 냉각기 + CDU 열교환기에서 잃는 온도를 합친 설계 값, 여기선 5 °C 가정)
// Vera Rubin 이 받는 물은 45 °C → 바깥이 40 °C 까지는 건식 냉각기만으로 됨. Horizon(GB300)은 더 찬물이 필요해 더운 날 칠러가 보탬
export const WATER = { supply: 45, approach: 5, cp: 4.18, dT: 10 };
export const coolest = (outdoor) => outdoor + WATER.approach;     // 건식 냉각기가 만들 수 있는 가장 찬물
export const NO_CHILLER_MAX = WATER.supply - WATER.approach;       // 이 기온까지는 칠러 없이 45 °C 물 (= 40 °C)
export const TEMP = { cool: 24, hot: 39 };                          // 바깥 기온 예시 (°C): 아침 / 서텍사스 여름 오후

// ---------- 둘러보기 시간표 (초) ----------
// 부품을 차례로 짚은 뒤 전체로 돌아와 ① 더운 오후: 바깥 39 °C 여도 건식 냉각기만으로 45 °C 물 → 칠러 없음
//   ② 다음 단계: 비워 둔 변압기 자리·피더 칸에 다음 단계가 붙는 모습 (규모·시기는 미공개 → 흐린 그림)
export const T = { stopsAt: 3.2, stopLen: 2.6 };
export const PHASES = ["normal", "warm", "hot", "evening", "grow", "grown", "settle"];

export function tourPlan(n) {
  const zoomEnd = T.stopsAt + n * T.stopLen;
  const warm = zoomEnd + 2.2;
  const at = {
    warm,
    hot: warm + 3.2,          // 한낮: 팬 최대, 물은 여전히 45 °C
    evening: warm + 9.0,      // 기온이 내려감
    grow: warm + 12.6,        // 다음 단계 그림이 나타나기 시작
    grown: warm + 15.0,       // 다 나타남
    settle: warm + 21.0,      // 다시 사라짐
  };
  at.stop = at.settle + 1.6;
  return { len: at.stop + 3, zoomEnd, stopsAt: T.stopsAt, stopLen: T.stopLen, at };
}

// t 초의 상태: 바깥 기온 · 냉각기 팬 0..1 · 다음 단계 그림 0..1 · 단계 이름 · 흐름
export function stateAt(t, plan) {
  const a = plan.at;
  const ramp = (x, x0, x1) => Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const ease = (q) => q * q * (3 - 2 * q);
  const hot = t < a.evening ? ease(ramp(t, a.warm, a.warm + 3)) : 1 - ease(ramp(t, a.evening, a.evening + 3));
  const temp = 24 + (39 - 24) * hot;
  const fan = 0.45 + 0.55 * hot;                                   // 더울수록 팬을 빨리
  const future = t < a.settle ? ease(ramp(t, a.grow, a.grown)) : 1 - ease(ramp(t, a.settle, a.settle + 1.4));
  const phase = t < a.warm ? "normal" : t < a.hot ? "warm" : t < a.evening ? "hot" : t < a.grow ? "evening"
    : t < a.grown ? "grow" : t < a.settle ? "grown" : t < a.stop ? "settle" : "normal";
  return { temp, fan, future, phase, flow: { power: true, water: true, future: future > 0.6 } };
}
