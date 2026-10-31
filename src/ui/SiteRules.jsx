// =============================================================
// SiteRules — 캠퍼스 패널 "현황" 탭의 "지역 규제" 칸 (미국 부지만)
//   부지 카운티·같은 주의 데이터센터 유예·제한 조치 수와, 같은 주에서 가장 가까운 조치 하나
//   자료: data/restrictions.json (scripts/fetch-restrictions.mjs 가 Miklian 2026, CC BY 4.0 에서 계산)
// 따로 불러옴(React.lazy) → 첫 화면 번들에 안 들어감. 제3자 연구 자료라 회사 발표가 아니라고 적음
// =============================================================
import { ArrowUpRight, Scale } from 'lucide-react'
import { rulesLine, stateActionsFor } from '../data/rulesText.js'   // 한 줄 문구 (현황 페이지 캠퍼스 카드와 같은 문구) · 주 정부 조치
import './siteNews.css'   // 날짜 칸·가는 선 모양을 최근 소식 목록과 같게
import './siteFacts.css'  // 아래 작은 안내 글(facts-note) 모양

// rules: 이 부지의 요약 한 줄(restrictions.sites 중 하나) · source: 자료 출처(restrictions.source)
// actions: 주 전체에 걸린 정부 조치(restrictions.stateActions) — 원문 링크와 함께 카운티 집계 위에 보임
export default function SiteRules({ rules: r, source, actions, lang }) {
  const ko = lang === 'ko'
  const line = rulesLine(r, lang)
  const stateActions = stateActionsFor(actions, r.state)
  return <>
    {stateActions.length > 0 && <>
      <h3>{ko ? '주 정부 조치 · 데이터센터' : 'State action · data centers'}</h3>
      <ol className="site-news">
        {stateActions.map((a) => <li key={a.date}>
          <span className="site-news-date">{a.date.slice(2).replaceAll('-', '.')}</span>
          <div className="site-news-body">
            <a className="rules-line" href={a.source} target="_blank" rel="noreferrer">{ko ? a.ko : a.en}<ArrowUpRight size={10} aria-hidden="true" /></a>
          </div>
        </li>)}
      </ol>
      <p className="facts-note">{ko ? '이 부지에 미치는 영향은 회사가 밝히지 않음' : 'The company has not said how this affects the site'}</p>
    </>}
    <h3>{ko ? '지역 규제 · 데이터센터 유예·제한' : 'Local rules · data center moratoria'}</h3>
    <ol className="site-news">
      <li>
        <span className="site-news-date"><Scale size={12} aria-hidden="true" /></span>
        <div className="site-news-body">
          <span className="rules-line">{line.main}</span>
          {line.nearest && <small>{line.nearest}</small>}
        </div>
      </li>
    </ol>
    <p className="facts-note">
      {ko ? `제3자 연구 자료(${source.coverage}, 회사 발표 아님) · ` : `Third-party research data (${source.coverage}; not company-reported) · `}
      <a href={source.url} target="_blank" rel="noreferrer">Miklian 2026 · CC BY 4.0<ArrowUpRight size={10} aria-hidden="true" /></a>
    </p>
  </>
}
