import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRss, rssItemId, classifyFiling, recentFilings, pickExhibit, headlineFromHtml, filingTitle, sortNews, domainOf, decodeEntities, filingFolder, INCLUDE_FORMS } from './news.js'

const rss = readFileSync(new URL('./fixtures/google-news.rss.xml', import.meta.url), 'utf8')
const submissions = JSON.parse(readFileSync(new URL('./fixtures/edgar-submissions.sample.json', import.meta.url), 'utf8'))

describe('Google 뉴스 RSS', () => {
  it('제목(매체명 꼬리 제거)·링크·날짜(ISO)·매체 추출', () => {
    const items = parseRss(rss)
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ title: 'IREN stock rises on report of multiyear Anthropic deal (IREN:NASDAQ)', date: '2026-10-12', source: 'Seeking Alpha', source_url: 'https://seekingalpha.com' })
    expect(items[0].link).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\//)
    expect(items[0].title).not.toMatch(/Seeking Alpha$/)
  })
  it('id 는 링크 기준으로 같은 링크면 같고 다르면 다름', () => {
    expect(rssItemId('https://a/1')).toBe(rssItemId('https://a/1'))
    expect(rssItemId('https://a/1')).not.toBe(rssItemId('https://a/2'))
    expect(rssItemId('x')).toMatch(/^gn:[0-9a-f]{8}$/)
  })
  it('엔티티·CDATA 복원', () => {
    expect(decodeEntities('A &amp; B &#39;c&#39; &#x26;')).toBe("A & B 'c' &")
    expect(parseRss('<item><title><![CDATA[Q&A - X]]></title><link>https://l</link><pubDate>Mon, 12 Oct 2026 10:20:41 GMT</pubDate><source url="https://x.com">X</source></item>')[0].title).toBe('Q&A')
  })
})

describe('SEC EDGAR 분류', () => {
  it.each([
    [{ form: '10-K', items: [] }, 'earnings'],
    [{ form: '10-Q/A', items: [] }, 'earnings'],
    [{ form: '20-F', items: [] }, 'earnings'],
    [{ form: '4', items: [] }, 'insider'],
    [{ form: '8-K', items: ['2.02', '9.01'] }, 'earnings'],
    [{ form: '8-K', items: ['1.01', '7.01', '9.01'] }, 'press'],
    [{ form: '8-K', items: ['8.01', '9.01'] }, 'press'],
    [{ form: '8-K', items: ['5.02'] }, 'filing'],
    [{ form: '8-K', items: '1.01,2.03' }, 'press'],
    [{ form: '6-K', items: [] }, 'press'],
  ])('%o → %s', (f, kind) => expect(classifyFiling(f)).toBe(kind))

  it('submissions 열 배열 → 행 객체, 뉴스 서식만 걸러냄', () => {
    const rows = recentFilings(submissions)
    expect(rows).toHaveLength(14)
    expect(rows[2]).toMatchObject({ form: '8-K', date: '2026-08-27', items: ['2.02', '9.01'] })
    const news = rows.filter((r) => INCLUDE_FORMS.includes(r.form))
    expect(news.map((r) => r.form)).toEqual(['10-K', '8-K', '8-K', '8-K', '8-K', '4', '4', '4'])
    expect(filingFolder('0001140361-25-040072')).toBe('https://www.sec.gov/Archives/edgar/data/1878848/000114036125040072/')
  })
  it('첨부 파일 고르기: ex99-1 우선, 없으면 ex99*, 그림·xml 제외', () => {
    const idx = { directory: { item: [{ name: 'ef_8k.htm' }, { name: 'ef_ex99-2.htm' }, { name: 'ef_ex99-1.htm' }, { name: 'ef_ex99-2slide1.jpg' }] } }
    expect(pickExhibit(idx)).toBe('ef_ex99-1.htm')
    expect(pickExhibit({ directory: { item: [{ name: 'a_ex99.htm' }, { name: 'a_8k.htm' }] } })).toBe('a_ex99.htm')
    expect(pickExhibit({ directory: { item: [{ name: 'a_8k.htm' }] } })).toBeNull()
    // ex99 이름이 없으면 본문·R*.htm 을 뺀 나머지 (IREN 식 이름)
    expect(pickExhibit({ directory: { item: [{ name: 'iren-20260827.htm' }, { name: 'irenreportsfy26results.htm' }, { name: 'R1.htm' }] } }, 'iren-20260827.htm')).toBe('irenreportsfy26results.htm')
    expect(pickExhibit({ directory: { item: [{ name: 'ef_8k.htm' }, { name: 'ef_ex10-1.htm' }, { name: 'ef_ex5-1.htm' }] } }, 'ef_8k.htm')).toBeNull() // 계약서·법률의견은 보도자료 아님
  })
  it('첨부 HTML → 헤드라인 (Exhibit 99.1 머리말 건너뜀)', () => {
    const html = '<html><body><p>Exhibit 99.1</p><p><b>IREN Secures $9.7bn AI Cloud Contract with Microsoft</b></p><p>NEW YORK, November 3, 2025 (GLOBE NEWSWIRE) &#8211; IREN Limited…</p></body></html>'
    expect(headlineFromHtml(html)).toBe('IREN Secures $9.7bn AI Cloud Contract with Microsoft')
    expect(headlineFromHtml('<p>EX-99.1</p><p>short</p>')).toBeNull()
    // EDGAR 원본의 SGML 머리말(파일명 포함)은 건너뜀
    const raw = '<DOCUMENT>\n<TYPE>EX-99.1\n<SEQUENCE>2\n<FILENAME>ef20080141_ex99-1.htm\n<DESCRIPTION>EXHIBIT 99.1\n<TEXT>\n<html><body><p>Exhibit 99.1</p><p>IREN Reports Q4 FY26 Results</p></body></html>'
    expect(headlineFromHtml(raw)).toBe('IREN Reports Q4 FY26 Results')
    expect(headlineFromHtml('<html><head><title>irenreportsfy26results</title></head><body><p>IREN Reports FY26 Results</p></body></html>')).toBe('IREN Reports FY26 Results')
  })
  it('기본 제목·정렬·도메인', () => {
    expect(filingTitle({ form: '10-K', report_date: '2026-06-30' })).toBe('Annual report (10-K) (FY2026)')
    expect(filingTitle({ form: '8-K/A', report_date: null })).toBe('Current report (8-K) — amendment')
    const sorted = sortNews([{ date: '2026-01-01', kind: 'filing' }, { date: '2026-02-01', kind: 'insider' }, { date: '2026-01-01', kind: 'press' }])
    expect(sorted.map((x) => `${x.date}:${x.kind}`)).toEqual(['2026-02-01:insider', '2026-01-01:press', '2026-01-01:filing'])
    expect(domainOf('https://www.sec.gov/Archives/x')).toBe('sec.gov')
  })
})
