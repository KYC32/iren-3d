// =============================================================
// FigureLayer — 3D 화면에서 건물을 눌러 연 그림 대화상자 (Scene 옆 DOM 층, 3D 묶음과 함께 불러옴)
// =============================================================
import FigureDialog from './FigureDialog.jsx'
import { useFigure, closeFigure } from './figureState.js'
import { useAppStore } from '../store/useAppStore.js'

export default function FigureLayer() {
  const name = useFigure((s) => s.name)
  const lang = useAppStore((s) => s.lang)
  return <FigureDialog name={name} lang={lang} onClose={closeFigure} />
}
