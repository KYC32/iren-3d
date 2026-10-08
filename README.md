# IREN 3D — 데이터센터 현황판

IREN(NASDAQ: IREN)의 캠퍼스를 실제 지도에서 탐색하고, 건물별 진행 상황·계획 이력·근거 자료를 확인하는 비공식 리서치 웹앱입니다.
MapLibre GL JS + OpenFreeMap 지도를 기본으로 사용하며, 캠퍼스 목록은 지도 확대, 지도 마커는 3D 사업 구성도로 연결합니다.

엔진은 [ai-infra-map](https://github.com/KYC32/ai-infra-map) `5257a98` 을 **단일 회사 모드**(`src/config.js`)로 가져온 것입니다.
보드판 지도·사건 눈금·다가오는 일정·계약 연결선·갱신 기록은 이 레포에서 추가했습니다.

> 본 프로젝트는 IREN Ltd 와 무관한 개인의 비공식 프로젝트입니다. 모든 수치는 공개 자료에서 수집했고 항목마다 출처를 표기했습니다. 투자 조언이 아닙니다.

## 화면 구성

| 화면 | 내용 |
|---|---|
| 실제 지도 | OpenFreeMap Positron, 북미 중심 첫 화면, 접을 수 있는 캠퍼스 목록, 이름·용량·3D 진입을 담은 카드 표식, 가까운 캠퍼스 그룹, 국가 이동. 전체 보기는 날짜변경선을 연결해 미국 중심으로 배치. 위치 원문을 재검증하지 못한 곳은 지역 위치로 표시 |
| 상세 패널 | 현황 / 계획 이력 / 사진·근거, 건물·고객 구역 선택, 출처 공개일·검토일 |
| 3D 구성도 | Childress 공식 사진의 저층 채굴동·청회색 외벽·금속 지붕·환기 설비·건조 지형 반영. 텍사스 초지·캐나다 숲·남호주 관목 등 지역별 경관. 고객 구역과 용량 배치는 개념도 |
| 타임라인 | 확인된 상태와 목표를 분리. 미래 날짜에서도 실적은 마지막 근거 시점에 고정 |

딥링크: `/#site=childress&building=horizon-1&tab=history` 또는 `/#site=childress&surface=3d&zone=microsoft`.
기존 `site` / `date` 링크는 실제 지도 상세로 열립니다. 지도 마커를 클릭하면 `surface=3d`로 즉시 진입하고, 목록을 선택하면 해당 캠퍼스를 지도에서 확대합니다. 화면 전환 시 지도 위치는 세션 내에서 복원합니다. 미국 중심 세계지도 한 장의 경계 안에서 이동하며, 화면 크기에 맞춘 최소 줌으로 가로 반복을 방지합니다.

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
- 캠퍼스 카메라는 실제 패널 크기를 제외한 영역에 부지 전체를 맞춥니다. 상단 `전체 보기`로 선택을 해제하고 기본 구도로 돌아옵니다. 화면 크기가 바뀌면 다시 맞춥니다.
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
- 건물·울타리·도로·경관의 위치와 크기는 구성도입니다. 나무와 배경은 촬영 시점·현재 계절을 재현하지 않습니다. Sweetwater 1의 풍력발전기는 공식 사진에 보이는 주변 경관이며 캠퍼스 전력 공급원을 뜻하지 않습니다. 각 상세 패널의 ‘사진을 참고한 경관 · 출처’에서 확인할 수 있습니다.

## 데이터 갱신 방법 (가장 자주 하는 일)

1. 사이트 데이터는 `data/companies/iren.json`, 회사 지표·계약·일정은 `data/companies.json` 에 있습니다.
   - 건물 상태는 "바뀐 시점" 목록(`phases`)으로 적습니다. 예) `{ "status": "operating", "from": "2026-Q4", "basis": "target" }`
   - `basis`: `reported`(발표된 사실) · `target`(회사 목표) · `estimate`(우리 추정, `estimates` 에 근거 필요)
   - 기존 건물 전력을 재사용하는 전환(예: 채굴동 → AI 홀)은 `replaces: "<기존 건물 id>"`
   - 고객 계약은 `contracts`(사이트·건물 연결), 실적 발표 같은 회사 일정은 `events`
2. **`data/changelog.json` 맨 위에 오늘 날짜로 바뀐 내용을 적습니다.** 데이터 기준일보다 최신 기록이 없으면 빌드가 실패합니다.
3. `npm run validate` 로 검사합니다. 스키마·날짜 순서·매달 전력 합계·좌표·계약 참조·갱신 기록을 확인합니다.
4. 사이트를 추가하거나 좌표를 바꿨다면 `npm run geo` (보드판·지구본 타일 다시 계산).
5. `git commit` → `git push` 하면 Vercel 이 자동으로 다시 배포합니다.

## 영상 만들기 (X·쇼츠용)

같은 스토리보드로 16:9(1920×1080)와 9:16(1080×1920) 영상을 자동으로 만듭니다.
헤드리스 Chrome(임시 프로필)이 화면을 한 프레임씩 그려 PNG 로 저장하고, 끝나면 ffmpeg 가 mp4 로 합칩니다.

