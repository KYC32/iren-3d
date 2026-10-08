import { locationFor } from '../data/research.js'
export const MAP_HOME_CENTER = [-108, 45]
// A single Pacific/America view keeps Australia clear of the campus sidebar.
// A tiny inset avoids MapLibre treating equal
// wrapped endpoints (exactly 360° apart) as a zero-width range.
const MAP_WORLD_CENTER = -160
export const MAP_WORLD_BOUNDS = [[MAP_WORLD_CENTER - 179.9999, -85.051129], [MAP_WORLD_CENTER + 179.9999, 85.051129]]
export const mapLongitude = lng => MAP_WORLD_CENTER + ((lng - MAP_WORLD_CENTER + 180) % 360 + 360) % 360 - 180
export const minimumMapZoom = (width, height) => Math.max(0, Math.log2(Math.max(width, height, 1) / 512)) + 0.001
export const REGION_NAMES = { NA: ['북미','North America'], ALL: ['전체','All'], US: ['미국','US'], CA: ['캐나다','Canada'], AU: ['호주','Australia'], ES: ['스페인','Spain'] }
export function siteFeatures(sites, research) {
  return { type: 'FeatureCollection', features: sites.map((s) => {
    const location = locationFor(s,research)
    return { type:'Feature', id:s.id, geometry:{type:'Point',coordinates:[location.lng,location.lat]}, properties:{id:s.id, name:s.name+(location.precise?'':' · region'), name_ko:(s.name_ko ?? s.name)+(location.precise?'':' · 지역'), status:s.status, precise:location.precise} }
  }) }
}
export function boundsFor(sites, research, { centerLng } = {}) {
  // 전체 지도는 북미를 기준으로 경도를 펼쳐, 호주가 태평양 건너 왼쪽에 놓이게 합니다.
  // 원본 좌표는 그대로 두고 카메라 범위만 날짜변경선 너머까지 연결합니다.
  const coords = siteFeatures(sites,research).features.map((f)=>{
    const [lng,lat] = f.geometry.coordinates
    return [centerLng == null ? lng : centerLng + ((lng - centerLng + 180) % 360 + 360) % 360 - 180, lat]
  })
  if (!coords.length) return null
  return [[Math.min(...coords.map(c=>c[0])),Math.min(...coords.map(c=>c[1]))],[Math.max(...coords.map(c=>c[0])),Math.max(...coords.map(c=>c[1]))]]
}
