// 실측 지형을 쓰는 캠퍼스 목록. 패널도 campusLandscape.js 를 부르므로 격자 파일은 여기(3D 묶음)에만 둠
import childress from './terrain/childress.json'
import { realRelief } from './campusLandscape.js'

const GRIDS = { childress }
const cache = new Map()

// 경관 설정에 실측 높이를 더해 돌려줌. 같은 객체를 다시 쓰므로 식생을 매번 다시 계산하지 않음
export function withRealTerrain(siteId, profile) {
  if (!profile || !GRIDS[siteId]) return profile
  if (!cache.has(siteId)) cache.set(siteId, { ...profile, relief: realRelief(GRIDS[siteId]), realTerrain: GRIDS[siteId] })
  return cache.get(siteId)
}
