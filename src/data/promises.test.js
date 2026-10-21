// 경영진 약속 판정 계산 (promises.js) 테스트
//   기한은 기간의 끝(회계연도는 7월 시작), '약'·'최대'는 95% 이상, 판정은 오늘이 아니라 마지막 확인일(checkedAt) 기준
//   설계: docs/superpowers/specs/2026-10-21-ceo-statements-design.md 6장
import { it, expect } from 'vitest'
import { deadlineEnd, achievedOn, meetsTarget, verdictOf, scoreboard, recentCount, fmtAmount, evidenceLabel, isCompanyUrl } from './promises.js'

it.each([
  ['2026', '2026-12-31'], ['2026-H1', '2026-06-30'], ['2026-H2', '2026-12-31'], ['2026-Q1', '2026-03-31'],
  ['2026-02', '2026-02-28'], ['2028-02', '2028-02-29'], ['2026-06-15', '2026-06-15'],
  ['FY2026', '2026-06-30'], ['FY2026-H1', '2025-12-31'], ['FY2026-H2', '2026-06-30'], ['FY2026-Q1', '2025-09-30'], ['FY2026-Q3', '2026-03-31'],
])('deadlineEnd(%s) = %s — 기간의 끝, 회계연도는 7월 시작', (when, end) => expect(deadlineEnd(when)).toBe(end))

it('achievedOn: 이룬 날 > 밝힌 기간의 끝 > 발표일', () => {
  expect(achievedOn({ published: '2026-08-27', date: '2026-05-02' })).toBe('2026-05-02')
  expect(achievedOn({ published: '2026-08-27', period: 'FY2026-Q4' })).toBe('2026-06-30')
  expect(achievedOn({ published: '2026-08-27' })).toBe('2026-08-27')
})

const mw = (value, qualifier = 'exact') => ({ value, unit: 'MW', qualifier })
it.each([
  ['약 → 95% 이상이면 이룸', mw(300, 'about'), mw(285), true],
  ['약 → 95% 미만은 못 이룸', mw(300, 'about'), mw(284), false],
  ['최대 → 약처럼', mw(300, 'up_to'), mw(290), true],
  ['정확한 숫자 → 100%', mw(300), mw(299), false],
  ['이상 → 100% 이상', mw(300, 'at_least'), mw(300), true],
  ['숫자 있는 약속인데 이룬 양 모름 → 못 이룸', mw(300), undefined, false],
  ['숫자 없는 약속 → 일어나면 이룸', undefined, undefined, true],
])('meetsTarget: %s', (_, target, amount, want) => expect(meetsTarget(target, amount)).toBe(want))

const U = 'https://www.sec.gov/x', C = '2026-10-21'
const p = (extra) => ({ id: 'p', topic: 'capacity', title_ko: '', title_en: '', deadline: '2026-H1', ...extra })
it.each([
  ['기한 안에 이룸 → 지켜짐', p({ fulfilled: { url: U, published: '2026-05-07' } }), 'kept'],
  ['기한 뒤에 이룸 → 늦게 지켜짐', p({ fulfilled: { url: U, published: '2026-08-27' } }), 'late-kept'],
  ['기한 지남·아직 → 늦어짐', p({}), 'late'],
  ['기한 전 → 기한 전', p({ deadline: '2026-12' }), 'pending'],
  ['기한 = 기준일 → 기한 전', p({ deadline: '2026-10-21' }), 'pending'],
  ['철회는 기한과 상관없이 철회', p({ deadline: '2027', withdrawn: { date: '2026-08-27', url: U, reason_ko: '', reason_en: '' } }), 'withdrawn'],
  ['회사가 미뤄도 원래 기한으로 판정', p({ postponed: [{ to: '2027-H1', url: U, published: '2026-05-07' }] }), 'late'],
  ['줄였다는 발표 없이 일부만 → 늦어짐', p({ target: mw(300), fulfilled: { url: U, published: '2026-05-07', amount: mw(100) } }), 'late'],
])('verdictOf: %s', (_, promise, status) => expect(verdictOf(promise, C).status).toBe(status))

