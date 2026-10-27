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
  // 아래 예시는 2026-10-27 검토 때 숫자 검사를 통과해 화면에 나왔던 실제 오역
  it('회사 이름을 뜻으로 옮기면 탈락 — IREN Limited → 제한회사, Applied Digital → 적용 디지털', () => {
    expect(checkTranslation('IREN Limited Estimates – NASDAQ:IREN', 'IREN 제한회사, NASDAQ:IREN 예상치 발표')).toBe('name')
    expect(checkTranslation("Pure-Play AI Cloud vs. Energy-Driven Infrastructure: Nebius Scale Meets IREN Limited's Efficiency", 'AI 클라우드 순수 플레이어 Nebius Scale vs. 에너지 드라이브 인프라스트럭처의 IREN 제한된 효율성')).toBe('name')
    expect(checkTranslation('Applied Digital vs. IREN: Which Technology Stock Is a Better Buy in 2026?', '애플리케이션 디지털 대 IREN: 2026년 투자 가치가 더 높은 기술주는?')).toBe('name')
    expect(checkTranslation('TeraWulf Jumps 8% as CEO Says Power Demand Remains Strong', '테라윌프 8% 급등, CEO "전력 수요 여전히 강함"')).toBe('name')
  })
  it('매체·사람 이름을 바꾸면 탈락 — The Information → 정보 제공, Jim → 김', () => {
    expect(checkTranslation('Anthropic has unannounced multiyear cloud deal with IREN: The Information', 'Anthropic, IREN 간 비공개 장기 클라우드 계약 체결: 정보 제공')).toBe('name')
    expect(checkTranslation('Jim Cramer Skips IREN', '김 크레이머, IREN 참석 취소')).toBe('name')
  })
  it('이름은 원문 글자 그대로나 정해 둔 한국어 표기면 통과', () => {
    expect(checkTranslation('IREN Limited Keeps Falling', 'IREN 계속 하락')).toBe('ok')
    expect(checkTranslation('Microsoft Accepts IREN\'s First of Four 50MW AI Deployments', '마이크로소프트, IREN의 50MW AI 배치 네 건 중 첫 건 인수')).toBe('ok')
    expect(checkTranslation('Applied Digital Falls 4%; IREN Slides', '어플라이드 디지털 4% 하락, IREN도 하락')).toBe('ok')
    expect(checkTranslation('OpenAI Revenue Report Lifts IREN', '오픈AI 매출 보도에 IREN 상승')).toBe('ok')
  })
  it('원문에 없는 영어 낱말을 지어내면 탈락 (IREN, Inc.)', () => {
    expect(checkTranslation('IREN Adds Mirantis, Which Has Served 1,500+ Enterprise Customers', 'IREN, Inc. 추가로 Mirantis 도입... 1,500개 이상의 엔터프라이즈 고객 서비스')).toBe('new-latin')
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
