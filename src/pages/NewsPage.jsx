// =============================================================
// NewsPage — IREN 뉴스 (#page=news): [회사 발표 | 언론 보도] 탭 + 종류/매체 칩 + 날짜별 목록
//   회사 발표 = SEC EDGAR 제출(보도자료·실적·공시·내부자), 언론 = Google 뉴스 검색 결과
//   데이터: public/data/news.json (GitHub Action 이 매일 갱신). 제목은 영문 원문 그대로
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ChartLine } from 'lucide-react'
import PageShell from './PageShell.jsx'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { loadNews } from '../data/loadFeeds.js'
import { KIND_LABEL, domainOf } from '../data/news.js'

const PAGE = 60 // 한 번에 보여 줄 항목 수 ("더 보기"로 늘림)

export default function NewsPage() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const setPage = useAppStore((s) => s.setPage)
  const ko = lang === 'ko'
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('company')
  const [kinds, setKinds] = useState(new Set(['press', 'earnings', 'filing'])) // 내부자 거래는 기본 숨김
  const [source, setSource] = useState(null) // 언론 탭 매체 필터
  const [limit, setLimit] = useState(PAGE)
  const load = () => { setError(null); loadNews().then(setFile).catch((e) => setError(e.message)) }
  useEffect(load, [])
  useEffect(() => setLimit(PAGE), [tab, kinds, source])

  const block = file?.[tab]
  // 언론 탭: 매체별 건수 상위 6개를 칩으로
  const topSources = useMemo(() => {
    if (!file) return []
    const n = new Map()
    for (const it of file.press.items) n.set(it.source, (n.get(it.source) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [file])
  const items = useMemo(() => {
    if (!block) return []
    return tab === 'company' ? block.items.filter((i) => kinds.has(i.kind)) : block.items.filter((i) => !source || i.source === source)
  }, [block, tab, kinds, source])
  // 날짜별 묶음
  const groups = useMemo(() => {
    const out = []
    for (const it of items.slice(0, limit)) {
      const g = out.at(-1)
      if (g && g.date === it.date) g.items.push(it); else out.push({ date: it.date, items: [it] })
    }
    return out
  }, [items, limit])

  if (error) return <PageShell><p className="page-error">{t.news.loadError} — {error} <button className="lang-btn" onClick={load}>{t.stock.retry}</button></p></PageShell>
  if (!file) return <PageShell><div className="page-loading">{t.loading}</div></PageShell>

  const toggleKind = (k) => setKinds((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  return (
    <PageShell className="news-page">
      <div className="tabs map-tabs" role="tablist">
        {['company', 'press'].map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t.news[k]} <small>{file[k].items.length}</small></button>)}
      </div>
      <div className="news-chips">
        {tab === 'company'
          ? Object.entries(KIND_LABEL).map(([k, l]) => <button key={k} className={`chip kind-${k}${kinds.has(k) ? ' on' : ''}`} aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)}>{l[ko ? 'ko' : 'en']}</button>)
          : [<button key="all" className={`chip${!source ? ' on' : ''}`} aria-pressed={!source} onClick={() => setSource(null)}>{t.news.all}</button>,
            ...topSources.map(([s, n]) => <button key={s} className={`chip${source === s ? ' on' : ''}`} aria-pressed={source === s} onClick={() => setSource(source === s ? null : s)}>{s} <small>{n}</small></button>)]}
      </div>
      {!block.ok && <p className="page-warn">{block.error} · {t.news.stale}{block.fetched_at ? ` (${block.fetched_at.slice(0, 10)})` : ''}</p>}
      {groups.length === 0 && <p className="up-hint">{t.news.empty}</p>}
      <ul className="news-list">
        {groups.map((g) => (
          <li key={g.date}>
            <h5>{g.date}</h5>
            {g.items.map((it) => (
              <div key={it.id} className="news-row">
                {tab === 'company' ? <span className={`basis kind-${it.kind}`}>{KIND_LABEL[it.kind][ko ? 'ko' : 'en']}</span> : <span className="basis kind-press-media">{it.source}</span>}
                <div className="news-body">
                  <a href={tab === 'company' ? it.url : it.link} target="_blank" rel="noreferrer">{it.title} <ExternalLink size={11} aria-hidden="true" /></a>
                  <small>
                    {tab === 'company' ? <>sec.gov · {it.form}{it.title_from === 'form' ? '' : ' · Exhibit 99.1'}</> : domainOf(it.source_url || it.link)}
                    {tab === 'company' && <> · <button className="news-chart-btn" onClick={() => setPage('stock', it.date)}><ChartLine size={11} aria-hidden="true" />{t.stock.showOnChart}</button></>}
                  </small>
                </div>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {items.length > limit && <button className="lang-btn news-more" onClick={() => setLimit((n) => n + PAGE)}>{t.news.more} ({items.length - limit})</button>}
      <p className="page-note">
        {tab === 'company' ? t.news.companyNote : t.news.pressNote} · {t.news.updated} {(block.fetched_at ?? file.fetched_at).slice(0, 10)} · <a href={block.source.url} target="_blank" rel="noreferrer">{block.source.name}</a> · {t.news.engNote}
      </p>
    </PageShell>
  )
}
