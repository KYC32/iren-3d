import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { trimMaplibreCss } from './maplibre-css.mjs'

it('안 쓰는 컨트롤 규칙만 지우고 나머지는 글자 그대로 둠 (선택자 목록·@media 안쪽·애니메이션 포함)', () => {
  // maplibre-gl.css 와 같은 꼴(압축된 한 줄)로 만든 작은 예시
  const css = '.maplibregl-map{overflow:hidden}'
    + '.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg%3E")}'
    + 'a.maplibregl-ctrl-logo{background-image:url("data:logo")}'
    + '.maplibregl-canvas-container.maplibregl-interactive,.maplibregl-ctrl-group button.maplibregl-ctrl-compass{cursor:grab}'
    + '@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{x:1}.maplibregl-ctrl button.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon{x:2}}'
    + '@media(forced-colors:active){a.maplibregl-ctrl-logo{x:3}}'
    + '.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-waiting .maplibregl-ctrl-icon{animation:maplibregl-spin 2s linear infinite}'
    + '@keyframes maplibregl-spin{0%{transform:rotate(0)}to{transform:rotate(1turn)}}'
    + '.maplibregl-ctrl-group:not(:empty){box-shadow:0 0 0 2px red}'
    + '.maplibregl-popup{display:flex}'
  expect(trimMaplibreCss(css)).toBe('.maplibregl-map{overflow:hidden}'
    + '.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg%3E")}'
    + '.maplibregl-canvas-container.maplibregl-interactive{cursor:grab}'
    + '@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{x:1}}'
    + '.maplibregl-ctrl-group:not(:empty){box-shadow:0 0 0 2px red}')
})

it('아직 쓰는 규칙이 가리키는 애니메이션(@keyframes)은 남김', () => {
  const css = '.maplibregl-marker{animation:pulse 1s}@keyframes pulse{to{opacity:0}}'
  expect(trimMaplibreCss(css)).toBe(css)
})

it('실제 maplibre-gl.css: 지도가 만드는 단추·출처·마커 규칙은 원본 그대로 남고, 안 쓰는 컨트롤 규칙은 모두 빠짐', () => {
  const original = readFileSync(new URL('../../node_modules/maplibre-gl/dist/maplibre-gl.css', import.meta.url), 'utf8')
  const trimmed = trimMaplibreCss(original)
  // 원본에서 규칙 하나를 그대로 잘라 옴 (선택자부터 닫는 중괄호까지)
  const ruleOf = (selector) => {
    const start = original.indexOf(selector + '{')
    expect(start, selector).toBeGreaterThanOrEqual(0)
    return original.slice(start, original.indexOf('}', start) + 1)
  }
  // GeoMap 이 쓰는 것: 확대·축소 단추(NavigationControl), 접힌 출처 표시(attributionControl compact), HTML 마커, Shift+드래그 확대 상자
  for (const selector of [
    '.maplibregl-map',
    '.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon',
    '.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon',
    '.maplibregl-ctrl-attrib-button',
    '.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button',
    '.maplibregl-marker',
    '.maplibregl-boxzoom',
  ]) expect(trimmed).toContain(ruleOf(selector))
  // 이 앱이 만들지 않는 컨트롤의 흔적은 하나도 없어야 함
  expect(trimmed).not.toMatch(/maplibregl-(ctrl-logo|ctrl-geolocate|ctrl-fullscreen|ctrl-shrink|ctrl-compass|ctrl-globe|ctrl-terrain|ctrl-scale|popup|user-location|cooperative-gesture|pseudo-fullscreen|spin)/)
  // 중괄호 짝이 맞아야 CSS 가 깨지지 않음
  expect(trimmed.split('{').length).toBe(trimmed.split('}').length)
})
