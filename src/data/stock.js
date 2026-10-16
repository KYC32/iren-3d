// =============================================================
// stock.js — 주가 데이터 순수 함수 (스크립트·화면·테스트가 함께 씀, 브라우저 전용 API 없음)
// -------------------------------------------------------------
//   parseNasdaqRows : Nasdaq API 응답 행 → 우리 저장 형식 [날짜, 시가, 고가, 저가, 종가, 거래량]
//   mergeRows       : 기존 파일 + 새로 받은 행 병합 (같은 날짜는 새 값으로)
//   toSeries        : 저장 파일 → 화면용 객체 배열
//   sliceRange      : 1M·6M·1Y·ALL(상장 이후) 구간 자르기
//   yScale·linePath·areaPath·priceTicks·dateTicks·xForDate : SVG 차트 좌표 계산
//   nearestIndex    : 마우스 위치의 날짜 → 가장 가까운 거래일
//   stats           : 현재가·상장가 대비·52주 고저·최고가·최대 낙폭
//   eventsForChart  : 타임라인 사건(store.events) → 차트 마커 (발표 기준 + 일/월 정밀도만)
// =============================================================

export const COLUMNS = ['date', 'open', 'high', 'low', 'close', 'volume']
export const IPO = { date: '2021-11-17', price: 28 } // 공모가 $28 (2021-11-17 NASDAQ 상장)

