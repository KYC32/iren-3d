// 앱 진입점: index.html의 #root 에 React 앱을 마운트합니다.
// 참고: React.StrictMode 는 개발 중 컴포넌트를 일부러 두 번 마운트합니다.
// drei 의 <Html> 라벨(라벨마다 별도 React 루트를 씀)이 이 이중 마운트와 충돌해
// DOM 정리 오류를 내므로, 3D 앱에서는 StrictMode 를 쓰지 않습니다.
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { reloadOnce } from './chunkReload.js'

// 조각 불러오기 실패(Vite 가 알려 줌) → 한 번만 새로고침. import.meta.url 은 이 빌드의 index-해시.js 주소
//   새로고침할 때만 기본 동작(오류 던지기)을 막음
addEventListener('vite:preloadError', (e) => {
  if (reloadOnce(sessionStorage, import.meta.url, () => location.reload())) e.preventDefault()
})

createRoot(document.getElementById('root')).render(<App />)
