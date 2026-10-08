import { useAppStore } from '../store/useAppStore.js'
import { pickName, useT } from '../i18n/useT.js'
import { locationFor, milestonesAt } from '../data/research.js'
import { styleOf } from '../data/statusStyle.js'
import { REGION_NAMES } from '../map/mapData.js'
import { PanelLeftClose, PanelLeftOpen, MapPin } from 'lucide-react'
export function RegionControls(){
 const st=useAppStore(),ko=st.lang==='ko'
 return <nav className="region-controls" aria-label={ko?'지역 이동':'Map regions'}>{Object.entries(REGION_NAMES).map(([id,n])=><button key={id} aria-pressed={st.mapRegion.country===id} onClick={()=>st.setMapRegion(id)}>{n[ko?0:1]}</button>)}</nav>
}
export default function MapSidebar(){
 const st=useAppStore(),t=useT(),ko=st.lang==='ko'
 return <>
 <button className={`map-list-launcher${st.mapListCollapsed?' is-collapsed':''}${st.sheetOpen?' is-sheet-open':''}`} onClick={()=>st.setCampusListOpen(true)} aria-label={ko?'캠퍼스 목록 펼치기':'Expand campus list'} aria-controls="campus-list" aria-expanded="false"><PanelLeftOpen size={16}/><span>{ko?'캠퍼스':'Campuses'}</span><b>{st.data.sites.length}</b></button>
 <aside id="campus-list" aria-label={ko?'캠퍼스 목록':'Campus list'} className={`map-sidebar panel${st.sheetOpen?' is-open':''}${st.mapListCollapsed?' is-collapsed':''}`}><div className="map-list-heading"><div><small>IREN / LOCATIONS</small><h2>{ko?'캠퍼스':'Campuses'}</h2></div><button className="collapse-campus-list" onClick={()=>st.setCampusListOpen(false)} aria-label={ko?'캠퍼스 목록 접기':'Collapse campus list'} title={ko?'목록 접기':'Collapse list'} aria-controls="campus-list" aria-expanded="true"><PanelLeftClose size={18}/></button></div><p className="campus-list-help"><MapPin size={12}/>{ko?'목록으로 위치 확인 · 마커로 3D 보기':'List to locate · markers to explore in 3D'}</p><div className="map-site-list">{st.data.sites.map(s=>{
 const loc=locationFor(s,st.data.raw.research),target=milestonesAt(st.data.raw.research,s.id,st.month).find(m=>!m.completion)
 return <button key={s.id} aria-pressed={st.selectedSiteId===s.id} onClick={()=>st.focusSiteOnMap(s.id)}><span className="map-site-top"><b>{pickName(s,st.lang)}</b><small>{s.country}</small></span><span className="map-site-status"><i className="dot" style={{background:styleOf(s.status).color}}/>{t.status[s.status]}<strong>{s.grid_mw?`${s.grid_mw.toLocaleString()} MW`:'—'}</strong></span><small>{loc.precise?(ko?'주소 위치':'Address location'):(ko?'지역 위치 · 부지 미확인':'Region · parcel unverified')}</small>{target&&<small className="map-next">{ko?'목표':'Target'} · {target.latest?.target}</small>}</button>})}</div><div className="map-list-note">{ko?'지도는 지리적 위치를, 3D는 사업 구성을 보여줍니다.':'Map shows geography. 3D explains the business layout.'}</div></aside></>
}
