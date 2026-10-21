// =============================================================
// HqCity — 본사 3D 화면의 동네 (시드니 도심 모퉁이 꾸밈): 바닥 판 · 도로 · 인도 · 차선 · 횡단보도 ·
//          이웃 빌딩(창문 그림) · 가로수 · 가로등(밤엔 불빛 웅덩이) · 자동차
// -------------------------------------------------------------
// 배치는 hqCity.js (순수 계산 · 테스트), 창문 그림은 facade.js
// 밤: 빌딩 창문은 HqView 가 nightList 로 한꺼번에, 가로등·불빛 웅덩이는 여기서 SKY.lights 로 매 프레임
// 꾸밈일 뿐 실제 배치가 아님 — 카드에 '건물은 단순화한 모형'이라 밝힘
// =============================================================
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three'
import { hqCityLayout, ROAD_W, ROAD_AT } from './hqCity.js'
import { facadeMaterial } from './facade.js'
import { PLOT } from './hqTower.js'
import { SKY } from './nightLights.js'

const C = { ground: '#cfcbbf', block: '#dedad0', grass: '#a6c98f', road: '#737d8b', walk: '#ebe7dd', kerb: '#cfcabe', mark: '#f4f2ea', roof: '#c7cdd5', trunk: '#7a5d45', lampPole: '#3d4a57' }
const LEAVES = ['#6f9e5e', '#5f8f52', '#7fae68', '#86b56f']

export default function HqCity({ nightList }) {
  const L = useMemo(() => hqCityLayout(), [])
  const half = PLOT / 2
  const r0 = ROAD_AT - ROAD_W / 2, r1 = ROAD_AT + ROAD_W / 2
  return (
    <group name="hq-city">
      {/* 바닥 판 (블록 바닥) */}
      <RoundedBox args={[PLOT, 0.5, PLOT]} radius={0.3} position={[0, -0.25, 0]} receiveShadow>
        <meshStandardMaterial color={C.ground} roughness={0.95} />
      </RoundedBox>
      {/* 도로 두 개 (Market St = x 방향, Pitt St = z 방향) */}
      <mesh position={[0, 0.02, ROAD_AT]} receiveShadow><boxGeometry args={[PLOT, 0.04, ROAD_W]} /><meshStandardMaterial color={C.road} roughness={0.9} /></mesh>
      <mesh position={[ROAD_AT, 0.021, 0]} receiveShadow><boxGeometry args={[ROAD_W, 0.04, PLOT]} /><meshStandardMaterial color={C.road} roughness={0.9} /></mesh>
      {/* 블록 바닥 (인도와 같은 높이 0.12 — 빌딩·나무가 이 위에 섬) */}
      {L.blocks.map((k, i) => (
        <mesh key={`b${i}`} position={[(k.x0 + k.x1) / 2, 0.06, (k.z0 + k.z1) / 2]} receiveShadow>
          <boxGeometry args={[k.x1 - k.x0, 0.12, k.z1 - k.z0]} />
          <meshStandardMaterial color={C.block} roughness={0.95} />
        </mesh>
      ))}
      {/* 인도 (블록보다 밝은 판석) */}
      {L.walks.map((w, i) => (
        <mesh key={i} position={[(w.x0 + w.x1) / 2, 0.06, (w.z0 + w.z1) / 2]} receiveShadow>
          <boxGeometry args={[w.x1 - w.x0, 0.12, w.z1 - w.z0]} />
          <meshStandardMaterial color={C.walk} roughness={0.95} />
        </mesh>
      ))}
      <Markings half={half} r0={r0} r1={r1} crossings={L.crossings} />
      {/* 이웃 빌딩 */}
      {L.buildings.map((b, i) => <Neighbor key={i} b={b} i={i} nightList={nightList} />)}
      {/* 공원 잔디 (카메라 쪽 두 블록) + 공원 나무 */}
      {L.parks.map((k, i) => (
        <mesh key={`p${i}`} position={[(k.x0 + k.x1) / 2, 0.135, (k.z0 + k.z1) / 2]} receiveShadow>
          <boxGeometry args={[k.x1 - k.x0 - 0.3, 0.03, k.z1 - k.z0 - 0.3]} />
          <meshStandardMaterial color={C.grass} roughness={1} />
        </mesh>
      ))}
      <Trees points={L.trees} />
      <Trees points={L.parkTrees} big />
      <Lamps points={L.lamps} />
      {L.cars.map((c, i) => <Car key={i} c={c} />)}
    </group>
  )
}

