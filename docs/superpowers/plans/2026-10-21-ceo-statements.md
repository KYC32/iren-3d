# 경영진 발언 · 약속 장부 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 지도에 시드니 본사 카드를 두고, 누르면 두 공동 CEO의 발언과 약속 판정(지켜짐·늦게 지켜짐·늦어짐·철회·기한 전)이 보이는 칸을 연다.

**Architecture:**
- 데이터: `data/statements.json`(사람·발언·약속)을 기존 빌드가 `public/data/statements.json`으로 내보낸다 (관찰 데이터 `observations.json`과 같은 방식). 판정은 손으로 적지 않고 순수 함수(`src/data/promises.js`)가 계산한다.
- 지도 카드는 지도 코드 묶음(GeoMap) 안에, 발언 칸은 처음 열 때 불러오는 별도 묶음(React.lazy)에 둔다.
- 상태는 기존 zustand 저장소의 `hqOpen` 하나와 해시 `hq=1`로 다룬다.

**Tech Stack:** React · zustand · zod · maplibre-gl · vitest · lucide-react (모두 기존 의존성, 새로 설치하는 것 없음)

**Spec:** `docs/superpowers/specs/2026-10-21-ceo-statements-design.md` (참고 시안: 같은 폴더 `2026-10-21-ceo-statements/`)

## Global Constraints

- **작업 위치:** `/Users/kk/Desktop/CRFT/iren-3d`는 다른 Claude 세션들이 커밋하지 않은 채 동시에 쓰고 있다.
  - superpowers:using-git-worktrees로 `origin/main`에서 새 가지 `feat/ceo-statements`를 별도 작업 폴더(예: `/Users/kk/Desktop/CRFT/iren-3d-ceo`)에 만들어 거기서만 작업한다.
  - 작업 폴더에서 `npm ci`를 한 번 한다.
- **공개 시점:** Task 6의 데이터 검토표를 사용자가 승인하기 전에는 main에 합치지 않는다 (spec 8장 "첫 공개 전 검토").
- **커밋:** 자기 파일만 `git add <경로>`로 올린다. 메시지 끝줄은 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **푸시:** `git fetch -q && git merge-base --is-ancestor origin/main HEAD && git push -q origin HEAD:main` (Task 7에서만).
- **용량 예산:** `npm run build`의 마지막 줄 세 개가 모두 ✅여야 한다 — HTML UI ≤ 120 KiB (지금 116.0), 실제 지도 포함 전체 ≤ 550 KiB (지금 537.5), 첫 3D 지도 포함 전체 ≤ 450 KiB.
- **판정 이름(그대로):** 지켜짐 / 늦게 지켜짐 / 늦어짐 / 철회 / 기한 전. 태그 "목표 줄임". 의견은 "약속 아님 (의견)".
- **칸 아래 안내(그대로):** "요약은 이 사이트가 원문을 보고 정리한 것 · '지켜짐'은 회사 보도자료·SEC 공시로 확인됐을 때만 · 비공식 · 투자 조언 아님"
- **시작일:** 2023-08-29 (H100·생성형 AI를 처음 밝힌 6-K).
  - 이 날 뒤의 발언만 넣는다.
  - 예외: 시작일 전에 처음 한 약속을 뒤에 다시 말했으면 그 처음 발언도 넣는다.
- **약속 주제:** AI·데이터센터만 — `capacity`(가동·인도 용량), `power`(전력·변전소), `site`(부지·건물), `gpu`, `contract`(고객 계약), `revenue`(AI 매출). 채굴 약속은 넣지 않는다.
- **기한:** 기간의 끝으로 본다. IREN 회계연도는 7월 시작이다 (FY2026 = 2025-07-01 ~ 2026-06-30).
- **달성 기준:** '약'(about)·'최대'(up_to)는 95% 이상, 그 밖(exact·at_least)은 100% 이상이면 이룬 것이다.
- **'이룬 날'·'철회'·'목표 줄임'·'미룸'·'진행' 근거:** 회사 자료만. 주소의 호스트가 `sec.gov`, `iren.com`, `iren.gcs-web.com`, `globenewswire.com`(그 하위 호스트 포함)인 것만 인정한다.
- **발언 원문 인정 순서:**
  1. SEC 녹취록·회사 자료
  2. 대담·인터뷰 영상 — 재생 시각 필수
  3. 로그인·결제 없이 읽히는 공개 녹취록
- **'발언 n' 배지:** 오늘 기준 최근 30일 발언 수. 0이면 숨긴다.
- **색:** IREN 초록 #71DA80 · 남색 #0B344F.
  - 판정 색: 지켜짐 #71DA80, 늦게 지켜짐 #b9d97a, 늦어짐 #e8b04a, 기한 전 #c3ccd3, 철회 #c4645a (이 계획의 결정).
- **코드 규칙:** 초보자용 한국어 주석, 아이콘은 lucide만, 이모지 금지. UI 문자열은 `src/i18n/ko.js`·`en.js`에 같은 키로 넣는다.
- **조사 규칙:**
  - X는 내장 브라우저의 사용자 세션으로 읽기만 한다 (좋아요·팔로우 금지). Cloudflare·CAPTCHA는 우회하지 않는다.
  - SEC 요청의 User-Agent는 정확히 `iren-3d research bot research@example.com`이다.
  - 사진은 내려받기 전에 파일 이름·출처·크기를 말하고 사용자 허락을 받는다.
- **갱신 기록:** 데이터를 바꾸면 `data/changelog.json`에 한 줄 남긴다 (기존 규칙).

## Review Focus

