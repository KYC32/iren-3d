# IREN 3D — 데이터센터 현황판

IREN(NASDAQ: IREN)의 캠퍼스를 실제 지도에서 탐색하고, 건물별 진행 상황·계획 이력·근거 자료를 확인하는 비공식 리서치 웹앱입니다.
MapLibre GL JS + OpenFreeMap 지도를 기본으로 사용하며, 캠퍼스 목록은 지도 확대, 지도 마커는 3D 사업 구성도로 연결합니다.

엔진은 [ai-infra-map](https://github.com/KYC32/ai-infra-map) `5257a98` 을 **단일 회사 모드**(`src/config.js`)로 가져온 것입니다.
보드판 지도·사건 눈금·다가오는 일정·계약 연결선·갱신 기록은 이 레포에서 추가했습니다.

> 본 프로젝트는 IREN Ltd 와 무관한 개인의 비공식 프로젝트입니다. 모든 수치는 공개 자료에서 수집했고 항목마다 출처를 표기했습니다. 투자 조언이 아닙니다.

## 화면 구성

| 화면 | 내용 |
|---|---|
| 실제 지도 | OpenFreeMap Positron, 북미 중심 첫 화면, 접을 수 있는 캠퍼스 목록, 이름·용량·3D 진입을 담은 카드 표식, 가까운 캠퍼스 그룹, 국가 이동. 전체 보기는 날짜변경선을 연결해 미국 중심으로 배치. 위치는 2026-10-17 9곳 모두 원문으로 확인한 주소·필지 중심(SEC 첨부 주소·주정부 필지 자료·지자체 공고·연방 환경 신고·주정부 법령, `data/research.json` locations — 경계는 미확인). 근거를 확인하지 못한 곳은 지역 위치로 표시 |
| 사업 현황 (`#page=portfolio`) | 상단 네비 "현황": 포트폴리오 핵심 지표(확보 전력·AI 가동·전망·건설·사이트·ARR), 타임라인, 캠퍼스별 표(확보 전력·AI 가동·채굴·건설·계획 — 이름을 누르면 지도에서 열림). 날짜를 옮겨 보는 일은 이 페이지와 3D 화면에서 하고, 실제 지도는 늘 기준일 모습(KPI 판·타임라인 없음) |
| 상세 패널 | 현황 / 계획 이력 / 사진·근거, 건물·고객 구역 선택, 출처 공개일·검토일. 웹·모바일 접기/펼치기, 모바일 하단 손잡이 드래그 |
| 3D 구성도 | Childress 공식 사진의 저층 채굴동·청회색 외벽·금속 지붕·환기 설비·건조 지형 반영. 텍사스 초지·캐나다 숲·남호주 관목 등 지역별 경관. 고객 구역과 용량 배치는 개념도. 처음 화면은 건물·변전소가 있는 곳에 맞추고, 하늘은 기본이 "지금"(그 부지의 현지 시각 — 낮·노을·밤을 고르면 링크에 남음). 블록 1칸은 75MW, 작은 부지(BC 30~80MW·바다호스)는 20MW. 개요 칩에 건물 이름과 상태(건설 중 포함), 건물이 없는 개발 부지에는 개발 단계(부지·전력 확보 → 통전 → 착공 → 가동) 카드 |
| 타임라인 (현황 페이지·3D) | 기준일까지는 확인된 상태만, 그것도 그 시점에 공개돼 있던 것만(처음 공개일 → 문서 공개일 `data/source-dates.json` → 그래도 모르면 사건 날짜). 기준일 이후는 기준일 상태에서 출발해 회사 발표 목표(·추정)대로 진행하는 전망 |

딥링크: `/#site=childress&building=horizon-1&tab=history` 또는 `/#site=childress&surface=3d&zone=microsoft`.
기존 `site` 링크는 실제 지도 상세로 열립니다(지도는 기준일 기준이라 `date` 는 현황 페이지·3D 링크에서만 쓰임). 지도 마커를 클릭하면 `surface=3d`로 즉시 진입하고, 목록을 선택하면 해당 캠퍼스를 지도에서 확대합니다. 화면 전환 시 지도 위치는 세션 내에서 복원합니다. 미국 중심 세계지도 한 장의 경계 안에서 이동하며, 화면 크기에 맞춘 최소 줌으로 가로 반복을 방지합니다.

영상 인트로(녹화 모드)는 지구본을 그대로 씁니다.

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 시간 함수·사건·캠퍼스 배치 단위 테스트
npm run build      # validate → 빌드 (dist/)
```

## 시점 표시와 로딩

- ARR 등 회사 발표 지표는 선택한 월까지 공개된 값만 표시합니다. 같은 `key`의 이력을 추가하면 그 시점의 최신 값을 선택하며, 미래 화면에서는 마지막 발표값을 유지합니다. 카드의 `발표값 · 날짜`를 누르면 출처가 열립니다.
- 월 단위 화면이므로 일자가 있는 발표도 해당 월부터 표시합니다. 연·분기·반기로 적힌 지표는 해당 기간의 마지막 달부터 표시합니다.
- 캠퍼스 카메라는 실제 패널 크기를 제외한 영역에 부지 전체를 맞춥니다. 상단 `회전 / 이동`으로 드래그 동작을 선택하며 우클릭 드래그·두 손가락 드래그로도 이동할 수 있습니다. 휠·핀치로 확대하고, `전체 보기`로 위치·각도·배율을 복원합니다. 직접 조작하거나 건물을 확대해서 보고 있다면 날짜·패널·화면 크기가 바뀌어도 시점을 중앙으로 돌리지 않습니다. 이동 범위는 부지와 주변 경관으로 제한합니다.
- 설명 패널은 상단 `접기 / 펼치기`로 조작합니다. 모바일에서는 하단에 배치되며 손잡이를 아래로 끌면 접고 위로 끌면 펼칩니다. 접어도 선택·탭·스크롤 위치를 유지하고, 다른 캠퍼스나 새 고객·건물을 선택하면 설명을 다시 표시합니다. `×`는 캠퍼스를 닫고 지도로 돌아가는 별도 동작입니다.
- 전체 보기에는 고객·용도별 구역, 확대 시에는 건물명, 선택 시에는 용량·일정을 표시합니다. 라벨은 겹침과 화면 경계를 검사하고 선택한 건물을 우선 표시합니다. 고객 배지는 투영된 부지 바깥에 배치하고 구역 중심까지 점선으로 연결합니다. MS·NVIDIA 고객 배지 또는 패널 버튼을 클릭하면 연결된 구역을 강조하고 카메라를 맞추며, 고객별 용량·상태·계약을 표시합니다. 전체 보기 또는 선택 해제로 복귀합니다. 공개된 미완료 납품 계획은 트럭으로 표현하며, 대상 건물이 특정되지 않으면 공용 하역장으로 이동합니다. 트럭 라벨은 다른 라벨과 겹치면 숨깁니다.
- 주변의 나무와 건물 지붕 상태색을 유지합니다. 파란 지붕·체크는 고객 인수, 노란 지붕·신호는 시운전, 초록은 가동 상태를 나타냅니다. 인수 완료 건물의 팬 회전과 변전소에서 완공 설비로 이어지는 전력 흐름은 설비 연출이며, 납품 트럭도 실시간 추적이 아닙니다. 가동·매출 집계는 애니메이션과 무관하게 원문 근거를 따릅니다.
- 지표·목록 UI를 먼저 불러오고 3D 씬을 지연 로딩합니다. 지구본·캠퍼스·녹화 코드는 필요한 화면에서 불러옵니다.
- `npm run build`는 manifest의 의존성을 순회해 HTML UI 120KiB, 실제 지도 550KiB, 3D 450KiB(gzip) 예산을 검사합니다. 지도 워커와 CSS도 해당 예산에 포함됩니다. MapLibre의 단일 청크 크기 경고는 별도 gzip 예산으로 관리합니다.
- 그림자는 현재 three.js가 지원하는 PCF 설정을 명시합니다. `THREE.Clock` 경고는 설치된 `@react-three/fiber` 9 내부에서 발생합니다. 콘솔 경고를 숨기거나 의존성 코드를 직접 패치하지 않았으며, 렌더러 업그레이드 시 프레임 지정 녹화도 함께 검증해야 합니다.

## 경관 참고와 구현

- 2026-10-08 확인: [Childress](https://iren.com/data-centers/childress), [Sweetwater](https://iren.com/data-centers/sweetwater), [Prince George](https://iren.com/data-centers/prince-george), [Canal Flats](https://iren.com/data-centers/canal-flats)의 공식 갤러리를 직접 대조했습니다. [Mackenzie 공개 항공사진](https://www.datacentermap.com/canada/prince-george/iren-mackenzie/)도 식생 참고에 사용했습니다.
- 지역 이미지 검색으로 확인한 [Childress County](https://hallhall.com/property-for-sale/texas/diamond-h-headquarters/a09Nu000008tH6r/), [Canal Flats 지역 자료](https://www.canalflats.ca/your-canal-flats/), [Pittsburg County](https://www.land.com/property/250-acres-in-Pittsburg-County-Oklahoma/17419861/), [남호주 Morgan](https://www.realestate.com.au/sold/property-lifestyle-sa-morgan-7156392)은 주변 환경의 색·식생 참고이며 해당 캠퍼스의 사진으로 표시하지 않습니다. 외부 사진 파일은 앱에 추가하지 않았습니다.
- Oklahoma·Bundey는 공식 소개 이미지와 지역 사진을 참고한 분위기 표현입니다. Sweetwater 2의 정확한 주변 배치와 Badajoz 현장 경관은 미확인입니다. Badajoz 검색 결과의 계획 조감도는 현장 실사로 사용하지 않았습니다.
- 토양·수목·완만한 기복은 `src/scene/campusLandscape.js`의 출처별 프로필로 관리합니다. 나무 배치는 사이트 ID로 고정하고 부지·납품 도로·전력선 구간을 비웁니다. 식생은 [pmndrs/drei Instances](https://github.com/pmndrs/drei/blob/master/docs/performances/instances.mdx)를 참고한 정적 인스턴싱으로 처리합니다. [procedural terrain 예제](https://github.com/dgreenheck/threejs-vibecode-rpg)에서 살펴본 지형·식생 분리 방식을 참고했으며 외부 코드는 복사하지 않았습니다.
- 지도 카드 표식은 [MapLibre HTML cluster 예제](https://maplibre.org/maplibre-gl-js/docs/examples/display-html-clusters-with-custom-properties/)의 표식 캐시·그룹 조회 패턴을 참고합니다. 목록 접기 상태는 화면 전환 중 유지되며 모바일에서는 하단 목록으로 열립니다.
- 캐나다 세 캠퍼스에는 침엽수 사이에 단풍나무를 섞고, 호주 번디에는 부지 밖에서 뛰는 캥거루 세 마리를 배치했습니다. 둘 다 지역 분위기를 위한 장식 요소입니다. 캥거루 경로는 도로·부지와 분리하고 주변 식생도 비우며, 모션 감소 설정을 켜면 멈춥니다.
- 텍사스의 Childress·Sweetwater 1·2에는 롱혼 소 두 마리와 낮게 퍼지는 메스키트, 납작한 잎줄기의 가시배선인장을 추가했습니다. [텍사스 공식 상징](https://www.tsl.texas.gov/ref/abouttx/symbols)과 [Rolling Plains 식생](https://tpwd.texas.gov/landwater/land/habitats/cross_timbers/ecoregions/rolling_plains.phtml)을 참고한 장식입니다. 롱혼은 부지 밖의 서로 떨어진 초지에서 풀을 뜯거나 천천히 걷고 꼬리를 흔들며, 모션 감소 설정에서는 멈춥니다. 주변 나무·관목·선인장은 동선에서 제외합니다.
- 모든 캠퍼스의 송전선에는 부지 밖에서 변전소로 이동하는 민트색 빛줄기와 도착 시점에 맞춰 밝아지는 변전소 표시등이 있습니다. 선택 시점에 `reported` 통전 기록이 있는 곳에서만 켜지며 목표·미확인 상태에는 흐름을 표시하지 않습니다. 건물로 이어지는 흐름도 같은 민트색을 사용하고 지붕의 상태색은 유지합니다. 속도는 소비전력·가동률과 무관한 일정한 연출이며 모션 감소 설정에서는 빛줄기와 표시등이 정지합니다.
- 건물·울타리·도로·경관의 위치와 크기는 구성도입니다. 나무와 배경은 촬영 시점·현재 계절을 재현하지 않습니다. Sweetwater 1의 풍력발전기는 공식 사진에 보이는 주변 경관이며 캠퍼스 전력 공급원을 뜻하지 않습니다. 각 상세 패널의 ‘사진을 참고한 경관 · 출처’에서 확인할 수 있습니다.

## 데이터 갱신 방법 (가장 자주 하는 일)

1. 사이트 데이터는 `data/companies/iren.json`, 회사 지표·계약·일정은 `data/companies.json` 에 있습니다.
   - 건물 상태는 "바뀐 시점" 목록(`phases`)으로 적습니다. 예) `{ "status": "operating", "from": "2026-Q4", "basis": "target" }`
   - `basis`: `reported`(발표된 사실) · `target`(회사 목표) · `estimate`(우리 추정, `estimates` 에 근거 필요)
   - 기존 건물 전력을 재사용하는 전환(예: 채굴동 → AI 홀)은 `replaces: "<기존 건물 id>"`
   - 고객 계약은 `contracts`(사이트·건물 연결), 실적 발표 같은 회사 일정은 `events`
   - 계통을 아직 확보하지 못한 계획 부지(예: Redbank)는 `power` 의 확보 전력을 0 으로 두고, 회사가 밝힌 규모를 `planned: { mw, source }` 에 적습니다. 합계에는 안 들어가고 지도 핀 '계획 900 MW', 3D 빈 부지 '계획 · 계통 미확보', 패널·KPI 아래 줄로만 보입니다.
   - 회사가 발표하지 않았지만 공개 자료에 흔적이 있는 지역은 `data/prospects.json`(지도의 '?' 표, 정황마다 날짜·한 줄·출처)에 적습니다. 부지가 아니므로 캠퍼스 목록·합계·3D 에는 넣지 않고, 타임라인 날짜까지 공개된 정황만 보입니다.
   - 정부 허가 기록(EPA ECHO 등)은 `data/observations.json` 의 `progress` 에 `method: "permit"` 으로 적습니다. 제3자 관찰과 같은 등급이라 공식 상태를 바꾸지 않습니다(예: 스위트워터 2 변전소 부지 정지 허가 TXR1547YU).
   - 캠퍼스 패널의 '지역 규제' 칸은 `data/restrictions.json` 을 읽습니다. `node scripts/fetch-restrictions.mjs` 가 Hugging Face 의 Miklian(2026) 데이터센터 유예·제한 자료(CC BY 4.0, 판 번호 고정)와 FCC 카운티 조회로 미국 부지마다 계산합니다. 새 판이 나오면 스크립트의 `REV` 를 바꾸고 다시 돌립니다.
   - 회사 발표 지표는 `metrics`. 위쪽 KPI 줄에는 앞의 2개만 나오고, `show: "contracts"` 인 지표는 계약 탭 맨 위 "계약 조건"에 나옵니다. 회사가 "이상"·"약"으로 쓴 값은 `qualifier: "over"`(>$20m) · `"about"`(~$25m), 범위는 `value_max`(예: 선급금 45~55% → `value: 45, value_max: 55`)
2. **`data/changelog.json` 맨 위에 오늘 날짜로 바뀐 내용을 적습니다.** 데이터 기준일보다 최신 기록이 없으면 빌드가 실패합니다.
3. `npm run validate` 로 검사합니다. 스키마·날짜 순서·매달 전력 합계·좌표·계약 참조·갱신 기록을 확인합니다.
4. 사이트를 추가하거나 좌표를 바꿨다면 `npm run geo` (보드판·지구본 타일 다시 계산). 캐나다·호주 주 경계는 `scripts/.cache` 의 Natural Earth 원본(`npm run geo:fetch`)이 있어야 들어갑니다. 캐시가 없으면 주 경계가 빠진 채 만들어지니, 새 작업 폴더에서는 캐시부터 확인하세요.
5. `git commit` → `git push` 하면 Vercel 이 자동으로 다시 배포합니다.

## 첫 화면 부팅 그림 (GPU 랙 + GPU)

첫 화면에는 `index.html` 안에 든 그림 두 개가 먼저 보입니다. 왼쪽은 GB300 NVL72 식 GPU 랙입니다. 트레이가 저절로 나오면서 실제 GB300 배치대로 GPU 4개, 냉각수 매니폴드, CPU 2개와 메모리, NIC 4개, 저장장치·포트가 보입니다. 오른쪽은 B300 GPU 1개의 분해도입니다. 구리 냉각판과 니켈 뚜껑이 차례로 들리며 다이 2개와 HBM3e 8개가 보입니다. 두 그림은 마우스로 조작하지 않고 28초 둘러보기를 저절로 되풀이합니다. 랙이 먼저 트레이를 꺼내 확대하며 GPU 냉각판·매니폴드·CPU·NIC 를 청록 원으로 하나씩 짚고, 이어서 GPU 가 냉각판을 들고 기판을 확대해 다이·HBM·전원부 인덕터·NVLink 커넥터를 짚습니다. 짚는 동안 그 원 바로 옆 말풍선에 부품의 이름과 역할이 나오고, 원이 다음 부품으로 옮겨 가면 말풍선도 짧은 선으로 이어진 채 함께 옮겨 갑니다 (눈을 그림 아래까지 옮기지 않아도 됨). 말풍선은 원의 오른쪽 → 왼쪽 → 아래 → 위 중 칸 안에 들어가는 곳에 놓이고, 그림이 아주 작은 화면(예: 375×667)처럼 어디에도 들어가지 않으면 원을 가리지 않도록 그림 아래 줄에 설명을 씁니다.

색은 실물 사진(IREN 이 들이는 Dell XE9712 GB300 NVL72, GTC 2025 GB300 기판·HPE 트레이) 기준입니다. 랙은 검정, 컴퓨트 트레이는 은색 판금, 기판과 호스는 검정, 냉각판은 구리입니다. 파랑·빨강은 실물처럼 냉각수 연결부(퀵커넥터) 고리에만 쓰며 각각 공급·회수입니다. 주황은 눈에 보이지 않는 열을 표시한 것입니다.

- **만드는 법**: `anatomy` 스킬 방식(아이소메트릭 SVG + 같은 카메라의 WebGL 열 잉크)으로 `scripts/anatomy/rack/build.mjs` 가 만듭니다 (GPU 그림은 `gpu.mjs`, 공용 부품 도구는 `shop.mjs`). 결과물 `src/boot/rack.html` 조각을 Vite 플러그인이 `<!-- rack -->` 자리에 끼우므로 JS 번들과 무관합니다. 똑같이 생긴 부품은 한 번만 그리고 SVG `<use>` 로 복사해 압축 약 64KB 입니다.
- **검사**: `node scripts/anatomy/rack/build.mjs --audit` 는 부품마다 기록한 3D 모양으로 관통·호스 끝점·지지·칠하는 순서를 검사합니다. 선 끝 검사는 스킬의 `scripts/lines.mjs` 로 합니다.
- **확대**: 두 그림 위의 "트레이 확대"·"기판 확대" 단추(또는 그림 더블클릭, + 키)로 약 2.5배 확대합니다. 트레이 확대는 트레이를 끝까지 꺼낸 채 서랍 속을, 기판 확대는 냉각판과 뚜껑을 비킨 채 GPU 기판을 보여 줍니다. 돋보기처럼 포인터가 가리키는 곳이 그대로 확대되고, 부품에 포인터를 올리거나 탭하면 이름과 역할이 그 자리 바로 옆 말풍선에 나옵니다 (손가락으로 탭하면 손가락에 가리지 않게 위쪽에, 마우스가 그림 밖으로 나가면 사라짐). 키보드는 화살표로 조준 원을 옮기고 Esc 로 돌아갑니다. 확대해 보는 동안에는 둘러보기가 그 자리에서 멈추고(끝나면 이어짐), 부팅 화면도 지도로 저절로 넘어가지 않습니다.
- **넘김 규칙**: 둘러보기 한 바퀴(28초, 느린 기기에선 실제로 한 바퀴를 다 돌 때까지, 늦어도 56초)를 보여 주고, 지도·3D·페이지가 `window.__bootReady()` 를 부르면 넘어갑니다. 시간은 화면이 실제로 보이기 시작한 때부터 셉니다 (링크를 백그라운드 탭으로 열어도 탭을 연 뒤부터). 부팅 카드 위에서 마우스를 움직이거나 누르는 중이면 6초를 더 기다리고, 30초가 지나면 신호가 없어도 넘어갑니다. "건너뛰기 / 지도 보기" 버튼은 언제든 바로 넘깁니다.
- **다시 만들기**: `node scripts/anatomy/rack/build.mjs` (영어 검수용 페이지 `scripts/anatomy/rack/rack-light.html` 도 함께 생김).

## 전력 경로 그림 (매켄지 세그먼트 1칸)

3D 부지 화면에서 매켄지 공랭 홀 건물을 누르거나, 캠퍼스 패널에서 그 건물을 고른 뒤 "이 건물 안 자세히 보기"(또는 "현장 진척" 칸의 "이 관찰을 그림으로 보기" — 이때는 9/23 관찰 보기로 열림)를 누르면 세그먼트 1칸(2.5MW 전력 블록)의 모형이 대화상자로 열립니다. 어떤 건물에 그림을 붙일지는 `data/companies/*.json` 건물의 `figure` 로 정합니다 (지금은 `mk-air` → `power-block`). 현장 변전소에서 땅속으로 들어온 34.5kV(2.5MW 에 약 42A)가 강압 변압기에서 480V(약 3,000A)로 바뀌고, 케이블 래더를 타고 벽에 붙은 ATS·배전반으로 갑니다. 그 앞의 2.5MW 디젤 발전기는 콘듀잇 12개로 ATS 에 이어지고(패드를 잘라 보여 줌), ATS 에서 MER(전기실)과, 벽을 지나 홀 배전반 → 랙 위 트레이 → 랙 PDU(480V 의 한 상 277V) → 공랭 B300 서버로 이어집니다. 둘러보기가 저절로 확대하며 전기가 흐르는 순서대로 부품을 짚고(바로 옆 말풍선), 이어서 정전 → 발전기 기동(배기) → ATS 접점이 발전기 쪽으로 → 복전 → 되돌림을 보여 줍니다. 전류가 흐르는 길은 주황 점선이 움직입니다.

- **9/23 관찰 보기**: 그림 위 "완공 후 | 9/23 관찰" 단추로 바꿉니다(주소 끝 `#obs` 로 열면 바로 이 보기). 전기 없이(통전 전) 장비마다 설치 개수를 짚는 둘러보기가 돌고, 아래 개수 단추(패드 27/32 · 변압기 32/32 · 케이블 당김 3/4홀 · ATS·배전반 4/32 · 발전기 20/32 · MER 23/32)를 누르면 그 장비로 확대해 홀별 개수를 보여 줍니다. 1칸 그림은 32칸 중 "대부분"의 모습이라 절반을 넘게 설치된 장비만 진하게(`model.mjs` 의 `looksInstalled`), 대부분 아직 없는 장비(ATS·배전반)는 점선, 지붕 아래라 드론으로 안 보이는 홀 안은 흐리게 칠합니다. 숫자는 `data/observations.json` 의 그 관찰 항목(`figure: "power-block"`)에서 빌드가 읽으므로 캠퍼스 패널의 칸 그림과 같고, 관찰을 고치면 그림을 다시 만들면 됩니다. 색만 바꾸는 방식이라(재료 색 = `var(--fx-이름, 원래 색)`) 모양·칠하는 순서·검사 결과는 두 보기가 같습니다.
- **홀 안**: IREN 홈페이지의 매켄지·프린스조지 공랭 홀 사진(찬 통로·Dell 서버 앞면·천장 통신 사다리·뜨거운 통로의 배기 팬 벽)을 보고 그렸고, 평균 PUE 1.1·최대 랙 밀도 70kW 도 같은 페이지 값입니다. 찬 통로(파랑)·뜨거운 통로(주황) 바닥 색, 랙 한 줄 일부만 그린 것, 옆판을 뗀 마지막 랙은 설명을 위한 표현입니다.
- **근거**: 배치·전압·발전기·콘듀잇 12개·MER 은 매켄지 현장을 분석한 제3자 스레드(Ace-Kicker, 2026-10-01, 9/23 드론 영상) 기준이며 회사가 확인한 내용이 아닙니다(그림 아래에도 적음). 케이블 가닥 수·홀 안 배전 모양은 그림 표현입니다.
- **숫자**: `scripts/anatomy/power/model.mjs` 한 곳에서 나옵니다. 전류 = 전력 ÷ (√3 × 전압), GPU·랙 수는 `src/data/hallEstimate.js` 의 공랭 HGX 가정(GPU 1개당 2.0kW, 랙당 32개)을 그대로 써서 캠퍼스 패널 숫자와 같습니다. 둘러보기 시간표와 그 시각의 상태(`stateAt`: 계통·발전기·접점·흐름)도 같은 파일이고, 빌드가 이 함수를 페이지에 그대로 넣어 그림과 글이 어긋나지 않습니다.
- **연결**: 어떤 관찰 칸에 그림을 붙일지는 `data/observations.json` progress 항목의 `figure`(지금은 `power-block`)로 정합니다. 그림은 `public/figures/power-block.<ko|en>.html` 정적 페이지라 앱 번들과 무관하고, 대화상자를 열 때만 iframe 으로 받습니다(압축 약 130KB).
- **다시 만들기·검사**: `node scripts/anatomy/power/build.mjs` (부팅 그림과 같은 `scripts/anatomy/rack/shop.mjs` 도구), `--audit` 로 관통·끝점·지지·칠하는 순서를 검사합니다. 선 끝 검사는 스킬의 `scripts/lines.mjs` 에 `--reduced`(둘러보기 없이)를 붙여 돌립니다.

## Horizon 액체냉각 홀 그림 (차일드레스)

3D 차일드레스 화면에서 Horizon 1~4 건물을 누르거나, 캠퍼스 패널에서 고른 뒤 "이 건물 안 자세히 보기"를 누르면 Horizon 홀 한 토막의 모형이 대화상자로 열립니다. 두 길이 GB300 NVL72 랙에서 만납니다.

- **전기**: 1차 변전소 6에서 땅속 중압 관 → 홀 변압기 A·B → 저압 케이블(래더·벽 관통) → 배전반 A·B(← 디젤 발전기가 예비 전원으로 땅속 관을 거쳐 들어옴) → UPS A·B(배터리 칸 포함, 발전기가 설 때까지 10~15초를 메움) → 랙 위 버스웨이 A·B → 랙마다 탭오프 2개 → 랙 뒤 전원 선반·직류 버스바. 두 갈래라 한쪽 길을 통째로 정비해도 GPU 는 계속 돕니다(회사가 밝힌 Tier III 수준 동시 유지보수). 주황 점선이 전류입니다.
- **냉각수**: 카트 위에 꺼낸 컴퓨트 트레이의 구리 냉각판(GPU 4·CPU 2) → 랙 뒤 매니폴드(파랑 공급·빨강 회수, 트레이마다 퀵 커넥터) → 호스 → 천장 2차 배관(T 이음쇠) → CDU 3대(A 가동·C 대기·B 는 앞판을 떼어 판형 열교환기와 펌프가 보임) → 벽 밖 1차 배관(보온 알루미늄 덮개, 엘보·T 이음쇠) → 건식 냉각기(팬 7개) → 칠러 패키지 → 펌프 칸 → 벽 쪽 공급 배관으로 다시 CDU (둘러보기도 펌프까지 짚어 고리를 닫음). 파랑 점선 = 찬물, 빨강 = 데워진 물.
- **둘러보기**: 부품을 차례로 짚은 뒤 ① 더운 오후: 칠러 앞면 온도계 바늘이 39 °C 까지 오르고 칠러가 돌며(팬 위 더운 공기) 냉각 전력이 늘어남 → 저녁에 멈춤 ② 동시 유지보수: 대기 CDU C 기동 → CDU B 밸브 4개를 닫고(손잡이가 돌아감, 정비 표지) → 정비 중에도 냉각 계속 → 복귀.
- **근거**: 75MW(IT 50MW)·랙 200kW 까지(2025-02 월간 업데이트), 랙 130~200kW·Tier III 수준 동시 유지보수(2025-11 Microsoft 계약 발표 자료), 칠러 플랜트·칠러·건식 냉각기·CDU·UPS·디젤 발전기(2025-01 6-K), 1차 변전소 6(2025-02 배치도·2025-06 영상), Dell 이 공급하는 GB300 NVL72 와 발전기 대기 배출 허가(2026-08 10-K 첨부 금융 계약서), Horizon 1 인도(2026-08-13 8-K). 홀 안·바깥 모습은 회사의 "Horizon 1 인도" 영상(2026-08-13 X)에서 본 것(NVL72 랙 줄·노란 광케이블·구리 냉각판·통로의 회색 전기반·굵은 보온 배관·핀 코일 냉각기)입니다. 배관 방식(냉각기 → 칠러 직렬)·CDU 자리와 대수·변압기 모양·온도는 그림 표현이고 그림 아래에도 적었습니다.
- **숫자**: `scripts/anatomy/horizon/model.mjs` 한 곳. GPU·랙 수는 `src/data/hallEstimate.js` 의 NVL72 가정(GPU 1개당 2.0kW, 랙당 72개 → 랙 144kW)이라 캠퍼스 패널과 같고, 냉각수 유량 = 열(kW) ÷ (4.18 × ΔT) 에 ΔT 10 °C 가정(랙 1대 약 207 L/분, Horizon 1칸 약 72,000 L/분). 둘러보기 시간표와 `stateAt`(기온·칠러·CDU·밸브·흐름)도 같은 파일이며 빌드가 페이지에 그대로 넣습니다.
- **연결**: `data/companies/iren.json` 의 horizon-1~4 에 `"figure": "horizon-hall"`. 그림은 `public/figures/horizon-hall.<ko|en>.html` 정적 페이지(압축 약 170KB)라 앱 번들과 무관합니다. 그림 단추 아이콘은 `src/ui/figureIcons.js`(전력 = 플러그, 액체냉각 = 물방울). `src/data/figures.test.js` 가 데이터가 가리키는 그림 페이지가 한·영 모두 있는지 검사합니다.
- **다시 만들기·검사**: `node scripts/anatomy/horizon/build.mjs` (`--audit` 로 관통·끝점·지지·칠하는 순서), 선 끝 검사는 스킬의 `scripts/lines.mjs` 에 `--reduced`. 확대·말풍선 코드는 두 그림이 함께 쓰는 `scripts/anatomy/shared/zoomer.js` 입니다.

## 스위트워터 1 그림 (변전소 → 액체냉각 홀)

3D 스위트워터 1 화면에서 1단계 건물을 누르거나, 캠퍼스 패널에서 고른 뒤 "이 건물 안 자세히 보기"를 누르면 이미 통전된 변전소에서 1단계 액체냉각 홀까지의 모형이 대화상자로 열립니다.

- **전기 (계단처럼 내려감)**: ERCOT 345 kV 송전선(받침판 끝에서 잘라 보여 줌) → 인입 가대·매단 애자 → 단로기 → 가스 차단기 → 345 kV 관형 모선(받침 애자, 변압기마다 T 이음쇠) → 대형 변압기 2대(345 → 138 kV, 방열판·보존 탱크·부싱) + 비워 둔 세 번째 자리 → 케이블 헤드 → 138 kV 케이블 도랑 → 1차 변압기(138 → 34.5 kV) → 34.5 kV 케이블 도랑 → 홀: 34.5 kV 배전반 → 정류기 2칸(34.5 kV 교류 → 800 V 직류, 윗면 배기 팬) → 800 V 직류 배전반 → 800 V 버스웨이 → 탭오프 → Vera Rubin 랙(홀 전기는 NVIDIA DSX POD 의 800 V 직류 방식을 따른 그림 표현). 제어동·피뢰 기둥·울타리·자갈 마당은 회사 사진 기준입니다.
- **냉각수 (칠러 없음)**: 랙 매니폴드 → 호스 → 천장 2차 배관(공급은 앞·아래, 회수는 뒤·위라 둘 다 보임) → CDU 2대(B 는 앞판을 떼어 판형 열교환기·펌프가 보임) → 가지관 → 벽 밖 1차 배관(보온 알루미늄, 엘보·T 이음쇠) → 건식 냉각기(팬 5개) → 배관에 붙은 펌프 2대(1대 예비) → 다시 CDU. 칠러를 그리지 않은 것이 Horizon 그림과의 차이입니다(NVIDIA: '알맞은 기후에서' — 가장 더운 때 기계식 냉각을 보탤지는 지역 기후가 정함).
- **둘러보기**: 부품 18곳을 차례로 짚은 뒤 ① 더운 오후: 냉각기 제어반의 온도계가 39 °C 까지 오르고 팬이 빨라져도(날개 그림이 빨리 넘어가고 더운 공기가 자주 오름) 물은 약 44 °C 로 45 °C 아래 → 칠러 없음(바깥 40 °C 이상이면 보조 냉각이 필요할 수 있다고 함께 적음) → 저녁 ② 다음 단계: 비워 둔 변압기 자리와 앞마당 패드 2곳에 흐린 변압기가 나타났다 사라짐(예시).
- **근거**: 1,400 MW 대형 변전소(345 kV/138 kV)와 1차 변전소(138 kV/34.5 kV)(2025-01 6-K), 2026-05-01 통전(보도자료), 예정대로 통전·IT 200 MW 액체냉각 첫 단계 건설 중·"NVIDIA Vera Rubin 같은 차세대 칩 구조를 위해 설계"·"첫 단계가 다음 단계를 더 빨리 붙이는 뼈대"(FY26 3분기 실적 발표 콜), 첫 단계 300 MW·2027년 4분기 목표·스위트워터 1·2 = 2 GW 허브(2026-09-08 발표), 마당 모습(iren.com 사진), 스위트워터 캠퍼스 = NVIDIA DSX 구조의 대표 배치 예정(2026-05-08 NVIDIA 공동 발표). NVIDIA(GTC Berlin 2026 보도자료·기조연설 30:05, 2026-10-21): Vera Rubin 은 닫힌 순환 액체냉각·냉각수 최대 45 °C, 알맞은 기후에서는 건식 냉각기가 물을 증발시키지 않고 열을 버림(2 GW 규모에서 냉각탑보다 하루 물 5,400만 L 절약), 가장 더운 때 기계식 냉각을 보탤지는 지역 기후가 정함 → 그림의 온도계 빨간 띠. 홀 전기 800 V 직류는 같은 날 발표된 DSX POD(기술 블로그 '표준 입력 800 VDC', 기조연설 30:42)를 따른 것이고, 슈나이더 일렉트릭의 Vera Rubin NVL72 검증 설계는 480 V 교류라 추정입니다. 홀 안 설계·전기 방식·냉각 설비 구성·대수·랙 사양은 회사가 밝히지 않아 그림 표현이고, 냉각기·CDU 온도차 5 °C 와 기온은 가정입니다(그림 아래에도 적음).
- **'회사 확인' 보기**: 그림 위 [전체 | 회사 확인] 단추(또는 주소 끝 `#confirmed`)로 바꿉니다. 회사 공시·사진으로 종류를 확인한 변전소 설비는 색 그대로, 회사가 밝히지 않아 그린 홀 안·냉각 설비·비워 둔 자리·앞마당 패드는 흰 모형처럼 하얗게 칠하고, 말풍선 맨 위에 '회사 확인'/'그림 표현'을 붙입니다. 부품이 아니라 구역 단위로 나누고(`build.mjs` 의 `ZONE` — 구역이 빠진 설명 키가 있으면 빌드가 멈춤), 반투명 대신 재료 색 토큰을 흰색으로 바꿔(`var(--fx-*)`) 겹친 부품이 비치지 않게 했습니다. Horizon 그림은 회사가 설비 종류를 모두 밝혀(칠러·건식 냉각기·CDU·UPS·디젤 발전기·GB300 NVL72 랙) 하얗게 할 구역이 없으므로 이 보기를 넣지 않았습니다.
- **숫자**: `scripts/anatomy/sweetwater/model.mjs` 한 곳 — 선전류 I = P ÷ (√3 × V)(첫 단계 300 MW 를 보낼 때 345 kV 약 502 A · 138 kV 약 1,255 A · 34.5 kV 약 5,020 A), 800 V 직류 전류 I = P ÷ V(IT 200 MW → 250,000 A), 칠러 없이 되는 최고 기온 = 45 − 5 = 40 °C, 둘러보기 시간표와 `stateAt`(기온·팬·다음 단계·흐름)을 빌드가 페이지에 그대로 넣습니다.
- **연결**: `data/companies/iren.json` 의 sw1-phase1 에 `"figure": "sweetwater-1"`, 단추 아이콘은 전신주(lucide UtilityPole). 그림은 `public/figures/sweetwater-1.<ko|en>.html` 정적 페이지(압축 약 160KB)라 앱 번들과 무관합니다.
- **3D 화면의 GPU 표 (Vera Rubin · GB300 · B300 등)**: sw1-phase1 의 `gpu` = `Vera Rubin`, `basis: "designed_for"`(회사가 'Vera Rubin 을 포함한 차세대 칩 구조를 위해 설계'라고만 밝힘 — 주문·설치 발표 전). 개요 칩과 건물 이름표에 남색 GPU 표가 붙고(`buildingLabel.js` 의 `gpuLabel` — GPU 모델을 아는 홀이면 액체냉각·공랭 모두: 스위트워터 1단계 = Vera Rubin, Horizon 1~4·프린스조지 액체냉각 홀·커낼플랫츠 전환 계획 = GB300, 차일드레스·매켄지 공랭 홀 = B300, 프린스조지 공랭 홀 = H200·B200·B300·MI350X, 프린스조지 초기 파일럿 = H100·H200. 표 글자는 모델 글자에서 괄호 설명과 'NVL72' 를 뺀 것이고, 이름에 같은 모델 글자가 있으면 이름에서 빼서 표로만 보여 줌 — '공랭 B300 홀' → '공랭 홀' + B300), 골랐을 때 'GPU · Vera Rubin (설계 기준)' 같은 줄이 나옵니다. GPU 수 추정은 `hallEstimate.js` 의 Vera Rubin 가정(랙당 72개, GPU 1개당 약 3.0kW — NVIDIA 미발표, 업계 추정 랙 190–230kW 의 가운데 ÷ 72 + 네트워크·저장장치 몫)을 쓰고, 패널 설명에 그 근거를 적습니다.
- **다시 만들기·검사**: `node scripts/anatomy/sweetwater/build.mjs` (`--audit` 로 관통·끝점·지지·칠하는 순서). 그리기 도구(관·이음쇠·애자·도랑 창·도장)는 `scripts/anatomy/shared/tools.mjs` 에 있고, 같은 모양의 애자·이음쇠 공은 한 번만 그리고 `<use>` 로 복사해 파일을 줄입니다.

## 주가·뉴스 페이지와 자동 갱신

상단 네비 [지도 | 주가 | 뉴스] 로 전환합니다 (`#page=stock`, `#page=news`, 주가 강조 날짜 `&at=YYYY-MM-DD`).

- 주가: `public/data/stock.json` — Nasdaq 공개 일봉(상장 2021-11-17부터). `node scripts/fetch-stock.mjs` (증분, `--full` 전체)
- 뉴스: `public/data/news.json` — [회사 발표] SEC EDGAR 제출(8-K 첨부 보도자료 제목·실적·공시·내부자), [언론] Google 뉴스 RSS. `node scripts/fetch-news.mjs [--max=N] [--retry-titles]`
- 주식 수·희석: `data/shares.json` (SEC 공시 424B4·20-F·10-K·10-Q 의 발행 주식 수, ATM·직접 공모 조달, 전환사채 원금·최초 전환가 — 항목마다 원문 링크) → 빌드가 검사해 `public/data/shares.json`. 주가 페이지 아래 "주식 수 · 희석" 칸이 같은 기간 축의 주식 수 차트·조달 표·전환사채 표를 보여 줌 (전환 시 주식 수는 최초 전환가 단순 계산). 새 10-Q·10-K 표지 주식 수는 `node scripts/fetch-shares.mjs` 가 SEC XBRL 에서 덧붙이고, ATM·전환사채는 공시 본문에서 사람이 옮김
- `.github/workflows/refresh.yml` 이 하루 두 번 — 다음 날 아침(화~토 11:30 UTC, 전날 종가: Nasdaq 일봉 표는 장 마감 뒤 몇 시간이 지나야 그날 행이 올라옴)과 장 마감 직후(월~금 22:30 UTC, 그날 공시·언론) — 세 스크립트(주가·뉴스·주식 수)를 돌려 바뀐 파일을 커밋 → Vercel 자동 배포. 이어서 `scripts/check-asof.mjs` 가 사이트 숫자의 기준일(as_of) 뒤에 나온 회사 공시(내부자 거래 제외)를 찾아 `public/data/asof-check.json` 에 적고(현황 페이지가 "기준일 뒤 회사 공시 n건 — 아직 반영 전" 안내, 뉴스 페이지는 그 줄에 "기준일 뒤 · 미반영" 표시), GitHub 이슈(표 "기준일 갱신") 하나를 열거나 고쳐 씀 — 기준일을 옮기면 다음 갱신 때 저절로 닫힘. 시험: `node scripts/check-asof.mjs --dry --as-of=2026-08-01`. 소스가 막히면 기존 파일 유지(사이트는 정상). 수동 실행: GitHub Actions → refresh-data → Run workflow
- 차트의 사건 마커는 이 레포의 타임라인 데이터(회사 발표 기준)이며 주가 인과를 뜻하지 않습니다. 투자 조언이 아닙니다.
- **언론 제목 기계 번역**: 한국어 화면의 언론 탭은 영어 원문 아래에 기계 번역 한 줄을 붙입니다(원문이 기준). 모델은 Hugging Face 의 `kakaocorp/kanana-1.5-2.1b-instruct-2505`(Apache-2.0)입니다. 2026-10-26 에 opus-mt-tc-big-en-ko·Qwen3-1.7B 와 제목 50개로 비교해 골랐습니다. `scripts/translate/translate_titles.py` 가 새 제목만 후보로 만들고, `scripts/apply-translations.mjs` 가 검사기(`src/data/translateGuard.js`)를 통과한 것만 `public/data/news-ko.json` 에 넣습니다. 검사기는 숫자·금액(`$2.8bn` 그대로)·티커·거래소 표기가 원문과 같은지, 한자나 남은 영어 요일이 없는지 봅니다. 작은 모델이 "$2.8bn → 2.8억 달러"처럼 단위를 틀리는 일이 실제로 있었습니다. 회사·매체·사람 이름은 고유명사 표(`src/data/translateNames.json`)의 원문 표기나 정해 둔 한국어 표기로만 통과하고, 원문에 없는 영어 낱말을 지어낸 번역도 뺍니다. 2026-10-27 검토에서 'IREN Limited' → 'IREN 제한회사'(9건 중 9건), 'Applied Digital' → '적용 디지털', 매체 'The Information' → '정보 제공' 같은 오역이 숫자 검사를 그대로 통과했기 때문입니다. 같은 표를 번역 지시문에도 붙입니다. 검사기를 고치면 `apply-translations.mjs` 가 이미 들어간 번역도 다시 검사해 탈락한 것을 뺍니다(이때 122개 중 26개를 뺌). 나머지는 원문만 보입니다. 회사 발표(SEC) 제목은 공식 문장이라 번역하지 않습니다. `refresh.yml` 이 매번 CPU 로 새 제목만 번역합니다(모델 캐시, 실패해도 다른 갱신은 계속). Kanana 1.5 는 transformers 5 의 설정 검사에 걸려 `scripts/translate/requirements.txt` 에 4.x 를 고정했습니다.
- **위성 사진(Sentinel-2)**: 캠퍼스 패널 '현황' 탭의 '위성으로 본 변화'는 미국 부지 4곳 주변 4km 칸의 월별 사진(10m 해상도)입니다. `scripts/satellite/fetch_sentinel.py` 가 Microsoft Planetary Computer 의 공개 목록에서 달마다 부지 칸의 구름(SCL)이 가장 적은 장면을 골라 `public/satellite/<부지>/<YYYY-MM>.jpg` 와 `public/data/satellite.json` 을 늘립니다. 계정은 필요 없고, 공개 서명 토큰을 한 번 받아 다시 씁니다. 사진마다 서명을 받으면 429 로 막힙니다. `.github/workflows/satellite.yml` 이 매달 3일·17일에 새 달만 받습니다. 출처 표기 "Contains modified Copernicus Sentinel data"는 칸 아래에 있습니다. 위성 사진은 관찰 자료라 공식 상태를 바꾸지 않습니다.

## 경영진 발언 · 약속 장부 (시드니 본사)

지도에서 시드니 본사 카드를 누르거나(지도의 '본사' 단추는 시드니로 이동만) ≡ 메뉴 '경영진 발언' 을 누르면 **본사 3D 화면**으로 들어갑니다 (`#hq=1`, 캠퍼스 3D 처럼 돌려 보기·하늘 모드). 가운데는 55 Market Street 20층 빌딩(`src/scene/HqView.jsx` · 모양 계산 `hqTower.js`, 층수·IREN 층은 `data/companies.json` 의 `hq.building` — 층수 = 건물 소유사 Mirvac, IREN = Level 5 = 공시 주소, `moved_from` = 2026-05-08 분기 보고서 전엔 Level 6)이고 윤곽은 OpenStreetMap 입니다: 아래 3층은 땅 윤곽 전체(포디움 · FK 2021 리모델링의 3층 높이 유리 로비), 그 위는 모서리를 깎은 탑 윤곽('City Centre' 조각). 벽은 창문 그림(`facade.js`, 캔버스로 한 번 그려 모든 벽이 나눠 씀 — 밤엔 하늘 모드의 불빛 세기를 따라 창문에 불이 켜짐)이고 IREN 층은 초록 유리 + 초록 빛 띠로 표시합니다. 둘레는 실제 동네입니다(`HqCity.jsx` · 배치 `hqCity.js` · 자료 `public/data/hq-city.json`): 바닥 판(약 220m) 안의 OpenStreetMap 건물 윤곽·층수(층수가 없으면 종류별 어림값), 차도·Pitt St Mall(차 없는 보행자 거리)·조지 스트리트 경전철 선로·횡단보도, OSM 가로수 위치, 시드니 타워(OSM 조각 그대로 309m). 가로등·자동차는 꾸밈입니다. 차는 Market St·Pitt St 차로를 따라 움직이고(호주식 왼쪽 통행, 교차로에서 이어지는 차로로 꺾음 — `hqTraffic.js` · 그리기 `HqTraffic.jsx`, 차 모형은 캠퍼스 소품과 같은 Kenney CC0), 차 없는 Pitt St Mall 에는 걷는 사람이 오갑니다. 포디움 길 쪽 벽의 전광판(`HqTicker.jsx` · 글자 `src/data/hqTicker.js`)은 전일 종가(`public/data/stock.json`)와 다가오는 실적 발표·주총까지 남은 날(`companies.json` 의 `events`)을 흘려 보여 줍니다 — 그림 표현이고 실제 빌딩에 이런 전광판은 없습니다. 지도에서 들어오면 카메라가 위에서 내려옵니다(`hqTower.hqStartPose`). 움직임 줄이기 설정이면 차·사람·전광판이 멈추고 카메라도 바로 처음 시점입니다. 이웃 빌딩은 건축 모형처럼 밝게 칠해 본사만 또렷하게 하고, 돌려서 볼 때 본사 탑(5층~옥상)을 가리는 빌딩은 `hqCity.occludersOf` 가 골라 흐리게 그립니다. 처음 카메라는 남동쪽 위입니다(`hqTower.HQ_VIEW` — 방위마다 가림을 세어 본사 동쪽 벽이 가리지 않는 쪽). 빌딩에 붙는 것(`src/ui/HqParts.jsx`): 옥상 위 CEO 카드(큰 사진 · 이름 · 발언 수 · 아래 약속 성적표)와 그 오른쪽 최근 발언 말풍선(7초마다 다음 발언). 어디를 눌러도 카드는 약속 타임라인 탭이 먼저 열림 — 말풍선은 보이는 발언에 걸린 약속을 펼치고 사진으로 열면 발언 탭에서 그 사람 발언만, 빌딩 왼쪽 모서리의 'IREN · 5층' 표시(카메라를 돌려도 화면 왼쪽 모서리를 따라감). 카메라는 이 둘이 들어갈 자리(`hqTower.hqLabelRoom`)를 비워 두고 빌딩을 맞춥니다. 카드는 가운데 대화상자(`src/ui/StatementsCard.jsx`, Esc·바깥을 누르면 닫힘)이고 탭이 둘입니다 — 열려 있으면 주소에 `card=promises|statements` 가 붙어 공유 링크로 바로 열림(이 링크는 첫 화면 그림을 건너뜀). **약속** 탭(`src/ui/PromiseTimeline.jsx` · 계산 `src/data/promiseTimeline.js`)은 약속마다 한 줄 타임라인: 회색 막대 = 처음 말한 날 → 기한, 남색 눈금 = 기한, 초록 점 = 이룬 날, 주황 = 기한이 지난 뒤 흐른 시간, 자주 × = 철회, 남색 작은 점 = 그 약속을 다시 말한 날, 주황 고리 = 회사가 기한을 미룬다고 밝힌 날, 세로 줄 = 확인 기준일. 결과가 나온 약속 → 기한 전(기한마다 묶고 남은 기간)을 기한 순으로 늘어놓고, 판정 단추로 거르고, 줄을 누르면 판정 근거와 그 약속을 말한 발언을 펼칩니다(마우스를 올리면 날짜 풍선 · 세로 선이 그 자리 날짜를 보여 줌). 색은 dataviz 색 검사를 통과한 값(`statements.css` 의 `--tl-*`)이고, 판정은 색만이 아니라 아이콘·글자로도 표시합니다. **발언** 탭(계산 `src/data/statementFeed.js`)은 달별 묶음: 한국어 요약이 본문, 약속은 칩 하나(누르면 약속 탭의 그 줄로), 영어 원문은 접어 둠, 한 문장에 약속이 둘이면 한 줄에 칩 둘. ≡ 메뉴의 'CEO 약속 타임라인' 은 어느 화면에서든 본사 화면 + 약속 탭으로 갑니다(`useAppStore.showHq('promises')`). CEO 카드 성적표 아래에는 다음 기한 한 줄(기한 전 약속 중 가장 이른 기한 · 약속 수 · 남은 기간, `promiseTimeline.nextDeadline` — 휴대폰은 카드를 작게 두려고 숨김)이 있습니다. 기한 전 약속도 회사가 밝힌 진행 숫자(`progress`)가 있으면 줄 글자에 '진행 n%'(단위가 같을 때, `promises.progressPct`), 펼친 곳에 진행 양과 그 근거 자료를 보여 줍니다. 캠퍼스에 걸린 약속은 `data/statements.json` 의 `site`(일부는 `building`)로 캠퍼스와 이어져, 약속 줄을 펼치면 '○○ 현장 3D 보기' 단추가 나오고 캠퍼스 패널에는 '경영진 약속 · 이 캠퍼스' 칸(`src/ui/SitePromises.jsx`, 따로 불러옴)이 생깁니다 — 칸의 줄을 누르면 본사 화면 약속 타임라인에서 그 약속이 펼쳐집니다. 캠퍼스·건물이 실제로 있는지는 `scripts/validate.mjs` 가 확인합니다. 휴대폰(767px 이하)은 옥상 위엔 CEO 카드만, 말풍선은 화면 아래(`src/ui/HqDock.jsx`)에 붙입니다. CEO 카드·지도 본사 카드에는 발언이 하나라도 있는 사람만 나옵니다(`statementRows.speakers` — 지금은 Daniel Roberts. 공동 CEO Will Roberts 는 찾은 발언이 없어 화면에서 빼고 카드에 한 줄로 이유를 밝힘, 자료엔 남아 있어 발언을 넣으면 저절로 나타남). 뒤로 가기는 시드니 지도로. 두 공동 CEO(Daniel · Will Roberts)가 2023-08-29 AI 전환 뒤 한 말 중 기한과 대상이 분명한 AI·데이터센터 약속을 원문 링크와 함께 보여 주고, 약속마다 판정을 붙입니다.

- 자료: `data/statements.json` (people · statements · promises) → 빌드가 `src/data/statementsSchema.js` 로 검사해 `public/data/statements.json`. 사진은 `public/people/<id>.jpg` (IREN 팀 페이지 사진을 160px 로, `photo_source` 로 출처 표시)
- 판정은 손으로 적지 않고 `src/data/promises.js` 의 `verdictOf` 가 기준일(`checkedAt`)로 계산: 지켜짐 · 늦게 지켜짐 · 늦어짐 · 철회 · 기한 전. 기한 = 기간의 끝(FY 는 7월 시작), '약'·'최대'는 95% 이상, 회사가 미뤄도 원래 기한으로, 목표를 줄였으면 줄인 목표로 판정(원래 목표도 표시). 이룸·줄임·미룸·철회 근거는 회사 자료(sec.gov · iren.com · iren.gcs-web.com · globenewswire.com)만
- 발언 채널: 보도자료 속 CEO 인용 · 실적 발표 콜(SEC 녹취록 → 공개 녹취록·영상) · X(Daniel Roberts @danroberts0101, 날짜는 미국 동부) · 인터뷰. 의견은 최근 90일에서 눈에 띄는 것만

**발언 자료 갱신 방법** (실적 발표 뒤, 또는 요청 시)
1. 새 보도자료·콜·X 글에서 공동 CEO 의 약속(기한 + 대상)을 찾아 `data/statements.json` 에 발언을 더하고, 같은 약속이면 같은 `promise` id 를 겁니다 (목표를 올린 건 새 약속)
2. 기존 약속마다 회사 자료로 `fulfilled`·`reduced`·`postponed`·`withdrawn`·`progress` 를 붙이고 `checkedAt` 을 확인한 날로 바꿉니다
3. `npm run data && npm run validate` (오류 0) → 판정이 바뀐 약속을 사람이 확인하고 `data/changelog.json` 에 한 줄
- 처음 자료의 조사·판단 기록: `docs/superpowers/specs/2026-10-21-ceo-statements/review.md`

## 영상 만들기 (X·쇼츠용)

같은 스토리보드로 16:9(1920×1080)와 9:16(1080×1920) 영상을 자동으로 만듭니다.
헤드리스 Chrome(임시 프로필)이 화면을 한 프레임씩 그려 PNG 로 저장하고, 끝나면 ffmpeg 가 mp4 로 합칩니다.

```bash
npm run build
node scripts/record-server.mjs all              # 16:9 + 9:16 → video/ai-infra-map-x-ko.mp4, video/ai-infra-map-shorts-ko.mp4
node scripts/record-server.mjs x --lang=en      # 영어 자막 16:9
node scripts/record-server.mjs shorts --only=3,13,25   # 그 시점만 미리보기 PNG (video/preview-*.png)
node scripts/record-server.mjs og --only=13           # 링크 미리보기 1200×630 → ffmpeg 로 public/og.jpg 저장
```

- 장면 순서·카메라 동선·자막은 `src/record/storyboard.js` 의 시간표만 고치면 됩니다.
- 영상 위 라벨·자막은 `src/record/overlay.js` 가 2D 캔버스에 직접 그립니다 (HTML 라벨은 캡처되지 않음).
- 렌더 루프를 멈추고 프레임마다 시각을 지정하므로, 컴퓨터 속도와 상관없이 정확히 30fps 로 찍힙니다.
- 필요 조건: Google Chrome, ffmpeg (`brew install ffmpeg`). 결과물 `video/` 폴더는 git 에 올리지 않습니다.

### 한국어 내레이션 (Qwen3-TTS 'Sohee')

영상에 한국어 목소리를 입힙니다. 모델은 `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`(Apache-2.0, 약 2.5 GB, 판 고정)의 한국어 여성 목소리 'Sohee'입니다. 처음 실행할 때 Hugging Face 에서 받습니다.

```bash
python3 -m venv ~/.venvs/iren-tts
~/.venvs/iren-tts/bin/pip install -r scripts/narrate/requirements.txt
~/.venvs/iren-tts/bin/pip install --no-deps qwen-tts==0.1.1
PYTHON=~/.venvs/iren-tts/bin/python node scripts/narrate/narrate.mjs   # → video/narration-ko.wav
node scripts/record-server.mjs all                                     # 영상에 소리가 자동으로 들어감
```

- 읽을 문장은 `src/record/storyboard.js` 의 `NARRATION` 에 자막과 따로 씁니다. 자막 조각을 그대로 읽으면 어색하기 때문입니다.
- `narration.test.js` 가 문장을 검사합니다. 그 시간대 화면 자막에 없는 숫자는 쓸 수 없고, 회사·지명은 한글로 씁니다(IREN = 아이렌, Childress = 차일드레스). 영어 글자를 쓰면 TTS 가 낱자로 읽기 때문입니다.
- `narrate.mjs` 는 문장마다 소리를 만들고, 앞뒤 무음과 0.3초가 넘는 쉼을 줄인 뒤, 각 문장을 `t0` 에 놓습니다. `t1` 을 넘기면 1.15배까지 빠르게 하고, 그래도 넘치면 어느 문장을 줄일지 알려 주고 멈춥니다.
- 만든 소리는 문장별로 `video/narration/ko/cache/` 에 남습니다. 문장을 고친 줄만 다시 만듭니다(맥북 MPS 기준 한 줄에 약 10초, 모델 불러오기 약 10초).
- 스토리보드 문장을 고친 뒤 내레이션을 다시 만들지 않으면, 녹화 스크립트가 옛 소리를 넣지 않고 소리 없이 만들며 알려 줍니다.
- 영어 영상은 아직 소리가 없습니다(`NARRATION.en` 없음).

## 배포 (Vercel)

1. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New → Project** → `KYC32/iren-3d` Import
2. 프레임워크는 Vite 로 자동 감지됩니다 (Build `npm run build`, Output `dist`). 그대로 **Deploy**
3. 이후 `main` 브랜치에 push 할 때마다 자동 배포, PR 마다 프리뷰 URL 이 생깁니다.

## 기술 스택

Vite 8 · React 19 · @react-three/fiber 9 · @react-three/drei 10 · three 0.186 · zustand 5 · zod 4 · lucide-react

육지 타일과 경계선은 `npm run geo`(h3-js + Natural Earth 110m + us-atlas)로 미리 계산해 `public/data/land-hex.json`, `borders.json` 에 저장합니다.
사이트 주변 반경 6도는 더 작은 육각형(h3 해상도 4)으로 그립니다. 사이트를 추가했다면 `npm run geo` 를 다시 실행하세요.

캐나다·호주 주 경계(BC주·남호주 강조 포함)는 Natural Earth 50m 원본에서 가져옵니다.
처음 한 번 `npm run geo:fetch` 로 원본(2.3MB)을 `scripts/.cache/` 에 받아 두면 됩니다. 이 폴더는 git 에 올리지 않습니다.
캐시가 없으면 `npm run geo` 는 그 부분만 건너뛰고 나머지를 정상 생성합니다.
h3와 보드 지도 생성용 라이브러리는 빌드 스크립트에서만 사용합니다. 실제 지도용 MapLibre는 별도 지연 로딩 청크로 제공됩니다.

## 폴더

```
data/companies.json         회사 지표·계약·일정
data/companies/iren.json    사이트·건물(시점 이력) — 유일한 진실
data/changelog.json         데이터 갱신 기록
public/data/infra.json      위 원본을 합친 것 (npm run data 가 생성)
public/data/board-hex.json  보드판 육각 타일·경계선 (npm run geo 로 생성)
public/data/land-hex.json   지구본 육지 타일 (npm run geo 로 생성, 영상 인트로용)
public/data/borders.json    국경·해안선·미국 주 경계 (npm run geo 로 생성)
src/data/                   스키마(zod), 시간 함수(timeline.js), 사건(events.js), 상태 색상표
src/scene/                  3D: BoardView(boards.js), GlobeView, SiteView, CameraRig, layoutCampus, buildings/
src/ui/                     HTML 오버레이 패널들
src/i18n/                   한/영 문자열
scripts/                    build-data, validate, build-board-hex, build-land-hex, build-borders, record-server
docs/research-brief.md      참고 사례·코드·데이터 출처 리서치
```

## 지도 데이터 출처

사이트 안에서는 ≡ 메뉴의 '데이터·출처' 칸(`src/ui/DataSources.jsx`)이 자료·모델·3D 소재의 라이선스와 쓰는 곳을 한곳에 모아 보여 줍니다. 화면 아래 '데이터·출처' 링크도 이 칸을 엽니다. 자료를 새로 넣거나 빼면 이 칸과 아래 목록을 함께 고칩니다.

- Natural Earth (퍼블릭 도메인): 국경·해안선 110m(world-atlas 경유), 주·도 경계 50m — https://www.naturalearthdata.com
- us-atlas: 미국 주 경계 (U.S. Census Bureau 자료 기반)
- h3-js: 육각 격자 (Uber H3)
- IM3 Open Source Data Center Atlas v2026.02.09 (ODbL 1.0 · © OpenStreetMap contributors): 실제 지도 '주변 데이터센터' 층(기본 꺼짐)의 미국 기존 데이터센터 1,474곳 — https://huggingface.co/datasets/sarkarghya/im3_open_source_data_center_atlas_v2026.02.09 (판 번호 고정). `node scripts/fetch-im3.mjs` 로 `public/data/im3-datacenters.json` 을 다시 만듭니다. 이 파일은 ODbL 자료에서 만든 파생 데이터베이스라 같은 ODbL 로 공개합니다. 출처 문구는 지도 아래 출처 표기에 자동으로 붙습니다. 층 코드(`src/map/DataCenterLayer.jsx`)는 지도를 띄운 뒤 따로 불러와 지도 묶음 크기 한도에 들지 않습니다.

- OpenStreetMap (ODbL 1.0 · © OpenStreetMap contributors): 본사 3D 화면의 동네 — 55 Market Street 둘레의 건물 윤곽·층수·길·가로수. `node scripts/fetch-hq-osm.mjs` 로 `public/data/hq-city.json` 을 다시 만듭니다(Overpass API). 이 파일은 OSM 에서 만든 파생 데이터베이스라 같은 ODbL 로 공개합니다. 출처는 본사 화면 아래와 약속 카드의 건물 설명에 표기합니다. 배치 계산(`src/scene/hqCity.js`)은 본사 화면에 들어갈 때만 받습니다.

## 참고한 사례

- Dilum Sanjaya 의 WareTrack 데모 (x.com/DilumSanjaya/status/2106426962738880879) — 전체 콘셉트
- austin410203/warehouse, cahitberkay/waretrack — 카메라·조명·"스토어가 진실, 3D 는 투영" 구조 (코드는 복사하지 않음)
- dgreenheck/simcity-threejs-clone — 상태별 건물 단계 표현
- vasturiano/three-globe — 지구본 좌표계·레이어 아이디어

## 근거 데이터와 운영

`data/research.json`은 검토한 문서, 항목별 진술, 일정 이력, 사진 메타데이터, 위치 검토 기록의 원본입니다. 빌드가 스키마와 참조를 검증해 infra.json에 포함합니다. 2026-10-17 기준 건물 21동 중 20동이 원문 검토를 마쳤습니다(남은 1동 = 프린스조지 H100/H200 파일럿: 10-K 의 "보유 GPU 에 H100·H200 포함"과 2025-12 퇴역 추정이 엇갈려 검토 대기)(`auditedBuildings`: 회사 공시·보도자료·발표 자료로 단계·MW 를 확인, 회사가 밝히지 않은 IT MW 는 비워 둠). 검토를 마친 건물은 확인된 진술(`review: verified`)로만 단계가 나아가고, 사용자 결정과 걸리는 새 근거는 `pending` 으로 남겨 반영하지 않습니다(예: 프린스조지 공랭 홀 "commissioned").

`data/observations.json`은 설비 이중화(회사 홈페이지의 "IREN 소유 현장 변전소·이중 광케이블" 등)와 제3자 현장 관찰(드론·열화상 — 예: 매켄지 홀 4개 × 2.5MW 세그먼트 8칸 설치 개수)을 모은 파일입니다. 빌드가 `src/data/observationsSchema.js` 규칙(관찰은 관찰일·게시일·관찰자·원문 필수, 게시일 이후에만 표시)으로 검증해 `public/data/observations.json`으로 따로 내보내고, 캠퍼스 패널 "현황" 탭이 열릴 때만 불러옵니다. 제3자 관찰은 공식 상태(건설·가동)를 바꾸지 않고 근거로만 보여 줍니다 — 채용 선행지표와 같은 원칙.

- `reported`, `target`, `estimate`는 정보의 성격이며 `verified`, `pending`, `conflict`는 원문 검토 상태입니다. 원문이 확인된 목표도 실적이 아닙니다.
- 차일드레스 Horizon 1~4의 고객 인수·시운전·건설 단계와 Microsoft/NVIDIA 계약 원문을 확인했습니다. Horizon 1 고객 인수는 상태 이름은 '고객 인수'로 두고 AI 가동 전력에 포함해 집계합니다(가동 카드에 "고객 인수 75 MW 포함"으로 표시). NVIDIA 약 60MW는 IT/총전력 기준이 명시되지 않아 단위별 합계에서 분리했습니다.
- 기존 수치와 검토된 기록을 혼합해 전부 검증됐다고 표시하지 않습니다. 숫자 공정률은 새 현황 화면에서 숨깁니다. 원문 공개일을 모르는 기존 기록은 데이터 기준일 이후에만 노출하므로 과거 화면은 불완전할 수 있습니다.
- 3D 외형 참조는 `src/scene/campusAppearance.js`에서 관리합니다. Childress의 기존 채굴동 외형만 공식 사진으로 보정했으며 AI 건물·동수·배치는 용량을 설명하는 구성도입니다. 다른 캠퍼스에는 Childress의 외형을 일괄 적용하지 않습니다.
- 현재 9개 위치 모두 부지 정합 재검토가 필요합니다. 기존의 공식 주소 분류도 좌표 검증을 대체하지 않으며, 지역 마커로 표시하고 자동 확대를 줌 9로 제한합니다.
- 프로젝트 소유자의 사용 허용에 따라 IREN 공식 홈페이지 사진 3장을 로컬 자산으로 표시합니다. 원본 주소·출처·이용 근거를 기록하고 확대·2장 비교를 제공합니다. IR 자료 2건은 원문 링크로 유지합니다. 홈페이지 사진의 게시일·촬영일은 미상이며, 검토 시점(2026-10-08) 이전 월에는 표시하지 않습니다. 확인일을 촬영일·게시일로 바꾸지 않으며, 특정 건물로 식별되지 않은 사진은 캠퍼스 수준에서만 표시합니다.
- 새 문서를 추가할 때 발표일, 문서 내 위치, 검토일을 기록하고 목표를 덮어쓰지 말고 revisions에 추가합니다. 같은 대상·완료 조건만 한 일정에 묶습니다. 다른 범위는 별도 일정으로 남깁니다.
- 현장 사진 설비 후보 찾기: `scripts/vision/find_equipment.py` 가 드론·회사 사진에서 크레인·굴착기·트럭·변압기 같은 설비 후보에 번호 상자를 그립니다. 검출은 OWLv2(`google/owlv2-base-patch16-ensemble`), `--masks` 를 주면 SAM 2.1(`facebook/sam2.1-hiera-small`)로 윤곽 면적도 잽니다(둘 다 Apache-2.0). 결과는 후보일 뿐입니다. 사람이 번호 그림을 보고 맞는 것만 골라 `data/observations.json` 에 적습니다. 스위트워터 항공 사진 시험에서는 후보 54개에 틀린 이름도 섞여 있었습니다. 회사·제3자 사진과 결과 그림은 저장소에 넣지 않고 `--out` 폴더(저장소 밖)에만 둡니다. 필요한 패키지는 `scripts/vision/requirements.txt` 에 있습니다.
- 캠퍼스 3D 소품: 쓰거나 짓는 건물이 있는 캠퍼스에는 왼쪽 칸(변전소와 하역장 사이)에 주차장을 그립니다. 차 수는 그런 건물 수에 따라 늘고(2 + 건물 수 × 2, 최대 8대) 실제 직원 수가 아닙니다. 건설중 건물 옆에는 굴착 트랙터·라바콘·자재 컨테이너를 둡니다(크레인은 원래 있음). 모두 그림 표현이라 범례에도 적었습니다. 자리는 `src/scene/campusProps.js`(테스트 있음)가 정하고 `src/scene/buildings/CampusProps.jsx` 가 캠퍼스를 연 뒤 따로 불러와 그립니다. 모형은 `scripts/blender/campus-props.py` 가 Kenney 의 Car Kit 3.1 과 City Kit (Industrial) 2.0(둘 다 CC0, https://kenney.nl)에서 8가지만 골라 만듭니다. 색표 텍스처를 꼭짓점 색으로 구워 차분한 색으로 바꾸고, 차의 삼각형을 35%로 줄이고, 법선을 빼서 `public/models/campus-props.glb.gz`(56 KiB)로 냅니다. 다시 만들 때는 kenney.nl 에서 두 zip 을 받아 `<폴더>/car`, `<폴더>/city` 에 풀고 `blender -b --factory-startup -P scripts/blender/campus-props.py -- <폴더> public/models/campus-props.glb.gz` 를 실행합니다.
- `npm run validate`, `npm test`, `npm run build`로 확인합니다. 단위 테스트는 정보의 사실성을 보장하지 않으므로 문서 원문 검토도 필요합니다.
- 지도 배경은 현재 제공 데이터입니다. 타임라인이 과거여도 과거 지형 영상이 아닙니다. 지도 배경에는 위성영상이 없습니다(위성 사진은 캠퍼스 패널 '위성으로 본 변화' 칸에만 있음). 타일 실패 시에도 목록·상세는 독립적으로 동작합니다.

OpenFreeMap / OpenMapTiles / OpenStreetMap 출처 표시는 지도에 유지합니다. 유료 가입·API 키·자동 자료 게시 기능은 없습니다. 녹화 모드는 기존 자료의 시나리오 연출을 유지하며 투자자용 확인 현황과 구별됩니다.
