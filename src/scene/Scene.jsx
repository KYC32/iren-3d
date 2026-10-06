// =============================================================
// Scene — 하나의 Canvas 안에 지구본 뷰와 캠퍼스 뷰를 함께 두고 store.view 로 전환
// 조명은 WareTrack 재현판 레시피(밝은 앰비언트 + 반구광 + 그림자 방향광)를 참고했습니다.
// =============================================================
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useState } from 'react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import GlobeView from './GlobeView.jsx'
import SiteView from './SiteView.jsx'
import CameraRig from './CameraRig.jsx'
import RecordDirector from '../record/RecordDirector.jsx'

const BG = '#eceffa' // 배경 = 안개 색 (지평선이 자연스럽게 사라짐)

export default function Scene({ record = false }) {
  const view = useAppStore((s) => s.view)
  const site = useAppStore(selectSelectedSite)
  // 성능이 떨어지면 해상도(DPR)를 자동으로 낮춥니다
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      shadows
      // 녹화 모드: 자동 렌더를 끄고(never) RecordDirector 가 한 프레임씩 직접 그림
      frameloop={record ? 'never' : 'always'}
      dpr={record ? 1 : [1, dpr]}
      camera={{ fov: 30, near: 0.5, far: 3000, position: [200, 150, 200] }}
      gl={{ antialias: true }}
      onCreated={(state) => {
        state.gl.setClearColor(BG)
        // 개발 모드에서만: 브라우저 콘솔에서 window.__r3f 로 카메라·씬을 들여다볼 수 있게
        if (import.meta.env.DEV) window.__r3f = state
      }}
      onPointerMissed={() => useAppStore.getState().setHover(null)}
    >
      {!record && <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />}
      <color attach="background" args={[BG]} />
      {view === 'site' && <fog attach="fog" args={[BG, 140, 320]} />}

      {/* 조명 */}
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#b8c4dc', 0.9]} />
      <directionalLight
        position={view === 'site' ? [30, 50, 22] : [300, 260, 200]}
        intensity={1.7}
        castShadow={view === 'site'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />

      <Suspense fallback={null}>
        <GlobeView visible={view === 'globe'} />
        {view === 'site' && site && <SiteView key={site.id} site={site} />}
      </Suspense>
      {record ? <RecordDirector /> : <CameraRig />}
    </Canvas>
  )
}
