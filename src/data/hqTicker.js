// =============================================================
// hqTicker.js — 본사 로비 위 전광판에 흐르는 글자 (순수 함수 · hqTicker.test.js)
// -------------------------------------------------------------
// 쓰는 자료: public/data/stock.json (Nasdaq 일봉 — 매일 자동 갱신) · data/companies.json 의 events (회사가 발표한 일정)
//   전일 종가와 등락 · 다가오는 실적 발표 · 주주총회까지 남은 날 — 그림 표현일 뿐 실제 빌딩에 이런 전광판은 없음
// 날짜는 'YYYY-MM-DD' 글자 그대로 비교 (일정은 회사가 밝힌 미국 날짜, 오늘은 보는 사람의 날짜)
// =============================================================

// 마지막 두 거래일 종가 → { date, close, prev, pct } (줄이 둘 안 되면 null)
export function lastClose(file) {
  const rows = file?.rows ?? []
  const ci = file?.columns?.indexOf('close') ?? -1
  if (rows.length < 2 || ci < 0) return null
  const [a, b] = rows.slice(-2)
  const prev = a[ci], close = b[ci]
  return { date: b[0], close, prev, pct: Math.round(((close - prev) / prev) * 1000) / 10 }
}

// 두 날짜('YYYY-MM-DD') 사이 날 수 (date − today)
export function dday(date, today) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((t(date) - t(today)) / 86400000)
}

// 다가오는 일정: 오늘 이후 · 날짜가 일까지 있는 · 회사가 발표한(reported) 것만, 가까운 순 n 개
export function upcomingEvents(events, today, n = 2) {
  return (events ?? [])
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.basis === 'reported' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, n)
}

// 제목은 ' · ' 앞 첫 조각, 끝의 괄호 설명은 뺌 ('2026 정기 주주총회 (온라인, …)' → '2026 정기 주주총회')
const shortTitle = (t) => t.split(' · ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim()
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`
const monDay = (d) => `${new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${+d.slice(8, 10)}`

// 전광판 글자 목록 (한 줄씩) — close = lastClose 결과(없으면 null), today = 'YYYY-MM-DD'
export function tickerItems({ close, events, today, lang = 'ko' }) {
  const ko = lang === 'ko'
  const out = []
  if (close) {
    const arrow = close.pct >= 0 ? '▲' : '▼'
    out.push(`IREN $${close.close.toFixed(2)} ${arrow}${Math.abs(close.pct).toFixed(1)}% · ${ko ? `${md(close.date)} 종가` : `close ${md(close.date)}`}`)
  }
  for (const e of upcomingEvents(events, today)) {
    const n = dday(e.date, today)
    const left = ko ? (n === 0 ? '오늘' : `D-${n}`) : (n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`)
    out.push(`${shortTitle(ko ? e.title_ko : e.title_en)} · ${ko ? md(e.date) : monDay(e.date)} (${left})`)
  }
  return out
}
