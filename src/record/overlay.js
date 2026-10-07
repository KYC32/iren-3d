// =============================================================
// 영상 위 2D 오버레이: 3D 라벨(투영) + 자막 카드 + 페이드
// HTML 라벨은 캔버스 캡처에 찍히지 않으므로, 영상에서는 2D 캔버스에 직접 그립니다.
// 색·모양은 웹앱 UI(파스텔 패널, 상태색 점)와 맞췄습니다.
// =============================================================
import { styleOf, PENDING_COLOR } from '../data/statusStyle.js'
import { CARDS, clamp01, easeInOut } from './storyboard.js'

const FONT = '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif'
const TEXT = '#16213a'
const MUTED = '#6b7591'
const BG = '#eceffa'

function rr(o, x, y, w, h, r) {
  o.beginPath()
  o.roundRect(x, y, w, h, r)
}

function toneColor(tone) {
  return tone === 'pending' ? PENDING_COLOR : styleOf(tone).color
}

// 3D 위치 위에 붙는 알약 모양 라벨 (점 + 이름 + 보조 텍스트)
export function drawPill(o, x, y, u, { color, text, sub, alpha = 1 }) {
  o.save()
  o.globalAlpha = alpha
  o.font = `700 ${15 * u}px ${FONT}`
  const tw = o.measureText(text).width
  o.font = `500 ${13 * u}px ${FONT}`
  const sw = sub ? o.measureText(sub).width + 8 * u : 0
  const w = tw + sw + 34 * u
  const h = 30 * u
  // 화면 가장자리에서 잘리지 않게 안쪽으로 붙임
  const margin = 12 * u
  const left = Math.min(Math.max(x - w / 2, margin), o.canvas.width - w - margin)
  const top = y - h / 2
  o.shadowColor = 'rgba(30,45,90,0.16)'
  o.shadowBlur = 10 * u
  o.shadowOffsetY = 3 * u
  o.fillStyle = 'rgba(255,255,255,0.95)'
  rr(o, left, top, w, h, h / 2)
  o.fill()
  o.shadowColor = 'transparent'
  o.fillStyle = color
  o.beginPath()
  o.arc(left + 15 * u, y, 5 * u, 0, Math.PI * 2)
  o.fill()
  o.fillStyle = TEXT
  o.textBaseline = 'middle'
  o.font = `700 ${15 * u}px ${FONT}`
  o.fillText(text, left + 26 * u, y + 0.5 * u)
  if (sub) {
    o.fillStyle = MUTED
    o.font = `500 ${13 * u}px ${FONT}`
    o.fillText(sub, left + 26 * u + tw + 8 * u, y + 0.5 * u)
  }
  o.restore()
}

