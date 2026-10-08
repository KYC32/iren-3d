// =============================================================
// ContractsPanel — 고객 계약 이행 현황 (지도 왼쪽 패널의 "계약" 탭)
// -------------------------------------------------------------
// 투자자 질문: "계약이 실제 용량으로 얼마나 넘어갔나?" (계약 금액 → 매출이 나오는 속도)
// 계약마다 금액·기간·계약 용량과, 연결된 건물들이 그 날짜에 어느 단계인지 막대로 보여 줍니다.
//   초록 = 인수·가동(매출 단계) / 연두 = 시운전 / 주황 = 건설중 / 회색 = 계획
// 타임라인을 움직이면 그 시점 기준으로 바뀝니다 (기준일 이후는 회사 목표 기준 전망).
// =============================================================
import { useMemo } from 'react'
import { Link2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { pickName } from '../i18n/useT.js'
import { contractProgress } from '../data/contracts.js'
import { styleOf } from '../data/statusStyle.js'
import { fmtWhen } from '../data/events.js'
import { CustomerLogo } from './logos/index.jsx'

// 막대 구간 순서·색 (상태 범례와 같은 색)
const STAGES = [
  ['live', 'operating', { ko: '인수·가동', en: 'Accepted / live' }],
  ['commissioning', 'commissioning', { ko: '시운전', en: 'Commissioning' }],
  ['building', 'under_construction', { ko: '건설중', en: 'Under construction' }],
  ['planned', 'planned', { ko: '계획', en: 'Planned' }],
]

export default function ContractsPanel() {
  const data = useAppStore((s) => s.data)
  const lang = useAppStore((s) => s.lang)
  const focusSiteOnMap = useAppStore((s) => s.focusSiteOnMap)
  const ko = lang === 'ko'
  const contracts = useMemo(() => (data?.companies ?? []).flatMap((c) => c.contracts ?? []), [data])
  const list = useMemo(() => contractProgress(data?.sites ?? [], contracts), [data, contracts])
  if (!list.length) return <p className="up-hint">{ko ? '공개된 계약이 없습니다' : 'No disclosed contracts'}</p>

  return (
    <div className="contracts-panel">
      <p className="up-hint">{ko ? '계약 용량 중 그 시점에 어느 단계까지 왔나' : 'How much of each contract has reached each stage'}</p>
      {list.map((k) => {
        const name = ko ? k.customer_ko ?? k.customer : k.customer
        const live = Math.round((k.stages.live / (k.total || 1)) * 100)
        return (
          <article key={k.id} className="contract-card" style={{ borderColor: k.color }}>
            <header>
              <b style={{ color: k.color }}>{k.logo && <CustomerLogo name={k.logo} size={14} />}{name}</b>
              <span>{k.value_usd_bn != null && `$${k.value_usd_bn}bn`}{k.term_years != null && ` · ${k.term_years}${ko ? '년' : 'y'}`}</span>
            </header>
            <small className="contract-meta">
              {fmtWhen(k.signed, lang)}{k.total ? ` · ${k.total}MW ${k.unit === 'IT' ? 'IT' : (ko ? '(IT 기준 미공개)' : '(IT basis undisclosed)')}` : ''}
              {' '}<a href={k.source} target="_blank" rel="noreferrer" aria-label={ko ? '계약 원문' : 'Contract source'}><Link2 size={11} aria-hidden="true" /></a>
            </small>
            {k.known ? (
              <>
                {/* 단계별 막대: 폭 = 계약 용량 대비 비율 */}
                <div className="contract-bar" role="img" aria-label={STAGES.map(([key, , l]) => `${l[lang] ?? l.en} ${k.stages[key]}MW`).join(', ')}>
                  {STAGES.map(([key, status]) => k.stages[key] > 0 && (
                    <i key={key} style={{ width: `${(k.stages[key] / (k.total || 1)) * 100}%`, background: styleOf(status).color }} />
                  ))}
                </div>
                <div className="contract-legend">
                  {STAGES.filter(([key]) => k.stages[key] > 0).map(([key, status, l]) => (
                    <span key={key}><i style={{ background: styleOf(status).color }} />{l[ko ? 'ko' : 'en']} {k.stages[key]}</span>
                  ))}
                  <strong>{ko ? `매출 단계 ${live}%` : `${live}% revenue-stage`}</strong>
                </div>
                {/* 연결된 캠퍼스로 이동 */}
                {[...new Set(k.buildings.map((b) => b.siteId))].map((sid) => {
                  const site = data.sites.find((s) => s.id === sid)
                  return (
                    <button key={sid} className="contract-site" onClick={() => focusSiteOnMap(sid)}>
                      {pickName(site, lang)} · {k.buildings.filter((b) => b.siteId === sid).map((b) => pickName(b, lang)).join(', ')}
                    </button>
                  )
                })}
              </>
            ) : (
              <small className="contract-unknown">{ko ? '배치 사이트 미공개' : 'Deployment site not disclosed'}</small>
            )}
          </article>
        )
      })}
    </div>
  )
}
