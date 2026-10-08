// =============================================================
// bundle-size.mjs — 진입점에서 시작해 함께 받아야 하는 번들 파일 목록 모으기
// -------------------------------------------------------------
// Vite 빌드가 만드는 manifest.json 에는 파일마다 "이 파일이 정적으로 import 하는 다른 파일"이 적혀 있습니다.
// 진입점(roots)에서 출발해 그 import 를 줄줄이 따라가며 필요한 .js·.css 파일을 모읍니다.
// 동적 import(지연 로딩)는 따라가지 않으므로, 지연 로딩되는 부분을 세려면 그 파일을 roots 에 직접 넣어야 합니다.
// check-size.mjs 가 이 목록으로 gzip 크기를 잽니다.
// =============================================================
// manifest의 정적 의존성을 순회합니다. 중복·순환 import는 한 번만 계산합니다.
// manifest: dist/.vite/manifest.json 내용, roots: 출발할 진입점 키 목록 (예: 'index.html')
// 결과: 겹치지 않는 파일 경로 배열
export function collectChunks(manifest, roots) {
  // seen: 이미 방문한 manifest 항목 (순환 import 에서 무한 반복 방지), files: 모은 파일
  const seen = new Set()
  const files = new Set()
  function visit(key) {
    if (seen.has(key)) return
    const entry = manifest[key]
    // 진입점 이름이 틀렸거나 빌드 구성이 바뀐 경우 — 조용히 넘어가지 말고 바로 알림
    if (!entry) throw new Error(`번들 manifest에 없는 진입점: ${key}`)
    seen.add(key)
    // 이 항목의 JS 파일 + 딸린 CSS·자산 중 .js/.css 만 크기 계산 대상 (이미지 등은 제외)
    if (entry.file.endsWith('.js')) files.add(entry.file)
    for (const file of [...(entry.css ?? []), ...(entry.assets ?? [])]) if (/\.(js|css)$/.test(file)) files.add(file)
    // 정적 import 한 파일들도 따라가서 같은 일을 반복 (재귀)
    for (const dependency of entry.imports ?? []) visit(dependency)
  }
  roots.forEach(visit)
  return [...files]
}
