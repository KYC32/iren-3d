// =============================================================
// SiteGoneNotice — 날짜를 옮겨 보던 캠퍼스가 "아직 발표 전"이 되어 지도로 나왔을 때 이유를 알려 주는 안내
// -------------------------------------------------------------
// 지도 화면은 늘 기준일 모습이라, 사용자가 고른 날짜와 보던 캠퍼스가 말없이 사라진 것처럼 보였음.
// store.siteGoneNotice = { siteId, month } 가 있으면 화면 아래에 한 줄 안내를 띄우고 8초 뒤 저절로 닫음.
// 캠퍼스를 다시 열면(enterSite3D·focusSiteOnMap·selectSite) store 가 안내를 지움.
// =============================================================
import { useEffect } from 'react'
import { Info, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { pickName } from '../i18n/useT.js'
import { monthLabel } from '../data/timeline.js'
import './siteGoneNotice.css'

const AUTO_HIDE_MS = 8000

export default function SiteGoneNotice() {
  const notice = useAppStore((s) => s.siteGoneNotice)
  const lang = useAppStore((s) => s.lang)
  const asOf = useAppStore((s) => s.asOfMonth)
  // 지도는 기준일 데이터라 캠퍼스가 다시 들어 있음 → 이름을 여기서 찾음 (못 찾으면 id 그대로)
  const site = useAppStore((s) => s.data?.sites.find((x) => x.id === notice?.siteId))
  const clear = useAppStore((s) => s.clearSiteGoneNotice)

  // 일정 시간 뒤 저절로 닫힘 (새 안내가 오면 타이머를 다시 셈)
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(clear, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [notice, clear])

  if (!notice) return null
  const name = site ? pickName(site, lang) : notice.siteId
  const when = monthLabel(notice.month, lang)
  const text = lang === 'ko'
    ? `${name} — ${when}에는 아직 발표 전이라 지도로 돌아왔습니다. 지도는 기준일(${monthLabel(asOf, lang)}) 모습입니다.`
    : `${name} wasn't announced yet in ${when}, so you're back on the map (shown as of ${monthLabel(asOf, lang)}).`
  return (
    <div className="site-gone-notice panel" role="status">
      <Info size={15} aria-hidden="true" />
      <span>{text}</span>
      <button type="button" onClick={clear} aria-label={lang === 'ko' ? '안내 닫기' : 'Dismiss'} title={lang === 'ko' ? '안내 닫기' : 'Dismiss'}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
