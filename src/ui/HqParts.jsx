// =============================================================
// HqParts — 본사 3D 화면의 CEO 카드 · 최근 발언 말풍선 · 'IREN · 5층' 표시 (그림 조각)
// -------------------------------------------------------------
// scene/HqView.jsx 가 3D 위치에 붙임: 옥상 위 = CEO 카드(큰 사진 · 이름 · 발언 수 · 약속 성적표) + 그 옆 말풍선,
//   IREN 층 왼쪽 끝 = 'IREN · 5층' 표시 (2026-10-22 사용자 요청: 사진을 빌딩 위쪽에, 눈에 띄게)
// 휴대폰(767px 이하): 말풍선은 빌딩 위에 자리가 없어 ui/HqDock.jsx 가 화면 아래에 붙임 (CSS 가 위쪽 말풍선을 숨김)
// 누르면 가운데 카드 (useAppStore.openHqCard → ui/StatementsCard.jsx): 성적표 = 약속 탭(타임라인), 사진·말풍선 = 발언 탭
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js'
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { scoreboard } from '../data/promises.js'
import { statementRows, speakers } from '../data/statementRows.js'
import { Face, ChannelMark, VerdictBadge, ScoreBar, fill } from './statementParts.jsx' // 카드와 같은 그림 조각
import '../scene/hq.css'

const BUBBLE_COUNT = 6  // 말풍선으로 돌려 보여 줄 최근 발언 수
const BUBBLE_MS = 7000  // 말풍선이 바뀌는 간격

// 발언 자료 (public/data/statements.json): 이미 받았으면 바로, 아니면 받아 옴 (못 받으면 null 그대로 — 조각이 안 나타남)
export function useStatementsFile() {
  const [file, setFile] = useState(peekStatements)
  useEffect(() => {
    if (file) return undefined
    let alive = true
    loadStatements().then((f) => { if (alive && f) setFile(f) })
    return () => { alive = false }
  }, [file])
  return file
}

// 화면 언어에 맞는 문구 묶음
export function useHqText() {
  const lang = useAppStore((s) => s.lang)
  return { lang, h: hqText[lang === 'ko' ? 'ko' : 'en'] }
}

// 옥상 위 묶음: CEO 카드 + 그 옆 말풍선 (휴대폰은 CSS 가 말풍선을 숨기고 HqDock 이 아래에 그림)
export function CeoTop({ file }) {
  return <div className="hq-top"><CeoCard file={file} /><Bubble file={file} /></div>
}

// CEO 카드 (남색 바탕 · 큰 사진 · 초록 테두리): 발언이 있는 사람만 (speakers — 발언이 없는 공동 CEO 는 뺌)
//   사람을 누르면 그 사람 발언(발언 탭), 아래 성적표를 누르면 약속 타임라인(약속 탭)
export function CeoCard({ file }) {
  const { lang, h } = useHqText()
  const openCard = useAppStore((s) => s.openHqCard)
  const sb = scoreboard(file.promises, file.checkedAt)
  const counts = { kept: sb.kept, 'late-kept': sb.lateKept, late: sb.late, withdrawn: sb.withdrawn, pending: sb.pending }
  return (
    <div className="hq-ceo statements-panel">
      {speakers(file).map((p) => {
        const n = file.statements.filter((s) => s.person === p.id).length
        return (
          <button key={p.id} type="button" className="hq-ceo-person" onClick={() => openCard({ tab: 'statements', person: p.id })}
            aria-label={fill(h.badgeOpen, { name: p.name })} title={fill(h.badgeOpen, { name: p.name })}>
            <span className="hq-ceo-photo"><Face person={p} /></span>
            <b>{p.name}</b>
            <small>{lang === 'ko' ? p.title_ko : p.title_en}</small>
            <em>{fill(h.statementsN, { n })}</em>
          </button>
        )
      })}
      <button type="button" className="hq-ceo-score" onClick={() => openCard({ tab: 'promises' })} title={h.signOpen}
        aria-label={`${h.signOpen}: ${fill(h.scoreLine, { n: sb.total, a: sb.kept, b: sb.due })}`}>
        <span>{fill(h.scoreLine, { n: sb.total, a: sb.kept, b: sb.due })}</span>
        <ScoreBar counts={counts} />
      </button>
    </div>
  )
}

