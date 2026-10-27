// 본사 로비 위 전광판 글자 (hqTicker.js) — 전일 종가·등락 · 다가오는 실적 발표·주총까지 남은 날
import { it, expect } from 'vitest'
import { lastClose, upcomingEvents, dday, tickerItems } from './hqTicker.js'

const stock = { columns: ['date', 'open', 'high', 'low', 'close', 'volume'], rows: [['2026-10-23', 1, 1, 1, 50, 9], ['2026-10-26', 1, 1, 1, 52.5, 9]] }
const events = [
  { date: '2026-11-05', kind: 'earnings', title_ko: 'Q1 FY27 실적 발표 · 콘퍼런스콜 미국 동부 오후 5시 (한국 11/6 오전 7시)', title_en: 'Q1 FY27 results · conference call 5:00 pm ET', basis: 'reported' },
  { date: '2026-11-24', kind: 'other', title_ko: '2026 정기 주주총회 (온라인, 한국 11/25 오전 6:30) · 자사주 매입 승인 등 안건 6개', title_en: '2026 AGM (virtual, 4:30 pm ET) · 6 proposals', basis: 'reported' },
  { date: '2026-12', kind: 'other', title_ko: '누적 약 0.3GW 인도', title_en: '~0.3 GW delivery', basis: 'target' },
  { date: '2026-10-01', kind: 'other', title_ko: '지난 일', title_en: 'past', basis: 'reported' },
]

it('lastClose: 마지막 두 거래일 종가로 등락률', () => {
  expect(lastClose(stock)).toEqual({ date: '2026-10-26', close: 52.5, prev: 50, pct: 5 })
  expect(lastClose({ columns: stock.columns, rows: [] })).toBeNull()
})
it('dday: 날짜 차이(일) — 같은 날 0', () => {
  expect(dday('2026-11-05', '2026-10-27')).toBe(9)
  expect(dday('2026-10-27', '2026-10-27')).toBe(0)
})
it('upcomingEvents: 오늘 이후·날짜가 일까지 있는·회사가 발표한(reported) 일정만, 가까운 순', () => {
  expect(upcomingEvents(events, '2026-10-27').map((e) => e.date)).toEqual(['2026-11-05', '2026-11-24'])
})
it('tickerItems(ko): 종가 · 실적 발표 D-9 · 주총 D-28 (제목은 첫 조각만, 괄호 설명은 뺌)', () => {
  expect(tickerItems({ close: lastClose(stock), events, today: '2026-10-27', lang: 'ko' })).toEqual([
    'IREN $52.50 ▲5.0% · 10/26 종가', 'Q1 FY27 실적 발표 · 11/5 (D-9)', '2026 정기 주주총회 · 11/24 (D-28)',
  ])
})
it('tickerItems(en): 내린 날은 ▼, 오늘이면 today', () => {
  const down = { date: '2026-10-26', close: 48, prev: 50, pct: -4 }
  expect(tickerItems({ close: down, events, today: '2026-11-05', lang: 'en' })).toEqual([
    'IREN $48.00 ▼4.0% · close 10/26', 'Q1 FY27 results · Nov 5 (today)', '2026 AGM · Nov 24 (in 19 days)',
  ])
})
it('종가를 못 받았으면 일정만', () => {
  expect(tickerItems({ close: null, events, today: '2026-10-27', lang: 'ko' })).toHaveLength(2)
})
