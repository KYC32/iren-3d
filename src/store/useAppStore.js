// 앱 전역 상태 (zustand)
// "스토어가 진실의 원천, 3D 씬과 HTML UI 는 그 투영" 구조입니다.
import { create } from 'zustand'
import { customerKey, customerZones } from '../data/customerZones.js'
import { STATUS } from '../data/status.js'
import { parseHash, buildHash } from './hashState.js'
import { viewInfra, asOfMonth } from '../data/view.js'
import { toMonth, monthKey } from '../data/timeline.js'
import { buildEvents } from '../data/events.js'
import { SINGLE_COMPANY } from '../config.js'

// 처음 열 때 URL 해시(#date=…&site=…&c=…&color=…)를 읽어 그 상태로 시작합니다.
const initial = parseHash(window.location.hash)
const snapshot = (raw, month) => viewInfra(raw, month, { observed: !new URLSearchParams(window.location.search).has('record') })

// 타임라인 슬라이더 범위
export const MONTH_MIN = toMonth('2024-01')
export const MONTH_MAX = toMonth('2028-12')

// 호버 해제 지연 (ms) — clearHover 참고
const HOVER_CLEAR_MS = 80
// 지금 호버를 "누가" 걸었는지('3d' = 캔버스 속 물체, 'dom' = 라벨·목록 같은 HTML)와 몇 번째 호버인지.
// 라벨(HTML)이 R3F 이벤트 영역 안에 붙어 있어서, 라벨 위에서 움직이면 R3F 가 라벨 뒤를 다시 검사해
// "건물에서 나감"을 보냄 → 출처가 다르면 그 해제는 무시해야 라벨 호버가 지워지지 않음
let hoverSrc = null
let hoverSeq = 0

