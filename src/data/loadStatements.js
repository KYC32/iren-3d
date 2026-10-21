// =============================================================
// loadStatements.js — 경영진 발언 자료(public/data/statements.json)를 한 번만 받기
// -------------------------------------------------------------
// 지도 본사 카드(사진·새 발언 수)와 "경영진 발언" 칸이 함께 씀 — 처음 부른 쪽이 받고, 다음부터는 같은 결과
// 첫 화면에 바로 받지 않음: 본사 카드가 화면에 들어오거나 칸이 열릴 때만 (지도 첫 화면은 북미라 시드니가 안 보임)
// 못 받으면(오프라인·404) null → 카드는 배지 없이, 칸은 "발언 자료를 불러오지 못했습니다" (다음에 부르면 다시 받음)
// (SiteFacts.jsx 의 관찰 자료 받기와 같은 방식)
// =============================================================
let loaded = null   // 받은 자료 (아직이거나 실패면 null)
let pending = null  // 받는 중인 약속(Promise) — 두 번 불러도 요청은 한 번

export const loadStatements = () => (pending ??= fetch('/data/statements.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
  .then((file) => {
    loaded = file
    if (!file) pending = null // 못 받았으면 다음에 부를 때 다시 시도 (칸을 닫았다 열면 재시도)
    return file
  }))

// 이미 받은 자료 (없으면 null) — 화면이 처음 그려질 때 기다리지 않고 바로 쓰려고
export const peekStatements = () => loaded
