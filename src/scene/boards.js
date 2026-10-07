// =============================================================
// boards.js — 보드판 지도 설정과 좌표 변환 (three.js 를 쓰지 않는 순수 함수)
// -------------------------------------------------------------
// IREN 사이트는 북미 서부에 몰려 있고 호주·스페인에 하나씩 떨어져 있어서,
// 지구본 대신 "북미 서부 본판 + 모서리 삽입판(스페인·남호주)" 보드판으로 보여줍니다.
// (미국 지도에서 알래스카·하와이를 모서리 상자에 넣는 것과 같은 방식)
//
// 투영: 사인 곡선(sinusoidal) — 면적이 보존돼 육각 타일이 어디서나 같은 크기로 깔립니다.
//   x = (경도 - 중심경도) × cos(위도) × K,   z = -(위도 - 중심위도) × K
// 세 판 모두 같은 축척 K(위도 1도 = K 단위)라서 크기 비교가 정직합니다.
// 이 파일은 사전계산 스크립트(scripts/build-board-hex.mjs)도 함께 씁니다.
// =============================================================

export const K = 3 // 위도 1도 = 3 단위 (≈ 111km)

// center: 판 중심 위경도, w·d: 판 크기(단위). 판 안에 들어오는 지역만 그립니다.
export const BOARDS = [
  { id: 'na', name_ko: '북미 서부', name_en: 'Western North America', center: [42, -110.5], w: 92, d: 98 },
  { id: 'es', name_ko: '스페인', name_en: 'Spain', center: [40, -3.6], w: 34, d: 26, inset: true },
  { id: 'au', name_ko: '남호주', name_en: 'South Australia', center: [-34, 138.2], w: 30, d: 28, inset: true },
]

// 판 배치(판 중심의 월드 좌표). 가로 화면은 삽입판을 오른쪽 세로로, 세로 화면은 본판 아래 가로로.
const LAYOUT = {
  landscape: { na: [0, 0], es: [72, -21], au: [72, 21] },
  portrait: { na: [0, 0], es: [-20, 70], au: [20, 70] },
}
export function layoutKind() {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerWidth / Math.max(1, window.innerHeight) < 0.9 ? 'portrait' : 'landscape'
}
export function boardPos(id, kind = layoutKind()) {
  return LAYOUT[kind][id]
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
