// 회사 발표 지표를 화면 글자로 바꾸는 규칙 (KPI 줄·계약 탭이 함께 씀)
import { describe, it, expect } from 'vitest'
import { fmtMetric } from './format.js'

describe('회사 발표 지표 표시 (fmtMetric)', () => {
  it('금액은 $bn · $m', () => {
    expect(fmtMetric({ value: 4, unit: 'USD bn' })).toBe('$4bn')
    expect(fmtMetric({ value: 20, unit: 'USD m' })).toBe('$20m')
  })
  it('"이상"은 >, "약"은 ~ 를 앞에 붙임', () => {
    expect(fmtMetric({ value: 20, unit: 'USD m', qualifier: 'over' })).toBe('>$20m')
    expect(fmtMetric({ value: 25, unit: 'USD m', qualifier: 'about' })).toBe('~$25m')
  })
  it('비율은 %, 범위는 최소~최대', () => {
    expect(fmtMetric({ value: 90, unit: '%' })).toBe('90%')
    expect(fmtMetric({ value: 45, value_max: 55, unit: '%' })).toBe('45~55%')
  })
  it('기간(년)은 언어에 맞게', () => {
    expect(fmtMetric({ value: 2, unit: 'years', qualifier: 'about' }, 'ko')).toBe('~2년')
    expect(fmtMetric({ value: 2, unit: 'years', qualifier: 'about' }, 'en')).toBe('~2 yrs')
  })
  it('전력·개수는 기존 표기 그대로', () => {
    expect(fmtMetric({ value: 0.3, unit: 'GW' })).toBe('0.3 GW')
    expect(fmtMetric({ value: 150000, unit: 'GPU' })).toBe('~150k')
    expect(fmtMetric({ value: 72, unit: 'GPU' })).toBe('72')
  })
})
