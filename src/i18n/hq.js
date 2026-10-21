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
    title: 'IREN 본사', sub: '{city} · 공동 CEO {n}명', newCount: '발언 {n}', open: '경영진 발언 보기',
    // ≡ 메뉴 바로가기 (AppMenu)
    menuEntry: '경영진 발언', menuSub: '공동 CEO 발언 · 약속 지켜졌나',
    // 경영진 발언 칸 (StatementsPanel)
    panelLabel: 'IREN / 본사 · {city}', panelTitle: '경영진 발언', close: '닫기', photoSource: '사진: IREN 홈페이지',
    promisesCount: '기한을 밝힌 약속 {n}건', keptOnTime: '기한 안에 지켜짐 {a}/{b}', checkedAt: '{date} 확인 기준',
    status: { kept: '지켜짐', 'late-kept': '늦게 지켜짐', late: '늦어짐', withdrawn: '철회', pending: '기한 전' },
    reducedTag: '목표 줄임', reducedInLegend: '그중 목표 줄임 {n}', opinion: '약속 아님 (의견)',
    repeat: '다시 언급 · 처음 {date}', beforeSince: '처음 약속 (시작일 전)',
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
    title: 'IREN HQ', sub: '{city} · {n} co-CEOs', newCount: '{n} new', open: 'See management statements',
    menuEntry: 'Management statements', menuSub: 'What the co-CEOs said · promises kept?',
    panelLabel: 'IREN / HQ · {city}', panelTitle: 'Management statements', close: 'Close', photoSource: 'Photos: IREN website',
    promisesCount: '{n} promises with a deadline', keptOnTime: 'Kept on time {a}/{b}', checkedAt: 'As checked on {date}',
    status: { kept: 'Kept', 'late-kept': 'Kept late', late: 'Late', withdrawn: 'Withdrawn', pending: 'Not yet due' },
    reducedTag: 'Target cut', reducedInLegend: 'incl. {n} with target cut', opinion: 'Not a promise (opinion)',
    repeat: 'Repeated · first said {date}', beforeSince: 'First promised (before start date)',
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
