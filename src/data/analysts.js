// =============================================================
// analysts.js — 증권사 투자의견 계산 (순수 함수, 시험: analysts.test.js)
// -------------------------------------------------------------
// 증권사마다 표현이 다름(Outperform·Overweight·Neutral…) → 매수·보유·매도 셋으로 묶어 셈
// 화면: src/pages/AnalystSection.jsx · 갱신: scripts/fetch-analysts.mjs
// =============================================================

const BUCKETS = {
  buy: ['buy', 'strong-buy', 'outperform', 'market outperform', 'overweight'],
  hold: ['hold', 'neutral', 'market perform', 'equal weight'],
  sell: ['sell', 'strong sell', 'underperform', 'underweight'],
}
// 1년 넘은 의견은 표에서 흐리게 (오래됐다는 뜻만, 빼지는 않음)
const STALE_DAYS = 365

// 증권사 표현 → 'buy' | 'hold' | 'sell' (모르는 표현은 null — 매수로 짐작하지 않음)
export function ratingBucket(rating) {
  if (rating == null) return null
  const r = rating.trim().toLowerCase()
  return Object.keys(BUCKETS).find((k) => BUCKETS[k].includes(r)) ?? null
}

// Nasdaq 응답 → consensus 칸 (형식이 바뀌면 오류 → 갱신 스크립트가 기존 파일을 지킴)
export function parseNasdaqConsensus(target, ratings) {
  const o = target?.data?.consensusOverview
  if (!o || !(o.priceTarget > 0) || !(o.lowPriceTarget > 0) || !(o.highPriceTarget > 0)) throw new Error('Nasdaq 목표가 형식이 다름')
  return {
    mean_rating: ratings?.data?.meanRatingType ?? null,
    low: o.lowPriceTarget, high: o.highPriceTarget, mean: o.priceTarget,
    buy: o.buy, hold: o.hold, sell: o.sell,
  }
}

// 목표가가 현재가보다 몇 % 위인지 (현재가를 모르면 null)
export function upsidePct(target, price) {
  return target && price ? (target / price - 1) * 100 : null
}

// 표에 보일 줄: 최근 날짜부터, 묶음(bucket)·현재가 대비(upside)·오래됨(stale) 붙임
export function firmRows(file, price) {
  const now = Date.parse(file.checked)
  return [...file.firms]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((f) => ({
      ...f,
      bucket: ratingBucket(f.rating),
      upside: upsidePct(f.target, price),
      stale: (now - Date.parse(f.date)) / 864e5 > STALE_DAYS,
    }))
}

// 표의 의견 수 (의견을 못 찾은 곳은 none)
export function firmCounts(rows) {
  const n = { buy: 0, hold: 0, sell: 0, none: 0 }
  for (const r of rows) n[r.bucket ?? 'none']++
  return n
}

// 목표가 막대의 양 끝: 현재가가 범위 밖이면 현재가까지 넓힘
export function rangeOf(low, high, price) {
  return { lo: Math.min(low, price ?? low), hi: Math.max(high, price ?? high) }
}
// 막대 위 자리 0..100 (넘치면 끝에 묶음)
export function rangePos(v, lo, hi) {
  if (hi <= lo) return 50
  return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
}

// 회사 IR 명단에 있는데 표에 없는 증권사 (공개 의견을 못 찾은 곳)
export function missingCoverage(file) {
  const have = new Set(file.firms.map((f) => f.ir_name).filter(Boolean))
  return file.coverage.firms.filter((f) => !have.has(f))
}

// 다음 실적 예상 — 날짜가 지나면 숨김 (옛 예상치가 화면에 남지 않게)
export function nextEarnings(file, today) {
  return file.earnings && file.earnings.date >= today ? file.earnings : null
}
