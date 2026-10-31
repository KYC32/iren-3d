// =============================================================
// AnalystSection — 주가 페이지의 "증권사 투자의견" 칸
//   합의 카드(의견·평균 목표가·범위·다음 실적 예상) → 목표가 막대(증권사마다 점 하나, 현재가 표시) → 증권사별 표
// 데이터: public/data/analysts.json (data/analysts.json 에서 빌드)
//   합의 값 = Nasdaq, 매일 자동 갱신 / 증권사별 표 = MarketBeat 표를 사람이 옮김 → 두 집계는 포함 증권사가 달라 숫자가 다를 수 있음을 화면에 밝힘
// 증권사 의견일 뿐이고 이 사이트의 판단이 아니므로 "투자 조언 아님"을 꼭 표시
// =============================================================
import { useMemo } from 'react'
import { ratingBucket, firmRows, firmCounts, upsidePct, rangeOf, rangePos, missingCoverage, nextEarnings } from '../data/analysts.js'

// 묶음 이름 (증권사 표현은 표에 그대로 함께 보임)
const BUCKET = { buy: ['매수', 'Buy'], hold: ['보유', 'Hold'], sell: ['매도', 'Sell'] }
// 무엇이 바뀌었는지 — 시험을 위해 순수하게 둘 필요가 없는 표시 문구라 화면 파일에 둠
const ACTION = {
  initiated: ['신규', 'Initiated'], reiterated: ['유지', 'Reiterated'], upgrade: ['상향', 'Upgrade'], downgrade: ['하향', 'Downgrade'],
  'target-up': ['목표가 상향', 'Target raised'], 'target-down': ['목표가 하향', 'Target cut'], 'target-set': ['목표가 제시', 'Target set'],
}
const usd = (n) => `$${n % 1 ? n.toFixed(2) : n}`
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`

export default function AnalystSection({ file, price, priceDate, lang }) {
  const ko = lang === 'ko', i = ko ? 0 : 1
  const rows = useMemo(() => firmRows(file, price), [file, price])
  const n = useMemo(() => firmCounts(rows), [rows])
  const c = file.consensus
  const missing = missingCoverage(file)
  const today = new Date().toISOString().slice(0, 10)
  const next = nextEarnings(file, today)
  const up = upsidePct(c.mean, price)
  const cards = [
    { label: ko ? '합의 의견 · Nasdaq' : 'Consensus · Nasdaq', value: BUCKET[ratingBucket(c.mean_rating)]?.[i] ?? c.mean_rating ?? '-', sub: ko ? `매수 ${c.buy} · 보유 ${c.hold} · 매도 ${c.sell}` : `${c.buy} buy · ${c.hold} hold · ${c.sell} sell` },
    { label: ko ? '평균 목표가' : 'Mean target', value: usd(c.mean), sub: up != null ? (ko ? `${priceDate} 종가 대비 ${pct(up)}` : `${pct(up)} vs ${priceDate} close`) : null },
    { label: ko ? '목표가 범위' : 'Target range', value: `${usd(c.low)} - ${usd(c.high)}`, sub: ko ? '최저 - 최고' : 'Low - high' },
    next && { label: ko ? '다음 실적 매출 예상' : 'Next quarter revenue est.', value: `$${(next.revenue_usd / 1e6).toFixed(1)}M`, sub: `${next.date} · ${next.source_name}` },
  ].filter(Boolean)
  return (
    <section className="analysts" aria-labelledby="analysts-title">
      <h3 id="analysts-title">{ko ? '증권사 투자의견' : 'Broker ratings'}</h3>
      <div className="stock-stats">
        {cards.map((k) => <div key={k.label} className="stat"><small>{k.label}</small><b>{k.value}</b>{k.sub && <span>{k.sub}</span>}</div>)}
      </div>
      <TargetBar rows={rows} c={c} price={price} ko={ko} />
      <div className="analyst-table-wrap">
        <table className="dilution-table analyst-table">
          <caption>{ko
            ? `증권사별 최근 의견 · 매수 ${n.buy} · 보유 ${n.hold} · 매도 ${n.sell}${n.none ? ` · 의견 미확인 ${n.none}` : ''}`
            : `Latest by broker · ${n.buy} buy · ${n.hold} hold · ${n.sell} sell${n.none ? ` · ${n.none} unknown` : ''}`}</caption>
          <thead><tr><th>{ko ? '증권사' : 'Broker'}</th><th>{ko ? '날짜' : 'Date'}</th><th>{ko ? '의견' : 'Rating'}</th><th className="is-action">{ko ? '변경' : 'Change'}</th><th>{ko ? '목표가' : 'Target'}</th><th>{ko ? '종가 대비' : 'vs close'}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.firm} className={r.stale ? 'is-stale' : undefined}>
            <td><b>{r.firm}</b>{(ko ? r.note_ko : r.note_en) && <small>{ko ? r.note_ko : r.note_en}</small>}</td>
            <td className="is-date">{r.date.slice(2).replaceAll('-', '.')}</td>
            <td>{r.bucket
              ? <><span className={`rating rating-${r.bucket}`}>{BUCKET[r.bucket][i]}</span><small>{r.rating}{r.rating_prev ? ` ← ${r.rating_prev}` : ''}</small></>
              : <small>{ko ? '미확인' : 'Unknown'}</small>}</td>
            <td className="is-action">{ACTION[r.action][i]}</td>
            <td>{r.target ? usd(r.target) : '-'}{r.target_prev && <small>{ko ? `이전 ${usd(r.target_prev)}` : `was ${usd(r.target_prev)}`}</small>}</td>
            <td>{r.upside != null ? pct(r.upside) : '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="page-note">
        {ko
          ? <>증권사 의견을 옮긴 것이고 이 사이트의 판단이 아님 · 투자 조언 아님. 합의 값은 <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.name}</a>(매일 갱신 · {c.fetched_at.slice(0, 10)}), 증권사별 표는 <a href={file.firms_source.url} target="_blank" rel="noreferrer">{file.firms_source.name}</a>(확인 {file.checked})라 포함 증권사가 달라 숫자가 다를 수 있음. 흐린 줄은 1년 넘은 의견. <a href={file.coverage.source} target="_blank" rel="noreferrer">회사 IR 명단</a> {file.coverage.firms.length}곳 중 공개 의견을 못 찾은 곳: {missing.join(', ') || '없음'}.</>
          : <>Broker opinions, not this site's view · not investment advice. Consensus from <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.name}</a> (daily, {c.fetched_at.slice(0, 10)}); the broker table is from <a href={file.firms_source.url} target="_blank" rel="noreferrer">{file.firms_source.name}</a> (checked {file.checked}), so coverage and numbers can differ. Dimmed rows are over a year old. Of the {file.coverage.firms.length} brokers on the <a href={file.coverage.source} target="_blank" rel="noreferrer">company list</a>, no public rating was found for: {missing.join(', ') || 'none'}.</>}
      </p>
    </section>
  )
}

// 목표가 막대: 증권사 목표가마다 점 하나 + 평균 표시 + 현재가 표시. 현재가가 범위 밖이면 막대를 현재가까지 넓힘
function TargetBar({ rows, c, price, ko }) {
  const { lo, hi } = rangeOf(c.low, c.high, price)
  const at = (v) => `${rangePos(v, lo, hi)}%`
  const dots = rows.filter((r) => r.target)
  return (
    <div className="target-bar" role="img" aria-label={ko ? `목표가 ${usd(c.low)}에서 ${usd(c.high)}, 평균 ${usd(c.mean)}, 현재가 ${usd(price)}` : `Targets ${usd(c.low)} to ${usd(c.high)}, mean ${usd(c.mean)}, price ${usd(price)}`}>
      <div className="target-track">
        <i className="target-span" style={{ left: at(c.low), right: `calc(100% - ${at(c.high)})` }} />
        {dots.map((r) => <i key={r.firm} className="target-dot" style={{ left: at(r.target) }} title={`${r.firm} ${usd(r.target)}`} />)}
        <i className="target-mean" style={{ left: at(c.mean) }} />
        <i className="target-price" style={{ left: at(price) }} />
      </div>
      <div className="target-labels">
        <span style={{ left: at(price) }} className="is-price">{ko ? '종가' : 'Close'} {usd(price)}</span>
        <span style={{ left: at(c.mean) }}>{ko ? '평균' : 'Mean'} {usd(c.mean)}</span>
      </div>
    </div>
  )
}
