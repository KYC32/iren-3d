// =============================================================
// PageShell — 주가·뉴스 페이지의 공통 틀: 지도 위를 덮는 스크롤 영역 + 하단 면책 문구
// body 가 overflow:hidden 이라 페이지 스스로 스크롤합니다 (.page-scroll)
// '데이터·출처' 는 ≡ 메뉴 서랍의 '데이터·출처' 칸을 엶 (menuEvents.openMenu)
// =============================================================
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { OFFICIAL_IR } from '../config.js'
import { openMenu } from '../ui/menuEvents.js'
import './pages.css'

export default function PageShell({ children, className = '' }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  return (
    <section className={`page-scroll panel ${className}`}>
      {children}
      <p className="page-disclaimer">
        {lang === 'ko' ? '비공식 리서치 · 투자 조언이 아닙니다 · ' : 'Independent research · not investment advice · '}
        <button type="button" className="link-btn" onClick={() => openMenu('sources')}>{t.official}</button>{' · '}
        <a href={OFFICIAL_IR} target="_blank" rel="noreferrer">IREN IR</a>
      </p>
    </section>
  )
}
