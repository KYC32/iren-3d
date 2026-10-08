// =============================================================
// GridConnection.jsx — 외부 전력망 → 캠퍼스 변전소로 들어오는 송전선
// -------------------------------------------------------------
// 송전탑 3개와 전선, 그리고 변전소를 함께 그립니다.
//   - 통전(energized) 완료: 실선 / 아직이면: 대기색 점선
//   - 통전이 "보도로 확인된" 경우(flowActive)에만 전선 위로 빛 알갱이가 흘러가고,
//     변전소 위 신호등이 알갱이 도착에 맞춰 반짝임
//   - 흐름 속도는 장식일 뿐 MW·사용률을 뜻하지 않음 (계산은 powerFlow.js)
// =============================================================
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Object3D } from 'three'
import { Substation } from './Infrastructure.jsx'
import { PENDING_COLOR } from '../../data/statusStyle.js'
import { useReducedMotion } from '../useReducedMotion.js'
import { POWER_FLOW_COLOR, POWER_PACKET_COUNT, pointOnTransmission, powerArrivalPulse, powerPacketDistance, transmissionPath } from '../powerFlow.js'

// 전선을 따라 흘러가는 빛 알갱이들 (전력 패킷)
// InstancedMesh 를 써서 수십 개의 작은 구를 그리기 호출 한 번으로 그림
function WirePackets({ path, reducedMotion }) {
  // streaks: 꼬리가 달린 알갱이 줄기, halos: 알갱이 머리 주위의 흐릿한 빛무리
  const streaks=useRef(), halos=useRef()
  // 위치·크기를 계산해 행렬로 바꿀 때만 쓰는 임시 물체 (화면에 직접 그리지 않음)
  const dummy=useMemo(()=>new Object3D(),[])
  // 패킷 하나를 구슬 10개로 만듦
  const beads=10
  useFrame(({clock})=>{
    for (let i=0;i<POWER_PACKET_COUNT;i++) {
      // 패킷 머리가 전선 시작점에서 얼마나 떨어져 있는지 (월드 단위 거리)
      const head=powerPacketDistance(clock.elapsedTime,i,path.length,reducedMotion)
      for (let j=0;j<beads;j++) {
        // 구슬은 머리 뒤로 .12 간격으로 줄지어 따라옴
        const distance=head-j*.12
        pointOnTransmission(path,distance,dummy.position)
        // 겹친 구슬들이 뒤로 갈수록 가늘어지는 짧은 꼬리를 만들고, 전선 시작점 이전(거리 < 0)에선 크기 0 으로 숨김
        dummy.scale.setScalar(distance<0?0:.14-j*.009)
        dummy.updateMatrix()
        streaks.current.setMatrixAt(i*beads+j,dummy.matrix)
      }
      // 빛무리는 머리 위치에 더 크게(.28) 하나
      pointOnTransmission(path,head,dummy.position)
      dummy.scale.setScalar(.28)
      dummy.updateMatrix()
      halos.current.setMatrixAt(i,dummy.matrix)
    }
    // 바뀐 행렬을 GPU 로 다시 보내라고 표시
    streaks.current.instanceMatrix.needsUpdate=true
    halos.current.instanceMatrix.needsUpdate=true
  })
  // frustumCulled={false}: 알갱이가 계속 움직여서 처음 계산한 경계 범위를 벗어나도 사라지지 않게
  // toneMapped={false}: 조명 보정 없이 원래 색 그대로 밝게
  return <group name="incoming-power-packets">
    <instancedMesh ref={streaks} args={[null,null,POWER_PACKET_COUNT*beads]} frustumCulled={false}>
      <sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={POWER_FLOW_COLOR} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={halos} args={[null,null,POWER_PACKET_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#8fe8c8" transparent opacity={.16} depthWrite={false} toneMapped={false}/>
    </instancedMesh>
  </group>
}

// 변전소 위의 신호등: 전력이 흐르면 초록으로 켜지고, 패킷이 도착할 때마다 더 밝아짐
// active 가 아니면 회색으로 꺼져 있음
function SubstationSignal({ active, length, reducedMotion }) {
  const lamp=useRef(), halo=useRef()
  useFrame(({clock})=>{
    // pulse: 0(평소) ~ 1(패킷 도착 순간)
    const pulse=active?powerArrivalPulse(clock.elapsedTime,length,reducedMotion):0
    // 기본 밝기 .65 + 도착할 때 최대 .75 더 / 빛무리 투명도 .1 + 최대 .12 더
    lamp.current.emissiveIntensity=active?.65+pulse*.75:0
    halo.current.opacity=active?.1+pulse*.12:0
  })
  return <group name="grid-status-lamp" position={[1.2,2.95,0]}>
    {/* 받침대 · 램프 · 바깥 빛무리 */}
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

// line: 송전선 정보 (from·to 좌표, energized: 통전 완료, flowActive: 통전이 보도로 확인됨)
// sub: 변전소 정보, t: 번역 문구 묶음(Substation 에 그대로 전달), showLabel: 변전소 이름표 표시 여부
export default function GridConnection({ line, sub, t, showLabel }) {
  const [fx,fz]=line.from, [tx,tz]=line.to
  // 좌표 숫자가 바뀔 때만 송전탑·전선 경로를 다시 계산
  const path=useMemo(()=>transmissionPath([fx,fz],[tx,tz]),[fx,fz,tx,tz])
  const reducedMotion=useReducedMotion()
  const active=line.flowActive
  return <group name="grid-connection">
    {/* 송전탑: 위로 갈수록 가늘어지는 기둥 + 가로대 */}
    {path.towers.map(([x,z],i)=><group key={i} position={[x,0,z]}>
      <mesh position={[0,1.8,0]} castShadow><cylinderGeometry args={[.08,.22,3.6,4]}/><meshStandardMaterial color="#8f99b3"/></mesh>
      <mesh position={[0,3.45,0]}><boxGeometry args={[.1,.1,1.4]}/><meshStandardMaterial color="#8f99b3"/></mesh>
    </group>)}
    {/* 전선: 통전 완료면 짙은 실선, 아니면 대기색(PENDING_COLOR) 점선 */}
    <Line points={path.points} color={line.energized?'#556f69':PENDING_COLOR} lineWidth={line.energized?1.5:2} dashed={!line.energized} dashSize={.5} gapSize={.35}/>
    {active&&<WirePackets path={path} reducedMotion={reducedMotion}/>}
    <Substation sub={sub} t={t} showLabel={showLabel}>
      <SubstationSignal active={active} length={path.length} reducedMotion={reducedMotion}/>
    </Substation>
  </group>
}
