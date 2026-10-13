// =============================================================
// fetch-news.mjs — IREN 뉴스를 받아 public/data/news.json 에 저장
//   [회사 발표] SEC EDGAR 제출 목록 → 8-K/6-K 는 첨부 보도자료(ex99-1)에서 헤드라인을 뽑음
//   [언론]     Google 뉴스 RSS ("IREN" NASDAQ 검색)
// 사용법: node scripts/fetch-news.mjs [--max=40] [--retry-titles]
//   --max          이번 실행에서 첨부 헤드라인을 새로 조회할 최대 건수 (SEC 예의: 초당 ≤4회)
//   --retry-titles 전에 헤드라인을 못 구해 서식 이름으로 저장한 건도 다시 시도
// -------------------------------------------------------------
// 두 소스는 서로 독립: 하나가 실패해도 다른 쪽은 저장되고, 실패한 쪽은 기존 항목 유지 + ok:false 기록.
// 어떤 경우에도 종료 코드 0 (자동 갱신 실패가 배포를 막지 않게).
// =============================================================
import { fileURLToPath } from 'node:url'
import { fetchWithUa, readJsonOr, writeJsonIfChanged, sleep } from './lib/fetch-util.mjs'
import { parseRss, rssItemId, recentFilings, classifyFiling, pickExhibit, headlineFromHtml, filingTitle, filingFolder, sortNews, INCLUDE_FORMS, CIK } from '../src/data/news.js'
import { NewsFile } from '../src/data/feedSchema.js'

const OUT = fileURLToPath(new URL('../public/data/news.json', import.meta.url))
const EDGAR_URL = `https://data.sec.gov/submissions/CIK${CIK}.json`
const RSS_URL = 'https://news.google.com/rss/search?q=%22IREN%22+NASDAQ&hl=en-US&gl=US&ceid=US:en'
const MAX_PRESS = 400 // 언론 보도 보관 상한 (RSS 는 최근 ~100건만 주므로 누적 보관)
const EDGAR_HEADERS = { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' }

const arg = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt }
const now = () => new Date().toISOString()
const emptyBlock = (source) => ({ source, ok: false, fetched_at: null, error: null, items: [] })

// ---- 회사 발표 (EDGAR) ----
async function fetchCompany(prev, { max, retryTitles }) {
  const block = { ...emptyBlock({ name: 'SEC EDGAR', cik: CIK, url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${CIK}&type=&dateb=&owner=include&count=40` }), items: prev?.items ?? [] }
  const subs = await fetchWithUa(EDGAR_URL, { as: 'json', headers: EDGAR_HEADERS })
  const known = new Map(block.items.map((i) => [i.id, i]))
  const filings = recentFilings(subs).filter((f) => INCLUDE_FORMS.includes(f.form))
  // 새 제출 건 + (옵션) 헤드라인을 못 구했던 건
  const todo = filings.filter((f) => !known.has(f.accession) || (retryTitles && known.get(f.accession).title_from === 'form')).slice(0, max)
  let fetched = 0
  for (const f of todo) {
    const folder = filingFolder(f.accession)
    const kind = classifyFiling(f)
    let title = null, url = folder + f.primaryDocument
    // 8-K/6-K 만 첨부 보도자료를 찾음 (정기 보고서·Form 4 는 서식 이름으로 충분)
    if (/^(8-K|6-K)/.test(f.form)) {
      try {
        const idx = await fetchWithUa(folder + 'index.json', { as: 'json', headers: EDGAR_HEADERS }); fetched++
        const ex = pickExhibit(idx, f.primaryDocument)
        if (ex) {
          await sleep(260)
          const html = await fetchWithUa(folder + ex, { headers: { Accept: 'text/html' } }); fetched++
          title = headlineFromHtml(html)
          if (title) url = folder + ex
        }
      } catch (e) { console.warn(`  · ${f.accession} 첨부 조회 실패: ${e.message}`) }
      await sleep(260)
    }
    known.set(f.accession, {
      id: f.accession, date: f.date, report_date: f.report_date, form: f.form, items: f.items, kind,
      title: title ?? filingTitle(f), title_from: title ? 'exhibit' : 'form', url, filing_url: folder,
    })
  }
  block.items = sortNews([...known.values()])
  block.ok = true; block.fetched_at = now()
  console.log(`✅ 회사 발표: 새로 처리 ${todo.length}건 (요청 ${fetched}회), 전체 ${block.items.length}건`)
  return block
}

// ---- 언론 (Google 뉴스 RSS) ----
async function fetchPress(prev) {
  const block = { ...emptyBlock({ name: 'Google News', url: RSS_URL }), items: prev?.items ?? [] }
  const xml = await fetchWithUa(RSS_URL, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' } })
  const fresh = parseRss(xml).map((x) => ({ id: rssItemId(x.link), ...x }))
  if (!fresh.length) throw new Error('RSS 항목 0건 (형식 변경?)')
  const known = new Map(block.items.map((i) => [i.id, i]))
  for (const x of fresh) known.set(x.id, x)
  block.items = [...known.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, MAX_PRESS)
  block.ok = true; block.fetched_at = now()
  console.log(`✅ 언론: 이번 ${fresh.length}건, 보관 ${block.items.length}건`)
  return block
}

export async function fetchNews({ max = 40, retryTitles = false } = {}) {
  const prev = readJsonOr(OUT, null)
  const file = { schema_version: 1, fetched_at: now(), company: prev?.company ?? emptyBlock({ name: 'SEC EDGAR', cik: CIK, url: 'https://www.sec.gov/' }), press: prev?.press ?? emptyBlock({ name: 'Google News', url: RSS_URL }) }
  // 소스별로 따로 시도: 실패하면 그 블록은 기존 항목 유지 + ok:false, error 기록
  for (const [key, fn] of [['company', () => fetchCompany(prev?.company, { max, retryTitles })], ['press', () => fetchPress(prev?.press)]]) {
    try { file[key] = await fn() }
    catch (e) { file[key] = { ...file[key], ok: false, error: `${e.message} (${now().slice(0, 10)})` }; console.warn(`⚠️ ${key} 갱신 실패 — 기존 항목 유지: ${e.message}`) }
  }
  const parsed = NewsFile.parse(file)
  const changed = writeJsonIfChanged(OUT, parsed, { ignoreKeys: ['fetched_at'] })
  console.log(changed ? '✅ 저장 news.json' : '＝ 변경 없음 news.json')
  return parsed
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchNews({ max: Number(arg('max', 40)), retryTitles: process.argv.includes('--retry-titles') }).catch((e) => {
    console.warn(`⚠️ 뉴스 갱신 실패 — 기존 파일 유지: ${e.message}`)
    process.exit(0)
  })
}
