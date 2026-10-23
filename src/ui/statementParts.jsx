// =============================================================
// statementParts — 경영진 발언·약속 화면이 함께 쓰는 작은 그림 조각과 글자 도우미
// -------------------------------------------------------------
// 쓰는 곳: StatementsCard(가운데 카드 · 발언 탭) · PromiseTimeline(약속 탭) · HqParts(옥상 위 CEO 카드 · 말풍선)
//   예전엔 StatementsCard.jsx 안에 있었음 → 약속 탭을 따로 떼면서 서로 불러오는 고리가 생기지 않게 여기로 옮김
// 판정 색은 statements.css 의 .statements-panel 변수 (--v-kept 등), 판정 계산은 data/promises.js
// =============================================================
import { useState } from 'react'
import { Mic, Newspaper, FileText, CircleCheck, Clock, TriangleAlert, Ban } from 'lucide-react'
import { fmtAmount, evidenceLabel } from '../data/promises.js'
import { initialsOf } from '../data/format.js'
import './statements.css' // 이 조각들의 모양 (CEO 카드·말풍선은 카드를 열기 전에도 이 스타일이 필요)

export const STATUSES = ['kept', 'late-kept', 'late', 'withdrawn', 'pending']  // 성적표 막대·거르기 단추 순서
export const STATUS_ICON = { kept: CircleCheck, 'late-kept': CircleCheck, late: TriangleAlert, withdrawn: Ban, pending: Clock }
export const ym = (day) => day.slice(0, 7) // 'YYYY-MM-DD' → 'YYYY-MM'
// 문구 틀의 {이름} 자리를 값으로 채움 ('기한 안에 지켜짐 {a}/{b}' → '기한 안에 지켜짐 4/6')
export const fill = (text, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), text)
// 확인일 표시: 한국어 '10월 21일', 영어 'Oct 21' — 올해가 아니면 연도도 (오래된 자료임을 알 수 있게)
export function fmtDay(day, lang) {
  const [y, m, d] = day.split('-').map(Number)
  const thisYear = y === new Date().getFullYear()
  if (lang === 'ko') return `${thisYear ? '' : `${y}년 `}${m}월 ${d}일`
  const mon = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${mon} ${d}${thisYear ? '' : `, ${y}`}`
}

// 판정 막대 (판정별 칸 넓이 = 개수) — 옥상 위 CEO 카드의 성적표가 씀
export function ScoreBar({ counts }) {
  return <div className="st-bar" aria-hidden="true">{STATUSES.filter((k) => counts[k] > 0).map((k) => <i key={k} className={`v-${k}`} style={{ flex: counts[k] }} />)}</div>
}

// 채널 표시: X = 굵은 글자 "X", 실적 발표 콜 = 마이크, 인터뷰 = 신문, 보도자료 = 문서 (X 는 이름까지 쓰면 "X X" 라 글자 하나만)
export function ChannelMark({ channel, h }) {
  const ChannelIcon = { call: Mic, interview: Newspaper, release: FileText }[channel]
  return channel === 'x'
    ? <b className="st-x" aria-hidden="true">X</b>
    : <><ChannelIcon size={12} aria-hidden="true" /><span>{h.chips[channel]}</span></>
}

// 판정 배지 하나 (아이콘 + 판정 이름 + '목표 줄임') — 말풍선·약속 탭 펼침이 같이 씀
export function VerdictBadge({ v, h }) {
  const Icon = STATUS_ICON[v.status]
  return <span className={`st-badge v-${v.status}`}><Icon size={12} aria-hidden="true" />{h.status[v.status]}{v.reduced && <em>{h.reducedTag}</em>}</span>
}

// 판정 배지 + 근거 한 줄 (+ 목표 줄임 · 미룸 · 이룬 시점 정밀도) — 약속 탭에서 줄을 펼치면 맨 위
//   v = verdictOf 결과, p = 약속 (data/statements.json 의 promises 한 칸)
export function Verdict({ v, p, lang, h }) {
  const d = h.detail
  const ev = (url) => evidenceLabel(url, lang)
  const amount = (a) => fmtAmount(a, lang)
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
      <VerdictBadge v={v} h={h} />
      <small>{detail}</small>
    </div>
    {p.reduced && <p className="st-note">{d.reduced} <s>{amount(p.target)}</s> → {amount(p.reduced.amount)} {met ? d.reducedDone : d.reducedOnly} · {ev(p.reduced.url)}</p>}
    {lastPostponed && <p className="st-note">{fill(d.postponed, { to: lastPostponed.to })}</p>}
    {met && !p.fulfilled.date && <p className="st-note">{p.fulfilled.period ? fill(d.periodOnly, { period: p.fulfilled.period }) : d.publishedOnly}</p>}
  </div>
}

// 사진 동그라미: 사진을 못 받으면 이름 머리글자
export function Face({ person, small = false }) {
  const [broken, setBroken] = useState(false)
  const cls = `st-face${small ? ' is-small' : ''}`
  if (!person) return <i className={cls} />
  if (broken) return <i className={`${cls} is-initials`} aria-hidden="true">{initialsOf(person.name)}</i>
  return <img className={cls} src={person.photo} alt="" loading="lazy" onError={() => setBroken(true)} />
}
