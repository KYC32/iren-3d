// 선택한 사이트의 상세 패널: 요약 → 스펙 → 건물/단계 → 납품 예정 → 타임라인 → 추정 → 출처
import { ExternalLink, Truck, Clock, Building2, Info, Link2 } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtMw } from '../scene/geo.js'

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function SitePanel() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const site = useAppStore(selectSelectedSite)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  if (!site) return null
  const st = styleOf(site.status)

  return (
    <aside className="site-panel panel">
      <div className="sp-head">
        <span className="badge" style={{ background: st.color }}>{t.status[site.status]}</span>
        <span className="sp-conf">{t.panel.confidence}: {site.confidence}</span>
      </div>
      <p className="sp-summary">{lang === 'ko' ? site.summary_ko : site.summary_en}</p>

      <dl className="sp-specs">
        <div><dt>{t.panel.grid}</dt><dd>{fmtMw(site.grid_mw)}</dd></div>
        <div><dt>{t.panel.acres}</dt><dd>{site.acres ? `${site.acres.toLocaleString()} ${t.units.acres}` : '–'}</dd></div>
        <div><dt>{t.panel.cooling}</dt><dd>{site.cooling}</dd></div>
        <div><dt>{t.panel.substation}</dt><dd>{site.substation.voltage ? `${site.substation.voltage} · ` : ''}{site.substation.status === 'energized' ? `${t.panel.energized} ${site.substation.dates?.energized ?? ''}` : `${t.panel.target} ${site.substation.dates?.target ?? ''}`}</dd></div>
      </dl>
      {site.coord_confidence !== 'high' && <div className="sp-note"><Info size={12} /> {t.panel.coordNote}</div>}

      <h4><Building2 size={14} /> {t.panel.buildings}</h4>
      {site.buildings.length === 0 && <div className="sp-empty">{t.empty}</div>}
      <ul className="sp-buildings">
        {site.buildings.map((b) => {
          const bs = styleOf(b.status)
          return (
            <li
              key={b.id}
              className={hoverId === b.id ? 'is-hover' : ''}
              onMouseEnter={() => setHover(b.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="dot" style={{ background: bs.color }} />
              <span className="b-name">
                {pickName(b, lang)}
                <span className="b-meta">
                  {t.status[b.status]}
                  {b.progress != null && b.status === 'under_construction' ? ` ${Math.round(b.progress * 100)}%` : ''}
                  {b.customer ? ` · ${b.customer}` : ''}
                  {b.dates?.target ? ` · ${t.panel.target} ${b.dates.target}` : ''}
                  {b.dates?.end ? ` · ~${b.dates.end}` : ''}
                </span>
              </span>
              <span className="b-mw">{b.it_mw ? `${b.it_mw} IT` : `${b.gross_mw}`}</span>
            </li>
          )
        })}
      </ul>

      {site.deliveries.length > 0 && (
        <>
          <h4><Truck size={14} /> {t.panel.deliveries}</h4>
          <ul className="sp-list">
            {site.deliveries.map((d, i) => (
              <li key={i}>
                <span className="pending">{d.eta}</span> {d.what} <span className="muted">({d.from})</span>{' '}
                <a href={d.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4><Clock size={14} /> {t.panel.timeline}</h4>
      <ol className="sp-timeline">
        {site.timeline.map((e, i) => (
          <li key={i}>
            <span className="date">{e.date}</span>
            <span>
              {lang === 'ko' ? e.event : e.event_en ?? e.event}{' '}
              <a href={e.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>
            </span>
          </li>
        ))}
      </ol>

      {site.estimates.length > 0 && (
        <>
          <h4 className="est"><Info size={14} /> {t.panel.estimates}</h4>
          <ul className="sp-list est">
            {site.estimates.map((e, i) => (
              <li key={i}>
                {lang === 'ko' ? e.note : e.note_en ?? e.note}{' '}
                <a href={e.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4><ExternalLink size={14} /> {t.panel.sources}</h4>
      <ul className="sp-sources">
        {site.sources.map((u) => (
          <li key={u}><a href={u} target="_blank" rel="noreferrer">{host(u)}</a></li>
        ))}
      </ul>
    </aside>
  )
}
