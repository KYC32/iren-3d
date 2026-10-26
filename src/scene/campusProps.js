// =============================================================
// campusProps.js — 캠퍼스 3D 소품(주차한 차 · 공사 장비)을 놓을 자리 (순수 함수, 단위 테스트 대상)
// -------------------------------------------------------------
// 소품은 "그림 표현"입니다: 차 수·장비 수는 회사 자료가 아니라 건물 상태에서 정한 연출
//   주차장 = 지금 쓰거나 짓는 건물이 있는 캠퍼스에만 (사람이 일하는 곳) · 차 수는 그런 건물 수에 따라 늘어남
//   공사 장비 = 건설중 건물마다 굴착 트랙터 1 · 라바콘 2 · 자재 컨테이너 1 (크레인은 layoutCampus 가 이미 둠)
// 모형: scripts/blender/campus-props.py → public/models/campus-props.glb.gz (Kenney CC0) · 그리기: buildings/CampusProps.jsx
//
// 좌표계는 layoutCampus 와 같음: 캠퍼스 중심 (0,0), x = 오른쪽, z = 화면 앞쪽. 단위 1 = 블록 폭의 1/4
// rot = y 축 회전(라디안). 모형의 앞은 +z → rot 0 이면 앞쪽(카메라 쪽), π/2 이면 오른쪽을 봄
// =============================================================

// 소품 바닥 크기 (w = 폭 x, l = 길이 z) — 모형(GLB)에서 잰 값보다 조금 넉넉히
export const PROP_SIZE = {
  sedan: { w: 0.9, l: 1.52 }, suv: { w: 0.9, l: 1.6 }, van: { w: 0.9, l: 1.64 },
  pickup: { w: 0.9, l: 1.76 }, hatchback: { w: 0.9, l: 1.7 },
  loader: { w: 1.0, l: 1.46 }, cone: { w: 0.28, l: 0.28 }, container: { w: 0.8, l: 1.76 },
}
const CAR_KINDS = ['sedan', 'suv', 'pickup', 'van', 'hatchback']
// 사람이 있는 건물 상태 (가동·인수·시운전·건설·폐쇄 작업)
const ACTIVE = new Set(['operating', 'delivered', 'commissioning', 'under_construction', 'decommissioning'])

// ---- 주차장 크기 ----
const STALL_W = 1.05        // 칸 폭 (차 폭 0.9 + 여유)
const ROW_D = 1.8           // 줄 깊이 (가장 긴 픽업 1.76)
const AISLE = 1.2           // 두 줄 사이 통로
const LOT_D = 0.1 + ROW_D + AISLE + ROW_D + 0.1
const PER_ROW = 4
const GAP = 0.8             // 변전소·하역장과 띄우는 거리
// 칸을 채우는 순서 (줄 × 4 + 칸) — 한쪽부터 차례로 채우면 어색해서 흩어 놓음
const FILL = [1, 6, 3, 4, 0, 7, 2, 5]

const round2 = (v) => Math.round(v * 100) / 100

/**
 * @param {object} L  SiteView 의 화면 배치 = layoutCampus(...) + campusStateAt(...)
 * @param {{ keep?: (buildingId: string) => boolean }} opts  keep: 고객 구역을 골랐을 때 그 구역 건물만 (크레인과 같은 규칙)
 * @returns {{ parking: null | { x, z, w, d, stalls, slots, cars }, construction: Array<{ kind, x, z, rot, buildingId }> }}
 */
export function campusProps(L, { keep = () => true } = {}) {
  const anchors = L.blocks.filter((b) => b.isAnchor && !b.asLot)
  return { parking: parkingOf(L, anchors), construction: constructionOf(anchors, keep) }
}

// 주차장: 왼쪽 칸(변전소 아래, 하역장 위)에 두 줄 × 4칸. 그 칸이 좁으면(작은 부지) 만들지 않음
function parkingOf(L, anchors) {
  const active = anchors.filter((b) => ACTIVE.has(b.status)).length
  if (active === 0) return null
  const w = L.substation.w
  const z = L.receiving.z - L.receiving.d / 2 - GAP - LOT_D / 2
  if (z - LOT_D / 2 < L.substation.z + L.substation.d / 2 + GAP) return null
  const x = L.substation.x
  const slots = []
  for (let row = 0; row < 2; row++) {
    const sz = z + (row === 0 ? -1 : 1) * (AISLE / 2 + ROW_D / 2)
    for (let i = 0; i < PER_ROW; i++) {
      // 위 줄은 앞(+z, 통로 쪽)을 보고, 아래 줄은 뒤(−z, 통로 쪽)를 봄
      slots.push({ x: round2(x + (i - (PER_ROW - 1) / 2) * STALL_W), z: round2(sz), rot: row === 0 ? 0 : Math.PI })
    }
  }
  const count = Math.min(slots.length, 2 + active * 2)
  const cars = FILL.slice(0, count).map((s) => ({ kind: CAR_KINDS[(s * 3 + 1) % CAR_KINDS.length], ...slots[s] }))
  return { x, z: round2(z), w, d: LOT_D, stalls: slots.length, slots, cars }
}

// 공사 장비: 건물 앞 틈(블록 사이 1.4칸)과 오른쪽 틈에. 앞 틈 가운데(±0.6)는 납품 트럭 길이라 비워 둠
//   크레인은 오른쪽 뒤 모서리(layoutCampus) → 컨테이너는 오른쪽 틈의 앞쪽 절반
function constructionOf(anchors, keep) {
  const out = []
  for (const b of anchors) {
    if (b.status !== 'under_construction' || !keep(b.buildingId)) continue
    const front = b.z + b.d / 2
    const id = b.buildingId
    out.push(
      { kind: 'loader', x: round2(b.x - 1.35), z: round2(front + 0.7), rot: Math.PI / 2, buildingId: id },
      { kind: 'cone', x: round2(b.x + 1.0), z: round2(front + 0.45), rot: 0, buildingId: id },
      { kind: 'cone', x: round2(b.x + 1.55), z: round2(front + 0.45), rot: 0, buildingId: id },
      { kind: 'container', x: round2(b.x + b.w / 2 + 0.7), z: round2(b.z + 1.2), rot: 0, buildingId: id },
    )
  }
  return out
}
