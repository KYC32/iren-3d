// 상단 바: 제목·기준일 / 뒤로가기 / 한영 토글
import { ArrowLeft, Languages, Server, ListOrdered, Maximize2 } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'

export default function TopBar() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const surface = useAppStore((s) => s.surface)
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
  const toggleLang = useAppStore((s) => s.toggleLang)
  const requestGlobe = useAppStore((s) => s.requestGlobe)
  const toggleSheet = useAppStore((s) => s.toggleCampusList)

  return (
    <header className="topbar panel">
      <div className="brand">
        {view === 'site' ? (
          <button className="icon-btn" onClick={requestGlobe} aria-label={lang==='ko'?'캠퍼스 목록으로':'Back to campuses'} title={lang==='ko'?'캠퍼스 목록으로':'Back to campuses'}>
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className="brand-icon"><Server size={18} /></span>
        )}
        <div>
          <div className="title">
            {view === 'site' && site ? pickName(site, lang) : (lang==='ko'?'IREN 현장 리서치':'IREN Field Research')}
          </div>
          <div className="subtitle">
            {view === 'site' && site ? `${site.region} · ${site.grid_operator}` : t.subtitle}
            {data && <> · {t.asOf} {data.as_of}</>}
          </div>
        </div>
      </div>
      <div className="top-actions">
      {view === 'site' && surface==='3d' && <button className="lang-btn home-btn" onClick={() => useAppStore.getState().requestCampusHome()} aria-label={t.campus.home} title={t.campus.home}>
        <Maximize2 size={15} /><span>{t.campus.home}</span>
      </button>}
      {surface === 'map' && (
        <button className="icon-btn sheet-btn" onClick={toggleSheet} aria-label={lang==='ko'?'캠퍼스 목록':'Campus list'} title={lang==='ko'?'캠퍼스 목록':'Campus list'}>
          <ListOrdered size={17} />
        </button>
      )}
      <button className="lang-btn" onClick={toggleLang} aria-label="language">
        <Languages size={15} /> {t.langToggle}
      </button>
      </div>
    </header>
  )
}