it('verdictOf: 회사가 줄인 목표를 기한 안에 이룸 → 지켜짐 + reduced', () => {
  const v = verdictOf(p({ target: mw(1000, 'about'), reduced: { url: U, published: '2026-02-01', amount: mw(750) },
    fulfilled: { url: U, published: '2026-05-07', amount: mw(750) } }), C)
  expect(v).toMatchObject({ status: 'kept', reduced: true, deadline: '2026-06-30', achieved: '2026-05-07' })
})
it('verdictOf: 늦어짐이면 진행 X / Y', () => {
  const v = verdictOf(p({ target: mw(300), progress: { url: U, published: '2026-08-27', amount: mw(100) } }), C)
  expect(v.progress).toEqual({ done: mw(100), of: mw(300) })
})
it('verdictOf 는 오늘이 아니라 checkedAt 으로 판정 (오래된 자료에서 늦어짐으로 잘못 보이지 않게)', () => {
  expect(verdictOf(p({ deadline: '2026-12' }), '2026-10-21').status).toBe('pending')
})

it('scoreboard: due = 판정이 난 약속 수 (기한 전 빼고) — a ≤ b', () => {
  const list = [p({ fulfilled: { url: U, published: '2026-05-07' } }), p({ fulfilled: { url: U, published: '2026-08-27' } }), p({}),
    p({ withdrawn: { date: '2026-03-01', url: U, reason_ko: '', reason_en: '' } }), p({ deadline: '2027' }),
    p({ target: mw(1000, 'about'), reduced: { url: U, published: '2026-02-01', amount: mw(750) }, fulfilled: { url: U, published: '2026-05-07', amount: mw(750) } })]
  expect(scoreboard(list, C)).toEqual({ total: 6, kept: 2, lateKept: 1, late: 1, withdrawn: 1, pending: 1, reduced: 1, due: 5 })
})

it('recentCount: 오늘 포함 지난 30일 (30일 전 당일은 빼고)', () => {
  const s = [{ date: '2026-10-20' }, { date: '2026-09-22' }, { date: '2026-09-21' }]
  expect(recentCount(s, '2026-10-21')).toBe(2)
})

it.each([
  [mw(750, 'about'), 'ko', '약 750 MW'], [mw(1000), 'ko', '1 GW'], [mw(300, 'at_least'), 'en', '300+ MW'],
  [{ value: 23000, unit: 'GPUs', qualifier: 'exact' }, 'ko', 'GPU 23,000개'], [{ value: 23000, unit: 'GPUs', qualifier: 'exact' }, 'en', '23,000 GPUs'],
  [{ value: 9700, unit: 'USDm', qualifier: 'exact' }, 'en', '$9.7bn'], [{ value: 300, unit: 'USDm', qualifier: 'up_to' }, 'ko', '최대 $300m'],
])('fmtAmount(%o, %s) = %s', (a, lang, want) => expect(fmtAmount(a, lang)).toBe(want))

it('evidenceLabel·isCompanyUrl: 회사 자료 호스트만', () => {
  expect(evidenceLabel('https://www.sec.gov/Archives/x', 'ko')).toBe('SEC 공시')
  expect(evidenceLabel('https://www.globenewswire.com/news/x', 'ko')).toBe('보도자료')
  expect(evidenceLabel('https://iren.gcs-web.com/x', 'en')).toBe('press release')
  expect(evidenceLabel('https://iren.com/data-centers', 'ko')).toBe('회사 홈페이지')
  expect(isCompanyUrl('https://investors.iren.com/x')).toBe(true)
  expect(isCompanyUrl('https://x.com/IREN_Ltd/status/1')).toBe(false)
  expect(isCompanyUrl('https://seekingalpha.com/x')).toBe(false)
})
