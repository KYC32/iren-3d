# IREN 3D — 데이터센터 현황판

IREN(NASDAQ: IREN)의 데이터센터 사이트 현황을 **전략게임처럼** 보여주는 비공식 3D 웹앱입니다.
저폴리 지구본에서 사이트 핀을 누르면 카메라가 날아가 아이소메트릭 캠퍼스로 들어갑니다.
캠퍼스에서는 가동중·시운전·건설중·계획 건물과 GPU 납품 트럭, 변전소 통전 예정 등을 볼 수 있습니다.

> 본 프로젝트는 IREN Ltd 와 무관한 개인의 비공식 프로젝트입니다. 모든 수치는 공개 자료에서 수집했고 항목마다 출처를 표기했습니다. 투자 조언이 아닙니다.

## 화면 구성

| 화면 | 내용 |
|---|---|
| 지구본 | 육지 = 미리 계산한 h3 육각 타일, 핀 높이 = √계통전력, 링 펄스 속도 = 상태 |
| 캠퍼스 | 데이터홀 1블록 = 75MW gross(Horizon 1동). 상태별 외형, 크레인·트럭·전력 흐름 애니메이션 |
| 오버레이 | KPI, 상태 범례(클릭 = 필터), 사이트 목록, 상세 패널(타임라인·추정·출처), 한/영 토글 |

딥링크: `/#site=childress` 처럼 사이트 id 를 붙이면 그 캠퍼스로 바로 열립니다.

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 캠퍼스 배치 로직 단위 테스트
npm run build      # validate → 빌드 (dist/)
```

## 데이터 갱신 방법 (가장 자주 하는 일)

1. `public/data/sites.json` 을 수정합니다. 모든 수치에는 `sources`(URL)를 남깁니다.
   - 건물 상태: `operating` · `commissioning` · `under_construction`(+ `progress` 0~1) · `planned` · `decommissioning`
   - 기존 건물 전력을 재사용하는 전환(예: 채굴동 → AI 홀)은 `replaces: "<기존 건물 id>"` 로 표시해 이중 계산을 막습니다.
   - 채용공고처럼 회사 발표가 아닌 추정은 `estimates` 에만 넣습니다.
2. `npm run validate` 로 검사합니다. 스키마 오류·전력 합계 초과·중복 id 를 잡아 줍니다.
3. `git commit` → `git push` 하면 Vercel 이 자동으로 다시 배포합니다.

## 영상 만들기 (X·쇼츠용)

같은 스토리보드로 16:9(1920×1080)와 9:16(1080×1920) 영상을 자동으로 만듭니다.
헤드리스 Chrome(임시 프로필)이 화면을 한 프레임씩 그려 PNG 로 저장하고, 끝나면 ffmpeg 가 mp4 로 합칩니다.

```bash
npm run build
node scripts/record-server.mjs all              # 16:9 + 9:16 → video/iren-x-ko.mp4, video/iren-shorts-ko.mp4
node scripts/record-server.mjs x --lang=en      # 영어 자막 16:9
node scripts/record-server.mjs shorts --only=3,13,25   # 그 시점만 미리보기 PNG (video/preview-*.png)
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
public/data/sites.json      사이트 현황 (유일한 진실)
public/data/land-hex.json   지구본 육지 타일 (npm run geo 로 생성)
public/data/borders.json    국경·해안선·미국 주 경계 (npm run geo 로 생성)
src/data/                   스키마(zod), 로더·KPI 계산, 상태 색상표
src/scene/                  3D: GlobeView, SiteView, CameraRig, layoutCampus, buildings/
src/ui/                     HTML 오버레이 패널들
src/i18n/                   한/영 문자열
scripts/                    validate-sites, build-land-hex, build-borders
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
