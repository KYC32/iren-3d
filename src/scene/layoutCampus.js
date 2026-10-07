// =============================================================
// layoutCampus.js — 사이트 원본(v2) → 캠퍼스 3D 배치
// -------------------------------------------------------------
// 두 단계로 나눕니다.
//   1) layoutCampus(site)            : 날짜와 무관한 "고정 자리" — 과거·미래의 모든 건물 + 빈 부지
//   2) campusStateAt(layout, site, m) : 날짜 m 의 블록별 상태(가동·건설·계획…)와 크레인·트럭
// 그래서 타임라인 슬라이더를 움직여도 블록 위치는 그대로이고 모습만 바뀝니다.
// 모두 순수 함수라 단위 테스트로 검증합니다.
//
// 좌표계: 캠퍼스 중심이 (0,0). x = 오른쪽, z = 화면 앞쪽(카메라 쪽).
// =============================================================
import { grossOf, phaseMonth, effectiveBuildingsAt, powerAt, progressAt, toMonth } from '../data/timeline.js'

// ---- 배치 상수 ----
export const BLOCK_MW = 75        // 기본 블록 1칸 = 75MW gross (= Horizon 1동, 50MW IT)
export const BLOCK_W = 4          // 블록 가로 (x)
export const BLOCK_D = 6          // 블록 세로 (z)
export const GAP = 1.4            // 블록 사이 간격
export const MAX_BLOCKS = 28      // 캠퍼스 블록 수 상한 (기가와트급은 블록 1칸 MW 를 키움)
const BLOCK_STEPS = [75, 150, 300, 600]
const MARGIN = 2
const SUBSTATION_COL = 7
const ROAD_DEPTH = 3
const HEIGHT = { datahall_liquid: 2.4, datahall_air: 1.9, miner_hall: 1.1, lot: 0.05 }

// -------------------------------------------------------------
// 아직 용도가 발표되지 않은 전력을 "빈 부지(점선)" 몇 칸으로 그릴지
// TODO(학습 포인트): 비례 / 상한 / 로그 스케일 중 직접 골라 보세요. 지금은 "비례 + 상한 16칸".
// -------------------------------------------------------------
export function ghostLotCount(remainingMw, blockMw = BLOCK_MW) {
  if (remainingMw < blockMw * 0.5) return 0
  return Math.min(16, Math.round(remainingMw / blockMw))
}

// 건물 하나가 몇 블록을 차지하는지 (최소 1칸)
export function blocksFor(building, blockMw = BLOCK_MW) {
  return Math.max(1, Math.round(grossOf(building).mw / blockMw))
}

// 최종 확보 전력 (전력 이력의 마지막 값)
const finalSecured = (site) => site.power.at(-1).secured_mw

// 발표된 건물로 설명되지 않는 남은 전력 (전환 건물은 기존 전력을 재사용하므로 제외)
function remainingOf(site) {
  const announced = site.buildings.filter((b) => !b.replaces).reduce((n, b) => n + grossOf(b).mw, 0)
  return Math.max(0, finalSecured(site) - announced)
}

// 블록 1칸의 MW: 총 블록이 MAX_BLOCKS 안에 들어오는 가장 작은 값
export function blockMwFor(site) {
  for (const mw of BLOCK_STEPS) {
    const n = site.buildings.reduce((k, b) => k + blocksFor(b, mw), 0) + ghostLotCount(remainingOf(site), mw)
    if (n <= MAX_BLOCKS) return mw
  }
  return BLOCK_STEPS.at(-1)
}

function plateSideFromAcres(acres) {
  const a = acres ?? 100
  return Math.min(44, Math.max(18, 12 + Math.sqrt(a) * 0.8))
}

const firstMonth = (b) => Math.min(...b.phases.map(phaseMonth))
const round2 = (v) => Math.round(v * 100) / 100

/**
 * 1) 고정 배치
 * @param {object} site  v2 원본 사이트 (view.js 의 viewSite 라면 site._raw)
 * @param {{ defaultKind?: string }} opts  건물 종류가 없을 때 쓸 기본값 (회사 그룹별)
 */
