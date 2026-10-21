// =============================================================
// HqParts — 본사 3D 화면의 CEO 배지 · 최근 발언 말풍선 · 약속 간판 (그림 조각)
// -------------------------------------------------------------
// 같은 조각을 두 곳이 씀:
//   넓은 화면(768px 이상): scene/HqView.jsx 가 빌딩 옆 3D 위치에 붙임 (배지 = 왼쪽, 말풍선 = 오른쪽, 간판 = 옥상)
//   휴대폰(767px 이하) : ui/HqDock.jsx 가 화면 아래에 붙임 (배지 줄 + 말풍선) — 빌딩 옆엔 자리가 없어서
// 누르면 가운데 카드 (useAppStore.openHqCard → ui/StatementsCard.jsx)
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js'
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { scoreboard } from '../data/promises.js'
import { statementRows } from '../data/statementRows.js'
import { Face, ChannelMark, VerdictBadge, ScoreBar, fill } from './StatementsCard.jsx' // 카드와 같은 그림 조각
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

// 'IREN · 5층' 표시 + 두 공동 CEO 배지 (사진 · 이름 · 발언 수) → 누르면 그 사람 발언 카드
//   docked: 휴대폰 아래 묶음 (표시 줄 없이 배지만 가로로)
export function Badges({ file, level, street, docked = false }) {
  const { lang, h } = useHqText()
  const openCard = useAppStore((s) => s.openHqCard)
  return (
    <div className={docked ? 'hq-badges is-docked' : 'hq-badges'}>
      {!docked && <div className="hq-tag"><span className="dot" aria-hidden="true" /><b>{fill(h.towerFloor, { level })}</b><small>{street}</small></div>}
      {file.people.map((p) => {
        const n = file.statements.filter((s) => s.person === p.id).length
        return (
          <button key={p.id} type="button" className="hq-person" onClick={() => openCard({ person: p.id })}
            aria-label={fill(h.badgeOpen, { name: p.name })} title={fill(h.badgeOpen, { name: p.name })}>
            <Face person={p} />
            <span><b>{p.name}</b><small>{lang === 'ko' ? p.title_ko : p.title_en}</small></span>
            <em className={n ? '' : 'is-zero'}>{fill(h.statementsN, { n })}</em>
          </button>
        )
      })}
    </div>
  )
}

// 최근 발언 말풍선 — 7초마다 다음 발언 (마우스·초점이 있으면 멈춤, 움직임 줄이기면 자동으로 안 넘김)
//   누르면 전체 카드, ‹ › 로 직접 넘김. docked: 휴대폰 아래 묶음 (꼬리 없음)
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
      <button type="button" className="hq-bubble-main" onClick={() => openCard({})} title={h.bubbleOpen} aria-label={`${h.bubbleOpen}: ${ko ? r.summary_ko : r.summary_en}`}>
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
        <button type="button" className="hq-all" onClick={() => openCard({})}>{fill(h.bubbleAll, { n: file.statements.length })}</button>
      </div>
    </div>
  )
}

// 약속 성적표 간판 (약속 n건 · 기한 안에 지켜짐 a/b · 판정 막대) → 누르면 약속만 모은 카드
export function Sign({ file }) {
  const { h } = useHqText()
  const openCard = useAppStore((s) => s.openHqCard)
  const sb = scoreboard(file.promises, file.checkedAt)
  const counts = { kept: sb.kept, 'late-kept': sb.lateKept, late: sb.late, withdrawn: sb.withdrawn, pending: sb.pending }
  return (
    <button type="button" className="hq-sign statements-panel" onClick={() => openCard({ filter: 'promises' })} title={h.signOpen} aria-label={`${h.signOpen}: ${fill(h.keptOnTime, { a: sb.kept, b: sb.due })}`}>
      <span className="hq-sign-top"><b>{fill(h.promisesCount, { n: sb.total })}</b><span>{fill(h.keptOnTime, { a: sb.kept, b: sb.due })}</span></span>
      <ScoreBar counts={counts} />
    </button>
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
