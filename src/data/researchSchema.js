import { z } from 'zod'
import { isValidWhen } from './timeline.js'
const id = z.string().regex(/^[a-z0-9-]+$/)
const date = z.string().refine(isValidWhen)
const sourceRef = { sourceId: id }
export const Research = z.object({
  assessedThrough: date.optional(),
  sources: z.array(z.object({ id, title: z.string(), url: z.string().url(), published: date.nullable(), publisher: z.string(), reviewedAt: date })),
  claims: z.array(z.object({ id, site: id, building: id.optional(), field: z.enum(['status','it_mw','gross_mw','capacity_mw']), value: z.union([z.string(),z.number().nonnegative()]), basis: z.enum(['reported','target','estimate']), review: z.enum(['verified','pending','conflict']), ...sourceRef, locator: z.string(), summary_ko: z.string(), summary_en: z.string(), effective: date.optional() })),
  milestones: z.array(z.object({ id, site: id, building: id, title_ko: z.string(), title_en: z.string(), scope_ko: z.string(), scope_en: z.string(), revisions: z.array(z.object({ target: date, ...sourceRef, note_ko: z.string(), note_en: z.string() })), completion: z.object({ ...sourceRef, occurred: date.nullable() }).optional() })),
  media: z.array(z.object({ id, site: id, buildings: z.array(id), kind: z.enum(['photo','aerial','rendering']), title: z.string(), captured: date.nullable(), ...sourceRef, locator: z.string(), rights: z.enum(['display','link_only']), rightsNote: z.string(), rightsBasis: z.string().optional(), assetSource: z.string().url().optional(), identification: z.string(), thumbnail: z.string().optional(), full: z.string().optional() })),
  locations: z.array(z.object({ site: id, level: z.enum(['region','address','facility']), review: z.enum(['verified','pending','conflict']), reviewedAt: date, source: z.string().url(), note_ko: z.string(), note_en: z.string(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })),
  auditedBuildings: z.array(z.object({ site: id, building: id })),
})
export function validateResearch(research, sites) {
  const parsed = Research.safeParse(research)
  if (!parsed.success) return parsed.error.issues.map((i) => `research ${i.path.join('.')}: ${i.message}`)
  const errors = [], sources = new Map(research.sources.map((s) => [s.id,s]))
  for (const list of [research.sources,research.claims,research.milestones,research.media]) if (new Set(list.map((x) => x.id)).size !== list.length) errors.push('research: duplicate id')
  const check = (x) => { const s = sites.find((s) => s.id === x.site); if (!s) errors.push(`research: unknown site ${x.site}`); for (const b of x.building ? [x.building] : x.buildings ?? []) if (!s?.buildings.some((v) => v.id === b)) errors.push(`research: unknown building ${b}`) }
  for (const x of [...research.claims,...research.milestones,...research.media,...research.locations,...research.auditedBuildings]) check(x)
  for (const x of [...research.claims,...research.media,...research.milestones.flatMap((m) => [...m.revisions,...(m.completion ? [m.completion] : [])])]) if (!sources.has(x.sourceId)) errors.push(`research: missing source ${x.sourceId}`)
  for (const p of research.media) if (p.rights === 'display' && (!p.thumbnail || !p.full)) errors.push(`research: display media ${p.id} needs thumbnail and full asset`)
  for (const l of research.locations) if (l.review === 'verified' && l.level !== 'region' && (l.lat == null || l.lng == null)) errors.push(`research: verified location ${l.site} needs coordinates`)
  for (const m of research.milestones) { const dates=m.revisions.map((r)=>sources.get(r.sourceId)?.published); if (dates.some((d,i)=>i>0&&d<dates[i-1])) errors.push(`research: revisions out of order ${m.id}`) }
  return errors
}
