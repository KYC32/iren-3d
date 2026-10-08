import { describe, expect, it } from 'vitest'
import { CAMPUS_LANDSCAPES, landscapePlants, terrainHeight } from './campusLandscape.js'
import { layoutCampus } from './layoutCampus.js'
import { buildInfra } from '../../scripts/build-data.mjs'

const sites = buildInfra().sites
describe('사진 참고 경관의 배치', () => {
  it.each(Object.keys(CAMPUS_LANDSCAPES))('%s: 식생이 부지·납품 도로·인입 전력선을 침범하지 않는다', id => {
    const layout = layoutCampus(sites.find(s => s.id === id)), profile = CAMPUS_LANDSCAPES[id]
    const plants = landscapePlants(id, layout.side, layout.road.z, layout.powerLine.from[1], profile)
    expect(plants.filter(p => p.type === 0)).toHaveLength(profile.trees)
    expect(plants.filter(p => p.type === 1)).toHaveLength(profile.shrubs)
    for (const p of plants) {
      expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeGreaterThanOrEqual(layout.side / 2 + 1.7)
      expect(Math.abs(p.z - layout.road.z)).toBeGreaterThanOrEqual(3.5)
      if (p.x < -layout.side / 2) expect(Math.abs(p.z - layout.powerLine.from[1])).toBeGreaterThanOrEqual(1.8)
      expect(p.y).toBeCloseTo(terrainHeight(p.x, p.z, layout.side, profile.relief))
    }
    expect(landscapePlants(id, layout.side, layout.road.z, layout.powerLine.from[1], profile)).toEqual(plants)
  })
})
