// =============================================================
// Block — 캠퍼스의 블록 1칸을 상태에 맞는 모습으로 그립니다.
//   operating        : 완성 건물 + 지붕 상태색 + 회전하는 냉각팬 + 창문 점등
//   commissioning    : 완성 건물 + 노란 점멸 경광등
//   under_construction: 콘크리트 슬래브 + 기둥 골조 + 진행률만큼 올라온 반투명 벽
//   planned / lot    : 점선 풋프린트 + 옅은 유령 박스
//   decommissioning  : 낮은 회색 채굴동 (반투명) — 밤에는 희미한 주황 불 (아직 채굴 중)
// 같은 건물(buildingId)의 블록들은 함께 하이라이트됩니다.
// 타임라인에서 상태가 바뀌면(계획 → 건설 → 가동) 바닥에서 솟아오르는 짧은 애니메이션을 보여 줍니다.
// 밤·노을(하늘 모드)에는 가동 중인 건물만 창문 불이 켜지고 바닥에 불빛이 번집니다 (nightLights.js).
// =============================================================
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Line } from '@react-three/drei'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'
import { PhotoMiningHall } from './PhotoReferencedCampus.jsx'
import { useReducedMotion } from '../useReducedMotion.js'
import { nightMaterials } from '../nightLights.js'

const BODY = '#eef1f5'      // 건물 외벽 (밝은 흰색)
const CONCRETE = '#d9dde8'  // 슬래브
const STEEL = '#8f99b3'     // 골조

// 마우스 판정에서 빼는 표시 (불빛 웅덩이는 건물보다 넓어서, 판정에 넣으면 옆 빈 땅에서도 호버가 걸림)
export const noHit = () => null

const GROW_SEC = 0.6 // 솟아오르는 애니메이션 길이 (초)
// 살짝 튀어 오르는 이징 (끝에서 5% 넘쳤다 돌아옴)
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)

export default function Block({ block, appearance, hovered, selected, dimmed, onHover, onLeave, onSelect }) {
  const { x, z, w, d, h, kind, status } = block
  const handlers = block.buildingId
    ? {
        onPointerOver: (e) => { e.stopPropagation(); onHover(block.buildingId); document.body.style.cursor = 'pointer' },
        onPointerOut: () => { onLeave(block.buildingId); document.body.style.cursor = '' },
        // 클릭 → 패널의 그 건물 항목 강조. 카메라를 끌어 돌린 뒤 손을 뗀 경우(이동 4px 초과)는 클릭으로 치지 않음
        onClick: (e) => { e.stopPropagation(); if (e.delta <= 4) onSelect?.(block.buildingId) },
      }
    : {}

  // 필터에서 빠진 상태는 바닥 풋프린트만 남겨 "흐리게" 보이게 합니다
  const mode = dimmed ? 'dimmed' : kind === 'lot' ? 'planned' : status
  const photoSheds = appearance && kind === 'miner_hall' && ['operating','delivered','decommissioning'].includes(mode)
  // 밤 불빛: 가동·고객 인수 = 환하게, 시운전 = 희미하게, 그 밖(건설·계획·필터로 흐림)은 꺼짐
  //   채굴 홀은 주황, AI 데이터홀은 하늘색 → 밤에 보면 "지금 돈을 버는 건물"과 그 종류가 한눈에
  const nm = nightMaterials()
  const live = mode === 'operating' || mode === 'delivered'
  const miner = kind === 'miner_hall'
  const windowMat = live ? (miner ? nm.minerWindow : nm.aiWindow)
    : mode === 'commissioning' ? nm.pendingWindow
    : mode === 'decommissioning' ? nm.fadingWindow : null
  const poolMat = live ? (miner ? nm.minerPool : nm.aiPool) : null

  // ---- 솟아오르는 애니메이션 ----
  // "실제 상태"(빈 칸/계획/건설/가동…)가 바뀔 때만 재생. 필터로 흐려지는 건 상태 변화가 아니라서 제외.
  // 시계는 R3F 시계(clock.elapsedTime)를 써서 영상 녹화(프레임을 직접 넘김)에서도 똑같이 재생됨.
  const growRef = useRef()
  const anim = useRef({ first: true, pending: false, start: 0 })
  const shape = kind === 'lot' ? 'lot' : status
  useLayoutEffect(() => {
    if (anim.current.first) { anim.current.first = false; return } // 처음 화면에 나타날 땐 재생 안 함
    anim.current.pending = true // 다음 프레임에서 시작 시각을 기록
  }, [shape])
  useFrame(({ clock }) => {
    const g = growRef.current
    if (!g) return
    const a = anim.current
    if (a.pending) { a.start = clock.elapsedTime; a.pending = false }
    const t = a.start ? (clock.elapsedTime - a.start) / GROW_SEC : 1
    const s = t >= 1 ? 1 : 0.05 + 0.95 * easeOutBack(Math.max(0, t))
    if (g.scale.y !== s) g.scale.y = s
  })

  return (
    <group position={[x, 0, z]} {...handlers}>
      {/* 선택 하이라이트: 진한 파란 바닥 판 (호버보다 크고 진하게, 마우스를 떼도 유지) */}
      {selected && (
        <mesh position={[0, 0.025, 0]} receiveShadow>
          <boxGeometry args={[w + 1.1, 0.04, d + 1.1]} />
          <meshBasicMaterial color="#2f6bed" transparent opacity={0.7} />
        </mesh>
      )}
      {/* 호버 하이라이트: 바닥의 파란 테두리 판 */}
      {hovered && !selected && (
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[w + 0.7, 0.04, d + 0.7]} />
          <meshBasicMaterial color="#2f6bed" transparent opacity={0.45} />
        </mesh>
      )}
      {/* 밤에 건물 둘레 바닥으로 번지는 불빛 (낮에는 재질이 꺼져 있어 그려지지 않음) */}
      {poolMat && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} material={poolMat} renderOrder={1} raycast={noHit}>
          <planeGeometry args={[w + 6, d + 6]} />
        </mesh>
      )}
      <group ref={growRef}>
      {photoSheds && <PhotoMiningHall w={w} d={d} h={h} appearance={appearance} status={status} nightMaterial={windowMat}/>}
      {!photoSheds && live && <FinishedHall w={w} d={d} h={h} kind={kind} status={status} appearance={appearance} spinning nightMaterial={windowMat} />}
      {mode === 'commissioning' && <FinishedHall w={w} d={d} h={h} kind={kind} status={status} appearance={appearance} beacon nightMaterial={windowMat} />}
      {mode === 'under_construction' && <ConstructionHall w={w} d={d} h={h} progress={block.progress} />}
      {mode === 'planned' && <GhostFootprint w={w} d={d} h={kind === 'lot' ? 0.05 : h} solidish={kind !== 'lot'} />}
      {!photoSheds && mode === 'decommissioning' && <MinerHall w={w} d={d} h={h} nightMaterial={windowMat} />}
      {mode === 'dimmed' && <GhostFootprint w={w} d={d} h={0.05} />}
      </group>
    </group>
  )
}