// 'IREN · 5층' 표시 (IREN 층 왼쪽 끝 모서리에 붙음 — 오른쪽 끝이 빌딩)
export function FloorTag({ level, street }) {
  const { h } = useHqText()
  return <div className="hq-floor"><span className="dot" aria-hidden="true" /><b>{fill(h.towerFloor, { level })}</b>{street && <small>{street}</small>}</div>
}

// 최근 발언 말풍선 — 7초마다 다음 발언 (마우스·초점이 있으면 멈춤, 움직임 줄이기면 자동으로 안 넘김)
//   누르면 전체 카드, ‹ › 로 직접 넘김. docked: 휴대폰 아래 묶음 (꼬리 없음) · 아니면 CEO 카드 옆 (꼬리가 사진 쪽)
export function Bubble({ file, docked = false }) {
  const { lang, h } = useHqText()
  const ko = lang === 'ko'
  const openCard = useAppStore((s) => s.openHqCard)
  const rows = useMemo(() => statementRows(file, 'all').slice(0, BUBBLE_COUNT), [file])
  const people = useMemo(() => Object.fromEntries(file.people.map((p) => [p.id, p])), [file])
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const reduced = useReducedMotionPref()
  useEffect(() => {
    if (hold || reduced || rows.length < 2) return undefined
    const id = setInterval(() => setI((x) => (x + 1) % rows.length), BUBBLE_MS)
    return () => clearInterval(id)
  }, [hold, reduced, rows.length])
  if (!rows.length) return null
  const r = rows[i % rows.length]
  const step = (d) => setI((x) => (x + d + rows.length) % rows.length)
  return (
    <div className={`hq-bubble statements-panel${docked ? ' is-docked' : ''}`} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <button type="button" className="hq-bubble-main" onClick={() => openCard({ tab: 'statements' })} title={h.bubbleOpen} aria-label={`${h.bubbleOpen}: ${ko ? r.summary_ko : r.summary_en}`}>
        <span className="st-meta"><ChannelMark channel={r.channel} h={h} /><span>·</span><span>{people[r.person]?.name}</span><span>·</span><time dateTime={r.date}>{r.date}</time></span>
        {r.quote && <q className="hq-bubble-quote">{r.quote}</q>}
        {/* 한국어 화면은 요약도 (영어 원문만으로는 읽기 어려움) · 영어 화면은 인용이 없을 때만 요약 */}
        {(ko || !r.quote) && <span className="hq-bubble-sum">{ko ? r.summary_ko : r.summary_en}</span>}
        {r.verdict ? <VerdictBadge v={r.verdict} h={h} /> : <span className="st-opinion">{h.opinion}</span>}
      </button>
      <div className="hq-bubble-foot">
        <button type="button" onClick={() => step(-1)} aria-label={h.prev} title={h.prev}><ChevronLeft size={14} aria-hidden="true" /></button>
        <span aria-live="polite">{(i % rows.length) + 1}/{rows.length}</span>
        <button type="button" onClick={() => step(1)} aria-label={h.next} title={h.next}><ChevronRight size={14} aria-hidden="true" /></button>
        <button type="button" className="hq-all" onClick={() => openCard({ tab: 'statements' })}>{fill(h.bubbleAll, { n: file.statements.length })}</button>
      </div>
    </div>
  )
}

// '움직임 줄이기' 설정 (켜져 있으면 말풍선을 자동으로 넘기지 않음) — 3D 밖(휴대폰 묶음)에서도 쓰려고 여기 둠
function useReducedMotionPref() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return undefined
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
