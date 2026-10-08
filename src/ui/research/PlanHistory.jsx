import { milestonesAt } from '../../data/research.js'
import EvidenceCard from './EvidenceCard.jsx'
const LABELS={no_target:['목표 확인 필요','Target not established'],upcoming:['목표 예정','Target ahead'],unconfirmed:['기한 경과 · 완료 미확인','Deadline passed · completion unconfirmed'],on_time:['기한 내 완료','Completed within target'],late:['기한 후 완료','Completed after target'],completed_unknown_date:['완료 확인 · 정확한 날짜 미확인','Completed · exact date not established']}
export default function PlanHistory({site,buildingId,buildingIds,research,month,lang}) {
  const list=milestonesAt(research,site.id,month,buildingId).filter(m=>!buildingIds||buildingIds.includes(m.building))
  return <section className="plan-history"><small className="research-note">{lang==='ko'?'검토 기준':'Assessed through'} · {research.assessedThrough ?? '—'}</small><p className="research-note">{lang==='ko'?'같은 대상·완료 조건끼리 비교합니다. 인도·고객 인수·매출 개시는 서로 다른 사건입니다.':'Compare only matching scopes. Delivery, acceptance and revenue commencement are distinct events.'}</p>
    {!list.length&&<p className="research-empty">{lang==='ko'?'선택 시점에 확인된 목표 이력이 없습니다.':'No reviewed milestone history at this date.'}</p>}
    {list.map(m=><article key={m.id} className="milestone"><span className={`research-badge ${m.status==='unconfirmed'?'attention':''}`}>{LABELS[m.status][lang==='ko'?0:1]}</span><h3>{site.buildings.find(b=>b.id===m.building)?.name ?? m.building}</h3><h4>{lang==='ko'?m.title_ko:m.title_en}</h4><p>{lang==='ko'?m.scope_ko:m.scope_en}</p>
      {m.revised&&<b className="attention">{lang==='ko'?'목표가 뒤로 변경됨':'Target moved later'}</b>}
      <ol>{m.revisions.map((r,i)=><li key={`${r.sourceId}-${i}`}><div><small>{i===0?(lang==='ko'?'최초 확인 목표':'First reviewed target'):(lang==='ko'?'수정·구체화':'Updated target')}</small><strong>{r.target}</strong></div><EvidenceCard sourceId={r.sourceId} research={research} summary={lang==='ko'?r.note_ko:r.note_en} lang={lang}/></li>)}</ol>
      {m.completion&&<EvidenceCard sourceId={m.completion.sourceId} research={research} summary={lang==='ko'?'완료 발표일과 실제 완료일은 구분합니다.':'Publication and actual occurrence are separate dates.'} lang={lang}/>}
    </article>)}
  </section>
}
