// 계약 이행: Microsoft(Horizon 1~4) 는 기준일에 인수 50·시운전 50·건설 100, 회사 목표대로면 2027년엔 전량 가동
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra } from './view.js'
import { toMonth } from './timeline.js'
import { contractProgress, signedContractsAt } from './contracts.js'

const raw = buildInfra()
const at = (date) => contractProgress(viewInfra(raw, toMonth(date)).sites, raw.companies[0].contracts)

describe('contractProgress', () => {
  it('기준일: Microsoft 200MW IT 를 단계별로 나눔', () => {
    const ms = at('2026-10').find((k) => k.id === 'microsoft-2025')
    expect(ms.total).toBe(200)
    expect(ms.stages).toEqual({ live: 50, commissioning: 50, building: 100, planned: 0 })
  })
  it('IT 기준 미공개 계약은 공개 용량으로, 배치 미공개 계약은 known=false', () => {
    const list = at('2026-10')
    expect(list.find((k) => k.id === 'nvidia-2026').unit).toBe('capacity')
    expect(list.find((k) => k.id === 'ai-developers-2026').known).toBe(false)
  })
  it('회사 목표대로면 2027-06 엔 Microsoft 전량 가동(인수 포함)', () => {
    expect(at('2027-06').find((k) => k.id === 'microsoft-2025').stages.live).toBe(200)
  })
})

// 계약 탭: 타임라인 날짜보다 뒤에 서명한 계약은 그때 공개 전이었으니 숨김 ("그때 공개된 자료만")
describe('signedContractsAt', () => {
  // 손으로 만든 예시 (실제 데이터처럼 일 단위·월 단위 서명일을 섞음)
  const sample = [
    { id: 'microsoft', signed: '2025-11-03' },
    { id: 'nvidia', signed: '2026-05-07' },
    { id: 'frontier', signed: '2026-08' },
  ]
  const idsAt = (date) => signedContractsAt(sample, toMonth(date)).map((k) => k.id)

  it('보고 있는 달보다 뒤에 서명한 계약은 뺌', () => {
    expect(idsAt('2025-06')).toEqual([])
    expect(idsAt('2026-04')).toEqual(['microsoft'])
  })
  it('보고 있는 달과 같은 달이나 그 전에 서명한 계약은 넣음', () => {
    expect(idsAt('2026-05')).toEqual(['microsoft', 'nvidia'])
    expect(idsAt('2026-08')).toEqual(['microsoft', 'nvidia', 'frontier'])
  })
})
