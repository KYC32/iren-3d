// =============================================================
// market.js — 주가 페이지의 시장 칸 계산 (순수 함수, 시험: market.test.js)
// -------------------------------------------------------------
//   recentPeak·moveRows      : 최근 고점과 큰 변동일 (까닭은 data/stock-moves.json, 사람이 옮김)
//   returnFrom·peerBars      : 같은 기간 다른 회사 수익률 (public/data/peers.json)
//   parseShortRows·shortView : 공매도 잔고 (public/data/short.json)
//   parseEarnings            : Nasdaq EPS 예상·지난 결과 (data/analysts.json 의 eps 칸)
// 화면: MovesSection·ShortSection·EarningsSection · 갱신: scripts/fetch-market.mjs, fetch-analysts.mjs
// =============================================================
import { parseNasdaqRows } from './stock.js'

// 'MM/DD/YYYY' 또는 'M/D/YYYY' → 'YYYY-MM-DD' (형식이 다르면 null)
function isoDate(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim())
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}
// '94,617,935' → 94617935, 비어 있으면 null
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[$,]/g, ''))
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null
}

// 최근 days 거래일 안에서 종가가 가장 높았던 날 (하락 구간의 출발점)
export function recentPeak(series, days = 90) {
  const recent = series.slice(-days)
  if (!recent.length) return null
  return recent.reduce((a, b) => (b.close > a.close ? b : a))
}

// from 뒤로 하루 등락이 threshold(%) 이상이거나 까닭이 적힌 날, 최신 먼저
//   까닭이 없는 큰 변동일도 남김 (note: null) — 비워 두되 지어내지 않음
export function moveRows(series, notes = [], { from, threshold = 6 } = {}) {
  const byDate = new Map(notes.map((n) => [n.date, n]))
  const rows = []
  for (let i = 1; i < series.length; i++) {
    const p = series[i]
    if (from && p.date < from) continue
    const pct = (p.close / series[i - 1].close - 1) * 100
    const note = byDate.get(p.date) ?? null
    if (note || Math.abs(pct) >= threshold) rows.push({ date: p.date, close: p.close, pct, note })
  }
  return rows.reverse()
}

// [[날짜, 종가], …] 에서 from 이후 첫 거래일 대비 마지막 날 수익률(%). 자료가 없으면 null
export function returnFrom(rows, from) {
  const start = (rows ?? []).find((r) => r[0] >= from)
  const end = rows?.at(-1)
  return start && end && end[0] > start[0] ? (end[1] / start[1] - 1) * 100 : null
}

// 다른 회사들 + IREN 의 같은 기간 수익률, 낮은 순 (IREN 은 주가 페이지의 시리즈에서 계산)
export function peerBars(peers, series, from) {
  const iren = returnFrom(series.map((p) => [p.date, p.close]), from)
  const bars = (peers?.symbols ?? []).map((s) => ({ symbol: s.symbol, name: s.name, pct: returnFrom(s.rows, from), isIren: false }))
  if (iren != null) bars.push({ symbol: 'IREN', name: 'IREN', pct: iren, isIren: true })
  return bars.filter((b) => b.pct != null).sort((a, b) => a.pct - b.pct)
}

// Nasdaq 일봉 행 → [날짜, 종가] (주가 파일과 같은 해석을 씀)
export const parsePeerRows = (rows) => parseNasdaqRows(rows).map((r) => [r[0], r[4]])

// Nasdaq 공매도 표 → 오름차순 [{ date, shares, avg_volume, days_to_cover }]
export function parseShortRows(json) {
  const out = []
  for (const r of json?.data?.shortInterestTable?.rows ?? []) {
    const date = isoDate(r.settlementDate), shares = num(r.interest)
    if (!date || shares == null) continue
    out.push({ date, shares, avg_volume: num(r.avgDailyShareVolume) ?? 0, days_to_cover: Math.round((num(r.daysToCover) ?? 0) * 100) / 100 })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

// 기존 행 + 새 행 (같은 날짜는 새 값으로), 오름차순
export function mergeShort(existing, incoming) {
  const map = new Map()
  for (const r of existing ?? []) map.set(r.date, r)
  for (const r of incoming ?? []) map.set(r.date, r)
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

// 화면용 요약: 최신 잔고, 발행 주식 대비 비율(주식 수를 모르면 null), 직전 보고 대비 변화(%)
export function shortView(rows, sharesOut) {
  const last = rows?.at(-1)
  if (!last) return null
  const prev = rows.at(-2)
  return {
    ...last,
    pctOfShares: sharesOut ? (last.shares / sharesOut) * 100 : null,
    changePct: prev ? (last.shares / prev.shares - 1) * 100 : null,
  }
}

// Nasdaq earnings-forecast·earnings-surprise → { next, history } (형식이 다르면 null)
export function parseEarnings(forecast, surprise) {
  const q = forecast?.data?.quarterlyForecast?.rows?.[0]
  const hist = surprise?.data?.earningsSurpriseTable?.rows
  if (!q || !hist) return null
  return {
    next: { quarter: q.fiscalEnd, eps: num(q.consensusEPSForecast), high: num(q.highEPSForecast), low: num(q.lowEPSForecast), estimates: num(q.noOfEstimates) },
    history: hist.map((r) => ({ quarter: r.fiscalQtrEnd, date: isoDate(r.dateReported), eps: num(r.eps), forecast: num(r.consensusForecast) }))
      .filter((r) => r.date && r.eps != null && r.forecast != null),
  }
}
