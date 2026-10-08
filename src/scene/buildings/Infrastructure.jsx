// =============================================================
// 캠퍼스 기반 시설: 변전소, 송전선, 크레인, 납품 트럭, 전력 흐름 점, 나무
// =============================================================
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Instances, Instance } from '@react-three/drei'
import { CampusLabel } from '../CampusLabel.jsx'
import { CatmullRomCurve3, Vector3 } from 'three'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'
import { fmtMw } from '../geo.js'
import { POWER_FLOW_COLOR } from '../powerFlow.js'
import { useReducedMotion } from '../useReducedMotion.js'

// ---------- 변전소 ----------
export function Substation({ sub, t, showLabel = true, children }) {
  const energized = sub.status === 'energized'
  const accent = energized ? styleOf('operating').color : PENDING_COLOR
  const ghost = !energized
  const mat = (color) => (
    <meshStandardMaterial color={color} transparent={ghost} opacity={ghost ? 0.35 : 1} roughness={0.7} />
  )
  return (
    <group position={[sub.x, 0, sub.z]}>
      {/* 자갈 패드 */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[sub.w, 0.1, sub.d]} />
        <meshStandardMaterial color="#cfd4e0" roughness={1} />
      </mesh>
      {/* 변압기 3대 */}
      {[-1.3, 0, 1.3].map((dz, i) => (
        <group key={i} position={[-0.7, 0, dz]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[1.3, 1, 0.9]} />
            {mat('#aeb7cc')}
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.4, 6]} />
            {mat(accent)}
          </mesh>
        </group>
      ))}
      {/* 철골 갠트리 (송전선이 들어오는 문) */}
      {[-1.8, 1.8].map((dz, i) => (
        <mesh key={i} position={[1.2, 1.4, dz]} castShadow>
          <boxGeometry args={[0.14, 2.8, 0.14]} />
          {mat('#8f99b3')}
        </mesh>
      ))}
      <mesh position={[1.2, 2.8, 0]} castShadow>
        <boxGeometry args={[0.14, 0.14, 3.7]} />
        {mat('#8f99b3')}
      </mesh>
      {children}
      {/* 라벨: 통전 완료면 전압·용량, 아니면 노란 "통전 예정" */}
      {showLabel && <CampusLabel position={[0, 3.6, 0]} priority={20}>
        <div className={`tag ${energized ? '' : 'tag-pending'}`}>
          {energized
            ? `${sub.voltage ? sub.voltage + ' · ' : ''}${fmtMw(sub.mw)}`
            : `${t.panel.energized} ${sub.dates?.target ?? ''}`}
        </div>
      </CampusLabel>}
    </group>
  )
}

// ---------- 타워 크레인 (건설중 표시) ----------
export function Crane({ x, z, seed = 0 }) {
  const jib = useRef()
  useFrame((_, delta) => { if (jib.current) jib.current.rotation.y += delta * 0.25 })
  const H = 6.5
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, H / 2, 0]} castShadow>
        <boxGeometry args={[0.28, H, 0.28]} />
        <meshStandardMaterial color={PENDING_COLOR} roughness={0.6} />
      </mesh>
      <group ref={jib} position={[0, H, 0]} rotation={[0, seed * 1.7, 0]}>
        <mesh position={[1.8, 0, 0]} castShadow>
          <boxGeometry args={[5.2, 0.22, 0.24]} />
          <meshStandardMaterial color={PENDING_COLOR} />
        </mesh>
        <mesh position={[-1.4, -0.15, 0]} castShadow>
          <boxGeometry args={[0.7, 0.45, 0.5]} />
          <meshStandardMaterial color="#6f7a95" />
        </mesh>
        {/* 갈고리 줄 */}
        <mesh position={[3.6, -1.2, 0]}>
          <boxGeometry args={[0.03, 2.4, 0.03]} />
          <meshStandardMaterial color="#55627f" />
        </mesh>
        <mesh position={[3.6, -2.45, 0]}>
          <boxGeometry args={[0.35, 0.2, 0.35]} />
          <meshStandardMaterial color="#55627f" />
        </mesh>
      </group>
    </group>
  )
}

// 건물까지의 연결이 확인되지 않은 납품은 도로 옆 공용 하역장으로 들어옵니다.
export function ReceivingBay({ bay }) {
  return <group position={[bay.x, 0, bay.z]}>
    <mesh position={[0, .04, 0]} receiveShadow>
      <boxGeometry args={[bay.w, .06, bay.d]}/>
      <meshStandardMaterial color="#a4afa9" roughness={.95}/>
    </mesh>
    <Line points={[[-1, .09, 2.2], [-1, .09, -2], [1, .09, -2], [1, .09, 2.2]]} color="#f4e8b4" lineWidth={1.5}/>
    {[-.5, .6].map(z=><group key={z} position={[1.7, 0, z]}>
      <mesh position={[0, .43, 0]} castShadow>
        <boxGeometry args={[.65, .8, .8]}/><meshStandardMaterial color="#c6b493" roughness={.9}/>
      </mesh>
      <mesh position={[0, .835, 0]}>
        <boxGeometry args={[.14, .02, .81]}/><meshStandardMaterial color="#e6dcc8"/>
      </mesh>
    </group>)}
  </group>
}

