// market.js (주가 페이지 하락 구간·동종 비교·공매도·실적 칸) 시험
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { recentPeak, moveRows, returnFrom, peerBars, parsePeerRows, parseShortRows, mergeShort, shortView, parseEarnings } from './market.js'
import { validateMoves } from './marketSchema.js'

const s = (rows) => rows.map(([date, close]) => ({ date, close }))
const series = s([['2026-09-18', 40], ['2026-09-21', 50], ['2026-09-22', 45], ['2026-09-23', 44], ['2026-09-24', 40], ['2026-09-25', 41]])

describe('recentPeak (최근 구간의 최고 종가)', () => {
  it('지정한 거래일 수 안에서 가장 높은 종가를 고름', () => {
    expect(recentPeak(series, 6)).toMatchObject({ date: '2026-09-21', close: 50 })
  })
  it('구간을 줄이면 그 안에서만 찾음', () => {
    expect(recentPeak(series, 2)).toMatchObject({ date: '2026-09-25', close: 41 })
  })
  it('자료가 없으면 null', () => { expect(recentPeak([], 5)).toBeNull() })
})

describe('moveRows (큰 변동일 + 까닭을 적은 날)', () => {
  const notes = [{ date: '2026-09-23', scope: 'sector', ko: '가', en: 'a', source: 'https://x.test/a', source_name: 'A' }]
  it('기준 넘는 날과 까닭 있는 날만, 최신 먼저', () => {
    const r = moveRows(series, notes, { from: '2026-09-21', threshold: 6 })
    expect(r.map((x) => x.date)).toEqual(['2026-09-24', '2026-09-23', '2026-09-22', '2026-09-21'])
  })
  it('등락률은 전날 종가 대비', () => {
    const r = moveRows(series, notes, { from: '2026-09-21', threshold: 6 })
    expect(r.at(-1).pct).toBeCloseTo(25)
    expect(r[1].note.ko).toBe('가')
  })
  it('기준을 넘어도 까닭이 없으면 note 는 null (지어내지 않음)', () => {
    expect(moveRows(series, notes, { from: '2026-09-21', threshold: 6 })[0].note).toBeNull()
  })
  it('시작일 앞의 날은 넣지 않음', () => {
    expect(moveRows(series, notes, { from: '2026-09-24', threshold: 6 }).map((x) => x.date)).toEqual(['2026-09-24'])
  })
})

describe('returnFrom·peerBars (같은 기간 수익률 비교)', () => {
  const rows = [['2026-09-18', 10], ['2026-09-22', 20], ['2026-10-30', 15]]
  it('시작일이 휴장이면 그 뒤 첫 거래일 기준', () => { expect(returnFrom(rows, '2026-09-19')).toBeCloseTo(-25) })
  it('시작일 뒤 자료가 없으면 null', () => { expect(returnFrom(rows, '2026-11-01')).toBeNull() })
  it('IREN 을 포함해 낮은 수익률 먼저 정렬', () => {
    const peers = { symbols: [{ symbol: 'AAA', name: 'A', rows }, { symbol: 'BBB', name: 'B', rows: [['2026-09-22', 10], ['2026-10-30', 30]] }] }
    const b = peerBars(peers, s(rows), '2026-09-22')
    expect(b.map((x) => x.symbol)).toEqual(['AAA', 'IREN', 'BBB'])
    expect(b.find((x) => x.symbol === 'IREN').isIren).toBe(true)
  })
  it('자료가 빈 회사는 뺌', () => {
    const b = peerBars({ symbols: [{ symbol: 'AAA', name: 'A', rows: [] }] }, s(rows), '2026-09-22')
    expect(b.map((x) => x.symbol)).toEqual(['IREN'])
  })
  it('Nasdaq 행을 [날짜, 종가]로', () => {
    expect(parsePeerRows([{ date: '10/30/2026', close: '$23.95', volume: '1', open: '1', high: '1', low: '1' }])).toEqual([['2026-10-30', 23.95]])
  })
})

describe('공매도', () => {
  const api = { data: { shortInterestTable: { rows: [
    { settlementDate: '10/15/2026', interest: '94,617,935', avgDailyShareVolume: '51,965,505', daysToCover: 1.820784 },
    { settlementDate: '09/30/2026', interest: '81,653,639', avgDailyShareVolume: '34,982,123', daysToCover: 2.334153 },
  ] } } }
  it('Nasdaq 응답을 오름차순 숫자로', () => {
    const r = parseShortRows(api)
    expect(r[0]).toEqual({ date: '2026-09-30', shares: 81653639, avg_volume: 34982123, days_to_cover: 2.33 })
    expect(r.at(-1).date).toBe('2026-10-15')
  })
  it('형식이 다르면 빈 배열', () => { expect(parseShortRows({ data: null })).toEqual([]) })
  it('기존 행과 합치면 같은 날짜는 새 값', () => {
    const r = mergeShort([{ date: '2026-09-30', shares: 1, avg_volume: 1, days_to_cover: 1 }], parseShortRows(api))
    expect(r).toHaveLength(2)
    expect(r[0].shares).toBe(81653639)
  })
  it('발행 주식 대비 비율과 직전 대비 변화', () => {
    const v = shortView(parseShortRows(api), 394000000)
    expect(v.pctOfShares).toBeCloseTo(24.015, 2)
    expect(v.changePct).toBeCloseTo(15.88, 1)
  })
  it('주식 수를 모르면 비율은 null', () => { expect(shortView(parseShortRows(api), null).pctOfShares).toBeNull() })
  it('자료가 없으면 null', () => { expect(shortView([], 1)).toBeNull() })
})

describe('parseEarnings (Nasdaq EPS 예상·지난 결과)', () => {
  const forecast = { data: { quarterlyForecast: { rows: [{ fiscalEnd: 'Sep 2026', consensusEPSForecast: -0.46, highEPSForecast: -0.29, lowEPSForecast: -0.64, noOfEstimates: 3 }] } } }
  const surprise = { data: { earningsSurpriseTable: { rows: [
    { fiscalQtrEnd: 'Jun 2026', dateReported: '8/27/2026', eps: -0.41, consensusForecast: '-0.5', percentageSurprise: '18' },
    { fiscalQtrEnd: 'Mar 2026', dateReported: '5/7/2026', eps: -0.25, consensusForecast: '-0.18', percentageSurprise: '-38.89' },
  ] } } }
  it('다음 분기 예상과 지난 결과를 숫자로', () => {
    const e = parseEarnings(forecast, surprise)
    expect(e.next).toEqual({ quarter: 'Sep 2026', eps: -0.46, high: -0.29, low: -0.64, estimates: 3 })
    expect(e.history[0]).toEqual({ quarter: 'Jun 2026', date: '2026-08-27', eps: -0.41, forecast: -0.5 })
  })
  it('형식이 다르면 null', () => { expect(parseEarnings({}, {})).toBeNull() })
})

describe('data/stock-moves.json', () => {
  const file = JSON.parse(readFileSync(new URL('../../data/stock-moves.json', import.meta.url), 'utf8'))
  it('스키마를 통과', () => { expect(validateMoves(file)).toEqual([]) })
  it('까닭 문장은 140자 이하 (한글 문구 규칙)', () => {
    for (const n of file.notes) expect(n.ko.length).toBeLessThanOrEqual(140)
  })
  it('스키마가 날짜 겹침을 거절', () => {
    expect(validateMoves({ ...file, notes: [file.notes[0], file.notes[0]] }).length).toBeGreaterThan(0)
  })
})