```bash
npm run build
node scripts/record-server.mjs all              # 16:9 + 9:16 → video/iren-x-ko.mp4, video/iren-shorts-ko.mp4
node scripts/record-server.mjs x --lang=en      # 영어 자막 16:9
node scripts/record-server.mjs shorts --only=3,13,25   # 그 시점만 미리보기 PNG (video/preview-*.png)
node scripts/record-server.mjs og --only=13           # 링크 미리보기 1200×630 → ffmpeg 로 public/og.jpg 저장
```

- 장면 순서·카메라 동선·자막은 `src/record/storyboard.js` 의 시간표만 고치면 됩니다.
- 영상 위 라벨·자막은 `src/record/overlay.js` 가 2D 캔버스에 직접 그립니다 (HTML 라벨은 캡처되지 않음).
- 렌더 루프를 멈추고 프레임마다 시각을 지정하므로, 컴퓨터 속도와 상관없이 정확히 30fps 로 찍힙니다.
- 필요 조건: Google Chrome, ffmpeg (`brew install ffmpeg`). 결과물 `video/` 폴더는 git 에 올리지 않습니다.

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

- Natural Earth (퍼블릭 도메인): 국경·해안선 110m(world-atlas 경유), 주·도 경계 50m — https://www.naturalearthdata.com
- us-atlas: 미국 주 경계 (U.S. Census Bureau 자료 기반)
- h3-js: 육각 격자 (Uber H3)

## 참고한 사례

- Dilum Sanjaya 의 WareTrack 데모 (x.com/DilumSanjaya/status/2106426962738880879) — 전체 콘셉트
- austin410203/warehouse, cahitberkay/waretrack — 카메라·조명·"스토어가 진실, 3D 는 투영" 구조 (코드는 복사하지 않음)
- dgreenheck/simcity-threejs-clone — 상태별 건물 단계 표현
- vasturiano/three-globe — 지구본 좌표계·레이어 아이디어

## 근거 데이터와 운영

`data/research.json`은 검토한 문서, 항목별 진술, 일정 이력, 사진 메타데이터, 위치 검토 기록의 원본입니다. 빌드가 스키마와 참조를 검증해 infra.json에 포함합니다.

- `reported`, `target`, `estimate`는 정보의 성격이며 `verified`, `pending`, `conflict`는 원문 검토 상태입니다. 원문이 확인된 목표도 실적이 아닙니다.
- 칠드레스 Horizon 1~4의 고객 인수·시운전·건설 단계와 Microsoft/NVIDIA 계약 원문을 확인했습니다. Horizon 1 고객 인수는 가동·매출로 자동 전환하지 않습니다. NVIDIA 약 60MW는 IT/총전력 기준이 명시되지 않아 단위별 합계에서 분리했습니다.
- 기존 수치와 검토된 기록을 혼합해 전부 검증됐다고 표시하지 않습니다. 숫자 공정률은 새 현황 화면에서 숨깁니다. 원문 공개일을 모르는 기존 기록은 데이터 기준일 이후에만 노출하므로 과거 화면은 불완전할 수 있습니다.
- 3D 외형 참조는 `src/scene/campusAppearance.js`에서 관리합니다. Childress의 기존 채굴동 외형만 공식 사진으로 보정했으며 AI 건물·동수·배치는 용량을 설명하는 구성도입니다. 다른 캠퍼스에는 Childress의 외형을 일괄 적용하지 않습니다.
- 현재 9개 위치 모두 부지 정합 재검토가 필요합니다. 기존의 공식 주소 분류도 좌표 검증을 대체하지 않으며, 지역 마커로 표시하고 자동 확대를 줌 9로 제한합니다.
- 프로젝트 소유자의 사용 허용에 따라 IREN 공식 홈페이지 사진 3장을 로컬 자산으로 표시합니다. 원본 주소·출처·이용 근거를 기록하고 확대·2장 비교를 제공합니다. IR 자료 2건은 원문 링크로 유지합니다. 홈페이지 사진의 게시일·촬영일은 미상이며, 검토 시점(2026-10-08) 이전 월에는 표시하지 않습니다. 확인일을 촬영일·게시일로 바꾸지 않으며, 특정 건물로 식별되지 않은 사진은 캠퍼스 수준에서만 표시합니다.
- 새 문서를 추가할 때 발표일, 문서 내 위치, 검토일을 기록하고 목표를 덮어쓰지 말고 revisions에 추가합니다. 같은 대상·완료 조건만 한 일정에 묶습니다. 다른 범위는 별도 일정으로 남깁니다.
- `npm run validate`, `npm test`, `npm run build`로 확인합니다. 단위 테스트는 정보의 사실성을 보장하지 않으므로 문서 원문 검토도 필요합니다.
- 지도 배경은 현재 제공 데이터입니다. 타임라인이 과거여도 과거 지형 영상이 아니며, 위성영상은 이 버전에 포함하지 않습니다. 타일 실패 시에도 목록·상세는 독립적으로 동작합니다.

OpenFreeMap / OpenMapTiles / OpenStreetMap 출처 표시는 지도에 유지합니다. 유료 가입·API 키·자동 자료 게시 기능은 없습니다. 녹화 모드는 기존 자료의 시나리오 연출을 유지하며 투자자용 확인 현황과 구별됩니다.
