// =============================================================
// apply-translations.mjs — 기계 번역 후보·뜻 판정 점수를 검사기에 통과시켜 public/data/news-ko.json 에 넣음
// -------------------------------------------------------------
// 후보: scripts/translate/translate_titles.py 의 --out 파일 { model, items: [{ id, src, ko }] }
// 판정: scripts/translate/judge_titles.py 의 --out 파일 { model, scores: { id: 0~1 } } (--judge 로 넘김)
// 검사: src/data/translateGuard.js checkCandidate (숫자·금액·티커·한자·이름·길이 규칙 + 뜻 판정 점수)
//   통과 = items(판정 점수가 있으면 judge 도 적음), 탈락 = skipped(까닭과 함께)
//   탈락도 적어 둠 → 같은 제목을 매번 다시 번역하지 않음 (원문이 바뀌면 다시 함)
// 대상: 언론 제목 (회사 발표 헤드라인은 번역하지 않음 — translate_titles.py 설명) — news.json 에서 사라진 기사의 번역은 지움
//
// 사용법: node scripts/apply-translations.mjs [/tmp/ko-raw.json] [--judge /tmp/judge.json]
// =============================================================
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { checkCandidate } from '../src/data/translateGuard.js'
import { NewsKoFile } from '../src/data/feedSchema.js'
import { writeJsonIfChanged } from './lib/fetch-util.mjs'

const args = process.argv.slice(2)
const judgeAt = args.indexOf('--judge')
const judgePath = judgeAt >= 0 ? args[judgeAt + 1] : null
const rawPath = args.find((a, i) => !a.startsWith('--') && (judgeAt < 0 || i !== judgeAt + 1))   // --judge 다음 칸은 판정 파일
const koUrl = fileURLToPath(new URL('../public/data/news-ko.json', import.meta.url))   // 파일 쓰기 도우미가 문자열 경로를 받음
const news = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/news.json', import.meta.url)), 'utf8'))
const prev = existsSync(koUrl) ? JSON.parse(readFileSync(koUrl, 'utf8')) : { items: {}, skipped: {} }
const raw = rawPath && existsSync(rawPath) ? JSON.parse(readFileSync(rawPath, 'utf8')) : { items: [] }
const judged = judgePath && existsSync(judgePath) ? JSON.parse(readFileSync(judgePath, 'utf8')) : null

const live = new Set(news.press.items.map((i) => i.id))
const items = Object.fromEntries(Object.entries(prev.items ?? {}).filter(([id]) => live.has(id)))
const skipped = Object.fromEntries(Object.entries(prev.skipped ?? {}).filter(([id]) => live.has(id)))
// 뜻 판정 점수를 붙임 (그 사이 번역이 바뀐 것은 judge_titles 가 본 것이 아니므로 건너뜀 — 다음 판정 때 다시)
let scored = 0
for (const [id, score] of Object.entries(judged?.scores ?? {})) if (items[id]) { items[id] = { ...items[id], judge: score }; scored++ }
// 검사기를 고치거나 점수가 붙으면 예전에 통과한 번역도 다시 검사 — 이제 탈락이면 skipped 로 옮김 (화면엔 원문만 보임)
//   예: 2026-10-27 고유명사 규칙을 넣자 'IREN 제한회사' 같은 옛 번역이 빠짐 · 2026-10-28 뜻 판정 점수가 낮은 번역이 빠짐
let dropped = 0
for (const [id, v] of Object.entries(items)) {
  const why = checkCandidate(v)
  if (why !== 'ok') { delete items[id]; skipped[id] = { src: v.src, why }; dropped++ }
}
let ok = 0, bad = 0
for (const c of raw.items ?? []) {
  if (!live.has(c.id)) continue
  const why = checkCandidate(c)
  delete items[c.id]; delete skipped[c.id]
  if (why === 'ok') { items[c.id] = { src: c.src, ko: c.ko }; ok++ }   // 새 번역은 아직 판정 전 (judge 없음)
  else { skipped[c.id] = { src: c.src, why }; bad++ }
}
const out = NewsKoFile.parse({
  schema_version: 1,
  model: raw.model ?? prev.model ?? 'kakaocorp/kanana-1.5-2.1b-instruct-2505',
  license: 'Apache-2.0',
  judge_model: judged?.model ?? prev.judge_model,
  fetched_at: raw.items?.length || scored ? new Date().toISOString() : prev.fetched_at ?? new Date().toISOString(),
  items, skipped,
})
const changed = writeJsonIfChanged(koUrl, out, { ignoreKeys: ['fetched_at'] })   // 번역이 그대로면 시각만 바뀌어도 쓰지 않음
const waiting = Object.values(items).filter((v) => v.judge == null).length
console.log(`✅ news-ko.json — 새 번역 통과 ${ok} · 탈락 ${bad}${scored ? ` · 판정 점수 ${scored}` : ''}${dropped ? ` · 다시 검사해 뺀 번역 ${dropped}` : ''} · 모두 ${Object.keys(items).length}개 번역${waiting ? ` (판정 전 ${waiting})` : ''}${changed ? '' : ' (변경 없음)'}`)
