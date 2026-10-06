// 지구본 좌표 유틸
// three-globe 내부와 똑같은 공식(polar2Cartesian)을 써야 핀이 육지 위 정확한 위치에 섭니다.
import { Vector3 } from 'three'

export const GLOBE_RADIUS = 100 // three-globe 의 기본 반지름

// 위도·경도(+고도 비율) → 3D 좌표
export function latLngToVec3(lat, lng, alt = 0) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((90 - lng) * Math.PI) / 180
  const r = GLOBE_RADIUS * (1 + alt)
  return new Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

// 너무 가까운 핀(예: Sweetwater 1·2)을 화면에서 겹치지 않게 살짝 밀어냅니다.
// 실제 좌표는 바꾸지 않고 "표시용 좌표"만 만듭니다. (패널에 '좌표는 근사치' 안내)
export function spreadPins(sites, minDeg = 2.2, iterations = 40) {
  const pts = sites.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng }))
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j]
        const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180) // 고위도일수록 경도 1도가 짧음
        let dx = (b.lng - a.lng) * k
        let dy = b.lat - a.lat
        let dist = Math.hypot(dx, dy)
        if (dist >= minDeg) continue
        if (dist < 1e-6) { dx = 1; dy = 0; dist = 1 }
        const push = (minDeg - dist) / 2
        const ux = dx / dist, uy = dy / dist
        a.lng -= (ux * push) / k; a.lat -= uy * push
        b.lng += (ux * push) / k; b.lat += uy * push
      }
    }
  }
  return Object.fromEntries(pts.map((p) => [p.id, { lat: p.lat, lng: p.lng }]))
}

// 숫자 표시: 1,000MW 이상은 GW 로
export function fmtMw(mw, digits = 1) {
  if (mw == null) return '–'
  if (mw >= 1000) return `${(mw / 1000).toFixed(digits).replace(/\.0$/, '')} GW`
  return `${Math.round(mw).toLocaleString()} MW`
}
