# 리서치 브리프 — IREN 3D 현황판

조사일: 2026-10-06. X 데이터는 fxtwitter API, GitHub 수치는 GitHub API에서 그날 읽은 값입니다.

## 1. 결론

- **콘셉트 원형**: Dilum Sanjaya의 "창고를 전략게임처럼 관리" 데모(2026-10-03, 조회 약 217만, three.js 공식 계정이 인용). 본인 답글 기준 React + React Three Fiber. 소스는 비공개.
- **구조**: 저폴리 지구본 → 사이트 클릭 → 아이소메트릭 캠퍼스. 미국·캐나다·호주·스페인을 한 화면에 담을 수 있는 유일한 구조라 채택.
- **스택**: Vite + React 19 + R3F 9 + drei 10 + zustand. 외부 3D 모델 없이 박스·실린더 조합(Dilum 데모와 재현판들의 공통 원칙).

## 2. X / 웹 사례

| 사례 | 링크 | 참고한 점 |
|---|---|---|
| Dilum Sanjaya WareTrack | https://x.com/DilumSanjaya/status/2106426962738880879 | 창고→사이트, 트럭→GPU 납품, 출하 타임라인→가동 일정 치환 |
| three.js 공식 인용 | https://x.com/threejs/status/2106721710670238104 | 같은 영상, 커뮤니티 반응 확인 |
| Dilum "Total War 캠페인 맵" | https://x.com/DilumSanjaya/status/2086495645742080049 | 상위 레벨 지도 → 시설로 내려가는 2단 내비게이션 |
| Dilum "핵발전소 글로벌→시설" | https://x.com/DilumSanjaya/status/1979953974188073036 | three.js 씬 ↔ UI 전환 연출 |
| Jay Scambler 아이소메트릭 시스템 맵 | https://x.com/JayScambler/status/2088356230968287547 | 그리드 위 건물 + 범례 + 흐르는 점(전력 흐름 점의 출처) |
| Tom Krcha 철도 시뮬레이션 | https://x.com/tomkrcha/status/2096082580554777041 | 모델 파일 없이 치수 데이터 → 절차적 지오메트리 |
| Galaxy Helios 전환 영상 | https://x.com/galaxyhq/status/2049082448013676937 | "채굴 → AI 전환" 서사가 X에서 반응이 큼 (조회 약 182만) |
| Cloudflare Status Dashboard | https://github.com/wbfoss/cf-status-dashboard | 지구본 위 다수 사이트 + 상태색, Vercel 배포 |
| IREN 공식 데이터센터 페이지 | https://iren.com/data-centers | 공식 상태 4단계, 카드 필드 순서, 브랜드색 |

## 3. 오픈소스 코드

| 레포 | 라이선스 | 가져온 것 |
|---|---|---|
| austin410203/warehouse | 미지정 → 구조만 참고 | 직교 카메라 수치, 조명 레시피, "스토어가 진실, 3D는 투영", 오버레이 레이아웃 |
| cahitberkay/waretrack | 확인 필요 → 구조만 | 파스텔 배경·안개 색, 낮은 fov 준아이소메트릭 |
| alexngdev99/rork-seaport-logistics-3d | MIT | 애니메이션을 시간 t의 순수 함수로 (향후 타임라인 슬라이더) |
| dgreenheck/simcity-threejs-clone | MIT | 미개발 → 건설중 → 완공 상태별 외형 |
| vasturiano/three-globe | MIT | 위경도 → 3D 좌표 공식, 상태별 링 펄스 아이디어 (최종 번들에서는 제거) |
| yomotsu/camera-controls (drei) | MIT | setLookAt 전환, focalOffset 으로 패널 회피 |
| srizzon/git-city | AGPL → 아이디어만 | 수치 → 건물 크기 매핑 |

지도 라이브러리 비교 (bundlephobia gzip): three 185KB, globe.gl 559KB, deck.gl 553KB, maplibre 287KB, cesium 1.35MB.
→ three 하나로 직접 그리는 방식이 가장 가볍고 스타일 자유도가 높음.

## 4. IREN 데이터 출처 (1차 우선)

- FY26 실적 (2026-08-27): https://www.globenewswire.com/news-release/2026/08/27/3352401/0/en/iren-reports-fy26-results.html
- 10-K (2026-06-30 회계연도): https://www.sec.gov/Archives/edgar/data/0001878848/000187884826000052/iren-20260630.htm
- Horizon 1 Microsoft 인도 (2026-08-13): https://www.globenewswire.com/news-release/2026/08/13/3344413/0/en/iren-delivers-horizon-1-to-microsoft-and-achieves-nvidia-exemplar-cloud-status-on-gb300-nvl72.html
- Sweetwater 1 통전 (2026-05-01): https://www.globenewswire.com/news-release/2026/05/01/3286213/0/en/iren-announces-successful-energization-of-sweetwater-1.html
- ERCOT Batch Zero (2026-09-08): https://www.globenewswire.com/news-release/2026/09/08/3357498/0/en/iren-s-2gw-sweetwater-hub-included-as-base-load-in-ercot-batch-zero.html
- NVIDIA $3.4bn 계약 (2026-05-07): https://www.globenewswire.com/news-release/2026/05/07/3290760/0/en/iren-secures-3-4bn-ai-cloud-contract-with-nvidia.html
- 사이트 페이지: https://iren.com/data-centers/{childress, sweetwater, prince-george, mackenzie, canal-flats, oklahoma, bundey}

교차 확인: 계통 전력 합계 5,610MW = 10-K 표 합계. 통전 완료 합계 2,310MW = 2026-06 자체 카드의 "에너자이즈 완료 2.31GW".

## 5. 한계와 미확인 항목

- 사이트별 정확한 GPU 수량은 회사 미공개. Prince George 23k 외에는 `null`.
- Sweetwater 1·2, Kiowa, Bundey 좌표는 카운티·지역 중심 추정. 화면에 "좌표는 근사치"로 표기.
- 채용공고 기반 해석(Sweetwater 본공사 진입, Badajoz 착공 준비)은 2026-10-05 잡보드 스냅샷이며 "추정"으로 분리.
- 건설 진행률(progress)은 회사 발표 문구("late-stage" 등)를 수치로 옮긴 근사치.
- Dilum 데모 영상 자체는 텍스트 도구로 분석하지 못해, 인용 트윗과 재현 레포로 기능을 재구성함.
- 사이트별 2렌즈 교차 팩트체크 단계는 사용량 한도로 완료하지 못함. 다음 실적(Q1 FY27, 2026-12 추정) 때 재검증 권장.
