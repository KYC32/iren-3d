// =============================================================
// longhornMotion.js — 롱혼 소 한 마리의 "지금 이 순간 자세"를 계산하는 순수 함수
// -------------------------------------------------------------
// 48초를 한 주기로 반복합니다.
//   - 0~24초: 제자리에서 고개를 숙이고 풀을 뜯음
//   - 24~48초: 자기 목초지(작은 타원) 둘레를 1/4 바퀴 천천히 걸어감
// three.js 를 쓰지 않아서 테스트하기 쉽습니다.
// =============================================================
import { longhornPasture, terrainHeight } from './campusLandscape.js'

// smoothstep: 0~1 로 자른 뒤 부드러운 S자 곡선으로 바꿈 (천천히 시작 → 빨라짐 → 천천히 멈춤)
const smooth = value => {
  const v = Math.min(1, Math.max(0, value))
  return v * v * (3 - 2 * v)
}

// 24초 동안 풀을 뜯은 뒤, 각자의 목초지 둘레를 천천히 1/4 바퀴 돎
// 부드럽게 바뀌는 걷기 속도를 적분한 값(=이동량)으로 위치를 정해서, 풀 뜯는 동안 소가 미끄러지지 않고 딱 멈춤
// time: 경과 시간(초), index: 몇 번째 소(0·1), side: 캠퍼스 한 변(월드 단위), relief: 지형 굴곡
export function longhornPose(time, index, side, relief, reducedMotion = false) {
  // 동작 줄이기 설정이면 시간을 0 에 고정 → 항상 같은 자세
  const t = reducedMotion ? 0 : time
  // 몇 번째 주기인지 (48초 = 1). index × .19 만큼 박자를 어긋나게 해서 두 마리가 따로 움직임
  const cycle = t / 48 + index * .19
  // 이번 주기 안에서 몇 초째인지 (0 ~ 48초)
  const phase = (cycle % 1) * 48
  // 걷기 진행도: 24초 전까지 0, 24→48초 동안 0 → 1
  const walk = Math.min(1, Math.max(0, (phase - 24) / 24))
  // 누적 이동량: 지난 주기 수 + 이번 주기의 걷기 진행도 (주기마다 1 씩 늘어남)
  const travel = Math.floor(cycle) + smooth(walk)
  // 이동량 1 = 90°(π/2). 두 마리는 반 바퀴(π) 떨어져 출발, .55 는 시작 각도 보정(라디안)
  const angle = travel * Math.PI / 2 + index * Math.PI + .55
  // 목초지 = 중심(x, z) + 가로·세로 반지름(rx, rz)의 작은 타원
  const pasture = longhornPasture(side, index)
  const x = pasture.x + Math.cos(angle) * pasture.rx
  const z = pasture.z + Math.sin(angle) * pasture.rz
  // 걷는 세기: 4 × w × (1 − w) 는 걷기 시작·끝에 0, 한가운데에서 1 인 종 모양 → 다리 흔드는 폭
  const walking = reducedMotion ? 0 : 4 * walk * (1 - walk)
  // 풀 뜯기 정도(1 = 고개 숙임, 0 = 고개 듦):
  //   20~23초에 고개를 들고(1 → 0), 45~48초에 다시 숙임(0 → 1) → 걷는 동안은 고개를 든 상태
  const graze = 1 - smooth((phase - 20) / 3) + smooth((phase - 45) / 3)
  return {
    // 땅 높이 + 살짝 띄운 높이(.06)
    x, z, y: terrainHeight(x, z, side, relief) + .06,
    // 타원을 따라가는 방향(접선)을 바라보도록 atan2 로 계산한 회전각
    heading: Math.atan2(-pasture.rx * Math.sin(angle), pasture.rz * Math.cos(angle)),
    // 0번 소를 조금 더 크게
    scale: index === 0 ? 1.08 : .96,
    // 고개 각도(라디안): 기본 .08 + 숙일 때 약 .98 더. 풀 뜯는 동안 sin 으로 아주 살짝(.035) 까딱거림
    head: .08 + graze * (.98 + (reducedMotion ? 0 : Math.sin(t * 1.7 + index) * .035)),
    // 다리 흔들기: 시간 대신 이동량(travel)에 묶어서, 실제로 걸어간 만큼만 다리가 움직임
    // (1/4 바퀴 동안 sin 이 6번 왕복, 최대 .3 라디안)
    stride: Math.sin(travel * Math.PI * 12) * .3 * walking,
    // 꼬리는 항상 천천히 좌우로 흔듦 (최대 .25 라디안)
    tail: reducedMotion ? 0 : Math.sin(t * 1.6 + index * 2) * .25,
  }
}
