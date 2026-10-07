// =============================================================
// CameraRig — 카메라 이동과 "지구본 ↔ 캠퍼스" 전환 연출 담당
// -------------------------------------------------------------
// 흐름 (사이트 진입):
//   핀 클릭 → store.requestSite(id) → (여기서) 핀 쪽으로 줌인 1.2초
//   → 화면 페이드 → store.selectSite(id) 로 view 전환 → 캠퍼스 시점으로 순간 이동
//   → 페이드 아웃
// 지구본으로 돌아갈 때는 역순입니다.
// =============================================================
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { latLngToVec3 } from './geo.js'
import { layoutCampus } from './layoutCampus.js'
import { Box3, Vector3 } from 'three'
import { SINGLE_COMPANY } from '../config.js'
import { layoutBounds } from './boards.js'
import { boardPinPositions } from './BoardView.jsx'

// 개요 화면 종류: 단일 회사 모드는 보드판 지도, 아니면 지구본
const OVERVIEW = SINGLE_COMPANY ? 'board' : 'globe'

// ---------- 보드판 카메라 ----------
// 보드 전체가 UI 패널(위 KPI, 아래 슬라이더, 왼쪽 목록)을 피해 화면에 들어오는 거리와 시점
const BOARD_DIR = new Vector3(0, 0.8, 0.6).normalize() // 위에서 약 37° 기울여 내려다봄
function boardHome() {
  const b = layoutBounds()
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  const mobile = window.innerWidth < 768
  const T = 0.536 // 2·tan(15°), fov 30
  // 데스크톱은 왼쪽 목록(약 30%)·위아래 패널(약 38%)이 가리므로 보이는 영역 기준으로 맞춤
  const usableW = mobile ? 0.98 : 0.6
  const usableH = mobile ? 0.62 : 0.66
  const needW = (b.w + 6) / (T * aspect * usableW)
  const needH = (b.d * 0.8 + 14) / (T * usableH)
  const D = Math.max(needW, needH)
  const target = new Vector3(b.cx, 0, b.cz + 2)
  return { target, pos: target.clone().addScaledVector(BOARD_DIR, D), D }
}
// 보드 위 한 지점을 가까이 내려다보는 시점
function boardCloseUp(x, z) {
  return { target: new Vector3(x, 0, z), pos: new Vector3(x + 4, 26, z + 20) }
}

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

// 캠퍼스 기본 시점: 부지 크기에 맞춰 대각선 위에서 내려다봄 (준아이소메트릭)
function campusHome(side) {
  // 세로로 긴 화면(모바일)은 가로 시야가 좁으므로 그만큼 멀리서 봅니다
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  const k = aspect < 1 ? Math.min(2.5, 1.05 / aspect) : 1
  const d = side * 1.32 * Math.max(1, k)
  return [d, d * 0.95, d, 0, 0, 0]
}

// 상세 패널이 화면 일부를 가리므로 캠퍼스를 보이는 영역 가운데로 밀어 줍니다.
// focalOffset 은 "화면 기준" 평행이동이라 회전해도 패널 반대쪽에 머뭅니다.
function applyFocalOffset(c, view, side, transition) {
  const mobile = window.innerWidth < 768
  // 보드판: 데스크톱은 왼쪽 목록을 피해 보드를 오른쪽으로, 모바일은 하단 패널을 피해 위로
  if (view !== 'site' && OVERVIEW === 'board') {
    const { D } = boardHome()
    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    const visW = 0.536 * D * aspect
    return c.setFocalOffset(mobile ? 0 : -visW * 0.12, mobile ? -0.536 * D * 0.012 : -0.536 * D * 0.02, 0, transition)
  }
  // 지구본: 데스크톱에서는 왼쪽 사이트 목록을 피해 지구본을 오른쪽으로
  if (view !== 'site') return c.setFocalOffset(mobile ? 0 : -28, 0, 0, transition)
  if (mobile) return c.setFocalOffset(0, side * 0.3, 0, transition) // 바텀시트(화면 아래 42%) → 캠퍼스를 위로 (+y = 화면 위)
  return c.setFocalOffset(side * 0.22, -side * 0.05, 0, transition)   // 오른쪽 패널 → 왼쪽으로, 상단 KPI → 살짝 아래로
}

// 뷰별 카메라 제약
function applyLimits(c, view, side = 30) {
  if (view === 'globe' && OVERVIEW === 'board') {
    const { D } = boardHome()
    const b = layoutBounds()
    c.minDistance = 25
    c.maxDistance = D * 1.4
    c.minPolarAngle = 0.12
    c.maxPolarAngle = 1.15        // 판 옆면 아래로 내려가지 않게
    c.minAzimuthAngle = -0.9      // 좌우 회전은 ±50° 정도까지만 (보드판 정면 유지)
    c.maxAzimuthAngle = 0.9
    c.truckSpeed = 1.5
    c.dollySpeed = 0.8
    // 평행이동은 보드 범위 안에서만
    c.setBoundary(new Box3(new Vector3(b.x0, -5, b.z0), new Vector3(b.x1, 5, b.z1)))
    return
  }
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
    c.minDistance = side * 0.9
    c.maxDistance = side * 7
    c.minPolarAngle = 0.35 // 너무 위에서 수직으로 내려다보지 않게
    c.maxPolarAngle = 1.2  // 바닥 아래로 들어가지 않게
    c.truckSpeed = 1
    c.dollySpeed = 0.8
  }
}

