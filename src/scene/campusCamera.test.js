import { it, expect, vi, afterEach } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { campusFrame, campusFrameBox, contentBox, campusOffset, campusViewport } from './campusCamera.js'
import { buildInfra } from '../../scripts/build-data.mjs'
import { layoutCampus } from './layoutCampus.js'

afterEach(() => vi.unstubAllGlobals())

// 캠퍼스 처음 화면: 부지 판 전체가 아니라 "건물·변전소가 있는 곳"에 맞춤
// (예전엔 판 전체 + 넉넉한 여백이라 1440×900 에서도 건물 영역이 가운데 약 350px 뿐이었음)
it.each([
  [1440, 900, { left: 24, right: 1049, top: 188, bottom: 800 }],
  [960, 968, { left: 24, right: 586, top: 174, bottom: 740 }],
  [390, 844, { left: 18, right: 372, top: 163, bottom: 468 }],
])('화면 %sx%s: 건물 영역 상자는 패널을 뺀 영역 안에 들어오고, 그 영역을 70% 이상 채움', (w, h, rect) => {
  for (const box of [{ x0: -12, x1: 12, z0: -17, z1: 13, y0: 0, y1: 3.5 }, { x0: -6, x1: 9, z0: -10, z1: 6, y0: 0, y1: 3.5 }, { x0: -20, x1: 21, z0: -22, z1: 10, y0: 0, y1: 3.5 }]) {
    const frame = campusFrameBox(box, w, h, rect)
    const camera = new PerspectiveCamera(30, w / h, 0.5, 3000)
    camera.position.fromArray(frame.position)
    camera.lookAt(new Vector3(...frame.target))
    const [ox, oy] = campusOffset(frame.distance, w, h, rect)
    camera.position.add(new Vector3(ox, -oy, 0).applyQuaternion(camera.quaternion))
    camera.updateMatrixWorld()
    const xs = [], ys = []
    for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
      const p = new Vector3(x, y, z).project(camera)
      xs.push((p.x + 1) * w / 2); ys.push((1 - p.y) * h / 2)
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(rect.left)
    expect(Math.max(...xs)).toBeLessThanOrEqual(rect.right)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(rect.top)
    expect(Math.max(...ys)).toBeLessThanOrEqual(rect.bottom)
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / (rect.right - rect.left), (Math.max(...ys) - Math.min(...ys)) / (rect.bottom - rect.top))
    expect(fill).toBeGreaterThanOrEqual(0.7)
  }
})

// 본사 화면은 카메라 방향을 따로 줌 (실제 동네에서 본사가 가장 잘 보이는 쪽) — 방향이 달라도 상자가 영역 안에 들어옴
it.each([[[-1, 1.4, 1]], [[1, 1.4, 0.2]], [[-1, 1.2, -1]]])('campusFrameBox: 카메라 방향 %j 를 주면 그 방향에서 상자를 맞춤', (direction) => {
  const w = 1440, h = 900, rect = { left: 224, right: 1056, top: 318, bottom: 860 }
  const box = { x0: -6, x1: 6, z0: -5, z1: 5, y0: 0, y1: 17 }
  const frame = campusFrameBox(box, w, h, rect, 30, 0.92, direction)
  // 카메라 위치 − 바라보는 점 = 준 방향 (크기만 다름)
  const v = frame.position.map((p, i) => p - frame.target[i]), l = Math.hypot(...v), dl = Math.hypot(...direction)
  v.forEach((c, i) => expect(c / l).toBeCloseTo(direction[i] / dl, 6))
  const camera = new PerspectiveCamera(30, w / h, 0.5, 3000)
  camera.position.fromArray(frame.position)
  camera.lookAt(new Vector3(...frame.target))
  const [ox, oy] = campusOffset(frame.distance, w, h, rect)
  camera.position.add(new Vector3(ox, -oy, 0).applyQuaternion(camera.quaternion))
  camera.updateMatrixWorld()
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
    const p = new Vector3(x, y, z).project(camera)
    expect((p.x + 1) * w / 2).toBeGreaterThanOrEqual(rect.left - 0.5)
    expect((p.x + 1) * w / 2).toBeLessThanOrEqual(rect.right + 0.5)
    expect((1 - p.y) * h / 2).toBeGreaterThanOrEqual(rect.top - 0.5)
    expect((1 - p.y) * h / 2).toBeLessThanOrEqual(rect.bottom + 0.5)
  }
})