// 시간 t 의 자막 카드들 그리기
export function drawCards(o, t, W, H, lang, format) {
  const u = Math.min(W, H) / 1080 // 1080 기준 크기 단위
  const shorts = format === 'shorts'
  for (const c of CARDS[lang]) {
    if (t < c.t0 || t > c.t1) continue
    const a = easeInOut(clamp01((t - c.t0) / 0.45)) * (1 - easeInOut(clamp01((t - (c.t1 - 0.35)) / 0.35)))
    if (a <= 0) continue
    const rise = (1 - a) * 18 * u
    o.save()
    o.globalAlpha = a

    if (c.kind === 'title' || c.kind === 'header') {
      // 왼쪽 위 제목 패널
      const big = c.kind === 'title' ? 64 : 50
      const x = shorts ? 64 * u : 80 * u
      const y = (shorts ? 190 : 80) * u + rise
      o.font = `800 ${big * u}px ${FONT}`
      const tw = o.measureText(c.title).width
      o.font = `500 ${26 * u}px ${FONT}`
      const sw = o.measureText(c.sub).width
      const w = Math.min(W - x * 2, Math.max(tw, sw) + 64 * u)
      const h = (big + 26 + 70) * u
      o.shadowColor = 'rgba(30,45,90,0.12)'
      o.shadowBlur = 24 * u
      o.fillStyle = 'rgba(255,255,255,0.93)'
      rr(o, x, y, w, h, 22 * u)
      o.fill()
      o.shadowColor = 'transparent'
      o.fillStyle = styleOf('operating').color
      rr(o, x, y, 8 * u, h, 4 * u)
      o.fill()
      o.textBaseline = 'alphabetic'
      o.fillStyle = TEXT
      o.font = `800 ${big * u}px ${FONT}`
      o.fillText(c.title, x + 34 * u, y + (big + 18) * u)
      o.fillStyle = MUTED
      o.font = `500 ${26 * u}px ${FONT}`
      o.fillText(c.sub, x + 34 * u, y + (big + 18 + 44) * u)
    }

    if (c.kind === 'caption') {
      // 아래쪽 자막 (쇼츠는 하단 UI 를 피해 화면 62% 높이)
      o.font = `700 ${34 * u}px ${FONT}`
      const tw = o.measureText(c.text).width
      const w = Math.min(W - 80 * u, tw + 100 * u)
      const h = 78 * u
      const x = (W - w) / 2
      const y = (shorts ? H * 0.62 : H - 150 * u) + rise
      o.shadowColor = 'rgba(30,45,90,0.16)'
      o.shadowBlur = 20 * u
      o.fillStyle = 'rgba(255,255,255,0.95)'
      rr(o, x, y, w, h, h / 2)
      o.fill()
      o.shadowColor = 'transparent'
      o.fillStyle = toneColor(c.tone)
      o.beginPath()
      o.arc(x + 42 * u, y + h / 2, 11 * u, 0, Math.PI * 2)
      o.fill()
      o.fillStyle = TEXT
      o.textBaseline = 'middle'
      o.fillText(c.text, x + 66 * u, y + h / 2 + u)
    }

    if (c.kind === 'outro') {
      // 화면 중앙 정리 카드
      const w = Math.min(W - 120 * u, 900 * u)
      const h = 420 * u
      const x = (W - w) / 2
      const y = (shorts ? H * 0.5 : H * 0.5 - h / 2 + 40 * u) + rise
      o.shadowColor = 'rgba(30,45,90,0.14)'
      o.shadowBlur = 30 * u
      o.fillStyle = 'rgba(255,255,255,0.95)'
      rr(o, x, y, w, h, 28 * u)
      o.fill()
      o.shadowColor = 'transparent'
      o.textAlign = 'center'
      o.textBaseline = 'alphabetic'
      o.fillStyle = TEXT
      o.font = `800 ${66 * u}px ${FONT}`
      o.fillText(c.title, W / 2, y + 108 * u)
      // 지표 3개를 알약으로
      const tones = ['pending', 'operating', 'commissioning']
      o.font = `700 ${28 * u}px ${FONT}`
      const widths = c.stats.map((s) => o.measureText(s).width + 70 * u)
      const gap = 16 * u
      const total = widths.reduce((n, v) => n + v, 0) + gap * (c.stats.length - 1)
      const scale = Math.min(1, (w - 60 * u) / total)
      let cx = W / 2 - (total * scale) / 2
      c.stats.forEach((s, i) => {
        const pw = widths[i] * scale, ph = 58 * u
        o.fillStyle = '#f2f4fa'
        rr(o, cx, y + 150 * u, pw, ph, ph / 2)
        o.fill()
        o.fillStyle = toneColor(tones[i])
        o.beginPath()
        o.arc(cx + 26 * u * scale, y + 150 * u + ph / 2, 8 * u, 0, Math.PI * 2)
        o.fill()
        o.fillStyle = TEXT
        o.textAlign = 'left'
        o.textBaseline = 'middle'
        o.font = `700 ${28 * u * scale}px ${FONT}`
        o.fillText(s, cx + 44 * u * scale, y + 150 * u + ph / 2 + u)
        cx += pw + gap * scale
      })
      o.textAlign = 'center'
      o.textBaseline = 'alphabetic'
      o.fillStyle = '#2f6bed'
      o.font = `800 ${40 * u}px ${FONT}`
      o.fillText(c.url, W / 2, y + 300 * u)
      o.fillStyle = MUTED
      o.font = `500 ${21 * u}px ${FONT}`
      o.fillText(c.note, W / 2, y + 360 * u)
    }
    o.restore()
  }
}

