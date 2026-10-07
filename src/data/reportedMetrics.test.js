import { describe, it, expect } from 'vitest'
import { reportedMetricsAt } from './reportedMetrics.js'
import { toMonth } from './timeline.js'
const metrics = [
  { key: 'arr', value: 4, as_of: '2026-08' },
  { key: 'arr', value: 1, as_of: '2025-08' },
  { key: 'gpus', value: 100, as_of: '2026-Q4' },
]
describe('발표 지표 시점', () => {
  it('발표 전의 미래 값은 노출하지 않음', () => expect(reportedMetricsAt(metrics, toMonth('2024'))).toEqual([]))
  it('입력 정렬에 관계없이 당시 최신 값을 사용', () => {
    expect(reportedMetricsAt(metrics, toMonth('2025-12'))[0].value).toBe(1)
    expect(reportedMetricsAt(metrics, toMonth('2026-08'))[0].value).toBe(4)
  })
  it('분기 지표는 분기 말부터 표시', () => {
    expect(reportedMetricsAt(metrics, toMonth('2026-10'))).toHaveLength(1)
    expect(reportedMetricsAt(metrics, toMonth('2026-12'))).toHaveLength(2)
  })
  it('미래 화면에서도 마지막 발표값 유지', () => {
    expect(reportedMetricsAt(metrics, toMonth('2028'))[0].value).toBe(4)
  })
})
