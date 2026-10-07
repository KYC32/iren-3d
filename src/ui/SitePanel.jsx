// 선택한 사이트의 상세 패널: 요약 → 스펙 → 건물/단계 → 납품 예정 → 타임라인 → 추정 → 출처
import { customerZones } from '../data/customerZones.js'
import { useEffect, useRef } from 'react'
import { ExternalLink, Truck, Clock, Building2, Info, Link2, Handshake } from 'lucide-react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtMw } from '../data/format.js'
import { toMonth } from '../data/timeline.js'
import { fmtWhen } from '../data/events.js'
import { CustomerLogo } from './logos/index.jsx'

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function SitePanel() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const site = useAppStore(selectSelectedSite)
  const month = useAppStore((s) => s.month)
  const companies = useAppStore((s) => s.data?.companies)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const zoneKey = useAppStore((s) => s.selectedZoneKey)
  const home = useAppStore((s) => s.requestCampusHome)
  const panelRef = useRef(null)
  useEffect(() => { if (zoneKey) panelRef.current?.scrollTo({ top: 0 }) }, [zoneKey])
  const selectedId = useAppStore((s) => s.selectedBuildingId)
  const selectBuilding = useAppStore((s) => s.selectBuilding)
  // 3D 에서 건물을 클릭해 고르면 패널의 그 항목이 보이도록 스크롤 (패널에서 직접 고른 경우는 이미 보이니 생략)
  const rowRefs = useRef({})
  const fromPanel = useRef(null)
  useEffect(() => {
    if (!selectedId || fromPanel.current === selectedId) return
    rowRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])
  if (!site) return null
  const st = styleOf(site.status)
  const zones = customerZones(site, companies)
  const zone = zones.find((z) => z.key === zoneKey)
  const buildings = zone?.buildings ?? site.buildings

  return (
    <aside className="site-panel panel" ref={panelRef}>
      {zones.length > 0 && <div className="zone-switch" aria-label={lang === 'ko' ? '고객 구역 선택' : 'Customer zones'}>
        {zones.map((z) => <button key={z.key} aria-pressed={zoneKey === z.key} onClick={() => useAppStore.getState().selectZone(z.key)}>{z.name}</button>)}
      </div>}
      {zone && <section className="zone-summary" aria-label={`${zone.name} ${lang === 'ko' ? '구역 요약' : 'zone summary'}`}>
        <div className="zone-summary-head"><h3>{zone.name} {lang === 'ko' ? '구역' : 'zone'}</h3><button onClick={home}>{lang === 'ko' ? '선택 해제' : 'Clear'}</button></div>
        <p>{zone.buildings.length}{lang === 'ko' ? '개 건물 · 선택 시점 기준' : ' buildings · at selected date'}</p>
        <dl className="sp-specs">
          <div><dt>{lang === 'ko' ? 'IT 용량' : 'IT capacity'}</dt><dd>{zone.itMw ? `${zone.itMw} MW` : '–'}</dd></div>
          <div><dt>{lang === 'ko' ? '시설 총전력' : 'Gross capacity'}</dt><dd>{fmtMw(zone.grossMw)}</dd></div>
        </dl>
        <ul className="zone-statuses">{zone.statuses.map((s) => <li key={s.status}><span className="dot" style={{ background: styleOf(s.status).color }} />{t.status[s.status]}<b>{s.count}{lang === 'ko' ? '동' : ' bldgs'}{s.itMw ? ` · ${s.itMw} MW IT` : ''}</b></li>)}</ul>
        <p className="muted">{lang === 'ko' ? '구역은 공개된 건물·고객 연결을 나타내며 실제 경계도는 아닙니다. 일정은 아래 건물별 목표를 확인하세요.' : 'Zones show published building/customer links, not surveyed boundaries. Target dates are listed by building below.'}</p>
      </section>}
      {!zone && <>

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

      </>}
      <h4><Building2 size={14} /> {t.panel.buildings}</h4>
      {buildings.length === 0 && <div className="sp-empty">{t.empty}</div>}
      <ul className="sp-buildings">
        {buildings.map((b) => {
          const bs = styleOf(b.status)
          return (
            <li
              key={b.id}
              ref={(el) => (rowRefs.current[b.id] = el)}
              className={`${hoverId === b.id ? 'is-hover' : ''}${selectedId === b.id ? ' is-selected' : ''}`}
              onMouseEnter={() => setHover(b.id)}
              onMouseLeave={() => useAppStore.getState().clearHover(b.id)}
              onClick={() => { fromPanel.current = b.id; selectBuilding(b.id, true) }} // 클릭 → 카메라가 그 건물로
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

      <SiteContracts site={site} zone={zone} companies={companies} month={month} lang={lang} t={t} />

      {zone && <h4 className="zone-context">{lang === 'ko' ? '캠퍼스 전체 참고 정보' : 'Campus-wide reference'}</h4>}
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

// 이 사이트에 연결된 고객 계약 (타임라인이 서명일 이전이면 "서명 전"으로 흐리게)
function SiteContracts({ site, zone, companies, month, lang, t }) {
  const list = zone ? zone.contracts.filter((c) => toMonth(c.signed) <= month) : (companies ?? []).flatMap((c) => c.contracts ?? []).filter((k) => k.sites.includes(site.id))
  if (!list.length) return zone ? <p className="sp-note">{lang === 'ko' ? '선택 시점에 확인된 연결 계약이 없습니다.' : 'No linked contract confirmed at the selected date.'}</p> : null
  const bName = Object.fromEntries(site.buildings.map((b) => [b.id, pickName(b, lang)]))
  return (
    <>
      <h4><Handshake size={14} /> {t.contracts.title}</h4>
      <ul className="sp-contracts">
        {list.map((k) => {
          const before = month < toMonth(k.signed)
          return (
            <li key={k.id} className={before ? 'before' : ''} style={{ borderColor: k.color }}>
              <div className="spc-head">
                <b className="spc-name" style={{ color: k.color }}>
                  {k.logo && <CustomerLogo name={k.logo} size={13} />}
                  {lang === 'ko' ? k.customer_ko ?? k.customer : k.customer}
                </b>
                <span>
                  {k.value_usd_bn != null && `$${k.value_usd_bn}bn`}
                  {k.term_years != null && ` · ${k.term_years}${t.contracts.years}`}
                  {k.it_mw != null && ` · ${k.it_mw}MW IT`}
                </span>
              </div>
              <div className="spc-meta">
                {fmtWhen(k.signed, lang)}
                {k.buildings?.length ? ` · ${k.buildings.map((id) => bName[id] ?? id).join(', ')}` : ''}
                {' '}<a href={k.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>
              </div>
              {(lang === 'ko' ? k.note_ko : k.note_en) && <div className="spc-note">{lang === 'ko' ? k.note_ko : k.note_en}</div>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
