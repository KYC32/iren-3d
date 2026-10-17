// 상단 바: 제목·기준일 / 뒤로가기 / 하늘(낮·노을·밤·지금) / 공유 / 한영 토글 / ≡ 메뉴(갱신 기록)
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Languages, Zap, ListOrdered, Maximize2, Move, Rotate3D, Share2, Check, Sun, Sunset, Moon, Clock, Compass, Map as MapIcon, ChartLine, Newspaper, LayoutDashboard, Menu } from 'lucide-react'
import { localClock } from '../scene/sun.js'
import { AI_LIGHT, MINER_LIGHT } from '../scene/nightColors.js'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'

// ≡ 메뉴 서랍은 처음 열 때 불러옴 (첫 화면 번들에 넣지 않음 — 첫 화면 용량 한도가 빠듯함)
const AppMenu = lazy(() => import('./AppMenu.jsx'))

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
  const dragMode = useAppStore((s) => s.campusDragMode)
  const setDragMode = useAppStore((s) => s.setCampusDragMode)
  const page = useAppStore((s) => s.page)
  const setPage = useAppStore((s) => s.setPage)
  const inMap = !page // 지도·3D 화면일 때만 보이는 버튼들

  return (
    <header className="topbar panel">
      <div className="brand">
        {page ? (
          <span className="brand-icon">{page === 'portfolio' ? <LayoutDashboard size={18} /> : page === 'stock' ? <ChartLine size={18} /> : <Newspaper size={18} />}</span>
        ) : view === 'site' ? (
          <button className="icon-btn" onClick={requestGlobe} aria-label={lang==='ko'?'캠퍼스 목록으로':'Back to campuses'} title={lang==='ko'?'캠퍼스 목록으로':'Back to campuses'}>
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className="brand-icon" aria-hidden="true">{/* 번개 = 전력: 전력을 먼저 확보하는 데이터센터 (IREN 로고의 초록·남색) */}<Zap size={17} fill="currentColor" strokeWidth={1.6} /></span>
        )}
        <div>
          <div className="title">
            {page ? t.nav[`${page}Title`] : view === 'site' && site ? pickName(site, lang) : (lang==='ko'?'IREN 현장 리서치':'IREN Field Research')}
          </div>
          <div className="subtitle">
            {page ? <>{t.nav[`${page}Sub`]}{page === 'portfolio' && data && <> · {t.asOf} {data.as_of}</>}</> : <>{view === 'site' && site ? `${site.region} · ${site.grid_operator}` : t.subtitle}{data && <> · {t.asOf} {data.as_of}</>}</>}
          </div>
        </div>
      </div>
      {/* 페이지 네비: 지도 | 현황 | 주가 | 뉴스 */}
      <nav className="camera-mode page-nav" aria-label={t.nav.label}>
        {[[null, MapIcon, t.nav.map], ['portfolio', LayoutDashboard, t.nav.portfolio], ['stock', ChartLine, t.nav.stock], ['news', Newspaper, t.nav.news]].map(([key, Icon, label]) => (
          <button key={key ?? 'map'} aria-pressed={page === key} onClick={() => setPage(key)} aria-label={label} title={label}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>
        ))}
      </nav>
      <div className="top-actions">
      {inMap && view === 'site' && surface==='3d' && site && <SkyControl t={t} site={site} />}
      {inMap && view === 'site' && surface==='3d' && <div className="camera-mode" role="group" aria-label={t.campus.controls}>
        <button aria-pressed={dragMode==='rotate'} aria-label={t.campus.rotateLabel} title={t.campus.rotateLabel} onClick={()=>setDragMode('rotate')}><Rotate3D size={15}/><span>{t.campus.rotate}</span></button>
        <button aria-pressed={dragMode==='pan'} aria-label={t.campus.panLabel} title={t.campus.panLabel} onClick={()=>setDragMode('pan')}><Move size={15}/><span>{t.campus.pan}</span></button>
      </div>}
      {/* 전체 보기: 아이콘만 (이름은 마우스를 올리면 — title·aria-label). ≡ 메뉴가 들어갈 자리를 위해 글자를 뺌
          (1200~1440px 3D 상단 바는 버튼이 꽉 차서, 글자가 있으면 제목이 두 줄로 접혔음) */}
      {inMap && view === 'site' && surface==='3d' && <button className="lang-btn home-btn" onClick={() => useAppStore.getState().requestCampusHome()} aria-label={t.campus.home} title={t.campus.home}>
        <Maximize2 size={15} aria-hidden="true" />
      </button>}
      {inMap && surface === 'map' && (
        <button className="icon-btn sheet-btn" onClick={toggleSheet} aria-label={lang==='ko'?'캠퍼스 목록':'Campus list'} title={lang==='ko'?'캠퍼스 목록':'Campus list'}>
          <ListOrdered size={17} />
          <span className="sheet-label">{lang==='ko'?'캠퍼스':'Campuses'}{data && <b>{data.sites.length}</b>}</span>{/* 휴대폰에서만 보이는 글자 (지도 위 단추 대신) */}
        </button>
      )}
      {/* 자동 투어: 처음 온 사람이 90초 안에 전체 그림을 보게 */}
      {inMap && data && <button className="lang-btn tour-btn" onClick={() => useAppStore.getState().startTour()} aria-label={t.tour.startTitle} title={t.tour.startTitle}>
        <Compass size={15} aria-hidden="true" /><span>{t.tour.start}</span>
      </button>}
      <ShareButton lang={lang} title={view === 'site' && site ? pickName(site, lang) : 'IREN'} />
      <button className="lang-btn" onClick={toggleLang} aria-label="language">
        <Languages size={15} /> {t.langToggle}
      </button>
      <MenuButton t={t} />
      </div>
    </header>
  )
}

