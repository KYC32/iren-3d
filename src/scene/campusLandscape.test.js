import { describe, expect, it } from 'vitest'
import { CAMPUS_LANDSCAPES, contourSegments, inKangarooHabitat, inLonghornPasture, landscapePlants, realRelief, terrainHeight } from './campusLandscape.js'
import { groundY, reliefFloorY, roadStrip, roadY, withRealTerrain } from './campusTerrain.js'
import { kangarooPose } from './kangarooMotion.js'
import { longhornPose } from './longhornMotion.js'
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
      if (profile.longhorns && p.type < 2) expect(inLonghornPasture(p.x, p.z, layout.side)).toBe(false)
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
    for (let i=0;i<2;i++) expect(longhornPose(150,i,44,.22,true)).toEqual(longhornPose(0,i,44,.22,true))
  })
  it('텍사스 캠퍼스에만 롱혼·메스키트·가시배선인장을 적용한다', () => {
    for (const site of sites) {
      const profile = CAMPUS_LANDSCAPES[site.id]
      const texas = site.admin1 === 'US-TX'
      expect(Boolean(profile?.longhorns)).toBe(texas)
      if (!profile) continue
      const layout = layoutCampus(site)
      const plants = landscapePlants(site.id,layout.side,layout.road.z,layout.powerLine.from[1],profile)
      expect(plants.some(p=>p.species==='mesquite')).toBe(texas)
      expect(plants.some(p=>p.species==='prickly-pear')).toBe(texas)
    }
  })
  it.each(['childress','sweetwater-1','sweetwater-2'])('%s: 롱혼이 도로·부지·서로를 침범하지 않고 지면을 따라 걷는다', id => {
    const layout = layoutCampus(sites.find(s=>s.id===id)), profile = CAMPUS_LANDSCAPES[id]
    for (let t=0;t<192;t+=.25) {
      const pair = [0,1].map(i=>longhornPose(t,i,layout.side,profile.relief))
      for (const p of pair) {
        expect(p.z-layout.side/2).toBeGreaterThan(3)
        expect(p.z-layout.road.z).toBeGreaterThan(layout.road.depth/2+3)
        expect(p.y).toBeCloseTo(terrainHeight(p.x,p.z,layout.side,profile.relief)+.06)
        expect(inLonghornPasture(p.x,p.z,layout.side)).toBe(true)
        expect(Math.hypot(p.x,p.z)+2).toBeLessThan(layout.side*.95)
      }
      expect(Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z)).toBeGreaterThan(5)
    }
  })
  it('풀을 뜯을 때는 제자리에 서고 걷기 주기가 바뀌어도 자세가 튀지 않는다', () => {
    const pose = t=>longhornPose(t,0,37.2,.22)
    expect([pose(10).x,pose(10).z,pose(10).stride]).toEqual([pose(16).x,pose(16).z,0])
    expect(pose(36).x).not.toBeCloseTo(pose(10).x)
    for (const boundary of [24,48,72,96]) {
      const before=pose(boundary-.0001), after=pose(boundary+.0001)
      for (const key of ['x','y','z','head','stride','tail']) expect(before[key]).toBeCloseTo(after[key],3)
      expect(Math.sin(before.heading)).toBeCloseTo(Math.sin(after.heading),3)
      expect(Math.cos(before.heading)).toBeCloseTo(Math.cos(after.heading),3)
    }
  })
})

