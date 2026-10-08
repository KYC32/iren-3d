// =============================================================
// Scene — 하나의 Canvas 안에 지구본 뷰와 캠퍼스 뷰를 함께 두고 store.view 로 전환
// 조명은 WareTrack 재현판 레시피(밝은 앰비언트 + 반구광 + 그림자 방향광)를 참고했습니다.
// =============================================================
import { Suspense, lazy } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useState, useMemo } from 'react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
const GlobeView = lazy(() => import('./GlobeView.jsx'))
import { SINGLE_COMPANY } from '../config.js'
// 캠퍼스·녹화 코드는 필요할 때만 불러옵니다 (첫 화면 로딩을 가볍게)
const SiteView = lazy(() => import('./SiteView.jsx'))
import { layoutCampus } from './layoutCampus.js'
import CameraRig from './CameraRig.jsx'
import { campusAppearance } from './campusAppearance.js'
import { campusLandscape } from './campusLandscape.js'
const RecordDirector = lazy(() => import('../record/RecordDirector.jsx'))

const BG = '#eceffa' // 배경 = 안개 색 (지평선이 자연스럽게 사라짐)

export default function Scene({ record = false }) {
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
  // 성능이 떨어지면 해상도(DPR)를 자동으로 낮춥니다
  const [dpr, setDpr] = useState(1.5)
  const campusSide = useMemo(() => site ? layoutCampus(site._raw).side : 32, [site?._raw])
  const campus = view === 'site'
  const background = campusLandscape(site?.id)?.background ?? campusAppearance(site?.id)?.background ?? BG
  const shadowSpan = campus ? campusSide * 1.15 : 110
  const boardMode = Boolean(SINGLE_COMPANY) && !record

  return (
    <Canvas
      shadows="percentage"
      // 녹화 모드: 자동 렌더를 끄고(never) RecordDirector 가 한 프레임씩 직접 그림
      frameloop={record ? 'never' : 'always'}
      dpr={record ? 1 : [1, dpr]}
      camera={{ fov: 30, near: 0.5, far: 3000, position: [200, 150, 200] }}
      gl={{ antialias: true }}
      onCreated={(state) => {
        state.gl.setClearColor(background)
        // 개발 모드에서만: 브라우저 콘솔에서 window.__r3f 로 카메라·씬을 들여다볼 수 있게
        if (import.meta.env.DEV) window.__r3f = state
      }}
      onPointerMissed={() => useAppStore.getState().setHover(null)}
    >
      {!record && <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />}
      <color attach="background" args={[background]} />
      {view === 'site' && <fog attach="fog" args={[background, campusSide * 12, campusSide * 22]} />}

      {/* 조명 */}
      <ambientLight intensity={campus ? 0.45 : 1.1} />
      <hemisphereLight args={[campus ? '#edf4ff' : '#ffffff', campus ? '#9ca9b4' : '#b8c4dc', campus ? 0.7 : 0.9]} />
      {campus && <directionalLight position={[-30, 18, -25]} color="#d9e8ff" intensity={0.45} />}
      <directionalLight
        position={campus ? [campusSide * 0.7, campusSide * 1.4, campusSide * 0.85] : boardMode ? [80, 140, 90] : [300, 260, 200]}
        intensity={campus ? 2.5 : 1.7}
        color={campus ? '#fff5e8' : '#ffffff'}
        castShadow={view === 'site' || boardMode}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={1}
        shadow-camera-far={campus ? campusSide * 4 : 400}
        shadow-bias={campus ? -0.00015 : -0.0004}
        shadow-normalBias={campus ? 0.025 : 0}
        onUpdate={(light) => light.shadow.camera.updateProjectionMatrix()}
      />

      <Suspense fallback={null}>
        {/* 3D 개요(지구본)는 영상 녹화 인트로와 다회사 모드에서만 — 단일 회사 모드의 개요는 실제 지도(GeoMap)가 맡음 */}
        {(!SINGLE_COMPANY || record) && <GlobeView visible={view === 'globe'} />}
        {view === 'site' && site && <SiteView key={site.id} site={site} />}
      </Suspense>
      {record ? (
        <Suspense fallback={null}>
          <RecordDirector />
        </Suspense>
      ) : (
        <CameraRig />
      )}
    </Canvas>
  )
}
