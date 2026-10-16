// 주식 수·희석 계산 (src/data/shares.js) — 실제 데이터 파일(data/shares.json)과 작은 예시로 확인
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sharesAt, sharesInterp, dilutionStats, raiseRows, convertRows, mergeXbrlPoints, fmtShares, fmtUsd } from './shares.js'
import { SharesFile } from './sharesSchema.js'

const file = JSON.parse(readFileSync(new URL('../../data/shares.json', import.meta.url), 'utf8'))

describe('data/shares.json', () => {
  it('스키마를 통과하고 날짜 순서대로', () => {
    expect(SharesFile.safeParse(file).success).toBe(true)
    const dates = file.points.map((p) => p.date)
    expect([...dates].sort()).toEqual(dates)
  })
})

const tiny = {
  points: [
    { date: '2021-11-17', shares: 50 }, { date: '2025-08-15', shares: 200 }, { date: '2026-08-14', shares: 300 },
  ],
  raises: [{ id: 'a', shares: 10, gross_usd: 500, limit_usd: 2000 }],
  converts: [{ id: 'c1', principal_usd: 1000, conversion_price_usd: 10 }, { id: 'c2', principal_usd: 900, conversion_price_usd: 30 }],
}

describe('sharesAt (계단: 그날까지 마지막으로 공시된 값)', () => {
  it('공시 사이 날짜는 직전 값, 첫 공시 전은 null', () => {
    expect(sharesAt(tiny.points, '2025-12-31')).toBe(200)
    expect(sharesAt(tiny.points, '2026-08-14')).toBe(300)
    expect(sharesAt(tiny.points, '2020-01-01')).toBeNull()
  })
})

describe('dilutionStats', () => {
  it('최신 주식 수, 상장 직후 대비 배수, 1년 전 대비 증가율, 전환사채 단순 계산', () => {
    const s = dilutionStats(tiny)
    expect(s.latest).toEqual({ date: '2026-08-14', shares: 300 })
    expect(s.sinceIpo).toBeCloseTo(6)          // 300 / 50
    expect(s.yearAgo.date).toBe('2025-08-15')  // 최신 공시 1년 전 무렵의 공시
    expect(s.yoyPct).toBeCloseTo(50)           // 300 / 200 − 1
    expect(s.convertShares).toBeCloseTo(130)   // 1000/10 + 900/30
    expect(s.convertPct).toBeCloseTo(130 / 300 * 100)
  })
})

describe('raiseRows / convertRows', () => {
  it('조달: 주당 평균가와 한도 사용률', () => {
    expect(raiseRows(tiny)[0]).toMatchObject({ avgPrice: 50, usedPct: 25 })
  })
  it('전환사채: 최초 전환가로 전환하면 생길 주식 수', () => {
    expect(convertRows(tiny).map((c) => Math.round(c.shares))).toEqual([100, 30])
  })
})

describe('mergeXbrlPoints (매일 갱신: SEC XBRL 표지 주식 수 덧붙이기)', () => {
  const facts = { facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2026-08-14', val: 300, form: '10-K', accn: '0001878848-26-000052', filed: '2026-08-27' },  // 이미 있음
    { end: '2026-10-30', val: 320, form: '10-Q', accn: '0001878848-26-000099', filed: '2026-11-05' },  // 새 공시
  ] } } } } }
  it('없는 날짜만 덧붙이고, 출처는 SEC 공시 목록 주소', () => {
    const { file: next, added } = mergeXbrlPoints(tiny, facts)
    expect(added).toBe(1)
    expect(next.points.at(-1)).toMatchObject({ date: '2026-10-30', shares: 320, form: '10-Q', auto: true })
    expect(next.points.at(-1).source).toContain('000187884826000099')
    expect(mergeXbrlPoints(next, facts).added).toBe(0) // 두 번 돌려도 그대로
  })
})

describe('fmtShares / fmtUsd (화면 숫자)', () => {
  it('한국어는 억·만, 영어는 M·B', () => {
    expect(fmtShares(394058648, 'ko')).toBe('3.94억')
    expect(fmtShares(54899937, 'ko')).toBe('5,490만')
    expect(fmtShares(394058648, 'en')).toBe('394.1M')
    expect(fmtShares(1250000000, 'en')).toBe('1.25B')
  })
  it('금액은 $bn·$m', () => {
    expect(fmtUsd(2492057000)).toBe('$2.49bn')
    expect(fmtUsd(771438000)).toBe('$771m')
    expect(fmtUsd(999999452)).toBe('$1.00bn')
  })
})

describe('sharesInterp (차트: 공시 사이는 직선으로 이음)', () => {
  it('두 공시 사이는 날짜 비율대로, 마지막 공시 뒤는 그 값, 첫 공시 전은 null', () => {
    const pts = [{ date: '2024-01-01', shares: 100 }, { date: '2024-01-11', shares: 200 }]
    expect(sharesInterp(pts, '2024-01-06')).toBeCloseTo(150)
    expect(sharesInterp(pts, '2024-02-01')).toBe(200)
    expect(sharesInterp(pts, '2023-12-31')).toBeNull()
  })
})