1. **오래된 데이터:** 오늘이 `checkedAt`보다 몇 달 뒤여도 판정은 `checkedAt` 기준이어야 한다. 칸에 "○월 ○일 확인 기준"이 보여야 한다. → Task 1 테스트 `verdictOf 는 오늘이 아니라 checkedAt 으로 판정`, Task 5 확인 단계.
2. **사진을 못 받음 (404·차단):** 카드와 칸의 동그라미에 이름 머리글자(DR·WR)가 대신 나와야 한다. → Task 4 테스트 `initialsOf`, 확인 단계 `사진 주소를 일부러 틀리게`.
3. **`statements.json`을 못 받음 (오프라인·없음):** 본사 카드는 배지 없이 그대로 보이고, 칸은 "발언 자료를 불러오지 못했습니다"를 보여야 한다. → Task 4 테스트 `loadStatements 는 실패하면 null`, Task 5 확인 단계.
4. **지도 경도 이어 붙임:** 이 지도는 북미를 가운데 두고 경도를 펼친다. 시드니 카드는 번디와 같은 쪽(북미 왼쪽)에 나와야 한다. → Task 3 테스트 `hqLngLat`.
5. **휴대폰 375px:** 지역 단추 줄에 '본사'가 늘어도 가로 넘침이 없고, 아래 시트로 열린 칸을 닫을 수 있어야 한다. → Task 4·5 확인 단계 (`scrollWidth - clientWidth === 0`).

---

## 파일 구조

| 파일 | 하는 일 | Task |
|---|---|---|
| `src/data/promises.js` (새) | 기한 끝 날짜·달성 판정·성적표·표기 — 순수 함수 | 1 |
| `src/data/statementsSchema.js` (새) | `data/statements.json` zod 스키마 + 내용 규칙 | 2 |
| `scripts/build-data.mjs`, `scripts/validate.mjs` | 발언 파일 빌드·검사 연결 | 2 |
| `src/data/schema.js`, `data/companies.json` | 회사에 `hq`(본사 위치) 추가 | 3 |
| `src/store/hashState.js`, `src/store/useAppStore.js` | `hq=1` 해시, `hqOpen`·`openHq`·`closeHq` | 3 |
| `src/map/mapData.js` | `REGION_NAMES.HQ`, `hqLngLat`, `regionBounds` | 3 |
| `src/data/loadStatements.js` (새) | 발언 파일 한 번만 받기 | 4 |
| `src/data/format.js` | `initialsOf` | 4 |
| `src/map/HqMarker.jsx` (새), `src/map/GeoMap.jsx` | 지도 위 본사 카드, '본사' 단추 이동 | 4 |
| `src/data/statementRows.js` (새) | 칸 목록 행 만들기(거르기·정렬·다시 언급) — 순수 함수 | 5 |
| `src/ui/StatementsPanel.jsx` (새), `src/ui/statements.css` (새), `src/App.jsx` | 경영진 발언 칸 (지연 로딩) | 5 |
| `src/i18n/ko.js`, `src/i18n/en.js` | `hq` 문자열 묶음 | 4·5 |
| `data/statements.json` (새), `public/people/*.jpg` (새) | 실제 사람·발언·약속·사진 | 6 |
| `README.md`, `data/changelog.json` | 설명·갱신 기록 | 7 |

---

### Task 1: 약속 판정 계산 (`promises.js`)

**Files:**
- Create: `src/data/promises.js`
- Test: `src/data/promises.test.js`

**Interfaces:**
- Produces (다른 Task가 씀):
  - `COMPANY_HOSTS: string[]` = `['sec.gov','iren.com','iren.gcs-web.com','globenewswire.com']`
  - `isCompanyUrl(url: string): boolean` — 호스트가 목록과 같거나 `.목록`으로 끝나면 true
  - `deadlineEnd(when: string): string` — 'YYYY-MM-DD'
  - `achievedOn(fulfilled: {published, date?, period?}): string`
  - `meetsTarget(target?: Amount, amount?: Amount): boolean`
  - `verdictOf(promise, checkedAt: string): Verdict`. 여기서 `Verdict = { status: 'kept'|'late-kept'|'late'|'withdrawn'|'pending', reduced: boolean, deadline: string, achieved?: string, progress?: { done: Amount, of: Amount } }`
  - `scoreboard(promises, checkedAt): { total, kept, lateKept, late, withdrawn, pending, reduced, due }`
  - `recentCount(statements, today: string, days = 30): number`
  - `fmtAmount(amount: Amount, lang: 'ko'|'en'): string`
  - `evidenceLabel(url: string, lang): string`
  - `Amount = { value: number, unit: 'MW'|'GPUs'|'USDm', qualifier: 'about'|'at_least'|'exact'|'up_to' }`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/data/promises.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/data/promises.test.js`
Expected: FAIL — `Failed to resolve import "./promises.js"`

- [ ] **Step 3: `src/data/promises.js` 구현** — 위 Interfaces의 이름·인자·반환 그대로.
  - `verdictOf` 순서:
    1. `withdrawn.date ≤ checkedAt`이면 `withdrawn`
    2. 목표 `goal = reduced?.amount ?? target`, `reduced: !!promise.reduced`
    3. `fulfilled`이고 `meetsTarget(goal, fulfilled.amount)`이면 `achieved = achievedOn(fulfilled)`. `achieved ≤ deadline`이면 `kept`, 아니면 `late-kept`
    4. 3이 아니면 `deadline < checkedAt`이면 `late`, 아니면 `pending`
    - `deadline = deadlineEnd(promise.deadline)`이다. `postponed`는 판정에 쓰지 않는다.
    - `progress`는 3이 아니고 `promise.progress?.amount` 또는 기준에 못 미친 `fulfilled.amount`가 있으면 `{ done, of: goal }`으로 채운다.
  - `fmtAmount`의 MW는 기존 `fmtMw`(`src/data/format.js`)를 쓴다.
  - 날짜는 'YYYY-MM-DD' 문자열 비교로 충분하다 (사전순 = 날짜순).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/data/promises.test.js`
Expected: PASS (전부)

- [ ] **Step 5: 커밋**

```bash
git add src/data/promises.js src/data/promises.test.js
git commit -m "feat(statements): 약속 판정 계산 — 기한 끝·달성 기준·지켜짐/늦게 지켜짐/늦어짐/철회/기한 전·성적표"
```

