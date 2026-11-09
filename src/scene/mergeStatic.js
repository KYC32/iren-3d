// =============================================================
// mergeStatic.js — 움직이지 않는 조각들을 하나의 메시로 합쳐 그리기 호출을 줄임
// -------------------------------------------------------------
// 왜: 3D 화면은 메시 하나마다 GPU 에 "그려라" 명령(그리기 호출)을 한 번씩 보냄.
//     그림자를 드리우는 메시는 그림자 그릴 때 한 번 더 보냄.
//     Horizon 모형 1동이 메시 39개, 소 1마리가 34개라서 휴대폰에서 이 명령 수가 부담이 됨.
// 어떻게: 같이 움직이는 조각끼리, 겉모습 규칙(재질 종류·빛을 내는 정도·투명도·그림자 설정)이 같으면 한 메시로 합침.
//   - 색·거칠기·금속성만 다르면: 그 값을 꼭짓점마다 적어 두고(꼭짓점 색 + mergedRM),
//     합친 재질이 꼭짓점 값을 읽어 원래 재질과 똑같이 칠함 → 화면은 그대로, 호출만 줄어듦
//   - 재질 하나를 같이 쓰던 조각끼리는 재질을 그대로 두고 모양만 합침
// 쓰는 곳: Horizon 모형(캠퍼스 화면), 롱혼 소, 건설 중 건물 기둥
// =============================================================
import { BufferAttribute, BufferGeometry, Color, Euler, Group, Matrix3, Matrix4, Mesh, Quaternion, Vector3 } from 'three'

// 개발 서버에서만: 주소에 ?nomerge 를 붙이면 합치지 않고 원래대로 그림 (합치기 전후 화면·호출 수 비교용)
//   배포판에서는 import.meta.env.DEV 가 false 라 늘 합침
export const MERGE_ON = !(import.meta.env?.DEV && typeof location !== 'undefined' && location.search.includes('nomerge'))

// ---------- 조각 하나 만들기 ----------
// 조각 = { geometry 모양, material 재질, matrix 기준 틀 안 위치·회전·배율, castShadow·receiveShadow 그림자 }
const _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3()
export function partOf(geometry, material, { position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], castShadow = false, receiveShadow = false } = {}) {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale
  const matrix = new Matrix4().compose(_p.set(...position), _q.setFromEuler(_e.set(...rotation)), _s.set(...s))
  return { geometry, material, matrix, castShadow, receiveShadow }
}

// ---------- 겉모습 규칙 ----------
// 색·거칠기·금속성은 꼭짓점으로 옮길 수 있어서 규칙에서 뺌. 나머지가 같아야 같이 합침
function lookKey(part) {
  const m = part.material
  return [
    m.type, m.emissive?.getHexString?.() ?? '', m.emissiveIntensity ?? '', m.transparent, m.opacity, m.side,
    m.depthWrite, m.depthTest, m.flatShading, m.map?.uuid ?? '', m.vertexColors, m.toneMapped, m.wireframe,
    m.name === 'HZ_status' ? m.uuid : '', // Horizon 상태색 띠: 건물 상태마다 색을 따로 바꾸므로 절대 섞지 않음
    !!part.castShadow, !!part.receiveShadow,
  ].join('|')
}

// 꼭짓점 값으로 칠할 수 있는 재질 (표준·물리 재질: 색·거칠기·금속성이 모두 있음)
const canPaint = (m) => m.isMeshStandardMaterial && !m.vertexColors

// ---------- 모양 하나를 기준 틀 좌표로 굽기 ----------
// 결과: 위치·법선(+ 모두 있으면 uv)만 남긴 Float32 배열 묶음과 삼각형 번호
const _n = new Vector3(), _v = new Vector3(), _nm = new Matrix3()
function bake(geometry, matrix) {
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const count = pos.count
  const out = { count, position: new Float32Array(count * 3), normal: new Float32Array(count * 3), uv: uv ? new Float32Array(count * 2) : null }
  _nm.getNormalMatrix(matrix)
  for (let i = 0; i < count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(matrix)
    out.position.set([_v.x, _v.y, _v.z], i * 3)
    if (nor) {
      _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize()
      out.normal.set([_n.x, _n.y, _n.z], i * 3)
    }
    if (uv) out.uv.set([uv.getX(i), uv.getY(i)], i * 2)
  }
  // 삼각형 번호: 없으면 0,1,2,… 로 만듦
  const index = geometry.index ? Array.from({ length: geometry.index.count }, (_, i) => geometry.index.getX(i)) : Array.from({ length: count }, (_, i) => i)
  // 배율이 음수(좌우 뒤집기)면 삼각형을 감는 방향이 뒤집혀 앞뒷면이 바뀜 → 두 꼭짓점 순서를 바꿔 되돌림
  if (matrix.determinant() < 0) for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  out.index = index
  out.hasNormal = !!nor
  return out
}