export default function CameraRig() {
  const ref = useRef()
  const lastInteract = useRef(-Infinity)
  const pending = useAppStore((s) => s.pending)

  // 처음 마운트: 딥링크(#site=...)면 캠퍼스, 아니면 지구본 시점
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const st = useAppStore.getState()
    const site = selectSelectedSite(st)
    if (st.view === 'site' && site) {
      const L = layoutCampus(site._raw)
      applyLimits(c, 'site', L.side)
      c.setLookAt(...campusHome(L.side), false)
      applyFocalOffset(c, 'site', L.side, false)
    } else if (OVERVIEW === 'board') {
      applyLimits(c, 'globe')
      applyFocalOffset(c, 'globe', 0, false)
      const { pos, target } = boardHome()
      c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false)
    } else {
      applyLimits(c, 'globe')
      applyFocalOffset(c, 'globe', 0, false)
      const p = latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, GLOBE_HOME.alt)
      c.setLookAt(p.x, p.y, p.z, 0, 0, 0, false)
    }
    // 사용자가 직접 조작하면 자동 회전을 잠시 멈춥니다
    const onStart = () => { lastInteract.current = performance.now() }
    c.addEventListener('controlstart', onStart)
    return () => c.removeEventListener('controlstart', onStart)
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
      // 1) 보드판이면 그 핀을 가까이 내려다보도록 줌인
      if (st.view === 'globe' && OVERVIEW === 'board') {
        const p = boardPinPositions(st.data.sites)[id]
        if (p) {
          c.minDistance = 0
          c.setBoundary(null)
          const { pos, target } = boardCloseUp(p.x, p.z)
          c.smoothTime = 0.45
          await settle(c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true), 1000)
        }
      } else if (st.view === 'globe') {
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
      st.selectSite(id)
      const L = layoutCampus(site._raw)
      applyLimits(c, 'site', L.side)
      c.smoothTime = 0.25
      const [px, py, pz] = campusHome(L.side)
      // 살짝 멀리서 시작해 안으로 들어오는 느낌
      c.setLookAt(px * 1.6, py * 1.6, pz * 1.6, 0, 0, 0, false)
      applyFocalOffset(c, 'site', L.side, false)
      await sleep(30)
      st.setTransitioning(false)
      await settle(c.setLookAt(px, py, pz, 0, 0, 0, true), 1200)
    }

    async function toGlobe() {
      const prev = selectSelectedSite(st)
      st.setTransitioning(true)
      await sleep(FADE_MS)
      st.goGlobe()
      if (OVERVIEW === 'board') {
        // 방금 보던 사이트 핀 바로 위에서 시작해 보드 전체로 빠져나옴
        applyLimits(c, 'globe')
        applyFocalOffset(c, 'globe', 0, false)
        c.minDistance = 0
        c.setBoundary(null)
        const p = prev ? boardPinPositions(st.data.sites)[prev.id] : null
        const near = p ? boardCloseUp(p.x, p.z) : boardHome()
        c.setLookAt(near.pos.x, near.pos.y, near.pos.z, near.target.x, near.target.y, near.target.z, false)
        await sleep(30)
        st.setTransitioning(false)
        const home = boardHome()
        c.smoothTime = 0.5
        await settle(c.setLookAt(home.pos.x, home.pos.y, home.pos.z, home.target.x, home.target.y, home.target.z, true), 1300)
        applyLimits(c, 'globe')
        return
      }
      applyLimits(c, 'globe')
      applyFocalOffset(c, 'globe', 0, false)
      c.minDistance = 0
      // 방금 보던 사이트 바로 위에서 시작해 바깥으로 빠져나옴
      const near = prev ? latLngToVec3(prev.lat, prev.lng, 0.7) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, 0.7)
      const target = prev ? latLngToVec3(prev.lat, prev.lng, 0) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, 0)
      c.setLookAt(near.x, near.y, near.z, target.x, target.y, target.z, false)
      await sleep(30)
      st.setTransitioning(false)
      const far = prev ? latLngToVec3(prev.lat, prev.lng, GLOBE_HOME.alt) : latLngToVec3(GLOBE_HOME.lat, GLOBE_HOME.lng, GLOBE_HOME.alt)
      c.smoothTime = 0.5
      await settle(c.setLookAt(far.x, far.y, far.z, 0, 0, 0, true), 1400)
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

  // 지구본 자동 회전: 조작 후 4초간, 핀 호버 중, 전환 중에는 멈춤
  useFrame((_, delta) => {
    const c = ref.current
    const st = useAppStore.getState()
    if (!c || OVERVIEW !== 'globe' || st.view !== 'globe' || st.pending || st.hoverId) return
    if (performance.now() - lastInteract.current < 4000) return
    c.rotate(-delta * 0.035, 0, false)
  })

  return <CameraControls ref={ref} makeDefault smoothTime={0.3} />
}
