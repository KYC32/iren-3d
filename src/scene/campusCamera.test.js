import { it, expect, vi, afterEach } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { campusFrame, campusOffset, campusViewport } from './campusCamera.js'

afterEach(() => vi.unstubAllGlobals())

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
