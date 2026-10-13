// 주가(stock.json)·뉴스(news.json) 파일 스키마 — 스크립트가 쓰기 전, 개발 모드에서 읽은 뒤 검사
import { z } from 'zod'

const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Url = z.string().url()

export const StockFile = z.object({
  schema_version: z.literal(1),
  symbol: z.string(),
  source: z.object({ name: z.string(), url: Url, note_ko: z.string().optional() }).strict(),
  ipo: z.object({ date: Iso, price: z.number().positive() }).strict(),
  fetched_at: z.string(),
  last_date: Iso,
  columns: z.tuple([z.literal('date'), z.literal('open'), z.literal('high'), z.literal('low'), z.literal('close'), z.literal('volume')]),
  // [날짜, 시가, 고가, 저가, 종가, 거래량]
  rows: z.array(z.tuple([Iso, z.number(), z.number(), z.number(), z.number(), z.number()])).min(1),
}).strict()

const Block = (item) => z.object({
  source: z.object({ name: z.string(), url: Url, cik: z.string().optional() }).strict(),
  ok: z.boolean(),
  fetched_at: z.string().nullable(),
  error: z.string().nullable(),
  items: z.array(item),
}).strict()

export const CompanyItem = z.object({
  id: z.string(), date: Iso, report_date: Iso.nullable(), form: z.string(), items: z.array(z.string()),
  kind: z.enum(['press', 'earnings', 'filing', 'insider']),
  title: z.string(), title_from: z.enum(['exhibit', 'form']),
  url: Url, filing_url: Url,
}).strict()
export const PressItem = z.object({ id: z.string(), date: Iso, title: z.string(), link: Url, source: z.string(), source_url: z.string() }).strict()

export const NewsFile = z.object({
  schema_version: z.literal(1),
  fetched_at: z.string(),
  company: Block(CompanyItem),
  press: Block(PressItem),
}).strict()
