// =============================================================
// figureViewers.js — 그림마다 붙는 "3D 모형" 확대 창 목록 (그림 이름 → 지연 로딩 컴포넌트)
//   3D 화면 묶음(FigureLayer)이 올라올 때 채움 → 3D 화면에서는 어느 단추로 그림 창을 열든 "3D 모형" 탭이 생김
//   그림 창(FigureDialog)이 확대 창을 직접 import 하지 않는 까닭: 그림 창은 첫 화면 캠퍼스 패널의 그림 단추로도
//   열려서, 그 경로에 three.js·R3F 가 걸리면 빌드가 공용 조각을 첫 화면 묶음에서 떼어 내 첫 화면이 조금 무거워짐
// =============================================================
const viewers = {}
export const registerFigureViewer = (name, component) => {
  viewers[name] = component
}
export const figureViewer = (name) => viewers[name] ?? null
