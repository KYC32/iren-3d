// =============================================================
// StatementsPanel — "경영진 발언" 칸 (지도 본사 카드·'본사' 지역 단추·≡ 메뉴로 엶, 주소 #hq=1)
// -------------------------------------------------------------
// 위에서 아래로: 두 공동 CEO → 약속 성적표 → 거르기 단추 → 발언 목록 → 안내 문구
//   판정(지켜짐·늦게 지켜짐·늦어짐·철회·기한 전)은 손으로 적지 않고 promises.js 가 계산 (기준일 = 자료 확인일)
//   목록 행은 statementRows.js 가 만들고 여기서는 그리기만
// 따로 불러옴(App 의 React.lazy): 이 파일·statements.css·발언 자료가 첫 화면 번들에 안 들어감
// 겉 상자는 캠퍼스 칸과 같은 클래스(site-panel campus-panel) → 같은 자리, 휴대폰에서는 아래 시트
// 설계: docs/superpowers/specs/2026-10-21-ceo-statements-design.md 5-2·6장
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { X, Mic, Newspaper, FileText, ArrowUpRight, CircleCheck, Clock, TriangleAlert, Ban } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js' // 본사·경영진 발언 문구 (첫 화면 사전과 따로 — 이 칸과 함께 불러옴)
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { verdictOf, scoreboard, fmtAmount, evidenceLabel } from '../data/promises.js'
import { statementRows, visibleFilters } from '../data/statementRows.js'
import { initialsOf } from '../data/format.js'
import './statements.css'

