// 영상 내레이션 시험 — 읽을 문장이 화면 자막과 맞는지, 소리 조각을 시간표에 맞게 놓는지
import { describe, it, expect } from 'vitest'
import { numbersOf, checkNarration, placeClips, MAX_SPEED, GAP } from './narration.js'
import { buildCards, NARRATION, DURATION } from './storyboard.js'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from '../data/view.js'

// 자막은 자료로 만들므로 실제 자료로 검사 (자료가 바뀌어 자막 숫자가 달라지면 내레이션도 고쳐야 함을 알려 줌)
const raw = buildInfra()
const CARDS = { ko: buildCards(viewInfra(raw, asOfMonth(raw.as_of)), 'ko') }

describe('numbersOf — 글 속 숫자', () => {
  it('YYYY.MM 날짜는 해·달 둘로, 소수는 그대로', () => {
    expect(numbersOf('Horizon 1 가동 — Microsoft 인도 완료 (2026.08)')).toEqual([1, 2026, 8])
    expect(numbersOf('1.4GW 변전소 통전 완료 (2026.05)')).toEqual([1.4, 2026, 5])
  })
  it('범위·단위·통화 기호가 붙어도 숫자만', () => {
    expect(numbersOf('Horizon 2~4 — 2026년 4분기 납품 목표 (GB300)')).toEqual([2, 4, 2026, 4, 300])
    expect(numbersOf('수주잔고 $13bn+ · 확보 전력 5.6GW')).toEqual([13, 5.6])
  })
})

describe('checkNarration — 읽을 문장 검사', () => {
  it('지금 스토리보드(한국어)는 문제 없음', () => {
    expect(checkNarration(CARDS.ko, NARRATION.ko, DURATION)).toEqual([])
  })
  it('그 시간대 자막에 없는 숫자를 말하면 잡아냄', () => {
    const cards = [{ t0: 9, t1: 13, kind: 'caption', text: 'Horizon 1 가동 — Microsoft 인도 완료 (2026.08)' }]
    const problems = checkNarration(cards, [{ t0: 9.5, t1: 13, say: '호라이즌 1은 2026년 9월에 인도됐습니다.' }], 34)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/9/)
  })
  it('다른 시간대 자막의 숫자는 인정하지 않음 (장면이 바뀌면 화면에서 사라지므로)', () => {
    const cards = [{ t0: 0, t1: 5, kind: 'title', title: '5.6GW' }, { t0: 10, t1: 14, kind: 'caption', text: '없음' }]
    expect(checkNarration(cards, [{ t0: 10, t1: 14, say: '5.6기가와트' }], 34)).toHaveLength(1)
  })
  it('회사·지명은 한글로 (TTS 가 영어 글자를 낱자로 읽지 않게) — AI 만 허용', () => {
    const cards = [{ t0: 0, t1: 5, kind: 'title', title: 'IREN' }]
    expect(checkNarration(cards, [{ t0: 0, t1: 5, say: 'IREN 데이터센터' }], 34)[0]).toMatch(/IREN/)
    expect(checkNarration(cards, [{ t0: 0, t1: 5, say: 'AI 클라우드' }], 34)).toEqual([])
  })
  it('시각이 뒤집히거나 영상 밖이거나 순서가 어긋나면 잡아냄', () => {
    const cards = []
    expect(checkNarration(cards, [{ t0: 5, t1: 4, say: '가' }], 34)).toHaveLength(1)
    expect(checkNarration(cards, [{ t0: 30, t1: 40, say: '가' }], 34)).toHaveLength(1)
    expect(checkNarration(cards, [{ t0: 10, t1: 12, say: '가' }, { t0: 5, t1: 8, say: '나' }], 34)).toHaveLength(1)
  })
})

describe('placeClips — 소리 조각 놓기', () => {
  it('각자 t0 에서 시작 (앞 조각이 일찍 끝났으면)', () => {
    const { clips, problems } = placeClips([{ t0: 0, t1: 5 }, { t0: 3, t1: 8 }], [2, 2])
    expect(clips.map((c) => c.start)).toEqual([0, 3])
    expect(clips.every((c) => c.speed === 1)).toBe(true)
    expect(problems).toEqual([])
  })
  it('앞 조각이 길면 끝난 뒤 GAP 만큼 쉬고 이어서 시작', () => {
    const { clips } = placeClips([{ t0: 0, t1: 6 }, { t0: 2, t1: 8 }], [4, 3])
    expect(clips[1].start).toBeCloseTo(4 + GAP, 6)
    expect(clips[1].end).toBeCloseTo(4 + GAP + 3, 6)
  })
  it('t1 을 넘기면 빠르게 해서 맞춤 (최대 MAX_SPEED 배)', () => {
    const { clips, problems } = placeClips([{ t0: 0, t1: 5 }], [5.5])
    expect(clips[0].speed).toBeCloseTo(1.1, 6)
    expect(clips[0].end).toBeCloseTo(5, 6)
    expect(problems).toEqual([])
  })
  it('밀려서 늦게 시작한 조각도 t1 안에 끝나게 빠르기를 계산', () => {
    const { clips } = placeClips([{ t0: 0, t1: 6 }, { t0: 2, t1: 6.5 }], [4, 2.6])
    expect(clips[1].speed).toBeCloseTo(2.6 / (6.5 - 4 - GAP), 6)
    expect(clips[1].end).toBeCloseTo(6.5, 6)
  })
  it('MAX_SPEED 배로도 안 들어가면 문제로 알림 (문장을 줄여야 함)', () => {
    const { problems } = placeClips([{ t0: 0, t1: 5, say: '긴 문장' }], [5 * MAX_SPEED + 0.5])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/긴 문장/)
  })
})
