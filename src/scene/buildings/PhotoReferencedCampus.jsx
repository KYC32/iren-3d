// =============================================================
// PhotoReferencedCampus.jsx — 공식 사진을 참고해 만든 Childress 캠퍼스용 건물·바닥
// -------------------------------------------------------------
//   - PhotoMiningHall: 길쭉한 창고(shed) 3동이 나란히 선 채굴 홀 + 지붕 환기팬
//   - DryCampusGround: 캠퍼스 둘레 울타리와 변전소 옆 자갈 작업장
// 모양은 사진 느낌을 살린 "도식"일 뿐, 실제 건물 수·위치를 측량한 것이 아닙니다.
// 같은 부품이 여러 번 반복돼서 drei Instances 로 한 번에 그립니다.
// =============================================================
import { useMemo } from 'react'
import { Instances, Instance, Line } from '@react-three/drei'
import { styleOf } from '../../data/statusStyle.js'

// 반복되는 창고 모양은 Childress 공식 사진을 반영한 것
// 용량 블록 하나는 도식적인 묶음일 뿐, 실제 건물 수를 주장하지 않음
// w·d·h: 블록의 가로·세로·높이(월드 단위), appearance: 벽·지붕 색, status: 진행 상태
export function PhotoMiningHall({ w, d, h, appearance, status }) {
  // 창고 한 동: 가로는 블록의 27%, 세로는 거의 전체(97%), 높이는 85%
  const shedW = w * 0.27, shedD = d * 0.97, height = h * 0.85
  // 창고 3동의 x 위치: 블록을 3등분한 가운데들 (−w/3, 0, w/3)
  const rows = [-1, 0, 1].map(i => i * w / 3)
  // 환기팬: 창고마다 지붕 위에 앞뒤로 4개씩 (z = 길이의 −34%, −11%, 11%, 34%)
  const vents = rows.flatMap(x => [-0.34, -0.11, 0.11, 0.34].map(z => [x, height + 0.2, z * shedD]))
  // 해체 중(decommissioning)이면 벽을 회색으로
  const color = status === 'decommissioning' ? '#a8afad' : appearance.wall
  return <group>
    {/* 창고 몸체 3개 */}
    <Instances limit={3} castShadow receiveShadow>
      <boxGeometry args={[shedW, height, shedD]}/><meshStandardMaterial color={color} roughness={0.82}/>
      {rows.map(x=><Instance key={x} position={[x,height/2,0]}/>)}
    </Instances>
    {/* 박공지붕: 창고마다 좌우 두 장을 살짝(.12 라디안) 기울여 ∧ 모양 */}
    <Instances limit={6} castShadow>
      <boxGeometry args={[shedW*.53,.07,shedD+.08]}/><meshStandardMaterial color={appearance.roof} roughness={.65} metalness={.18}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x+s*shedW*.25,height+.025,0]} rotation={[0,0,-s*.12]}/>))}
    </Instances>
    {/* 창고 앞뒤 끝면 판 (다른 색) */}
    <Instances limit={6}>
      <boxGeometry args={[shedW*.94,height*.88,.035]}/><meshStandardMaterial color={appearance.endWall} roughness={.8}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x,height*.44,s*shedD/2]}/>))}
    </Instances>
    {/* 지붕 환기팬 원통 + 그 위의 짙은 뚜껑 */}
    <Instances limit={vents.length} castShadow>
      <cylinderGeometry args={[shedW*.2,shedW*.23,.22,12]}/><meshStandardMaterial color="#c2ceca" roughness={.65} metalness={.25}/>
      {vents.map((p,i)=><Instance key={i} position={p}/>)}
    </Instances>
    <Instances limit={vents.length}>
      <cylinderGeometry args={[shedW*.15,shedW*.15,.025,12]}/><meshStandardMaterial color="#546967" roughness={.85}/>
      {vents.map(([x,y,z],i)=><Instance key={i} position={[x,y+.12,z]}/>)}
    </Instances>
    {/* 창고 긴 옆면에 붙은 짙은 띠 (좌우 각 1장) */}
    <Instances limit={6}>
      <boxGeometry args={[.045,height*.6,shedD*.9]}/><meshStandardMaterial color="#4c625f" roughness={.95}/>
      {rows.flatMap(x=>[-1,1].map(s=><Instance key={`${x}-${s}`} position={[x+s*shedW/2,height*.44,0]}/>))}
    </Instances>
    {/* 블록 앞 바닥의 상태색 띠 — 진행 상태를 색으로 표시 */}
    <mesh position={[0,.04,d/2+.17]}><boxGeometry args={[w,.04,.14]}/><meshBasicMaterial color={styleOf(status).color}/></mesh>
  </group>
}

// 캠퍼스 바닥 장식: 울타리(기둥 + 철선 3줄)와 자갈 작업장
// layout: 캠퍼스 배치(한 변 side, 도로 road, 변전소 substation 위치), appearance: 철재 색 등
export function DryCampusGround({ layout, appearance }) {
  // edge: 캠퍼스 가장자리에서 .35 안쪽 — 울타리가 놓이는 선
  const half=layout.side/2, edge=half-.35
  // 울타리 기둥 위치 (2.1 간격). 뒤쪽 한 변 + 좌우 두 변, 앞쪽은 도로(road.z) 2 단위 앞에서 끊김
  const posts=useMemo(()=>{
    const points=[]
    for(let x=-edge;x<=edge;x+=2.1) points.push([x,.47,-edge])
    for(let z=-edge;z<layout.road.z-2;z+=2.1) points.push([-edge,.47,z],[edge,.47,z])
    return points
  },[edge,layout.road.z])
  // 철선이 지나는 꺾은선: 왼쪽 앞 → 왼쪽 뒤 → 오른쪽 뒤 → 오른쪽 앞 (ㄷ자, 도로 쪽은 열림)
  const border=[[-edge,0,layout.road.z-2],[-edge,0,-edge],[edge,0,-edge],[edge,0,layout.road.z-2]]
  return <group>
    {/* 울타리와 작업장 위치는 도식이며 측량한 위치가 아님 */}
    <Instances limit={posts.length} castShadow>
      <boxGeometry args={[.065,.94,.065]}/><meshStandardMaterial color={appearance.steel} roughness={.8}/>
      {posts.map((p,i)=><Instance key={i} position={p}/>)}
    </Instances>
    {/* 철선 3줄: 높이 .18 · .5 · .85 */}
    {[.18,.5,.85].map(y=><Line key={y} points={border.map(([x,,z])=>[x,y,z])} color={appearance.steel} lineWidth={.7} transparent opacity={.7}/>)}
    {/* 비워 둔 설비 구역(변전소 옆)에 깐 자갈 작업장 */}
    <mesh position={[layout.substation.x,.015,layout.substation.z+5]} receiveShadow>
      <boxGeometry args={[4.5,.035,4]}/><meshStandardMaterial color="#c6c6b8" roughness={1}/>
    </mesh>
  </group>
}
