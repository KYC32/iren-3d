// sites.json 검증 스크립트
// 사용법: npm run validate   (npm run build 전에 자동 실행됩니다)
// - 스키마 위반, 중복 id, 건물 it_mw 합이 계통 전력보다 큰 경우를 잡아냅니다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SitesFile } from '../src/data/sitesSchema.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = join(here, '..', 'public', 'data', 'sites.json')
const raw = JSON.parse(readFileSync(file, 'utf8'))

const parsed = SitesFile.safeParse(raw)
if (!parsed.success) {
  console.error('❌ sites.json 스키마 오류:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const { sites } = parsed.data
const errors = []

// 1) 사이트 id 중복 검사
const ids = new Set()
for (const s of sites) {
  if (ids.has(s.id)) errors.push(`사이트 id 중복: ${s.id}`)
  ids.add(s.id)
}

// 2) 건물 합계가 계통 전력을 넘지 않는지 (gross 기준)
//    replaces 가 있는 건물은 기존 건물 전력을 재사용하므로 합계에서 뺍니다.
for (const s of sites) {
  const gross = s.buildings.filter((b) => !b.replaces).reduce((n, b) => n + b.gross_mw, 0)
  if (gross > s.grid_mw * 1.05) {
    errors.push(`${s.id}: 건물 gross 합계 ${gross}MW 가 계통 전력 ${s.grid_mw}MW 를 초과`)
  }
  const bids = new Set()
  for (const b of s.buildings) {
    if (bids.has(b.id)) errors.push(`${s.id}: 건물 id 중복 ${b.id}`)
    bids.add(b.id)
    if (b.replaces && !s.buildings.some((x) => x.id === b.replaces)) {
      errors.push(`${s.id}/${b.id}: replaces 대상 ${b.replaces} 가 없음`)
    }
    if (b.status === 'under_construction' && b.progress == null) {
      errors.push(`${s.id}/${b.id}: 건설중 건물은 progress(0~1) 가 필요`)
    }
  }
}

if (errors.length) {
  console.error('❌ sites.json 내용 오류:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}

const totalGrid = sites.reduce((n, s) => n + s.grid_mw, 0)
console.log(`✅ sites.json OK — 사이트 ${sites.length}곳, 계통 전력 합계 ${totalGrid.toLocaleString()}MW, 기준일 ${parsed.data.as_of}`)