// 차선 가운데 점선 + 횡단보도 줄무늬 (같은 흰 재질, 한 묶음으로)
function Markings({ half, r0, r1, crossings }) {
  const items = useMemo(() => {
    const out = []
    // 가운데 점선: 모퉁이(교차로) 안은 비움
    for (let v = -half + 1; v <= half - 1; v += 1.6) {
      if (Math.abs(v - ROAD_AT) < ROAD_W) continue
      out.push({ p: [v, 0.045, ROAD_AT], s: [0.8, 0.01, 0.1] })   // Market St
      out.push({ p: [ROAD_AT, 0.046, v], s: [0.1, 0.01, 0.8] })   // Pitt St
    }
    // 횡단보도: 길을 건너는 방향으로 줄무늬
    for (const c of crossings) {
      for (let t = r0 + 0.3; t <= r1 - 0.3 + 1e-9; t += 0.52) {
        if (c.across === 'z') out.push({ p: [c.x, 0.047, t], s: [1.2, 0.012, 0.28] })
        else out.push({ p: [t, 0.047, c.z], s: [0.28, 0.012, 1.2] })
      }
    }
    return out
  }, [half, r0, r1, crossings])
  return <Boxes items={items} color={C.mark} />
}

// 같은 재질의 작은 상자 여러 개를 InstancedMesh 하나로 (그리기 호출 1번)
function Boxes({ items, color, castShadow = false }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = new Object3D()
    items.forEach((it, i) => { o.position.set(...it.p); o.scale.set(...it.s); o.rotation.set(0, it.ry ?? 0, 0); o.updateMatrix(); ref.current.setMatrixAt(i, o.matrix) })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} castShadow={castShadow} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </instancedMesh>
  )
}

