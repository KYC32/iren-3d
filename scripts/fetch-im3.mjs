// =============================================================
// fetch-im3.mjs — 지도 '주변 데이터센터' 층 자료: 미국 기존 데이터센터 위치 → public/data/im3-datacenters.json
// -------------------------------------------------------------
// 자료: IM3 Open Source Data Center Atlas v2026.02.09 (Hugging Face 사본, 판 번호 고정)
//   라이선스 ODbL 1.0 — OpenStreetMap 에서 나온 자료라 출처 표기 필수, 이 자료로 만든 파일도 ODbL
//   → 이 스크립트가 만드는 im3-datacenters.json 은 ODbL 로 공개됨 (파일 안 license 칸, README 에 적음)
// 같은 시설이 건물·캠퍼스로 여러 줄일 수 있어 IM3 번호(id)로 하나만 남김 (캠퍼스 > 건물 > 점 순으로)
//
// 사용법: node scripts/fetch-im3.mjs   (인터넷 필요 · CSV 는 저장하지 않고 메모리에서만 읽음)
// =============================================================
import { writeFileSync } from 'node:fs'

const REPO = 'sarkarghya/im3_open_source_data_center_atlas_v2026.02.09'
const REV = '57f17b62dccf540a82280822e6aa55df5469c991'
const CSV = `https://huggingface.co/datasets/${REPO}/resolve/${REV}/im3_open_source_data_center_atlas_v2026.02.09.csv`
const UA = { 'User-Agent': 'iren-3d research bot (github.com/KYC32/iren-3d)' }

// 따옴표·쉼표를 지키는 작은 CSV 읽기 (fetch-restrictions.mjs 와 같은 방식)
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

const res = await fetch(CSV, { headers: UA })
if (!res.ok) throw new Error(`${res.status} ${CSV}`)
const rows = parseCsv(await res.text())
const RANK = { campus: 0, building: 1, point: 2 }
const best = new Map()
for (const r of rows) {
  const lng = Number(r.lon), lat = Number(r.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
  const prev = best.get(r.id)
  if (!prev || (RANK[r.type] ?? 9) < (RANK[prev.type] ?? 9)) best.set(r.id, { ...r, lng, lat })
}
// 작게: [경도, 위도, 이름, 운영사, 종류] 배열 (이름·운영사는 없으면 빈 글자)
const points = [...best.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((r) => [Math.round(r.lng * 1e5) / 1e5, Math.round(r.lat * 1e5) / 1e5, r.name || '', r.operator || '', r.type || ''])
const out = {
  schema_version: 1,
  source: {
    name: 'IM3 Open Source Data Center Atlas v2026.02.09',
    url: `https://huggingface.co/datasets/${REPO}/tree/${REV}`,
    license: 'ODbL-1.0',
    attribution: 'IM3 Open Source Data Center Atlas · © OpenStreetMap contributors · ODbL',
  },
  note: 'This file is a derived database of the IM3 Atlas and is made available under the Open Database License (ODbL) 1.0.',
  points,
}
writeFileSync(new URL('../public/data/im3-datacenters.json', import.meta.url), JSON.stringify(out) + '\n')
console.log(`✅ im3-datacenters.json — ${rows.length}줄에서 시설 ${points.length}곳`)
