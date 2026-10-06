// =============================================================
// 영상 스토리보드 — 장면(shot)과 자막(card)을 시간표로 정의합니다.
// 숫자(초)만 고치면 영상 길이·순서·자막이 바뀝니다.
// 카메라는 각 장면의 진행률 p(0~1) 에 대한 함수라서 같은 시각엔 항상 같은 화면이 나옵니다.
// =============================================================

export const DURATION = 34 // 전체 길이(초)

// type: 'globe' = 지구본, 'site' = 캠퍼스
// fadeIn/fadeOut: 장면 시작/끝에 배경색으로 페이드(초)
export const SHOTS = [
  // 1) 지구본: 태평양 쪽에서 북미로 천천히 돌아옴
  { t0: 0, t1: 6.5, type: 'globe', cam: { from: { lat: 30, lng: -165, alt: 1 }, to: { lat: 38, lng: -102, alt: 1 } }, fadeIn: 0.4 },
  // 2) Childress 로 날아 들어감
  { t0: 6.5, t1: 9, type: 'globe', fly: 'childress', cam: { from: { lat: 38, lng: -102, alt: 1 } }, fadeOut: 0.45 },
  // 3) Childress 캠퍼스 한 바퀴
  { t0: 9, t1: 19.5, type: 'site', site: 'childress', orbit: { az0: 0.55, az1: 1.45, polar0: 0.98, polar1: 0.9, dist0: 1.08, dist1: 0.92 }, fadeIn: 0.45, fadeOut: 0.45 },
  // 4) Sweetwater 1 캠퍼스
  { t0: 19.5, t1: 28, type: 'site', site: 'sweetwater-1', orbit: { az0: 1.2, az1: 0.45, polar0: 0.92, polar1: 0.98, dist0: 0.82, dist1: 0.7 }, fadeIn: 0.45, fadeOut: 0.45 },
  // 5) 지구본으로 빠져나오며 전체 정리
  { t0: 28, t1: DURATION, type: 'globe', cam: { from: { lat: 34, lng: -101, alt: 0.25 }, to: { lat: 30, lng: -112, alt: 1 } }, fadeIn: 0.45 },
]

// 자막 카드. kind: 'title'(큰 제목) | 'header'(장면 제목) | 'caption'(아래 자막) | 'outro'
// tone: 상태색 점 (operating / commissioning / under_construction / planned / pending)
export const CARDS = {
  ko: [
    { t0: 0.6, t1: 6.3, kind: 'title', title: 'IREN 데이터센터 현황', sub: '비트코인 채굴에서 AI 클라우드로 · 9개 사이트 5.6GW' },
    { t0: 9.4, t1: 19.2, kind: 'header', title: 'Childress, Texas', sub: '계통 750MW · 자사 변전소 345kV' },
    { t0: 10.6, t1: 13.6, kind: 'caption', tone: 'operating', text: 'Horizon 1 가동 — Microsoft 인도 완료 (2026.08)' },
    { t0: 13.6, t1: 16.6, kind: 'caption', tone: 'commissioning', text: 'Horizon 2~4 — 2026년 4분기 납품 목표 (GB300)' },
    { t0: 16.6, t1: 19.3, kind: 'caption', tone: 'planned', text: '채굴동 380MW — 2026년 말 폐쇄, AI로 전환' },
    { t0: 19.9, t1: 27.8, kind: 'header', title: 'Sweetwater 1, Texas', sub: '1.4GW 변전소 통전 완료 (2026.05)' },
    { t0: 21.0, t1: 24.4, kind: 'caption', tone: 'under_construction', text: '1단계 300MW 건설중 — 2027년 4분기 납품 목표' },
    { t0: 24.4, t1: 27.8, kind: 'caption', tone: 'pending', text: 'Sweetwater 2와 합쳐 2GW 허브 — ERCOT 편입' },
    { t0: 29.0, t1: DURATION, kind: 'outro', title: '확보 전력 5.6GW', stats: ['계약 ARR $4bn', '수주잔고 $13bn+', '총 GPU ~15만'], url: 'iren-3d.vercel.app', note: '비공식 · 공개자료 기반 · 투자 조언 아님 · 2026.10.06 기준' },
  ],
  en: [
    { t0: 0.6, t1: 6.3, kind: 'title', title: 'IREN Data Center Map', sub: 'From bitcoin mining to AI cloud · 9 sites, 5.6GW' },
    { t0: 9.4, t1: 19.2, kind: 'header', title: 'Childress, Texas', sub: '750MW grid · own 345kV substation' },
    { t0: 10.6, t1: 13.6, kind: 'caption', tone: 'operating', text: 'Horizon 1 live — delivered to Microsoft (Aug 2026)' },
    { t0: 13.6, t1: 16.6, kind: 'caption', tone: 'commissioning', text: 'Horizon 2–4 — Q4 2026 delivery target (GB300)' },
    { t0: 16.6, t1: 19.3, kind: 'caption', tone: 'planned', text: 'Mining halls 380MW — wound down by end-2026' },
    { t0: 19.9, t1: 27.8, kind: 'header', title: 'Sweetwater 1, Texas', sub: '1.4GW substation energized (May 2026)' },
    { t0: 21.0, t1: 24.4, kind: 'caption', tone: 'under_construction', text: 'Phase 1, 300MW under construction — Q4 2027' },
    { t0: 24.4, t1: 27.8, kind: 'caption', tone: 'pending', text: '2GW hub with Sweetwater 2 — in ERCOT Batch Zero' },
    { t0: 29.0, t1: DURATION, kind: 'outro', title: '5.6GW secured power', stats: ['$4bn contracted ARR', '$13bn+ backlog', '~150k GPUs'], url: 'iren-3d.vercel.app', note: 'Unofficial · public sources · not investment advice · as of 2026-10-06' },
  ],
}

// ---- 시간 보간 도우미 ----
export const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const lerp = (a, b, k) => a + (b - a) * k

export function shotAt(t) {
  return SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1]
}

// 장면 경계의 페이드 정도(0=선명, 1=배경색으로 가림)
export function fadeAt(t) {
  const s = shotAt(t)
  let f = 0
  if (s.fadeIn) f = Math.max(f, 1 - clamp01((t - s.t0) / s.fadeIn))
  if (s.fadeOut) f = Math.max(f, clamp01((t - (s.t1 - s.fadeOut)) / s.fadeOut))
  return f
}
