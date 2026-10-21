// =============================================================
// HqView — 본사 3D 화면: 시드니 55 Market Street 사무 빌딩 (단순화한 모형) + IREN 층(Level 5) + 동네
// -------------------------------------------------------------
// 지도에서 본사 카드를 누르면 (useAppStore.enterHq3D → view 'hq') Scene 이 이것을 그림
// 모양 계산은 hqTower.js (층수·IREN 층 = data/companies.json 의 hq.building), 카메라는 CameraRig 가 같은 상자로 맞춤
// 빌딩: 로비 · 아래층 · IREN 층(초록 유리) · 위층을 창문 그림(facade.js) 상자로 — 밤엔 창문에 불이 켜짐
// 동네: HqCity.jsx (도로 · 인도 · 이웃 빌딩 · 가로수 · 가로등 · 자동차 — 꾸밈일 뿐 실제 배치가 아님)
//   돌려 볼 때 본사를 가리는 이웃 빌딩은 흐려짐 (과녁 점 = hqCity.towerTargets)
// 빌딩에 붙는 것 (3D 위치에 붙은 HTML — 그림 조각은 ui/HqParts.jsx):
//   옥상 위: CEO 카드(큰 사진 · 이름 · 약속 성적표) + 그 옆 최근 발언 말풍선 (휴대폰은 말풍선을 화면 아래로 — HqDock)
//   IREN 층: 'IREN · 5층' 표시 (카메라에서 본 빌딩 왼쪽 끝 모서리 — hqTower.sideCorners, 돌려도 빌딩을 가리지 않게)
// 카드(가운데 대화상자)는 App 이 그림 (useAppStore.hqCard → ui/StatementsCard.jsx)
// =============================================================
import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { useAppStore } from '../store/useAppStore.js'
import { hqTower, sideCorners, TOWER_W, TOWER_D, PLOT } from './hqTower.js'
import { facadeMaterial } from './facade.js'
import { towerTargets } from './hqCity.js'
import HqCity from './HqCity.jsx'
import Html from './SafeHtml.jsx'
import { SKY } from './nightLights.js'
import { CeoTop, FloorTag, useStatementsFile } from '../ui/HqParts.jsx' // 옥상 위 CEO 카드·말풍선, 5층 표시
import './scene.css'

const NIGHT_GAIN = 1.15 // 밤 창문 밝기 (SKY.lights 1 일 때)

export default function HqView() {
  const hq = useAppStore((s) => s.data?.companies?.[0]?.hq)
  const b = hq?.building ?? { floors: 20, level: 5 } // 자료가 없으면 기본 모양 (그림은 그려지게)
  const T = useMemo(() => hqTower(b), [b.floors, b.level])
  const targets = useMemo(() => towerTargets(T), [T]) // 돌려 볼 때 본사를 가리는 이웃 빌딩을 고르는 과녁 점
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
      <HqCity nightList={nightList} targets={targets} />
      <Tower T={T} nightList={nightList} />
      <HqOverlays T={T} hq={hq} level={b.level} />
    </group>
  )
}

