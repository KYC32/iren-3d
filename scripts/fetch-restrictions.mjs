// =============================================================
// fetch-restrictions.mjs — 미국 부지마다 "지역 규제(데이터센터 유예·제한)" 요약을 만들어 data/restrictions.json 에 씀
// -------------------------------------------------------------
// 자료: Miklian(2026) "US data center moratoria and local opposition" — Hugging Face, CC BY 4.0
//   늘 같은 판을 쓰려고 판 번호(commit)를 고정함 (REV). 새 판이 나오면 REV 를 바꾸고 다시 돌림
// 부지가 속한 카운티는 미국 정부(FCC) 지도 서비스로 좌표 → 카운티 번호(FIPS)를 찾음
// 계산은 src/data/restrictions.js (순수 함수 · 테스트 있음)
//
// 사용법: node scripts/fetch-restrictions.mjs   (인터넷 필요 · 받은 CSV 는 저장하지 않고 메모리에서만 읽음)
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { restrictionsFor, statusOf } from '../src/data/restrictions.js'
import { RestrictionsFile } from '../src/data/schema.js'

const REPO = 'miklia/us-data-center-moratoria-local-opposition'
const REV = 'aede5834e0f4add48f3f4eb22a62ec0c429f7396'          // 2026-10-02 판
const RAW = `https://huggingface.co/datasets/${REPO}/resolve/${REV}/replication/raw/`
const UA = { 'User-Agent': 'iren-3d research bot (github.com/KYC32/iren-3d)' }
const YEAR = 2026                                                // '그해 몇 건'을 셀 해 (자료 마지막 해)

// 따옴표·쉼표를 지키는 작은 CSV 읽기 (첫 줄 = 열 이름)
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const getText = async (url) => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text() }

// 1) 조치 목록: 좌표·카운티가 있는 표 + 현재 상태가 있는 표를 조치 번호로 합침
const geo = parseCsv(await getText(RAW + 'moratoria_531_geoids.csv'))
const inv = new Map(parseCsv(await getText(RAW + 'us_moratorium_inventory_533.csv')).map((r) => [r.moratorium_id, r]))
const rows = geo.map((g) => ({
  id: g.moratorium_id, jurisdiction: g.jurisdiction, type: g.jurisdiction_type, state: g.state_abbrev,
  county: g.county_name, county_fips: g.county_fips?.padStart(5, '0'), date: g.date_enacted_iso,
  lat: Number(g.latitude), lng: Number(g.longitude), status: statusOf(inv.get(g.moratorium_id)?.current_status),
})).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))

// 2) 미국 부지와 카운티 (FCC: 좌표 → 2020 인구조사 카운티)
const iren = JSON.parse(readFileSync(new URL('../data/companies/iren.json', import.meta.url), 'utf8'))
const sites = []
for (const s of iren.sites.filter((x) => x.country === 'US')) {
  const r = await fetch(`https://geo.fcc.gov/api/census/area?lat=${s.coord.lat}&lon=${s.coord.lng}&censusYear=2020&format=json`, { headers: UA })
  const a = (await r.json()).results?.[0]
  if (!a) throw new Error(`카운티를 못 찾음: ${s.id}`)
  sites.push(restrictionsFor({ site: s.id, lat: s.coord.lat, lng: s.coord.lng, state: a.state_code, county: a.county_name, county_fips: a.county_fips }, rows, { year: YEAR }))
}

// 3) 쓰기 (스키마 검사 뒤)
const out = RestrictionsFile.parse({
  checked: new Date().toISOString().slice(0, 10),
  source: {
    name: 'US data center moratoria and local opposition (Miklian 2026)',
    url: `https://huggingface.co/datasets/${REPO}/tree/${REV}/replication`,
    license: 'CC-BY-4.0',
    attribution: 'Miklian, Jason. 2026. "US data center moratoria and local opposition: replication materials." CC BY 4.0.',
    coverage: '2017-01 ~ 2026-08',
  },
  sites,
})
writeFileSync(new URL('../data/restrictions.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`✅ restrictions.json — 조치 ${rows.length}건에서 부지 ${sites.length}곳 요약`)
for (const s of sites) console.log(`  ${s.site}: ${s.county} ${s.county_count}건 · ${s.state} ${s.state_count}건(${YEAR}년 ${s.state_count_year}건) · 가장 가까운 곳 ${s.nearest ? `${s.nearest.jurisdiction} ${s.nearest.km}km ${s.nearest.status}` : '없음'}`)
