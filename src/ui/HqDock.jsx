// =============================================================
// HqDock — 휴대폰(767px 이하) 본사 3D 화면: 최근 발언 말풍선을 화면 아래에 붙임 (CEO 카드는 그대로 빌딩 위)
// -------------------------------------------------------------
// 빌딩 위 CEO 카드 옆에 붙이기엔 화면이 좁아서 (375px) 말풍선만 아래로 모음
// App 이 본사 화면의 .bottom 안(안내 문구 위)에 그림 → CameraRig 가 이 묶음 위쪽까지만 빌딩을 맞춤
// 넓은 화면에선 CSS 로 숨김 (그땐 HqView 가 CEO 카드 옆 3D 위치에 같은 말풍선을 붙임)
// =============================================================
import { Bubble, useStatementsFile } from './HqParts.jsx'

export default function HqDock() {
  const file = useStatementsFile()
  if (!file) return null
  return (
    <div className="hq-dock">
      <Bubble file={file} docked />
    </div>
  )
}
