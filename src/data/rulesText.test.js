// 지역 규제 한 줄 문구 시험 — 캠퍼스 패널과 현황 페이지가 같은 문구를 씀
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rulesLine, stateActionsFor } from './rulesText.js'

const sw1 = { site: 'sweetwater-1', county: 'Fisher County', state: 'TX', county_count: 0, state_count: 3, state_count_year: 3, year: 2026,
  nearest: { jurisdiction: 'Hill County', date: '2026-05-12', km: 335, status: 'rescinded' } }

describe('rulesLine', () => {
  it('한국어: 카운티 이름을 한글로, 주 전체·그해 건수, 가장 가까운 조치', () => {
    const t = rulesLine(sw1, 'ko')
    expect(t.main).toBe('피셔 카운티 0건 · 텍사스 전체 3건(2026년 3건)')
    expect(t.nearest).toMatch(/^같은 주에서 가장 가까운 조치: Hill County · .+ · 철회됨 · 약 335km$/)
  })
  it('영어 문구', () => {
    expect(rulesLine(sw1, 'en').main).toBe('Fisher County: 0 · Texas: 3 in total (3 in 2026)')
  })
  it('가까운 조치가 없으면 nearest 는 null', () => {
    expect(rulesLine({ ...sw1, nearest: null }, 'ko').nearest).toBe(null)
  })
})

describe('stateActionsFor (주 정부 조치)', () => {
  const list = [
    { state: 'TX', date: '2026-08-03', ko: 'a', en: 'a', source: 'https://x.test/a' },
    { state: 'TX', date: '2026-09-21', ko: 'b', en: 'b', source: 'https://x.test/b' },
    { state: 'OK', date: '2026-01-01', ko: 'c', en: 'c', source: 'https://x.test/c' },
  ]
  it('그 주의 조치만 최근 순으로', () => { expect(stateActionsFor(list, 'TX').map((a) => a.ko)).toEqual(['b', 'a']) })
  it('조치가 없는 주는 빈 목록', () => { expect(stateActionsFor(list, 'NM')).toEqual([]) })
  it('자료에 칸이 없어도 깨지지 않음', () => { expect(stateActionsFor(undefined, 'TX')).toEqual([]) })
})

describe('data/restrictions.json 의 주 정부 조치', () => {
  const real = JSON.parse(readFileSync(new URL('../../data/restrictions.json', import.meta.url), 'utf8'))
  it('텍사스 주지사 8/3 감사 지시와 9/21 TCEQ 허가 중단이 들어 있음', () => {
    const dates = stateActionsFor(real.stateActions, 'TX').map((a) => a.date)
    expect(dates).toContain('2026-08-03')
    expect(dates).toContain('2026-09-21')
  })
})
