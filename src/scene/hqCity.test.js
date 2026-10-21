// 본사 3D 화면의 동네 배치 (hqCity.js) — 겹침 없음 · 본사 5층을 가리지 않음 · 가로수·가로등은 인도 위
import { describe, it, expect } from 'vitest'
import { hqCityLayout, ROAD_W, occludersOf, towerTargets } from './hqCity.js'
import { TOWER_W, TOWER_D, PLOT, hqTower } from './hqTower.js'

const L = hqCityLayout()
const box = (b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 })
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
const HQ = { x0: -TOWER_W / 2, x1: TOWER_W / 2, z0: -TOWER_D / 2, z1: TOWER_D / 2 }
const roadBoxes = L.roads.map((r) => r.axis === 'x'
  ? { x0: -PLOT / 2, x1: PLOT / 2, z0: r.at - ROAD_W / 2, z1: r.at + ROAD_W / 2 }
  : { x0: r.at - ROAD_W / 2, x1: r.at + ROAD_W / 2, z0: -PLOT / 2, z1: PLOT / 2 })
const inside = (p, b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1

describe('이웃 건물', () => {
  it('본사·도로·서로와 겹치지 않고 바닥 판 안에 있음', () => {
    const bs = L.buildings.map(box)
    for (const [i, b] of bs.entries()) {
      expect(overlap(b, HQ)).toBe(false)
      for (const r of roadBoxes) expect(overlap(b, r)).toBe(false)
      for (const o of bs.slice(i + 1)) expect(overlap(b, o)).toBe(false)
      expect(b.x0 >= -PLOT / 2 && b.x1 <= PLOT / 2 && b.z0 >= -PLOT / 2 && b.z1 <= PLOT / 2).toBe(true)
    }
  })
  // 카메라는 (+x, +z) 쪽 위에서 내려다봄: 화면 가로 = (x − z)/√2, 카메라 쪽으로 가까울수록 x + z 가 큼
  it('카메라와 본사 사이(화면에서 본사와 겹치는 앞쪽)의 건물은 낮음 — 5층(IREN)을 가리지 않게', () => {
    const hqScreen = [-(TOWER_W + TOWER_D) / 2 / Math.SQRT2, (TOWER_W + TOWER_D) / 2 / Math.SQRT2]
    for (const b of L.buildings) {
      const c = box(b)
      const xs = [[c.x0, c.z0], [c.x0, c.z1], [c.x1, c.z0], [c.x1, c.z1]].map(([x, z]) => (x - z) / Math.SQRT2)
      const near = Math.max(...[[c.x0, c.z0], [c.x0, c.z1], [c.x1, c.z0], [c.x1, c.z1]].map(([x, z]) => x + z))
      const screenOverlap = Math.min(...xs) < hqScreen[1] && Math.max(...xs) > hqScreen[0]
      if (screenOverlap && near > TOWER_W) expect(b.h).toBeLessThanOrEqual(2.6)
    }
  })
  it('화면에서 본사와 겹치는 뒤쪽 빌딩은 본사 옥상(13.8)보다 낮음 — 본사가 하늘을 배경으로 돋보이게', () => {
    const hqScreen = [-(TOWER_W + TOWER_D) / 2 / Math.SQRT2, (TOWER_W + TOWER_D) / 2 / Math.SQRT2]
    for (const b of L.buildings) {
      const c = box(b)
      const xs = [[c.x0, c.z0], [c.x0, c.z1], [c.x1, c.z0], [c.x1, c.z1]].map(([x, z]) => (x - z) / Math.SQRT2)
      const behind = Math.min(...[[c.x0, c.z0], [c.x0, c.z1], [c.x1, c.z0], [c.x1, c.z1]].map(([x, z]) => x + z)) < 0
      if (behind && Math.min(...xs) < hqScreen[1] && Math.max(...xs) > hqScreen[0]) expect(b.h).toBeLessThan(13)
    }
  })
  it('건물 모양이 여러 가지 (같은 상자만 늘어놓지 않음)', () => {
    expect(new Set(L.buildings.map((b) => b.style)).size).toBeGreaterThanOrEqual(3)
    expect(L.buildings.length).toBeGreaterThanOrEqual(7)
  })
})

describe('공원', () => {
  it('공원은 블록 안, 건물·본사와 겹치지 않음 · 공원 나무는 공원 안', () => {
    expect(L.parks.length).toBeGreaterThan(0)
    for (const pk of L.parks) {
      expect(L.blocks.some((k) => pk.x0 >= k.x0 && pk.x1 <= k.x1 && pk.z0 >= k.z0 && pk.z1 <= k.z1)).toBe(true)
      for (const b of L.buildings) expect(overlap(pk, box(b))).toBe(false)
      expect(overlap(pk, HQ)).toBe(false)
    }
    expect(L.parkTrees.length).toBeGreaterThan(0)
    for (const t of L.parkTrees) expect(L.parks.some((pk) => inside(t, pk))).toBe(true)
  })
})

describe('가로수 · 가로등 · 자동차', () => {
  it('가로수·가로등은 인도 위 (도로·건물·본사 위가 아님)', () => {
    for (const p of [...L.trees, ...L.lamps]) {
      expect(L.walks.some((w) => inside(p, w))).toBe(true)
      for (const r of roadBoxes) expect(inside(p, r)).toBe(false)
      for (const b of L.buildings) expect(inside(p, box(b))).toBe(false)
      expect(inside(p, HQ)).toBe(false)
    }
    expect(L.trees.length).toBeGreaterThanOrEqual(12)
    expect(L.lamps.length).toBeGreaterThanOrEqual(6)
  })
  it('자동차는 도로 위', () => {
    expect(L.cars.length).toBeGreaterThan(0)
    for (const c of L.cars) expect(roadBoxes.some((r) => inside(c, r))).toBe(true)
  })
  it('횡단보도는 두 도로가 만나는 모퉁이 가까이', () => {
    expect(L.crossings.length).toBeGreaterThanOrEqual(2)
    for (const c of L.crossings) expect(Math.hypot(c.x - L.corner.x, c.z - L.corner.z)).toBeLessThan(ROAD_W * 2)
  })
})

// 돌려 볼 때 본사(특히 5층)를 가리는 이웃 건물은 흐리게 — 그 건물을 고르는 계산
describe('본사를 가리는 이웃 건물', () => {
  const T = hqTower({ floors: 20, level: 5 })
  const targets = towerTargets(T)
  // 카메라 위치: 본사 화면 기본 구도와 같은 높이 각도(campusFrameBox 의 [1, 1.05, 1])로, (dx, dz) 쪽에서 거리 60
  const camAt = (dx, dz, dist = 60) => {
    const l = Math.hypot(dx, 1.05, dz), cy = (T.box.y0 + T.box.y1) / 2
    return [dx / l * dist, cy + 1.05 / l * dist, dz / l * dist]
  }
  const at = (x, z) => L.buildings.findIndex((b) => b.x === x && b.z === z)

  it('기본 구도(앞 오른쪽 위)에서는 가리는 건물이 없음 — 배치가 처음 화면을 지킴', () => {
    expect(occludersOf(camAt(1, 1), L.buildings, targets)).toEqual([])
  })
  it('뒤에서 보면 본사 뒤쪽의 높은 빌딩이 5층을 가림', () => {
    expect(occludersOf(camAt(-1, -1), L.buildings, targets)).toContain(at(-8.8, -9.6))
  })
  it('시선에서 옆으로 비켜 있는 건물은 고르지 않음', () => {
    expect(occludersOf(camAt(-1, -1), L.buildings, targets)).not.toContain(at(13.0, -0.6))
  })
  it('로비 높이만 가리는 낮은 건물은 그대로, 5층을 가리는 높은 건물만 고름', () => {
    const low = { x: 7, z: 7, w: 3, d: 3, h: 0.9 }, tall = { x: 7, z: 7, w: 3, d: 3, h: 9 }
    expect(occludersOf(camAt(1, 1), [low], targets)).toEqual([])
    expect(occludersOf(camAt(1, 1), [tall], targets)).toEqual([0])
  })
  it('과녁 점은 5층(IREN) 높이부터 옥상 아래까지, 카메라 쪽 벽만 셈', () => {
    const irenMid = 0.12 + T.iren.y + T.iren.h / 2
    for (const t of targets) {
      expect(t.p[1]).toBeGreaterThanOrEqual(irenMid - 1e-9)
      expect(t.p[1]).toBeLessThanOrEqual(0.12 + T.roof.y)
    }
    // 뒤 벽 앞에만 있는 건물(카메라 반대쪽)은 앞에서 볼 때 고르지 않음
    const behind = { x: 0, z: -7, w: 4, d: 3, h: 30 }
    expect(occludersOf(camAt(1, 1), [behind], targets)).toEqual([])
  })
})
