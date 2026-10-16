// 회사 발표 지표 스키마: "이상/약" 표기, 범위(최소~최대), 보여 줄 자리(KPI 줄 / 계약 탭)
import { describe, it, expect } from 'vitest'
import { ReportedMetric } from './schema.js'

const base = { key: 'prepay', value: 45, unit: '%', label_ko: '선급금', label_en: 'Prepayments', as_of: '2026-08', source: 'https://example.com/pr' }

describe('ReportedMetric', () => {
  it('범위·표기·보여 줄 자리를 받음', () => {
    expect(ReportedMetric.safeParse({ ...base, value_max: 55, qualifier: 'about', show: 'contracts' }).success).toBe(true)
  })
  it('최대가 최소보다 작은 범위는 거부', () => {
    expect(ReportedMetric.safeParse({ ...base, value_max: 40 }).success).toBe(false)
  })
  it('정해지지 않은 표기·자리는 거부', () => {
    expect(ReportedMetric.safeParse({ ...base, qualifier: 'maybe' }).success).toBe(false)
    expect(ReportedMetric.safeParse({ ...base, show: 'footer' }).success).toBe(false)
  })
})
