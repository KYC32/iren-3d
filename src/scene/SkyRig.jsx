// =============================================================
// SkyRig — 캠퍼스 조명(해·달·하늘빛)과 배경색을 "하늘 모드"에 맞춰 바꿉니다.
// -------------------------------------------------------------
//   낮  : 그 부지·그 달의 실제 오전 해 방향 (계절에 따라 그림자 길이·방향이 바뀜)
//   노을: 저녁 해가 낮게 깔린 때 — 주황빛, 긴 그림자, 창문 불이 켜지기 시작
//   밤  : 푸른 달빛 + 가동 중인 건물만 불이 켜짐
//   지금: 그 부지의 실제 현지 시각 해 위치 (10초마다 다시 계산)
// 값이 갑자기 바뀌지 않도록 매 프레임 목표값 쪽으로 조금씩 옮깁니다(약 1초).
// 조명 개수는 항상 같게 유지 — 조명 수가 바뀌면 모든 재질의 셰이더를 다시 만들어 화면이 멈칫함
// =============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color } from 'three'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { skyTarget } from './sun.js'
import { SKY, updateNightMaterials } from './nightLights.js'
import { useReducedMotion } from './useReducedMotion.js'

// 팔레트: [낮, 노을, 밤]
const PAL = {
  key: ['#fff5e8', '#ffb07a', '#a9bdf2'], keyI: [2.5, 1.9, 0.55],   // 해(밤엔 달)빛
  amb: ['#ffffff', '#ffe0c4', '#7d8fcc'], ambI: [0.45, 0.4, 0.16],  // 전체를 고르게 밝히는 빛
  sky: ['#edf4ff', '#ffd6b8', '#36467a'],                            // 반구광: 위(하늘) 쪽 색
  ground: ['#9ca9b4', '#a8948a', '#1b2335'], hemiI: [0.7, 0.6, 0.42], // 반구광: 아래(땅) 쪽 색
  fill: ['#d9e8ff', '#c9c6ee', '#7f95d6'], fillI: [0.45, 0.3, 0.12],  // 반대편 보조광
  bg: [null, '#f4cdb4', '#121b31'],                                  // 배경: 낮은 부지별 색(prop)
}
const C = (hex) => new Color(hex)
const palColors = Object.fromEntries(Object.entries(PAL).filter(([k]) => !k.endsWith('I')).map(([k, v]) => [k, v.map((x) => x && C(x))]))
const tmp = new Color()

// 낮→노을→밤 섞기: 숫자
const mix3 = ([d, g, n], golden, night) => (d + (g - d) * golden) * (1 - night) + n * night
// 같은 방식으로 색 섞기 (out 에 결과)
function mixColor(out, [d, g, n], golden, night) {
  out.copy(d).lerp(g, golden)
  return out.lerp(n, night)
}

