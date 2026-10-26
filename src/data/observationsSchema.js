// =============================================================
// observationsSchema.js — data/observations.json (현장 관찰 · 설비 이중화) 스키마와 규칙
// -------------------------------------------------------------
// 이 파일은 데이터 빌드(scripts)와 테스트에서만 씁니다 → 앱 첫 화면 번들에 들어가지 않음
//
// facilities: 전력·통신 이중화 항목 (변전소·광케이블·변압기·발전기·UPS)
//   basis: reported = 회사 자료(홈페이지·공시), observed = 제3자 현장 관찰(드론·열화상 등)
// progress  : 홀·세그먼트 진척 (제3자 관찰) — 공식 상태(건설·가동)는 바꾸지 않고 근거로만 보여 줌
//   (채용 선행지표와 같은 원칙: 회사 자료로 확인되지 않은 사실은 "추정 근거"로만)
// =============================================================
import { z } from 'zod'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const Url = z.string().url()

const Facility = z.object({
  site: z.string(),
  item: z.enum(['substation', 'fiber', 'transformers', 'generators', 'ups']),
  basis: z.enum(['reported', 'observed']),
  label_ko: z.string(),
  label_en: z.string(),
  source: Url,
  date: Day.optional(),       // 관찰한 날 (observed 면 필수)
  published: Day.optional(),  // 공개(게시)된 날 — 지나간 달 화면에서는 이날 이후에만 보임
  by: z.string().optional(),  // 관찰한 사람·매체 (observed 면 필수)
  checked: Day.optional(),    // 회사 페이지를 확인한 날 (reported)
}).strict()

const Hall = z.object({
  name: z.string(),
  pads: z.number().int().nonnegative(),          // 콘크리트 패드
  mer: z.number().int().nonnegative(),           // 전기실(MER)
  transformers: z.number().int().nonnegative(),  // 34.5kV → 480V 변압기
  generators: z.number().int().nonnegative(),    // 2.5MW 디젤 발전기
  ats: z.number().int().nonnegative(),           // 자동 전환 스위치·배전반
  cabling: z.enum(['none', 'pulled', 'terminated']),
}).strict()

const Progress = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  site: z.string(),
  building: z.string().optional(),
  method: z.enum(['drone', 'thermal', 'photo', 'permit']),   // permit = 정부 허가 기록 (EPA ECHO 등) — 회사 발표 아님, 관찰과 같은 등급
  date: Day,
  published: Day,
  by: z.string(),
  source: Url,
  segments_per_hall: z.number().int().positive().optional(),
  segment_mw: z.number().positive().optional(),
  halls: z.array(Hall).optional(),
  figure: z.enum(['power-block', 'horizon-hall', 'sweetwater-1']).optional(),   // 이 관찰 칸에서 열 그림 (public/figures/<이름>.<ko|en>.html — scripts/anatomy/power 가 만듦)
  note_ko: z.string(),
  note_en: z.string(),
}).strict()

export const ObservationsFile = z.object({
  checked: Day,
  about_ko: z.string(),
  about_en: z.string(),
  facilities: z.array(Facility),
  progress: z.array(Progress),
}).strict()

// 스키마 + 내용 규칙. 오류 문장 목록을 돌려줌 (없으면 빈 배열)
export function validateObservations(file, sites) {
  const parsed = ObservationsFile.safeParse(file)
  if (!parsed.success) return parsed.error.issues.slice(0, 5).map((i) => `observations.json ${i.path.join('.')}: ${i.message}`)
  const errors = []
  const site = (id) => sites.find((s) => s.id === id)
  for (const f of file.facilities) {
    if (!site(f.site)) errors.push(`observations.json facilities: 없는 사이트 ${f.site}`)
    if (f.basis === 'observed' && (!f.date || !f.published || !f.by)) errors.push(`observations.json facilities ${f.site}/${f.item}: 제3자 관찰은 date·published·by 필수`)
    if (f.date && f.published && f.published < f.date) errors.push(`observations.json facilities ${f.site}/${f.item}: 게시일이 관찰일보다 빠름`)
  }
  const ids = new Set()
  for (const p of file.progress) {
    if (ids.has(p.id)) errors.push(`observations.json progress: id 중복 ${p.id}`)
    ids.add(p.id)
    const s = site(p.site)
    if (!s) { errors.push(`observations.json progress ${p.id}: 없는 사이트 ${p.site}`); continue }
    if (p.building && !s.buildings.some((b) => b.id === p.building)) errors.push(`observations.json progress ${p.id}: 없는 건물 ${p.building}`)
    if (p.published < p.date) errors.push(`observations.json progress ${p.id}: 게시일이 관찰일보다 빠름`)
    for (const h of p.halls ?? []) {
      const n = p.segments_per_hall ?? 0
      for (const k of ['pads', 'mer', 'transformers', 'generators', 'ats']) if (h[k] > n) errors.push(`observations.json progress ${p.id} 홀 ${h.name}: ${k} ${h[k]} > 세그먼트 ${n}`)
    }
  }
  return errors
}
