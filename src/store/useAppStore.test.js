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


describe('실제 지도와 3D 공유 상태', () => {
  it('화면 전환 시 캠퍼스·구역·건물·탭과 지도 카메라를 유지', () => {
    state().setRaw(raw)
    state().selectSite('childress')
    state().selectZone('microsoft')
    state().selectBuilding('horizon-1')
    state().setDetailTab('evidence')
    const camera = { center: [-100.2, 34.4], zoom: 8 }
    state().setMapCamera(camera)
    state().setSurface('3d')
    state().setSurface('map')
    expect(state().selectedSiteId).toBe('childress')
    expect(state().selectedZoneKey).toBe('microsoft')
    expect(state().selectedBuildingId).toBe('horizon-1')
    expect(state().detailTab).toBe('evidence')
    expect(state().mapCamera).toEqual(camera)
  })
  it('공유 링크로 상세 상태를 복원', () => {
    state().setRaw(raw)
    state().applyHash('#site=childress&surface=3d&zone=microsoft&building=horizon-1&tab=history')
    expect(state().surface).toBe('3d')
    expect(state().selectedSiteId).toBe('childress')
    expect(state().selectedBuildingId).toBe('horizon-1')
    expect(state().selectedZoneKey).toBe('microsoft')
    expect(state().detailTab).toBe('history')
    expect(state().pending).toBeNull()
  })
})

describe('캠퍼스 클릭으로 3D 진입', () => {
  it('지도 카메라는 보존하고 이전 상세 선택은 초기화하여 바로 진입', () => {
    state().setRaw(raw)
    state().selectSite('childress')
    state().selectZone('microsoft')
    state().selectBuilding('horizon-1', true)
    state().setDetailTab('evidence')
    const camera = { center: [-100.2, 34.4], zoom: 8 }
    state().setMapCamera(camera)
    state().toggleSheet()
    state().enterSite3D('childress')
    expect(state()).toMatchObject({ surface:'3d', view:'site', selectedSiteId:'childress', detailTab:'overview',
      selectedBuildingId:null, selectedZoneKey:null, buildingFly:null, pending:null, transitioning:false, sheetOpen:false })
    expect(state().mapCamera).toEqual(camera)
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', expect.stringContaining('surface=3d'))
    state().requestGlobe()
    expect(state().surface).toBe('map')
    expect(state().mapCamera).toEqual(camera)
  })
  it('해당 날짜에 없는 캠퍼스는 진입하지 않음', () => {
    state().setRaw(raw)
    state().enterSite3D('missing')
    expect(state().surface).toBe('map')
    expect(state().selectedSiteId).toBeNull()
    state().setMonth(toMonth('2024-01'))
    state().enterSite3D('bundey')
    expect(state().selectedSiteId).toBeNull()
  })
})

describe('캠퍼스 목록은 지도 확대',()=>{
 it.each([390,960,1440])('폭 %i에서 목록 열기·선택·다시 열기가 선택 상태를 보존',width=>{
  window.innerWidth=width
  state().setRaw(raw)
  state().setCampusListOpen(false)
  state().toggleCampusList()
  expect(state()).toMatchObject({mapListCollapsed:false,sheetOpen:true})
  state().focusSiteOnMap('childress')
  expect(state()).toMatchObject({surface:'map',selectedSiteId:'childress',sheetOpen:false})
  state().toggleCampusList()
  if(width<1100) expect(state()).toMatchObject({mapListCollapsed:false,sheetOpen:true})
  else expect(state()).toMatchObject({mapListCollapsed:true,sheetOpen:false})
  state().setCampusListOpen(true)
  expect(state().selectedSiteId).toBe('childress')
  state().setCampusListOpen(false)
  state().enterSite3D('childress')
  state().requestGlobe()
  expect(state().mapListCollapsed).toBe(true)
 })
 it('목록 선택은 3D 진입과 분리되고 같은 캠퍼스를 다시 눌러도 확대 요청',()=>{
  state().setRaw(raw)
  state().enterSite3D('childress')
  state().focusSiteOnMap('childress')
  expect(state()).toMatchObject({surface:'map',view:'site',selectedSiteId:'childress',pending:null})
  const seq=state().mapFocusSeq
  state().focusSiteOnMap('childress')
  expect(state().mapFocusSeq).toBe(seq+1)
  state().enterSite3D('childress')
  expect(state().surface).toBe('3d')
 })
})

describe('캠퍼스 설명 패널 접기', () => {
  it('접기·펼치기와 화면 전환은 캠퍼스·고객·건물·탭을 보존', () => {
    state().setRaw(raw)
    state().enterSite3D('childress')
    state().selectZone('microsoft')
    state().selectBuilding('horizon-1')
    state().setDetailTab('history')
    const hashCalls = window.history.replaceState.mock.calls.length
    state().setCampusPanelCollapsed(true)
    expect(window.history.replaceState).toHaveBeenCalledTimes(hashCalls)
    expect(state()).toMatchObject({ campusPanelCollapsed:true, surface:'3d', view:'site', selectedSiteId:'childress',
      selectedZoneKey:'microsoft', selectedBuildingId:'horizon-1', detailTab:'history' })
    state().setSurface('map')
    expect(state().campusPanelCollapsed).toBe(true)
    state().setCampusPanelCollapsed(false)
    expect(state()).toMatchObject({ selectedSiteId:'childress', selectedZoneKey:'microsoft', selectedBuildingId:'horizon-1', detailTab:'history' })
  })
  it.each(['selectSite', 'enterSite3D', 'focusSiteOnMap'])('%s로 캠퍼스 선택 시 접힌 패널을 다시 표시', (action) => {
    state().setRaw(raw)
    state().enterSite3D('childress')
    state().setCampusPanelCollapsed(true)
    state()[action]('bundey')
    expect(state()).toMatchObject({ selectedSiteId:'bundey', campusPanelCollapsed:false })
  })
  it('장면에서 새 고객·건물 선택 시 설명을 다시 표시하고 날짜 변경은 접기 유지', () => {
    state().setRaw(raw)
    state().enterSite3D('childress')
    state().setCampusPanelCollapsed(true)
    state().setMonth(toMonth('2026-10'))
    expect(state().campusPanelCollapsed).toBe(true)
    state().selectZone('microsoft')
    expect(state().campusPanelCollapsed).toBe(false)
    state().setCampusPanelCollapsed(true)
    state().selectBuilding('horizon-1')
    expect(state().campusPanelCollapsed).toBe(false)
  })
})
