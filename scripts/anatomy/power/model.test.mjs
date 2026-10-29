// =============================================================
// model.test.mjs — 전력 블록 그림의 "9/23 관찰" 숫자 계산과 "규모 사다리"(둘러보기 끝: 랙 1대 → 전력 블록 1칸 → 매켄지 캠퍼스) 테스트
//   그림의 진하게/흐리게·말풍선·이름표 숫자가 이 함수들에서 나오므로, 숫자가 틀리면 그림도 틀림 (npm test 가 함께 돌림)
// =============================================================
import { describe, it, expect } from 'vitest'
import { obsTotals, looksInstalled, hallCounts, scaleLadder, BLOCK, EST, SITE, CAMPUS, tourPlan, stateAt, PHASES } from './model.mjs'

describe('scaleLadder — 둘러보기 끝 이름표 3장 (이름 + 숫자 2개)', () => {
  const ladder = scaleLadder()
  it('랙 → 전력 블록 1칸 → 매켄지 캠퍼스 차례', () => {
    expect(ladder.map((s) => s.id)).toEqual(['rack', 'hall', 'site'])
    for (const s of ladder) expect(s.nums).toHaveLength(2)
  })
  it('랙: GPU 32개 (사이트 가정: 서버 4대 × 8) · 최대 랙 밀도 70 kW (회사)', () => {
    const [gpu, kw] = ladder[0].nums
    expect(gpu).toMatchObject({ value: 32, basis: 'estimate' })
    expect(kw).toMatchObject({ value: 70, basis: 'company' })
    expect(kw.value).toBe(SITE.rackMaxKw)
    expect(EST.rackKw).toBeLessThanOrEqual(SITE.rackMaxKw)   // 그림의 가정(64 kW)이 회사 최대 밀도 안
  })
  it('전력 블록 1칸: 2.5 MW (제3자 관찰) · GPU ≈ 1,250개 · 랙 ≈ 40대 (그림 제목 아래 줄의 숫자와 같음)', () => {
    const [mw, gpu] = ladder[1].nums
    expect(mw).toMatchObject({ value: BLOCK.mw, basis: 'observed' })
    expect(gpu).toMatchObject({ value: 1250, basis: 'estimate' })
    expect(gpu.value).toBe(EST.gpus)
    expect(ladder[1].racks).toBe(40)
    expect(ladder[1].racks).toBe(EST.racks)
  })
  it('매켄지 캠퍼스: 전력 80 MW · 부지 11 에이커 (회사 홈페이지)', () => {
    const [mw, acres] = ladder[2].nums
    expect(mw).toMatchObject({ value: 80, basis: 'company' })
    expect(acres).toMatchObject({ value: 11, basis: 'company' })
    expect(CAMPUS).toMatchObject({ mw: 80, acres: 11, halls: 4 })
  })
  it('홀 4개 × 8칸 × 2.5 MW = 80 MW (제3자 관찰이 회사 용량과 맞음) · 이 블록은 32칸 중 1칸', () => {
    expect(CAMPUS.halls * BLOCK.perHall * BLOCK.mw).toBe(CAMPUS.mw)
    expect(CAMPUS.halls * BLOCK.perHall).toBe(32)
  })
})

