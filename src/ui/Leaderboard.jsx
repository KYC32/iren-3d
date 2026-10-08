// =============================================================
// 왼쪽 패널: [회사 순위 | 사이트] 탭
// 순위표: 확보 / AI 가동 / 건설 MW 기준 회사 순위 + 가동·건설·계획 비율 막대
// 행을 누르면 그 회사만 강조(필터), 다시 누르면 해제
// =============================================================
import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { companyRanking } from '../data/timeline.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtMw } from '../data/format.js'
import SiteList from './SiteList.jsx'
import { SINGLE_COMPANY } from '../config.js'
import Upcoming from './Upcoming.jsx'
import ChangeLog from './ChangeLog.jsx'

const GROUPS = ['miner', 'neocloud', 'hyperscaler', 'korea']
const METRICS = ['secured', 'ai', 'building']

export default function LeftPanel() {
  const t = useT()
  const leftTab = useAppStore((s) => s.leftTab)
  const setLeftTab = useAppStore((s) => s.setLeftTab)
  const sheetOpen = useAppStore((s) => s.sheetOpen)
  // 단일 회사 모드: 순위표 대신 [사이트 | 다가오는 일정 | 갱신 기록] 탭
  if (SINGLE_COMPANY) {
    const tab = ['sites', 'upcoming', 'log'].includes(leftTab) ? leftTab : 'sites'
    return (
      <div className={`left-panel panel${sheetOpen ? ' sheet-open' : ''}`}>
        <div className="tabs">
          <button className={tab === 'sites' ? 'on' : ''} onClick={() => setLeftTab('sites')}>{t.rank.sitesTab}</button>
          <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setLeftTab('upcoming')}>{t.upcoming.tab}</button>
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setLeftTab('log')}>{t.changelog.tab}</button>
        </div>
        {tab === 'sites' ? <SiteList /> : tab === 'upcoming' ? <Upcoming /> : <ChangeLog />}
      </div>
    )
  }
  return (
    <div className={`left-panel panel${sheetOpen ? ' sheet-open' : ''}`}>
      <div className="tabs">
        <button className={leftTab === 'rank' ? 'on' : ''} onClick={() => setLeftTab('rank')}>{t.rank.tab}</button>
        <button className={leftTab === 'sites' ? 'on' : ''} onClick={() => setLeftTab('sites')}>{t.rank.sitesTab}</button>
      </div>
      <GroupChips />
      {leftTab === 'rank' ? <Leaderboard /> : <SiteList />}
    </div>
  )
}

// 회사 그룹 필터 칩 (데이터에 있는 그룹만 표시)
function GroupChips() {
  const t = useT()
  const companies = useAppStore((s) => s.data.companies)
  const activeGroups = useAppStore((s) => s.activeGroups)
  const activeCompanies = useAppStore((s) => s.activeCompanies)
  const toggleGroup = useAppStore((s) => s.toggleGroup)
  const clear = useAppStore((s) => s.clearCompanyFilters)
  const present = GROUPS.filter((g) => companies.some((c) => c.group === g))
  return (
    <div className="chips">
      {present.map((g) => (
        <button key={g} className={`chip${activeGroups.has(g) ? ' on' : ''}`} onClick={() => toggleGroup(g)}>
          {t.groups[g]}
        </button>
      ))}
      {(activeGroups.size > 0 || activeCompanies.size > 0) && (
        <button className="chip reset" onClick={clear}>{t.rank.reset}</button>
      )}
    </div>
  )
}

function Leaderboard() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const metric = useAppStore((s) => s.rankMetric)
  const setMetric = useAppStore((s) => s.setRankMetric)
  const activeGroups = useAppStore((s) => s.activeGroups)
  const activeCompanies = useAppStore((s) => s.activeCompanies)
  const toggleCompany = useAppStore((s) => s.toggleCompany)

  const rows = useMemo(
    () => companyRanking(data.observedRaw ?? data.raw, data.month, { metric, groups: activeGroups.size ? activeGroups : null }),
    [data, metric, activeGroups],
  )
  const byId = Object.fromEntries(data.companies.map((c) => [c.id, c]))
  const max = Math.max(1, ...rows.map((r) => r.secured))

  return (
    <div className="leaderboard">
      <div className="seg">
        {METRICS.map((m) => (
          <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{t.rank.metric[m]}</button>
        ))}
      </div>
      <ol className="rank-list">
        {rows.map((r) => {
          const c = byId[r.companyId]
          const off = activeCompanies.size > 0 && !activeCompanies.has(r.companyId)
          return (
            <li key={r.companyId}>
              <button className={`rank-row${off ? ' off' : ''}${activeCompanies.has(r.companyId) ? ' on' : ''}`} onClick={() => toggleCompany(r.companyId)}>
                <span className="rank-no">{r.rank}</span>
                <span className="dot" style={{ background: c.color }} />
                <span className="rank-name">
                  {pickName(c, lang)}
                  {c.ticker && <span className="ticker">{c.ticker.symbol}</span>}
                </span>
                <span className="rank-val">{r.hasEstimate ? '~' : ''}{fmtMw(r[metric])}</span>
                {/* 가동(AI) · 건설 · 계획 비율 막대 — 길이는 1위 확보 전력 대비 */}
                <span className="rank-bar">
                  <i style={{ width: `${(r.ai / max) * 100}%`, background: styleOf('operating').color }} />
                  <i style={{ width: `${(r.building / max) * 100}%`, background: styleOf('under_construction').color }} />
                  <i style={{ width: `${(r.planned / max) * 100}%`, background: styleOf('planned').color }} />
                </span>
              </button>
              {/* 이 회사만 골랐을 때: 코로케이션 입주 시설을 아래에 병기 */}
              {activeCompanies.size === 1 && activeCompanies.has(r.companyId) && <Colocations company={c} />}
            </li>
          )
        })}
      </ol>
      <div className="rank-note">{t.rank.note}</div>
    </div>
  )
}

// 코로케이션(다른 회사 시설에 입주) 목록 — 지도 핀·순위 합계에는 들어가지 않는 참고 정보
function Colocations({ company }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const list = company.colocations ?? []
  if (!list.length) return null
  // 규모가 공개된 곳만 더한 합계 (미공개는 "+N곳" 으로 따로 표시)
  const known = list.filter((x) => x.mw != null)
  const sum = known.reduce((n, x) => n + x.mw, 0)
  return (
    <div className="coloc">
      <div className="coloc-head">
        {t.rank.coloc} · {fmtMw(sum)}{list.length > known.length ? ` + ${list.length - known.length}${t.rank.colocMore}` : ''}
      </div>
      <ul>
        {list.map((x) => (
          <li key={x.name}>
            <span className="dot" style={{ background: styleOf(x.status).color }} />
            <a href={x.source} target="_blank" rel="noreferrer" title={lang === 'ko' ? x.note_ko : x.note_en}>
              {pickName(x, lang)}
            </a>
            <span className="coloc-host">{x.host}</span>
            <span className="coloc-mw">{x.mw != null ? `${x.basis === 'reported' ? '' : '~'}${fmtMw(x.mw)}` : t.rank.undisclosed}</span>
          </li>
        ))}
      </ul>
      <div className="coloc-note">{t.rank.colocNote}</div>
    </div>
  )
}
