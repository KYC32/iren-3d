// =============================================================
// StockChart — 라이브러리 없이 SVG 로 그리는 주가 차트
// -------------------------------------------------------------
//   선(종가) + 옅은 면 · 공모가 $28 점선 · 거래량 막대(아래) · 사건 마커(위 띠) · 십자선 툴팁 · 강조 날짜(노란 선)
//   폭은 ResizeObserver 로 컨테이너에 맞추고, 높이는 폭에 비례(최소 260px)
//   툴팁 우선순위: 마커를 눌러 고정한 것 > 강조 날짜(뉴스에서 "차트에서 보기") > 마우스 위치
//   마우스가 마커 근처(8px)에 있으면 그 사건들도 툴팁에 함께 보임 (월 단위 사건은 15일에 놓여 거래일과 안 맞을 수 있어서)
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { yScale, xForDate, linePath, areaPath, priceTicks, dateTicks, nearestIndex, markerColor } from '../data/stock.js'

const PAD = { top: 18, right: 54, bottom: 26, left: 8 } // 가격 눈금은 오른쪽
const EVENT_LANE = 16   // 사건 마커 띠 높이
const VOL_FRAC = 0.2    // 거래량 영역 비율
const HIT = 8           // 마커 판정 반경(px) — 원(r=4)보다 넓게
const TIP_W = 240       // 툴팁 최대 폭 (화면 밖으로 안 나가게 자리 잡을 때 씀)
const fmt = (n) => (n >= 100 ? n.toFixed(1) : n.toFixed(2))
const fmtVol = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v))

