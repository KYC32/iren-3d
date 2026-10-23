// =============================================================
// siteNews.js — 캠퍼스(사이트) 소식 목록을 고르는 순수 함수
// -------------------------------------------------------------
// data/companies/iren.json 의 사이트마다 있는 timeline(회사 발표·공시 등 이미 일어난 일)을
// 캠퍼스 패널 '현황' 탭과 현황 페이지(#page=portfolio)의 "최근 소식" 목록(ui/SiteNews.jsx)으로 보여 줍니다.
//   - 보고 있는 달(타임라인 날짜)까지의 소식만 → 과거로 옮기면 그 뒤 소식은 숨김 ("그때 공개된 자료만")
//   - 최신이 맨 위
// 달은 타임라인 눈금(events.js buildEvents)과 같은 toMonth(date) 로 셈 → 눈금과 목록이 같은 달에 나타남
// =============================================================
import { toMonth } from './timeline.js'

// 날짜 글자 내림차순 ('2025-12-31' 이 '2025-12' 보다 위 — 같은 달이면 날짜까지 적힌 쪽이 먼저)
const newerFirst = (a, b) => (a < b) - (a > b)

export function siteNewsAt(site, month) {
  return (site.timeline ?? [])
    .map((item) => ({ item, m: toMonth(item.date) }))
    .filter(({ m }) => m <= month)
    .sort((a, b) => b.m - a.m || newerFirst(a.item.date, b.item.date))
    .map(({ item }) => item)
}
