// layoutCampus 단위 테스트 — 실행: npm test
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth } from '../data/timeline.js'
import { layoutCampus, campusStateAt, blocksFor, ghostLotCount, blockMwFor, BLOCK_MW, MAX_BLOCKS } from './layoutCampus.js'

const infra = buildInfra()
const site = (id) => infra.sites.find((s) => s.id === id)
const M = (s) => toMonth(s)
const asOf = M(infra.as_of.slice(0, 7))

// 두 블록의 사각형이 겹치는지
function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6
}

describe('blocksFor / ghostLotCount / blockMwFor', () => {
  it('Horizon 1동(75MW gross)은 1블록', () => expect(blocksFor({ gross_mw: 75 })).toBe(1))
  it('아주 작은 건물도 최소 1블록', () => expect(blocksFor({ gross_mw: 30 })).toBe(1))
  it('IT 만 있으면 ×1.3 으로 블록 계산', () => expect(blocksFor({ it_mw: 115 })).toBe(2))
  it('남은 전력이 반 블록 미만이면 빈 부지 없음', () => expect(ghostLotCount(BLOCK_MW * 0.4)).toBe(0))
  it('빈 부지는 상한을 넘지 않음', () => expect(ghostLotCount(100000)).toBeLessThanOrEqual(16))
  it('기가와트급 가짜 사이트는 블록 1칸 MW 를 키워 28칸 안에', () => {
    const giga = { power: [{ secured_mw: 5000 }], buildings: [{ gross_mw: 2000, phases: [] }, { gross_mw: 1500, phases: [] }] }
    const mw = blockMwFor(giga)
    expect(mw).toBeGreaterThan(75)
    expect(blocksFor(giga.buildings[0], mw) + blocksFor(giga.buildings[1], mw) + ghostLotCount(1500, mw)).toBeLessThanOrEqual(MAX_BLOCKS)
  })
})

describe('layoutCampus — 실제 사이트 데이터', () => {
  for (const s of infra.sites) {
    const L = layoutCampus(s)
    it(`${s.id}: 블록 ≤ ${MAX_BLOCKS}, 서로 안 겹치고 모두 부지 안`, () => {
      expect(L.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS)
      const half = L.side / 2
      for (const b of L.blocks) {
        expect(Math.abs(b.x) + b.w / 2).toBeLessThanOrEqual(half + 1e-6)
        expect(Math.abs(b.z) + b.d / 2).toBeLessThanOrEqual(half + 1e-6)
      }
      for (let i = 0; i < L.blocks.length; i++)
        for (let j = i + 1; j < L.blocks.length; j++) expect(overlaps(L.blocks[i], L.blocks[j])).toBe(false)
    })
    it(`${s.id}: 2024~2028 어느 날짜에도 블록 위치·개수가 그대로`, () => {
      const ref = L.blocks.map((b) => `${b.key}@${b.x},${b.z}`)
      for (let m = M('2024-01'); m <= M('2028-12'); m += 3) {
        const S = campusStateAt(L, s, m)
        expect(S.blocks.map((b) => `${b.key}@${b.x},${b.z}`)).toEqual(ref)
      }
    })
    it(`${s.id}: 건물이 없으면 빈 부지가 1칸 이상`, () => {
      if (s.buildings.length === 0) expect(L.lotCount).toBeGreaterThanOrEqual(1)
    })
  }

  it('Childress: 기준일에 Horizon 1 가동, Horizon 3 건설중(크레인), 채굴동 5블록 폐쇄중', () => {
    const s = site('childress')
    const S = campusStateAt(layoutCampus(s), s, asOf)
    const h1 = S.blocks.find((b) => b.buildingId === 'horizon-1')
    expect(h1.status).toBe('operating')
    expect(S.blocks.find((b) => b.buildingId === 'horizon-3').status).toBe('under_construction')
    expect(S.blocks.filter((b) => b.buildingId === 'miners' && b.status === 'decommissioning')).toHaveLength(5)
    expect(S.cranes.length).toBeGreaterThan(0)
  })

  it('Childress: 2024년에는 Horizon 건물이 아직 없어 빈 부지 모습', () => {
    const s = site('childress')
    const S = campusStateAt(layoutCampus(s), s, M('2024-06'))
    expect(S.blocks.filter((b) => b.buildingId?.startsWith('horizon')).every((b) => b.asLot)).toBe(true)
  })

  it('Childress: 2027년 채굴동은 사라져 빈 부지 모습', () => {
    const s = site('childress')
    const S = campusStateAt(layoutCampus(s), s, M('2027-03'))
    expect(S.blocks.filter((b) => b.buildingId === 'miners').every((b) => b.asLot)).toBe(true)
  })

  it('Sweetwater 1: 2025년엔 변전소 미통전, 2026-06 부터 통전', () => {
    const s = site('sweetwater-1')
    const L = layoutCampus(s)
    expect(campusStateAt(L, s, M('2025-06')).powerLine.energized).toBe(false)
    expect(campusStateAt(L, s, M('2026-06')).powerLine.energized).toBe(true)
  })
})
