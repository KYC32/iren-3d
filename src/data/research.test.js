import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra } from './view.js'
import { toMonth, siteMetricsAt } from './timeline.js'
import { claimsAt, mediaAt, assessMilestone, dateRange, locationFor, observedSiteAt } from './research.js'
import { validateResearch } from './researchSchema.js'
import { siteFeatures, boundsFor } from '../map/mapData.js'
const raw=buildInfra(), M=toMonth
const childress=(date)=>viewInfra(raw,M(date)).sites.find(s=>s.id==='childress')
describe('observed investor state',()=>{
 // 고객 인수(delivered)는 상태 이름은 그대로 두되 "AI 가동"으로 집계 (프로젝트 소유자 결정, 2026-10-09)
 it('keeps the delivered label, counts it as AI operating, and does not advance on elapsed targets',()=>{
   for(const date of ['2026-10','2027-06','2028-12']){
     const s=childress(date)
     expect(s.buildings.find(b=>b.id==='horizon-1').status).toBe('delivered')
     expect(s.buildings.find(b=>b.id==='horizon-2').status).toBe('commissioning')
     const mt=siteMetricsAt(s._raw,M(date))
     expect(mt.delivered).toBe(75)
     expect(mt.ai).toBe(75) // Horizon 1 인수분 = 가동
   }
 })
 // 퇴역은 추정(estimate)이어도 반영 — 줄어드는 변화까지 "보고된 근거"를 기다리면 퇴역한 건물이 가동으로 되살아남
 it('applies retirements recorded as estimates, so retired halls do not come back to life',()=>{
   const site=(id,date)=>viewInfra(raw,M(date)).sites.find(s=>s.id===id)
   const status=(id,b,date)=>site(id,date).buildings.find(x=>x.id===b)?.status ?? null
   expect(status('prince-george','pg-hopper-pilot','2026-10')).not.toBe('operating') // 2025-12 퇴역(추정)
   expect(status('mackenzie','mk-miners','2026-10')).not.toBe('operating')           // 2026-05 퇴역(추정)
   expect(status('canal-flats','cf-miners','2026-10')).not.toBe('operating')          // 2026-10 퇴역(추정)
 })
 // 원문을 검토한 건물(Horizon 1~4)도 iren.json 에 이미 보고된 이력은 유지
 // (날짜별 노출은 "그때 공개된 자료" 기준이라, 공개일을 아는 기준일 시점에서 이력 목록을 확인)
 it('keeps reported history for audited buildings',()=>{
   const h1=childress('2026-10')._raw.buildings.find(b=>b.id==='horizon-1')
   expect(h1.phases.map(p=>p.status)).toEqual(['under_construction','commissioning','delivered'])
 })
 it('does not invent numerical construction percentages or acceptance dates',()=>{
   const s=childress('2026-10')
   expect(s.buildings.find(b=>b.id==='horizon-3').progress).toBeUndefined()
   expect(s.buildings.find(b=>b.id==='horizon-1').dates.delivered).toBeUndefined()
   expect(s.buildings.find(b=>b.id==='horizon-2').dates.energized).toBeUndefined()
 })
 it('hides customer links and evidence before publication',()=>{
   const s=childress('2025-10')
   expect(s.buildings.some(b=>b.customer==='Microsoft')).toBe(false)
   expect(claimsAt(raw.research,'childress',M('2026-07')).some(c=>c.value==='delivered')).toBe(false)
   expect(mediaAt(raw.research,'childress',M('2025-04'))).toHaveLength(0)
 })
 it('preserves source data and keeps publicly known campus deliveries without inventing destinations',()=>{
   const s=childress('2026-10')
   expect(raw.sites.find(s=>s.id==='childress').buildings.find(b=>b.id==='horizon-3').progress).toBe(.8)
   expect(s._raw.deliveries).toHaveLength(2)
   expect(s._raw.deliveries.every(d=>!d.buildingId)).toBe(true)
   expect(childress('2025-10')._raw.deliveries).toEqual([])
   expect(childress('2025-11')._raw.deliveries.map(d=>d.what)).toEqual(['GB300 NVL72 (Horizon 2~4)'])
 })
 it('does not replay completed deliveries',()=>{
   const s=structuredClone(raw.sites.find(s=>s.id==='childress'))
   s.deliveries.forEach(d=>{d.status='done'})
   expect(observedSiteAt(s,raw.research,M('2026-10'),raw.companies).deliveries).toEqual([])
 })
 it('does not promote a reported future target to an actual status',()=>{
   const s=raw.sites.find(s=>s.id==='childress')
   const research=structuredClone(raw.research)
   research.claims.push({...research.claims[0],id:'bad-target',field:'status',value:'operating',basis:'target'})
   expect(observedSiteAt(s,research,M('2026-10'),raw.companies).buildings.find(b=>b.id==='horizon-1').phases.some(p=>p.status==='operating')).toBe(false)
 })
})
describe('milestone comparisons',()=>{
 const r={sources:[{id:'a',published:'2025-01-10'},{id:'b',published:'2025-05-10'},{id:'c',published:'2026-02-01'}]}
 const milestone={revisions:[{target:'2025-Q4',sourceId:'a'},{target:'2026-Q1',sourceId:'b'}]}
 it('preserves all publicly known revisions',()=>{
   expect(assessMilestone(milestone,r,M('2025-02')).revisions).toHaveLength(1)
   const x=assessMilestone(milestone,r,M('2026-02'))
   expect(x.revisions).toHaveLength(2);expect(x.revised).toBe(true);expect(x.first.target).toBe('2025-Q4')
 })
 it('an elapsed deadline is unconfirmed, not a proven delay',()=>expect(assessMilestone(milestone,r,M('2026-05')).status).toBe('unconfirmed'))
 it.each([['2026-01','on_time'],['2026-04','late'],[null,'completed_unknown_date']])('compares occurrence range %s',(occurred,status)=>{
   expect(assessMilestone({...milestone,completion:{sourceId:'c',occurred}},r,M('2026-05')).status).toBe(status)
 })
 it('preserves quarterly and leap-year date precision',()=>{
   expect(dateRange('2024-Q1')).toEqual({start:'2024-01-01',end:'2024-03-31'})
   expect(dateRange('2024-02').end).toBe('2024-02-29')
 })
})
describe('location and media integrity',()=>{
 it('unreviewed address metadata is not treated as a verified parcel',()=>{
   const s=raw.sites.find(s=>s.id==='prince-george')
   expect(locationFor(s,raw.research)).toMatchObject({precise:false,maxZoom:9})
 })
 it('retains co-located coordinates without jitter and covers all countries',()=>{
   const sites=raw.sites.slice(0,2).map(s=>({...s,coord:{lat:1,lng:2}}))
   const f=siteFeatures(sites,{locations:[]})
   expect(f.features.map(x=>x.geometry.coordinates)).toEqual([[2,1],[2,1]])
   expect(boundsFor(sites,{locations:[]})).toEqual([[2,1],[2,1]])
   expect(siteFeatures(raw.sites,raw.research).features).toHaveLength(9)
 })
 it('campus panorama is not attributed to a specific building',()=>{
   expect(mediaAt(raw.research,'childress',M('2026-10'),'horizon-1').some(p=>p.id==='childress-apr2025')).toBe(false)
 })
 it('does not backdate undated official website images or treat them as dated claims',()=>{
   expect(mediaAt(raw.research,'childress',M('2026-09')).some(p=>p.id==='childress-official-main')).toBe(false)
   expect(mediaAt(raw.research,'childress',M('2026-10')).some(p=>p.id==='childress-official-main')).toBe(true)
   expect(mediaAt(raw.research,'childress',M('2026-10'),'horizon-1').some(p=>p.id==='childress-official-main')).toBe(false)
 })
 it('requires usable image assets before enabling in-app photos',()=>{
   const r=structuredClone(raw.research);r.media[0].rights='display';delete r.media[0].thumbnail;delete r.media[0].full
   expect(validateResearch(r,raw.sites).some(e=>e.includes('thumbnail'))).toBe(true)
 })
 it('rejects broken source references and target building references',()=>{
   const r=structuredClone(raw.research);r.claims[0].sourceId='missing';r.media[0].buildings=['missing']
   const errors=validateResearch(r,raw.sites)
   expect(errors.some(e=>e.includes('source'))).toBe(true);expect(errors.some(e=>e.includes('building'))).toBe(true)
 })
 // 상태 claim 의 값이 오타면(예: 'operatng') 검증에서 잡혀야 함 — 안 그러면 화면에 이상한 상태로 나옴
 it('rejects status claims with unknown status values',()=>{
   const r=structuredClone(raw.research)
   r.claims.push({...r.claims.find(c=>c.field==='status'),id:'typo-status',value:'operatng'})
   expect(validateResearch(r,raw.sites).some(e=>e.includes('unknown status'))).toBe(true)
   expect(validateResearch(raw.research,raw.sites).some(e=>e.includes('unknown status'))).toBe(false)
 })
})