export default function StockChart({ series, events = [], log = false, showVolume = true, showEvents = true, ipo, highlight = null }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const wrap = useRef(null)
  const [width, setWidth] = useState(720)
  const [hover, setHover] = useState(null)   // { i, x, y } 마우스에 가장 가까운 거래일
  const [pinned, setPinned] = useState(null) // 마커를 눌러 고정한 묶음 { x, items }
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 데이터·구간이 바뀌면 고정 툴팁은 풀고, Esc 로도 풀 수 있게
  useEffect(() => setPinned(null), [series, events])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setPinned(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const height = Math.max(260, Math.min(420, Math.round(width * 0.48)))

  // ---- 좌표 계산 (데이터·크기·옵션이 바뀔 때만) ----
  const G = useMemo(() => {
    if (!series.length) return null
    const first = series[0].date, last = series.at(-1).date
    const innerW = width - PAD.left - PAD.right
    const lane = showEvents ? EVENT_LANE : 0
    const volH = showVolume ? Math.round((height - PAD.top - PAD.bottom) * VOL_FRAC) : 0
    const priceTop = PAD.top + lane, priceBottom = height - PAD.bottom - volH - (volH ? 6 : 0)
    const priceH = priceBottom - priceTop
    let min = Infinity, max = -Infinity, maxVol = 0
    for (const p of series) { if (p.close < min) min = p.close; if (p.close > max) max = p.close; if (p.volume > maxVol) maxVol = p.volume }
    if (ipo && ipo.price >= min * 0.5 && ipo.price <= max * 2) { min = Math.min(min, ipo.price); max = Math.max(max, ipo.price) }
    const y = yScale(min, max, priceH, { log })
    const x = (d) => PAD.left + xForDate(d, first, last, innerW)
    const pts = series.map((p) => [x(p.date), priceTop + y(p.close)])
    const ticks = priceTicks(min, max, { log }).map((v) => ({ v, y: priceTop + y(v) }))
    const dticks = dateTicks(series, { lang }).map((d) => ({ ...d, x: x(d.date) }))
    const bars = showVolume ? series.map((p) => ({ x: x(p.date), h: maxVol ? (p.volume / maxVol) * volH : 0 })) : []
    const barW = Math.max(0.6, (innerW / series.length) * 0.7)
    // 사건: 구간 안의 것만, x 가 가까우면(6px) 한 묶음
    const marks = []
    if (showEvents) for (const e of events) {
      if (e.date < first || e.date > last) continue
      const ex = x(e.date)
      const g = marks.find((m) => Math.abs(m.x - ex) < 6)
      if (g) g.items.push(e); else marks.push({ x: ex, items: [e] })
    }
    return { first, last, innerW, priceTop, priceBottom, priceH, volH, pts, ticks, dticks, bars, barW, marks, x, y, min, max,
      line: linePath(pts), area: areaPath(pts, priceBottom) }
  }, [series, events, width, height, log, showVolume, showEvents, ipo, lang])

  if (!G) return null
  const { pts, priceTop, priceBottom, volH } = G
  const ipoY = ipo && ipo.price >= G.min && ipo.price <= G.max ? priceTop + G.y(ipo.price) : null

  // ---- 마우스·터치 ----
  const onMove = (ev) => {
    const rect = wrap.current.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const ratio = (px - PAD.left) / G.innerW
    const ms = Date.parse(G.first) + ratio * (Date.parse(G.last) - Date.parse(G.first))
    const i = nearestIndex(series, new Date(Math.max(0, ms)).toISOString().slice(0, 10))
    setHover({ i, x: pts[i][0], y: pts[i][1], px })
  }
  const togglePin = (m) => setPinned((p) => (p?.x === m.x ? null : m))
  const hp = hover ? series[hover.i] : null
  // 마우스 근처 마커 묶음 (있으면 그 사건들을 툴팁에 같이)
  const nearMark = hover ? G.marks.find((m) => Math.abs(m.x - hover.px) <= HIT) : null
  // 강조 날짜: 그 날(또는 직전 거래일)의 가격 + 그 날짜의 사건
  const hi = highlight ? nearestIndex(series, highlight) : -1
  const hiX = hi >= 0 && highlight >= G.first && highlight <= G.last ? pts[hi][0] : null
  const hiTip = hiX != null ? { x: hiX, price: series[hi], items: events.filter((e) => e.date === highlight) } : null
  // 보여 줄 툴팁 하나 고르기: 고정 > 강조(마우스 없을 때) > 마우스
  const tip = pinned ? { kind: 'pinned', ...pinned } : hp ? { kind: 'hover', x: hover.x, price: hp, items: nearMark?.items ?? [] } : hiTip ? { kind: 'highlight', ...hiTip } : null
  // 툴팁 위치: 오른쪽 공간이 모자라면 왼쪽에
  const tipLeft = tip ? Math.max(0, tip.x + 12 + TIP_W > width ? tip.x - 12 - TIP_W : tip.x + 12) : 0
  const tipTop = tip?.kind === 'hover' ? Math.max(4, hover.y - 52) : PAD.top + 14

  return (
    <div className="stock-chart" ref={wrap} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => setPinned(null)}>
      <svg width={width} height={height} role="img" aria-label={`${t.nav.stockTitle} ${G.first} ~ ${G.last}`}>
        {/* 가격 격자·눈금 */}
        <g className="chart-grid">{G.ticks.map((tk) => <line key={tk.v} x1={PAD.left} x2={width - PAD.right} y1={tk.y} y2={tk.y} />)}</g>
        <g className="chart-axis">{G.ticks.map((tk) => <text key={tk.v} x={width - PAD.right + 6} y={tk.y + 4}>${tk.v}</text>)}</g>
        <g className="chart-axis">{G.dticks.map((d) => <text key={d.date} x={d.x} y={height - 8} textAnchor="middle">{d.label}</text>)}</g>
        {/* 공모가 */}
        {ipoY != null && <g><line className="chart-ipo" x1={PAD.left} x2={width - PAD.right} y1={ipoY} y2={ipoY} /><text className="chart-ipo-label" x={PAD.left + 4} y={ipoY - 4}>{t.stock.ipoLine}</text></g>}
        {/* 거래량 */}
        {volH > 0 && <g className="chart-vol">{G.bars.map((b, i) => <rect key={i} x={b.x - G.barW / 2} y={priceBottom + 6 + volH - b.h} width={G.barW} height={b.h} />)}</g>}
        {/* 가격 선·면 */}
        <path className="chart-area" d={G.area} />
        <path className="chart-line" d={G.line} />
        {/* 강조 날짜 (뉴스에서 "차트에서 보기") */}
        {hiX != null && <line className="chart-highlight" x1={hiX} x2={hiX} y1={priceTop - 4} y2={priceBottom} />}
        {/* 사건 마커 띠: 눌러서 고정, Enter 도 됨. 보이지 않는 넓은 판정 영역을 깔아 작은 원도 쉽게 눌리게 */}
        {G.marks.map((m) => {
          const color = markerColor(m.items[0].kind), label = m.items.map((e) => (lang === 'ko' ? e.title_ko : e.title_en)).join(' · ')
          const on = pinned?.x === m.x
          return (
            <g key={m.x} className={`chart-marker${on ? ' is-pinned' : ''}`} role="button" tabIndex={0} aria-label={label} aria-pressed={on}
              onClick={(e) => { e.stopPropagation(); togglePin(m) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(m) } }}>
              <rect x={m.x - HIT} y={0} width={HIT * 2} height={PAD.top + 12} fill="transparent" />
              <line x1={m.x} x2={m.x} y1={PAD.top + 7} y2={priceBottom} stroke={color} strokeOpacity={on ? 0.5 : 0.18} strokeWidth={on ? 1.5 : 1} />
              {m.items.slice(0, 3).map((e, k) => (
                <circle key={e.id} cx={m.x} cy={PAD.top + 5 - k * 3} r={on ? 5 : 4} fill={e.precision === 'month' ? '#fff' : markerColor(e.kind)} stroke={markerColor(e.kind)} strokeWidth={1.5} />
              ))}
              {m.items.length > 3 && <text className="chart-more" x={m.x + 6} y={PAD.top + 8}>+{m.items.length - 3}</text>}
            </g>
          )
        })}
        {/* 십자선 */}
        {hover && <g className="chart-cross"><line x1={hover.x} x2={hover.x} y1={priceTop} y2={priceBottom + 6 + volH} /><circle cx={hover.x} cy={hover.y} r={3.5} /></g>}
      </svg>
      {/* 툴팁 (한 번에 하나): 고정된 사건 / 강조 날짜 / 마우스 위치 거래일 */}
      {tip && (
        <div className={`chart-tip ${tip.kind}`} style={{ left: tipLeft, top: tipTop }} onClick={(e) => e.stopPropagation()}>
          {tip.price && (
            <>
              <b>{tip.price.date}</b>
              <div>{t.stock.close} <strong>${fmt(tip.price.close)}</strong> <span className={tip.price.close >= tip.price.open ? 'up' : 'down'}>{tip.price.close >= tip.price.open ? '▲' : '▼'} {Math.abs(((tip.price.close - tip.price.open) / tip.price.open) * 100).toFixed(1)}%</span></div>
              <small>{t.stock.open} {fmt(tip.price.open)} · {t.stock.high} {fmt(tip.price.high)} · {t.stock.low} {fmt(tip.price.low)} · {t.stock.volume} {fmtVol(tip.price.volume)}</small>
            </>
          )}
          {tip.items.map((e) => (
            <div key={e.id} className="tip-event">
              <i style={{ background: markerColor(e.kind) }} />
              <span>
                <b>{e.date.slice(0, e.precision === 'month' ? 7 : 10)}{e.precision === 'month' ? ` (${t.stock.monthOnly})` : ''}</b> {lang === 'ko' ? e.title_ko : e.title_en}
                {tip.kind !== 'hover' && e.source && <> · <a href={e.source} target="_blank" rel="noreferrer">{t.news.source}</a></>}
              </span>
            </div>
          ))}
          {tip.kind === 'hover' && tip.items.length > 0 && <small className="tip-hint">{lang === 'ko' ? '누르면 고정 · 출처 보기' : 'Click to pin · view source'}</small>}
        </div>
      )}
    </div>
  )
}
