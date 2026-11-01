// =============================================================
// marketSchema.js — 주가 페이지 시장 칸 파일 스키마
// -------------------------------------------------------------
//   MovesFile  : data/stock-moves.json — 큰 변동일의 까닭을 사람이 옮긴 것 (보도 기준, 원인 단정 아님)
//   PeersFile  : public/data/peers.json — 다른 회사 종가 (scripts/fetch-market.mjs 가 매일 씀)
//   ShortFile  : public/data/short.json — 공매도 잔고 (같은 스크립트)
// 주가 페이지(나중에 불러오는 코드)·스크립트·시험만 씀 → 첫 화면 번들에 들어가지 않음
// =============================================================
import { z } from 'zod'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const Url = z.string().url()

const Note = z.object({
  date: Day,                                 // 거래일 (미국 동부)
  scope: z.enum(['company', 'sector']),      // company = IREN 자체 소식 · sector = 업계·시장 전체 소식
  ko: z.string().max(140),                   // 한글 문구 규칙: 140자 이하
  en: z.string(),
  source: Url,
  source_name: z.string(),
}).strict()

export const MovesFile = z.object({
  checked: Day,                              // 사람이 마지막으로 확인한 날
  notes: z.array(Note),
}).strict()

export function validateMoves(file) {
  const parsed = MovesFile.safeParse(file)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  const seen = new Set(), errors = []
  for (const n of file.notes) {
    if (seen.has(n.date)) errors.push(`같은 날짜가 두 번: ${n.date}`)
    seen.add(n.date)
  }
  return errors
}

export const PeersFile = z.object({
  fetched_at: z.string(),
  source: z.object({ name: z.string(), url: Url }).strict(),
  symbols: z.array(z.object({
    symbol: z.string(), name: z.string(),
    rows: z.array(z.tuple([Day, z.number()])),   // [날짜, 종가]
  }).strict()),
}).strict()

export const ShortFile = z.object({
  fetched_at: z.string(),
  source: z.object({ name: z.string(), url: Url }).strict(),
  rows: z.array(z.object({ date: Day, shares: z.number().positive(), avg_volume: z.number().nonnegative(), days_to_cover: z.number().nonnegative() }).strict()).min(1),
}).strict()
