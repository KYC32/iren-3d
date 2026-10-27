// =============================================================
// loadHqCity.js — 본사 3D 화면의 실제 동네 자료(public/data/hq-city.json — OpenStreetMap · ODbL)를 한 번만 받아 배치까지 계산
// -------------------------------------------------------------
// 본사 화면에 들어갈 때 CameraRig(카메라 맞춤 — 탑 윤곽)와 HqView(빌딩·동네)가 함께 씀 — 처음 부른 쪽이 받음
// 받은 자료는 scene/hqCity.js 의 hqCityLayout 으로 화면 좌표 배치까지 한 번만 계산해 둠
//   hqCity.js 는 여기서 나중에 불러옴 → 카메라(CameraRig, 3D 첫 묶음)가 이 파일을 불러도 배치 계산 코드는 본사 화면에서만 받음
// 못 받으면(오프라인·404) null → 빌딩은 정사각형 기본 모양, 동네 없이 바닥 판만 (다음에 부르면 다시 받음)
// (loadStatements.js 와 같은 방식)
// =============================================================
let layout = null   // 계산한 배치 (아직이거나 실패면 null)
let pending = null  // 받는 중인 약속(Promise) — 두 번 불러도 요청은 한 번

export const loadHqCity = () => (pending ??= Promise.all([
  fetch('/data/hq-city.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  import('../scene/hqCity.js'),
])
  .catch(() => [null, null])
  .then(([file, mod]) => {
    try { layout = file && mod ? mod.hqCityLayout(file) : null } catch { layout = null } // 자료 모양이 틀려도 화면은 기본 모양으로
    if (!layout) pending = null // 못 받았으면 다음에 부를 때 다시 시도
    return layout
  }))

// 이미 계산한 배치 (없으면 null) — 카메라·화면이 기다리지 않고 바로 쓰려고
export const peekHqCity = () => layout
