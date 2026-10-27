// =============================================================
// satellite.js — 캠퍼스 위성 사진(Sentinel-2) 고르기 (순수 함수)
// -------------------------------------------------------------
// 목록: public/data/satellite.json (scripts/satellite/fetch_sentinel.py 가 매달 늘림)
// 타임라인이 가리키는 달까지 찍힌 사진만 — 과거 화면에 미래 사진이 미리 보이지 않게
// =============================================================
import { toMonth } from './timeline.js'

// manifest: satellite.json 내용 · siteId: 부지 · month: 보고 있는 달(월 번호) → 오래된 순 사진 목록
export function satelliteAt(manifest, siteId, month) {
  return (manifest?.images ?? [])
    .filter((i) => i.site === siteId && toMonth(i.month) <= month)
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
}

// 자동 넘김 한 걸음: 지금 사진 순번 i, 마지막 순번 last → 다음 순번 (마지막이면 null = 멈춤)
export const nextFrame = (i, last) => (i >= last ? null : i + 1)

// 실제 지도에 겹칠 사진: 부지마다 가장 최근 한 장 (네 귀퉁이 corners 가 있는 것만) → [{ site, img }]
//   실제 지도는 늘 기준일(지금) 모습이라 타임라인 달과 상관없이 마지막 사진
export function latestPerSite(manifest) {
  const last = new Map()
  for (const img of manifest?.images ?? []) {
    if (!img.corners) continue
    const prev = last.get(img.site)
    if (!prev || img.month > prev.month) last.set(img.site, img)
  }
  return [...last.entries()].map(([site, img]) => ({ site, img }))
}
