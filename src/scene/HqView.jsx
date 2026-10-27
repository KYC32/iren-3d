// =============================================================
// HqView — 본사 3D 화면: 시드니 55 Market Street 사무 빌딩 + IREN 층(Level 5) + 실제 동네
// -------------------------------------------------------------
// 지도에서 본사 카드를 누르면 (useAppStore.enterHq3D → view 'hq') Scene 이 이것을 그림
// 모양: 윤곽은 OpenStreetMap (data/loadHqCity.js → hqCity.js 배치), 층수·IREN 층은 data/companies.json 의 hq.building
//   아래 3층 = 땅 윤곽 전체(포디움 · FK 2021 리모델링의 3층 높이 유리 로비) · 그 위 = 모서리를 깎은 탑 윤곽
//   동네 자료를 받기 전엔 바닥 판만, 못 받으면 정사각형 기본 모양 (hqTower.js)
// 카메라는 CameraRig 가 같은 모양(hqTower)으로 맞춤
// 빌딩: 층 구간마다 창문 그림(facade.js) 기둥(prism.js) — 밤엔 창문에 불이 켜짐 · IREN 층은 초록 유리 + 빛 띠
// 동네: HqCity.jsx (실제 건물 윤곽·높이 · 길 · 가로수 · 꾸밈 가로등·차) — 돌려 볼 때 본사를 가리는 건물은 흐려짐
// 빌딩에 붙는 것 (3D 위치에 붙은 HTML — 그림 조각은 ui/HqParts.jsx):
//   옥상 위: CEO 카드(큰 사진 · 이름 · 약속 성적표) + 그 옆 최근 발언 말풍선 (휴대폰은 말풍선을 화면 아래로 — HqDock)
//   IREN 층: 'IREN · 5층' 표시 (카메라에서 본 탑의 왼쪽 끝 모서리 — hqTower.sideCorners, 돌려도 빌딩을 가리지 않게)
// 카드(가운데 대화상자)는 App 이 그림 (useAppStore.hqCard → ui/StatementsCard.jsx)
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { useAppStore } from '../store/useAppStore.js'
import { hqTower, sideCorners, ringFaces, PLOT } from './hqTower.js'
import { facadeMaterial, TILE_W, TILE_H } from './facade.js'
import { towerTargets } from './hqCity.js'
import { prismGeometry, flatGeometry } from './prism.js'
import { centroid, inflateRing, segmentQuad } from './geom2d.js'
import { loadHqCity, peekHqCity } from '../data/loadHqCity.js'
import HqCity from './HqCity.jsx'
import Html from './SafeHtml.jsx'
import { SKY } from './nightLights.js'
import { CeoTop, FloorTag, useStatementsFile } from '../ui/HqParts.jsx' // 옥상 위 CEO 카드·말풍선, 5층 표시
import './scene.css'

const NIGHT_GAIN = 1.15 // 밤 창문 밝기 (SKY.lights 1 일 때)
const BASE = 0.12       // 바닥 판 윗면 (빌딩·인도가 이 위에 섬 — HqCity.jsx·hqCity.js 와 같음)

// 동네 자료(배치): 이미 계산했으면 바로, 아니면 받아 옴 — done = 받기 끝남(성공이든 실패든)
function useHqCity() {
  const [state, setState] = useState(() => ({ L: peekHqCity(), done: !!peekHqCity() }))
  useEffect(() => {
    if (state.done) return undefined
    let alive = true
    loadHqCity().then((L) => { if (alive) setState({ L, done: true }) })
    return () => { alive = false }
  }, [state.done])
  return state
}

export default function HqView() {
  const hq = useAppStore((s) => s.data?.companies?.[0]?.hq)
  const b = hq?.building ?? { floors: 20, level: 5 } // 자료가 없으면 기본 모양 (그림은 그려지게)
  const { L, done } = useHqCity()
  const shape = L?.hq?.tower?.length >= 3 ? L.hq : null
  const T = useMemo(() => hqTower(b, shape), [b.floors, b.level, shape])
  const targets = useMemo(() => towerTargets(T), [T]) // 돌려 볼 때 본사를 가리는 이웃 건물을 고르는 과녁 점
  // 밤에 불이 켜지는 벽 재질 목록 (빌딩·이웃 빌딩) — 아래 useFrame 이 한꺼번에 밝기를 바꿈
  const nightList = useMemo(() => [], [])
  useFrame(() => {
    for (const m of nightList) m.emissiveIntensity = (m.userData.glow ?? 0) + SKY.lights * NIGHT_GAIN
  })

  return (
    <group name="hq">
      {/* 넓은 바닥 (배경과 같은 색) + 그림자 받는 판 */}
      <SkyGround radius={PLOT * 3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.31, 0]} receiveShadow>
        <circleGeometry args={[PLOT * 3, 48]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
      <HqCity L={L} nightList={nightList} targets={targets} />
      {done && <Tower T={T} nightList={nightList} />}
      {done && <HqOverlays T={T} hq={hq} level={b.level} />}
    </group>
  )
}

