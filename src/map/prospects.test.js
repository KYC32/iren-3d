// 지도 '?' 표시(회사가 발표하지 않은 진출 정황)에 쓰는 순수 함수 시험
import { describe, it, expect } from 'vitest'
import { prospectsAt } from './prospects.js'
import { toMonth } from '../data/timeline.js'
import { buildInfra } from '../../scripts/build-data.mjs'

// 시험용 정황 3건 (날짜 순서를 일부러 섞음)
const P = [{ id: 'alberta', signals: [
  { date: '2025-11-26', ko: 'AESO 작업반', en: 'AESO working group', source: 'https://a.example/1' },
  { date: '2026-10-05', ko: '채용 공고', en: 'Job ad', source: 'https://a.example/2' },
  { date: '2026-07-29', ko: '채용 공고 2', en: 'Job ad 2', source: 'https://a.example/3' },
] }]

describe('prospectsAt', () => {
  it('보고 있는 달까지 공개된 정황만, 최신이 위', () => {
    const [a] = prospectsAt(P, toMonth('2026-08'))
    expect(a.signals.map((s) => s.date)).toEqual(['2026-07-29', '2025-11-26'])
  })
  it('그 달까지 정황이 하나도 없으면 표시하지 않음', () => {
    expect(prospectsAt(P, toMonth('2025-10'))).toEqual([])
  })
  it('자료가 없으면 빈 목록', () => {
    expect(prospectsAt(undefined, toMonth('2026-10'))).toEqual([])
  })
})

describe('실제 데이터 (data/prospects.json)', () => {
  const raw = buildInfra()
  it('앨버타 ? 는 부지 목록에 없고 정황 자료에만 있음 (합계·목록·3D 에 안 들어감)', () => {
    expect(raw.sites.some((s) => s.id === 'alberta')).toBe(false)
    const ab = raw.prospects.find((p) => p.id === 'alberta')
    expect(ab.admin1).toBe('CA-AB')
    expect(ab.signals.length).toBeGreaterThanOrEqual(3)
  })
})
