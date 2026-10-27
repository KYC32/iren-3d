// =============================================================
// SitePromises — 캠퍼스 패널 "현황" 탭의 "경영진 약속 · 이 캠퍼스" 칸
//   공동 CEO가 기한을 밝힌 약속 중 이 캠퍼스에 걸린 것(data/statements.json 의 promise.site)을 판정 배지와 함께
//   한 줄을 누르면 본사 3D 화면의 약속 타임라인 카드가 그 약속을 펼친 채 열림 (반대 방향 = 약속 줄의 '현장 3D 보기')
// 따로 불러옴(React.lazy) → 첫 화면 번들에 안 들어감. 발언 자료는 본사 화면과 같은 파일(loadStatements — 한 번만 받음)
// 약속이 없는 캠퍼스(예: 카이오와)는 칸 자체를 그리지 않음
// =============================================================
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js'
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { sitePromises } from '../data/promiseTimeline.js'
import { VerdictBadge, ym, fill } from './statementParts.jsx' // 배지 모양·색은 약속 타임라인과 같음 (statements.css)
import './siteFacts.css' // 아래 작은 안내 글(facts-note) 모양

export default function SitePromises({ siteId, lang }) {
  const [file, setFile] = useState(peekStatements)
  useEffect(() => {
    if (file) return undefined
    let live = true
    loadStatements().then((f) => { if (live && f) setFile(f) })
    return () => { live = false }
  }, [file])
  if (!file) return null
  const rows = sitePromises(file, siteId)
  if (!rows.length) return null
  const ko = lang === 'ko'
  const h = hqText[ko ? 'ko' : 'en']
  // 본사 화면 + 약속 카드를 열고 그 약속 줄을 펼침
  const open = (id) => { const st = useAppStore.getState(); st.showHq(); st.openHqCard({ tab: 'promises', open: id }) }
  return (
    <div className="statements-panel">
      <h3>{h.sitePromisesTitle} · {fill(h.tl.all, { n: rows.length })}</h3>
      <ol className="site-promises">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => open(r.id)} title={h.sitePromisesOpen}>
              <VerdictBadge v={r.verdict} h={h} />
              <b>{ko ? r.title_ko : r.title_en}</b>
              <small>{fill(h.tl.pending, { ym: ym(r.deadline) })}</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="facts-note">{h.sitePromisesNote}</p>
    </div>
  )
}