// ---------- 합친 재질 (꼭짓점 색·거칠기·금속성으로 칠함) ----------
// 원래 재질을 복사한 뒤 바탕색 흰색·거칠기 1·금속성 1 로 두고, 셰이더가 꼭짓점 값을 곱하게 함
//   흰색 × 꼭짓점 색 = 원래 색, 1 × 꼭짓점 거칠기 = 원래 거칠기 → 원래 재질과 같은 결과
function paintedMaterial(base) {
  const m = base.clone()
  m.name = `${base.name || base.type}-merged`
  m.color = new Color(1, 1, 1)
  m.vertexColors = true
  m.roughness = 1
  m.metalness = 1
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec2 mergedRM;\nvarying vec2 vMergedRM;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvMergedRM = mergedRM;')
    shader.fragmentShader = 'varying vec2 vMergedRM;\n' + shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor *= vMergedRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor *= vMergedRM.y;')
  }
  // 셰이더를 고쳤으므로 보통 재질과 다른 프로그램으로 따로 컴파일되게 이름표를 붙임
  m.customProgramCacheKey = () => 'merged-rm'
  return m
}

// ---------- 조각 묶음 → 합친 메시 목록 ----------
// 돌려주는 값: [{ geometry, material, ownMaterial, castShadow, receiveShadow }]
export function mergeParts(parts) {
  const groups = new Map()
  for (const part of parts) {
    const key = lookKey(part)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(part)
  }
  const out = []
  for (const list of groups.values()) {
    const shared = list.every((p) => p.material === list[0].material) // 모두 같은 재질 하나를 씀
    const paint = !shared && canPaint(list[0].material)
    // 꼭짓점으로 칠할 수 없는데 재질이 여럿이면 재질별로 다시 나눔 (기본 재질 등)
    if (!shared && !paint) {
      const byMat = new Map()
      for (const p of list) { if (!byMat.has(p.material)) byMat.set(p.material, []); byMat.get(p.material).push(p) }
      for (const sub of byMat.values()) out.push(build(sub, false))
      continue
    }
    out.push(build(list, paint))
  }
  return out
}

// 같은 겉모습 조각들을 실제로 이어 붙임
function build(list, paint) {
  const baked = list.map((p) => bake(p.geometry, p.matrix))
  const total = baked.reduce((n, b) => n + b.count, 0)
  const withUv = baked.every((b) => b.uv)
  const withNormal = baked.every((b) => b.hasNormal)
  const position = new Float32Array(total * 3)
  const normal = new Float32Array(total * 3)
  const uv = withUv ? new Float32Array(total * 2) : null
  const color = paint ? new Float32Array(total * 3) : null
  const rm = paint ? new Float32Array(total * 2) : null
  const index = []
  let base = 0
  baked.forEach((b, k) => {
    position.set(b.position, base * 3)
    normal.set(b.normal, base * 3)
    if (uv) uv.set(b.uv, base * 2)
    if (paint) {
      const m = list[k].material
      for (let i = 0; i < b.count; i++) {
        color.set([m.color.r, m.color.g, m.color.b], (base + i) * 3) // three 의 재질 색은 이미 선형 값 → 꼭짓점 색도 선형으로 그대로
        rm.set([m.roughness, m.metalness], (base + i) * 2)
      }
    }
    for (const i of b.index) index.push(base + i)
    base += b.count
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  if (uv) geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  if (color) geometry.setAttribute('color', new BufferAttribute(color, 3))
  if (rm) geometry.setAttribute('mergedRM', new BufferAttribute(rm, 2))
  geometry.setIndex(total > 65535 ? new BufferAttribute(new Uint32Array(index), 1) : new BufferAttribute(new Uint16Array(index), 1))
  if (!withNormal) geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  // ownMaterial: 여기서 새로 만든 재질(합친 재질)이면 true → 다 쓰고 나면 버려야 함. 원래 재질을 그대로 쓰면 false
  return { geometry, material: paint ? paintedMaterial(list[0].material) : list[0].material, ownMaterial: paint, castShadow: !!list[0].castShadow, receiveShadow: !!list[0].receiveShadow }
}

// ---------- 물체 묶음 → 합친 Group ----------
// objects 아래의 모든 메시를 frame(기준 틀) 좌표로 구워 합침. frame 은 합친 Group 을 놓을 자리의 부모
//   합칠 수 없는 것(InstancedMesh·여러 재질 메시·선 등)은 기준 틀 좌표 그대로 복사해 Group 에 넣음
const _inv = new Matrix4(), _rel = new Matrix4()
export function mergeObjects(objects, frame) {
  frame.updateMatrixWorld(true)
  _inv.copy(frame.matrixWorld).invert()
  const parts = [], keep = []
  for (const obj of objects) {
    obj.traverse((o) => {
      if (!o.visible) return
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !o.geometry.morphAttributes?.position) {
        parts.push({ geometry: o.geometry, material: o.material, matrix: _rel.multiplyMatrices(_inv, o.matrixWorld).clone(), castShadow: o.castShadow, receiveShadow: o.receiveShadow })
      } else if (o.isMesh || o.isLine || o.isPoints) {
        const c = o.clone(false)
        _rel.multiplyMatrices(_inv, o.matrixWorld).decompose(c.position, c.quaternion, c.scale)
        keep.push(c)
      }
    })
  }
  const group = new Group()
  for (const m of mergeParts(parts)) {
    const mesh = new Mesh(m.geometry, m.material)
    mesh.castShadow = m.castShadow
    mesh.receiveShadow = m.receiveShadow
    group.add(mesh)
  }
  keep.forEach((c) => group.add(c))
  return group
}
