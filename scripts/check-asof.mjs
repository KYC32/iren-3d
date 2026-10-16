// =============================================================
// check-asof.mjs — 사이트 숫자의 기준일(as_of) "뒤"에 새 회사 공시가 나왔는지 확인
// -------------------------------------------------------------
// 주가·뉴스는 매일 자동으로 갱신되지만, 캠퍼스·계약·지표 숫자(data/companies/iren.json 의 as_of)는 사람이 고칩니다.
// 그래서 기준일 뒤에 회사 공시가 나오면 "아직 반영 전"이라는 걸 사이트와 저장소에 알려 줍니다.
//
//   1) public/data/asof-check.json 을 씀: { as_of, pending: [{ id, date, form, kind, title, url }] }
//      → 현황 페이지가 "기준일 뒤 회사 공시 n건 — 아직 반영 전" 안내를 띄움
//        (뉴스 파일 전체(압축 약 37KB)를 받지 않아도 되게 결과만 담은 작은 파일)
//   2) --issue 를 붙이면 (GitHub Action 안에서) GitHub 이슈 하나를 열거나 고쳐 쓰고, 다 반영되면 닫음
//      이슈 본문은 파일로 넘기고 gh 는 셸 없이 부름 → 공시 제목 같은 바깥 글자가 명령으로 해석되지 않음
//
// 사용법: node scripts/check-asof.mjs            (파일만 씀)
//         node scripts/check-asof.mjs --issue    (+ GitHub 이슈, 환경 변수 GH_TOKEN 필요)
//         node scripts/check-asof.mjs --dry      (아무것도 쓰지 않고 결과만 출력)
//         --as-of=YYYY-MM-DD 로 기준일을 바꿔 시험해 볼 수 있음
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filingsAfter } from '../src/data/news.js'
import { writeJsonIfChanged } from './lib/fetch-util.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`))
const DRY = !!arg('dry'), ISSUE = !!arg('issue')
const LABEL = '기준일 갱신'   // 이 스크립트가 여는 이슈에 붙이는 표 (같은 이슈를 다시 찾는 데 씀)

// 기준일: 사이트가 실제로 쓰는 public/data/infra.json 의 as_of (npm run data 가 iren.json 에서 만듦)
const infra = JSON.parse(readFileSync(join(ROOT, 'public/data/infra.json'), 'utf8'))
const asOf = arg('as-of')?.split('=')[1] ?? infra.as_of
const news = JSON.parse(readFileSync(join(ROOT, 'public/data/news.json'), 'utf8'))

// 기준일 뒤 회사 공시 (최신순) — 화면에 필요한 것만 남김
const pending = filingsAfter(news.company?.items, asOf).map(({ id, date, form, kind, title, url }) => ({ id, date, form, kind, title, url }))
console.log(`기준일 ${asOf} 뒤 회사 공시: ${pending.length}건`)
for (const p of pending) console.log(`  ${p.date} ${p.form} ${p.title}`)
if (DRY) process.exit(0)

// 1) 작은 결과 파일 (내용이 같으면 쓰지 않음 → 매일 쓸데없는 커밋이 생기지 않음)
const out = join(ROOT, 'public/data/asof-check.json')
console.log(writeJsonIfChanged(out, { as_of: asOf, pending }) ? `wrote ${out}` : '결과 파일 변경 없음')

// 2) GitHub 이슈 (Action 안에서만) — 이슈에서 오류가 나도 0 으로 끝냄 (주가·뉴스 갱신 커밋까지 막지 않게)
if (ISSUE) {
  if (!process.env.GH_TOKEN) { console.log('GH_TOKEN 없음 → 이슈 건너뜀'); process.exit(0) }
  try { syncIssue() } catch (e) { console.log(`이슈 처리 실패 (갱신은 계속): ${e.message}`) }
}
function syncIssue() {
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()   // 셸을 거치지 않음
  const open = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number', '--limit', '1'))[0]
  if (pending.length) {
    const title = `기준일(${asOf}) 뒤 새 회사 공시 ${pending.length}건 — 사이트 숫자 갱신 필요`
    const lines = pending.map((p) => `- ${p.date} · ${p.form} · [${p.title.replace(/[[\]]/g, '')}](${p.url})`)
    const body = [
      `사이트 숫자의 기준일(\`data/companies/iren.json\` 의 \`as_of\`)은 **${asOf}** 인데, 그 뒤에 회사 공시가 ${pending.length}건 나왔습니다.`,
      '', ...lines, '',
      '반영 순서: 공시 원문 확인 → `data/companies/iren.json`(as_of·건물 단계·전력) / `data/companies.json`(계약·지표) 수정 → `data/changelog.json` → `npm run data && npm run validate && npm test`.',
      '', '기준일을 이 공시들 뒤로 옮기면 다음 자동 갱신 때 이 이슈가 저절로 닫힙니다. (scripts/check-asof.mjs 가 자동으로 쓴 이슈)',
    ].join('\n')
    const file = join(tmpdir(), 'asof-issue.md')
    writeFileSync(file, body)
    if (open) { gh('issue', 'edit', String(open.number), '--title', title, '--body-file', file); console.log(`이슈 #${open.number} 고침`) }
    else {
      // 처음 여는 이슈면 표부터 만듦 (이미 있으면 오류 → 무시)
      try { gh('label', 'create', LABEL, '--color', 'FBCA04', '--description', '기준일 뒤 새 회사 공시 — 사이트 숫자 갱신 필요') } catch { /* 이미 있음 */ }
      console.log(`이슈 만듦: ${gh('issue', 'create', '--title', title, '--body-file', file, '--label', LABEL)}`)
    }
  } else if (open) {
    gh('issue', 'close', String(open.number), '--comment', `기준일이 ${asOf} 로 갱신되어 그 뒤 미반영 공시가 없음 — 자동으로 닫음`)
    console.log(`이슈 #${open.number} 닫음`)
  }
}