// ---------- 납품 트럭 (GPU 납품 예정) ----------
// 경로(path)를 일정 속도로 달려 하역 지점에 멈췄다가 다시 처음부터 반복합니다.
export function Truck({ truck, index, lang }) {
  const ref = useRef()
  const reducedMotion = useReducedMotion() // 모션 감소 설정 (설정을 바꾸면 바로 반영)
  const { segs, total } = useMemo(() => {
    const segs = []
    let total = 0
    for (let i = 0; i < truck.path.length - 1; i++) {
      const [ax, az] = truck.path[i], [bx, bz] = truck.path[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      segs.push({ ax, az, bx, bz, len, start: total })
      total += len
    }
    return { segs, total }
  }, [truck.path])

  const SPEED = 4 // 초당 이동 거리
  const PAUSE = 2.5
  useFrame(({ clock }) => {
    if (!ref.current || total === 0) return
    const cycle = total / SPEED + PAUSE
    const t = reducedMotion ? cycle * ((index + 1) / (index + 2)) : (clock.elapsedTime + index * 3.3) % cycle
    const dist = Math.min(total, t * SPEED)
    const seg = segs.find((s) => dist <= s.start + s.len) ?? segs[segs.length - 1]
    const k = seg.len ? (dist - seg.start) / seg.len : 1
    ref.current.position.set(seg.ax + (seg.bx - seg.ax) * k, 0, seg.az + (seg.bz - seg.az) * k)
    ref.current.rotation.y = Math.atan2(seg.bx - seg.ax, seg.bz - seg.az)
  })

  const d = truck.delivery
  return (
    <group ref={ref}>
      {/* 운전석 */}
      <mesh position={[0, 0.55, 1.15]} castShadow>
        <boxGeometry args={[1, 0.85, 0.8]} />
        <meshStandardMaterial color="#2f6bed" roughness={0.5} />
      </mesh>
      {/* 컨테이너 (노랑 = 납품 예정) */}
      <mesh position={[0, 0.7, -0.35]} castShadow>
        <boxGeometry args={[1.05, 1.05, 2.1]} />
        <meshStandardMaterial color={PENDING_COLOR} roughness={0.6} />
      </mesh>
      {/* 바퀴 */}
      {[[-0.5, 1.1], [0.5, 1.1], [-0.5, -0.9], [0.5, -0.9]].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.2, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 10]} />
          <meshStandardMaterial color="#3a4256" />
        </mesh>
      ))}
      <CampusLabel position={[0, 2, 0]} priority={0} hideOnOverlap>
        {/* 모델·목표 시기만 짧게 표시하고, 다른 라벨과 겹치면 숨깁니다. */}
        <div className="tag tag-pending truck-label" title={`${lang === 'ko' ? '납품 계획' : 'Delivery plan'} · ${d.what} · ${d.from}`}>
          {d.what.replace(/\s*\([^)]*\)/g, '')} · {d.eta}
        </div>
      </CampusLabel>
    </group>
  )
}

// ---------- 전력 흐름 점: 변전소 → 완공 설비 (통전 표현, 건물 상태와 별도) ----------
export function FlowDots({ from, targets }) {
  const reducedMotion = useReducedMotion()
  const curves = useMemo(
    () =>
      targets.map((tg) => {
        // 변전소에서 나와 건물 줄 높이까지 갔다가 건물로 들어가는 꺾인 경로
        const pts = [
          new Vector3(from[0] + 2, 0.35, from[1]),
          new Vector3(from[0] + 2, 0.35, tg.z),
          new Vector3(tg.x - tg.w / 2 - 0.2, 0.35, tg.z),
        ]
        return new CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
      }),
    [from, targets],
  )
  const PER = 4 // 경로당 점 개수
  const refs = useRef([])
  useFrame(({ clock }) => {
    curves.forEach((c, ci) => {
      for (let i = 0; i < PER; i++) {
        const m = refs.current[ci * PER + i]
        if (!m) continue
        const t = ((reducedMotion ? 0 : clock.elapsedTime * 0.25) + i / PER) % 1
        c.getPointAt(t, m.position)
      }
    })
  })
  return (
    <group>
      {curves.map((c, ci) => {
        const color = POWER_FLOW_COLOR
        return (
          <group key={ci}>
            <Line points={c.getPoints(20)} color={color} lineWidth={1.5} transparent opacity={0.55} />
            {Array.from({ length: PER }, (_, i) => (
              <mesh key={i} ref={(el) => (refs.current[ci * PER + i] = el)}>
                <sphereGeometry args={[0.18, 8, 6]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// ---------- 부지 주변 나무 (인스턴싱으로 1번에 그림) ----------
export function Trees({ side, seed = 1, roadZ = null }) {
  const trees = useMemo(() => {
    // 결정적 의사난수: 같은 사이트는 항상 같은 배치
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const arr = []
    const half = side / 2
    for (let i = 0; i < 70; i++) {
      const angle = rnd() * Math.PI * 2
      const r = half * (1.25 + rnd() * 0.9)
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      if (roadZ != null && Math.abs(z - roadZ) < 3) continue // 도로 위에는 심지 않기
      arr.push({ x, z, s: 0.7 + rnd() * 0.8 })
    }
    return arr
  }, [side, seed, roadZ])
  return (
    <group>
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[0.9, 2.2, 6]} />
        <meshStandardMaterial color="#9ccfb4" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 1.1 * t.s + 0.4, t.z]} scale={t.s} />
        ))}
      </Instances>
      <Instances limit={trees.length}>
        <cylinderGeometry args={[0.12, 0.12, 0.8, 5]} />
        <meshStandardMaterial color="#b8a48c" />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.4, t.z]} scale={t.s} />
        ))}
      </Instances>
    </group>
  )
}
