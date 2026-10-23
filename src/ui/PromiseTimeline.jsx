// =============================================================
// PromiseTimeline — 경영진 카드의 '약속' 탭: 약속마다 한 줄, 처음 말한 날 → 기한 막대
// -------------------------------------------------------------
// 2026-10-22 사용자 결정 (B안): "저렇게 한눈에 볼 수 있어야 해" — PolitiFact 약속 추적기·로드맵 화면 참고
// 계산은 data/promiseTimeline.js (행·묶음·축 위치) — 여기는 그리기만
// 한 줄 = 왼쪽 글자(약속 제목 + 판정 아이콘·이름·결과) + 오른쪽 막대 (휴대폰은 글자 아래에 막대)
//   회색 막대 = 처음 말한 날 → 기한 (기한 전 약속은 확인일 뒤를 옅게) · 남색 세로 눈금 = 기한
//   초록 점 = 이룬 날 · 주황 = 기한이 지난 뒤 흐른 시간 · 자주 × = 철회 · 남색 작은 점 = 그 약속을 말한 날
//   주황 고리 = 회사가 기한을 미룬다고 밝힌 날 · 세로 선 = 확인 기준일
//   판정은 색만으로 알리지 않음: 왼쪽 글자에 아이콘 + 판정 이름 + 결과 (색약·흑백 인쇄에서도 읽히게)
// 줄을 누르면 아래로 펼침: 판정 근거 + 이 약속을 말한 발언들 · 마우스를 올리면 날짜 풍선, 세로 선이 따라가며 그 자리 날짜
// 색은 statements.css 의 --tl-* 변수 (검증: dataviz 색 검사 — 초록·주황·자주 3색 통과, 주황은 글자로 보완)
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X, ArrowUpRight } from 'lucide-react'
import { timelineRows, timelineGroups, timelineAxis, pos, fmtSpan } from '../data/promiseTimeline.js'
import { scoreboard } from '../data/promises.js'
import { STATUSES, STATUS_ICON, ym, fill, fmtDay, ChannelMark, Verdict } from './statementParts.jsx'

