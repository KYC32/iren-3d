// =============================================================
// CameraRig — 카메라 이동과 "지구본 ↔ 캠퍼스" 전환 연출 담당
// -------------------------------------------------------------
// 흐름 (사이트 진입):
//   핀 클릭 → store.requestSite(id) → (여기서) 핀 쪽으로 줌인 1.2초
//   → 화면 페이드 → store.selectSite(id) 로 view 전환 → 캠퍼스 시점으로 순간 이동
//   → 페이드 아웃
// 지구본으로 돌아갈 때는 역순입니다.
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { latLngToVec3 } from './geo.js'
import { campusFrame, campusFrameBox, contentBox, campusOffset, campusViewport } from './campusCamera.js'
import { customerKey, zoneBounds } from '../data/customerZones.js'
import { layoutCampus } from './layoutCampus.js'
import { Box3, Vector3 } from 'three'
import { SINGLE_COMPANY } from '../config.js'
import { hqTower, hqLabelRoom, hqDirection } from './hqTower.js'
import { loadHqCity, peekHqCity } from '../data/loadHqCity.js' // 본사 탑 실제 윤곽 (OSM — 받기 전엔 정사각형)

// 3D 개요 화면은 지구본(다회사 모드 계보 · 영상 녹화 인트로).
// 단일 회사(IREN) 모드에선 개요를 실제 지도(GeoMap)가 맡아서, 3D 는 캠퍼스 화면에만 쓰입니다.
// (예전 국가 카드 보드판은 지도·계약 탭과 역할이 겹쳐 2026-10-09 삭제)
const OVERVIEW = 'globe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// camera-controls 의 이동 Promise 는 카메라가 완전히 멈춰야 끝나서 가끔 늦게 끝납니다.
// 최대 ms 만 기다리고 다음 단계로 넘어가도록 감쌉니다.
const settle = (promise, ms) => Promise.race([promise, sleep(ms)])
const FADE_MS = 320 // App.css 의 .fade 전환 시간과 맞춥니다

// 지구본 기본 시점: 북미가 정면에 오도록
const GLOBE_HOME = { lat: 40, lng: -102, alt: globeAlt() }

// 화면 비율에 맞춰 지구본 전체가 들어오는 거리 (세로 화면일수록 멀리)
function globeAlt() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  return aspect < 0.6 ? 7.2 : aspect < 0.8 ? 5.6 : aspect < 1.2 ? 4.2 : 3.7
}

// 캠퍼스 기본 시점: 건물·변전소가 있는 곳(contentBox)에 맞춰 대각선 위에서 내려다봄 (준아이소메트릭)
//   예전엔 부지 판 전체에 맞춰 건물이 작게 보였음 → 건물 영역이 쓸 수 있는 화면을 70% 이상 채움
function campusHome(L) {
  const w = window.innerWidth, h = window.innerHeight
  const frame = campusFrameBox(contentBox(L), w, h, campusViewport(w, h))
  return [...frame.position, ...frame.target]
}

