import { useEffect, useRef, lazy, Suspense } from 'react'
import { ChevronRight, Box, Map as MapIcon, ArrowUpRight, X } from 'lucide-react' // MapIcon: 자바스크립트 기본 Map 과 이름 겹침 방지
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { pickName, useT } from '../i18n/useT.js'
import { customerZones } from '../data/customerZones.js'
import { signedContractsAt } from '../data/contracts.js' // 그 날짜까지 서명된 계약만 (계약 탭과 같은 기준)
import { claimsAt, locationFor, milestonesAt, EMPTY_RESEARCH, sourceById } from '../data/research.js'
import { toMonth, monthLabel } from '../data/timeline.js'
import { siteNewsAt } from '../data/siteNews.js' // 보고 있는 달까지의 캠퍼스 소식 (최신 위)
import { styleOf } from '../data/statusStyle.js'
import EvidenceCard from './research/EvidenceCard.jsx'
import PlanHistory from './research/PlanHistory.jsx'
import PhotoGallery from './research/PhotoGallery.jsx'
import { campusAppearance } from '../scene/campusAppearance.js'
import { campusLandscape } from '../scene/campusLandscape.js'
import { CustomerLogo, logoKeyOf } from './logos/index.jsx'
import HallEstimateCard from './HallEstimateCard.jsx'
// 전력·통신 이중화 · 현장 진척(제3자 관찰) 칸 — 따로 불러와 첫 화면 번들에 안 들어감
const SiteFacts = lazy(() => import('./SiteFacts.jsx'))
const FigureButton = lazy(() => import('./FigureButton.jsx')) // 고른 건물의 그림(전력 경로·홀 안) 단추
const SiteNews = lazy(() => import('./SiteNews.jsx')) // 캠퍼스 최근 소식 목록 (현황 페이지와 같은 조각)
const SiteRules = lazy(() => import('./SiteRules.jsx')) // 지역 규제 칸 (미국 부지 · 데이터센터 유예·제한, data/restrictions.json)
const SiteSatellite = lazy(() => import('./SiteSatellite.jsx')) // 위성으로 본 변화 (Sentinel-2 월별 사진, public/data/satellite.json)
const SitePromises = lazy(() => import('./SitePromises.jsx')) // 경영진 약속 · 이 캠퍼스 (statements.json 의 promise.site)
const TABS={overview:['현황','Overview'],history:['계획 이력','Plan history'],evidence:['사진·근거','Photos & evidence']}
export default function CampusPanel(){
  const site=useAppStore(selectSelectedSite), st=useAppStore(), t=useT(), panel=useRef(null)
  const {lang,month,detailTab,selectedBuildingId,selectedZoneKey,campusPanelCollapsed:collapsed}=st, ko=lang==='ko'
  const gesture=useRef(null), dragged=useRef(false)
  const togglePanel=()=>st.setCampusPanelCollapsed(!collapsed)
  const panelAction=collapsed?(ko?'설명 패널 펼치기':'Expand details'):(ko?'설명 패널 접기':'Collapse details')
  const startDrag=e=>{
    if(e.button!==0)return
    dragged.current=false
    gesture.current={x:e.clientX,y:e.clientY}
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const endDrag=e=>{
    const start=gesture.current
    gesture.current=null
    if(!start)return
    const dy=e.clientY-start.y, dx=e.clientX-start.x
    if(Math.abs(dy)>32&&Math.abs(dy)>Math.abs(dx)){
      dragged.current=true
      st.setCampusPanelCollapsed(dy>0)
    }
  }
  useEffect(()=>{panel.current?.scrollTo({top:0})},[site?.id,detailTab,selectedZoneKey,selectedBuildingId])
  if(!site)return null
  const appearance=campusAppearance(site.id)
  const landscape=campusLandscape(site.id)
  const research=st.data.raw.research??EMPTY_RESEARCH, location=locationFor(site,research)
  const rules=st.data.raw.restrictions?.sites.find(r=>r.site===site.id) // 지역 규제 요약 (미국 부지만 있음)
  const zones=customerZones(site,st.data.companies), zone=zones.find(z=>z.key===selectedZoneKey)
  const building=site.buildings.find(b=>b.id===selectedBuildingId), buildings=zone?.buildings??site.buildings
  const claims=claimsAt(research,site.id,month,selectedBuildingId).filter(c=>!zone||zone.buildings.some(b=>b.id===c.building))
  const targets=milestonesAt(research,site.id,month,selectedBuildingId).filter(m=>!m.completion&&(!zone||zone.buildings.some(b=>b.id===m.building)))
  return <aside className={`site-panel panel campus-panel${collapsed?' is-collapsed':''}`} aria-label={ko?'캠퍼스 상세':'Campus details'}>
    <button className="campus-panel-handle" aria-label={ko?'설명 패널 손잡이':'Details panel handle'} title={ko?'누르거나 위아래로 끌어 펼치기·접기':'Tap or drag up/down to expand or collapse'} aria-expanded={!collapsed} aria-controls="campus-panel-content"
      onPointerDown={startDrag} onPointerUp={endDrag} onPointerCancel={()=>{gesture.current=null;dragged.current=false}}
      onClick={()=>{if(dragged.current){dragged.current=false;return}togglePanel()}}><span/></button>
    <div className="campus-heading"><div className="campus-heading-title"><small>{site.country} / {site.region}</small><h2 title={pickName(site,lang)}>{pickName(site,lang)}</h2></div>
      <div className="campus-heading-actions"><button className="campus-panel-toggle" onClick={togglePanel} aria-label={panelAction} title={panelAction} aria-expanded={!collapsed} aria-controls="campus-panel-content"><ChevronRight size={15} aria-hidden="true"/><span>{collapsed?(ko?'펼치기':'Expand'):(ko?'접기':'Collapse')}</span></button><button className="close-small" onClick={st.requestGlobe} aria-label={ko?'캠퍼스 닫기':'Close campus'} title={ko?'캠퍼스 닫기':'Close campus'}><X size={14} aria-hidden="true"/></button></div>
    </div>
    <div id="campus-panel-content" className="campus-panel-body" ref={panel} hidden={collapsed}>
    {/* 위치·근거 표시. 3D 화면이면 위치 표시 바로 옆에 작은 '지도에서 위치 보기' (같은 캠퍼스를 실제 지도 위에서)
        2026-10-27 사용자 결정: 예전 폭 전체 남색 막대 '실제 지도로'는 뺌 — 뒤로 가기(← · ×)처럼 읽혀 헷갈리고 칸에서 가장 무거웠음 */}
    <div className="research-badges"><span className="research-badge">{location.precise?(ko?'주소 위치 · 경계 미확인':'Address · boundary unverified'):(ko?'지역 위치 · 부지 미확인':'Regional location · parcel unverified')}</span>
      {st.surface==='3d'&&<button type="button" className="map-link" onClick={()=>st.setSurface('map')} title={ko?'이 캠퍼스를 실제 지도 위에서 보기':'See this campus on the geographic map'}><MapIcon size={12} aria-hidden="true"/>{ko?'지도에서 위치 보기':'See on map'}</button>}
      <span className="research-badge">{site.evidenceReview==='partial'?(ko?'건물별 근거 검토':'Building evidence reviewed'):(ko?'근거 이력 미정리':'Evidence history pending')}</span></div>
    {/* 지도 화면에서는 3D 로 들어가는 큰 단추 (여기서 하는 다음 동작이라 그대로) */}
    {st.surface==='map'&&<button className="surface-switch" onClick={()=>st.setSurface('3d')}><Box size={14} aria-hidden="true"/>{ko?'3D 사업 구성도':'3D business diagram'}</button>}
    <div className="zone-switch">{zones.map(z=><button key={z.key} aria-pressed={z.key===selectedZoneKey} onClick={()=>st.selectZone(z.key)}><span className="customer-mark" aria-hidden="true"><CustomerLogo name={logoKeyOf(z.name)} size={16}/></span><span>{z.name}</span></button>)}{(building||zone)&&<button onClick={()=>{st.requestCampusHome();st.syncHash()}}>{ko?'선택 해제':'Clear'}</button>}</div>
    {building&&<div className="selected-building"><b>{pickName(building,lang)}</b><span>{t.status[building.status]} · {building.lastReported ?? site.as_of}</span></div>}
    {/* 고른 건물에 그림(전력 경로·홀 안·냉각수 길)이 있으면 바로 아래 단추 — 따로 불러오는 묶음 */}
    {building?.figure&&<Suspense fallback={null}><FigureButton name={building.figure} lang={lang} label={ko?'이 건물 안 자세히 보기':'Look inside this building'}/></Suspense>}
    {/* 선택한 데이터홀: MW → GPU·랙·계약 기준 연 매출 (추정과 가정을 함께) */}
    {building&&detailTab==='overview'&&<HallEstimateCard building={building}/>}
    {st.surface==='3d'&&((appearance||landscape)?<details className="model-reference"><summary>{ko?'사진을 참고한 경관 · 출처':'Photo-informed setting · sources'}</summary>{appearance&&<p>{ko?appearance.notes_ko:appearance.notes_en}</p>}{landscape&&<p>{ko?landscape.notes_ko:landscape.notes_en} {ko?landscape.decoration_ko:landscape.decoration_en}</p>}<p>{ko?'건물·도로·경계의 위치와 규모는 용량을 설명하는 구성도입니다. 현장 실측·현재 공정률·계절을 재현하지 않습니다.':'Buildings, roads and boundaries illustrate capacity, not surveyed positions, current progress or seasons.'}</p><a href={landscape?.source??appearance.source} target="_blank" rel="noreferrer">{ko?'IREN 공식 자료':'IREN official reference'}<ArrowUpRight size={12} aria-hidden="true"/></a>{landscape?.regionalSource&&<a href={landscape.regionalSource} target="_blank" rel="noreferrer">{ko?'지역 경관 참고':'Regional landscape reference'}<ArrowUpRight size={12} aria-hidden="true"/></a>}</details>:<p className="research-note">{ko?'3D 사업 구성도 · 실제 건물 배치·공정률을 재현한 모형이 아닙니다.':'Business diagram · not a surveyed layout or measured construction model.'}</p>)}
    <div className="research-tabs" role="tablist" aria-label={ko?'상세 정보':'Detail tabs'}>{Object.entries(TABS).map(([key,names])=><button role="tab" key={key} id={`tab-${key}`} aria-controls="campus-tabpanel"  aria-selected={detailTab===key} onClick={()=>st.setDetailTab(key)}>{names[ko?0:1]}</button>)}</div>
    <div role="tabpanel" id="campus-tabpanel" aria-labelledby={`tab-${detailTab}`}>
    {detailTab==='overview'&&<>
      <dl className="sp-specs"><div><dt>{zone?(ko?'공개 IT 용량 합계':'Disclosed IT capacity'):(ko?'확보 전력':'Secured power')}</dt><dd>{zone?`${zone.itMw || '—'} MW`:!site.grid_mw&&site.planned?(ko?`— (계획 ${site.planned.mw} MW · 계통 미확보)`:`— (${site.planned.mw} MW planned · grid not secured)`):`${site.grid_mw || '—'} MW`}</dd></div><div><dt>{ko?'정보 기준일':'Data as of'}</dt><dd>{site.as_of}</dd></div></dl>
      {zone&&<ul className="zone-statuses">{zone.statuses.map(s=><li key={s.status}><span className="dot" style={{background:styleOf(s.status).color}}/>{t.status[s.status]}<b>{s.count}{ko?'동':' bldgs'}{s.itMw?` · ${s.itMw} MW IT`: ''}</b></li>)}</ul>}
      {/* 기준일 이후(미래)는 회사 목표 기준 전망, 기준일까지는 확인 기록 — 어느 쪽인지 안내 */}
      <p className={`research-note${site._raw?._forecast?' is-forecast':''}`}>{site._raw?._forecast
        ?(ko?'기준일 이후는 회사가 발표한 목표 일정대로 진행한 전망입니다. 실제 진행과 다를 수 있습니다.':'After the as-of date, this is an outlook that follows company-announced targets. Actual progress may differ.')
        :(ko?'기준일까지의 상태는 마지막 확인 기록입니다. 목표일 경과만으로 가동으로 전환하지 않습니다. 일부 기존 수치는 원문 재검토가 필요합니다.':'Up to the as-of date, statuses follow reported records, not elapsed target dates. Some legacy figures still need source review.')}</p>
      {month<toMonth(site.as_of)&&<p className="research-note attention">{ko?'과거 공개일이 확인되지 않은 항목은 제외했습니다. 과거 기록이 불완전할 수 있습니다.':'Items without historical publication dates are excluded; historical coverage may be incomplete.'}</p>}
      {targets.length>0&&<button className="next-target" onClick={()=>st.setDetailTab('history')}><small>{ko?'다음 확인 목표':'Target to monitor'}</small><b>{targets[0].latest?.target} · {ko?targets[0].title_ko:targets[0].title_en}</b><span>{ko?'계획 이력 확인 →':'View plan history →'}</span></button>}
      <h3>{zone?`${zone.name} · `:''}{ko?'건물·단계':'Buildings & phases'}</h3><div className="research-buildings">{buildings.map(b=><button key={b.id} className={b.id===selectedBuildingId?'selected':''} onClick={()=>st.selectBuilding(b.id,true)}><span className="dot" style={{background:styleOf(b.status).color}}/><span><b>{pickName(b,lang)}</b><small>{t.status[b.status]} · {b.evidenceReview==='verified'?(ko?'원문 확인':'Source reviewed'):(ko?'재검토 필요':'Needs review')}</small></span><strong>{b.it_mw?`${b.it_mw} IT`:b.disclosedMw?`~${b.disclosedMw} MW*`:b.gross_mw?`${b.gross_mw} MW`:'—'}</strong></button>)}</div>
      {buildings.some(b=>b.disclosedMw)&&<p className="research-note">{ko?'* IT·총전력 기준 미명시. 용량 합계와 분리합니다.':'* IT/gross basis unspecified; excluded from typed capacity totals.'}</p>}
      {!buildings.length&&<p className="research-empty">{ko?'이 시점에 확인 가능한 건물 기록 없음':'No building records available at this date'}</p>}
      {/* 최근 소식: 보고 있는 달까지의 캠퍼스 소식 (지난 날짜를 보면 제목에 'O년 O월까지') · 캠퍼스 전체 소식이라 고객 구역을 고르면 숨김 */}
      {!zone&&<Suspense fallback={null}><SiteNews key={site.id} items={siteNewsAt(site,month)} lang={lang}
        title={<h3>{ko?'최근 소식':'Recent news'}{month<toMonth(site.as_of)&&(ko?` · ${monthLabel(month,lang)}까지`:` · through ${monthLabel(month,lang)}`)}</h3>}
        empty={ko?'이 시점까지 공개된 소식이 없습니다.':'No news published by this date.'}/></Suspense>}
      {/* 경영진 약속: 이 캠퍼스에 걸린 약속이 있을 때만 · 누르면 본사 화면 약속 타임라인 */}
      {!zone&&<Suspense fallback={null}><SitePromises siteId={site.id} lang={lang}/></Suspense>}
      {!zone&&<Suspense fallback={null}><SiteFacts site={site} month={month} lang={lang}/></Suspense>}
      {/* 위성 사진: 목록에 그 부지 사진이 있을 때만 (지금은 미국 부지 4곳) · 보고 있는 달까지 찍힌 것만 */}
      {!zone&&<Suspense fallback={null}><SiteSatellite site={site} month={month} lang={lang}/></Suspense>}
      {/* 지역 규제: 자료가 있는 미국 부지만 (자료 기간이 2026-08 까지라 지난 날짜를 봐도 같은 요약) */}
      {!zone&&rules&&<Suspense fallback={null}><SiteRules rules={rules} source={st.data.raw.restrictions.source} lang={lang}/></Suspense>}
      <h3>{ko?'현장 자료':'Site imagery'}</h3><PhotoGallery site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang} compact/>
      <h3>{ko?'위치 근거':'Location evidence'}</h3><p className="research-note">{ko?location.note_ko:location.note_en}</p><a href={location.source??site.sources[0]} target="_blank" rel="noreferrer">{ko?'위치 관련 원문':'Location source'}<ArrowUpRight size={12} aria-hidden="true"/></a>
    </>}
    {detailTab==='history'&&<PlanHistory site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang}/>}
    {detailTab==='evidence'&&<><PhotoGallery site={site} buildingId={selectedBuildingId} buildingIds={zone?.buildings.map(b=>b.id)} research={research} month={month} lang={lang}/><h3>{ko?'검토된 근거':'Reviewed evidence'}</h3>{claims.map(c=><div key={c.id}><span className="research-badge">{c.basis==='target'?(ko?'회사 목표':'Company target'):(ko?'회사 발표':'Company reported')}</span><EvidenceCard sourceId={c.sourceId} research={research} locator={c.locator} summary={`${c.building??''} · ${ko?c.summary_ko:c.summary_en}`} lang={lang}/></div>)}{!claims.length&&<p className="research-empty">{ko?'이 범위의 원문 검토 기록이 없습니다.':'No reviewed claims for this selection.'}</p>}<h3>{ko?'연결된 고객 계약':'Linked customer contracts'}</h3>{signedContractsAt(st.data.companies.flatMap(c=>c.contracts??[]),month).filter(c=>c.sites.includes(site.id)&&(!zone||zone.contracts.includes(c))&&(!building||c.buildings?.includes(building.id))).map(c=><article className="contract-research" key={c.id}><b>{c.customer}</b><span>{c.value_usd_bn!=null?`$${c.value_usd_bn}bn`: '—'} · {c.term_years} {ko?'년':'years'}</span><p>{ko?c.note_ko:c.note_en}</p><a href={c.source} target="_blank" rel="noreferrer">{ko?'계약 원문':'Contract source'}<ArrowUpRight size={12} aria-hidden="true"/></a></article>)}<p className="research-note">{ko?'계약금액·고객 인수는 실제 매출과 구분합니다.':'Contract value and customer acceptance are distinct from recognized revenue.'}</p></>}
    </div>
    </div>
  </aside>
}
