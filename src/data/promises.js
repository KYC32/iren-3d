// =============================================================
// promises.js — 경영진 약속 판정 계산 (순수 함수 — 화면·빌드·테스트가 함께 씀)
// -------------------------------------------------------------
// 판정은 손으로 적지 않고 여기서 계산합니다 (설계: docs/superpowers/specs/2026-10-21-ceo-statements-design.md 6장).
//   지켜짐      : 회사 자료로 확인된 이룬 날 ≤ 기한
//   늦게 지켜짐 : 이룬 날 > 기한
//   늦어짐      : 기한 < 기준일(checkedAt)인데 아직 확인 안 됨
//   철회        : 회사가 거둬들이거나 다른 것으로 바꿨다고 밝힘 (기한과 상관없이)
//   기한 전     : 기한 ≥ 기준일이고 아직 안 이룸
// 기준일은 "오늘"이 아니라 자료를 마지막으로 확인한 날(checkedAt) —
//   다시 확인하지 않은 사이 이미 이뤄진 약속이 '늦어짐'으로 잘못 보이지 않게
// 날짜는 모두 'YYYY-MM-DD' 문자열이라 크기 비교(<, ≤)가 곧 날짜 비교입니다.
// =============================================================
import { fmtMw } from './format.js'

// '이룬 날'·'철회'·'목표 줄임' 근거로 인정하는 회사 자료 주소 (그 하위 주소 포함, 예: www.sec.gov)
export const COMPANY_HOSTS = ['sec.gov', 'iren.com', 'iren.gcs-web.com', 'globenewswire.com']

// 주소의 호스트 이름 (잘못된 주소면 빈 문자열)
function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}
// host 가 base 와 같거나 base 의 하위 주소인가 (예: investors.iren.com → iren.com)
const isUnder = (host, base) => host === base || host.endsWith(`.${base}`)

// 회사 자료 주소인가
export function isCompanyUrl(url) {
  const host = hostOf(url)
  return COMPANY_HOSTS.some((base) => isUnder(host, base))
}

// 그 달의 마지막 날 (월은 1~12) — Date.UTC 의 "다음 달 0일" = 이번 달 마지막 날
const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const day = (year, month, d) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const monthEnd = (year, month) => day(year, month, lastDay(year, month))

// 기한 글자 → 그 기간의 마지막 날
//   달력: 2026 · 2026-H1 · 2026-Q3 · 2026-06 · 2026-06-15
//   회계연도(IREN 은 7월 시작, FY2026 = 2025-07-01 ~ 2026-06-30): FY2026 · FY2026-H1 · FY2026-Q2
export function deadlineEnd(when) {
  let m = /^(\d{4})$/.exec(when)
  if (m) return `${m[1]}-12-31`
  m = /^(\d{4})-H([12])$/.exec(when)
  if (m) return m[2] === '1' ? `${m[1]}-06-30` : `${m[1]}-12-31`
  m = /^(\d{4})-Q([1-4])$/.exec(when)
  if (m) return monthEnd(Number(m[1]), Number(m[2]) * 3)
  m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(when)
  if (m) return monthEnd(Number(m[1]), Number(m[2]))
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) return when
  m = /^FY(\d{4})(?:-(H[12]|Q[1-4]))?$/.exec(when)
  if (m) {
    const fy = Number(m[1]) // FY2026 은 2026-06-30 에 끝남
    // 회계연도 안의 구간 → 끝나는 달 (달력 기준). 상반기·1·2분기는 앞 해(fy-1) 에 끝남
    const ends = { '': [fy, 6], H1: [fy - 1, 12], H2: [fy, 6], Q1: [fy - 1, 9], Q2: [fy - 1, 12], Q3: [fy, 3], Q4: [fy, 6] }
    const [year, month] = ends[m[2] ?? '']
    return monthEnd(year, month)
  }
  throw new Error(`알 수 없는 기한 형식: ${when}`)
}

// 이룬 날: 회사가 날짜를 밝혔으면 그 날 → 기간만 밝혔으면 그 기간의 끝 → 둘 다 없으면 자료 발표일 (보수적)
export function achievedOn(fulfilled) {
  if (fulfilled.date) return fulfilled.date
  if (fulfilled.period) return deadlineEnd(fulfilled.period)
  return fulfilled.published
}

