// =============================================================
// layoutCampus.js — 사이트 데이터(sites.json) → 캠퍼스 3D 배치 계산
// -------------------------------------------------------------
// 3D 컴포넌트는 "어디에 무엇을 그릴지" 고민하지 않고 이 함수의 결과만 그립니다.
// 순수 함수(입력이 같으면 결과도 같음)라서 단위 테스트로 검증할 수 있습니다.
//
// 좌표계: 캠퍼스 중심이 (0,0). x = 오른쪽, z = 화면 앞쪽(카메라 쪽), 단위는 대략 "블록 1칸 = 4~6".
// =============================================================

// ---- 배치 상수 (값을 바꾸면 캠퍼스 모양이 바뀝니다) ----
export const BLOCK_MW = 75        // 데이터홀 1블록 = 75MW gross (= Horizon 1동, 50MW IT)
export const BLOCK_W = 4          // 블록 가로 (x)
export const BLOCK_D = 6          // 블록 세로 (z)
export const GAP = 1.4            // 블록 사이 간격
const MARGIN = 2                  // 부지 가장자리 여백
const SUBSTATION_COL = 7          // 왼쪽에 변전소가 차지하는 폭
const ROAD_DEPTH = 3              // 앞쪽 도로 폭

// 건물 종류별 높이
const HEIGHT = { datahall_liquid: 2.4, datahall_air: 1.9, miner_hall: 1.1, lot: 0.05 }

// 상태별 정렬 순서: 가동 → 시운전 → 건설 → 폐쇄중 → 계획 → 빈 부지
const ORDER = { operating: 0, commissioning: 1, under_construction: 2, decommissioning: 3, planned: 4 }

// -------------------------------------------------------------
// 아직 용도가 발표되지 않은 전력을 "빈 부지(점선)"로 몇 칸 그릴지 결정합니다.
//
// TODO(학습 포인트 2): 이 규칙을 직접 정해 보세요. (5~10줄)
//   remainingMw : 계통 전력 중 발표된 건물로 설명되지 않는 MW (예: Kiowa 1,600MW)
//   반환값      : 빈 부지 블록 수
//   고려할 점   :
//     - 비례로 그리면(1,600 / 75 ≈ 21칸) "규모감"이 정직하게 전달되지만 화면이 빈 부지로 가득 찹니다.
//     - 상한을 두면(예: 최대 12칸) 깔끔하지만 1.6GW 와 0.9GW 가 똑같이 보입니다.
//     - 로그 스케일(예: 3 + log2(MW/75) * 2)은 규모 차이를 남기면서 화면도 지킵니다.
//   지금은 "비례 + 상한 16칸" 으로 두었습니다.
// -------------------------------------------------------------
export function ghostLotCount(remainingMw) {
  if (remainingMw < BLOCK_MW * 0.5) return 0
  return Math.min(16, Math.round(remainingMw / BLOCK_MW))
}

// 건물 하나가 몇 블록을 차지하는지 (최소 1칸)
export function blocksFor(building) {
  return Math.max(1, Math.round(building.gross_mw / BLOCK_MW))
}

// 부지 크기(한 변 길이): 에이커가 클수록 넓게, 단 너무 작거나 크지 않게
function plateSideFromAcres(acres) {
  const a = acres ?? 100
  return Math.min(44, Math.max(18, 12 + Math.sqrt(a) * 0.8))
}

/**
 * @param {object} site  sites.json 의 사이트 1개
 * @returns {{
 *   side:number, blocks:Array, substation:object, road:object, gate:object,
 *   powerLine:object, trucks:Array, cranes:Array, ghostCount:number
 * }}
 */
