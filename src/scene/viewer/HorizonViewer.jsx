// =============================================================
// HorizonViewer — Horizon 홀 3D 모형 확대 보기 (그림 창의 "3D 모형" 탭)
// -------------------------------------------------------------
// 캠퍼스 화면은 카메라가 멀어 랙 하나가 몇 픽셀뿐 → 여기서는 같은 모형을 실제 크기(m)로 띄워 랙 사이까지 들어감
//   · 카메라에서 가까운 랙(RACK_NEAR m 안, 최대 MAX_HI 대)은 확대용 틀(매니폴드·호스·버스바·광케이블), 나머지는 멀리용 틀
//   · 미리 정한 시점 5개(전체·홀 속·랙 사이·냉각 설비·전기) + 마우스/손가락으로 돌리기·확대
//   · 부품(이름표)을 누르면 이름·하는 일·근거(회사 확인 / 그림 표현) 카드 — 글은 모형 안 extras (Blender 스크립트의 TEXT)
//   · 전기·찬물·데워진 물이 도는 길을 점이 따라 흐름 (모션 감소 설정이면 멈춘 점)
// 그림 창이 3D 탭을 열 때만 받는 묶음 (첫 화면·첫 3D 지도 예산과 무관). 열려 있는 동안 뒤 캠퍼스 캔버스는 멈춤
// =============================================================
import { Component, Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { Box3, Matrix4, PMREMGenerator, Vector3 } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Columns3, Fan, House, LandPlot, Server, Tag, X, Zap } from 'lucide-react'
import Html from '../SafeHtml.jsx'
import { useReducedMotion } from '../useReducedMotion.js'
import { styleOf } from '../../data/statusStyle.js'
import { splitByDistance, rackPlace } from '../horizonHall.js'
import { loadHorizonModel, cloneParts, makeInstanced, slotMatrix } from '../buildings/horizonModel.js'
import HallFlows, { FLOW_COLORS } from '../buildings/HallFlows.jsx'
import './horizonViewer.css'

const RACK_NEAR = 16   // 이 거리(m) 안의 랙은 확대용 틀
const MAX_HI = 72      // 확대용 틀은 최대 72대까지 (랙 1대 ≈ 2천 삼각형 → 휴대폰도 버틸 만큼)
const PER_ROW = 29     // 모형의 줄마다 랙 수 (자리 번호 → 줄·순서 이름에 씀)

// 미리 정한 시점 (모형 좌표, m): 카메라 위치 → 보는 곳. 마당이 +z, 건물이 -z (북쪽)
const VIEWS = [
  { id: 'all', pos: [70, 62, 96], target: [0, 0, 0], ko: '전체', en: 'Overview', Icon: LandPlot },
  { id: 'hall', pos: [30, 30, -2], target: [0, 0, -32], ko: '홀 속', en: 'Hall', Icon: Server },
  { id: 'aisle', pos: [-5.5, 2.5, -22.4], target: [-5.5, 1.4, -34], ko: '랙 사이', en: 'Rack aisle', Icon: Columns3 },   // 더운 통로에 서서 (양쪽이 랙 뒷면)
  { id: 'cooling', pos: [46, 24, 34], target: [4, 0, 2], ko: '냉각 설비', en: 'Cooling', Icon: Fan },
  { id: 'power', pos: [-2, 19, 5], target: [-20, 1, -23], ko: '전기', en: 'Power', Icon: Zap },
]
// 이름표를 달 부품 (모형 안 part 이름) — 지붕을 덮으면 속(open) 부품 이름표는 숨김
const LABELED = ['dry_cooler', 'chiller', 'pump', 'generator', 'transformer', 'pipes_primary', 'electrical', 'cdu', 'racks']
// 묶음 가운데가 엉뚱한 곳에 잡히는 부품은 이름표 자리를 직접 줌 (모형 좌표 m)
const ANCHORS = {
  electrical: [-20, 4.6, -32],      // 전기실 — 버스웨이 본선이 홀을 가로질러 묶음 가운데가 홀 한복판으로 감
  pipes_primary: [10, 3.4, -16.9],  // 1차 배관 — 건물 남쪽 벽을 따라가는 본관 위 (세로관 때문에 가운데가 냉각기 사이로 감)
}