export const useAppStore = create((set, get) => ({
  // ----- 데이터 -----
  data: null,            // 화면용 데이터 = viewInfra(원본, 지금 날짜)
  loadError: null,
  // ----- 타임라인 -----
  month: null,           // 지금 보고 있는 날짜 (월 번호). 원본을 받으면 기준일 또는 해시의 date 로 설정
  asOfMonth: null,       // 데이터 기준일 (이 이후는 "회사 발표 목표")
  playing: false,        // 재생 중인지

  // ----- 화면 상태 -----
  view: initial.site ? 'site' : 'globe',   // 'globe' | 'site'
  selectedSiteId: initial.site ?? null,    // 선택된 사이트 id
  hoverId: null,                           // 마우스 올린 사이트/건물 id
  selectedBuildingId: null,                // 캠퍼스에서 클릭해 고른 건물 id (패널 항목과 연동)
  selectedZoneKey: null,
  surface: initial.surface ?? 'map',
  detailTab: initial.tab ?? 'overview',
  mapCamera: null,
  mapRegion: { country: 'NA', seq: 0 },
  cameraHomeSeq: 0,
  buildingFly: null,                       // { id, seq } 패널에서 건물을 고르면 카메라가 그 건물로 (seq 로 같은 건물 재요청도 구분)
  transitioning: false,                    // 카메라 전환(페이드) 중인지
  // 카메라 전환 요청: UI/핀이 요청하면 CameraRig 가 애니메이션 후 실제로 view 를 바꿉니다
  pending: null,                           // null | { type: 'site', id } | { type: 'globe' }
  lang: (navigator.language || 'ko').startsWith('ko') ? 'ko' : 'en',
  // 상태 필터: 비어 있으면 전체 표시, 값이 있으면 그 상태만 강조
  activeStatuses: new Set(),
  // 회사·그룹 필터 (비어 있으면 전체)
  activeCompanies: new Set(initial.companies ?? []),
  activeGroups: new Set(),
  // 핀 색 기준: 'status'(가동·건설·계획 상태색) | 'company'(회사색)
  colorMode: initial.color ?? 'status',
  // 순위표 기준 지표: secured(확보) | ai(AI 가동) | building(건설·시운전)
  rankMetric: 'secured',
  // 왼쪽 패널 탭: 'rank'(회사 순위) | 'sites'(사이트 목록)
  leftTab: SINGLE_COMPANY ? 'sites' : 'rank',
  // 사건 목록 (원본에서 한 번 계산): 타임라인 눈금·다가오는 일정·계약
  events: [],
  // 지도에 고객 계약 연결선 표시
  showContracts: true,
  // 마우스를 올린 계약 id (그 계약선만 강조)
  hoverContract: null,
  // 모바일: 순위·사이트 패널을 바텀시트로 열었는지
  sheetOpen: false,
  mapListCollapsed: false,

  // ----- 액션 -----
  // 원본(infra.json)을 받으면 시작 날짜를 정하고 화면용 데이터를 만듦
  setRaw: (raw) => {
    const asOf = asOfMonth(raw.as_of)
    const h = parseHash(window.location.hash)
    const m = Math.min(MONTH_MAX, Math.max(MONTH_MIN, h.date ? toMonth(h.date) : asOf))
    const data = snapshot(raw, m)
    const id = data.sites.some((s) => s.id === h.site) ? h.site : null
    set({ asOfMonth: asOf, month: m, data, events: buildEvents(raw),
      selectedSiteId: id, view: id ? 'site' : 'globe', loadError: null,
      surface: id ? h.surface ?? 'map' : 'map', detailTab: h.tab ?? 'overview',
      selectedBuildingId: data.sites.find((s)=>s.id===id)?.buildings.some((b)=>b.id===h.building) ? h.building : null,
      selectedZoneKey: customerZones(data.sites.find((s)=>s.id===id) ?? {buildings:[]},data.companies).some((z)=>z.key===h.zone) ? h.zone : null,
      activeCompanies: new Set((h.companies ?? []).filter((id) => raw.companies.some((c) => c.id === id))),
      colorMode: h.color ?? 'status',
    })
    get().syncHash()
  },
  // 날짜 바꾸기 → 그 날짜의 상태로 화면용 데이터 다시 계산
  setMonth: (m) => {
    if (!Number.isFinite(m)) return
    const mm = Math.min(MONTH_MAX, Math.max(MONTH_MIN, Math.round(m)))
    const { data, month } = get()
    if (!data || mm === month) return
    const nextData = snapshot(data.raw, mm)
    const st = get()
    const missing = (id) => id && !nextData.sites.some((s) => s.id === id)
    const leaveSite = (st.view === 'site' && missing(st.selectedSiteId)) ||
      (st.pending?.type === 'site' && missing(st.pending.id))
    const site = nextData.sites.find((s) => s.id === st.selectedSiteId)
    set({ month: mm, data: nextData,
      ...(!site || !customerZones(site, nextData.companies).some((z) => z.key === st.selectedZoneKey) ? { selectedZoneKey: null } : {}),
      ...(leaveSite && st.pending?.type !== 'globe' ? { pending: { type: 'globe' } } : {}),
      ...(!site?.buildings.some((b) => b.id === st.selectedBuildingId)
        ? { selectedBuildingId: null, buildingFly: null } : {}),
    })
    if (!get().playing) get().syncHash()
  },
  setPlaying: (v) => {
    set({ playing: v })
    if (!v) get().syncHash()
  },
  // 지금 상태를 주소창 해시에 반영 (공유 링크용). 기준일이면 date 생략
  syncHash: () => {
    const st = get()
    const hash = buildHash({
      site: st.view === 'site' ? st.selectedSiteId : null,
      date: st.month != null && st.month !== st.asOfMonth ? monthKey(st.month) : null,
      companies: [...st.activeCompanies],
      color: st.colorMode, surface: st.surface, tab: st.detailTab, building: st.selectedBuildingId, zone: st.selectedZoneKey,
    })
    window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
  },
  // 해시에서 생략된 값도 기본값으로 복원합니다. 데이터 로딩 전에는 setRaw가 처리합니다.
  applyHash: (hash) => {
    const st = get()
    if (!st.data) return
    const h = parseHash(hash)
    set({ playing: false })
    st.setMonth(h.date ? toMonth(h.date) : st.asOfMonth)
    const next = get()
    const id = next.data.sites.some((s) => s.id === h.site) ? h.site : null
    set({
      activeCompanies: new Set((h.companies ?? []).filter((id) => next.data.companies.some((c) => c.id === id))),
      colorMode: h.color ?? 'status',
      pending: id ? (id === next.selectedSiteId && next.view === 'site' && !next.pending ? null : { type: 'site', id })
        : (next.view === 'site' || next.pending ? { type: 'globe' } : null),
    })
    set({ surface: id ? h.surface ?? 'map' : 'map', detailTab: h.tab ?? 'overview', selectedSiteId: id, view: id ? 'site' : 'globe', pending: null,
      selectedBuildingId: next.data.sites.find((s)=>s.id===id)?.buildings.some((b)=>b.id===h.building) ? h.building : null,
      selectedZoneKey: customerZones(next.data.sites.find((s)=>s.id===id) ?? {buildings:[]},next.data.companies).some((z)=>z.key===h.zone) ? h.zone : null })
    get().syncHash()
  },
  setSurface: (surface) => { if (surface === '3d' && !get().selectedSiteId) return; set({ surface, pending: null, transitioning: false }); get().syncHash() },
  // Map markers, co-located campus choices and the list all enter the same 3D view.
  // Set selection and surface atomically so no stale campus flashes during lazy loading.
  enterSite3D: (id) => {
    if (!get().data?.sites.some((site) => site.id === id)) return
    set({ surface: '3d', view: 'site', selectedSiteId: id, detailTab: 'overview',
      selectedBuildingId: null, selectedZoneKey: null, buildingFly: null, hoverId: null,
      pending: null, transitioning: false, sheetOpen: false })
    get().syncHash()
  },
  setDetailTab: (detailTab) => { set({ detailTab }); get().syncHash() },
  mapFocusSeq: 0,
  focusSiteOnMap: (id) => {
    if (!get().data?.sites.some(site=>site.id===id)) return
    set({surface:'map',view:'site',selectedSiteId:id,detailTab:'overview',sheetOpen:false,
      selectedBuildingId:null,selectedZoneKey:null,buildingFly:null,hoverId:null,
      pending:null,transitioning:false,mapCamera:null,mapFocusSeq:get().mapFocusSeq+1})
    get().syncHash()
  },
  setMapCamera: (mapCamera) => set({ mapCamera }),
  setMapRegion: (country) => { get().goGlobe(); set({ mapRegion: { country, seq: get().mapRegion.seq + 1 }, sheetOpen: false }) },
  setLoadError: (err) => set({ loadError: err }),
  // src: '3d'(캔버스 속 물체) | 'dom'(라벨·목록 등 HTML, 기본값)
  setHover: (id, src = 'dom') => {
    hoverSeq++      // 순번이 바뀌면 그 전에 예약된 해제는 모두 무효
    hoverSrc = src
    if (get().hoverId !== id) set({ hoverId: id })
  },
  // "떠남" 처리용 (호버 깜빡임 방지 세 가지):
  //  1) 바로 지우지 않고 HOVER_CLEAR_MS 뒤에 지움 — 건물(캔버스)에서 그 건물의 라벨(HTML)로
  //     넘어가는 순간처럼 "떠남 → 진입"이 연달아 올 때 한 프레임 깜빡임을 없앰
  //  2) 그 사이 새 호버가 있었으면(순번이 바뀜) 지우지 않음
  //  3) 지금 호버를 건 출처·대상과 같을 때만 지움 — 다른 쪽의 늦은 떠남 이벤트가
  //     새 호버를 덮어쓰지 않게. 요청마다 타이머를 따로 둬서 서로의 예약을 취소하지도 않음
  clearHover: (id, src = 'dom') => {
    const seq = hoverSeq
    setTimeout(() => {
      if (hoverSeq === seq && hoverSrc === src && get().hoverId === id) set({ hoverId: null })
    }, HOVER_CLEAR_MS)
  },
  setTransitioning: (v) => set({ transitioning: v }),
  // 건물 고르기. fly=true 면 카메라도 그 건물로 이동 (패널에서 고를 때 — 3D 에서 클릭할 땐 이미 보고 있으니 안 움직임)
  // 같은 건물을 다시 고르면 선택 해제 (토글)
  selectBuilding: (id, fly = false) => {
    const st = get()
    const next = id && st.selectedBuildingId === id && !fly ? null : id
    set({
      selectedBuildingId: next,
      selectedZoneKey: next && customerKey(selectSelectedSite(st)?.buildings.find((b) => b.id === next)?.customer) !== st.selectedZoneKey ? null : st.selectedZoneKey,
      buildingFly: fly && next ? { id: next, seq: (st.buildingFly?.seq ?? 0) + 1 } : st.buildingFly,
    })
    get().syncHash()
  },
  selectZone: (key) => {
    const st = get(), site = selectSelectedSite(st)
    if (st.pending || !site || !customerZones(site, st.data.companies).some((z) => z.key === key)) return
    if (st.selectedZoneKey === key) return st.requestCampusHome()
    set({ selectedZoneKey: key, selectedBuildingId: null, buildingFly: null, hoverId: null }); get().syncHash()
  },
  requestCampusHome: () => { if (!get().pending) { set({ cameraHomeSeq: get().cameraHomeSeq + 1, selectedBuildingId: null, buildingFly: null, hoverId: null, selectedZoneKey: null }); get().syncHash() } },
  toggleLang: () => set({ lang: get().lang === 'ko' ? 'en' : 'ko' }),

  // 전환 "요청" (애니메이션 포함) — UI 와 핀은 이것을 호출합니다
  requestSite: (id) => { if (get().data?.sites.some((s) => s.id === id) && !get().pending) set({ pending: { type: 'site', id } }) },
  requestGlobe: () => { if (!get().pending) { set({surface:'map'}); get().goGlobe() } },
  // 지구본에서 특정 지역(북미·유럽·아시아)으로 카메라 이동
  requestRegion: (lat, lng) => { if (!get().pending && get().view === 'globe') set({ pending: { type: 'region', lat, lng } }) },
  clearPending: () => set({ pending: null }),

  // 사이트 선택 → 캠퍼스 뷰로 (CameraRig 가 애니메이션 도중에 호출) (URL 해시도 갱신해 공유 가능하게)
  selectSite: (id) => {
    set({ detailTab: 'overview', sheetOpen: false, selectedSiteId: id, view: id ? 'site' : 'globe', hoverId: null, selectedBuildingId: null, buildingFly: null, selectedZoneKey: null })
    get().syncHash()
  },
  goGlobe: () => {
    set({ surface: 'map', detailTab: 'overview', view: 'globe', selectedSiteId: null, hoverId: null, selectedBuildingId: null, buildingFly: null, selectedZoneKey: null })
    get().syncHash()
  },

  // 범례 클릭: 해당 상태만 강조 (다시 클릭하면 해제)
  toggleStatus: (status) => {
    const next = new Set(get().activeStatuses)
    next.has(status) ? next.delete(status) : next.add(status)
    set({ activeStatuses: next })
  },
  clearStatuses: () => set({ activeStatuses: new Set() }),

  // 회사 필터: 같은 회사를 다시 누르면 해제
  toggleCompany: (id) => {
    const next = new Set(get().activeCompanies)
    next.has(id) ? next.delete(id) : next.add(id)
    set({ activeCompanies: next })
    get().syncHash()
  },
  toggleGroup: (g) => {
    const next = new Set(get().activeGroups)
    next.has(g) ? next.delete(g) : next.add(g)
    set({ activeGroups: next })
  },
  clearCompanyFilters: () => { set({ activeCompanies: new Set(), activeGroups: new Set() }); get().syncHash() },
  setColorMode: (mode) => { set({ colorMode: mode }); get().syncHash() },
  setRankMetric: (metric) => set({ rankMetric: metric }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  toggleContracts: () => set({ showContracts: !get().showContracts }),
  setHoverContract: (id) => set({ hoverContract: id }),
  clearHoverContract: (id) => { if (get().hoverContract === id) set({ hoverContract: null }) },
  // 일정 항목 클릭: 그 시점으로 이동하고 (사이트가 있으면) 그 사이트로
  jumpTo: (month, siteId) => {
    const st = get()
    st.setPlaying(false)
    st.setMonth(month)
    if (siteId && siteId !== st.selectedSiteId) st.requestSite(siteId)
  },
  toggleSheet: () => set({ sheetOpen: !get().sheetOpen }),
  setCampusListOpen: (open) => set({ mapListCollapsed: !open, sheetOpen: open }),
  toggleCampusList: () => {
    const st = get()
    const overlay = window.innerWidth < 768 || (window.innerWidth <= 1100 && st.view === 'site')
    const open = overlay ? st.sheetOpen : !st.mapListCollapsed
    st.setCampusListOpen(!open)
  },
}))

// 셀렉터 기본값용 빈 배열 — `?? []` 를 쓰면 매번 새 배열이 생겨 무한 리렌더가 날 수 있어 항상 같은 배열을 씀
export const EMPTY = Object.freeze([])

// 선택된 사이트 객체를 편하게 꺼내는 셀렉터
export const selectSelectedSite = (s) =>
  s.data?.sites.find((x) => x.id === s.selectedSiteId) ?? null

// 상태 필터에 걸리는지 (필터가 없으면 항상 true)
export function isStatusActive(activeStatuses, status) {
  return activeStatuses.size === 0 || activeStatuses.has(status)
}

// 사이트가 회사·그룹 필터를 통과하는지
export function isCompanyActive(state, site) {
  const { activeCompanies, activeGroups, data } = state
  if (activeCompanies.size && !activeCompanies.has(site.primary)) return false
  if (activeGroups.size) {
    const group = data?.companies.find((c) => c.id === site.primary)?.group
    if (!activeGroups.has(group)) return false
  }
  return true
}

// 상태·회사·그룹 필터를 모두 통과하는지
export function isSiteActive(state, site) {
  return isStatusActive(state.activeStatuses, site.status) && isCompanyActive(state, site)
}

export { STATUS }
