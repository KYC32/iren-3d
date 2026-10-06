// =============================================================
// 지구본 경계선 미리 계산 스크립트
// 사용법: npm run geo   (결과: public/data/borders.json)
// -------------------------------------------------------------
//   countries : 국경 + 해안선 (Natural Earth 110m)
//   states    : 미국 주 경계 (us-atlas 10m, 내부 경계만)
//   focus     : 사이트가 있는 주(텍사스·오클라호마·BC·남호주) 외곽선 — 조금 진하게 그림
// 캐나다·호주 주 경계는 Natural Earth 50m 원본(npm run geo:fetch 로 받은 캐시)에서 가져옵니다.
// 캐시가 없으면 그 부분만 건너뜁니다.
// 좌표는 [경도, 위도, 경도, 위도, ...] 평평한 배열, 소수 둘째 자리로 반올림합니다.
// =============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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

// ---------- 캐나다·호주 주 경계 (Natural Earth 50m) ----------
const NE_FILE = new URL('./.cache/ne_50m_admin_1_states_provinces.geojson', import.meta.url)
const NE_COUNTRIES = new Set(['CAN', 'AUS'])
const NE_FOCUS = new Set(['British Columbia', 'South Australia'])
let neNote = '캐시 없음 → 건너뜀 (npm run geo:fetch)'
if (existsSync(NE_FILE)) {
  const ne = JSON.parse(readFileSync(NE_FILE, 'utf8'))
  const provs = ne.features.filter((f) => NE_COUNTRIES.has(f.properties.adm0_a3))

  // 내륙 경계만 뽑기: 두 개 이상의 주에 똑같이 들어 있는 꼭짓점 = 주와 주가 맞닿은 선
  // (해안선은 한 주에만 있으므로 빠짐 → 국경·해안선 레이어와 이중으로 그려지지 않음)
  const key = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`
  const owners = new Map()
  provs.forEach((f, i) => {
    for (const ring of lines(f.geometry)) for (const p of ring) {
      const k = key(p)
      if (!owners.has(k)) owners.set(k, new Set())
      owners.get(k).add(i)
    }
  })
  const shared = (p) => owners.get(key(p)).size > 1
  const seen = new Set() // 같은 경계가 양쪽 주에서 두 번 나오므로 한 번만
  provs.forEach((f) => {
    for (const ring of lines(f.geometry)) {
      let run = []
      const flush = () => {
        if (run.length >= 2) {
          const id = [key(run[0]), key(run[run.length - 1])].sort().join('|') + run.length
          if (!seen.has(id)) { seen.add(id); const l = simplify(run, 0.12); if (l) states.push(l) }
        }
        run = []
      }
      for (const p of ring) (shared(p) ? run.push(p) : flush())
      flush()
    }
  })
  // 강조할 주의 외곽선(해안 포함)
  for (const f of provs.filter((f) => NE_FOCUS.has(f.properties.name))) {
    for (const ring of lines(f.geometry)) {
      const l = simplify(ring, 0.06)
      if (l && l.length >= 40) focus.push(l) // 아주 작은 섬은 생략
    }
  }
  neNote = `캐나다·호주 ${provs.length}개 주, 강조 ${[...NE_FOCUS].join('·')}`
}

writeFileSync(new URL('../public/data/borders.json', import.meta.url), JSON.stringify({ countries, states, focus }))
const pts = (arr) => arr.reduce((n, l) => n + l.length / 2, 0).toLocaleString()
console.log(`✅ borders.json — 국경·해안선 ${countries.length}개(${pts(countries)}점), 주 경계 ${states.length}개(${pts(states)}점), 강조 ${focus.length}개 / Natural Earth: ${neNote}`)
