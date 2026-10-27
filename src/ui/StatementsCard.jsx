// =============================================================
// StatementsCard — 본사 3D 화면의 가운데 카드 "경영진 발언" (옥상 위 CEO 카드·말풍선을 누르면 열림)
// -------------------------------------------------------------
// 탭 두 개 (useAppStore.hqCard.tab — 주소에도 card=탭):
//   약속 (promises)   : 약속마다 한 줄 타임라인 — 처음 말한 날 → 기한 막대, 이룬 날 점 (ui/PromiseTimeline.jsx)
//                       카드는 늘 이 탭으로 열림: CEO 사진·성적표 · 말풍선(그 발언의 약속을 펼침) · ≡ 메뉴 'CEO 약속 타임라인'
//                       (2026-10-23 사용자 요청 "본사에서 경영진 발언을 확인할 때 약속이 먼저")
//   발언 (statements) : 달별 묶음 (data/statementFeed.js) — 요약이 본문, 약속은 칩 하나(누르면 약속 탭의 그 줄),
//                       영어 원문은 접어 둠. CEO 사진으로 열었으면 이 탭에서 그 사람 발언만 (hqCard.person)
//   2026-10-22 사용자 요청: "약속만 따로 · 전체 나열은 가독성이 별로" → 예전 한 줄 목록(56줄)을 이 두 탭으로 바꿈
// 판정(지켜짐·늦게 지켜짐·늦어짐·철회·기한 전)은 손으로 적지 않고 data/promises.js 가 계산 (기준일 = 자료 확인일)
// <dialog> + showModal(): Esc·바깥(어두운 뒷배경)을 누르면 닫히고, 닫으면 초점이 누른 곳으로 돌아감 (AppMenu 와 같은 방식)
// 따로 불러옴(App 의 React.lazy): 이 파일·statements.css·발언 자료가 첫 화면 번들에 안 들어감
// 설계: docs/superpowers/specs/2026-10-21-ceo-statements-design.md 5-2·6장
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X, ArrowUpRight, ChartGantt, MessageSquareQuote } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js' // 본사·경영진 발언 문구 (첫 화면 사전과 따로 — 이 카드와 함께 불러옴)
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { statementFeed, feedChannels } from '../data/statementFeed.js'
import { speakers } from '../data/statementRows.js'
import { STATUS_ICON, fill, ChannelMark, Face } from './statementParts.jsx'
import PromiseTimeline from './PromiseTimeline.jsx'

const TABS = ['promises', 'statements']
const TAB_ICON = { promises: ChartGantt, statements: MessageSquareQuote }

