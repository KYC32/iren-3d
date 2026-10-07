// =============================================================
// 데이터 갱신 기록 — 언제 어떤 수치가 바뀌었는지 (비공식 사이트의 신뢰 장치)
// data/changelog.json 을 그대로 보여 줍니다. 데이터를 고치면 기록도 남겨야 빌드가 통과합니다.
// =============================================================
import { History, Link2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { REPO_URL } from '../config.js'

export default function ChangeLog() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const log = useAppStore((s) => s.data?.raw.changelog)
  if (!log?.length) return <div className="sp-empty">{t.changelog.empty}</div>
  return (
    <div className="changelog">
      <div className="up-hint"><History size={12} /> {t.changelog.hint}</div>
      {log.map((entry) => (
        <section key={entry.date}>
          <h5>{entry.date}</h5>
          <ul>
            {entry.items.map((it, i) => (
              <li key={i}>
                <span>{lang === 'ko' ? it.ko : it.en}</span>
                {it.source && <a href={it.source} target="_blank" rel="noreferrer" aria-label="source"><Link2 size={11} /></a>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <a className="cl-repo" href={`${REPO_URL}/commits/main/data`} target="_blank" rel="noreferrer">{t.changelog.full}</a>
    </div>
  )
}
