// =============================================================
// kangarooMotion.js — 캥거루 한 마리의 "지금 이 순간 자세"를 계산하는 순수 함수
// -------------------------------------------------------------
// 시간(초)을 넣으면 위치(x·y·z), 점프 높이(hop), 바라보는 방향(heading)을 돌려줍니다.
//   - 캥거루들은 서식지(타원) 둘레를 따라 천천히 한 바퀴씩 돎
//   - 공중에 떠 있을 때만 앞으로 나아가고, 착지 후 잠깐 멈춤 (발이 미끄러지지 않게)
//   - three.js 를 쓰지 않아서 테스트하기 쉬움
// =============================================================
import { kangarooHabitat, terrainHeight } from './campusLandscape.js'

// 장면 시계(scene clock)를 써서 평소 재생과 한 프레임씩 녹화할 때 움직임이 똑같게 함
// time: 경과 시간(초), index: 몇 번째 캥거루(0·1·2), side: 캠퍼스 한 변(월드 단위), relief: 지형 굴곡
export function kangarooPose(time, index, side, relief, reducedMotion = false) {
  // 동작 줄이기 설정이면 시간을 0 에 고정 → 항상 같은 자세로 멈춤
  const t = reducedMotion ? 0 : time
  // 서식지 = 중심(x, z)과 가로·세로 반지름(rx, rz)을 가진 타원
  const habitat = kangarooHabitat(side)
  // 점프 횟수: 1초에 1.55번 뜀. index × .23 만큼 박자를 어긋나게 해서 세 마리가 동시에 뛰지 않음
  const cycles = t * 1.55 + index * .23
  // 이번 점프 안에서의 진행도 (0 → 1)
  const phase = cycles % 1
  // 한 점프의 앞 76% 동안 공중에 있음 (0 → 1), 나머지 24% 는 땅에 서 있음 (1 로 고정)
  const airborne = Math.min(phase / .76, 1)
  // 점프하는 동안에만 앞으로 나아감. 점프 사이에는 발이 잠깐 멈춰 서서 미끄러지지 않음
  // airborne² × (3 − 2·airborne) 는 smoothstep: 천천히 출발 → 빨라짐 → 천천히 착지
  // 마지막에 1.55 로 나누어 "이동 거리"를 초 단위 크기로 맞춤
  const travel = (Math.floor(cycles) + airborne * airborne * (3 - 2 * airborne) - index * .23) / 1.55
  // 타원 위 각도(라디안): 이동량 1 당 .19 라디안씩 돎 + 세 마리를 120°(2π/3)씩 떨어뜨려 출발
  const angle = travel * .19 + index * Math.PI * 2 / 3
  // 타원 둘레 위의 위치
  const x = habitat.x + habitat.rx * Math.cos(angle)
  const z = habitat.z + habitat.rz * Math.sin(angle)
  // sin(π × airborne) 로 0 → 1 → 0 을 만들어 깡충 뛰는 높이 곡선으로 씀 (착지 후에는 0)
  const hop = reducedMotion ? 0 : Math.sin(Math.PI * airborne)
  // 큰 수컷·중간·작은 새끼처럼 보이게 크기를 다르게
  const scale = [1.2, 1.04, .76][index]
  // 그 자리의 땅 높이 (지형이 울퉁불퉁하므로 위치마다 다름)
  const ground = terrainHeight(x, z, side, relief)
  // y: 땅 + 살짝 띄운 높이(.06) + 점프 높이(최대 .72 × 크기)
  // heading: 타원을 따라 움직이는 방향(접선)을 바라보도록 atan2 로 계산한 회전각
  return { x, z, ground, y: ground + .06 + hop * .72 * scale, hop, scale,
    heading: Math.atan2(-habitat.rx * Math.sin(angle), habitat.rz * Math.cos(angle)) }
}
