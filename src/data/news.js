// =============================================================
// news.js — 뉴스 데이터 순수 함수 (스크립트·화면·테스트 공용, 외부 라이브러리 없음)
// -------------------------------------------------------------
//   parseRss         : Google 뉴스 RSS XML → [{title, link, date, source, source_url}]
//   rssItemId        : 링크 → 짧은 고유 id ('gn:' + FNV-1a 해시)
//   recentFilings    : EDGAR submissions JSON(열별 배열) → 제출 건 객체 배열
//   classifyFiling   : 제출 서식·항목 코드 → 보도자료 / 실적·보고서 / 공시 / 내부자
//   pickExhibit      : 제출 폴더 index.json → 보도자료 첨부(ex99-1.htm) 파일명
//   headlineFromHtml : 첨부 HTML → 헤드라인 한 줄
//   filingTitle      : 헤드라인이 없을 때 서식 이름으로 만든 기본 제목
//   sortNews         : 날짜 내림차순 + 같은 날이면 보도자료 먼저
// =============================================================

export const CIK = '0001878848'
export const EDGAR_BASE = `https://www.sec.gov/Archives/edgar/data/${Number(CIK)}`

// ---- 공통 ----
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, k) => ENTITIES[k])
}
const stripCdata = (s) => String(s ?? '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)); return m ? decodeEntities(stripCdata(m[1])).trim() : '' }
export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
// RFC 822 ('Mon, 12 Oct 2026 10:20:41 GMT') → '2026-10-12' (UTC 기준)
export function isoFromRfc822(s) {
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

// ---- Google 뉴스 RSS ----
export function parseRss(xml) {
  const items = String(xml ?? '').match(/<item>[\s\S]*?<\/item>/g) ?? []
  return items.map((it) => {
    const srcMatch = it.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/)
    const source = srcMatch ? decodeEntities(srcMatch[2]).trim() : ''
    let title = tag(it, 'title')
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)) // 구글이 붙이는 " - 매체명" 제거
    return { title, link: tag(it, 'link'), date: isoFromRfc822(tag(it, 'pubDate')), source, source_url: srcMatch?.[1] ? decodeEntities(srcMatch[1]) : '' }
  }).filter((x) => x.title && x.link && x.date)
}
// FNV-1a 32비트 해시 (node·브라우저 공용, crypto 불필요)
export function rssItemId(link) {
  let h = 0x811c9dc5
  for (const ch of String(link)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return 'gn:' + h.toString(16).padStart(8, '0')
}

// ---- SEC EDGAR ----
// 뉴스로 볼 서식만 (주주 보고서·임원 거래 포함). S-8·424B·13G 같은 발행·지분 공시는 제외
export const INCLUDE_FORMS = ['8-K', '8-K/A', '6-K', '6-K/A', '10-K', '10-K/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '4']
export const KIND_LABEL = {
  press: { ko: '보도자료', en: 'Press release' },
  earnings: { ko: '실적·보고서', en: 'Earnings / report' },
  filing: { ko: '공시', en: 'Filing' },
  insider: { ko: '내부자 거래', en: 'Insider' },
}
const KIND_ORDER = { press: 0, earnings: 1, filing: 2, insider: 3 }

// 서식(form)과 8-K 항목 코드(items)로 종류 결정
//   10-K/10-Q/20-F = 정기 보고서 → earnings,  Form 4 = 임원·대주주 거래 → insider
//   8-K/6-K: 2.02(실적 발표) → earnings, 1.01(중요 계약)·7.01(Reg FD)·8.01(기타 사건) → press, 그 밖(5.02 임원 변경 등) → filing
export function classifyFiling({ form, items = [] }) {
  const f = String(form).replace(/\/A$/, '')
  if (f === '4') return 'insider'
  if (['10-K', '10-Q', '20-F'].includes(f)) return 'earnings'
  const codes = Array.isArray(items) ? items : String(items).split(',').map((s) => s.trim()).filter(Boolean)
  if (codes.includes('2.02')) return 'earnings'
  if (codes.some((c) => ['1.01', '7.01', '8.01'].includes(c))) return 'press'
  if (f === '6-K' && codes.length === 0) return 'press' // 2024년까지의 6-K 는 항목 코드가 없음 — 대부분 보도자료 첨부
  return 'filing'
}

// submissions JSON 의 filings.recent (열마다 배열) → 행 객체 배열 (최신순 유지)
export function recentFilings(submissions) {
  const r = submissions?.filings?.recent ?? {}
  const n = r.accessionNumber?.length ?? 0
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({
      accession: r.accessionNumber[i], form: r.form[i], date: r.filingDate[i], report_date: r.reportDate?.[i] || null,
      primaryDocument: r.primaryDocument?.[i] ?? '', description: r.primaryDocDescription?.[i] ?? '',
      items: String(r.items?.[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    })
  }
  return out
}
export const filingFolder = (accession) => `${EDGAR_BASE}/${String(accession).replace(/-/g, '')}/`

// 제출 폴더의 파일 목록(index.json) → 보도자료 첨부 파일명. ex99-1 (또는 ex99_1·ex991) 우선, 없으면 ex99 로 시작하는 첫 .htm
export function pickExhibit(indexJson) {
  const names = (indexJson?.directory?.item ?? []).map((i) => i.name).filter((n) => /\.htm$/i.test(n))
  const ex99 = names.filter((n) => /ex[-_]?99/i.test(n))
  return ex99.find((n) => /ex[-_]?99[-_.]?1\b/i.test(n)) ?? ex99[0] ?? null
}

// 첨부 HTML → 헤드라인: 태그 제거 후 "Exhibit 99.1" 같은 머리말을 건너뛰고 첫 의미 있는 줄 (최대 160자)
export function headlineFromHtml(html) {
  const text = String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const lines = decodeEntities(text).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const skip = /^(exhibit\s*99|ex-?99|press release|news release|for immediate release)/i
  const line = lines.find((l) => l.length >= 10 && !skip.test(l) && !/^\(?[A-Z]{3,6}:\s*[A-Z]+\)?$/.test(l))
  return line ? line.slice(0, 160) : null
}

// 헤드라인이 없을 때의 기본 제목
export function filingTitle(f) {
  const base = String(f.form).replace(/\/A$/, '')
  const year = f.report_date ? Number(f.report_date.slice(0, 4)) : null
  const fy = year != null && base === '10-K' ? ` (FY${f.report_date.slice(5, 7) >= '07' ? year + 1 : year})` : ''
  const names = { '10-K': 'Annual report (10-K)', '20-F': 'Annual report (20-F)', '10-Q': 'Quarterly report (10-Q)', 4: 'Insider transaction (Form 4)', '8-K': 'Current report (8-K)', '6-K': 'Report of foreign issuer (6-K)' }
  return `${names[base] ?? `${f.form} filing`}${fy}${f.form.endsWith('/A') ? ' — amendment' : ''}`
}

export function sortNews(items) {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9)))
}
