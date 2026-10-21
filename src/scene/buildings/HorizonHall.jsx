// =============================================================
// HorizonHall — 차일드레스 Horizon 1~4 를 실제 모양 3D 모형(GLB)으로 그림
// -------------------------------------------------------------
// 모형 설계도: scripts/blender/horizon-hall.py → public/models/horizon-hall.glb.gz (gzip 으로 줄인 GLB, 약 42 KiB)
//   닫힘(A): 건물 + 마당 설비 (건식 냉각기·칠러·펌프·발전기·변압기·1차 배관)
//   열림(B, 건물을 고르면): 지붕·앞벽이 걷히고 전기실·CDU·천장 배관과 랙 348대가 바닥에서 솟아오름
//     랙은 모형 안의 "틀" 하나를 348 자리에 찍어 씀(InstancedMesh) → 그리기 호출이 몇 번뿐
//   전기(초록)·찬물(파랑)·데워진 물(빨강)이 도는 길을 점이 따라 흐름 (HallFlows)
// 모형 받기·정리는 horizonModel.js (확대 보기 창과 같이 씀). 이 파일은 Block.jsx 가 처음 필요할 때 받음
// 받는 동안이나 실패하면 Block.jsx 가 예전 상자(FinishedHall)를 그대로 그림
// 배치·대수는 회사가 밝히지 않은 그림 표현 → 속을 열면 그 안내 + "가까이 보기"(확대 창) 단추를 띄움
// =============================================================
import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Maximize2 } from 'lucide-react'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'
import { useReducedMotion } from '../useReducedMotion.js'
import { useAppStore } from '../../store/useAppStore.js'
import { openFigure } from '../../ui/figureState.js'
import { CampusLabel } from '../CampusLabel.jsx'
import { NightWindows } from './Block.jsx'
import { fitScale } from '../horizonHall.js'
import { loadHorizonModel, cloneParts, makeRacks } from './horizonModel.js'
import HallFlows from './HallFlows.jsx'

const PLINTH = 0.14      // 다른 건물과 같은 낮은 기단 (선택·호버 바닥 판이 모형 밑으로 숨게)
const RISE_SEC = 0.6     // 속을 열 때 설비·랙이 솟아오르는 시간

export default function HorizonHall({ w, d, status, beacon, nightMaterial, racks = 0 }) {
  const model = use(loadHorizonModel())
  const parts = useMemo(() => cloneParts(model), [model])
  const rackMeshes = useMemo(() => makeRacks(model), [model])
  const lang = useAppStore((s) => s.lang)
  const reduced = useReducedMotion()
  const open = racks > 0
  const s = fitScale(model.lot, w, d)    // 부지 60 × 90 m → 블록 4 × 6 이면 1/15
  const B = model.building
  const bTop = PLINTH + B.h * s           // 건물 꼭대기 높이 (블록 단위)

  // 상태색 띠 (가동·시운전 등 — 다른 건물 지붕 띠와 같은 색)
  useEffect(() => {
    parts.status.forEach((m) => m.color.set(styleOf(status).color))
  }, [parts, status])
  // 보일 랙 수 (추정 랙 수가 모형 자리보다 적으면 그만큼만)
  useEffect(() => {
    rackMeshes.forEach((m) => (m.count = Math.min(racks, model.slots.length)))
  }, [rackMeshes, racks, model])
  useEffect(() => () => {
    parts.status.forEach((m) => m.dispose())
    rackMeshes.forEach((m) => m.dispose())
  }, [parts, rackMeshes])

  // 속을 열면 설비·랙이 바닥에서 솟아오름 (모션 감소 설정이면 바로)
  const riseRef = useRef()
  const rise = useRef({ start: null })
  useEffect(() => {
    rise.current.start = open ? 'next' : null
  }, [open])
  useFrame(({ clock }) => {
    const g = riseRef.current
    if (!g) return
    const r = rise.current
    if (r.start === 'next') r.start = clock.elapsedTime
    const k = reduced || r.start == null ? 1 : Math.min(1, (clock.elapsedTime - r.start) / RISE_SEC)
    const y = 0.02 + 0.98 * (1 - (1 - k) ** 3)
    if (g.scale.y !== y) g.scale.y = y
  })

  const en = lang === 'en'
  return (
    <group>
      {/* 기단 + 마우스 판정용 투명 상자 (모형 자체는 판정에서 뺌) */}
      <mesh position={[0, PLINTH / 2, 0]} receiveShadow>
        <boxGeometry args={[w + 0.28, PLINTH, d + 0.28]} />
        <meshStandardMaterial color="#9daab8" roughness={0.95} />
      </mesh>
      <mesh position={[0, bTop / 2, 0]} visible={false}>
        <boxGeometry args={[w, bTop, d]} />
      </mesh>
      <group position={[0, PLINTH, 0]} scale={s}>
        {parts.always.map((o) => <primitive key={o.uuid} object={o} />)}
        <group visible={!open}>
          {parts.closed.map((o) => <primitive key={o.uuid} object={o} />)}
        </group>
        <group ref={riseRef} visible={open}>
          {parts.open.map((o) => <primitive key={o.uuid} object={o} />)}
          {rackMeshes.map((m) => <primitive key={m.uuid} object={m} />)}
        </group>
        {open && <HallFlows flows={model.flows} reduced={reduced} />}
      </group>
      {/* 밤 창문 띠 (건물 부분만, 속을 열었을 땐 없음) */}
      {nightMaterial && !open && (
        <group position={[B.cx * s, PLINTH, B.cz * s]}>
          <NightWindows w={B.w * s} d={B.d * s} h={B.h * s} material={nightMaterial} />
        </group>
      )}
      {beacon && <Beacon position={[(B.cx + B.w / 2) * s - 0.2, bTop + 0.35, (B.cz + B.d / 2) * s - 0.2]} reduced={reduced} />}
      {/* 속을 열면: 배치·대수는 그림 표현이라는 안내 + 확대 창 단추 (마당 앞 오른쪽 모서리) */}
      {open && (
        <CampusLabel position={[w / 2 - 0.2, PLINTH + 0.3, d / 2]} priority={18}>
          <div className="hz-note" title={en ? model.info.note_en : model.info.note_ko}>
            <span>{en ? '3D model · layout and counts are illustrative' : '3D 모형 · 배치·대수는 그림 표현'}</span>
            <button type="button" className="hz-note-zoom" onClick={(e) => { e.stopPropagation(); openFigure('horizon-hall', '3d') }}>
              <Maximize2 size={12} aria-hidden="true" />{en ? 'Look closer' : '가까이 보기'}
            </button>
          </div>
        </CampusLabel>
      )}
    </group>
  )
}

// ---------- 시운전 경광등 (상자 건물과 같은 점멸, 낮은 모형에 맞춰 조금 작게) ----------
function Beacon({ position, reduced }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const on = reduced || Math.sin(clock.elapsedTime * 5) > 0
    ref.current.material.emissiveIntensity = on ? 2.2 : 0.1
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.16, 12, 10]} />
      <meshStandardMaterial color={PENDING_COLOR} emissive={PENDING_COLOR} emissiveIntensity={1} />
    </mesh>
  )
}
