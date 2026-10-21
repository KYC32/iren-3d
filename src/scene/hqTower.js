// =============================================================
// hqTower.js — 본사 3D 화면의 사무 빌딩 모양 (순수 계산 — HqView 가 그리고, CameraRig 가 카메라를 맞춤)
// -------------------------------------------------------------
// 시드니 55 Market Street: 20층 사무 빌딩 (건물 소유사 Mirvac), IREN 은 Level 5 (FY26 10-K 표지 주소)
//   실제 윤곽·외관 자료가 없어 단순화한 모형 — 층당 임대 면적(20,382㎡ ÷ 약 19층 ≈ 1,070㎡)으로 정사각형 약 33m
// 좌표: 건물 가운데 바닥이 (0,0,0), x = 오른쪽, z = 화면 앞쪽, y = 위. 1 = 약 5.5m (캠퍼스 화면과 비슷한 크기감)
// 층 번호는 호주식: 지상층 G = 0, 그 위가 Level 1, 2, …
// =============================================================
export const TOWER_W = 6        // 건물 가로 (x) ≈ 33m
export const TOWER_D = 6        // 건물 세로 (z)
export const FLOOR_H = 0.68     // 사무 층 높이 ≈ 3.7m
const LOBBY_H = FLOOR_H * 1.6   // 지상층(로비)은 더 높게
const ROOF_H = 0.8              // 옥상 기계실
export const PLOT = 34          // 바닥 판 한 변 (건물 + 둘레 도로·인도·이웃 건물 — HqCity.jsx)

// 카메라(cx, cz — 건물 가운데 기준 위치)에서 본 건물의 화면 왼쪽·오른쪽 끝 모서리 [x, z]
//   화면 오른쪽 방향 = 바라보는 방향 × 위 = (-fz, fx) → 모서리를 그 방향에 내린 값이 가장 작은 게 왼쪽, 큰 게 오른쪽
//   보이는 벽(카메라 쪽을 MIN_FACING 넘게 바라보는 벽)의 모서리만 셈 — 거의 정면일 때 실처럼 얇게 보이는
//   옆벽의 뒤 모서리를 고르면, 그 모서리는 멀어서 화면에서 더 위에 찍혀 5층 표시가 초록 띠보다 위에 뜸
//   본사 화면의 'IREN · 5층' 표시(왼쪽)를 카메라를 돌려도 건물 가장자리에 붙이려고 씀
const MIN_FACING = 0.26 // 약 15° — 이보다 비스듬한 벽은 '안 보이는 벽'으로 침
export function sideCorners(cx, cz) {
  const len = Math.hypot(cx, cz) || 1
  const fx = -cx / len, fz = -cz / len           // 카메라가 바라보는 방향 (건물 쪽)
  const rx = -fz, rz = fx                         // 화면 오른쪽 방향
  const hw = TOWER_W / 2, hd = TOWER_D / 2
  // 네 벽: 바깥쪽 방향 n 과 양 끝 모서리
  const faces = [
    { n: [1, 0], c: [[hw, -hd], [hw, hd]] }, { n: [-1, 0], c: [[-hw, -hd], [-hw, hd]] },
    { n: [0, 1], c: [[-hw, hd], [hw, hd]] }, { n: [0, -1], c: [[-hw, -hd], [hw, -hd]] },
  ]
  // 벽이 카메라를 바라보는 정도 = n · (카메라 쪽 방향 = −f). 바로 위에서 볼 땐 모두 0 → 네 벽 모두로
  const shown = faces.filter((f) => -(f.n[0] * fx + f.n[1] * fz) > MIN_FACING)
  const corners = (shown.length ? shown : faces).flatMap((f) => f.c)
  const along = (c) => c[0] * rx + c[1] * rz
  const sorted = [...corners].sort((a, b) => along(a) - along(b))
  return { left: sorted[0], right: sorted.at(-1) }
}

// 카메라가 빌딩을 맞출 때 비워 둘 화면 자리(px): 위 = 옥상 위 CEO 카드, 오른쪽 = 그 옆 말풍선, 왼쪽 = 5층 'IREN' 표시
//   값은 hq.css 의 폭과 맞춤 — 1024px 이상 말풍선 320, 768~1023px 260, 767px 이하는 말풍선을 화면 아래에 붙여 위 자리만
export function hqLabelRoom(width) {
  if (width < 768) return { top: 190, right: 0, left: 0 }
  if (width < 1024) return { top: 220, right: 260 + 40, left: 180 }
  return { top: 230, right: 320 + 40, left: 200 }
}

// floors: 건물 층수, level: 회사가 쓰는 층 → 층판 목록 · IREN 층 · 전체 높이 · 카메라 상자
export function hqTower({ floors, level }) {
  const list = []
  let y = 0
  for (let i = 0; i < floors; i++) {
    const h = i === 0 ? LOBBY_H : FLOOR_H
    list.push({ level: i, y, h, iren: i === level })
    y += h
  }
  const height = y + ROOF_H
  return {
    floors: list,
    iren: list.find((f) => f.iren) ?? null,
    height,
    roof: { y, h: ROOF_H },
    // 카메라가 맞출 상자: 건물 + 양옆에 배지·말풍선이 들어갈 자리 + 위에 옥상 간판 자리 (CameraRig → campusFrameBox)
    box: { x0: -TOWER_W / 2 - 2, x1: TOWER_W / 2 + 2, z0: -TOWER_D / 2 - 2, z1: TOWER_D / 2 + 2, y0: 0, y1: height + 2.5 },
    side: PLOT,
  }
}
