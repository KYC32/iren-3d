// =============================================================
// HallEstimateCard — 선택한 데이터홀의 "속" 추정 카드 (캠퍼스 패널 · 현황 탭)
// -------------------------------------------------------------
// MW 만으로는 감이 안 오는 투자자를 위해: GPU 몇 개 · 랙 몇 개 · 계약 기준 1년 매출
// 회사 발표값과 추정값을 구분하고, 계산식과 가정을 카드 아래에 그대로 적어 둡니다 (hallEstimate.js).
// 3D 에서는 같은 추정 랙 수만큼 건물 속에 랙이 줄지어 섭니다 (HallInterior).
// =============================================================
import { useMemo } from 'react'
import { Cpu } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { estimateHall, contractRunRate, referenceHall, roundNice, fmtUsdM } from '../data/hallEstimate.js'
import { toMonth } from '../data/timeline.js'

export default function HallEstimateCard({ building }) {
  const data = useAppStore((s) => s.data)
  const month = useAppStore((s) => s.month)
  const ko = useAppStore((s) => s.lang) === 'ko'
  // 그 날짜에 이미 서명된 계약만 (서명 전 날짜에는 계약 매출을 보여 주지 않음)
  const contracts = useMemo(
    () => (data?.companies ?? []).flatMap((c) => c.contracts ?? []).filter((k) => toMonth(k.signed) <= month),
    [data, month],
  )
  const ref = useMemo(() => referenceHall(data?.raw.sites ?? []), [data])
  const est = estimateHall(building)
  if (!est) return null
  // 여러 건물에 걸친 계약은 IT 전력이 공개된 건물만 나눔 (전체 전력에서 환산한 IT 로는 계약 몫을 나누지 않음)
  const run = contractRunRate(building, contracts, est.itBasis === 'it' ? est.itMw : null)
  const p = est.profile
  const itText = `${Math.round(est.itMw)}MW`
  const isRef = ref?.building.id === building.id

  return (
    <section className="hall-est" aria-label={ko ? '건물 속 추정' : 'Inside this hall (estimate)'}>
      <header>
        <Cpu size={14} aria-hidden="true" />
        <b>{ko ? '건물 속 · MW 를 GPU 로' : 'Inside · MW to GPUs'}</b>
        <span className="est-badge">{ko ? '추정' : 'Estimate'}</span>
      </header>
      <div className="hall-est-grid">
        <div>
          <small>GPU</small>
          <strong>{est.gpusReported ? est.gpus.toLocaleString() : `≈ ${roundNice(est.gpus).toLocaleString()}`}</strong>
          <em>{est.gpusReported ? (ko ? '회사 발표' : 'Company reported')
            : est.itBasis === 'it' ? (ko ? `IT ${itText} 기준 추정` : `Est. from ${itText} IT`)
            : (ko ? `용량 ~${itText} 기준 추정` : `Est. from ~${itText} capacity`)}</em>
        </div>
        <div>
          <small>{ko ? '랙' : 'Racks'}</small>
          <strong>≈ {roundNice(est.racks).toLocaleString()}</strong>
          <em>{p.label} · {ko ? `랙당 GPU ${p.gpusPerRack}개` : `${p.gpusPerRack} GPUs per rack`}</em>
        </div>
        {run && (
          <div className="wide">
            <small>{ko ? '계약 기준 연 매출 환산' : 'Contract run-rate per year'}</small>
            <strong>≈ {fmtUsdM(run.usdM)}</strong>
            <em>{run.contract.customer} ${run.contract.value_usd_bn}bn ÷ {run.contract.term_years}{ko ? '년' : ' yrs'}{run.whole ? (ko ? ' (계약 전체가 이 건물)' : ' (whole contract)') : ` × ${Math.round(est.itMw)}/${run.contract.it_mw}MW`}</em>
          </div>
        )}
      </div>
      <p className="hall-est-note">
        {est.gpusReported
          ? (ko ? '회사가 발표한 GPU 수를 랙 수로만 환산했습니다.' : 'Company-reported GPU count, converted to racks only.')
          : (ko
            ? `IT 전력 ÷ GPU 1개당 약 ${p.kwPerGpu.toFixed(1)}kW(CPU·네트워크·스토리지 몫 포함)로 계산했습니다.${p.modelKnown ? '' : ' GPU 모델 미발표 — 냉각 방식으로 최신 세대를 가정.'}${est.itBasis === 'gross' ? ' IT 전력 미공개 — 전체 전력 ÷ 1.3 으로 환산.' : ''}${est.itBasis === 'disclosed' ? ' 발표 용량이 IT 기준인지 미공개 — IT 로 보고 계산.' : ''}`
            : `IT power ÷ ~${p.kwPerGpu.toFixed(1)} kW per GPU (incl. CPU, network, storage share).${p.modelKnown ? '' : ' GPU model undisclosed — latest generation assumed from cooling type.'}${est.itBasis === 'gross' ? ' IT undisclosed — gross ÷ 1.3.' : ''}${est.itBasis === 'disclosed' ? ' Disclosed capacity basis unclear — treated as IT.' : ''}`)}
        {ref && !isRef && (ko
          ? ` 검산: ${ref.site.name_ko ?? ref.site.name}는 IT ${ref.itMw}MW 에 GPU ${ref.gpus.toLocaleString()}개를 회사가 발표 (개당 약 ${ref.kwPerGpu.toFixed(1)}kW).`
          : ` Check: ${ref.site.name} reported ${ref.gpus.toLocaleString()} GPUs on ${ref.itMw} MW IT (~${ref.kwPerGpu.toFixed(1)} kW each).`)}
        {run && (ko
          ? ` 매출 환산은 계약 금액이 기간${run.whole ? '' : '·용량'}에 고르게 나뉜다고 가정한 값으로, 회계상 매출·인식 시점과 다릅니다.`
          : ' Run-rate assumes contract value is spread evenly over term and capacity; it is not recognized revenue.')}
      </p>
    </section>
  )
}
