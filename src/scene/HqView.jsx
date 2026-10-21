// =============================================================
// HqView — 본사 3D 화면: 시드니 55 Market Street 사무 빌딩 (단순화한 모형) + IREN 층(Level 5)
// -------------------------------------------------------------
// 지도에서 본사 카드를 누르면 (useAppStore.enterHq3D → view 'hq') Scene 이 이것을 그림
// 모양 계산은 hqTower.js (층수·IREN 층 = data/companies.json 의 hq.building), 카메라는 CameraRig 가 같은 상자로 맞춤
// 빌딩에 붙는 세 가지 (3D 위치에 붙은 HTML — 카메라를 돌려도 따라감, 그림 조각은 ui/HqParts.jsx):
//   왼쪽  : 'IREN · 5층' 표시 + 두 공동 CEO 배지 → 누르면 그 사람 발언 카드
//   오른쪽: 최근 발언 말풍선 (7초마다 다음 발언, 마우스를 올리면 멈춤) → 누르면 전체 카드
//   옥상  : 약속 성적표 간판 → 누르면 약속만 모은 카드
//   왼쪽·오른쪽은 카메라에서 본 빌딩의 양 끝 모서리 (hqTower.sideCorners) — 돌려도 빌딩을 가리지 않게
//   휴대폰(767px 이하)은 빌딩 옆 자리가 없어 배지·말풍선을 화면 아래(ui/HqDock.jsx)로 — 여기선 간판만 (hq.css 가 숨김)
// 카드(가운데 대화상자)는 App 이 그림 (useAppStore.hqCard → ui/StatementsCard.jsx)
// 이웃 건물·도로는 "도심 모퉁이 건물"임을 보여 주는 배경일 뿐 실제 배치가 아님 → 회색 상자로만
// =============================================================
import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useAppStore } from '../store/useAppStore.js'
import { hqTower, sideCorners, TOWER_W, TOWER_D, PLOT } from './hqTower.js'
import Html from './SafeHtml.jsx'
import { SKY } from './nightLights.js'
import { Badges, Bubble, Sign, useStatementsFile } from '../ui/HqParts.jsx' // 배지·말풍선·간판 (휴대폰 아래 묶음과 같은 조각)
import './scene.css'

const GLASS = '#a9bccd'      // 사무 층 유리 (파란 회색)
const SPANDREL = '#5d6f80'   // 층 사이 띠 (슬래브 끝)
const LOBBY = '#6f8193'      // 지상층 로비 유리 (조금 어둡게)
const IREN_GREEN = '#71da80' // IREN 층
const NEIGHBOR = '#d5dae1'   // 이웃 건물 (배경)
const ROAD = '#8997a9'
// 이웃 건물: [x, z, 가로, 세로, 높이] — 배경일 뿐 실제 배치 아님 (건물 뒤·왼쪽에만, 도로 반대편)
const NEIGHBORS = [[-7.2, -1.2, 5, 6.5, 3.2], [-7.2, -7.4, 5, 4.6, 5.4], [-0.6, -7.4, 6.4, 4.6, 2.4], [6.2, -7.4, 4.6, 4.6, 4.2]]

