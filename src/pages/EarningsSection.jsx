// =============================================================
// EarningsSection — 주가 페이지의 "다음 실적 발표" 칸
//   발표일·매출·EPS 예상 → 이번 발표에서 확인할 것(사람이 적음) → 지난 분기 EPS 실제·예상 표
//   발표일이 지나면 칸 전체를 숨김 (nextEarnings). 예상치는 Nasdaq·MarketBeat 값을 옮긴 것이고 이 사이트의 전망이 아님
// =============================================================
import { ArrowUpRight } from 'lucide-react'
import { nextEarnings } from '../data/analysts.js'

// EPS 는 음수가 많아 부호를 앞에 둠 (−$0.41)
const eps = (n) => (n == null ? '-' : `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`)
const day = (d) => d.slice(2).replaceAll('-', '.')

export default function EarningsSection({ file, lang }) {
  const ko = lang === 'ko'
  const next = nextEarnings(file, new Date().toISOString().slice(0, 10))
  if (!next) return null
  const e = file.eps
  const cards = [
    { label: ko ? '발표일' : 'Report date', value: next.date, sub: ko ? '미국 기준' : 'US date' },
    { label: ko ? '매출 예상' : 'Revenue est.', value: `$${(next.revenue_usd / 1e6).toFixed(1)}M`, sub: next.source_name },
    e?.next.eps != null && { label: ko ? `EPS 예상 · ${e.next.quarter}` : `EPS est. · ${e.next.quarter}`, value: eps(e.next.eps), sub: `${eps(e.next.low)} - ${eps(e.next.high)} · ${ko ? `${e.next.estimates}곳` : `${e.next.estimates} est.`}` },
  ].filter(Boolean)
  return (
    <section className="analysts" aria-labelledby="earn-title">
      <h3 id="earn-title">{ko ? '다음 실적 발표' : 'Next earnings'}</h3>
      <div className="stock-stats">
        {cards.map((k) => <div key={k.label} className="stat"><small>{k.label}</small><b>{k.value}</b>{k.sub && <span>{k.sub}</span>}</div>)}
      </div>
      {next.watch?.length > 0 && <>
        <h4>{ko ? '이번 발표에서 확인할 것' : 'What to check in this report'}</h4>
        <ol className="earn-watch">
          {next.watch.map((w) => <li key={w.en}>{ko ? w.ko : w.en}{w.source && <>{' '}<a href={w.source} target="_blank" rel="noreferrer" aria-label={ko ? '관련 자료' : 'Related source'}><ArrowUpRight size={12} aria-hidden="true" /></a></>}</li>)}
        </ol>
      </>}
      {e?.history.length > 0 && <div className="analyst-table-wrap">
        <table className="dilution-table earn-table">
          <caption>{ko ? '지난 분기 EPS · Nasdaq' : 'Past quarters EPS · Nasdaq'}</caption>
          <thead><tr><th>{ko ? '분기' : 'Quarter'}</th><th>{ko ? '발표' : 'Reported'}</th><th>{ko ? '실제' : 'Actual'}</th><th>{ko ? '예상' : 'Est.'}</th><th>{ko ? '결과' : 'Result'}</th></tr></thead>
          <tbody>{e.history.map((h) => {
            const beat = h.eps >= h.forecast
            return <tr key={h.quarter}><td>{h.quarter}</td><td className="is-date">{day(h.date)}</td><td>{eps(h.eps)}</td><td>{eps(h.forecast)}</td>
              <td><span className={`rating rating-${beat ? 'buy' : 'hold'}`}>{beat ? (ko ? '상회' : 'Beat') : (ko ? '하회' : 'Miss')}</span></td></tr>
          })}</tbody>
        </table>
      </div>}
      <p className="page-note">
        {ko
          ? <>예상치는 증권사 값을 모은 것이고 이 사이트의 전망이 아님 · 투자 조언 아님. 확인할 것은 공개 자료에서 아직 답이 없는 항목을 이 사이트가 고른 것.</>
          : <>Estimates aggregate broker figures and are not this site's forecast · not investment advice. The checklist is this site's pick of items public sources have not yet answered.</>}
      </p>
    </section>
  )
}
