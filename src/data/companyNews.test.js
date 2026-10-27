// 사이트 기록의 회사 공식 발표 → 뉴스 '회사 발표' 탭 (SEC 제출과 겹치지 않는 것만)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { siteReleases, isOfficialRelease } from './companyNews.js'

const gnw = (d, slug) => `https://www.globenewswire.com/news-release/${d.replaceAll('-', '/')}/1/0/en/${slug}.html`
const raw = {
  sourceDates: [{ url: 'https://x.com/IREN_Ltd/status/2110149386600947768', published: '2026-10-13' }],
  sites: [
    { id: 'badajoz', timeline: [{ date: '2026-10-21', event: '바다호스 토목 허가', event_en: 'Badajoz civil works license', source: gnw('2026-10-21', 'badajoz') }] },
    { id: 'redbank', timeline: [{ date: '2026-10-14', event: '레드뱅크 계획 공개', event_en: 'Redbank plan', source: 'https://x.com/IREN_Ltd/status/2110149386600947768' }] },
    { id: 'childress', timeline: [
      { date: '2026-08-27', event: 'FY26 실적', event_en: 'FY26 results', source: gnw('2026-08-27', 'fy26') },
      { date: '2026-05-11', event: '콜 발언', source: 'https://www.sec.gov/Archives/edgar/data/1878848/x/irentranscript.htm' },
      { date: '2026-09-18', event: '텍사스 PUC 규칙', source: 'https://interchange.puc.texas.gov/x' },
    ] },
    { id: 'sweetwater-1', timeline: [{ date: '2026-08-27', event: 'FY26 실적(스위트워터)', source: gnw('2026-08-27', 'fy26') }] },
  ],
  companies: [{ events: [
    { date: '2026-11-05', basis: 'reported', title_ko: '1분기 실적 발표', title_en: 'Q1 results', source: gnw('2026-10-22', 'q1-date') },
    { date: '2026-12', basis: 'target', title_ko: '목표', source: gnw('2026-08-27', 'fy26-target') },
  ] }],
}
raw.sourceDates.push({ url: gnw('2026-10-22', 'q1-date'), published: '2026-10-22' })
const edgar = [{ date: '2026-08-27', kind: 'earnings' }, { date: '2026-10-20', kind: 'insider' }]

describe('siteReleases', () => {
  const out = siteReleases(raw, edgar)
  it('회사 공식 채널(GlobeNewswire·회사 X)만, 최신 먼저', () => {
    expect(out.map((r) => r.date)).toEqual(['2026-10-22', '2026-10-21', '2026-10-13'])
    expect(out.every((r) => isOfficialRelease(r.url))).toBe(true)
  })
  it('SEC 보도자료·실적 제출과 하루 안으로 겹치면 같은 발표로 보고 뺌 (내부자 거래는 상관없음)', () => {
    expect(out.some((r) => r.date === '2026-08-27')).toBe(false)
    expect(out.some((r) => r.date === '2026-10-21')).toBe(true)   // 10-20 은 내부자 거래뿐
  })
  it('날짜는 출처 공개일 (회사 사건은 사건 날짜가 아니라 발표한 날) · 회사 목표(target)와 달 단위는 뺌', () => {
    expect(out.find((r) => r.url.includes('q1-date')).date).toBe('2026-10-22')
    expect(out.find((r) => r.url.includes('x.com')).date).toBe('2026-10-13')
    expect(out.some((r) => r.url.includes('fy26-target'))).toBe(false)
  })
  it('SEC·주정부 같은 비공식 채널이 아닌 회사 외 출처는 넣지 않음', () => {
    expect(isOfficialRelease('https://interchange.puc.texas.gov/x')).toBe(false)
    expect(isOfficialRelease('https://x.com/AceKicker13/status/1')).toBe(false)
    expect(isOfficialRelease('https://iren.com/investors')).toBe(true)
  })
})

// 실제 자료: 10월 회사 발표 3건(레드뱅크·바다호스·실적 발표일)이 들어가고 FY26 실적(8-K 있음)은 빠짐
describe('실제 자료 (infra.json + news.json)', () => {
  const infra = JSON.parse(readFileSync(new URL('../../public/data/infra.json', import.meta.url), 'utf8'))
  const news = JSON.parse(readFileSync(new URL('../../public/data/news.json', import.meta.url), 'utf8'))
  it('SEC 에 없는 10월 회사 발표가 보임', () => {
    const out = siteReleases(infra, news.company.items)
    const oct = out.filter((r) => r.date >= '2026-10-01').map((r) => r.date)
    expect(oct).toEqual(expect.arrayContaining(['2026-10-22', '2026-10-21', '2026-10-13']))
    expect(out.some((r) => r.date === '2026-08-27')).toBe(false)
  })
})
