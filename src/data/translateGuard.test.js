// 뉴스 제목 기계 번역 검사기 시험 — 예시는 2026-10-26 모델 비교에서 실제로 나온 번역
import { describe, it, expect } from 'vitest'
import { checkTranslation } from './translateGuard.js'

describe('checkTranslation', () => {
  it('숫자·티커·금액이 그대로면 통과', () => {
    expect(checkTranslation('IREN (NASDAQ:IREN) Shares Down 8.4% - Time to Sell?', 'IREN(나스닥:IREN) 주식, 8.4% 하락 - 매도 시기일까?')).toBe('ok')
    expect(checkTranslation('IREN Signs $2.8bn in New Customer Contracts', 'IREN, 신규 고객 계약 $2.8bn 체결')).toBe('ok')
  })
  it('금액을 억 단위로 바꾸면 탈락 ($2.8bn → 2.8억 달러는 10배 틀림)', () => {
    expect(checkTranslation('IREN Signs $2.8bn in New Customer Contracts', 'IREN, 신규 고객 계약 체결로 2.8억 달러 투자 유치')).toBe('money')
    expect(checkTranslation('IREN Prices $2 Billion Convertible Notes Offering', 'IREN 가격 $2억 달러 전환사채 발행')).toBe('money')
  })
  it('원문에 없는 숫자·티커를 지어내면 탈락', () => {
    expect(checkTranslation('IREN Reports Q2 FY26 Results', 'IREN 2023년 2분기 연간 실적 발표')).toBe('numbers')
    expect(checkTranslation('IREN Closes $3.0 Billion Convertible Notes Offering', 'IREN, NBIS, CRWV 등 주요 기업, $3.0 Billion 규모 프로젝트 추진')).toBe('new-token')
  })
  it('한자가 섞이거나 한국어가 아니면 탈락', () => {
    expect(checkTranslation('IREN (NASDAQ:IREN) Stock Jumps 6% - What\'s Next?', 'IREN(纳斯达克:IREN) 주가 6% 상승 - 다음은 무엇인가?')).toBe('han')
    expect(checkTranslation('IREN Completes Acquisition of Mirantis', 'IREN, Completes Acquisition of Mirantis')).toBe('not-korean')
  })
  it('원문의 IREN 을 다른 글자로 바꾸면 탈락 (이렌·아이렌)', () => {
    expect(checkTranslation('IREN Reports FY26 Results', '이렌 FY26 결과 발표')).toBe('iren')
  })
  it('거래소:티커 표기는 거래소(나스닥)까지 남아야 함 — "IREN(주식회사)"·"IREN(주식시장:IREN)" 탈락', () => {
    expect(checkTranslation('IREN (NASDAQ:IREN) Shares Down 6.5% - What\'s Next?', 'IREN(주식회사) 주가 6.5% 하락, 향후 전망은?')).toBe('exchange')
    expect(checkTranslation('IREN (NASDAQ:IREN) Stock Falls 1.5% - What\'s Next?', 'IREN(주식시장:IREN) 주가 1.5% 하락, 향후 전망은?')).toBe('exchange')
    expect(checkTranslation('IREN (NASDAQ:IREN) Stock Falls 1.5% - What\'s Next?', 'IREN(나스닥:IREN) 주가 1.5% 하락, 향후 전망은?')).toBe('ok')
  })
  it('IREN 을 한글로 옮긴 표기가 섞이면 탈락 (원문 티커에 IREN 이 남아 있어도)', () => {
    expect(checkTranslation('IREN: AI Pivot Continues (NASDAQ:IREN)', '아이언AI 전략 전환 지속 (NASDAQ:IREN)')).toBe('iren')
  })
  it('요일·달 이름을 영어로 남기면 탈락', () => {
    expect(checkTranslation('What’s Going on With IREN Stock on Tuesday?', 'IREN 주식의 Tuesday 상황은 어때?')).toBe('english-left')
  })
  it('빈 번역·지나치게 긴 번역은 탈락', () => {
    expect(checkTranslation('Why Is IREN Stock Falling?', '')).toBe('empty')
    expect(checkTranslation('IREN Rises', `IREN ${'상승 '.repeat(40)}`)).toBe('too-long')
  })
})

// 실제 번역 파일: 들어 있는 번역은 모두 지금 검사기를 통과해야 함 (검사기를 고친 뒤 옛 번역이 남지 않게)
import { existsSync, readFileSync } from 'node:fs'
import { NewsKoFile } from './feedSchema.js'
describe('public/data/news-ko.json', () => {
  const p = new URL('../../public/data/news-ko.json', import.meta.url)
  it('스키마를 통과하고 모든 번역이 검사기를 통과', () => {
    if (!existsSync(p)) return
    const f = JSON.parse(readFileSync(p, 'utf8'))
    expect(NewsKoFile.safeParse(f).success).toBe(true)
    for (const v of Object.values(f.items)) expect(checkTranslation(v.src, v.ko)).toBe('ok')
  })
})
