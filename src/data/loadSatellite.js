// 위성 사진 목록(public/data/satellite.json)을 한 번만 받아 둠 — 캠퍼스 패널 '위성으로 본 변화'와 현황 페이지가 함께 씀
//   실패하면 null (칸을 그리지 않음). 부지를 바꾸거나 화면을 다시 열어도 다시 받지 않음
let pending = null
export const loadSatellite = () => (pending ??= fetch('/data/satellite.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))
