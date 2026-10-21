// =============================================================
// hq.js — 본사 카드 · 경영진 발언 칸 · ≡ 메뉴 바로가기 문구 (한국어 / 영어)
// -------------------------------------------------------------
// ko.js·en.js 와 따로 둔 이유: 이 문구를 쓰는 곳(지도 본사 카드·경영진 발언 칸·≡ 메뉴)이 모두 나중에 불러오는 묶음이라,
//   첫 화면 사전(ko.js·en.js — 첫 화면 번들 120 KiB 한도 안)에 넣으면 쓰지도 않는 글자가 첫 화면에 실림
// 쓰는 법: hqText[lang] (lang = 'ko' | 'en'). {이름} 자리는 코드가 채움. 두 언어 키는 hq.test.js 가 같은지 검사
// =============================================================
export const hqText = {
  ko: {
    // 지도 위 시드니 본사 카드 (HqMarker)
    title: 'IREN 본사', sub: '{city} · 경영진 발언 {n}건', newCount: '발언 {n}', open: '본사 건물 · 경영진 발언 보기 (3D)',
    // 본사 3D 화면 (빌딩 옆 'IREN · 5층' 표시 · 카드의 건물 설명)
    towerFloor: 'IREN · {level}층',
    modelNote: '건물은 단순화한 모형 · {floors}층(건물 소유사 Mirvac) · IREN {level}층(10-K 주소)', buildingSource: '건물 자료',
    // 옥상 위 CEO 카드 · 말풍선 (HqParts) — 누르면 가운데 카드 (StatementsCard)
    badgeOpen: '{name}의 발언 보기', statementsN: '발언 {n}', bubbleAll: '전체 {n}건', bubbleOpen: '이 발언 자세히 (카드)',
    prev: '이전 발언', next: '다음 발언', signOpen: '약속만 모아 보기', scoreLine: '약속 {n}건 · 기한 안에 지켜짐 {a}/{b}',
    silentNote: '{names}: 2023-08-29 이후 이름이 붙은 발언을 찾지 못해 화면에서 뺐어요 (찾으면 다시 나타남)',
    personTitle: '{name}의 발언', noStatements: '2023-08-29 AI 전환 뒤 회사 보도자료·실적 발표 콜·X 에서 {name} 이름이 붙은 발언을 찾지 못했어요.',
    // ≡ 메뉴 바로가기 (AppMenu)
    menuEntry: '경영진 발언', menuSub: '공동 CEO 발언 · 약속 지켜졌나',
    // 경영진 발언 카드 (StatementsCard)
    panelLabel: 'IREN / 본사 · {city}', panelTitle: '경영진 발언', close: '닫기', photoSource: '사진: IREN 홈페이지',
    promisesCount: '기한을 밝힌 약속 {n}건', keptOnTime: '기한 안에 지켜짐 {a}/{b}', checkedAt: '{date} 확인 기준',
    status: { kept: '지켜짐', 'late-kept': '늦게 지켜짐', late: '늦어짐', withdrawn: '철회', pending: '기한 전' },
    reducedTag: '목표 줄임', reducedInLegend: '그중 목표 줄임 {n}', opinion: '약속 아님 (의견)',
    repeat: '다시 언급 · 처음 {date}', beforeSince: '처음 약속 (시작일 전)', sameQuote: '위와 같은 문장 (약속이 하나 더 들어 있음)',
    chips: { all: '전체', promises: '약속만', x: 'X', call: '실적 발표', interview: '인터뷰', release: '보도자료' },
    // 판정 옆 근거 한 줄 ({ym} = YYYY-MM)
    detail: {
      kept: '{ym} {ev}로 확인', lateKept: '기한 {due} → {ym} 확인', late: '기한 지남, 아직 확인 안 됨', progress: '진행 {done} / {of}',
      pending: '{due} 까지', reduced: '원래 목표', reducedDone: '로 줄여서 이룸', reducedOnly: '로 줄임',
      postponed: '회사가 {to} 로 미룸', periodOnly: "이룬 시점: 회사가 '{period}'로만 밝힘", publishedOnly: '이룬 시점: 발표일 기준',
    },
    source: '원문', loading: '불러오는 중…', loadError: '발언 자료를 불러오지 못했습니다',
    disclaimer: "요약은 이 사이트가 원문을 보고 정리한 것 · '지켜짐'은 회사 보도자료·SEC 공시로 확인됐을 때만 · 비공식 · 투자 조언 아님",
  },
  en: {
    title: 'IREN HQ', sub: '{city} · {n} management statements', newCount: '{n} new', open: 'See the HQ building and management statements (3D)',
    towerFloor: 'IREN · Level {level}',
    modelNote: 'Simplified model · {floors} storeys (building owner Mirvac) · IREN on Level {level} (10-K address)', buildingSource: 'Building data',
    badgeOpen: 'See statements by {name}', statementsN: '{n} statements', bubbleAll: 'All {n}', bubbleOpen: 'Open this statement (card)',
    prev: 'Previous statement', next: 'Next statement', signOpen: 'See promises only', scoreLine: '{n} promises · kept on time {a}/{b}',
    silentNote: '{names}: no attributed statements found since 2023-08-29, so not shown (will reappear if found)',
    personTitle: 'Statements by {name}', noStatements: 'Since the 2023-08-29 AI pivot we found no statements attributed to {name} in company releases, earnings calls or on X.',
    menuEntry: 'Management statements', menuSub: 'What the co-CEOs said · promises kept?',
    panelLabel: 'IREN / HQ · {city}', panelTitle: 'Management statements', close: 'Close', photoSource: 'Photos: IREN website',
    promisesCount: '{n} promises with a deadline', keptOnTime: 'Kept on time {a}/{b}', checkedAt: 'As checked on {date}',
    status: { kept: 'Kept', 'late-kept': 'Kept late', late: 'Late', withdrawn: 'Withdrawn', pending: 'Not yet due' },
    reducedTag: 'Target cut', reducedInLegend: 'incl. {n} with target cut', opinion: 'Not a promise (opinion)',
    repeat: 'Repeated · first said {date}', beforeSince: 'First promised (before start date)', sameQuote: 'Same sentence as above (it holds another promise)',
    chips: { all: 'All', promises: 'Promises', x: 'X', call: 'Earnings calls', interview: 'Interviews', release: 'Press releases' },
    detail: {
      kept: 'Confirmed {ym} in a {ev}', lateKept: 'Due {due} → confirmed {ym}', late: 'Past due, not yet confirmed', progress: 'progress {done} / {of}',
      pending: 'Due {due}', reduced: 'Original target', reducedDone: 'cut and met', reducedOnly: 'cut',
      postponed: 'Company moved it to {to}', periodOnly: "Timing: company only said '{period}'", publishedOnly: 'Timing: release date',
    },
    source: 'Source', loading: 'Loading…', loadError: 'Could not load the statements',
    disclaimer: "Summaries written by this site from the originals · 'Kept' only when confirmed by company releases or SEC filings · Unofficial · Not investment advice",
  },
}
