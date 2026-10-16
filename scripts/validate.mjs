// =============================================================
// 데이터 검증 (npm run validate — 빌드 전에 자동 실행)
// 실제 검사 내용은 scripts/lib/validate-core.mjs 에 있습니다.
// 오류가 하나라도 있으면 빌드를 멈추고, 경고는 표시만 합니다.
// =============================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { validateResearch } from '../src/data/researchSchema.js'
import { validateAll } from './lib/validate-core.mjs'
import { StockFile, NewsFile } from '../src/data/feedSchema.js'
import { validateObservations } from '../src/data/observationsSchema.js'
import { validateShares } from '../src/data/sharesSchema.js'

const DATA = new URL('../data/', import.meta.url)
const companiesFile = JSON.parse(readFileSync(new URL('companies.json', DATA), 'utf8'))
const files = Object.fromEntries(
  readdirSync(new URL('companies/', DATA))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(new URL(`companies/${f}`, DATA), 'utf8'))]),
)

const logUrl = new URL('changelog.json', DATA)
const changelogFile = existsSync(logUrl) ? JSON.parse(readFileSync(logUrl, 'utf8')) : null
const { errors, warns, infra } = validateAll({ companiesFile, files, changelogFile })
// 자동 갱신 파일(주가·뉴스)은 스키마가 깨져도 빌드를 막지 않고 경고만 (GitHub Action 이 만든 파일이 사이트를 멈추지 않게)
for (const [name, schema] of [['stock.json', StockFile], ['news.json', NewsFile]]) {
  const url = new URL(`../public/data/${name}`, import.meta.url)
  if (!existsSync(url)) { warns.push(`${name} 없음 — node scripts/fetch-${name.split('.')[0]}.mjs 로 생성`); continue }
  const r = schema.safeParse(JSON.parse(readFileSync(url, 'utf8')))
  if (!r.success) warns.push(`${name} 스키마 오류: ${r.error.issues[0]?.path.join('.')} — ${r.error.issues[0]?.message}`)
}
const researchUrl = new URL('research.json', DATA)
if (infra && existsSync(researchUrl)) errors.push(...validateResearch(JSON.parse(readFileSync(researchUrl,'utf8')),infra.sites))
// 현장 관찰·설비 이중화 (data/observations.json): 스키마·사이트·건물·날짜 규칙
const obsUrl = new URL('observations.json', DATA)
if (infra && existsSync(obsUrl)) errors.push(...validateObservations(JSON.parse(readFileSync(obsUrl, 'utf8')), infra.sites))
// 발행 주식 수·희석 (data/shares.json)
const sharesUrl = new URL('shares.json', DATA)
if (existsSync(sharesUrl)) errors.push(...validateShares(JSON.parse(readFileSync(sharesUrl, 'utf8'))))
// 공개일을 모르는 보고(reported) 기록 → 타임라인은 "사건 날짜에 공개됨"으로 대신 처리 (경고만)
// 해결: 그 사실을 처음 공개한 자료를 찾아 published / published_source 를 적거나, data/source-dates.json 에 문서 공개일 추가
if (infra) {
  const datesUrl = new URL('source-dates.json', DATA)
  const dated = new Set(existsSync(datesUrl) ? JSON.parse(readFileSync(datesUrl, 'utf8')).sources.map((s) => s.url) : [])
  if (existsSync(researchUrl)) for (const s of JSON.parse(readFileSync(researchUrl, 'utf8')).sources) if (s.published) dated.add(s.url)
  for (const site of infra.sites) {
    const records = [...site.buildings.flatMap((b) => b.phases.map((p) => [`${site.id}/${b.id} ${p.status}@${p.from}`, p])),
      ...site.power.map((p) => [`${site.id} 전력@${p.from}`, p])]
    for (const [label, p] of records) if (p.basis === 'reported' && !p.published && !dated.has(p.source)) warns.push(`공개일 미상(사건 날짜로 대체): ${label}`)
  }
}
warns.forEach((w) => console.warn('⚠️  ' + w))
if (errors.length) {
  console.error('❌ 데이터 오류:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
const total = infra.sites.reduce((n, s) => n + s.power.at(-1).secured_mw, 0)
console.log(`✅ 데이터 OK — 회사 ${infra.companies.length}곳, 사이트 ${infra.sites.length}곳, 최종 확보 전력 합계 ${total.toLocaleString()}MW, 기준일 ${infra.as_of}`)
