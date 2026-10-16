// =============================================================
// FigureDialog — 그림 페이지(public/figures/<이름>.<ko|en>.html)를 대화상자로 보여 줌
//   그림은 scripts/anatomy 가 만든 정적 페이지라 앱 번들과 섞이지 않고, 열려 있을 때만 iframe 을 둠
//   (닫으면 iframe 을 지워 그림의 움직임도 멈춤). 캠퍼스 패널 단추와 3D 건물 클릭이 함께 씀
// =============================================================
import { useEffect, useRef } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import './figureDialog.css'

// 그림마다 대화상자 제목 (그림 이름은 데이터의 figure 값)
export const FIGURES = {
  'power-block': { ko: '세그먼트 1칸(2.5MW)의 전력 경로 · 공랭 홀 안', en: 'Inside one 2.5MW segment · power path and air-cooled hall' },
}

export default function FigureDialog({ name, lang, onClose }) {
  const ko = lang === 'ko'
  const dialog = useRef(null)
  // name 이 생기면 열고, 없어지면 닫음 (Esc·닫기 단추로 닫히면 onClose 로 알려 줌)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (name && !d.open) d.showModal()
    if (!name && d.open) d.close()
  }, [name])
  const src = name ? `/figures/${name}.${ko ? 'ko' : 'en'}.html` : ''
  const title = name ? (FIGURES[name]?.[ko ? 'ko' : 'en'] ?? name) : ''
  return (
    <dialog ref={dialog} className="facts-figure" aria-label={title} onCancel={onClose} onClose={onClose}>
      <div className="facts-figure-head">
        <b>{title}</b>
        {name && <a href={src} target="_blank" rel="noreferrer">{ko ? '새 창' : 'New tab'}<ArrowUpRight size={12} aria-hidden="true" /></a>}
        <button type="button" autoFocus onClick={onClose} aria-label={ko ? '닫기' : 'Close'}><X size={16} aria-hidden="true" /></button>
      </div>
      {name && <iframe src={src} title={title} />}
    </dialog>
  )
}
