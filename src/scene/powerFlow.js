// =============================================================
// powerFlow.js — 송전선 모양과 "전력 흐름" 애니메이션 계산 (three.js 없는 순수 함수)
// -------------------------------------------------------------
// GridConnection.jsx 가 쓰는 계산을 모아 둔 파일입니다.
//   - transmissionPath: 송전탑 3개 위치와, 탑 사이에 처지는 전선 꺾은선 만들기
//   - pointOnTransmission: 전선 위 "시작점에서 거리 d" 인 지점 찾기
//   - powerPacketDistance / powerArrivalPulse: 패킷 위치와 변전소 램프 반짝임
// 연결 상태를 보여 주는 장식 신호일 뿐입니다. 속도는 늘 일정하며 MW·사용률을 뜻하지 않습니다.
// =============================================================
export const POWER_FLOW_COLOR = '#36aa8d'
// 패킷이 움직이는 속도 (월드 단위 / 초)
export const POWER_FLOW_SPEED = 3.2
// 전선 위에 동시에 흐르는 패킷 수
export const POWER_PACKET_COUNT = 3

// from: 전력망 쪽 시작점 [x, z], to: 변전소 쪽 끝점 [x, z]
export function transmissionPath(from, to) {
  const [fx,fz] = from, [tx,tz] = to
  // 송전탑 3개: 시작점, 중간, 끝 근처. x 방향은 85% 까지만 가서 마지막 탑이 변전소와 겹치지 않게
  const towers = [0,.5,1].map(k=>[fx+(tx-fx)*k*.85,fz+(tz-fz)*k])
  const points = []
  // 탑과 탑 사이를 8칸으로 나눠 점을 찍음. 높이는 3.4 에서 가운데가 최대 .5 처지게 (sin 으로 0 → 1 → 0)
  for (let i=0;i<towers.length-1;i++) {
    const [ax,az]=towers[i], [bx,bz]=towers[i+1]
    // 두 번째 구간부터는 s=1 에서 시작 → 탑 위치 점이 두 번 들어가지 않게
    for (let s=i===0?0:1;s<=8;s++) {
      const k=s/8
      points.push([ax+(bx-ax)*k,3.4-Math.sin(Math.PI*k)*.5,az+(bz-az)*k])
    }
  }
  // 마지막 점: 끝점(to)에서 x 로 +1.2, 높이 2.8 인 곳 — 변전소 위 신호등 쪽으로 전선을 이어 붙임
  points.push([tx+1.2,2.8,tz])
  // 각 점까지의 누적 거리(distances)와 전체 길이(length) 계산 — 점 사이 직선 거리를 차례로 더함
  let length=0
  const distances=points.map((point,i)=>{
    if (i) length+=Math.hypot(...point.map((n,j)=>n-points[i-1][j]))
    return length
  })
  return { towers, points, distances, length }
}

// 전선 그림과 똑같은 꺾은선 위에서, 거리 기준으로 위치를 찾음 (탑을 지날 때 속도가 바뀌지 않음)
// distance: 시작점에서의 거리(월드 단위), target: 결과를 적어 넣을 {x, y, z} 물체 (새 물체를 안 만들어 가볍게)
export function pointOnTransmission(path, distance, target) {
  // 0 ~ 전체 길이 범위로 자름
  const d=Math.min(path.length,Math.max(0,distance))
  // d 가 들어 있는 구간 [start, end] 찾기
  let end=1
  while (end<path.distances.length-1 && path.distances[end]<d) end++
  const start=end-1, span=path.distances[end]-path.distances[start]
  // 구간 안에서 몇 % 지점인지 (0 ~ 1). 길이 0 인 구간이면 0
  const t=span>0?(d-path.distances[start])/span:0
  // 두 점 사이를 비율 t 로 직선 보간
  const a=path.points[start], b=path.points[end]
  target.x=a[0]+(b[0]-a[0])*t
  target.y=a[1]+(b[1]-a[1])*t
  target.z=a[2]+(b[2]-a[2])*t
  return target
}

// index 번째 패킷의 현재 위치 = 시작점에서의 거리
// 시간 × 속도만큼 나아가고, 패킷끼리는 전체 길이를 똑같이 나눈 간격으로 떨어져 있음
// 끝에 닿으면 % length 로 다시 처음부터 (동작 줄이기 설정이면 멈춘 위치)
export function powerPacketDistance(time, index, length, reducedMotion=false) {
  return ((reducedMotion?0:time)*POWER_FLOW_SPEED + (index+.5)*length/POWER_PACKET_COUNT)%length
}

// 패킷이 도착하기 직전에 부드럽게 밝아졌다가 지나면 서서히 어두워짐 — 전선 위 패킷과 박자가 맞음
// 결과: 0(평소) ~ 1(도착 순간)
export function powerArrivalPulse(time, length, reducedMotion=false) {
  if (reducedMotion) return 0
  // 패킷 사이 간격(월드 단위)
  const spacing=length/POWER_PACKET_COUNT
  // 지금 패킷들이 간격 안에서 어디쯤인지 — 0 또는 spacing 근처면 어느 패킷이 막 끝점에 닿은 때
  const phase=(time*POWER_FLOW_SPEED+spacing*.5)%spacing
  // 가장 가까운 도착 시각까지 남은(또는 지난) 시간(초)
  const nearest=Math.min(phase,spacing-phase)/POWER_FLOW_SPEED
  // 종 모양(가우스) 곡선: 도착 순간 1, 약 ±0.3초 지나면 0.37, 더 멀어지면 0 에 가까워짐
  return Math.exp(-Math.pow(nearest/.3,2))
}
