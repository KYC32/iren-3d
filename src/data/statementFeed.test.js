// 경영진 발언 탭 목록 (statementFeed.js) — 달별 묶음 · 최신순 · 채널·사람 거르기 · 같은 문장 합치기 · 약속 칩
import { describe, it, expect } from 'vitest'
import { statementFeed, feedChannels } from './statementFeed.js'
import file from './fixtures/statements.sample.json'

const items = (months) => months.flatMap((m) => m.items)

describe('달별 묶음', () => {
  const months = statementFeed(file)
  it('달은 최신순, 달 안의 발언도 최신순', () => {
    const keys = months.map((m) => m.month)
    expect(keys).toEqual([...keys].sort().reverse())
    expect(new Set(keys).size).toBe(keys.length) // 같은 달은 한 묶음
    for (const m of months) { const d = m.items.map((i) => i.date); expect(d).toEqual([...d].sort().reverse()) }
  })
  it('발언마다 한 줄 (같은 문장이 없으면 발언 수 그대로)', () => {
    expect(items(months)).toHaveLength(file.statements.length)
  })
  it('약속에 걸린 발언은 약속 칩(약속 + 판정), 앞서 같은 약속을 말한 적이 있으면 repeat', () => {
    const later = items(months).find((i) => i.id === 's-sample-9')
    expect(later.promises).toHaveLength(1)
    expect(later.promises[0]).toMatchObject({ repeat: true, verdict: { status: 'kept' } })
    expect(later.promises[0].promise.id).toBe('p-sample-kept')
    const first = items(months).find((i) => i.id === 's-sample-3')
    expect(first.promises[0].repeat).toBe(false)
  })
  it('약속이 없는 발언(의견)은 칩 없음', () => {
    expect(items(months).filter((i) => !i.promises.length).map((i) => i.id).sort()).toEqual(['s-sample-7', 's-sample-8'])
  })
  it('시작일(2023-08-29) 전 발언 표시', () => {
    expect(items(months).find((i) => i.id === 's-sample-1').beforeSince).toBe(true)
    expect(items(months).find((i) => i.id === 's-sample-9').beforeSince).toBe(false)
  })
})

describe('거르기', () => {
  it('채널을 주면 그 채널 발언만', () => {
    const x = items(statementFeed(file, { channel: 'x' }))
    expect(x.map((i) => i.id).sort()).toEqual(['s-sample-4', 's-sample-7'])
  })
  it('사람을 주면 그 사람 발언만 (CEO 사진을 눌렀을 때)', () => {
    const a = items(statementFeed(file, { person: 'person-a' }))
    expect(a.length).toBeGreaterThan(0); expect(a.every((i) => i.person === 'person-a')).toBe(true)
    expect(items(statementFeed(file, { person: 'nobody' }))).toEqual([])
  })
  it('채널 단추: 전체 + 발언이 있는 채널만 (사람별이면 그 사람 기준) — 약속은 약속 탭이 따로 보여 줌', () => {
    expect(feedChannels(file)).toEqual(['all', 'x', 'call', 'interview', 'release'])
    expect(feedChannels(file, 'nobody')).toEqual(['all'])
  })
})

describe('같은 문장 합치기', () => {
  it('한 문장에 약속이 둘이면(같은 사람·주소·인용) 한 줄에 약속 칩 둘', () => {
    const s = file.statements.find((x) => x.id === 's-sample-9')
    const twin = { ...s, id: 's-sample-9b', promise: 'p-sample-late' }
    const list = items(statementFeed({ ...file, statements: [...file.statements, twin] }))
    expect(list).toHaveLength(file.statements.length)
    expect(list.find((i) => i.id === 's-sample-9').promises.map((c) => c.promise.id)).toEqual(['p-sample-kept', 'p-sample-late'])
  })
})