// 사무 빌딩: 층 구간(포디움 · 그 위 사무층 · IREN 층 · 그 위 사무층)마다 창문 그림 기둥 하나 (층 띠는 그림 안)
//   포디움(아래 3층)은 땅 윤곽 전체에 키 큰 유리(lobby 그림), 그 위는 탑 윤곽
function Tower({ T, nightList }) {
  const roof = useMemo(() => new MeshStandardMaterial({ color: '#c3cad3', roughness: 0.8 }), [])
  const parts = useMemo(() => {
    const pod = T.podium.h, top = T.roof.y, f = T.iren
    // 구간 경계: 바닥 · 포디움 꼭대기 · IREN 층 아래·위 · 옥상
    const cuts = [...new Set([0, pod, ...(f ? [f.y, f.y + f.h] : []), top].filter((y) => y >= 0 && y <= top))].sort((a, c) => a - c)
    const out = []
    for (let i = 0; i + 1 < cuts.length; i++) {
      const y0 = cuts[i], y1 = cuts[i + 1]
      if (y1 - y0 < 1e-6) continue
      const inPodium = y0 < pod - 1e-6
      const iren = f && Math.abs(y0 - f.y) < 1e-6
      const style = iren ? 'iren' : inPodium ? 'lobby' : 'hq'
      const mat = facadeMaterial(style, TILE_W, TILE_H, nightList, iren ? { glow: 0.55 } : { oy: (i * 0.25) % 1 }) // IREN 층: 낮에도 은은히 빛남
      out.push({ key: `${style}${i}`, geo: prismGeometry(inPodium ? T.podium.ring : T.ring, y0, y1), mats: [mat, roof] })
    }
    return out
  }, [T, nightList, roof])
  // 옥상 기계실(탑 가운데) · 난간(탑 윤곽을 조금 부풀린 고리) · 정문 차양과 검은 화강석 포장(Market St 쪽 — FK 2021 리모델링)
  const extra = useMemo(() => {
    const xs = T.ring.map((p) => p[0]), zs = T.ring.map((p) => p[1])
    const plant = { w: (Math.max(...xs) - Math.min(...xs)) * 0.55, d: (Math.max(...zs) - Math.min(...zs)) * 0.5, c: centroid(T.ring) }
    const parapet = prismGeometry(inflateRing(T.ring, 0.04), T.roof.y, T.roof.y + 0.18)
    // 포디움의 북쪽(+x, Market St) 벽 중 가장 긴 것 = 정문 쪽
    const north = ringFaces(T.podium.ring).filter((fc) => fc.n[0] > 0.8).sort((a, c) => c.len - a.len)[0]
    let door = null
    if (north) {
      const [a, c] = north.c, mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]
      const along = Math.atan2(-(c[1] - a[1]), c[0] - a[0]) // 벽 방향으로 차양을 돌림
      const out = (d) => [mid[0] + north.n[0] * d, mid[1] + north.n[1] * d]
      const inset = (p, d) => [p[0] + north.n[0] * d, p[1] + north.n[1] * d]
      door = {
        canopy: { p: out(0.45), ry: along, w: Math.min(2.6, north.len * 0.45) },
        granite: flatGeometry([segmentQuad(inset(a, 0.5), inset(c, 0.5), 1)], BASE + 0.004), // 벽 앞 폭 1칸(≈5.5m) 띠
      }
    }
    return { plant, parapet, door }
  }, [T])
  return (
    <group>
      <group position={[0, BASE, 0]}>
        {parts.map((p) => <mesh key={p.key} geometry={p.geo} material={p.mats} castShadow receiveShadow />)}
        <mesh geometry={extra.parapet}><meshStandardMaterial color="#56697c" roughness={0.6} /></mesh>
      </group>
      {T.iren && <IrenHalo f={T.iren} ring={T.ring} />}
      {extra.door && <>
        <mesh position={[extra.door.canopy.p[0], BASE + T.floors[0].h * 0.72, extra.door.canopy.p[1]]} rotation={[0, extra.door.canopy.ry, 0]} castShadow>
          <boxGeometry args={[extra.door.canopy.w, 0.08, 0.9]} />
          <meshStandardMaterial color="#3f5164" roughness={0.6} />
        </mesh>
        <mesh geometry={extra.door.granite} receiveShadow><meshStandardMaterial color="#2b2f36" roughness={0.35} metalness={0.1} /></mesh>
      </>}
      <mesh position={[extra.plant.c[0], BASE + T.roof.y + T.roof.h / 2, extra.plant.c[1]]} castShadow>
        <boxGeometry args={[extra.plant.w, T.roof.h, extra.plant.d]} />
        <meshStandardMaterial color="#c3cad3" roughness={0.8} />
      </mesh>
    </group>
  )
}

