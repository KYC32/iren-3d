// =============================================================
// HqView — 본사 3D 화면: 시드니 55 Market Street 사무 빌딩 (단순화한 모형) + IREN 층(Level 5) 표시
// -------------------------------------------------------------
// 지도에서 본사 카드를 누르면 (useAppStore.enterHq3D → view 'hq') Scene 이 이것을 그림
// 모양 계산은 hqTower.js (층수·IREN 층 = data/companies.json 의 hq.building), 카메라는 CameraRig 가 같은 상자로 맞춤
// 오른쪽 칸(CEO·경영진 발언)은 App 이 StatementsPanel 로 그림
// 이웃 건물·도로는 "도심 모퉁이 건물"임을 보여 주는 배경일 뿐 실제 배치가 아님 → 회색 상자로만
// =============================================================
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useAppStore } from '../store/useAppStore.js'
import { hqTower, TOWER_W, TOWER_D, PLOT } from './hqTower.js'
import { CampusLabel, CampusLabelLayout } from './CampusLabel.jsx'
import { SKY } from './nightLights.js'
import { hqText } from '../i18n/hq.js'
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
  const lang = useAppStore((s) => s.lang)
  const hq = useAppStore((s) => s.data?.companies?.[0]?.hq)
  const b = hq?.building ?? { floors: 20, level: 5 } // 자료가 없으면 기본 모양 (그림은 그려지게)
  const T = useMemo(() => hqTower(b), [b.floors, b.level])
  const h = hqText[lang === 'ko' ? 'ko' : 'en']
  const street = hq?.address?.split(',')[1]?.trim() ?? '' // 'Level 5, 55 Market Street, …' → '55 Market Street'
  const fill = (s) => s.replace('{level}', b.level).replace('{floors}', b.floors)

  return (
    <group name="hq">
      <CampusLabelLayout />
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

      {/* IREN 층 라벨 (오른쪽 앞 모서리 바깥) */}
      {T.iren && (
        <CampusLabel position={[TOWER_W / 2 + 0.3, T.iren.y + T.iren.h / 2, TOWER_D / 2 + 0.3]} priority={100}>
          <div className="bld-label is-lot hq-floor-label">
            <div className="row"><span className="dot" style={{ background: IREN_GREEN }} /><span className="name">{fill(h.towerFloor)}</span></div>
            <div className="sub">{fill(h.towerSub).replace('{street}', street)}</div>
          </div>
        </CampusLabel>
      )}
    </group>
  )
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
