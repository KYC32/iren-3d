// =============================================================
// hqTraffic.js — 본사 3D 화면의 움직이는 차·사람 (순수 계산 — HqTraffic.jsx 가 매 프레임 자리를 받아 그림 · hqTraffic.test.js)
// -------------------------------------------------------------
// 차: 차도(hqCityLayout 의 roads, kind 'car')를 차로(lane)로 나눔 — 폭 1칸(5.5m)이 안 되는 골목은 뺌
//   일방통행 = 차로 수만큼 OSM 선 방향으로 나란히 · 양방향 = 호주식 왼쪽 통행 (두 방향 모두 진행 방향의 왼쪽 차로)
//   차로 끝에서 0.9칸 안에 이어지는 다른 차로가 있으면 그쪽으로 넘어감 (교차로에서 꺾음 — 곧게 가는 쪽을 먼저)
//   이어지는 차로가 없으면(바닥 판 끝) 판 가장자리에서 시작하는 차로 중 하나로 다시 들어옴
//   판 가장자리 1칸에서는 크기를 줄였다 키워 갑자기 생기고 사라지지 않게
// 사람: Pitt St Mall(차 없는 보행자 거리) 선을 따라 오가며 걸음 (끝에 닿으면 돌아섬)
// 화면 좌표는 hqCity.js 와 같음: x = 북, z = 동, 1칸 = 5.5m. 진행 방향 d 의 왼쪽 = (dz, −dx)
// 움직임 줄이기 설정이면 HqTraffic.jsx 가 시간을 멈춤 (처음 자리에 그대로)
// =============================================================
import { PLOT } from './hqTower.js'

const LANE_W = 3.3 / 5.5   // 차로 폭 (칸)
const MIN_ROAD_W = 1       // 이보다 좁은 길(골목·서비스 도로)은 차를 다니게 하지 않음
const JOIN = 0.9           // 차로 끝과 다음 차로 사이 허용 거리 (칸)
const KINDS = ['sedan', 'suv', 'hatchback', 'van', 'pickup']
const COLORS = ['#f4f6f8', '#c8463d', '#2f4a6b', '#e9b949', '#9aa5b1', '#1f2a36', '#5d7f99', '#e7e1d4']
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h }
const leftOf = (d) => [d[1], -d[0]]

// 꺾은선을 진행 방향 왼쪽으로 off 만큼 옮김 (꼭짓점은 양옆 변의 왼쪽 방향을 더한 쪽으로, 꺾인 각에 맞춰 늘림)
function offsetPolyline(line, off) {
  const dirs = []
  for (let i = 1; i < line.length; i++) { const dx = line[i][0] - line[i - 1][0], dz = line[i][1] - line[i - 1][1], l = Math.hypot(dx, dz) || 1; dirs.push([dx / l, dz / l]) }
  return line.map((p, i) => {
    const a = leftOf(dirs[Math.max(0, i - 1)]), b = leftOf(dirs[Math.min(dirs.length - 1, i)])
    const mx = a[0] + b[0], mz = a[1] + b[1], ml = Math.hypot(mx, mz) || 1
    const k = off / Math.max(0.5, (mx / ml) * a[0] + (mz / ml) * a[1])
    return [p[0] + (mx / ml) * k, p[1] + (mz / ml) * k]
  })
}

// 꺾은선의 누적 길이 · 전체 길이
function measured(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, cum, len: cum.at(-1) }
}

// 꺾은선 위 거리 s 의 점과 진행 방향
function along(path, s) {
  const { pts, cum } = path
  const t = Math.max(0, Math.min(path.len, s))
  let i = 1
  while (i < pts.length - 1 && cum[i] < t) i++
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, u = (t - cum[i - 1]) / seg
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
  return { p: [a[0] + dx * u, a[1] + dz * u], d: [dx / l, dz / l] }
}

// 점 p 에서 꺾은선까지 가장 가까운 자리 (거리 · 그 자리의 s)
function nearestOn(path, p) {
  let best = { dist: Infinity, s: 0 }
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1], b = path.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
    const q = [a[0] + dx * u, a[1] + dz * u], dist = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (dist < best.dist) best = { dist, s: path.cum[i - 1] + Math.sqrt(l2) * u }
  }
  return best
}

// roads → 차로 목록 [{ road, pts, cum, len, next: { lane, s } | null, entry }] (entry = 바닥 판 가장자리에서 시작)
export function buildLanes(roads, half = PLOT / 2) {
  const lanes = []
  const atEdge = (p) => Math.abs(p[0]) >= half - 0.6 || Math.abs(p[1]) >= half - 0.6
  for (const r of roads) {
    if (r.kind !== 'car' || !r.line || r.width < MIN_ROAD_W) continue
    const push = (line) => lanes.push({ road: r.id, ...measured(line), next: null, entry: atEdge(line[0]) })
    if (r.oneway) {
      const n = Math.max(1, Math.min(4, Math.round(r.lanes ?? r.width / LANE_W)))
      const lw = r.width / n
      for (let i = 0; i < n; i++) push(offsetPolyline(r.line, (i - (n - 1) / 2) * lw))
    } else {
      push(offsetPolyline(r.line, r.width / 4))                 // 선 방향 — 왼쪽 차로
      push(offsetPolyline([...r.line].reverse(), r.width / 4))  // 반대 방향 — 그 방향의 왼쪽 차로
    }
  }
  // 교차로: 차로 끝에서 가까운 다른 차로의 자리로 이어 붙임 (남은 길이 2칸 넘고, 꺾는 각 100° 안 — 되돌아가지 않게)
  lanes.forEach((A) => {
    const end = A.pts.at(-1), dEnd = along(A, A.len).d
    let best = null
    lanes.forEach((B, j) => {
      if (B === A || B.road === A.road) return
      const n = nearestOn(B, end)
      if (n.dist > JOIN || B.len - n.s < 2) return
      const d = along(B, n.s).d
      const turn = Math.acos(Math.max(-1, Math.min(1, dEnd[0] * d[0] + dEnd[1] * d[1]))) * 180 / Math.PI
      if (turn > 100) return
      const score = n.dist + turn / 90
      if (!best || score < best.score) best = { score, lane: j, s: n.s }
    })
    A.next = best ? { lane: best.lane, s: best.s } : null
  })
  return lanes
}