export default function HorizonViewer({ lang }) {
  const en = lang === 'en'
  const reduced = useReducedMotion()
  const [view, setView] = useState('hall')
  const [roof, setRoof] = useState(false)      // 지붕 덮기 (기본: 걷어서 속이 보이게)
  const [labels, setLabels] = useState(true)   // 이름표
  const [picked, setPicked] = useState(null)   // 고른 부품 { data, sub }
  const [model, setModel] = useState(null)     // 다 받으면 안내·범례를 띄우려고
  // 열려 있는 동안 뒤 캠퍼스 캔버스를 멈춤 (WebGL 화면 두 개를 동시에 돌리지 않게) — Scene.jsx 가 이 이벤트를 들음
  //   상태 저장소 대신 브라우저 이벤트를 쓰는 까닭: 이 창은 캠퍼스 패널 그림 단추로도 열려서, 저장소를 import 하면
  //   빌드가 상태 도구(zustand)를 첫 화면 묶음에서 떼어 내 첫 화면이 조금 무거워짐
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('iren:viewer3d', { detail: true }))
    return () => window.dispatchEvent(new CustomEvent('iren:viewer3d', { detail: false }))
  }, [])

  return (
    <div className="hz-viewer" aria-label={en ? 'Horizon hall 3D model' : 'Horizon 홀 3D 모형'}>
      <ViewerBoundary message={en ? 'Could not load the 3D model.' : '3D 모형을 불러오지 못했습니다.'}>
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, near: 0.1, far: 1500, position: VIEWS[1].pos }} gl={{ antialias: true }}>
          <color attach="background" args={['#e7edf3']} />
          <Lights />
          <Suspense fallback={null}>
            <ViewerScene view={view} roof={roof} labels={labels} reduced={reduced} en={en} onPick={setPicked} onReady={setModel} />
          </Suspense>
        </Canvas>
      </ViewerBoundary>
      {!model && <div className="hz-viewer-wait">{en ? 'Loading the 3D model…' : '3D 모형을 불러오는 중…'}</div>}

      {/* 고른 부품 카드 */}
      {picked && (
        <div className="hz-viewer-card" role="status">
          <button type="button" className="hz-viewer-x" onClick={() => setPicked(null)} aria-label={en ? 'Close' : '닫기'}><X size={14} aria-hidden="true" /></button>
          <h3>{en ? picked.data.label_en : picked.data.label_ko}</h3>
          {picked.sub && <div className="hz-viewer-sub">{picked.sub}</div>}
          <p>{en ? picked.data.role_en : picked.data.role_ko}</p>
          <div className="hz-viewer-basis">{en ? picked.data.basis_en : picked.data.basis_ko}</div>
        </div>
      )}

      {/* 흐름 범례 + 그림 표현 안내 */}
      {model && (
        <div className="hz-viewer-legend" title={en ? model.info.note_en : model.info.note_ko}>
          <span><i style={{ background: FLOW_COLORS.power }} />{en ? 'Power' : '전기'}</span>
          <span><i style={{ background: FLOW_COLORS.supply }} />{en ? 'Cold water' : '찬물'}</span>
          <span><i style={{ background: FLOW_COLORS.return }} />{en ? 'Warm water' : '데워진 물'}</span>
          <small>{en ? 'IT 50 MW · ~348 racks (estimate) · layout and counts are illustrative' : 'IT 50 MW · 랙 약 348대(추정) · 배치·대수는 그림 표현'}</small>
        </div>
      )}

      {/* 시점 · 지붕 · 이름표 단추 */}
      <div className="hz-viewer-bar" role="toolbar" aria-label={en ? 'Views' : '시점'}>
        {VIEWS.map(({ id, ko, en: label, Icon }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); if (id === 'aisle' || id === 'hall') setRoof(false) }}>
            <Icon size={14} aria-hidden="true" /><span>{en ? label : ko}</span>
          </button>
        ))}
        <i className="hz-viewer-sep" aria-hidden="true" />
        <button type="button" aria-pressed={roof} onClick={() => setRoof((r) => !r)}>
          <House size={14} aria-hidden="true" /><span>{en ? 'Roof' : '지붕'}</span>
        </button>
        <button type="button" aria-pressed={labels} onClick={() => setLabels((v) => !v)}>
          <Tag size={14} aria-hidden="true" /><span>{en ? 'Labels' : '이름표'}</span>
        </button>
      </div>
    </div>
  )
}

