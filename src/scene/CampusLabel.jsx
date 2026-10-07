import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Html from './SafeHtml.jsx'
import { campusViewport } from './campusCamera.js'

export function CampusLabel({ children, priority = 20, position, hideOnOverlap = false }) {
  return <Html position={position} center zIndexRange={[12, 0]}>
    <div className="campus-label" data-priority={priority} data-hide-on-overlap={hideOnOverlap ? "1" : "0"}>{children}</div>
  </Html>
}

// 히스테리시스를 두어 확대 경계에서 라벨이 깜빡이지 않게 합니다.
export function useCampusDetail(side) {
  const [detail, setDetail] = useState(false)
  const current = useRef(false)
  useFrame(({ controls }) => {
    if (!controls) return
    const next = controls.distance < side * (current.current ? 3.5 : 3.1)
    if (next !== current.current) { current.current = next; setDetail(next) }
  })
  return detail
}

// 라벨 실제 너비(한/영 포함)를 이용해 화면 경계와 겹침을 피합니다.
// DOM 크기만 읽고, 가려도 공간은 보존하므로 다음 검사에서 다시 나타날 수 있습니다.
export function CampusLabelLayout() {
  const last = useRef(0)
  useFrame(({ clock, size }) => {
    if (clock.elapsedTime >= last.current && clock.elapsedTime - last.current < 0.12) return
    last.current = clock.elapsedTime
    const safe = campusViewport(size.width, size.height)
    const labels = [...document.querySelectorAll('.campus-label')]
      .map((el) => ({ el, rect: el.getBoundingClientRect(), priority: Number(el.dataset.priority) }))
      .sort((a, b) => b.priority - a.priority)
    const used = []
    for (const { el, rect: measured } of labels) {
      const previous = Number(el.dataset.shift ?? 0)
      const previousX = Number(el.dataset.shiftX ?? 0)
      const base = { left: measured.left - previousX, right: measured.right - previousX, top: measured.top - previous, bottom: measured.bottom - previous }
      // 트럭은 위치를 옮기지 않고, 원래 위치에서 겹치면 숨깁니다.
      const shifts = el.dataset.hideOnOverlap === '1' ? [0] : [0, -28, 28, -56, 56]
      let placed = null
      for (const shift of shifts) {
        const r = { ...base, top: base.top + shift, bottom: base.bottom + shift }
        const inside = r.left >= safe.left && r.right <= safe.right && r.top >= safe.top && r.bottom <= safe.bottom
        const overlaps = used.some((a) => r.left < a.right + 8 && r.right + 8 > a.left && r.top < a.bottom + 6 && r.bottom + 6 > a.top)
        if (inside && !overlaps) { placed = { rect: r, shift }; break }
      }
      el.style.visibility = placed ? 'visible' : 'hidden'
      el.style.pointerEvents = placed ? '' : 'none'
      if (placed) {
        el.style.translate = `0px ${placed.shift}px`
        el.dataset.shiftX = '0'
        el.dataset.shift = String(placed.shift)
        el.style.setProperty('--leader-length', `${Math.abs(placed.shift)}px`)
        el.style.setProperty('--leader-top', placed.shift < 0 ? '100%' : 'auto')
        el.style.setProperty('--leader-bottom', placed.shift > 0 ? '100%' : 'auto')
        used.push(placed.rect)
      }
    }
  })
  return null
}
