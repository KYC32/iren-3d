// =============================================================
// MovesSection — 주가 페이지의 "최근 하락 구간" 칸
//   고점 → 최근 종가 요약 → 같은 기간 다른 회사 수익률(막대) → 큰 변동일 목록(등락·구분·까닭·출처)
// 데이터: stock.json 시리즈(자동) · public/data/peers.json(자동) · public/data/moves.json(까닭, 사람이 옮김)
// 큰 변동일은 숫자로 자동 선택. 까닭을 적지 않은 날은 "정리 전"으로 남기고 짐작해서 채우지 않음
// 까닭은 당시 보도가 든 것이지 원인을 확정한 것이 아니므로 화면에 밝힘
// =============================================================
import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { recentPeak, moveRows, peerBars } from '../data/market.js'

const pct = (n, d = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`
const usd = (n) => `$${n.toFixed(2)}`
const SCOPE = { company: ['IREN 소식', 'IREN news'], sector: ['업계·시장', 'Sector / market'] }

export default function MovesSection({ series, moves, peers, lang }) {
  const ko = lang === 'ko', i = ko ? 0 : 1
  const peak = useMemo(() => recentPeak(series, 90), [series])
  const rows = useMemo(() => moveRows(series, moves?.notes, { from: peak?.date }), [series, moves, peak])
  const bars = useMemo(() => (peak ? peerBars(peers, series, peak.date) : []), [peers, series, peak])
  const last = series.at(-1)
  // 고점이 최근 종가와 같으면 하락 구간이 없는 것 → 칸을 그리지 않음
  if (!peak || !last || peak.date === last.date) return null
  const drop = (last.close / peak.close - 1) * 100
  const widest = Math.max(1, ...bars.map((b) => Math.abs(b.pct)))
  return (
    <section className="analysts moves" aria-labelledby="moves-title">
      <h3 id="moves-title">{ko ? '최근 하락 구간' : 'Recent decline'}</h3>
      <p className="moves-head"><b>{pct(drop)}</b> {ko ? `${peak.date} 고점 ${usd(peak.close)} → ${last.date} ${usd(last.close)}` : `${peak.date} high ${usd(peak.close)} → ${last.date} ${usd(last.close)}`}</p>
      {bars.length > 1 && <>
        <h4>{ko ? '같은 기간 다른 회사' : 'Others over the same period'}</h4>
        <ul className="peer-bars">
          {bars.map((b) => {
            // 0 을 가운데 두고 왼쪽 = 하락, 오른쪽 = 상승 (막대 길이는 가장 큰 변화 기준)
            const w = (Math.abs(b.pct) / widest) * 50
            return <li key={b.symbol} className={b.isIren ? 'is-iren' : undefined}>
              <span className="peer-name">{b.name}</span>
              <span className="peer-track"><i style={b.pct < 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }} /></span>
              <span className="peer-pct">{pct(b.pct)}</span>
            </li>
          })}
        </ul>
      </>}
      <h4>{ko ? '큰 변동일과 당시 보도' : 'Big moves and what was reported'}</h4>
      <ul className="move-list">
        {rows.map((r) => <li key={r.date}>
          <div className="move-when">
            <span>{r.date.slice(5).replace('-', '/')}</span>
            <b className={r.pct >= 0 ? 'is-up' : 'is-down'}>{pct(r.pct)}</b>
          </div>
          {r.note
            ? <p>
                <span className={`move-scope is-${r.note.scope}`}>{SCOPE[r.note.scope][i]}</span>
                {ko ? r.note.ko : r.note.en}{' '}
                <a href={r.note.source} target="_blank" rel="noreferrer">{r.note.source_name}<ArrowUpRight size={11} aria-hidden="true" /></a>
              </p>
            : <p className="is-empty">{ko ? '까닭 정리 전' : 'Not yet reviewed'}</p>}
        </li>)}
      </ul>
      <p className="page-note">
        {ko
          ? <>등락은 전날 종가 대비이고 하루 6% 이상 움직인 날과 주요 소식이 있던 날만 보여 줌. 까닭은 당시 보도가 든 것이며 하나의 원인으로 단정할 수 없음 · 투자 조언 아님. 고점은 최근 90거래일 종가 기준이고 다른 회사는 <a href={peers?.source.url} target="_blank" rel="noreferrer">Nasdaq</a> 종가로 계산. 까닭 확인 {moves?.checked}.</>
          : <>Moves are close to close, showing days of 6% or more and days with major news. Reasons are what coverage cited at the time, not established causes · not investment advice. The high is the top close of the last 90 trading days; others use <a href={peers?.source.url} target="_blank" rel="noreferrer">Nasdaq</a> closes. Reasons checked {moves?.checked}.</>}
      </p>
    </section>
  )
}
