// 실측 지형을 쓰는 캠퍼스 목록. 패널도 campusLandscape.js 를 부르므로 격자 파일은 여기(3D 묶음)에만 둠
import childress from './terrain/childress.json'
import sweetwater1 from './terrain/sweetwater-1.json'
import { realRelief, terrainHeight } from './campusLandscape.js'

const GRIDS = { childress, 'sweetwater-1': sweetwater1 }
// 등고선 간격(m). 땅이 평평할수록 촘촘해야 읽힘
const CONTOUR_M = { childress: 2.5, 'sweetwater-1': 5 }
const cache = new Map()

// 경관 설정에 실측 높이를 더해 돌려줌. 같은 객체를 다시 쓰므로 식생을 매번 다시 계산하지 않음
export function withRealTerrain(siteId, profile) {
  if (!profile || !GRIDS[siteId]) return profile
  if (!cache.has(siteId)) cache.set(siteId, {
    ...profile, relief: realRelief(GRIDS[siteId]), realTerrain: GRIDS[siteId],
    contourM: CONTOUR_M[siteId], floorY: reliefFloorY(GRIDS[siteId]),
  })
  return cache.get(siteId)
}

const FLOOR_Y = -.32   // 장면 바닥의 기본 높이

// 장면 바닥(불투명)이 내려가는 땅을 가리지 않도록 가장 낮은 땅보다 조금 아래 높이를 돌려줌
export function reliefFloorY({ dm, m_per_unit, pad_dm = 0 }, exaggeration = 2) {
  const lowest = (Math.min(...dm) - pad_dm) / 10 / m_per_unit * exaggeration
  return Math.min(FLOOR_Y, -.28 + lowest - .04)
}

// 그 자리에 세우는 시설의 밑동 높이: 부지 판 위는 0, 밖은 지형 높이
export function groundY(x, z, side, relief) {
  return Math.max(Math.abs(x), Math.abs(z)) <= side / 2 ? 0 : terrainHeight(x, z, side, relief)
}

// 땅이 가장자리에서 배경으로 사라지는 정도 (0 = 또렷, 1 = 완전히 사라짐)
export function landFade(x, z, side) {
  return Math.min(1, Math.max(0, (Math.hypot(x, z) / side - .87) / .38))
}

// 도로 높이: 트럭 출발점(부지 끝 + 7칸)까지는 부지와 같은 높이, 그 뒤 7칸에 걸쳐 지형 위로 내려앉음
export function roadY(x, z, side, relief) {
  const k = Math.min(1, Math.max(0, (Math.abs(x) - side / 2 - 7) / 7))
  const ease = k * k * (3 - 2 * k)
  return .03 + (terrainHeight(x, z, side, relief) + .05 - .03) * ease
}

// 실측 지형 위를 달리는 도로의 모양 값. rows = 1칸마다 양쪽 가장자리 높이·투명도, dashes = 중앙 점선
export function roadStrip(side, roadZ, depth, relief) {
  const end = Math.ceil(side * 1.22), rows = [], dashes = []
  const alphaAt = (x) => { const f = landFade(x, roadZ, side); return 1 - f * f * (3 - 2 * f) }
  for (let x = -end; x <= end; x++) {
    rows.push({ x, north: roadY(x, roadZ - depth / 2, side, relief), south: roadY(x, roadZ + depth / 2, side, relief), alpha: alphaAt(x) })
  }
  for (let x = -end; x + 1.1 <= end; x += 2.4) {
    dashes.push({ x0: x, x1: x + 1.1, y0: roadY(x, roadZ, side, relief) + .015, y1: roadY(x + 1.1, roadZ, side, relief) + .015, alpha: alphaAt(x + .55) })
  }
  return { rows, dashes }
}
