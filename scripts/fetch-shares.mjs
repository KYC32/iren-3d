// =============================================================
// fetch-shares.mjs — 발행 주식 수 자동 갱신 (매일 갱신 워크플로가 실행)
// -------------------------------------------------------------
// SEC XBRL(companyfacts)의 표지 주식 수(dei:EntityCommonStockSharesOutstanding) 중
// data/shares.json 에 아직 없는 날짜만 덧붙이고, public/data/shares.json 도 같이 씀.
// ATM·전환사채는 공시 본문에서 사람이 옮기므로 건드리지 않음.
// 어떤 실패든(차단·형식 변경) 기존 파일을 그대로 두고 0 으로 끝남 → 사이트는 마지막 데이터로 계속 동작
// 사용법: node scripts/fetch-shares.mjs
// =============================================================
import { fetchWithUa, readJsonOr, writeJsonIfChanged } from './lib/fetch-util.mjs'
import { mergeXbrlPoints } from '../src/data/shares.js'
import { validateShares } from '../src/data/sharesSchema.js'

const SRC = new URL('../data/shares.json', import.meta.url)
const OUT = new URL('../public/data/shares.json', import.meta.url)
const FACTS = 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001878848.json'

try {
  const file = readJsonOr(SRC, null)
  if (!file) throw new Error('data/shares.json 없음')
  const facts = await fetchWithUa(FACTS, { as: 'json' })
  const { file: next, added } = mergeXbrlPoints(file, facts)
  const errors = validateShares(next)
  if (errors.length) throw new Error(errors.join(' / '))
  writeJsonIfChanged(SRC, next, { pretty: true })
  writeJsonIfChanged(OUT, next)
  console.log(added ? `✅ shares.json — 새 공시 ${added}건 추가 (마지막 ${next.points.at(-1).date})` : '✅ shares.json — 새 공시 없음')
} catch (e) {
  console.warn(`⚠️ shares.json 갱신 실패 — 기존 파일 유지: ${e.message}`)
}
