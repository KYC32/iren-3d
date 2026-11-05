// 새 배포 뒤 옛 페이지가 이미 지워진 조각(청크)을 부르면 빈 화면이 됨 → 한 번만 새로고침해 새 빌드를 받음
//   storage: sessionStorage, build: 지금 빌드 이름(index-해시.js), reload: 새로고침 함수
//   같은 빌드로 이미 새로고침했는데 또 실패하면 멈춤(무한 새로고침 방지). 새 배포면 다시 한 번 허용
export function reloadOnce(storage, build, reload) {
  try {
    if (storage.getItem('chunk-reload') === build) return false
    storage.setItem('chunk-reload', build)
  } catch {
    return false // 저장소를 못 쓰면 반복을 막을 수 없으니 새로고침하지 않음
  }
  reload()
  return true
}
