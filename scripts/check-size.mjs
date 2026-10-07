// HTML UI와 초기 3D 지도를 별도 계산. 지연 로딩된 Scene도 첫 지도 예산에 포함합니다.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectChunks } from './lib/bundle-size.mjs'
import { SINGLE_COMPANY } from '../src/config.js'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const manifest = JSON.parse(readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'))
const mapRoots = ['index.html', 'src/scene/Scene.jsx']
if (!SINGLE_COMPANY) mapRoots.push('src/scene/GlobeView.jsx')
const budgets = [
  { label: 'HTML UI', roots: ['index.html'], limit: 120 },
  { label: '첫 3D 지도 포함 전체', roots: mapRoots, limit: 450 },
]
for (const { label, roots, limit } of budgets) {
  const total = collectChunks(manifest, roots)
    .reduce((sum, file) => sum + gzipSync(readFileSync(join(DIST, file))).length / 1024, 0)
  const ok = total <= limit
  console.log(`${ok ? '✅' : '❌'} ${label}: ${total.toFixed(1)} KiB (gzip) / 한도 ${limit} KiB`)
  if (!ok) process.exitCode = 1
}
