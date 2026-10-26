// =============================================================
// CampusProps — 캠퍼스 3D 소품: 주차장과 주차한 차 · 건설중 건물 옆 공사 장비 (그림 표현)
// -------------------------------------------------------------
// 자리는 campusProps.js(순수 함수)가 정하고, 여기서는 그리기만 합니다.
// 모형: public/models/campus-props.glb.gz (scripts/blender/campus-props.py · Kenney Car Kit / City Kit Industrial, CC0)
//   종류마다 InstancedMesh 하나 → 차 8대·장비 수십 개여도 그리기 호출은 종류 수(최대 8)만큼
//   모형을 못 받으면 주차장 바닥만 그리고 차·장비는 생략 (화면은 그대로 동작)
// SiteView 가 지연 로딩(React.lazy) → GLTFLoader 와 함께 첫 3D 지도 묶음 밖
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MeshStandardMaterial, Object3D } from 'three'
import { campusProps } from '../campusProps.js'
import { loadPackedGlb } from './packedGlb.js'

const MODEL_URL = '/models/campus-props.glb.gz'
const noHit = () => null   // 마우스 판정에서 뺌 (소품 때문에 건물 클릭이 막히지 않게)
const dummy = new Object3D()

// 모형은 한 번만 받아 모든 캠퍼스가 같이 씀: { sedan: geometry, … }
let modelPromise = null
function loadPropsModel() {
  modelPromise ??= loadPackedGlb(MODEL_URL).then((gltf) => {
    const geo = {}
    gltf.scene.traverse((o) => { if (o.isMesh && o.name.startsWith('prop_')) geo[o.name.slice(5)] = o.geometry })
    return geo
  })
  return modelPromise
}

// 꼭짓점 색 + 면마다 음영(flatShading): 모형에 법선이 없어 면 방향으로 밝기를 계산 (저폴리 모양 그대로)
const propMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0 })

export default function CampusProps({ layout, state, keep }) {
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let live = true
    loadPropsModel().then((g) => live && setGeo(g)).catch(() => {})
    return () => { live = false }
  }, [])

  const { parking, construction } = useMemo(() => campusProps({ ...layout, ...state }, { keep }), [layout, state, keep])
  // 종류별로 모음: { sedan: [{x,z,rot}, …], loader: […] }
  const byKind = useMemo(() => {
    const out = {}
    for (const p of [...(parking?.cars ?? []), ...construction]) (out[p.kind] ??= []).push(p)
    return out
  }, [parking, construction])

  return (
    <group name="campus-props">
      {parking && <ParkingLot lot={parking} />}
      {geo && Object.entries(byKind).map(([kind, items]) => geo[kind] && <PropInstances key={kind} geometry={geo[kind]} items={items} />)}
    </group>
  )
}

// 같은 종류 소품 여러 개를 한 번에 (자리·방향만 다름)
function PropInstances({ geometry, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((p, i) => {
      dummy.position.set(p.x, 0.03, p.z)   // 0.03 = 주차장·땅 바닥 두께 위
      dummy.rotation.set(0, p.rot, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()   // 자리가 바뀌면 화면 밖 판정(컬링)을 다시
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, propMaterial, items.length]} castShadow receiveShadow raycast={noHit} />
}

// 주차장: 아스팔트 판 + 칸 선 (차가 없는 칸도 선은 그림)
function ParkingLot({ lot }) {
  const lines = useMemo(() => {
    const out = []
    const rows = [...new Set(lot.slots.map((s) => s.z))]
    const xs = [...new Set(lot.slots.map((s) => s.x))].sort((a, b) => a - b)
    const half = xs.length > 1 ? (xs[1] - xs[0]) / 2 : 0.5
    for (const z of rows) for (const x of [...xs.map((v) => v - half), xs.at(-1) + half]) out.push([x, z])
    return out
  }, [lot])
  return (
    <group>
      <mesh position={[lot.x, 0.02, lot.z]} receiveShadow raycast={noHit}>
        <boxGeometry args={[lot.w, 0.04, lot.d]} />
        <meshStandardMaterial color="#9aa2a6" roughness={1} />
      </mesh>
      {lines.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.045, z]} raycast={noHit}>
          <boxGeometry args={[0.05, 0.01, 1.6]} />
          <meshBasicMaterial color="#eef1ee" />
        </mesh>
      ))}
    </group>
  )
}
