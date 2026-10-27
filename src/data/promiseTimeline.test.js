// 경영진 약속 타임라인 계산 (promiseTimeline.js) — 행(약속마다 한 줄) · 순서 · 묶음 · 축 위치 · 늦은 기간 글자
import { describe, it, expect } from 'vitest'
import { timelineRows, timelineGroups, timelineAxis, pos, fmtSpan, nextDeadline, sitePromises } from './promiseTimeline.js'
import file from './fixtures/statements.sample.json'

const rows = timelineRows(file)
const byId = Object.fromEntries(rows.map((r) => [r.id, r]))

describe('행 (약속마다 한 줄)', () => {
  it('약속 수만큼 · 말한 날 = 그 약속을 처음 말한 발언 날 · 다시 말한 날은 mentions (날짜순, 같은 날은 한 번)', () => {
    expect(rows).toHaveLength(file.promises.length)
    expect(byId['p-sample-kept'].said).toBe('2025-08-28')
    expect(byId['p-sample-kept'].mentions).toEqual(['2025-08-28', '2025-11-03'])
    expect(byId['p-sample-kept'].mentionCount).toBe(2)
  })
  it('판정·기한·이룬 날은 promises.verdictOf 그대로 (회사가 미뤄도 원래 기한)', () => {
    expect(byId['p-sample-late-kept']).toMatchObject({ status: 'late-kept', deadline: '2026-03-31', achieved: '2026-06-30' })
    expect(byId['p-sample-late']).toMatchObject({ status: 'late', deadline: '2026-06-30' })
    expect(byId['p-sample-late'].achieved).toBeUndefined()
    expect(byId['p-sample-repeat'].status).toBe('pending')
  })
  it('회사가 기한을 미룬 날(발표일)과 철회한 날도 행에', () => {
    expect(byId['p-sample-late'].postponedOn).toEqual(['2026-08-27'])
    expect(byId['p-sample-kept'].postponedOn).toEqual([])
    expect(byId['p-sample-withdrawn'].withdrawnOn).toBe('2026-08-27')
  })
  it('기한이 지난 뒤 흐른 날수: 늦게 지켜짐 = 기한 → 이룬 날, 늦어짐 = 기한 → 기준일, 나머지는 0', () => {
    expect(byId['p-sample-late-kept'].lateDays).toBe(91) // 2026-03-31 → 2026-06-30
    expect(byId['p-sample-late'].lateDays).toBe(113)     // 2026-06-30 → 2026-10-21 (기준일)
    expect(byId['p-sample-kept'].lateDays).toBe(0)
    expect(byId['p-sample-withdrawn'].lateDays).toBe(0)
    expect(byId['p-sample-repeat'].lateDays).toBe(0)
  })
  it('기한 전 약속은 기준일부터 기한까지 남은 날수', () => {
    expect(byId['p-sample-repeat'].daysLeft).toBe(71) // 2026-10-21 → 2026-12-31
    expect(byId['p-sample-kept'].daysLeft).toBeUndefined()
  })
  it('순서: 결과가 나온 약속 먼저, 그다음 기한 전 — 각각 기한이 이른 순, 같으면 먼저 말한 순', () => {
    expect(rows.map((r) => r.id)).toEqual(['p-sample-late-kept', 'p-sample-kept', 'p-sample-late', 'p-sample-withdrawn', 'p-sample-repeat'])
  })
  it('발언이 하나도 없는 약속은 막대 없이 기한 한 점 (말한 날 = 기한)', () => {
    const lone = { ...file, promises: [...file.promises, { id: 'p-lone', topic: 'gpu', title_ko: '혼자', title_en: 'Lone', deadline: '2027-06' }] }
    const r = timelineRows(lone).find((x) => x.id === 'p-lone')
    expect(r).toMatchObject({ said: '2027-06-30', deadline: '2027-06-30', mentions: [], mentionCount: 0 })
  })
})

