// =============================================================
// 번들 크기 검사 (npm run build 뒤에 자동 실행 — postbuild)
// 첫 화면에서 브라우저가 받는 JS(gzip 기준) 합계가 한도를 넘으면 빌드를 실패시킵니다.
// 회사·기능이 늘어도 첫 로딩이 느려지지 않게 지키는 안전장치입니다.
// =============================================================
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIMIT_KB = 450
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

// index.html 이 바로 불러오는 스크립트 + 미리 불러오는(modulepreload) 스크립트
const srcs = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1])

let total = 0
for (const src of new Set(srcs)) {
  const file = join(DIST, src.replace(/^\//, ''))
  if (!existsSync(file)) continue
  const kb = gzipSync(readFileSync(file)).length / 1024
  total += kb
  console.log(`  ${src}  ${kb.toFixed(1)} KB (gzip)`)
}
const msg = `첫 화면 JS 합계 ${total.toFixed(1)} KB (gzip) / 한도 ${LIMIT_KB} KB`
if (total > LIMIT_KB) {
  console.error(`❌ ${msg} — 코드 분할(React.lazy)이나 의존성 정리가 필요합니다.`)
  process.exit(1)
}
console.log(`✅ ${msg}`)
