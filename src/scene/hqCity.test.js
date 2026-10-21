// 본사 3D 화면의 동네 배치 (hqCity.js) — 겹침 없음 · 본사 5층을 가리지 않음 · 가로수·가로등은 인도 위
import { describe, it, expect } from 'vitest'
import { hqCityLayout, ROAD_W } from './hqCity.js'
import { TOWER_W, TOWER_D, PLOT } from './hqTower.js'

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
