// Vite 설정 파일
// - React 플러그인만 켜면 JSX를 바로 쓸 수 있습니다.
// - Vercel 루트 배포라 base 경로는 기본값('/')을 그대로 둡니다.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js가 커서 경고가 뜨는 것을 막기 위해 한도를 조금 올립니다 (단위: KB)
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node', // 순수 함수(layoutCampus 등) 테스트만 돌리므로 node 환경이면 충분
  },
})
