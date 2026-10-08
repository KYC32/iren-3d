// =============================================================
// Kangaroos.jsx — 호주(Bundey) 캠퍼스 옆에서 깡충깡충 뛰어다니는 캥거루 3마리
// -------------------------------------------------------------
// 사이트가 어느 나라인지 한눈에 알아보게 하는 장식용 동물입니다.
//   - 몸 전체를 구(sphere) 하나를 늘리고 돌린 조각들로 만듦 (외부 3D 모델·텍스처 다운로드 없음)
//   - 3마리가 지오메트리·재질을 함께 써서 메모리를 아낌
//   - 위치·점프 높이 계산은 kangarooMotion.js 의 kangarooPose 가 담당하고,
//     여기서는 매 프레임 그 결과를 3D 물체에 옮겨 적기만 함
//   - "동작 줄이기"(prefers-reduced-motion) 설정이면 제자리에 가만히 서 있음
// =============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, ConeGeometry, SphereGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { kangarooPose } from '../kangarooMotion.js'
import { useReducedMotion } from '../useReducedMotion.js'

// 캥거루 한 마리. index(0·1·2)마다 크기와 출발 위치·점프 타이밍이 다름
function Kangaroo({ index, side, relief, assets, reducedMotion }) {
  // root: 전체 위치·방향, body: 상체 기울기, tail: 꼬리, legs: 뒷다리 2개, shadow: 바닥 그림자
  const root = useRef(), body = useRef(), tail = useRef(), legs = useRef([]), shadow = useRef()
  const { sphere, cone, fur, cream, dark, ear } = assets
  // 첫 프레임이 그려지기 전에 쓸 "쉬는 자세"(시간 0, 움직임 없음)
  const rest = kangarooPose(0, index, side, relief, true)
  // 매 프레임 호출 — clock.elapsedTime(초)으로 자세를 계산해 3D 물체에 적용
  useFrame(({ clock }) => {
    if (!root.current) return
    const pose = kangarooPose(clock.elapsedTime, index, side, relief, reducedMotion)
    root.current.position.set(pose.x, pose.y, pose.z)
    root.current.rotation.y = pose.heading
    // pose.hop: 0(땅) ~ 1(가장 높이). 뛰어오를수록 상체를 젖히고, 꼬리와 뒷다리는 반대쪽으로 뻗음 (각도 단위: 라디안)
    body.current.rotation.x = -.08 + pose.hop * .14
    tail.current.rotation.x = -pose.hop * .16
    for (const leg of legs.current) if (leg) leg.rotation.x = -pose.hop * .65
    // 그림자는 공중으로 뜨지 않고 땅(ground) 바로 위에 붙어 있음 (.012 는 땅과 겹쳐 깜빡이지 않게 띄운 높이)
    shadow.current.position.set(pose.x, pose.ground + .012, pose.z)
    // 높이 뛸수록 그림자를 최대 25% 작게 → 공중에 떠 있는 느낌
    const spread = (1 - pose.hop * .25) * pose.scale
    shadow.current.scale.set(spread * .75, spread * .58, 1)
  })
  // 몸 조각 하나 그리기 도우미: 공(sphere)을 position 위치에 두고 scale 로 늘려 타원체로 만듦
  const part = (position, scale, material = fur, rotation) => <mesh geometry={sphere} material={material} position={position} scale={scale} rotation={rotation} castShadow/>
  return <group name={`kangaroo-${index}`}>
    {/* 바닥 그림자: 납작한 원을 눕혀서(-90°) 땅에 깔아 둠 */}
    <mesh ref={shadow} geometry={assets.shadowGeometry} material={assets.shadowMaterial} rotation={[-Math.PI / 2,0,0]} position={[rest.x,rest.ground+.012,rest.z]}/>
    <group ref={root} position={[rest.x,rest.y,rest.z]} rotation={[0,rest.heading,0]} scale={rest.scale}>
      {/* 상체: 엉덩이 높이(.82)를 축으로 기울어짐. 몸통·크림색 배·목·머리·주둥이·코 순서 */}
      <group ref={body} position={[0,.82,0]}>
        {part([0,.56,0],[.42,.72,.38],fur,[.2,0,0])}
        {part([0,.54,.29],[.27,.48,.14],cream,[.2,0,0])}
        {part([0,1.03,.22],[.22,.39,.22],fur,[.45,0,0])}
        {part([0,1.37,.43],[.25,.28,.34])}
        {part([0,1.29,.69],[.19,.15,.29])}
        {part([0,1.32,.95],[.13,.09,.07],dark)}
        {/* s = -1(왼쪽) / 1(오른쪽): 좌우 대칭 부위를 한 번에 그림 */}
        {[-1,1].map(s=><group key={s}>
          {/* 긴 귀, 앞으로 나온 주둥이, 굵은 꼬리 덕분에 지도 배율에서도 캥거루 실루엣이 살아남 */}
          {/* 귀(바깥·안쪽 분홍), 눈, 앞다리, 앞발 */}
          {part([s*.16,1.78,.36],[.1,.4,.085],fur,[.12,0,-s*.2])}
          {part([s*.16,1.8,.415],[.054,.27,.025],ear,[.12,0,-s*.2])}
          {part([s*.218,1.43,.6],[.035,.044,.041],dark)}
          {part([s*.32,.72,.29],[.105,.29,.1],fur,[-.55,0,s*.2])}
          {part([s*.31,.48,.43],[.085,.12,.14])}
        </group>)}
      </group>
      {/* 꼬리: 원뿔을 길게 늘여 뒤쪽 아래로 눕힘 */}
      <group ref={tail} position={[0,.82,0]}>
        <mesh geometry={cone} material={fur} position={[0,-.33,-1.12]} scale={[.28,2,.28]} rotation={[-1.9,0,0]} castShadow/>
      </group>
      {/* 뒷다리 2개: 허벅지·정강이·긴 발. 점프할 때 엉덩이 축으로 함께 회전 */}
      {[-1,1].map((s,i)=><group key={s} ref={el=>{legs.current[i]=el}} position={[s*.32,.82,-.07]}>
        {part([0,-.08,0],[.26,.42,.3],fur,[-.2,0,0])}
        {part([0,-.49,-.07],[.12,.3,.12],fur,[-.45,0,0])}
        {part([0,-.72,.19],[.135,.11,.44])}
      </group>)}
    </group>
  </group>
}

