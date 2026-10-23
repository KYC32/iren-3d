// =============================================================
// SiteFacts — 캠퍼스 패널 "현황" 탭의 두 칸
//   1) 전력·통신 이중화: 변전소·광케이블(회사 홈페이지) + 변압기·발전기·UPS(제3자 현장 관찰)
//   2) 현장 진척 (제3자 관찰): 매켄지처럼 홀 × 세그먼트 칸으로 "어디까지 지어졌나"
//      관찰 항목에 figure 가 있으면 "세그먼트 1칸의 전력 경로" 그림을 대화상자로 엶 (public/figures, iframe)
// 따로 불러옴(React.lazy): 코드·스타일·데이터(public/data/observations.json)가 첫 화면 번들에 안 들어감
// 제3자 관찰은 공식 상태(건설·가동)를 바꾸지 않고 근거로만 — 화면에도 그렇게 적음
// =============================================================
import { useEffect, useState } from 'react'
import { ArrowUpRight, Zap, Cable, Factory, Fuel, BatteryCharging, Camera, Thermometer } from 'lucide-react'
import FigureButton from './FigureButton.jsx'
import { factsFor, segmentStages } from './siteFacts.js'
import { fmtWhen } from '../data/events.js'
import './siteFacts.css'

// 한 번만 받아 둠 (부지를 바꾸거나 패널을 다시 열어도 다시 받지 않음). 실패하면 칸을 그리지 않음
let loaded = null
let pending = null
const load = () => (pending ??= fetch('/data/observations.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null).then((f) => (loaded = f)))

const ITEM_ICON = { substation: Zap, fiber: Cable, transformers: Factory, generators: Fuel, ups: BatteryCharging }
const METHOD = { drone: { Icon: Camera, ko: '드론 영상', en: 'drone footage' }, photo: { Icon: Camera, ko: '사진', en: 'photos' }, thermal: { Icon: Thermometer, ko: '열화상', en: 'thermal imaging' } }
// 세그먼트 칸 단계 (siteFacts.segmentStages) — 앞설수록 진한 색
const STAGES = [
  ['ats', { ko: 'ATS·배전반까지', en: 'ATS / switchboard' }],
  ['equipment', { ko: '전기실·변압기·발전기', en: 'MER · transformer · generator' }],
  ['pad', { ko: '콘크리트 패드', en: 'Concrete pad' }],
  ['none', { ko: '패드 전', en: 'Not started' }],
]
const CABLING = { pulled: { ko: '케이블 당김 · 결선 전', en: 'cables pulled, not terminated' }, terminated: { ko: '결선 완료', en: 'terminated' }, none: { ko: '케이블 없음', en: 'no cabling yet' } }

export default function SiteFacts({ site, month, lang }) {
  const [file, setFile] = useState(loaded)
  useEffect(() => {
    if (loaded) return undefined
    let alive = true
    load().then((f) => { if (alive) setFile(f) })
    return () => { alive = false }
  }, [])
  const ko = lang === 'ko'
  const { facilities, progress } = factsFor(file, site.id, month)
  if (!facilities.length && !progress.length) return null
  const tag = (x) => x.basis === 'reported' ? (ko ? '회사 자료' : 'Company') : `${ko ? '제3자 관찰' : 'Third-party'} · ${fmtWhen(x.date, lang)}`
  return (
    <section className="site-facts">
      {facilities.length > 0 && <>
        <h3>{ko ? '전력·통신 이중화' : 'Power & network redundancy'}</h3>
        <ul className="facts-list">{facilities.map((f) => {
          const Icon = ITEM_ICON[f.item]
          return <li key={`${f.item}-${f.basis}-${f.source}`}>
            <Icon size={13} aria-hidden="true" />
            <span>{ko ? f.label_ko : f.label_en}</span>
            <a className={`facts-tag is-${f.basis}`} href={f.source} target="_blank" rel="noreferrer" title={f.by ?? f.source}>{tag(f)}<ArrowUpRight size={10} aria-hidden="true" /></a>
          </li>
        })}</ul>
      </>}
      {progress.map((p, i) => {
        const m = METHOD[p.method]
        return <div className="facts-progress" key={p.id}>
          {/* 관찰이 여럿이면 제목은 첫 항목에만 (같은 제목이 되풀이되지 않게) */}
          {i === 0 && <h3>{ko ? '현장 진척 · 제3자 관찰' : 'Site progress · third-party'}</h3>}
          <p className="facts-meta"><m.Icon size={12} aria-hidden="true" />{fmtWhen(p.date, lang)} {ko ? m.ko : m.en} · {p.by} · <a href={p.source} target="_blank" rel="noreferrer">{ko ? '원문' : 'Source'}<ArrowUpRight size={10} aria-hidden="true" /></a></p>
          {p.halls && <>
            <div className="seg-grid" role="img" aria-label={p.halls.map((h) => `${ko ? '홀' : 'Hall'} ${h.name}: ATS ${h.ats}/${p.segments_per_hall}`).join(', ')}>
              {p.halls.map((h) => <div className="seg-row" key={h.name}>
                <span className="seg-hall">{ko ? `홀 ${h.name}` : `Hall ${h.name}`}</span>
                <span className="seg-cells">{segmentStages(h, p.segments_per_hall).map((s, i) => <i key={i} className={`seg-${s}`} />)}</span>
                <small>{ko ? CABLING[h.cabling].ko : CABLING[h.cabling].en}</small>
              </div>)}
            </div>
            <div className="seg-legend">{STAGES.map(([k, l]) => <span key={k}><i className={`seg-${k}`} />{ko ? l.ko : l.en}</span>)}</div>
            <p className="facts-note">{ko ? `1칸 = 세그먼트 ${p.segment_mw}MW · 칸 순서는 설치 개수만 나타냄(실제 위치 아님)` : `1 cell = ${p.segment_mw}MW segment · cell order shows counts only, not positions`}</p>
          </>}
          {/* 관찰 칸에서 여는 그림은 관찰 시점 보기(#obs)로 시작 — 그림 안에서 "완공 후"로 바꿀 수 있음 */}
          {p.figure && <FigureButton name={p.figure} lang={lang} view="obs" label={ko ? '이 관찰을 그림으로 보기 · 1칸 안 무엇이 설치됐나' : 'See this observation in the drawing · what one segment had'} />}
          <p className="facts-note">{ko ? p.note_ko : p.note_en}</p>
        </div>
      })}
      <p className="facts-disclaimer">{ko ? '제3자 관찰은 회사가 확인한 사실이 아니며 공식 상태(건설·가동)를 바꾸지 않습니다.' : 'Third-party observations are not company-confirmed and never change official statuses.'}</p>
    </section>
  )
}
