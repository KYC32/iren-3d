// 계약 이행: Microsoft(Horizon 1~4) 는 기준일에 인수 50·시운전 50·건설 100, 회사 목표대로면 2027년엔 전량 가동
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra } from './view.js'
import { toMonth } from './timeline.js'
import { contractProgress } from './contracts.js'

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