export default function HqView() {
  const hq = useAppStore((s) => s.data?.companies?.[0]?.hq)
  const b = hq?.building ?? { floors: 20, level: 5 } // 자료가 없으면 기본 모양 (그림은 그려지게)
  const T = useMemo(() => hqTower(b), [b.floors, b.level])

  return (
    <group name="hq">
      {/* 넓은 바닥 + 그림자 받는 판 */}
      <SkyGround radius={PLOT * 3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.31, 0]} receiveShadow>
        <circleGeometry args={[PLOT * 3, 48]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
      <RoundedBox args={[PLOT, 0.5, PLOT]} radius={0.25} position={[0, -0.25, 0]} receiveShadow>
        <meshStandardMaterial color="#e5e5dd" roughness={0.95} />
      </RoundedBox>
      {/* 모퉁이의 두 도로 (앞 = Market St, 오른쪽 = Pitt St) */}
      <mesh position={[0, 0.01, TOWER_D / 2 + 2]} receiveShadow>
        <boxGeometry args={[PLOT, 0.04, 2.6]} />
        <meshStandardMaterial color={ROAD} roughness={1} />
      </mesh>
      <mesh position={[TOWER_W / 2 + 2, 0.015, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.04, PLOT]} />
        <meshStandardMaterial color={ROAD} roughness={1} />
      </mesh>
      {/* 이웃 건물 (배경) */}
      {NEIGHBORS.map(([x, z, w, d, ht], i) => (
        <mesh key={i} position={[x, ht / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[w, ht, d]} />
          <meshStandardMaterial color={NEIGHBOR} roughness={0.9} />
        </mesh>
      ))}

      {/* 사무 빌딩: 층마다 유리 한 칸 + 층 사이 띠, IREN 층은 초록 */}
      {T.floors.map((f) => (
        <group key={f.level}>
          <mesh position={[0, f.y + f.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[TOWER_W, f.h - 0.07, TOWER_D]} />
            {f.iren
              ? <meshStandardMaterial color={IREN_GREEN} emissive={IREN_GREEN} emissiveIntensity={0.35} roughness={0.4} />
              : <meshStandardMaterial color={f.level === 0 ? LOBBY : GLASS} roughness={0.3} metalness={0.15} />}
          </mesh>
          <mesh position={[0, f.y + f.h - 0.035, 0]} castShadow>
            <boxGeometry args={[TOWER_W + 0.08, 0.07, TOWER_D + 0.08]} />
            <meshStandardMaterial color={SPANDREL} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* 로비 입구 차양 (Market St 쪽) */}
      <mesh position={[0, T.floors[0].h * 0.72, TOWER_D / 2 + 0.45]} castShadow>
        <boxGeometry args={[2.6, 0.08, 0.9]} />
        <meshStandardMaterial color={SPANDREL} roughness={0.6} />
      </mesh>
      {/* 옥상 기계실 */}
      <mesh position={[0, T.roof.y + T.roof.h / 2, -0.4]} castShadow>
        <boxGeometry args={[TOWER_W * 0.6, T.roof.h, TOWER_D * 0.55]} />
        <meshStandardMaterial color="#c3cad3" roughness={0.8} />
      </mesh>

      <HqOverlays T={T} hq={hq} level={b.level} />
    </group>
  )
}

// 빌딩에 붙는 배지·말풍선·간판 (발언 자료를 받은 뒤에 나타남)
function HqOverlays({ T, hq, level }) {
  const file = useStatementsFile()
  // 카메라에서 본 빌딩의 왼쪽·오른쪽 끝 모서리 — 바뀔 때만 다시 그림 (매 프레임 확인은 값 비교뿐)
  const camera = useThree((s) => s.camera)
  const [corners, setCorners] = useState(() => sideCorners(camera.position.x, camera.position.z))
  const cornerKey = useRef(`${corners.left}|${corners.right}`)
  useFrame(() => {
    const c = sideCorners(camera.position.x, camera.position.z)
    const key = `${c.left}|${c.right}`
    if (key !== cornerKey.current) { cornerKey.current = key; setCorners(c) }
  })

  if (!file || !T.iren) return null
  const y = T.iren.y + T.iren.h / 2 // IREN 층 가운데 높이
  const street = hq?.address?.split(',')[1]?.trim() ?? '' // 'Level 5, 55 Market Street, …' → '55 Market Street'
  return <>
    <Html position={[corners.left[0], y, corners.left[1]]} zIndexRange={[12, 0]}><Badges file={file} level={level} street={street} /></Html>
    <Html position={[corners.right[0], y, corners.right[1]]} zIndexRange={[12, 0]}><Bubble file={file} /></Html>
    <Html position={[0, T.height + 0.3, 0]} zIndexRange={[12, 0]}><Sign file={file} /></Html>
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
