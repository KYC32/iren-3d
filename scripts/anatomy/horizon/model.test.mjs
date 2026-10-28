// =============================================================
// model.test.mjs — Horizon 홀 그림의 "규모 사다리"(둘러보기 끝: 랙 1대 → Horizon 1 → 차일드레스 캠퍼스) 테스트
//   이름표의 숫자와 둘러보기 장면이 이 함수들에서 나오므로, 숫자가 틀리면 그림도 틀림 (npm test 가 함께 돌림)
// =============================================================
import { describe, it, expect } from 'vitest'
import { scaleLadder, HORIZON, EST, CAMPUS, SOURCES, tourPlan, stateAt, PHASES } from './model.mjs'
import { GPU_PROFILES } from '../../../src/data/hallEstimate.js'

const nvl = GPU_PROFILES.find((p) => p.id === 'nvl72')

describe('scaleLadder — 둘러보기 끝 이름표 3장 (이름 + 숫자 2개)', () => {
  const ladder = scaleLadder()
  it('랙 → Horizon 1 → 차일드레스 캠퍼스 차례', () => {
    expect(ladder.map((s) => s.id)).toEqual(['rack', 'hall', 'site'])
    for (const s of ladder) expect(s.nums).toHaveLength(2)
  })
  it('랙: GB300 NVL72 = GPU 72개 (NVIDIA 사양) · 랙 밀도 130–200 kW (회사 설계 범위)', () => {
    const [gpu, kw] = ladder[0].nums
    expect(gpu).toMatchObject({ value: 72, basis: 'nvidia' })
    expect(kw).toMatchObject({ range: [130, 200], basis: 'company' })
  })
  it('Horizon 1: IT 50 MW (회사) · GPU ≈ 25,000개 · 랙 ≈ 348대 (사이트 NVL72 가정 2.0 kW, 그림 제목의 숫자와 같음)', () => {
    const [it, gpu] = ladder[1].nums
    expect(it).toMatchObject({ value: HORIZON.itMw, basis: 'company' })
    expect(gpu).toMatchObject({ value: 25000, basis: 'estimate' })
    expect(ladder[1].racks).toBe(348)
    expect(gpu.value).toBe(EST.gpus)
    expect(ladder[1].racks).toBe(EST.racks)
    expect(EST.kwPerGpu).toBe(nvl.kwPerGpu)
  })
  it('차일드레스 캠퍼스: 전력 750 MW · 부지 576 에이커 (회사 사이트)', () => {
    const [mw, acres] = ladder[2].nums
    expect(mw).toMatchObject({ value: 750, basis: 'company' })
    expect(acres).toMatchObject({ value: 576, basis: 'company' })
    expect(CAMPUS).toMatchObject({ mw: 750, acres: 576 })
    expect(SOURCES.campus).toMatch(/iren\.com\/data-centers\/childress/)
  })
  it('Horizon 1 전체 75 MW = 캠퍼스 750 MW 의 10%', () => {
    expect(Math.round((HORIZON.grossMw / CAMPUS.mw) * 100)).toBe(10)
  })
})

describe('tourPlan / stateAt — 정비 장면 뒤에 규모 사다리 장면 3개', () => {
  const plan = tourPlan(16)
  const a = plan.at
  it('back → rack → hall → site → stop 차례로, 장면마다 3초 넘게 머묾', () => {
    expect(a.rack).toBeGreaterThan(a.back + 1)   // 대기 CDU C 가 다 멈춘 뒤
    expect(a.hall - a.rack).toBeGreaterThan(3)
    expect(a.site - a.hall).toBeGreaterThan(3)
    expect(a.stop - a.site).toBeGreaterThan(3)
    expect(plan.len).toBeGreaterThan(a.stop)
  })
  it('각 구간의 단계 이름', () => {
    expect(stateAt(a.restore + 0.1, plan).phase).toBe('restore')
    expect(stateAt(a.rack - 0.1, plan).phase).toBe('restore')
    expect(stateAt(a.rack + 0.1, plan).phase).toBe('rack')
    expect(stateAt(a.hall + 0.1, plan).phase).toBe('hall')
    expect(stateAt(a.site + 0.1, plan).phase).toBe('site')
    expect(stateAt(a.stop + 0.1, plan).phase).toBe('normal')
  })
  it('규모 장면에선 평소 모습: 기온 22 °C · 칠러 꺼짐 · CDU A·B 가동, C 대기 · B 밸브 열림', () => {
    for (const t of [a.rack + 0.1, a.hall + 1, a.site + 1]) {
      const s = stateAt(t, plan)
      expect(s.temp).toBe(22)
      expect(s.chill).toBe(0)
      expect(s.cdu).toEqual([1, 1, 0])
      expect(s.valve).toBe(1)
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
