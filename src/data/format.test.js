// 회사 발표 지표를 화면 글자로 바꾸는 규칙 (KPI 줄·계약 탭이 함께 씀)
import { describe, it, expect } from 'vitest'
import { fmtMetric, energizeLabel } from './format.js'

// 변전소 통전 표시: "통전 2028" 처럼 날짜만 붙으면 이미 통전된 것처럼 읽혀서, 상태를 문구로 밝힘
describe('통전 표시 (energizeLabel)', () => {
  const t = { panel: { energizeTarget: '통전 목표', notEnergized: '통전 전' } }
  it('통전 전 + 목표가 있으면 "통전 목표 날짜"', () => {
    expect(energizeLabel({ status: 'planned', dates: { target: '2028' } }, t)).toBe('통전 목표 2028')
  })
  it('목표도 모르면 "통전 전" (날짜 없는 "통전" 금지)', () => {
    expect(energizeLabel({ status: 'planned', dates: {} }, t)).toBe('통전 전')
  })
})

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