export function layoutCampus(site) {
  // 1) 그릴 블록 목록 만들기 ------------------------------------
  //    건물마다 blocksFor(건물) 칸을 만들고, 첫 칸을 "라벨 기준점(anchor)"으로 표시
  const sorted = [...site.buildings].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
  const items = []
  for (const b of sorted) {
    const n = blocksFor(b)
    for (let i = 0; i < n; i++) {
      items.push({
        key: `${b.id}#${i}`,
        buildingId: b.id,
        kind: b.kind,
        status: b.status,
        progress: b.progress ?? (b.status === 'operating' || b.status === 'commissioning' ? 1 : 0),
        isAnchor: i === 0,
        index: i,
        count: n,
      })
    }
  }

  // 2) 발표되지 않은 남은 전력 → 빈 부지 --------------------------
  //    replaces(전환) 건물은 기존 전력을 재사용하므로 합계에서 제외
  const announcedMw = site.buildings.filter((b) => !b.replaces).reduce((n, b) => n + b.gross_mw, 0)
  const remainingMw = Math.max(0, site.grid_mw - announcedMw)
  const ghostCount = ghostLotCount(remainingMw)
  for (let i = 0; i < ghostCount; i++) {
    items.push({
      key: `lot#${i}`, buildingId: null, kind: 'lot', status: 'planned',
      progress: 0, isAnchor: i === 0, index: i, count: ghostCount,
    })
  }

  // 3) 부지 크기 결정: 에이커 기준 크기와 "블록이 다 들어가는 크기" 중 큰 쪽 ---------
  const cellW = BLOCK_W + GAP
  const cellD = BLOCK_D + GAP
  let side = plateSideFromAcres(site.acres)
  // 블록이 들어갈 자리가 부족하면 부지를 키웁니다
  for (let guard = 0; guard < 40; guard++) {
    const cols = Math.max(1, Math.floor((side - SUBSTATION_COL - MARGIN * 2) / cellW))
    const rows = Math.max(1, Math.floor((side - ROAD_DEPTH - MARGIN * 2) / cellD))
    if (cols * rows >= items.length) break
    side += 2
  }
  const half = side / 2
  const cols = Math.max(1, Math.floor((side - SUBSTATION_COL - MARGIN * 2) / cellW))

  // 4) 블록 좌표 배정: 왼쪽 위(변전소 옆)부터 오른쪽으로 채우고 줄을 바꿉니다 ------
  const x0 = -half + MARGIN + SUBSTATION_COL + BLOCK_W / 2
  const z0 = -half + MARGIN + BLOCK_D / 2
  const blocks = items.map((it, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return {
      ...it,
      x: round2(x0 + c * cellW),
      z: round2(z0 + r * cellD),
      w: BLOCK_W,
      d: BLOCK_D,
      h: HEIGHT[it.kind] ?? 2,
    }
  })

  // 5) 변전소·도로·게이트·송전선 ----------------------------------
  const substation = {
    x: round2(-half + MARGIN + 2.6),
    z: round2(-half + MARGIN + 3),
    w: 4.4,
    d: 5,
    status: site.substation.status,
    mw: site.substation.mw,
    dates: site.substation.dates,
  }
  const roadZ = round2(half - MARGIN - ROAD_DEPTH / 2 + 0.6)
  const road = { z: roadZ, x0: -half, x1: half, depth: ROAD_DEPTH }
  const gate = { x: round2(half), z: roadZ }
  // 송전선: 부지 바깥 왼쪽 → 변전소
  const powerLine = {
    from: [round2(-half - 10), substation.z],
    to: [substation.x, substation.z],
    energized: site.substation.status === 'energized',
    dates: site.substation.dates,
  }

  // 6) 크레인: 건설중 건물마다 하나 (첫 블록 옆) ------------------------
  const cranes = blocks
    .filter((b) => b.status === 'under_construction' && b.isAnchor)
    .map((b) => ({ key: `crane-${b.buildingId}`, buildingId: b.buildingId, x: round2(b.x + b.w / 2 + 0.6), z: round2(b.z - b.d / 2 + 0.6) }))

  // 7) 납품 트럭: deliveries 하나당 트럭 1대 ---------------------------
  //    게이트 → 도로 → 목표 건물 앞까지 가는 경로 (시운전/건설중 건물 우선)
  const targets = blocks.filter((b) => b.isAnchor && (b.status === 'commissioning' || b.status === 'under_construction'))
  const trucks = site.deliveries.map((dlv, i) => {
    const target = targets[i % Math.max(1, targets.length)] ?? blocks[0] ?? { x: 0, z: 0, d: BLOCK_D }
    const frontZ = round2(target.z + target.d / 2 + 0.9)
    return {
      key: `truck-${i}`,
      delivery: dlv,
      targetBuildingId: target.buildingId ?? null,
      // 경로: [x, z] 점 목록. 마지막 점에서 잠시 멈췄다가 처음으로 돌아갑니다.
      path: [
        [round2(half + 6), roadZ],
        [target.x, roadZ],
        [target.x, frontZ],
      ],
    }
  })

  return { side: round2(side), blocks, substation, road, gate, powerLine, cranes, trucks, ghostCount, remainingMw }
}

function round2(v) {
  return Math.round(v * 100) / 100
}
