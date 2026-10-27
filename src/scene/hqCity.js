// =============================================================
// hqCity.js — 본사 3D 화면의 실제 동네 배치 (순수 계산 — HqCity.jsx 가 그리고, hqCity.test.js 가 검사)
// -------------------------------------------------------------
// 자료: public/data/hq-city.json (OpenStreetMap · ODbL — scripts/fetch-hq-osm.mjs 가 만듦). 좌표는 미터 [동쪽, 북쪽]
// 화면 좌표: 본사 탑('City Centre' 조각) 가운데 = (0,0), x = 북쪽, z = 동쪽, y = 위, 1칸 = 5.5m
//   이 축 배치는 지도를 거울처럼 뒤집지 않음. 처음 카메라는 남동쪽 위(hqTower.HQ_VIEW) → 본사 동쪽(Pitt St) 벽이 정면
// 하는 일: 좌표 바꾸기 · 바닥 판(PLOT) 밖 자르기 · 건물 높이(층수·height 태그, 없으면 종류별 기본값) · 창문 모양 고르기 ·
//   길을 바닥 그림으로(아스팔트·보도·경전철 선로·차선 점선·횡단보도) · 가로수(OSM 나무 위치) · 가로등·차(꾸밈) · 이름표
// 돌려서 볼 때 본사를 가리는 건물은 occludersOf 가 고르고 HqCity.jsx 가 흐리게 그림
// =============================================================
import { FLOOR_H, PLOT, ringFaces, hqDirection, HQ_VIEW } from './hqTower.js'
import { centroid, pointInRing, clipRingToRect, clipLineToRect, segmentQuad, distToSegment, segmentHitsRing } from './geom2d.js'

export const M_PER_UNIT = 5.5
const u = (m) => m / M_PER_UNIT // 미터 → 칸

// 태그에 높이가 없을 때 쓰는 층수 (건물 종류별 — 시드니 도심의 흔한 높이로 잡은 기본값)
const DEFAULT_LEVELS = { retail: 3, commercial: 8, office: 8, yes: 5, apartments: 12, residential: 6, hotel: 12, service: 2, garage: 4, parking: 4, house: 2, church: 3, civic: 4, public: 4 }
// 길 폭(m): width 태그 → 차로 수 × 3.3m → 종류별 기본값
const ROAD_M = { motorway: 14, trunk: 14, primary: 13, secondary: 12, tertiary: 10, unclassified: 8, residential: 7, living_street: 6, service: 4.5 }
const LANE_M = 3.3
const WALK_M = 9    // 보행자 거리 기본 폭 (Pitt St Mall 처럼 넓은 곳은 따로 면(area)으로도 그려짐)
const RAIL_M = 7    // 경전철이 다니는 조지 스트리트 (보도 포장 + 선로 두 줄)
const CROSS_M = 3   // 횡단보도 줄무늬 길이 (차가 다니는 방향)
// 이름표: 바닥에 쓰는 길 이름 (OSM 이름 → 화면 글자) · 건물 위 이름표 (한국어 · 영어)
const STREET_LABELS = { 'Market Street': 'Market St', 'Pitt Street': 'Pitt St', 'Pitt Street Mall': 'Pitt St Mall', 'Castlereagh Street': 'Castlereagh St', 'George Street': 'George St' }
//   스테이트 시어터는 본사 바로 서쪽 옆이라 어느 쪽에서 보든 이름표가 본사 위에 겹쳐서 뺌 (2026-10-27)
const BUILDING_LABELS = { 'Westfield Sydney': { ko: '웨스트필드 시드니', en: 'Westfield Sydney' } }
const CAR_COLORS = ['#f4f6f8', '#c8463d', '#2f4a6b', '#e9b949', '#9aa5b1', '#1f2a36', '#5d7f99', '#e7e1d4']

// 문자열 → 0 이상 정수 (같은 건물은 늘 같은 창문 모양 · 같은 길은 늘 같은 차 배치)
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h }
const r3 = (v) => Math.round(v * 1000) / 1000

