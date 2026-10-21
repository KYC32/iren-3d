// =============================================================
// HorizonHall — 차일드레스 Horizon 1~4 를 실제 모양 3D 모형(GLB)으로 그림
// -------------------------------------------------------------
// 모형 설계도: scripts/blender/horizon-hall.py → public/models/horizon-hall.glb.gz (gzip 으로 줄인 GLB, 약 40 KiB)
//   닫힘(A): 건물 + 마당 설비 (건식 냉각기·칠러·펌프·발전기·변압기·1차 배관)
//   열림(B, 건물을 고르면): 지붕·앞벽이 걷히고 전기실·CDU·천장 배관과 랙 348대가 바닥에서 솟아오름
//     랙은 모형 안의 "틀" 하나를 348 자리에 찍어 씀(InstancedMesh) → 그리기 호출이 몇 번뿐
//   전기(초록)·찬물(파랑)·데워진 물(빨강)이 도는 길을 점이 따라 흐름 (모형에 넣어 둔 꺾인 선)
// 이 파일과 GLTFLoader·meshopt 해제기는 Block.jsx 가 처음 필요할 때 받음 → 첫 3D 지도 예산(check-size)과 무관
// 받는 동안이나 실패하면 Block.jsx 가 예전 상자(FinishedHall)를 그대로 그림
// 배치·대수는 회사가 밝히지 않은 그림 표현 → 속을 열면 그 안내를 띄움
// =============================================================
import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, InstancedMesh, MeshBasicMaterial, Object3D, SphereGeometry } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { styleOf, PENDING_COLOR } from '../../data/statusStyle.js'
import { POWER_FLOW_COLOR } from '../powerFlow.js'
import { useReducedMotion } from '../useReducedMotion.js'
import { useAppStore } from '../../store/useAppStore.js'
import { CampusLabel } from '../CampusLabel.jsx'
import { NightWindows, noHit } from './Block.jsx'
import { isGzip, isGlb, fitScale, cumulative, pointAlong, flowDots, readJson } from '../horizonHall.js'

const MODEL_URL = '/models/horizon-hall.glb.gz'
const PLINTH = 0.14      // 다른 건물과 같은 낮은 기단 (선택·호버 바닥 판이 모형 밑으로 숨게)
const RISE_SEC = 0.6     // 속을 열 때 설비·랙이 솟아오르는 시간
const DOT_SPACING = 7    // 흐르는 점 간격 (m)
const DOT_SPEED = 6      // 흐르는 점 속도 (m/초 — 실제 유속이 아니라 보기 좋은 빠르기)
const FLOW_COLORS = { power: POWER_FLOW_COLOR, supply: '#3d8bff', return: '#ff5a4a' }
const DOT_GEO = new SphereGeometry(0.6, 8, 6)   // 흐르는 점 (반지름 0.6 m — 캠퍼스에서 보일 만큼)
const dummy = new Object3D()
const P = [0, 0, 0]

// ---------- 모형 받기 (한 번만 받아 모든 Horizon 이 같이 씀) ----------
let modelPromise = null
function loadModel() {
  modelPromise ??= fetch(MODEL_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`모형 파일 ${r.status}`)
      return r.arrayBuffer()
    })
    .then(unpack)
    .then((buf) => {
      const loader = new GLTFLoader()
      loader.setMeshoptDecoder(MeshoptDecoder)
      return loader.parseAsync(buf, '')
    })
    .then((gltf) => prepare(gltf.scene))
  return modelPromise
}

// gzip 이면 브라우저 기본 기능(DecompressionStream)으로 풂. 서버가 이미 풀어서 줬으면 그대로 씀
async function unpack(buf) {
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength))
  if (isGlb(head)) return buf
  if (!isGzip(head)) throw new Error('모형 파일 형식을 알 수 없음')
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 gzip 풀기를 지원하지 않음')
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

// 읽은 장면 → 부품 묶음 (show: always 늘 · closed 닫혔을 때 · open 속을 열었을 때) + 랙 틀·자리 + 흐름 선 + 건물 크기
function prepare(scene) {
  scene.updateMatrixWorld(true)
  const root = scene.getObjectByName('Horizon_hall') ?? scene
  const parts = { always: [], closed: [], open: [] }
  for (const child of root.children) parts[child.userData?.show]?.push(child)
  const rackLo = []
  root.getObjectByName('HZ_rack_lo')?.traverse((o) => o.isMesh && rackLo.push(o))
  const box = new Box3().setFromObject(root.getObjectByName('HZ_shell'))
  return {
    info: root.userData,
    lot: readJson(root.userData.lot_m, [60, 90]),
    parts,
    rackLo,
    slots: readJson(root.getObjectByName('HZ_racks')?.userData.slots, []),
    flows: readJson(root.getObjectByName('HZ_flows')?.userData.flows, {}),
    building: { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, d: box.max.z - box.min.z, h: box.max.y },
  }
}

