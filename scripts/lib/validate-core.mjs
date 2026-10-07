// =============================================================
// 데이터 검증 핵심 로직 (validate.mjs, check-draft.mjs 가 함께 사용)
// -------------------------------------------------------------
// 1) zod 스키마  2) id 중복·참조  3) 날짜 순서  4) 매달 전력 합계 ≤ 확보 전력
// 5) 좌표가 해당 국가 안인지  6) 3km 안 다른 사이트(중복 의심) 경고
// 7) 회사색 중복·상태색과 겹침  8) 추정(estimate)에는 설명  9) 지도 타일 갱신 필요 경고
// 오류가 하나라도 있으면 빌드를 멈춥니다. 경고는 표시만 합니다.
// =============================================================
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { feature } from 'topojson-client'
import { CompaniesFile, CompanySitesFile } from '../../src/data/schema.js'
import { toMonth, phaseMonth, statusAt, grossOf, powerAt, effectiveBuildingsAt } from '../../src/data/timeline.js'
import { STATUS_STYLE } from '../../src/data/statusStyle.js'
import { ISO2_TO_NUM } from '../iso.mjs'
import { createHash } from 'node:crypto'

export function validateAll({ companiesFile, files }) {
const errors = []
const warns = []
const err = (m) => errors.push(m)
const warn = (m) => warns.push(m)

// ---------- 1) 스키마 ----------
const issues = (label, r) => r.success || r.error.issues.forEach((i) => err(`${label} ${i.path.join('.')}: ${i.message}`))
issues('companies.json', CompaniesFile.safeParse(companiesFile))
for (const [name, file] of Object.entries(files)) {
  issues(`companies/${name}.json`, CompanySitesFile.safeParse(file))
  if (file.company_id !== name) err(`companies/${name}.json: company_id(${file.company_id}) 가 파일 이름과 다름`)
}
if (errors.length) return { errors, warns }

// 회사별 파일을 합친 것 (build-data.mjs 와 같은 방식)
const infra = {
  as_of: Object.values(files).reduce((a, f) => (f.as_of > a ? f.as_of : a), '0000-00-00'),
  companies: companiesFile.companies,
  programs: companiesFile.programs ?? [],
  sites: Object.values(files).flatMap((f) => f.sites.map((s) => ({ ...s, as_of: f.as_of }))),
}
const companyIds = new Set(infra.companies.map((c) => c.id))
const programIds = new Set(infra.programs.map((p) => p.id))

// ---------- 2) id·참조 ----------
const seen = new Set()
for (const id of [...infra.companies.map((c) => c.id), ...infra.programs.map((p) => p.id)]) {
  if (seen.has(id)) err(`회사/프로그램 id 중복: ${id}`)
  seen.add(id)
}
for (const p of infra.programs) for (const m of p.members) if (!companyIds.has(m)) err(`프로그램 ${p.id}: 없는 회사 ${m}`)
const siteIds = new Set()
for (const s of infra.sites) {
  if (siteIds.has(s.id)) err(`사이트 id 중복: ${s.id}`)
  siteIds.add(s.id)
  if (!companyIds.has(s.primary)) err(`${s.id}: primary 회사 ${s.primary} 없음`)
  if (!s.parties.some((p) => p.company === s.primary)) err(`${s.id}: primary 가 parties 에 없음`)
  for (const p of s.parties) if (!companyIds.has(p.company)) err(`${s.id}: parties 에 없는 회사 ${p.company}`)
  if (s.program && !programIds.has(s.program)) err(`${s.id}: 없는 프로그램 ${s.program}`)
  const bids = new Set()
  for (const b of s.buildings) {
    if (bids.has(b.id)) err(`${s.id}/${b.id}: 건물 id 중복`)
    bids.add(b.id)
    if (b.replaces && !s.buildings.some((x) => x.id === b.replaces)) err(`${s.id}/${b.id}: replaces 대상 ${b.replaces} 없음`)
  }
}

// ---------- 3) 날짜 순서 ----------
for (const s of infra.sites) {
  const asOfM = toMonth(s.as_of.slice(0, 7))
  const ann = toMonth(s.announced)
  const pm = s.power.map((p) => toMonth(p.from))
  if (pm.some((v, i) => i && v < pm[i - 1])) err(`${s.id}: power 날짜가 오름차순이 아님`)
  if (pm[0] < ann) err(`${s.id}: 첫 power(${s.power[0].from}) 가 announced(${s.announced}) 보다 이름`)
  for (const b of s.buildings) {
    const ph = b.phases.map(phaseMonth)
    if (ph.some((v, i) => i && v < ph[i - 1])) err(`${s.id}/${b.id}: phases 날짜가 오름차순이 아님`)
    const ri = b.phases.findIndex((p) => p.status === 'retired')
    if (ri !== -1 && ri !== b.phases.length - 1) err(`${s.id}/${b.id}: retired 는 마지막 단계에만`)
    b.phases.forEach((p, i) => {
      if (ph[i] > asOfM && p.basis === 'reported') err(`${s.id}/${b.id}: 기준일 이후 단계(${p.from})는 basis 가 target/estimate 여야 함`)
    })
    if (statusAt(b, asOfM) === 'under_construction' && b.progress == null) err(`${s.id}/${b.id}: 기준일에 건설중인 건물은 progress(0~1) 필요`)
  }
  const usesEstimate = s.buildings.some((b) => b.phases.some((p) => p.basis === 'estimate')) || s.power.some((p) => p.basis === 'estimate')
  if (usesEstimate && !s.estimates.length) err(`${s.id}: estimate 단계가 있으면 estimates[] 에 설명이 필요`)
}

// ---------- 4) 매달 전력 합계 ----------
const M0 = toMonth('2024-01'), M1 = toMonth('2028-12')
for (const s of infra.sites) {
  for (let m = M0; m <= M1; m++) {
    const power = powerAt(s, m)
    if (!power) continue
    let sum = 0
    for (const b of s.buildings) {
      if (b.replaces) continue // 기존 건물 전력을 넘겨받는 전환은 새 전력이 아님
      const st = statusAt(b, m)
      if (st && st !== 'retired') sum += grossOf(b).mw
    }
    if (sum > power.secured * 1.05) { err(`${s.id}: ${Math.floor(m / 12)}-${(m % 12) + 1} 건물 합계 ${Math.round(sum)}MW > 확보 전력 ${power.secured}MW`); break }
    // 실제로 전력을 쓰는 건물(가동·시운전·폐쇄중)만, 전환으로 넘겨받은 용량까지 반영한 그 달 합계
    const drawing = effectiveBuildingsAt(s, m)
      .filter((e) => ['operating', 'commissioning', 'decommissioning'].includes(e.status))
      .reduce((n, e) => n + e.mw, 0)
    if (drawing > power.secured * 1.05) { err(`${s.id}: ${Math.floor(m / 12)}-${(m % 12) + 1} 실제 사용 전력 ${Math.round(drawing)}MW > 확보 전력 ${power.secured}MW (IT 만 공개된 건물은 PUE 확인)`); break }
  }
}

// ---------- 5) 좌표가 국가 안인지 ----------
const topo = JSON.parse(readFileSync(new URL('../../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'))
// 같은 국가 코드를 가진 영토가 여러 개일 수 있어(예: 호주 본토 + 애슈모어 제도) 코드별로 모두 모음
const countries = new Map()
for (const f of feature(topo, topo.objects.countries).features) {
  const k = String(f.id)
  countries.set(k, [...(countries.get(k) ?? []), f])
}
function inside(lng, lat, ring) {
  let ins = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins
  }
  return ins
}
function inCountry(f, lng, lat) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  return polys.some((p) => inside(lng, lat, p[0]))
}
for (const s of infra.sites) {
  const num = ISO2_TO_NUM[s.country]
  if (!num) { warn(`${s.id}: scripts/iso.mjs 에 ${s.country} 코드가 없어 좌표 검사를 건너뜀`); continue }
  const fs = countries.get(num)
  if (fs && !fs.some((f) => inCountry(f, s.coord.lng, s.coord.lat))) err(`${s.id}: 좌표(${s.coord.lat}, ${s.coord.lng})가 ${s.country} 영토 밖`)
}

