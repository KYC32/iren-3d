// =============================================================
// PortfolioPage — "현황" 페이지 (#page=portfolio): 포트폴리오 사업 현황을 지도에서 떼어 따로 보여 줌
//   핵심 지표(KpiBar, 회사 전체 기준) → 타임라인(날짜를 옮기면 지표·표가 그 시점으로) → 캠퍼스별 표
//   지도 화면은 늘 기준일 모습이고, 날짜를 옮겨 보는 일은 이 페이지(와 3D 화면)에서 합니다
//   표의 캠퍼스를 누르면 지도로 돌아가 그 캠퍼스를 엶
// =============================================================
import { ArrowUpRight } from 'lucide-react'
import PageShell from './PageShell.jsx'
import KpiBar from '../ui/KpiBar.jsx'
import TimelineSlider from '../ui/TimelineSlider.jsx'
import { useAppStore } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { siteMetrics } from '../data/loadSites.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtMw } from '../data/format.js'
import { monthLabel } from '../data/timeline.js'

export default function PortfolioPage() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const month = useAppStore((s) => s.month)
  const ko = lang === 'ko'
  if (!data) return <PageShell><div className="page-loading">{t.loading}</div></PageShell>
  // 캠퍼스별 숫자: 확보 전력(계통 연결 용량) · AI 가동(고객 인수 포함) · 채굴 · 건설·시운전 · 계획 — 지금 고른 날짜 기준
  //   (채굴 열이 있어야 칠드레스처럼 채굴동이 남은 곳의 합이 확보 전력과 맞음)
  const rows = data.sites.map((s) => ({ site: s, m: siteMetrics(s) }))
  const open = (id) => { const st = useAppStore.getState(); st.setPage(null); st.focusSiteOnMap(id) }
  return (
    <PageShell className="portfolio-page">
      <KpiBar mode="portfolio" />
      <div className="portfolio-timeline"><TimelineSlider /></div>
      <div className="pf-table-wrap">
        <table className="pf-table">
          <caption>{ko ? `캠퍼스별 · ${monthLabel(month, lang)} 기준 · 이름을 누르면 지도에서 열림` : `By campus · as of ${monthLabel(month, lang)} · click a name to open it on the map`}</caption>
          <thead><tr>
            <th>{ko ? '캠퍼스' : 'Campus'}</th><th>{ko ? '상태' : 'Status'}</th>
            <th>{ko ? '확보 전력' : 'Secured'}</th><th>{t.kpi2.ai}</th><th>{ko ? '채굴' : 'Mining'}</th><th>{t.kpi2.building}</th><th>{t.kpi.planned}</th>
          </tr></thead>
          <tbody>{rows.map(({ site: s, m }) => (
            <tr key={s.id}>
              <td><button type="button" onClick={() => open(s.id)}><b>{pickName(s, lang)}</b><ArrowUpRight size={11} aria-hidden="true" /></button><small>{s.country} · {s.region}</small></td>
              <td><span className="pf-status"><i style={{ background: styleOf(s.status).color }} />{t.status[s.status]}</span></td>
              <td>{s.grid_mw ? fmtMw(s.grid_mw) : '—'}</td>
              <td>{m.ai ? fmtMw(m.ai) : '—'}</td>
              <td>{m.mining ? fmtMw(m.mining) : '—'}</td>
              <td>{m.building ? fmtMw(m.building) : '—'}</td>
              <td>{m.planned ? fmtMw(m.planned) : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="page-note">{ko
        ? '확보 전력 = 계통에 연결(또는 확보)한 용량. AI 가동에는 고객 인수 확인분 포함. 과거 날짜는 "그때 공개된 자료", 기준일 뒤는 회사 목표 기준의 전망입니다.'
        : 'Secured = grid capacity connected or secured. AI live includes customer-accepted capacity. Past dates show what was public then; dates after the as-of date follow company targets.'}</p>
    </PageShell>
  )
}
