// =============================================================
// fetch-market.mjs — 주가 페이지의 시장 자료를 Nasdaq 공개 API 에서 받음 (매일 갱신 워크플로가 실행)
// -------------------------------------------------------------
//   public/data/peers.json : 다른 회사·지수 ETF 종가 1년 치 (같은 기간 수익률 비교)
//   public/data/short.json : IREN 공매도 잔고 (FINRA 보고분, 월 2회)
// 둘은 따로 시도: 하나가 막혀도 다른 쪽은 저장되고, 실패한 쪽은 기존 파일 유지. 어떤 경우에도 종료 코드 0
// 사용법: node scripts/fetch-market.mjs
// =============================================================
import { fileURLToPath } from 'node:url'
import { fetchWithUa, readJsonOr, writeJsonIfChanged, sleep, BROWSER_UA } from './lib/fetch-util.mjs'
import { parsePeerRows, parseShortRows, mergeShort } from '../src/data/market.js'
import { PeersFile, ShortFile } from '../src/data/marketSchema.js'

const PEERS_OUT = fileURLToPath(new URL('../public/data/peers.json', import.meta.url))
const SHORT_OUT = fileURLToPath(new URL('../public/data/short.json', import.meta.url))
const headers = { 'User-Agent': BROWSER_UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' }
// 사업이 비슷한 회사들 + 시장 전체 비교용 QQQ (assetclass 가 ETF 만 다름)
const SYMBOLS = [
  { symbol: 'CRWV', name: 'CoreWeave', assetclass: 'stocks' },
  { symbol: 'NBIS', name: 'Nebius', assetclass: 'stocks' },
  { symbol: 'APLD', name: 'Applied Digital', assetclass: 'stocks' },
  { symbol: 'CIFR', name: 'Cipher', assetclass: 'stocks' },
  { symbol: 'WULF', name: 'TeraWulf', assetclass: 'stocks' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', assetclass: 'etf' },
]
const iso = (d) => d.toISOString().slice(0, 10)

async function fetchPeers() {
  const prev = readJsonOr(PEERS_OUT, null)
  const today = new Date(), from = iso(new Date(today.getTime() - 400 * 86400000))
  const symbols = []
  for (const s of SYMBOLS) {
    try {
      const url = `https://api.nasdaq.com/api/quote/${s.symbol}/historical?assetclass=${s.assetclass}&fromdate=${from}&todate=${iso(today)}&limit=9999`
      const json = await fetchWithUa(url, { as: 'json', timeoutMs: 25000, headers })
      const rows = parsePeerRows(json?.data?.tradesTable?.rows)
      if (!rows.length) throw new Error('빈 응답')
      symbols.push({ symbol: s.symbol, name: s.name, rows })
    } catch (e) {
      // 한 회사만 실패하면 그 회사의 지난 값을 그대로 씀
      const old = prev?.symbols?.find((x) => x.symbol === s.symbol)
      console.warn(`⚠️ ${s.symbol} 실패 (${e.message}) — ${old ? '지난 값 유지' : '이번엔 뺌'}`)
      if (old) symbols.push(old)
    }
    await sleep(300)
  }
  if (!symbols.length) throw new Error('받은 회사가 없음')
  const file = PeersFile.parse({ fetched_at: new Date().toISOString(), source: { name: 'Nasdaq', url: 'https://www.nasdaq.com/market-activity/stocks' }, symbols })
  const changed = writeJsonIfChanged(PEERS_OUT, file, { ignoreKeys: ['fetched_at'] })
  console.log(`${changed ? '✅ 저장' : '＝ 변경 없음'} peers.json — ${symbols.map((s) => s.symbol).join(' ')}`)
}

async function fetchShort() {
  const prev = readJsonOr(SHORT_OUT, null)
  const json = await fetchWithUa('https://api.nasdaq.com/api/quote/IREN/short-interest?assetClass=stocks', { as: 'json', timeoutMs: 25000, headers })
  const rows = parseShortRows(json)
  if (!rows.length) throw new Error('빈 응답 (형식 변경?)')
  const file = ShortFile.parse({ fetched_at: new Date().toISOString(), source: { name: 'Nasdaq · FINRA', url: 'https://www.nasdaq.com/market-activity/stocks/iren/short-interest' }, rows: mergeShort(prev?.rows, rows) })
  const changed = writeJsonIfChanged(SHORT_OUT, file, { ignoreKeys: ['fetched_at'] })
  console.log(`${changed ? '✅ 저장' : '＝ 변경 없음'} short.json — 마지막 보고 ${file.rows.at(-1).date}`)
}

for (const [name, fn] of [['peers', fetchPeers], ['short', fetchShort]]) {
  try { await fn() } catch (e) { console.warn(`⚠️ ${name} 갱신 실패 — 기존 파일 유지: ${e.message}`) }
}