describe('실측 지형 격자', () => {
  // 2×2 격자: 왼쪽 0 m, 오른쪽 10 m (dm 단위 0·100), 한 변 200 m, 1칸 = 10 m → 장면 좌표 -10 ~ 10
  const slope = { cols: 2, half_m: 100, m_per_unit: 10, dm: [0, 100, 0, 100] }
  it('realRelief: 미터 높이를 칸으로 바꾸고 배율을 곱함 · 사이 값은 보간', () => {
    const relief = realRelief(slope, 2)
    expect(relief(-10, 0)).toBeCloseTo(0)
    expect(relief(10, 0)).toBeCloseTo(2)    // 10 m ÷ 10 m/칸 × 2배
    expect(relief(0, 0)).toBeCloseTo(1)     // 가운데 = 5 m
  })
  it('realRelief: 격자 밖 좌표는 가장자리 값으로 고정', () => {
    expect(realRelief(slope, 1)(99, 0)).toBeCloseTo(1)
    expect(realRelief(slope, 1)(-99, 0)).toBeCloseTo(0)
  })
  it('contourSegments: 5 m 등고선은 격자 가운데를 남북으로 가로지름', () => {
    const lines = contourSegments({ ...slope, dm: [20, 80, 20, 80] }, 5)   // 왼쪽 2 m, 오른쪽 8 m
    expect(lines).toHaveLength(1)
    const [x1, z1, x2, z2, h] = lines[0]
    expect(h).toBe(5)
    expect(x1).toBeCloseTo(0)
    expect(x2).toBeCloseTo(0)
    expect(Math.abs(z2 - z1)).toBeCloseTo(20)
  })
  it('contourSegments: 평평한 땅엔 등고선이 없음', () => {
    expect(contourSegments({ ...slope, dm: [12, 12, 12, 12] }, 5)).toHaveLength(0)
  })
  it('realRelief: pad_dm 이 있으면 부지 둘레를 0 으로 두고 더 낮은 땅은 음수', () => {
    const relief = realRelief({ ...slope, pad_dm: 50 }, 2)
    expect(relief(-10, 0)).toBeCloseTo(-1)
    expect(relief(10, 0)).toBeCloseTo(1)
  })
  it('reliefFloorY: 장면 바닥은 가장 낮은 땅보다 아래에 둠', () => {
    expect(reliefFloorY(slope, 2)).toBeCloseTo(-.32)   // 내려가는 땅이 없으면 기본 높이
    expect(reliefFloorY({ ...slope, pad_dm: 50 }, 2)).toBeCloseTo(-1.32)
  })
  it('groundY: 부지 판 위는 0, 밖은 지형 높이', () => {
    const relief = () => 1
    expect(groundY(0, 0, 40, relief)).toBe(0)
    expect(groundY(40, 0, 40, relief)).toBeCloseTo(.72)
  })
  it('roadY: 트럭 출발점까지 평평하고 멀어지면 지형 위로 내려앉음', () => {
    const relief = () => -1
    expect(roadY(0, 0, 40, relief)).toBeCloseTo(.03)
    expect(roadY(27, 0, 40, relief)).toBeCloseTo(.03)     // 부지 끝 + 7칸
    expect(roadY(-40, 0, 40, relief)).toBeCloseTo(-1.28 + .05)
    expect(roadY(30, 0, 40, relief)).toBeLessThan(.03)
    expect(roadY(30, 0, 40, relief)).toBeGreaterThan(-1.23)
  })
  it('roadStrip: 도로 띠와 점선은 부지 앞을 지나고 가장자리에서 사라짐', () => {
    const { rows, dashes } = roadStrip(40, 17, 3, () => 0)
    expect(rows[0].x).toBeLessThan(-40)
    expect(rows.at(-1).x).toBeGreaterThan(40)
    expect(rows.find(r => r.x === 0).alpha).toBe(1)
    expect(rows[0].alpha).toBeLessThan(.5)
    expect(dashes.length).toBeGreaterThan(30)
    for (const r of rows) expect(r.north).toBeCloseTo(roadY(r.x, 15.5, 40, () => 0))
  })
  it('Sweetwater 1: 부지 둘레 기준 높이로 오르내리고 도로 끝·첫 송전탑이 묻히지 않음', () => {
    const layout = layoutCampus(sites.find(s => s.id === 'sweetwater-1'))
    const profile = withRealTerrain('sweetwater-1', CAMPUS_LANDSCAPES['sweetwater-1'])
    const { side, road, powerLine } = layout, { relief } = profile
    expect(terrainHeight(layout.gate.x + 6, road.z, side, relief)).toBeCloseTo(-.28)
    let lowest = Infinity, highest = -Infinity
    for (let x = -60; x <= 60; x += 2) for (let z = -60; z <= 60; z += 2) {
      const y = terrainHeight(x, z, side, relief)
      lowest = Math.min(lowest, y); highest = Math.max(highest, y)
    }
    expect(lowest).toBeLessThan(-.6)                    // 동남쪽은 실제로 부지보다 낮음
    expect(highest).toBeGreaterThan(.6)
    expect(lowest).toBeGreaterThan(profile.floorY)      // 바닥이 땅을 가리면 안 됨
    const tower = groundY(powerLine.from[0], powerLine.from[1], side, relief)
    expect(tower).toBeCloseTo(terrainHeight(powerLine.from[0], powerLine.from[1], side, relief))
  })
  it('Kiowa: 언덕은 솟고 도로 끝·첫 송전탑은 땅 위에 있으며 등고선은 5 m 간격', () => {
    const layout = layoutCampus(sites.find(s => s.id === 'kiowa'))
    const profile = withRealTerrain('kiowa', CAMPUS_LANDSCAPES.kiowa)
    const { side, road, powerLine } = layout, { relief } = profile
    expect(profile.contourM).toBe(5)
    expect(CAMPUS_LANDSCAPES.kiowa.terrain_ko).toContain('5 m')
    expect(terrainHeight(layout.gate.x + 6, road.z, side, relief)).toBeCloseTo(-.28)
    let lowest = Infinity, highest = -Infinity
    for (let x = -60; x <= 60; x += 2) for (let z = -60; z <= 60; z += 2) {
      const y = terrainHeight(x, z, side, relief)
      lowest = Math.min(lowest, y); highest = Math.max(highest, y)
    }
    expect(highest).toBeGreaterThan(1.5)                // 언덕이 부지보다 확실히 높음
    expect(lowest).toBeGreaterThan(profile.floorY)      // 바닥이 땅을 가리면 안 됨
    const tower = groundY(powerLine.from[0], powerLine.from[1], side, relief)
    expect(tower).toBeCloseTo(terrainHeight(powerLine.from[0], powerLine.from[1], side, relief))
  })
  it('Sweetwater 2 는 Sweetwater 1 의 실측 지형 문구를 물려받지 않음', () => {
    expect(CAMPUS_LANDSCAPES['sweetwater-1'].terrain_ko).toContain('5 m')
    expect(CAMPUS_LANDSCAPES['sweetwater-2'].terrain_ko).toBeUndefined()
    expect(withRealTerrain('sweetwater-2', CAMPUS_LANDSCAPES['sweetwater-2']).realTerrain).toBeUndefined()
  })
  it('Childress: 부지 안은 평평하고 부지 밖만 실측 높이로 솟음', () => {
    const layout = layoutCampus(sites.find(s => s.id === 'childress')), { relief } = withRealTerrain('childress', CAMPUS_LANDSCAPES.childress)
    expect(terrainHeight(0, 0, layout.side, relief)).toBeCloseTo(-.28)
    expect(terrainHeight(layout.gate.x + 6, layout.road.z, layout.side, relief)).toBeCloseTo(-.28)   // 트럭 출발점·도로 끝
    expect(terrainHeight(layout.powerLine.from[0], layout.powerLine.from[1], layout.side, relief)).toBeLessThan(.3)   // 첫 송전탑
    let highest = -Infinity
    for (let x = -50; x <= 50; x += 2) for (let z = -50; z <= 50; z += 2) highest = Math.max(highest, terrainHeight(x, z, layout.side, relief))
    expect(highest).toBeGreaterThan(.5)
    expect(highest).toBeLessThan(2)   // 고도 차 31 m × 2배 ÷ 38.9 m/칸
  })
})
