// analysts.js (주가 페이지 증권사 투자의견 칸) 시험
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ratingBucket, parseNasdaqConsensus, firmRows, firmCounts, upsidePct, rangeOf, rangePos, missingCoverage, nextEarnings } from './analysts.js'
import { validateAnalysts } from './analystsSchema.js'

const firm = (o) => ({ firm: 'A', date: '2026-10-30', action: 'reiterated', rating: 'Buy', ...o })
const file = {
  checked: '2026-10-31',
  consensus: { source: { name: 'Nasdaq', url: 'https://www.nasdaq.com/market-activity/stocks/iren/analyst-research' }, fetched_at: '2026-10-31T00:00:00.000Z', mean_rating: 'Buy', low: 40, high: 100, mean: 77.78, buy: 8, hold: 2, sell: 0 },
  firms_source: { name: 'MarketBeat', url: 'https://www.marketbeat.com/stocks/NASDAQ/IREN/forecast/' },
  coverage: { checked: '2026-10-31', source: 'https://iren.com/investors/analysts', firms: ['B Riley', 'Goldman Sachs', 'China Construction Bank'] },
  earnings: { date: '2026-11-05', revenue_usd: 229810000, source_name: 'MarketBeat', source: 'https://www.marketbeat.com/earnings/reports/2026-11-5-iris-energy-ltd-stock/' },
  firms: [
    firm({ firm: 'Goldman Sachs', ir_name: 'Goldman Sachs', date: '2026-07-20', rating: 'Neutral' }),
    firm({ firm: 'B. Riley', ir_name: 'B Riley', action: 'target-down', target: 64, target_prev: 91 }),
    firm({ firm: 'Jones', date: '2025-09-02', action: 'downgrade', rating: 'Hold', rating_prev: 'Buy' }),
    firm({ firm: 'Citizens', date: '2025-11-19', action: 'target-set', rating: null, target: 80 }),
  ],
}

describe('ratingBucket (증권사마다 다른 표현 → 매수·보유·매도)', () => {
  it.each([['Buy', 'buy'], ['Strong-Buy', 'buy'], ['Outperform', 'buy'], ['Market Outperform', 'buy'], ['Overweight', 'buy'],
    ['Hold', 'hold'], ['Neutral', 'hold'], ['Underweight', 'sell'], ['Sell', 'sell'], ['Underperform', 'sell']])('%s → %s', (r, b) => {
    expect(ratingBucket(r)).toBe(b)
  })
  it('의견이 없으면 null', () => { expect(ratingBucket(null)).toBeNull() })
  it('모르는 표현은 null (매수로 짐작하지 않음)', () => { expect(ratingBucket('Accumulate-ish')).toBeNull() })
})

describe('parseNasdaqConsensus', () => {
  const json = { data: { consensusOverview: { lowPriceTarget: 40, highPriceTarget: 100, priceTarget: 77.78, buy: 8, sell: 0, hold: 2 } } }
  it('목표가·의견 수를 꺼냄', () => {
    expect(parseNasdaqConsensus(json, { data: { meanRatingType: 'Buy' } })).toEqual({ mean_rating: 'Buy', low: 40, high: 100, mean: 77.78, buy: 8, hold: 2, sell: 0 })
  })
  it('형식이 바뀌면 오류 (기존 파일을 지키려고)', () => {
    expect(() => parseNasdaqConsensus({ data: {} }, null)).toThrow()
    expect(() => parseNasdaqConsensus({ data: { consensusOverview: { priceTarget: null } } }, null)).toThrow()
  })
})

describe('firmRows', () => {
  const rows = firmRows(file, 23.95)
  it('최근 날짜부터', () => { expect(rows.map((r) => r.firm)).toEqual(['B. Riley', 'Goldman Sachs', 'Citizens', 'Jones']) })
  it('목표가가 있으면 현재가 대비 %', () => { expect(rows[0].upside).toBeCloseTo(167.2, 1) })
  it('목표가가 없으면 null', () => { expect(rows[1].upside).toBeNull() })
  it('확인일 기준 1년 넘은 의견은 stale', () => {
    expect(rows.find((r) => r.firm === 'Jones').stale).toBe(true)
    expect(rows.find((r) => r.firm === 'Citizens').stale).toBe(false)
  })
})

it('firmCounts: 의견 없는 곳은 따로 셈', () => {
  expect(firmCounts(firmRows(file, 24))).toEqual({ buy: 1, hold: 2, sell: 0, none: 1 })
})

describe('upsidePct', () => {
  it('목표가 $48, 현재가 $24 → +100%', () => { expect(upsidePct(48, 24)).toBe(100) })
  it('현재가가 없으면 null', () => { expect(upsidePct(48, null)).toBeNull() })
})

describe('rangeOf · rangePos (목표가 막대)', () => {
  it('현재가가 최저 목표가보다 낮으면 막대를 현재가까지 넓힘', () => { expect(rangeOf(40, 100, 24)).toEqual({ lo: 24, hi: 100 }) })
  it('현재가가 범위 안이면 그대로', () => { expect(rangeOf(40, 100, 60)).toEqual({ lo: 40, hi: 100 }) })
  it('막대 위 자리 0..100, 넘치면 묶음', () => {
    expect(rangePos(50, 0, 100)).toBe(50)
    expect(rangePos(-5, 0, 100)).toBe(0)
    expect(rangePos(150, 0, 100)).toBe(100)
  })
  it('최저 = 최고여도 깨지지 않음', () => { expect(rangePos(5, 5, 5)).toBe(50) })
})

it('missingCoverage: 회사 명단에 있는데 표에 없는 곳', () => {
  expect(missingCoverage(file)).toEqual(['China Construction Bank'])
})

describe('nextEarnings', () => {
  it('실적 날짜 전이면 보임', () => { expect(nextEarnings(file, '2026-11-05')?.revenue_usd).toBe(229810000) })
  it('지나면 숨김 (옛 예상치가 남지 않게)', () => { expect(nextEarnings(file, '2026-11-06')).toBeNull() })
})

describe('validateAnalysts', () => {
  it('정상 파일은 오류 없음', () => { expect(validateAnalysts(file)).toEqual([]) })
  it('모르는 의견 표현은 오류 (표에서 조용히 빠지지 않게)', () => {
    const bad = { ...file, firms: [firm({ rating: 'Accumulate-ish' })] }
    expect(validateAnalysts(bad).join(' ')).toMatch(/Accumulate-ish/)
  })
  it('애널리스트 개인 이름 칸은 받지 않음', () => {
    const bad = { ...file, firms: [firm({ analyst: 'Someone' })] }
    expect(validateAnalysts(bad).length).toBeGreaterThan(0)
  })
})

describe('data/analysts.json (실제 파일)', () => {
  const real = JSON.parse(readFileSync(new URL('../../data/analysts.json', import.meta.url), 'utf8'))
  it('스키마를 통과', () => { expect(validateAnalysts(real)).toEqual([]) })
  it('회사 명단 19곳 중 못 찾은 곳은 China Construction Bank 뿐', () => {
    expect(real.coverage.firms).toHaveLength(19)
    expect(missingCoverage(real)).toEqual(['China Construction Bank'])
  })
})
