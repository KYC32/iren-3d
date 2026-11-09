// 정적 메시 병합(mergeStatic.js) — 움직이지 않는 조각을 겉모습이 같은 것끼리 하나로 합쳐 그리기 호출을 줄임
import { it, expect } from 'vitest'
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { mergeParts, mergeObjects, partOf } from './mergeStatic.js'

const steel = () => new MeshStandardMaterial({ color: '#336699', roughness: 0.5, metalness: 0.6 })
const paint = () => new MeshStandardMaterial({ color: '#ffcc00', roughness: 0.9, metalness: 0 })
const at = (x, y = 0, z = 0) => new Matrix4().makeTranslation(x, y, z)

it('색·거칠기만 다른 표준 재질 조각은 메시 하나로 합치고, 색·거칠기·금속성은 꼭짓점마다 옮김', () => {
  const box = new BoxGeometry(1, 1, 1)
  const out = mergeParts([
    { geometry: box, material: steel(), matrix: at(0) },
    { geometry: box, material: paint(), matrix: at(5) },
  ])
  expect(out).toHaveLength(1)
  const g = out[0].geometry
  expect(g.getAttribute('position').count).toBe(box.getAttribute('position').count * 2)
  expect(g.index.count).toBe(box.index.count * 2)
  // 두 번째 상자는 x 로 5 옮겨진 자리
  const n = box.getAttribute('position').count
  expect(g.getAttribute('position').getX(n)).toBeCloseTo(box.getAttribute('position').getX(0) + 5)
  // 꼭짓점 색 = 원래 재질 색 (첫 조각 강철색, 둘째 조각 노란색)
  const color = g.getAttribute('color')
  expect(color.getX(0)).toBeCloseTo(steel().color.r)
  expect(color.getX(n)).toBeCloseTo(paint().color.r)
  // 꼭짓점마다 거칠기·금속성
  const rm = g.getAttribute('mergedRM')
  expect([rm.getX(0), rm.getY(0)]).toEqual([0.5, expect.closeTo(0.6)])
  expect([rm.getX(n), rm.getY(n)]).toEqual([expect.closeTo(0.9), 0])
  // 합친 재질: 꼭짓점 색을 쓰고 바탕색은 흰색 (곱해도 원래 색 그대로)
  expect(out[0].material.vertexColors).toBe(true)
  expect(out[0].material.color.getHex()).toBe(0xffffff)
})

it('같은 재질 하나를 같이 쓰는 조각은 재질을 그대로 두고 꼭짓점 색을 만들지 않음', () => {
  const m = steel()
  const out = mergeParts([
    { geometry: new BoxGeometry(), material: m, matrix: at(0) },
    { geometry: new BoxGeometry(), material: m, matrix: at(2) },
  ])
  expect(out).toHaveLength(1)
  expect(out[0].material).toBe(m)
  expect(out[0].geometry.getAttribute('color')).toBeUndefined()
})

it('그림자 설정·빛을 내는 정도·투명도·재질 종류가 다르면 따로 둠', () => {
  const box = new BoxGeometry()
  const glow = new MeshStandardMaterial({ color: '#ffffff', emissive: '#00ff00' })
  const glass = new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })
  const out = mergeParts([
    { geometry: box, material: steel(), matrix: at(0), castShadow: true },
    { geometry: box, material: steel(), matrix: at(1), castShadow: false },
    { geometry: box, material: glow, matrix: at(2) },
    { geometry: box, material: glass, matrix: at(3) },
    { geometry: box, material: new MeshBasicMaterial(), matrix: at(4) },
  ])
  expect(out).toHaveLength(5)
  expect(out.filter((o) => o.castShadow)).toHaveLength(1)
})

it('좌우를 뒤집은(배율 -1) 조각도 면이 바깥을 봄 — 삼각형 감는 방향을 되돌림', () => {
  const box = new BoxGeometry(1, 1, 1)
  const [{ geometry: g }] = mergeParts([{ geometry: box, material: steel(), matrix: new Matrix4().makeScale(-1, 1, 1) }])
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3()
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i)); b.fromBufferAttribute(pos, idx.getX(i + 1)); c.fromBufferAttribute(pos, idx.getX(i + 2))
    const face = b.clone().sub(a).cross(c.clone().sub(a)) // 감는 방향으로 정한 앞면 방향
    n.fromBufferAttribute(nor, idx.getX(i))
    expect(face.dot(n)).toBeGreaterThan(0)
  }
})

it('mergeObjects: 물체 묶음을 기준 틀 좌표로 구워 합친 Group 을 돌려줌 (여러 겹 부모 변환 포함)', () => {
  const frame = new Group()
  const a = new Group(); a.position.set(10, 0, 0); a.scale.setScalar(2)
  const m1 = new Mesh(new BoxGeometry(1, 1, 1), steel()); m1.position.set(1, 0, 0); m1.castShadow = true
  a.add(m1); frame.add(a)
  const b = new Mesh(new BoxGeometry(1, 1, 1), paint()); b.castShadow = true; frame.add(b)
  const merged = mergeObjects([a, b], frame)
  const meshes = merged.children.filter((o) => o.isMesh)
  expect(meshes).toHaveLength(1)
  merged.updateMatrixWorld(true)
  meshes[0].geometry.computeBoundingBox()
  const bb = meshes[0].geometry.boundingBox
  // a 안의 상자: 중심 10 + 1×2 = 12, 크기 2 → x 11..13 / b: -0.5..0.5
  expect(bb.max.x).toBeCloseTo(13)
  expect(bb.min.x).toBeCloseTo(-0.5)
  expect(meshes[0].castShadow).toBe(true)
})

it('mergeObjects: InstancedMesh·여러 재질 메시처럼 합칠 수 없는 것은 원래 자리 그대로 복사해 둠', () => {
  const frame = new Group()
  const multi = new Mesh(new BoxGeometry(), [steel(), paint()]); multi.position.set(3, 0, 0)
  frame.add(multi)
  const merged = mergeObjects([multi], frame)
  expect(merged.children).toHaveLength(1)
  expect(merged.children[0].position.x).toBeCloseTo(3)
})

it('partOf: 위치·배율·회전으로 조각 하나를 만듦', () => {
  const p = partOf(new BoxGeometry(), steel(), { position: [1, 2, 3], scale: [2, 2, 2], rotation: [0, Math.PI, 0], castShadow: true })
  const v = new Vector3(0.5, 0, 0).applyMatrix4(p.matrix)
  expect(v.x).toBeCloseTo(0)
  expect(v.y).toBeCloseTo(2)
  expect(p.castShadow).toBe(true)
})
