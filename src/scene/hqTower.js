// =============================================================
// hqTower.js — 본사 3D 화면의 사무 빌딩 모양 (순수 계산 — HqView 가 그리고, CameraRig 가 카메라를 맞춤)
// -------------------------------------------------------------
// 시드니 55 Market Street: 20층 사무 빌딩 (건물 소유사 Mirvac), IREN 은 Level 5 (FY26 10-K 표지 주소)
//   윤곽은 OpenStreetMap (public/data/hq-city.json → hqCity.js 가 화면 좌표로): 탑 = 'City Centre' 조각(모서리를 깎은 윤곽),
//   아래 3층 = 땅 윤곽 전체(포디움 — FK 2021 리모델링의 '길에서 보이는 3층 높이 유리 로비'). 층수는 Mirvac 자료(20층)
//   OSM 자료를 받기 전이나 못 받으면 정사각형 기본 모양 (TOWER_W × TOWER_D ≈ 33m)
// 좌표: 탑 가운데 바닥이 (0,0,0), x = 북쪽, z = 동쪽, y = 위. 1 = 약 5.5m (캠퍼스 화면과 비슷한 크기감)
//   처음 카메라는 남동쪽 위 (HQ_VIEW — 2026-10-27 사용자 선택 A안) → 본사 동쪽(Pitt St) 벽 · 오른쪽에 시드니 타워
// 층 번호는 호주식: 지상층 G = 0, 그 위가 Level 1, 2, …
// =============================================================
import { signedArea } from './geom2d.js'

export const TOWER_W = 6        // 기본 모양 가로 (x) ≈ 33m
export const TOWER_D = 6        // 기본 모양 세로 (z)
export const FLOOR_H = 0.68     // 사무 층 높이 ≈ 3.7m
const LOBBY_H = FLOOR_H * 1.6   // 지상층(로비)은 더 높게
const ROOF_H = 0.8              // 옥상 기계실
export const PODIUM_FLOORS = 3  // 포디움 = 아래 3층 (G·1·2층) — 땅 윤곽 전체를 덮는 유리 로비
export const PLOT = 40          // 바닥 판 한 변 (≈ 220m — 북동쪽 약 120m 의 시드니 타워까지 담음 · HqCity.jsx)
const SQUARE = [[-TOWER_W / 2, -TOWER_D / 2], [TOWER_W / 2, -TOWER_D / 2], [TOWER_W / 2, TOWER_D / 2], [-TOWER_W / 2, TOWER_D / 2]]

// 본사 화면 기본 카메라 방향: 방위각(북 = 0°, 동 = 90°)과 높이각 — 실제 동네에서 본사 5층이 가리지 않고 보이는 쪽
//   (hqCity.occludersOf 로 방위마다 세어 본 결과: 동~남동쪽은 45° 높이에서 가리는 벽 점이 0)
export const HQ_VIEW = { azimuth: 135, elevation: 45 }
// 바라보는 점에서 카메라 쪽 방향 [x 북, y 위, z 동] (campusFrameBox 의 direction)
export function hqDirection(view = HQ_VIEW) {
  const a = (view.azimuth * Math.PI) / 180, e = (view.elevation * Math.PI) / 180
  return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]
}

// 다각형 변마다 바깥쪽 방향(n)과 양 끝 점 — x 를 오른쪽, z 를 위로 보면 반시계 윤곽의 바깥쪽은 (dz, −dx)
export function ringFaces(ring) {
  const ccw = signedArea(ring) > 0
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length]
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    return { n: ccw ? [dz / l, -dx / l] : [-dz / l, dx / l], c: [a, b], len: l }
  })
}

