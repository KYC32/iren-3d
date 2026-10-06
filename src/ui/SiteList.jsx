// 지구본 화면 왼쪽의 사이트 목록 (핀이 겹쳐도 여기서 바로 선택 가능)
import { ChevronRight } from 'lucide-react'
import { useAppStore, isStatusActive } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtMw } from '../scene/geo.js'

const FLAG = { US: 'US', CA: 'CA', AU: 'AU', ES: 'ES' }

export default function SiteList() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const sites = useAppStore((s) => s.data?.sites ?? [])
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const active = useAppStore((s) => s.activeStatuses)

  return (
    <nav className="site-list panel">
      {sites.map((s) => {
        const st = styleOf(s.status)
        return (
          <button
            key={s.id}
            className={`site-row${hoverId === s.id ? ' is-hover' : ''}${isStatusActive(active, s.status) ? '' : ' off'}`}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => requestSite(s.id)}
          >
            <span className="dot" style={{ background: st.color }} />
            <span className="site-name">
              {pickName(s, lang)}
              <span className="site-meta">{FLAG[s.country]} · {t.status[s.status]}</span>
            </span>
            <span className="site-mw">{fmtMw(s.grid_mw)}</span>
            <ChevronRight size={14} className="chev" />
          </button>
        )
      })}
    </nav>
  )
}
