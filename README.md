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

## 배포 (Vercel)

1. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New → Project** → `KYC32/iren-3d` Import
2. 프레임워크는 Vite 로 자동 감지됩니다 (Build `npm run build`, Output `dist`). 그대로 **Deploy**
3. 이후 `main` 브랜치에 push 할 때마다 자동 배포, PR 마다 프리뷰 URL 이 생깁니다.

## 기술 스택

Vite 8 · React 19 · @react-three/fiber 9 · @react-three/drei 10 · three 0.186 · zustand 5 · zod 4 · lucide-react

육지 타일은 `npm run land`(h3-js + Natural Earth 110m)로 미리 계산해 `public/data/land-hex.json` 에 저장합니다.
브라우저 번들에는 h3/지도 라이브러리가 들어가지 않습니다.

## 폴더

```
public/data/sites.json      사이트 현황 (유일한 진실)
public/data/land-hex.json   지구본 육지 타일 (npm run land 로 생성)
src/data/                   스키마(zod), 로더·KPI 계산, 상태 색상표
src/scene/                  3D: GlobeView, SiteView, CameraRig, layoutCampus, buildings/
src/ui/                     HTML 오버레이 패널들
src/i18n/                   한/영 문자열
scripts/                    validate-sites, build-land-hex
docs/research-brief.md      참고 사례·코드·데이터 출처 리서치
```

## 참고한 사례

- Dilum Sanjaya 의 WareTrack 데모 (x.com/DilumSanjaya/status/2106426962738880879) — 전체 콘셉트
- austin410203/warehouse, cahitberkay/waretrack — 카메라·조명·"스토어가 진실, 3D 는 투영" 구조 (코드는 복사하지 않음)
- dgreenheck/simcity-threejs-clone — 상태별 건물 단계 표현
- vasturiano/three-globe — 지구본 좌표계·레이어 아이디어
