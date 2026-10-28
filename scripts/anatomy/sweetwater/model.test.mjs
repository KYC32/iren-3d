// =============================================================
// model.test.mjs — 스위트워터 1 그림의 "규모 사다리"(둘러보기 끝: 랙 1대 → 첫 단계 홀 → 스위트워터 1)와 구리 수치 테스트
//   이름표의 숫자와 둘러보기 장면이 이 함수들에서 나오므로, 숫자가 틀리면 그림도 틀림 (npm test 가 함께 돌림)
// =============================================================
import { describe, it, expect } from 'vitest'
import { scaleLadder, RUBIN, COPPER, SOURCES, SITE, tourPlan, stateAt, PHASES } from './model.mjs'
import { GPU_PROFILES } from '../../../src/data/hallEstimate.js'

const vr = GPU_PROFILES.find((p) => p.id === 'vera-rubin')

describe('RUBIN — 사이트의 Vera Rubin 추정 규칙(hallEstimate.js)과 같은 값', () => {
  it('랙 1대 = GPU 72개, GPU 1개당 약 3.0 kW (사이트 추정 규칙을 그대로 가져옴)', () => {
    expect(RUBIN.gpusPerRack).toBe(vr.gpusPerRack)
    expect(RUBIN.kwPerGpu).toBe(vr.kwPerGpu)
  })
  it('랙 전력 범위(업계 추정 190–230 kW)의 가운데 ÷ 72 가 GPU 1개당 전력과 0.2 kW 안에서 맞음', () => {
    const [lo, hi] = RUBIN.rackKw
    expect([lo, hi]).toEqual([190, 230])
    expect(Math.abs((lo + hi) / 2 / RUBIN.gpusPerRack - RUBIN.kwPerGpu)).toBeLessThan(0.2)
  })
})

describe('scaleLadder — 둘러보기 끝 이름표 3장 (이름 + 숫자 2개)', () => {
  const ladder = scaleLadder()
  it('랙 → 첫 단계 홀 → 스위트워터 1 차례', () => {
    expect(ladder.map((s) => s.id)).toEqual(['rack', 'hall', 'site'])
    for (const s of ladder) expect(s.nums).toHaveLength(2)
  })
  it('랙: GPU 72개 · 랙 전력 190–230 kW (추정 표시)', () => {
    const [gpu, kw] = ladder[0].nums
    expect(gpu.value).toBe(72)
    expect(kw.range).toEqual([190, 230])
    expect(kw.basis).toBe('estimate')
    expect(gpu.basis).toBe('nvidia')
  })
  it('첫 단계 홀: IT 200 MW (회사) · GPU ≈ 67,000개 · 랙 ≈ 930대 (IT ÷ 3.0 kW 추정, 사이트 반올림 규칙)', () => {
    const [it, gpu] = ladder[1].nums
    expect(it).toMatchObject({ value: SITE.phase1It, basis: 'company' })
    expect(gpu).toMatchObject({ value: 67000, basis: 'estimate' })
    expect(ladder[1].racks).toBe(930)
  })
  it('스위트워터 1: 계통 연결 1,400 MW · 부지 1,700 에이커 (회사)', () => {
    const [mw, acres] = ladder[2].nums
    expect(mw).toMatchObject({ value: 1400, basis: 'company' })
    expect(acres).toMatchObject({ value: 1700, basis: 'company' })
  })
})

describe('tourPlan / stateAt — 다음 단계 장면 뒤에 규모 사다리 장면 3개', () => {
  const plan = tourPlan(18)
  const a = plan.at
  it('settle → rack → hall → site → stop 차례로, 장면마다 3초 넘게 머묾', () => {
    expect(a.rack).toBeGreaterThan(a.settle + 1.4)   // 다음 단계 흐린 그림이 다 사라진 뒤
    expect(a.hall - a.rack).toBeGreaterThan(3)
    expect(a.site - a.hall).toBeGreaterThan(3)
    expect(a.stop - a.site).toBeGreaterThan(3)
    expect(plan.len).toBeGreaterThan(a.stop)
  })
  it('각 구간의 단계 이름', () => {
    expect(stateAt(a.rack + 0.1, plan).phase).toBe('rack')
    expect(stateAt(a.hall + 0.1, plan).phase).toBe('hall')
    expect(stateAt(a.site + 0.1, plan).phase).toBe('site')
    expect(stateAt(a.stop + 0.1, plan).phase).toBe('normal')
    expect(stateAt(a.settle + 0.1, plan).phase).toBe('settle')
  })
  it('규모 장면에선 다음 단계 흐린 그림이 없고 기온은 평소', () => {
    for (const t of [a.rack + 0.1, a.hall + 1, a.site + 1]) {
      const s = stateAt(t, plan)
      expect(s.future).toBe(0)
      expect(s.temp).toBe(24)
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

describe('COPPER — NVIDIA: 줄 단위 800 V 직류 버스웨이는 415 V 교류 배전보다 구리 45% 적게', () => {
  it('수치와 비교 대상, 출처', () => {
    expect(COPPER).toMatchObject({ cut: 0.45, vsVac: 415, more: 0.85 })
    expect(SOURCES.copper).toMatch(/developer\.nvidia\.com\/blog\/nvidia-800-v-hvdc-architecture/)
    expect(SOURCES.podVideo).toMatch(/x\.com\/NVIDIAAIInfra\/status\/2115129444281037280/)
  })
})
