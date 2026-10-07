// =============================================================
// timeline.js — "그 날짜에 무엇이 어떤 상태였나"를 계산하는 순수 함수 모음
// -------------------------------------------------------------
// 데이터에는 건물의 현재 상태를 저장하지 않고, 상태가 바뀐 시점(phases)만 기록합니다.
//   예) phases: [{ status:'under_construction', from:'2025-02' }, { status:'operating', from:'2026-Q4', basis:'target' }]
// 그러면 아무 날짜나 넣어도 그때의 상태를 계산할 수 있어 타임라인 슬라이더가 가능해집니다.
//
// 날짜는 모두 "월 번호"(정수)로 바꿔 비교합니다: 2026년 8월 = 2026*12 + 7
// 입력이 같으면 결과도 항상 같아서(vitest) 테스트하기 쉽습니다.
// =============================================================

export const PUE_DEFAULT = 1.3 // IT MW 만 공개된 경우 총 전력(gross)으로 환산할 때 쓰는 값 (추정)

// 상태 우선순위: 사이트 대표 상태를 고를 때 "가장 앞선" 상태를 씁니다
const PRECEDENCE = ['operating', 'commissioning', 'under_construction', 'decommissioning', 'planned']

// ---------- 날짜 → 월 번호 ----------
// 허용 형식: '2026' | '2026-Q4' | '2026-H2' | '2026-08' | '2026-08-13'
// edge: 'start' 면 기간의 첫 달, 'end' 면 마지막 달 ('2026-Q4' → 10월 / 12월)
export function toMonth(when, edge = 'start') {
  const m = String(when).match(/^(\d{4})(?:-(Q[1-4]|H[12]|\d{2})(?:-\d{2})?)?$/)
  if (!m) throw new Error(`알 수 없는 날짜 형식: ${when}`)
  const y = Number(m[1])
  const part = m[2]
  let first = 1, last = 12
  if (part?.startsWith('Q')) { const q = Number(part[1]); first = (q - 1) * 3 + 1; last = q * 3 }
  else if (part?.startsWith('H')) { const h = Number(part[1]); first = h === 1 ? 1 : 7; last = h === 1 ? 6 : 12 }
  else if (part) { first = last = Number(part) }
  return y * 12 + (edge === 'end' ? last : first) - 1
}

// 월 번호 → 'YYYY-MM'
export function monthKey(m) {
  const y = Math.floor(m / 12)
  return `${y}-${String((m % 12) + 1).padStart(2, '0')}`
}

