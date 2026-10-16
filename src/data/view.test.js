// view.js — 화면용 사이트 데이터 (실제 IREN 데이터로 확인)
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from './view.js'

const raw = buildInfra()
const at = (m) => viewInfra(raw, m)
const asOf = asOfMonth(raw.as_of)

describe('변전소 통전 날짜', () => {
  // 기준일 "확인 기록" 화면은 회사 목표 단계를 빼고 보여 주는데, 통전 목표 날짜까지 빠지면
  // 통전 전 부지가 날짜 없이 "통전"으로만 보여 이미 통전된 것처럼 읽혔음 (카이오와·번디·바다호스)
  it('통전 전 부지도 확인 기록 화면에서 회사 통전 목표 날짜를 가짐', () => {
    const kiowa = at(asOf).sites.find((s) => s.id === 'kiowa')
    expect(kiowa.substation.status).toBe('planned')
    expect(kiowa.substation.dates.target).toBe('2028')
  })
  it('이미 통전된 부지는 통전한 날', () => {
    const sw1 = at(asOf).sites.find((s) => s.id === 'sweetwater-1')
    expect(sw1.substation.status).toBe('energized')
    expect(sw1.substation.dates.energized).toBe('2026-05-01')
  })
})
