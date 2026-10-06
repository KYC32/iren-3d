// 앱 진입점: index.html의 #root 에 React 앱을 마운트합니다.
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
