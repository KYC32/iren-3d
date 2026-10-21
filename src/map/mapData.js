import { locationFor } from '../data/research.js'
export const MAP_HOME_CENTER = [-108, 45]
// A single Pacific/America view keeps Australia clear of the campus sidebar.
// A tiny inset avoids MapLibre treating equal
// wrapped endpoints (exactly 360° apart) as a zero-width range.
const MAP_WORLD_CENTER = -160
export const MAP_WORLD_BOUNDS = [[MAP_WORLD_CENTER - 179.9999, -85.051129], [MAP_WORLD_CENTER + 179.9999, 85.051129]]
export const mapLongitude = lng => MAP_WORLD_CENTER + ((lng - MAP_WORLD_CENTER + 180) % 360 + 360) % 360 - 180
export const minimumMapZoom = (width, height) => Math.max(0, Math.log2(Math.max(width, height, 1) / 512)) + 0.001
// 지도 위 지역 단추 (맨 끝 '본사' = 시드니 본사로 가면서 경영진 발언 칸을 엶 — useAppStore.setMapRegion)
export const REGION_NAMES = { NA: ['북미','North America'], ALL: ['전체','All'], US: ['미국','US'], CA: ['캐나다','Canada'], AU: ['호주','Australia'], ES: ['스페인','Spain'], HQ: ['본사','HQ'] }
// 지도 위 본사 카드 자리: 캠퍼스 마커와 같은 경도 펼침 → 시드니가 번디와 같은 쪽(북미 왼쪽)에 놓임
export const hqLngLat = (hq) => [mapLongitude(hq.lng), hq.lat]
// 지도 위 한 점이 화면 안에 있나 (가로 80px · 아래 100px 여유 — 카드가 화면 끝에 걸쳐도 보이는 셈)
//   경도 ±360° 사본도 봄: 이 지도는 경도를 펼쳐 두지만(시드니 −208.8°) 지도 라이브러리는 비행 뒤 중심을 [−180,180] 으로 접어서,
//   펼친 경도 하나만 화면 좌표로 바꾸면 360° 떨어진 엉뚱한 자리를 봄 (본사 카드가 발언 자료를 안 받던 원인)
//   project: 지도의 [경도, 위도] → { x, y } (maplibre map.project)
export function onScreenAnyCopy(project, [lng, lat], width, height) {
  return [0, 360, -360].some((dx) => {
    const p = project([lng + dx, lat])
    return p.x > -80 && p.x < width + 80 && p.y > 0 && p.y < height + 100
  })
}
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

// 지역 단추 → 지도 범위 (GeoMap 이 fitBounds 에 씀)
//   'HQ'(본사) 는 null — 범위가 아니라 본사 한 점으로 날아가야 해서 GeoMap 이 따로 처리
//   'ALL'·'AU' 는 캠퍼스 범위에 본사(시드니)도 넣음 — 호주를 볼 때 번디만 보이고 본사가 화면 밖에 있지 않게
//   'NA' 는 미국+캐나다, 그 밖은 그 나라 캠퍼스만
export function regionBounds(country, sites, research, hq) {
  if (country === 'HQ') return null
  const picked = sites.filter((s) => country === 'ALL' || (country === 'NA' ? ['US', 'CA'].includes(s.country) : s.country === country))
  const centerLng = MAP_HOME_CENTER[0]
  const bounds = boundsFor(picked, research, { centerLng })
  if (!hq || !['ALL', 'AU'].includes(country)) return bounds
  const lng = centerLng + ((hq.lng - centerLng + 180) % 360 + 360) % 360 - 180 // boundsFor 와 같은 경도 펼침
  if (!bounds) return [[lng, hq.lat], [lng, hq.lat]]
  return [[Math.min(bounds[0][0], lng), Math.min(bounds[0][1], hq.lat)], [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], hq.lat)]]
}