// view = 처음 카메라 방향 (바닥에 쓴 길 이름이 그 카메라에서 바로 읽히게)
export function hqCityLayout(file, plot = PLOT, view = HQ_VIEW) {
  const half = plot / 2
  const rect = { x0: -half, x1: half, z0: -half, z1: half }
  // ── 1) 본사: 땅 윤곽(hq) + 그 안에서 층이 가장 많은 조각 = 탑 → 탑 가운데를 원점으로 ──
  const podiumM = file.buildings.find((b) => b.hq)
  const inPodium = (b) => podiumM && b !== podiumM && b['building:part'] && pointInRing(centroid(b.ring), podiumM.ring)
  const towerM = file.buildings.filter(inPodium).sort((a, b) => (b['building:levels'] ?? 0) - (a['building:levels'] ?? 0))[0] ?? podiumM
  const o = towerM ? centroid(towerM.ring) : [0, 0] // 미터 [동, 북]
  const P = (p) => [r3(u(p[1] - o[1])), r3(u(p[0] - o[0]))] // [동, 북] m → [x 북, z 동] 칸
  const ring = (r) => r.map(P)

  // ── 2) 건물: 조각이 있는 윤곽은 조각 높이에 맞춤, 윤곽 속에 숨는 조각은 뺌 ──
  const all = file.buildings.filter((b) => b !== podiumM && b !== towerM && !inPodium(b) && (b.building ?? b['building:part']) !== 'roof')
  const parts = all.filter((b) => b['building:part'])
  const levels = (b) => b['building:levels'] ?? null
  const baseOf = (b) => (b.min_height != null ? u(b.min_height) : b['building:min_level'] != null ? b['building:min_level'] * FLOOR_H : 0)
  const ownTop = (b) => (b.height != null ? u(b.height) : levels(b) != null ? levels(b) * FLOOR_H : null)
  const partsOf = new Map(all.filter((b) => !b['building:part']).map((b) => [b, parts.filter((p) => pointInRing(centroid(p.ring), b.ring))]))
  const tops = new Map()
  for (const b of all) {
    let top = ownTop(b)
    const ps = partsOf.get(b) ?? []
    if (top == null && ps.length) { const g = ps.filter((p) => baseOf(p) === 0 && ownTop(p) != null).map(ownTop); if (g.length) top = Math.min(...g) }
    if (top == null) top = (DEFAULT_LEVELS[b.building ?? b['building:part']] ?? 5) * FLOOR_H
    tops.set(b, top)
  }
  // 윤곽과 같은 자리·같은 높이로 땅에서 시작하는 조각, 윤곽보다 낮은 조각은 윤곽 속에 숨음 → 뺌 (같은 벽 두 번 = 깜빡임)
  const hidden = new Set()
  for (const [b, ps] of partsOf) for (const p of ps) if (baseOf(p) === 0 && tops.get(p) <= tops.get(b) + 1e-6) hidden.add(p)
  const buildings = []
  for (const b of all) {
    if (hidden.has(b)) continue
    const r = clipRingToRect(ring(b.ring), rect.x0, rect.x1, rect.z0, rect.z1)
    if (r.length < 3) continue
    const y0 = baseOf(b), y1 = Math.max(tops.get(b), y0 + 0.4)
    const areaM = Math.abs(polyArea(b.ring))
    buildings.push({
      id: b.id, ...(b.name ? { name: b.name } : {}), ring: r, y0: r3(y0), y1: r3(y1),
      style: styleOf(b, y1 - y0, areaM),
      ...(b.holes ? { holes: b.holes.map((h) => clipRingToRect(ring(h), rect.x0, rect.x1, rect.z0, rect.z1)).filter((h) => h.length >= 3) } : {}),
    })
  }

  // ── 3) 길: 종류 · 폭 · 화면 좌표 꺾은선 (바닥 판 안만) ──
  const roads = []
  for (const r of file.roads) {
    const kind = r.crossing ? 'crossing' : r.highway === 'pedestrian' ? 'walk' : r.rails ? 'rail' : ROAD_M[r.highway] ? 'car' : null
    if (!kind) continue
    const wm = r.width ?? (kind === 'walk' ? WALK_M : kind === 'rail' ? RAIL_M : kind === 'crossing' ? CROSS_M : r.lanes ? Math.max(r.lanes * LANE_M, 5) : ROAD_M[r.highway])
    const base = { id: r.id, ...(r.name ? { name: r.name } : {}), kind, width: r3(u(wm)), ...(r.lanes ? { lanes: r.lanes } : {}), ...(r.oneway ? { oneway: true } : {}) }
    if (r.ring) { const g = clipRingToRect(ring(r.ring), rect.x0, rect.x1, rect.z0, rect.z1); if (g.length >= 3) roads.push({ ...base, ring: g }); continue }
    for (const run of clipLineToRect(r.line.map(P), rect)) roads.push({ ...base, line: run })
  }
  const carRoads = roads.filter((r) => r.kind === 'car' && r.line)

  // 바닥 그림 (다각형 목록 — 모두 바닥 판 안으로 자름): 아스팔트 · 보도 포장 · 선로 · 차선 점선 · 횡단보도
  const clip = (g) => clipRingToRect(g, rect.x0, rect.x1, rect.z0, rect.z1)
  const strip = (line, w) => { const out = []; for (let i = 1; i < line.length; i++) out.push(segmentQuad(line[i - 1], line[i], w)); for (const p of line.slice(1, -1)) out.push(disc(p, w / 2)); return out }
  const asphalt = carRoads.flatMap((r) => strip(r.line, r.width)).map(clip).filter((g) => g.length >= 3)
  const paving = [
    ...roads.filter((r) => (r.kind === 'walk' || r.kind === 'rail') && r.line).flatMap((r) => strip(r.line, r.width)),
    ...roads.filter((r) => r.kind === 'walk' && r.ring).map((r) => r.ring),
    ...(file.areas ?? []).map((a) => ring(a.ring)),
  ].map(clip).filter((g) => g.length >= 3)
  const rails = roads.filter((r) => r.kind === 'rail' && r.line).flatMap((r) => [-1, 1].flatMap((side) => offsetLine(r.line, side * u(0.72)).flatMap((l) => strip(l, u(0.12)))))
    .map(clip).filter((g) => g.length >= 3)
  const dashes = carRoads.filter((r) => r.width >= u(7)).flatMap((r) => dashesAlong(r.line, u(3), u(3), u(0.16))).map(clip).filter((g) => g.length >= 3)
  const zebras = roads.filter((r) => r.kind === 'crossing' && r.line).flatMap((r) => zebraAlong(r.line, r.width)).map(clip).filter((g) => g.length >= 3)

  // ── 4) 가로수 (OSM 나무 위치) — 건물 안·차도 위·바닥 판 가장자리는 뺌 ──
  const solid = [...buildings.filter((b) => b.y0 === 0).map((b) => b.ring), ring(podiumM?.ring ?? [])].filter((r) => r.length >= 3)
  const onCarRoad = (p, pad = 0) => carRoads.some((r) => r.line.some((a, i) => i > 0 && distToSegment(p, r.line[i - 1], a) <= r.width / 2 + pad))
  const inSolid = (p) => solid.some((r) => pointInRing(p, r))
  const edgeOk = (p, m) => Math.abs(p[0]) <= half - m && Math.abs(p[1]) <= half - m
  const trees = (file.trees ?? []).map(P).filter((p) => edgeOk(p, 0.6) && !inSolid(p) && !onCarRoad(p, 0.15))

  // ── 5) 바닥 길 이름 (먼저 자리를 정해 차가 그 위에 서지 않게) ──
  const dir = hqDirection(view), dl = Math.hypot(dir[0], dir[2]) || 1
  const cam = [dir[0] * 60, 8 + dir[1] * 60, dir[2] * 60] // 처음 카메라 자리 어림 (거리 60 — 가림 확인용)
  const ground = streetLabels(roads, [dir[2] / dl, -dir[0] / dl], [dir[0] / dl, dir[2] / dl], half, (p) => !buildings.some((b) => segmentHitsPrism([p[0], BLOCK_TOP + 0.01, p[1]], cam, b)))
  const onLabel = (p) => ground.some((g) => Math.hypot(p[0] - g.at[0], p[1] - g.at[1]) < 2.6)

  // ── 6) 가로등 · 차 (꾸밈 — OSM 에 가로등 위치가 거의 없어 차도 가장자리에 일정 간격으로) ──
  const lamps = [], cars = []
  for (const r of carRoads) {
    const h = hash(r.id)
    // 가로등: 인도 쪽 가장자리를 따라 5칸마다, 양쪽 번갈아
    for (const [i, s] of samples(r.line, 5, (h % 7) / 7 * 5).entries()) {
      const side = i % 2 ? 1 : -1, p = offsetPoint(s, side * (r.width / 2 + u(1.8)))
      if (edgeOk(p, 0.4) && !inSolid(p) && !onCarRoad(p, 0.05)) lamps.push(p)
    }
    // 차: 폭이 6m 넘는 차도에 5칸(약 27m)마다 — 일방통행은 차로마다 같은 방향, 양방향은 바깥 차로에 서로 반대로
    if (r.width < u(6)) continue
    const lanes = Math.max(1, Math.round(r.lanes ?? r.width / u(LANE_M)))
    for (const [i, s] of samples(r.line, 5, ((h >> 3) % 5) + 1).entries()) {
      const lane = (i + (h % lanes)) % lanes
      const off = r.oneway ? (lane - (lanes - 1) / 2) * u(LANE_M) : (i % 2 ? 1 : -1) * r.width / 4
      const back = !r.oneway && i % 2 === 1 // 양방향 길의 반대 차로 → 반대 방향
      const p = offsetPoint(s, off)
      const nearOther = carRoads.some((q) => q !== r && q.line.some((a, k) => k > 0 && distToSegment(p, q.line[k - 1], a) < q.width / 2 + 0.7)) // 교차로 안
      if (!edgeOk(p, 1.2) || nearOther || onLabel(p) || cars.some((c) => Math.hypot(c.x - p[0], c.z - p[1]) < 1.6)) continue
      cars.push({ x: r3(p[0]), z: r3(p[1]), ry: r3(Math.atan2(-(back ? -s.d[1] : s.d[1]), back ? -s.d[0] : s.d[0])), color: CAR_COLORS[(h + i) % CAR_COLORS.length], road: r.id })
    }
  }

  // ── 7) 공원 · 이름표 · 랜드마크(시드니 타워) ──
  const parks = (file.parks ?? []).map((p) => clip(ring(p.ring))).filter((g) => g.length >= 3)
  const labels = buildings.filter((b) => BUILDING_LABELS[b.name] && !labelTaken(b, buildings)).map((b) => {
    const [x, z] = centroid(b.ring)
    return { id: b.id, ...BUILDING_LABELS[b.name], at: [r3(x), r3(b.y1 + 0.15), r3(z)] }
  })
  const towerParts = file.buildings.filter((b) => b.name === 'Sydney Tower' || (b.height ?? 0) >= 300)
  const turret = file.buildings.find((b) => b.name === 'Sydney Tower')
  const sydneyTower = turret ? (() => {
    const [x, z] = P(centroid(turret.ring))
    return { x: r3(x), z: r3(z), top: r3(u(Math.max(...towerParts.map((b) => b.height ?? 0)))), turret: { y0: r3(u(turret.min_height ?? 0)), y1: r3(u(turret.height ?? 0)) } }
  })() : null

  return {
    origin: o, half,
    hq: { podium: ring(podiumM?.ring ?? []), tower: ring(towerM?.ring ?? []), osmLevels: towerM?.['building:levels'] ?? null },
    buildings, roads, asphalt, paving, rails, dashes, zebras, parks, trees, lamps, cars, labels, ground,
    landmarks: { sydneyTower },
  }
}