---

### Task 2: 발언 데이터 파일 스키마·검사·빌드

**Files:**
- Create:
  - `src/data/statementsSchema.js`
  - `src/data/fixtures/statements.sample.json` — 화면 작업(Task 4·5)에 쓸 가짜 자료. 스키마에 맞아야 한다.
    - 사람 둘: "Sample Person A/B", 사진 주소는 일부러 없는 `/people/sample-a.jpg`·`/people/sample-b.jpg` (머리글자 대체를 보려고)
    - 다섯 판정이 한 번씩 나오게 한다.
    - 목표 줄임·미룸·진행 X/Y를 하나씩 넣는다.
    - 두 번 말한 약속 `p-sample-repeat`와 시작일 전 발언을 하나씩 넣는다.
    - 의견 발언을 둘 넣는다.
- Test: `src/data/statementsSchema.test.js`
- Modify:
  - `scripts/build-data.mjs` — `buildObservations` 옆에 `buildStatements`, 직접 실행 부분에 저장
  - `scripts/validate.mjs` — 관찰 검사 옆에 발언 검사

**Interfaces:**
- Consumes: Task 1의 `isCompanyUrl`, `deadlineEnd`
- Produces:
  - `StatementsFile` (zod)
  - `validateStatements(file): string[]` — 빈 배열이면 통과
  - `buildStatements(): StatementsFile | null` — 파일이 없으면 null
  - 데이터 모양 (아래 그대로):

```js
const Id = z.string().regex(/^[a-z0-9-]+$/), Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), Url = z.string().url()
const When = z.string().regex(/^(\d{4}(-(H[12]|Q[1-4]|(0[1-9]|1[0-2])(-\d{2})?))?|FY\d{4}(-(H[12]|Q[1-4]))?)$/)
const Amount = z.object({ value: z.number().positive(), unit: z.enum(['MW', 'GPUs', 'USDm']), qualifier: z.enum(['about', 'at_least', 'exact', 'up_to']) }).strict()
const Ref = { url: Url, published: Day }
const Person = z.object({ id: Id, name: z.string(), title_ko: z.string(), title_en: z.string(), photo: z.string().regex(/^\/people\/[a-z0-9-]+\.jpg$/), photo_source: Url, x: Url.optional() }).strict()
const Statement = z.object({ id: Id, person: Id, date: Day, channel: z.enum(['x', 'call', 'interview']),
  kind: z.enum(['sec', 'company', 'video', 'transcript', 'x', 'article']), url: Url, at: z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/).optional(),
  summary_ko: z.string(), summary_en: z.string(), quote: z.string().max(200).optional(), promise: Id.optional() }).strict()
const PromiseRec = z.object({ id: Id, topic: z.enum(['capacity', 'power', 'site', 'gpu', 'contract', 'revenue']), title_ko: z.string(), title_en: z.string(),
  deadline: When, target: Amount.optional(),
  reduced: z.object({ ...Ref, amount: Amount }).strict().optional(),
  postponed: z.array(z.object({ to: When, ...Ref }).strict()).optional(),
  withdrawn: z.object({ date: Day, url: Url, reason_ko: z.string(), reason_en: z.string() }).strict().optional(),
  fulfilled: z.object({ ...Ref, date: Day.optional(), period: When.optional(), amount: Amount.optional() }).strict().optional(),
  progress: z.object({ ...Ref, amount: Amount }).strict().optional(),
  milestone: Id.optional() }).strict()
export const StatementsFile = z.object({ checkedAt: Day, since: Day, since_source: Url, people: z.array(Person).min(1), statements: z.array(Statement), promises: z.array(PromiseRec) }).strict()
```

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/data/statementsSchema.test.js`
  - `sample()`을 만든다. 사람 1명, 발언 2건(약속 1건에 연결된 발언 + 의견 1건), 약속 1건(`fulfilled`, 회사 URL)이 든 올바른 파일을 돌려준다.
  - 아래 표대로 하나씩 망가뜨려 오류 문장에 들어갈 낱말을 확인한다.

```js
import fixture from './fixtures/statements.sample.json'
it('화면용 샘플 자료도 통과', () => expect(validateStatements(fixture)).toEqual([]))
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
])('%s', (_, breakIt, word) => { const f = sample(); breakIt(f); expect(validateStatements(f).join('\n')).toContain(word) })
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/data/statementsSchema.test.js` → FAIL (모듈 없음)

- [ ] **Step 3: `src/data/statementsSchema.js` 구현**
  - 위 스키마와 `validateStatements(file)`을 만든다. 스키마가 틀리면 앞 5개 문제만 문장으로 돌려준다 (`observationsSchema.js`와 같은 방식).
  - 내용 규칙(위 표의 13가지) 외에, id 중복(사람·발언·약속)과 `since ≤ checkedAt`도 검사한다.
  - '시작일 전' 규칙: `date < since`인 발언은 그 `promise`에 `date ≥ since`인 발언이 하나 더 있어야 한다.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/data/statementsSchema.test.js` → PASS

- [ ] **Step 5: 빌드·검사 연결**
  - `scripts/build-data.mjs`: `export function buildStatements()`를 둔다. `data/statements.json`이 없으면 null을 돌려주고, 있으면 `validateStatements`로 검사해 오류를 throw한다.
    - 직접 실행 부분에서 `public/data/statements.json`으로 저장한다.
    - 출력: `✅ statements.json — 사람 {n}명, 발언 {n}건, 약속 {n}건`
  - `scripts/validate.mjs`: `obsUrl` 검사 바로 아래에 같은 방식으로 `validateStatements` 오류를 `errors`에 더한다.
    - 같은 자리에서 `promise.milestone`이 `research.json`의 `milestones` id에 있는지도 검사한다 (없으면 `statements: 없는 일정 {id}`).
  - Run: `npm run data && npm run validate` → Expected: 지금은 파일이 없어 statements 줄 없이 ✅ (기존 출력 그대로)

