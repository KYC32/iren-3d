// =============================================================
// fetch-hq-osm.mjs — 본사 3D 화면의 실제 동네 자료: OpenStreetMap 건물 윤곽·층수·길·가로수 → public/data/hq-city.json
// -------------------------------------------------------------
// 자료: OpenStreetMap (Overpass API 로 받음) — 라이선스 ODbL 1.0, 출처 표기 필수 ('© OpenStreetMap contributors')
//   → 이 스크립트가 만드는 hq-city.json 은 OSM 에서 만든 파생 데이터베이스라 같은 ODbL 로 공개
//     (파일 안 license·note 칸, README 의 자료 출처, 본사 화면 아래 출처 표기)
// 범위: 본사 주소 좌표(data/companies.json 의 hq) 에서 반경 RADIUS m 안에 걸치는 건물·길
// 저장 모양: 좌표는 본사 윤곽(OSM way 548828429 = 55 Market Street) 가운데 기준 미터 [동쪽, 북쪽] (소수 첫째 자리)
//   화면 좌표(1칸 ≈ 5.5m, Market St 가 화면 가로축)로 돌리고 자르는 계산은 src/scene/hqCity.js (테스트 있음)
// 건물 높이 태그는 그대로 옮김 (building:levels · height · min_height …) — 태그가 없을 때의 기본 높이도 hqCity.js 가 정함
//
// 사용법: node scripts/fetch-hq-osm.mjs   (인터넷 필요 · Overpass 가 바쁘면 502·504 → 잠시 뒤 다시 실행)
// =============================================================
import { readFileSync } from 'node:fs'
import { fetchWithUa, writeJsonIfChanged } from './lib/fetch-util.mjs'

const OUT = new URL('../public/data/hq-city.json', import.meta.url).pathname
const HQ_WAY = 548828429   // 55 Market Street 건물 윤곽 (이름 없는 office 윤곽 — 본사 좌표를 품음, 2026-10-27 확인)
const RADIUS = 230         // m — 화면 바닥 판(약 200m 사각형)의 모서리까지 덮도록 조금 넉넉히
const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const UA = { 'User-Agent': 'iren-3d research bot (github.com/KYC32/iren-3d)' } // 사용자 개인정보는 넣지 않음

// 검색 가운데 = 본사 주소 좌표 (회사 자료)
const { companies } = JSON.parse(readFileSync(new URL('../data/companies.json', import.meta.url), 'utf8'))
const hq = companies.find((c) => c.id === 'iren')?.hq
if (!hq) throw new Error('data/companies.json 에 iren 본사(hq) 좌표가 없음')

const query = `[out:json][timeout:90];
(
  way["building"](around:${RADIUS},${hq.lat},${hq.lng});
  way["building:part"](around:${RADIUS},${hq.lat},${hq.lng});
  relation["building"](around:${RADIUS},${hq.lat},${hq.lng});
  relation["building:part"](around:${RADIUS},${hq.lat},${hq.lng});
  way["highway"](around:${RADIUS},${hq.lat},${hq.lng});
  way["area:highway"](around:${RADIUS},${hq.lat},${hq.lng});
  node["natural"="tree"](around:${RADIUS},${hq.lat},${hq.lng});
  node["highway"="street_lamp"](around:${RADIUS},${hq.lat},${hq.lng});
  way["leisure"~"^(park|garden)$"](around:${RADIUS},${hq.lat},${hq.lng});
);
out geom qt;`

const osm = await fetchWithUa(`${ENDPOINT}?data=${encodeURIComponent(query)}`, { headers: UA, timeoutMs: 120000, retries: 3, as: 'json' })
const els = osm.elements ?? []
const hqWay = els.find((e) => e.type === 'way' && e.id === HQ_WAY)
if (!hqWay?.geometry?.length) throw new Error(`본사 윤곽(way ${HQ_WAY})이 결과에 없음 — OSM 에서 지워졌거나 바뀌었는지 확인`)

// ── 좌표: 본사 윤곽 가운데(꼭짓점 평균)를 0 으로, 위도·경도 → 미터 [동, 북] (200m 안이라 평면으로 봐도 오차가 cm 수준) ──
const ring0 = openRing(hqWay.geometry)
const lat0 = ring0.reduce((s, p) => s + p.lat, 0) / ring0.length
const lon0 = ring0.reduce((s, p) => s + p.lon, 0) / ring0.length
const M_LAT = 110574                                  // 위도 1도 ≈ 110.574 km
const M_LON = 111320 * Math.cos((lat0 * Math.PI) / 180) // 경도 1도 = 111.32 km × cos(위도)
const r1 = (v) => Math.round(v * 10) / 10
const toM = (p) => [r1((p.lon - lon0) * M_LON), r1((p.lat - lat0) * M_LAT)]

// 닫힌 줄(첫 점 = 끝 점)이면 끝 점을 뺌 → 윤곽은 꼭짓점 목록만
function openRing(g) {
  const a = g[0], b = g.at(-1)
  return a && b && a.lat === b.lat && a.lon === b.lon ? g.slice(0, -1) : g
}

