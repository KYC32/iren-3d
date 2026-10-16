// =============================================================
// shares.js — 발행 주식 수·희석 계산 (주가 페이지의 "주식 수 · 희석" 칸과 매일 갱신 스크립트가 씀)
// =============================================================

const DAY = 86400000
const t = (d) => Date.parse(`${d}T00:00:00Z`)

// 주식 수 글자: 한국어는 억·만 (3.94억 / 5,490만), 영어는 M·B (394.1M / 1.25B)
export function fmtShares(n, lang = 'ko') {
  if (lang === 'ko') return n >= 1e8 ? `${(n / 1e8).toFixed(2)}억` : `${Math.round(n / 1e4).toLocaleString('en-US')}만`
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`
}
// 금액 글자: $2.49bn / $771m
//   (999.5m 이상은 bn — 10억 달러 프로그램의 $999,999,452 가 "$1000m" 으로 찍히지 않게)
export const fmtUsd = (n) => (n >= 999.5e6 ? `$${(n / 1e9).toFixed(2)}bn` : `$${Math.round(n / 1e6)}m`)

// 그날(date)까지 마지막으로 공시된 주식 수 — 계단 모양 (공시 사이 날짜는 직전 값). 첫 공시 전이면 null
export function sharesAt(points, date) {
  let v = null
  for (const p of points) { if (p.date <= date) v = p.shares; else break }
  return v
}

// 차트용: 두 공시 사이는 날짜 비율대로 직선 (ATM 처럼 조금씩 늘어난 구간이 "공시일에 한 번에 뛴" 것처럼 보이지 않게)
//   마지막 공시 뒤는 그 값 그대로(새 공시 전), 첫 공시 전은 null
export function sharesInterp(points, date) {
  if (!points.length || date < points[0].date) return null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (date <= b.date) return a.shares + (b.shares - a.shares) * ((t(date) - t(a.date)) / (t(b.date) - t(a.date)))
  }
  return points.at(-1).shares
}

// 요약: 최신 주식 수, 상장 직후 대비 배수, 1년 전 무렵 공시 대비 증가율, 전환사채를 최초 전환가로 모두 바꾸면 생길 주식 수
export function dilutionStats(file) {
  const pts = file.points
  const latest = { date: pts.at(-1).date, shares: pts.at(-1).shares }
  // 최신 공시의 1년 전 날짜에 가장 가까운 공시 (최신 자신은 제외)
  const target = t(latest.date) - 365 * DAY
  const yearAgo = pts.slice(0, -1).reduce((best, p) => (!best || Math.abs(t(p.date) - target) < Math.abs(t(best.date) - target) ? p : best), null)
  const convertShares = file.converts.reduce((n, c) => n + c.principal_usd / c.conversion_price_usd, 0)
  return {
    latest,
    sinceIpo: latest.shares / pts[0].shares,
    yearAgo: yearAgo && { date: yearAgo.date, shares: yearAgo.shares },
    yoyPct: yearAgo ? (latest.shares / yearAgo.shares - 1) * 100 : null,
    convertShares,
    convertPct: (convertShares / latest.shares) * 100,
  }
}

// 주식 조달 표: 금액이 없으면 주식 수 × 주당 가격, 주당 평균가 = 금액 ÷ 주식 수, 한도가 있으면 사용률
export function raiseRows(file) {
  return file.raises.map((r) => {
    const gross = r.gross_usd ?? (r.price_usd ? r.shares * r.price_usd : null)
    return { ...r, gross, grossCalc: r.gross_usd == null, avgPrice: gross ? gross / r.shares : null, usedPct: r.limit_usd && gross ? (gross / r.limit_usd) * 100 : null }
  })
}

// 전환사채 표: 최초 전환가로 모두 주식이 되면 생길 주식 수 (단순 계산 — 현금 상환·캡드콜·전환 조건으로 줄 수 있음)
export function convertRows(file) {
  return file.converts.map((c) => ({ ...c, shares: c.principal_usd / c.conversion_price_usd }))
}

// 매일 갱신: SEC XBRL(companyfacts)의 표지 주식 수 중 아직 없는 날짜만 덧붙임 (출처 = 그 공시 목록 주소)
export function mergeXbrlPoints(file, facts, cik = '1878848') {
  const rows = facts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? []
  const have = new Set(file.points.map((p) => p.date))
  const add = rows.filter((r) => r.end && Number.isInteger(r.val) && r.val > 0 && !have.has(r.end))
    .filter((r, i, all) => all.findIndex((x) => x.end === r.end) === i) // 같은 날짜가 두 번 나오면 하나만
    .map((r) => ({ date: r.end, shares: r.val, form: r.form, source: `https://www.sec.gov/Archives/edgar/data/${cik}/${String(r.accn).replace(/-/g, '')}/`, auto: true }))
  if (!add.length) return { file, added: 0 }
  return { file: { ...file, points: [...file.points, ...add].sort((a, b) => a.date.localeCompare(b.date)) }, added: add.length }
}
