// =============================================================
// SiteRules — 캠퍼스 패널 "현황" 탭의 "지역 규제" 칸 (미국 부지만)
//   부지 카운티·같은 주의 데이터센터 유예·제한 조치 수와, 같은 주에서 가장 가까운 조치 하나
//   자료: data/restrictions.json (scripts/fetch-restrictions.mjs 가 Miklian 2026, CC BY 4.0 에서 계산)
// 따로 불러옴(React.lazy) → 첫 화면 번들에 안 들어감. 제3자 연구 자료라 회사 발표가 아니라고 적음
// =============================================================
import { ArrowUpRight, Scale } from 'lucide-react'
import { fmtWhen } from '../data/events.js'
import './siteNews.css'   // 날짜 칸·가는 선 모양을 최근 소식 목록과 같게
import './siteFacts.css'  // 아래 작은 안내 글(facts-note) 모양

const STATE = { TX: ['텍사스', 'Texas'], OK: ['오클라호마', 'Oklahoma'] }
const STATUS = {
  active: ['유효', 'in effect'], rescinded: ['철회됨', 'rescinded'], replaced: ['영구 규정으로 대체', 'replaced by permanent rules'],
  expired: ['만료', 'expired'], unknown: ['상태 미확인', 'status unclear'],
}
const COUNTY_KO = { 'Childress County': '차일드레스 카운티', 'Fisher County': '피셔 카운티', 'Pittsburg County': '피츠버그 카운티' }

// rules: 이 부지의 요약 한 줄(restrictions.sites 중 하나) · source: 자료 출처(restrictions.source)
export default function SiteRules({ rules: r, source, lang }) {
  const ko = lang === 'ko', i = ko ? 0 : 1
  const state = STATE[r.state]?.[i] ?? r.state
  const county = ko ? COUNTY_KO[r.county] ?? r.county : r.county
  const n = r.nearest
  return <>
    <h3>{ko ? '지역 규제 · 데이터센터 유예·제한' : 'Local rules · data center moratoria'}</h3>
    <ol className="site-news">
      <li>
        <span className="site-news-date"><Scale size={12} aria-hidden="true" /></span>
        <div className="site-news-body">
          <span className="rules-line">{ko
            ? `${county} ${r.county_count}건 · ${state} 전체 ${r.state_count}건(${r.year}년 ${r.state_count_year}건)`
            : `${county}: ${r.county_count} · ${state}: ${r.state_count} in total (${r.state_count_year} in ${r.year})`}</span>
          {n && <small>{ko
            ? `같은 주에서 가장 가까운 조치: ${n.jurisdiction} · ${fmtWhen(n.date.slice(0, 7), lang)} · ${STATUS[n.status][0]} · 약 ${n.km}km`
            : `Nearest in-state: ${n.jurisdiction} · ${fmtWhen(n.date.slice(0, 7), lang)} · ${STATUS[n.status][1]} · ~${n.km} km`}</small>}
        </div>
      </li>
    </ol>
    <p className="facts-note">
      {ko ? `제3자 연구 자료(${source.coverage}, 회사 발표 아님) · ` : `Third-party research data (${source.coverage}; not company-reported) · `}
      <a href={source.url} target="_blank" rel="noreferrer">Miklian 2026 · CC BY 4.0<ArrowUpRight size={10} aria-hidden="true" /></a>
    </p>
  </>
}