const pct = (x) => `${x.toFixed(3)}%`
const md = (day) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}` // '2026-10-21' → '10/21'

// open: 펼친 약속 id (가게 상태 hqCard.open) · onOpen(id | null): 펼치기·접기
export default function PromiseTimeline({ file, lang, h, open, onOpen }) {
  const t = h.tl
  const rows = useMemo(() => timelineRows(file), [file])
  const axis = useMemo(() => timelineAxis(rows, file.checkedAt), [rows, file.checkedAt])
  const sb = useMemo(() => scoreboard(file.promises, file.checkedAt), [file])
  const said = useMemo(() => statementsByPromise(file), [file]) // 펼친 줄에 보일 발언들
  const [only, setOnly] = useState('all') // 판정 거르기 (단추가 곧 범례)
  const groups = timelineGroups(only === 'all' ? rows : rows.filter((r) => r.status === only))
  const counts = Object.fromEntries(STATUSES.map((k) => [k, rows.filter((r) => r.status === k).length]))
  const grid = useMemo(() => gridBackground(axis), [axis]) // 줄마다 같은 해·분기·확인일 세로 줄
  const chartRef = useRef(null), trackRef = useRef(null)
  const [tip, setTip] = useState(null) // 날짜 풍선: { r, x, y }

  // 약속을 골라 들어오면(발언 탭의 약속 칩 · 3D 말풍선) 그 줄이 보이게 (처음 그릴 때 한 번만 — 줄을 직접 누를 땐 스크롤하지 않음)
  //   한 프레임 뒤에: 카드를 막 여는 중이면 바깥 틀(StatementsCard)의 showModal 이 이 효과보다 늦게 돌아서,
  //   바로 스크롤하면 아직 닫힌 카드라 움직이지 않음 (말풍선으로 열 때 펼친 줄이 화면 밖에 있었음)
  useEffect(() => {
    if (!open) return undefined
    const id = requestAnimationFrame(() => chartRef.current?.querySelector(`[data-row="${open}"]`)?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 줄에 마우스가 들어오거나 키보드 초점이 오면 그 줄 아래에 풍선 (손가락은 풍선 없이 펼침만)
  const showTip = (e, r) => {
    if (e.type.startsWith('pointer') && e.pointerType !== 'mouse') return
    const cr = chartRef.current.getBoundingClientRect(), rr = e.currentTarget.getBoundingClientRect()
    const tr = trackRef.current?.getBoundingClientRect()
    const x = e.type === 'focus' ? (tr ? tr.left - cr.left : 0) : e.clientX - cr.left
    setTip({ r, x: Math.max(0, Math.min(x, cr.width - 280)), y: rr.bottom - cr.top + 4 })
  }

  return (
    <section className="tl" aria-label={t.chartLabel}>
      {/* 1) 성적표 한 줄 + 판정 거르기 (단추의 작은 그림 = 막대 그림과 같음) */}
      <div className="tl-head">
        <p className="tl-summary"><b>{fill(h.promisesCount, { n: sb.total })}</b><span>{fill(h.keptOnTime, { a: sb.kept, b: sb.due })}</span><small>{fill(h.checkedAt, { date: fmtDay(file.checkedAt, lang) })}</small></p>
        <div className="tl-filter" role="group" aria-label={t.chartLabel}>
          <button type="button" aria-pressed={only === 'all'} onClick={() => setOnly('all')}>{fill(t.all, { n: rows.length })}</button>
          {STATUSES.filter((k) => counts[k] > 0).map((k) => (
            <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(only === k ? 'all' : k)}>
              <Swatch status={k} />{h.status[k]} <b>{counts[k]}</b>
            </button>
          ))}
        </div>
      </div>

      {/* 2) 차트: 축 + 묶음별 줄 */}
      <div className="tl-chart" ref={chartRef} onPointerLeave={() => setTip(null)}>
        <Axis axis={axis} t={t} trackRef={trackRef} />
        {groups.map((g) => (
          <div className="tl-group" key={g.key}>
            <h4 className="tl-group-head">
              {g.key === 'decided' ? t.decided : fill(t.pendingGroup, { due: ym(g.deadline), left: fmtSpan(g.daysLeft, lang) })}
              <small>{g.rows.length}</small>
            </h4>
            <ol className="tl-rows">
              {g.rows.map((r) => (
                <Row key={r.id} r={r} axis={axis} grid={grid} lang={lang} h={h} open={open === r.id} list={said.get(r.id) ?? []}
                  onToggle={() => { setTip(null); onOpen(open === r.id ? null : r.id) }}
                  onTip={showTip} onTipOff={() => setTip(null)} />
              ))}
            </ol>
          </div>
        ))}
        <Crosshair chartRef={chartRef} trackRef={trackRef} axis={axis} />
        {tip && tip.r.id !== open && <Tip r={tip.r} x={tip.x} y={tip.y} lang={lang} h={h} />}
      </div>

      {/* 3) 막대 그림 읽는 법 */}
      <ul className="tl-legend">
        <li><i className="lg lg-promised" />{t.legend.promised}</li>
        <li><i className="lg lg-due" />{t.legend.deadline}</li>
        <li><i className="lg lg-met" />{t.legend.achieved}</li>
        <li><i className="lg lg-late" />{t.legend.late}</li>
        {counts.withdrawn > 0 && <li><X className="lg-withdrawn" size={12} strokeWidth={3} aria-hidden="true" />{h.status.withdrawn}</li>}
        <li><i className="lg lg-postponed" />{t.legend.postponed}</li>
        <li><i className="lg lg-mention" />{t.legend.mention}</li>
        <li><i className="lg lg-today" />{t.legend.today}</li>
      </ul>
    </section>
  )
}

// 약속 한 줄 (단추 = 펼치기) + 펼친 내용
function Row({ r, axis, grid, lang, h, open, list, onToggle, onTip, onTipOff }) {
  const t = h.tl
  const Icon = STATUS_ICON[r.status]
  return (
    <li className={`tl-row is-${r.status}${open ? ' is-open' : ''}`} data-row={r.id}>
      <button type="button" className="tl-line" aria-expanded={open} onClick={onToggle}
        onPointerEnter={(e) => onTip(e, r)} onPointerLeave={onTipOff} onFocus={(e) => onTip(e, r)} onBlur={onTipOff}>
        <span className="tl-label">
          <span className="tl-title">{lang === 'ko' ? r.title_ko : r.title_en}</span>
          <span className="tl-meta"><Icon size={12} className="tl-icon" aria-hidden="true" /><b>{h.status[r.status]}</b><span aria-hidden="true">·</span><span>{rowResult(r, lang, t)}</span></span>
        </span>
        <span className="tl-track" style={{ backgroundImage: grid }} aria-hidden="true"><Marks r={r} axis={axis} /></span>
        <ChevronDown className="tl-chev" size={14} aria-hidden="true" />
      </button>
      {open && <Detail r={r} list={list} lang={lang} h={h} />}
    </li>
  )
}

// 왼쪽 글자의 결과 한 줄: '2024-03 이룸' · '7개월 늦게 이룸' · '기한 지나 10개월' · '2026-08 철회' · '기한 2026-12'
function rowResult(r, lang, t) {
  if (r.status === 'kept') return fill(t.kept, { ym: ym(r.achieved) })
  if (r.status === 'late-kept') return fill(t.lateKept, { span: fmtSpan(r.lateDays, lang) })
  if (r.status === 'late') return fill(t.late, { span: fmtSpan(r.lateDays, lang) })
  if (r.status === 'withdrawn') return fill(t.withdrawn, { ym: ym(r.withdrawnOn) })
  return fill(t.pending, { ym: ym(r.deadline) })
}

// 막대 위 그림들 (모두 축 위치 % 로)
function Marks({ r, axis }) {
  const x = (day) => pos(day, axis)
  // 구간 하나 (a → b) — 길이가 0 이면 그리지 않음
  const seg = (a, b, cls) => (b > a ? <i className={`tl-seg ${cls}`} style={{ left: pct(x(a)), width: pct(x(b) - x(a)) }} /> : null)
  const today = axis.today
  const pending = r.status === 'pending'
  return <>
    {/* 말한 날 → 기한 (철회면 철회한 날까지). 기한 전 약속은 확인일까지 진하게, 그 뒤는 옅게 */}
    {pending ? <>
      {seg(r.said, today < r.deadline ? today : r.deadline, 'is-promised')}
      {seg(r.said > today ? r.said : today, r.deadline, 'is-future')}
    </> : seg(r.said, r.withdrawnOn ?? r.deadline, 'is-promised')}
    {/* 기한이 지난 뒤: 늦게 지켜짐 = 이룬 날까지, 늦어짐 = 확인일까지 */}
    {r.status === 'late-kept' && seg(r.deadline, r.achieved, 'is-late')}
    {r.status === 'late' && seg(r.deadline, today, 'is-late is-open-end')}
    {r.status !== 'withdrawn' && <i className="tl-due" style={{ left: pct(x(r.deadline)) }} />}
    {r.mentions.map((d) => <i key={d} className="tl-mention" style={{ left: pct(x(d)) }} />)}
    {r.postponedOn.map((d) => <i key={`p${d}`} className="tl-postponed" style={{ left: pct(x(d)) }} />)}
    {r.achieved && <i className="tl-met" style={{ left: pct(x(r.achieved)) }} />}
    {r.withdrawnOn && <X className="tl-withdrawn" size={12} strokeWidth={3} style={{ left: pct(x(r.withdrawnOn)) }} />}
  </>
}

// 위 축: 해 이름(아래 줄) + 확인일(위 줄) — 둘이 가까워도 겹치지 않게 줄을 나눔
function Axis({ axis, t, trackRef }) {
  const first = axis.years[0]
  const startYear = axis.start.slice(0, 4)
  return (
    <div className="tl-axis" aria-hidden="true">
      <span className="tl-label" />
      <span className="tl-track" ref={trackRef}>
        {/* 축이 해 중간에서 시작하면 왼쪽 끝에 그해 이름 (첫 해 눈금이 축 폭의 12% 안이면 뺌 — 휴대폰 폭에서 글자가 겹침) */}
        {(!first || pos(first.day, axis) > 12) && axis.start.slice(5) !== '01-01' && <span className="tl-year is-start" style={{ left: 0 }}>{startYear}</span>}
        {axis.years.map((y) => <span key={y.day} className="tl-year" style={{ left: pct(pos(y.day, axis)) }}>{y.label}</span>)}
        <span className="tl-today-label" style={{ left: pct(pos(axis.today, axis)) }}>{fill(t.today, { md: md(axis.today) })}</span>
      </span>
      <span />
    </div>
  )
}

// 줄 배경의 세로 줄: 해(진하게) · 분기(옅게) · 확인일(남색) — 줄마다 같은 그림이라 문자열 하나를 같이 씀
function gridBackground(axis) {
  const line = (at, color, w = 1) => `linear-gradient(to right, transparent calc(${pct(at)} - ${w / 2}px), ${color} calc(${pct(at)} - ${w / 2}px), ${color} calc(${pct(at)} + ${w / 2}px), transparent calc(${pct(at)} + ${w / 2}px))`
  return [
    line(pos(axis.today, axis), 'var(--tl-today)'),
    ...axis.years.map((y) => line(pos(y.day, axis), 'var(--tl-grid)')),
    ...axis.quarters.map((q) => line(pos(q, axis), 'var(--tl-grid-q)')),
  ].join(', ')
}

// 판정 단추·범례의 작은 그림 (막대 위 그림과 같은 모양)
function Swatch({ status }) {
  if (status === 'withdrawn') return <X className="sw-x" size={11} strokeWidth={3} aria-hidden="true" />
  return <i className={`sw sw-${status}`} aria-hidden="true" />
}

// 날짜 풍선 (마우스·키보드 초점) — 값이 앞, 이름이 뒤
function Tip({ r, x, y, lang, h }) {
  const t = h.tl
  const lines = [fill(t.said, { date: r.said, n: r.mentionCount }), fill(t.due, { date: r.deadline })]
  if (r.achieved) lines.push(`${fill(t.achieved, { date: r.achieved })}${r.lateDays ? ` · ${fill(t.lateBy, { span: fmtSpan(r.lateDays, lang) })}` : ''}`)
  if (r.status === 'late') lines.push(fill(t.overdue, { span: fmtSpan(r.lateDays, lang) }))
  if (r.withdrawnOn) lines.push(fill(t.withdrawnOn, { date: r.withdrawnOn }))
  if (r.status === 'pending') lines.push(fill(t.left, { span: fmtSpan(r.daysLeft, lang) }))
  if (r.postponedOn.length) lines.push(fill(t.postponed, { dates: r.postponedOn.join(', ') }))
  return (
    <div className="tl-tip" style={{ left: x, top: y }} role="tooltip">
      <b>{h.status[r.status]}</b>
      {lines.map((l) => <span key={l}>{l}</span>)}
    </div>
  )
}

// 마우스를 따라가는 세로 선 + 그 자리 날짜 (YYYY-MM) — 이 조각만 다시 그려서 가벼움 (펼친 내용 위에서는 숨김)
function Crosshair({ chartRef, trackRef, axis }) {
  const [at, setAt] = useState(null)
  useEffect(() => {
    const el = chartRef.current
    if (!el) return undefined
    const t0 = Date.parse(`${axis.start}T00:00:00Z`), t1 = Date.parse(`${axis.end}T00:00:00Z`)
    const move = (e) => {
      const tr = trackRef.current?.getBoundingClientRect()
      if (e.pointerType !== 'mouse' || !tr || e.clientX < tr.left || e.clientX > tr.right || e.target.closest?.('.tl-detail')) { setAt(null); return }
      const f = (e.clientX - tr.left) / tr.width, cr = el.getBoundingClientRect()
      // 날짜 글자는 마우스 높이 조금 위에 (차트 맨 위에 두면 스크롤했을 때 안 보임)
      setAt({ x: e.clientX - cr.left, y: Math.max(0, e.clientY - cr.top - 26), label: new Date(t0 + f * (t1 - t0)).toISOString().slice(0, 7) })
    }
    const leave = () => setAt(null)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [chartRef, trackRef, axis])
  if (!at) return null
  return <div className="tl-cross" style={{ left: at.x }} aria-hidden="true"><span style={{ top: at.y }}>{at.label}</span></div>
}

// 펼친 내용: 판정 근거 + 회사가 미룬 날 + 이 약속을 말한 발언들 (최신순)
function Detail({ r, list, lang, h }) {
  const ko = lang === 'ko'
  return (
    <div className="tl-detail">
      <Verdict v={r.verdict} p={r.promise} lang={lang} h={h} />
      {r.postponedOn.length > 0 && <p className="st-note">{fill(h.tl.postponed, { dates: r.postponedOn.join(', ') })}</p>}
      <h5>{fill(h.tl.mentions, { n: list.length })}</h5>
      <ol className="tl-said">
        {list.map((s) => (
          <li key={s.id}>
            <div className="st-meta"><ChannelMark channel={s.channel} h={h} /><span>·</span><time dateTime={s.date}>{s.date}</time>
              <a className="st-src" href={s.url} target="_blank" rel="noreferrer">{h.source}<ArrowUpRight size={11} aria-hidden="true" /></a></div>
            <p className="st-summary">{ko ? s.summary_ko : s.summary_en}</p>
            {s.quote && <q className="st-quote">{s.quote}</q>}
          </li>
        ))}
      </ol>
    </div>
  )
}

// 약속 id → 그 약속을 말한 발언들 (최신순)
function statementsByPromise(file) {
  const out = new Map()
  for (const s of [...file.statements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)))) {
    if (!s.promise) continue
    if (!out.has(s.promise)) out.set(s.promise, [])
    out.get(s.promise).push(s)
  }
  return out
}
