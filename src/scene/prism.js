// =============================================================
// prism.js — 다각형 기둥 모양 (윤곽을 위로 세운 벽 + 지붕) · 바닥 다각형 묶음 — 본사·이웃 빌딩·길 바닥 그림이 씀
// -------------------------------------------------------------
// prismGeometry(ring, y0, y1): 그룹 0 = 벽, 그룹 1 = 지붕 → 재질 두 개 [창문 그림, 지붕 색] 로 그림
//   벽 UV 는 창문 그림 한 칸(facade.js 의 TILE_W × TILE_H) 단위: 가로 = 둘레를 따라 잰 거리, 세로 = 바닥에서 높이
//   → 창문 그림 재질은 반복 1×1 로 만들면 됨 (facadeMaterial(style, TILE_W, TILE_H, …)) · 모서리를 돌아도 창문이 이어짐
// flatGeometry(rings, y): 바닥 다각형(아스팔트·보도·횡단보도…) 여러 개를 위를 보는 삼각형 한 묶음으로 (그리기 1번)
// 윤곽 방향(시계·반시계)은 상관없음 — 안에서 바깥을 보도록 맞춤. 점 = [x, z] (화면 바닥 좌표)
// =============================================================
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three'
import { signedArea, cleanRing } from './geom2d.js'
import { TILE_W, TILE_H } from './facade.js'

// 윤곽 하나의 벽 삼각형을 pos·uv 에 더함. outward = 이 고리의 바깥(솔리드 밖)이 어느 쪽인지 (구멍은 안쪽이 바깥)
function pushWalls(ring, y0, y1, pos, uv, { u0 = 0, v0 = 0, hole = false } = {}) {
  // 벽 (a→b, 아래 A·B, 위 C·D) 의 삼각형 (A,B,C)(A,C,D) 법선은 (−dz, 0, dx) 쪽 → 시계 윤곽이면 그쪽이 바깥
  const cw = signedArea(ring) < 0
  const r = cw !== hole ? ring : [...ring].reverse()
  let acc = u0
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ua = acc / TILE_W, ub = (acc + len) / TILE_W, va = v0, vb = v0 + (y1 - y0) / TILE_H
    const A = [a[0], y0, a[1]], B = [b[0], y0, b[1]], C = [b[0], y1, b[1]], D = [a[0], y1, a[1]]
    pos.push(...A, ...B, ...C, ...A, ...C, ...D)
    uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb)
    acc += len
  }
}

// 다각형(+구멍)을 삼각형으로 나눠 높이 y 의 위를 보는 면으로 더함
function pushCap(ring, holes, y, pos, uv) {
  const contour = ring.map(([x, z]) => new Vector2(x, z))
  const hs = holes.map((h) => h.map(([x, z]) => new Vector2(x, z)))
  const pts = [contour, ...hs].flat()
  for (const [i, j, k] of ShapeUtils.triangulateShape(contour, hs)) {
    let a = pts[i], b = pts[j], c = pts[k]
    // 위를 보려면 (x 오른쪽 · z 위로 놓고 볼 때) 시계 방향 삼각형 — 반시계면 두 점을 바꿈
    if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0) [b, c] = [c, b]
    for (const p of [a, b, c]) { pos.push(p.x, y, p.y); uv.push(p.x / TILE_W, p.y / TILE_W) }
  }
}

export function prismGeometry(ring, y0, y1, { holes = [], u0 = 0, v0 = 0, roof = true } = {}) {
  const outer = cleanRing(ring)
  const inner = holes.map((h) => cleanRing(h)).filter((h) => h.length >= 3)
  const pos = [], uv = []
  pushWalls(outer, y0, y1, pos, uv, { u0, v0 })
  for (const h of inner) pushWalls(h, y0, y1, pos, uv, { u0, v0, hole: true })
  const wallCount = pos.length / 3
  if (roof && outer.length >= 3) pushCap(outer, inner, y1, pos, uv)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals() // 꼭짓점을 나눠 쓰지 않아 면마다 평평한 법선
  g.addGroup(0, wallCount, 0)
  if (pos.length / 3 > wallCount) g.addGroup(wallCount, pos.length / 3 - wallCount, 1)
  g.computeBoundingSphere()
  return g
}

export function flatGeometry(rings, y) {
  const pos = [], uv = []
  for (const r of rings) { const c = cleanRing(r); if (c.length >= 3) pushCap(c, [], y, pos, uv) }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
