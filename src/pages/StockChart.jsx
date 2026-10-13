// =============================================================
// StockChart — 라이브러리 없이 SVG 로 그리는 주가 차트
// -------------------------------------------------------------
//   선(종가) + 옅은 면 · 공모가 $28 점선 · 거래량 막대(아래) · 사건 마커(위 띠) · 십자선 툴팁 · 강조 날짜(노란 선)
//   폭은 ResizeObserver 로 컨테이너에 맞추고, 높이는 폭에 비례(최소 260px)
//   마우스·터치가 움직이면 가장 가까운 거래일을 찾아(nearestIndex) 툴팁을 띄움
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { yScale, xForDate, linePath, areaPath, priceTicks, dateTicks, nearestIndex, markerColor } from '../data/stock.js'

const PAD = { top: 18, right: 54, bottom: 26, left: 8 } // 가격 눈금은 오른쪽
const EVENT_LANE = 16   // 사건 마커 띠 높이
const VOL_FRAC = 0.2    // 거래량 영역 비율
const fmt = (n) => (n >= 100 ? n.toFixed(1) : n.toFixed(2))
const fmtVol = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v))

export default function StockChart({ series, events = [], log = false, showVolume = true, showEvents = true, ipo, highlight = null }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const wrap = useRef(null)
  const [width, setWidth] = useState(720)
  const [hover, setHover] = useState(null) // { i, x, y } 가장 가까운 거래일
  const [pinned, setPinned] = useState(null) // 마커를 눌러 고정한 사건
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
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
    return { first, last, innerW, priceTop, priceBottom, priceH, volH, pts, ticks, dticks, bars, barW, marks, x, y, min, max }
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
    setHover({ i, x: pts[i][0], y: pts[i][1] })
  }
  const hp = hover ? series[hover.i] : null
  const hoverEvents = hp ? events.filter((e) => e.date === hp.date) : []
  const hi = highlight ? nearestIndex(series, highlight) : -1
  const hiX = hi >= 0 && highlight >= G.first && highlight <= G.last ? pts[hi][0] : null
  const tipLeft = hover ? (hover.x > width * 0.6 ? hover.x - 190 : hover.x + 12) : 0
  const pinnedTip = pinned ?? (hiX != null && !hover ? { x: hiX, items: events.filter((e) => e.date === highlight) } : null)

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
        <path className="chart-area" d={areaPath(pts, priceBottom)} />
        <path className="chart-line" d={linePath(pts)} />
        {/* 강조 날짜 (뉴스에서 "차트에서 보기") */}
        {hiX != null && <line className="chart-highlight" x1={hiX} x2={hiX} y1={priceTop - 4} y2={priceBottom} />}
        {/* 사건 마커 띠 */}
        {G.marks.map((m) => (
          <g key={m.x} className="chart-marker" onClick={(e) => { e.stopPropagation(); setPinned((p) => (p?.x === m.x ? null : m)) }}>
            <line x1={m.x} x2={m.x} y1={PAD.top + 7} y2={priceBottom} stroke={markerColor(m.items[0].kind)} strokeOpacity="0.18" />
            {m.items.slice(0, 3).map((e, k) => (
              <circle key={e.id} cx={m.x} cy={PAD.top + 5 - k * 3} r={4} fill={e.precision === 'month' ? '#fff' : markerColor(e.kind)} stroke={markerColor(e.kind)} strokeWidth={1.5}><title>{lang === 'ko' ? e.title_ko : e.title_en}</title></circle>
            ))}
            {m.items.length > 3 && <text className="chart-more" x={m.x + 6} y={PAD.top + 8}>+{m.items.length - 3}</text>}
          </g>
        ))}
        {/* 십자선 */}
        {hover && <g className="chart-cross"><line x1={hover.x} x2={hover.x} y1={priceTop} y2={priceBottom + 6 + volH} /><circle cx={hover.x} cy={hover.y} r={3.5} /></g>}
      </svg>
      {/* 툴팁: 마우스 위치 거래일 */}
      {hp && (
        <div className="chart-tip" style={{ left: tipLeft, top: Math.max(4, hover.y - 52) }}>
          <b>{hp.date}</b>
          <div>{t.stock.close} <strong>${fmt(hp.close)}</strong> <span className={hp.close >= hp.open ? 'up' : 'down'}>{hp.close >= hp.open ? '▲' : '▼'} {Math.abs(((hp.close - hp.open) / hp.open) * 100).toFixed(1)}%</span></div>
          <small>{t.stock.open} {fmt(hp.open)} · {t.stock.high} {fmt(hp.high)} · {t.stock.low} {fmt(hp.low)} · {t.stock.volume} {fmtVol(hp.volume)}</small>
          {hoverEvents.map((e) => <div key={e.id} className="tip-event"><i style={{ background: markerColor(e.kind) }} />{lang === 'ko' ? e.title_ko : e.title_en}</div>)}
        </div>
      )}
      {/* 고정 툴팁: 마커를 눌렀거나 강조 날짜 */}
      {pinnedTip && pinnedTip.items.length > 0 && !hp && (
        <div className="chart-tip pinned" style={{ left: pinnedTip.x > width * 0.6 ? pinnedTip.x - 230 : pinnedTip.x + 12, top: PAD.top + 14 }}>
          {pinnedTip.items.map((e) => (
            <div key={e.id} className="tip-event">
              <i style={{ background: markerColor(e.kind) }} />
              <span><b>{e.date.slice(0, e.precision === 'month' ? 7 : 10)}{e.precision === 'month' ? ` (${t.stock.monthOnly})` : ''}</b> {lang === 'ko' ? e.title_ko : e.title_en}
                {e.source && <> · <a href={e.source} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>{t.news.source}</a></>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
