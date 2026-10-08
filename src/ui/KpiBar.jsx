// 핵심 지표 카드 줄: 지구본에서는 회사 전체, 캠퍼스에서는 선택한 사이트 기준
import { PackageCheck as ServerDelivery, Zap, HardHat, MapPinned, CircleDollarSign, Cpu, Plug } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { siteMetrics } from '../data/loadSites.js'
import { totalsAt } from '../data/timeline.js'
import { fmtMw } from '../data/format.js'
import { reportedMetricsAt } from '../data/reportedMetrics.js'
import { SINGLE_COMPANY } from '../config.js'

// 회사 발표 지표 표시: 단위에 맞게 ($bn / $m / GW·MW / 개수)
function fmtMetric(x) {
  if (x.unit === 'USD bn') return `$${x.value}bn`
  if (x.unit === 'USD m') return `$${x.value}m`
  if (x.unit === 'GW' || x.unit === 'MW') return `${x.value} ${x.unit}`
  return x.value >= 1000 ? `~${Math.round(x.value / 1000)}k` : String(x.value)
}

function MetricValue({ value }) {
  const parts = value.match(/^(.*?)\s+(MW|GW)$/)
  return <div className="kpi-value"><span>{parts ? parts[1] : value}</span>{parts && <small>{parts[2]}</small>}</div>
}

export default function KpiBar() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
  const activeCompanies = useAppStore((s) => s.activeCompanies)
  const activeGroups = useAppStore((s) => s.activeGroups)
  if (!data) return null

  let cards
  if (view === 'site' && site) {
    const m = siteMetrics(site)
    cards = [
      { icon: Plug, label: t.panel.grid, value: fmtMw(site.grid_mw), tone: site.substation.status === 'energized' ? 'operating' : 'pending', sub: site.substation.status === 'energized' ? (lang === 'ko' ? '통전 완료' : 'Energized') : `${t.panel.energized} ${site.substation.dates?.target ?? ''}` },
      { icon: Zap, label: t.kpi.operating, value: fmtMw(m.operating), tone: 'operating', sub: m.mining ? (lang === 'ko' ? `채굴 ${fmtMw(m.mining)} 포함` : `incl. ${fmtMw(m.mining)} mining`) : null },
      { icon: HardHat, label: t.kpi.building, value: fmtMw(m.building), tone: 'construction' },
      { icon: MapPinned, label: t.kpi.planned, value: fmtMw(m.planned), tone: 'planned' },
    ]
    if (m.delivered) cards.splice(2,0,{icon:ServerDelivery,label:lang==='ko'?'고객 인수':'Customer accepted',value:fmtMw(m.delivered),tone:'delivered',sub:lang==='ko'?'가동·매출과 별도':'Separate from live revenue'})
  } else {
    // 지구본: 회사·그룹 필터를 반영한 합계
    const ids = data.companies
      .filter((c) => (!activeCompanies.size || activeCompanies.has(c.id)) && (!activeGroups.size || activeGroups.has(c.group)))
      .map((c) => c.id)
    const m = totalsAt(data.observedRaw ?? data.raw, data.month, { companies: new Set(ids) })
    cards = [
      { icon: Plug, label: t.kpi2.secured, value: fmtMw(m.secured, 2), sub: `${t.kpi2.energized} ${fmtMw(m.energized, 2)}` },
      { icon: Zap, label: t.kpi2.ai, value: fmtMw(m.ai), tone: 'operating', sub: m.mining ? `${t.kpi2.mining} ${fmtMw(m.mining)}` : null },
      { icon: HardHat, label: t.kpi2.building, value: fmtMw(m.building), tone: 'construction' },
      { icon: MapPinned, label: t.kpi2.sites, value: String(m.sites), sub: SINGLE_COMPANY ? null : `${t.kpi2.companies} ${ids.length}` },
    ]
    // 회사를 하나만 골랐으면 그 회사가 발표한 지표(출처 있음)도 표시
    const one = ids.length === 1 ? data.companies.find((c) => c.id === ids[0]) : null
    for (const x of reportedMetricsAt(one?.metrics ?? [], data.month).slice(0, 2)) {
      cards.push({
        icon: x.unit.startsWith('USD') ? CircleDollarSign : Cpu,
        label: lang === 'ko' ? x.label_ko : x.label_en,
        value: fmtMetric(x),
        tone: 'pending',
        sub: `${t.kpi2.reported} · ${x.as_of}`,
        source: x.source,
      })
    }
  }

  return (
    <section className="kpis panel" aria-label={lang==='ko'?'핵심 현황':'Key metrics'}>
      <div className="kpi-context"><small>{view==='site'?'CAMPUS':'PORTFOLIO'}</small><b>{lang==='ko'?(view==='site'?'전력 현황':'사업 현황'):(view==='site'?'Power overview':'At a glance')}</b><span>{lang==='ko'?(view==='site'?'시설 전력 기준':'공개 자료 기준'):(view==='site'?'Facility capacity':'Reported data')}</span></div>
      <div className="kpi-items" tabIndex={0} aria-label={lang==='ko'?'지표 목록, 좌우로 스크롤':'Metrics, scroll horizontally'}>
      {cards.map((k) => (
        <div key={k.label} className={`kpi tone-${k.tone ?? 'none'}`}>
          <div className="kpi-label"><k.icon size={13} strokeWidth={1.6} aria-hidden="true" /> {k.label}</div>
          <MetricValue value={k.value}/>
          {k.sub && <div className="kpi-sub">{k.source ? <a href={k.source} target="_blank" rel="noreferrer">{k.sub}</a> : k.sub}</div>}
        </div>
      ))}
      </div>
    </section>
  )
}
