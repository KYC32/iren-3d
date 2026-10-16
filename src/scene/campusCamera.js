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

// 상자(x0~x1 · y0~y1 · z0~z1)의 꼭짓점이 모두 쓸 수 있는 화면 영역(rect)에 들어오는 시점
//   campusFrame 은 부지 판 전체(정사각형 + 넉넉한 여백)용. 이것은 처음 화면을 "건물이 있는 곳"에 맞출 때 씀
//   → 예전엔 판 전체를 맞춰 1440×900 에서도 건물 영역이 가운데 약 350px 뿐이었음 (지금은 약 700px)
//   fill: 영역 가장자리에 남길 여유 비율 (0.92 = 8% 여유)
export function campusFrameBox(box, width, height, rect, fov = 30, fill = 0.92) {
  const direction = [1, 1.05, 1]          // 캠퍼스를 내려다보는 방향 (campusFrame 과 같은 구도)
  const length = Math.hypot(...direction)
  const dir = direction.map((v) => v / length)
  const right = [Math.SQRT1_2, 0, -Math.SQRT1_2]
  const up = [-dir[1] * Math.SQRT1_2, Math.SQRT2 * dir[0], -dir[1] * Math.SQRT1_2]
  const tan = Math.tan(fov * Math.PI / 360)
  const center = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2]
  const usableW = Math.max(80, rect.right - rect.left) / width * fill
  const usableH = Math.max(80, rect.bottom - rect.top) / height * fill
  // 쓸 수 있는 영역의 가운데가 화면 가운데에서 얼마나 비켜 있는지 (-1~1) — 원근 때문에 비킨 만큼 여유를 더 둠
  const nx = (rect.left + rect.right) / width - 1
  const ny = 1 - (rect.top + rect.bottom) / height
  let distance = 1
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
    const v = [x - center[0], y - center[1], z - center[2]]   // 상자 가운데에서 본 꼭짓점
    const dot = (axis) => v.reduce((sum, n, i) => sum + n * axis[i], 0)
    distance = Math.max(distance, dot(dir) + Math.abs(dot(right) + nx * dot(dir) * tan * width / height) / (tan * width / height * usableW),
      dot(dir) + Math.abs(dot(up) + ny * dot(dir) * tan) / (tan * usableH))
  }
  return { position: dir.map((v, i) => v * distance + center[i]), target: center, distance }
}

// 건물 영역 상자: 모든 블록(빈 부지 칸 포함)과 변전소를 담고 둘레에 pad 만큼 여유
//   높이 3.5 = 건물(최대 2.4) + 지붕 위 표시 여유
export function contentBox(L, pad = 1.5) {
  const items = [...L.blocks, L.substation]
  return {
    x0: Math.min(...items.map((b) => b.x - b.w / 2)) - pad, x1: Math.max(...items.map((b) => b.x + b.w / 2)) + pad,
    z0: Math.min(...items.map((b) => b.z - b.d / 2)) - pad, z1: Math.max(...items.map((b) => b.z + b.d / 2)) + pad,
    y0: 0, y1: 3.5,
  }
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
