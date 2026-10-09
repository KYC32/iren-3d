// =============================================================
// nightLights.js — 밤 조명에 쓰는 "공유" 재질과 현재 하늘 상태
// -------------------------------------------------------------
// 핵심 아이디어: 밤에 켜지는 창문·불빛 웅덩이는 모든 건물이 같은 재질 몇 개를 함께 씁니다.
//   → SkyRig 가 매 프레임 이 재질의 투명도만 바꾸면 수십 개 건물의 불이 한 번에 켜지고 꺼짐
//   → 낮에는 재질을 visible=false 로 꺼 두어 그리기 비용이 0 (그리기 목록에서 빠짐)
// 의미: 불이 켜진 건물 = 그 날짜에 가동 중(고객 인수 포함). 하늘색 = AI 데이터홀, 주황 = 채굴.
//       시운전 중인 AI 홀·축소(폐쇄 진행) 중인 채굴 홀은 희미하게, 건설·계획 중인 건물은 꺼져 있음.
//       (축소 중인 채굴 홀도 KPI 에서는 아직 "채굴 가동"으로 세므로 불을 끄지 않음)
// =============================================================
import { MeshBasicMaterial, CanvasTexture, AdditiveBlending, Color } from 'three'

// SkyRig 가 매 프레임 갱신하는 현재 하늘 값 (0~1)
//   night : 밤 정도, golden : 노을 정도, lights : 창문 불빛 세기(밤 + 노을 일부)
export const SKY = { night: 0, golden: 0, lights: 0, bg: null } // bg: 지금 배경색 (THREE.Color)

// 불빛 색: AI 데이터홀(차가운 하늘색) / 채굴(따뜻한 주황)
import { AI_LIGHT, MINER_LIGHT } from './nightColors.js'

// 창문 띠 재질 — 조명 계산 없이(Basic) 색 그대로, 톤매핑도 끄고 밝게
const windowMat = (color) => new MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, visible: false })

// 바닥에 번지는 불빛 웅덩이용 둥근 그라데이션 그림 (처음 쓸 때 한 번만 만듦)
let glowTexture = null
function glow() {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glowTexture = new CanvasTexture(c)
  return glowTexture
}
// 더하기 합성(Additive): 어두운 바닥 위에 빛을 "더해" 은은하게 밝아 보이게
const poolMat = (color) => new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false, visible: false })

// 모든 건물이 함께 쓰는 재질들 (지연 생성: 3D 화면에서 처음 필요할 때 만듦)
let mats = null
export function nightMaterials() {
  if (mats) return mats
  mats = {
    aiWindow: windowMat(AI_LIGHT),         // 가동 중 AI 홀 창문
    minerWindow: windowMat(MINER_LIGHT),   // 가동 중 채굴 홀 창문
    pendingWindow: windowMat(AI_LIGHT),    // 시운전 중 홀 창문 (희미하게)
    fadingWindow: windowMat(MINER_LIGHT),  // 축소(폐쇄 진행) 중 채굴 홀 창문 (희미하게)
    aiPool: poolMat(new Color(AI_LIGHT).multiplyScalar(0.8)),
    minerPool: poolMat(new Color(MINER_LIGHT).multiplyScalar(0.8)),
    aviation: new MeshBasicMaterial({ color: '#ff4a3d', toneMapped: false, visible: false }), // 크레인 꼭대기 항공 장애등
    headlight: new MeshBasicMaterial({ color: '#fff3d1', toneMapped: false, visible: false }), // 트럭 전조등
  }
  mats.aiPool.map = mats.minerPool.map = glow()
  return mats
}

// 하늘 값으로 공유 재질을 갱신 (SkyRig 의 useFrame 에서 매 프레임 호출)
//   t: 경과 시간(초) — 항공 장애등 깜빡임용, steady: 모션 감소 설정이면 깜빡이지 않음
export function updateNightMaterials(t, steady) {
  const m = nightMaterials()
  const L = SKY.lights
  const on = L > 0.01
  for (const [mat, k] of [[m.aiWindow, 1], [m.minerWindow, 1], [m.pendingWindow, 0.4], [m.fadingWindow, 0.55], [m.aiPool, 0.9], [m.minerPool, 0.75]]) {
    mat.opacity = L * k
    mat.visible = on
  }
  m.headlight.visible = L > 0.25
  // 항공 장애등: 어두워지면 1.5초 주기로 깜빡 (모션 감소 설정이면 켜진 채)
  m.aviation.visible = L > 0.25 && (steady || Math.sin(t * 4.2) > -0.2)
}
