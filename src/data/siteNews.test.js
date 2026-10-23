// 캠퍼스 소식 목록 (siteNewsAt) — 순수 함수와 실제 데이터 검사
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { toMonth } from './timeline.js'
import { siteNewsAt } from './siteNews.js'

// 실제 iren.json 의 timeline 과 같은 모양 (date · event · event_en · source)
const news = (date) => ({ date, event: `${date} 소식`, event_en: `${date} news`, source: `https://example.com/${date}` })

describe('siteNewsAt', () => {
  it('보고 있는 달까지의 소식만 (그 달 소식은 넣고, 그 뒤 소식은 지난 달에 미리 보이지 않음)', () => {
    const site = { timeline: [news('2026-09-08'), news('2026-10-21'), news('2026-11-05')] }
    expect(siteNewsAt(site, toMonth('2026-10')).map((n) => n.date)).toEqual(['2026-10-21', '2026-09-08'])
    expect(siteNewsAt(site, toMonth('2026-09')).map((n) => n.date)).toEqual(['2026-09-08'])
  })
  it('최신 소식이 맨 위 — 데이터에 적힌 순서와 상관없이 (달만·해만 적힌 날짜도)', () => {
    const site = { timeline: [news('2025-12'), news('2019'), news('2026-05-07'), news('2025-12-31'), news('2025-02')] }
    expect(siteNewsAt(site, toMonth('2026-10')).map((n) => n.date)).toEqual(['2026-05-07', '2025-12-31', '2025-12', '2025-02', '2019'])
  })
  it('원래 항목을 그대로 돌려줌 (글·영어 글·출처)', () => {
    const one = news('2026-06-15')
    expect(siteNewsAt({ timeline: [one] }, toMonth('2026-10'))).toEqual([one])
  })
  it('timeline 이 없거나 그 달까지 소식이 없으면 빈 목록', () => {
    expect(siteNewsAt({}, toMonth('2026-10'))).toEqual([])
    expect(siteNewsAt({ timeline: [news('2026-10-21')] }, toMonth('2026-09'))).toEqual([])
  })
})

describe('실제 데이터', () => {
  // 지도 화면은 늘 기준일 달을 보므로, 기준일 뒤 날짜의 소식이 있으면 지도 캠퍼스 패널에서 조용히 빠짐
  // → 소식을 넣을 때 data/companies/*.json 의 as_of 도 그 날짜 이후로 올릴 것
  it('기준일 달에는 모든 캠퍼스의 소식이 빠짐없이 보임', () => {
    const infra = buildInfra()
    const asOfM = toMonth(infra.as_of.slice(0, 7))
    for (const site of infra.sites) {
      expect(siteNewsAt(site, asOfM).length, site.id).toBe(site.timeline.length)
    }
  })
})