// 이웃 빌딩 한 채: 네 벽 = 창문 그림(모양별), 지붕 = 회색 + 옥상 기계실 하나
function Neighbor({ b, i, nightList }) {
  const mats = useMemo(() => {
    const roof = new MeshStandardMaterial({ color: C.roof, roughness: 0.85 })
    const oy = (i * 0.37) % 1 // 빌딩마다 다른 창이 켜지게 그림 시작 위치를 비킴
    const sideX = facadeMaterial(b.style, b.d, b.h, nightList, { oy }) // ±x 벽 (폭 = d)
    const sideZ = facadeMaterial(b.style, b.w, b.h, nightList, { oy: (oy + 0.5) % 1 }) // ±z 벽 (폭 = w)
    return [sideX, sideX, roof, roof, sideZ, sideZ] // 상자 면 순서: +x, −x, +y, −y, +z, −z
  }, [b, i, nightList])
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2 + 0.12, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
      </mesh>
      {b.h > 3 && (
        <mesh position={[b.w * 0.12, b.h + 0.12 + 0.28, -b.d * 0.1]} castShadow>
          <boxGeometry args={[b.w * 0.36, 0.56, b.d * 0.3]} />
          <meshStandardMaterial color="#b7bec8" roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

// 가로수: 줄기 + 잎(각진 공) — InstancedMesh 두 개, 잎 색은 조금씩 다르게
//   big: 공원 나무 (조금 크게)
function Trees({ points, big = false }) {
  const trunks = useRef(), leaves = useRef()
  useLayoutEffect(() => {
    const o = new Object3D(), col = new Color()
    points.forEach((p, i) => {
      const k = (big ? 1.15 : 0.85) + ((i * 7) % 5) * 0.06 // 나무마다 크기 조금씩
      o.position.set(p.x, 0.12 + 0.45 * k, p.z); o.scale.set(1, k, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.current.setMatrixAt(i, o.matrix)
      o.position.set(p.x, 0.12 + 1.15 * k, p.z); o.scale.set(k, k * 0.95, k); o.rotation.set(0, i * 0.7, 0); o.updateMatrix(); leaves.current.setMatrixAt(i, o.matrix)
      leaves.current.setColorAt(i, col.set(LEAVES[i % LEAVES.length]))
    })
    trunks.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceMatrix.needsUpdate = true
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true
  }, [points])
  return <>
    <instancedMesh ref={trunks} args={[null, null, points.length]} castShadow>
      <cylinderGeometry args={[0.07, 0.1, 0.9, 6]} />
      <meshStandardMaterial color={C.trunk} roughness={0.9} />
    </instancedMesh>
    <instancedMesh ref={leaves} args={[null, null, points.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[0.62, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={0.85} flatShading />
    </instancedMesh>
  </>
}

// 둥근 불빛 그림 (가로등 아래 웅덩이) — 처음 쓸 때 한 번만
let glowTex = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64)
  glowTex = new CanvasTexture(c)
  return glowTex
}

// 가로등: 기둥 + 등 머리(밤에 빛남) + 바닥 불빛 웅덩이(밤에만, 더하기 합성)
function Lamps({ points }) {
  const poles = useRef(), heads = useRef(), pools = useRef()
  const headMat = useMemo(() => new MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffd98a', emissiveIntensity: 0.1, roughness: 0.4 }), [])
  const poolMat = useMemo(() => new MeshBasicMaterial({ color: '#ffcf7a', map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), [])
  useLayoutEffect(() => {
    const o = new Object3D()
    points.forEach((p, i) => {
      o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1)
      o.position.set(p.x, 0.12 + 0.6, p.z); o.updateMatrix(); poles.current.setMatrixAt(i, o.matrix)
      o.position.set(p.x, 0.12 + 1.24, p.z); o.updateMatrix(); heads.current.setMatrixAt(i, o.matrix)
      o.position.set(p.x, 0.13, p.z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); pools.current.setMatrixAt(i, o.matrix)
    })
    for (const r of [poles, heads, pools]) r.current.instanceMatrix.needsUpdate = true
  }, [points])
  // 밤 밝기 (SkyRig 가 매 프레임 SKY.lights 를 0~1 로 갱신)
  useFrame(() => {
    headMat.emissiveIntensity = 0.1 + SKY.lights * 2.4
    poolMat.opacity = SKY.lights * 0.55
    poolMat.visible = SKY.lights > 0.02
  })
  return <>
    <instancedMesh ref={poles} args={[null, null, points.length]} castShadow>
      <cylinderGeometry args={[0.035, 0.05, 1.2, 6]} />
      <meshStandardMaterial color={C.lampPole} roughness={0.6} metalness={0.3} />
    </instancedMesh>
    <instancedMesh ref={heads} args={[null, null, points.length]} material={headMat}>
      <sphereGeometry args={[0.11, 10, 8]} />
    </instancedMesh>
    <instancedMesh ref={pools} args={[null, null, points.length]} material={poolMat}>
      <planeGeometry args={[2.4, 2.4]} />
    </instancedMesh>
  </>
}

// 자동차 한 대: 차체 + 유리 지붕 (Pitt St 차는 90° 돌림)
function Car({ c }) {
  return (
    <group position={[c.x, 0.04, c.z]} rotation={[0, c.along === 'z' ? Math.PI / 2 : 0, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[1.5, 0.32, 0.72]} /><meshStandardMaterial color={c.color} roughness={0.45} metalness={0.2} /></mesh>
      <mesh position={[-0.08, 0.46, 0]} castShadow><boxGeometry args={[0.82, 0.24, 0.62]} /><meshStandardMaterial color="#2f3c4b" roughness={0.2} metalness={0.4} /></mesh>
    </group>
  )
}
