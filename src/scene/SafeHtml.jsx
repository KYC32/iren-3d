// =============================================================
// SafeHtml — drei <Html> 을 "이벤트 연결이 끝난 뒤에" 붙이는 얇은 포장
// -------------------------------------------------------------
// drei Html 은 라벨 DOM 을 붙일 곳(target)을 events.connected 로 정합니다.
// 캔버스가 처음 뜰 때 가장 먼저 만들어진 Html 은 아직 events.connected 가 없어서
// 다른 곳에 붙었다가, 연결되는 순간 target 이 바뀌며 React 루트를 지우고 새로 만듭니다.
// 이때 "렌더 중 루트 정리"가 뒤로 미뤄져 새로 그린 내용까지 지워지는 경쟁이 생겨
// 라벨이 빈 상자로 남았습니다 (예: 보드판에서 첫 사이트인 칠드레스 라벨이 사라짐).
// → 연결이 끝난 뒤에만 Html 을 만들면 target 이 처음부터 고정돼 경쟁이 없습니다.
// 사용법은 drei Html 과 똑같습니다: <Html position={...} center>...</Html>
// =============================================================
import { Html as DreiHtml } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

export default function Html(props) {
  const connected = useThree((s) => s.events.connected)
  if (!connected) return null // 아직 연결 전 → 다음 렌더에서 붙음 (한두 프레임 차이)
  return <DreiHtml {...props} />
}
