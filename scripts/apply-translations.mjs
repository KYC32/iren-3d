// =============================================================
// apply-translations.mjs — 기계 번역 후보를 검사기에 통과시켜 public/data/news-ko.json 에 넣음
// -------------------------------------------------------------
// 후보: scripts/translate/translate_titles.py 의 --out 파일 { model, items: [{ id, src, ko }] }
// 검사: src/data/translateGuard.js (숫자·금액·티커·한자·길이) — 통과 = items, 탈락 = skipped(까닭과 함께)
//   탈락도 적어 둠 → 같은 제목을 매번 다시 번역하지 않음 (원문이 바뀌면 다시 함)
// news.json 에서 사라진 기사의 번역은 지워 파일이 계속 커지지 않게 함
//
// 사용법: node scripts/apply-translations.mjs /tmp/ko-raw.json
// =============================================================
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { checkTranslation } from '../src/data/translateGuard.js'
import { NewsKoFile } from '../src/data/feedSchema.js'
import { writeJsonIfChanged } from './lib/fetch-util.mjs'

const rawPath = process.argv[2]
const koUrl = fileURLToPath(new URL('../public/data/news-ko.json', import.meta.url))   // 파일 쓰기 도우미가 문자열 경로를 받음
const news = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/news.json', import.meta.url)), 'utf8'))
const prev = existsSync(koUrl) ? JSON.parse(readFileSync(koUrl, 'utf8')) : { items: {}, skipped: {} }
const raw = rawPath && existsSync(rawPath) ? JSON.parse(readFileSync(rawPath, 'utf8')) : { items: [] }

const live = new Set(news.press.items.map((i) => i.id))
const items = Object.fromEntries(Object.entries(prev.items ?? {}).filter(([id]) => live.has(id)))
const skipped = Object.fromEntries(Object.entries(prev.skipped ?? {}).filter(([id]) => live.has(id)))
// 검사기를 고치면 예전에 통과한 번역도 다시 검사 — 이제 탈락이면 skipped 로 옮김 (화면엔 원문만 보임)
//   예: 2026-10-27 고유명사 규칙을 넣자 'IREN 제한회사' 같은 옛 번역이 빠짐
let dropped = 0
for (const [id, v] of Object.entries(items)) {
  const why = checkTranslation(v.src, v.ko)
  if (why !== 'ok') { delete items[id]; skipped[id] = { src: v.src, why }; dropped++ }
}
let ok = 0, bad = 0
for (const c of raw.items ?? []) {
  const why = checkTranslation(c.src, c.ko)
  delete items[c.id]; delete skipped[c.id]
  if (why === 'ok') { items[c.id] = { src: c.src, ko: c.ko }; ok++ }
  else { skipped[c.id] = { src: c.src, why }; bad++ }
}
const out = NewsKoFile.parse({
  schema_version: 1,
  model: raw.model ?? prev.model ?? 'kakaocorp/kanana-1.5-2.1b-instruct-2505',
  license: 'Apache-2.0',
  fetched_at: raw.items?.length ? new Date().toISOString() : prev.fetched_at ?? new Date().toISOString(),
  items, skipped,
})
const changed = writeJsonIfChanged(koUrl, out, { ignoreKeys: ['fetched_at'] })   // 번역이 그대로면 시각만 바뀌어도 쓰지 않음
console.log(`✅ news-ko.json — 새 번역 통과 ${ok} · 탈락 ${bad}${dropped ? ` · 다시 검사해 뺀 옛 번역 ${dropped}` : ''} · 모두 ${Object.keys(items).length}개 번역${changed ? '' : ' (변경 없음)'}`)
