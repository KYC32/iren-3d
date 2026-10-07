import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth } from '../data/timeline.js'

const raw = buildInfra()
let store
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('window', { location: { hash: '', pathname: '/', search: '' }, history: { replaceState: vi.fn() } })
  vi.stubGlobal('navigator', { language: 'ko' })
  store = (await import('./useAppStore.js')).useAppStore
})
afterEach(() => vi.unstubAllGlobals())
const state = () => store.getState()

describe('날짜와 캠퍼스 상태', () => {
  it.each(['#site=unknown', '#site=bundey&date=2024-01'])('유효하지 않은 초기 캠퍼스는 보드로 복구: %s', (hash) => {
    window.location.hash = hash
    state().setRaw(raw)
    expect(state().view).toBe('globe')
    expect(state().selectedSiteId).toBeNull()
  })
  it('데이터를 기다리는 동안 바뀐 해시를 적용', () => {
    window.location.hash = '#site=childress&date=2027-06'
    state().setRaw(raw)
    expect(state().view).toBe('site')
    expect(state().month).toBe(toMonth('2027-06'))
  })
  it('발표 이전으로 이동하면 보드 복귀를 요청', () => {
    state().setRaw(raw)
    state().selectSite('bundey')
    state().setMonth(toMonth('2024-01'))
    expect(state().pending).toEqual({ type: 'globe' })
  })
  it('재생 중 연속 월 변경이 진행 중인 보드 복귀를 재시작하지 않음', () => {
    state().setRaw(raw)
    state().selectSite('bundey')
    state().setMonth(toMonth('2024-01'))
    const pending = state().pending
    state().setMonth(toMonth('2024-02'))
    expect(state().pending).toBe(pending)
  })
  it('이동 중 목적지가 사라져도 보드 복귀를 요청', () => {
    state().setRaw(raw)
    state().requestSite('bundey')
    state().setMonth(toMonth('2024-01'))
    expect(state().pending).toEqual({ type: 'globe' })
  })
  it('해시에서 생략한 날짜·회사·색상은 기본값으로 복원하고 재생 중지', () => {
    state().setRaw(raw)
    state().applyHash('#date=2027-06&c=iren&color=company')
    expect(state().activeCompanies.has('iren')).toBe(true)
    expect(state().colorMode).toBe('company')
    state().setPlaying(true)
    state().applyHash('')
    expect(state().month).toBe(toMonth(raw.as_of))
    expect(state().activeCompanies.size).toBe(0)
    expect(state().colorMode).toBe('status')
    expect(state().playing).toBe(false)
  })
  it('없는 사이트 요청 및 유효하지 않은 월은 무시', () => {
    state().setRaw(raw)
    const month = state().month
    state().requestSite('unknown')
    state().setMonth(NaN)
    expect(state().pending).toBeNull()
    expect(state().month).toBe(month)
  })
  it('캠퍼스 이동 시 이전 건물 카메라 요청 초기화', () => {
    state().setRaw(raw)
    state().selectBuilding('horizon-1', true)
    state().selectSite('bundey')
    expect(state().buildingFly).toBeNull()
  })
})

describe('고객 구역 선택', () => {
  it('구역 안 건물 상세는 유지하고 전체 보기에서 해제', () => {
    state().setRaw(raw)
    state().selectSite('childress')
    state().selectZone('microsoft')
    expect(state().selectedZoneKey).toBe('microsoft')
    state().selectBuilding('horizon-1', true)
    expect(state().selectedZoneKey).toBe('microsoft')
    state().requestCampusHome()
    expect(state().selectedZoneKey).toBeNull()
    expect(state().selectedBuildingId).toBeNull()
  })
  it('다른 구역 전환·사이트 이탈·발표 이전 날짜에서 이전 선택을 남기지 않음', () => {
    state().setRaw(raw)
    state().selectSite('childress')
    state().selectZone('microsoft')
    state().selectBuilding('horizon-1')
    state().selectZone('nvidia')
    expect(state().selectedBuildingId).toBeNull()
    state().setMonth(toMonth('2024-01'))
    expect(state().selectedZoneKey).toBeNull()
    state().setMonth(toMonth('2026-10'))
    state().selectZone('microsoft')
    state().selectSite('sweetwater')
    expect(state().selectedZoneKey).toBeNull()
  })
})