// ---------- 빛: 반구광 + 그림자 해 + 방 환경맵 (금속 배관·트레이가 어둡지 않게, 인터넷에서 받는 것 없음) ----------
function Lights() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#f4f7fb', '#b9a98a', 0.9]} />
      <directionalLight position={[45, 80, 55]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-62, 62, 62, -62, 1, 260]} />
      </directionalLight>
    </>
  )
}

// ---------- 모형 + 카메라 ----------
function ViewerScene({ view, roof, labels, reduced, en, onPick, onReady }) {
  const model = use(loadHorizonModel())
  const parts = useMemo(() => cloneParts(model, { pickable: true }), [model])
  const controls = useRef()
  const first = useRef(true)
  useEffect(() => {
    onReady(model)
    parts.status.forEach((m) => m.color.set(styleOf('operating').color))   // 확대 창은 가동 중인 홀 모습
    return () => parts.status.forEach((m) => m.dispose())
  }, [model, parts, onReady])
  // 시점 단추 → 카메라 이동 (처음 한 번과 모션 감소 설정이면 바로, 아니면 부드럽게)
  useEffect(() => {
    const v = VIEWS.find((x) => x.id === view)
    controls.current?.setLookAt(...v.pos, ...v.target, !first.current && !reduced)
    first.current = false
  }, [view, reduced])

  // 누른 곳 → 부품 정보 (랙은 몇 줄 몇 번째인지까지)
  const pick = (e) => {
    e.stopPropagation()
    let o = e.object
    if (o.userData.slotOf) {
      const { row, pos } = rackPlace(o.userData.slotOf[e.instanceId], PER_ROW)
      return onPick({ data: model.racks, sub: en ? `Row ${row} · rack ${pos} of ${PER_ROW}` : `${row}번째 줄 · ${pos}/${PER_ROW}번째 랙` })
    }
    while (o && !o.userData.part) o = o.parent
    if (o && o.userData.part !== 'pad') onPick({ data: o.userData, sub: countText(o.userData.count, en) })
  }

  return (
    <>
      <CameraControls ref={controls} makeDefault minDistance={1.2} maxDistance={260} maxPolarAngle={Math.PI * 0.49} smoothTime={0.35} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.06} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color="#d8ccae" roughness={1} />
      </mesh>
      <group onClick={pick}>
        {parts.always.map((o) => <primitive key={o.uuid} object={o} />)}
        <group visible={roof}>{parts.closed.map((o) => <primitive key={o.uuid} object={o} />)}</group>
        <group visible={!roof}>{parts.open.map((o) => <primitive key={o.uuid} object={o} />)}</group>
        <ViewerRacks model={model} visible={!roof} />
      </group>
      {!roof && <HallFlows flows={model.flows} reduced={reduced} radius={0.14} spacing={3.5} speed={2.5} />}
      {labels && <PartLabels model={model} roof={roof} en={en} onPick={onPick} />}
    </>
  )
}

const countText = (n, en) => (n ? (en ? `${n} units (illustrative count)` : `${n}대 (대수는 그림 표현)`) : null)