describe('tourPlan / stateAt — 정전 장면(발전기 정지) 뒤에 규모 사다리 장면 3개', () => {
  const plan = tourPlan(13)
  const a = plan.at
  it('발전기가 멈춘 뒤 rack → hall → site → end 차례로, 장면마다 3초 넘게 머묾', () => {
    expect(a.rack).toBeGreaterThanOrEqual(a.stop + 1.5)   // 발전기가 다 멈춘 뒤
    expect(a.hall - a.rack).toBeGreaterThan(3)
    expect(a.site - a.hall).toBeGreaterThan(3)
    expect(a.end - a.site).toBeGreaterThan(3)
    expect(plan.len).toBeGreaterThan(a.end)
  })
  it('각 구간의 단계 이름', () => {
    expect(stateAt(a.stop + 0.1, plan).phase).toBe('cooldown')
    expect(stateAt(a.rack - 0.1, plan).phase).toBe('cooldown')
    expect(stateAt(a.rack + 0.1, plan).phase).toBe('rack')
    expect(stateAt(a.hall + 0.1, plan).phase).toBe('hall')
    expect(stateAt(a.site + 0.1, plan).phase).toBe('site')
    expect(stateAt(a.end + 0.1, plan).phase).toBe('normal')
  })
  it('규모 장면에선 평소 모습: 계통 있음 · 발전기 멈춤 · 접점은 계통(N) · 계통 쪽으로 전류가 흐름', () => {
    for (const t of [a.rack + 0.1, a.hall + 1, a.site + 1]) {
      const s = stateAt(t, plan)
      expect(s.grid).toBe(true)
      expect(s.gen).toBe(0)
      expect(s.blade).toBe(1)
      expect(s.flow).toEqual({ hv: true, lv: true, gen: false, load: true })
    }
  })
  it('PHASES 에 새 단계 이름이 들어 있음', () => {
    expect(PHASES).toEqual(expect.arrayContaining(['rack', 'hall', 'site']))
  })
  it('stateAt 은 페이지에 글자로 넣어도 돌아감 (바깥 이름을 쓰지 않음)', () => {
    const copy = new Function(`return ${stateAt.toString()}`)()
    expect(copy(a.hall + 0.1, plan).phase).toBe('hall')
  })
})

// data/observations.json 의 mk-air-2026-09-23 과 같은 모양 (홀 4개 × 8칸)
const SEP23 = {
  segments_per_hall: 8,
  halls: [
    { name: '1', pads: 8, mer: 8, transformers: 8, generators: 8, ats: 1, cabling: 'pulled' },
    { name: '2', pads: 8, mer: 7, transformers: 8, generators: 6, ats: 0, cabling: 'pulled' },
    { name: '3', pads: 8, mer: 8, transformers: 8, generators: 6, ats: 3, cabling: 'pulled' },
    { name: '4', pads: 3, mer: 0, transformers: 8, generators: 0, ats: 0, cabling: 'none' },
  ],
}

describe('obsTotals', () => {
  it('홀마다 센 장비 개수를 캠퍼스 전체(32칸)로 더함', () => {
    expect(obsTotals(SEP23)).toEqual({
      segments: 32, halls: 4,
      pads: 27, transformers: 32, generators: 20, mer: 23, ats: 4,
      pulledHalls: 3,   // 케이블을 당겨 놓은 홀 수 (1~3홀)
    })
  })
})

describe('looksInstalled — 1칸 그림에서 진하게 그릴지', () => {
  it('32칸 중 절반을 넘게 설치됐으면 진하게', () => {
    expect(looksInstalled(32, 32)).toBe(true)    // 변압기
    expect(looksInstalled(20, 32)).toBe(true)    // 발전기
    expect(looksInstalled(17, 32)).toBe(true)
  })
  it('절반 이하면 흐리게 (딱 절반도 "대부분"이 아님)', () => {
    expect(looksInstalled(16, 32)).toBe(false)
    expect(looksInstalled(4, 32)).toBe(false)    // ATS
    expect(looksInstalled(0, 32)).toBe(false)
  })
})

describe('hallCounts — 말풍선에 넣는 홀별 개수', () => {
  // 말풍선은 " · " 를 줄바꿈으로 쓰므로 홀끼리는 쉼표로 이음 (한 줄에 홀 4개)
  it('한국어: "1홀 8, 2홀 6, …"', () => {
    expect(hallCounts(SEP23, 'generators', true)).toBe('1홀 8, 2홀 6, 3홀 6, 4홀 0')
  })
  it('영어: "H1 8, H2 6, …"', () => {
    expect(hallCounts(SEP23, 'ats', false)).toBe('H1 1, H2 0, H3 3, H4 0')
  })
})
