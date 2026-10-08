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
    // Undated website imagery becomes visible only from the month we observed it.
    // This is not evidence that it was publicly available in earlier periods.
    && (() => { const source = sourceById(research, p.sourceId); return source && toMonth(source.published ?? source.reviewedAt, 'end') <= month })())
}
// Date intervals preserve disclosure precision; a reporting date is not an occurrence date.
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
// Preserve legacy source data for the record/forecast view. The investor view only advances on reported evidence.
export function observedSiteAt(site, research, month, companies) {
  const sourceForUrl = (url) => research.sources.find((s) => s.url === url)
  const cutoff = Math.min(month, toMonth(site.as_of, 'end'))
  const isKnown = (p) => {
    const source = sourceForUrl(p.source)
    return toMonth(p.published ?? source?.published ?? site.as_of, 'end') <= cutoff
  }
  const claims = claimsAt(research, site.id, cutoff)
  const buildings = site.buildings.map((b) => {
    const own = claims.filter((c) => c.building === b.id)
    const audited = research.auditedBuildings?.some((a) => a.site === site.id && a.building === b.id)
    const statusClaims = own.filter((c) => c.field === 'status' && (c.basis === 'reported' || c.value === 'planned'))
    const reported = audited ? statusClaims.map((c) => ({ status: c.value, from: c.effective ?? sourceById(research, c.sourceId).published,
      basis: 'reported', source: sourceById(research, c.sourceId).url, published: sourceById(research, c.sourceId).published }))
      : b.phases.filter((p) => p.basis === 'reported' && isKnown(p) && toMonth(p.from, 'end') <= cutoff)
    const knownContract = companies.flatMap((c) => c.contracts ?? []).find((c) => c.sites.includes(site.id) && c.buildings?.includes(b.id)
      && toMonth(c.published ?? c.signed, 'end') <= cutoff)
    const targets = b.phases.filter((p) => p.basis === 'target' && isKnown(p))
    const visible = reported.length > 0 || knownContract || targets.length > 0
    const phases = reported.length ? reported : [{ status: 'planned', from: visible ? `${Math.floor(cutoff / 12)}-${String(cutoff % 12 + 1).padStart(2, '0')}` : '9999-01', basis: 'reported', source: b.sources[0] }]
    const result = { ...b, phases, progress: undefined, customer: knownContract?.customer,
      evidenceReview: audited ? (own.length ? 'verified' : 'pending') : 'pending', targets,
      lastReported: phases.filter((p) => p.from !== '9999-01').at(-1)?.published ?? (visible ? site.as_of : null) }
    for (const field of ['it_mw', 'gross_mw']) {
      const claim = own.filter((c) => c.field === field).at(-1)
      if (claim) result[field] = claim.value
    }
    // This contract discloses ~60 MW data-center capacity, not an explicit IT-load figure.
    if (audited && !own.some((c) => c.field === 'it_mw')) result.it_mw = undefined
    const unspecified = own.find((c) => c.field === 'capacity_mw')
    if (unspecified) { result.disclosedMw = unspecified.value; result.gross_mw = undefined }
    return result
  })
  const power = site.power.filter((p) => p.basis === 'reported' && isKnown(p) && toMonth(p.from, 'end') <= cutoff)
  return { ...site, buildings, power: power.length ? power : [{ from: site.announced, secured_mw: 0, energized_mw: 0, basis: 'reported', source: site.sources[0] }],
    // Campus-level orders remain visible; a missing building link is not a cancelled delivery.
    deliveries: site.deliveries.filter((d) => isKnown(d) && d.status !== 'done'),
    _research: research, _observed: true, _layoutSource: site,
    evidenceReview: research.auditedBuildings?.some((a) => a.site === site.id) ? 'partial' : 'pending' }
}
