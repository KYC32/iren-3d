// =============================================================
// Longhorns.jsx — 텍사스 캠퍼스 옆 목초지에서 풀을 뜯는 롱혼 소 2마리
// -------------------------------------------------------------
// 사이트가 텍사스라는 걸 한눈에 보여 주는 장식용 동물입니다.
//   - 몸은 구(sphere)·원기둥 조각을 늘여 붙여 만들고, 양옆으로 길게 뻗은 뿔만 곡선 튜브로 만듦
//   - 0번 소: 적갈색 바탕 + 크림색 얼룩 / 1번 소: 크림색 바탕 + 적갈색 얼룩
//   - 위치·고개·다리 움직임은 longhornMotion.js 의 longhornPose 가 계산
//   - "동작 줄이기" 설정이면 제자리에 서 있음
// =============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, CircleGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { longhornPose } from '../longhornMotion.js'
import { useReducedMotion } from '../useReducedMotion.js'

// 롱혼의 상징인 긴 뿔 (오른쪽 한 개). 왼쪽은 그릴 때 x 를 뒤집어(scale -1) 재사용
function hornGeometry() {
  // 머리 옆에서 출발해 바깥으로 뻗다가 끝이 위로 휘는 곡선 (점 5개를 부드럽게 잇는 CatmullRom 곡선)
  const curve = new CatmullRomCurve3([
    new Vector3(.18,.24,.17), new Vector3(.62,.19,.12),
    new Vector3(1.15,.27,.05), new Vector3(1.52,.49,.09), new Vector3(1.68,.72,.16),
  ])
  // 곡선을 따라 굵기 .14 인 관(tube)을 만듦: 길이 방향 16칸, 둘레 6각
  const geometry = new TubeGeometry(curve,16,.14,6,false)
  const vertices = geometry.attributes.position
  // 뿔 끝으로 갈수록 가늘게: 각 고리(ring)의 꼭짓점을 곡선 중심 쪽으로 당김
  // taper 는 뿌리 1(100%) → 끝 0.02(2%) 로 줄어드는 굵기 비율
  for (let ring = 0; ring <= 16; ring++) {
    const center = curve.getPointAt(ring / 16), taper = 1 - .98 * ring / 16
    for (let j = 0; j <= 6; j++) {
      // 고리 하나에 꼭짓점이 7개(둘레 6각 + 이음매 1개)라서 ring × 7 + j 번째
      const i = ring * 7 + j
      vertices.setXYZ(i, center.x + (vertices.getX(i)-center.x)*taper,
        center.y + (vertices.getY(i)-center.y)*taper, center.z + (vertices.getZ(i)-center.z)*taper)
    }
  }
  // 꼭짓점을 옮겼으니 빛 반사 방향(법선)을 다시 계산
  geometry.computeVertexNormals()
  return geometry
}

