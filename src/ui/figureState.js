// =============================================================
// figureState.js — "그림 대화상자"가 지금 어떤 그림을 여는지 (3D 화면의 건물 클릭 → FigureLayer)
// 첫 화면 상태 저장소(useAppStore)와 따로 둠 → 3D 화면 묶음에만 들어가 첫 화면 번들이 늘지 않음
// =============================================================
import { create } from 'zustand'

export const useFigure = create(() => ({ name: null }))   // name = 그림 이름 (예: 'power-block'), null = 닫힘
export const openFigure = (name) => useFigure.setState({ name })
export const closeFigure = () => useFigure.setState({ name: null })
