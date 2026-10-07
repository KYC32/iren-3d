// 하단: 조작 힌트 + 비제휴 면책 + 공식 IR 링크
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { REPO_URL, OFFICIAL_IR } from '../config.js'

export default function Footer() {
  const t = useT()
  const view = useAppStore((s) => s.view)
  return (
    <footer className="footer">
      <div className="hint panel">{view === 'site' ? t.hintSite : t.hintGlobe}</div>
      <div className="disclaimer">
        {t.disclaimer}{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">{t.official}</a>
        {' · '}
        <a href={OFFICIAL_IR} target="_blank" rel="noreferrer">IREN IR</a>
      </div>
    </footer>
  )
}
