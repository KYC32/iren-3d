// =============================================================
// hallEstimate.js — 데이터홀 한 동의 "속": IT 전력(MW) → GPU 몇 개 · 랙 몇 개 · 계약 기준 연 매출
// -------------------------------------------------------------
// 투자자 질문: "50MW 짜리 건물 하나가 실제로 GPU 몇 개이고, 계약상 1년에 얼마를 버나?"
// 회사는 건물별 GPU 수를 거의 발표하지 않음 (지금은 프린스조지 23,000개뿐) → 아래 가정으로 계산한 "추정"
//   GPU 수 ≈ IT 전력(kW) ÷ GPU 1개당 전력(kW)    ← 회사가 GPU 수를 발표했으면 그 값을 그대로 씀
//   랙 수  ≈ GPU 수 ÷ 랙 1개당 GPU 수
//   계약 기준 연 매출 ≈ 계약 금액 ÷ 기간(년) ÷ 계약 IT 용량 × 이 건물 IT 용량  (용량에 고르게 나뉜다고 가정)
// 화면은 반드시 "추정"과 가정을 함께 표시합니다.
// =============================================================

// TODO(학습 포인트): GPU 세대별 가정 — 숫자를 바꾸면 화면의 추정치가 모두 바뀝니다.
//   kwPerGpu  : GPU 1개당 IT 전력. CPU·NVLink 스위치·네트워크·스토리지까지 나눠 담은 "전체" 값
//               예) GB300 NVL72 랙 ≈ 132~140kW ÷ 72개 ≈ 1.9kW + 네트워크·스토리지 → 약 2.0kW
//               검산: 프린스조지 공랭 홀은 IT 50MW 에 GPU 23,000개 (회사 발표) → 약 2.2kW/개
//   gpusPerRack: NVL72 = 랙 하나에 GPU 72개 / 공랭 HGX = 8개짜리 서버 4대 = 32개
// 위에서부터 차례로 모델 이름을 맞춰 보고, 처음 맞는 가정을 씁니다 (혼합 모델은 최신 세대 우선).
export const GPU_PROFILES = [
  { id: 'nvl72', test: /NVL72|GB300|GB200/i, label: 'NVL72', gpusPerRack: 72, kwPerGpu: 2.0, cooling: 'liquid' },
  { id: 'hgx-blackwell', test: /B300|B200|MI3\d\d|Blackwell/i, label: 'HGX', gpusPerRack: 32, kwPerGpu: 2.0, cooling: 'air' },
  { id: 'hgx-hopper', test: /H100|H200|Hopper/i, label: 'HGX (Hopper)', gpusPerRack: 32, kwPerGpu: 1.4, cooling: 'air' },
]
// 모델이 발표되지 않은 건물: 냉각 방식으로 최신 세대를 가정 (액체냉각 → NVL72, 공랭 → HGX Blackwell)
const DEFAULT_BY_KIND = { datahall_liquid: 'nvl72', datahall_air: 'hgx-blackwell' }
const PUE = 1.3 // IT 전력이 없고 전체(gross) 전력만 있을 때: IT ≈ gross ÷ 1.3

// 건물에 맞는 GPU 가정 고르기 → { ...profile, modelKnown }
export function gpuProfile(building) {
  const model = building?.gpu?.model
  const hit = model && GPU_PROFILES.find((p) => p.test.test(model))
  if (hit) return { ...hit, modelKnown: true }
  const id = DEFAULT_BY_KIND[building?.kind]
  return id ? { ...GPU_PROFILES.find((p) => p.id === id), modelKnown: false } : null
}

// 건물 한 동의 추정치. AI 데이터홀이 아니거나 전력 정보가 없으면 null
//   → { itMw, itBasis: 'it'|'disclosed'|'gross', gpus, gpusReported, racks, profile }
export function estimateHall(building) {
  const profile = gpuProfile(building)
  if (!profile) return null
  // 화면용 건물(view.js)은 IT 전력이 없으면 0 으로 채워 둠 → 0 도 "없음"으로 봄 (|| 사용)
  const itMw = building.it_mw || building.disclosedMw || (building.gross_mw ? building.gross_mw / PUE : null)
  const itBasis = building.it_mw ? 'it' : building.disclosedMw ? 'disclosed' : 'gross'
  const reported = building.gpu?.count
  if (!reported && !itMw) return null
  const gpus = reported ?? Math.round((itMw * 1000) / profile.kwPerGpu)
  return { itMw, itBasis, gpus, gpusReported: Boolean(reported), racks: Math.ceil(gpus / profile.gpusPerRack), profile }
}

// 계약 기준 연 매출 (백만 달러). 계약 금액·기간이 공개된 계약에 묶인 건물만
//   계약이 이 건물 하나뿐이면 계약 전체가 이 건물 몫 (share = 1, 예: NVIDIA 공랭 홀)
//   여러 건물에 걸친 계약은 IT 용량 비율로 나눔 (계약 IT 용량·건물 IT 용량이 모두 공개돼야 함)
//   → { usdM, contract, share, whole } 또는 null
export function contractRunRate(building, contracts, itMw = building?.it_mw || null) {
  const k = contracts.find((c) => c.buildings?.includes(building?.id))
  if (!k || !k.value_usd_bn || !k.term_years) return null
  const whole = k.buildings.length === 1
  if (!whole && (!k.it_mw || !itMw)) return null
  const share = whole ? 1 : itMw / k.it_mw
  return { usdM: (k.value_usd_bn * 1000 / k.term_years) * share, contract: k, share, whole }
}

// 화면용 반올림: 큰 수는 유효숫자 2자리 (25,347 → 25,000), 작은 수는 10 단위
export function roundNice(n) {
  if (n >= 1000) { const p = 10 ** (Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p }
  return n >= 100 ? Math.round(n / 10) * 10 : n
}

// 검산용 기준 건물: 회사가 GPU 수와 IT 전력을 함께 발표한 첫 건물 → GPU 1개당 실제 kW
//   (지금 데이터에선 프린스조지 공랭 홀: 50MW · 23,000개 ≈ 2.2kW) 화면에서 가정과 나란히 보여 줌
export function referenceHall(sites) {
  for (const site of sites) {
    for (const b of site.buildings) {
      if (b.gpu?.count && b.it_mw) return { site, building: b, itMw: b.it_mw, gpus: b.gpu.count, kwPerGpu: (b.it_mw * 1000) / b.gpu.count }
    }
  }
  return null
}

// 달러 표시: 1,000M 이상은 bn, 그 아래는 M (예: 485 → $485M, 1940 → $1.94bn)
export const fmtUsdM = (m) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}bn` : `$${Math.round(m)}M`)
