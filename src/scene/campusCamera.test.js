import { it, expect } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { campusFrame, campusOffset } from './campusCamera.js'

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
