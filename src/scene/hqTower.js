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
export const PLOT = 20          // 바닥 판 한 변 (건물 + 둘레 도로·이웃 건물)

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
    // 카메라가 맞출 상자: 건물 + 둘레 조금 (CameraRig → campusFrameBox)
    box: { x0: -TOWER_W / 2 - 2, x1: TOWER_W / 2 + 2, z0: -TOWER_D / 2 - 2, z1: TOWER_D / 2 + 2, y0: 0, y1: height + 0.5 },
    side: PLOT,
  }
}
