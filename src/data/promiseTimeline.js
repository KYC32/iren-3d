// =============================================================
// promiseTimeline.js — 경영진 약속 타임라인 계산 (순수 함수 — 화면 ui/PromiseTimeline.jsx 는 이 값을 그리기만)
// -------------------------------------------------------------
// 약속마다 한 줄: 처음 말한 날 → 기한 막대 · 이룬 날 점 · 기한이 지난 뒤 흐른 기간 · 회사가 미룬 날 · 다시 말한 날
// 판정은 promises.verdictOf 그대로 (기준일 = file.checkedAt, 회사가 기한을 미뤄도 원래 기한으로)
// 날짜는 모두 'YYYY-MM-DD' 문자열 — 크기 비교가 곧 날짜 비교, 날수만 UTC 자정 시각으로 바꿔 셈
// 2026-10-22 사용자 결정: "한눈에 볼 수 있게" 기한 타임라인(B안) — PolitiFact 약속 추적기·로드맵 화면 참고
// =============================================================
import { verdictOf } from './promises.js'

const DAY = 86400000
const ms = (day) => Date.parse(`${day}T00:00:00Z`)
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY)

// 약속마다 한 줄 (순서: 결과가 나온 약속 → 기한 전, 각각 기한이 이른 순 → 먼저 말한 순)
//   said        처음 말한 날 (발언이 없으면 기한 — 막대 없이 한 점)
//   mentions    그 약속을 말한 날들 (같은 날은 한 번) · mentionCount 발언 수
//   achieved    이룬 날 (지켜짐·늦게 지켜짐) · withdrawnOn 철회한 날 · postponedOn 회사가 미룬다고 밝힌 날들
//   lateDays    기한이 지난 뒤 흐른 날수 (늦게 지켜짐 = 기한 → 이룬 날, 늦어짐 = 기한 → 기준일, 나머지 0)
//   daysLeft    기한 전 약속만: 기준일부터 기한까지 남은 날수
export function timelineRows(file) {
  const saidOn = new Map() // 약속 id → 말한 날 목록
  for (const s of file.statements) {
    if (!s.promise) continue
    if (!saidOn.has(s.promise)) saidOn.set(s.promise, [])
    saidOn.get(s.promise).push(s.date)
  }
  const rows = file.promises.map((p) => {
    const v = verdictOf(p, file.checkedAt)
    const dates = [...(saidOn.get(p.id) ?? [])].sort()
    const mentions = [...new Set(dates)]
    const row = {
      id: p.id, promise: p, verdict: v, status: v.status, topic: p.topic, title_ko: p.title_ko, title_en: p.title_en,
      said: mentions[0] ?? v.deadline, deadline: v.deadline, mentions, mentionCount: dates.length,
      postponedOn: (p.postponed ?? []).map((x) => x.published).sort(),
      lateDays: v.status === 'late-kept' ? daysBetween(v.deadline, v.achieved) : v.status === 'late' ? daysBetween(v.deadline, file.checkedAt) : 0,
    }
    if (v.achieved) row.achieved = v.achieved
    if (v.status === 'withdrawn') row.withdrawnOn = p.withdrawn.date
    if (v.status === 'pending') row.daysLeft = daysBetween(file.checkedAt, v.deadline)
    return row
  })
  const later = (r) => (r.status === 'pending' ? 1 : 0) // 기한 전 약속은 뒤로
  return rows.sort((a, b) => later(a) - later(b) || a.deadline.localeCompare(b.deadline) || a.said.localeCompare(b.said) || a.id.localeCompare(b.id))
}

// 화면 묶음: 결과가 나온 약속 한 묶음('decided') + 기한 전은 기한마다 한 묶음('pending:YYYY-MM-DD', 남은 날수와 함께)
//   rows 는 timelineRows 순서 그대로 받음 (그래서 묶음도 기한 순)
export function timelineGroups(rows) {
  const out = []
  const decided = rows.filter((r) => r.status !== 'pending')
  if (decided.length) out.push({ key: 'decided', rows: decided })
  for (const r of rows) {
    if (r.status !== 'pending') continue
    const key = `pending:${r.deadline}`
    let g = out.find((x) => x.key === key)
    if (!g) { g = { key, deadline: r.deadline, daysLeft: r.daysLeft, rows: [] }; out.push(g) }
    g.rows.push(r)
  }
  return out
}

// 가로 축: 가장 이른 말한 날이 든 달의 첫날 ~ 가장 늦은 날(기한·이룬 날·철회한 날·기준일)이 든 달의 다음 달 첫날
//   years = 축 안의 1월 1일 (해 이름 눈금) · quarters = 축 안의 4·7·10월 1일 (옅은 세로 줄) · today = 기준일
export function timelineAxis(rows, checkedAt) {
  if (!rows.length) { const y = Number(checkedAt.slice(0, 4)); return axisOf(`${y}-01-01`, `${y + 1}-01-01`, checkedAt) }
  let earliest = rows[0].said, latest = checkedAt
  for (const r of rows) {
    if (r.said < earliest) earliest = r.said
    for (const d of [r.deadline, r.achieved, r.withdrawnOn]) if (d && d > latest) latest = d
  }
  return axisOf(`${earliest.slice(0, 7)}-01`, nextMonthStart(latest), checkedAt)
}

// 그 날이 든 달의 다음 달 1일 ('2027-12-31' → '2028-01-01')
function nextMonthStart(day) {
  const [y, m] = day.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

function axisOf(start, end, today) {
  const years = [], quarters = []
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    const jan = `${y}-01-01`
    if (jan > start && jan < end) years.push({ label: String(y), day: jan })
    for (const m of ['04', '07', '10']) { const d = `${y}-${m}-01`; if (d > start && d < end) quarters.push(d) }
  }
  return { start, end, today, years, quarters }
}

// 날짜 → 축 위 위치 (0~100 %, 축 밖은 양 끝으로 자름) — 화면은 이 값을 left·width 퍼센트로 씀
export function pos(day, axis) {
  const t = ((ms(day) - ms(axis.start)) / (ms(axis.end) - ms(axis.start))) * 100
  return Math.min(100, Math.max(0, t))
}

// 기간 글자: 한 달(31일) 미만은 날, 그 이상은 달(평균 30.44일로 나눠 반올림) — "7개월 늦게" · "8일 늦게" · "71일 남음"
export function fmtSpan(days, lang) {
  if (days < 31) return lang === 'ko' ? `${days}일` : `${days} ${days === 1 ? 'day' : 'days'}`
  const m = Math.round(days / 30.44)
  return lang === 'ko' ? `${m}개월` : `${m} ${m === 1 ? 'month' : 'months'}`
}

// 다음 기한 (옥상 위 CEO 카드 한 줄): 기한 전 약속 중 가장 이른 기한 · 그 기한의 약속 수 · 기준일부터 남은 날 (없으면 null)
export function nextDeadline(file) {
  const g = timelineGroups(timelineRows(file)).find((x) => x.key.startsWith('pending:'))
  return g ? { deadline: g.deadline, count: g.rows.length, daysLeft: g.daysLeft } : null
}

// 한 캠퍼스의 약속만 (캠퍼스 패널 '경영진 약속' 칸) — 약속의 site 칸으로 고름, 순서는 타임라인과 같음
export function sitePromises(file, siteId) {
  return timelineRows(file).filter((r) => r.promise.site === siteId)
}
