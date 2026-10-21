// 회사 발표 지표 스키마: "이상/약" 표기, 범위(최소~최대), 보여 줄 자리(KPI 줄 / 계약 탭)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ReportedMetric, Company } from './schema.js'

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

// 회사 본사 위치 (지도 위 본사 카드) — 정해진 칸만 받음
describe('Company.hq', () => {
  const iren = JSON.parse(readFileSync(new URL('../../data/companies.json', import.meta.url), 'utf8')).companies.find((c) => c.id === 'iren')
  const { hq: _ignored, ...company } = iren // 지금 데이터의 hq 는 빼고 시험값을 넣어 봄
  it('Company.hq 는 정해진 칸만', () => {
    const hq = { city_ko: '시드니', city_en: 'Sydney', address: 'x', lat: -33.87, lng: 151.21, source: 'https://www.sec.gov/x' }
    expect(Company.safeParse({ ...company, hq }).success).toBe(true)
    expect(Company.safeParse({ ...company, hq: { ...hq, phone: '1' } }).success).toBe(false)
  })
  // 본사 3D 화면의 건물: 층수(소유사 자료)와 회사가 쓰는 층(10-K 주소), 출처 — 쓰는 층은 건물 층수 안이어야
  it('Company.hq.building: 층수·쓰는 층·출처, 쓰는 층이 층수를 넘으면 거부', () => {
    const hq = { city_ko: '시드니', city_en: 'Sydney', address: 'x', lat: -33.87, lng: 151.21, source: 'https://www.sec.gov/x' }
    const building = { floors: 20, level: 5, source: 'https://www.mirvac.com/x' }
    expect(Company.safeParse({ ...company, hq: { ...hq, building } }).success).toBe(true)
    expect(Company.safeParse({ ...company, hq: { ...hq, building: { ...building, level: 20 } } }).success).toBe(false)
    expect(Company.safeParse({ ...company, hq: { ...hq, building: { ...building, floors: 0 } } }).success).toBe(false)
  })
  it('지금 데이터의 본사 건물: 20층 · IREN 5층 (주소 Level 5 와 같음)', () => {
    expect(iren.hq.building).toMatchObject({ floors: 20, level: 5 })
    expect(iren.hq.address).toMatch(/^Level 5,/)
  })
})