- [ ] **Step 6: 커밋**

```bash
git add src/data/statementsSchema.js src/data/statementsSchema.test.js src/data/fixtures/statements.sample.json scripts/build-data.mjs scripts/validate.mjs
git commit -m "feat(statements): 발언 데이터 스키마·내용 규칙, 빌드가 public/data/statements.json 으로"
```

---

### Task 3: 본사 위치 · 상태 · 해시 · 지역 단추

**Files:**
- Modify:
  - `src/data/schema.js` — `Company`에 `hq`
  - `data/companies.json` — IREN에 `hq`
  - `src/store/hashState.js`, `src/store/useAppStore.js`, `src/map/mapData.js`
- Test: `src/store/hashState.test.js`, `src/store/useAppStore.test.js`, `src/map/mapData.test.js`, `src/data/schema.test.js`

**Interfaces:**
- Produces:
  - `Company.hq?: { city_ko: string, city_en: string, address: string, lat: number, lng: number, source: Url }` (strict) — 화면은 `data.companies[0].hq`로 읽는다
  - 저장소: `hqOpen: boolean`, `openHq(): void`, `closeHq(): void`
  - 해시: `parseHash('#hq=1').hq === true`, `buildHash({ hq: true })`
  - `REGION_NAMES.HQ = ['본사','HQ']` (맨 끝)
  - `hqLngLat(hq): [lng, lat]` — `[mapLongitude(hq.lng), hq.lat]`
  - `regionBounds(country, sites, research, hq): bounds | null` — 'HQ'면 null(호출한 쪽이 본사로 날아감). 'ALL'·'AU'는 사이트 범위에 본사 점을 더함. 'NA'는 US+CA, 그 밖은 그 나라 사이트만 (지금 GeoMap 안의 거르기 그대로)

- [ ] **Step 1: 본사 위치 확인 (조사)**
  - EDGAR에서 IREN 최신 10-K 표지의 "Address of principal executive offices"를 읽는다 (User-Agent 규칙 지킴).
  - 그 주소의 좌표는 내장 브라우저로 openstreetmap.org 검색 결과를 읽어 소수 4자리까지 정한다.
  - 적을 값: `address`(영문 그대로), `lat`, `lng`, `source`(10-K 주소), `city_ko: '시드니'`, `city_en: 'Sydney'`

- [ ] **Step 2: 실패하는 테스트 쓰기**

```js
// hashState.test.js
it('hq=1 → hq', () => { expect(parseHash('#hq=1')).toEqual({ hq: true }); expect(parseHash('#hq=0')).toEqual({}) })
it('hq 는 캠퍼스·페이지가 없을 때만 주소에', () => {
  expect(buildHash({ hq: true })).toBe('#hq=1')
  expect(buildHash({ hq: true, site: 'childress' })).toBe('#site=childress')
  expect(buildHash({ hq: true, page: 'stock' })).toBe('#page=stock')
})
// useAppStore.test.js (기존 beforeEach 그대로 — raw = buildInfra())
describe('본사 칸', () => {
  it('openHq: 캠퍼스 선택을 풀고 지도에서 칸을 엶 + 주소 #hq=1', () => {
    state().setRaw(raw); state().selectSite('childress'); state().openHq()
    expect(state()).toMatchObject({ hqOpen: true, view: 'globe', selectedSiteId: null, surface: 'map' })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#hq=1')
  })
  it.each([['selectSite', (s) => s.selectSite('childress')], ['focusSiteOnMap', (s) => s.focusSiteOnMap('childress')],
    ['enterSite3D', (s) => s.enterSite3D('childress')], ['setPage', (s) => s.setPage('stock')], ['closeHq', (s) => s.closeHq()]])(
    '%s 하면 본사 칸이 닫힘', (_, act) => { state().setRaw(raw); state().openHq(); act(state()); expect(state().hqOpen).toBe(false) })
  it("setMapRegion('HQ') 는 본사 칸을 엶", () => { state().setRaw(raw); state().setMapRegion('HQ'); expect(state()).toMatchObject({ hqOpen: true, mapRegion: { country: 'HQ' } }) })
  it('#hq=1 로 들어오면 데이터가 온 뒤 칸이 열림', () => { window.location.hash = '#hq=1'; state().setRaw(raw); expect(state().hqOpen).toBe(true) })
})
// mapData.test.js — const raw = buildInfra() (scripts/build-data.mjs), sites = raw.sites, research = raw.research, hq = raw.companies[0].hq (Step 1 값)
it('REGION_NAMES 끝에 본사', () => expect(Object.entries(REGION_NAMES).at(-1)).toEqual(['HQ', ['본사', 'HQ']]))
it('hqLngLat: 시드니는 이 지도에서 북미 왼쪽(번디와 같은 쪽)', () => {
  const [lng] = hqLngLat(hq); expect(lng).toBe(mapLongitude(hq.lng)); expect(lng).toBeLessThan(MAP_HOME_CENTER[0])
})
it("regionBounds: 'AU'·'ALL' 은 본사를 품고, 'HQ' 는 null, 'US' 는 본사 없이", () => {
  const au = regionBounds('AU', sites, research, hq)
  expect(au[1][0]).toBeGreaterThanOrEqual(hqLngLat(hq)[0]); expect(au[0][1]).toBeLessThanOrEqual(hq.lat)
  expect(regionBounds('HQ', sites, research, hq)).toBeNull()
  expect(regionBounds('US', sites, research, hq)).toEqual(boundsFor(sites.filter((s) => s.country === 'US'), research, { centerLng: MAP_HOME_CENTER[0] }))
})
// schema.test.js — base = data/companies.json 의 IREN 항목(hq 뺀 것)
it('Company.hq 는 정해진 칸만', () => {
  const hq = { city_ko: '시드니', city_en: 'Sydney', address: 'x', lat: -33.87, lng: 151.21, source: 'https://www.sec.gov/x' }
  expect(Company.safeParse({ ...base, hq }).success).toBe(true)
  expect(Company.safeParse({ ...base, hq: { ...hq, phone: '1' } }).success).toBe(false)
})
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/store src/map/mapData.test.js src/data/schema.test.js` → 새 테스트 FAIL

