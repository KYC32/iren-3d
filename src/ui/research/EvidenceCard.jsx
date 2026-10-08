import { sourceById } from '../../data/research.js'
export default function EvidenceCard({ sourceId, research, locator, summary, lang='ko' }) {
  const source=sourceById(research,sourceId)
  if(!source)return <p className="research-note">{lang==='ko'?'근거 문서 확인 필요':'Source needs review'}</p>
  return <details className="evidence-card"><summary>{lang==='ko'?'근거 확인':'View evidence'} · {source.title}</summary>
    <p>{summary}</p><dl><dt>{lang==='ko'?'발표':'Published'}</dt><dd>{source.published ?? (lang==='ko'?'미상':'Unknown')}</dd><dt>{lang==='ko'?'원문 검토':'Reviewed'}</dt><dd>{source.reviewedAt}</dd><dt>{lang==='ko'?'위치':'Location'}</dt><dd>{locator||'본문 / Main text'}</dd></dl>
    <a href={source.url} target="_blank" rel="noreferrer">{source.publisher} · {lang==='ko'?'원문 열기 ↗':'Open original ↗'}</a>
  </details>
}
