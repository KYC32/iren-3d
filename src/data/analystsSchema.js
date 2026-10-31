// =============================================================
// analystsSchema.js — data/analysts.json (증권사 투자의견) 스키마
// -------------------------------------------------------------
//   consensus : Nasdaq 합의 의견·목표가 (scripts/fetch-analysts.mjs 가 매일 바꿈)
//   firms     : 증권사별 최근 의견 한 줄씩 (MarketBeat 표를 사람이 옮김 — firms_source)
//   coverage  : 회사 IR 페이지의 담당 증권사 명단 (회사 표기 그대로)
//   earnings  : 다음 실적 매출 예상 (날짜가 지나면 화면에서 숨김)
// 애널리스트 개인 이름은 넣지 않음 — 회사 이름만 (strict 라 다른 칸은 스키마가 거절)
// 주가 페이지(나중에 불러오는 코드)·데이터 빌드·시험만 씀 → 첫 화면 번들에 들어가지 않음
// =============================================================
import { z } from 'zod'
import { ratingBucket } from './analysts.js'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const Url = z.string().url()
const Usd = z.number().positive()
const Link = z.object({ name: z.string(), url: Url }).strict()

const Firm = z.object({
  firm: z.string(),                       // 표에 보이는 증권사 이름
  ir_name: z.string().optional(),         // 회사 IR 명단의 표기 (명단과 짝을 맞출 때 씀)
  date: Day,                              // 의견을 낸 날
  action: z.enum(['initiated', 'reiterated', 'upgrade', 'downgrade', 'target-up', 'target-down', 'target-set']),
  rating: z.string().nullable(),          // 증권사가 쓴 표현 그대로 (Buy·Outperform·Neutral…), 모르면 null
  rating_prev: z.string().optional(),
  target: Usd.optional(),                 // 목표가 (달러)
  target_prev: Usd.optional(),
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
}).strict()

export const AnalystsFile = z.object({
  checked: Day,                           // 증권사별 표를 사람이 확인한 날
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
  consensus: z.object({
    source: Link,
    fetched_at: z.string(),
    mean_rating: z.string().nullable(),
    low: Usd, high: Usd, mean: Usd,
    buy: z.number().int().nonnegative(),
    hold: z.number().int().nonnegative(),
    sell: z.number().int().nonnegative(),
  }).strict(),
  firms_source: Link,
  coverage: z.object({ checked: Day, source: Url, firms: z.array(z.string()) }).strict(),
  earnings: z.object({ date: Day, revenue_usd: Usd, source_name: z.string(), source: Url }).strict().optional(),
  firms: z.array(Firm),
}).strict()

// 파일 전체 검사 → 오류 문장 목록 (빌드·갱신 스크립트·시험이 씀)
export function validateAnalysts(file) {
  const r = AnalystsFile.safeParse(file)
  if (!r.success) return r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  const errors = []
  for (const f of file.firms) {
    if (f.rating != null && !ratingBucket(f.rating)) errors.push(`${f.firm}: 모르는 의견 표현 '${f.rating}' — ratingBucket 에 넣을 것`)
    if (f.ir_name && !file.coverage.firms.includes(f.ir_name)) errors.push(`${f.firm}: 회사 명단에 없는 이름 '${f.ir_name}'`)
  }
  return errors
}
