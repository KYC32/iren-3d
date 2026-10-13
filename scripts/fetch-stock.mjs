// =============================================================
// fetch-stock.mjs — IREN 일봉 주가를 Nasdaq 공개 API 에서 받아 public/data/stock.json 에 저장
// 사용법: node scripts/fetch-stock.mjs            (마지막 저장일 7일 전부터 증분)
//         node scripts/fetch-stock.mjs --full     (상장일부터 전부 다시)
// -------------------------------------------------------------
// 실패해도 기존 파일을 그대로 두고 종료 코드 0 으로 끝납니다 (자동 갱신이 막혀도 사이트는 멀쩡해야 함).
// 매일 GitHub Action 이 실행하고, 파일이 바뀌면 커밋 → Vercel 자동 배포.
// =============================================================
import { fileURLToPath } from 'node:url'
import { fetchWithUa, readJsonOr, writeJsonIfChanged, BROWSER_UA } from './lib/fetch-util.mjs'
import { parseNasdaqRows, mergeRows, IPO } from '../src/data/stock.js'
import { StockFile } from '../src/data/feedSchema.js'

const OUT = fileURLToPath(new URL('../public/data/stock.json', import.meta.url))
const SYMBOL = 'IREN'
const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (iso, n) => new Date(Date.parse(iso) - n * 86400000).toISOString().slice(0, 10)

export async function fetchStock({ full = false } = {}) {
  const existing = readJsonOr(OUT, null)
  // 증분: 마지막 저장일 일주일 전부터 (늦게 정정되는 값 반영). 파일이 없거나 --full 이면 상장 직전부터
  const from = !full && existing?.last_date ? daysAgo(existing.last_date, 7) : '2021-11-01'
  const url = `https://api.nasdaq.com/api/quote/${SYMBOL}/historical?assetclass=stocks&fromdate=${from}&todate=${today()}&limit=9999`
  const json = await fetchWithUa(url, {
    as: 'json', timeoutMs: 25000,
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' },
  })
  const rows = parseNasdaqRows(json?.data?.tradesTable?.rows)
  if (!rows.length) throw new Error('받은 행이 없음 (응답 형식이 바뀌었거나 빈 응답)')
  const merged = mergeRows(full ? [] : existing?.rows, rows)
  const file = StockFile.parse({
    schema_version: 1, symbol: SYMBOL,
    source: { name: 'Nasdaq', url: `https://www.nasdaq.com/market-activity/stocks/${SYMBOL.toLowerCase()}/historical`, note_ko: '일봉 · 공개 데이터' },
    ipo: IPO, fetched_at: new Date().toISOString(), last_date: merged.at(-1)[0],
    columns: ['date', 'open', 'high', 'low', 'close', 'volume'], rows: merged,
  })
  const changed = writeJsonIfChanged(OUT, file, { ignoreKeys: ['fetched_at'] })
  console.log(`${changed ? '✅ 저장' : '＝ 변경 없음'} stock.json — ${merged.length}일치 (${merged[0][0]} ~ ${file.last_date}), 이번에 받은 ${rows.length}행`)
  return file
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchStock({ full: process.argv.includes('--full') }).catch((e) => {
    console.warn(`⚠️ 주가 갱신 실패 — 기존 파일 유지: ${e.message}`)
    process.exit(0)
  })
}
