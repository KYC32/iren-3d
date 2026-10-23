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
  it('하늘 모드는 공유 링크에 담기고 링크로 복원', () => {
    state().setRaw(raw)
    state().enterSite3D('childress')
    state().setSkyMode('night')
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', expect.stringContaining('sky=night'))
    state().setSkyMode('noon') // 모르는 값은 무시
    expect(state().skyMode).toBe('night')
    state().applyHash('#site=childress&surface=3d')
    expect(state().skyMode).toBe('live') // 하늘 값이 없는 링크 = 기본 보기 "지금"(부지 현지 시각)
    state().applyHash('#site=childress&surface=3d&sky=day')
    expect(state().skyMode).toBe('day')
    state().applyHash('#site=childress&surface=3d&sky=dusk')
    expect(state().skyMode).toBe('dusk')
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
  it('공유 링크로 건물을 열면 카메라도 그 건물로 (buildingFly)', () => {
    state().setRaw(raw)
    state().applyHash('#site=childress&surface=3d&building=horizon-2')
    expect(state().buildingFly?.id).toBe('horizon-2')
    state().applyHash('#site=childress&surface=3d')
    expect(state().buildingFly).toBeNull()
  })
  it('3D 에서 새 건물은 카메라 이동과 함께 고르고, 같은 건물을 다시 누르면 해제', () => {
    state().setRaw(raw)
    state().applyHash('#site=childress&surface=3d')
    state().selectBuilding('horizon-3', true)
    expect(state().selectedBuildingId).toBe('horizon-3')
    expect(state().buildingFly?.id).toBe('horizon-3')
    state().selectBuilding('horizon-3', false)
    expect(state().selectedBuildingId).toBeNull()
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

describe('일정 탭에서 이동', () => {
  // 지도 화면(기본)에서 일정 항목을 누르면 3D 로 넘어가지 않고 지도가 그 캠퍼스로 이동해야 함
  it('지도 화면에선 그 시점·캠퍼스로 지도를 옮김', () => {
    state().setRaw(raw)
    expect(state().surface).toBe('map')
    state().jumpTo(toMonth('2027-03'), 'childress')
    expect(state().month).toBe(toMonth('2027-03'))
    expect(state().selectedSiteId).toBe('childress')
    expect(state().surface).toBe('map')
    expect(state().pending).toBeNull()
  })
})

describe('주가·뉴스 페이지', () => {
  it('페이지 전환은 해시에 page·at 을 남기고 지도 상태는 보존', () => {
    state().setRaw(raw)
    state().selectSite('childress')
    state().setPage('stock', '2025-11-03')
    expect(state()).toMatchObject({ page: 'stock', stockAt: '2025-11-03', selectedSiteId: 'childress' })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', expect.stringContaining('page=stock&at=2025-11-03'))
    state().setPage('news')
    expect(state()).toMatchObject({ page: 'news', stockAt: null })
    state().setPage(null)
    expect(state().page).toBeNull()
    expect(state().selectedSiteId).toBe('childress')
  })
  it('시설 데이터가 없어도 해시로 페이지를 열 수 있고, 투어 중 페이지로 가면 투어 종료', () => {
    state().applyHash('#page=news')
    expect(state().page).toBe('news')
    state().setRaw(raw)
    state().startTour()
    state().setPage('stock')
    expect(state().tour).toBeNull()
  })
})

// 본사 3D 화면 — 지도의 시드니 본사 카드·≡ 메뉴·#hq=1 로 들어가 본사 건물과 경영진 발언을 봄 (2026-10-21 사용자 요청: 지도 옆 칸 대신)
describe('본사 3D 화면', () => {
  it('enterHq3D: 캠퍼스 선택을 풀고 3D 본사 화면 + 주소 #hq=1 (지역은 본사 → 지도로 돌아가면 시드니)', () => {
    state().setRaw(raw); state().selectSite('childress'); state().enterHq3D()
    expect(state()).toMatchObject({ view: 'hq', surface: '3d', selectedSiteId: null, mapRegion: { country: 'HQ' }, mapCamera: null })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1')
  })
  it.each([['requestGlobe (뒤로 가기·칸 닫기)', (s) => s.requestGlobe()], ['enterSite3D', (s) => s.enterSite3D('childress')],
    ['focusSiteOnMap', (s) => s.focusSiteOnMap('childress')], ["다른 지역 단추 setMapRegion('US')", (s) => s.setMapRegion('US')]])(
    '%s 하면 본사 화면에서 나옴', (_, act) => { state().setRaw(raw); state().enterHq3D(); act(state()); expect(state().view).not.toBe('hq') })
  it("requestGlobe 로 나오면 지도 화면 (주소에서 hq 도 빠짐)", () => {
    state().setRaw(raw); state().enterHq3D(); state().requestGlobe()
    expect(state()).toMatchObject({ view: 'globe', surface: 'map' })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/')
  })
  it("setMapRegion('HQ') 는 지도에서 시드니로만 (칸도 3D 도 열지 않음)", () => {
    state().setRaw(raw); state().setMapRegion('HQ')
    expect(state()).toMatchObject({ view: 'globe', surface: 'map', mapRegion: { country: 'HQ' } })
  })
  it('#hq=1 로 들어오면 데이터가 온 뒤 3D 본사 화면 + 지역은 본사', () => {
    window.location.hash = '#hq=1'; state().setRaw(raw)
    expect(state()).toMatchObject({ view: 'hq', surface: '3d', mapRegion: { country: 'HQ' } })
  })
  it('앱이 켜진 뒤 주소가 #hq=1 로 바뀌어도(뒤로 가기·붙여넣기) 3D 본사 화면', () => {
    state().setRaw(raw); state().applyHash('#hq=1')
    expect(state()).toMatchObject({ view: 'hq', surface: '3d', mapRegion: { country: 'HQ' } })
  })
  it('showHq: 주가 페이지에서도 3D 본사 화면으로 (≡ 메뉴 경영진 발언)', () => {
    state().setRaw(raw); state().setPage('stock'); state().showHq()
    expect(state()).toMatchObject({ page: null, view: 'hq', surface: '3d' })
  })
  it('본사 화면에서 페이지를 열어도 주소에 hq 가 남음 (페이지를 닫으면 본사로)', () => {
    state().setRaw(raw); state().enterHq3D(); state().setPage('stock')
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#page=stock&hq=1')
  })
  it('본사 화면에서 하늘을 바꾸면 주소에 sky', () => {
    state().setRaw(raw); state().enterHq3D(); state().setSkyMode('night')
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1&sky=night')
  })
  // 말풍선·CEO 사진·성적표를 누르면 가운데 카드 (탭: 약속 타임라인 | 발언 — 2026-10-22)
  it('openHqCard / closeHqCard: 카드 열고 닫기 + 주소에 card(탭), 본사 화면에 다시 들어오면 닫힌 채', () => {
    state().setRaw(raw); state().enterHq3D()
    expect(state().hqCard).toBeNull()
    state().openHqCard({ tab: 'statements', person: 'daniel-roberts' })
    expect(state().hqCard).toEqual({ tab: 'statements', person: 'daniel-roberts' })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1&card=statements')
    state().closeHqCard(); expect(state().hqCard).toBeNull()
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1')
    state().openHqCard({ tab: 'promises' }); state().requestGlobe(); state().enterHq3D()
    expect(state().hqCard).toBeNull()
  })
  it('탭을 안 주면 발언 탭 · setHqTab 으로 바꾸면 주소도 (펼친 약속은 약속 탭에만, 사람 거르기는 유지)', () => {
    state().setRaw(raw); state().enterHq3D(); state().openHqCard({})
    expect(state().hqCard).toEqual({ tab: 'statements' })
    state().setHqTab('promises', { open: 'p-x' })
    expect(state().hqCard).toEqual({ tab: 'promises', open: 'p-x' })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1&card=promises')
    state().setHqTab('statements'); expect(state().hqCard).toEqual({ tab: 'statements' })
    state().openHqCard({ tab: 'statements', person: 'daniel-roberts' }); state().setHqTab('promises')
    expect(state().hqCard).toEqual({ tab: 'promises', person: 'daniel-roberts' })
  })
  it('#hq=1&card=promises 로 들어오면 데이터가 온 뒤 약속 탭 카드 · 앱이 켜진 뒤 주소가 바뀌어도 따라감', () => {
    window.location.hash = '#hq=1&card=promises'; state().setRaw(raw)
    expect(state().hqCard).toEqual({ tab: 'promises' })
    state().applyHash('#hq=1'); expect(state().hqCard).toBeNull()
    state().applyHash('#hq=1&card=statements'); expect(state().hqCard).toEqual({ tab: 'statements' })
  })
  it("showHq('promises'): ≡ 메뉴 'CEO 약속' — 어느 화면에서든 본사 화면 + 약속 탭 카드", () => {
    state().setRaw(raw); state().setPage('stock'); state().showHq('promises')
    expect(state()).toMatchObject({ page: null, view: 'hq', hqCard: { tab: 'promises' } })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1&card=promises')
  })
})
