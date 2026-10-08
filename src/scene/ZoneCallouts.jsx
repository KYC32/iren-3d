import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import Html from './SafeHtml.jsx'
import { campusViewport } from './campusCamera.js'
import { placeZoneCallouts } from './zoneCalloutLayout.js'
import { CustomerLogo } from '../ui/logos/index.jsx'

const origin = () => [0,0]
export default function ZoneCallouts({zones,side,selectedKey,onSelect,lang}){
  const size=useThree(s=>s.size), buttons=useRef({}), paths=useRef({}), dots=useRef({})
  const point=useMemo(()=>new Vector3(),[])
  useFrame(({camera,size})=>{
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