// ---------- 완성된 데이터홀 ----------
function FinishedHall({ w, d, h, kind, status, spinning, beacon, appearance, nightMaterial }) {
  const st = styleOf(status)
  const fans = useRef([])
  const beaconRef = useRef()
  const liquid = kind === 'datahall_liquid'
  const reducedMotion = useReducedMotion() // 모션 감소 설정 (설정을 바꾸면 바로 반영)

  useFrame(({ clock }, delta) => {
    // 설비 연출(팬 회전)은 보고된 상태 배지·전력 흐름과 별개인 장식
    if (spinning && !reducedMotion) fans.current.forEach((f) => f && (f.rotation.y += delta * 6))
    // 경광등 점멸 (시운전)
    // 모션 감소 설정이면 깜빡이지 않고 켜진 채로 둠
    if (beaconRef.current) {
      const on = reducedMotion || Math.sin(clock.elapsedTime * 5) > 0
      beaconRef.current.material.emissiveIntensity = on ? 2.2 : 0.1
    }
  })

  // 지붕 위 설비 배치: 액체냉각은 드라이쿨러 2열, 공랭은 큰 팬 1열
  const units = useMemo(() => {
    const arr = []
    const rows = liquid ? 2 : 1
    const cols = 3
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        arr.push([(c - (cols - 1) / 2) * (w / cols), (r - (rows - 1) / 2) * (d / 3)])
    return arr
  }, [w, d, liquid])

  return (
    <group>
      {/* 낮은 기단으로 건물과 지면의 경계를 구분 */}
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.28, 0.14, d + 0.28]} />
        <meshStandardMaterial color="#9daab8" roughness={0.95} />
      </mesh>
      {/* 본체 */}
      <RoundedBox args={[w, h, d]} radius={0.12} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} roughness={0.75} />
      </RoundedBox>
      {/* 지붕 상태색 띠 */}
      <mesh position={[0, h + 0.03, 0]} castShadow>
        <boxGeometry args={[w * 0.96, 0.08, d * 0.96]} />
        <meshStandardMaterial color={st.color} roughness={0.6} />
      </mesh>
      {/* 앞면 창문 띠 (점등) */}
      <mesh position={[0, h * 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.8, h * 0.18]} />
        <meshStandardMaterial color={appearance?.endWall ?? st.color} emissive={st.emissive} emissiveIntensity={status==='operating' ? 0.35 : 0} />
      </mesh>
      {appearance && <mesh position={[0,.08,d/2+.2]}><boxGeometry args={[w,.06,.16]}/><meshBasicMaterial color={st.color}/></mesh>}
      {/* 공랭 홀은 옆면에 루버(환기창) 줄무늬 */}
      {!liquid &&
        [-1, 0, 1].map((i) => (
          <mesh key={i} position={[w / 2 + 0.01, h * 0.5 + i * 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[d * 0.8, 0.12]} />
            <meshStandardMaterial color="#c5cbdb" />
          </mesh>
        ))}
      {/* 지붕 설비 + 팬 */}
      {units.map(([ux, uz], i) => (
        <group key={i} position={[ux, h + 0.07, uz]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[w / 3.6, 0.44, liquid ? d / 4 : d / 2.6]} />
            <meshStandardMaterial color="#e3e7f1" roughness={0.6} />
          </mesh>
          <mesh ref={(el) => (fans.current[i] = el)} position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 3]} />
            <meshStandardMaterial color="#7b86a3" />
          </mesh>
        </group>
      ))}
      {/* 밤 창문 띠 2줄: 건물보다 살짝 큰 얇은 상자 하나로 네 면을 한 번에 (건물마다 그리기 2번) */}
      {nightMaterial && <NightWindows w={w} d={d} h={h} material={nightMaterial} />}
      {/* 시운전 경광등 */}
      {beacon && (
        <mesh ref={beaconRef} position={[w / 2 - 0.3, h + 0.45, d / 2 - 0.3]}>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshStandardMaterial color={PENDING_COLOR} emissive={PENDING_COLOR} emissiveIntensity={1} />
        </mesh>
      )}
    </group>
  )
}

