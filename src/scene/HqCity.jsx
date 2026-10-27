// =============================================================
// HqCity — 본사 3D 화면의 실제 동네 (시드니 도심 Market St · Pitt St 모퉁이): 바닥 판 · 길(아스팔트·보도·경전철 선로·
//          차선 점선·횡단보도) · 이웃 건물(OSM 윤곽 · 층수 높이 · 창문 그림) · 가로수(OSM 위치) · 가로등·차(꾸밈) · 이름표
// -------------------------------------------------------------
// 배치는 hqCity.js (순수 계산 · 테스트) — 자료는 OpenStreetMap (© OpenStreetMap contributors · ODbL, 화면 아래 출처 표기)
// 벽·지붕 모양은 prism.js, 창문 그림은 facade.js
// 밤: 빌딩 창문은 HqView 가 nightList 로 한꺼번에, 가로등·불빛 웅덩이는 여기서 SKY.lights 로 매 프레임
// 돌려 볼 때 본사를 가리는 이웃 빌딩은 흐리게 (hqCity.occludersOf 가 고르고, useGhosts 가 투명도를 부드럽게)
// 높이는 OSM 층수(없으면 종류별 어림값)라 실제와 다를 수 있음 — 카드의 건물 설명에 밝힘
// =============================================================
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, SRGBColorSpace } from 'three'
import { occludersOf, M_PER_UNIT } from './hqCity.js'
import { facadeMaterial, TILE_W, TILE_H } from './facade.js'
import { prismGeometry, flatGeometry } from './prism.js'
import { centroid } from './geom2d.js'
import { PLOT } from './hqTower.js'
import { SKY } from './nightLights.js'
import { useAppStore } from '../store/useAppStore.js'
import Html from './SafeHtml.jsx'

const C = { plate: '#e3dfd5', road: '#737d8b', paving: '#d8ccb4', rail: '#59626d', mark: '#f4f2ea', grass: '#a6c98f', roof: '#c7cdd5', trunk: '#7a5d45', lampPole: '#3d4a57' }
const LEAVES = ['#6f9e5e', '#5f8f52', '#7fae68', '#86b56f']
const BASE = 0.12 // 바닥 판 윗면 (인도 높이 — 빌딩·나무가 이 위에 섬)

// L = hqCityLayout 결과 (받기 전엔 null → 바닥 판만) · targets = 본사 벽의 과녁 점 (가리는 빌딩을 고를 때 씀)
export default function HqCity({ L, nightList, targets }) {
  return (
    <group name="hq-city">
      {/* 바닥 판 (윗면 = 인도 높이) */}
      <RoundedBox args={[PLOT, 0.62, PLOT]} radius={0.3} position={[0, BASE - 0.31, 0]} receiveShadow>
        <meshStandardMaterial color={C.plate} roughness={0.95} />
      </RoundedBox>
      {L && <CityContent L={L} nightList={nightList} targets={targets} />}
    </group>
  )
}

