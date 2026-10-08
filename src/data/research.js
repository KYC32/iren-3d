// =============================================================
// research.js — 원문 근거(research.json)를 날짜에 맞춰 꺼내 쓰는 함수 모음
// -------------------------------------------------------------
// research.json 에는 출처(sources), 원문에서 확인한 사실(claims), 회사 목표 일정(milestones),
// 사진(media), 위치 근거(locations)가 들어 있습니다.
// 핵심 원칙: "그 날짜에 공개돼 있던 자료"만 보여 줍니다 (나중에 나온 발표로 과거를 고쳐 쓰지 않음).
// observedSiteAt 은 투자자용 기본 화면 — 상태는 보고된 근거로만 앞으로 진행합니다.
// =============================================================
import { toMonth } from './timeline.js'

export const EMPTY_RESEARCH = { sources: [], claims: [], milestones: [], media: [], locations: [] }
export const publicBy = (source, month) => !!source?.published && toMonth(source.published, 'end') <= month
export const sourceById = (research, id) => research?.sources?.find((s) => s.id === id)
export function claimsAt(research, siteId, month, buildingId = null) {
  return (research?.claims ?? []).filter((c) => c.site === siteId && (!buildingId || c.building === buildingId)
    && c.review === 'verified' && publicBy(sourceById(research, c.sourceId), month))
}
export function mediaAt(research, siteId, month, buildingId = null) {
  return (research?.media ?? []).filter((p) => p.site === siteId && (!buildingId || p.buildings.includes(buildingId))
    // 게시일이 없는 홈페이지 사진은 우리가 확인한 달부터만 보여 줌
    // (그 전에 공개돼 있었다는 증거가 아니므로)
    && (() => { const source = sourceById(research, p.sourceId); return source && toMonth(source.published ?? source.reviewedAt, 'end') <= month })())
}
// 날짜 범위: 발표된 정밀도(연·분기·월·일)를 그대로 유지. 발표일은 실제로 일어난 날과 다를 수 있음
export function dateRange(when) {
  if (!when) return null
  const startMonth = toMonth(when), endMonth = toMonth(when, 'end')
  const start = /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : `${Math.floor(startMonth / 12)}-${String(startMonth % 12 + 1).padStart(2, '0')}-01`
  const end = /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : new Date(Date.UTC(Math.floor(endMonth / 12), endMonth % 12 + 1, 0)).toISOString().slice(0, 10)
  return { start, end }
}
export function assessMilestone(milestone, research, month) {
  const revisions = milestone.revisions.filter((r) => publicBy(sourceById(research, r.sourceId), month))
  const latest = revisions.at(-1), first = revisions[0]
  const completion = milestone.completion && publicBy(sourceById(research, milestone.completion.sourceId), month) ? milestone.completion : null
  const assessedMonth = Math.min(month, research.assessedThrough ? toMonth(research.assessedThrough) : month)
  let status = 'no_target'
  if (latest) {
    const due = dateRange(latest.target)
    if (completion) {
      const actual = dateRange(completion.occurred)
      status = !actual ? 'completed_unknown_date' : actual.end <= due.end ? 'on_time' : actual.start > due.end ? 'late' : 'completed_unknown_date'
    } else if (toMonth(latest.target, 'end') < assessedMonth) status = 'unconfirmed'
    else status = 'upcoming'
  } else if (completion) status = 'completed_unknown_date'
  return { ...milestone, revisions, first, latest, completion, status,
    revised: !!first && revisions.some((r, i) => i > 0 && dateRange(r.target).end > dateRange(revisions[i - 1].target).end) }
}
export function milestonesAt(research, siteId, month, buildingId = null) {
  return (research?.milestones ?? []).filter((m) => m.site === siteId && (!buildingId || m.building === buildingId))
    .map((m) => assessMilestone(m, research, month)).filter((m) => m.latest || m.completion)
}
export function locationFor(site, research) {
  const record = research?.locations?.find((l) => l.site === site.id)
  const verified = record?.review === 'verified'
  const precise = verified && ['facility', 'address'].includes(record.level)
  return { ...record, level: precise ? record.level : 'region', precise,
    lat: precise ? record.lat : site.coord.lat, lng: precise ? record.lng : site.coord.lng,
    maxZoom: precise ? 15 : 9 }
}
// 단계 목록을 날짜순으로 정렬 (같은 달이면 원래 순서 유지)
function sortPhases(list) {
  return list.map((p, i) => [p, i]).sort((a, b) => toMonth(a[0].from) - toMonth(b[0].from) || a[1] - b[1]).map(([p]) => p)
}
// 두 단계 목록을 합쳐 날짜순으로 — 연달아 같은 상태가 오면 앞의 것(먼저 확인된 시점)만 남김.
// 이미 건설·시운전 등으로 진행된 뒤에 오는 '계획'(예: 나중에 맺은 고객 계약 시점)은 뒤로 돌아가는 것이라 버림
function mergePhases(a, b) {
  const out = []
  for (const p of sortPhases([...a, ...b])) {
    const last = out.at(-1)?.status
    if (last === p.status) continue
    if (p.status === 'planned' && last && last !== 'planned') continue
    out.push(p)
  }
  return out
}

