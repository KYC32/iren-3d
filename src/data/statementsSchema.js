// =============================================================
// statementsSchema.js — data/statements.json (경영진 발언 · 약속 장부) 스키마와 규칙
// -------------------------------------------------------------
// 이 파일은 데이터 빌드(scripts)와 테스트에서만 씁니다 → 앱 첫 화면 번들에 들어가지 않음
//
// people     : 발언한 사람 (두 공동 CEO) — 사진은 IREN 홈페이지 사진, 출처(photo_source) 필수
// statements : 발언 하나하나 — 채널(X · 실적 발표 콜 · 인터뷰 · 보도자료 속 CEO 인용), 원문 주소, 한국어/영어 요약, 걸린 약속(promise)
//   원문 종류(kind): sec(SEC 녹취록) · company(회사 자료) · video(영상, 재생 시각 at 필수) · transcript(공개 녹취록) · x · article
// promises   : 기한과 대상이 분명한 약속 — 판정은 promises.js 가 계산 (여기서는 근거가 맞는지만 검사)
//   fulfilled(이룸) · reduced(회사가 목표를 줄임) · postponed(회사가 미룸) · withdrawn(철회) · progress(일부 이룸)
//   이 근거들은 회사 자료(sec.gov · iren.com · iren.gcs-web.com · globenewswire.com)만 인정
// 설계: docs/superpowers/specs/2026-10-21-ceo-statements-design.md
// =============================================================
import { z } from 'zod'
import { isCompanyUrl } from './promises.js'

const Id = z.string().regex(/^[a-z0-9-]+$/)
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const Url = z.string().url()
// 기한 글자: 2026 · 2026-H1 · 2026-Q3 · 2026-06 · 2026-06-15 · FY2026 · FY2026-H1 · FY2026-Q2
const When = z.string().regex(/^(\d{4}(-(H[12]|Q[1-4]|(0[1-9]|1[0-2])(-\d{2})?))?|FY\d{4}(-(H[12]|Q[1-4]))?)$/)
// 양: MW(전력) · GPUs(개수) · USDm(백만 달러), 앞뒤 말: about(약) · at_least(이상) · exact · up_to(최대)
const Amount = z.object({ value: z.number().positive(), unit: z.enum(['MW', 'GPUs', 'USDm']), qualifier: z.enum(['about', 'at_least', 'exact', 'up_to']) }).strict()
const Ref = { url: Url, published: Day }

const Person = z.object({
  id: Id, name: z.string(), title_ko: z.string(), title_en: z.string(),
  photo: z.string().regex(/^\/people\/[a-z0-9-]+\.jpg$/), photo_source: Url, x: Url.optional(),
}).strict()

const Statement = z.object({
  id: Id, person: Id, date: Day, channel: z.enum(['x', 'call', 'interview', 'release']), // release = 회사 보도자료 속 이름이 붙은 CEO 인용
  kind: z.enum(['sec', 'company', 'video', 'transcript', 'x', 'article']), url: Url,
  at: z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/).optional(), // 영상 재생 시각 (예: 12:34, 1:02:03)
  summary_ko: z.string(), summary_en: z.string(),
  quote: z.string().max(200).optional(),                      // 원문 짧은 인용 (한 문장)
  promise: Id.optional(),                                     // 걸린 약속 (없으면 의견)
}).strict()

const PromiseRec = z.object({
  id: Id, topic: z.enum(['capacity', 'power', 'site', 'gpu', 'contract', 'revenue']), // AI·데이터센터 약속만 (채굴 약속 없음)
  title_ko: z.string(), title_en: z.string(),
  deadline: When, target: Amount.optional(),
  reduced: z.object({ ...Ref, amount: Amount }).strict().optional(),
  postponed: z.array(z.object({ to: When, ...Ref }).strict()).optional(),
  withdrawn: z.object({ date: Day, url: Url, reason_ko: z.string(), reason_en: z.string() }).strict().optional(),
  fulfilled: z.object({ ...Ref, date: Day.optional(), period: When.optional(), amount: Amount.optional() }).strict().optional(),
  progress: z.object({ ...Ref, amount: Amount }).strict().optional(),
  milestone: Id.optional(), // research.json 의 같은 건물 일정 id (scripts/validate.mjs 가 있는지 확인)
}).strict()

export const StatementsFile = z.object({
  checkedAt: Day,          // 판정 기준일 = 원문·근거를 마지막으로 확인한 날
  since: Day,              // 시작일 (AI 전환: 2023-08-29 6-K)
  since_source: Url,
  people: z.array(Person).min(1),
  statements: z.array(Statement),
  promises: z.array(PromiseRec),
}).strict()

// 주소의 호스트가 base 이거나 그 하위 주소인가
function hostIs(url, base) {
  try { const h = new URL(url).hostname.toLowerCase(); return h === base || h.endsWith(`.${base}`) } catch { return false }
}

