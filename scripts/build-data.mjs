// =============================================================
// 회사별 원본 → public/data/infra.json 하나로 합치기
// 사용법: npm run data   (npm run dev / build 전에 자동 실행)
// -------------------------------------------------------------
// data/companies.json            회사·프로그램 목록
// data/companies/<회사id>.json    { company_id, as_of, sites }
// 다른 스크립트·테스트에서도 import { buildInfra } 로 같은 결과를 얻을 수 있습니다.
// =============================================================
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// DATA_DIR=data-fake 처럼 지정하면 다른 폴더의 데이터로 빌드 (성능 시험용 가짜 데이터 등)
const DATA = new URL(`../${process.env.DATA_DIR ?? 'data'}/`, import.meta.url)

export function buildInfra() {
  const { companies, programs = [] } = JSON.parse(readFileSync(new URL('companies.json', DATA), 'utf8'))
  const files = readdirSync(new URL('companies/', DATA)).filter((f) => f.endsWith('.json')).sort()
  const sites = []
  let asOf = '0000-00-00'
  for (const f of files) {
    const file = JSON.parse(readFileSync(new URL(`companies/${f}`, DATA), 'utf8'))
    if (file.as_of > asOf) asOf = file.as_of
    // 사이트마다 그 회사 파일의 기준일을 붙여 둠 (회사마다 조사 시점이 다를 수 있음)
    for (const s of file.sites) sites.push({ ...s, as_of: file.as_of })
  }
  return { schema_version: 2, as_of: asOf, companies, programs, sites }
}

// 직접 실행했을 때만 파일로 저장
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const infra = buildInfra()
  mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../public/data/infra.json', import.meta.url), JSON.stringify(infra))
  console.log(`✅ infra.json — 회사 ${infra.companies.length}곳, 사이트 ${infra.sites.length}곳, 기준일 ${infra.as_of}`)
}
