// Natural Earth 50m 주·도 경계 원본을 캐시 폴더로 내려받습니다 (최초 1회).
// 사용법: npm run geo:fetch   → scripts/.cache/ (git 에 올리지 않음)
// 출처: https://github.com/nvkelso/natural-earth-vector (Natural Earth, 퍼블릭 도메인)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
const dir = new URL('./.cache/', import.meta.url)
const out = new URL('ne_50m_admin_1_states_provinces.geojson', dir)

if (existsSync(out)) {
  console.log('이미 받아 둔 파일이 있습니다:', out.pathname)
} else {
  mkdirSync(dir, { recursive: true })
  const res = await fetch(URL_50M)
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`)
  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  console.log('✅ 저장:', out.pathname)
}
