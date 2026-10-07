// =============================================================
// App — 3D 캔버스(뒤) + HTML 오버레이(앞)
// 오버레이 전체는 pointer-events:none 이고 패널만 클릭을 받습니다.
// =============================================================
import { useEffect, lazy, Suspense } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { loadSites } from './data/loadSites.js'
import { useT } from './i18n/useT.js'
const Scene = lazy(() => import('./scene/Scene.jsx'))
import TopBar from './ui/TopBar.jsx'
import KpiBar from './ui/KpiBar.jsx'
import Legend from './ui/Legend.jsx'
import LeftPanel from './ui/Leaderboard.jsx'
import SitePanel from './ui/SitePanel.jsx'
import Footer from './ui/Footer.jsx'
import TimelineSlider from './ui/TimelineSlider.jsx'
import { RECORD } from './record/recordMode.js'

export default function App() {
  const t = useT()
  const data = useAppStore((s) => s.data)
  const loadError = useAppStore((s) => s.loadError)
  const view = useAppStore((s) => s.view)
  const transitioning = useAppStore((s) => s.transitioning)
  const lang = useAppStore((s) => s.lang)

  // 처음 한 번 infra.json 로드
  useEffect(() => {
    loadSites()
      .then((raw) => useAppStore.getState().setRaw(raw))
      .catch((e) => useAppStore.getState().setLoadError(e.message))
  }, [])

  // 주소창 해시가 바뀌면(링크 공유·직접 입력) 그 상태로 이동
  useEffect(() => {
    const onHash = () => {
      useAppStore.getState().applyHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // html lang 속성도 언어에 맞춤 (스크린리더용)
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  // 녹화 모드: HTML UI 없이 영상 크기(2배)의 캔버스만 렌더링
  if (RECORD) {
    return (
      <div className="app record">
        <div className="canvas-wrap" style={{ width: RECORD.W * RECORD.SS, height: RECORD.H * RECORD.SS }}>
          {data && <Suspense fallback={null}><Scene record /></Suspense>}
        </div>
      </div>
    )
  }

  return (
    <div className={`app view-${view}`}>
      <div className="canvas-wrap">{data && <Suspense fallback={<div className="scene-loading" role="status">{t.sceneLoading}</div>}><Scene /></Suspense>}</div>

      {/* 뷰 전환 시 덮는 페이드 막 */}
      <div className={`fade${transitioning ? ' on' : ''}`} />

      <div className="overlay">
        <TopBar />
        {data && <KpiBar />}
        <div className="middle">
          {data && view === 'globe' && <LeftPanel />}
          <div className="spacer" />
          {data && view === 'site' && <SitePanel />}
        </div>
        <div className="bottom">
          {data && <Legend />}
          {data && <TimelineSlider />}
          <Footer />
        </div>
      </div>

      {!data && !loadError && <div className="center-msg">{t.loading}</div>}
      {loadError && <pre className="center-msg error">{loadError}</pre>}
    </div>
  )
}
