// =============================================================
// figureState.js — "그림 대화상자"가 지금 어떤 그림을 여는지 (3D 화면의 건물 클릭 → FigureLayer)
// 첫 화면 상태 저장소(useAppStore)와 따로 둠 → 3D 화면 묶음에만 들어가 첫 화면 번들이 늘지 않음
//   name = 그림 이름 (예: 'power-block'), null = 닫힘
//   mode = 보기: 'figure'(그림 페이지) | '3d'(3D 모형 확대 창 — 모형이 있는 그림만), null = 그림부터
// =============================================================
import { create } from 'zustand'

export const useFigure = create(() => ({ name: null, mode: null }))
export const openFigure = (name, mode = null) => useFigure.setState({ name, mode })
export const closeFigure = () => useFigure.setState({ name: null, mode: null })
export const setFigureMode = (mode) => useFigure.setState({ mode })
