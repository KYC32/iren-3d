// =============================================================
// contracts.js — 고객 계약이 실제 용량으로 얼마나 이행됐나
// -------------------------------------------------------------
// 계약마다 연결된 건물들의 "그 날짜 상태"를 모아 MW 로 나눕니다.
//   live         : 고객 인수 + 가동 (매출이 나는 단계)
//   commissioning: 시운전
//   building     : 건설중
//   planned      : 계획 (아직 착공 전)
// MW 기준: 건물의 IT MW. IT 기준이 공개되지 않은 계약(NVIDIA 약 60MW)은 공개된 용량(disclosedMw)으로
// 세고 unit 을 'capacity' 로 표시합니다. 배치 사이트를 밝히지 않은 계약은 known=false.
// =============================================================

const STAGE_OF = { delivered: 'live', operating: 'live', commissioning: 'commissioning', under_construction: 'building', planned: 'planned' }

// sites: 화면용 사이트 목록(data.sites — 날짜에 맞춘 상태), contracts: 회사 계약 목록
export function contractProgress(sites, contracts) {
  return contracts.map((k) => {
    const stages = { live: 0, commissioning: 0, building: 0, planned: 0 }
    let unit = 'IT'
    const buildings = []
    for (const sid of k.sites ?? []) {
      const site = sites.find((s) => s.id === sid)
      if (!site) continue
      for (const bid of k.buildings ?? []) {
        const b = site.buildings.find((x) => x.id === bid)
        if (!b) continue
        // IT MW 가 있으면 그걸, 없으면 원문에 공개된 용량(예: NVIDIA ~60MW)
        const raw = site._raw?.buildings.find((x) => x.id === bid)
        let mw = b.it_mw || 0
        if (!mw && raw?.disclosedMw) { mw = raw.disclosedMw; unit = 'capacity' }
        const stage = STAGE_OF[b.status] ?? 'planned'
        stages[stage] += mw
        buildings.push({ id: bid, siteId: sid, name: b.name, name_ko: b.name_ko, status: b.status, mw })
      }
    }
    const total = k.it_mw ?? Object.values(stages).reduce((a, v) => a + v, 0)
    return { ...k, stages, total, unit, buildings, known: buildings.length > 0 }
  })
}
