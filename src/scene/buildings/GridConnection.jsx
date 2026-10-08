import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Object3D } from 'three'
import { Substation } from './Infrastructure.jsx'
import { PENDING_COLOR } from '../../data/statusStyle.js'
import { useReducedMotion } from '../useReducedMotion.js'
import { POWER_FLOW_COLOR, POWER_PACKET_COUNT, pointOnTransmission, powerArrivalPulse, powerPacketDistance, transmissionPath } from '../powerFlow.js'

function WirePackets({ path, reducedMotion }) {
  const streaks=useRef(), halos=useRef()
  const dummy=useMemo(()=>new Object3D(),[])
  const beads=10
  useFrame(({clock})=>{
    for (let i=0;i<POWER_PACKET_COUNT;i++) {
      const head=powerPacketDistance(clock.elapsedTime,i,path.length,reducedMotion)
      for (let j=0;j<beads;j++) {
        const distance=head-j*.12
        pointOnTransmission(path,distance,dummy.position)
        // Overlapping beads form a short tapered streak and disappear at the entry point.
        dummy.scale.setScalar(distance<0?0:.14-j*.009)
        dummy.updateMatrix()
        streaks.current.setMatrixAt(i*beads+j,dummy.matrix)
      }
      pointOnTransmission(path,head,dummy.position)
      dummy.scale.setScalar(.28)
      dummy.updateMatrix()
      halos.current.setMatrixAt(i,dummy.matrix)
    }
    streaks.current.instanceMatrix.needsUpdate=true
    halos.current.instanceMatrix.needsUpdate=true
  })
  return <group name="incoming-power-packets">
    <instancedMesh ref={streaks} args={[null,null,POWER_PACKET_COUNT*beads]} frustumCulled={false}>
      <sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={POWER_FLOW_COLOR} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={halos} args={[null,null,POWER_PACKET_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#8fe8c8" transparent opacity={.16} depthWrite={false} toneMapped={false}/>
    </instancedMesh>
  </group>
}

function SubstationSignal({ active, length, reducedMotion }) {
  const lamp=useRef(), halo=useRef()
  useFrame(({clock})=>{
    const pulse=active?powerArrivalPulse(clock.elapsedTime,length,reducedMotion):0
    lamp.current.emissiveIntensity=active?.65+pulse*.75:0
    halo.current.opacity=active?.1+pulse*.12:0
  })
  return <group name="grid-status-lamp" position={[1.2,2.95,0]}>
    <mesh><cylinderGeometry args={[.29,.29,.14,12]}/><meshStandardMaterial color="#66756f" roughness={.8}/></mesh>
    <mesh position={[0,.16,0]}>
      <sphereGeometry args={[.24,12,8]}/>
      <meshStandardMaterial ref={lamp} color={active?POWER_FLOW_COLOR:'#93a29b'} emissive={active?POWER_FLOW_COLOR:'#000000'} emissiveIntensity={active?.65:0} roughness={.35} toneMapped={false}/>
    </mesh>
    <mesh position={[0,.16,0]}>
      <sphereGeometry args={[.4,12,8]}/><meshBasicMaterial ref={halo} color="#8fe8c8" transparent opacity={active?.1:0} depthWrite={false} toneMapped={false}/>
    </mesh>
  </group>
}

export default function GridConnection({ line, sub, t, showLabel }) {
  const [fx,fz]=line.from, [tx,tz]=line.to
  const path=useMemo(()=>transmissionPath([fx,fz],[tx,tz]),[fx,fz,tx,tz])
  const reducedMotion=useReducedMotion()
  const active=line.flowActive
  return <group name="grid-connection">
    {path.towers.map(([x,z],i)=><group key={i} position={[x,0,z]}>
      <mesh position={[0,1.8,0]} castShadow><cylinderGeometry args={[.08,.22,3.6,4]}/><meshStandardMaterial color="#8f99b3"/></mesh>
      <mesh position={[0,3.45,0]}><boxGeometry args={[.1,.1,1.4]}/><meshStandardMaterial color="#8f99b3"/></mesh>
    </group>)}
    <Line points={path.points} color={line.energized?'#556f69':PENDING_COLOR} lineWidth={line.energized?1.5:2} dashed={!line.energized} dashSize={.5} gapSize={.35}/>
    {active&&<WirePackets path={path} reducedMotion={reducedMotion}/>}
    <Substation sub={sub} t={t} showLabel={showLabel}>
      <SubstationSignal active={active} length={path.length} reducedMotion={reducedMotion}/>
    </Substation>
  </group>
}
