import { useMemo, useEffect } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { PlaneGeometry, Float32BufferAttribute, Color } from 'three'
import { landscapePlants, terrainHeight } from '../campusLandscape.js'

function LandscapeGround({ side, profile }) {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(side * 2.7, side * 2.7, 48, 48)
    geo.rotateX(-Math.PI / 2)
    const positions = geo.attributes.position, colors = []
    const earth = new Color(profile.soil), field = new Color(profile.field), bg = new Color(profile.background)
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      const noise = .5 + Math.sin(x * .14 + Math.cos(z * .18)) * .25 + Math.cos(z * .19 - x * .08) * .2
      const fade = Math.min(1, Math.max(0, (Math.hypot(x, z) / side - .87) / .38))
      positions.setY(i, terrainHeight(x, z, side, profile.relief))
      const color = earth.clone().lerp(field, noise).lerp(bg, fade)
      colors.push(color.r, color.g, color.b, 1 - fade * fade * (3 - 2 * fade))
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 4))
    geo.computeVertexNormals()
    return geo
  }, [side, profile])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors transparent depthWrite={false} roughness={1}/></mesh>
}

function Vegetation({ plants, profile }) {
  const trees = plants.filter(p => p.type === 0), shrubs = plants.filter(p => p.type === 1), grass = plants.filter(p => p.type === 2)
  const conifers = profile.type === 'forest' ? trees.filter((_, i) => !profile.mixed || i % 4 !== 0) : []
  const broadleaf = profile.type === 'forest' ? trees.filter((_, i) => profile.mixed && i % 4 === 0) : trees
  return <group>
    <Instances frames={1} limit={trees.length} castShadow>
      <cylinderGeometry args={[.1, .15, 1.7, 5]}/><meshStandardMaterial color={profile.trunk} roughness={1}/>
      {trees.map((p, i) => <Instance key={i} position={[p.x,p.y+.85*p.scale,p.z]} scale={p.scale}/>)}
    </Instances>
    {conifers.length > 0 && <Instances frames={1} limit={conifers.length * 2} castShadow receiveShadow>
      <coneGeometry args={[.9, 2.2, 7]}/><meshStandardMaterial roughness={1}/>
      {conifers.flatMap((p, i) => [0,1].map(t => <Instance key={`${i}-${t}`} color={p.color} position={[p.x,p.y+(1.65+t*.8)*p.scale,p.z]} scale={[p.scale*(1-t*.2),p.scale,p.scale*(1-t*.2)]} rotation={[0,p.angle,0]}/>))}
    </Instances>}
    {broadleaf.length > 0 && <Instances frames={1} limit={broadleaf.length * 3} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]}/><meshStandardMaterial roughness={1}/>
      {broadleaf.flatMap((p, i) => [0,1,2].map(t => <Instance key={`${i}-${t}`} color={p.color} position={[p.x+Math.cos(p.angle+t*2.1)*.45*p.scale,p.y+(1.45+(t===0?.35:0))*p.scale,p.z+Math.sin(p.angle+t*2.1)*.45*p.scale]} scale={[p.scale*.85,p.scale*.65,p.scale*.85]} rotation={[0,p.angle,0]}/>))}
    </Instances>}
    <Instances frames={1} limit={shrubs.length} castShadow>
      <icosahedronGeometry args={[1, 0]}/><meshStandardMaterial roughness={1}/>
      {shrubs.map((p,i)=><Instance key={i} color={p.color} position={[p.x,p.y+p.scale*.35,p.z]} scale={[p.scale,p.scale*.55,p.scale*.8]} rotation={[0,p.angle,0]}/>)}
    </Instances>
    <Instances frames={1} limit={grass.length * 2}>
      <coneGeometry args={[.45,1,3]}/><meshStandardMaterial color={profile.grass} roughness={1}/>
      {grass.flatMap((p,i)=>[0,1].map(t=><Instance key={`${i}-${t}`} position={[p.x+t*.15,p.y+p.scale*.4,p.z]} scale={[p.scale,p.scale,p.scale]} rotation={[.12,p.angle+t,.12]}/>))}
    </Instances>
  </group>
}

function WindTurbine({ position, scale = 1 }) {
  // Distant landscape reference only; deliberately not connected to campus power flows.
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0,3.7,0]}><cylinderGeometry args={[.11,.24,7.4,8]}/><meshStandardMaterial color="#e7eae0" roughness={.8}/></mesh>
    <mesh position={[0,7.4,0]}><boxGeometry args={[.5,.4,.85]}/><meshStandardMaterial color="#e7eae0"/></mesh>
    <group position={[0,7.4,.5]} rotation={[0,0,.3]}>
      {[0,1,2].map(i=><group key={i} rotation={[0,0,i*Math.PI*2/3]}><mesh position={[0,1.4,0]} rotation={[0,0,-.07]}><boxGeometry args={[.16,2.8,.07]}/><meshStandardMaterial color="#e7eae0" roughness={.8}/></mesh></group>)}
      <mesh><sphereGeometry args={[.2,8,6]}/><meshStandardMaterial color="#d9e0d7"/></mesh>
    </group>
  </group>
}

export default function CampusLandscape({ siteId, layout, profile }) {
  const {side, road, powerLine} = layout
  const plants = useMemo(() => landscapePlants(siteId, side, road.z, powerLine.from[1], profile), [siteId,side,road.z,powerLine.from[1],profile])
  return <group name="regional-landscape">
    <LandscapeGround side={side} profile={profile}/>
    <Vegetation plants={plants} profile={profile}/>
    {/* Cleared perimeter separates the facility from native vegetation. */}
    {[-1,1].map(s=><group key={s}>
      <mesh position={[s*(side/2+.65),-.16,0]} receiveShadow><boxGeometry args={[1.3,.1,side]}/><meshStandardMaterial color={profile.ground} roughness={1}/></mesh>
      <mesh position={[0,-.16,s*(side/2+.65)]} receiveShadow><boxGeometry args={[side+2.6,.1,1.3]}/><meshStandardMaterial color={profile.ground} roughness={1}/></mesh>
    </group>)}
    {profile.turbines && [-1,0,1].map((v,i)=><WindTurbine key={i} position={[v*side*.47,0,-side*.96]} scale={.85+i*.1}/>)}
    {profile.ridges && [-1,0,1].map((v,i)=><mesh key={i} position={[v*side*.52,-1.5,-side*1.2]} scale={[side*.42,side*(.09+i*.025),side*.22]}>
      <icosahedronGeometry args={[1,1]}/><meshStandardMaterial color={['#9bab9d','#a9b9ad','#b6c3b7'][i]} roughness={1} flatShading/>
    </mesh>)}
  </group>
}
