// 지구본 좌표 유틸
// 육지 타일(land-hex.json)과 핀이 모두 이 공식 하나로 위치를 계산해야 정확히 겹칩니다.
import { Vector3 } from 'three'

export const GLOBE_RADIUS = 100 // 지구본 반지름 (3D 단위)

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

// 가까이 모인 사이트(예: 텍사스 4곳)를 무리로 묶습니다.
// 멀리서 볼 때는 무리의 대표(가장 큰 사이트) 라벨만 "+N" 과 함께 보여 겹침을 막고,
// 가까이 줌하거나 호버하면 모든 라벨을 펼칩니다.
export function labelRanks(sites, nearDeg = 5.5) {
  const leads = []
  const ranks = {}
  // 계통 전력이 큰 사이트가 대표가 되도록 큰 순서로 처리
  for (const s of [...sites].sort((a, b) => b.grid_mw - a.grid_mw)) {
    const lead = leads.find((l) => Math.hypot(l.lat - s.lat, (l.lng - s.lng) * Math.cos((s.lat * Math.PI) / 180)) < nearDeg)
    if (lead) {
      ranks[s.id] = { lead: false, members: [] }
      ranks[lead.id].members.push(s)
    } else {
      leads.push(s)
      ranks[s.id] = { lead: true, members: [] }
    }
  }
  return ranks
}


// 지구본 핀 막대 높이 ∝ √MW (면적 감각에 가깝게): 30MW ≈ 5, 1,600MW ≈ 21
export function pinHeight(mw) {
  return 3 + Math.sqrt(mw) * 0.45
}