// 이 건물만의 사본: 기하·재질은 모든 Horizon 이 같이 쓰고, 상태색 띠 재질만 따로 (색을 바꾸려고)
function cloneParts(model) {
  const status = []
  const copy = (list) => list.map((part) => {
    const c = part.clone(true)
    c.traverse((o) => {
      if (!o.isMesh) return
      o.raycast = noHit                  // 삼각형 수만 개를 마우스 판정에서 뺌 (판정은 아래 투명 상자가 받음)
      o.castShadow = o.receiveShadow = true
      if (o.material?.name === 'HZ_status') {
        o.material = o.material.clone()
        status.push(o.material)
      }
    })
    return c
  })
  return { always: copy(model.parts.always), closed: copy(model.parts.closed), open: copy(model.parts.open), status }
}

// 랙 348대: 틀(몸체·표시등·매니폴드 띠)마다 InstancedMesh 하나 → 자리 목록대로 찍음
function makeRacks(model) {
  return model.rackLo.map((tpl) => {
    const inst = new InstancedMesh(tpl.geometry, tpl.material, model.slots.length)
    model.slots.forEach(([x, y, z, rot], i) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, rot, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    inst.raycast = noHit
    inst.castShadow = inst.receiveShadow = true
    return inst
  })
}

export default function HorizonHall({ w, d, status, beacon, nightMaterial, racks = 0 }) {
  const model = use(loadModel())
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

  const note = lang === 'en' ? model.info.note_en : model.info.note_ko
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
        {open && <Flows flows={model.flows} reduced={reduced} />}
      </group>
      {/* 밤 창문 띠 (건물 부분만, 속을 열었을 땐 없음) */}
      {nightMaterial && !open && (
        <group position={[B.cx * s, PLINTH, B.cz * s]}>
          <NightWindows w={B.w * s} d={B.d * s} h={B.h * s} material={nightMaterial} />
        </group>
      )}
      {beacon && <Beacon position={[(B.cx + B.w / 2) * s - 0.2, bTop + 0.35, (B.cz + B.d / 2) * s - 0.2]} reduced={reduced} />}
      {/* 속을 열면: 배치·대수는 그림 표현이라는 안내 (마당 앞 오른쪽 모서리) */}
      {open && (
        <CampusLabel position={[w / 2 - 0.2, PLINTH + 0.3, d / 2]} priority={18}>
          <div className="hz-note" title={note}>
            {lang === 'en' ? '3D model · layout and counts are illustrative' : '3D 모형 · 배치·대수는 그림 표현'}
          </div>
        </CampusLabel>
      )}
    </group>
  )
}

// ---------- 전기·냉각수가 도는 길을 따라 흐르는 점 ----------
// 종류(전기·찬물·데워진 물)마다 InstancedMesh 하나 → 점 수백 개를 그리기 호출 3번으로
function Flows({ flows, reduced }) {
  const sets = useMemo(() => Object.entries(FLOW_COLORS).map(([kind, color]) => {
    const lines = flows[kind] ?? []
    const dots = flowDots(lines, DOT_SPACING)
    const mesh = new InstancedMesh(DOT_GEO, new MeshBasicMaterial({ color, toneMapped: false }), Math.max(1, dots.length))
    mesh.count = dots.length
    mesh.raycast = noHit
    mesh.frustumCulled = false   // 점이 매 프레임 움직여 경계 구가 맞지 않으므로 늘 그림
    return { lines, cums: lines.map(cumulative), dots, mesh }
  }), [flows])
  useEffect(() => () => sets.forEach((x) => {
    x.mesh.material.dispose()
    x.mesh.dispose()
  }), [sets])
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime * DOT_SPEED   // 모션 감소 설정이면 점이 제자리 (길만 보여 줌)
    for (const x of sets) {
      x.dots.forEach((dot, i) => {
        pointAlong(x.lines[dot.line], x.cums[dot.line], dot.offset + t, P)
        dummy.position.set(P[0], P[1], P[2])
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        x.mesh.setMatrixAt(i, dummy.matrix)
      })
      x.mesh.instanceMatrix.needsUpdate = true
    }
  })
  return sets.map((x, i) => <primitive key={i} object={x.mesh} />)
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
