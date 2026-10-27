// =============================================================
// HqTicker — 본사 로비 위 전광판 (그림 표현 — 실제 빌딩에 이런 전광판은 없음)
// -------------------------------------------------------------
// 포디움(아래 3층)의 길 쪽 벽(Market St · Pitt St — hqTower.streetFaces)에 흐르는 글자 띠를 두름
//   글자: data/hqTicker.js — 전일 종가·등락(public/data/stock.json) · 다가오는 실적 발표·주총까지 남은 날(companies.json events)
//   LED 처럼: 짙은 바탕 + 호박색 글자 + 촘촘한 점 무늬 (빛을 받지 않는 재질이라 밤에도 그대로 밝음)
//   글자는 벽을 따라 왼쪽으로 흐르고(모서리를 돌아 이어짐), 움직임 줄이기면 멈춤
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { useAppStore } from '../store/useAppStore.js'
import { streetFaces } from './hqTower.js'
import { lastClose, tickerItems } from '../data/hqTicker.js'
import { useReducedMotion } from './useReducedMotion.js'

const BASE = 0.12    // 바닥 판 윗면
const BAND_H = 1.25  // 띠 높이 (칸 ≈ 6.9m — 기본 구도는 벽을 비스듬히 봐서 0.85 칸이면 글자가 약 6px 로 안 읽혔음, 2026-10-27 시험)
const TOP_GAP = 0.08 // 포디움 꼭대기와 띠 사이
const OUT = 0.05     // 벽에서 띄우는 거리 (유리와 겹쳐 깜빡이지 않게)
const SPEED = 0.9    // 흐르는 빠르기 (칸/초)
const CH = 128       // 글자 그림 높이 (px)

// 전일 종가: 주가 페이지와 같은 파일 (이미 받았으면 브라우저 캐시) — 못 받으면 일정만
let closePromise = null
const loadClose = () => (closePromise ??= fetch('/data/stock.json').then((r) => (r.ok ? r.json() : null)).then(lastClose).catch(() => null))
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// 글자 한 바퀴를 그린 그림 (가로로 반복해서 붙임) — tileLen = 이 그림 한 장이 벽에서 차지하는 길이(칸)
function tickerTexture(items) {
  const text = items.length ? `${items.join('     ·     ')}     ·     ` : ' '
  const probe = document.createElement('canvas').getContext('2d')
  const font = '800 92px ui-monospace, Menlo, Consolas, monospace' // 띠 높이의 약 72%
  probe.font = font
  const w = Math.max(256, Math.ceil(probe.measureText(text).width / 64) * 64)
  const c = document.createElement('canvas'); c.width = w; c.height = CH
  const g = c.getContext('2d')
  g.fillStyle = '#0d1217'; g.fillRect(0, 0, w, CH)
  g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#ffb63b'
  g.fillText(text, 0, CH / 2 + 4)
  // LED 점 무늬: 4px 마다 가는 어두운 선 (가로·세로)
  g.fillStyle = 'rgba(13, 18, 23, 0.42)'
  for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, CH)
  for (let y = 0; y < CH; y += 4) g.fillRect(0, y, w, 1)
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 8
  t.userData.tileLen = BAND_H * (w / CH)
  return t
}

// 띠 모양: 길 쪽 벽마다 사각형 하나 (벽에서 OUT 만큼 바깥), 가로 UV 는 벽을 따라 이어짐
function bandGeometry(T, tileLen) {
  const y1 = BASE + T.podium.h - TOP_GAP, y0 = y1 - BAND_H
  const pos = [], uv = []
  for (const f of streetFaces(T.podium.ring)) {
    const a = [f.a[0] + f.n[0] * OUT, f.a[1] + f.n[1] * OUT], b = [f.b[0] + f.n[0] * OUT, f.b[1] + f.n[1] * OUT]
    const u0 = f.u0 / tileLen, u1 = (f.u0 + f.len) / tileLen
    // (A 아래왼쪽, B 아래오른쪽, C 위오른쪽, D 위왼쪽) — 앞면이 바깥을 봄
    pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1])
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

export default function HqTicker({ T }) {
  const lang = useAppStore((s) => s.lang)
  const events = useAppStore((s) => s.data?.companies?.[0]?.events)
  const [close, setClose] = useState(null)
  useEffect(() => {
    let live = true
    loadClose().then((c) => live && setClose(c))
    return () => { live = false }
  }, [])
  const reduced = useReducedMotion()
  const items = useMemo(() => tickerItems({ close, events, today: todayStr(), lang }), [close, events, lang])
  const tex = useMemo(() => tickerTexture(items), [items])
  const geo = useMemo(() => bandGeometry(T, tex.userData.tileLen), [T, tex])
  const mat = useMemo(() => new MeshBasicMaterial({ map: tex, toneMapped: false }), [tex])
  useEffect(() => () => { tex.dispose(); geo.dispose(); mat.dispose() }, [tex, geo, mat])
  useFrame((_, delta) => {
    if (!reduced) tex.offset.x = (tex.offset.x + (Math.min(delta, 0.1) * SPEED) / tex.userData.tileLen) % 1
  })
  if (!items.length) return null
  return <mesh geometry={geo} material={mat} />
}