const STATUSES = ['kept', 'late-kept', 'late', 'withdrawn', 'pending']  // 성적표 막대 순서
const STATUS_ICON = { kept: CircleCheck, 'late-kept': CircleCheck, late: TriangleAlert, withdrawn: Ban, pending: Clock }
const ym = (day) => day.slice(0, 7) // 'YYYY-MM-DD' → 'YYYY-MM'
// 문구 틀의 {이름} 자리를 값으로 채움 ('기한 안에 지켜짐 {a}/{b}' → '기한 안에 지켜짐 4/6')
const fill = (text, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), text)
// 확인일 표시: 한국어 '10월 21일', 영어 'Oct 21' — 올해가 아니면 연도도 (오래된 자료임을 알 수 있게)
function fmtDay(day, lang) {
  const [y, m, d] = day.split('-').map(Number)
  const thisYear = y === new Date().getFullYear()
  if (lang === 'ko') return `${thisYear ? '' : `${y}년 `}${m}월 ${d}일`
  const mon = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${mon} ${d}${thisYear ? '' : `, ${y}`}`
}

export default function StatementsPanel() {
  const lang = useAppStore((s) => s.lang)
  const closeHq = useAppStore((s) => s.closeHq)
  const city = useAppStore((s) => (lang === 'ko' ? s.data?.companies?.[0]?.hq?.city_ko : s.data?.companies?.[0]?.hq?.city_en) ?? '')
  const [file, setFile] = useState(peekStatements) // 이미 받은 자료가 있으면 바로
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (file) return undefined
    let alive = true
    loadStatements().then((f) => { if (!alive) return; if (f) setFile(f); else setFailed(true) })
    return () => { alive = false }
  }, [file])
  const h = hqText[lang === 'ko' ? 'ko' : 'en']
  return (
    <aside className="site-panel panel campus-panel statements-panel" aria-label={h.panelTitle}>
      <div className="campus-heading">
        <div className="campus-heading-title"><small>{fill(h.panelLabel, { city })}</small><h2>{h.panelTitle}</h2></div>
        <div className="campus-heading-actions">
          <button className="close-small" onClick={closeHq} aria-label={h.close} title={h.close}><X size={14} aria-hidden="true" /></button>
        </div>
      </div>
      {file ? <Body file={file} lang={lang} h={h} /> : <p className="st-status" role="status">{failed ? h.loadError : h.loading}</p>}
    </aside>
  )
}

function Body({ file, lang, h }) {
  const [filter, setFilter] = useState('all')
  const people = useMemo(() => Object.fromEntries(file.people.map((p) => [p.id, p])), [file])
  const rows = useMemo(() => statementRows(file, filter), [file, filter])
  const filters = useMemo(() => visibleFilters(file), [file]) // 발언이 없는 채널 단추는 숨김
  const sb = useMemo(() => scoreboard(file.promises, file.checkedAt), [file])
  // 판정별 '목표 줄임' 수 — 범례 "지켜짐 4 (그중 목표 줄임 1)"
  const reducedBy = useMemo(() => {
    const out = {}
    for (const p of file.promises) { const v = verdictOf(p, file.checkedAt); if (v.reduced) out[v.status] = (out[v.status] ?? 0) + 1 }
    return out
  }, [file])
  const counts = { kept: sb.kept, 'late-kept': sb.lateKept, late: sb.late, withdrawn: sb.withdrawn, pending: sb.pending }
  const sources = [...new Set(file.people.map((p) => p.photo_source))] // 사진 출처 (같은 페이지면 한 번만)
  return <>
    {/* 1) 두 공동 CEO + 사진 출처 */}
    <div className="st-people">
      {file.people.map((p) => <div key={p.id} className="st-person"><Face person={p} /><span><b>{p.name}</b><small>{lang === 'ko' ? p.title_ko : p.title_en}</small></span></div>)}
    </div>
    <p className="st-photo-src">{sources.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{h.photoSource}<ArrowUpRight size={10} aria-hidden="true" /></a>)}</p>

    {/* 2) 약속 성적표 */}
    <section className="st-score" aria-label={fill(h.promisesCount, { n: sb.total })}>
      <div className="st-score-top"><b>{fill(h.promisesCount, { n: sb.total })}</b><span>{fill(h.keptOnTime, { a: sb.kept, b: sb.due })}</span></div>
      <div className="st-bar" aria-hidden="true">{STATUSES.filter((k) => counts[k] > 0).map((k) => <i key={k} className={`v-${k}`} style={{ flex: counts[k] }} />)}</div>
      <div className="st-legend">{STATUSES.map((k) => <span key={k} className={`v-${k}`}>{h.status[k]} {counts[k]}{reducedBy[k] ? ` (${fill(h.reducedInLegend, { n: reducedBy[k] })})` : ''}</span>)}</div>
      <small className="st-checked">{fill(h.checkedAt, { date: fmtDay(file.checkedAt, lang) })}</small>
    </section>

    {/* 3) 거르기 단추 */}
    <div className="st-chips" role="group" aria-label={h.panelTitle}>
      {filters.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{h.chips[f]}</button>)}
    </div>

    {/* 4) 발언 목록 */}
    <ol className="st-list">{rows.map((r) => <Row key={r.id} r={r} person={people[r.person]} lang={lang} h={h} />)}</ol>

    {/* 5) 안내 */}
    <p className="st-disclaimer">{h.disclaimer}</p>
  </>
}

// 발언 한 줄
function Row({ r, person, lang, h }) {
  const ko = lang === 'ko'
  // 채널 표시: X = 굵은 글자 "X", 실적 발표 콜 = 마이크, 인터뷰 = 신문, 보도자료 = 문서
  const ChannelIcon = { call: Mic, interview: Newspaper, release: FileText }[r.channel]
  const channel = r.channel === 'x' ? <b className="st-x" aria-hidden="true">X</b> : <ChannelIcon size={12} aria-hidden="true" />
  return (
    <li className="st-row">
      <Face person={person} small />
      <div className="st-row-body">
        {/* X 는 굵은 글자 "X" 하나로 충분 (이름까지 쓰면 "X X"), 실적 발표·인터뷰는 아이콘 + 이름 */}
        <div className="st-meta">{channel}{r.channel !== 'x' && <span>{h.chips[r.channel]}</span>}<span>·</span><span>{person?.name}</span><span>·</span><time dateTime={r.date}>{r.date}</time></div>
        <p className="st-summary">{ko ? r.summary_ko : r.summary_en}</p>
        {r.quote && <q className="st-quote">{r.quote}</q>}
        {r.verdict ? <Verdict r={r} lang={lang} h={h} /> : <span className="st-opinion">{h.opinion}</span>}
        {(r.repeatOf || r.beforeSince) && <div className="st-tags">
          {r.repeatOf && <small>{fill(h.repeat, { date: r.repeatOf })}</small>}
          {r.beforeSince && <small>{h.beforeSince}</small>}
        </div>}
        <a className="st-src" href={r.url} target="_blank" rel="noreferrer">{h.source}{r.at ? ` · ${r.at}` : ''}<ArrowUpRight size={11} aria-hidden="true" /></a>
      </div>
    </li>
  )
}

// 판정 배지 + 근거 한 줄 (+ 목표 줄임 · 미룸 · 이룬 시점 정밀도)
function Verdict({ r, lang, h }) {
  const v = r.verdict, p = r.promise, d = h.detail
  const ev = (url) => evidenceLabel(url, lang)
  const amount = (a) => fmtAmount(a, lang)
  const Icon = STATUS_ICON[v.status]
  let detail
  if (v.status === 'kept') detail = fill(d.kept, { ym: ym(v.achieved), ev: ev(p.fulfilled.url) })
  else if (v.status === 'late-kept') detail = fill(d.lateKept, { due: ym(v.deadline), ym: ym(v.achieved) })
  else if (v.status === 'late') detail = d.late + (v.progress ? ` · ${fill(d.progress, { done: amount(v.progress.done), of: amount(v.progress.of) })}` : '')
  else if (v.status === 'withdrawn') detail = `${ym(p.withdrawn.date)} · ${lang === 'ko' ? p.withdrawn.reason_ko : p.withdrawn.reason_en}`
  else detail = fill(d.pending, { due: ym(v.deadline) })
  const met = v.status === 'kept' || v.status === 'late-kept'
  const lastPostponed = p.postponed?.at(-1)
  return <div className="st-verdict">
    <div className="st-verdict-top">
      <span className={`st-badge v-${v.status}`}><Icon size={12} aria-hidden="true" />{h.status[v.status]}{v.reduced && <em>{h.reducedTag}</em>}</span>
      <small>{detail}</small>
    </div>
    {p.reduced && <p className="st-note">{d.reduced} <s>{amount(p.target)}</s> → {amount(p.reduced.amount)} {met ? d.reducedDone : d.reducedOnly} · {ev(p.reduced.url)}</p>}
    {lastPostponed && <p className="st-note">{fill(d.postponed, { to: lastPostponed.to })}</p>}
    {met && !p.fulfilled.date && <p className="st-note">{p.fulfilled.period ? fill(d.periodOnly, { period: p.fulfilled.period }) : d.publishedOnly}</p>}
  </div>
}

// 사진 동그라미: 사진을 못 받으면 이름 머리글자
function Face({ person, small = false }) {
  const [broken, setBroken] = useState(false)
  const cls = `st-face${small ? ' is-small' : ''}`
  if (!person) return <i className={cls} />
  if (broken) return <i className={`${cls} is-initials`} aria-hidden="true">{initialsOf(person.name)}</i>
  return <img className={cls} src={person.photo} alt="" loading="lazy" onError={() => setBroken(true)} />
}
