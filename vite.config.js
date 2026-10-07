// Vite 설정 파일
// - React 플러그인만 켜면 JSX를 바로 쓸 수 있습니다.
// - Vercel 루트 배포라 base 경로는 기본값('/')을 그대로 둡니다.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true, // 번들 검사에서 동적 3D 진입점까지 합산
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /node_modules[\\/]three[\\/]build[\\/]three\.core\.js$/, priority: 2 },
            { name: 'three-renderer', test: /node_modules[\\/]three[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node', // 순수 함수(layoutCampus 등) 테스트만 돌리므로 node 환경이면 충분
  },
})
