import { Instance, Instances } from '@react-three/drei'

const pads = [
  [0,.52,0,.43,.6,0], [-.35,.94,0,.32,.48,.48], [.36,1.12,.03,.35,.51,-.42],
  [-.55,1.43,0,.28,.42,.16], [.5,1.7,.03,.27,.38,-.18],
]

export default function TexasVegetation({ trees, cacti, trunk }) {
  return <group name="texas-vegetation">
    {trees.length > 0 && <>
      {/* Low forked trunks and a broad, airy crown distinguish mesquite from forest trees. */}
      <Instances frames={1} limit={trees.length*3} castShadow>
        <cylinderGeometry args={[.055,.11,1.5,5]}/><meshStandardMaterial color={trunk} roughness={1}/>
        {trees.flatMap((p,i)=>[0,1,2].map(t=>{
          const angle = p.angle + t*Math.PI*2/3
          return <Instance key={`${i}-${t}`} position={[p.x+Math.cos(angle)*.3*p.scale,p.y+.67*p.scale,p.z-Math.sin(angle)*.3*p.scale]}
            scale={p.scale} rotation={[0,angle,-.5]}/>
        }))}
      </Instances>
      <Instances frames={1} limit={trees.length*4} castShadow receiveShadow>
        <icosahedronGeometry args={[1,1]}/><meshStandardMaterial roughness={1} flatShading/>
        {trees.flatMap((p,i)=>[0,1,2,3].map(t=>{
          const angle=p.angle+t*Math.PI*2/3, outer=t<3
          return <Instance key={`${i}-${t}`} color={p.color} position={[p.x+(outer?Math.cos(angle)*.64*p.scale:0),p.y+(outer?1.3:1.53)*p.scale,p.z-(outer?Math.sin(angle)*.64*p.scale:0)]}
            scale={[p.scale*(outer?.91:.72),p.scale*.32,p.scale*(outer?.67:.72)]} rotation={[0,angle,0]}/>
        }))}
      </Instances>
    </>}
    {cacti.length > 0 && <>
      {/* Flat oval pads, rather than tall desert columns, identify prickly pear. */}
      <Instances frames={1} limit={cacti.length*pads.length} castShadow receiveShadow>
        <sphereGeometry args={[1,8,6]}/><meshStandardMaterial roughness={1} flatShading/>
        {cacti.flatMap((p,i)=>pads.map(([x,y,z,sx,sy,tilt],j)=><Instance key={`${i}-${j}`}
          color={j%2?'#79916a':'#667e55'} position={[p.x+(x*Math.cos(p.angle)+z*Math.sin(p.angle))*p.scale,p.y+y*p.scale,p.z+(-x*Math.sin(p.angle)+z*Math.cos(p.angle))*p.scale]}
          scale={[sx*p.scale,sy*p.scale,.14*p.scale]} rotation={[0,p.angle,tilt]}/>))}
      </Instances>
      <Instances frames={1} limit={cacti.length}>
        <sphereGeometry args={[1,6,5]}/><meshStandardMaterial color="#ad6252" roughness={1}/>
        {cacti.map((p,i)=><Instance key={i} position={[p.x+.54*Math.cos(p.angle)*p.scale,p.y+2.04*p.scale,p.z-.54*Math.sin(p.angle)*p.scale]} scale={[.1*p.scale,.14*p.scale,.1*p.scale]}/>)}
      </Instances>
    </>}
  </group>
}
