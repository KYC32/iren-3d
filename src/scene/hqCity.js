// =============================================================
// hqCity.js — 본사 3D 화면의 동네 배치 (순수 계산 — HqCity.jsx 가 그리고, hqCity.test.js 가 규칙을 검사)
// -------------------------------------------------------------
// 55 Market Street 는 Market St(동서) 와 Pitt St(남북) 가 만나는 모퉁이 빌딩
//   이 장면: 본사 가운데가 (0,0), +z 쪽 = Market St, +x 쪽 = Pitt St, 두 길이 만나는 모퉁이 = (+x, +z)
//   카메라는 (+x, +z) 쪽 위에서 내려다봄 → 모퉁이와 본사 정면이 보이고, 뒤(−x·−z)의 높은 빌딩이 배경이 됨
// 이웃 건물·나무·차는 "도심 모퉁이"임을 보여 주는 꾸밈 — 실제 건물 배치가 아님 (화면 카드에 '단순화한 모형'이라 밝힘)
// 규칙 (테스트): 서로·본사·도로와 안 겹침 / 카메라와 본사 사이의 건물은 낮게(5층을 가리지 않게) / 나무·가로등은 인도 위
//   돌려서 다른 쪽에서 볼 때 가리는 건물은 맨 아래 occludersOf 가 골라 HqCity.jsx 가 흐리게 그림
// =============================================================
import { TOWER_W, TOWER_D, PLOT } from './hqTower.js'

export const ROAD_W = 3.2   // 도로 폭 (왕복 2차로)
export const WALK_W = 1.3   // 인도 폭
const GAP = 0.3             // 본사 벽과 인도 사이
// 도로 한가운데 줄: Market St 는 z = ROAD_AT, Pitt St 는 x = ROAD_AT
export const ROAD_AT = TOWER_W / 2 + GAP + WALK_W + ROAD_W / 2

// 건물 모양(style): glass 파란 유리 · dark 짙은 유리 · stone 밝은 석재 · warm 따뜻한 벽돌색 · retail 낮은 상가(넓은 유리 진열창)
const BUILDINGS = [
  // 본사와 같은 블록 (x·z < 인도) — 뒤(−x·−z) 쪽. 화면에서 본사와 겹치는 건 본사 옥상보다 낮게 (본사가 하늘을 배경으로 돋보이게)
  { x: -7.4, z: -0.4, w: 7.2, d: 7.4, h: 7.6, style: 'stone' },
  { x: -0.2, z: -8.2, w: 6.8, d: 6.6, h: 10.5, style: 'stone' },
  { x: -8.8, z: -9.6, w: 8.0, d: 6.8, h: 10.5, style: 'dark' },
  { x: -14.4, z: -1.4, w: 4.4, d: 9.2, h: 5.2, style: 'warm' },
  { x: -15.0, z: -11.6, w: 3.6, d: 8.4, h: 12.0, style: 'glass' },
  { x: 0.2, z: -14.6, w: 6.2, d: 4.2, h: 6.8, style: 'warm' },
  // Pitt St 건너편 (오른쪽) — 화면에서 본사 옆으로 비켜 있음
  { x: 13.0, z: -0.6, w: 7.0, d: 7.4, h: 4.8, style: 'warm' },
  { x: 13.0, z: -10.0, w: 7.0, d: 9.4, h: 12.0, style: 'dark' },
  // Market St 건너편 (카메라 쪽) — 낮은 상가 하나 (본사 5층을 가리지 않게), 나머지는 공원
  { x: -10.6, z: 12.9, w: 11.6, d: 6.4, h: 2.4, style: 'retail' },
]

// 인도 상자 [x0,x1] × [z0,z1] — 도로와 겹치는 곳은 나눔 (길을 건너는 자리는 횡단보도)
function walkBoxes(half) {
  const r0 = ROAD_AT - ROAD_W / 2, r1 = ROAD_AT + ROAD_W / 2          // 도로 가장자리
  const near = [r0 - WALK_W, r0], far = [r1, r1 + WALK_W]              // 도로 이쪽·건너편 인도
  const out = []
  for (const [z0, z1] of [near, far]) out.push({ x0: -half, x1: r0, z0, z1 }, { x0: r1, x1: half, z0, z1 })   // Market St 양쪽
  for (const [x0, x1] of [near, far]) out.push({ x0, x1, z0: -half, z1: r0 }, { x0, x1, z0: r1, z1: half })   // Pitt St 양쪽
  return out
}