// 사무 빌딩: 로비(G) · 1~(IREN-1)층 · IREN 층 · 그 위 층 — 층 덩어리마다 창문 그림 상자 하나 (층 띠는 그림 안)
function Tower({ T, nightList }) {
  const parts = useMemo(() => {
    const lobby = T.floors[0], iren = T.iren
    const below = T.floors.filter((f) => f.level > 0 && (!iren || f.level < iren.level))
    const above = T.floors.filter((f) => f.level > 0 && iren && f.level > iren.level)
    const span = (fs) => fs.length ? { y: fs[0].y, h: fs.at(-1).y + fs.at(-1).h - fs[0].y } : null
    const roof = new MeshStandardMaterial({ color: '#c3cad3', roughness: 0.8 })
    const box = (style, part, opts) => {
      const side = facadeMaterial(style, TOWER_W, part.h, nightList, opts) // 네 벽 크기가 같음 (정사각형 빌딩)
      return { ...part, mats: [side, side, roof, roof, side, side] }
    }
    return [
      box('lobby', { y: lobby.y, h: lobby.h }, {}),
      ...(span(below) ? [box('hq', span(below), { oy: 0.25 })] : []),
      ...(iren ? [box('iren', { y: iren.y, h: iren.h }, { glow: 0.55 })] : []), // IREN 층: 낮에도 은은히 빛남
      ...(span(above) ? [box('hq', span(above), { oy: 0.5 })] : []),
    ]
  }, [T, nightList])
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={[0, p.y + p.h / 2 + 0.12, 0]} material={p.mats} castShadow receiveShadow>
          <boxGeometry args={[TOWER_W, p.h, TOWER_D]} />
        </mesh>
      ))}
      {T.iren && <IrenHalo f={T.iren} />}
      {/* 로비 입구 차양 (Market St 쪽) */}
      <mesh position={[0, 0.12 + T.floors[0].h * 0.72, TOWER_D / 2 + 0.45]} castShadow>
        <boxGeometry args={[2.6, 0.08, 0.9]} />
        <meshStandardMaterial color="#3f5164" roughness={0.6} />
      </mesh>
      {/* 옥상: 기계실 + 둘레 난간 */}
      <mesh position={[0, 0.12 + T.roof.y + T.roof.h / 2, -0.4]} castShadow>
        <boxGeometry args={[TOWER_W * 0.6, T.roof.h, TOWER_D * 0.55]} />
        <meshStandardMaterial color="#c3cad3" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12 + T.roof.y + 0.09, 0]}>
        <boxGeometry args={[TOWER_W + 0.06, 0.18, TOWER_D + 0.06]} />
        <meshStandardMaterial color="#56697c" roughness={0.6} />
      </mesh>
    </group>
  )
}

// IREN 층 둘레의 초록 빛 띠: 반투명 더하기 합성 상자 + 위·아래 밝은 선 — 낮엔 은은히, 밤엔 가장 밝게 (5층이 한눈에)
function IrenHalo({ f }) {
  const halo = useMemo(() => new MeshBasicMaterial({ color: '#71da80', transparent: true, opacity: 0.18, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), [])
  const line = useMemo(() => new MeshBasicMaterial({ color: '#8dffa3', toneMapped: false }), [])
  useFrame(() => { halo.opacity = 0.16 + SKY.lights * 0.34 })
  const y = 0.12 + f.y
  return <>
    <mesh position={[0, y + f.h / 2, 0]} material={halo}><boxGeometry args={[TOWER_W + 0.42, f.h + 0.12, TOWER_D + 0.42]} /></mesh>
    <mesh position={[0, y + 0.02, 0]} material={line}><boxGeometry args={[TOWER_W + 0.1, 0.05, TOWER_D + 0.1]} /></mesh>
    <mesh position={[0, y + f.h - 0.02, 0]} material={line}><boxGeometry args={[TOWER_W + 0.1, 0.05, TOWER_D + 0.1]} /></mesh>
  </>
}

// 빌딩에 붙는 CEO 카드·말풍선(옥상 위)과 'IREN · 5층' 표시 (발언 자료를 받은 뒤에 나타남)
function HqOverlays({ T, hq, level }) {
  const file = useStatementsFile()
  // 카메라에서 본 빌딩의 왼쪽 끝 모서리 — 바뀔 때만 다시 그림 (매 프레임 확인은 값 비교뿐)
  const camera = useThree((s) => s.camera)
  const [corners, setCorners] = useState(() => sideCorners(camera.position.x, camera.position.z))
  const cornerKey = useRef(`${corners.left}|${corners.right}`)
  useFrame(() => {
    const c = sideCorners(camera.position.x, camera.position.z)
    const key = `${c.left}|${c.right}`
    if (key !== cornerKey.current) { cornerKey.current = key; setCorners(c) }
  })
  if (!T.iren) return null
  const y = 0.12 + T.iren.y + T.iren.h / 2 // IREN 층 가운데 높이
  const street = hq?.address?.split(',')[1]?.trim() ?? '' // 'Level 5, 55 Market Street, …' → '55 Market Street'
  return <>
    <Html position={[corners.left[0], y, corners.left[1]]} zIndexRange={[12, 0]}><FloorTag level={level} street={street} /></Html>
    {file && <Html position={[0, 0.12 + T.height, 0]} zIndexRange={[13, 0]}><CeoTop file={file} /></Html>}
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
