// 핵심 지표 카드 줄: 지구본에서는 회사 전체, 캠퍼스에서는 선택한 사이트 기준
import { Zap, HardHat, MapPinned, CircleDollarSign, Cpu, Plug } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { companyMetrics, siteMetrics } from '../data/loadSites.js'
import { fmtMw } from '../scene/geo.js'

export default function KpiBar() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
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
  } else {
    const m = companyMetrics(data)
    const c = data.company
    cards = [
      { icon: Plug, label: lang === 'ko' ? '확보 전력' : 'Secured power', value: fmtMw(m.gridTotal, 2), sub: lang === 'ko' ? `통전 ${fmtMw(m.energized, 2)}` : `${fmtMw(m.energized, 2)} energized` },
      { icon: Zap, label: t.kpi.operating, value: fmtMw(m.operating), tone: 'operating', sub: lang === 'ko' ? `AI ${fmtMw(m.ai)} · 채굴 ${fmtMw(m.mining)}` : `AI ${fmtMw(m.ai)} · mining ${fmtMw(m.mining)}` },
      { icon: HardHat, label: t.kpi.building, value: fmtMw(m.building), tone: 'construction' },
      { icon: CircleDollarSign, label: t.kpi.arr, value: `$${c.contracted_arr_usd_bn}bn`, tone: 'pending', sub: lang === 'ko' ? `수주잔고 >$${c.backlog_usd_bn}bn` : `backlog >$${c.backlog_usd_bn}bn` },
      { icon: Cpu, label: t.kpi.gpus, value: `~${Math.round(c.gpus_total / 1000)}k`, sub: lang === 'ko' ? '설치+주문' : 'installed + ordered' },
    ]
  }

  return (
    <div className="kpis">
      {cards.map((k) => (
        <div key={k.label} className={`kpi panel tone-${k.tone ?? 'none'}`}>
          <div className="kpi-label"><k.icon size={13} /> {k.label}</div>
          <div className="kpi-value">{k.value}</div>
          {k.sub && <div className="kpi-sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}
