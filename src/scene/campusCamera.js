import { campusPanelLayout } from '../ui/panelLayout.js'

// 화면 패널을 제외한 영역에 캠퍼스 경계 상자가 들어오도록 시점을 계산합니다.
export function campusFrame(side, width, height, rect, fov = 30) {
  const direction = [1, 1.05, 1]
  const length = Math.hypot(...direction)
  const dir = direction.map((v) => v / length)
  const right = [Math.SQRT1_2, 0, -Math.SQRT1_2]
  const up = [-dir[1] * Math.SQRT1_2, Math.SQRT2 * dir[0], -dir[1] * Math.SQRT1_2]
  const tan = Math.tan(fov * Math.PI / 360)
  const half = side / 2 + 2
  const center = [0, 2, 0]
  let distance = side
  // 화면 중심 이동에 의한 원근 오차까지 여유를 두어 포함합니다.
  const usableW = Math.max(80, rect.right - rect.left) / width * 0.96
  const usableH = Math.max(80, rect.bottom - rect.top) / height * 0.94
  const nx = (rect.left + rect.right) / width - 1
  const ny = 1 - (rect.top + rect.bottom) / height
  for (const x of [-half, half]) for (const y of [-2, 5]) for (const z of [-half, half]) {
    const v = [x, y, z]
    const dot = (axis) => v.reduce((sum, n, i) => sum + n * axis[i], 0)
    distance = Math.max(distance, dot(dir) + Math.abs(dot(right) + nx * dot(dir) * tan * width / height) / (tan * width / height * usableW),
      dot(dir) + Math.abs(dot(up) + ny * dot(dir) * tan) / (tan * usableH))
  }
  return { position: dir.map((v, i) => v * distance + center[i]), target: center, distance }
}

export function campusOffset(distance, width, height, rect, fov = 30) {
  const worldH = 2 * Math.tan(fov * Math.PI / 360) * distance
  return [
    (width / 2 - (rect.left + rect.right) / 2) / height * worldH,
    (height / 2 - (rect.top + rect.bottom) / 2) / height * worldH,
    0,
  ]
}

// DOM에는 실제 패널 크기가 반영되므로 언어·화면 크기가 달라도 같은 구도를 유지합니다.
export function campusViewport(width, height) {
  const box = (selector) => {
    const el = document.querySelector(selector)
    const r = el?.getBoundingClientRect()
    return r?.width && r?.height ? r : null
  }
  const top = (box('.kpis')?.bottom ?? 150) + 18
  const panel = campusPanelLayout()
  if (panel?.bottomDocked || width < 768) return { left: 18, right: width - 18, top, bottom: (panel?.rect.top ?? height - 8) - 14 }
  const bottom = box('.bottom')
  return { left: 24, right: panel && !panel.collapsed ? panel.rect.left - 18 : width - 24,
    top: panel?.collapsed ? Math.max(top, panel.rect.bottom + 14) : top,
    bottom: (bottom?.top ?? height - 180) - 14 }
}
