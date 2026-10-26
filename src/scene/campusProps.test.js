// campusProps 단위 테스트 — 캠퍼스 3D 소품(주차한 차·공사 장비)을 놓을 자리
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth } from '../data/timeline.js'
import { layoutCampus, campusStateAt } from './layoutCampus.js'
import { campusProps, PROP_SIZE } from './campusProps.js'

const infra = buildInfra()
const site = (id) => infra.sites.find((s) => s.id === id)
// 그 날짜의 화면 배치 (SiteView 가 쓰는 L = 고정 배치 + 날짜 상태)
const at = (id, month) => {
  const layout = layoutCampus(site(id))
  return { ...layout, ...campusStateAt(layout, site(id), toMonth(month)) }
}
// 소품 하나의 바닥 사각형 (rot 이 ±90° 면 길이·폭이 바뀜)
const rectOf = (p) => {
  const { w, l } = PROP_SIZE[p.kind]
  const turned = Math.abs(Math.sin(p.rot)) > 0.5
  return { x: p.x, z: p.z, w: turned ? l : w, d: turned ? w : l }
}
const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6
const inside = (r, half) => Math.abs(r.x) + r.w / 2 <= half && Math.abs(r.z) + r.d / 2 <= half
const ACTIVE = ['operating', 'delivered', 'commissioning', 'under_construction', 'decommissioning']

describe('주차장', () => {
  it('지금 쓰거나 짓는 건물이 없는 부지(계획만)는 주차장 없음', () => {
    expect(campusProps(at('kiowa', '2026-10')).parking).toBe(null)
  })
  it('차일드레스: 왼쪽 칸에서 변전소와 하역장 사이, 부지 판 안', () => {
    const L = at('childress', '2026-10')
    const { parking } = campusProps(L)
    expect(parking).not.toBe(null)
    expect(inside(parking, L.side / 2)).toBe(true)
    expect(overlaps(parking, L.substation)).toBe(false)
    expect(overlaps(parking, L.receiving)).toBe(false)
    expect(parking.z).toBeGreaterThan(L.substation.z)
    expect(parking.z).toBeLessThan(L.receiving.z)
    for (const b of L.blocks) expect(overlaps(parking, b)).toBe(false)
  })
  it('차는 주차장 안 칸마다 하나, 서로 겹치지 않음', () => {
    const { parking } = campusProps(at('childress', '2026-10'))
    const cars = parking.cars.map(rectOf)
    for (const c of cars) expect(Math.abs(c.x - parking.x) + c.w / 2 <= parking.w / 2 + 1e-6 && Math.abs(c.z - parking.z) + c.d / 2 <= parking.d / 2 + 1e-6).toBe(true)
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) expect(overlaps(cars[i], cars[j])).toBe(false)
  })
  it('차 수 = 2 + 쓰거나 짓는 건물 수 × 2, 칸 수(8)를 넘지 않음', () => {
    const L = at('childress', '2026-10')
    const active = L.blocks.filter((b) => b.isAnchor && !b.asLot && ACTIVE.includes(b.status)).length
    const { parking } = campusProps(L)
    expect(parking.cars).toHaveLength(Math.min(parking.stalls, 2 + active * 2))
    expect(parking.stalls).toBe(8)
  })
  it('같은 입력이면 같은 배치 (새로 그릴 때마다 차가 바뀌지 않음)', () => {
    expect(campusProps(at('childress', '2026-10'))).toEqual(campusProps(at('childress', '2026-10')))
  })
  it('왼쪽 칸이 좁은 작은 부지(커낼플랫츠)는 건물이 있어도 주차장을 만들지 않음', () => {
    const L = at('canal-flats', '2026-10')
    const live = { ...L, blocks: L.blocks.map((b) => (b.isAnchor ? { ...b, status: 'operating', asLot: false } : b)) }
    expect(campusProps(live).parking).toBe(null)
  })
})

describe('공사 현장 장비', () => {
  const L = at('childress', '2026-10')
  const building = L.blocks.filter((b) => b.isAnchor && !b.asLot && b.status === 'under_construction')
  const { construction } = campusProps(L)

  it('건설중 건물마다 굴착 트랙터 1 · 라바콘 2 · 자재 컨테이너 1', () => {
    expect(building.length).toBeGreaterThan(0)
    for (const b of building) {
      const mine = construction.filter((p) => p.buildingId === b.buildingId)
      expect(mine.filter((p) => p.kind === 'loader')).toHaveLength(1)
      expect(mine.filter((p) => p.kind === 'cone')).toHaveLength(2)
      expect(mine.filter((p) => p.kind === 'container')).toHaveLength(1)
    }
    expect(construction).toHaveLength(building.length * 4)
  })
  it('장비는 어느 블록과도 겹치지 않고 부지 판 안', () => {
    for (const p of construction) {
      const r = rectOf(p)
      expect(inside(r, L.side / 2)).toBe(true)
      for (const b of L.blocks) expect(overlaps(r, b)).toBe(false)
    }
  })
  it('납품 트럭이 건물 앞으로 들어오는 길(건물 가운데 ±0.6)은 비워 둠', () => {
    for (const p of construction) {
      const b = building.find((x) => x.buildingId === p.buildingId)
      const r = rectOf(p)
      if (r.z > b.z + b.d / 2) expect(Math.abs(r.x - b.x) - r.w / 2).toBeGreaterThanOrEqual(0.6 - 1e-6)
    }
  })
  it('크레인과 겹치지 않음 (크레인 기둥 0.28칸)', () => {
    for (const p of construction) for (const c of L.cranes) expect(overlaps(rectOf(p), { x: c.x, z: c.z, w: 0.28, d: 0.28 })).toBe(false)
  })
  it('keep 으로 고객 구역을 고르면 그 건물의 장비만', () => {
    const one = building[0].buildingId
    const kept = campusProps(L, { keep: (id) => id === one }).construction
    expect(kept.length).toBe(4)
    expect(kept.every((p) => p.buildingId === one)).toBe(true)
  })
  it('계획만 있는 부지는 장비 없음', () => {
    expect(campusProps(at('kiowa', '2026-10')).construction).toEqual([])
  })
})