// 여러 조각(way)으로 된 relation 의 바깥 윤곽 잇기: 끝 점이 같은 조각끼리 이어 닫힌 고리를 만듦
function joinRings(parts) {
  const key = (p) => `${p.lat},${p.lon}`
  const left = parts.map((g) => [...g])
  const rings = []
  while (left.length) {
    let cur = left.shift()
    for (let guard = 0; guard < 500 && key(cur[0]) !== key(cur.at(-1)); guard++) {
      const i = left.findIndex((g) => key(g[0]) === key(cur.at(-1)) || key(g.at(-1)) === key(cur.at(-1)))
      if (i < 0) break
      const g = left.splice(i, 1)[0]
      cur = cur.concat(key(g[0]) === key(cur.at(-1)) ? g.slice(1) : [...g].reverse().slice(1))
    }
    if (cur.length >= 4 && key(cur[0]) === key(cur.at(-1))) rings.push(openRing(cur))
  }
  return rings
}

// 높이에 쓰는 태그만 옮김 (숫자는 숫자로 · 없으면 칸을 안 만듦)
const NUM = ['building:levels', 'building:min_level', 'height', 'min_height', 'roof:levels', 'roof:height']
const TXT = ['name', 'name:ko', 'building', 'building:part', 'roof:shape', 'building:colour', 'roof:colour', 'building:material', 'man_made', 'tower:type']
function pickTags(t = {}) {
  const out = {}
  for (const k of TXT) if (t[k]) out[k] = t[k]
  for (const k of NUM) { const v = parseFloat(String(t[k] ?? '').replace(',', '.')); if (Number.isFinite(v)) out[k] = v }
  return out
}

// 그리는 길만 남김: 차도 · 보행자 거리 · 횡단보도 (인도·계단·자전거길·건물 안 통로·지하는 화면에 안 그려서 뺌 — 파일이 작아짐)
const CAR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service'])
const keepRoad = (t) => !(t.layer && Number(t.layer) < 0) && !(t.tunnel && t.tunnel !== 'no') && t.indoor !== 'yes'
  && (CAR.has(t.highway) || t.highway === 'pedestrian' || (t.highway === 'footway' && t.footway === 'crossing'))

const buildings = [], roads = [], areas = [], trees = [], parks = [], lamps = []
for (const e of els) {
  const t = e.tags ?? {}
  if (e.type === 'node' && t.natural === 'tree') { trees.push(toM(e)); continue }
  if (e.type === 'node' && t.highway === 'street_lamp') { lamps.push(toM(e)); continue }
  if (e.type === 'relation' && (t.building || t['building:part'])) {
    const outers = joinRings((e.members ?? []).filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry).map((m) => m.geometry))
    const inners = joinRings((e.members ?? []).filter((m) => m.type === 'way' && m.role === 'inner' && m.geometry).map((m) => m.geometry))
    outers.forEach((ring, i) => buildings.push({ id: `r${e.id}${outers.length > 1 ? `-${i}` : ''}`, ...pickTags(t), ring: ring.map(toM), ...(inners.length ? { holes: inners.map((h) => h.map(toM)) } : {}) }))
    continue
  }
  if (e.type !== 'way' || !e.geometry?.length) continue
  if (t.building || t['building:part']) {
    buildings.push({ id: `w${e.id}`, ...pickTags(t), ...(e.id === HQ_WAY ? { hq: true } : {}), ring: openRing(e.geometry).map(toM) })
  } else if (t['area:highway']) {
    areas.push({ id: `w${e.id}`, kind: t['area:highway'], ...(t.name ? { name: t.name } : {}), ring: openRing(e.geometry).map(toM) })
  } else if (t.highway) {
    if (!keepRoad(t)) continue
    const area = t.area === 'yes'
    roads.push({
      id: `w${e.id}`, highway: t.highway, ...(t.name ? { name: t.name } : {}),
      ...(Number.isFinite(parseFloat(t.lanes)) ? { lanes: parseFloat(t.lanes) } : {}),
      ...(Number.isFinite(parseFloat(t.width)) ? { width: parseFloat(t.width) } : {}),
      ...(t.oneway === 'yes' ? { oneway: true } : {}),
      ...(t.embedded_rails || t.railway ? { rails: true } : {}),       // 조지 스트리트 경전철
      ...(t.footway === 'crossing' ? { crossing: true } : {}),          // 횡단보도 (줄무늬로 그림)
      ...(area ? { area: true, ring: openRing(e.geometry).map(toM) } : { line: e.geometry.map(toM) }),
    })
  } else if (t.leisure) {
    parks.push({ id: `w${e.id}`, ...(t.name ? { name: t.name } : {}), ring: openRing(e.geometry).map(toM) })
  }
}

const file = {
  schema_version: 1,
  source: {
    name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', api: ENDPOINT,
    license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors',
  },
  note: 'This file is a derived database of OpenStreetMap data and is made available under the Open Database License (ODbL) 1.0.',
  fetched_at: new Date().toISOString(),
  center: { lat: Math.round(lat0 * 1e7) / 1e7, lng: Math.round(lon0 * 1e7) / 1e7, osm_way: HQ_WAY },
  radius_m: RADIUS,
  units: 'm, [east, north] from center',
  buildings: buildings.sort((a, b) => a.id.localeCompare(b.id)),
  roads: roads.sort((a, b) => a.id.localeCompare(b.id)),
  areas: areas.sort((a, b) => a.id.localeCompare(b.id)),
  parks: parks.sort((a, b) => a.id.localeCompare(b.id)),
  trees: trees.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  lamps: lamps.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
}
const changed = writeJsonIfChanged(OUT, file, { ignoreKeys: ['fetched_at'] })
console.log(`${changed ? '✅ 저장' : '— 변경 없음'}: hq-city.json — 건물 ${buildings.length} · 길 ${roads.length} · 길 면 ${areas.length} · 공원 ${parks.length} · 나무 ${trees.length} · 가로등 ${lamps.length}`)
