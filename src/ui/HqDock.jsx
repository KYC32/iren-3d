// =============================================================
// HqDock — 휴대폰(767px 이하) 본사 3D 화면: CEO 배지 줄 + 최근 발언 말풍선을 화면 아래에 붙임
// -------------------------------------------------------------
// 빌딩 양옆에 붙이기엔 화면이 좁아서 (375px 에서 배지·말풍선이 화면 밖으로 잘렸음) 아래로 모음
// App 이 본사 화면의 .bottom 안(안내 문구 위)에 그림 → CameraRig 가 이 묶음 위쪽까지만 빌딩을 맞춤
// 넓은 화면에선 CSS 로 숨김 (그땐 HqView 가 빌딩 옆 3D 위치에 같은 조각을 붙임)
// =============================================================
import { useAppStore } from '../store/useAppStore.js'
import { Badges, Bubble, useStatementsFile } from './HqParts.jsx'

export default function HqDock() {
  const file = useStatementsFile()
  const level = useAppStore((s) => s.data?.companies?.[0]?.hq?.building?.level ?? 5)
  if (!file) return null
  return (
    <div className="hq-dock">
      <Badges file={file} level={level} docked />
      <Bubble file={file} docked />
    </div>
  )
}