// 롱혼 한 마리. index 0·1 에 따라 털색·크기·목초지가 다름
function Longhorn({ index, side, relief, assets, reducedMotion }) {
  // root: 전체 위치·방향, head: 고개(풀 뜯기), tail: 꼬리, legs: 다리 4개, shadow: 바닥 그림자
  const root = useRef(), head = useRef(), tail = useRef(), legs = useRef([]), shadow = useRef()
  // 첫 프레임 전에 쓸 "쉬는 자세"(시간 0, 움직임 없음)
  const rest = longhornPose(0,index,side,relief,true)
  // 바탕색과 얼룩색을 소마다 반대로
  const coat = index === 0 ? assets.rust : assets.cream
  const patch = index === 0 ? assets.cream : assets.rust
  // 매 프레임: 경과 시간(초)으로 자세를 계산해 각 부위에 적용
  useFrame(({ clock }) => {
    const pose = longhornPose(clock.elapsedTime,index,side,relief,reducedMotion)
    root.current.position.set(pose.x,pose.y,pose.z)
    root.current.rotation.y = pose.heading
    head.current.rotation.x = pose.head
    tail.current.rotation.z = pose.tail
    // 대각선 다리끼리 같은 방향으로 움직임 (0번 왼쪽 뒤 + 3번 오른쪽 앞 / 1번 왼쪽 앞 + 2번 오른쪽 뒤)
    legs.current.forEach((leg,i) => { if (leg) leg.rotation.x = pose.stride * (i === 0 || i === 3 ? 1 : -1) })
    // 그림자는 몸 아래 땅에 깔고, 몸과 같은 방향으로 돌림
    shadow.current.position.set(pose.x,pose.y-.045,pose.z)
    shadow.current.rotation.z = pose.heading
  })
  // 몸 조각 하나 그리기 도우미: 공(sphere)을 늘려 타원체로 만듦 (기본 재질은 바탕색)
  const part = (position,scale,material=coat,rotation) => <mesh geometry={assets.sphere} material={material} position={position} scale={scale} rotation={rotation} castShadow/>
  return <group name={`longhorn-${index}`}>
    {/* 바닥 그림자: 원을 눕히고 앞뒤로 길게(1.5배) 늘린 타원 */}
    <mesh ref={shadow} geometry={assets.shadowGeometry} material={assets.shadowMaterial} rotation={[-Math.PI/2,0,rest.heading]} position={[rest.x,rest.y-.045,rest.z]} scale={[.67*rest.scale,1.5*rest.scale,1]}/>
    <group ref={root} position={[rest.x,rest.y,rest.z]} rotation={[0,rest.heading,0]} scale={rest.scale}>
      {/* 몸통 뒤쪽·어깨·가슴 아래 (z 가 + 쪽이 앞) */}
      {part([0,1.22,-.1],[.55,.57,1.02])}
      {part([0,1.31,.54],[.48,.59,.46])}
      {part([0,.97,.68],[.26,.32,.33])}
      {[-1,1].map(s=><group key={s}>
        {/* 불규칙한 크림/적갈색 얼룩 덕분에 캠퍼스 전체 화면에서도 소로 알아볼 수 있음 */}
        {part([s*.5,1.3,-.36],[.075,.33,.44],patch,[0,0,s*.12])}
        {part([s*.49,1.16,.25],[.085,.26,.24],patch,[0,0,-s*.2])}
      </group>)}
      {/* 머리: 목덜미 위치를 축으로 숙였다 들었다 함 (풀 뜯기) */}
      <group ref={head} position={[0,1.28,.68]} rotation={[rest.head,0,0]}>
        {/* 뒷머리·긴 얼굴·얼굴 줄무늬 얼룩·주둥이 */}
        {part([0,-.02,.26],[.29,.34,.38])}
        {part([0,-.2,.62],[.22,.25,.47],coat,[.22,0,0])}
        {part([0,-.13,.59],[.12,.23,.4],patch,[.22,0,0])}
        {part([0,-.32,1.01],[.26,.17,.2],assets.muzzle)}
        {/* 좌우 대칭: 뿔(왼쪽은 x 를 뒤집어 재사용)·귀·눈·콧구멍 */}
        {[-1,1].map(s=><group key={s}>
          <group scale={[s,1,1]}><mesh geometry={assets.horn} material={assets.ivory} castShadow/></group>
          {part([s*.42,.05,.24],[.24,.08,.12],coat,[0,0,s*.15])}
          {part([s*.256,.04,.45],[.033,.04,.043],assets.dark)}
          {part([s*.12,-.28,1.17],[.043,.025,.02],assets.dark)}
        </group>)}
      </group>
      {/* 다리 4개: s = 왼(-1)/오른(1), end = 뒤(-1)/앞(1). 번호 i = 0 왼뒤, 1 왼앞, 2 오른뒤, 3 오른앞 */}
      {/* 다리 하나 = 허벅지(구) + 정강이(원기둥) + 짙은 발굽 */}
      {[-1,1].flatMap((s,j)=>[-1,1].map((end,k)=>{
        const i=j*2+k
        return <group key={i} ref={el=>{legs.current[i]=el}} position={[s*.36,.98,end*.67-.07]}>
          {part([0,-.2,0],[.15,.3,.17])}
          <mesh geometry={assets.cylinder} material={coat} position={[0,-.57,.025]} scale={[.085,.55,.085]} castShadow/>
          {part([0,-.89,.045],[.12,.1,.16],assets.dark)}
        </group>
      }))}
      {/* 꼬리: 가는 원기둥 + 끝의 짙은 털뭉치. 엉덩이 위를 축으로 좌우로 흔듦 */}
      <group ref={tail} position={[0,1.48,-1.01]}>
        <mesh geometry={assets.cylinder} material={coat} position={[0,-.43,-.09]} scale={[.045,.9,.045]} rotation={[.18,0,0]} castShadow/>
        {part([0,-.87,-.17],[.09,.18,.075],assets.dark)}
      </group>
    </group>
  </group>
}

// side: 캠퍼스 한 변 길이(월드 단위), relief: 지형 굴곡 정도
export default function Longhorns({ side, relief }) {
  const reducedMotion = useReducedMotion()
  // 두 마리가 함께 쓰는 지오메트리·재질 (다운로드하는 모델·텍스처 없음)
  // rust: 적갈색 털, cream: 크림색 털, ivory: 뿔, dark: 눈·발굽·꼬리털, muzzle: 주둥이
  const assets = useMemo(()=>({
    sphere: new SphereGeometry(1,10,7), cylinder: new CylinderGeometry(1,1,1,6), horn: hornGeometry(),
    shadowGeometry: new CircleGeometry(1,20), shadowMaterial: new MeshBasicMaterial({color:'#65553e',transparent:true,opacity:.13,depthWrite:false}),
    rust: new MeshStandardMaterial({color:'#9e5230',roughness:1}), cream: new MeshStandardMaterial({color:'#f2e5cc',roughness:1}),
    ivory: new MeshStandardMaterial({color:'#ded3b9',roughness:.9}), dark: new MeshStandardMaterial({color:'#41372e',roughness:1}),
    muzzle: new MeshStandardMaterial({color:'#90735e',roughness:1}),
  }),[])
  // 화면에서 사라질 때 GPU 메모리 정리 (dispose={null} 로 자동 정리를 끄고 여기서 직접 처리)
  useEffect(()=>()=>Object.values(assets).forEach(asset=>asset.dispose()),[assets])
  return <group name="texas-longhorns" dispose={null}>{[0,1].map(index=><Longhorn key={index} index={index} side={side} relief={relief} assets={assets} reducedMotion={reducedMotion}/>)}</group>
}
