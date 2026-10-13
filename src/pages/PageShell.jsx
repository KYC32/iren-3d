// =============================================================
// PageShell — 주가·뉴스 페이지의 공통 틀: 지도 위를 덮는 스크롤 영역 + 하단 면책 문구
// body 가 overflow:hidden 이라 페이지 스스로 스크롤합니다 (.page-scroll)
// =============================================================
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { REPO_URL, OFFICIAL_IR } from '../config.js'
import './pages.css'

export default function PageShell({ children, className = '' }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  return (
    <section className={`page-scroll panel ${className}`}>
      {children}
      <p className="page-disclaimer">
        {lang === 'ko' ? '비공식 리서치 · 투자 조언이 아닙니다 · ' : 'Independent research · not investment advice · '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">{t.official}</a>{' · '}
        <a href={OFFICIAL_IR} target="_blank" rel="noreferrer">IREN IR</a>
      </p>
    </section>
  )
}