// 인도 한가운데 줄을 따라 step 간격으로 점 찍기 (from·to 사이, skip(p) 이면 뺌)
function along(axis, at, from, to, step, skip) {
  const pts = []
  for (let v = from; v <= to + 1e-9; v += step) {
    const p = axis === 'x' ? { x: v, z: at } : { x: at, z: v }
    if (!skip(p)) pts.push(p)
  }
  return pts
}

export function hqCityLayout(plot = PLOT) {
  const half = plot / 2
  const r0 = ROAD_AT - ROAD_W / 2, r1 = ROAD_AT + ROAD_W / 2
  const walkNear = r0 - WALK_W / 2, walkFar = r1 + WALK_W / 2       // 인도 한가운데 줄
  const corner = { x: ROAD_AT, z: ROAD_AT }
  // 본사 정문(Market St 쪽 가운데) 앞과 모퉁이 가까이는 나무를 비움
  const nearDoor = (p) => p.z === walkNear && Math.abs(p.x) < 1.8
  const nearCorner = (p) => Math.hypot(p.x - corner.x, p.z - corner.z) < 3.2
  const skipTree = (p) => nearDoor(p) || nearCorner(p)
  const lines = [  // [방향, 인도 줄, 시작, 끝] — 도로가 가로지르는 구간은 뺌
    ['x', walkNear, -half + 1.5, r0 - 0.8], ['x', walkFar, -half + 1.5, r0 - 0.8], ['x', walkFar, r1 + 0.8, half - 1.5], ['x', walkNear, r1 + 0.8, half - 1.5],
    ['z', walkNear, -half + 1.5, r0 - 0.8], ['z', walkFar, -half + 1.5, r0 - 0.8], ['z', walkFar, r1 + 0.8, half - 1.5],
  ]
  const trees = lines.flatMap(([a, at, f, t]) => along(a, at, f, t, 3, skipTree))
  const lamps = lines.flatMap(([a, at, f, t]) => along(a, at, f + 1.5, t, 6, skipTree))
  // 블록 바닥 네 개 (인도와 같은 높이로 깔아 빌딩·나무가 그 위에 섬): 도로·인도를 뺀 네 귀퉁이
  const a = r0 - WALK_W, b = r1 + WALK_W
  const blocks = [[-half, a, -half, a], [b, half, -half, a], [-half, a, b, half], [b, half, b, half]].map(([x0, x1, z0, z1]) => ({ x0, x1, z0, z1 }))
  // 공원 (카메라 쪽 두 블록): 잔디 + 나무 격자 — 앞쪽이 비어 보이지 않고, 본사를 가리지 않게
  const parks = [{ x0: -3.8, x1: a, z0: b, z1: half }, { x0: b, x1: half, z0: b, z1: half }]
  const parkTrees = parks.flatMap((pk) => {
    const pts = []
    for (let x = pk.x0 + 1.1; x <= pk.x1 - 0.9; x += 2.3) for (let z = pk.z0 + 1.1; z <= pk.z1 - 0.9; z += 2.3) pts.push({ x: x + ((z * 3) % 0.6), z })
    return pts
  })
  return {
    corner, blocks, parks, parkTrees,
    roads: [{ axis: 'x', at: ROAD_AT, name: 'Market St' }, { axis: 'z', at: ROAD_AT, name: 'Pitt St' }],
    walks: walkBoxes(half),
    buildings: BUILDINGS,
    trees, lamps,
    // 횡단보도: 모퉁이 네 방향 (줄무늬는 도로를 가로지름)
    crossings: [
      { x: r0 - 0.9, z: ROAD_AT, across: 'z' }, { x: r1 + 0.9, z: ROAD_AT, across: 'z' },
      { x: ROAD_AT, z: r0 - 0.9, across: 'x' }, { x: ROAD_AT, z: r1 + 0.9, across: 'x' },
    ],
    // 자동차: 차선 가운데 (Market St 는 x 방향, Pitt St 는 z 방향으로 놓임)
    cars: [
      { x: -10.5, z: ROAD_AT - 0.8, along: 'x', color: '#f4f6f8' }, { x: -3.2, z: ROAD_AT + 0.8, along: 'x', color: '#c8463d' },
      { x: 12.5, z: ROAD_AT - 0.8, along: 'x', color: '#2f4a6b' }, { x: ROAD_AT - 0.8, z: -9.5, along: 'z', color: '#e9b949' },
      { x: ROAD_AT + 0.8, z: 12.0, along: 'z', color: '#9aa5b1' },
    ],
  }
}