describe('묶음', () => {
  it('결과가 나온 약속 한 묶음 + 기한 전은 기한마다 한 묶음 (남은 날수와 함께)', () => {
    const g = timelineGroups(rows)
    expect(g.map((x) => x.key)).toEqual(['decided', 'pending:2026-12-31'])
    expect(g[0].rows.map((r) => r.id)).toEqual(['p-sample-late-kept', 'p-sample-kept', 'p-sample-late', 'p-sample-withdrawn'])
    expect(g[1]).toMatchObject({ deadline: '2026-12-31', daysLeft: 71 })
    expect(g[1].rows.map((r) => r.id)).toEqual(['p-sample-repeat'])
  })
  it('행이 없는 묶음은 만들지 않음', () => {
    expect(timelineGroups(rows.filter((r) => r.status === 'pending')).map((x) => x.key)).toEqual(['pending:2026-12-31'])
    expect(timelineGroups([])).toEqual([])
  })
})

describe('축', () => {
  const a = timelineAxis(rows, file.checkedAt)
  it('가장 이른 말한 날이 든 달의 첫날부터, 가장 늦은 날(기한·이룬 날·기준일)이 든 달의 다음 달 첫날까지', () => {
    expect(a.start).toBe('2023-06-01') // 가장 이른 말한 날 2023-06-15 (시작일 전 발언)
    expect(a.end).toBe('2028-01-01')   // 가장 늦은 기한 2027-12-31
    expect(a.today).toBe(file.checkedAt)
  })
  it('해 눈금 = 축 안의 1월 1일, 분기 눈금 = 축 안의 4·7·10월 1일', () => {
    expect(a.years.map((y) => y.label)).toEqual(['2024', '2025', '2026', '2027'])
    expect(a.quarters).toContain('2026-04-01')
    expect(a.quarters).not.toContain('2026-01-01')
  })
  it('pos: 축 시작 0 · 끝 100 · 그 사이는 날짜에 비례, 축 밖은 0~100 으로 자름', () => {
    expect(pos(a.start, a)).toBe(0)
    expect(pos(a.end, a)).toBe(100)
    const mid = pos('2025-09-16', a)
    expect(mid).toBeGreaterThan(50); expect(mid).toBeLessThan(51) // 2023-06-01 ~ 2028-01-01 의 가운데쯤
    expect(pos('2020-01-01', a)).toBe(0); expect(pos('2030-01-01', a)).toBe(100)
  })
  it('행이 없으면 기준일이 든 해 하나', () => {
    const e = timelineAxis([], '2026-10-21')
    expect([e.start, e.end]).toEqual(['2026-01-01', '2027-01-01'])
  })
})

describe('기간 글자 (늦은 기간 · 남은 기간)', () => {
  it('한 달(31일) 미만은 날, 그 이상은 달 (반올림)', () => {
    expect(fmtSpan(8, 'ko')).toBe('8일'); expect(fmtSpan(8, 'en')).toBe('8 days')
    expect(fmtSpan(1, 'en')).toBe('1 day')
    expect(fmtSpan(91, 'ko')).toBe('3개월'); expect(fmtSpan(31, 'en')).toBe('1 month')
    expect(fmtSpan(659, 'ko')).toBe('22개월'); expect(fmtSpan(659, 'en')).toBe('22 months')
  })
})

// 옥상 위 CEO 카드의 '다음 기한' 한 줄 · 캠퍼스 패널의 '이 캠퍼스 약속' 목록
describe('다가오는 기한 · 캠퍼스별 약속', () => {
  it('nextDeadline: 기한 전 약속 중 가장 이른 기한 · 그 기한의 약속 수 · 기준일부터 남은 날', () => {
    expect(nextDeadline(file)).toEqual({ deadline: '2026-12-31', count: 1, daysLeft: 71 })
  })
  it('nextDeadline: 기한 전 약속이 없으면 null', () => {
    const none = { ...file, promises: file.promises.filter((p) => timelineRows(file).find((r) => r.id === p.id).status !== 'pending') }
    expect(nextDeadline(none)).toBeNull()
  })
  it('sitePromises: 그 캠퍼스 약속만, 타임라인과 같은 순서', () => {
    const f2 = { ...file, promises: file.promises.map((p) => (p.id === 'p-sample-kept' || p.id === 'p-sample-repeat' ? { ...p, site: 'childress' } : p)) }
    expect(sitePromises(f2, 'childress').map((r) => r.id)).toEqual(['p-sample-kept', 'p-sample-repeat'])
    expect(sitePromises(f2, 'mackenzie')).toEqual([])
  })
})
