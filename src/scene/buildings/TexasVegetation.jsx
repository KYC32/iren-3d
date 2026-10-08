// =============================================================
// TexasVegetation.jsx — 텍사스 캠퍼스 주변 식물: 메스키트 나무와 백년초(prickly pear) 선인장
// -------------------------------------------------------------
// 같은 모양을 수십 번 반복하므로 drei 의 Instances 로 "한 번에" 그립니다.
//   - trees: 메스키트 위치 목록, cacti: 선인장 위치 목록 (각각 x·y·z·angle·scale, 나무는 color 도)
//   - trunk: 나무줄기 색 (CampusLandscape.jsx 가 지역 설정에서 넘겨줌)
//   - frames={1}: 식물은 움직이지 않으니 위치 계산을 첫 프레임에 한 번만 함 (성능 절약)
//   - limit: 그릴 수 있는 최대 개수 (식물 수 × 한 그루당 조각 수)
// =============================================================
import { Instance, Instances } from '@react-three/drei'

// 선인장 납작한 잎(pad) 5장의 배치: [x, y, z, 가로 크기, 세로 크기, 기울기(라디안)]
// 아래 큰 잎에서 위로 갈수록 작은 잎이 좌우로 번갈아 붙음
const pads = [
  [0,.52,0,.43,.6,0], [-.35,.94,0,.32,.48,.48], [.36,1.12,.03,.35,.51,-.42],
  [-.55,1.43,0,.28,.42,.16], [.5,1.7,.03,.27,.38,-.18],
]

export default function TexasVegetation({ trees, cacti, trunk }) {
  return <group name="texas-vegetation">
    {trees.length > 0 && <>
      {/* 낮게 갈라진 줄기와 넓고 성긴 수관(나뭇잎 덩어리) 덕분에 숲의 나무와 다른 메스키트로 보임 */}
      {/* 줄기: 한 그루에 3개. 120°(2π/3)씩 돌려 놓고 바깥으로 기울여(-.5 라디안) 갈라진 모양 */}
      <Instances frames={1} limit={trees.length*3} castShadow>
        <cylinderGeometry args={[.055,.11,1.5,5]}/><meshStandardMaterial color={trunk} roughness={1}/>
        {trees.flatMap((p,i)=>[0,1,2].map(t=>{
          const angle = p.angle + t*Math.PI*2/3
          return <Instance key={`${i}-${t}`} position={[p.x+Math.cos(angle)*.3*p.scale,p.y+.67*p.scale,p.z-Math.sin(angle)*.3*p.scale]}
            scale={p.scale} rotation={[0,angle,-.5]}/>
        }))}
      </Instances>
      {/* 수관: 한 그루에 납작한 덩어리 4개 — 바깥 3개(t 0·1·2)는 둘레에, 4번째(t 3)는 가운데 조금 더 높이 */}
      {/* 세로(y) 크기를 .32 배로 눌러서 우산처럼 넓고 납작하게 */}
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
      {/* 사막의 키 큰 기둥 선인장이 아니라 납작한 타원형 잎이라서 백년초(prickly pear)로 보임 */}
      {/* 잎 위치 (x, z)를 선인장마다 angle 만큼 y축으로 돌려서 배치 (회전 공식: x·cos + z·sin, −x·sin + z·cos) */}
      {/* 두께는 .14 로 얇게, 잎 색은 두 가지 초록을 번갈아 */}
      <Instances frames={1} limit={cacti.length*pads.length} castShadow receiveShadow>
        <sphereGeometry args={[1,8,6]}/><meshStandardMaterial roughness={1} flatShading/>
        {cacti.flatMap((p,i)=>pads.map(([x,y,z,sx,sy,tilt],j)=><Instance key={`${i}-${j}`}
          color={j%2?'#79916a':'#667e55'} position={[p.x+(x*Math.cos(p.angle)+z*Math.sin(p.angle))*p.scale,p.y+y*p.scale,p.z+(-x*Math.sin(p.angle)+z*Math.cos(p.angle))*p.scale]}
          scale={[sx*p.scale,sy*p.scale,.14*p.scale]} rotation={[0,p.angle,tilt]}/>))}
      </Instances>
      {/* 맨 위 잎 끝에 달린 붉은 열매 하나 (선인장마다 1개) */}
      <Instances frames={1} limit={cacti.length}>
        <sphereGeometry args={[1,6,5]}/><meshStandardMaterial color="#ad6252" roughness={1}/>
        {cacti.map((p,i)=><Instance key={i} position={[p.x+.54*Math.cos(p.angle)*p.scale,p.y+2.04*p.scale,p.z-.54*Math.sin(p.angle)*p.scale]} scale={[.1*p.scale,.14*p.scale,.1*p.scale]}/>)}
      </Instances>
    </>}
  </group>
}