// ---------- 랙: 가까운 랙은 확대용 틀, 먼 랙은 멀리용 틀 (카메라가 움직일 때만 다시 나눔) ----------
function ViewerRacks({ model, visible }) {
  const sets = useMemo(() => {
    const n = model.slots.length
    const hi = makeInstanced(model.rackHi, MAX_HI, { pickable: true })
    const lo = makeInstanced(model.rackLo, n, { pickable: true })
    const hiSlot = new Int32Array(MAX_HI)
    const loSlot = new Int32Array(n)
    // 누른 랙 → 자리 번호 (InstancedMesh 의 몇 번째 → 모형의 몇 번째 자리)
    hi.forEach((m) => Object.assign(m.userData, { part: 'racks', slotOf: hiSlot }))
    lo.forEach((m) => Object.assign(m.userData, { part: 'racks', slotOf: loSlot }))
    ;[...hi, ...lo].forEach((m) => (m.frustumCulled = false))   // 바꿔 끼우는 동안 경계 구가 맞지 않으므로
    return { hi, lo, hiSlot, loSlot, mats: model.slots.map((s) => slotMatrix(s, new Matrix4())) }
  }, [model])
  useEffect(() => () => [...sets.hi, ...sets.lo].forEach((m) => m.dispose()), [sets])
  const last = useRef(new Vector3(Infinity, 0, 0))
  const cam = useRef([0, 0, 0])
  useFrame(({ camera }) => {
    if (camera.position.distanceToSquared(last.current) < 0.04) return   // 20 cm 넘게 움직였을 때만
    last.current.copy(camera.position)
    cam.current[0] = camera.position.x
    cam.current[1] = camera.position.y
    cam.current[2] = camera.position.z
    const { hi, lo } = splitByDistance(model.slots, cam.current, RACK_NEAR, MAX_HI)
    hi.forEach((slot, k) => {
      sets.hiSlot[k] = slot
      sets.hi.forEach((m) => m.setMatrixAt(k, sets.mats[slot]))
    })
    lo.forEach((slot, k) => {
      sets.loSlot[k] = slot
      sets.lo.forEach((m) => m.setMatrixAt(k, sets.mats[slot]))
    })
    // 바꿔 끼운 뒤에는 누르기 판정용 경계(구·상자)를 비워 둠 → 다음 클릭 때 지금 자리로 다시 계산 (안 하면 옛 자리 기준이라 랙을 놓침)
    ;[...sets.hi, ...sets.lo].forEach((m) => {
      m.count = m.userData.slotOf === sets.hiSlot ? hi.length : lo.length
      m.instanceMatrix.needsUpdate = true
      m.boundingSphere = null
      m.boundingBox = null
    })
  })
  return (
    <group visible={visible}>
      {[...sets.hi, ...sets.lo].map((m) => <primitive key={m.uuid} object={m} />)}
    </group>
  )
}

// ---------- 이름표: 부품 묶음의 위쪽 가운데 — 누르면 그 부품 카드 ----------
function PartLabels({ model, roof, en, onPick }) {
  const items = useMemo(() => {
    const out = []
    const box = new Box3()
    const all = [...model.parts.always, ...model.parts.open]
    for (const key of LABELED) {
      if (key === 'racks') {   // 랙은 홀 가운데 위
        const B = model.building
        out.push({ key, open: true, data: model.racks, pos: [B.cx + 6, 4.2, B.cz + 1] })
        continue
      }
      const node = all.find((o) => o.userData.part === key)
      if (!node) continue
      box.setFromObject(node)
      const pos = ANCHORS[key] ?? [(box.min.x + box.max.x) / 2, box.max.y + 1.2, (box.min.z + box.max.z) / 2]
      out.push({ key, open: node.userData.show === 'open', data: node.userData, pos })
    }
    return out
  }, [model])
  return items.filter((it) => !(roof && it.open)).map((it) => (
    <Html key={it.key} position={it.pos} center zIndexRange={[5, 0]}>
      <button type="button" className="hz-viewer-label" onClick={() => onPick({ data: it.data, sub: it.key === 'racks' ? countText(model.slots.length, en) : countText(it.data.count, en) })}>
        {en ? it.data.label_en : it.data.label_ko}
      </button>
    </Html>
  ))
}

// ---------- 모형을 못 받으면 (네트워크·gzip 을 못 푸는 오래된 브라우저) 안내 글 ----------
class ViewerBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('[3D] Horizon 확대 창 모형을 불러오지 못함:', error)
  }
  render() {
    return this.state.failed ? <div className="hz-viewer-wait">{this.props.message}</div> : this.props.children
  }
}