// ---------- 6) 3km 안 다른 사이트 ----------
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
for (let i = 0; i < infra.sites.length; i++)
  for (let j = i + 1; j < infra.sites.length; j++)
    if (km(infra.sites[i].coord, infra.sites[j].coord) < 3) warn(`${infra.sites[i].id} ↔ ${infra.sites[j].id}: 3km 안 — 같은 장소 중복이 아닌지 확인`)

// ---------- 7) 회사색 ----------
const statusColors = new Set(Object.values(STATUS_STYLE).map((s) => s.color.toLowerCase()))
const colorSeen = new Map()
for (const c of infra.companies) {
  const col = c.color.toLowerCase()
  if (statusColors.has(col)) err(`${c.id}: 회사색 ${c.color} 이 상태색과 같음`)
  if (colorSeen.has(col)) err(`${c.id}: 회사색 ${c.color} 이 ${colorSeen.get(col)} 와 같음`)
  colorSeen.set(col, c.id)
}

// 완전히 같지 않아도 "눈으로 구분이 안 될 만큼" 가까운 색은 경고
// (참여사 partner 는 핀이 없으니 제외. 거리 = RGB 공간의 직선 거리, 0~441)
const SIMILAR_RGB = 28
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const pinned = infra.companies.filter((c) => c.group !== 'partner')
for (let i = 0; i < pinned.length; i++)
  for (let j = i + 1; j < pinned.length; j++) {
    const a = rgbOf(pinned[i].color), b = rgbOf(pinned[j].color)
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    if (dist > 0 && dist < SIMILAR_RGB) warn(`${pinned[i].id} ↔ ${pinned[j].id}: 회사색이 너무 비슷함 (${pinned[i].color} / ${pinned[j].color}, 거리 ${dist.toFixed(0)})`)
  }

// ---------- 9) 지도 타일 갱신 필요 여부 ----------
const hash = createHash('sha1').update(JSON.stringify(infra.sites.map((s) => [s.id, s.coord.lat, s.coord.lng]))).digest('hex').slice(0, 12)
const hexFile = new URL('../../public/data/land-hex.json', import.meta.url)
if (existsSync(hexFile)) {
  const h = JSON.parse(readFileSync(hexFile, 'utf8')).sitesHash
  if (h !== hash) warn('사이트 좌표가 바뀌었습니다 → npm run geo 로 지구본 타일을 다시 만드세요')
}

return { errors, warns, infra }
}
