// 지금 3D 캠퍼스 배경이 "밤하늘"(어두움)인지 — 캔버스 위 글자(면책 문구 등) 색을 바꾸는 데 씀
//   밤 모드는 항상 어둡고, 지금(현지) 모드는 그 부지의 실제 해가 지평선 4° 아래면 어두움 (1분마다 다시 확인)
import { useEffect, useState } from 'react'
import { useAppStore, selectSelectedSite } from '../store/useAppStore.js'
import { sunPosition } from '../scene/sun.js'

export function useSkyDark() {
  const mode = useAppStore((s) => s.skyMode)
  const surface = useAppStore((s) => s.surface)
  const site = useAppStore(selectSelectedSite)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (mode !== 'live') return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [mode])
  if (surface !== '3d' || !site) return false
  if (mode === 'night') return true
  if (mode === 'live') return sunPosition(new Date(), site.lat, site.lng).elevation < -4
  return false
}
