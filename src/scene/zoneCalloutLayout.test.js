import { it, expect } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { campusFrame, campusOffset } from './campusCamera.js'
import { placeZoneCallouts, intersectsFootprint, calloutEnd } from './zoneCalloutLayout.js'

it.each([
  [960,968,{left:24,right:568,top:188,bottom:720}],
  [1440,900,{left:24,right:1040,top:188,bottom:660}],
  [390,844,{left:18,right:372,top:185,bottom:435}],
])('%sx%s: customer badges sit outside the campus and avoid each other', (w,h,safe)=>{
  const side=37.2, frame=campusFrame(side,w,h,safe)
  const camera=new PerspectiveCamera(30,w/h,.5,3000)
  camera.position.fromArray(frame.position);camera.lookAt(new Vector3(...frame.target))
  const [ox,oy]=campusOffset(frame.distance,w,h,safe)
  camera.position.add(new Vector3(ox,-oy,0).applyQuaternion(camera.quaternion));camera.updateMatrixWorld()
  const project=(x,z)=>{const p=new Vector3(x,0,z).project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2}}
  const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>project(x*side/2,z*side/2))
  const placed=placeZoneCallouts([{key:'ms',anchor:project(3,3),width:105,height:31},{key:'nv',anchor:project(6,8),width:100,height:31}],footprint,safe)
  expect(placed).toHaveLength(2)
  for(const p of placed){
    expect(intersectsFootprint(p.rect,footprint)).toBe(false)
    expect(p.rect.left).toBeGreaterThanOrEqual(safe.left)
    expect(p.rect.right).toBeLessThanOrEqual(safe.right)
    expect(p.rect.top).toBeGreaterThanOrEqual(safe.top)
    expect(p.rect.bottom).toBeLessThanOrEqual(safe.bottom)
  }
  const [a,b]=placed.map(p=>p.rect)
  expect(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top).toBe(true)
})

it('does not force badges over a campus that fills the viewport',()=>{
 const footprint=[{x:0,y:0},{x:400,y:0},{x:400,y:400},{x:0,y:400}]
 expect(placeZoneCallouts([{key:'ms',anchor:{x:200,y:200},width:100,height:30}],footprint,{left:0,right:400,top:0,bottom:400})).toEqual([])
})

// 점선 끝점: 구역 모서리 중 배지에 가장 가까운 곳 — 단, 건물 라벨이 덮은 모서리는 건너뜀
//   (버그였던 것: 차일드레스 NVIDIA 점선 끝 점이 아래로 비켜 간 "Horizon 6 건설중" 칩 글자 위에 떨어져
//    NVIDIA 가 Horizon 6 인 것처럼 읽혔음)
it('calloutEnd: 라벨이 덮은 모서리는 건너뛰고 다음으로 가까운 모서리', () => {
  const from = { x: 0, y: 0 }                                        // 배지 쪽 점선 시작
  const corners = [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 50, y: 0 }] // 가까운 순서: 10 → 30 → 50
  const chip = { left: 5, top: -5, right: 15, bottom: 5 }            // 가장 가까운 모서리(10,0)를 덮은 칩
  expect(calloutEnd(corners, from, [])).toEqual({ x: 10, y: 0 })     // 덮인 곳이 없으면 가장 가까운 곳
  expect(calloutEnd(corners, from, [chip])).toEqual({ x: 30, y: 0 }) // 덮였으면 다음으로 가까운 곳
})
it('calloutEnd: 모든 모서리가 덮였으면 가장 가까운 곳 (점을 아예 안 그리진 않음)', () => {
  const corners = [{ x: 10, y: 0 }, { x: 30, y: 0 }]
  const wide = { left: 0, top: -5, right: 40, bottom: 5 }
  expect(calloutEnd(corners, { x: 0, y: 0 }, [wide])).toEqual({ x: 10, y: 0 })
})
it('calloutEnd: 라벨 가장자리에서 4px 안쪽까지는 덮인 것으로 봄 (점 반지름 3px + 흰 테두리)', () => {
  const corners = [{ x: 10, y: 0 }, { x: 30, y: 0 }]
  const near = { left: 12, top: -5, right: 20, bottom: 5 }           // 모서리(10,0)에서 2px 떨어진 칩
  expect(calloutEnd(corners, { x: 0, y: 0 }, [near])).toEqual({ x: 30, y: 0 })
})
