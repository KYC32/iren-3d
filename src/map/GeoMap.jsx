import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
maplibregl.setWorkerUrl(workerUrl)
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { locationFor } from '../data/research.js'
import { siteFeatures, boundsFor, MAP_HOME_CENTER, MAP_WORLD_BOUNDS, mapLongitude, minimumMapZoom } from './mapData.js'
import CampusMarkers from './CampusMarkers.jsx'
import { applyBasemapLabels } from './basemapStyle.js'
import { campusPanelLayout } from '../ui/panelLayout.js'

export default function GeoMap() {
  const container = useRef(null), mapRef = useRef(null), firstSelection = useRef(true), firstRegion = useRef(true), restoredCamera = useRef(useAppStore.getState().mapCamera)
  const [loaded,setLoaded] = useState(false), [error,setError] = useState(false), [group,setGroup] = useState(null)
  const data = useAppStore(s=>s.data), site = useAppStore(selectSelectedSite)
  const region = useAppStore(s=>s.mapRegion), lang = useAppStore(s=>s.lang)
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
      map.on('error',(e)=>{if(!alive)return;if(didLoad){console.warn('지도 타일 오류(무시):',e?.error?.message);return}setError(true)})
      map.on('load',()=>{
        if (!alive) return
        map.addSource('campuses',{type:'geojson',data:siteFeatures(useAppStore.getState().data.sites,useAppStore.getState().data.raw.research),cluster:true,clusterRadius:85,clusterMaxZoom:17})
        map.addLayer({id:'campus-anchors',type:'circle',source:'campuses',paint:{'circle-radius':1,'circle-opacity':0}})
        didLoad=true;setLoaded(true);setError(false)
      })
      map.on('moveend',()=>{if(alive)useAppStore.getState().setMapCamera({center:map.getCenter().toArray(),zoom:map.getZoom(),padding:map.getPadding(),viewport:[window.innerWidth,window.innerHeight]})})
    } catch {setError(true)}
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
    const selected=data.sites.filter(s=>region.country==='ALL'||(region.country==='NA'?['US','CA'].includes(s.country):s.country===region.country))
    const bounds=boundsFor(selected,data.raw.research,{centerLng:MAP_HOME_CENTER[0]})
    const fitPadding=padding()
    if(region.country==='ALL'&&window.innerWidth>=768){fitPadding.left+=80;fitPadding.right+=80}
    if(bounds)mapRef.current.fitBounds(bounds,{padding:fitPadding,maxZoom:6,duration:initialRegion||window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:700})
    setGroup(null)
  },[loaded,region])
  return <div className="geo-map">
    <div className="geo-map-canvas" ref={container} role="region" aria-label={lang==='ko'?'실제 지리 지도':'Geographic map'} />
    {loaded && mapRef.current && <CampusMarkers map={mapRef.current} data={data} lang={lang} selectedId={site?.id} onGroup={setGroup}/> }
    {error && <div className="map-error" role="status">{lang==='ko'?'지도를 불러오지 못했습니다. 캠퍼스 목록과 상세 정보는 계속 사용할 수 있습니다.':'Map unavailable. Campus list and details remain available.'}</div>}
    {!loaded&&!error&&<div className="map-loading">{lang==='ko'?'실제 지도 불러오는 중…':'Loading map…'}</div>}
    {group&&<div className="map-group panel"><button className="close-small" onClick={()=>setGroup(null)} aria-label={lang==='ko'?'닫기':'Close'}><X size={14} aria-hidden="true"/></button><b>{lang==='ko'?'이 지역의 캠퍼스':'Campuses in this area'}</b>{group.map(s=><button key={s.id} onClick={()=>{useAppStore.getState().enterSite3D(s.id);setGroup(null)}}>{lang==='ko'?s.name_ko:s.name}</button>)}</div>}
    <div className="map-caption">{lang==='ko'?'현재 제공 지도 · 지역 위치 표시는 부지 경계가 아닙니다':'Current basemap · Regional markers do not indicate parcel boundaries'}</div>
  </div>
}
