// 현장 관찰·설비(이중화) — 순수 함수와 실제 데이터 파일 검사
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth } from '../data/timeline.js'
import { validateObservations } from '../data/observationsSchema.js'
import { factsFor, segmentStages } from './siteFacts.js'

const file = JSON.parse(readFileSync(new URL('../../data/observations.json', import.meta.url), 'utf8'))

describe('observations.json', () => {
  it('스키마·사이트·건물·날짜 규칙을 통과', () => {
    expect(validateObservations(file, buildInfra().sites)).toEqual([])
  })
})

describe('factsFor', () => {
  it('보고 있는 달까지 게시된 관찰만 (그 뒤 관찰은 지나간 달에 미리 보이지 않음)', () => {
    const now = factsFor(file, 'mackenzie', toMonth('2026-10'))
    expect(now.progress.map((p) => p.id)).toContain('mk-air-2026-09-23')
    const before = factsFor(file, 'mackenzie', toMonth('2026-08'))
    expect(before.progress).toEqual([])
    expect(before.facilities.every((f) => f.basis === 'reported')).toBe(true) // 회사 홈페이지 설명은 날짜와 무관
  })
  // 정부 허가 기록(EPA ECHO · TCEQ 건설 빗물 일반 허가)도 같은 칸 — 회사 발표가 아니라 관찰과 같은 등급
  it('스위트워터 2 는 EPA 허가 기록(2026-07-09 발급)이 그 달부터 보이고 그 전에는 없음', () => {
    const ids = (m) => factsFor(file, 'sweetwater-2', toMonth(m)).progress.map((p) => [p.id, p.method])
    expect(ids('2026-10')).toContainEqual(['sw2-2026-07-09-permit', 'permit'])
    expect(ids('2026-06')).toEqual([])
  })
  it('다른 사이트 관찰은 섞이지 않음', () => {
    expect(factsFor(file, 'kiowa', toMonth('2026-10'))).toEqual({ facilities: [], progress: [] })
  })
})

describe('segmentStages', () => {
  // 홀 1개 = 세그먼트 8칸. 장비 개수로 칸마다 가장 앞선 단계를 정함 (어느 칸인지는 구분하지 않음 — 개수만)
  it('ATS 설치 > 장비(MER·변압기·발전기 모두) > 패드 > 패드 전 순으로 칸을 채움', () => {
    expect(segmentStages({ pads: 8, mer: 7, transformers: 8, generators: 6, ats: 1 }, 8))
      .toEqual(['ats', 'equipment', 'equipment', 'equipment', 'equipment', 'equipment', 'pad', 'pad'])
    expect(segmentStages({ pads: 3, mer: 0, transformers: 8, generators: 0, ats: 0 }, 8))
      .toEqual(['pad', 'pad', 'pad', 'none', 'none', 'none', 'none', 'none'])
  })
})
