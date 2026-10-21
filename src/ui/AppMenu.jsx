// =============================================================
// AppMenu — 상단 바 ≡ 단추로 여는 메뉴 서랍 (화면 오른쪽에서 열림)
// -------------------------------------------------------------
// 맨 위 "경영진 발언" 바로가기 (어느 화면에서든 시드니 본사 3D 화면으로 — useAppStore.showHq, 2026-10-21 사용자 요청)
// 그 아래 자주 보지 않는 "갱신 기록"(데이터가 바뀔 때마다 남기는 기록)
//   예전엔 지도 왼쪽 패널의 탭이었음 → 사용자 요청으로 메뉴 안으로 숨김 (2026-10-17)
// 처음 열 때만 불러옴(TopBar 의 React.lazy) → 이 파일·스타일·ChangeLog 가 첫 화면 번들에 안 들어감
// <dialog> + showModal() 을 쓰는 이유: Esc 로 닫힘, 뒤 화면은 눌리지 않음,
//   닫으면 초점이 ≡ 단추로 돌아감 — 모두 브라우저 기본 동작 (FigureDialog 와 같은 방식)
// =============================================================
import { useEffect, useRef } from 'react'
import { History, X, Building2 } from 'lucide-react'
import { useT } from '../i18n/useT.js'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js' // '경영진 발언' 바로가기 문구
import ChangeLog from './ChangeLog.jsx'
import './appMenu.css'

export default function AppMenu({ open, onClose }) {
  const t = useT()
  const hq = hqText[useAppStore((s) => s.lang) === 'ko' ? 'ko' : 'en']
  const dialog = useRef(null)
  // open 값에 맞춰 서랍을 열고 닫음 (Esc 로 닫히면 onCancel·onClose 로 알려 줌)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      className="app-menu"
      aria-labelledby="app-menu-title"
      onCancel={onClose}
      onClose={onClose}
      // 서랍 바깥(어두운 뒷배경)을 누르면 닫힘: 안쪽 내용(.app-menu-body)이 서랍을 꽉 채우므로
      // 눌린 대상이 dialog 자신이면 = 뒷배경을 누른 것
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="app-menu-body">
        <div className="app-menu-head">
          <b id="app-menu-title">{t.menu.title}</b>
          <button type="button" onClick={onClose} aria-label={t.menu.close} title={t.menu.close}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {/* 경영진 발언 바로가기: 서랍을 닫고 지도로 돌아와 시드니 본사 칸을 엶 */}
        <button type="button" className="app-menu-link" onClick={() => { onClose(); useAppStore.getState().showHq() }}>
          <Building2 size={16} aria-hidden="true" />
          <span><b>{hq.menuEntry}</b><small>{hq.menuSub}</small></span>
        </button>
        {/* 갱신 기록: 날짜별 변경 내용 + 출처 링크 (data/changelog.json 그대로) */}
        <section className="app-menu-section" aria-labelledby="app-menu-log">
          <h3 id="app-menu-log"><History size={14} aria-hidden="true" />{t.changelog.tab}</h3>
          <ChangeLog />
        </section>
      </div>
    </dialog>
  )
}
