// =============================================================
// FigureLayer — 3D 화면에서 건물을 눌러 연 그림 대화상자 (Scene 옆 DOM 층, 3D 묶음과 함께 불러옴)
//   보기(그림 / 3D 모형)도 figureState 에 둬서, 캠퍼스의 "가까이 보기" 단추가 3D 보기로 바로 열 수 있음
// =============================================================
import { lazy } from 'react'
import FigureDialog from './FigureDialog.jsx'
import { useFigure, closeFigure, setFigureMode } from './figureState.js'
import { registerFigureViewer } from './figureViewers.js'
import { useAppStore } from '../store/useAppStore.js'

// 3D 화면에서만: Horizon 홀 그림 창에 "3D 모형" 탭 (Blender 모형 확대 보기 — 탭을 누를 때만 받음)
registerFigureViewer('horizon-hall', lazy(() => import('../scene/viewer/HorizonViewer.jsx')))

export default function FigureLayer() {
  const name = useFigure((s) => s.name)
  const mode = useFigure((s) => s.mode)
  const lang = useAppStore((s) => s.lang)
  return <FigureDialog name={name} lang={lang} mode={mode} onMode={setFigureMode} onClose={closeFigure} />
}