// 장면 전환 페이드: 배경색으로 덮기
export function drawFade(o, W, H, f) {
  if (f <= 0) return
  o.save()
  o.globalAlpha = f
  o.fillStyle = BG
  o.fillRect(0, 0, W, H)
  o.restore()
}

// 회사 순위 오버레이 (오른쪽 위): rows = companyRanking(...) 결과, byId = 회사 정보
export function drawRanking(o, rows, byId, W, H, { title, dateLabel, lang = 'ko', top = 6 } = {}) {
  if (!rows.length) return
  const u = Math.min(W, H) / 1080
  const shorts = H > W
  const w = (shorts ? 900 : 560) * u
  const rowH = 46 * u
  const list = rows.slice(0, top)
  const h = (92 + list.length * 46 + 16) * u
  const x = shorts ? (W - w) / 2 : W - w - 70 * u
  const y = shorts ? H * 0.70 : 260 * u
  const max = Math.max(1, ...list.map((r) => r.secured))
  o.save()
  o.shadowColor = 'rgba(30,45,90,0.12)'
  o.shadowBlur = 24 * u
  o.fillStyle = 'rgba(255,255,255,0.94)'
  o.beginPath(); o.roundRect(x, y, w, h, 22 * u); o.fill()
  o.shadowColor = 'transparent'
  o.textBaseline = 'alphabetic'
  o.fillStyle = TEXT
  o.font = `800 ${28 * u}px ${FONT}`
  o.fillText(title ?? (lang === 'ko' ? '확보 전력 순위' : 'Secured power ranking'), x + 28 * u, y + 46 * u)
  if (dateLabel) {
    o.fillStyle = MUTED
    o.font = `600 ${20 * u}px ${FONT}`
    o.textAlign = 'right'
    o.fillText(dateLabel, x + w - 28 * u, y + 46 * u)
    o.textAlign = 'left'
  }
  list.forEach((r, i) => {
    const c = byId[r.companyId] ?? { name: r.companyId, color: '#999' }
    const ry = y + 80 * u + i * rowH
    o.fillStyle = MUTED
    o.font = `700 ${18 * u}px ${FONT}`
    o.fillText(String(r.rank), x + 28 * u, ry + 22 * u)
    o.fillStyle = c.color
    o.beginPath(); o.arc(x + 62 * u, ry + 15 * u, 8 * u, 0, Math.PI * 2); o.fill()
    o.fillStyle = TEXT
    o.font = `700 ${21 * u}px ${FONT}`
    o.fillText(lang === 'ko' && c.name_ko ? c.name_ko : c.name, x + 82 * u, ry + 22 * u)
    const val = r.secured >= 1000 ? `${(r.secured / 1000).toFixed(1)} GW` : `${Math.round(r.secured)} MW`
    o.textAlign = 'right'
    o.fillText(val, x + w - 28 * u, ry + 22 * u)
    o.textAlign = 'left'
    // 가동(AI) · 건설 · 계획 막대
    const bx = x + 82 * u, bw = w - 110 * u, by = ry + 30 * u, bh = 7 * u
    o.fillStyle = '#eef1f8'; o.fillRect(bx, by, bw, bh)
    let cx = bx
    for (const [v, col] of [[r.ai, styleOf('operating').color], [r.building, styleOf('under_construction').color], [r.planned, styleOf('planned').color]]) {
      const ww = (v / max) * bw
      o.fillStyle = col; o.fillRect(cx, by, ww, bh)
      cx += ww
    }
  })
  o.restore()
}
