// 지역 규제(데이터센터 유예·제한) 계산 시험 — 순수 함수 + 실제 데이터 파일
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { haversineKm, statusOf, restrictionsFor } from './restrictions.js'
import { RestrictionsFile } from './schema.js'

describe('haversineKm', () => {
  it('위도 1도 ≈ 111km, 같은 점은 0', () => {
    expect(haversineKm(30, -100, 31, -100)).toBeCloseTo(111.2, 0)
    expect(haversineKm(30, -100, 30, -100)).toBe(0)
  })
})

describe('statusOf', () => {
  it('원문 상태 문장 → 유효 / 철회 / 모름', () => {
    expect(statusOf('Active as of 2026-07-31')).toBe('active')
    expect(statusOf('Rescinded. Following a $100 million federal lawsuit …')).toBe('rescinded')
    expect(statusOf('Expired 2025-12-31')).toBe('expired')
    expect(statusOf('Reported adopted per news')).toBe('unknown')
    // 부정문 속 낱말에 속지 않게 (실제로 걸린 경우: Seminole Nation 은 유효인데 'rescinding' 때문에 철회로 읽었음)
    expect(statusOf('Active per Native News Online; no captured Tribal Council action rescinding or amending the resolution')).toBe('active')
    expect(statusOf('Active, as amended. On 2026-05-19, City Council voted to amend …')).toBe('active')
    expect(statusOf('Extended through 2027-03-31')).toBe('active')
    expect(statusOf('Replaced by permanent zoning ordinance on 2026-02-10')).toBe('replaced')
    expect(statusOf('')).toBe('unknown')
  })
})

describe('restrictionsFor', () => {
  // 시험용 조치 3건: 같은 카운티 1, 같은 주 다른 카운티 1(2025년), 다른 주 1
  const rows = [
    { id: 'm1', jurisdiction: 'Town A', type: 'City', state: 'TX', county: 'Fisher County', county_fips: '48151', date: '2026-05-12', lat: 32.8, lng: -100.3, status: 'active' },
    { id: 'm2', jurisdiction: 'Hill County', type: 'County', state: 'TX', county: 'Hill County', county_fips: '48217', date: '2025-03-01', lat: 31.99, lng: -97.13, status: 'rescinded' },
    { id: 'm3', jurisdiction: 'Tulsa', type: 'City', state: 'OK', county: 'Tulsa County', county_fips: '40143', date: '2026-03-25', lat: 36.15, lng: -95.99, status: 'active' },
  ]
  const site = { site: 'sweetwater-2', lat: 32.93, lng: -100.22, state: 'TX', county: 'Fisher County', county_fips: '48151' }
  it('같은 카운티·같은 주 수와 그해 수, 가장 가까운 조치', () => {
    const r = restrictionsFor(site, rows, { year: 2026 })
    expect(r).toMatchObject({ county_count: 1, state_count: 2, state_count_year: 1, year: 2026 })
    expect(r.nearest).toMatchObject({ jurisdiction: 'Town A', status: 'active', date: '2026-05-12' })
    expect(r.nearest.km).toBeGreaterThan(10)
    expect(r.nearest.km).toBeLessThan(20)
  })
  it('그 주에 조치가 없으면 가장 가까운 조치는 null (다른 주 조치는 세지 않음)', () => {
    const r = restrictionsFor({ ...site, state: 'NM', county: 'X', county_fips: '35001' }, rows, { year: 2026 })
    expect(r).toMatchObject({ county_count: 0, state_count: 0, state_count_year: 0, nearest: null })
  })
})

describe('data/restrictions.json', () => {
  const file = JSON.parse(readFileSync(new URL('../../data/restrictions.json', import.meta.url), 'utf8'))
  it('스키마를 통과하고 미국 IREN 부지 4곳이 모두 있음', () => {
    expect(RestrictionsFile.safeParse(file).success).toBe(true)
    expect(file.sites.map((s) => s.site).sort()).toEqual(['childress', 'kiowa', 'sweetwater-1', 'sweetwater-2'])
  })
  it('출처 표기(CC BY 4.0)와 고정한 판 주소가 있음', () => {
    expect(file.source.license).toBe('CC-BY-4.0')
    expect(file.source.url).toMatch(/\/tree\/[0-9a-f]{40}\//)
  })
})