- [ ] **Step 4: 구현**
  - **스키마·데이터:** `schema.js`의 `Company`에 `hq` (optional, strict)를 넣고, `data/companies.json`의 IREN에 Step 1 값을 넣는다.
  - **해시:** `hashState.js`에 `hq`를 넣는다 (맨 위 설명 주석에도 한 줄).
  - **저장소 상태:** `useAppStore.js`
    - `hqOpen: initial.hq === true && !initial.site`
    - `openHq`: `set({ hqOpen: true, surface: 'map', view: 'globe', selectedSiteId: null, sheetOpen: false, hoverId: null, selectedBuildingId: null, buildingFly: null, selectedZoneKey: null })` 다음 `syncHash()`
    - `closeHq`: `set({ hqOpen: false })` 다음 `syncHash()`
  - **다른 동작과 맞추기:**
    - `selectSite`·`focusSiteOnMap`·`enterSite3D`·`setPage`에 `hqOpen: false`를 더한다.
    - `setMapRegion`은 `country === 'HQ'`면 마지막에 `get().openHq()`를 부른다.
    - `syncHash`의 `buildHash` 인자에 `hq: st.hqOpen`을 넣는다.
    - `applyHash`는 캠퍼스(`id`)가 없을 때 `hqOpen: !!h.hq`로 둔다.
  - **지도 데이터:** `mapData.js`에 `REGION_NAMES.HQ`, `hqLngLat`, `regionBounds`를 넣는다. 본사 점은 `boundsFor`와 같은 경도 펼침(`centerLng = MAP_HOME_CENTER[0]`)으로 더한다.

- [ ] **Step 5: 통과 확인** — `npx vitest run` → 전부 PASS (기존 테스트 포함). `npm run validate` → ✅

- [ ] **Step 6: 커밋**

```bash
git add src/data/schema.js src/data/schema.test.js data/companies.json src/store/hashState.js src/store/hashState.test.js src/store/useAppStore.js src/store/useAppStore.test.js src/map/mapData.js src/map/mapData.test.js
git commit -m "feat(statements): 본사 위치(10-K 주소)·hqOpen 상태·#hq=1·'본사' 지역 단추 범위"
```

---

### Task 4: 지도 위 본사 카드

**Files:**
- Create:
  - `src/data/loadStatements.js` (+ `src/data/loadStatements.test.js`)
  - `src/map/HqMarker.jsx`
- Modify:
  - `src/map/GeoMap.jsx`
  - `src/data/format.js` (+ `src/data/format.test.js`)
  - `src/styles/global.css` (`.map-campus-card.is-hq` 몇 줄)
  - `src/i18n/ko.js`, `src/i18n/en.js` (`hq` 묶음 시작)

**Interfaces:**
- Consumes: Task 3 `hqOpen`·`openHq`·`hqLngLat`·`regionBounds`·`REGION_NAMES.HQ`. Task 1 `recentCount`
- Produces:
  - `loadStatements(): Promise<StatementsFile | null>` — 처음 부를 때만 `fetch('/data/statements.json', { cache: 'no-cache' })`. 실패·404면 null. 같은 Promise를 다시 돌려준다.
  - `peekStatements(): StatementsFile | null` — 이미 받은 값
  - `initialsOf(name: string): string` — 'Daniel Roberts' → 'DR', 'Will' → 'W'
  - i18n `hq.title`('IREN 본사'), `hq.sub`('시드니 · 공동 CEO {n}명'), `hq.newCount`('발언 {n}'), `hq.open`('경영진 발언 보기'). 영어도 같은 키로 넣는다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

```js
// format.test.js
it.each([['Daniel Roberts', 'DR'], ['Will', 'W'], ['  ', '']])('initialsOf(%s) = %s', (n, w) => expect(initialsOf(n)).toBe(w))
// loadStatements.test.js — vi.resetModules() 후 import 해 매번 새 캐시
it('loadStatements 는 실패하면 null (오프라인·404)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  expect(await (await import('./loadStatements.js')).loadStatements()).toBeNull()
})
it('loadStatements 는 한 번만 받음', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkedAt: '2026-10-21' }) }); vi.stubGlobal('fetch', f)
  const m = await import('./loadStatements.js'); await m.loadStatements(); await m.loadStatements()
  expect(f).toHaveBeenCalledTimes(1); expect(m.peekStatements()).toEqual({ checkedAt: '2026-10-21' })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/data/format.test.js src/data/loadStatements.test.js` → FAIL

