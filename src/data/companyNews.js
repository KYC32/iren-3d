// =============================================================
// companyNews.js — 사이트 기록에 있는 회사 공식 발표 중 SEC 제출(EDGAR)에 없는 것 (순수 함수)
// -------------------------------------------------------------
// 뉴스 페이지 '회사 발표' 탭은 SEC EDGAR 제출만 모음 → IREN 이 8-K 없이 GlobeNewswire·회사 X 로만 낸 발표가 빠졌음
//   (2026-10-27 검토: 탭의 최신이 8/27 인데 10월 회사 발표 3건(레드뱅크·바다호스·실적 발표일)이 사이트 기록에는 있었음)
// 그래서 캠퍼스 소식(sites[].timeline)·회사 사건(companies[].events, reported)의 출처가 회사 공식 채널이면 모아서
//   EDGAR 보도자료·실적 항목과 날짜가 하루 안으로 겹치지 않는 것만 탭에 더함 (겹치면 같은 발표의 8-K 로 봄)
// 날짜 = 출처 공개일(sourceDates) — 없으면 기록 날짜. 제목은 공식 헤드라인이 아니라 이 사이트가 정리한 문구라 화면에 그렇게 적음
// =============================================================

// 회사 공식 채널: 보도자료 배포처(GlobeNewswire)·회사 누리집·회사 X 계정
const OFFICIAL = [/^https?:\/\/(www\.)?globenewswire\.com\//i, /^https?:\/\/([a-z0-9-]+\.)?iren\.com\//i, /^https?:\/\/(www\.)?(x|twitter)\.com\/IREN_Ltd\//i]
export const isOfficialRelease = (url) => OFFICIAL.some((re) => re.test(String(url ?? '')))

const DAY = 86400000
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY

// raw: infra.json 원본 (sites·companies·sourceDates) · edgar: news.json company.items
// → [{ id, date, kind: 'press', title_ko, title_en, url, from: 'site' }] 최신 먼저
export function siteReleases(raw, edgar = []) {
  if (!raw) return []
  const published = new Map((raw.sourceDates ?? []).map((x) => [x.url, x.published]))
  const seen = new Map()   // 같은 발표를 여러 캠퍼스가 기록했으면 하나로 (주소 기준, 처음 것)
  const add = (url, date, ko, en) => {
    if (!isOfficialRelease(url) || seen.has(url)) return
    const d = published.get(url) ?? date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) return   // 달까지만 아는 기록은 뺌
    seen.set(url, { id: `site:${url}`, date: d, kind: 'press', title_ko: ko, title_en: en ?? ko, url, from: 'site' })
  }
  for (const s of raw.sites ?? []) for (const t of s.timeline ?? []) add(t.source, t.date, t.event, t.event_en)
  for (const c of raw.companies ?? []) for (const e of c.events ?? []) if (e.basis === 'reported') add(e.source, e.date, e.title_ko, e.title_en)
  const filed = edgar.filter((i) => i.kind === 'press' || i.kind === 'earnings')
  return [...seen.values()]
    .filter((r) => !filed.some((i) => dayDiff(i.date, r.date) <= 1))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
