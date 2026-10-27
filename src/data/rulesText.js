// =============================================================
// rulesText.js — 지역 규제 요약 한 줄 문구 (순수 함수)
// -------------------------------------------------------------
// 캠퍼스 패널 '지역 규제' 칸(SiteRules.jsx)과 현황 페이지 캠퍼스 카드(PortfolioPage.jsx)가 함께 씀
//   자료: data/restrictions.json 의 sites[] 한 줄 (Miklian 2026, CC BY 4.0 — 제3자 연구 자료, 회사 발표 아님)
// =============================================================
import { fmtWhen } from './events.js'

const STATE = { TX: ['텍사스', 'Texas'], OK: ['오클라호마', 'Oklahoma'] }
export const RULE_STATUS = {
  active: ['유효', 'in effect'], rescinded: ['철회됨', 'rescinded'], replaced: ['영구 규정으로 대체', 'replaced by permanent rules'],
  expired: ['만료', 'expired'], unknown: ['상태 미확인', 'status unclear'],
}
const COUNTY_KO = { 'Childress County': '차일드레스 카운티', 'Fisher County': '피셔 카운티', 'Pittsburg County': '피츠버그 카운티' }

// r: restrictions.sites 한 줄 → { main: 카운티·주 건수 한 줄, nearest: 같은 주에서 가장 가까운 조치 한 줄(없으면 null) }
export function rulesLine(r, lang) {
  const ko = lang === 'ko', i = ko ? 0 : 1
  const state = STATE[r.state]?.[i] ?? r.state
  const county = ko ? COUNTY_KO[r.county] ?? r.county : r.county
  const n = r.nearest
  return {
    main: ko
      ? `${county} ${r.county_count}건 · ${state} 전체 ${r.state_count}건(${r.year}년 ${r.state_count_year}건)`
      : `${county}: ${r.county_count} · ${state}: ${r.state_count} in total (${r.state_count_year} in ${r.year})`,
    nearest: n
      ? (ko
        ? `같은 주에서 가장 가까운 조치: ${n.jurisdiction} · ${fmtWhen(n.date.slice(0, 7), lang)} · ${RULE_STATUS[n.status][0]} · 약 ${n.km}km`
        : `Nearest in-state: ${n.jurisdiction} · ${fmtWhen(n.date.slice(0, 7), lang)} · ${RULE_STATUS[n.status][1]} · ~${n.km} km`)
      : null,
  }
}
