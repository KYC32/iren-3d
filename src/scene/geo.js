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

export { fmtMw } from '../data/format.js'

// 가까이 모인 사이트(예: 텍사스 4곳)를 무리로 묶습니다.
// 멀리서 볼 때는 무리의 대표(가장 큰 사이트) 라벨만 "+N" 과 함께 보여 겹침을 막고,
// 가까이 줌하거나 호버하면 모든 라벨을 펼칩니다.
const LEAD_ORDER = ['operating', 'commissioning', 'under_construction', 'planned', 'decommissioning']

export function labelRanks(sites, nearDeg = 5.5) {
  // 거리 = 위경도 차이(경도는 위도에 따라 줄여서)
  const deg = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180))
  return labelRanksBy(sites, nearDeg, deg)
}

// labelRanks 의 일반형: 거리 함수 dist(대표, 사이트) 를 직접 받음
// (보드판처럼 카드마다 배율이 달라 "몇 도"보다 "화면에서 몇 단위"로 묶어야 할 때)
export function labelRanksBy(sites, near, dist) {
  const leads = []
  const ranks = {}
  // 대표 선정: 상태가 앞선 사이트(가동 > 시운전 > 건설 > 계획 > 폐쇄중) 먼저, 같으면 계통 전력이 큰 순서
  // → 예) 텍사스 무리는 1.4GW 건설중인 스위트워터 1보다 가동중인 칠드레스가 대표
  const rank = (s) => LEAD_ORDER.indexOf(s.status) === -1 ? 9 : LEAD_ORDER.indexOf(s.status)
  for (const s of [...sites].sort((a, b) => rank(a) - rank(b) || b.grid_mw - a.grid_mw)) {
    const lead = leads.find((l) => dist(l, s) < near)
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