// 같은 이름의 건물이 여럿이면 가장 넓은 것 하나에만 이름표 (웨스트필드처럼 조각이 여럿인 곳)
function labelTaken(b, all) {
  const same = all.filter((o) => o.name === b.name)
  return same.some((o) => o !== b && Math.abs(polyArea(o.ring)) > Math.abs(polyArea(b.ring)))
}

// 창문 그림 모양: 금색 탑 꼭대기 · 가늘고 높은 구조물(탑 기둥) · 유리 · 상가 · 사무 · 주거 — 같은 건물은 늘 같은 모양
function styleOf(b, h, areaM) {
  const col = String(b['building:colour'] ?? '').toLowerCase()
  if (col === 'gold') return 'gold'
  if (areaM < 250 && h > u(100)) return 'concrete'
  if (b['building:material'] === 'glass') return 'glass'
  const type = b.building ?? b['building:part']
  const k = hash(b.id)
  if (type === 'retail' && h <= 4 * FLOOR_H) return 'retail'
  if (['apartments', 'residential', 'hotel'].includes(type)) return ['warm', 'stone'][k % 2]
  if (col === 'peru' || b['building:material'] === 'sandstone') return 'warm'
  return ['glass', 'dark', 'stone', 'warm'][k % 4]
}

const polyArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1] } return a / 2 }

