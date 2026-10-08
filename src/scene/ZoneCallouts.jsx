import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Matrix4, Vector3 } from 'three'
import Html from './SafeHtml.jsx'
import { campusViewport } from './campusCamera.js'
import { placeZoneCallouts } from './zoneCalloutLayout.js'
import { CustomerLogo } from '../ui/logos/index.jsx'

// =============================================================
// ZoneCallouts — 고객 계약 구역(Microsoft·NVIDIA 등) 배지를 캠퍼스 밖 여백에 띄우고
//                구역 중심까지 점선으로 잇는 HTML 오버레이
// -------------------------------------------------------------
// 화면 좌표 계산(3D → 2D 투영)과 겹침 없는 자리 찾기(placeZoneCallouts)는 꽤 무거워서
// 카메라나 화면 크기가 바뀔 때만 다시 계산합니다. (가만히 있을 땐 0.5초에 한 번만 — 배지 글자 크기 변화 대비)
// =============================================================
const origin = () => [0,0] // Html 을 화면 왼쪽 위(0,0)에 고정 → 안쪽에서 직접 픽셀 좌표로 배치
const IDLE_REFRESH = 0.5   // 카메라가 멈춰 있을 때 다시 계산하는 간격 (초)
export default function ZoneCallouts({zones,side,selectedKey,onSelect,lang}){
  const size=useThree(s=>s.size), buttons=useRef({}), paths=useRef({}), dots=useRef({})
  const point=useMemo(()=>new Vector3(),[])
  // 마지막으로 계산했을 때의 카메라 행렬·화면 크기·구역 목록·시각 → 같으면 계산을 건너뜀
  const last=useRef({ matrix: new Matrix4(), w: 0, h: 0, zones: null, sel: null, t: -Infinity })
  useFrame(({camera,size,clock})=>{
    const L=last.current
    const same=L.matrix.equals(camera.matrixWorld)&&L.w===size.width&&L.h===size.height&&L.zones===zones&&L.sel===selectedKey
    if(same&&clock.elapsedTime-L.t<IDLE_REFRESH)return
    L.matrix.copy(camera.matrixWorld);L.w=size.width;L.h=size.height;L.zones=zones;L.sel=selectedKey;L.t=clock.elapsedTime
    const project=(x,y,z)=>{point.set(x,y,z).project(camera);return {x:(point.x+1)*size.width/2,y:(1-point.y)*size.height/2,z:point.z}}
    const half=side/2
    const footprint=[[-half,-half],[half,-half],[half,half],[-half,half]].map(([x,z])=>project(x,0,z))
    const safe=campusViewport(size.width,size.height)
    const items=zones.flatMap(zone=>{
      const button=buttons.current[zone.key]
      if(!button)return []
      const anchor=project(zone.blocks.reduce((n,b)=>n+b.x,0)/zone.blocks.length,.4,zone.blocks.reduce((n,b)=>n+b.z,0)/zone.blocks.length)
      if(anchor.z < -1 || anchor.z>1 || anchor.x<safe.left || anchor.x>safe.right || anchor.y<safe.top || anchor.y>safe.bottom)return []
      return [{key:zone.key,anchor,width:button.offsetWidth,height:button.offsetHeight}]
    })
    const placed=placeZoneCallouts(items,footprint,safe)
    for(const zone of zones){
      const button=buttons.current[zone.key],path=paths.current[zone.key],dot=dots.current[zone.key]
      if(!button||!path||!dot)continue
      const p=placed.find(x=>x.key===zone.key)
      button.style.visibility=path.style.visibility=dot.style.visibility=p?'visible':'hidden'
      if(!p)continue
      button.style.transform=`translate(${p.rect.left}px,${p.rect.top}px)`
      const sx=p.side==='left'?p.rect.right:p.rect.left,sy=(p.rect.top+p.rect.bottom)/2
      const bend=(sx+p.anchor.x)/2
      path.setAttribute('d',`M ${sx} ${sy} C ${bend} ${sy}, ${bend} ${p.anchor.y}, ${p.anchor.x} ${p.anchor.y}`)
      dot.setAttribute('cx',p.anchor.x);dot.setAttribute('cy',p.anchor.y)
    }
  })
  return <Html calculatePosition={origin} zIndexRange={[15,15]} style={{pointerEvents:'none'}}>
    <div className="zone-callout-layer" style={{width:size.width,height:size.height}}>
      <svg width={size.width} height={size.height} aria-hidden="true">{zones.map(z=><g key={z.key} opacity={selectedKey&&selectedKey!==z.key? .35:1}>
        <path ref={el=>{paths.current[z.key]=el}} fill="none" stroke={z.color} strokeWidth={selectedKey===z.key?2:1.4} strokeDasharray="3 5" strokeLinecap="round"/>
        <circle ref={el=>{dots.current[z.key]=el}} r="3.2" fill={z.color} stroke="white" strokeWidth="1.5"/>
      </g>)}</svg>
      {zones.map(z=><button key={z.key} ref={el=>{buttons.current[z.key]=el}} type="button" className={`zone-badge campus-callout${selectedKey===z.key?' is-selected':''}`} aria-label={`${z.name} ${lang==='ko'?'구역':'zone'}`} aria-pressed={selectedKey===z.key} onClick={e=>{e.stopPropagation();onSelect(z.key)}} style={{borderColor:z.color,color:z.color,opacity:selectedKey&&selectedKey!==z.key? .5:1}}>
        {z.logo&&<CustomerLogo name={z.logo} size={14}/>}<b>{z.name}</b>
      </button>)}
    </div>
  </Html>
}