// ── 돌려 볼 때 본사를 가리는 이웃 건물 고르기 (HqCity.jsx 가 그 건물을 흐리게 그림) ──────────────
// 기본 구도는 위 배치 규칙이 지키지만, 카메라를 뒤로 돌리면 뒤쪽 높은 빌딩이 본사 5층을 가림
//   → 본사 벽의 과녁 점에서 카메라까지 선을 긋고, 그 선이 지나가는 건물 = 가리는 건물
const BLOCK_TOP = 0.12 // 블록 바닥 높이 (빌딩·본사가 이 위에 섬 — HqCity.jsx·HqView.jsx 와 같음)

// 본사 네 벽의 과녁 점: 높이는 IREN 층 가운데 · 건물 중간 · 옥상 바로 아래, 가로는 모서리에서 조금 안쪽 세 곳
//   로비 높이는 빼서 낮은 상가가 로비만 가릴 땐 흐리게 하지 않음. n = 벽이 바라보는 방향 (카메라 쪽 벽만 셀 때 씀)
export function towerTargets(T) {
  const irenMid = BLOCK_TOP + (T.iren ? T.iren.y + T.iren.h / 2 : T.height * 0.3)
  const ys = [irenMid, BLOCK_TOP + T.height * 0.55, BLOCK_TOP + T.roof.y - 0.3]
  const hw = TOWER_W / 2, hd = TOWER_D / 2, s3 = [-0.7, 0, 0.7]
  const faces = [
    { n: [1, 0, 0], at: (s, y) => [hw + 0.01, y, s * hd] },
    { n: [-1, 0, 0], at: (s, y) => [-hw - 0.01, y, s * hd] },
    { n: [0, 0, 1], at: (s, y) => [s * hw, y, hd + 0.01] },
    { n: [0, 0, -1], at: (s, y) => [s * hw, y, -hd - 0.01] },
  ]
  return faces.flatMap((f) => ys.flatMap((y) => s3.map((s) => ({ p: f.at(s, y), n: f.n }))))
}

// 선분 a→b 가 상자를 지나면 들어가는 지점 t(0~1), 안 지나면 Infinity (축마다 들어가고 나가는 t 를 좁혀 가는 방법)
function segmentHitsBox(a, b, box) {
  let t0 = 0, t1 = 1
  const lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1]
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k]
    if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) return Infinity; continue }
    let ta = (lo[k] - a[k]) / d, tb = (hi[k] - a[k]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return Infinity
  }
  return t0
}

// cam = 카메라 위치 [x, y, z] → 본사를 가리는 건물 번호 목록 (buildings 순서)
export function occludersOf(cam, buildings, targets) {
  // 카메라 쪽을 바라보는 벽의 점만 (반대쪽 벽은 본사 자신에 가려 어차피 안 보임)
  const seen = targets.filter((t) => (cam[0] - t.p[0]) * t.n[0] + (cam[2] - t.p[2]) * t.n[2] > 0)
  const out = []
  buildings.forEach((b, i) => {
    const box = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: 0, y1: BLOCK_TOP + b.h, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }
    if (seen.some((t) => segmentHitsBox(t.p, cam, box) <= 1)) out.push(i)
  })
  return out
}
