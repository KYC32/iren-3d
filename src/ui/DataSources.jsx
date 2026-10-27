// =============================================================
// DataSources — ≡ 메뉴 서랍의 '데이터·출처' 칸 (이 사이트가 쓰는 자료·모델·그림 소재와 라이선스, 쓰는 곳)
// -------------------------------------------------------------
// 2026-10-26 허깅페이스 자료를 넣을 때 정한 규칙: "CC-BY·ODbL 같은 출처 표기는 사이트의 '데이터·출처' 칸에 모은다"
//   각 화면에도 그 자리 출처를 따로 붙여 둠(지도 아래·캠퍼스 패널 칸 아래·뉴스 안내) — 여기는 한곳에서 보는 목록
// 회사 자료가 사실의 근거이고, 제3자 자료는 '관찰·참고'로만 씀 (공식 상태를 바꾸지 않음)
// AppMenu.jsx 가 불러옴 → 서랍을 처음 열 때만 받음 (첫 화면 묶음에 안 들어감)
// 자료를 새로 넣거나 빼면 여기와 README '지도 데이터 출처'를 함께 고칠 것
// =============================================================
import { forwardRef } from 'react'
import { ArrowUpRight, ChevronDown, Scale } from 'lucide-react'
import { REPO_URL } from '../config.js'

