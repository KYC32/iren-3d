// 하단: 조작 힌트 + 비제휴 면책 + 공식 IR 링크
//   본사 3D 화면은 동네 그림이 화면 오른쪽 아래 끝까지 차서 세 줄짜리 면책 문구가 그림을 가림
//   → 한 줄 짧은 문구 (긴 문구는 마우스를 올리면 보이고, '데이터·출처' 링크에도 있음)
// '데이터·출처' 는 ≡ 메뉴 서랍의 '데이터·출처' 칸을 엶 (예전엔 GitHub 저장소로 감 — 2026-10-27)
//   본사 화면의 동네 모양은 OpenStreetMap 자료 → ODbL 출처 표기 '© OpenStreetMap contributors' 를 붙임
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { OFFICIAL_IR } from '../config.js'
import { openMenu } from './menuEvents.js'

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
        <button type="button" className="link-btn" onClick={() => openMenu('sources')}>{t.official}</button>
        {' · '}
        <a href={OFFICIAL_IR} target="_blank" rel="noreferrer">IREN IR</a>
        {short && <>{' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></>}
      </div>
    </footer>
  )
}