// 목표를 이뤘나: '약'(about)·'최대'(up_to)는 95% 이상, 그 밖(exact·at_least)은 100% 이상
//   숫자 없는 약속(target 없음)은 일이 일어났으면 이룬 것, 숫자 약속인데 이룬 양을 모르면 못 이룬 것
export function meetsTarget(target, amount) {
  if (!target) return true
  if (!amount || amount.unit !== target.unit) return false
  const need = target.qualifier === 'about' || target.qualifier === 'up_to' ? 0.95 : 1
  return amount.value / target.value >= need - 1e-9 // 1e-9: 285/300 같은 나눗셈의 아주 작은 오차 대비
}

// 약속 하나의 판정 (checkedAt = 판정 기준일)
export function verdictOf(promise, checkedAt) {
  const deadline = deadlineEnd(promise.deadline) // 회사가 미뤄도(postponed) 원래 기한으로 판정
  const reduced = !!promise.reduced
  const goal = promise.reduced?.amount ?? promise.target // 회사가 줄였다고 밝혔으면 줄인 목표로
  if (promise.withdrawn && promise.withdrawn.date <= checkedAt) return { status: 'withdrawn', reduced, deadline }
  const f = promise.fulfilled
  if (f && meetsTarget(goal, f.amount)) {
    const achieved = achievedOn(f)
    return { status: achieved <= deadline ? 'kept' : 'late-kept', reduced, deadline, achieved }
  }
  // 아직 못 이룸: 기한이 지났으면 늦어짐, 아니면 기한 전. 일부 이룬 양이 있으면 "진행 X / Y"
  const status = deadline < checkedAt ? 'late' : 'pending'
  const done = promise.progress?.amount ?? f?.amount
  return done && goal ? { status, reduced, deadline, progress: { done, of: goal } } : { status, reduced, deadline }
}

// 약속 성적표: 판정별 개수 + 목표 줄임 수 + due(판정이 난 약속 수 = 기한 전만 뺀 수)
//   "기한 안에 지켜짐 a/b" 의 b 가 due — 기한 전에 미리 지켜진 약속도 넣어 a ≤ b 가 늘 성립
export function scoreboard(promises, checkedAt) {
  const out = { total: 0, kept: 0, lateKept: 0, late: 0, withdrawn: 0, pending: 0, reduced: 0, due: 0 }
  const key = { kept: 'kept', 'late-kept': 'lateKept', late: 'late', withdrawn: 'withdrawn', pending: 'pending' }
  for (const p of promises) {
    const v = verdictOf(p, checkedAt)
    out.total += 1
    out[key[v.status]] += 1
    if (v.reduced) out.reduced += 1
  }
  out.due = out.total - out.pending
  return out
}

// 최근 발언 수: 오늘 포함 지난 days 일 (days 일 전 당일은 뺌) — 지도 본사 카드의 "발언 n" 배지
export function recentCount(statements, today, days = 30) {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  const from = d.toISOString().slice(0, 10)
  return statements.filter((s) => s.date > from && s.date <= today).length
}

// 양 표기: 750 MW · 1 GW · GPU 23,000개 · $9.7bn, 앞뒤에 '약'·'최대'·'이상'
export function fmtAmount(amount, lang) {
  const ko = lang === 'ko'
  const { value, unit, qualifier } = amount
  const count = value.toLocaleString('en-US') // 천 단위 쉼표 (언어와 상관없이 같은 모양)
  let base
  if (unit === 'MW') base = fmtMw(value)
  else if (unit === 'GPUs') base = ko ? `GPU ${count}개` : `${count} GPUs`
  else base = value >= 1000 ? `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}bn` : `$${count}m` // USDm = 백만 달러
  if (qualifier === 'about') return ko ? `약 ${base}` : `~${base}`
  if (qualifier === 'up_to') return ko ? `최대 ${base}` : `up to ${base}`
  if (qualifier === 'at_least') return ko ? `${base} 이상` : base.replace(/^(\S+)/, '$1+') // 영어: 300+ MW
  return base
}

// 근거 자료 종류 이름 (배지 옆 "2026-05 보도자료로 확인" 의 '보도자료')
export function evidenceLabel(url, lang) {
  const ko = lang === 'ko'
  const host = hostOf(url)
  if (isUnder(host, 'sec.gov')) return ko ? 'SEC 공시' : 'SEC filing'
  if (isUnder(host, 'globenewswire.com') || isUnder(host, 'iren.gcs-web.com')) return ko ? '보도자료' : 'press release'
  if (isUnder(host, 'iren.com')) return ko ? '회사 홈페이지' : 'company site'
  return ko ? '자료' : 'source'
}