export default function SkyRig({ side, background, shadowSpan, record = false }) {
  const mode = useAppStore((s) => (record ? 'day' : s.skyMode)) // 영상 녹화는 항상 낮 (결과가 매번 같도록)
  const month = useAppStore((s) => s.month)
  const site = useAppStore(selectSelectedSite)
  const lat = site?.lat ?? 35, lng = site?.lng ?? -100
  const steady = useReducedMotion()
  const scene = useThree((s) => s.scene)

  const key = useRef(), amb = useRef(), hemi = useRef(), fill = useRef()
  const cur = useRef(null)                  // 지금 화면에 적용된 값 (목표로 조금씩 이동)
  const live = useRef({ at: -Infinity, target: null })
  const dayBg = useMemo(() => C(background), [background])
  // 낮·노을·밤 목표는 달·부지가 바뀔 때만 계산 (지금 모드는 프레임 안에서 10초마다)
  const preset = useMemo(() => (mode === 'live' ? null : skyTarget(mode, { lat, lng }, month ?? 0)), [mode, lat, lng, month])
  useEffect(() => { live.current = { at: -Infinity, target: null } }, [mode, lat, lng])

  // 캠퍼스를 떠날 때 하늘 값을 낮으로 되돌림 (다른 화면에 밤 재질이 남지 않게)
  useEffect(() => () => { SKY.night = SKY.golden = SKY.lights = 0; SKY.bg = null; updateNightMaterials(0, true) }, [])

  // priority −1: 다른 useFrame(건물 창문 등)보다 먼저 실행 → 같은 프레임에 같은 하늘 값을 읽음
  useFrame(({ clock }, dt) => {
    let target = preset
    if (!target) {
      if (clock.elapsedTime - live.current.at > 10) live.current = { at: clock.elapsedTime, target: skyTarget('live', { lat, lng }, month ?? 0, new Date()) }
      target = live.current.target
    }
    // 처음엔 바로 목표값으로 (화면을 열 때 낮→밤으로 서서히 바뀌는 연출은 불필요)
    if (!cur.current) cur.current = { dir: [...target.dir], night: target.night, golden: target.golden }
    const c = cur.current
    const k = steady ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 3.5) // 약 1초에 걸쳐 따라감
    c.night += (target.night - c.night) * k
    c.golden += (target.golden - c.golden) * k
    for (let i = 0; i < 3; i++) c.dir[i] += (target.dir[i] - c.dir[i]) * k
    const len = Math.hypot(...c.dir) || 1

    // 공유 하늘 값 → 창문·불빛 재질
    SKY.night = c.night
    SKY.golden = c.golden
    SKY.lights = Math.min(1, c.night + 0.45 * c.golden) // 노을부터 창문 불이 켜지기 시작
    updateNightMaterials(clock.elapsedTime, steady)

    const g = c.golden, n = c.night
    if (key.current) {
      const D = side * 1.8 // 빛을 캠퍼스 중심에서 이만큼 떨어진 곳에 둠 (방향만 의미 있음)
      key.current.position.set((c.dir[0] / len) * D, (c.dir[1] / len) * D, (c.dir[2] / len) * D)
      mixColor(key.current.color, palColors.key, g, n)
      key.current.intensity = mix3(PAL.keyI, g, n)
    }
    if (amb.current) { mixColor(amb.current.color, palColors.amb, g, n); amb.current.intensity = mix3(PAL.ambI, g, n) }
    if (hemi.current) {
      mixColor(hemi.current.color, palColors.sky, g, n)
      mixColor(hemi.current.groundColor, palColors.ground, g, n)
      hemi.current.intensity = mix3(PAL.hemiI, g, n)
    }
    if (fill.current) { mixColor(fill.current.color, palColors.fill, g, n); fill.current.intensity = mix3(PAL.fillI, g, n) }
    // 배경·안개: 부지별 낮 색 → 노을(살구색, 65%) → 밤(남색)
    tmp.copy(dayBg).lerp(palColors.bg[1], g * 0.65).lerp(palColors.bg[2], n)
    if (scene.background?.isColor) scene.background.copy(tmp)
    if (scene.fog) scene.fog.color.copy(tmp)
    SKY.bg = tmp
  }, -1)

  return (
    <>
      <ambientLight ref={amb} intensity={PAL.ambI[0]} />
      <hemisphereLight ref={hemi} args={[PAL.sky[0], PAL.ground[0], PAL.hemiI[0]]} />
      {/* 보조광: 해 반대편에서 그림자 쪽 면이 너무 어둡지 않게 */}
      <directionalLight ref={fill} position={[-30, 18, -25]} color={PAL.fill[0]} intensity={PAL.fillI[0]} />
      <directionalLight
        ref={key}
        position={[side * 0.7, side * 1.4, side * 0.85]}
        intensity={PAL.keyI[0]}
        color={PAL.key[0]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={1}
        shadow-camera-far={side * 4}
        shadow-bias={-0.00015}
        shadow-normalBias={0.03}
        onUpdate={(light) => light.shadow.camera.updateProjectionMatrix()}
      />
    </>
  )
}
