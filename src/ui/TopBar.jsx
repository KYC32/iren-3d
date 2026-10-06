// 상단 바: 제목·기준일 / 뒤로가기 / 한영 토글
import { ArrowLeft, Languages, Server } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'

export default function TopBar() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
  const toggleLang = useAppStore((s) => s.toggleLang)
  const requestGlobe = useAppStore((s) => s.requestGlobe)

  return (
    <header className="topbar panel">
      <div className="brand">
        {view === 'site' ? (
          <button className="icon-btn" onClick={requestGlobe} aria-label={t.back} title={t.back}>
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className="brand-icon"><Server size={18} /></span>
        )}
        <div>
          <div className="title">
            {view === 'site' && site ? pickName(site, lang) : t.appTitle}
          </div>
          <div className="subtitle">
            {view === 'site' && site ? `${site.region} · ${site.grid_operator}` : 'NASDAQ: IREN'}
            {data && <> · {t.asOf} {data.as_of}</>}
          </div>
        </div>
      </div>
      <button className="lang-btn" onClick={toggleLang} aria-label="language">
        <Languages size={15} /> {t.langToggle}
      </button>
    </header>
  )
}