// [이름, 라이선스·조건, 쓰는 곳, 링크] — 문구는 { ko, en }
const L = (ko, en) => ({ ko, en })
const GROUPS = [
  {
    title: L('회사 자료 · 사실의 근거', 'Company sources · the basis for facts'),
    items: [
      [L('SEC EDGAR — IREN 공시(10-K·10-Q·8-K·6-K)', 'SEC EDGAR — IREN filings (10-K, 10-Q, 8-K, 6-K)'), L('미국 정부 공개 자료', 'US government public records'), L('뉴스 \'회사 발표\' · 일정·계약·약속 판정의 근거', 'News "Company" tab · basis for schedules, contracts and promise verdicts'), 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001878848'],
      [L('IREN 보도자료·IR 자료 (GlobeNewswire · iren.com)', 'IREN press releases and IR material (GlobeNewswire · iren.com)'), L('회사 저작물 — 링크와 짧은 인용만', 'Company material — links and short quotes only'), L('캠퍼스 소식 · 건물 근거 · 경영진 약속', 'Campus news · building evidence · management promises'), 'https://iren.com/investors'],
      [L('IREN 홈페이지 사진 3장', 'Three photos from the IREN website'), L('출처를 표시해 보여 줌 · 회사가 요청하면 내림', 'Shown with attribution · removed if the company asks'), L('캠퍼스 패널 \'사진·근거\'', 'Campus panel "Photos & evidence"'), 'https://iren.com/data-centers'],
    ],
  },
  {
    title: L('시장 자료', 'Market data'),
    items: [
      [L('Nasdaq 공개 데이터 — IREN 일봉', 'Nasdaq public data — IREN daily prices'), L('공개 웹 자료 (투자 판단용 아님)', 'Public web data (not for trading decisions)'), L('주가 페이지 · 본사 화면 전광판', 'Stock page · HQ ticker sign'), 'https://www.nasdaq.com/market-activity/stocks/iren/historical'],
      [L('Google 뉴스 RSS 검색 결과', 'Google News RSS search results'), L('제목·링크만 — 기사는 각 매체의 것', 'Headlines and links only — articles belong to each outlet'), L('뉴스 \'언론 보도\'', 'News "Press" tab'), 'https://news.google.com'],
    ],
  },
  {
    title: L('지도·지리', 'Maps and geography'),
    items: [
      [L('OpenFreeMap · OpenMapTiles · OpenStreetMap', 'OpenFreeMap · OpenMapTiles · OpenStreetMap'), L('ODbL 1.0 · © OpenStreetMap contributors', 'ODbL 1.0 · © OpenStreetMap contributors'), L('실제 지도 배경', 'Real-map basemap'), 'https://www.openstreetmap.org/copyright'],
      [L('OpenStreetMap 건물 윤곽·층수·길 (Overpass)', 'OpenStreetMap footprints, levels and streets (Overpass)'), L('ODbL 1.0 — 만든 파일(hq-city.json)도 ODbL', 'ODbL 1.0 — the derived file (hq-city.json) is ODbL too'), L('본사 3D 화면의 동네', 'HQ 3D neighborhood'), 'https://www.openstreetmap.org/copyright'],
      [L('Natural Earth · us-atlas(미국 인구조사국)', 'Natural Earth · us-atlas (US Census Bureau)'), L('퍼블릭 도메인 · 미국 정부 공개 자료', 'Public domain · US government public data'), L('국경·해안선·주 경계', 'Borders, coastlines and state lines'), 'https://www.naturalearthdata.com'],
      [L('주정부·지자체 필지·지적 공개 자료', 'State and municipal parcel and cadastral records'), L('각 기관 공개 자료 — 원문 링크', 'Public records of each agency — linked'), L('캠퍼스 패널 \'위치 근거\'', 'Campus panel "Location evidence"'), null],
    ],
  },
  {
    title: L('제3자 자료 · 관찰·참고 (회사 발표 아님)', 'Third-party data · observation only (not company statements)'),
    items: [
      [L('Copernicus Sentinel-2 L2A (Microsoft Planetary Computer)', 'Copernicus Sentinel-2 L2A (Microsoft Planetary Computer)'), L('Copernicus 무료·공개 자료 — "Contains modified Copernicus Sentinel data"', 'Free and open Copernicus data — "Contains modified Copernicus Sentinel data"'), L('캠퍼스 패널 \'위성으로 본 변화\'', 'Campus panel "Seen from space"'), 'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a'],
      [L('Miklian (2026) 미국 데이터센터 유예·제한 자료', 'Miklian (2026) US data center moratoria and local opposition'), L('CC BY 4.0', 'CC BY 4.0'), L('캠퍼스 패널 \'지역 규제\'', 'Campus panel "Local rules"'), 'https://huggingface.co/datasets/miklia/us-data-center-moratoria-local-opposition'],
      [L('IM3 Open Source Data Center Atlas v2026.02.09', 'IM3 Open Source Data Center Atlas v2026.02.09'), L('ODbL 1.0 · © OpenStreetMap contributors — 만든 파일도 ODbL', 'ODbL 1.0 · © OpenStreetMap contributors — derived file is ODbL too'), L('실제 지도 \'주변 데이터센터\' 층', 'Real-map "Nearby data centers" layer'), 'https://huggingface.co/datasets/sarkarghya/im3_open_source_data_center_atlas_v2026.02.09'],
      [L('미국 환경보호청 ECHO 허가 기록', 'US EPA ECHO permit records'), L('미국 정부 공개 자료', 'US government public records'), L('스위트워터 2 공사 기록', 'Sweetwater 2 construction record'), 'https://echo.epa.gov'],
      [L('X @AceKicker13 드론·열화상 게시물', 'X @AceKicker13 drone and thermal posts'), L('관찰 근거로만 — 원문 링크, 사진은 싣지 않음', 'Observation only — linked, photos not copied'), L('캠퍼스 패널 \'현장 진척\'', 'Campus panel "Site progress"'), 'https://x.com/AceKicker13'],
    ],
  },
  {
    title: L('모델 (Hugging Face)', 'Models (Hugging Face)'),
    items: [
      [L('Kanana 1.5 2.1B Instruct (Kakao)', 'Kanana 1.5 2.1B Instruct (Kakao)'), L('Apache-2.0', 'Apache-2.0'), L('언론 제목 기계 번역 (검사를 통과한 것만)', 'Machine translation of press headlines (only those that pass checks)'), 'https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505'],
      [L('Qwen3-4B-Instruct-2507 (Alibaba Qwen)', 'Qwen3-4B-Instruct-2507 (Alibaba Qwen)'), L('Apache-2.0', 'Apache-2.0'), L('기계 번역의 뜻 판정 — 원문과 뜻이 다른 번역을 빼는 데만 씀', 'Meaning check of machine translations — only used to drop translations that change the meaning'), 'https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507'],
      [L('Qwen3-TTS 0.6B CustomVoice \'Sohee\'', 'Qwen3-TTS 0.6B CustomVoice "Sohee"'), L('Apache-2.0', 'Apache-2.0'), L('소개 영상의 한국어 음성', 'Korean narration of the intro video'), 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice'],
      [L('OWLv2 (Google) · SAM 2.1 (Meta)', 'OWLv2 (Google) · SAM 2.1 (Meta)'), L('Apache-2.0', 'Apache-2.0'), L('현장 사진 설비 후보 찾기 — 사이트엔 사람이 확인한 숫자만', 'Finding equipment candidates in site photos — only human-checked counts reach the site'), 'https://huggingface.co/google/owlv2-base-patch16-ensemble'],
    ],
  },
  {
    title: L('3D 소재·화면 코드', '3D assets and code'),
    items: [
      [L('Kenney Car Kit · City Kit (Industrial)', 'Kenney Car Kit · City Kit (Industrial)'), L('CC0 (퍼블릭 도메인)', 'CC0 (public domain)'), L('캠퍼스 3D 주차장·공사 장비 · 본사 동네 차', 'Campus 3D parking and construction props · HQ street cars'), 'https://kenney.nl'],
      [L('three.js · MapLibre GL JS · React · lucide', 'three.js · MapLibre GL JS · React · lucide'), L('MIT · BSD-3-Clause · MIT · ISC', 'MIT · BSD-3-Clause · MIT · ISC'), L('3D 화면 · 지도 · 화면 틀 · 아이콘', '3D scenes · map · UI · icons'), null],
    ],
  },
]
export const SOURCE_COUNT = GROUPS.reduce((n, g) => n + g.items.length, 0)

// ref: 서랍(AppMenu)이 이 칸을 펼치고(.open = true) 스크롤할 때 씀
//   펼침 여부를 prop 으로 주지 않음 — 사용자가 직접 접고 펼친 상태를 React 가 덮어쓰지 않게
const DataSources = forwardRef(function DataSources({ lang }, ref) {
  const ko = lang === 'ko'
  const pick = (x) => (ko ? x.ko : x.en)
  return (
    <details ref={ref} className="app-menu-sources">
      <summary>
        <Scale size={14} aria-hidden="true" />
        <b>{ko ? '데이터·출처' : 'Data & sources'}</b>
        <small>{ko ? `자료 ${SOURCE_COUNT}가지 · 라이선스와 쓰는 곳` : `${SOURCE_COUNT} sources · licenses and where they are used`}</small>
        <ChevronDown className="src-chev" size={14} aria-hidden="true" />
      </summary>
      <div className="src-groups">
        {GROUPS.map((g) => (
          <section key={g.title.en}>
            <h4>{pick(g.title)}</h4>
            <ul>
              {g.items.map(([name, lic, where, url]) => (
                <li key={name.en}>
                  {url
                    ? <a href={url} target="_blank" rel="noreferrer">{pick(name)}<ArrowUpRight size={10} aria-hidden="true" /></a>
                    : <span>{pick(name)}</span>}
                  <small>{pick(lic)}</small>
                  <small className="src-where">{pick(where)}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="src-foot">
          {ko ? '자료를 다시 만드는 방법과 자세한 출처는 ' : 'How each file is rebuilt, with full sources: '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">{ko ? 'GitHub 저장소 README' : 'GitHub README'}<ArrowUpRight size={10} aria-hidden="true" /></a>
        </p>
      </div>
    </details>
  )
})
export default DataSources