// ---------- 밤 창문 띠 ----------
// 건물 몸체보다 사방으로 0.03 큰 얇은 상자 → 네 옆면에 빛나는 띠가 둘러짐 (위·아래 면은 건물 속에 숨음)
// material 은 모든 건물이 함께 쓰는 재질이라 SkyRig 가 투명도만 바꾸면 한 번에 켜지고 꺼짐
export function NightWindows({ w, d, h, material, rows = [0.34, 0.66] }) {
  return rows.map((y) => (
    <mesh key={y} position={[0, h * y, 0]} material={material} raycast={noHit}>
      <boxGeometry args={[w + 0.06, h * 0.13, d + 0.06]} />
    </mesh>
  ))
}

// ---------- 건설중 데이터홀 ----------
function ConstructionHall({ w, d, h, progress = 0.3 }) {
  const st = styleOf('under_construction')
  const wallH = Math.max(0.15, h * progress)
  // 기둥 위치: 네 모서리 + 긴 변 중간
  const cols = [
    [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2],
    [-w / 2, 0], [w / 2, 0],
  ]
  // 지붕 높이의 테두리 보 (선)
  const top = h
  const beam = [
    [-w / 2, top, -d / 2], [w / 2, top, -d / 2], [w / 2, top, d / 2], [-w / 2, top, d / 2], [-w / 2, top, -d / 2],
  ]
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.3, 0.16, d + 0.3]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.9} />
      </mesh>
      {cols.map(([cx, cz], i) => (
        <mesh key={i} position={[cx * 0.97, h / 2, cz * 0.97]} castShadow>
          <boxGeometry args={[0.16, h, 0.16]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
      <Line points={beam} color={STEEL} lineWidth={1.5} />
      {/* 진행률만큼 올라온 벽 (반투명 코럴) */}
      <mesh position={[0, 0.16 + wallH / 2, 0]} castShadow>
        <boxGeometry args={[w * 0.94, wallH, d * 0.94]} />
        <meshStandardMaterial color={st.color} transparent opacity={0.5} roughness={0.8} />
      </mesh>
      {/* 공사장 펜스 (점선) */}
      <Line
        points={[[-w / 2 - 0.5, 0.3, -d / 2 - 0.5], [w / 2 + 0.5, 0.3, -d / 2 - 0.5], [w / 2 + 0.5, 0.3, d / 2 + 0.5], [-w / 2 - 0.5, 0.3, d / 2 + 0.5], [-w / 2 - 0.5, 0.3, -d / 2 - 0.5]]}
        color={st.color}
        lineWidth={1.2}
        dashed
        dashSize={0.35}
        gapSize={0.25}
      />
    </group>
  )
}

// ---------- 계획(유령) 풋프린트 ----------
function GhostFootprint({ w, d, h, solidish }) {
  const st = styleOf('planned')
  const y = 0.06
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#e1e5ef" transparent opacity={0.7} />
      </mesh>
      <Line
        points={[[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2], [-w / 2, y, -d / 2]]}
        color={st.color}
        lineWidth={1.4}
        dashed
        dashSize={0.4}
        gapSize={0.3}
      />
      {solidish && (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.96, h, d * 0.96]} />
          <meshStandardMaterial color={st.color} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// ---------- 폐쇄중 채굴동 ----------
function MinerHall({ w, d, h, nightMaterial }) {
  const st = styleOf('decommissioning')
  return (
    <group>
      {nightMaterial && <NightWindows w={w} d={d} h={h} material={nightMaterial} rows={[0.5]} />}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={st.color} transparent opacity={0.8} roughness={0.9} />
      </mesh>
      {/* 지붕 용마루 3줄 */}
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * (w / 3), h + 0.08, 0]} castShadow>
          <boxGeometry args={[0.2, 0.16, d * 0.95]} />
          <meshStandardMaterial color="#a7aebe" />
        </mesh>
      ))}
    </group>
  )
}
