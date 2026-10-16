// =============================================================
// maplibre-css.mjs — maplibre-gl.css 에서 이 앱이 쓰지 않는 컨트롤의 규칙 빼기
// -------------------------------------------------------------
// maplibre-gl.css(약 83KB)의 4분의 3 은 단추 그림(SVG 를 글자로 넣은 data URI)입니다.
// 그중 MapLibre 로고(3벌)와 내 위치·전체화면·지구본·지형·나침반 단추 그림은
// 이 앱(src/map/GeoMap.jsx)이 그 컨트롤을 만들지 않아 화면에 한 번도 나오지 않습니다.
// vite.config.js 가 빌드(와 개발 서버)에서 CSS 를 처리하기 전에 이 함수로 그 규칙만 지웁니다
// → 실제 지도 첫 화면이 gzip 으로 약 8.5 KiB 가벼워짐. 남는 규칙은 한 글자도 바꾸지 않습니다.
// 지도에 새 컨트롤(말풍선 Popup, 내 위치 GeolocateControl 등)을 쓰게 되면 아래 목록에서 그 이름을 지우세요.
// =============================================================

// 지울 기능 — 클래스 이름에서 'maplibregl-' 뒤에 오는 부분
export const UNUSED_FEATURES = [
  'ctrl-logo', // MapLibre 로고 (maplibreLogo 옵션 꺼짐) — 그림 3벌이 CSS 의 절반 이상
  'ctrl-geolocate', 'user-location', // 내 위치 단추와 지도 위 파란 점 (GeolocateControl 안 씀)
  'ctrl-fullscreen', 'ctrl-shrink', 'pseudo-fullscreen', // 전체화면 단추 (FullscreenControl 안 씀)
  'ctrl-compass', // 나침반 (NavigationControl 을 showCompass:false 로 만들어 확대·축소 단추만 있음)
  'ctrl-globe', 'ctrl-terrain', // 지구본·지형 단추
  'ctrl-scale', // 축척 막대
  'popup', // 말풍선 (캠퍼스 표시는 직접 만든 HTML 마커 카드)
  'cooperative-gesture', // "두 손가락으로 움직이세요" 안내 (cooperativeGestures 꺼짐)
]

// CSS 를 최상위 덩어리(규칙 하나, 또는 @media 블록 하나)로 자름 — 중괄호 깊이가 0 으로 돌아오는 곳이 끝
function blocks(css) {
  const out = []
  let depth = 0, start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1 }
  }
  return out
}

// css: maplibre-gl.css 원문 → 안 쓰는 규칙을 뺀 CSS 문자열
export function trimMaplibreCss(css, unused = UNUSED_FEATURES) {
  const isUnused = new RegExp(`maplibregl-(${unused.join('|')})`)
  // 규칙 하나 거르기: 선택자 목록(쉼표로 나뉜 것) 중 안 쓰는 것만 빼고, 모두 빠지면 규칙째 없앰
  const keepRule = (rule) => {
    const brace = rule.indexOf('{')
    const selectors = rule.slice(0, brace).split(',').filter((s) => !isUnused.test(s))
    return selectors.length ? selectors.join(',') + rule.slice(brace) : ''
  }
  const kept = blocks(css).map((block) => {
    if (block.startsWith('@keyframes')) return block // 애니메이션은 아래에서 따로 판단
    if (block.startsWith('@')) {
      // @media 등: 안쪽 규칙을 하나씩 거르고, 모두 빠지면 블록째 없앰
      const brace = block.indexOf('{')
      const inner = blocks(block.slice(brace + 1, -1)).map(keepRule).join('')
      return inner ? block.slice(0, brace + 1) + inner + '}' : ''
    }
    return keepRule(block)
  })
  // 애니메이션(@keyframes)은 남은 규칙이 아직 이름을 부르는 것만 남김 (예: 내 위치 단추가 돌던 maplibregl-spin 은 빠짐)
  const rules = kept.filter((b) => !b.startsWith('@keyframes')).join('')
  const animationName = (b) => b.slice('@keyframes'.length, b.indexOf('{')).trim()
  return kept.filter((b) => !b.startsWith('@keyframes') || rules.includes(animationName(b))).join('')
}
