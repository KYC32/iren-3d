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
    towerFloor: 'IREN · {level}층', floorTitle: 'IREN 공시 주소의 층 · 층 전체를 쓰는지는 공시에 없음',
    modelNote: '건물·길 모양은 OpenStreetMap 윤곽·층수로 만든 모형(층수가 없는 건물은 어림값) · 본사 {floors}층(건물 소유사 Mirvac) · IREN {level}층은 공시 주소 기준이며 층 전체를 쓰는지는 공시에 없음', buildingSource: '건물 자료',
    movedNote: '{date} 분기 보고서부터 {level}층 주소 (그 전 보고서엔 {from}층)', filingSource: '공시',
    // 옥상 위 CEO 카드 · 말풍선 (HqParts) — 누르면 가운데 카드 (StatementsCard)
    badgeOpen: '{name}의 약속·발언 보기', statementsN: '발언 {n}', bubbleAll: '약속·발언 보기', bubbleOpen: '약속·발언 카드 열기',
    prev: '이전 발언', next: '다음 발언', signOpen: '약속 타임라인 보기', scoreLine: '약속 {n}건 · 기한 안에 지켜짐 {a}/{b}',
    scoreCount: '약속 {n}건', scoreKept: '기한 안에 지켜짐 {a}/{b}', // 성적표 글자를 두 조각으로 (휴대폰 가로 카드는 두 줄)
    silentNote: '{names}: 2023-08-29 이후 이름이 붙은 발언을 찾지 못해 화면에서 뺐어요 (찾으면 다시 나타남)',
    personTitle: '{name}의 발언', noStatements: '2023-08-29 AI 전환 뒤 회사 보도자료·실적 발표 콜·X에서 {name} 이름이 붙은 발언을 찾지 못했어요.',
    // ≡ 메뉴 바로가기 (AppMenu) — 경영진 발언(본사 화면) · CEO 약속 타임라인(본사 화면 + 약속 탭)
    menuEntry: '경영진 발언', menuSub: '공동 CEO 발언 · 약속 지켜졌나',
    menuPromises: 'CEO 약속 타임라인', menuPromisesSub: '말한 날 → 기한 → 이룬 날을 한눈에',
    // 카드 탭 (StatementsCard)
    tabs: { promises: '약속 {n}', statements: '발언 {n}' },
    // 약속 탭 = 타임라인 (PromiseTimeline) — {ym} YYYY-MM · {span} '7개월'·'8일' · {md} 'M/D'
    tl: {
      all: '전체 {n}', decided: '결과가 나온 약속', pendingGroup: '기한 {due} · {left} 남음',
      kept: '{ym} 이룸', lateKept: '{span} 늦게 이룸', late: '기한 지나 {span}', withdrawn: '{ym} 철회', pending: '기한 {ym}',
      said: '처음 말함 {date} · 언급 {n}번', due: '기한 {date}', achieved: '이룸 {date}', overdue: '기한 지나 {span} · 아직 확인 안 됨',
      withdrawnOn: '철회 {date}', left: '{span} 남음', postponed: '회사가 기한을 미룬 날 {dates}', lateBy: '기한보다 {span} 늦게',
      today: '{md} 확인', mentions: '이 약속을 말한 발언 {n}건',
      legend: { promised: '말한 날 → 기한', deadline: '기한', achieved: '이룬 날', late: '기한이 지난 뒤', postponed: '회사가 기한을 미룬 날', mention: '다시 말한 날', today: '확인 기준일' },
      chartLabel: '약속 타임라인 — 막대는 처음 말한 날부터 기한까지, 점은 이룬 날',
    },
    // 발언 탭 (달별 묶음)
    fd: { count: '{n}건', quote: '영어 원문', repeat: '다시 언급', personOnly: '{name} 발언만', showAll: '모두 보기' },
    // 경영진 발언 카드 (StatementsCard)
    panelLabel: 'IREN / 본사 · {city}', panelTitle: '경영진 발언', close: '닫기', photoSource: '사진: IREN 홈페이지',
    promisesCount: '기한을 밝힌 약속 {n}건', keptOnTime: '기한 안에 지켜짐 {a}/{b}', checkedAt: '{date} 확인 기준',
    status: { kept: '지켜짐', 'late-kept': '늦게 지켜짐', late: '늦어짐', withdrawn: '철회', pending: '기한 전' },
    reducedTag: '목표 줄임', reducedInLegend: '그중 목표 줄임 {n}', opinion: '약속 아님 (의견)',
    beforeSince: '처음 약속 (시작일 전)',
    chips: { all: '전체', promises: '약속만', x: 'X', call: '실적 발표', interview: '인터뷰', release: '보도자료' },
    // 판정 옆 근거 한 줄 ({ym} = YYYY-MM)
    detail: {
      kept: '{ym} {ev}로 확인', lateKept: '기한 {due} → {ym} 확인', late: '기한 지남, 아직 확인 안 됨', progress: '진행 {done} / {of}',
      pending: '{due}까지', reduced: '원래 목표', reducedDone: '로 줄여서 이룸', reducedOnly: '로 줄임',
      postponed: '회사가 {to}로 미룸', periodOnly: "이룬 시점: 회사가 '{period}'로만 밝힘", publishedOnly: '이룬 시점: 발표일 기준',
    },
    source: '원문', loading: '불러오는 중…', loadError: '발언 자료를 불러오지 못했습니다',
    disclaimer: "요약은 이 사이트가 원문을 보고 정리한 것 · '지켜짐'은 회사 보도자료·SEC 공시로 확인됐을 때만 · 비공식 · 투자 조언 아님",
  },
  en: {
    title: 'IREN HQ', sub: '{city} · {n} management statements', newCount: '{n} new', open: 'See the HQ building and management statements (3D)',
    towerFloor: 'IREN · Level {level}', floorTitle: "Floor in IREN's filing address · filings do not say whether it uses the whole floor",
    modelNote: "Buildings and streets are modelled from OpenStreetMap outlines and storey counts (estimated where missing) · HQ {floors} storeys (building owner Mirvac) · IREN on Level {level} per its filing address — filings do not say whether it uses the whole floor", buildingSource: 'Building data',
    movedNote: 'Address shows Level {level} from the {date} quarterly report (Level {from} before)', filingSource: 'Filing',
    badgeOpen: 'See promises and statements by {name}', statementsN: '{n} statements', bubbleAll: 'Promises & statements', bubbleOpen: 'Open the promises and statements card',
    prev: 'Previous statement', next: 'Next statement', signOpen: 'See the promise timeline', scoreLine: '{n} promises · kept on time {a}/{b}',
    scoreCount: '{n} promises', scoreKept: 'kept on time {a}/{b}',
    silentNote: '{names}: no attributed statements found since 2023-08-29, so not shown (will reappear if found)',
    personTitle: 'Statements by {name}', noStatements: 'Since the 2023-08-29 AI pivot we found no statements attributed to {name} in company releases, earnings calls or on X.',
    menuEntry: 'Management statements', menuSub: 'What the co-CEOs said · promises kept?',
    menuPromises: 'CEO promise timeline', menuPromisesSub: 'Said → due → met, at a glance',
    tabs: { promises: 'Promises {n}', statements: 'Statements {n}' },
    tl: {
      all: 'All {n}', decided: 'Promises with a result', pendingGroup: 'Due {due} · {left} left',
      kept: 'Met {ym}', lateKept: 'Met {span} late', late: '{span} past due', withdrawn: 'Withdrawn {ym}', pending: 'Due {ym}',
      said: 'First said {date} · mentions: {n}', due: 'Due {date}', achieved: 'Met {date}', overdue: '{span} past due · not yet confirmed',
      withdrawnOn: 'Withdrawn {date}', left: '{span} left', postponed: 'Company moved the deadline on {dates}', lateBy: '{span} after the deadline',
      today: 'checked {md}', mentions: 'Statements with this promise ({n})',
      legend: { promised: 'Said → due', deadline: 'Deadline', achieved: 'Met', late: 'Past the deadline', postponed: 'Company moved the deadline', mention: 'Said again', today: 'Check date' },
      chartLabel: 'Promise timeline — bars run from when it was first said to the deadline, dots mark when it was met',
    },
    fd: { count: '{n}', quote: 'Original (English)', repeat: 'Repeated', personOnly: 'Only {name}', showAll: 'Show all' },
    panelLabel: 'IREN / HQ · {city}', panelTitle: 'Management statements', close: 'Close', photoSource: 'Photos: IREN website',
    promisesCount: '{n} promises with a deadline', keptOnTime: 'Kept on time {a}/{b}', checkedAt: 'As checked on {date}',
    status: { kept: 'Kept', 'late-kept': 'Kept late', late: 'Late', withdrawn: 'Withdrawn', pending: 'Not yet due' },
    reducedTag: 'Target cut', reducedInLegend: 'incl. {n} with target cut', opinion: 'Not a promise (opinion)',
    beforeSince: 'First promised (before start date)',
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
