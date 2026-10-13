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
  it('3D 캠퍼스에서만 주소에 남기고, 낮(day)은 생략', () => {
    expect(buildHash({ site: 'childress', surface: '3d', sky: 'night' })).toContain('sky=night')
    expect(buildHash({ site: 'childress', surface: '3d', sky: 'day' })).not.toContain('sky')
    expect(buildHash({ site: 'childress', surface: 'map', sky: 'night' })).not.toContain('sky')
    expect(parseHash('#site=childress&surface=3d&sky=live')).toMatchObject({ sky: 'live' })
    expect(parseHash('#sky=noon')).toEqual({})
  })
})

describe('페이지 (page · at)', () => {
  it('주가·뉴스 페이지와 강조 날짜 왕복, 지도 상태는 그대로 유지', () => {
    expect(parseHash(buildHash({ page: 'news' }))).toEqual({ page: 'news' })
    const s = { page: 'stock', at: '2025-11-03', site: 'childress', date: '2026-08' }
    expect(parseHash(buildHash(s))).toEqual(s)
    expect(buildHash(s).startsWith('#page=stock&at=2025-11-03')).toBe(true)
  })
  it('모르는 페이지·page 없는 at·잘못된 날짜는 무시', () => {
    expect(parseHash('#page=foo')).toEqual({})
    expect(parseHash('#at=2025-11-03')).toEqual({})
    expect(parseHash('#page=news&at=2025-11-03')).toEqual({ page: 'news' })
    expect(parseHash('#page=stock&at=2025-13-40')).toEqual({ page: 'stock' })
    expect(buildHash({ page: 'news', at: '2025-11-03' })).toBe('#page=news')
  })
})
