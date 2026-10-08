// 상단 바: 제목·기준일 / 뒤로가기 / 공유 / 한영 토글
import { useState } from 'react'
import { ArrowLeft, Languages, Server, ListOrdered, Maximize2, Move, Rotate3D, Share2, Check } from 'lucide-react'
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
  const dragMode = useAppStore((s) => s.campusDragMode)
  const setDragMode = useAppStore((s) => s.setCampusDragMode)

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
      {view === 'site' && surface==='3d' && <div className="camera-mode" role="group" aria-label={t.campus.controls}>
        <button aria-pressed={dragMode==='rotate'} aria-label={t.campus.rotateLabel} title={t.campus.rotateLabel} onClick={()=>setDragMode('rotate')}><Rotate3D size={15}/><span>{t.campus.rotate}</span></button>
        <button aria-pressed={dragMode==='pan'} aria-label={t.campus.panLabel} title={t.campus.panLabel} onClick={()=>setDragMode('pan')}><Move size={15}/><span>{t.campus.pan}</span></button>
      </div>}
      {view === 'site' && surface==='3d' && <button className="lang-btn home-btn" onClick={() => useAppStore.getState().requestCampusHome()} aria-label={t.campus.home} title={t.campus.home}>
        <Maximize2 size={15} /><span>{t.campus.home}</span>
      </button>}
      {surface === 'map' && (
        <button className="icon-btn sheet-btn" onClick={toggleSheet} aria-label={lang==='ko'?'캠퍼스 목록':'Campus list'} title={lang==='ko'?'캠퍼스 목록':'Campus list'}>
          <ListOrdered size={17} />
        </button>
      )}
      <ShareButton lang={lang} title={view === 'site' && site ? pickName(site, lang) : 'IREN'} />
      <button className="lang-btn" onClick={toggleLang} aria-label="language">
        <Languages size={15} /> {t.langToggle}
      </button>
      </div>
    </header>
  )
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
