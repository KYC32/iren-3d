// =============================================================
// 데이터 검증 (npm run validate — 빌드 전에 자동 실행)
// 실제 검사 내용은 scripts/lib/validate-core.mjs 에 있습니다.
// 오류가 하나라도 있으면 빌드를 멈추고, 경고는 표시만 합니다.
// =============================================================
import { readFileSync, readdirSync } from 'node:fs'
import { validateAll } from './lib/validate-core.mjs'

const DATA = new URL('../data/', import.meta.url)
const companiesFile = JSON.parse(readFileSync(new URL('companies.json', DATA), 'utf8'))
const files = Object.fromEntries(
  readdirSync(new URL('companies/', DATA))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(new URL(`companies/${f}`, DATA), 'utf8'))]),
)

const { errors, warns, infra } = validateAll({ companiesFile, files })
warns.forEach((w) => console.warn('⚠️  ' + w))
if (errors.length) {
  console.error('❌ 데이터 오류:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
const total = infra.sites.reduce((n, s) => n + s.power.at(-1).secured_mw, 0)
console.log(`✅ 데이터 OK — 회사 ${infra.companies.length}곳, 사이트 ${infra.sites.length}곳, 최종 확보 전력 합계 ${total.toLocaleString()}MW, 기준일 ${infra.as_of}`)
