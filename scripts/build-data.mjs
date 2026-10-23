// =============================================================
// 회사별 원본 → public/data/infra.json 하나로 합치기
// 사용법: npm run data   (npm run dev / build 전에 자동 실행)
// -------------------------------------------------------------
// data/companies.json            회사·프로그램 목록
// data/companies/<회사id>.json    { company_id, as_of, sites }
// 다른 스크립트·테스트에서도 import { buildInfra } 로 같은 결과를 얻을 수 있습니다.
// =============================================================
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { validateResearch } from '../src/data/researchSchema.js'
import { SourceDatesFile, HiringFile, ProspectsFile } from '../src/data/schema.js'
import { validateObservations } from '../src/data/observationsSchema.js'
import { validateStatements } from '../src/data/statementsSchema.js'
import { validateShares } from '../src/data/sharesSchema.js'
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
  // 갱신 기록 (있으면): 최신 항목이 먼저
  const logFile = new URL('changelog.json', DATA)
  const changelog = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')).entries : undefined
  const researchUrl = new URL('research.json', DATA)
  const research = existsSync(researchUrl) ? JSON.parse(readFileSync(researchUrl, 'utf8')) : undefined
  if (research) { const errors = validateResearch(research, sites); if (errors.length) throw new Error(errors.join('\n')) }
  // 출처 문서의 실제 공개일 (타임라인이 "그때 공개된 자료"만 보여 주는 데 씀)
  const datesUrl = new URL('source-dates.json', DATA)
  const sourceDates = existsSync(datesUrl) ? SourceDatesFile.parse(JSON.parse(readFileSync(datesUrl, 'utf8'))).sources : undefined
  // 채용 공고 스냅샷 (선행지표) — 없는 사이트 id 를 적으면 빌드 실패
  const hiringUrl = new URL('hiring.json', DATA)
  const hiring = existsSync(hiringUrl) ? HiringFile.parse(JSON.parse(readFileSync(hiringUrl, 'utf8'))) : undefined
  for (const h of hiring?.sites ?? []) if (!sites.some((s) => s.id === h.site)) throw new Error(`hiring.json: 없는 사이트 ${h.site}`)
  // 미확인 진출 정황 (지도 '?' 표시) — 부지와 id 가 겹치면 같은 곳을 두 번 그리게 되므로 빌드 실패
  const prospectsUrl = new URL('prospects.json', DATA)
  const prospects = existsSync(prospectsUrl) ? ProspectsFile.parse(JSON.parse(readFileSync(prospectsUrl, 'utf8'))).prospects : undefined
  for (const p of prospects ?? []) if (sites.some((s) => s.id === p.id)) throw new Error(`prospects.json: 부지와 같은 id ${p.id}`)
  return { ...(research ? { research } : {}), ...(sourceDates ? { sourceDates } : {}), ...(hiring ? { hiring } : {}), ...(prospects ? { prospects } : {}), schema_version: 2, as_of: asOf, companies, programs, sites, ...(changelog ? { changelog } : {}) }
}

// 현장 관찰·설비 이중화 (data/observations.json) — infra.json 과 따로 둠:
//   캠퍼스 패널의 "현장 관찰·이중화" 칸이 열릴 때만 불러와서 첫 화면 데이터·번들이 커지지 않게
export function buildObservations(sites) {
  const url = new URL('observations.json', DATA)
  if (!existsSync(url)) return null
  const file = JSON.parse(readFileSync(url, 'utf8'))
  const errors = validateObservations(file, sites)
  if (errors.length) throw new Error(errors.join('\n'))
  return file
}

// 경영진 발언·약속 장부 (data/statements.json) — infra.json 과 따로 둠:
//   지도 본사 카드가 화면에 들어오거나 "경영진 발언" 칸이 열릴 때만 불러옴 (src/data/loadStatements.js)
//   파일이 없으면 null (아직 자료를 넣기 전)
export function buildStatements() {
  const url = new URL('statements.json', DATA)
  if (!existsSync(url)) return null
  const file = JSON.parse(readFileSync(url, 'utf8'))
  const errors = validateStatements(file)
  if (errors.length) throw new Error(errors.join('\n'))
  return file
}

// 직접 실행했을 때만 파일로 저장
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const infra = buildInfra()
  mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../public/data/infra.json', import.meta.url), JSON.stringify(infra))
  console.log(`✅ infra.json — 회사 ${infra.companies.length}곳, 사이트 ${infra.sites.length}곳, 기준일 ${infra.as_of}`)
  // 발행 주식 수·희석 (data/shares.json → 주가 페이지가 불러옴)
  const sharesUrl = new URL('shares.json', DATA)
  if (existsSync(sharesUrl)) {
    const shares = JSON.parse(readFileSync(sharesUrl, 'utf8'))
    const errors = validateShares(shares)
    if (errors.length) throw new Error(errors.join('\n'))
    writeFileSync(new URL('../public/data/shares.json', import.meta.url), JSON.stringify(shares) + '\n')
    console.log(`✅ shares.json — 공시 ${shares.points.length}건, 조달 ${shares.raises.length}건, 전환사채 ${shares.converts.length}건`)
  }
  const observations = buildObservations(infra.sites)
  if (observations) {
    writeFileSync(new URL('../public/data/observations.json', import.meta.url), JSON.stringify(observations))
    console.log(`✅ observations.json — 설비 ${observations.facilities.length}건, 현장 관찰 ${observations.progress.length}건`)
  }
  const statements = buildStatements()
  if (statements) {
    writeFileSync(new URL('../public/data/statements.json', import.meta.url), JSON.stringify(statements))
    console.log(`✅ statements.json — 사람 ${statements.people.length}명, 발언 ${statements.statements.length}건, 약속 ${statements.promises.length}건`)
  }
}
