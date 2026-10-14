// Vite 설정 파일
// - React 플러그인만 켜면 JSX를 바로 쓸 수 있습니다.
// - Vercel 루트 배포라 base 경로는 기본값('/')을 그대로 둡니다.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// 부팅 화면(GPU 랙 그림)을 index.html 의 <!-- rack --> 자리에 끼워 넣음
//   그림은 scripts/anatomy/rack/build.mjs 가 만든 src/boot/rack.html (SVG + 작은 스크립트, 지도 코드와 별개)
//   JS 번들이 아니라 HTML 에 들어가므로 번들 예산(check-size)과 무관하고, 받자마자 그려짐
const bootFigure = () => ({
  name: 'boot-figure',
  transformIndexHtml: (html) => html.replace('<!-- rack -->', () => readFileSync(new URL('./src/boot/rack.html', import.meta.url), 'utf8')),
})

export default defineConfig({
  plugins: [react(), bootFigure()],
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
