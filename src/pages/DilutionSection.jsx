// =============================================================
// DilutionSection — 주가 페이지의 "주식 수 · 희석" 칸
//   요약 카드(발행 주식 · 상장 직후 대비 · 최근 1년 · 전환사채 잠재 희석)
//   → 주식 수 차트(주가 차트와 같은 기간·같은 가로축이라 날짜가 위아래로 맞음)
//   → 주식으로 조달한 돈 표 → 전환사채 표
// 데이터: public/data/shares.json (data/shares.json 에서 빌드, 새 10-Q·10-K 표지 수치는 매일 갱신 스크립트가 덧붙임)
// 모든 숫자는 SEC 공시 원문 링크와 함께. 전환 시 주식 수는 최초 전환가 단순 계산(추정)이라고 화면에 밝힘
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { xForDate, dateTicks } from '../data/stock.js'
import { sharesInterp, dilutionStats, raiseRows, convertRows, fmtShares, fmtUsd } from '../data/shares.js'

const PAD = { top: 12, right: 54, bottom: 22, left: 8 } // 주가 차트(StockChart)와 같은 좌우 여백 → 날짜 위치가 맞음
const H = 150

export default function DilutionSection({ file, series, lang }) {
  const ko = lang === 'ko'
  const s = useMemo(() => dilutionStats(file), [file])
  const raises = useMemo(() => raiseRows(file), [file])
  const converts = useMemo(() => convertRows(file), [file])
  const n = (v) => fmtShares(v, lang)
  const cards = [
    { label: ko ? '발행 주식' : 'Shares outstanding', value: n(s.latest.shares), sub: `${s.latest.date} · ${file.points.at(-1).form ?? ''}` },
    { label: ko ? '상장 직후 대비' : 'Since the IPO', value: `×${s.sinceIpo.toFixed(1)}`, sub: `${n(file.points[0].shares)} → ${n(s.latest.shares)}`, tone: 'down' },
    s.yoyPct != null && { label: ko ? '최근 1년' : 'Past year', value: `+${s.yoyPct.toFixed(1)}%`, sub: `${s.yearAgo.date} → ${s.latest.date}`, tone: 'down' },
    { label: ko ? '전환사채 잠재 희석' : 'Convertible overhang', value: `≈ ${n(s.convertShares)}`, sub: ko ? `지금의 ${s.convertPct.toFixed(0)}% · 단순 계산` : `${s.convertPct.toFixed(0)}% of today · simple calc` },
  ].filter(Boolean)
  return (
    <section className="dilution" aria-labelledby="dilution-title">
      <h3 id="dilution-title">{ko ? '주식 수 · 희석' : 'Share count · dilution'}</h3>
      <div className="stock-stats">
        {cards.map((c) => <div key={c.label} className={`stat${c.tone ? ` tone-${c.tone}` : ''}`}><small>{c.label}</small><b>{c.value}</b><span>{c.sub}</span></div>)}
      </div>
      <SharesChart points={file.points} series={series} lang={lang} />
      <div className="dilution-tables">
        <table className="dilution-table">
          <caption>{ko ? '주식으로 조달한 돈 · 주당 평균가가 오를수록 같은 돈에 새 주식이 덜 늘어남' : 'Equity raised · a higher average price means fewer new shares per dollar'}</caption>
          <thead><tr><th>{ko ? '구분' : 'Program'}</th><th>{ko ? '기준' : 'As of'}</th><th>{ko ? '주식 수' : 'Shares'}</th><th>{ko ? '금액' : 'Gross'}</th><th>{ko ? '주당 평균' : 'Avg / share'}</th></tr></thead>
          <tbody>{raises.map((r) => <tr key={r.id}>
            <td><a href={r.source} target="_blank" rel="noreferrer">{ko ? r.label_ko : r.label_en}<ArrowUpRight size={10} aria-hidden="true" /></a>{(ko ? r.note_ko : r.note_en) && <small>{ko ? r.note_ko : r.note_en}</small>}</td>
            <td>{r.until}</td>
            <td>{n(r.shares)}</td>
            <td>{fmtUsd(r.gross)}{r.grossCalc && <i title={ko ? '주식 수 × 주당 가격으로 계산' : 'shares × price'}>*</i>}{r.usedPct != null && <small>{ko ? `한도의 ${r.usedPct.toFixed(0)}%` : `${r.usedPct.toFixed(0)}% of limit`}</small>}</td>
            <td>${r.avgPrice.toFixed(2)}</td>
          </tr>)}</tbody>
        </table>
        <table className="dilution-table">
          <caption>{ko ? `전환사채 · ${converts[0]?.as_of ?? ''} 원금 기준, 최초 전환가로 모두 주식이 되면 (단순 계산)` : `Convertible notes · principal as of ${converts[0]?.as_of ?? ''}, if all convert at the initial price (simple calc)`}</caption>
          <thead><tr><th>{ko ? '만기' : 'Maturity'}</th><th>{ko ? '원금' : 'Principal'}</th><th>{ko ? '최초 전환가' : 'Conv. price'}</th><th>{ko ? '전환 시 주식' : 'Shares if converted'}</th></tr></thead>
          <tbody>{converts.map((c) => <tr key={c.id}>
            <td><a href={c.source} target="_blank" rel="noreferrer">{ko ? c.label_ko : c.label_en}<ArrowUpRight size={10} aria-hidden="true" /></a><small>{c.coupon_pct}% · {c.maturity}</small></td>
            <td>{fmtUsd(c.principal_usd)}</td>
            <td>${c.conversion_price_usd.toFixed(2)}</td>
            <td>≈ {n(c.shares)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="page-note">
        {ko
          ? '출처: SEC 공시(424B4·20-F·10-K·10-Q 표지와 본문, 표의 링크). 공시마다 대출형 주식 포함 여부 표기가 다를 수 있음. 전환 시 주식 수는 최초 전환가로 나눈 단순 계산 — 회사가 현금으로 갚거나 전환 조건·캡드콜에 따라 실제로는 줄 수 있음. 2029·2030년물 원금은 10-K 표의 장부가 + 미상각 할인. 투자 조언 아님.'
          : 'Sources: SEC filings (424B4, 20-F, 10-K, 10-Q covers and text; links in the tables). Filings differ on whether loan-funded shares are included. Shares if converted = principal ÷ initial conversion price — cash settlement, conversion conditions and capped calls can reduce it. 2029/2030 principal = carrying value + unamortized discount from the 10-K table. Not investment advice.'}
        {' '}{ko ? '갱신' : 'Checked'} {file.checked}
      </p>
    </section>
  )
}

// 주식 수 차트 — 가로축은 주가 차트의 기간(series 첫날~마지막 날)과 같게. 점 = 공시 시점, 공시 사이는 직선
//   (옛 계단 모양은 ATM 처럼 1년 내내 조금씩 늘어난 구간이 연말에 한 번에 뛴 것처럼 보였음)
function SharesChart({ points, series, lang }) {
  const wrap = useRef(null)
  const [width, setWidth] = useState(720)
  useEffect(() => {
    const el = wrap.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const G = useMemo(() => {
    if (series.length < 2) return null
    const first = series[0].date, last = series.at(-1).date
    const innerW = width - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom
    const x = (d) => PAD.left + xForDate(d, first, last, innerW)
    // 기간 첫날 값 + 기간 안 공시들을 직선으로 잇고(공시 사이는 sharesInterp), 마지막 공시 뒤는 점선으로 그 값 유지
    const inside = points.filter((p) => p.date > first && p.date <= last)
    const startV = sharesInterp(points, first)
    const line = [...(startV != null ? [{ date: first, shares: startV }] : []), ...inside]
    const lastFiled = points.filter((p) => p.date <= last).at(-1)
    if (!line.length || !lastFiled) return null
    const max = Math.max(...line.map((p) => p.shares)) * 1.08
    const y = (v) => PAD.top + innerH - (v / max) * innerH // 0 부터 (늘어난 폭을 과장하지 않게)
    const pt = (p) => `${x(p.date).toFixed(1)} ${y(p.shares).toFixed(1)}`
    const d = `M${line.map(pt).join('L')}`
    const endX = x(last).toFixed(1), lastPt = line.at(-1)
    const tail = lastPt.date < last ? `M${pt(lastPt)}H${endX}` : '' // 새 공시 전 구간 (점선)
    const area = `${d}H${endX}V${y(0).toFixed(1)}H${x(line[0].date).toFixed(1)}Z`
    // 세로 눈금: 1억(100M) 단위 — 작은 구간이면 5천만
    const unit = max > 2.5e8 ? 1e8 : 5e7
    const ticks = []
    for (let v = unit; v < max; v += unit) ticks.push({ v, y: y(v) })
    const dticks = dateTicks(series, { lang }).map((t) => ({ ...t, x: x(t.date) }))
    return { d, tail, area, ticks, dticks, dots: inside.map((p) => ({ ...p, x: x(p.date), y: y(p.shares) })) }
  }, [points, series, width, lang])
  return (
    <div className="shares-chart" ref={wrap}>
      {G && <svg width={width} height={H} role="img" aria-label={lang === 'ko' ? '발행 주식 수 변화' : 'Shares outstanding over time'}>
        <g className="chart-grid">{G.ticks.map((t) => <line key={t.v} x1={PAD.left} x2={width - PAD.right} y1={t.y} y2={t.y} />)}</g>
        <g className="chart-axis">{G.ticks.map((t) => <text key={t.v} x={width - PAD.right + 6} y={t.y + 4}>{fmtShares(t.v, lang)}</text>)}</g>
        <g className="chart-axis">{G.dticks.map((t) => <text key={t.date} x={t.x} y={H - 6} textAnchor="middle">{t.label}</text>)}</g>
        <path className="shares-area" d={G.area} />
        <path className="shares-line" d={G.d} />
        {G.tail && <path className="shares-line is-tail" d={G.tail} />}
        {G.dots.map((p) => <circle key={p.date} className={`shares-dot${p.auto ? ' is-auto' : ''}`} cx={p.x} cy={p.y} r={3.5}>
          <title>{`${p.date} · ${fmtShares(p.shares, lang)} · ${p.form ?? ''}${p.kind === 'calc' ? (lang === 'ko' ? ' (계산)' : ' (calc)') : ''}`}</title>
        </circle>)}
      </svg>}
    </div>
  )
}
