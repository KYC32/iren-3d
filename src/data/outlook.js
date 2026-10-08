// =============================================================
// outlook.js — "앞으로 얼마나 늘어나나" (회사 발표 목표 기준 성장 경로)
// -------------------------------------------------------------
// 기준일 뒤 매년 12월 시점의 AI 가동 전력을 계산합니다.
// 기준일 이후는 기준일의 확인 상태에서 출발해 회사 목표대로 진행하는 전망이라(research.js 의 observedSiteAt),
// 확정치가 아니라 "회사가 발표한 일정대로라면"의 숫자입니다. 화면에서도 그렇게 표시합니다.
// =============================================================
import { viewInfra } from './view.js'
import { toMonth, totalsAt } from './timeline.js'

// raw: 원본 데이터(infra.json), years: 기준일이 있는 해부터 몇 해까지 볼지
// 반환: [{ month, year, ai, energized }]  (기준일 이전 12월은 건너뜀)
export function growthPath(raw, { years = 3 } = {}) {
  const asOf = toMonth(raw.as_of, 'end')
  const firstYear = Math.floor(asOf / 12)
  const points = []
  for (let year = firstYear; year < firstYear + years; year++) {
    const month = year * 12 + 11 // 그해 12월 (월 번호 = 연도×12 + 0~11)
    if (month <= asOf) continue
    const view = viewInfra(raw, month)
    const t = totalsAt(view.observedRaw, month)
    points.push({ month, year, ai: t.ai, energized: t.energized })
  }
  return points
}
