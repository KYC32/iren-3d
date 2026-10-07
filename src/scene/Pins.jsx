// =============================================================
// Pins — 지구본 위 사이트 핀 (인스턴싱) + 무리 라벨
// -------------------------------------------------------------
// 사이트가 수십~수백 곳이 되어도 가볍도록, 막대·머리·링을 각각 InstancedMesh 하나로 그립니다.
// (핀 50개를 개별 메시로 그리면 150개 메시 + 50개 프레임 콜백 → 인스턴싱은 3개 + 1개)
// 색·높이·필터 흐림·호버 확대·링 펄스는 useFrame 하나에서 매 프레임 갱신합니다.
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, CylinderGeometry, Object3D, Quaternion, RingGeometry, SphereGeometry, Vector3 } from 'three'
import { useAppStore, isSiteActive, EMPTY } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { latLngToVec3, spreadPins, labelRanks, pinHeight, fmtMw } from './geo.js'
import { pickName } from '../i18n/useT.js'

const UP = new Vector3(0, 1, 0)
const DIM = new Color('#c3c9d8')   // 필터에서 빠진 사이트 색
const RING_BG = new Color('#cdd8f3') // 링이 사라질 때 섞는 색 (바다색에 가깝게)
const EXPAND_DISTANCE = 300        // 카메라가 이보다 가까우면 촘촘한 무리 기준으로 라벨을 펼침

// 핀 색: 상태색 모드 / 회사색 모드
export function pinColor(site, mode, companyColor) {
  if (mode === 'company') return companyColor[site.primary] ?? '#888888'
  return styleOf(site.status).color
}

// 기본 지오메트리: 원점이 핀 바닥에 오도록 미리 옮겨 둠
function useGeometries() {
  return useMemo(() => {
    const bar = new CylinderGeometry(1.1, 1.4, 1, 12)
    bar.translate(0, 0.5, 0) // 높이 1 짜리를 바닥 기준으로 → scale.y = 핀 높이
    const cap = new SphereGeometry(1.9, 16, 12)
    const ring = new RingGeometry(1.8, 2.5, 32)
    ring.rotateX(-Math.PI / 2) // 지표면에 눕힘
    return { bar, cap, ring }
  }, [])
}

