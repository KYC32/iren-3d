// =============================================================
// horizonModel.js — Horizon 홀 3D 모형(GLB)을 받아 쓰기 좋게 정리
// -------------------------------------------------------------
// 캠퍼스 화면(HorizonHall)과 확대 보기 창(viewer/HorizonViewer)이 같이 씀 → 모형은 한 번만 받음
// 모형 설계도: scripts/blender/horizon-hall.py → public/models/horizon-hall.glb.gz (meshopt GLB 를 gzip 으로 한 번 더)
// 지연 로딩되는 두 화면에서만 import → GLTFLoader·meshopt 해제기와 함께 따로 떨어진 묶음이 됨 (첫 화면 예산과 무관)
// =============================================================
import { Box3, InstancedMesh, Matrix4, Object3D } from 'three'
import { readJson } from '../horizonHall.js'
import { loadPackedGlb } from './packedGlb.js'   // gzip GLB 받기·풀기·읽기 (캠퍼스 소품과 공용)

const MODEL_URL = '/models/horizon-hall.glb.gz'
const noHit = () => null   // 마우스 판정에서 뺌
const dummy = new Object3D()

// ---------- 모형 받기 (한 번만 받아 모든 화면이 같이 씀) ----------
let modelPromise = null
export function loadHorizonModel() {
  modelPromise ??= loadPackedGlb(MODEL_URL).then((gltf) => prepare(gltf.scene))
  return modelPromise
}

// 읽은 장면 → 부품 묶음 (show: always 늘 · closed 닫혔을 때 · open 속을 열었을 때) + 랙 틀·자리 + 흐름 선 + 건물 크기
function prepare(scene) {
  scene.updateMatrixWorld(true)
  const root = scene.getObjectByName('Horizon_hall') ?? scene
  const parts = { always: [], closed: [], open: [] }
  for (const child of root.children) parts[child.userData?.show]?.push(child)
  const meshesOf = (name) => {
    const out = []
    root.getObjectByName(name)?.traverse((o) => o.isMesh && out.push(o))
    return out
  }
  const racks = root.getObjectByName('HZ_racks')?.userData ?? {}
  const box = new Box3().setFromObject(root.getObjectByName('HZ_shell'))
  return {
    info: root.userData,                        // 근거 요약 (note_ko/en), 부지·건물 크기, 랙 수
    lot: readJson(root.userData.lot_m, [60, 90]),
    parts,
    racks,                                      // 랙 부품 정보 (이름·하는 일·근거)
    rackLo: meshesOf('HZ_rack_lo'),             // 멀리용 랙 틀 (몸체·표시등·매니폴드 띠)
    rackHi: meshesOf('HZ_rack_hi'),             // 확대용 랙 틀 (트레이·매니폴드·호스·버스바·광케이블)
    slots: readJson(racks.slots, []),
    flows: readJson(root.getObjectByName('HZ_flows')?.userData.flows, {}),
    building: { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, d: box.max.z - box.min.z, h: box.max.y },
  }
}

// 이 화면만의 사본: 기하·재질은 같이 쓰고, 상태색 띠 재질만 따로 (색을 바꾸려고)
//   pickable = false (캠퍼스): 삼각형 수만 개를 마우스 판정에서 뺌 / true (확대 창): 부품을 눌러 고를 수 있게 둠
export function cloneParts(model, { pickable = false } = {}) {
  const status = []
  const copy = (list) => list.map((part) => {
    const c = part.clone(true)
    c.traverse((o) => {
      if (!o.isMesh) return
      if (!pickable) o.raycast = noHit
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

// 랙 자리 하나의 행렬 (위치 + 세로축 회전)
export function slotMatrix([x, y, z, rot], out = new Matrix4()) {
  dummy.position.set(x, y, z)
  dummy.rotation.set(0, rot, 0)
  dummy.scale.set(1, 1, 1)
  dummy.updateMatrix()
  return out.copy(dummy.matrix)
}

// 틀(여러 재질 조각)마다 InstancedMesh 하나 — capacity 대까지 찍을 수 있게
export function makeInstanced(templates, capacity, { pickable = false } = {}) {
  return templates.map((tpl) => {
    const inst = new InstancedMesh(tpl.geometry, tpl.material, Math.max(1, capacity))
    if (!pickable) inst.raycast = noHit
    inst.castShadow = inst.receiveShadow = true
    return inst
  })
}

// 캠퍼스용: 멀리용 틀을 모든 자리에 찍음
export function makeRacks(model) {
  const meshes = makeInstanced(model.rackLo, model.slots.length)
  const m = new Matrix4()
  model.slots.forEach((slot, i) => {
    slotMatrix(slot, m)
    meshes.forEach((inst) => inst.setMatrixAt(i, m))
  })
  meshes.forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
  })
  return meshes
}
