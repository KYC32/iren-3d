import { longhornPasture, terrainHeight } from './campusLandscape.js'

const smooth = value => {
  const v = Math.min(1, Math.max(0, value))
  return v * v * (3 - 2 * v)
}

// Twenty-four seconds grazing, then a gentle quarter-turn around each private patch.
// Integrate the eased walk speed so the cattle stop instead of skating while grazing.
export function longhornPose(time, index, side, relief, reducedMotion = false) {
  const t = reducedMotion ? 0 : time
  const cycle = t / 48 + index * .19
  const phase = (cycle % 1) * 48
  const walk = Math.min(1, Math.max(0, (phase - 24) / 24))
  const travel = Math.floor(cycle) + smooth(walk)
  const angle = travel * Math.PI / 2 + index * Math.PI + .55
  const pasture = longhornPasture(side, index)
  const x = pasture.x + Math.cos(angle) * pasture.rx
  const z = pasture.z + Math.sin(angle) * pasture.rz
  const walking = reducedMotion ? 0 : 4 * walk * (1 - walk)
  const graze = 1 - smooth((phase - 20) / 3) + smooth((phase - 45) / 3)
  return {
    x, z, y: terrainHeight(x, z, side, relief) + .06,
    heading: Math.atan2(-pasture.rx * Math.sin(angle), pasture.rz * Math.cos(angle)),
    scale: index === 0 ? 1.08 : .96,
    head: .08 + graze * (.98 + (reducedMotion ? 0 : Math.sin(t * 1.7 + index) * .035)),
    stride: Math.sin(travel * Math.PI * 12) * .3 * walking,
    tail: reducedMotion ? 0 : Math.sin(t * 1.6 + index * 2) * .25,
  }
}