// 투자자용 "확인 기록" 화면: 상태는 보고된 근거로만 앞으로 진행 (목표일이 지났다고 자동으로 가동 처리하지 않음).
// 원본(iren.json)은 그대로 두고 녹화·전망용 화면에서 씁니다.
export function observedSiteAt(site, research, month, companies, sourceDates = []) {
  const sourceForUrl = (url) => research.sources.find((s) => s.url === url)
  const docDate = (url) => sourceDates.find((d) => d.url === url)?.published
  const asOfM = toMonth(site.as_of, 'end')
  const cutoff = Math.min(month, asOfM)
  // 기준일 이후(미래)를 보고 있나? → 그렇다면 기준일의 확인 상태에서 출발해 회사 목표·추정대로 진행
  const forecast = month > asOfM
  // 기준일 "뒤"에 잡힌 목표·추정 단계 (목표는 기간의 끝으로 — 2026-Q4 목표는 12월부터. timeline.js 와 같은 규칙)
  const isFuture = (p) => p.basis !== 'reported' && toMonth(p.from, p.basis === 'target' ? 'end' : 'start') > asOfM
  // 이 기록이 "공개된 날" — 아래 순서로 찾고, 그날이 보고 있는 달(cutoff) 이전이면 보여 줌
  //   1) published: 그 사실을 처음 공개한 날 (나중에 나온 정리 자료를 출처로 쓸 때 조사해 적어 둔 값)
  //   2) research.json 출처의 공개일 (원문을 검토한 자료)
  //   3) source-dates.json 의 문서 공개일 (주소 날짜·X 게시물 번호·EDGAR 제출일)
  //   4) 그래도 모르면: 보고(reported)된 사실은 "사건 날짜에 공개된 것"으로 봄
  //      (날짜 없는 회사 소개 페이지 등 — 대부분 실적·보도자료로 그 무렵 공개됨)
  //      목표·추정·납품 주문은 발표 시점을 알 수 없어 기준일에 알려진 것으로 봄
  const publishedOf = (p) => p.published ?? sourceForUrl(p.source)?.published ?? docDate(p.source)
    ?? (p.basis === 'reported' && p.from ? p.from : site.as_of)
  const isKnown = (p) => toMonth(publishedOf(p), 'end') <= cutoff
  const claims = claimsAt(research, site.id, cutoff)
  const buildings = site.buildings.map((b) => {
    const own = claims.filter((c) => c.building === b.id)
    const audited = research.auditedBuildings?.some((a) => a.site === site.id && a.building === b.id)
    const statusClaims = own.filter((c) => c.field === 'status' && (c.basis === 'reported' || c.value === 'planned'))
    // iren.json 에 이미 "보고(reported)"로 기록된 단계 — 상태를 앞으로 진행시키는 건 확인된 근거만
    const ownReported = b.phases.filter((p) => p.basis === 'reported' && isKnown(p) && toMonth(p.from, 'end') <= cutoff)
    // 원문을 검토한 건물은 원문 근거(claim) 단계를 쓰되, 기존 보고 이력도 합침
    // (예전엔 claim 만 써서 Horizon 1 의 2025년 건설·시운전 이력이 통째로 사라졌음)
    const claimPhases = statusClaims.map((c) => ({ status: c.value, from: c.effective ?? sourceById(research, c.sourceId).published,
      basis: 'reported', source: sourceById(research, c.sourceId).url, published: sourceById(research, c.sourceId).published }))
    // 단, 기존 이력은 원문 근거의 첫 시점 "이전" 것만 — 같은 사건을 iren.json 은 '가동', 원문은 '고객 인수'로
    // 다르게 기록한 경우(Horizon 1, 2026-08) 원문 쪽 분류를 따름
    const firstClaim = Math.min(...claimPhases.map((p) => toMonth(p.from)))
    const reported = audited ? mergePhases(ownReported.filter((p) => toMonth(p.from) < firstClaim), claimPhases) : ownReported
    // 퇴역(retired)은 근거 종류와 상관없이 반영 (목표 제외) — "줄어드는" 변화까지 보고를 기다리면
    // 퇴역 시점을 추정으로 기록한 건물(예: 프린스조지 Hopper 시범동)이 '가동'으로 되살아남
    const retired = b.phases.filter((p) => p.status === 'retired' && p.basis !== 'target' && toMonth(p.from, 'start') <= cutoff)
    const knownContract = companies.flatMap((c) => c.contracts ?? []).find((c) => c.sites.includes(site.id) && c.buildings?.includes(b.id)
      && toMonth(c.published ?? c.signed, 'end') <= cutoff)
    const targets = b.phases.filter((p) => p.basis === 'target' && isKnown(p))
    const visible = reported.length > 0 || knownContract || targets.length > 0
    const future = forecast ? b.phases.filter(isFuture) : []
    // 아직 확인 기록이 없는 건물: 보이는 건물이거나(계약·목표가 있음) 미래 목표가 있으면 기준일부터 '계획'
    const plannedFrom = visible || future.length ? `${Math.floor(cutoff / 12)}-${String(cutoff % 12 + 1).padStart(2, '0')}` : '9999-01'
    const base = reported.length ? reported : [{ status: 'planned', from: plannedFrom, basis: 'reported', source: b.sources[0] }]
    const phases = retired.length || future.length ? sortPhases([...base, ...retired, ...future]) : base
    const result = { ...b, phases, progress: undefined, customer: knownContract?.customer,
      evidenceReview: audited ? (own.length ? 'verified' : 'pending') : 'pending', targets,
      lastReported: phases.filter((p) => p.from !== '9999-01').at(-1)?.published ?? (visible ? site.as_of : null) }
    for (const field of ['it_mw', 'gross_mw']) {
      const claim = own.filter((c) => c.field === field).at(-1)
      if (claim) result[field] = claim.value
    }
    // 이 계약(NVIDIA)은 데이터센터 용량 약 60MW 만 밝혔고 IT 부하 기준인지는 명시하지 않음 → IT MW 비움
    if (audited && !own.some((c) => c.field === 'it_mw')) result.it_mw = undefined
    const unspecified = own.find((c) => c.field === 'capacity_mw')
    if (unspecified) { result.disclosedMw = unspecified.value; result.gross_mw = undefined }
    return result
  })
  const reportedPower = site.power.filter((p) => p.basis === 'reported' && isKnown(p) && toMonth(p.from, 'end') <= cutoff)
  const power = [...reportedPower, ...(forecast ? site.power.filter(isFuture) : [])] // 미래면 전력 확보·통전 목표도 이어 붙임
  return { ...site, buildings, power: power.length ? power : [{ from: site.announced, secured_mw: 0, energized_mw: 0, basis: 'reported', source: site.sources[0] }],
    _forecast: forecast, // 화면 안내용: 기준일 이후 = 회사 목표 기준 전망
    // 캠퍼스 단위 납품 주문은 계속 보여 줌 — 어느 건물로 가는지 모른다고 취소된 납품은 아님
    deliveries: site.deliveries.filter((d) => isKnown(d) && d.status !== 'done'),
    _research: research, _observed: true, _layoutSource: site,
    evidenceReview: research.auditedBuildings?.some((a) => a.site === site.id) ? 'partial' : 'pending' }
}
