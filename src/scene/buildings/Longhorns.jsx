import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, CircleGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { longhornPose } from '../longhornMotion.js'
import { useReducedMotion } from '../useReducedMotion.js'

function hornGeometry() {
  const curve = new CatmullRomCurve3([
    new Vector3(.18,.24,.17), new Vector3(.62,.19,.12),
    new Vector3(1.15,.27,.05), new Vector3(1.52,.49,.09), new Vector3(1.68,.72,.16),
  ])
  const geometry = new TubeGeometry(curve,16,.14,6,false)
  const vertices = geometry.attributes.position
  for (let ring = 0; ring <= 16; ring++) {
    const center = curve.getPointAt(ring / 16), taper = 1 - .98 * ring / 16
    for (let j = 0; j <= 6; j++) {
      const i = ring * 7 + j
      vertices.setXYZ(i, center.x + (vertices.getX(i)-center.x)*taper,
        center.y + (vertices.getY(i)-center.y)*taper, center.z + (vertices.getZ(i)-center.z)*taper)
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function Longhorn({ index, side, relief, assets, reducedMotion }) {
  const root = useRef(), head = useRef(), tail = useRef(), legs = useRef([]), shadow = useRef()
  const rest = longhornPose(0,index,side,relief,true)
  const coat = index === 0 ? assets.rust : assets.cream
  const patch = index === 0 ? assets.cream : assets.rust
  useFrame(({ clock }) => {
    const pose = longhornPose(clock.elapsedTime,index,side,relief,reducedMotion)
    root.current.position.set(pose.x,pose.y,pose.z)
    root.current.rotation.y = pose.heading
    head.current.rotation.x = pose.head
    tail.current.rotation.z = pose.tail
    legs.current.forEach((leg,i) => { if (leg) leg.rotation.x = pose.stride * (i === 0 || i === 3 ? 1 : -1) })
    shadow.current.position.set(pose.x,pose.y-.045,pose.z)
    shadow.current.rotation.z = pose.heading
  })
  const part = (position,scale,material=coat,rotation) => <mesh geometry={assets.sphere} material={material} position={position} scale={scale} rotation={rotation} castShadow/>
  return <group name={`longhorn-${index}`}>
    <mesh ref={shadow} geometry={assets.shadowGeometry} material={assets.shadowMaterial} rotation={[-Math.PI/2,0,rest.heading]} position={[rest.x,rest.y-.045,rest.z]} scale={[.67*rest.scale,1.5*rest.scale,1]}/>
    <group ref={root} position={[rest.x,rest.y,rest.z]} rotation={[0,rest.heading,0]} scale={rest.scale}>
      {part([0,1.22,-.1],[.55,.57,1.02])}
      {part([0,1.31,.54],[.48,.59,.46])}
      {part([0,.97,.68],[.26,.32,.33])}
      {[-1,1].map(s=><group key={s}>
        {/* Irregular cream/russet patches read as cattle even in the campus overview. */}
        {part([s*.5,1.3,-.36],[.075,.33,.44],patch,[0,0,s*.12])}
        {part([s*.49,1.16,.25],[.085,.26,.24],patch,[0,0,-s*.2])}
      </group>)}
      <group ref={head} position={[0,1.28,.68]} rotation={[rest.head,0,0]}>
        {part([0,-.02,.26],[.29,.34,.38])}
        {part([0,-.2,.62],[.22,.25,.47],coat,[.22,0,0])}
        {part([0,-.13,.59],[.12,.23,.4],patch,[.22,0,0])}
        {part([0,-.32,1.01],[.26,.17,.2],assets.muzzle)}
        {[-1,1].map(s=><group key={s}>
          <group scale={[s,1,1]}><mesh geometry={assets.horn} material={assets.ivory} castShadow/></group>
          {part([s*.42,.05,.24],[.24,.08,.12],coat,[0,0,s*.15])}
          {part([s*.256,.04,.45],[.033,.04,.043],assets.dark)}
          {part([s*.12,-.28,1.17],[.043,.025,.02],assets.dark)}
        </group>)}
      </group>
      {[-1,1].flatMap((s,j)=>[-1,1].map((end,k)=>{
        const i=j*2+k
        return <group key={i} ref={el=>{legs.current[i]=el}} position={[s*.36,.98,end*.67-.07]}>
          {part([0,-.2,0],[.15,.3,.17])}
          <mesh geometry={assets.cylinder} material={coat} position={[0,-.57,.025]} scale={[.085,.55,.085]} castShadow/>
          {part([0,-.89,.045],[.12,.1,.16],assets.dark)}
        </group>
      }))}
      <group ref={tail} position={[0,1.48,-1.01]}>
        <mesh geometry={assets.cylinder} material={coat} position={[0,-.43,-.09]} scale={[.045,.9,.045]} rotation={[.18,0,0]} castShadow/>
        {part([0,-.87,-.17],[.09,.18,.075],assets.dark)}
      </group>
    </group>
  </group>
}

export default function Longhorns({ side, relief }) {
  const reducedMotion = useReducedMotion()
  const assets = useMemo(()=>({
    sphere: new SphereGeometry(1,10,7), cylinder: new CylinderGeometry(1,1,1,6), horn: hornGeometry(),
    shadowGeometry: new CircleGeometry(1,20), shadowMaterial: new MeshBasicMaterial({color:'#65553e',transparent:true,opacity:.13,depthWrite:false}),
    rust: new MeshStandardMaterial({color:'#9e5230',roughness:1}), cream: new MeshStandardMaterial({color:'#f2e5cc',roughness:1}),
    ivory: new MeshStandardMaterial({color:'#ded3b9',roughness:.9}), dark: new MeshStandardMaterial({color:'#41372e',roughness:1}),
    muzzle: new MeshStandardMaterial({color:'#90735e',roughness:1}),
  }),[])
  useEffect(()=>()=>Object.values(assets).forEach(asset=>asset.dispose()),[assets])
  return <group name="texas-longhorns" dispose={null}>{[0,1].map(index=><Longhorn key={index} index={index} side={side} relief={relief} assets={assets} reducedMotion={reducedMotion}/>)}</group>
}