// 점 둘레 원(팔각형) — 꺾이는 길목을 메우는 둥근 이음
function disc([x, z], r, n = 10) {
  return Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), z + r * Math.sin((i / n) * Math.PI * 2)])
}

// 꺾은선을 따라 step 마다 점 (start 부터) — 점마다 진행 방향 d 도 같이
function samples(line, step, start = 0) {
  const out = []
  let next = start, acc = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1e-9) continue
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    while (next <= acc + len) { const t = next - acc; out.push({ p: [a[0] + d[0] * t, a[1] + d[1] * t], d }); next += step }
    acc += len
  }
  return out
}
// 진행 방향의 왼쪽(+)·오른쪽(−)으로 off 만큼 옮긴 점
const offsetPoint = (s, off) => [s.p[0] - s.d[1] * off, s.p[1] + s.d[0] * off]

// 꺾은선을 옆으로 off 만큼 평행이동 (선로 두 줄) — 꺾인 곳은 두 변의 이동점을 그대로 이음 (작은 꺾임만 있는 길이라 충분)
function offsetLine(line, off) {
  const out = []
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const n = [-(b[1] - a[1]) / len * off, (b[0] - a[0]) / len * off]
    out.push([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]]])
  }
  return out
}

// 차선 점선: dash 길이만큼 칠하고 gap 만큼 띄움 (폭 w)
function dashesAlong(line, dash, gap, w) {
  return samples(line, dash + gap, gap).map((s) => segmentQuad(s.p, [s.p[0] + s.d[0] * dash, s.p[1] + s.d[1] * dash], w))
}

