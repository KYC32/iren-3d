// timeline.js 단위 테스트 — 실행: npm test
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth, monthKey, monthLabel, phaseMonth, statusAt, progressAt, grossOf, powerAt, siteStatusAt, siteMetricsAt, companyRanking, totalsAt } from './timeline.js'
import { asOfMonth, viewInfra } from './view.js'

const infra = buildInfra()
const M = (s) => toMonth(s)
const src = 'https://example.com'

describe('toMonth / monthKey', () => {
  it('여러 날짜 형식을 월 번호로', () => {
    expect(monthKey(M('2026'))).toBe('2026-01')
    expect(monthKey(toMonth('2026', 'end'))).toBe('2026-12')
    expect(monthKey(M('2026-Q4'))).toBe('2026-10')
    expect(monthKey(toMonth('2026-Q4', 'end'))).toBe('2026-12')
    expect(monthKey(toMonth('2026-H1', 'end'))).toBe('2026-06')
    expect(monthKey(M('2026-H2'))).toBe('2026-07')
    expect(monthKey(M('2026-08-13'))).toBe('2026-08')
  })
  it('잘못된 형식은 오류', () => {
    expect(() => toMonth('2026/08')).toThrow()
  })
  it('표시용 라벨', () => {
    expect(monthLabel(M('2027-06'), 'ko')).toBe('2027년 6월')
    expect(monthLabel(M('2027-06'), 'en')).toBe('Jun 2027')
  })
})

describe('statusAt / phaseMonth', () => {
  const b = {
    phases: [
      { status: 'under_construction', from: '2025-02', basis: 'reported', source: src },
      { status: 'operating', from: '2026-Q4', basis: 'target', source: src }, // 목표는 기간 끝(12월)으로
    ],
  }
  it('첫 단계 전에는 null', () => expect(statusAt(b, M('2025-01'))).toBeNull())
  it('단계 시작 당일부터 그 상태', () => expect(statusAt(b, M('2025-02'))).toBe('under_construction'))
  it('목표 단계는 기간의 끝 달부터', () => {
    expect(phaseMonth(b.phases[1])).toBe(toMonth('2026-12'))
    expect(statusAt(b, M('2026-11'))).toBe('under_construction')
    expect(statusAt(b, M('2026-12'))).toBe('operating')
  })
  it('진행률은 시작 0 → 다음 단계 1 사이에서 증가', () => {
    const p1 = progressAt(b, M('2025-06'))
    const p2 = progressAt(b, M('2026-06'))
    expect(p1).toBeGreaterThan(0)
    expect(p2).toBeGreaterThan(p1)
    expect(progressAt(b, M('2026-12'))).toBe(1)
  })
  it('기준일 진행률을 통과하도록 보간', () => {
    const withP = { ...b, progress: 0.8 }
    expect(progressAt(withP, M('2026-10'), M('2026-10'))).toBeCloseTo(0.8)
  })
  it('gross 가 없으면 IT×1.3 추정', () => {
    expect(grossOf({ it_mw: 100 })).toEqual({ mw: 130, estimated: true })
  })
})

describe('실제 데이터 (IREN)', () => {
  const asOf = asOfMonth(infra.as_of)

  const IREN = { companies: new Set(['iren']) } // 다른 회사가 병합돼도 IREN 수치만 비교
  // 2026-10-07 IREN BC 3곳 채굴 이력 보정(사용자 승인) 반영: 커낼플랫츠는 2026-10 기준 AI 홀이 아직 계획 단계
  it('기준일 IREN KPI (iren-3d 대비 BC 보정 반영: AI 155→125MW)', () => {
    const t = totalsAt(infra, toMonth('2026-10'), IREN)
    expect(t.secured).toBe(5610)
    expect(t.energized).toBe(2310)
    expect(t.operating).toBe(505)
    expect(t.ai).toBe(125)
    expect(t.mining).toBe(380)
    expect(t.building).toBe(665)
    expect(t.planned).toBe(4440)
    expect(t.gpus).toBe(23000)
  })

  it('채굴동은 폐쇄 전(가동 단계)에도 AI 가동이 아닌 채굴로 집계', () => {
    const t = totalsAt(infra, M('2026-09'), IREN)
    expect(t.ai).toBe(125)
    expect(t.mining).toBe(410) // Childress 380 + 커낼플랫츠 30 (채굴 종료 2026-10)
  })

  it('기준일 사이트 상태가 원본 설명과 일치', () => {
    const st = Object.fromEntries(infra.sites.map((s) => [s.id, siteStatusAt(s, asOf)]))
    expect(st.childress).toBe('operating')
    expect(st['sweetwater-1']).toBe('under_construction')
    expect(st['sweetwater-2']).toBe('planned')
    expect(st['prince-george']).toBe('operating')
    expect(st.kiowa).toBe('planned')
  })

  it('발표 전에는 사이트가 없음 (Bundey 2026-06 발표)', () => {
    const bundey = infra.sites.find((s) => s.id === 'bundey')
    expect(powerAt(bundey, M('2026-05'))).toBeNull()
    expect(powerAt(bundey, M('2026-06'))).not.toBeNull()
  })

  it('2024-01 ~ 2028-12 매달: 가동+건설+계획 ≤ 확보 전력', () => {
    for (let m = M('2024-01'); m <= M('2028-12'); m++) {
      for (const s of infra.sites) {
        const x = siteMetricsAt(s, m)
        expect(x.operating + x.building + x.planned).toBeLessThanOrEqual(x.secured * 1.05 + 1e-6)
      }
    }
  })

  it('primary 렌즈 순위 합계 = 전체 합계', () => {
    for (const m of [M('2025-01'), asOf, M('2028-12')]) {
      const rank = companyRanking(infra, m)
      const t = totalsAt(infra, m)
      expect(rank.reduce((n, r) => n + r.secured, 0)).toBe(t.secured)
    }
  })

  it('채굴동은 2026-12 목표에 retired → 2027 년에는 사라짐', () => {
    const c = infra.sites.find((s) => s.id === 'childress')
    const miners = c.buildings.find((b) => b.id === 'miners')
    expect(statusAt(miners, M('2026-11'))).toBe('decommissioning')
    expect(statusAt(miners, M('2027-01'))).toBe('retired')
  })

  it('부분 전환: 매켄지 공랭 80MW 중 액체냉각 50MW 가동 후 공랭은 30MW 로', () => {
    const mk = infra.sites.find((s) => s.id === 'mackenzie')
    const x = siteMetricsAt(mk, M('2028-06'))
    expect(x.ai).toBe(80) // 공랭 30 + 액체냉각 50
    const pg = infra.sites.find((s) => s.id === 'prince-george')
    expect(siteMetricsAt(pg, M('2028-06')).ai).toBe(50) // 완전 전환 → 공랭 홀 사라짐
  })

  it('viewInfra: 기준일 IREN 사이트는 9곳, 발표 전 날짜에는 줄어듦', () => {
    const iren = (m) => viewInfra(infra, m).sites.filter((s) => s.primary === 'iren')
    expect(iren(asOf)).toHaveLength(9)
    expect(iren(M('2024-01')).length).toBeLessThan(9)
  })
})
