// =============================================================
// sharesSchema.js — data/shares.json (발행 주식 수 · 주식 조달 · 전환사채) 스키마
// -------------------------------------------------------------
// 모든 숫자는 SEC 공시(424B4·20-F·10-K·10-Q 표지와 본문)에서 옮기고 원문 주소를 붙임
//   points  : 시점별 발행 주식 수 (auto: true = 매일 갱신 스크립트가 SEC XBRL 표지 값에서 덧붙인 것)
//   raises  : 주식으로 조달한 돈 (ATM 프로그램·직접 공모)
//   converts: 전환사채 (원금·최초 전환가) — 전환 시 주식 수는 화면에서 단순 계산(추정)으로 표시
//   loans   : 장비 담보 금융 (주식이 늘지 않는 조달, 주요 건만)
// 주가 페이지(나중에 불러오는 코드)·데이터 빌드·테스트만 씀 → 첫 화면 번들에 들어가지 않음
// =============================================================
import { z } from 'zod'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const Url = z.string().url()

const Point = z.object({
  date: Day,
  shares: z.number().int().positive(),
  form: z.string().optional(),               // 424B4 · 20-F · 10-K · 10-Q
  kind: z.enum(['filed', 'calc']).optional(), // calc = 공시 숫자로 계산한 값 (상장 직후)
  source: Url,
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
  auto: z.boolean().optional(),
}).strict()

const Raise = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['atm', 'direct']),
  label_ko: z.string(),
  label_en: z.string(),
  from: Day.optional(),
  until: z.string(),                          // 누적 기준일 (YYYY-MM 또는 YYYY-MM-DD)
  shares: z.number().int().positive(),
  gross_usd: z.number().positive().optional(), // 없으면 주식 수 × 주당 가격으로 계산
  price_usd: z.number().positive().optional(),
  limit_usd: z.number().positive().optional(), // ATM 한도
  source: Url,
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
}).strict()

const Convert = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label_ko: z.string(),
  label_en: z.string(),
  issued: Day,
  maturity: Day,
  coupon_pct: z.number().nonnegative(),
  principal_usd: z.number().positive(),
  conversion_price_usd: z.number().positive(),
  as_of: Day,
  source: Url,
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
}).strict()

// 장비 담보 금융 — 주식이 늘지 않는 조달 (주요 건만 사람이 옮김)
const Loan = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label_ko: z.string(),
  label_en: z.string(),
  date: z.string(),                           // YYYY-MM 또는 YYYY-MM-DD
  amount_usd: z.number().positive(),
  about: z.boolean().optional(),              // true = 회사가 "약"이라고 적은 금액
  rate_ko: z.string(),
  rate_en: z.string(),
  source: Url,
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
}).strict()

export const SharesFile = z.object({
  checked: Day,
  note_ko: z.string(),
  note_en: z.string(),
  points: z.array(Point).min(1),
  raises: z.array(Raise),
  converts: z.array(Convert),
  loans: z.array(Loan).optional(),
}).strict()

// 스키마 + 순서 규칙. 오류 문장 목록 (없으면 빈 배열)
export function validateShares(file) {
  const r = SharesFile.safeParse(file)
  if (!r.success) return r.error.issues.slice(0, 5).map((i) => `shares.json ${i.path.join('.')}: ${i.message}`)
  const errors = []
  const dates = file.points.map((p) => p.date)
  if (dates.join() !== [...dates].sort().join()) errors.push('shares.json points: 날짜 순서대로 적어야 함')
  if (new Set(dates).size !== dates.length) errors.push('shares.json points: 같은 날짜가 두 번')
  return errors
}
