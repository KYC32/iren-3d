// 경영진 발언 데이터(data/statements.json) 스키마·내용 규칙 테스트
//   '이룬 날'·'철회'·'목표 줄임' 근거는 회사 자료만, 시작일(2023-08-29) 뒤 발언만 (시작일 전 약속을 뒤에 다시 말한 경우는 예외)
import { it, expect } from 'vitest'
import { validateStatements } from './statementsSchema.js'
import fixture from './fixtures/statements.sample.json'

// 가장 작은 올바른 파일: 사람 1명, 발언 2건(약속에 연결된 것 + 의견), 약속 1건
const sample = () => ({
  checkedAt: '2026-10-21', since: '2023-08-29', since_source: 'https://www.sec.gov/Archives/sample-6k.htm',
  people: [{ id: 'person-a', name: 'Sample Person A', title_ko: '공동 CEO', title_en: 'Co-CEO', photo: '/people/sample-a.jpg', photo_source: 'https://iren.com/about' }],
  statements: [
    { id: 's-1', person: 'person-a', date: '2025-11-05', channel: 'call', kind: 'sec', url: 'https://www.sec.gov/Archives/sample-call.htm', summary_ko: '약속', summary_en: 'promise', promise: 'p-1' },
    { id: 's-2', person: 'person-a', date: '2026-10-01', channel: 'x', kind: 'x', url: 'https://x.com/sample/status/1', summary_ko: '의견', summary_en: 'opinion' },
  ],
  promises: [{ id: 'p-1', topic: 'capacity', title_ko: '약속', title_en: 'promise', deadline: '2026-H1', fulfilled: { url: 'https://www.globenewswire.com/sample', published: '2026-05-07' } }],
})

it('화면용 샘플 자료도 통과', () => expect(validateStatements(fixture)).toEqual([]))
// 회사 보도자료·실적 보도자료 속 공동 CEO 인용 (이름이 붙은 말) — 채널 'release'
it("보도자료 속 CEO 인용은 channel 'release'", () => {
  const f = sample(); f.statements[0].channel = 'release'
  expect(validateStatements(f)).toEqual([])
})
it('올바른 파일은 통과', () => expect(validateStatements(sample())).toEqual([]))
it.each([
  ['없는 사람', (f) => { f.statements[0].person = 'nobody' }, 'person'],
  ['발언 없는 약속', (f) => { f.statements[0].promise = undefined }, '발언 없음'],
  ['시작일 전 발언은 시작일 뒤에 다시 말한 약속에만', (f) => { f.statements[1].date = '2023-01-01' }, '시작일 전'],
  ['근거가 회사 자료가 아님', (f) => { f.promises[0].fulfilled.url = 'https://seekingalpha.com/a' }, '회사 자료'],
  ['영상은 재생 시각 필수', (f) => { f.statements[0].kind = 'video'; delete f.statements[0].at }, '재생 시각'],
  ['재생 시각은 영상에만', (f) => { f.statements[0].kind = 'sec'; f.statements[0].at = '1:02' }, '재생 시각'],
  ['확인일 뒤 날짜', (f) => { f.statements[0].date = '2099-01-01' }, 'checkedAt'],
  ['숫자 약속을 이뤘으면 이룬 양 필수', (f) => { f.promises[0].target = { value: 1, unit: 'MW', qualifier: 'exact' }; delete f.promises[0].fulfilled.amount }, 'amount'],
  ['이룸과 철회를 함께 둘 수 없음', (f) => { f.promises[0].withdrawn = { date: '2026-01-01', url: 'https://www.sec.gov/a', reason_ko: 'x', reason_en: 'x' } }, '함께'],
  ['목표·이룬 양 단위가 다름', (f) => { f.promises[0].target = { value: 1, unit: 'MW', qualifier: 'exact' }; f.promises[0].fulfilled.amount = { value: 1, unit: 'GPUs', qualifier: 'exact' } }, 'unit'],
  ['X 발언은 x.com 주소', (f) => { f.statements[0].kind = 'x'; f.statements[0].url = 'https://example.com/a' }, 'x.com'],
  ['SEC 발언은 sec.gov 주소', (f) => { f.statements[0].kind = 'sec'; f.statements[0].url = 'https://example.com/a' }, 'sec.gov'],
  ['인용은 한 문장(줄바꿈 없음)', (f) => { f.statements[0].quote = 'a\nb' }, 'quote'],
  // 계획의 "그 밖의 규칙": id 중복·시작일 순서·회사 발언 주소·철회 근거·근거 날짜·목표 줄임엔 원래 목표
  ['발언 id 중복', (f) => { f.statements[1].id = 's-1' }, '중복'],
  ['시작일이 확인일 뒤', (f) => { f.since = '2027-01-01' }, 'since'],
  ['회사 발언(company)은 회사 자료 주소', (f) => { f.statements[0].kind = 'company'; f.statements[0].url = 'https://example.com/a' }, '회사 자료'],
  ['철회 근거도 회사 자료만', (f) => { delete f.promises[0].fulfilled; f.promises[0].withdrawn = { date: '2026-01-01', url: 'https://example.com/a', reason_ko: 'x', reason_en: 'x' } }, '회사 자료'],
  ['근거 발표일이 확인일 뒤', (f) => { f.promises[0].fulfilled.published = '2099-01-01' }, 'checkedAt'],
  ['목표 줄임은 원래 목표가 있어야', (f) => { f.promises[0].reduced = { url: 'https://www.sec.gov/a', published: '2026-02-01', amount: { value: 1, unit: 'MW', qualifier: 'exact' } } }, 'target'],
])('%s', (_, breakIt, word) => { const f = sample(); breakIt(f); expect(validateStatements(f).join('\n')).toContain(word) })