// 본사 화면(view 'hq'): 사무 빌딩 모양(층수는 데이터)과 그 빌딩이 쓸 수 있는 화면을 채우는 시점
const isCampusLike = (view) => view === 'site' || view === 'hq' // 캠퍼스처럼 돌려 보는 3D 화면
function hqShape() {
  const shape = peekHqCity()?.hq // 실제 윤곽(탑·포디움)을 받았으면 그것으로, 아니면 정사각형 기본 모양
  return hqTower(useAppStore.getState().data?.companies?.[0]?.hq?.building ?? { floors: 20, level: 5 }, shape?.tower?.length >= 3 ? shape : null)
}
// 본사 화면에서 빌딩이 들어갈 화면 영역: 위 = 상단 바 아래 + 옥상 위 CEO 카드 자리, 양옆 = 말풍선·5층 표시 자리,
//   아래 = 휴대폰이면 말풍선 묶음(.hq-dock) 위까지 (본사 화면엔 KPI 판이 없어 위는 상단 바에서 잼)
function hqViewport(w, h) {
  const rect = campusViewport(w, h)
  const room = hqLabelRoom(w)
  const bar = document.querySelector('.topbar')?.getBoundingClientRect()
  const dock = document.querySelector('.hq-dock')?.getBoundingClientRect()
  return { ...rect, top: (bar?.bottom ?? 70) + 18 + room.top, left: rect.left + room.left, right: rect.right - room.right,
    bottom: w < 768 && dock?.height ? Math.min(rect.bottom, dock.top - 12) : rect.bottom }
}
function hqHome(T) {
  const w = window.innerWidth, h = window.innerHeight
  const frame = campusFrameBox(T.box, w, h, hqViewport(w, h), 30, 0.92, hqDirection()) // 본사가 가장 잘 보이는 쪽에서
  return [...frame.position, ...frame.target]
}

// 상세 패널이 화면 일부를 가리므로 캠퍼스를 보이는 영역 가운데로 밀어 줍니다.
// focalOffset 은 "화면 기준" 평행이동이라 회전해도 패널 반대쪽에 머뭅니다.
function applyFocalOffset(c, view, side, transition) {
  const mobile = window.innerWidth < 768
  // 지구본: 데스크톱에서는 왼쪽 사이트 목록을 피해 지구본을 오른쪽으로
  if (!isCampusLike(view)) return c.setFocalOffset(mobile ? 0 : -28, 0, 0, transition)
  const w = window.innerWidth, h = window.innerHeight
  return c.setFocalOffset(...campusOffset(c.distance, w, h, view === 'hq' ? hqViewport(w, h) : campusViewport(w, h)), transition)
}

// 뷰별 카메라 제약
// top: 시점 중심이 올라갈 수 있는 높이 (본사 빌딩처럼 높은 건물은 그 가운데까지)
function applyLimits(c, view, side = 30, top = side * 0.35) {
  // 보드판 제약을 풀어 줌 (캠퍼스·지구본 전환 시)
  c.minAzimuthAngle = -Infinity
  c.maxAzimuthAngle = Infinity
  c.setBoundary(null)
  if (view === 'globe') {
    c.minDistance = 150
    c.maxDistance = 900
    c.minPolarAngle = 0.15
    c.maxPolarAngle = Math.PI - 0.15
    c.truckSpeed = 0 // 지구본에서는 평행이동 금지 (회전·줌만)
    c.dollySpeed = 0.6
  } else {
    c.minDistance = side * 0.45 // 데이터홀 속(랙) 을 들여다볼 수 있을 만큼 가까이
    c.maxDistance = Math.max(side * 9, campusFrame(side, window.innerWidth, window.innerHeight, campusViewport(window.innerWidth, window.innerHeight)).distance * 1.8)
    c.minPolarAngle = 0.35 // 너무 위에서 수직으로 내려다보지 않게
    c.maxPolarAngle = 1.2  // 바닥 아래로 들어가지 않게
    // Keep the focus near the campus and its landscape, while allowing screen-space panning.
    c.setBoundary(new Box3(new Vector3(-side, -side*.15, -side), new Vector3(side, top, side)))
    c.truckSpeed = 1.8
    c.dollySpeed = 0.8
  }
}

