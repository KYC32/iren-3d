import { describe, expect, it } from 'vitest'
import { CAMPUS_LANDSCAPES, inKangarooHabitat, landscapePlants, terrainHeight } from './campusLandscape.js'
import { kangarooPose } from './kangarooMotion.js'
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
      if (profile.kangaroos) expect(inKangarooHabitat(p.x, p.z, layout.side)).toBe(false)
    }
    expect(landscapePlants(id, layout.side, layout.road.z, layout.powerLine.from[1], profile)).toEqual(plants)
  })
  it('캐나다 세 캠퍼스에 단풍나무를 섞고 기존 나무 위치를 유지한다', () => {
    for (const id of ['prince-george','mackenzie','canal-flats']) {
      const layout = layoutCampus(sites.find(s => s.id === id)), profile = CAMPUS_LANDSCAPES[id]
      const args = [id,layout.side,layout.road.z,layout.powerLine.from[1]]
      const trees = landscapePlants(...args,profile).filter(p=>p.type===0)
      const before = landscapePlants(...args,{...profile,maples:false}).filter(p=>p.type===0)
      expect(trees.filter(p=>p.species==='maple').length).toBeGreaterThan(0)
      expect(trees.filter(p=>p.species==='conifer').length).toBeGreaterThan(trees.length / 2)
      expect(trees.map(p=>[p.x,p.z])).toEqual(before.map(p=>[p.x,p.z]))
    }
  })
  it('캥거루는 부지와 도로 바깥의 빈 공간에서 지면 위로 뛴다', () => {
    const layout = layoutCampus(sites.find(s=>s.id==='bundey')), profile = CAMPUS_LANDSCAPES.bundey
    const heights = []
    for (let t = 0; t < 40; t += .1) for (let index = 0; index < 3; index++) {
      const p = kangarooPose(t,index,layout.side,profile.relief)
      expect(p.z - layout.side / 2).toBeGreaterThan(3)
      expect(p.z - layout.road.z).toBeGreaterThan(layout.road.depth / 2 + 3)
      expect(p.y).toBeGreaterThanOrEqual(p.ground)
      expect(inKangarooHabitat(p.x,p.z,layout.side)).toBe(true)
      heights.push(p.y-p.ground)
    }
    expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(.6)
    expect(kangarooPose(4,0,layout.side,profile.relief)).not.toEqual(kangarooPose(0,0,layout.side,profile.relief))
  })
  it('모션 감소 설정에서는 위치와 자세가 고정된다', () => {
    for (let i=0;i<3;i++) expect(kangarooPose(20,i,44,.22,true)).toEqual(kangarooPose(0,i,44,.22,true))
  })
})
