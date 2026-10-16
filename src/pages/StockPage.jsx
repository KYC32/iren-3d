// =============================================================
// StockPage — 상장(2021-11-17)부터 지금까지 IREN 주가 (#page=stock, at=YYYY-MM-DD 로 날짜 강조)
//   통계 카드 → 기간·눈금·표시 옵션 → 차트(StockChart) → 범례 → 주식 수·희석(DilutionSection) → 출처
//   데이터: public/data/stock.json (GitHub Action 이 매일 갱신). 시설 데이터(infra)와 독립이라 그게 없어도 열림
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import PageShell from './PageShell.jsx'
import StockChart from './StockChart.jsx'
import DilutionSection from './DilutionSection.jsx'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { loadStock, loadShares } from '../data/loadFeeds.js'
import { toSeries, sliceRange, stats, eventsForChart, markerColor, RANGES } from '../data/stock.js'

const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const usd = (n) => `$${n >= 100 ? n.toFixed(1) : n.toFixed(2)}`

export default function StockPage() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const events = useAppStore((s) => s.events)
  const highlight = useAppStore((s) => s.stockAt)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('ALL')
  const [log, setLog] = useState(false)
  const [showEvents, setShowEvents] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const load = () => { setError(null); loadStock().then(setFile).catch((e) => setError(e.message)) }
  useEffect(load, [])
  // 발행 주식 수·희석 — 못 받아도 주가 페이지는 그대로 (그 칸만 빠짐)
  const [shares, setShares] = useState(null)
  useEffect(() => { loadShares().then(setShares).catch(() => setShares(null)) }, [])
  // 강조 날짜가 있으면 그 날짜가 보이는 구간으로
  useEffect(() => { if (highlight && file) setRange('ALL') }, [highlight, file])

  const series = useMemo(() => (file ? toSeries(file) : []), [file])
  const shown = useMemo(() => sliceRange(series, range), [series, range])
  const st = useMemo(() => (series.length ? stats(series, file.ipo.price) : null), [series, file])
  const marks = useMemo(() => eventsForChart(events), [events])
  const ko = lang === 'ko'

  if (error) return <PageShell><p className="page-error">{t.stock.loadError} — {error} <button className="lang-btn" onClick={load}>{t.stock.retry}</button></p></PageShell>
  if (!file) return <PageShell><div className="page-loading">{t.loading}</div></PageShell>

  const up = st.chg >= 0
  const cards = [
    { label: t.stock.price, value: usd(st.last), sub: `${st.date} · ${t.stock.prev} ${pct(st.chgPct)}`, tone: up ? 'up' : 'down', icon: up ? TrendingUp : TrendingDown },
    { label: t.stock.vsIpo, value: pct(st.vsIpoPct), sub: `${file.ipo.date}`, tone: st.vsIpoPct >= 0 ? 'up' : 'down' },
    // 52주 최고·최저도 종가 기준 (사상 최고·최대 낙폭·차트와 같은 기준) + 그 날짜
    { label: `${t.stock.high52} / ${t.stock.low52}`, value: `${usd(st.high52.price)} / ${usd(st.low52.price)}`, sub: `${st.high52.date} / ${st.low52.date}` },
    { label: t.stock.ath, value: usd(st.ath.price), sub: st.ath.date },
    { label: t.stock.drawdown, value: pct(st.maxDrawdownPct), sub: `${st.drawdownFrom} → ${st.drawdownTo}`, tone: 'down' },
  ]
  return (
    <PageShell className="stock-page">
      <div className="stock-stats">
        {cards.map((c) => (
          <div key={c.label} className={`stat${c.tone ? ` tone-${c.tone}` : ''}`}>
            <small>{c.label}</small>
            <b>{c.icon && <c.icon size={15} aria-hidden="true" />}{c.value}</b>
            {c.sub && <span>{c.sub}</span>}
          </div>
        ))}
      </div>
      <div className="stock-controls">
        <div className="camera-mode" role="group" aria-label={t.stock.range}>
          {RANGES.map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r === 'ALL' ? t.stock.all : r}</button>)}
        </div>
        <div className="camera-mode" role="group" aria-label="scale">
          <button aria-pressed={!log} onClick={() => setLog(false)}>{t.stock.linear}</button>
          <button aria-pressed={log} onClick={() => setLog(true)}>{t.stock.log}</button>
        </div>
        <label className="chip-toggle"><input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />{t.stock.events}</label>
        <label className="chip-toggle"><input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />{t.stock.volume}</label>
      </div>
      <StockChart series={shown} events={marks} log={log} showVolume={showVolume} showEvents={showEvents} ipo={file.ipo} highlight={highlight} />
      {showEvents && (
        <div className="chart-legend">
          {[['contract', t.stock.legend.contract], ['earnings', t.stock.legend.earnings], ['phase', t.stock.legend.phase], ['news', t.stock.legend.news]].map(([k, label]) => (
            <span key={k}><i style={{ background: markerColor(k) }} />{label}</span>
          ))}
          <span><i className="hollow" />{ko ? '테두리만 = 월 단위 날짜' : 'Hollow = month-level date'}</span>
        </div>
      )}
      {shares && <DilutionSection file={shares} series={shown} lang={lang} />}
      <p className="page-note">
        {t.stock.note} {st.date} · {ko ? '데이터 갱신' : 'refreshed'} {file.fetched_at.slice(0, 10)} · <a href={file.source.url} target="_blank" rel="noreferrer">{file.source.name}</a>
        {showEvents && <> · {t.stock.eventsNote}</>}
      </p>
    </PageShell>
  )
}
