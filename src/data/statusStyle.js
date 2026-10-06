// 상태(status) → 색/라벨/애니메이션 규칙을 한 곳에서 관리합니다.
// 3D 씬(머티리얼 색)과 HTML UI(범례·배지)가 모두 이 표를 읽으므로
// 여기 한 줄만 바꾸면 화면 전체의 의미 체계가 함께 바뀝니다.
//
// TODO(학습 포인트 1): 색과 의미를 직접 다듬어 보세요.
//   - 기존 X 카드(iren-power-card)와 같은 청록/코럴/노랑 체계를 유지했습니다.
//   - 예: commissioning 을 operating 과 같은 색으로 합칠지, 별도 색으로 둘지 결정.

export const STATUS_STYLE = {
  operating: {
    color: '#2ea88a',      // 청록: 가동중
    emissive: '#1f7f66',   // 창문/점등 색
    ringSpeed: 1,          // 지구본 링 펄스 속도 (느림)
    opacity: 1,
    order: 0,
  },
  commissioning: {
    color: '#3fbf96',      // 밝은 청록: 완공 후 시운전
    emissive: '#f5c518',   // 노란 점멸등
    ringSpeed: 2.5,
    opacity: 1,
    order: 1,
  },
  under_construction: {
    color: '#e8825a',      // 코럴: 건설중
    emissive: '#e8825a',
    ringSpeed: 3,
    opacity: 0.55,         // 골조 느낌의 반투명
    order: 2,
  },
  planned: {
    color: '#9aa6bd',      // 회색: 토지·전력만 확보
    emissive: '#9aa6bd',
    ringSpeed: 0.6,
    opacity: 0.35,
    order: 3,
  },
  decommissioning: {
    color: '#b9bfcc',      // 연회색: 폐쇄 진행중 (채굴동)
    emissive: '#b9bfcc',
    ringSpeed: 0,
    opacity: 0.4,
    order: 4,
  },
}

// "예정 이벤트"(GPU 납품·통전 예정·고객 계약) 강조색 — 노랑
export const PENDING_COLOR = '#f5c518'

// 상태 목록을 표시 순서대로
export const STATUS_ORDER = Object.entries(STATUS_STYLE)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([k]) => k)

export function styleOf(status) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.planned
}
