// =============================================================
// prospects.js — 지도 '?' 표시(회사가 발표하지 않은 진출 정황) 계산 (순수 함수)
// -------------------------------------------------------------
// 정황마다 공개된 날이 있어서, 타임라인이 가리키는 달까지 공개된 것만 보여 줌 (과거 화면에 미리 새지 않게)
// =============================================================
import { toMonth } from '../data/timeline.js'

// prospects: data/prospects.json 의 목록 · month: 지금 보고 있는 달(월 번호)
// → 그 달까지의 정황만 남긴 목록 (최신 정황이 위). 남은 정황이 없으면 그 지역은 뺌
export function prospectsAt(prospects, month) {
  return (prospects ?? [])
    .map((p) => ({
      ...p,
      signals: p.signals
        .filter((s) => toMonth(s.date) <= month)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    }))
    .filter((p) => p.signals.length > 0)
}
