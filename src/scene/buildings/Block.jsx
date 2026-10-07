// =============================================================
// Block — 캠퍼스의 블록 1칸을 상태에 맞는 모습으로 그립니다.
//   operating        : 완성 건물 + 지붕 상태색 + 회전하는 냉각팬 + 창문 점등
//   commissioning    : 완성 건물 + 노란 점멸 경광등
//   under_construction: 콘크리트 슬래브 + 기둥 골조 + 진행률만큼 올라온 반투명 벽
//   planned / lot    : 점선 풋프린트 + 옅은 유령 박스
//   decommissioning  : 낮은 회색 채굴동 (반투명)
// 같은 건물(buildingId)의 블록들은 함께 하이라이트됩니다.
// =============================================================
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Line } from '@react-three/drei'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'

const BODY = '#f7f8fc'      // 건물 외벽 (밝은 흰색)
const CONCRETE = '#d9dde8'  // 슬래브
const STEEL = '#8f99b3'     // 골조

export default function Block({ block, hovered, dimmed, onHover, onLeave }) {
  const { x, z, w, d, h, kind, status } = block
  const handlers = block.buildingId
    ? {
        onPointerOver: (e) => { e.stopPropagation(); onHover(block.buildingId); document.body.style.cursor = 'pointer' },
        onPointerOut: () => { onLeave(block.buildingId); document.body.style.cursor = '' },
      }
    : {}

  // 필터에서 빠진 상태는 바닥 풋프린트만 남겨 "흐리게" 보이게 합니다
  const mode = dimmed ? 'dimmed' : kind === 'lot' ? 'planned' : status

  return (
    <group position={[x, 0, z]} {...handlers}>
      {/* 호버 하이라이트: 바닥의 파란 테두리 판 */}
      {hovered && (
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[w + 0.7, 0.04, d + 0.7]} />
          <meshBasicMaterial color="#2f6bed" transparent opacity={0.45} />
        </mesh>
      )}
      {mode === 'operating' && <FinishedHall w={w} d={d} h={h} kind={kind} status={status} spinning />}
      {mode === 'commissioning' && <FinishedHall w={w} d={d} h={h} kind={kind} status={status} beacon />}
      {mode === 'under_construction' && <ConstructionHall w={w} d={d} h={h} progress={block.progress} />}
      {mode === 'planned' && <GhostFootprint w={w} d={d} h={kind === 'lot' ? 0.05 : h} solidish={kind !== 'lot'} />}
      {mode === 'decommissioning' && <MinerHall w={w} d={d} h={h} />}
      {mode === 'dimmed' && <GhostFootprint w={w} d={d} h={0.05} />}
    </group>
  )
}

// ---------- 완성된 데이터홀 ----------
function FinishedHall({ w, d, h, kind, status, spinning, beacon }) {
  const st = styleOf(status)
  const fans = useRef([])
  const beaconRef = useRef()
  const liquid = kind === 'datahall_liquid'

  useFrame(({ clock }, delta) => {
    // 지붕 냉각팬 회전 (가동중일 때만)
    if (spinning) fans.current.forEach((f) => f && (f.rotation.y += delta * 6))
    // 경광등 점멸 (시운전)
    if (beaconRef.current) {
      const on = Math.sin(clock.elapsedTime * 5) > 0
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
        <meshStandardMaterial color={st.color} emissive={st.emissive} emissiveIntensity={0.6} />
      </mesh>
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
function MinerHall({ w, d, h }) {
  const st = styleOf('decommissioning')
  return (
    <group>
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
