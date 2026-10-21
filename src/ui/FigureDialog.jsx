// =============================================================
// FigureDialog — 그림 페이지(public/figures/<이름>.<ko|en>.html)를 대화상자로 보여 줌
//   그림은 scripts/anatomy 가 만든 정적 페이지라 앱 번들과 섞이지 않고, 열려 있을 때만 iframe 을 둠
//   (닫으면 iframe 을 지워 그림의 움직임도 멈춤). 캠퍼스 패널 단추와 3D 건물 클릭이 함께 씀
//   3D 모형 확대 창이 등록된 그림(figureViewers.js — 3D 화면에서만)은 머리줄에 "그림 | 3D 모형" 탭
// =============================================================
import { Suspense, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Box, PencilRuler, X } from 'lucide-react'
import { figureViewer } from './figureViewers.js'
import './figureDialog.css'

// 그림마다 대화상자 제목 (그림 이름은 데이터의 figure 값)
export const FIGURES = {
  'power-block': { ko: '세그먼트 1칸(2.5MW)의 전력 경로 · 공랭 홀 안', en: 'Inside one 2.5MW segment · power path and air-cooled hall' },
  'horizon-hall': { ko: 'Horizon 액체냉각 홀 · 전기와 냉각수가 도는 길', en: 'Horizon liquid-cooled hall · power and coolant paths' },
  'sweetwater-1': { ko: '스위트워터 1 · 변전소에서 액체냉각 홀까지', en: 'Sweetwater 1 · from substation to liquid-cooled hall' },
}

// view = 그림 페이지를 어떤 보기로 열지 (주소 끝 #view, 예: 'obs' = 전력 경로 그림의 9/23 관찰 보기). 없으면 기본 보기
// mode·onMode = "그림 | 3D 모형" 탭 (FigureLayer 처럼 바깥에서 쥐면 그 값, 아니면 이 대화상자가 스스로 기억)
export default function FigureDialog({ name, lang, view, mode, onMode, onClose }) {
  const ko = lang === 'ko'
  const dialog = useRef(null)
  const [ownMode, setOwnMode] = useState(null)
  useEffect(() => setOwnMode(null), [name])   // 다른 그림을 열면 그림 보기부터
  // name 이 생기면 열고, 없어지면 닫음 (Esc·닫기 단추로 닫히면 onClose 로 알려 줌)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (name && !d.open) d.showModal()
    if (!name && d.open) d.close()
  }, [name])
  const Viewer = name ? figureViewer(name) : null   // 3D 모형 확대 창 (등록된 그림만, 탭을 누를 때 받음)
  const show3d = Boolean(Viewer) && (onMode ? mode : ownMode) === '3d'
  const setMode = onMode ?? setOwnMode
  const src = name ? `/figures/${name}.${ko ? 'ko' : 'en'}.html${view ? `#${view}` : ''}` : ''
  const title = name ? (FIGURES[name]?.[ko ? 'ko' : 'en'] ?? name) : ''
  return (
    <dialog ref={dialog} className="facts-figure" aria-label={title} onCancel={onClose} onClose={onClose}>
      <div className="facts-figure-head">
        <b>{title}</b>
        {Viewer && (
          <div className="facts-figure-tabs" role="tablist" aria-label={ko ? '보기' : 'View'}>
            <button type="button" role="tab" aria-selected={!show3d} onClick={() => setMode('figure')}>
              <PencilRuler size={13} aria-hidden="true" />{ko ? '그림' : 'Drawing'}
            </button>
            <button type="button" role="tab" aria-selected={show3d} onClick={() => setMode('3d')}>
              <Box size={13} aria-hidden="true" />{ko ? '3D 모형' : '3D model'}
            </button>
          </div>
        )}
        {name && !show3d && <a href={src} target="_blank" rel="noreferrer">{ko ? '새 창' : 'New tab'}<ArrowUpRight size={12} aria-hidden="true" /></a>}
        <button type="button" autoFocus onClick={onClose} aria-label={ko ? '닫기' : 'Close'}><X size={16} aria-hidden="true" /></button>
      </div>
      {name && !show3d && <iframe src={src} title={title} />}
      {show3d && (
        <Suspense fallback={<div className="facts-figure-wait">{ko ? '3D 모형 화면을 여는 중…' : 'Opening the 3D model…'}</div>}>
          <Viewer lang={lang} />
        </Suspense>
      )}
    </dialog>
  )
}
