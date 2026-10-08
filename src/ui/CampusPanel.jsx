import { useEffect, useRef } from 'react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { pickName, useT } from '../i18n/useT.js'
import { customerZones } from '../data/customerZones.js'
import { claimsAt, locationFor, milestonesAt, EMPTY_RESEARCH, sourceById } from '../data/research.js'
import { toMonth } from '../data/timeline.js'
import { styleOf } from '../data/statusStyle.js'
import EvidenceCard from './research/EvidenceCard.jsx'
import PlanHistory from './research/PlanHistory.jsx'
import PhotoGallery from './research/PhotoGallery.jsx'
import { campusAppearance } from '../scene/campusAppearance.js'
import { campusLandscape } from '../scene/campusLandscape.js'
import { CustomerLogo, logoKeyOf } from './logos/index.jsx'
const TABS={overview:['현황','Overview'],history:['계획 이력','Plan history'],evidence:['사진·근거','Photos & evidence']}
export default function CampusPanel(){
  const site=useAppStore(selectSelectedSite), st=useAppStore(), t=useT(), panel=useRef(null)
  const {lang,month,detailTab,selectedBuildingId,selectedZoneKey}=st, ko=lang==='ko'
  useEffect(()=>{panel.current?.scrollTo({top:0})},[site?.id,detailTab,selectedZoneKey,selectedBuildingId])
  if(!site)return null
  const appearance=campusAppearance(site.id)
  const landscape=campusLandscape(site.id)
  const research=st.data.raw.research??EMPTY_RESEARCH, location=locationFor(site,research)
  const zones=customerZones(site,st.data.companies), zone=zones.find(z=>z.key===selectedZoneKey)
  const building=site.buildings.find(b=>b.id===selectedBuildingId), buildings=zone?.buildings??site.buildings
  const claims=claimsAt(research,site.id,month,selectedBuildingId).filter(c=>!zone||zone.buildings.some(b=>b.id===c.building))
  const targets=milestonesAt(research,site.id,month,selectedBuildingId).filter(m=>!m.completion&&(!zone||zone.buildings.some(b=>b.id===m.building)))
  return <aside className="site-panel panel campus-panel" ref={panel} aria-label={ko?'캠퍼스 상세':'Campus details'}>
    <div className="campus-heading"><div><small>{site.country} / {site.region}</small><h2>{pickName(site,lang)}</h2></div><button className="close-small" onClick={st.requestGlobe} aria-label={ko?'캠퍼스 닫기':'Close campus'}>×</button></div>
    <div className="research-badges"><span className="research-badge">{location.precise?(ko?'주소 위치 · 경계 미확인':'Address · boundary unverified'):(ko?'지역 위치 · 부지 미확인':'Regional location · parcel unverified')}</span><span className="research-badge">{site.evidenceReview==='partial'?(ko?'건물별 근거 검토':'Building evidence reviewed'):(ko?'근거 이력 미정리':'Evidence history pending')}</span></div>
    <button className="surface-switch" onClick={()=>st.setSurface(st.surface==='map'?'3d':'map')}>{st.surface==='map'?(ko?'◇ 3D 사업 구성도':'◇ 3D business diagram'):(ko?'↗ 실제 지도로':'↗ Geographic map')}</button>
    <div className="zone-switch">{zones.map(z=><button key={z.key} aria-pressed={z.key===selectedZoneKey} onClick={()=>st.selectZone(z.key)}><span className="customer-mark" aria-hidden="true"><CustomerLogo name={logoKeyOf(z.name)} size={16}/></span><span>{z.name}</span></button>)}{(building||zone)&&<button onClick={()=>{st.requestCampusHome();st.syncHash()}}>{ko?'선택 해제':'Clear'}</button>}</div>
    {building&&<div className="selected-building"><b>{pickName(building,lang)}</b><span>{t.status[building.status]} · {building.lastReported ?? site.as_of}</span></div>}
    {st.surface==='3d'&&((appearance||landscape)?<details className="model-reference"><summary>{ko?'사진을 참고한 경관 · 출처':'Photo-informed setting · sources'}</summary>{appearance&&<p>{ko?appearance.notes_ko:appearance.notes_en}</p>}{landscape&&<p>{ko?landscape.notes_ko:landscape.notes_en} {ko?landscape.decoration_ko:landscape.decoration_en}</p>}<p>{ko?'건물·도로·경계의 위치와 규모는 용량을 설명하는 구성도입니다. 현장 실측·현재 공정률·계절을 재현하지 않습니다.':'Buildings, roads and boundaries illustrate capacity, not surveyed positions, current progress or seasons.'}</p><a href={landscape?.source??appearance.source} target="_blank" rel="noreferrer">{ko?'IREN 공식 자료 ↗':'IREN official reference ↗'}</a>{landscape?.regionalSource&&<a href={landscape.regionalSource} target="_blank" rel="noreferrer">{ko?'지역 경관 참고 ↗':'Regional landscape reference ↗'}</a>}</details>:<p className="research-note">{ko?'3D 사업 구성도 · 실제 건물 배치·공정률을 재현한 모형이 아닙니다.':'Business diagram · not a surveyed layout or measured construction model.'}</p>)}
    <div className="research-tabs" role="tablist" aria-label={ko?'상세 정보':'Detail tabs'}>{Object.entries(TABS).map(([key,names])=><button role="tab" key={key} id={`tab-${key}`} aria-controls={`tabpanel-${key}`} aria-selected={detailTab===key} onClick={()=>st.setDetailTab(key)}>{names[ko?0:1]}</button>)}</div>
    <div role="tabpanel" id={`tabpanel-${detailTab}`} aria-labelledby={`tab-${detailTab}`}>
    {detailTab==='overview'&&<>
      <dl className="sp-specs"><div><dt>{zone?(ko?'공개 IT 용량 합계':'Disclosed IT capacity'):(ko?'확보 전력':'Secured power')}</dt><dd>{zone?`${zone.itMw || '—'} MW`:`${site.grid_mw || '—'} MW`}</dd></div><div><dt>{ko?'정보 기준일':'Data as of'}</dt><dd>{site.as_of}</dd></div></dl>
      {zone&&<ul className="zone-statuses">{zone.statuses.map(s=><li key={s.status}><span className="dot" style={{background:styleOf(s.status).color}}/>{t.status[s.status]}<b>{s.count}{ko?'동':' bldgs'}{s.itMw?` · ${s.itMw} MW IT`: ''}</b></li>)}</ul>}
      <p className="research-note">{ko?'상태는 마지막 확인 기록입니다. 목표일 경과만으로 가동으로 전환하지 않습니다. 일부 기존 수치는 원문 재검토가 필요합니다.':'Statuses follow reported records, not elapsed target dates. Some legacy figures still need source review.'}</p>
      {month>toMonth(site.as_of)&&<p className="research-note attention">{ko?'미래 선택: 실제 현황은 마지막 확인 시점에 고정되며 목표만 전망으로 표시합니다.':'Future date: reported status stays at the last evidence cutoff; targets remain projections.'}</p>}
      {month<toMonth(site.as_of)&&<p className="research-note attention">{ko?'과거 공개일이 확인되지 않은 항목은 제외했습니다. 과거 기록이 불완전할 수 있습니다.':'Items without historical publication dates are excluded; historical coverage may be incomplete.'}</p>}
      {targets.length>0&&<button className="next-target" onClick={()=>st.setDetailTab('history')}><small>{ko?'다음 확인 목표':'Target to monitor'}</small><b>{targets[0].latest?.target} · {ko?targets[0].title_ko:targets[0].title_en}</b><span>{ko?'계획 이력 확인 →':'View plan history →'}</span></button>}
      <h3>{zone?`${zone.name} · `:''}{ko?'건물·단계':'Buildings & phases'}</h3><div className="research-buildings">{buildings.map(b=><button key={b.id} className={b.id===selectedBuildingId?'selected':''} onClick={()=>st.selectBuilding(b.id,true)}><span className="dot" style={{background:styleOf(b.status).color}}/><span><b>{pickName(b,lang)}</b><small>{t.status[b.status]} · {b.evidenceReview==='verified'?(ko?'원문 확인':'Source reviewed'):(ko?'재검토 필요':'Needs review')}</small></span><strong>{b.it_mw?`${b.it_mw} IT`:b.disclosedMw?`~${b.disclosedMw} MW*`:b.gross_mw?`${b.gross_mw} MW`:'—'}</strong></button>)}</div>
      {buildings.some(b=>b.disclosedMw)&&<p className="research-note">{ko?'* IT·총전력 기준 미명시. 용량 합계와 분리합니다.':'* IT/gross basis unspecified; excluded from typed capacity totals.'}</p>}
      {!buildings.length&&<p className="research-empty">{ko?'이 시점에 확인 가능한 건물 기록 없음':'No building records available at this date'}</p>}
      <h3>{ko?'현장 자료':'Site imagery'}</h3><PhotoGallery site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang} compact/>
      <h3>{ko?'위치 근거':'Location evidence'}</h3><p className="research-note">{ko?location.note_ko:location.note_en}</p><a href={location.source??site.sources[0]} target="_blank" rel="noreferrer">{ko?'위치 관련 원문 ↗':'Location source ↗'}</a>
    </>}
    {detailTab==='history'&&<PlanHistory site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang}/>}
    {detailTab==='evidence'&&<><PhotoGallery site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang}/><h3>{ko?'검토된 근거':'Reviewed evidence'}</h3>{claims.map(c=><div key={c.id}><span className="research-badge">{c.basis==='target'?(ko?'회사 목표':'Company target'):(ko?'회사 발표':'Company reported')}</span><EvidenceCard sourceId={c.sourceId} research={research} locator={c.locator} summary={`${c.building??''} · ${ko?c.summary_ko:c.summary_en}`} lang={lang}/></div>)}{!claims.length&&<p className="research-empty">{ko?'이 범위의 원문 검토 기록이 없습니다.':'No reviewed claims for this selection.'}</p>}<h3>{ko?'연결된 고객 계약':'Linked customer contracts'}</h3>{st.data.companies.flatMap(c=>c.contracts??[]).filter(c=>c.sites.includes(site.id)&&toMonth(c.signed)<=month&&(!zone||zone.contracts.includes(c))&&(!building||c.buildings?.includes(building.id))).map(c=><article className="contract-research" key={c.id}><b>{c.customer}</b><span>{c.value_usd_bn!=null?`$${c.value_usd_bn}bn`: '—'} · {c.term_years} {ko?'년':'years'}</span><p>{ko?c.note_ko:c.note_en}</p><a href={c.source} target="_blank" rel="noreferrer">{ko?'계약 원문 ↗':'Contract source ↗'}</a></article>)}<p className="research-note">{ko?'계약금액·고객 인수는 실제 매출과 구분합니다.':'Contract value and customer acceptance are distinct from recognized revenue.'}</p></>}
    </div>
  </aside>
}
