import { useMemo, useEffect, memo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { BufferGeometry, PlaneGeometry, Float32BufferAttribute, Color } from 'three'
import { REAL_TERRAIN_MARGIN, contourSegments, landscapePlants, terrainHeight } from '../campusLandscape.js'
import Kangaroos from './Kangaroos.jsx'
import Longhorns from './Longhorns.jsx'
import TexasVegetation from './TexasVegetation.jsx'

function LandscapeGround({ side, profile }) {
  const geometry = useMemo(() => {
    // 실측 지형은 도랑·둔덕이 보이도록 격자를 2배로 촘촘하게
    const segments = profile.realTerrain ? 96 : 48
    const geo = new PlaneGeometry(side * 2.7, side * 2.7, segments, segments)
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
    if (profile.realTerrain) {
      // 음영기복: 북서쪽에서 빛이 온다고 보고 경사면 색을 밝게·어둡게 (완만한 땅의 굴곡을 읽게 함)
      const normals = geo.attributes.normal, tint = geo.attributes.color
      for (let i = 0; i < normals.count; i++) {
        const lit = -normals.getX(i) * .6 - normals.getZ(i) * .6 + normals.getY(i) * .53
        const shade = 1 + Math.max(-.1, Math.min(.1, (lit - .53) * 2))
        tint.setXYZ(i, tint.getX(i) * shade, tint.getY(i) * shade, tint.getZ(i) * shade)
      }
    }
    return geo
  }, [side, profile])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors transparent depthWrite={false} roughness={1}/></mesh>
}

// 실측 등고선: 부지 밖 땅 위에 얇은 선으로 그림. 가장자리로 갈수록 땅처럼 사라짐
function Contours({ side, profile }) {
  const geometry = useMemo(() => {
    const points = [], colors = []
    const line = new Color('#6a5c44')
    const put = (x, z) => {
      const fade = Math.min(1, Math.max(0, (Math.hypot(x, z) / side - .8) / .3))
      const near = Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - side / 2 - REAL_TERRAIN_MARGIN) / 3))  // 부지 경계 근처에선 안 보이게
      points.push(x, terrainHeight(x, z, side, profile.relief) + .03, z)
      // 네 번째 값 = 투명도. 땅과 같은 방식으로 사라져서 낮·밤 배경색이 달라도 선이 튀지 않음
      colors.push(line.r, line.g, line.b, (1 - fade) * near * .8)
    }
    for (const [x1, z1, x2, z2] of contourSegments(profile.realTerrain, 2.5)) {
      if (Math.max(Math.abs(x1), Math.abs(z1)) < side / 2 + REAL_TERRAIN_MARGIN || Math.hypot(x1, z1) > side * 1.15) continue
      put(x1, z1); put(x2, z2)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(points, 3))
    geo.setAttribute('color', new Float32BufferAttribute(colors, 4))
    return geo
  }, [side, profile])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <lineSegments geometry={geometry}><lineBasicMaterial vertexColors transparent depthWrite={false}/></lineSegments>
}

function Vegetation({ plants, profile }) {
  const trees = plants.filter(p => p.type === 0), shrubs = plants.filter(p => p.type === 1 && p.species !== 'prickly-pear'), grass = plants.filter(p => p.type === 2)
  const conifers = trees.filter(p => p.species === 'conifer')
  const broadleaf = trees.filter(p => p.species === 'broadleaf')
  const maples = trees.filter(p => p.species === 'maple')
  const mesquite = trees.filter(p => p.species === 'mesquite')
  const cacti = plants.filter(p => p.species === 'prickly-pear')
  const upright = trees.filter(p => p.species !== 'mesquite')
  return <group>
    {upright.length > 0 && <Instances frames={1} limit={upright.length} castShadow>
      <cylinderGeometry args={[.1, .15, 1.7, 5]}/><meshStandardMaterial color={profile.trunk} roughness={1}/>
      {upright.map((p, i) => <Instance key={i} position={[p.x,p.y+.85*p.scale,p.z]} scale={p.scale}/>)}
    </Instances>}
    {(mesquite.length > 0 || cacti.length > 0) && <TexasVegetation trees={mesquite} cacti={cacti} trunk={profile.trunk}/>}
    {conifers.length > 0 && <Instances frames={1} limit={conifers.length * 2} castShadow receiveShadow>
      <coneGeometry args={[.9, 2.2, 7]}/><meshStandardMaterial roughness={1}/>
      {conifers.flatMap((p, i) => [0,1].map(t => <Instance key={`${i}-${t}`} color={p.color} position={[p.x,p.y+(1.65+t*.8)*p.scale,p.z]} scale={[p.scale*(1-t*.2),p.scale,p.scale*(1-t*.2)]} rotation={[0,p.angle,0]}/>))}
    </Instances>}
    {broadleaf.length > 0 && <Instances frames={1} limit={broadleaf.length * 3} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]}/><meshStandardMaterial roughness={1}/>
      {broadleaf.flatMap((p, i) => [0,1,2].map(t => <Instance key={`${i}-${t}`} color={p.color} position={[p.x+Math.cos(p.angle+t*2.1)*.45*p.scale,p.y+(1.45+(t===0?.35:0))*p.scale,p.z+Math.sin(p.angle+t*2.1)*.45*p.scale]} scale={[p.scale*.85,p.scale*.65,p.scale*.85]} rotation={[0,p.angle,0]}/>))}
    </Instances>}
    {maples.length > 0 && <Instances frames={1} limit={maples.length * 5} castShadow receiveShadow>
      <icosahedronGeometry args={[1,1]}/><meshStandardMaterial roughness={1} flatShading/>
      {maples.flatMap((p,i)=>[0,1,2,3,4].map(t=><Instance key={`${i}-${t}`} color={t===0?'#dda448':p.color}
        position={[p.x+(t?Math.cos(p.angle+t*Math.PI/2)*.62*p.scale:0),p.y+(t?1.9:2.5)*p.scale,p.z+(t?Math.sin(p.angle+t*Math.PI/2)*.62*p.scale:0)]}
        scale={[p.scale*(t?.78:.7),p.scale*(t?.8:.9),p.scale*(t?.78:.7)]} rotation={[0,p.angle+t*.4,0]}/>))}
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

// 실제로 쓰는 값(사이트·경관 설정·부지 크기·도로·송전선 위치)이 같으면 다시 그리지 않음.
// SiteView 는 호버·타임라인마다 다시 그려지는데, 식생 인스턴스(숲 사이트 약 1,000개)까지 매번 다시
// 계산하면 끊김이 생김. layout 객체는 날짜마다 새로 만들어지므로 안의 숫자만 비교합니다.
const sameLandscape = (a, b) => a.siteId === b.siteId && a.profile === b.profile
  && a.layout.side === b.layout.side && a.layout.road.z === b.layout.road.z
  && a.layout.powerLine.from[1] === b.layout.powerLine.from[1]
export default memo(CampusLandscape, sameLandscape)

function CampusLandscape({ siteId, layout, profile }) {
  const {side, road, powerLine} = layout
  const plants = useMemo(() => landscapePlants(siteId, side, road.z, powerLine.from[1], profile), [siteId,side,road.z,powerLine.from[1],profile])
  return <group name="regional-landscape">
    <LandscapeGround side={side} profile={profile}/>
    {profile.realTerrain && <Contours side={side} profile={profile}/>}
    <Vegetation plants={plants} profile={profile}/>
    {profile.kangaroos && <Kangaroos side={side} relief={profile.relief}/>}
    {profile.longhorns && <Longhorns side={side} relief={profile.relief}/>}
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
