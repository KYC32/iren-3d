import { describe, it, expect } from 'vitest'
import { parseNasdaqRows, mergeRows, toSeries, sliceRange, yScale, linePath, areaPath, priceTicks, dateTicks, xForDate, nearestIndex, stats, eventsForChart, markerColor } from './stock.js'

const nasdaq = [
  { date: '10/12/2026', close: '$34.80', volume: '49,659,280', open: '$36.305', high: '$36.6941', low: '$34.655' },
  { date: '11/17/2021', close: '$24.45', volume: '5,815,310', open: '$28.00', high: '$28.25', low: '$21.46' },
  { date: '11/18/2021', close: 'N/A', volume: 'N/A', open: 'N/A', high: 'N/A', low: 'N/A' }, // 값 없는 행은 버림
]

describe('Nasdaq 행 파싱·병합', () => {
  it('달러·콤마·미국식 날짜를 숫자·ISO 로 바꾸고 오름차순 정렬', () => {
    expect(parseNasdaqRows(nasdaq)).toEqual([
      ['2021-11-17', 28, 28.25, 21.46, 24.45, 5815310],
      ['2026-10-12', 36.305, 36.6941, 34.655, 34.8, 49659280],
    ])
  })
  it('같은 날짜는 새 값으로 덮어쓰고 정렬 유지', () => {
    const merged = mergeRows([['2026-10-10', 1, 1, 1, 1, 1], ['2026-10-12', 2, 2, 2, 2, 2]], [['2026-10-12', 3, 3, 3, 3, 3], ['2026-10-13', 4, 4, 4, 4, 4]])
    expect(merged.map((r) => `${r[0]}:${r[4]}`)).toEqual(['2026-10-10:1', '2026-10-12:3', '2026-10-13:4'])
  })
})

// 2025-01-02 부터 평일만 400일치 가짜 시계열 (가격 = 10 + 일수 × 0.1)
const fake = (() => {
  const out = []
  const d = new Date('2025-01-02T00:00:00Z')
  for (let i = 0; out.length < 400; i++) {
    const day = new Date(d.getTime() + i * 86400000)
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue
    const c = 10 + out.length * 0.1
    out.push({ date: day.toISOString().slice(0, 10), open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 1000 })
  }
  return out
})()

describe('구간·좌표', () => {
  it('1M·6M·1Y 는 마지막 날짜 기준 달력 개월, ALL 은 전체', () => {
    const last = fake.at(-1).date
    expect(sliceRange(fake, 'ALL')).toHaveLength(400)
    const m1 = sliceRange(fake, '1M')
    expect(m1.at(-1).date).toBe(last)
    expect(m1.length).toBeGreaterThan(18); expect(m1.length).toBeLessThan(25)
    expect(sliceRange(fake, '1Y').length).toBeGreaterThan(250)
  })
  it('yScale 은 큰 값일수록 위(작은 y), 로그도 단조', () => {
    const lin = yScale(10, 50, 100), log = yScale(10, 50, 100, { log: true })
    expect(lin(50)).toBeLessThan(lin(10)); expect(log(50)).toBeLessThan(log(10))
    expect(lin(10)).toBeLessThanOrEqual(100); expect(lin(50)).toBeGreaterThanOrEqual(0)
  })
  it('linePath / areaPath 형식', () => {
    expect(linePath([[0, 10], [5.26, 3.14]])).toBe('M0 10L5.3 3.1')
    expect(areaPath([[0, 10], [5, 3]], 20)).toBe('M0 10L5 3L5 20L0 20Z')
  })
  it('가격 눈금은 1·2·5 단위, 로그는 2배', () => {
    expect(priceTicks(12, 78)).toEqual([20, 40, 60])
    expect(priceTicks(2, 40, { log: true })).toEqual([2, 4, 8, 16, 32])
  })
  it('날짜 눈금 단위: 긴 구간은 연, 중간은 월, 짧으면 주', () => {
    expect(dateTicks(fake).map((t) => t.label)).toEqual(['4월', '7월', '10월', '2026', '4월', '7월']) // 약 1.6년 → 분기 단위, 연초는 연도
    const years = fake.concat(fake.map((p) => ({ ...p, date: p.date.replace(/^2025/, '2023').replace(/^2026/, '2024') }))).sort((a, b) => (a.date < b.date ? -1 : 1))
    expect(dateTicks(years).map((t) => t.label)).toEqual(['2024', '2025', '2026']) // 3년 이상 → 연 단위
    const months = dateTicks(sliceRange(fake, '6M'))
    expect(months.length).toBeGreaterThanOrEqual(5)
    expect(dateTicks(sliceRange(fake, '1M'))[0].label).toMatch(/^\d{1,2}\/\d{1,2}$/)
  })
  it('xForDate 는 시간 비례, nearestIndex 는 휴장일이면 직전 거래일', () => {
    expect(xForDate('2025-01-02', '2025-01-01', '2025-01-03', 100)).toBe(50)
    const sat = '2025-01-04', fri = '2025-01-03'
    expect(fake[nearestIndex(fake, sat)].date).toBe(fri)
    expect(nearestIndex(fake, '2020-01-01')).toBe(0)
    expect(nearestIndex(fake, '2030-01-01')).toBe(399)
  })
})

