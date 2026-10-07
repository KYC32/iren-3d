// =============================================================
// boards.js — 보드판 지도 설정과 좌표 변환 (three.js 를 쓰지 않는 순수 함수)
// -------------------------------------------------------------
// IREN 사이트는 BC(캐나다)·텍사스 일대·스페인·남호주 네 곳에 몰려 있어서,
// 지구본 대신 사이트가 있는 지역만 잘라 낸 "섬 보드" 4개를 나란히 놓아 보여줍니다.
// (예전엔 북미 서부를 한 판에 담았는데, BC 와 텍사스 사이 2,500km 가 대부분 빈 땅이었음)
//
// 투영: 사인 곡선(sinusoidal) — 면적이 보존돼 육각 타일이 어디서나 같은 크기로 깔립니다.
//   x = (경도 - 중심경도) × cos(위도) × K,   z = -(위도 - 중심위도) × K
// 네 판 모두 같은 축척 K(위도 1도 = K 단위)라서 판끼리 크기 비교가 정직합니다.
// 이 파일은 사전계산 스크립트(scripts/build-board-hex.mjs)도 함께 씁니다.
// =============================================================

export const K = 5 // 위도 1도 = 5 단위 (≈ 111km) — 모든 판 공통 축척

// center: 판 중심 위경도, w·d: 판 크기(단위). 판 안에 들어오는 지역만 그립니다.
// 범위는 "사이트 + 알아볼 만한 큰 도시"가 들어오도록 잡았습니다 (주석의 도시들).
export const BOARDS = [
  // 밴쿠버·캘거리·에드먼턴까지
  { id: 'bc', name_ko: '캐나다 BC', name_en: 'British Columbia', center: [52.6, -119.4], w: 38, d: 36 },
  // 애머릴로·애빌린·댈러스·오클라호마시티까지
  { id: 'tx', name_ko: '텍사스·오클라호마', name_en: 'Texas · Oklahoma', center: [33.7, -98.0], w: 38, d: 30 },
  // 리스본·세비야·마드리드까지
  { id: 'es', name_ko: '스페인', name_en: 'Spain', center: [39.6, -6.0], w: 32, d: 25 },
  // 애들레이드·포트오거스타까지
  { id: 'au', name_ko: '남호주', name_en: 'South Australia', center: [-34.4, 138.9], w: 28, d: 24 },
]

// 판 배치: 윗줄 북미(서→동), 아랫줄 해외. 같은 열·행끼리 가운데를 맞춥니다.
const GRID = [
  ['bc', 'tx'],
  ['es', 'au'],
]
const GAP = 7 // 판 사이 간격 (단위)

// GRID → 판 중심 좌표 { id: [x, z] }. 열 폭 = 그 열에서 가장 넓은 판, 행 높이 = 가장 깊은 판
function gridLayout(grid, gap) {
  const byId = Object.fromEntries(BOARDS.map((b) => [b.id, b]))
  const colW = grid[0].map((_, c) => Math.max(...grid.map((row) => byId[row[c]]?.w ?? 0)))
  const rowD = grid.map((row) => Math.max(...row.map((id) => byId[id]?.d ?? 0)))
  const totalW = colW.reduce((a, b) => a + b, 0) + gap * (colW.length - 1)
  const totalD = rowD.reduce((a, b) => a + b, 0) + gap * (rowD.length - 1)
  const out = {}
  let z = -totalD / 2
  grid.forEach((row, r) => {
    let x = -totalW / 2
    row.forEach((id, c) => {
      out[id] = [x + colW[c] / 2, z + rowD[r] / 2]
      x += colW[c] + gap
    })
    z += rowD[r] + gap
  })
  return out
}
const LAYOUT = gridLayout(GRID, GAP)

// 화면 방향. 지금은 가로·세로 모두 같은 2×2 배치지만, 카메라 맞춤(CameraRig)이 여백 계산에 씁니다.
export function layoutKind() {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerWidth / Math.max(1, window.innerHeight) < 0.9 ? 'portrait' : 'landscape'
}
// eslint-disable-next-line no-unused-vars
export function boardPos(id, kind = layoutKind()) {
  return LAYOUT[id]
}

// 판 안에서의 좌표 (판 중심 기준)
export function projectLocal(board, lat, lng) {
  const [lat0, lng0] = board.center
  return [(lng - lng0) * Math.cos((lat * Math.PI) / 180) * K, -(lat - lat0) * K]
}

// 점이 판 안(여백 margin 단위 제외)에 들어오는지
export function insideBoard(board, lat, lng, margin = 0) {
  const [x, z] = projectLocal(board, lat, lng)
  return Math.abs(x) <= board.w / 2 - margin && Math.abs(z) <= board.d / 2 - margin
}

// 위경도 → 어느 판의 어디 (월드 좌표). 어느 판에도 없으면 null
export function projectToBoard(lat, lng, kind = layoutKind()) {
  for (const b of BOARDS) {
    if (!insideBoard(b, lat, lng)) continue
    const [x, z] = projectLocal(b, lat, lng)
    const [px, pz] = boardPos(b.id, kind)
    return { board: b, x: px + x, z: pz + z }
  }
  return null
}

// 판 전체가 차지하는 범위 (카메라 맞춤용)
export function layoutBounds(kind = layoutKind()) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const b of BOARDS) {
    const [px, pz] = boardPos(b.id, kind)
    x0 = Math.min(x0, px - b.w / 2); x1 = Math.max(x1, px + b.w / 2)
    z0 = Math.min(z0, pz - b.d / 2); z1 = Math.max(z1, pz + b.d / 2)
  }
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }
}

// 판의 대략적인 위경도 범위 (사전계산 때 후보 셀을 거르는 용도)
export function latLngBox(board) {
  const [lat0, lng0] = board.center
  const dLat = board.d / 2 / K
  const latMin = lat0 - dLat, latMax = lat0 + dLat
  const minCos = Math.min(Math.cos((latMin * Math.PI) / 180), Math.cos((latMax * Math.PI) / 180))
  const dLng = board.w / 2 / K / Math.max(0.2, minCos)
  return { latMin, latMax, lngMin: lng0 - dLng, lngMax: lng0 + dLng }
}
