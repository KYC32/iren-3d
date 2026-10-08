import { describe, expect, it } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { layoutCampus, campusStateAt } from './layoutCampus.js'
import { toMonth } from '../data/timeline.js'
import { viewInfra } from '../data/view.js'
import { POWER_FLOW_SPEED, POWER_PACKET_COUNT, pointOnTransmission, powerArrivalPulse, powerPacketDistance, transmissionPath } from './powerFlow.js'

const infra=buildInfra()
const path=transmissionPath([-28.6,-13.6],[-14,-13.6])

describe('송전선 전력 흐름',()=>{
  it.each(infra.sites.map(s=>[s.id,s]))('%s: 빛의 경로가 처진 전선과 변전소 인입점에 정확히 놓인다',(_id,site)=>{
    const {powerLine}=layoutCampus(site)
    const wire=transmissionPath(powerLine.from,powerLine.to)
    expect(wire.points[0]).toEqual([powerLine.from[0],3.4,powerLine.from[1]])
    expect(wire.points.at(-1)).toEqual([powerLine.to[0]+1.2,2.8,powerLine.to[1]])
    for (let i=0;i<wire.points.length;i++) {
      expect(Object.values(pointOnTransmission(wire,wire.distances[i],{}))).toEqual(wire.points[i])
      if (i) expect(wire.distances[i]).toBeGreaterThan(wire.distances[i-1])
    }
    expect(wire.points[4][1]).toBeCloseTo(2.9)
    expect(wire.points[8][1]).toBeCloseTo(3.4)
    expect(pointOnTransmission(wire,-1,{})).toEqual(pointOnTransmission(wire,0,{}))
    expect(pointOnTransmission(wire,wire.length+1,{})).toEqual(pointOnTransmission(wire,wire.length,{}))
  })

  it('전력 용량과 무관하게 인입 방향으로 일정한 거리만큼 이동한다',()=>{
    for (let i=0;i<POWER_PACKET_COUNT;i++) {
      const before=powerPacketDistance(0,i,path.length)
      const after=powerPacketDistance(.1,i,path.length)
      expect(after-before).toBeCloseTo(.1*POWER_FLOW_SPEED)
      expect(pointOnTransmission(path,after,{}).x).toBeGreaterThan(pointOnTransmission(path,before,{}).x)
    }
  })

  it('각 빛줄기가 변전소에 도착할 때 표시등이 밝아진다',()=>{
    for (let i=0;i<POWER_PACKET_COUNT;i++) {
      const arrival=(path.length-powerPacketDistance(0,i,path.length))/POWER_FLOW_SPEED
      expect(powerArrivalPulse(arrival,path.length)).toBeCloseTo(1)
      expect(powerArrivalPulse(arrival-.4,path.length)).toBeLessThan(.2)
      expect(powerArrivalPulse(arrival+.4,path.length)).toBeLessThan(.2)
      expect(powerArrivalPulse(arrival-.001,path.length)).toBeCloseTo(powerArrivalPulse(arrival+.001,path.length))
    }
  })

  it('모션 감소 설정에서는 빛줄기가 멈추고 표시등이 점멸하지 않는다',()=>{
    for (const t of [0,3,45,120]) {
      for (let i=0;i<POWER_PACKET_COUNT;i++) expect(powerPacketDistance(t,i,path.length,true)).toBe(powerPacketDistance(0,i,path.length,true))
      expect(powerArrivalPulse(t,path.length,true)).toBe(0)
    }
  })
})

describe('통전 기록과 애니메이션',()=>{
  const base=infra.sites.find(s=>s.id==='childress')
  const layout=layoutCampus(base)
  it.each(['target',undefined])('통전 수치가 있어도 근거가 %s이면 공급 연출을 켜지 않는다',basis=>{
    const site={...base,power:[{from:'2026-01',secured_mw:750,energized_mw:750,basis}]}
    const state=campusStateAt(layout,site,toMonth('2026-10'))
    expect(state.powerLine.flowActive).toBe(false)
    expect(state.flowTargets).toEqual([])
  })
  it('통전 확인 전·후와 나중의 공급 중단 기록을 따른다',()=>{
    const site={...base,power:[
      {from:'2026-01',secured_mw:750,energized_mw:0,basis:'reported'},
      {from:'2026-05',secured_mw:750,energized_mw:750,basis:'reported'},
      {from:'2026-09',secured_mw:750,energized_mw:0,basis:'reported'},
    ]}
    expect(campusStateAt(layout,site,toMonth('2026-04')).powerLine.flowActive).toBe(false)
    expect(campusStateAt(layout,site,toMonth('2026-05')).powerLine.flowActive).toBe(true)
    expect(campusStateAt(layout,site,toMonth('2026-09')).powerLine.flowActive).toBe(false)
  })
  it('투자자 화면에서 미래의 목표일을 지나도 미확인 캠퍼스에 흐름을 만들지 않는다',()=>{
    const future=toMonth('2028-12')
    for (const id of ['sweetwater-2','kiowa','bundey','badajoz']) {
      const site=viewInfra(infra,future).sites.find(s=>s.id===id)._raw
      const state=campusStateAt(layoutCampus(site),site,future)
      expect(state.powerLine.flowActive).toBe(false)
      expect(state.flowTargets).toEqual([])
    }
    for (const id of ['childress','sweetwater-1','prince-george','mackenzie','canal-flats']) {
      const site=viewInfra(infra,future).sites.find(s=>s.id===id)._raw
      expect(campusStateAt(layoutCampus(site),site,future).powerLine.flowActive).toBe(true)
    }
  })
})
