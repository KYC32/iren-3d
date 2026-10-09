// =============================================================
// Scene — 하나의 Canvas 안에 지구본 뷰와 캠퍼스 뷰를 함께 두고 store.view 로 전환
// 조명은 WareTrack 재현판 레시피(밝은 앰비언트 + 반구광 + 그림자 방향광)를 참고했고,
// 캠퍼스에서는 SkyRig 가 하늘 모드(낮·노을·밤·지금)에 맞춰 색·세기·방향을 바꿉니다.
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
import SkyRig from './SkyRig.jsx'
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

      {/* 조명: 캠퍼스는 하늘 모드(낮·노을·밤·지금)를 따르는 SkyRig, 지구본(영상 인트로)은 고정 조명 */}
      {campus ? (
        <SkyRig side={campusSide} background={background} shadowSpan={shadowSpan} record={record} />
      ) : (
        <>
          <ambientLight intensity={1.1} />
          <hemisphereLight args={['#ffffff', '#b8c4dc', 0.9]} />
          <directionalLight
            position={boardMode ? [80, 140, 90] : [300, 260, 200]}
            intensity={1.7}
            castShadow={boardMode}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-shadowSpan}
            shadow-camera-right={shadowSpan}
            shadow-camera-top={shadowSpan}
            shadow-camera-bottom={-shadowSpan}
            shadow-camera-near={1}
            shadow-camera-far={400}
            shadow-bias={-0.0004}
            onUpdate={(light) => light.shadow.camera.updateProjectionMatrix()}
          />
        </>
      )}

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
