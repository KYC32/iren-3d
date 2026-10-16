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
// 8-K 항목 코드 → 뜻 (첨부 제목이 없을 때 "무슨 공시인지" 보여 주는 데 씀)
export const ITEM_LABEL = {
  '1.01': { ko: '중요 계약 체결', en: 'Material agreement' }, '1.02': { ko: '중요 계약 종료', en: 'Agreement terminated' },
  '2.02': { ko: '실적 발표', en: 'Results of operations' }, '2.03': { ko: '채무·금융 계약', en: 'Financial obligation' },
  '3.02': { ko: '미등록 증권 발행', en: 'Unregistered securities' }, '3.03': { ko: '주주 권리 변경', en: 'Rights of holders' },
  '4.01': { ko: '감사인 변경', en: 'Auditor change' }, '5.02': { ko: '임원·이사 변동', en: 'Officer / director change' },
  '5.03': { ko: '정관 변경', en: 'Bylaws amended' }, '5.07': { ko: '주주총회 결과', en: 'Shareholder vote' },
  '7.01': { ko: '공정공시(Reg FD)', en: 'Reg FD disclosure' }, '8.01': { ko: '기타 사건', en: 'Other events' }, '9.01': { ko: '첨부 자료', en: 'Exhibits' },
}
export const itemLabels = (items, lang = 'ko') => (items ?? []).filter((c) => c !== '9.01').map((c) => ITEM_LABEL[c]?.[lang] ?? c)

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

// 제출 폴더의 파일 목록(index.json) → 보도자료 첨부 파일명
//   1) ex99-1 (또는 ex99_1·ex991) 우선  2) ex99 로 시작하는 첫 .htm
//   3) 둘 다 없으면 본문(primaryDocument)·R*.htm(재무 표)·_8k.htm 을 뺀 나머지 .htm — IREN 은 첨부를 'irenreportsfy26results.htm' 처럼 이름 짓기도 함
export function pickExhibit(indexJson, primaryDocument = '') {
  const names = (indexJson?.directory?.item ?? []).map((i) => i.name).filter((n) => /\.htm$/i.test(n))
  const ex99 = names.filter((n) => /ex[-_]?99/i.test(n))
  if (ex99.length) return ex99.find((n) => /ex[-_]?99[-_.]?1\b/i.test(n)) ?? ex99[0]
  // ex10-1(계약서)·ex3-1(정관)·ex5-1(법률의견) 같은 다른 첨부는 보도자료가 아니므로 제외
  const rest = names.filter((n) => n !== primaryDocument && !/^R\d+\.htm$/i.test(n) && !/_?8k\.htm$/i.test(n) && !/^iren-\d{8}\.htm$/i.test(n) && !/ex[-_]?\d/i.test(n))
  return rest[0] ?? null
}

// 첨부 HTML → 헤드라인: 태그 제거 후 "Exhibit 99.1" 같은 머리말을 건너뛰고 첫 의미 있는 줄 (최대 160자)
export function headlineFromHtml(html) {
  // EDGAR 원본은 <DOCUMENT><TYPE>EX-99.1<FILENAME>…<TEXT> 머리말로 시작 → <TEXT> 뒤부터
  const body = String(html ?? '').replace(/^[\s\S]*?<TEXT>/i, '')
  const text = body
    .replace(/<head[\s\S]*?<\/head>/gi, ' ') // <title> 에 파일명이 들어 있는 경우가 있음
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  // 줄바꿈뿐 아니라 "두 칸 이상 띄움"으로도 나눔 — 슬라이드형 첨부는 한 줄에 제목·부제·본문을 공백 여러 개로 이어 붙임
  const lines = decodeEntities(text).split(/\n|\s{2,}/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  // 월간 지표표("Key Metrics …")로 시작하는 첨부는 제목이 없는 표 문서 → 서식 이름으로 대신 (호출한 쪽에서 처리)
  if (lines.slice(0, 6).some((l) => /^key metrics/i.test(l))) return null
  const skip = /^(exhibit\s*\d|ex-?\d|press release|news release|for immediate release|proceed with purpose|about iren)/i
  const dateline = /^[A-Z][A-Za-z .]+,\s.*\d{4}\s*\(GLOBE NEWSWIRE\)/ // "SYDNEY, Australia, January 7, 2025 (GLOBE NEWSWIRE) --" 본문 첫 줄
  const line = lines.find((l) => l.length >= 10 && !skip.test(l)
    && /[A-Za-z]{4,}/.test(l)                               // 글자가 거의 없는 줄(불릿·기호·&deg;)은 제외
    && !/^\(?[A-Z]{3,6}:\s*[A-Z]+\)?$/.test(l) && !/\.(htm|html|pdf)$/i.test(l)
    && !/^(iren|iris energy) (limited|ltd\.?)$/i.test(l))  // 회사명만 있는 줄 (옛 이름 Iris Energy 포함)
  if (!line || dateline.test(line)) return null             // 제목 없이 본문(날짜줄)부터 시작하면 제목을 모르는 것
  return line.replace(/^\d{1,2}\s+(?=[A-Z])/, '').slice(0, 160) // 슬라이드 쪽 번호("1 ") 제거
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

// 사이트 숫자의 기준일(as_of) "뒤"에 나온 회사 공시 = 아직 사이트에 반영 안 됐을 수 있는 것 (최신순 그대로)
//   기준일 당일 공시는 반영된 것으로 봄. 내부자 거래(Form 4)는 캠퍼스·계약 숫자와 상관없어 뺌
//   현황·뉴스 페이지의 "기준일 뒤 · 미반영" 안내와 자동 갱신의 GitHub 이슈(scripts/check-asof.mjs)가 같이 씀
export function filingsAfter(items, asOf) {
  if (!asOf || !items) return []
  return items.filter((it) => it.date > asOf && it.kind !== 'insider')
}
