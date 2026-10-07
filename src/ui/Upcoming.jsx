// =============================================================
// 다가오는 일정 — 기준일 이후 예정된 건물 가동·통전·납품·실적 발표
// 항목을 누르면 타임라인을 그 시점으로 옮기고 해당 사이트로 이동 → 미래 모습을 미리 보기
// 회사 발표 목표(target)와 외부 추정(estimate)을 배지로 구분합니다.
// =============================================================
import { useMemo } from 'react'
import { CalendarClock, Link2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { upcomingEvents, fmtWhen } from '../data/events.js'
import { styleOf, PENDING_COLOR } from '../data/statusStyle.js'

// 사건 종류별 점 색
function dotColor(e) {
  if (e.kind === 'phase') return styleOf(e.status).color
  if (e.kind === 'earnings') return '#2f6bed'
  return PENDING_COLOR
}

export default function Upcoming() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const events = useAppStore((s) => s.events)
  const asOf = useAppStore((s) => s.asOfMonth)
  const month = useAppStore((s) => s.month)
  const data = useAppStore((s) => s.data)
  const jumpTo = useAppStore((s) => s.jumpTo)
  const sites = useMemo(() => Object.fromEntries((data?.raw.sites ?? []).map((s) => [s.id, s])), [data])
  const list = useMemo(() => upcomingEvents(events, asOf), [events, asOf])

  // 분기별로 묶기 (2026년 4분기 / 2027년 / ...)
  const groups = useMemo(() => {
    const g = new Map()
    for (const e of list) {
      const y = Math.floor(e.month / 12), q = Math.floor((e.month % 12) / 3) + 1
      const key = y >= 2027 ? `${y}` : `${y}-Q${q}`
      if (!g.has(key)) g.set(key, [])
      g.get(key).push(e)
    }
    return [...g.entries()]
  }, [list])

  if (!list.length) return <div className="sp-empty">{t.upcoming.empty}</div>
  return (
    <div className="upcoming">
      <div className="up-hint"><CalendarClock size={12} /> {t.upcoming.hint}</div>
      {groups.map(([key, evs]) => (
        <section key={key}>
          <h5>{fmtWhen(key, lang)}</h5>
          <ul>
            {evs.map((e) => (
              <li key={e.id} className={month >= e.month ? 'passed' : ''}>
                <button className="up-row" onClick={() => jumpTo(e.month, e.siteId)}>
                  <span className="dot" style={{ background: dotColor(e) }} />
                  <span className="up-text">
                    <span className="up-title">{lang === 'ko' ? e.title_ko : e.title_en}</span>
                    <span className="up-meta">
                      {e.siteId ? pickName(sites[e.siteId] ?? { name: e.siteId }, lang) : 'IREN'} · {fmtWhen(e.when, lang)}
                      <span className={`basis ${e.basis}`}>{t.basis[e.basis]}</span>
                    </span>
                  </span>
                </button>
                <a className="up-src" href={e.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
