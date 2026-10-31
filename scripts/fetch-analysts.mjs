// =============================================================
// fetch-analysts.mjs — 증권사 합의 의견 자동 갱신 (매일 갱신 워크플로가 실행)
// -------------------------------------------------------------
// Nasdaq 공개 API(주가와 같은 곳)의 평균 목표가·의견 수만 data/analysts.json 의 consensus 칸에 쓰고,
// public/data/analysts.json 도 같이 씀. 증권사별 표(firms)는 사람이 옮기므로 건드리지 않음.
// 어떤 실패든(차단·형식 변경) 기존 파일을 그대로 두고 0 으로 끝남 → 사이트는 마지막 데이터로 계속 동작
// 사용법: node scripts/fetch-analysts.mjs
// =============================================================
import { fileURLToPath } from 'node:url'
import { fetchWithUa, readJsonOr, writeJsonIfChanged, BROWSER_UA } from './lib/fetch-util.mjs'
import { parseNasdaqConsensus } from '../src/data/analysts.js'
import { validateAnalysts } from '../src/data/analystsSchema.js'

// writeJsonIfChanged 가 dirname 을 쓰므로 URL 이 아니라 문자열 경로로 넘김
const SRC = fileURLToPath(new URL('../data/analysts.json', import.meta.url))
const OUT = fileURLToPath(new URL('../public/data/analysts.json', import.meta.url))
const API = 'https://api.nasdaq.com/api/analyst/IREN'
const headers = { 'User-Agent': BROWSER_UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' }

try {
  const file = readJsonOr(SRC, null)
  if (!file) throw new Error('data/analysts.json 없음')
  const target = await fetchWithUa(`${API}/targetprice`, { as: 'json', headers })
  const ratings = await fetchWithUa(`${API}/ratings`, { as: 'json', headers })
  const parsed = parseNasdaqConsensus(target, ratings)
  // 숫자가 그대로면 파일을 건드리지 않음 (날짜만 바뀌어 커밋이 생기지 않게)
  const same = Object.entries(parsed).every(([k, v]) => file.consensus[k] === v)
  const next = same ? file : { ...file, consensus: { ...file.consensus, ...parsed, fetched_at: new Date().toISOString() } }
  const errors = validateAnalysts(next)
  if (errors.length) throw new Error(errors.join(' / '))
  writeJsonIfChanged(SRC, next, { pretty: true })
  writeJsonIfChanged(OUT, next)
  console.log(`✅ analysts.json — ${same ? '변경 없음' : '갱신'} (평균 목표가 $${next.consensus.mean}, 매수 ${next.consensus.buy} · 보유 ${next.consensus.hold} · 매도 ${next.consensus.sell})`)
} catch (e) {
  console.warn(`⚠️ analysts.json 갱신 실패 — 기존 파일 유지: ${e.message}`)
}