// 처음 차 배치: 차로마다 spacing 칸 간격 (차로마다 시작 자리를 비킴) — 같은 차로의 차는 같은 속도라 서로 겹치지 않음
export function spawnCars(lanes, { spacing = 6 } = {}) {
  const cars = []
  lanes.forEach((l, i) => {
    const h = hash(`${l.road}:${i}`)
    const speed = 1.8 + (h % 5) * 0.09 // 칸/초 (≈ 36~43km/h — 시드니 도심 제한 40km/h 언저리)
    for (let s = ((h % 97) / 97) * spacing + 0.5; s < l.len - 1; s += spacing) {
      const k = hash(`${l.road}:${i}:${Math.round(s * 10)}`)
      cars.push({ id: cars.length, lane: i, s, speed, kind: KINDS[k % KINDS.length], color: COLORS[(k >> 3) % COLORS.length], trips: 0 })
    }
  })
  return cars
}

// dt 초만큼 앞으로: 차로 끝을 넘으면 이어지는 차로로, 없으면 판 가장자리 차로 중 하나로 다시 들어옴
export function advanceCar(car, dt, lanes) {
  car.s += car.speed * dt
  for (let guard = 0; guard < 8; guard++) {
    const l = lanes[car.lane]
    if (car.s <= l.len) return car
    const over = car.s - l.len
    if (l.next) { car.lane = l.next.lane; car.s = l.next.s + over; continue }
    const entries = lanes.map((x, i) => (x.entry ? i : -1)).filter((i) => i >= 0)
    car.trips += 1
    car.lane = entries.length ? entries[(car.id + car.trips) % entries.length] : car.lane
    car.s = Math.min(over, 0.5)
  }
  return car
}

// 차 한 대의 자리 · 방향(모형 앞 = +z 이므로 atan2(dx, dz)) · 크기(판 가장자리에서 줄였다 키움)
export function carPose(lanes, car) {
  const l = lanes[car.lane]
  const { p, d } = along(l, car.s)
  let scale = 1
  if (l.entry) scale = Math.min(scale, car.s)
  if (!l.next) scale = Math.min(scale, l.len - car.s)
  return { x: p[0], z: p[1], heading: Math.atan2(d[0], d[1]), scale: Math.max(0, Math.min(1, scale)) }
}

// ── 사람: Pitt St Mall 선 (조각이 여럿이면 가장 긴 것) ──
export function buildWalkPath(roads, name = 'Pitt Street Mall') {
  const runs = roads.filter((r) => r.kind === 'walk' && r.name === name && r.line && r.line.length >= 2).map((r) => ({ ...measured(r.line), width: r.width }))
  return runs.sort((a, b) => b.len - a.len)[0] ?? null
}

// 사람 count 명: 선 위 자리 · 걷는 방향(±1) · 옆으로 비킨 정도(폭의 ±60% 안) · 걸음 속도(≈1.2~1.7m/s)
export function spawnWalkers(path, { count = 14 } = {}) {
  if (!path) return []
  return Array.from({ length: count }, (_, i) => {
    const h = hash(`walker:${i}`)
    return {
      id: i, s: 0.4 + ((h % 1000) / 1000) * (path.len - 0.8), dir: h % 2 ? 1 : -1,
      off: (((h >> 10) % 1000) / 1000 - 0.5) * 1.2 * (path.width / 2),
      speed: 0.22 + ((h >> 4) % 9) * 0.012, phase: (h % 628) / 100, shirt: COLORS[(h >> 6) % COLORS.length],
    }
  })
}

export function advanceWalker(w, dt, path) {
  w.s += w.dir * w.speed * dt
  if (w.s > path.len - 0.3) { w.s = path.len - 0.3; w.dir = -1 }
  if (w.s < 0.3) { w.s = 0.3; w.dir = 1 }
  return w
}

// 사람 한 명의 자리 · 방향 · 걸음 출렁임(위아래 조금)
export function walkerPose(path, w) {
  const { p, d } = along(path, w.s)
  const n = leftOf(d)
  const fwd = w.dir > 0 ? d : [-d[0], -d[1]]
  return { x: p[0] + n[0] * w.off, z: p[1] + n[1] * w.off, heading: Math.atan2(fwd[0], fwd[1]), bob: Math.abs(Math.sin(w.phase + w.s * 9)) * 0.03 }
}
