import { useMemo } from 'react'
import { Instances, Instance, Line } from '@react-three/drei'
import { styleOf } from '../../data/statusStyle.js'

// Repeated shed forms reflect the official Childress photographs.
// Each capacity block remains a schematic group, not a claim about actual building count.
export function PhotoMiningHall({ w, d, h, appearance, status }) {
  const shedW = w * 0.27, shedD = d * 0.97, height = h * 0.85
  const rows = [-1, 0, 1].map(i => i * w / 3)
  const vents = rows.flatMap(x => [-0.34, -0.11, 0.11, 0.34].map(z => [x, height + 0.2, z * shedD]))
  const color = status === 'decommissioning' ? '#a8afad' : appearance.wall
  return <group>
    <Instances limit={3} castShadow receiveShadow>
      <boxGeometry args={[shedW, height, shedD]}/><meshStandardMaterial color={color} roughness={0.82}/>
      {rows.map(x=><Instance key={x} position={[x,height/2,0]}/>)}
    </Instances>
    <Instances limit={6} castShadow>
      <boxGeometry args={[shedW*.53,.07,shedD+.08]}/><meshStandardMaterial color={appearance.roof} roughness={.65} metalness={.18}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x+s*shedW*.25,height+.025,0]} rotation={[0,0,-s*.12]}/>))}
    </Instances>
    <Instances limit={6}>
      <boxGeometry args={[shedW*.94,height*.88,.035]}/><meshStandardMaterial color={appearance.endWall} roughness={.8}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x,height*.44,s*shedD/2]}/>))}
    </Instances>
    <Instances limit={vents.length} castShadow>
      <cylinderGeometry args={[shedW*.2,shedW*.23,.22,12]}/><meshStandardMaterial color="#c2ceca" roughness={.65} metalness={.25}/>
      {vents.map((p,i)=><Instance key={i} position={p}/>)}
    </Instances>
    <Instances limit={vents.length}>
      <cylinderGeometry args={[shedW*.15,shedW*.15,.025,12]}/><meshStandardMaterial color="#546967" roughness={.85}/>
      {vents.map(([x,y,z],i)=><Instance key={i} position={[x,y+.12,z]}/>)}
    </Instances>
    <Instances limit={6}>
      <boxGeometry args={[.045,height*.6,shedD*.9]}/><meshStandardMaterial color="#4c625f" roughness={.95}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x+s*shedW/2,height*.44,0]}/>))}
    </Instances>
    <mesh position={[0,.04,d/2+.17]}><boxGeometry args={[w,.04,.14]}/><meshBasicMaterial color={styleOf(status).color}/></mesh>
  </group>
}

export function DryCampusGround({ layout, appearance }) {
  const half=layout.side/2, edge=half-.35
  const posts=useMemo(()=>{
    const points=[]
    for(let x=-edge;x<=edge;x+=2.1) points.push([x,.47,-edge])
    for(let z=-edge;z<layout.road.z-2;z+=2.1) points.push([-edge,.47,z],[edge,.47,z])
    return points
  },[edge,layout.road.z])
  const border=[[-edge,0,layout.road.z-2],[-edge,0,-edge],[edge,0,-edge],[edge,0,layout.road.z-2]]
  return <group>
    {/* The fence and service apron are schematic, not surveyed positions. */}
    <Instances limit={posts.length} castShadow>
      <boxGeometry args={[.065,.94,.065]}/><meshStandardMaterial color={appearance.steel} roughness={.8}/>
      {posts.map((p,i)=><Instance key={i} position={p}/>)}
    </Instances>
    {[.18,.5,.85].map(y=><Line key={y} points={border.map(([x,,z])=>[x,y,z])} color={appearance.steel} lineWidth={.7} transparent opacity={.7}/>)}
    {/* Gravel service apron in the reserved utility strip. */}
    <mesh position={[layout.substation.x,.015,layout.substation.z+5]} receiveShadow>
      <boxGeometry args={[4.5,.035,4]}/><meshStandardMaterial color="#c6c6b8" roughness={1}/>
    </mesh>
  </group>
}
