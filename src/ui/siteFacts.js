// =============================================================
// siteFacts.js — 캠퍼스 패널 "현장 관찰 · 이중화" 칸의 순수 함수 (SiteFacts.jsx 가 씀)
// =============================================================
import { toMonth } from '../data/timeline.js'

// 한 사이트의 설비·관찰 중 보고 있는 달(month)까지 공개된 것만
//   회사 홈페이지 설명(reported, 날짜 없음)은 늘 보여 주고, 제3자 관찰은 게시한 달부터
export function factsFor(file, siteId, month) {
  const known = (x) => !x.published || toMonth(x.published) <= month
  return {
    facilities: (file?.facilities ?? []).filter((f) => f.site === siteId && known(f)),
    progress: (file?.progress ?? []).filter((p) => p.site === siteId && known(p)),
  }
}

// 홀 하나의 세그먼트 칸마다 단계: 'ats' > 'equipment' > 'pad' > 'none'
//   장비 개수로 앞 칸부터 채움 — 관찰 글이 "몇 개 설치"만 알려 주므로 칸 순서는 실제 위치가 아님 (화면에도 그렇게 적음)
//   equipment = 전기실(MER)·변압기·발전기가 모두 있는 칸
export function segmentStages(hall, perHall) {
  const equipment = Math.min(hall.mer, hall.transformers, hall.generators)
  return Array.from({ length: perHall }, (_, i) => (i < hall.ats ? 'ats' : i < equipment ? 'equipment' : i < hall.pads ? 'pad' : 'none'))
}
