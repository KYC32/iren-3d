// =============================================================
// model.test.mjs — 전력 블록 그림의 "9/23 관찰" 숫자 계산 테스트 (npm test 가 함께 돌림)
//   그림의 진하게/흐리게와 말풍선 숫자가 이 함수들에서 나오므로, 숫자가 틀리면 그림도 틀림
// =============================================================
import { describe, it, expect } from 'vitest'
import { obsTotals, looksInstalled, hallCounts } from './model.mjs'

// data/observations.json 의 mk-air-2026-09-23 과 같은 모양 (홀 4개 × 8칸)
const SEP23 = {
  segments_per_hall: 8,
  halls: [
    { name: '1', pads: 8, mer: 8, transformers: 8, generators: 8, ats: 1, cabling: 'pulled' },
    { name: '2', pads: 8, mer: 7, transformers: 8, generators: 6, ats: 0, cabling: 'pulled' },
    { name: '3', pads: 8, mer: 8, transformers: 8, generators: 6, ats: 3, cabling: 'pulled' },
    { name: '4', pads: 3, mer: 0, transformers: 8, generators: 0, ats: 0, cabling: 'none' },
  ],
}

describe('obsTotals', () => {
  it('홀마다 센 장비 개수를 캠퍼스 전체(32칸)로 더함', () => {
    expect(obsTotals(SEP23)).toEqual({
      segments: 32, halls: 4,
      pads: 27, transformers: 32, generators: 20, mer: 23, ats: 4,
      pulledHalls: 3,   // 케이블을 당겨 놓은 홀 수 (1~3홀)
    })
  })
})

describe('looksInstalled — 1칸 그림에서 진하게 그릴지', () => {
  it('32칸 중 절반을 넘게 설치됐으면 진하게', () => {
    expect(looksInstalled(32, 32)).toBe(true)    // 변압기
    expect(looksInstalled(20, 32)).toBe(true)    // 발전기
    expect(looksInstalled(17, 32)).toBe(true)
  })
  it('절반 이하면 흐리게 (딱 절반도 "대부분"이 아님)', () => {
    expect(looksInstalled(16, 32)).toBe(false)
    expect(looksInstalled(4, 32)).toBe(false)    // ATS
    expect(looksInstalled(0, 32)).toBe(false)
  })
})

describe('hallCounts — 말풍선에 넣는 홀별 개수', () => {
  // 말풍선은 " · " 를 줄바꿈으로 쓰므로 홀끼리는 쉼표로 이음 (한 줄에 홀 4개)
  it('한국어: "1홀 8, 2홀 6, …"', () => {
    expect(hallCounts(SEP23, 'generators', true)).toBe('1홀 8, 2홀 6, 3홀 6, 4홀 0')
  })
  it('영어: "H1 8, H2 6, …"', () => {
    expect(hallCounts(SEP23, 'ats', false)).toBe('H1 1, H2 0, H3 3, H4 0')
  })
})
