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