it('건물 영역 상자는 모든 블록과 변전소를 담음', () => {
  const L = layoutCampus(buildInfra().sites.find((s) => s.id === 'childress'))
  const box = contentBox(L)
  for (const b of [...L.blocks, L.substation]) {
    expect(b.x - b.w / 2).toBeGreaterThanOrEqual(box.x0)
    expect(b.x + b.w / 2).toBeLessThanOrEqual(box.x1)
    expect(b.z - b.d / 2).toBeGreaterThanOrEqual(box.z0)
    expect(b.z + b.d / 2).toBeLessThanOrEqual(box.z1)
  }
})

it.each([
  [960, 968, { left: 24, right: 586, top: 174, bottom: 740 }],
  [1440, 900, { left: 24, right: 1066, top: 174, bottom: 672 }],
  [390, 844, { left: 18, right: 372, top: 163, bottom: 468 }],
])('화면 %sx%s: 캠퍼스 모서리는 패널을 제외한 영역에 들어옴', (w, h, rect) => {
  for (const side of [18, 37.2, 60]) {
    const frame = campusFrame(side, w, h, rect)
    const camera = new PerspectiveCamera(30, w / h, 0.5, 3000)
    camera.position.fromArray(frame.position)
    camera.lookAt(new Vector3(...frame.target))
    const [ox, oy] = campusOffset(frame.distance, w, h, rect)
    camera.position.add(new Vector3(ox, -oy, 0).applyQuaternion(camera.quaternion))
    camera.updateMatrixWorld()
    for (const x of [-side / 2, side / 2]) for (const y of [0, 7]) for (const z of [-side / 2, side / 2]) {
      const p = new Vector3(x, y, z).project(camera)
      const sx = (p.x + 1) * w / 2, sy = (1 - p.y) * h / 2
      expect(sx).toBeGreaterThanOrEqual(rect.left)
      expect(sx).toBeLessThanOrEqual(rect.right)
      expect(sy).toBeGreaterThanOrEqual(rect.top)
      expect(sy).toBeLessThanOrEqual(rect.bottom)
    }
  }
})

it.each([
  [1440, 900, false, false, { left:1066, top:170, bottom:650, width:358, height:480 }],
  [1440, 900, false, true, { left:1164, top:170, bottom:224, width:260, height:54 }],
  [390, 844, true, false, { left:8, top:448, bottom:836, width:374, height:388 }],
  [390, 844, true, true, { left:8, top:764, bottom:836, width:374, height:72 }],
  [1024, 900, true, false, { left:8, top:478, bottom:892, width:1008, height:414 }],
])('패널 접힘·실제 하단 배치를 반영한 가용 영역: %s × %s, bottom=%s, collapsed=%s', (width, height, bottomDocked, collapsed, rect) => {
  const panel = { getBoundingClientRect:()=>rect, classList:{ contains:()=>collapsed } }
  const boxes = {
    '.campus-panel':panel,
    '.kpis':{ getBoundingClientRect:()=>({ width, height:70, bottom:152 }) },
    '.bottom':{ getBoundingClientRect:()=>({ width, height:150, top:height-160 }) },
  }
  vi.stubGlobal('document', { querySelector:selector=>boxes[selector] })
  vi.stubGlobal('window', { getComputedStyle:()=>({ position:bottomDocked?'fixed':'static' }) })
  const safe=campusViewport(width,height)
  if(bottomDocked){
    expect(safe.bottom).toBeLessThan(rect.top)
    expect(safe.right-safe.left).toBeGreaterThan(width-40)
  }else if(collapsed){
    expect(safe.right-safe.left).toBeGreaterThan(width-50)
    expect(safe.top).toBeGreaterThan(rect.bottom)
  }else{
    expect(safe.right).toBeLessThan(rect.left)
  }
})
