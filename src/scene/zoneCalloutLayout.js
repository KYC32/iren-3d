const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const overlap = (a,b,gap=0) => a.left < b.right+gap && a.right+gap > b.left && a.top < b.bottom+gap && a.bottom+gap > b.top

// SAT intersection keeps the entire label outside the projected campus, including on rotation.
export function intersectsFootprint(rect, polygon, gap=8) {
  const corners=[{x:rect.left-gap,y:rect.top-gap},{x:rect.right+gap,y:rect.top-gap},{x:rect.right+gap,y:rect.bottom+gap},{x:rect.left-gap,y:rect.bottom+gap}]
  const axes=[{x:1,y:0},{x:0,y:1},...polygon.map((p,i)=>{const next=polygon[(i+1)%polygon.length];return {x:p.y-next.y,y:next.x-p.x}})]
  return !axes.some(a=>{
    const project=points=>points.map(p=>p.x*a.x+p.y*a.y)
    const r=project(corners),p=project(polygon)
    return Math.max(...r)<Math.min(...p)||Math.max(...p)<Math.min(...r)
  })
}

export function placeZoneCallouts(items, footprint, safe) {
  const placed=[]
  for(const item of [...items].sort((a,b)=>a.anchor.y-b.anchor.y||a.key.localeCompare(b.key))){
    const {width,height,anchor}=item
    const candidates=[]
    for(const side of ['left','right']){
      const left=side==='left'?safe.left+4:safe.right-width-4
      const add=top=>{
        const rect={left,right:left+width,top,bottom:top+height}
        if(rect.left<safe.left||rect.right>safe.right||rect.top<safe.top||rect.bottom>safe.bottom)return
        if(intersectsFootprint(rect,footprint)||placed.some(p=>overlap(rect,p.rect,8)))return
        candidates.push({rect,side,score:Math.hypot(left+width/2-anchor.x,top+height/2-anchor.y)})
      }
      add(clamp(anchor.y-height/2,safe.top+4,safe.bottom-height-4))
      for(let top=safe.top+4;top<=safe.bottom-height-4;top+=8)add(top)
    }
    candidates.sort((a,b)=>a.score-b.score)
    if(candidates[0])placed.push({...item,...candidates[0]})
  }
  return placed
}
