import { describe, it, expect } from 'vitest'
import { rackGrid } from './rackLayout.js'

describe('데이터홀 랙 배치 (rackGrid)', () => {
  it.each([1, 7, 87, 348, 800])('랙 %i 개가 모두 벽 안에, 서로 겹치지 않게', (n) => {
    const w = 4, d = 6, wall = 0.3
    const g = rackGrid(w, d, n, wall)
    expect(g.racks).toHaveLength(n)
    const s = g.size
    expect(s).toBeGreaterThan(0)
    for (const r of g.racks) {
      expect(Math.abs(r.x) + s).toBeLessThanOrEqual(w / 2 - wall + 1e-9) // 깊이 2s → 중심에서 ±s
      expect(Math.abs(r.z) + s / 2).toBeLessThanOrEqual(d / 2 - wall + 1e-9)
    }
    // 같은 줄 안에서는 폭(s) 이상 떨어짐, 다른 줄은 깊이(2s) 이상 떨어짐
    const byRow = new Map()
    for (const r of g.racks) byRow.set(r.row, [...(byRow.get(r.row) ?? []), r])
    const xs = [...byRow.values()].map((list) => list[0].x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(2 * s - 1e-9)
    for (const list of byRow.values()) {
      const zs = list.map((r) => r.z).sort((a, b) => a - b)
      for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(s - 1e-9)
    }
  })
  it('랙이 많을수록 작아짐, 짝을 이룬 두 줄은 앞면이 서로 반대(바깥 차가운 통로 쪽)', () => {
    const few = rackGrid(4, 6, 50), many = rackGrid(4, 6, 600)
    expect(many.size).toBeLessThan(few.size)
    expect(many.racks.find((r) => r.row === 0).face).toBe(-1)
    expect(many.racks.find((r) => r.row === 1).face).toBe(1)
  })
  it('0개거나 블록이 너무 작으면 빈 배치', () => {
    expect(rackGrid(4, 6, 0).racks).toEqual([])
    expect(rackGrid(0.5, 0.5, 10).racks).toEqual([])
  })
})
