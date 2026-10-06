// layoutCampus 단위 테스트 — 실행: npm test
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { layoutCampus, blocksFor, ghostLotCount, BLOCK_MW } from './layoutCampus.js'

const data = JSON.parse(readFileSync(new URL('../../public/data/sites.json', import.meta.url), 'utf8'))
const site = (id) => data.sites.find((s) => s.id === id)

// 두 블록의 사각형이 겹치는지 검사하는 도우미
function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6
}

describe('blocksFor / ghostLotCount', () => {
  it('Horizon 1동(75MW gross)은 1블록', () => {
    expect(blocksFor({ gross_mw: 75 })).toBe(1)
  })
  it('아주 작은 건물도 최소 1블록', () => {
    expect(blocksFor({ gross_mw: 30 })).toBe(1)
  })
  it('남은 전력이 반 블록 미만이면 빈 부지 없음', () => {
    expect(ghostLotCount(BLOCK_MW * 0.4)).toBe(0)
  })
  it('빈 부지는 상한을 넘지 않음', () => {
    expect(ghostLotCount(100000)).toBeLessThanOrEqual(16)
  })
})

describe('layoutCampus — 실제 사이트 데이터', () => {
  for (const s of data.sites) {
    it(`${s.id}: 블록끼리 겹치지 않고 모두 부지 안에 있음`, () => {
      const L = layoutCampus(s)
      const half = L.side / 2
      for (const b of L.blocks) {
        expect(Math.abs(b.x) + b.w / 2).toBeLessThanOrEqual(half + 1e-6)
        expect(Math.abs(b.z) + b.d / 2).toBeLessThanOrEqual(half + 1e-6)
      }
      for (let i = 0; i < L.blocks.length; i++)
        for (let j = i + 1; j < L.blocks.length; j++)
          expect(overlaps(L.blocks[i], L.blocks[j])).toBe(false)
    })
  }

  it('Childress: Horizon 1이 첫 번째(가동) 블록, 채굴동은 5블록, 크레인은 건설중 건물 수만큼', () => {
    const L = layoutCampus(site('childress'))
    expect(L.blocks[0].buildingId).toBe('horizon-1')
    expect(L.blocks.filter((b) => b.buildingId === 'miners')).toHaveLength(5)
    const underConstruction = site('childress').buildings.filter((b) => b.status === 'under_construction')
    expect(L.cranes).toHaveLength(underConstruction.length)
    expect(L.trucks).toHaveLength(site('childress').deliveries.length)
  })

  it('Sweetwater 1: 1단계 4블록(300MW) + 남은 1,100MW 는 빈 부지', () => {
    const L = layoutCampus(site('sweetwater-1'))
    expect(L.blocks.filter((b) => b.buildingId === 'sw1-phase1')).toHaveLength(4)
    expect(L.remainingMw).toBe(1100)
    expect(L.ghostCount).toBeGreaterThan(0)
    expect(L.powerLine.energized).toBe(true)
  })

  it('Kiowa: 건물 없음 → 빈 부지만, 송전선은 미통전(점선)', () => {
    const L = layoutCampus(site('kiowa'))
    expect(L.blocks.every((b) => b.kind === 'lot')).toBe(true)
    expect(L.powerLine.energized).toBe(false)
  })

  it('Prince George: 액체냉각 확장(replaces)은 남은 전력 계산에서 제외', () => {
    const L = layoutCampus(site('prince-george'))
    expect(L.remainingMw).toBe(0)
    expect(L.ghostCount).toBe(0)
  })
})
