// =============================================================
// ShortSection — 주가 페이지의 "공매도 잔고" 칸
//   요약 카드 → 최근 24회 보고 막대. 데이터: public/data/short.json (Nasdaq·FINRA, 매일 확인 · 보고는 월 2회)
//   비율은 SEC 공시 표지의 최신 발행 주식 수 기준 (매체마다 분모가 달라 숫자가 다를 수 있음을 밝힘)
// =============================================================
import { useMemo } from 'react'
import { shortView } from '../data/market.js'

const m = (n) => `${(n / 1e6).toFixed(1)}M`
const pct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`

export default function ShortSection({ file, sharesOut, lang }) {
  const ko = lang === 'ko'
  const v = useMemo(() => shortView(file.rows, sharesOut), [file, sharesOut])
  const bars = file.rows.slice(-24)
  const top = Math.max(...bars.map((r) => r.shares))
  const cards = [
    { label: ko ? '공매도 잔고' : 'Short interest', value: ko ? `${m(v.shares)}주` : `${m(v.shares)} sh`, sub: ko ? `${v.date} 결제일 기준` : `settled ${v.date}` },
    v.pctOfShares != null && { label: ko ? '발행 주식 대비' : 'Of shares outstanding', value: `${v.pctOfShares.toFixed(1)}%` },
    { label: ko ? '커버 일수' : 'Days to cover', value: ko ? `${v.days_to_cover.toFixed(1)}일` : `${v.days_to_cover.toFixed(1)} days`, sub: ko ? '잔고 ÷ 하루 평균 거래량' : 'Short interest ÷ avg daily volume' },
    v.changePct != null && { label: ko ? '직전 보고 대비' : 'vs previous report', value: pct(v.changePct) },
  ].filter(Boolean)
  return (
    <section className="analysts" aria-labelledby="short-title">
      <h3 id="short-title">{ko ? '공매도 잔고' : 'Short interest'}</h3>
      <div className="stock-stats">
        {cards.map((k) => <div key={k.label} className="stat"><small>{k.label}</small><b>{k.value}</b>{k.sub && <span>{k.sub}</span>}</div>)}
      </div>
      <div className="short-bars" role="img" aria-label={ko ? `최근 ${bars.length}회 공매도 잔고, 최고 ${m(top)}주` : `Last ${bars.length} short interest reports, peak ${m(top)} shares`}>
        {bars.map((r) => <i key={r.date} style={{ height: `${(r.shares / top) * 100}%` }} title={`${r.date} ${m(r.shares)}`} />)}
      </div>
      <div className="short-axis"><span>{bars[0].date}</span><span>{bars.at(-1).date}</span></div>
      <p className="page-note">
        {ko
          ? <>결제일 기준으로 월 2회 보고되어 약 2주 늦게 공개됨. 잔고가 많다는 사실만으로 주가 방향을 말할 수 없음 · 투자 조언 아님. 비율은 최신 SEC 공시의 발행 주식 수 기준이라 유통 주식 기준인 매체와 다를 수 있음. <a href={file.source.url} target="_blank" rel="noreferrer">{file.source.name}</a> · 갱신 {file.fetched_at.slice(0, 10)}</>
          : <>Reported twice a month by settlement date and published about two weeks late. A high balance alone says nothing about price direction · not investment advice. The ratio uses shares outstanding from the latest SEC filing, so it can differ from float-based figures. <a href={file.source.url} target="_blank" rel="noreferrer">{file.source.name}</a> · refreshed {file.fetched_at.slice(0, 10)}</>}
      </p>
    </section>
  )
}
