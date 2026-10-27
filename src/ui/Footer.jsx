// 하단: 조작 힌트 + 비제휴 면책 + 공식 IR 링크
//   본사 3D 화면은 동네 그림이 화면 오른쪽 아래 끝까지 차서 세 줄짜리 면책 문구가 그림을 가림
//   → 한 줄 짧은 문구 (긴 문구는 마우스를 올리면 보이고, '데이터·출처' 링크에도 있음)
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { REPO_URL, OFFICIAL_IR } from '../config.js'

export default function Footer() {
  const t = useT()
  const view = useAppStore((s) => s.view)
  const dragMode = useAppStore((s) => s.campusDragMode)
  const short = view === 'hq'
  return (
    <footer className="footer">
      <div className="hint panel">{view === 'site' || view === 'hq' ? (dragMode==='pan'?t.hintSitePan:t.hintSite) : t.hintGlobe}</div>
      <div className={`disclaimer${short ? ' is-short' : ''}`} title={short ? t.disclaimer : undefined}>
        {short ? t.disclaimerShort : t.disclaimer}{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">{t.official}</a>
        {' · '}
        <a href={OFFICIAL_IR} target="_blank" rel="noreferrer">IREN IR</a>
      </div>
    </footer>
  )
}
