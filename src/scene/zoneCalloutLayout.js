// =============================================================
// zoneCalloutLayout.js — 캠퍼스 구역 설명 카드(callout)를 화면 어디에 놓을지 정하는 순수 함수
// -------------------------------------------------------------
// ZoneCallouts.jsx 가 3D 캠퍼스를 화면 좌표(픽셀)로 투영한 뒤 이 함수를 부릅니다.
//   - 카드는 안전 영역(safe: 상단 KPI·옆 패널을 피한 화면 범위)의 왼쪽 또는 오른쪽 끝에 붙임
//   - 캠퍼스 바닥(footprint) 위를 가리지 않고, 카드끼리도 겹치지 않게
//   - 후보 자리 중 가리키는 지점(anchor)과 가장 가까운 곳을 고름. 자리가 없으면 그 카드는 생략
// 모든 좌표 단위는 화면 픽셀입니다.
// =============================================================
// v 를 lo ~ hi 범위 안으로 자름
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// 두 사각형이 겹치는지 (gap 만큼 여유를 두고 판단 — gap 이내로 가까워도 겹친 것으로 봄)
const overlap = (a,b,gap=0) => a.left < b.right+gap && a.right+gap > b.left && a.top < b.bottom+gap && a.bottom+gap > b.top

// 분리축 정리(SAT)로 교차를 검사해서, 카메라가 돌아가 캠퍼스가 기울어 보여도 카드 전체가 캠퍼스 바깥에 있게 함
// rect: 카드 사각형, polygon: 화면에 투영된 캠퍼스 바닥 꼭짓점들(볼록 다각형), gap: 바깥 여유(픽셀)
// 결과: 겹치면 true
// SAT 원리: 두 볼록 도형을 어떤 축에 그림자처럼 투영했을 때 한 축에서라도 안 겹치면 두 도형은 떨어져 있음
export function intersectsFootprint(rect, polygon, gap=8) {
  // 카드 사각형을 gap 만큼 넓힌 네 꼭짓점
  const corners=[{x:rect.left-gap,y:rect.top-gap},{x:rect.right+gap,y:rect.top-gap},{x:rect.right+gap,y:rect.bottom+gap},{x:rect.left-gap,y:rect.bottom+gap}]
  // 검사할 축: 사각형의 가로·세로 축 + 다각형 각 변에 수직인 방향(법선)
  const axes=[{x:1,y:0},{x:0,y:1},...polygon.map((p,i)=>{const next=polygon[(i+1)%polygon.length];return {x:p.y-next.y,y:next.x-p.x}})]
  // 어느 축에서도 분리되지 않으면(= 모든 축에서 투영이 겹치면) 교차
  return !axes.some(a=>{
    // 점들을 축 a 위로 투영(내적)한 값 목록
    const project=points=>points.map(p=>p.x*a.x+p.y*a.y)
    const r=project(corners),p=project(polygon)
    // 한쪽 투영의 최댓값이 다른 쪽 최솟값보다 작으면 이 축에서 떨어져 있음
    return Math.max(...r)<Math.min(...p)||Math.max(...p)<Math.min(...r)
  })
}

// items: 카드 목록 ({key, width, height, anchor:{x,y}} — anchor 는 카드가 가리킬 화면 지점)
// footprint: 캠퍼스 바닥 다각형, safe: {left, right, top, bottom} 카드를 놓아도 되는 화면 범위
// 결과: 자리를 찾은 카드들 (원래 정보 + rect·side·score)
export function placeZoneCallouts(items, footprint, safe) {
  const placed=[]
  // 화면 위쪽에 있는 구역부터 차례로 배치 (y 가 같으면 key 순서 → 매번 같은 결과)
  for(const item of [...items].sort((a,b)=>a.anchor.y-b.anchor.y||a.key.localeCompare(b.key))){
    const {width,height,anchor}=item
    const candidates=[]
    for(const side of ['left','right']){
      // 카드 x 위치: 안전 영역 왼쪽 끝 또는 오른쪽 끝에서 4px 안쪽
      const left=side==='left'?safe.left+4:safe.right-width-4
      // top 위치에 놓아 보고, 조건을 통과하면 후보에 추가
      const add=top=>{
        const rect={left,right:left+width,top,bottom:top+height}
        // 안전 영역을 벗어나면 탈락
        if(rect.left<safe.left||rect.right>safe.right||rect.top<safe.top||rect.bottom>safe.bottom)return
        // 캠퍼스를 가리거나, 먼저 놓인 카드와 8px 이내로 붙으면 탈락
        if(intersectsFootprint(rect,footprint)||placed.some(p=>overlap(rect,p.rect,8)))return
        // 점수 = 카드 중심과 anchor 사이 거리 (작을수록 좋음)
        candidates.push({rect,side,score:Math.hypot(left+width/2-anchor.x,top+height/2-anchor.y)})
      }
      // 1순위: anchor 와 같은 높이 (화면 안으로 잘라서)
      add(clamp(anchor.y-height/2,safe.top+4,safe.bottom-height-4))
      // 그다음: 위에서 아래로 8px 간격으로 전부 시도
      for(let top=safe.top+4;top<=safe.bottom-height-4;top+=8)add(top)
    }
    // 가장 가까운 후보를 고름. 후보가 하나도 없으면 이 카드는 표시하지 않음
    candidates.sort((a,b)=>a.score-b.score)
    if(candidates[0])placed.push({...item,...candidates[0]})
  }
  return placed
}
