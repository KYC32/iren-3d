// =============================================================
// 지구본 경계선 미리 계산 스크립트
// 사용법: npm run geo   (결과: public/data/borders.json)
// -------------------------------------------------------------
//   countries : 국경 + 해안선 (Natural Earth 110m)
//   states    : 미국 주 경계 (us-atlas 10m, 내부 경계만)
//   focus     : 사이트가 있는 주(텍사스·오클라호마) 외곽선 — 조금 진하게 그림
// 좌표는 [경도, 위도, 경도, 위도, ...] 평평한 배열, 소수 둘째 자리로 반올림합니다.
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { mesh, feature } from 'topojson-client'

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const world = read('../node_modules/world-atlas/countries-110m.json')
const us = read('../node_modules/us-atlas/states-10m.json')

const FOCUS_STATES = new Set(['48', '40']) // 48 텍사스, 40 오클라호마 (FIPS 코드)

// 선 하나를 단순화: 가까운 점(약 minDeg 미만)은 건너뛰고 반올림
function simplify(coords, minDeg) {
  const out = []
  let px = null, py = null
  coords.forEach(([x, y], i) => {
    const last = i === coords.length - 1
    if (px === null || last || Math.hypot(x - px, y - py) >= minDeg) {
      out.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100)
      px = x; py = y
    }
  })
  return out.length >= 4 ? out : null
}
// MultiLineString / Polygon / MultiPolygon → 선 목록
function lines(geom) {
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}

// 남극 해안선은 제외
const worldNoAQ = { ...world, objects: { countries: { ...world.objects.countries, geometries: world.objects.countries.geometries.filter((g) => g.id !== '010') } } }
const countries = lines(mesh(worldNoAQ, worldNoAQ.objects.countries)).map((l) => simplify(l, 0.15)).filter(Boolean)
// 주 경계: 두 주 사이의 선만 (a !== b) → 해안선과 국경은 위의 countries 가 그림
const states = lines(mesh(us, us.objects.states, (a, b) => a !== b)).map((l) => simplify(l, 0.12)).filter(Boolean)
const focus = feature(us, us.objects.states).features
  .filter((f) => FOCUS_STATES.has(String(f.id)))
  .flatMap((f) => lines(f.geometry).map((l) => simplify(l, 0.06)))
  .filter(Boolean)

writeFileSync(new URL('../public/data/borders.json', import.meta.url), JSON.stringify({ countries, states, focus }))
const pts = (arr) => arr.reduce((n, l) => n + l.length / 2, 0).toLocaleString()
console.log(`✅ borders.json — 국경·해안선 ${countries.length}개(${pts(countries)}점), 주 경계 ${states.length}개(${pts(states)}점), 강조 ${focus.length}개`)