// IREN 층 둘레의 초록 빛 띠: 탑 윤곽을 부풀린 반투명 더하기 합성 벽 + 위·아래 밝은 선 — 낮엔 은은히, 밤엔 가장 밝게 (5층이 한눈에)
function IrenHalo({ f, ring }) {
  const halo = useMemo(() => new MeshBasicMaterial({ color: '#71da80', transparent: true, opacity: 0.18, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), [])
  const line = useMemo(() => new MeshBasicMaterial({ color: '#8dffa3', toneMapped: false }), [])
  useFrame(() => { halo.opacity = 0.16 + SKY.lights * 0.34 })
  const geos = useMemo(() => {
    const y = BASE + f.y
    return {
      band: prismGeometry(inflateRing(ring, 0.21), y - 0.06, y + f.h + 0.06, { roof: false }),
      lo: prismGeometry(inflateRing(ring, 0.05), y, y + 0.05),
      hi: prismGeometry(inflateRing(ring, 0.05), y + f.h - 0.05, y + f.h),
    }
  }, [f, ring])
  return <>
    <mesh geometry={geos.band} material={halo} />
    <mesh geometry={geos.lo} material={[line, line]} />
    <mesh geometry={geos.hi} material={[line, line]} />
  </>
}

// 빌딩에 붙는 CEO 카드·말풍선(옥상 위)과 'IREN · 5층' 표시 (발언 자료를 받은 뒤에 나타남)
function HqOverlays({ T, hq, level }) {
  const file = useStatementsFile()
  // 카메라에서 본 탑의 왼쪽 끝 모서리 — 바뀔 때만 다시 그림 (매 프레임 확인은 값 비교뿐)
  const camera = useThree((s) => s.camera)
  const [corners, setCorners] = useState(() => sideCorners(camera.position.x, camera.position.z, T.ring))
  const cornerKey = useRef(`${corners.left}|${corners.right}`)
  useFrame(() => {
    const c = sideCorners(camera.position.x, camera.position.z, T.ring)
    const key = `${c.left}|${c.right}`
    if (key !== cornerKey.current) { cornerKey.current = key; setCorners(c) }
  })
  if (!T.iren) return null
  const y = BASE + T.iren.y + T.iren.h / 2 // IREN 층 가운데 높이
  const street = hq?.address?.split(',')[1]?.trim() ?? '' // 'Level 5, 55 Market Street, …' → '55 Market Street'
  return <>
    <Html position={[corners.left[0], y, corners.left[1]]} zIndexRange={[12, 0]}><FloorTag level={level} street={street} /></Html>
    {file && <Html position={[0, BASE + T.height, 0]} zIndexRange={[13, 0]}><CeoTop file={file} /></Html>}
  </>
}

// 넓은 바닥: 배경과 같은 색이라 지평선이 자연스럽게 사라짐. 밤·노을엔 SkyRig 가 바꾼 배경색(SKY.bg)을 따라감 (SiteView 와 같은 방식)
function SkyGround({ radius }) {
  const mat = useRef()
  useFrame(() => { if (mat.current && SKY.bg) mat.current.color.copy(SKY.bg) })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial ref={mat} color="#eceffa" toneMapped={false} />
    </mesh>
  )
}