// 월 번호 → 화면 표시용 ('2027년 6월' / 'Jun 2027')
export function monthLabel(m, lang = 'ko') {
  const y = Math.floor(m / 12), mo = (m % 12) + 1
  if (lang === 'ko') return `${y}년 ${mo}월`
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo - 1]} ${y}`
}

// 단계가 시작되는 달: 회사 "목표"는 보수적으로 기간의 끝(예: 2026-Q4 → 12월), 실제 발표는 시작
export function phaseMonth(phase) {
  return toMonth(phase.from, phase.basis === 'target' ? 'end' : 'start')
}

// ---------- 건물 ----------
// 날짜 m 의 상태. 아직 첫 단계 전이면 null(존재하지 않음), 철거·전환 완료면 'retired'
export function statusAt(building, m) {
  let status = null
  for (const p of building.phases) {
    if (phaseMonth(p) <= m) status = p.status
    else break
  }
  return status
}

// 지금 단계가 언제 시작해서 다음 단계가 언제인지
function phaseWindow(building, m) {
  let cur = null, next = null
  for (const p of building.phases) {
    if (phaseMonth(p) <= m) cur = p
    else { next = p; break }
  }
  return { cur, next }
}

// 건설 진행률(0~1): 건설 시작 → (기준일, 발표 진행률) → 다음 단계 를 선으로 이어 보간
export function progressAt(building, m, asOfM) {
  const st = statusAt(building, m)
  if (st === 'operating' || st === 'commissioning' || st === 'decommissioning') return 1
  if (st !== 'under_construction') return 0
  const { cur, next } = phaseWindow(building, m)
  const start = phaseMonth(cur)
  const end = next ? phaseMonth(next) : start + 12
  const lerp = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k))
  const p = building.progress
  if (p != null && asOfM != null && asOfM > start && asOfM < end) {
    return m <= asOfM ? lerp(0, p, (m - start) / (asOfM - start)) : lerp(p, 1, (m - asOfM) / (end - asOfM))
  }
  return lerp(0.05, 1, (m - start) / Math.max(1, end - start))
}

// 건물의 총 전력(MW). gross 가 없고 IT 만 있으면 PUE 로 환산 (estimated 표시)
export function grossOf(building) {
  if (building.gross_mw != null) return { mw: building.gross_mw, estimated: false }
  if (building.it_mw != null) return { mw: building.it_mw * (building.pue ?? PUE_DEFAULT), estimated: true }
  return { mw: 0, estimated: false }
}

// ---------- 전환(replaces) 반영 ----------
// 전환 건물(replaces: X)이 실제로 전력을 쓰기 시작하면(시운전·가동) 기존 건물 X 의 용량을 그만큼 넘겨받습니다.
//   예) 매켄지: 공랭 홀 80MW 중 액체냉각 전환 50MW 가동 → 공랭 홀은 30MW 로 줄어듦
//   기존 건물 용량이 0 이 되면 'retired'(사라짐) 로 봅니다. 건설 중에는 넘겨받지 않습니다.
const DRAWS_POWER = new Set(['commissioning', 'operating'])

export function effectiveBuildingsAt(site, m) {
  const out = []
  for (const b of site.buildings) {
    let status = statusAt(b, m)
    if (!status || status === 'retired') continue
    const g = grossOf(b)
    let mw = g.mw
    const takenOver = site.buildings
      .filter((r) => r.replaces === b.id && DRAWS_POWER.has(statusAt(r, m)))
      .reduce((n, r) => n + grossOf(r).mw, 0)
    if (takenOver > 0) {
      mw = Math.max(0, mw - takenOver)
      if (mw === 0) continue // 완전히 전환됨 → 사라짐
    }
    out.push({ building: b, status, mw, estimated: g.estimated, reduced: takenOver > 0 })
  }
  return out
}

// ---------- 사이트 ----------
// 날짜 m 의 계통 전력 { secured: 확보, energized: 통전 } — 발표 전이면 null
export function powerAt(site, m) {
  if (toMonth(site.announced) > m) return null
  let cur = null
  for (const p of site.power) {
    if (toMonth(p.from, p.basis === 'target' ? 'end' : 'start') <= m) cur = p
    else break
  }
  return cur ? { secured: cur.secured_mw, energized: cur.energized_mw } : { secured: 0, energized: 0 }
}

// 사이트 대표 상태: 존재하는 건물 중 가장 앞선 상태. 건물이 없으면 'planned', 발표 전이면 null
export function siteStatusAt(site, m) {
  if (!powerAt(site, m)) return null
  const statuses = effectiveBuildingsAt(site, m).map((e) => e.status)
  for (const s of PRECEDENCE) if (statuses.includes(s)) return s
  return 'planned'
}

// 사이트 전력을 "지금 무엇에 쓰이는가" 로 나눔 (iren-3d 의 siteMetrics 를 날짜별로 확장)
//   operating = 가동 AI + 아직 돌고 있는 채굴(폐쇄 예정)
//   building  = 시운전 + 건설중
//   planned   = 나머지 확보 전력
// TODO(학습 포인트): 시운전(commissioning)을 '가동'으로 볼지 '건설'로 볼지 직접 정해 보세요.
export function siteMetricsAt(site, m) {
  const power = powerAt(site, m)
  const empty = { secured: 0, energized: 0, operating: 0, ai: 0, mining: 0, building: 0, planned: 0, gpus: 0, hasEstimate: false }
  if (!power) return empty
  let ai = 0, mining = 0, building = 0, gpus = 0, hasEstimate = false
  for (const { building: b, status: st, mw, estimated } of effectiveBuildingsAt(site, m)) {
    if (estimated) hasEstimate = true
    // 채굴동은 상태와 상관없이 '채굴' 로 분류 (AI 가동에 섞이지 않게)
    const isMining = b.kind === 'miner_hall'
    if (isMining && (st === 'operating' || st === 'decommissioning')) mining += mw
    else if (st === 'operating') ai += mw
    else if (st === 'decommissioning') mining += mw
    else if (st === 'commissioning' || st === 'under_construction') building += mw
    if (st === 'operating' || st === 'commissioning') gpus += b.gpu?.count ?? 0
  }
  const operating = ai + mining
  const secured = power.secured
  const buildingClamped = Math.max(0, Math.min(building, secured - operating))
  return {
    secured,
    energized: power.energized,
    operating,
    ai,
    mining,
    building: buildingClamped,
    planned: Math.max(0, secured - operating - buildingClamped),
    gpus,
    hasEstimate,
  }
}

// ---------- 회사 순위 ----------
// lens 'primary': 사이트를 대표 회사 한 곳에만 셈 → 전체 합과 일치
// lens 'tenant' : 입주사(tenant·end_user)에게도 셈 → 회사 간 중복 계산 있음
export function companyRanking(data, m, { lens = 'primary', metric = 'secured', companies = null, groups = null } = {}) {
  const groupOf = Object.fromEntries(data.companies.map((c) => [c.id, c.group]))
  const rows = new Map()
  const add = (cid, mt) => {
    if (companies && !companies.has(cid)) return
    if (groups && !groups.has(groupOf[cid])) return
    const r = rows.get(cid) ?? { companyId: cid, secured: 0, energized: 0, operating: 0, ai: 0, building: 0, planned: 0, sites: 0, hasEstimate: false }
    for (const k of ['secured', 'energized', 'operating', 'ai', 'building', 'planned']) r[k] += mt[k]
    r.sites += 1
    r.hasEstimate ||= mt.hasEstimate
    rows.set(cid, r)
  }
  for (const site of data.sites) {
    const mt = siteMetricsAt(site, m)
    if (!powerAt(site, m)) continue
    if (lens === 'tenant') {
      const tenants = site.parties.filter((p) => p.role === 'tenant' || p.role === 'end_user').map((p) => p.company)
      for (const cid of new Set(tenants.length ? tenants : [site.primary])) add(cid, mt)
    } else {
      add(site.primary, mt)
    }
  }
  return [...rows.values()]
    .sort((a, b) => b[metric] - a[metric] || a.companyId.localeCompare(b.companyId))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

// 전체 합계 (필터 적용 가능)
export function totalsAt(data, m, { companies = null } = {}) {
  const t = { secured: 0, energized: 0, operating: 0, ai: 0, mining: 0, building: 0, planned: 0, gpus: 0, sites: 0 }
  for (const site of data.sites) {
    if (companies && !companies.has(site.primary)) continue
    if (!powerAt(site, m)) continue
    const mt = siteMetricsAt(site, m)
    for (const k of Object.keys(t)) if (k !== 'sites') t[k] += mt[k]
    t.sites += 1
  }
  return t
}
