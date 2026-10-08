import { it, expect } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { campusFrame, campusOffset } from './campusCamera.js'
import { placeZoneCallouts, intersectsFootprint } from './zoneCalloutLayout.js'

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
