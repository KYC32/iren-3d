// 성장 경로: 기준일(2026-10) 뒤 연말마다 AI 가동 전력 — 회사 목표대로 늘어나야 함
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { growthPath } from './outlook.js'

describe('growthPath', () => {
  const path = growthPath(buildInfra())
  it('기준일 뒤 연말 3개 시점을 순서대로', () => {
    expect(path.map((p) => p.year)).toEqual([2026, 2027, 2028])
  })
  it('AI 가동 전력은 줄지 않고 회사 목표대로 늘어남', () => {
    for (let i = 1; i < path.length; i++) expect(path[i].ai).toBeGreaterThanOrEqual(path[i - 1].ai)
    expect(path.at(-1).ai).toBeGreaterThan(path[0].ai)
  })
})
