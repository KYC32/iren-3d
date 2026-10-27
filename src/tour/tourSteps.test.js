import { describe, it, expect } from 'vitest'
import { buildTourSteps, tourSeconds } from './tourSteps.js'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from '../data/view.js'

const raw = buildInfra()
const data = viewInfra(raw, asOfMonth(raw.as_of))

describe('자동 투어 대본 (buildTourSteps)', () => {
  it('지도 → 차일드레스 3D → 계약·건물 → 밤 → 스위트워터 → 캐나다 → 확장 → 본사 → 전망 → 마무리 순서', () => {
    const ids = buildTourSteps(data, 'ko').map((s) => s.id)
    expect(ids).toEqual(['intro', 'childress-map', 'childress-3d', 'childress-microsoft', 'childress-horizon-1', 'childress-nvidia', 'childress-night',
      'sweetwater-map', 'sweetwater-3d', 'bc-map', 'expansion-map', 'hq', 'outlook', 'outro'])
  })
  // 본사 단계: 시드니 본사 3D 화면(view 'hq')에서 옥상 위 CEO 카드의 약속 성적표를 소개 — 캠퍼스가 아니라 사이트 id 없음
  it('본사 단계는 본사 3D 화면으로 가고, 성적표 막대 색(타임라인과 같은 색)을 설명', () => {
    const hq = buildTourSteps(data, 'ko').find((s) => s.id === 'hq')
    expect(hq.view).toBe('hq')
    expect(hq.site).toBeUndefined()
    expect(hq.title).toContain('시드니')
    expect(hq.text).toMatch(/초록.*주황/)
    expect(buildTourSteps(data, 'en').find((s) => s.id === 'hq').title).toContain('Sydney')
  })
  it('본사 자료가 없는 회사면 본사 단계를 뺌', () => {
    const noHq = { ...data, companies: data.companies.map(({ hq: _drop, ...c }) => c) }
    expect(buildTourSteps(noHq, 'ko').some((s) => s.id === 'hq')).toBe(false)
  })
  it('모든 단계에 제목·자막·길이가 있고, 3D 단계는 사이트가 있음', () => {
    for (const s of buildTourSteps(data, 'en')) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.text.length).toBeGreaterThan(20)
      expect(s.dur).toBeGreaterThanOrEqual(5000)
      if (s.surface === '3d') expect(data.sites.some((x) => x.id === s.site)).toBe(true)
    }
  })
  it('자막 숫자는 데이터에서 계산 (확보 전력 5.6 GW, Microsoft 매출 단계 25%, 전망 2027 1.1 GW)', () => {
    const steps = buildTourSteps(data, 'ko')
    expect(steps[0].text).toContain('5.6 GW')
    expect(steps.find((s) => s.id === 'childress-microsoft').text).toContain('25%')
    const outlook = steps.find((s) => s.id === 'outlook')
    expect(outlook.text).toContain('2027 1.1 GW')
    expect(outlook.month).toBe(2028 * 12 + 11) // 성장 경로의 마지막 연말(2028-12)로 타임라인을 옮김
    // 지도 화면엔 KPI 판·타임라인이 없으므로 전망 단계는 사업 현황 페이지에서 보여 줌
    expect(outlook.page).toBe('portfolio')
    expect(outlook.text).not.toContain('타임라인을')
  })
  it('전체 길이는 약 90초, 밤 단계는 하늘을 밤으로', () => {
    const steps = buildTourSteps(data, 'ko')
    expect(tourSeconds(steps)).toBeGreaterThan(70)
    expect(tourSeconds(steps)).toBeLessThan(110)
    expect(steps.find((s) => s.id === 'childress-night').sky).toBe('night')
  })
})
