// 개발 이정표 (부지·전력 확보 → 통전 → 착공 → 가동) — 실제 IREN 데이터로 확인
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from '../data/view.js'
import { toMonth } from '../data/timeline.js'
import { devMilestones } from './devMilestones.js'

const raw = buildInfra()
const asOf = asOfMonth(raw.as_of)
// 3D 화면이 쓰는 것과 같은 사이트 (확인 기록 화면의 원본 = site._raw)
const at = (id, m = asOf) => viewInfra(raw, m).sites.find((s) => s.id === id)._raw
const states = (steps) => Object.fromEntries(steps.map((s) => [s.key, [s.state, s.when ?? null]]))

describe('devMilestones', () => {
  it('개발 부지(카이오와): 부지·전력 확보 완료, 통전은 회사 목표, 착공·가동은 미발표', () => {
    expect(states(devMilestones(at('kiowa'), asOf))).toEqual({
      secured: ['done', '2026-02'],
      energized: ['target', '2028'],
      construction: ['unknown', null],
      operating: ['unknown', null],
    })
  })
  it('공사 중인 부지(스위트워터 1): 확보·통전·착공 완료, 가동은 회사 목표', () => {
    expect(states(devMilestones(at('sweetwater-1'), asOf))).toEqual({
      secured: ['done', '2025-02'],
      energized: ['done', '2026-05-01'],
      construction: ['done', '2026-05'],
      operating: ['target', '2027-Q4'],
    })
  })
  it('지나간 달을 볼 때는 그 뒤에 알려진 목표를 미리 보여 주지 않음', () => {
    const m = toMonth('2026-03')
    expect(states(devMilestones(at('kiowa', m), m)).energized).toEqual(['unknown', null])
  })
})
