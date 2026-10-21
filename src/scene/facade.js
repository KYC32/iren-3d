// =============================================================
// facade.js — 본사 화면 빌딩 벽의 창문 그림 (캔버스로 한 번 그려 모든 벽이 나눠 씀)
// -------------------------------------------------------------
// 그림 한 칸 = 창문 4열 × 4층 (가로 2.4 · 세로 2.72 = 사무 층 높이 0.68 × 4) → 벽 크기만큼 반복(repeat)해 붙임
// 두 장을 만듦: map(낮에 보이는 유리·창틀·층 띠) + emissiveMap(밤에 켜지는 창문만 — 나머지는 검정)
//   밤 밝기는 HqView 가 SkyRig 의 SKY.lights(0~1) 로 매 프레임 emissiveIntensity 를 바꿈
// 켜지는 창문은 시드 고정 난수 → 새로 고쳐도 같은 창문이 켜짐
// =============================================================
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, MeshStandardMaterial } from 'three'

export const TILE_W = 2.4   // 그림 한 칸의 가로 (창문 4개)
export const TILE_H = 2.72  // 그림 한 칸의 세로 (사무 층 4개 = 0.68 × 4)

// 벽 모양별 색 (frame 창틀 · glass 유리 아래 · glassHi 유리 위 반사 · band 층 띠 · lit 밤 불빛 · litRatio 켜진 창 비율)
export const PALETTES = {
  // 본사(주인공): 짙은 창틀 + 맑은 유리 — 이웃 빌딩(아래, 흐리고 밝은 색)보다 또렷하게
  hq:     { frame: '#2f4a63', glass: '#7fa6c6', glassHi: '#dcebf6', band: '#22394f', lit: '#d9e8ff', litRatio: 0.48, seed: 11 },
  iren:   { frame: '#2c7742', glass: '#71da80', glassHi: '#c3f5cb', band: '#23633a', lit: '#6dff8c', litRatio: 1, seed: 2 },
  lobby:  { frame: '#3f5164', glass: '#6f879c', glassHi: '#b3c6d6', band: '#33465a', lit: '#fff3d8', litRatio: 0.9, seed: 6, cols: 3, rows: 1 },
  // 이웃 빌딩(배경): 채도를 낮추고 밝게 — 본사가 돋보이게
  glass:  { frame: '#8396a8', glass: '#a7b8c7', glassHi: '#d6e0e8', band: '#73879a', lit: '#ffe2a8', litRatio: 0.42, seed: 3 },
  dark:   { frame: '#5e6b78', glass: '#808f9d', glassHi: '#adb8c2', band: '#525e6a', lit: '#ffd48a', litRatio: 0.36, seed: 5 },
  stone:  { frame: '#e3ddce', glass: '#9ba9b6', glassHi: '#c6d0d8', band: '#d2cab8', lit: '#ffd99a', litRatio: 0.4, seed: 8 },
  warm:   { frame: '#d6b6a0', glass: '#96a5b3', glassHi: '#c1ccd5', band: '#c5a48d', lit: '#ffcf86', litRatio: 0.38, seed: 9 },
  retail: { frame: '#e6e0d2', glass: '#8db3cb', glassHi: '#d2e6f1', band: '#cec6b5', lit: '#fff0c8', litRatio: 0.85, seed: 4, cols: 3, rows: 2 },
}

// 시드 고정 난수 (0~1)
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

const cache = new Map() // 모양마다 그림 한 쌍만 (모든 벽이 나눠 씀)
export function facadeTextures(style) {
  if (cache.has(style)) return cache.get(style)
  const p = PALETTES[style]
  const S = 256, cols = p.cols ?? 4, rows = p.rows ?? 4, cw = S / cols, rh = S / rows
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c }
  const day = canvas(), night = canvas()
  const g = day.getContext('2d'), n = night.getContext('2d')
  g.fillStyle = p.frame; g.fillRect(0, 0, S, S)
  n.fillStyle = '#000'; n.fillRect(0, 0, S, S)
  const r = rng(p.seed)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x * cw + cw * 0.1, py = y * rh + rh * 0.14, w = cw * 0.8, h = rh * 0.66
    const grad = g.createLinearGradient(px, py, px, py + h)   // 유리: 위가 밝게 (하늘 반사)
    grad.addColorStop(0, p.glassHi); grad.addColorStop(1, p.glass)
    g.fillStyle = grad; g.fillRect(px, py, w, h)
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px, py, w * 0.18, h) // 유리 세로 반사 줄
    if (r() < p.litRatio) { n.fillStyle = p.lit; n.globalAlpha = 0.65 + r() * 0.35; n.fillRect(px, py, w, h); n.globalAlpha = 1 }
  }
  g.fillStyle = p.band
  for (let y = 0; y < rows; y++) g.fillRect(0, y * rh + rh * 0.88, S, rh * 0.12) // 층 사이 띠 (슬래브 끝)
  const out = { map: new CanvasTexture(day), emissiveMap: new CanvasTexture(night) }
  for (const t of Object.values(out)) { t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 4 }
  cache.set(style, out)
  return out
}

// 벽 한 면의 재질: 그림을 벽 크기(w × h)만큼 반복. oy = 세로 시작 위치(층마다 다른 창이 켜지게)
//   만든 재질은 nightList 에 넣어 HqView 가 밤 밝기를 한꺼번에 바꿈
export function facadeMaterial(style, w, h, nightList, { oy = 0, glow = 0 } = {}) {
  const t = facadeTextures(style)
  const sized = (tex) => { const c = tex.clone(); c.repeat.set(w / TILE_W, h / TILE_H); c.offset.set(0, oy); c.needsUpdate = true; return c }
  const m = new MeshStandardMaterial({ map: sized(t.map), emissiveMap: sized(t.emissiveMap), emissive: '#ffffff', emissiveIntensity: glow, roughness: 0.42, metalness: 0.08 })
  m.userData.glow = glow // 낮에도 조금 빛나는 벽(IREN 층)의 기본 밝기
  nightList?.push(m)
  return m
}
