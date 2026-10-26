import { X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
maplibregl.setWorkerUrl(workerUrl)
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { locationFor } from '../data/research.js'
import { siteFeatures, MAP_HOME_CENTER, MAP_WORLD_BOUNDS, mapLongitude, minimumMapZoom, regionBounds, hqLngLat } from './mapData.js'
import CampusMarkers from './CampusMarkers.jsx'
import HqMarker from './HqMarker.jsx' // 시드니 본사 카드 (CEO 사진·새 발언 수, 누르면 본사 3D 화면)
import ProspectMarkers from './ProspectMarkers.jsx' // '?' 카드: 회사 발표 없이 정황만 있는 지역 (앨버타)
// '주변 데이터센터' 층(IM3 Atlas, ODbL): 지도를 띄운 뒤 따로 불러옴 → 지도 묶음 크기 한도에 들지 않음
const DataCenterLayer = lazy(() => import('./DataCenterLayer.jsx'))
import { applyBasemapLabels } from './basemapStyle.js'
import { campusPanelLayout } from '../ui/panelLayout.js'

export default function GeoMap() {
  const container = useRef(null), mapRef = useRef(null), firstSelection = useRef(true), firstRegion = useRef(true), restoredCamera = useRef(useAppStore.getState().mapCamera)
  const [loaded,setLoaded] = useState(false), [error,setError] = useState(false), [group,setGroup] = useState(null)
  const data = useAppStore(s=>s.data), site = useAppStore(selectSelectedSite)
  const region = useAppStore(s=>s.mapRegion), lang = useAppStore(s=>s.lang)
  const hq = data?.companies?.[0]?.hq // 본사 위치 (data/companies.json — 10-K 주소)
  const focusSeq=useAppStore(s=>s.mapFocusSeq), initialFocusSeq=useRef(focusSeq)
  const panelCollapsed=useAppStore(s=>s.campusPanelCollapsed)
  const previousLayout=useRef({collapsed:panelCollapsed,siteId:site?.id,focusSeq})
  const padding = () => {
    const width = window.innerWidth
    const list = document.querySelector('.map-sidebar')?.getBoundingClientRect()
    const detail = campusPanelLayout()
    if (width < 768 || detail?.bottomDocked) return { top:235, bottom:detail?window.innerHeight-detail.rect.top+18:150, left:105, right:105 }
    return { top:detail?.collapsed?Math.max(260,detail.rect.bottom+30):260, bottom:160, left:list?.width?list.right+85:100, right:detail&&!detail.collapsed?width-detail.rect.left+85:100 }
  }
  useEffect(()=>{
    let alive = true, map, resizeObserver
    setLoaded(false)
    setError(false)
    try {
      const saved=useAppStore.getState().mapCamera
      const center=saved ? [mapLongitude(saved.center[0]),saved.center[1]] : MAP_HOME_CENTER
      // Wrapped tiles join the Pacific; bounds and a viewport-sized minimum zoom
      // keep the user inside one world instead of letting it repeat horizontally.
      map = new maplibregl.Map({container:container.current,style:'https://tiles.openfreemap.org/styles/positron',center,zoom:saved?.zoom ?? 2.5,
        bearing:0,pitch:0,maxPitch:0,dragRotate:false,touchPitch:false,renderWorldCopies:true,maxBounds:MAP_WORLD_BOUNDS,
        minZoom:minimumMapZoom(container.current.clientWidth,container.current.clientHeight),attributionControl:{compact:true}})
      mapRef.current=map
      map.touchZoomRotate.disableRotation()
      map.keyboard.disableRotation()
      map.on('style.load',()=>applyBasemapLabels(map))
      if(saved?.padding){
        const sameViewport=saved.viewport?.[0]===window.innerWidth&&saved.viewport?.[1]===window.innerHeight
        map.jumpTo({center,zoom:saved.zoom,padding:sameViewport?saved.padding:padding()})
      }
      resizeObserver=new ResizeObserver(()=>{
        // A queued resize may arrive after React detaches the map for 3D.
        if (!alive || !container.current) return
        map.setMinZoom(minimumMapZoom(container.current.clientWidth,container.current.clientHeight))
        map.resize()
      })
      resizeObserver.observe(container.current)
      map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'bottom-right')
      // MapLibre 는 타일·글꼴 하나만 실패해도 error 를 보냄 → 처음 불러오기(load) 전 오류만 화면에 알림
      // (불러온 뒤의 일시적인 타일 실패로 정상 지도 위에 오류 문구가 계속 남던 문제)
      let didLoad=false
      map.on('error',(e)=>{if(!alive)return;if(didLoad){console.warn('지도 타일 오류(무시):',e?.error?.message);return}setError(true);window.__bootReady?.()})
      map.on('load',()=>{
        if (!alive) return
        map.addSource('campuses',{type:'geojson',data:siteFeatures(useAppStore.getState().data.sites,useAppStore.getState().data.raw.research),cluster:true,clusterRadius:85,clusterMaxZoom:17})
        map.addLayer({id:'campus-anchors',type:'circle',source:'campuses',paint:{'circle-radius':1,'circle-opacity':0}})
        didLoad=true;setLoaded(true);setError(false)
        window.__bootReady?.() // 부팅 화면(GPU 랙) → 지도로
      })
      map.on('moveend',()=>{if(alive)useAppStore.getState().setMapCamera({center:map.getCenter().toArray(),zoom:map.getZoom(),padding:map.getPadding(),viewport:[window.innerWidth,window.innerHeight]})})
    } catch {setError(true);window.__bootReady?.()}
    return ()=>{alive=false;resizeObserver?.disconnect();map?.remove();mapRef.current=null}
  },[])
  useEffect(()=>{if(loaded)mapRef.current?.getSource('campuses')?.setData(siteFeatures(data.sites,data.raw.research))},[loaded,data])
  useEffect(()=>{
    if(!loaded || !site || !mapRef.current?.getSource('campuses'))return
    if(firstSelection.current && restoredCamera.current && focusSeq===initialFocusSeq.current){firstSelection.current=false;return}
    firstSelection.current=false
    const l=locationFor(site,data.raw.research)
    mapRef.current.flyTo({center:[mapLongitude(l.lng),l.lat],zoom:l.maxZoom,padding:padding(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:900})
    setGroup(null)
  },[loaded,site?.id,focusSeq])
  useEffect(()=>{
    const previous=previousLayout.current
    previousLayout.current={collapsed:panelCollapsed,siteId:site?.id,focusSeq}
    // Campus navigation already fits the new panel; do not interrupt its flight.
    if(previous.collapsed===panelCollapsed||previous.siteId!==site?.id||previous.focusSeq!==focusSeq)return
    if(loaded&&site)mapRef.current?.easeTo({padding:padding(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250})
  },[loaded,panelCollapsed,site?.id,focusSeq])
  useEffect(()=>{
    if(!loaded || !mapRef.current?.getSource('campuses'))return
    const initialRegion=firstRegion.current
    firstRegion.current=false
    // A saved map or a campus deep link takes precedence over the initial overview.
    if(initialRegion&&(restoredCamera.current||site))return
    // 본사: '본사' 단추(또는 본사 3D 화면에서 처음 지도로 돌아옴 — 지역이 '본사') → 시드니 본사로 날아감 (범위가 아니라 한 점)
    const country=region.country
    const still=initialRegion||window.matchMedia('(prefers-reduced-motion: reduce)').matches // 처음 화면·움직임 줄이기 = 바로 이동
    if(country==='HQ'){
      if(hq)mapRef.current.flyTo({center:hqLngLat(hq),zoom:9,padding:padding(),duration:still?0:900})
      setGroup(null)
      return
    }
    // 그 밖의 지역: 캠퍼스 범위 ('호주'·'전체'는 본사도 함께 — mapData.regionBounds)
    const bounds=regionBounds(country,data.sites,data.raw.research,hq)
    const fitPadding=padding()
    if(country==='ALL'&&window.innerWidth>=768){fitPadding.left+=80;fitPadding.right+=80}
    if(bounds)mapRef.current.fitBounds(bounds,{padding:fitPadding,maxZoom:6,duration:still?0:700})
    setGroup(null)
  },[loaded,region])
  return <div className="geo-map">
    <div className="geo-map-canvas" ref={container} role="region" aria-label={lang==='ko'?'실제 지리 지도':'Geographic map'} />
    {loaded && mapRef.current && <CampusMarkers map={mapRef.current} data={data} lang={lang} selectedId={site?.id} onGroup={setGroup}/> }
    {loaded && mapRef.current && hq && <HqMarker map={mapRef.current} hq={hq} lang={lang}/>}
    {loaded && mapRef.current && data?.raw?.prospects && <ProspectMarkers map={mapRef.current} prospects={data.raw.prospects} lang={lang}/>}
    {loaded && mapRef.current && <Suspense fallback={null}><DataCenterLayer map={mapRef.current} lang={lang}/></Suspense>}
    {error && <div className="map-error" role="status">{lang==='ko'?'지도를 불러오지 못했습니다. 캠퍼스 목록과 상세 정보는 계속 사용할 수 있습니다.':'Map unavailable. Campus list and details remain available.'}</div>}
    {!loaded&&!error&&<div className="map-loading">{lang==='ko'?'실제 지도 불러오는 중…':'Loading map…'}</div>}
    {group&&<div className="map-group panel"><button className="close-small" onClick={()=>setGroup(null)} aria-label={lang==='ko'?'닫기':'Close'}><X size={14} aria-hidden="true"/></button><b>{lang==='ko'?'이 지역의 캠퍼스':'Campuses in this area'}</b>{group.map(s=><button key={s.id} onClick={()=>{useAppStore.getState().enterSite3D(s.id);setGroup(null)}}>{lang==='ko'?s.name_ko:s.name}</button>)}</div>}
    <div className="map-caption">{lang==='ko'?'현재 제공 지도 · 위치 표시는 확인한 주소·필지의 중심(또는 지역 중심)이며 부지 경계가 아닙니다':'Current basemap · markers show verified address or parcel centres (or a regional centre), not site boundaries'}</div>
  </div>
}