export function PinsInstanced({ sites }) {
  const geo = useGeometries()
  const barRef = useRef(), capRef = useRef(), ringRef = useRef()
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const companies = useAppStore((s) => s.data?.companies ?? EMPTY)
  const companyColor = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.color])), [companies])

  // 사이트별 고정 정보: 지표 위치·방향 (가까운 핀은 화면용으로 살짝 벌림)
  const placed = useMemo(() => {
    const display = spreadPins(sites, 0.8)
    return sites.map((s) => {
      const d = display[s.id]
      const base = latLngToVec3(d.lat, d.lng, 0)
      const n = base.clone().normalize()
      return { site: s, base, n, q: new Quaternion().setFromUnitVectors(UP, n) }
    })
  }, [sites])

  const dummy = useMemo(() => new Object3D(), [])
  const col = useMemo(() => new Color(), [])
  const count = placed.length

  // 사이트 목록이 바뀌면 클릭 판정용 경계구를 다시 계산
  useEffect(() => {
    for (const r of [barRef, capRef]) {
      if (!r.current) continue
      r.current.instanceMatrix.needsUpdate = true
      r.current.computeBoundingSphere()
    }
  }, [placed])

  useFrame(({ clock }) => {
    const bar = barRef.current, cap = capRef.current, ring = ringRef.current
    if (!bar || !cap || !ring) return
    const st = useAppStore.getState()
    const t = clock.elapsedTime
    placed.forEach((p, i) => {
      const s = p.site
      const active = isSiteActive(st, s)
      const hovered = st.hoverId === s.id
      const h = pinHeight(s.grid_mw)
      const k = hovered ? 1.25 : active ? 1 : 0.75

      // 막대
      dummy.position.copy(p.base)
      dummy.quaternion.copy(p.q)
      dummy.scale.set(k, h, k)
      dummy.updateMatrix()
      bar.setMatrixAt(i, dummy.matrix)
      // 머리 (막대 끝)
      dummy.position.copy(p.base).addScaledVector(p.n, h + 0.8)
      dummy.scale.setScalar(k)
      dummy.updateMatrix()
      cap.setMatrixAt(i, dummy.matrix)

      // 색: 필터에서 빠지면 회색, 계획 단계는 밝게(반투명 느낌)
      col.set(active ? pinColor(s, st.colorMode, companyColor) : DIM)
      if (active && s.status === 'planned') col.offsetHSL(0, -0.05, 0.1)
      bar.setColorAt(i, col)
      col.offsetHSL(0, 0, 0.1)
      cap.setColorAt(i, col)

      // 링 펄스: 상태별 속도로 커지며 바다색으로 녹아 사라짐 (링은 항상 상태색)
      const speed = styleOf(s.status).ringSpeed
      const ph = speed > 0 ? (t * speed * 0.6 + i * 0.137) % 1 : 1
      const rs = active ? 1 + ph * 2.4 : 0.001
      dummy.position.copy(p.base).addScaledVector(p.n, 0.25)
      dummy.scale.setScalar(rs)
      dummy.updateMatrix()
      ring.setMatrixAt(i, dummy.matrix)
      col.set(styleOf(s.status).color).lerp(RING_BG, ph)
      ring.setColorAt(i, col)
    })
    for (const m of [bar, cap, ring]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })

  // 클릭·호버: instanceId 로 사이트를 찾음
  const handlers = {
    onPointerMove: (e) => {
      e.stopPropagation()
      const s = placed[e.instanceId]?.site
      if (s && useAppStore.getState().hoverId !== s.id) setHover(s.id)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => { setHover(null); document.body.style.cursor = '' },
    onClick: (e) => {
      e.stopPropagation()
      const s = placed[e.instanceId]?.site
      if (s) requestSite(s.id)
    },
  }

  if (!count) return null
  return (
    <group>
      <instancedMesh key={`bar-${count}`} ref={barRef} args={[geo.bar, null, count]} frustumCulled={false} {...handlers}>
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh key={`cap-${count}`} ref={capRef} args={[geo.cap, null, count]} frustumCulled={false} {...handlers}>
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <instancedMesh key={`ring-${count}`} ref={ringRef} args={[geo.ring, null, count]} frustumCulled={false} raycast={() => null}>
        <meshBasicMaterial transparent opacity={0.7} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}

// ---------- 무리 라벨 ----------
// 멀리서는 5.5° 안의 사이트를 한 무리(대표 + "+N"), 가까이 줌하면 1.5° 기준으로 더 잘게 나눠 펼칩니다.
export function PinLabels({ sites }) {
  const [near, setNear] = useState(false)
  const farRanks = useMemo(() => labelRanks(sites, 5.5), [sites])
  const nearRanks = useMemo(() => labelRanks(sites, 1.5), [sites])
  const display = useMemo(() => spreadPins(sites, 0.8), [sites])
  // 카메라 거리가 기준선을 넘을 때만 상태를 바꿔 다시 그림 (매 프레임 리렌더 방지)
  useFrame(({ camera }) => {
    const n = camera.position.length() < EXPAND_DISTANCE
    if (n !== near) setNear(n)
  })
  const ranks = near ? nearRanks : farRanks
  return sites
    .filter((s) => ranks[s.id].lead)
    .map((s) => <PinLabel key={s.id} site={s} pos={display[s.id]} members={ranks[s.id].members} expanded={near} />)
}

function PinLabel({ site, pos, members, expanded }) {
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const colorMode = useAppStore((s) => s.colorMode)
  const companies = useAppStore((s) => s.data?.companies ?? EMPTY)
  const companyColor = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.color])), [companies])
  const ref = useRef()
  const { position, normal } = useMemo(() => {
    const base = latLngToVec3(pos.lat, pos.lng, 0)
    const n = base.clone().normalize()
    return { position: base.clone().addScaledVector(n, pinHeight(site.grid_mw) + 3.2), normal: n }
  }, [pos.lat, pos.lng, site.grid_mw])
  const tmp = useMemo(() => new Vector3(), [])

  // 지구 뒤편이면 숨김 + 필터에서 빠진 무리는 흐리게
  useFrame(({ camera }) => {
    if (!ref.current) return
    tmp.copy(camera.position).sub(position).normalize()
    const show = tmp.dot(normal) > 0.15
    const st = useAppStore.getState()
    const anyActive = [site, ...members].some((m) => isSiteActive(st, m))
    ref.current.style.opacity = show ? (anyActive ? 1 : 0.35) : 0
    ref.current.style.pointerEvents = show ? 'auto' : 'none'
  })

  const list = [site, ...members]
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <div ref={ref} className="pin-cluster" data-expanded={expanded ? '1' : '0'}>
        {list.map((m, i) => (
          <button
            key={m.id}
            className={`pin-label${hoverId === m.id ? ' is-hover' : ''}${i > 0 ? ' member' : ''}`}
            onPointerEnter={() => setHover(m.id)}
            onPointerLeave={() => setHover(null)}
            onClick={() => requestSite(m.id)}
          >
            <span className="dot" style={{ background: pinColor(m, colorMode, companyColor) }} />
            <span className="name">{pickName(m, lang)}</span>
            <span className="mw">{fmtMw(m.grid_mw)}</span>
            {i === 0 && members.length > 0 && <span className="more">+{members.length}</span>}
          </button>
        ))}
      </div>
    </Html>
  )
}
