import { describe, it, expect } from 'vitest'
import { parseHash, buildHash } from './hashState.js'

describe('hashState', () => {
  it('옛 링크(#site=) 호환', () => {
    expect(parseHash('#site=childress')).toEqual({ site: 'childress' })
  })
  it('모든 항목 파싱', () => {
    expect(parseHash('#date=2027-06&site=childress&c=iren,galaxy&color=company')).toEqual({
      date: '2027-06', site: 'childress', companies: ['iren', 'galaxy'], color: 'company',
    })
  })
  it('잘못된 값은 무시', () => {
    expect(parseHash('#date=2027-13&site=../x&color=rainbow')).toEqual({})
  })
  it('생성 → 파싱 왕복', () => {
    const state = { date: '2025-01', site: 'sweetwater-1', companies: ['iren'], color: 'company' }
    expect(parseHash(buildHash(state))).toEqual({ date: '2025-01', site: 'sweetwater-1', companies: ['iren'], color: 'company' })
  })
  it('기본값은 생략', () => {
    expect(buildHash({})).toBe('')
    expect(buildHash({ color: 'status' })).toBe('')
  })
})

 it('shares the map/diagram, selected building and evidence tab', () => {
   const s={site:'childress',surface:'3d',building:'horizon-1',zone:'microsoft',tab:'evidence',date:'2026-08'}
   expect(parseHash(buildHash(s))).toEqual(s)
 })

describe('하늘 모드 (sky)', () => {
  // 기본 보기 = 지금(부지 현지 시각, live) — 2026-10-16 사용자 요청. 기본값은 주소에서 생략
  it('3D 캠퍼스에서만 주소에 남기고, 기본인 지금(live)은 생략', () => {
    expect(buildHash({ site: 'childress', surface: '3d', sky: 'night' })).toContain('sky=night')
    expect(buildHash({ site: 'childress', surface: '3d', sky: 'live' })).not.toContain('sky')
    expect(buildHash({ site: 'childress', surface: '3d' })).not.toContain('sky')
    expect(buildHash({ site: 'childress', surface: 'map', sky: 'night' })).not.toContain('sky')
    expect(parseHash('#site=childress&surface=3d&sky=live')).toMatchObject({ sky: 'live' })
    expect(parseHash('#sky=noon')).toEqual({})
  })
  it('낮(day)을 고르면 주소에 남아 공유 링크로도 낮으로 열림', () => {
    expect(buildHash({ site: 'childress', surface: '3d', sky: 'day' })).toContain('sky=day')
    expect(parseHash('#site=childress&surface=3d&sky=day')).toMatchObject({ sky: 'day' })
  })
})

describe('페이지 (page · at)', () => {
  it('주가·뉴스 페이지와 강조 날짜 왕복, 지도 상태는 그대로 유지', () => {
    expect(parseHash(buildHash({ page: 'news' }))).toEqual({ page: 'news' })
    const s = { page: 'stock', at: '2025-11-03', site: 'childress', date: '2026-08' }
    expect(parseHash(buildHash(s))).toEqual(s)
    expect(buildHash(s).startsWith('#page=stock&at=2025-11-03')).toBe(true)
  })
  it('사업 현황 페이지(portfolio): 날짜와 함께 왕복 (현황 페이지엔 타임라인이 있음)', () => {
    expect(parseHash(buildHash({ page: 'portfolio' }))).toEqual({ page: 'portfolio' })
    expect(parseHash(buildHash({ page: 'portfolio', date: '2025-06' }))).toEqual({ page: 'portfolio', date: '2025-06' })
    expect(buildHash({ page: 'portfolio', at: '2025-11-03' })).toBe('#page=portfolio') // at 은 주가 페이지 전용
  })
  it('모르는 페이지·page 없는 at·잘못된 날짜는 무시', () => {
    expect(parseHash('#page=foo')).toEqual({})
    expect(parseHash('#at=2025-11-03')).toEqual({})
    expect(parseHash('#page=news&at=2025-11-03')).toEqual({ page: 'news' })
    expect(parseHash('#page=stock&at=2025-13-40')).toEqual({ page: 'stock' })
    expect(buildHash({ page: 'news', at: '2025-11-03' })).toBe('#page=news')
  })
})

// 본사 3D 화면: #hq=1 — 캠퍼스 주소가 있으면 캠퍼스가 먼저, 페이지와는 함께 (페이지를 닫으면 본사로)
describe('본사 화면 주소', () => {
  it('hq=1 → hq', () => { expect(parseHash('#hq=1')).toEqual({ hq: true }); expect(parseHash('#hq=0')).toEqual({}) })
  it('hq 는 캠퍼스가 없을 때 주소에 (페이지와 함께도) · 본사 화면의 하늘도', () => {
    expect(buildHash({ hq: true })).toBe('#hq=1')
    expect(buildHash({ hq: true, site: 'childress' })).toBe('#site=childress')
    expect(buildHash({ hq: true, page: 'stock' })).toBe('#page=stock&hq=1')
    expect(buildHash({ hq: true, sky: 'night' })).toBe('#hq=1&sky=night')
  })
})