export default function CameraRig() {
  const ref = useRef()
  const lastInteract = useRef(-Infinity)
  const manualView = useRef(false)
  const fittedContext = useRef(null)
  const pending = useAppStore((s) => s.pending)
  const view = useAppStore((s) => s.view)
  const zoneKey = useAppStore((s) => s.selectedZoneKey)
  const siteId = useAppStore((s) => s.selectedSiteId)
  const dragMode = useAppStore((s) => s.campusDragMode)
  const homeSeq = useAppStore((s) => s.cameraHomeSeq)
  const size = useThree((s) => s.size)
  const safeRect = useRef(null)
  const lastOffset = useRef(null) // 마지막으로 적용한 캠퍼스 초점 이동값 (같으면 다시 안 함)
  // 본사 화면: 동네 자료(탑 실제 윤곽)를 받으면 카메라를 다시 맞춤 (사용자가 이미 돌렸으면 그대로)
  const [hqCityReady, setHqCityReady] = useState(() => !!peekHqCity())
  useEffect(() => {
    if (view !== 'hq' || hqCityReady) return undefined
    let alive = true
    loadHqCity().then((x) => { if (alive && x) setHqCityReady(true) })
    return () => { alive = false }
  }, [view, hqCityReady])

  // Explicit navigation resets the view. Panel/date changes preserve the user's close-up.
  useEffect(() => {
    if (!isCampusLike(view)) { fittedContext.current=null; return }
    const context=`${view}:${siteId}:${zoneKey}:${homeSeq}`
    if (context!==fittedContext.current) manualView.current=false
    fittedContext.current=context
    const fit = () => {
      const st = useAppStore.getState(), c = ref.current
      safeRect.current = st.view === 'hq' ? hqViewport(size.width, size.height) : campusViewport(size.width, size.height)
      // 본사 화면: 빌딩 전체가 칸을 뺀 화면에 들어오게 (사용자가 돌렸으면 그대로)
      if (st.view === 'hq') {
        if (!c || st.pending) return
        const T = hqShape()
        applyLimits(c, 'site', T.side, T.height)
        if (!manualView.current) c.setLookAt(...hqHome(T), true)
        return
      }
      const site = selectSelectedSite(st)
      if (!c || !site || st.pending) return
      const L = layoutCampus(site._raw)
      applyLimits(c, 'site', L.side)
      if (manualView.current) return
      const ids = new Set(site.buildings.filter((b) => customerKey(b.customer) === st.selectedZoneKey).map((b) => b.id))
      const bounds = st.selectedZoneKey && zoneBounds(L.blocks.filter((b) => ids.has(b.buildingId)))
      if (bounds) {
        const frame = campusFrame(bounds.side, size.width, size.height, safeRect.current)
        c.setLookAt(frame.position[0] + bounds.x, frame.position[1], frame.position[2] + bounds.z,
          bounds.x, frame.target[1], bounds.z, true)
      } else c.setLookAt(...campusHome(L), true)
    }
    fit()
    const observer = new ResizeObserver(fit)
    for (const selector of ['.site-panel', '.kpis', '.bottom']) {
      const el = document.querySelector(selector)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [view, size.width, size.height, homeSeq, zoneKey, siteId, hqCityReady])

  // 처음 마운트: 딥링크(#site=...)면 캠퍼스, 아니면 지구본 시점
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const st = useAppStore.getState()
    const site = selectSelectedSite(st)
    if (st.view === 'hq') {
      const T = hqShape()
      applyLimits(c, 'site', T.side, T.height)
      c.setLookAt(...hqHome(T), false)
      applyFocalOffset(c, 'hq', T.side, false)
    } else if (st.view === 'site' && site) {
      const L = layoutCampus(site._raw)
      applyLimits(c, 'site', L.side)
      c.setLookAt(...campusHome(L), false)
      applyFocalOffset(c, 'site', L.side, false)
    } else {
      applyLimits(c, 'globe')
      applyFocalOffset(c, 'globe', 0, false)
      const p = latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, GLOBE_HOME.alt)
      c.setLookAt(p.x, p.y, p.z, 0, 0, 0, false)
    }
    // 사용자가 직접 조작하면 자동 회전을 잠시 멈춥니다
    const onStart = () => {
      lastInteract.current = performance.now()
      if (isCampusLike(useAppStore.getState().view)) manualView.current=true
    }
    c.addEventListener('controlstart', onStart)
    // Wheel events emit control without controlstart; zoom-only inspection must also persist.
    c.addEventListener('control', onStart)
    return () => {
      c.removeEventListener('controlstart', onStart)
      c.removeEventListener('control', onStart)
    }
  }, [])

  // 전환 요청 처리
  useEffect(() => {
    const c = ref.current
    if (!c || !pending) return
    let cancelled = false
    const st = useAppStore.getState()

    async function toSite(id) {
      const site = st.data?.sites.find((s) => s.id === id)
      if (!site) return
      if (st.view === 'globe') {
        // 1) 지구본 상태라면 핀 쪽으로 줌인
        c.minDistance = 0
        const from = latLngToVec3(site.lat, site.lng, 0.7)
        const to = latLngToVec3(site.lat, site.lng, 0)
        c.smoothTime = 0.45
        await settle(c.setLookAt(from.x, from.y, from.z, to.x, to.y, to.z, true), 1100)
      }
      if (cancelled) return
      // 2) 페이드 인 → 뷰 전환 → 캠퍼스 시점
      st.setTransitioning(true)
      await sleep(FADE_MS)
      if (cancelled) return
      st.selectSite(id)
      const L = layoutCampus(site._raw)
      applyLimits(c, 'site', L.side)
      c.smoothTime = 0.25
      const [px, py, pz, tx, ty, tz] = campusHome(L)
      // 살짝 멀리서 시작해 안으로 들어오는 느낌 (바라보는 점 기준으로 15% 뒤에서 — 점이 원점이 아니어도 옆으로 밀리지 않게)
      const back = (p, t) => t + (p - t) * 1.15
      c.setLookAt(back(px, tx), back(py, ty), back(pz, tz), tx, ty, tz, false)
      applyFocalOffset(c, 'site', L.side, false)
      await sleep(30)
      if (cancelled) return
      st.setTransitioning(false)
      await settle(c.setLookAt(px, py, pz, tx, ty, tz, true), 1200)
    }

    async function toGlobe() {
      const prev = selectSelectedSite(st)
      st.setTransitioning(true)
      await sleep(FADE_MS)
      if (cancelled) return
      st.goGlobe()
      applyLimits(c, 'globe')
      applyFocalOffset(c, 'globe', 0, false)
      c.minDistance = 0
      // 방금 보던 사이트 바로 위에서 시작해 바깥으로 빠져나옴
      const near = prev ? latLngToVec3(prev.lat, prev.lng, 0.7) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, 0.7)
      const target = prev ? latLngToVec3(prev.lat, prev.lng, 0) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, 0)
      c.setLookAt(near.x, near.y, near.z, target.x, target.y, target.z, false)
      await sleep(30)
      if (cancelled) return
      st.setTransitioning(false)
      const far = prev ? latLngToVec3(prev.lat, prev.lng, GLOBE_HOME.alt) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, GLOBE_HOME.alt)
      c.smoothTime = 0.5
      await settle(c.setLookAt(far.x, far.y, far.z, 0, 0, 0, true), 1400)
      if (cancelled) return
      applyLimits(c, 'globe')
    }

    async function toRegion(lat, lng) {
      const p = latLngToVec3(lat, lng, GLOBE_HOME.alt)
      c.smoothTime = 0.5
      lastInteract.current = performance.now() // 이동 직후 자동 회전이 바로 시작되지 않게
      await settle(c.setLookAt(p.x, p.y, p.z, 0, 0, 0, true), 1300)
    }

    const run = pending.type === 'site' ? toSite(pending.id) : pending.type === 'region' ? toRegion(pending.lat, pending.lng) : toGlobe()
    run.finally(() => { if (!cancelled) useAppStore.getState().clearPending() })
    return () => { cancelled = true }
  }, [pending])

  // 패널에서 건물을 고르면 그 건물로 카메라 이동: 보는 각도는 그대로, 시점 중심만 건물로 옮기고 조금 가까이
  // (건물 배치는 날짜와 무관하게 고정이라 layoutCampus 만으로 위치를 구할 수 있음)
  const buildingFly = useAppStore((s) => s.buildingFly)
  useEffect(() => {
    const c = ref.current
    const st = useAppStore.getState()
    const site = selectSelectedSite(st)
    if (!c || !buildingFly || st.view !== 'site' || !site) return
    const L = layoutCampus(site._raw)
    const blocks = L.blocks.filter((b) => b.buildingId === buildingFly.id)
    if (!blocks.length) return
    manualView.current = true
    const x = blocks.reduce((a, b) => a + b.x, 0) / blocks.length
    const z = blocks.reduce((a, b) => a + b.z, 0) / blocks.length
    c.smoothTime = 0.35
    c.moveTo(x, 0, z, true)
    // 완성된 데이터홀(속을 여는 건물)은 랙이 보이도록 더 가까이, 그 밖은 캠퍼스가 보이는 거리
    const bld = site.buildings.find((b) => b.id === buildingFly.id)
    const opens = bld && bld.kind !== 'miner_hall' && ['operating', 'delivered', 'commissioning'].includes(bld.status)
    c.dollyTo(Math.max(c.minDistance * 1.15, Math.min(c.distance, L.side * (opens ? 1 : 1.3))), true) // 이미 가까우면 그대로
    // 속을 여는 건물은 위에서 더 내려다보게(극각 0.6rad ≈ 지면에서 56°) → 옆 건물에 속이 가리지 않음
    if (opens && c.polarAngle > 0.6) c.rotatePolarTo(0.6, true)
  }, [buildingFly])

  // 지구본 자동 회전: 조작 후 4초간, 핀 호버 중, 전환 중에는 멈춤
  useFrame((_, delta) => {
    const c = ref.current
    const st = useAppStore.getState()
    if (c && isCampusLike(st.view)) {
      const rect = safeRect.current ?? (st.view === 'hq' ? hqViewport(size.width, size.height) : campusViewport(size.width, size.height))
      const off = campusOffset(c.distance, size.width, size.height, rect)
      // 값이 바뀔 때만 적용: 매 프레임 호출하면 카메라가 "계속 움직이는 중"으로 남아 쉬지 못함
      const prev = lastOffset.current
      if (!prev || off.some((v, i) => Math.abs(v - prev[i]) > 1e-4)) {
        lastOffset.current = off
        c.setFocalOffset(...off, false)
      }
    } else {
      lastOffset.current = null // 캠퍼스를 벗어나면 잊음 → 다시 들어올 때 반드시 새로 적용
    }
    // 자동 투어 중 캠퍼스: 카메라가 천천히 돌아 입체감을 줌 (사용자가 직접 조작하면 그때부터 멈춤)
    if (c && st.tour && st.view === 'site' && !st.pending && !manualView.current) c.rotate(delta * 0.06, 0, false)
    if (!c || OVERVIEW !== 'globe' || st.view !== 'globe' || st.pending || st.hoverId) return
    if (performance.now() - lastInteract.current < 4000) return
    c.rotate(-delta * 0.035, 0, false)
  })

  const inputs=useMemo(()=>{
    const A=CameraControlsImpl.ACTION
    const pan=isCampusLike(view) && dragMode==='pan'
    return {
      mouseButtons:{left:pan?A.TRUCK:A.ROTATE,right:A.TRUCK,middle:A.DOLLY,wheel:A.DOLLY},
      touches:{one:pan?A.TOUCH_TRUCK:A.TOUCH_ROTATE,two:A.TOUCH_DOLLY_TRUCK,three:A.TOUCH_TRUCK},
    }
  },[view,dragMode])
  return <CameraControls ref={ref} makeDefault smoothTime={0.3} mouseButtons={inputs.mouseButtons} touches={inputs.touches}/>
}