// 스키마 + 내용 규칙. 오류 문장 목록을 돌려줌 (없으면 빈 배열)
export function validateStatements(file) {
  const parsed = StatementsFile.safeParse(file)
  if (!parsed.success) return parsed.error.issues.slice(0, 5).map((i) => `statements.json ${i.path.join('.')}: ${i.message}`)
  const errors = []
  const err = (where, msg) => errors.push(`statements.json ${where}: ${msg}`)
  const { checkedAt, since } = file

  // id 중복 (사람·발언·약속 각각)
  for (const [name, list] of [['people', file.people], ['statements', file.statements], ['promises', file.promises]]) {
    const seen = new Set()
    for (const x of list) { if (seen.has(x.id)) err(name, `중복 id ${x.id}`); seen.add(x.id) }
  }
  if (since > checkedAt) err('since', `시작일 since(${since}) 가 checkedAt(${checkedAt}) 뒤`)

  const people = new Set(file.people.map((p) => p.id))
  const promises = new Map(file.promises.map((p) => [p.id, p]))
  // 약속마다 걸린 발언들 (시작일 전 규칙·발언 없는 약속 검사용)
  const byPromise = new Map()
  for (const s of file.statements) if (s.promise) byPromise.set(s.promise, [...(byPromise.get(s.promise) ?? []), s])

  for (const s of file.statements) {
    if (!people.has(s.person)) err(s.id, `없는 사람(person) ${s.person}`)
    if (s.promise && !promises.has(s.promise)) err(s.id, `없는 약속(promise) ${s.promise}`)
    if (s.date > checkedAt) err(s.id, `날짜 ${s.date} 가 checkedAt(${checkedAt}) 뒤`)
    if (s.kind === 'video' && !s.at) err(s.id, '영상(video)은 재생 시각(at) 필수')
    if (s.kind !== 'video' && s.at) err(s.id, '재생 시각(at)은 영상(video)에만')
    if (s.kind === 'x' && !hostIs(s.url, 'x.com') && !hostIs(s.url, 'twitter.com')) err(s.id, 'X 발언은 x.com 주소여야 함')
    if (s.kind === 'sec' && !hostIs(s.url, 'sec.gov')) err(s.id, 'SEC 발언은 sec.gov 주소여야 함')
    if (s.kind === 'company' && !isCompanyUrl(s.url)) err(s.id, '회사 발언(company)은 회사 자료 주소여야 함')
    if (s.quote && /[\r\n]/.test(s.quote)) err(s.id, '인용(quote)은 한 문장, 줄바꿈 없이')
    // 시작일 전 발언: 그 약속을 시작일 뒤에 다시 말했을 때만 ("처음 약속 (시작일 전)")
    if (s.date < since && !(byPromise.get(s.promise) ?? []).some((x) => x.date >= since)) err(s.id, `시작일 전(${since}) 발언은 시작일 뒤에 다시 말한 약속에만`)
  }

  for (const p of file.promises) {
    if (!byPromise.has(p.id)) err(p.id, '발언 없음 (약속은 발언에서 나와야 함)')
    // 근거 자료: 회사 자료만, 날짜는 확인일까지
    const refs = [['fulfilled', p.fulfilled], ['reduced', p.reduced], ['progress', p.progress], ['withdrawn', p.withdrawn],
      ...(p.postponed ?? []).map((x, i) => [`postponed.${i}`, x])].filter(([, r]) => r)
    for (const [field, r] of refs) {
      if (!isCompanyUrl(r.url)) err(p.id, `${field} 근거는 회사 자료(sec.gov · iren.com · 보도자료)만`)
      for (const d of [r.published, r.date].filter(Boolean)) if (d > checkedAt) err(p.id, `${field} 날짜 ${d} 가 checkedAt(${checkedAt}) 뒤`)
    }
    if (p.fulfilled && p.withdrawn) err(p.id, '이룸(fulfilled)과 철회(withdrawn)를 함께 둘 수 없음')
    if (p.reduced && !p.target) err(p.id, '목표 줄임(reduced)은 원래 목표(target)가 있어야')
    if (p.target && p.fulfilled && !p.fulfilled.amount) err(p.id, '숫자 약속을 이뤘으면 이룬 양(amount) 필수')
    // 양의 단위는 목표와 같아야 비교 가능
    for (const [field, a] of [['fulfilled', p.fulfilled?.amount], ['reduced', p.reduced?.amount], ['progress', p.progress?.amount]]) {
      if (a && p.target && a.unit !== p.target.unit) err(p.id, `${field} 단위(unit) ${a.unit} 가 목표 ${p.target.unit} 와 다름`)
    }
  }
  return errors
}
