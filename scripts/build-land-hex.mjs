// =============================================================
// 육지 육각형 타일 미리 계산 스크립트
// 사용법: npm run geo   (결과: public/data/land-hex.json)
// -------------------------------------------------------------
// 브라우저에서 매번 h3 로 나라 경계를 육각형으로 바꾸면 1~2초 멈추고 번들도 커집니다.
// 그래서 개발할 때 한 번만 계산해 "육각형 중심 좌표 목록"을 JSON 으로 저장합니다.
//
// 두 가지 크기를 섞습니다.
//   - 기본: 해상도 3 (한 변 약 60km) — 지구 전체
//   - 사이트 주변(반경 FINE_DEG 도): 해상도 4 (한 변 약 23km) — 해안선·지형이 덜 거칠게
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { polygonToCells, cellToLatLng, latLngToCell, greatCircleDistance } from 'h3-js'
import { feature } from 'topojson-client'
import { buildInfra } from './build-data.mjs'
import { ISO2_TO_NUM } from './iso.mjs'
import { createHash } from 'node:crypto'

const RES = 3        // 기본 해상도 (작을수록 큼직한 저폴리 타일)
const FINE_RES = 4   // 사이트 주변 해상도
let FINE_DEG = 3.5   // 사이트 무리 주변 반경 (도). 1도 ≈ 111km — 예산을 넘으면 자동으로 줄임
const BUDGET_TOTAL = 20000 // 전체 타일 수 한도 (성능)
const BUDGET_FINE = 9000   // 고해상도 타일 수 한도

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const topo = read('../node_modules/world-atlas/countries-110m.json')
const countries = feature(topo, topo.objects.countries).features
// 사이트 좌표는 회사별 원본을 합친 결과에서 가져옴
const infraSites = buildInfra().sites
// 사이트가 있는 나라 = 민트색 강조 (데이터의 country 에서 자동 계산)
const HOME = new Set(infraSites.map((s) => ISO2_TO_NUM[s.country]).filter(Boolean))
const sites = infraSites.map((s) => ({ id: s.id, lat: s.coord.lat, lng: s.coord.lng }))
// 사이트 좌표 지문: validate 가 "좌표가 바뀌었는데 타일을 안 다시 만들었는지" 확인할 때 사용
const sitesHash = createHash('sha1').update(JSON.stringify(infraSites.map((s) => [s.id, s.coord.lat, s.coord.lng]))).digest('hex').slice(0, 12)

// 사이트를 1.5도 격자로 묶어 "무리 중심" 목록을 만듦 → 가까운 사이트들이 고해상도 영역을 겹쳐 쓰지 않게
const focusRegions = (() => {
  const buckets = new Map()
  for (const s of sites) {
    const k = `${Math.round(s.lat / 1.5)}:${Math.round(s.lng / 1.5)}`
    const b = buckets.get(k) ?? { lat: 0, lng: 0, n: 0 }
    b.lat += s.lat; b.lng += s.lng; b.n += 1
    buckets.set(k, b)
  }
  return [...buckets.values()].map((b) => ({ lat: b.lat / b.n, lng: b.lng / b.n }))
})()
// 무리 중심 반경 안인지: 대권 거리(km) 기준
function nearSite(lat, lng) {
  const km = FINE_DEG * 111.2
  return focusRegions.some((s) => greatCircleDistance([lat, lng], [s.lat, s.lng], 'km') < km)
}

// 점이 다각형 안에 있는지 (ray casting) — h3 변환 실패 시 대체용
function inside(lng, lat, ring) {
  let ins = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins
  }
  return ins
}
function sampleCells(ring, res) {
  const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1])
  const step = res >= 4 ? 0.08 : 0.2
  const out = new Set()
  for (let lat = Math.min(...lats); lat <= Math.max(...lats); lat += step)
    for (let lng = Math.min(...lngs); lng <= Math.max(...lngs); lng += step)
      if (inside(lng, lat, ring)) out.add(latLngToCell(lat, lng, res))
  return out
}

