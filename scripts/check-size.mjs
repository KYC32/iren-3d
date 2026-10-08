// =============================================================
// check-size.mjs — 첫 화면 번들 크기 검사 (용량 예산)
// -------------------------------------------------------------
// `npm run build` 가 끝나면 자동으로 실행됩니다 (package.json 의 postbuild).
// 예산(budget)마다 첫 화면에 필요한 JS·CSS 파일을 모아 gzip 압축 크기를 재고,
// 한도를 넘으면 종료 코드 1 로 빌드를 실패시킵니다 → 모르는 사이에 첫 로딩이 느려지는 걸 막음.
// HTML UI와 초기 3D 지도를 별도 계산. 지연 로딩된 Scene도 첫 지도 예산에 포함합니다.
// =============================================================
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectChunks } from './lib/bundle-size.mjs'
import { SINGLE_COMPANY } from '../src/config.js'

// 빌드 결과 폴더(dist)와, Vite 가 남긴 "파일 ↔ import 관계" 목록(manifest)
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const manifest = JSON.parse(readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'))
// 3D 지도 진입점: 기본 UI + 지연 로딩되는 3D 장면(Scene)
// 단일 회사 모드가 아니면 지구본(GlobeView)도 첫 3D 화면에 들어가므로 함께 셈
const mapRoots = ['index.html', 'src/scene/Scene.jsx']
if (!SINGLE_COMPANY) mapRoots.push('src/scene/GlobeView.jsx')
// 예산 목록 (limit 단위: KiB, gzip 기준)
//   1) HTML UI: 패널·KPI 등 기본 화면 코드만 (index.html 에서 정적으로 import 되는 것)
//   2) 실제 지도 포함 전체: 기본 첫 화면 — HTML UI + 지연 로딩되는 maplibre 실제 지도(GeoMap)
//   3) 첫 3D 지도 포함 전체: HTML UI + 3D 장면(three.js) — 3D 화면으로 바꿨을 때 받는 양
const budgets = [
  { label: 'HTML UI', roots: ['index.html'], limit: 120 },
  { label: '실제 지도 포함 전체', roots: ['index.html', 'src/map/GeoMap.jsx'], limit: 550 },
  { label: '첫 3D 지도 포함 전체', roots: mapRoots, limit: 450 },
]
for (const { label, roots, limit } of budgets) {
  // 필요한 파일마다 gzip 으로 압축한 크기(바이트 ÷ 1024 = KiB)를 더함 — 실제 네트워크 전송량에 가까움
  const total = collectChunks(manifest, roots)
    .reduce((sum, file) => sum + gzipSync(readFileSync(join(DIST, file))).length / 1024, 0)
  const ok = total <= limit
  console.log(`${ok ? '✅' : '❌'} ${label}: ${total.toFixed(1)} KiB (gzip) / 한도 ${limit} KiB`)
  // 바로 끝내지 않고 종료 코드만 1 로 표시 → 나머지 예산도 모두 출력한 뒤 실패로 끝남
  if (!ok) process.exitCode = 1
}
