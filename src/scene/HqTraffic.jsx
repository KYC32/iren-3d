// =============================================================
// HqTraffic — 본사 3D 화면의 움직이는 차와 Pitt St Mall 의 걷는 사람 (꾸밈 — 차 수·사람 수는 실제 통행량이 아님)
// -------------------------------------------------------------
// 자리 계산은 hqTraffic.js (차로 · 교차로 이어짐 · 판 가장자리에서 줄였다 키움 · 사람은 오가며 걸음)
// 차 모형: 캠퍼스 소품과 같은 public/models/campus-props.glb.gz (Kenney Car Kit, CC0) — 종류마다 InstancedMesh 하나
//   모형을 못 받으면 단순한 상자 차로 그림 (화면은 그대로 동작)
// 사람: 몸(캡슐) + 머리(공) InstancedMesh 두 개, 옷 색은 사람마다 조금씩
// 움직임 줄이기 설정이면 시간을 멈춤 (처음 자리에 서 있음) · 매 프레임 자리만 바꿈 (그리기 호출은 종류 수만큼)
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, MeshStandardMaterial, Object3D } from 'three'
import { loadPackedGlb } from './buildings/packedGlb.js'
import { useReducedMotion } from './useReducedMotion.js'
import { buildLanes, spawnCars, advanceCar, carPose, buildWalkPath, spawnWalkers, advanceWalker, walkerPose } from './hqTraffic.js'

const MODEL_URL = '/models/campus-props.glb.gz'
const BASE = 0.12        // 바닥 판 윗면 (HqCity.jsx 와 같음)
const CAR_SCALE = 0.6    // 캠퍼스 소품 차(길이 약 1.5) → 본사 화면 1칸 = 5.5m 에서 길이 약 0.9칸(≈5m)
const KINDS = ['sedan', 'suv', 'hatchback', 'van', 'pickup']
const noHit = () => null // 마우스 판정에서 뺌
const dummy = new Object3D()

// 차 모형은 한 번만 받음: { sedan: geometry, … } (캠퍼스 소품과 같은 파일이라 이미 받았으면 브라우저 캐시)
let carModels = null
function loadCarModels() {
  carModels ??= loadPackedGlb(MODEL_URL).then((gltf) => {
    const geo = {}
    gltf.scene.traverse((o) => { if (o.isMesh && o.name.startsWith('prop_') && KINDS.includes(o.name.slice(5))) geo[o.name.slice(5)] = o.geometry })
    return geo
  })
  return carModels
}
const carMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.1 })
// 모형을 못 받았을 때의 상자 차: 앞이 +z (모형과 같은 방향), 바닥이 0
const boxCar = new BoxGeometry(0.9, 0.5, 1.5).translate(0, 0.25, 0)
const boxMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.2 })

export default function HqTraffic({ roads }) {
  const lanes = useMemo(() => buildLanes(roads), [roads])
  const cars = useMemo(() => spawnCars(lanes), [lanes])
  const path = useMemo(() => buildWalkPath(roads), [roads])
  const walkers = useMemo(() => spawnWalkers(path), [path])
  const reduced = useReducedMotion()
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let live = true
    loadCarModels().then((g) => live && setGeo(g)).catch(() => live && setGeo({}))
    return () => { live = false }
  }, [])
  // 종류별 차 묶음 (모형이 없으면 모두 상자 한 묶음)
  const groups = useMemo(() => {
    if (!geo) return []
    const has = (k) => !!geo[k]
    const out = new Map()
    for (const c of cars) { const k = has(c.kind) ? c.kind : 'box'; (out.get(k) ?? out.set(k, []).get(k)).push(c) }
    return [...out.entries()]
  }, [geo, cars])
  const refs = useRef({})
  const body = useRef(), head = useRef()

  // 상자 차는 차마다 색 (모형 차는 꼭짓점 색 그대로)
  useLayoutEffect(() => {
    const box = refs.current.box
    if (!box) return
    const col = new Color()
    groups.find(([k]) => k === 'box')?.[1].forEach((c, i) => box.setColorAt(i, col.set(c.color)))
    if (box.instanceColor) box.instanceColor.needsUpdate = true
  }, [groups])
  useLayoutEffect(() => {
    if (!body.current) return
    const col = new Color()
    walkers.forEach((w, i) => body.current.setColorAt(i, col.set(w.shirt)))
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [walkers])

  useFrame((_, delta) => {
    const dt = reduced ? 0 : Math.min(delta, 0.1) // 탭을 다녀오면 한 번에 크게 뛰지 않게
    for (const c of cars) advanceCar(c, dt, lanes)
    for (const [k, list] of groups) {
      const mesh = refs.current[k]
      if (!mesh) continue
      list.forEach((c, i) => {
        const p = carPose(lanes, c)
        dummy.position.set(p.x, BASE + 0.002, p.z)
        dummy.rotation.set(0, p.heading, 0)
        dummy.scale.setScalar((k === 'box' ? 0.6 : CAR_SCALE) * p.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    if (path && body.current && head.current) {
      walkers.forEach((w, i) => {
        advanceWalker(w, dt, path)
        const p = walkerPose(path, w)
        dummy.scale.setScalar(1)
        dummy.rotation.set(0, p.heading, 0)
        dummy.position.set(p.x, BASE + 0.17 + p.bob, p.z); dummy.updateMatrix(); body.current.setMatrixAt(i, dummy.matrix)
        dummy.position.set(p.x, BASE + 0.34 + p.bob, p.z); dummy.updateMatrix(); head.current.setMatrixAt(i, dummy.matrix)
      })
      body.current.instanceMatrix.needsUpdate = true
      head.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group name="hq-traffic">
      {groups.map(([k, list]) => (
        <instancedMesh key={k} ref={(m) => { refs.current[k] = m }} args={[k === 'box' ? boxCar : geo[k], k === 'box' ? boxMaterial : carMaterial, list.length]}
          castShadow frustumCulled={false} raycast={noHit} />
      ))}
      {path && walkers.length > 0 && <>
        <instancedMesh ref={body} args={[null, null, walkers.length]} castShadow frustumCulled={false} raycast={noHit}>
          <capsuleGeometry args={[0.055, 0.2, 3, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </instancedMesh>
        <instancedMesh ref={head} args={[null, null, walkers.length]} castShadow frustumCulled={false} raycast={noHit}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#e2b896" roughness={0.7} />
        </instancedMesh>
      </>}
    </group>
  )
}
