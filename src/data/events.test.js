// events.js 단위 테스트 — 실제 IREN 데이터로 확인
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildEvents, upcomingEvents, eventTicks, fmtWhen } from './events.js'
import { asOfMonth } from './view.js'

const raw = JSON.parse(readFileSync(new URL('../../public/data/infra.json', import.meta.url), 'utf8'))
const events = buildEvents(raw)
const asOf = asOfMonth(raw.as_of)
const up = upcomingEvents(events, asOf)

describe('fmtWhen', () => {
  it('분기·반기·월·일', () => {
    expect(fmtWhen('2026-Q4')).toBe('2026년 4분기')
    expect(fmtWhen('2026-Q4', 'en')).toBe('Q4 2026')
    expect(fmtWhen('2027-H1')).toBe('2027년 상반기')
    expect(fmtWhen('2026-08')).toBe('2026.08')
    expect(fmtWhen('2026-08-13')).toBe('2026.08.13')
  })
})

describe('buildEvents', () => {
  it('시간 순으로 정렬', () => {
    for (let i = 1; i < events.length; i++) expect(events[i].month).toBeGreaterThanOrEqual(events[i - 1].month)
  })
  it('지난 공식 건물 단계·계획 발표는 넣지 않음', () => {
    expect(events.filter((e) => e.kind === 'phase' && (e.basis === 'reported' || e.status === 'planned'))).toHaveLength(0)
  })
  it('계약 4건(이름 미공개 프런티어 AI 연구소 포함)과 회사가 확정한 실적 발표·주주총회 일정이 있음', () => {
    expect(events.filter((e) => e.kind === 'contract')).toHaveLength(4)
    // 회사가 날짜를 발표하면 외부 추정(estimate, 월 단위) 대신 발표(reported), 일 단위 날짜로 바꿈
    expect(events.some((e) => e.kind === 'earnings' && e.when === '2026-11-05' && e.basis === 'reported')).toBe(true)
    // 주주총회는 회사 단위 일정(사이트 없음), 출처는 위임장 설명서(DEF 14A)
    expect(events.some((e) => e.siteId === null && e.when === '2026-11-24' && e.source.includes('def14a'))).toBe(true)
  })
})

describe('upcomingEvents', () => {
  it('모두 기준일 이후(또는 같은 달의 목표·추정)', () => {
    for (const e of up) expect(e.month > asOf || (e.month === asOf && e.basis !== 'reported')).toBe(true)
  })
  it('FY26 발표의 누적 인도 목표(2026·2027년, IT 기준)가 회사 목표로 들어 있음', () => {
    const targets = up.filter((e) => e.kind === 'other' && e.basis === 'target' && e.title_ko.includes('GW(IT)'))
    expect(targets.map((e) => e.when)).toEqual(['2026-12', '2027-12'])
  })
  it('Horizon 2 가동 목표(2026-Q4)와 Sweetwater 2 통전 목표가 들어 있음', () => {
    expect(up.some((e) => e.buildingId === 'horizon-2' && e.status === 'operating')).toBe(true)
    expect(up.some((e) => e.siteId === 'sweetwater-2' && e.kind === 'power')).toBe(true)
  })
})

describe('eventTicks', () => {
  it('같은 달은 하나의 눈금으로', () => {
    const ticks = eventTicks(events, asOf)
    expect(new Set(ticks.map((t) => t.month)).size).toBe(ticks.length)
    expect(ticks.reduce((n, t) => n + t.events.length, 0)).toBe(events.length)
  })
})