- [ ] **Step 3: 구현**
  - **`initialsOf`·`loadStatements`:** 이름·동작은 Interfaces 그대로. `loadStatements`는 `SiteFacts.jsx`의 `load()`와 같은 방식이다.
  - **`HqMarker.jsx`:** `export default function HqMarker({ map, hq, lang, open })`
    - maplibre `Marker({ element, anchor: 'bottom' })`를 `hqLngLat(hq)`에 한 번 만들고, 카드를 `createPortal`로 그린다 (`CampusMarkers.jsx`와 같은 방식).
    - 카드 버튼: `className="map-campus-card is-hq"`, 열려 있으면 `is-selected`. `aria-pressed={open}`, `aria-label`·`title`은 `hq.open`. 누르면 `useAppStore.getState().openHq()`.
    - 카드 안:
      - 아이콘 칸 lucide `Building2`
      - `<b>`에 `hq.title`, 둘째 줄에 `hq.sub`(n = 사람 수, 데이터 전에는 2)
      - 사람마다 사진 동그라미 `<img src={photo} alt={name} loading="lazy">`. `onError`면 `initialsOf(name)` 글자 동그라미로 바꾼다. 데이터 전에는 빈 동그라미.
      - `recentCount(statements, 오늘 'YYYY-MM-DD') > 0`일 때만 초록 배지 `hq.newCount`
    - 데이터는 카드가 화면에 들어올 때(`moveend`에서 `map.getBounds().contains(hqLngLat(hq))`) 또는 `open`일 때 `loadStatements()`로 받는다.
  - **`GeoMap.jsx`:**
    - `loaded && hq`면 `<HqMarker map hq={data.companies[0]?.hq} lang open={hqOpen}/>`를 `CampusMarkers` 옆에 그린다.
    - 지역 효과에서 거르기 + `boundsFor` 대신 `regionBounds(region.country, data.sites, data.raw.research, hq)`를 쓴다.
    - 'HQ'면 `flyTo({ center: hqLngLat(hq), zoom: 9, padding: padding() })`를 하고, 움직임 줄이기 설정이면 duration 0이다.
  - **CSS:** `global.css`의 `.map-campus-card` 바로 아래에 `.is-hq`의 사진 동그라미(26px, 흰 테두리 2px, 둘째부터 margin-left −8px)와 배지(#71DA80 바탕, #0B344F 글자)만 더한다.

- [ ] **Step 4: 통과 확인** — `npx vitest run` → 전부 PASS. `npm run build` → 세 예산 ✅

- [ ] **Step 5: 화면 확인 (헤드리스)**
  - 아직 실제 데이터가 없으니 Task 2의 `src/data/fixtures/statements.sample.json`을 `public/data/statements.json`으로 임시 복사한다 (커밋 금지 — 끝나면 지움).
  - `npm run build && npm run preview` 뒤, anatomy 스킬의 `drive.mjs`(`CHROME_PATH` 지정)로 `http://localhost:4174/`를 연다. 부팅 화면은 `[data-boot-go]` 누름.
  - 확인 1: 지역 단추 '본사'를 누르면 `.map-campus-card.is-hq`가 보이고 `aria-pressed="true"`
  - 확인 2: 배지는 샘플의 최근 30일 발언 수와 같다
  - 확인 3: 사진 주소를 일부러 틀리게 한 샘플로 머리글자 동그라미가 나온다
  - 확인 4: 375×812에서 `document.documentElement.scrollWidth - clientWidth === 0`
  - 확인 5: 콘솔 오류 없음

- [ ] **Step 6: 커밋** — 임시 복사본 `public/data/statements.json`은 빼고 올린다

```bash
git add src/data/loadStatements.js src/data/loadStatements.test.js src/data/format.js src/data/format.test.js src/map/HqMarker.jsx src/map/GeoMap.jsx src/styles/global.css src/i18n/ko.js src/i18n/en.js
git commit -m "feat(statements): 지도 위 시드니 본사 카드 — CEO 사진·최근 30일 발언 수, '본사' 단추로 이동"
```

---

### Task 5: 경영진 발언 칸

**Files:**
- Create:
  - `src/data/statementRows.js` (+ `src/data/statementRows.test.js`)
  - `src/ui/StatementsPanel.jsx`, `src/ui/statements.css`
- 샘플 자료는 Task 2의 `src/data/fixtures/statements.sample.json`을 쓴다.
- Modify: `src/App.jsx`, `src/i18n/ko.js`, `src/i18n/en.js`

**Interfaces:**
- Consumes: Task 1 `verdictOf`·`scoreboard`·`fmtAmount`·`evidenceLabel`. Task 3 `hqOpen`·`closeHq`. Task 4 `loadStatements`·`peekStatements`·`initialsOf`
- Produces:
  - `statementRows(file, filter: 'all'|'promises'|'x'|'call'|'interview'): Row[]`
  - `Row = { id, date, person, channel, kind, url, at?, summary_ko, summary_en, quote?, promise?: PromiseRec, verdict?: Verdict, repeatOf?: string /* 같은 약속을 처음 말한 날 */, beforeSince: boolean }`
  - 정렬은 날짜 최신순이다.
- i18n `hq` 묶음에 더할 키 (한국어 값 그대로, 영어는 자연스러운 같은 뜻):
  - `panelLabel` 'IREN / 본사 · 시드니', `panelTitle` '경영진 발언', `close` '닫기'
  - `promisesCount` '기한을 밝힌 약속 {n}건', `keptOnTime` '기한 안에 지켜짐 {a}/{b}', `checkedAt` '{date} 확인 기준'
  - `status.kept` '지켜짐', `status.late-kept` '늦게 지켜짐', `status.late` '늦어짐', `status.withdrawn` '철회', `status.pending` '기한 전'
  - `reducedTag` '목표 줄임', `reducedInLegend` '그중 목표 줄임 {n}', `opinion` '약속 아님 (의견)'
  - `repeat` '다시 언급 · 처음 {date}', `beforeSince` '처음 약속 (시작일 전)'
  - `chips` 전체 / 약속만 / X / 실적 발표 / 인터뷰
  - `source` '원문', `loadError` '발언 자료를 불러오지 못했습니다', `disclaimer` (Global Constraints 문구 그대로)

- [ ] **Step 1: 실패하는 테스트 쓰기**

```js
import file from './fixtures/statements.sample.json'
it('최신순', () => { const d = statementRows(file, 'all').map((r) => r.date); expect(d).toEqual([...d].sort().reverse()) })
it("'약속만' 은 약속에 걸린 발언만, 'x' 는 X 만", () => {
  expect(statementRows(file, 'promises').every((r) => r.promise)).toBe(true)
  expect(statementRows(file, 'x').every((r) => r.channel === 'x')).toBe(true)
})
it('같은 약속의 뒤 발언은 repeatOf = 처음 날짜, 처음 발언에는 없음', () => {
  const rows = statementRows(file, 'all').filter((r) => r.promise?.id === 'p-sample-repeat')
  const first = rows.at(-1), later = rows[0]
  expect(first.repeatOf).toBeUndefined(); expect(later.repeatOf).toBe(first.date)
})
it('시작일 전 발언은 beforeSince', () => expect(statementRows(file, 'all').filter((r) => r.date < file.since).every((r) => r.beforeSince)).toBe(true))
it('판정은 checkedAt 기준으로 붙음', () => {
  const r = statementRows(file, 'promises')[0]; expect(r.verdict).toEqual(verdictOf(r.promise, file.checkedAt))
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/data/statementRows.test.js` → FAIL (모듈 없음)

- [ ] **Step 3: `statementRows` 구현** — Interfaces 그대로. 판정은 `verdictOf(promise, file.checkedAt)`.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/data/statementRows.test.js` → PASS

- [ ] **Step 5: 칸 그리기 (`StatementsPanel.jsx`·`statements.css`·`App.jsx`)**
  - **붙이는 곳:** `App.jsx`에 `const StatementsPanel = lazy(() => import('./ui/StatementsPanel.jsx'))`를 두고, `.middle`의 `spacer` 다음에 `{data && surface === 'map' && hqOpen && view !== 'site' && <Suspense fallback={null}><StatementsPanel /></Suspense>}`를 넣는다.
  - **겉 상자:** `<aside className="site-panel panel campus-panel statements-panel">` — 캠퍼스 칸의 휴대폰 아래 시트 배치를 그대로 받는다. 머리는 `campus-heading` 구조 + 닫기 X(`closeHq`)다. 끌기 손잡이는 이번에 넣지 않는다.
  - **위에서 아래로:** spec 5-2와 시안 `mockup-statements-panel.html` 순서다.
    1. 사람 둘 (사진, 실패하면 머리글자). 그 아래 작은 링크 "사진: IREN 홈페이지"(`photo_source`) — spec 4장 "사진은 출처를 표시한다"
    2. 성적표
       - `promisesCount`와 막대 다섯 칸. 칸 비율은 `scoreboard` 값, 순서는 지켜짐·늦게 지켜짐·늦어짐·철회·기한 전, 색은 Global Constraints
       - 범례 + `reducedInLegend`, `keptOnTime`(a = kept, b = due), `checkedAt`(ko 'M월 D일', en 'Mon D')
    3. 거르기 단추 다섯 개 (로컬 state, 기본 전체)
    4. 행 목록
       - 위 줄: 채널(X는 글자 "X", 실적 발표 lucide `Mic`, 인터뷰 `Newspaper`) · 이름 · 날짜
       - 요약 (언어별), `quote`가 있으면 따옴표로
       - 배지와 근거 한 줄. 아래 문구에서 `ym`은 'YYYY-MM'이다.
         - kept: `{ym(achieved)} {evidenceLabel(fulfilled.url)}로 확인`
         - late-kept: `기한 {ym(deadline)} → {ym(achieved)} 확인`
         - late: `기한 지남, 아직 확인 안 됨`, `progress`가 있으면 ` · 진행 {fmtAmount(done)} / {fmtAmount(of)}`
         - withdrawn: `{ym(withdrawn.date)} · {reason}`
         - pending: `{ym(deadline)} 까지`
       - 목표 줄임 줄: `원래 목표 <s>{fmtAmount(target)}</s> → {fmtAmount(reduced.amount)}` + (이뤘으면 ` 로 줄여서 이룸`, 아니면 ` 로 줄임`) + ` · {evidenceLabel(reduced.url)}`
       - 미룸 줄: `회사가 {마지막 postponed.to} 로 미룸`
       - 이룬 시점이 `period`나 발표일에서 나왔으면: `이룬 시점: 회사가 '{period}'로만 밝힘` / `이룬 시점: 발표일 기준`
       - 약속 없는 발언은 `opinion`. `repeatOf`면 `repeat`, `beforeSince`면 `beforeSince` 글자
       - 원문 링크 (`at`이 있으면 ` · {at}`)
    5. 안내 문구
  - **데이터를 못 받으면:** `loadStatements()`가 null이면 칸에 `loadError`만 보여 준다.
  - **CSS:** `statements.css`는 칸 파일에서만 import한다 (첫 화면 CSS에 안 들어가게). 판정 색은 CSS 변수 `--v-kept` 등 다섯 개로 둔다.

- [ ] **Step 6: 확인** — `npx vitest run` 전부 PASS, `npm run build` 세 예산 ✅ (HTML UI가 120을 넘으면 칸·CSS가 첫 화면에 섞인 것이니 import를 다시 본다).
  - 헤드리스: 샘플을 `public/data/statements.json`에 임시 복사하고 `#hq=1`로 연다.
    - 칸 보임, 성적표 문구에 "기한을 밝힌 약속"·"확인 기준"
    - 거르기 다섯 개, 행 수 = 샘플 발언 수
    - 안내 문구 그대로
    - 닫기 → 해시 빈 값
    - 390×844: 아래 시트로 열리고 닫힘
    - 영어 전환 후 한국어가 남지 않음
    - 샘플 파일을 지운 상태에서 `#hq=1` → `loadError` 문구, 콘솔 오류 없음

- [ ] **Step 7: 커밋** — 임시 복사본은 지우고 올린다

```bash
git add src/data/statementRows.js src/data/statementRows.test.js src/data/fixtures/statements.sample.json src/ui/StatementsPanel.jsx src/ui/statements.css src/App.jsx src/i18n/ko.js src/i18n/en.js
git commit -m "feat(statements): 경영진 발언 칸 — 약속 성적표·거르기·판정 배지·목표 줄임·철회 (지연 로딩)"
```

---

### Task 6: 실제 자료 조사 · 사용자 검토 (공개 전 관문)

**Files:**
- Create:
  - `data/statements.json`
  - `public/people/<id>.jpg` (사람마다)
  - `docs/superpowers/specs/2026-10-21-ceo-statements/review.md` (검토표)
- Modify: `data/changelog.json`

**Interfaces:**
- Consumes: Task 2 스키마(데이터 모양), Task 1 `verdictOf`(검토표의 판정 열)

- [ ] **Step 1: 시작일 문서 확인**
  - EDGAR에서 2023-08-29 IREN 6-K를 연다. H100·생성형 AI 문장이 있는지 확인한다.
  - 날짜가 맞으면 `since: '2023-08-29'`, `since_source`에 그 문서 주소를 적는다. 날짜가 다르면 멈추고 사용자에게 알린다.

- [ ] **Step 2: 사람 확인**
  - IREN 홈페이지 경영진 페이지와 최신 10-K로 두 공동 CEO의 이름·직함(한/영)·본인 X 계정 주소를 확인한다.
  - 사진 원본 주소를 찾아 파일 이름(`public/people/<id>.jpg`)·출처·크기를 말하고 **사용자 허락을 받은 뒤** 내려받는다.
  - `sips -Z 160`으로 줄인다. `photo_source`에 원본 페이지 주소를 적는다.

- [ ] **Step 3: 발언 모으기 (2023-08-29 ~ 오늘)**
  - 회계연도별로 나눠 조사 서브에이전트에 맡겨도 된다. 각자 아래 모양의 줄을 돌려받는다.
  - **실적 발표 콜 (약 13번):**
    - SEC 녹취록이 있으면 그것을 쓴다 (`kind: 'sec'`, 2026-05-11 8-K Q3 FY26).
    - 없으면 대담·콜 영상(`kind: 'video'` + `at`, 자막으로 말 확인) → 공개 녹취록(`kind: 'transcript'`) 순서다.
    - 기한과 대상이 분명한 AI·데이터센터 약속만 `promises`로 만든다.
  - **X:** 두 사람 계정을 읽기만 한다. 약속 문장은 모두 넣고, 의견은 최근 90일에서 눈에 띄는 것만 넣는다.
  - **인터뷰·기사:** 원문 링크가 있는 것만 넣는다.
  - 같은 약속을 다시 말했으면 같은 `promise` id를 건다.
  - 시작일 전에 처음 한 약속이면 그 처음 발언도 넣는다.

- [ ] **Step 4: 결과 근거 붙이기**
  - 약속마다 회사 자료(호스트 규칙)로 `fulfilled`·`reduced`·`postponed`·`withdrawn`·`progress`를 찾아 적는다.
  - `research.json`의 같은 건물 일정(milestones)과 같은 약속이면 `milestone`에 그 id를 적는다.
  - `checkedAt`은 마지막으로 확인한 날로 둔다.

- [ ] **Step 5: 검사** — `npm run data && npm run validate`
  - Expected: `✅ statements.json — 사람 2명, 발언 {n}건, 약속 {m}건`, 오류 0

- [ ] **Step 6: 검토표 만들고 사용자에게 보이기**
  - `review.md`에 두 표를 만든다.
    - (1) 약속 표: id · 처음 말한 날·사람·채널 · 한국어 요약 · 기한 · 목표 · `verdictOf` 판정 · 근거 링크
    - (2) 의견 발언 표
  - 사용자에게 보이고 고칠 점을 반영한다. **승인 문장을 받기 전에는 Task 7로 가지 않는다.**

- [ ] **Step 7: 커밋** (승인 뒤)
  - `data/changelog.json` 맨 위 날짜에 한 줄을 넣는다: 한 "지도에 시드니 본사 카드와 경영진 발언·약속 장부 추가 (2023-08-29 AI 전환 뒤, 판정 5가지 · 회사 자료로 확인)" / 영 같은 뜻.

```bash
git add data/statements.json public/people docs/superpowers/specs/2026-10-21-ceo-statements/review.md data/changelog.json
git commit -m "data(statements): 공동 CEO 발언·약속 첫 자료 (사용자 검토 승인) + 사진(출처 표시)"
```

---

### Task 7: 마무리 · 합치기 · 배포 확인

**Files:**
- Modify: `README.md` (기능 소개 한 단락 + "발언 자료 갱신 방법": 실적 발표 뒤 / 요청 시, Task 6 절차 요약)

- [ ] **Step 1: README 단락 쓰고 커밋**

```bash
git add README.md
git commit -m "docs: 경영진 발언·약속 장부 설명과 자료 갱신 방법"
```

- [ ] **Step 2: 최신 main 위로 옮기기** — `git fetch -q && git rebase origin/main`
  - 충돌이 나면 다른 세션이 그사이 커밋한 것이다. 그쪽 변경을 살리며 푼다 (특히 `App.jsx`·`useAppStore.js`·`global.css`·`TopBar`).

- [ ] **Step 3: 전체 확인**
  - `npx vitest run` → 전부 PASS
  - `npm run build` → 세 예산 ✅
  - 헤드리스(실제 자료):
    - 1440×900 한/영에서 '본사' 단추 → 카드 → 칸, 성적표 수가 `scoreboard` 결과와 같음
    - 375×812에서 가로 넘침 0
    - 콘솔 오류 없음

- [ ] **Step 4: 합치고 푸시**
  - main으로 fast-forward 한다. 작업 폴더가 따로라 원래 폴더의 다른 세션 작업은 건드리지 않는다. 방법은 둘 중 하나다:
    - `git push -q origin feat/ceo-statements:main` (먼저 `git merge-base --is-ancestor origin/main HEAD` 확인)
    - 또는 PR
  - Vercel 배포 뒤 `https://iren-3d.vercel.app/#hq=1`을 헤드리스로 열어 칸·성적표가 보이는지 확인한다.

- [ ] **Step 5: 정리**
  - 작업 폴더를 지운다 (superpowers:finishing-a-development-branch).
  - 프로젝트 메모리(`iren-3d-project.md`)에 한 줄 남긴다: 파일 위치, 판정 규칙, 갱신 방법.