// '$34.80' → 34.8, '49,659,280' → 49659280, 'N/A' → null
const num = (v) => {
  if (v == null) return null
  const n = Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
// '10/12/2026' (미국식 월/일/년) → '2026-10-12'
const isoDate = (us) => {
  const m = String(us).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}

// Nasdaq 행 배열 → [[date, open, high, low, close, volume], …] 날짜 오름차순. 종가가 없는 행은 버림
export function parseNasdaqRows(rows) {
  const out = []
  for (const r of rows ?? []) {
    const date = isoDate(r.date), close = num(r.close)
    if (!date || close == null) continue
    out.push([date, num(r.open) ?? close, num(r.high) ?? close, num(r.low) ?? close, close, num(r.volume) ?? 0])
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

// 기존 행 + 새 행 → 날짜별로 하나씩 (새 값 우선), 오름차순
export function mergeRows(existing, incoming) {
  const map = new Map()
  for (const r of existing ?? []) map.set(r[0], r)
  for (const r of incoming ?? []) map.set(r[0], r)
  return [...map.values()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

// 저장 파일 → [{date, open, high, low, close, volume}]
export function toSeries(file) {
  return (file?.rows ?? []).map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }))
}

// ---- 구간 ----
export const RANGES = ['1M', '6M', '1Y', 'ALL']
const addMonths = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}
// endDate(기본: 마지막 거래일) 기준으로 n개월 전부터. ALL 은 전체
export function sliceRange(series, range, endDate = series.at(-1)?.date) {
  if (!series.length || range === 'ALL') return series
  const months = { '1M': 1, '6M': 6, '1Y': 12 }[range] ?? 12
  const from = addMonths(endDate, -months)
  return series.filter((p) => p.date >= from && p.date <= endDate)
}

// ---- 좌표 ----
// 가격 → y (위가 0). log 면 로그 눈금. pad 만큼 위아래 여백
export function yScale(min, max, height, { log = false, pad = 0.06 } = {}) {
  const f = log ? Math.log : (v) => v
  let lo = f(Math.max(min, 1e-6)), hi = f(Math.max(max, 1e-6))
  if (hi === lo) hi = lo + 1
  const span = hi - lo
  lo -= span * pad; hi += span * pad
  return (v) => height - ((f(Math.max(v, 1e-6)) - lo) / (hi - lo)) * height
}
// 날짜 → x: 시간(ms)에 비례 (휴장일이 있어도 달력 간격 유지)
export function xForDate(date, first, last, width) {
  const t = Date.parse(date + 'T00:00:00Z'), a = Date.parse(first + 'T00:00:00Z'), b = Date.parse(last + 'T00:00:00Z')
  if (b === a) return width / 2
  return ((t - a) / (b - a)) * width
}
const r1 = (n) => Math.round(n * 10) / 10
export function linePath(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')
}
export function areaPath(points, baseY) {
  if (!points.length) return ''
  return `${linePath(points)}L${r1(points.at(-1)[0])} ${r1(baseY)}L${r1(points[0][0])} ${r1(baseY)}Z`
}
// 보기 좋은 가격 눈금 (1·2·5 단위). log 면 2배씩
export function priceTicks(min, max, { log = false, count = 5 } = {}) {
  if (log) {
    const out = []
    for (let v = 1; v <= max * 2; v *= 2) if (v >= min * 0.9 && v <= max * 1.1) out.push(v)
    return out.length >= 2 ? out : priceTicks(min, max, { count })
  }
  const raw = (max - min) / Math.max(1, count - 1)
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? mag * 10
  const out = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
// 날짜 눈금: 구간 길이에 따라 연 / 분기 / 월 / 주 단위 → [{date, label}]
export function dateTicks(series, { lang = 'ko' } = {}) {
  if (series.length < 2) return []
  const first = series[0].date, last = series.at(-1).date
  const days = (Date.parse(last) - Date.parse(first)) / 86400000
  const unit = days > 900 ? 'year' : days > 400 ? 'quarter' : days > 100 ? 'month' : 'week'
  const out = []
  let prev = null
  for (const p of series) {
    const [y, m, d] = p.date.split('-').map(Number)
    let key, label
    if (unit === 'year') { key = y; label = String(y) }
    else if (unit === 'quarter') { key = `${y}-${Math.ceil(m / 3)}`; label = m === 1 ? String(y) : `${m}${lang === 'ko' ? '월' : ''}` }
    else if (unit === 'month') { key = `${y}-${m}`; label = m === 1 ? String(y) : `${m}${lang === 'ko' ? '월' : ''}` }
    else { key = `${y}-${m}-${Math.floor((d - 1) / 7)}`; label = `${m}/${d}` }
    if (key !== prev) { out.push({ date: p.date, label }); prev = key }
  }
  return out.slice(out.length > 1 && out[0].date === first && unit !== 'week' ? 1 : 0)
}

// 날짜(ISO) → 그 날 또는 직전 거래일의 인덱스 (이진 탐색). 첫 거래일 이전이면 0
export function nearestIndex(series, date) {
  let lo = 0, hi = series.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (series[mid].date <= date) lo = mid
    else hi = mid - 1
  }
  return lo
}

// ---- 통계 ----
// 목록에서 better(지금까지 고른 것, 새것) 가 참일 때마다 새것으로 바꿔 끝까지 고른 날의 { 종가, 날짜 }
const pick = (list, better) => { const p = list.reduce((a, b) => (better(a, b) ? b : a)); return { price: p.close, date: p.date } }
export function stats(series, ipoPrice = IPO.price) {
  if (!series.length) return null
  const last = series.at(-1), prev = series.at(-2) ?? last
  const yearAgo = addMonths(last.date, -12)
  const recent = series.filter((p) => p.date >= yearAgo)
  // 최대 낙폭: 지나온 최고점(peak) 대비 가장 많이 떨어진 날. ddFrom 은 "그 낙폭의" 최고점 (나중에 더 높은 고점이 와도 바뀌지 않음)
  let ath = series[0], peak = series[0], maxDd = 0, ddFrom = series[0], ddTo = series[0]
  for (const p of series) {
    if (p.close > ath.close) ath = p
    if (p.close > peak.close) peak = p
    const dd = (p.close - peak.close) / peak.close
    if (dd < maxDd) { maxDd = dd; ddFrom = peak; ddTo = p }
  }
  return {
    last: last.close, date: last.date, prevClose: prev.close,
    chg: last.close - prev.close, chgPct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0,
    vsIpoPct: ((last.close - ipoPrice) / ipoPrice) * 100,
    // 52주 최고·최저: 차트(종가 선)·사상 최고·최대 낙폭과 같은 종가 기준 + 그 날짜
    //   (장중 고가를 쓰면 같은 날 "52주 최고 76.87 > 사상 최고 76.41" 처럼 서로 어긋나 보임)
    high52: pick(recent, (a, b) => b.close > a.close), low52: pick(recent, (a, b) => b.close < a.close),
    ath: { price: ath.close, date: ath.date },
    maxDrawdownPct: maxDd * 100, drawdownFrom: ddFrom.date, drawdownTo: ddTo.date,
    from: series[0].date, to: last.date, days: series.length,
  }
}

// ---- 사건 마커 ----
// store.events(buildEvents 결과) 중 "발표(reported)"이고 날짜가 일 또는 월 단위인 것만. 월 단위는 15일에 놓고 precision:'month'
export function eventsForChart(events) {
  const out = []
  for (const e of events ?? []) {
    if (e.basis !== 'reported') continue
    const w = String(e.when)
    let date, precision
    if (/^\d{4}-\d{2}-\d{2}$/.test(w)) { date = w; precision = 'day' }
    else if (/^\d{4}-\d{2}$/.test(w)) { date = `${w}-15`; precision = 'month' }
    else continue // 연·분기 단위는 너무 넓어 마커로 두지 않음
    out.push({ id: e.id, date, precision, kind: e.kind, title_ko: e.title_ko, title_en: e.title_en, source: e.source, siteId: e.siteId ?? null })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
// 마커 색: 계약 = 파랑(accent), 실적 = 주황, 건물·전력 단계 = 초록(가동색), 그 밖(뉴스) = 회색
export function markerColor(kind) {
  if (kind === 'contract') return '#2f6bed'
  if (kind === 'earnings') return '#e38b1f'
  if (kind === 'phase' || kind === 'power' || kind === 'delivery') return '#2ea88a'
  return '#8a93ab'
}