// ≡ 메뉴 단추: 자주 보지 않는 것(지금은 갱신 기록)을 오른쪽 서랍에 숨겨 둠 — AppMenu.jsx
//   한 번 연 뒤로는 서랍을 붙여 둔 채 열고 닫기만 함 (다시 불러오지 않음)
function MenuButton({ t }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false) // 한 번이라도 열었나 (그 전엔 서랍 코드를 받지 않음)
  return (
    <>
      <button className="lang-btn menu-btn" onClick={() => { setLoaded(true); setOpen(true) }}
        aria-label={t.menu.open} title={t.menu.open} aria-haspopup="dialog" aria-expanded={open}>
        <Menu size={15} aria-hidden="true" />
      </button>
      {loaded && <Suspense fallback={null}><AppMenu open={open} onClose={() => setOpen(false)} /></Suspense>}
    </>
  )
}

// 하늘 모드 버튼: 낮 / 노을 / 밤 / 지금(그 부지의 현지 시각)
//   밤·노을로 바꾸면 "불 켜진 건물 = 가동 중"이라는 읽는 법을 5초 동안 말풍선으로 알려 줌
const SKY_ITEMS = [['day', Sun], ['dusk', Sunset], ['night', Moon], ['live', Clock]]
function SkyControl({ t, site }) {
  const mode = useAppStore((s) => s.skyMode)
  const setMode = useAppStore((s) => s.setSkyMode)
  const now = useNow(20000) // 현지 시각 표시는 20초마다 갱신
  const clock = localClock(now, { tz: site.tz, lng: site.lng })
  const [hint, setHint] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const pick = (m) => {
    setMode(m)
    clearTimeout(timer.current)
    setHint(m !== 'day')
    if (m !== 'day') timer.current = setTimeout(() => setHint(false), 5000)
  }
  // 좁은 화면용: 버튼 하나를 누를 때마다 낮 → 노을 → 밤 → 지금 순서로 바뀜 (상단 바가 화면 밖으로 넘치지 않게)
  const idx = SKY_ITEMS.findIndex(([m]) => m === mode)
  const [, CurIcon] = SKY_ITEMS[idx] ?? SKY_ITEMS[0]
  const next = SKY_ITEMS[(idx + 1) % SKY_ITEMS.length][0]
  const curText = mode === 'live' ? `${t.sky.live} ${clock}` : t.sky[mode]
  return (
    <div className="sky-control">
      <div className="camera-mode sky-mode" role="group" aria-label={t.sky.label}>
        {SKY_ITEMS.map(([m, Icon]) => {
          const text = m === 'live' ? `${t.sky.live} ${clock}` : t.sky[m]
          return (
            <button key={m} aria-pressed={mode === m} onClick={() => pick(m)} aria-label={text} title={m === 'live' ? `${t.sky.liveTitle} · ${clock}` : text}>
              <Icon size={15} aria-hidden="true" /><span className={m === 'live' ? 'sky-live' : undefined}>{text}</span>
            </button>
          )
        })}
      </div>
      <button className="lang-btn sky-cycle" onClick={() => pick(next)} aria-label={`${t.sky.label}: ${curText} → ${next === 'live' ? t.sky.live : t.sky[next]}`} title={`${t.sky.label}: ${curText}`}>
        <CurIcon size={15} aria-hidden="true" />{mode === 'live' && <span className="sky-live">{clock}</span>}
      </button>
      {hint && (
        <div className="sky-hint" role="status">
          <b>{curText} · {t.sky.hint}</b>
          <span><i style={{ background: AI_LIGHT }} />{t.sky.ai}<i style={{ background: MINER_LIGHT }} />{t.sky.mining}<em>{t.sky.pending}</em></span>
        </div>
      )}
    </div>
  )
}

// ms 마다 현재 시각을 새로 주는 훅 (시계 표시용)
function useNow(ms) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

// 공유 버튼: 지금 보는 화면(캠퍼스·날짜·탭이 주소에 들어 있음)의 링크를 공유
//   휴대폰처럼 공유 창(navigator.share)이 있으면 그걸 열고, 없으면 링크를 복사한 뒤 "복사됨"을 2초 표시
function ShareButton({ lang, title }) {
  const [copied, setCopied] = useState(false)
  const ko = lang === 'ko'
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share && window.matchMedia?.('(pointer: coarse)').matches) {
        await navigator.share({ title: `${title} · IREN 3D`, url })
        return
      }
      if (await copyText(url)) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        window.prompt(ko ? '이 주소를 복사하세요' : 'Copy this link', url) // 복사가 막힌 환경: 직접 복사하도록 주소를 보여 줌
      }
    } catch {
      // 휴대폰 공유 창을 닫은 경우 — 조용히 무시
    }
  }
  const label = copied ? (ko ? '링크 복사됨' : 'Link copied') : (ko ? '이 화면 공유' : 'Share this view')
  return (
    <button className={`lang-btn share-btn${copied ? ' is-copied' : ''}`} onClick={share} aria-label={label} title={label}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      <span>{copied ? (ko ? '복사됨' : 'Copied') : (ko ? '공유' : 'Share')}</span>
    </button>
  )
}

// 링크 복사: 최신 방식(clipboard API) → 막히면 예전 방식(숨긴 입력칸 + copy 명령). 성공하면 true
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(box)
    box.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    box.remove()
    return ok
  }
}