// 횡단보도 줄무늬: 건너는 방향(선 방향)으로 0.55m 마다 막대, 막대는 차가 다니는 방향으로 길게 (길이 = 횡단보도 폭)
function zebraAlong(line, width) {
  return samples(line, u(1.1), u(0.4)).map((s) => {
    const n = [-s.d[1] * width / 2, s.d[0] * width / 2]
    return segmentQuad([s.p[0] - n[0], s.p[1] - n[1]], [s.p[0] + n[0], s.p[1] + n[1]], u(0.5))
  })
}

// 바닥에 쓰는 길 이름: 이름마다 하나 — 본사에 가깝고, 처음 카메라 쪽(본사 앞)이며, 교차로가 아닌 자리
//   점수 = 본사까지 거리 + (본사 뒤쪽이면 8칸 벌점) · 다른 이름 차도의 폭 안(+1.2칸)이나 바닥 판 가장자리 1칸 안은 뺌
//   visible(p) = 처음 카메라와 그 자리 사이에 건물이 없는지 (길 건너 빌딩에 가린 자리는 뺌)
//   글자 방향은 처음 카메라에서 왼쪽→오른쪽으로 읽히게 (right = 그 카메라의 화면 오른쪽, toCam = 본사에서 카메라 쪽)
function streetLabels(roads, right, toCam, half, visible) {
  const cars = roads.filter((r) => r.kind === 'car' && r.line)
  const out = []
  for (const [osm, text] of Object.entries(STREET_LABELS)) {
    const runs = roads.filter((r) => r.name === osm && r.line && r.kind !== 'crossing')
    if (!runs.length) continue
    const others = cars.filter((r) => r.name !== osm)
    let best = null
    for (const r of runs) for (const s of samples(r.line, 0.5)) {
      const p = s.p
      if (Math.abs(p[0]) > half - 1 || Math.abs(p[1]) > half - 1) continue
      if (others.some((q) => q.line.some((b, i) => i > 0 && distToSegment(p, q.line[i - 1], b) <= q.width / 2 + 1.2))) continue
      if (!visible(p)) continue
      const score = Math.hypot(p[0], p[1]) + (p[0] * toCam[0] + p[1] * toCam[1] < 0 ? 8 : 0)
      if (!best || score < best.score) best = { score, r, s }
    }
    if (!best) continue
    let d = best.s.d
    if (d[0] * right[0] + d[1] * right[1] < 0) d = [-d[0], -d[1]] // 화면 오른쪽과 같은 쪽을 보게
    out.push({ text, at: [r3(best.s.p[0]), r3(best.s.p[1])], ry: r3(Math.atan2(-d[1], d[0])), walk: best.r.kind !== 'car' })
  }
  return out
}

