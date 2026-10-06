// 앱 진입점: index.html의 #root 에 React 앱을 마운트합니다.
// 참고: React.StrictMode 는 개발 중 컴포넌트를 일부러 두 번 마운트합니다.
// drei 의 <Html> 라벨(라벨마다 별도 React 루트를 씀)이 이 이중 마운트와 충돌해
// DOM 정리 오류를 내므로, 3D 앱에서는 StrictMode 를 쓰지 않습니다.
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

createRoot(document.getElementById('root')).render(<App />)
