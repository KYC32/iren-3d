// =============================================================
// 캠퍼스 기반 시설: 변전소, 송전선, 크레인, 납품 트럭, 전력 흐름 점, 나무
// =============================================================
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Instances, Instance } from '@react-three/drei'
import Html from '../SafeHtml.jsx'
import { CatmullRomCurve3, Vector3 } from 'three'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'
import { fmtMw } from '../geo.js'

// ---------- 변전소 ----------
export function Substation({ sub, t }) {
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
      {/* 라벨: 통전 완료면 전압·용량, 아니면 노란 "통전 예정" */}
      <Html position={[0, 3.6, 0]} center zIndexRange={[10, 0]}>
        <div className={`tag ${energized ? '' : 'tag-pending'}`}>
          {energized
            ? `${sub.voltage ? sub.voltage + ' · ' : ''}${fmtMw(sub.mw)}`
            : `${t.panel.energized} ${sub.dates?.target ?? ''}`}
        </div>
      </Html>
    </group>
  )
}

// ---------- 송전선 (부지 밖 → 변전소) ----------
export function PowerLine({ line }) {
  const [fx, fz] = line.from
  const [tx, tz] = line.to
  const towers = [0, 0.5, 1].map((k) => [fx + (tx - fx) * k * 0.85, fz + (tz - fz) * k])
  const wireY = 3.4
  // 철탑 사이 전선은 살짝 처지게(현수선 근사)
  const wire = useMemo(() => {
    const pts = []
    for (let i = 0; i < towers.length - 1; i++) {
      const [ax, az] = towers[i], [bx, bz] = towers[i + 1]
      for (let s = 0; s <= 8; s++) {
        const k = s / 8
        pts.push([ax + (bx - ax) * k, wireY - Math.sin(Math.PI * k) * 0.5, az + (bz - az) * k])
      }
    }
    pts.push([tx + 1.2, 2.8, tz])
    return pts
  }, [fx, fz, tx, tz])
  return (
    <group>
      {towers.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.22, 3.6, 4]} />
            <meshStandardMaterial color="#8f99b3" />
          </mesh>
          <mesh position={[0, 3.45, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.4]} />
            <meshStandardMaterial color="#8f99b3" />
          </mesh>
        </group>
      ))}
      <Line
        points={wire}
        color={line.energized ? '#55627f' : PENDING_COLOR}
        lineWidth={line.energized ? 1.4 : 2}
        dashed={!line.energized}
        dashSize={0.5}
        gapSize={0.35}
      />
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

// ---------- 납품 트럭 (GPU 납품 예정) ----------
// 경로(path)를 일정 속도로 달려 건물 앞에 멈췄다가 다시 처음부터 반복합니다.
export function Truck({ truck, index, lang }) {
  const ref = useRef()
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
    const t = (clock.elapsedTime + index * 3.3) % cycle
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
      <Html position={[0, 2, 0]} center zIndexRange={[15, 0]}>
        <div className="tag tag-pending">
          {d.what} · {d.eta}
        </div>
      </Html>
    </group>
  )
}

// ---------- 전력 흐름 점: 변전소 → 가동/시운전 건물 ----------
export function FlowDots({ from, targets }) {
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
        const t = (clock.elapsedTime * 0.25 + i / PER) % 1
        m.position.copy(c.getPointAt(t))
      }
    })
  })
  return (
    <group>
      {curves.map((c, ci) => (
        <group key={ci}>
          <Line points={c.getPoints(20)} color="#9fd9c5" lineWidth={1} transparent opacity={0.8} />
          {Array.from({ length: PER }, (_, i) => (
            <mesh key={i} ref={(el) => (refs.current[ci * PER + i] = el)}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color="#2ea88a" emissive="#2ea88a" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      ))}
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
