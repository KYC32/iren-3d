// 주가(stock.json)·뉴스(news.json) 불러오기 — loadSites 와 같은 패턴 (개발 모드에서만 스키마 검사)
import { StockFile, NewsFile } from './feedSchema.js'

async function loadJson(path, schema) {
  const res = await fetch(path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  const json = await res.json()
  if (import.meta.env.DEV) {
    const r = schema.safeParse(json)
    if (!r.success) throw new Error(`${path} 스키마 오류: ${r.error.issues[0]?.path.join('.')} — ${r.error.issues[0]?.message}`)
  }
  return json
}
export const loadStock = () => loadJson('/data/stock.json', StockFile)
export const loadNews = () => loadJson('/data/news.json', NewsFile)