// ── 돌려 볼 때 본사를 가리는 이웃 건물 고르기 (HqCity.jsx 가 그 건물을 흐리게 그림) ──────────────
// 본사 탑 벽의 과녁 점에서 카메라까지 선을 긋고, 그 선이 지나가는 건물(다각형 기둥) = 가리는 건물
const BLOCK_TOP = 0.12 // 바닥 판 윗면 높이 (빌딩·본사가 이 위에 섬 — HqCity.jsx·HqView.jsx 와 같음)

// 탑 벽의 과녁 점: 높이는 IREN 층 가운데 · 건물 중간 · 옥상 바로 아래, 가로는 벽마다 양 끝에서 조금 안쪽 두 곳과 가운데
//   로비·포디움 높이는 빼서 낮은 상가가 아래층만 가릴 땐 흐리게 하지 않음. n = 벽이 바라보는 방향 (카메라 쪽 벽만 셀 때 씀)
export function towerTargets(T) {
  const irenMid = BLOCK_TOP + (T.iren ? T.iren.y + T.iren.h / 2 : T.height * 0.3)
  const ys = [irenMid, BLOCK_TOP + T.height * 0.55, BLOCK_TOP + T.roof.y - 0.3]
  const out = []
  for (const f of ringFaces(T.ring)) {
    if (f.len < 0.8) continue // 모서리를 깎은 짧은 벽은 건너뜀 (긴 벽 점으로 충분)
    const [a, b] = f.c
    for (const t of [0.15, 0.5, 0.85]) {
      const x = a[0] + (b[0] - a[0]) * t + f.n[0] * 0.01, z = a[1] + (b[1] - a[1]) * t + f.n[1] * 0.01
      for (const y of ys) out.push({ p: [x, y, z], n: [f.n[0], 0, f.n[1]] })
    }
  }
  return out
}

// 선분 a→b(3D)가 다각형 기둥(ring, 높이 y0~y1)을 지나는지: 높이 구간으로 선분을 자른 뒤, 그 바닥 그림자 선분이 다각형을 지나는지
function segmentHitsPrism(a, b, prism) {
  const lo = BLOCK_TOP + prism.y0, hi = BLOCK_TOP + prism.y1
  const dy = b[1] - a[1]
  let t0 = 0, t1 = 1
  if (Math.abs(dy) < 1e-9) { if (a[1] < lo || a[1] > hi) return false }
  else {
    let ta = (lo - a[1]) / dy, tb = (hi - a[1]) / dy
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  const at = (t) => [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]
  return segmentHitsRing(at(t0), at(t1), prism.ring)
}

// cam = 카메라 위치 [x, y, z] → 본사를 가리는 건물 번호 목록 (buildings 순서)
//   빠르게: 먼저 건물의 바닥 사각형(bbox)으로 걸러 내고, 걸린 것만 다각형으로 정확히 봄
export function occludersOf(cam, buildings, targets) {
  const seen = targets.filter((t) => (cam[0] - t.p[0]) * t.n[0] + (cam[2] - t.p[2]) * t.n[2] > 0) // 카메라 쪽을 보는 벽의 점만
  const out = []
  buildings.forEach((b, i) => {
    const bb = b.bbox ?? (b.bbox = boxOf(b.ring))
    const near = seen.filter((t) => segBoxXZ(t.p, cam, bb))
    if (near.length && near.some((t) => segmentHitsPrism(t.p, cam, b))) out.push(i)
  })
  return out
}
const boxOf = (ring) => ({ x0: Math.min(...ring.map((p) => p[0])), x1: Math.max(...ring.map((p) => p[0])), z0: Math.min(...ring.map((p) => p[1])), z1: Math.max(...ring.map((p) => p[1])) })
// 바닥에 비친 선분(x·z)이 사각형에 닿는지 (빠른 거르기)
function segBoxXZ(a, b, bb) {
  let t0 = 0, t1 = 1
  for (const [p, q0, q1] of [[0, bb.x0, bb.x1], [2, bb.z0, bb.z1]]) {
    const d = b[p] - a[p]
    if (Math.abs(d) < 1e-9) { if (a[p] < q0 || a[p] > q1) return false; continue }
    let ta = (q0 - a[p]) / d, tb = (q1 - a[p]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  return true
}
