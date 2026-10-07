# IREN 3D — 데이터센터 현황판

IREN(NASDAQ: IREN)의 데이터센터 사이트 현황을 **전략게임처럼** 보여주는 비공식 3D 웹앱입니다.
북미 서부 보드판(+ 스페인·남호주 삽입판)에서 사이트 핀을 누르면 카메라가 날아가 아이소메트릭 캠퍼스로 들어갑니다.
캠퍼스에서는 가동중·시운전·건설중·계획 건물과 GPU 납품 트럭, 변전소 통전 예정 등을 볼 수 있습니다.
타임라인 슬라이더로 2024~2028년을 오가며 사이트가 지어지는 과정을 볼 수 있습니다.

엔진은 [ai-infra-map](https://github.com/KYC32/ai-infra-map) `5257a98` 을 **단일 회사 모드**(`src/config.js`)로 가져온 것입니다.
보드판 지도·사건 눈금·다가오는 일정·계약 연결선·갱신 기록은 이 레포에서 추가했습니다.

> 본 프로젝트는 IREN Ltd 와 무관한 개인의 비공식 프로젝트입니다. 모든 수치는 공개 자료에서 수집했고 항목마다 출처를 표기했습니다. 투자 조언이 아닙니다.

## 화면 구성

| 화면 | 내용 |
|---|---|
| 보드판 | 북미 서부 본판 + 스페인·남호주 삽입판(같은 축척). 육지 = 미리 계산한 h3 육각 타일, 핀 높이 = √계통전력, 링 펄스 속도 = 상태 |
| 계약 연결선 | 고객 배지(Microsoft·NVIDIA·AI 개발사) → 사이트, 선 굵기 ∝ 계약 금액, 서명일 이후에만 표시 |
| 타임라인 | 2024~2028 월 단위, 재생, 사건 눈금(회색=지난 일, 노랑=예정). 기준일 이후는 회사 발표 목표 기준 |
| 왼쪽 패널 | 사이트 목록 / 다가오는 일정(클릭 → 그 시점·사이트로) / 데이터 갱신 기록 |
| 캠퍼스 | 데이터홀 1블록 = 75MW gross(Horizon 1동). 상태별 외형, 크레인·트럭·전력 흐름 애니메이션 |
| 오버레이 | KPI, 상태 범례(클릭 = 필터), 사이트 목록, 상세 패널(타임라인·추정·출처), 한/영 토글 |

딥링크: `/#site=childress&date=2027-06` 처럼 사이트·날짜를 붙이면 그 상태로 바로 열립니다.
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
- 전체 보기에는 고객·용도별 구역, 확대 시에는 건물명, 선택 시에는 용량·일정을 표시합니다. 라벨은 겹침과 화면 경계를 검사하고 선택한 건물을 우선 표시합니다. MS·NVIDIA 고객 배지 또는 패널 버튼을 클릭하면 연결된 구역을 강조하고 카메라를 맞추며, 고객별 용량·상태·계약을 표시합니다. 전체 보기 또는 선택 해제로 복귀합니다. 트럭의 GPU 납품명·예정일은 선택 여부와 무관하게 표시하되, 다른 라벨보다 우선순위가 낮아 겹치면 숨깁니다.
- 지표·목록 UI를 먼저 불러오고 3D 씬을 지연 로딩합니다. 지구본·캠퍼스·녹화 코드는 필요한 화면에서 불러옵니다.
- `npm run build`는 manifest의 의존성을 순회해 HTML UI 120KiB, 첫 3D 지도까지 포함한 전체 450KiB(gzip) 예산을 검사합니다. 지연 로딩으로 옮긴 Scene도 전체 예산에 포함됩니다.
- 그림자는 현재 three.js가 지원하는 PCF 설정을 명시합니다. `THREE.Clock` 경고는 설치된 `@react-three/fiber` 9 내부에서 발생합니다. 콘솔 경고를 숨기거나 의존성 코드를 직접 패치하지 않았으며, 렌더러 업그레이드 시 프레임 지정 녹화도 함께 검증해야 합니다.

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
브라우저 번들에는 h3/지도 라이브러리가 들어가지 않습니다.

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