export function layoutCampus(site, { defaultKind = 'datahall_air' } = {}) {
  const blockMw = blockMwFor(site)
  // 첫 단계 날짜 순(같으면 데이터 순서) — 날짜가 바뀌어도 순서가 변하지 않음
  const ordered = site.buildings.map((b, i) => ({ b, i })).sort((x, y) => firstMonth(x.b) - firstMonth(y.b) || x.i - y.i)
  const items = []
  for (const { b } of ordered) {
    const n = blocksFor(b, blockMw)
    const kind = b.kind ?? defaultKind
    for (let i = 0; i < n; i++) items.push({ key: `${b.id}#${i}`, buildingId: b.id, kind, isAnchor: i === 0, index: i, count: n })
  }
  const remainingMw = remainingOf(site)
  const lotCount = ghostLotCount(remainingMw, blockMw)
  for (let i = 0; i < lotCount; i++) items.push({ key: `lot#${i}`, buildingId: null, kind: 'lot', isAnchor: i === 0, index: i, count: lotCount })

  // 부지 크기: 에이커 기준과 "블록이 다 들어가는 크기" 중 큰 쪽
  const cellW = BLOCK_W + GAP
  const cellD = BLOCK_D + GAP
  let side = plateSideFromAcres(site.acres)
  for (let guard = 0; guard < 40; guard++) {
    const cols = Math.max(1, Math.floor((side - SUBSTATION_COL - MARGIN * 2) / cellW))
    const rows = Math.max(1, Math.floor((side - ROAD_DEPTH - MARGIN * 2) / cellD))
    if (cols * rows >= items.length) break
    side += 2
  }
  const half = side / 2
  const cols = Math.max(1, Math.floor((side - SUBSTATION_COL - MARGIN * 2) / cellW))
  const x0 = -half + MARGIN + SUBSTATION_COL + BLOCK_W / 2
  const z0 = -half + MARGIN + BLOCK_D / 2
  const blocks = items.map((it, i) => ({
    ...it,
    x: round2(x0 + (i % cols) * cellW),
    z: round2(z0 + Math.floor(i / cols) * cellD),
    w: BLOCK_W,
    d: BLOCK_D,
    h: HEIGHT[it.kind] ?? 2,
  }))

  const substation = { x: round2(-half + MARGIN + 2.6), z: round2(-half + MARGIN + 3), w: 4.4, d: 5 }
  const roadZ = round2(half - MARGIN - ROAD_DEPTH / 2 + 0.6)
  return {
    side: round2(side),
    blockMw,
    blocks,
    substation,
    road: { z: roadZ, x0: -half, x1: half, depth: ROAD_DEPTH },
    gate: { x: round2(half), z: roadZ },
    powerLine: { from: [round2(-half - 10), substation.z], to: [substation.x, substation.z] },
    lotCount,
    remainingMw,
  }
}

/**
 * 2) 날짜 m 의 상태
 * 블록마다 status / progress / asLot(아직 없거나 사라진 건물 자리 → 빈 부지로 그림)
 */
export function campusStateAt(layout, site, m) {
  const asOfM = toMonth(String(site.as_of ?? '2026-01').slice(0, 7))
  const eff = new Map(effectiveBuildingsAt(site, m).map((e) => [e.building.id, e]))
  const byId = new Map(site.buildings.map((b) => [b.id, b]))
  const blocks = layout.blocks.map((blk) => {
    if (!blk.buildingId) return { ...blk, status: 'planned', progress: 0, asLot: false }
    const e = eff.get(blk.buildingId)
    // 아직 생기기 전 / 철거·완전 전환 / 부분 전환으로 줄어든 칸 → 빈 부지 모습
    const liveBlocks = e ? Math.max(1, Math.round(e.mw / layout.blockMw)) : 0
    if (!e || blk.index >= liveBlocks) return { ...blk, kind: 'lot', h: 0.05, status: 'planned', progress: 0, asLot: true }
    const progress = e.status === 'under_construction' ? progressAt(byId.get(blk.buildingId), m, asOfM) : e.status === 'planned' ? 0 : 1
    return { ...blk, status: e.status, progress, asLot: false }
  })

  // 변전소·송전선: 그 날짜에 통전됐는지
  const power = powerAt(site, m) ?? { secured: 0, energized: 0 }
  const energized = power.energized > 0
  const firstEnergized = site.power.find((p) => p.energized_mw > 0)
  const substation = {
    ...layout.substation,
    status: energized ? 'energized' : 'planned',
    mw: power.secured || finalSecured(site),
    voltage: site.substation?.voltage,
    dates: energized ? { energized: firstEnergized?.from } : firstEnergized ? { target: firstEnergized.from } : {},
  }

  // 크레인: 건설중 건물마다 하나 (첫 블록 옆)
  const cranes = blocks
    .filter((b) => b.status === 'under_construction' && b.isAnchor && !b.asLot)
    .map((b) => ({ key: `crane-${b.buildingId}`, buildingId: b.buildingId, x: round2(b.x + b.w / 2 + 0.6), z: round2(b.z - b.d / 2 + 0.6) }))

  // 납품 트럭: 기준일 이전·이후 모두 "진행 중" 납품만, 시운전·건설중 건물 앞으로
  const targets = blocks.filter((b) => b.isAnchor && !b.asLot && (b.status === 'commissioning' || b.status === 'under_construction'))
  const trucks = targets.length
    ? site.deliveries.map((dlv, i) => {
        const tgt = targets[i % targets.length]
        const frontZ = round2(tgt.z + tgt.d / 2 + 0.9)
        return {
          key: `truck-${i}`,
          delivery: dlv,
          targetBuildingId: tgt.buildingId,
          path: [[round2(layout.gate.x + 6), layout.road.z], [tgt.x, layout.road.z], [tgt.x, frontZ]],
        }
      })
    : []

  return {
    blocks,
    substation,
    powerLine: { ...layout.powerLine, energized, dates: substation.dates },
    cranes,
    trucks,
    remainingMw: layout.remainingMw,
  }
}
