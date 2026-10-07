// =============================================================
// 보드판(국가 카드) 육각 타일 사전계산
// 사용법: npm run geo   (결과: public/data/board-hex.json)
// -------------------------------------------------------------
// 카드마다(캐나다·미국·스페인·호주) "그 나라 육지만" h3 육각형으로 바꿔 나라 실루엣을 만듭니다.
// 이웃 나라는 그리지 않아서 카드 위에 나라가 섬처럼 떠 보입니다.
// 해상도는 카드마다 다름(boards.js 의 res) — 배율이 달라도 타일이 화면에서 비슷한 크기가 되도록.
//
// 저장 형식:
//   { res: { ca: 3, ... }, stride: 3,
//     boards: { ca: [lat, lng, focus, ...], ... },     focus: 1 = 강조할 주 안, 0 = 그 밖
//     lines:  { ca: { countries, states, focus }, ... } }   [경도, 위도, 경도, 위도, ...] 선 목록
//   - countries: 그 나라 외곽선(해안선·국경)       - states: 그 나라 안의 주 경계
//   - focus    : 강조할 주의 외곽선
// 주 경계: 미국은 us-atlas, 캐나다·호주는 Natural Earth 50m 캐시(npm run geo:fetch).
// 스페인은 50m 에 주 경계가 없어 사이트 반경(focus.km) 안을 강조합니다.
// =============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { polygonToCells, cellToLatLng, greatCircleDistance } from 'h3-js'
import { feature, mesh } from 'topojson-client'
import { BOARDS, insideBoard, keepPoint } from '../src/scene/boards.js'

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'))
const countries = feature(topo, topo.objects.countries).features
const us = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/states-10m.json', import.meta.url), 'utf8'))
const usStates = feature(us, us.objects.states).features
const iren = JSON.parse(readFileSync(new URL('../data/companies/iren.json', import.meta.url), 'utf8'))

const NE_FILE = new URL('./.cache/ne_50m_admin_1_states_provinces.geojson', import.meta.url)
const ne = existsSync(NE_FILE) ? JSON.parse(readFileSync(NE_FILE, 'utf8')) : null
if (!ne) console.log('  (Natural Earth 캐시 없음 → 캐나다·호주 주 경계·강조 생략. npm run geo:fetch)')
const NE_A3 = { CA: 'CAN', AU: 'AUS' }

// Polygon/MultiPolygon → 폴리곤 목록, 각종 도형 → 선(점 배열) 목록
const polysOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [])
function lines(geom) {
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}
// 폴리곤의 바깥 링이 통째로 "그릴 범위" 안인지 (알래스카·하와이 같은 떨어진 땅 제외)
const keepPoly = (board, poly) => poly[0].every(([lng, lat]) => keepPoint(board, lat, lng))

// 선을 카드 안 구간들로 자르고, 가까운 점은 건너뛰어 가볍게 (minDeg: 배율이 큰 카드일수록 촘촘히)
function clip(board, coords, minDeg) {
  const runs = []
  let run = []
  let last = null
  const flush = () => { if (run.length >= 4) runs.push(run); run = []; last = null }
  for (const [lng, lat] of coords) {
    if (!keepPoint(board, lat, lng) || !insideBoard(board, lat, lng)) { flush(); continue }
    if (last && Math.hypot(lng - last[0], lat - last[1]) < minDeg) continue
    run.push(Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000)
    last = [lng, lat]
  }
  flush()
  return runs
}

// 한 나라 안의 주 경계(두 주가 공유하는 구간만 — 해안선 이중 그리기 방지)
function innerBorders(provs) {
  const key = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`
  const owners = new Map()
  provs.forEach((f, i) => { for (const r of lines(f.geometry)) for (const p of r) { const k = key(p); if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(i) } })
  const out = []
  for (const f of provs) for (const r of lines(f.geometry)) {
    let run = []
    for (const p of r) { if (owners.get(key(p)).size > 1) run.push(p); else { if (run.length > 1) out.push(run); run = [] } }
    if (run.length > 1) out.push(run)
  }
  return out
}

const res = {}, boards = {}, lineOut = {}
for (const board of BOARDS) {
  const country = countries.find((f) => String(f.id) === board.topo)
  const polys = polysOf(country.geometry).filter((p) => keepPoly(board, p))

  // 1) 강조 영역: 주 폴리곤 목록 (또는 사이트 반경)
  let focusPolys = []
  let stateLines = []
  if (board.focus.us) {
    focusPolys = usStates.filter((f) => board.focus.us.includes(String(f.id))).flatMap((f) => polysOf(f.geometry))
    stateLines = lines(mesh(us, us.objects.states, (a, b) => a !== b))
  } else if (board.focus.ne && ne) {
    const provs = ne.features.filter((f) => f.properties.adm0_a3 === NE_A3[board.country])
    focusPolys = provs.filter((f) => board.focus.ne.includes(f.properties.name)).flatMap((f) => polysOf(f.geometry))
    stateLines = innerBorders(provs)
  }
  const focusCells = new Set(focusPolys.flatMap((p) => { try { return polygonToCells(p, board.res, true) } catch { return [] } }))
  const sites = iren.sites.filter((s) => s.country === board.country)
  const nearSite = (lat, lng) => sites.some((s) => greatCircleDistance([lat, lng], [s.coord.lat, s.coord.lng], 'km') <= board.focus.km)

  // 2) 그 나라 육지 → 육각 타일
  const cells = new Map()
  for (const poly of polys) {
    let ids
    try { ids = polygonToCells(poly, board.res, true) } catch { continue }
    for (const c of ids) {
      const [lat, lng] = cellToLatLng(c)
      if (!insideBoard(board, lat, lng, 0.4)) continue
      const focus = board.focus.km ? nearSite(lat, lng) : focusCells.has(c)
      cells.set(c, [lat, lng, focus])
    }
  }
  const flat = []
  for (const [lat, lng, focus] of cells.values()) flat.push(Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000, focus ? 1 : 0)
  res[board.id] = board.res
  boards[board.id] = flat
  const nFocus = [...cells.values()].filter((c) => c[2]).length

  // 3) 선: 나라 외곽선 / 주 경계 / 강조 주 외곽선
  const minDeg = 0.12 / board.k // 화면에서 약 0.12 단위 간격
  lineOut[board.id] = {
    countries: polys.flatMap((p) => p.flatMap((ring) => clip(board, ring, minDeg))),
    states: stateLines.flatMap((l) => clip(board, l, minDeg * 1.5)),
    focus: focusPolys.flatMap((p) => p.flatMap((ring) => clip(board, ring, minDeg))),
  }
  console.log(`  ${board.id}: 육각형 ${cells.size.toLocaleString()}개 (강조 ${nFocus.toLocaleString()}), 해상도 ${board.res}`)
}

writeFileSync(new URL('../public/data/board-hex.json', import.meta.url), JSON.stringify({ res, stride: 3, boards, lines: lineOut }))
console.log('✅ board-hex.json')