// 나라 하나를 주어진 해상도의 셀 집합으로 (실패하면 격자 샘플링)
function cellsOf(f, res) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  try {
    const out = new Set()
    for (const p of polys) for (const c of polygonToCells(p, res, true)) out.add(c)
    return { cells: out, fallback: false }
  } catch {
    // 110m 데이터에서 h3 변환이 실패하는 폴리곤(예: 북한)은 격자로 점을 찍어 대신 채움
    const out = new Set()
    for (const p of polys) for (const c of sampleCells(p[0], res)) out.add(c)
    return { cells: out, fallback: true }
  }
}

function generate() {
const cells = new Map() // 셀 id → { home, res }
  const fallbacks = []
  const put = (c, home, res) => {
    const prev = cells.get(c)
    if (!prev || (home && !prev.home)) cells.set(c, { home, res })
  }
  
  for (const f of countries) {
    if (f.id === '010') continue // 남극 제외 (화면에 거의 안 보이고 타일 수만 많음)
    const home = HOME.has(String(f.id))
  
    // 1) 기본 해상도: 사이트 반경 밖의 셀만
    const coarse = cellsOf(f, RES)
    if (coarse.fallback) fallbacks.push(f.properties.name)
    for (const c of coarse.cells) {
      const [lat, lng] = cellToLatLng(c)
      if (!nearSite(lat, lng)) put(c, home, RES)
    }
  
    // 2) 사이트 근처 나라만: 고해상도로 반경 안의 셀
    const touches = sites.some((s) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      return polys.some((p) => p[0].some(([lng, lat]) => Math.abs(lat - s.lat) < FINE_DEG * 2 && Math.abs(lng - s.lng) < FINE_DEG * 3))
    })
    if (!touches) continue
    for (const c of cellsOf(f, FINE_RES).cells) {
      const [lat, lng] = cellToLatLng(c)
      if (nearSite(lat, lng)) put(c, home, FINE_RES)
    }
  }
  
  
  return { cells, fallbacks }
}

// 예산 안에 들어올 때까지 고해상도 반경을 0.5도씩 줄이며 재시도
let result
for (;;) {
  result = generate()
  const fineCount = [...result.cells.values()].filter((v) => v.res === FINE_RES).length
  if ((result.cells.size <= BUDGET_TOTAL && fineCount <= BUDGET_FINE) || FINE_DEG <= 1) break
  console.log(`  타일 ${result.cells.size}개 / 고해상도 ${fineCount}개 — 예산 초과, 반경 ${FINE_DEG}° → ${FINE_DEG - 0.5}°`)
  FINE_DEG -= 0.5
}
const { cells, fallbacks } = result
if (cells.size > BUDGET_TOTAL) { console.error(`❌ 타일 ${cells.size}개 > 예산 ${BUDGET_TOTAL}`); process.exit(1) }

// [위도, 경도, home(1/0), 고해상도(1/0)] 를 평평한 숫자 배열로 → 파일 크기 최소화
const flat = []
let fine = 0
for (const [c, v] of cells) {
  const [lat, lng] = cellToLatLng(c)
  const isFine = v.res === FINE_RES
  if (isFine) fine++
  flat.push(Math.round(lat * 100) / 100, Math.round(lng * 100) / 100, v.home ? 1 : 0, isFine ? 1 : 0)
}
writeFileSync(new URL('../public/data/land-hex.json', import.meta.url), JSON.stringify({ res: RES, fineRes: FINE_RES, stride: 4, sitesHash, cells: flat }))
console.log(`✅ land-hex.json — 육각형 ${cells.size.toLocaleString()}개 (무리 ${focusRegions.length}곳 반경 ${FINE_DEG}° 고해상도 ${fine.toLocaleString()}개, 강조 국가 ${HOME.size}곳, 격자 대체: ${fallbacks.join(', ') || '없음'})`)