describe('통계', () => {
  it('현재가·전일 대비·상장가 대비·최고가·최대 낙폭', () => {
    const s = [
      { date: '2024-01-02', open: 10, high: 11, low: 9, close: 10, volume: 1 },
      { date: '2024-01-03', open: 10, high: 21, low: 9, close: 20, volume: 1 },
      { date: '2024-01-04', open: 10, high: 11, low: 4, close: 5, volume: 1 },
      { date: '2024-01-05', open: 10, high: 15, low: 9, close: 14, volume: 1 },
      { date: '2024-01-08', open: 10, high: 15, low: 9, close: 19, volume: 1 }, // 나중의 새 고점은 낙폭 시작일을 바꾸지 않음
    ]
    const st = stats(s, 28)
    expect(st.last).toBe(19); expect(st.chg).toBe(5); expect(st.chgPct).toBeCloseTo(35.714)
    expect(st.vsIpoPct).toBeCloseTo(-32.143)
    // 52주 최고·최저도 차트·사상 최고·최대 낙폭처럼 종가 기준 (장중 고가 21·저가 4 가 아님) + 그 날짜
    expect(st.high52).toEqual({ price: 20, date: '2024-01-03' }); expect(st.low52).toEqual({ price: 5, date: '2024-01-04' })
    expect(st.ath).toEqual({ price: 20, date: '2024-01-03' })
    expect(st.maxDrawdownPct).toBeCloseTo(-75); expect(st.drawdownFrom).toBe('2024-01-03'); expect(st.drawdownTo).toBe('2024-01-04')
  })
  it('52주 최고는 사상 최고를 넘지 않음 (같은 날 장중 고가가 종가보다 높아도)', () => {
    // 실제 사례: 2025-11-05 장중 $76.87 · 종가 $76.41 → 예전엔 "52주 최고 76.87 > 사상 최고 76.41" 로 보였음
    const s = [
      { date: '2025-11-05', open: 70, high: 76.87, low: 69, close: 76.41, volume: 1 },
      { date: '2026-10-14', open: 33, high: 33.85, low: 30.38, close: 30.56, volume: 1 },
    ]
    const st = stats(s, 28)
    expect(st.high52.price).toBe(76.41)
    expect(st.high52.price).toBeLessThanOrEqual(st.ath.price)
  })
})

describe('사건 마커', () => {
  it('발표 기준 + 일·월 정밀도만, 월은 15일에 놓고 precision 표시', () => {
    const events = [
      { id: 'a', kind: 'contract', when: '2025-11-03', basis: 'reported', title_ko: 'MS', title_en: 'MS', source: 'u' },
      { id: 'b', kind: 'power', when: '2026-05', basis: 'reported', title_ko: '통전', title_en: 'energized', source: 'u' },
      { id: 'c', kind: 'phase', when: '2026-Q4', basis: 'reported', title_ko: 'q', title_en: 'q', source: 'u' },
      { id: 'd', kind: 'phase', when: '2026-12-01', basis: 'target', title_ko: 't', title_en: 't', source: 'u' },
    ]
    expect(eventsForChart(events)).toEqual([
      { id: 'a', date: '2025-11-03', precision: 'day', kind: 'contract', title_ko: 'MS', title_en: 'MS', source: 'u', siteId: null },
      { id: 'b', date: '2026-05-15', precision: 'month', kind: 'power', title_ko: '통전', title_en: 'energized', source: 'u', siteId: null },
    ])
    expect(markerColor('contract')).toBe('#2f6bed'); expect(markerColor('news')).toBe('#8a93ab')
  })
  it('toSeries 는 열 순서대로 객체로', () => {
    expect(toSeries({ rows: [['2024-01-02', 1, 2, 0.5, 1.5, 9]] })).toEqual([{ date: '2024-01-02', open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 }])
  })
})