// 카메라(cx, cz — 건물 가운데 기준 위치)에서 본 건물의 화면 왼쪽·오른쪽 끝 모서리 [x, z]
//   화면 오른쪽 방향 = 바라보는 방향 × 위 = (-fz, fx) → 모서리를 그 방향에 내린 값이 가장 작은 게 왼쪽, 큰 게 오른쪽
//   보이는 벽(카메라 쪽을 MIN_FACING 넘게 바라보는 벽)의 모서리만 셈 — 거의 정면일 때 실처럼 얇게 보이는
//   옆벽의 뒤 모서리를 고르면, 그 모서리는 멀어서 화면에서 더 위에 찍혀 5층 표시가 초록 띠보다 위에 뜸
//   본사 화면의 'IREN · 5층' 표시(왼쪽)를 카메라를 돌려도 건물 가장자리에 붙이려고 씀
//   ring = 탑 윤곽 (주지 않으면 기본 정사각형) — 모서리를 깎은 윤곽이면 깎은 짧은 벽도 벽 하나로 셈
const MIN_FACING = 0.26 // 약 15° — 이보다 비스듬한 벽은 '안 보이는 벽'으로 침
export function sideCorners(cx, cz, ring = SQUARE) {
  const len = Math.hypot(cx, cz) || 1
  const fx = -cx / len, fz = -cz / len           // 카메라가 바라보는 방향 (건물 쪽)
  const rx = -fz, rz = fx                         // 화면 오른쪽 방향
  const faces = ringFaces(ring)
  // 벽이 카메라를 바라보는 정도 = n · (카메라 쪽 방향 = −f). 바로 위에서 볼 땐 모두 0 → 모든 벽으로
  const shown = faces.filter((f) => -(f.n[0] * fx + f.n[1] * fz) > MIN_FACING)
  const corners = (shown.length ? shown : faces).flatMap((f) => f.c)
  const along = (c) => c[0] * rx + c[1] * rz
  const sorted = [...corners].sort((a, b) => along(a) - along(b))
  return { left: sorted[0], right: sorted.at(-1) }
}

// 카메라가 빌딩을 맞출 때 비워 둘 화면 자리(px): 위 = 옥상 위 CEO 카드, 오른쪽 = 그 옆 말풍선, 왼쪽 = 5층 'IREN' 표시
//   값은 hq.css 의 폭과 맞춤 — 1024px 이상 말풍선 320, 768~1023px 260, 767px 이하는 말풍선을 화면 아래에 붙여 위 자리만
//   휴대폰 위 자리 20: 가로 한 줄 CEO 카드(옥상 위 약 83px)는 카메라 상자의 옥상 위 여유(hqTower box 의 +2.5칸)에 거의 다 들어감
//     (2026-10-27: 세로 카드일 땐 190 → 빌딩 자리가 좁았음. 375×667 작은 휴대폰에서도 카드가 상단 바 밑에 오는 값)
export function hqLabelRoom(width) {
  if (width < 768) return { top: 20, right: 0, left: 0 }
  if (width < 1024) return { top: 220, right: 260 + 40, left: 180 }
  return { top: 230, right: 320 + 40, left: 200 }
}

// floors: 건물 층수, level: 회사가 쓰는 층 → 층판 목록 · IREN 층 · 전체 높이 · 윤곽(탑·포디움) · 카메라 상자
//   shape = { tower, podium } 화면 좌표 윤곽 (hqCityLayout 의 hq) — 없으면 정사각형 기본 모양 (탑 = 포디움)
export function hqTower({ floors, level }, shape = null) {
  const ring = shape?.tower ?? SQUARE
  const podiumRing = shape?.podium ?? ring
  const list = []
  let y = 0
  for (let i = 0; i < floors; i++) {
    const h = i === 0 ? LOBBY_H : FLOOR_H
    list.push({ level: i, y, h, iren: i === level })
    y += h
  }
  const height = y + ROOF_H
  const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1])
  return {
    floors: list,
    iren: list.find((f) => f.iren) ?? null,
    height,
    roof: { y, h: ROOF_H },
    ring,
    podium: { ring: podiumRing, h: list[PODIUM_FLOORS]?.y ?? y }, // 포디움 꼭대기 = 4번째 층판 바닥
    // 카메라가 맞출 상자: 탑 + 양옆에 배지·말풍선이 들어갈 자리 + 위에 옥상 간판 자리 (CameraRig → campusFrameBox)
    box: { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, z0: Math.min(...zs) - 2, z1: Math.max(...zs) + 2, y0: 0, y1: height + 2.5 },
    side: PLOT,
  }
}
