// =============================================================
// 보드판 지도 육각 타일 사전계산
// 사용법: npm run geo   (결과: public/data/board-hex.json)
// -------------------------------------------------------------
// 판마다(북미 서부·스페인·남호주) 그 범위의 육지를 h3 해상도 4(한 변 약 23km) 육각형으로 바꿉니다.
// 저장 형식: { boards: { na: [lat, lng, home, ...], ... }, lines: { na: { countries, states, focus }, ... } }
//   lines 는 판 범위로 잘라낸 경계선 [경도, 위도, 경도, 위도, ...] 목록
//   - countries: 국경·해안선 (Natural Earth 50m — 지구본용 110m 보다 촘촘)
//   - states   : 미국 주 경계(us-atlas) + 캐나다·호주 주 경계(Natural Earth 50m 캐시가 있으면)
//   - focus    : 사이트가 있는 주(텍사스·오클라호마·BC·남호주) 외곽선
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { polygonToCells, cellToLatLng } from 'h3-js'
import { feature, mesh } from 'topojson-client'
import { existsSync } from 'node:fs'
import { BOARDS, insideBoard, latLngBox } from '../src/scene/boards.js'

const RES = 4
const HOME = new Set(['840', '124', '036', '724']) // 미국·캐나다·호주·스페인 → 민트색

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'))
const countries = feature(topo, topo.objects.countries).features

// 폴리곤(외곽 링)의 경위도 상자
function ringBox(ring) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity
  for (const [lng, lat] of ring) { a = Math.min(a, lat); b = Math.max(b, lat); c = Math.min(c, lng); d = Math.max(d, lng) }
  return { latMin: a, latMax: b, lngMin: c, lngMax: d }
}
const overlaps = (p, q) => p.latMin <= q.latMax && p.latMax >= q.latMin && p.lngMin <= q.lngMax && p.lngMax >= q.lngMin

const out = {}
for (const board of BOARDS) {
  const box = latLngBox(board)
  const cells = new Map()
  for (const f of countries) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) {
      if (!overlaps(ringBox(poly[0]), box)) continue // 판과 겹치지 않는 섬·대륙은 건너뜀
      let ids
      try { ids = polygonToCells(poly, RES, true) } catch { continue }
      for (const c of ids) {
        const [lat, lng] = cellToLatLng(c)
        if (!insideBoard(board, lat, lng, 0.4)) continue
        const home = HOME.has(String(f.id))
        if (!cells.has(c) || home) cells.set(c, [lat, lng, home])
      }
    }
  }
  const flat = []
  for (const [lat, lng, home] of cells.values()) flat.push(Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000, home ? 1 : 0)
  out[board.id] = flat
  console.log(`  ${board.id}: 육각형 ${cells.size.toLocaleString()}개`)
}
// ---------- 경계선 ----------
function lines(geom) {
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}
// 선을 판 안에 있는 구간들로 자르고, 가까운 점은 건너뛰어 가볍게
function clipToBoard(board, coords, minDeg = 0.03) {
  const runs = []
  let run = []
  let last = null
  const flush = () => { if (run.length >= 4) runs.push(run); run = []; last = null }
  for (const [lng, lat] of coords) {
    if (!insideBoard(board, lat, lng)) { flush(); continue }
    if (last && Math.hypot(lng - last[0], lat - last[1]) < minDeg) continue
    run.push(Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000)
    last = [lng, lat]
  }
  flush()
  return runs
}

const us = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/states-10m.json', import.meta.url), 'utf8'))
const countryLines = lines(mesh(topo, topo.objects.countries))
const stateLines = lines(mesh(us, us.objects.states, (a, b) => a !== b))
const focusLines = feature(us, us.objects.states).features.filter((f) => ['48', '40'].includes(String(f.id))).flatMap((f) => lines(f.geometry))

// 캐나다·호주 주 경계 (npm run geo:fetch 로 받은 Natural Earth 50m 캐시가 있으면)
const NE_FILE = new URL('./.cache/ne_50m_admin_1_states_provinces.geojson', import.meta.url)
if (existsSync(NE_FILE)) {
  const ne = JSON.parse(readFileSync(NE_FILE, 'utf8'))
  const provs = ne.features.filter((f) => ['CAN', 'AUS'].includes(f.properties.adm0_a3))
  // 내륙 경계만: 두 주 이상이 공유하는 꼭짓점 구간 (해안선 이중 그리기 방지)
  const key = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`
  const owners = new Map()
  provs.forEach((f, i) => { for (const r of lines(f.geometry)) for (const p of r) { const k = key(p); if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(i) } })
  for (const f of provs) for (const r of lines(f.geometry)) {
    let run = []
    for (const p of r) { if (owners.get(key(p)).size > 1) run.push(p); else { if (run.length > 1) stateLines.push(run); run = [] } }
    if (run.length > 1) stateLines.push(run)
  }
  for (const f of provs.filter((f) => ['British Columbia', 'South Australia'].includes(f.properties.name))) focusLines.push(...lines(f.geometry))
} else {
  console.log('  (Natural Earth 캐시 없음 → 캐나다·호주 주 경계 생략. npm run geo:fetch)')
}

const lineOut = {}
for (const board of BOARDS) {
  lineOut[board.id] = {
    countries: countryLines.flatMap((l) => clipToBoard(board, l)),
    states: stateLines.flatMap((l) => clipToBoard(board, l, 0.05)),
    focus: focusLines.flatMap((l) => clipToBoard(board, l)),
  }
}

writeFileSync(new URL('../public/data/board-hex.json', import.meta.url), JSON.stringify({ res: RES, stride: 3, boards: out, lines: lineOut }))
console.log('✅ board-hex.json')