export default function StatementsCard() {
  const lang = useAppStore((s) => s.lang)
  const card = useAppStore((s) => s.hqCard) ?? {}
  const close = useAppStore((s) => s.closeHqCard)
  const setTab = useAppStore((s) => s.setHqTab)
  const openCard = useAppStore((s) => s.openHqCard)
  const building = useAppStore((s) => s.data?.companies?.[0]?.hq?.building)
  const city = useAppStore((s) => (lang === 'ko' ? s.data?.companies?.[0]?.hq?.city_ko : s.data?.companies?.[0]?.hq?.city_en) ?? '')
  const [file, setFile] = useState(peekStatements) // 이미 받은 자료가 있으면 바로
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (file) return undefined
    let alive = true
    loadStatements().then((f) => { if (!alive) return; if (f) setFile(f); else setFailed(true) })
    return () => { alive = false }
  }, [file])
  // 카드가 붙으면 바로 열고(showModal), 떨어질 땐 닫아서 초점이 누른 곳(말풍선·CEO 카드)으로 돌아가게
  const dialog = useRef(null)
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    return () => { if (d?.open) d.close() }
  }, [])
  // 머리줄(제목 + 탭) 높이를 재서 --st-head-h 로 — 약속 탭의 축이 스크롤해도 머리 바로 아래에 붙게 (statements.css .tl-axis)
  const body = useRef(null), head = useRef(null)
  useLayoutEffect(() => {
    const hd = head.current, bd = body.current
    if (!hd || !bd || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => bd.style.setProperty('--st-head-h', `${hd.offsetHeight}px`))
    ro.observe(hd)
    return () => ro.disconnect()
  }, [])
  const h = hqText[lang === 'ko' ? 'ko' : 'en']
  const tab = TABS.includes(card.tab) ? card.tab : 'promises' // 탭이 없으면 약속 먼저 (2026-10-23 사용자 요청)
  const who = card.person ? file?.people.find((p) => p.id === card.person) : null
  const title = who && tab === 'statements' ? fill(h.personTitle, { name: who.name }) : h.panelTitle
  // 탭 바꾸기: 카드를 맨 위로 올린 뒤 바꿈 (안 그러면 앞 탭의 스크롤 위치에서 시작) — 약속 칩으로 오면 약속 탭이 그 줄로 다시 내림
  const goTab = (next, extra) => {
    if (body.current) body.current.scrollTop = 0
    setTab(next, extra)
  }
  // 탭 이동: ← → 로도 (탭 목록 방식)
  const onTabKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const next = TABS[(TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    goTab(next)
    requestAnimationFrame(() => document.getElementById(`st-tab-${next}`)?.focus())
  }
  return (
    <dialog ref={dialog} className="statements-card statements-panel" aria-labelledby="st-card-title"
      onCancel={close} onClose={close}
      // 카드 바깥(어두운 뒷배경)을 누르면 닫힘: 안쪽 내용(.st-card-body)이 카드를 꽉 채우므로 눌린 대상이 dialog 자신이면 = 뒷배경
      onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="st-card-body" ref={body}>
        <div className="st-card-head" ref={head}>
          <div className="st-card-title">
            <div><small>{fill(h.panelLabel, { city })}</small><h2 id="st-card-title">{title}</h2></div>
            <button type="button" className="close-small" onClick={close} aria-label={h.close} title={h.close}><X size={14} aria-hidden="true" /></button>
          </div>
          {file && (
            <div className="st-tabs" role="tablist" aria-label={h.panelTitle} onKeyDown={onTabKey}>
              {TABS.map((k) => {
                const Icon = TAB_ICON[k]
                const n = k === 'promises' ? file.promises.length : file.statements.length
                return (
                  <button key={k} id={`st-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="st-tab-panel"
                    tabIndex={tab === k ? 0 : -1} onClick={() => { if (k !== tab) goTab(k) }}>
                    <Icon size={14} aria-hidden="true" />{fill(h.tabs[k], { n })}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {file ? (
          <div id="st-tab-panel" role="tabpanel" aria-labelledby={`st-tab-${tab}`}>
            {tab === 'promises'
              ? <PromiseTimeline file={file} lang={lang} h={h} open={card.open ?? null} onOpen={(id) => setTab('promises', id ? { open: id } : {})} />
              : <StatementFeed key={card.person ?? ''} file={file} lang={lang} h={h} person={card.person ?? null}
                  onPromise={(id) => goTab('promises', { open: id })} onShowAll={() => openCard({ tab: 'statements' })} />}
            <Notes file={file} lang={lang} h={h} building={building} />
          </div>
        ) : <p className="st-status" role="status">{failed ? h.loadError : h.loading}</p>}
      </div>
    </dialog>
  )
}

// 발언 탭: 채널 거르기 + 달별 묶음 (왼쪽 달 · 오른쪽 발언 — Linear 변경 기록처럼)
function StatementFeed({ file, lang, h, person, onPromise, onShowAll }) {
  const [channel, setChannel] = useState('all')
  const channels = useMemo(() => feedChannels(file, person), [file, person])
  const ch = channels.includes(channel) ? channel : 'all'
  const months = useMemo(() => statementFeed(file, { channel: ch, person }), [file, ch, person])
  const people = useMemo(() => Object.fromEntries(file.people.map((p) => [p.id, p])), [file])
  const many = speakers(file).length > 1 // 말한 사람이 둘 이상일 때만 줄마다 이름
  const who = person ? people[person] : null
  if (who && !file.statements.some((s) => s.person === person)) {
    // 발언을 하나도 못 찾은 사람 (예: Will Roberts — 지금은 화면에서 빠져 있어 옛 링크로만 옴)
    return <p className="st-empty">{fill(h.noStatements, { name: who.name })}</p>
  }
  return <>
    <div className="st-chips" role="group" aria-label={h.panelTitle}>
      {channels.map((c) => <button key={c} type="button" aria-pressed={ch === c} onClick={() => setChannel(c)}>{h.chips[c]}</button>)}
      {who && <button type="button" className="fd-person" onClick={onShowAll} title={h.fd.showAll}>{fill(h.fd.personOnly, { name: who.name })}<X size={12} aria-hidden="true" /></button>}
    </div>
    {months.map((m) => (
      <section className="fd-month" key={m.month} aria-label={monthLabel(m.month, lang)}>
        <h3 className="fd-month-head"><span>{monthLabel(m.month, lang)}</span><small>{fill(h.fd.count, { n: m.items.length })}</small></h3>
        <ol className="fd-items">
          {m.items.map((it) => <FeedItem key={it.id} it={it} who={people[it.person]} many={many} lang={lang} h={h} onPromise={onPromise} />)}
        </ol>
      </section>
    ))}
  </>
}

// 발언 한 줄: 채널·날짜·원문 링크 → 한국어 요약(본문) → 약속 칩(또는 '의견') → 접힌 영어 원문
function FeedItem({ it, who, many, lang, h, onPromise }) {
  const ko = lang === 'ko'
  return (
    <li className="fd-item">
      <div className="st-meta">
        <ChannelMark channel={it.channel} h={h} /><span>·</span><time dateTime={it.date}>{it.date}</time>
        {many && <><span>·</span><span>{who?.name}</span></>}
        <a className="st-src" href={it.url} target="_blank" rel="noreferrer">{h.source}{it.at ? ` · ${it.at}` : ''}<ArrowUpRight size={11} aria-hidden="true" /></a>
      </div>
      <p className="fd-summary">{ko ? it.summary_ko : it.summary_en}</p>
      <div className="fd-tags">
        {it.promises.length ? it.promises.map((c) => {
          const Icon = STATUS_ICON[c.verdict.status]
          return (
            <button key={c.promise.id} type="button" className={`fd-chip is-${c.verdict.status}`} onClick={() => onPromise(c.promise.id)} title={h.signOpen}>
              <Icon size={12} className="fd-chip-icon" aria-hidden="true" />
              <span className="fd-chip-title">{ko ? c.promise.title_ko : c.promise.title_en}</span>
              <span className="fd-chip-status">{h.status[c.verdict.status]}</span>
              {c.repeat && <em>{h.fd.repeat}</em>}
            </button>
          )
        }) : <span className="st-opinion">{h.opinion}</span>}
        {it.beforeSince && <small className="fd-tag">{h.beforeSince}</small>}
      </div>
      {it.quote && <details className="fd-quote"><summary>{h.fd.quote}</summary><q className="st-quote">{it.quote}</q></details>}
    </li>
  )
}

// 달 이름: '2026년 9월' · 'Sep 2026'
function monthLabel(month, lang) {
  const [y, m] = month.split('-').map(Number)
  if (lang === 'ko') return `${y}년 ${m}월`
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// 카드 맨 아래 작은 글씨: 말한 사람(사진 출처) · 발언이 없어 뺀 사람 · 3D 건물 설명 · 안내
function Notes({ file, lang, h, building }) {
  const shown = speakers(file)
  const silent = file.people.filter((p) => !shown.includes(p))
  const sources = [...new Set(shown.map((p) => p.photo_source))] // 사진 출처 (같은 페이지면 한 번만)
  return (
    <footer className="st-notes">
      <div className="st-people">
        {shown.map((p) => <div key={p.id} className="st-person"><Face person={p} small /><span><b>{p.name}</b><small>{lang === 'ko' ? p.title_ko : p.title_en}</small></span></div>)}
        <p className="st-photo-src">{sources.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{h.photoSource}<ArrowUpRight size={10} aria-hidden="true" /></a>)}</p>
      </div>
      {silent.length > 0 && <p className="st-silent">{fill(h.silentNote, { names: silent.map((p) => p.name).join(', ') })}</p>}
      {building && <p className="st-model-note">{fill(h.modelNote, { floors: building.floors, level: building.level })} · <a href={building.source} target="_blank" rel="noreferrer">{h.buildingSource}<ArrowUpRight size={10} aria-hidden="true" /></a>
        {/* 공시 주소의 층이 바뀐 기록 (예: 2026-05-08 분기 보고서부터 5층, 그 전엔 6층) + 그 공시 */}
        {building.moved_from && <> · {fill(h.movedNote, { date: building.moved_from.first_seen, level: building.level, from: building.moved_from.level })} · <a href={building.moved_from.source} target="_blank" rel="noreferrer">{h.filingSource}<ArrowUpRight size={10} aria-hidden="true" /></a></>}
        {/* 동네 모양 출처 (ODbL 출처 표기) */}
        {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors<ArrowUpRight size={10} aria-hidden="true" /></a>
      </p>}
      <p className="st-disclaimer">{h.disclaimer}</p>
    </footer>
  )
}