function CityContent({ L, nightList, targets }) {
  // 바닥 그림: 종류마다 다각형을 한 묶음으로 (그리기 호출 1번씩) — 높이를 조금씩 달리해 겹친 곳이 깜빡이지 않게
  const ground = useMemo(() => ({
    asphalt: flatGeometry(L.asphalt, BASE + 0.002),
    paving: flatGeometry(L.paving, BASE + 0.003),
    parks: flatGeometry(L.parks, BASE + 0.0035),
    rails: flatGeometry(L.rails, BASE + 0.005),
    marks: flatGeometry([...L.dashes, ...L.zebras], BASE + 0.006),
  }), [L])
  // 이웃 빌딩마다 모양·재질 한 벌 (흐리게 할 때 그 빌딩만 투명도를 바꾸려고 재질을 따로 둠)
  const blds = useMemo(() => L.buildings.map((b, i) => neighbor(b, i, nightList)), [L, nightList])
  useGhosts(L.buildings, blds, targets)
  return <>
    <mesh geometry={ground.asphalt} receiveShadow><meshStandardMaterial color={C.road} roughness={0.9} /></mesh>
    <mesh geometry={ground.paving} receiveShadow><meshStandardMaterial color={C.paving} roughness={0.95} /></mesh>
    <mesh geometry={ground.parks} receiveShadow><meshStandardMaterial color={C.grass} roughness={1} /></mesh>
    <mesh geometry={ground.rails}><meshStandardMaterial color={C.rail} roughness={0.4} metalness={0.5} /></mesh>
    <mesh geometry={ground.marks} receiveShadow><meshStandardMaterial color={C.mark} roughness={0.8} /></mesh>
    <group position={[0, BASE, 0]}>
      {blds.map((n) => (
        <group key={n.id}>
          <mesh geometry={n.geo} material={n.mats} castShadow receiveShadow />
          {n.plant && <mesh position={n.plant.p} material={n.plantMat} castShadow><boxGeometry args={n.plant.s} /></mesh>}
        </group>
      ))}
    </group>
    <Trees points={L.trees} />
    <Lamps points={L.lamps} />
    {L.cars.map((c, i) => <Car key={i} c={c} />)}
    {L.ground.map((g) => <GroundLabel key={g.text} g={g} />)}
    <Labels L={L} />
  </>
}

// 이웃 빌딩 한 채: 창문 그림 벽 + 지붕 (+ 넓고 높은 건물은 옥상 기계실) — all = 흐리게 할 때 투명도를 바꿀 재질
function neighbor(b, i, nightList) {
  const oy = (i * 0.37) % 1 // 빌딩마다 다른 창이 켜지게 그림 시작 위치를 비킴
  const wall = facadeMaterial(b.style, TILE_W, TILE_H, nightList, { oy })
  const roof = new MeshStandardMaterial({ color: C.roof, roughness: 0.85 })
  const plantMat = new MeshStandardMaterial({ color: '#b7bec8', roughness: 0.8 })
  const geo = prismGeometry(b.ring, b.y0, b.y1, { holes: b.holes ?? [] })
  // 옥상 기계실: 바닥이 넓고(가로세로 3칸 넘음) 높은(3칸 넘음) 건물만, 윤곽 가운데에
  const xs = b.ring.map((p) => p[0]), zs = b.ring.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs)
  const [cx, cz] = centroid(b.ring)
  const plant = w > 3 && d > 3 && b.y1 - b.y0 > 3 && b.style !== 'gold' && b.style !== 'concrete'
    ? { p: [cx, b.y1 + 0.28, cz], s: [Math.min(w, d) * 0.3, 0.56, Math.min(w, d) * 0.25] } : null
  return { id: b.id, geo, mats: [wall, roof], plant, plantMat, all: [wall, roof, plantMat] }
}

const GHOST = 0.2 // 본사를 가릴 때 이웃 빌딩의 불투명도 (0 = 안 보임 · 1 = 그대로)

