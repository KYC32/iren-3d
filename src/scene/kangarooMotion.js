import { kangarooHabitat, terrainHeight } from './campusLandscape.js'

// Use the scene clock so normal playback and frame-by-frame recordings agree.
export function kangarooPose(time, index, side, relief, reducedMotion = false) {
  const t = reducedMotion ? 0 : time
  const habitat = kangarooHabitat(side)
  const cycles = t * 1.55 + index * .23
  const phase = cycles % 1
  const airborne = Math.min(phase / .76, 1)
  // Advance during each jump; feet settle briefly between hops instead of sliding.
  const travel = (Math.floor(cycles) + airborne * airborne * (3 - 2 * airborne) - index * .23) / 1.55
  const angle = travel * .19 + index * Math.PI * 2 / 3
  const x = habitat.x + habitat.rx * Math.cos(angle)
  const z = habitat.z + habitat.rz * Math.sin(angle)
  const hop = reducedMotion ? 0 : Math.sin(Math.PI * airborne)
  const scale = [1.2, 1.04, .76][index]
  const ground = terrainHeight(x, z, side, relief)
  return { x, z, ground, y: ground + .06 + hop * .72 * scale, hop, scale,
    heading: Math.atan2(-habitat.rx * Math.sin(angle), habitat.rz * Math.cos(angle)) }
}
