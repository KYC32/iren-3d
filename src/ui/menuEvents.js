// =============================================================
// menuEvents — ≡ 메뉴 서랍을 다른 곳에서 여는 신호 (화면 아래 '데이터·출처' 링크 → 서랍의 '데이터·출처' 칸)
// -------------------------------------------------------------
// 서랍은 상단 바의 MenuButton(TopBar.jsx)이 열고 닫음. 스토어에 상태를 더하지 않고
//   브라우저 이벤트 하나로 알림 → 첫 화면 코드가 거의 늘지 않음 (첫 화면 묶음 예산이 빠듯함)
// =============================================================
export const MENU_EVENT = 'iren-menu'

// section: 펼쳐서 보여 줄 칸 이름 ('sources' = 데이터·출처) · 없으면 서랍만 엶
export const openMenu = (section = null) => window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: section }))
