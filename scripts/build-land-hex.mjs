// =============================================================
// 육지 육각형 타일 미리 계산 스크립트
// 사용법: npm run land   (결과: public/data/land-hex.json)
// -------------------------------------------------------------
// 브라우저에서 매번 h3 로 나라 경계를 육각형으로 바꾸면 1~2초 멈추고 번들도 커집니다.
// 그래서 개발할 때 한 번만 계산해 "육각형 중심 좌표 목록"을 JSON 으로 저장합니다.
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { polygonToCells, cellToLatLng, latLngToCell } from 'h3-js'
import { feature } from 'topojson-client'

const RES = 3 // h3 해상도: 3 = 육각형 한 변 약 60km (작을수록 큼직한 저폴리 타일)
// IREN 사이트가 있는 나라 (민트색 강조): 미국, 캐나다, 호주, 스페인
const HOME = new Set(['840', '124', '036', '724'])

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url), 'utf8'))
const countries = feature(topo, topo.objects.countries).features

const cells = new Map() // 셀 id → home 여부 (같은 셀이 두 나라에 걸치면 home 우선)
let skipped = []
for (const f of countries) {
  if (f.id === '010') continue // 남극은 화면에서 거의 안 보이고 타일 수만 많아 제외
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  try {
    for (const p of polys) {
      for (const c of polygonToCells(p, RES, true)) {
        const home = HOME.has(String(f.id))
        if (!cells.has(c) || home) cells.set(c, home)
      }
    }
  } catch {
    // 110m 데이터에서 h3 변환이 실패하는 폴리곤(예: 북한)은
    // 0.2도 격자로 점을 찍어 "폴리곤 안에 있는 점"의 셀을 모으는 방식으로 대신 채웁니다.
    for (const p of polys) for (const c of sampleCells(p[0])) {
      const home = HOME.has(String(f.id))
      if (!cells.has(c) || home) cells.set(c, home)
    }
    skipped.push(`${f.properties.name}(격자 대체)`)
  }
}

// 점이 다각형 안에 있는지 (ray casting)
function inside(lng, lat, ring) {
  let ins = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins
  }
  return ins
}
function sampleCells(ring) {
  const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1])
  const out = new Set()
  for (let lat = Math.min(...lats); lat <= Math.max(...lats); lat += 0.2)
    for (let lng = Math.min(...lngs); lng <= Math.max(...lngs); lng += 0.2)
      if (inside(lng, lat, ring)) out.add(latLngToCell(lat, lng, RES))
  return out
}

// [위도, 경도, home(1/0)] 를 평평한 숫자 배열로 저장 → 파일 크기 최소화
const flat = []
for (const [c, home] of cells) {
  const [lat, lng] = cellToLatLng(c)
  flat.push(Math.round(lat * 100) / 100, Math.round(lng * 100) / 100, home ? 1 : 0)
}
const out = new URL('../public/data/land-hex.json', import.meta.url)
writeFileSync(out, JSON.stringify({ res: RES, stride: 3, cells: flat }))
console.log(`✅ land-hex.json — 육각형 ${cells.size.toLocaleString()}개 (대체 처리: ${skipped.join(', ') || '없음'})`)