// 카메라가 움직일 때만 가리는 빌딩을 다시 고르고(hqCity.occludersOf), 투명도는 매 프레임 부드럽게 따라감
function useGhosts(buildings, blds, targets) {
  const camera = useThree((s) => s.camera)
  const state = useRef(null)
  if (!state.current || state.current.buildings !== buildings) state.current = { buildings, key: '', targets: null, goal: buildings.map(() => 1), now: buildings.map(() => 1) }
  useFrame((_, dt) => {
    const S = state.current, p = camera.position
    const key = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}` // 0.1 단위로 움직였을 때만 다시 계산
    if (targets && (key !== S.key || targets !== S.targets)) {
      S.key = key; S.targets = targets
      const hit = new Set(occludersOf([p.x, p.y, p.z], buildings, targets))
      S.goal = buildings.map((_, i) => (hit.has(i) ? GHOST : 1))
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 9) // 약 0.3초면 거의 다 바뀜
    S.now.forEach((v, i) => {
      const g = S.goal[i]
      if (v === g) return
      const next = Math.abs(g - v) < 0.01 ? g : v + (g - v) * k
      S.now[i] = next
      for (const m of blds[i].all) setOpacity(m, next)
    })
  })
}

// 재질 투명도 바꾸기: 1 이면 보통(불투명)으로, 1 보다 작으면 투명으로 그림 (그 둘 사이를 오갈 때만 셰이더를 다시 고름)
function setOpacity(m, v) {
  const see = v < 0.995
  if (m.transparent !== see) { m.transparent = see; m.depthWrite = !see; m.needsUpdate = true }
  m.opacity = v
}

// 가로수: 줄기 + 잎(각진 공) — InstancedMesh 두 개, 잎 색은 조금씩 다르게
function Trees({ points }) {
  const trunks = useRef(), leaves = useRef()
  useLayoutEffect(() => {
    const o = new Object3D(), col = new Color()
    points.forEach(([x, z], i) => {
      const k = 0.85 + ((i * 7) % 5) * 0.06 // 나무마다 크기 조금씩
      o.position.set(x, BASE + 0.45 * k, z); o.scale.set(1, k, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.current.setMatrixAt(i, o.matrix)
      o.position.set(x, BASE + 1.15 * k, z); o.scale.set(k, k * 0.95, k); o.rotation.set(0, i * 0.7, 0); o.updateMatrix(); leaves.current.setMatrixAt(i, o.matrix)
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
    points.forEach(([x, z], i) => {
      o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1)
      o.position.set(x, BASE + 0.6, z); o.updateMatrix(); poles.current.setMatrixAt(i, o.matrix)
      o.position.set(x, BASE + 1.24, z); o.updateMatrix(); heads.current.setMatrixAt(i, o.matrix)
      o.position.set(x, BASE + 0.01, z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); pools.current.setMatrixAt(i, o.matrix)
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

// 자동차 한 대: 차체 + 유리 지붕 (ry = 길 방향으로 돌림)
function Car({ c }) {
  return (
    <group position={[c.x, BASE - 0.035, c.z]} rotation={[0, c.ry, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[1.5, 0.32, 0.72]} /><meshStandardMaterial color={c.color} roughness={0.45} metalness={0.2} /></mesh>
      <mesh position={[-0.08, 0.46, 0]} castShadow><boxGeometry args={[0.82, 0.24, 0.62]} /><meshStandardMaterial color="#2f3c4b" roughness={0.2} metalness={0.4} /></mesh>
    </group>
  )
}

// 바닥에 쓴 길 이름 (지도처럼 길 위에 눕힌 글자) — 차도는 흰 글자, 보행자 거리는 짙은 글자
function GroundLabel({ g }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96
    const x = c.getContext('2d')
    x.font = '600 54px ui-sans-serif, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillStyle = g.walk ? 'rgba(70,58,40,0.72)' : 'rgba(255,255,255,0.86)'
    x.fillText(g.text, 256, 50)
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4
    return t
  }, [g])
  return (
    <mesh position={[g.at[0], BASE + 0.008, g.at[1]]} rotation={[-Math.PI / 2, 0, g.ry]}>
      <planeGeometry args={[4.6, 0.86]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}

// 건물 이름표 (스테이트 시어터 · 웨스트필드 시드니 · 시드니 타워) — 작은 알약, 화면 언어대로
function Labels({ L }) {
  const lang = useAppStore((s) => s.lang)
  const ko = lang === 'ko'
  const t = L.landmarks.sydneyTower
  return <>
    {L.labels.map((l) => (
      <Html key={l.id} position={l.at} center zIndexRange={[6, 0]}>
        <span className="hq-place">{ko ? l.ko : l.en}</span>
      </Html>
    ))}
    {/* 시드니 타워: 꼭대기(약 56칸)는 화면 위로 나가서 기둥 중간쯤에 이름표 · 높이는 OSM 조각의 가장 높은 값 */}
    {t && (
      <Html position={[t.x, 9.5, t.z]} center zIndexRange={[6, 0]}>
        <span className="hq-place is-tower">{ko ? '시드니 타워' : 'Sydney Tower'} · {Math.round(t.top * M_PER_UNIT)} m</span>
      </Html>
    )}
  </>
}
