// Decorative connection signals. Speed is constant and never represents MW or utilization.
export const POWER_FLOW_COLOR = '#36aa8d'
export const POWER_FLOW_SPEED = 3.2
export const POWER_PACKET_COUNT = 3

export function transmissionPath(from, to) {
  const [fx,fz] = from, [tx,tz] = to
  const towers = [0,.5,1].map(k=>[fx+(tx-fx)*k*.85,fz+(tz-fz)*k])
  const points = []
  for (let i=0;i<towers.length-1;i++) {
    const [ax,az]=towers[i], [bx,bz]=towers[i+1]
    for (let s=i===0?0:1;s<=8;s++) {
      const k=s/8
      points.push([ax+(bx-ax)*k,3.4-Math.sin(Math.PI*k)*.5,az+(bz-az)*k])
    }
  }
  points.push([tx+1.2,2.8,tz])
  let length=0
  const distances=points.map((point,i)=>{
    if (i) length+=Math.hypot(...point.map((n,j)=>n-points[i-1][j]))
    return length
  })
  return { towers, points, distances, length }
}

// Sample the same polyline used by the wire, by distance (no speed changes at towers).
export function pointOnTransmission(path, distance, target) {
  const d=Math.min(path.length,Math.max(0,distance))
  let end=1
  while (end<path.distances.length-1 && path.distances[end]<d) end++
  const start=end-1, span=path.distances[end]-path.distances[start]
  const t=span>0?(d-path.distances[start])/span:0
  const a=path.points[start], b=path.points[end]
  target.x=a[0]+(b[0]-a[0])*t
  target.y=a[1]+(b[1]-a[1])*t
  target.z=a[2]+(b[2]-a[2])*t
  return target
}

export function powerPacketDistance(time, index, length, reducedMotion=false) {
  return ((reducedMotion?0:time)*POWER_FLOW_SPEED + (index+.5)*length/POWER_PACKET_COUNT)%length
}

// A gentle rise before arrival and decay afterwards, synchronized to the wire packets.
export function powerArrivalPulse(time, length, reducedMotion=false) {
  if (reducedMotion) return 0
  const spacing=length/POWER_PACKET_COUNT
  const phase=(time*POWER_FLOW_SPEED+spacing*.5)%spacing
  const nearest=Math.min(phase,spacing-phase)/POWER_FLOW_SPEED
  return Math.exp(-Math.pow(nearest/.3,2))
}