// side: 캠퍼스 한 변 길이(월드 단위), relief: 지형 굴곡 정도 — 서식지 위치와 땅 높이 계산에 씀
export default function Kangaroos({ side, relief }) {
  const reducedMotion = useReducedMotion()
  // 세 마리가 지오메트리와 재질을 함께 씀 — 다운로드하는 모델·텍스처 없음
  // 구는 가로 10·세로 7 조각만 써서 가볍게 (작게 보이니 충분히 둥글어 보임)
  const assets = useMemo(() => ({ sphere: new SphereGeometry(1,10,7), cone: new ConeGeometry(1,1,8),
    shadowGeometry: new CircleGeometry(1,20), shadowMaterial: new MeshBasicMaterial({color:'#645440',transparent:true,opacity:.12,depthWrite:false}),
    fur: new MeshStandardMaterial({color:'#b98a61',roughness:1}), cream: new MeshStandardMaterial({color:'#e0c7a3',roughness:1}),
    dark: new MeshStandardMaterial({color:'#403a33',roughness:1}), ear: new MeshStandardMaterial({color:'#c8957d',roughness:1}) }), [])
  // 화면에서 사라질 때 GPU 메모리 정리 (dispose={null} 로 자동 정리를 끄고 여기서 직접 처리)
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets])
  return <group name="bundey-kangaroos" dispose={null}>{[0,1,2].map(index=><Kangaroo key={index} index={index} side={side} relief={relief} assets={assets} reducedMotion={reducedMotion}/>)}</group>
}
