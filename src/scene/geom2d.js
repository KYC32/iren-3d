// =============================================================
// geom2d.js — 평면 도형 계산 (순수 함수 · geom2d.test.js)
// -------------------------------------------------------------
// 본사 동네(OSM 건물 윤곽·길)를 화면에 놓을 때 씀: hqCity.js(배치) · hqTower.js(본사 윤곽) · HqCity.jsx(바닥 그림)
// 점 = [x, z] (화면 바닥 좌표), 다각형(ring) = 점 목록 (첫 점을 끝에 다시 쓰지 않음)
// =============================================================

// 넓이 (부호 있음): x 를 오른쪽, z 를 위로 놓고 봤을 때 반시계면 +, 시계면 −
export function signedArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]
    a += x0 * z1 - x1 * z0
  }
  return a / 2
}

// 넓이 가운데 (꼭짓점이 한쪽에 몰려도 치우치지 않음)
export function centroid(ring) {
  let a = 0, cx = 0, cz = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]
    const c = x0 * z1 - x1 * z0
    a += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c
  }
  if (Math.abs(a) < 1e-12) return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
  return [cx / (3 * a), cz / (3 * a)]
}

// 점이 다각형 안에 있는지 (오른쪽으로 반직선을 그어 변을 몇 번 지나는지 셈 — 홀수면 안)
export function pointInRing([x, z], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

// 다각형을 축에 나란한 사각형 [x0,x1]×[z0,z1] 안만 남기고 자름 (Sutherland–Hodgman: 사각형의 네 변으로 차례로 자름)
export function clipRingToRect(ring, x0, x1, z0, z1) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => cutAt(a, b, 0, x0)], [(p) => p[0] <= x1, (a, b) => cutAt(a, b, 0, x1)],
    [(p) => p[1] >= z0, (a, b) => cutAt(a, b, 1, z0)], [(p) => p[1] <= z1, (a, b) => cutAt(a, b, 1, z1)],
  ]
  let out = ring
  for (const [inside, cut] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const cur = src[i], prev = src[(i + src.length - 1) % src.length]
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur) }
      else if (inside(prev)) out.push(cut(prev, cur))
    }
    if (!out.length) return []
  }
  return out
}
// 선분 a→b 가 k 축(0 = x, 1 = z) 값 v 를 지나는 점
function cutAt(a, b, k, v) {
  const t = (v - a[k]) / (b[k] - a[k])
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

// 꺾은선을 사각형 안만 남김 → 꺾은선 조각 목록 (사각형을 나갔다 다시 들어오면 조각이 여럿)
//   선분마다 들어가고 나가는 t 를 좁혀 감 (Liang–Barsky)
export function clipLineToRect(line, { x0, x1, z0, z1 }) {
  const runs = []
  let cur = null
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1]
    const dx = b[0] - a[0], dz = b[1] - a[1]
    let t0 = 0, t1 = 1, ok = true
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dz, a[1] - z0], [dz, z1 - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) { ok = false; break } continue }
      const r = q / p
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r)
      if (t0 > t1) { ok = false; break }
    }
    if (!ok) { if (cur) { runs.push(cur); cur = null } continue }
    const pa = [a[0] + dx * t0, a[1] + dz * t0], pb = [a[0] + dx * t1, a[1] + dz * t1]
    if (!cur) cur = [pa]
    cur.push(pb)
    if (t1 < 1) { runs.push(cur); cur = null } // 이 선분 중간에 사각형을 나감
  }
  if (cur) runs.push(cur)
  return runs.filter((r) => r.length >= 2)
}

// 선분 a→b 둘레 폭 w 의 직사각형 (도로 한 토막의 바닥 모양)
export function segmentQuad(a, b, w) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1
  const nx = (-dz / len) * (w / 2), nz = (dx / len) * (w / 2)
  return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]
}

// 점 p 에서 선분 a→b 까지 가장 가까운 거리
export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t))
}

// 두 선분이 서로의 안쪽에서 엇갈리는지 (끝점끼리 닿기만 하는 것은 셈하지 않음)
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d)
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))
}

// 점이 다각형 안쪽으로 tol 보다 깊이 들어가 있는지 (벽에 맞닿은 점은 '안'으로 치지 않음)
function deepInside(p, ring, tol) {
  if (!pointInRing(p, ring)) return false
  for (let i = 0; i < ring.length; i++) if (distToSegment(p, ring[i], ring[(i + 1) % ring.length]) < tol) return false
  return true
}

// 두 다각형이 겹치는지 (벽을 같이 쓰며 맞닿기만 하면 겹침 아님): 꼭짓점이 상대 안쪽 깊이 있거나, 변이 엇갈리거나
//   변 가운데 점도 봄 — 꼭짓점은 모두 벽 위인데 몸통이 겹치는 경우(같은 모양 두 개)를 잡으려고
export function ringsOverlap(a, b, tol = 0.05) {
  const probe = (r) => r.flatMap((p, i) => { const q = r[(i + 1) % r.length]; return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]] })
  if (probe(a).some((p) => deepInside(p, b, tol)) || probe(b).some((p) => deepInside(p, a, tol))) return true
  const ca = centroid(a), cb = centroid(b)
  if (deepInside(ca, b, tol) && pointInRing(ca, a)) return true
  if (deepInside(cb, a, tol) && pointInRing(cb, b)) return true
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
  }
  return false
}

// 선분 a→b 가 다각형을 지나는지 (끝점이 안에 있거나 변과 엇갈림) — 본사를 가리는 빌딩 고르기에 씀
export function segmentHitsRing(a, b, ring) {
  if (pointInRing(a, ring) || pointInRing(b, ring)) return true
  for (let i = 0; i < ring.length; i++) if (segmentsCross(a, b, ring[i], ring[(i + 1) % ring.length])) return true
  return false
}

// 윤곽을 바깥으로 d 만큼 부풀림 (꼭짓점마다 양옆 변의 바깥 방향을 더한 쪽으로 — 꺾인 각에 맞춰 길이를 늘림)
//   본사 IREN 층 둘레의 초록 빛 띠·옥상 난간처럼 벽에서 조금 떨어진 고리를 만들 때 씀
export function inflateRing(ring, d) {
  const s = signedArea(ring) > 0 ? 1 : -1 // 반시계면 바깥 = 변 방향의 오른쪽
  const n = ring.length
  const normal = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [(dz / l) * s, (-dx / l) * s] }
  return ring.map((p, i) => {
    const n1 = normal(ring[(i + n - 1) % n], p), n2 = normal(p, ring[(i + 1) % n])
    const mx = n1[0] + n2[0], mz = n1[1] + n2[1], ml = Math.hypot(mx, mz) || 1
    const k = d / Math.max(0.35, (mx / ml) * n1[0] + (mz / ml) * n1[1]) // 뾰족한 꼭짓점은 너무 멀리 튀지 않게
    return [p[0] + (mx / ml) * k, p[1] + (mz / ml) * k]
  })
}

// 겹친 점(거의 같은 자리)과 한 줄 위에 있는 점을 뺌 — 길이 0 인 벽·지붕 나누기 실패를 막음
export function cleanRing(ring, eps = 1e-6) {
  let pts = ring.filter((p, i) => { const q = ring[(i + ring.length - 1) % ring.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > eps })
  for (let changed = true; changed && pts.length > 3;) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], p = pts[i], b = pts[(i + 1) % pts.length]
      const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])
      if (Math.abs(cross) < eps * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]))) { pts = pts.filter((_, k) => k !== i); changed = true; break }
    }
  }
  return pts
}
