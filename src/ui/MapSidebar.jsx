// =============================================================
// MapSidebar — 실제 지도 화면 왼쪽 패널: [캠퍼스 | 일정 | 갱신 기록] 탭
// -------------------------------------------------------------
// 투자자가 첫 화면에서 바로 답을 얻도록:
//   캠퍼스  : 어디에 무엇이 있나 (누르면 지도가 그 캠퍼스로 이동)
//   일정    : 다음 이벤트·목표 일정은 언제인가 (실적 발표, 인도 목표 등)
//   갱신 기록: 지난번에 본 뒤로 데이터가 무엇이 바뀌었나
// 일정·갱신 기록 탭은 예전 3D 개요 화면에만 있어서 지금 흐름에선 볼 수 없었음 → 지도 화면으로 옮김
// =============================================================
import { useAppStore } from '../store/useAppStore.js'
import { pickName, useT } from '../i18n/useT.js'
import { locationFor, milestonesAt } from '../data/research.js'
import { styleOf } from '../data/statusStyle.js'
import { REGION_NAMES } from '../map/mapData.js'
import { PanelLeftClose, PanelLeftOpen, MapPin } from 'lucide-react'
import Upcoming from './Upcoming.jsx'
import ChangeLog from './ChangeLog.jsx'

// 지도 위 지역 바로가기 (북미·미국·캐나다…)
export function RegionControls(){
 const st=useAppStore(),ko=st.lang==='ko'
 return <nav className="region-controls" aria-label={ko?'지역 이동':'Map regions'}>{Object.entries(REGION_NAMES).map(([id,n])=><button key={id} aria-pressed={st.mapRegion.country===id} onClick={()=>st.setMapRegion(id)}>{n[ko?0:1]}</button>)}</nav>
}

const TABS = ['sites', 'upcoming', 'log'] // 탭 순서 (스토어의 leftTab 값과 같음)

export default function MapSidebar(){
  const st=useAppStore(), t=useT(), ko=st.lang==='ko'
  const tab = TABS.includes(st.leftTab) ? st.leftTab : 'sites'
  const label = { sites: ko?'캠퍼스':'Campuses', upcoming: t.upcoming.tab, log: t.changelog.tab }
  return <>
    {/* 목록을 접었을 때 보이는 작은 펼치기 버튼 */}
    <button className={`map-list-launcher${st.mapListCollapsed?' is-collapsed':''}${st.sheetOpen?' is-sheet-open':''}`} onClick={()=>st.setCampusListOpen(true)} aria-label={ko?'왼쪽 패널 펼치기':'Expand side panel'} aria-controls="campus-list" aria-expanded="false"><PanelLeftOpen size={16}/><span>{label[tab]}</span>{tab==='sites'&&<b>{st.data.sites.length}</b>}</button>
    <aside id="campus-list" aria-label={label[tab]} className={`map-sidebar panel${st.sheetOpen?' is-open':''}${st.mapListCollapsed?' is-collapsed':''}`}>
      <div className="map-list-heading">
        <div><small>IREN / {tab==='sites'?'LOCATIONS':tab==='upcoming'?'CALENDAR':'UPDATES'}</small><h2>{label[tab]}</h2></div>
        <button className="collapse-campus-list" onClick={()=>st.setCampusListOpen(false)} aria-label={ko?'왼쪽 패널 접기':'Collapse side panel'} title={ko?'접기':'Collapse'} aria-controls="campus-list" aria-expanded="true"><PanelLeftClose size={18}/></button>
      </div>
      {/* 탭: 캠퍼스 | 일정 | 갱신 기록 */}
      <div className="tabs map-tabs" role="tablist" aria-label={ko?'왼쪽 패널 보기':'Side panel views'}>
        {TABS.map((k)=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'on':''} onClick={()=>st.setLeftTab(k)}>{label[k]}{k==='sites'&&<span className="tab-count">{st.data.sites.length}</span>}</button>)}
      </div>
      {tab==='sites' && <CampusList />}
      {tab==='upcoming' && <Upcoming />}
      {tab==='log' && <ChangeLog />}
    </aside>
  </>
}

// 캠퍼스 목록: 이름·나라·상태·확보 전력, 위치 정확도, 다음 목표 일정
function CampusList(){
  const st=useAppStore(), t=useT(), ko=st.lang==='ko'
  return <>
    <p className="campus-list-help"><MapPin size={12}/>{ko?'목록으로 위치 확인 · 마커로 3D 보기':'List to locate · markers to explore in 3D'}</p>
    <div className="map-site-list">{st.data.sites.map(s=>{
      const loc=locationFor(s,st.data.raw.research)
      const target=milestonesAt(st.data.raw.research,s.id,st.month).find(m=>!m.completion) // 아직 완료 안 된 가장 가까운 목표
      return <button key={s.id} aria-pressed={st.selectedSiteId===s.id} onClick={()=>st.focusSiteOnMap(s.id)}>
        <span className="map-site-top"><b>{pickName(s,st.lang)}</b><small>{s.country}</small></span>
        <span className="map-site-status"><i className="dot" style={{background:styleOf(s.status).color}}/>{t.status[s.status]}<strong>{s.grid_mw?`${s.grid_mw.toLocaleString()} MW`:'—'}</strong></span>
        <small>{loc.precise?(ko?'주소 위치':'Address location'):(ko?'지역 위치 · 부지 미확인':'Region · parcel unverified')}</small>
        {target&&<small className="map-next">{ko?'목표':'Target'} · {target.latest?.target}</small>}
      </button>})}
    </div>
    <div className="map-list-note">{ko?'지도는 지리적 위치를, 3D는 사업 구성을 보여줍니다.':'Map shows geography. 3D explains the business layout.'}</div>
  </>
}
