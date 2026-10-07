// =============================================================
// boards.js — 보드판 지도 설정과 좌표 변환 (three.js 를 쓰지 않는 순수 함수)
// -------------------------------------------------------------
// IREN 사이트가 있는 나라(캐나다·미국·스페인·호주)를 "국가 카드" 4장으로 나란히 놓습니다.
//   - 나라 전체 모양(실루엣)을 그 나라 육지 타일만으로 그려서 어느 나라인지 바로 알아보게
//   - 사이트가 있는 주(텍사스·오클라호마, BC, 남호주)는 타일을 솟게 해서 강조
//   - 카드 크기를 비슷하게 맞추느라 나라마다 배율(k)이 다름 → 축척 표시는 하지 않음
//
// 투영: 사인 곡선(sinusoidal) — 면적이 보존돼 육각 타일이 고르게 깔립니다.
//   x = ((경도 - 중심경도) × cos(위도) - cx) × k,   z = -(위도 - 중심위도) × k
//   cx: 실루엣이 한쪽으로 치우친 나라(캐나다 북극 섬들)를 카드 가운데로 옮기는 값(도 단위)
// 이 파일은 사전계산 스크립트(scripts/build-board-hex.mjs)도 함께 씁니다.
// =============================================================

// id: 판 이름표, country: 사이트·도시의 나라 코드(ISO2), topo: world-atlas 나라 번호
// center: 중심 위경도, k: 배율(위도 1° = k 단위), w·d: 카드 크기(단위), res: 육각 타일 h3 해상도
// keep: 이 나라 폴리곤 중 그릴 범위 (알래스카·하와이·카나리아·먼 섬 제외)
// focus: 강조할 주 — us-atlas 주 번호 / Natural Earth 주 이름, 없으면 사이트 반경(focusKm)
export const BOARDS = [
  {
    id: 'ca', country: 'CA', topo: '124', name_ko: '캐나다', name_en: 'Canada',
    focus_ko: 'BC', focus_en: 'British Columbia', focus: { ne: ['British Columbia'] },
    center: [62.4, -96.8], cx: 4.05, k: 0.68, w: 39, d: 32, res: 3,
    keep: { latMax: 84 },
  },
  {
    id: 'us', country: 'US', topo: '840', name_ko: '미국', name_en: 'United States',
    focus_ko: '텍사스·오클라호마', focus_en: 'Texas · Oklahoma', focus: { us: ['48', '40'] },
    center: [37.0, -95.8], cx: -0.6, k: 0.8, w: 38, d: 24, res: 3,
    keep: { lngMin: -130, latMin: 24, latMax: 50 },
  },
  {
    id: 'es', country: 'ES', topo: '724', name_ko: '스페인', name_en: 'Spain',
    focus_ko: '바다호스 일대', focus_en: 'Badajoz area', focus: { km: 150 },
    center: [39.9, -2.5], cx: 0.1, k: 3.4, w: 39, d: 30, res: 5,
    keep: { latMin: 35.5 },
  },
  {
    id: 'au', country: 'AU', topo: '036', name_ko: '호주', name_en: 'Australia',
    focus_ko: '남호주', focus_en: 'South Australia', focus: { ne: ['South Australia'] },
    center: [-26.8, 133.3], cx: -0.1, k: 0.85, w: 35, d: 33, res: 3,
    keep: { lngMin: 112, lngMax: 155, latMin: -44, latMax: -9 },
  },
]

// 폴리곤 한 점이 그 나라의 "그릴 범위" 안인지
export function keepPoint(board, lat, lng) {
  const k = board.keep ?? {}
  return (k.latMin == null || lat >= k.latMin) && (k.latMax == null || lat <= k.latMax)
    && (k.lngMin == null || lng >= k.lngMin) && (k.lngMax == null || lng <= k.lngMax)
}

// 카드 배치: 확보 전력이 큰 나라부터 읽는 순서(왼→오, 위→아래)로 — 미국 4.35GW, 호주 0.8GW, 스페인 0.3GW, 캐나다 0.16GW.
// 미국이 왼쪽 위라서 위쪽 계약 배지(마이크로소프트·엔비디아 → 칠드레스) 선이 다른 카드를 가로지르지 않음.
// 같은 열·행끼리 가운데를 맞춥니다.
const GRID = [
  ['us', 'au'],
  ['es', 'ca'],
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
  return [((lng - lng0) * Math.cos((lat * Math.PI) / 180) - (board.cx ?? 0)) * board.k, -(lat - lat0) * board.k]
}

// 점이 판 안(여백 margin 단위 제외)에 들어오는지
export function insideBoard(board, lat, lng, margin = 0) {
  const [x, z] = projectLocal(board, lat, lng)
  return Math.abs(x) <= board.w / 2 - margin && Math.abs(z) <= board.d / 2 - margin
}

// 위경도(+나라) → 어느 카드의 어디 (월드 좌표). 해당 카드가 없거나 카드 밖이면 null
// 카드 범위가 위경도로는 서로 겹치므로(예: BC 남부는 미국 카드 사각형 안) 반드시 나라로 고릅니다.
export function projectToBoard(lat, lng, country, kind = layoutKind()) {
  for (const b of BOARDS) {
    if (b.country !== country || !insideBoard(b, lat, lng)) continue
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
  const dLat = board.d / 2 / board.k
  const latMin = lat0 - dLat, latMax = lat0 + dLat
  const minCos = Math.min(Math.cos((latMin * Math.PI) / 180), Math.cos((latMax * Math.PI) / 180))
  const dLng = (board.w / 2 / board.k + Math.abs(board.cx ?? 0)) / Math.max(0.2, minCos)
  return { latMin, latMax, lngMin: lng0 - dLng, lngMax: lng0 + dLng }
}
