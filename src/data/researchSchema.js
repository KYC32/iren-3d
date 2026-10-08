// =============================================================
// researchSchema.js — 리서치 자료(research JSON)의 형식 검사 규칙
// -------------------------------------------------------------
// 출처·주장·일정·사진·위치 자료가 올바른 모양인지 zod 로 검사하고,
// 그다음 서로 이어지는 관계(없는 사이트·건물·출처를 가리키지 않는지 등)를 추가로 확인합니다.
// scripts/build-data.mjs 가 데이터를 만들 때 이 검사를 돌리고, 오류가 하나라도 있으면 빌드를 멈춥니다.
// =============================================================
import { z } from 'zod'
import { isValidWhen } from './timeline.js'
import { STATUS } from './status.js'
// id: 영문 소문자·숫자·하이픈만 (예: 'sweetwater-1')
const id = z.string().regex(/^[a-z0-9-]+$/)
// date: '2026' · '2026-Q4' · '2026-H2' · '2026-08' · '2026-08-13' 같은 날짜 형식 (timeline.js 의 isValidWhen)
const date = z.string().refine(isValidWhen)
// 어떤 출처(sources 의 id)에서 나온 정보인지 가리키는 필드 — 여러 항목에 공통으로 끼워 넣음
const sourceRef = { sourceId: id }
// 리서치 파일 전체 모양
//   sources: 출처 목록 (제목·URL·발행일·발행처·검토일)
//   claims: 사이트·건물의 상태·MW 같은 개별 주장 (근거 종류 basis, 검토 상태 review 포함)
//   milestones: 공정 일정 — 목표일이 바뀐 기록(revisions)과 실제 완료(completion)
//   media: 사진·항공사진·렌더링 (rights 가 'display' 면 화면에 직접 표시 가능)
//   locations: 사이트 위치 확인 기록 (지역 / 주소 / 시설 수준)
//   auditedBuildings: 리서치로 검토를 마친 건물 목록
export const Research = z.object({
  assessedThrough: date.optional(),
  sources: z.array(z.object({ id, title: z.string(), url: z.string().url(), published: date.nullable(), publisher: z.string(), reviewedAt: date })),
  claims: z.array(z.object({ id, site: id, building: id.optional(), field: z.enum(['status','it_mw','gross_mw','capacity_mw']), value: z.union([z.string(),z.number().nonnegative()]), basis: z.enum(['reported','target','estimate']), review: z.enum(['verified','pending','conflict']), ...sourceRef, locator: z.string(), summary_ko: z.string(), summary_en: z.string(), effective: date.optional() })),
  milestones: z.array(z.object({ id, site: id, building: id, title_ko: z.string(), title_en: z.string(), scope_ko: z.string(), scope_en: z.string(), revisions: z.array(z.object({ target: date, ...sourceRef, note_ko: z.string(), note_en: z.string() })), completion: z.object({ ...sourceRef, occurred: date.nullable() }).optional() })),
  media: z.array(z.object({ id, site: id, buildings: z.array(id), kind: z.enum(['photo','aerial','rendering']), title: z.string(), captured: date.nullable(), ...sourceRef, locator: z.string(), rights: z.enum(['display','link_only']), rightsNote: z.string(), rightsBasis: z.string().optional(), assetSource: z.string().url().optional(), identification: z.string(), thumbnail: z.string().optional(), full: z.string().optional() })),
  locations: z.array(z.object({ site: id, level: z.enum(['region','address','facility']), review: z.enum(['verified','pending','conflict']), reviewedAt: date, source: z.string().url(), note_ko: z.string(), note_en: z.string(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })),
  auditedBuildings: z.array(z.object({ site: id, building: id })),
})
// research: 리서치 자료, sites: 사이트 목록 → 오류 문장 배열을 돌려줌 (빈 배열이면 통과)
export function validateResearch(research, sites) {
  // 1단계: 모양 검사. 여기서 틀리면 뒤 검사는 의미가 없으니 바로 돌려줌
  const parsed = Research.safeParse(research)
  if (!parsed.success) return parsed.error.issues.map((i) => `research ${i.path.join('.')}: ${i.message}`)
  // 2단계: 관계 검사. sources 는 id 로 빨리 찾으려고 Map 으로 만들어 둠
  const errors = [], sources = new Map(research.sources.map((s) => [s.id,s]))
  // 목록마다 id 가 겹치지 않는지 (Set 으로 중복을 없앤 개수 ≠ 원래 개수면 중복)
  for (const list of [research.sources,research.claims,research.milestones,research.media]) if (new Set(list.map((x) => x.id)).size !== list.length) errors.push('research: duplicate id')
  // 가리키는 사이트가 실제로 있는지, 그 사이트에 해당 건물(building 하나 또는 buildings 목록)이 있는지
  const check = (x) => { const s = sites.find((s) => s.id === x.site); if (!s) errors.push(`research: unknown site ${x.site}`); for (const b of x.building ? [x.building] : x.buildings ?? []) if (!s?.buildings.some((v) => v.id === b)) errors.push(`research: unknown building ${b}`) }
  for (const x of [...research.claims,...research.milestones,...research.media,...research.locations,...research.auditedBuildings]) check(x)
  // sourceId 가 실제 출처를 가리키는지 (주장·사진·일정 변경 기록·완료 기록 모두)
  for (const x of [...research.claims,...research.media,...research.milestones.flatMap((m) => [...m.revisions,...(m.completion ? [m.completion] : [])])]) if (!sources.has(x.sourceId)) errors.push(`research: missing source ${x.sourceId}`)
  // 화면에 표시할 사진('display')은 썸네일과 원본 파일이 둘 다 있어야 함
  // 상태(status) claim 의 값은 정해진 상태 이름만 — 오타('operatng' 등)가 화면에 그대로 나가지 않게
  const known = new Set([...STATUS, 'retired'])
  for (const c of research.claims) if (c.field === 'status' && !known.has(c.value)) errors.push(`research: unknown status ${c.value} (${c.id})`)
  for (const p of research.media) if (p.rights === 'display' && (!p.thumbnail || !p.full)) errors.push(`research: display media ${p.id} needs thumbnail and full asset`)
  // 확인된(verified) 주소·시설 수준 위치에는 위도·경도가 꼭 있어야 함 (지역 수준은 좌표 없어도 됨)
  for (const l of research.locations) if (l.review === 'verified' && l.level !== 'region' && (l.lat == null || l.lng == null)) errors.push(`research: verified location ${l.site} needs coordinates`)
  // 일정 변경 기록은 출처 발행일 순서대로 적혀 있어야 함 (앞 기록보다 이른 날짜가 뒤에 오면 오류)
  for (const m of research.milestones) { const dates=m.revisions.map((r)=>sources.get(r.sourceId)?.published); if (dates.some((d,i)=>i>0&&d<dates[i-1])) errors.push(`research: revisions out of order ${m.id}`) }
  return errors
}
