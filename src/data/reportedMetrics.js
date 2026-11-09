import { toMonth } from './timeline.js'

// 선택한 월까지 공개된 값만 사용합니다. 같은 지표의 이력이 있으면 가장 최신 값 선택.
// 연·분기·반기 기준 지표는 해당 기간이 끝난 달부터 표시합니다.
// place: 보여 줄 자리 — 'kpi'(기본, 위쪽 KPI 줄) 또는 'contracts'(계약 탭의 계약 조건 요약).
//   지표의 show 가 없으면 KPI 줄 지표로 봅니다.
export function reportedMetricsAt(metrics, month, place = 'kpi') {
  const latest = new Map()
  for (const metric of metrics) {
    if ((metric.show ?? 'kpi') !== place) continue
    const when = toMonth(metric.as_of, 'end')
    if (when > month) continue
    const previous = latest.get(metric.key)
    if (!previous || when > previous.when || (when === previous.when && metric.as_of > previous.metric.as_of)) {
      latest.set(metric.key, { metric, when })
    }
  }
  return [...latest.values()].map(({ metric }) => metric)
}

// 같은 지표(key)의 이력 중 as_of 가 가장 늦은 값 하나를 돌려줍니다.
//   companies.json 의 metrics[] 는 이력이 쌓여 같은 key 가 여러 번 나옵니다(옛 값 → 새 값).
//   영상 자막·투어처럼 "지금 기준" 값만 필요한 곳은 배열 첫 값(find)이 아니라 이걸 씁니다.
//   as_of 는 '2026-08'·'2026-09'·'2026-Q4' 처럼 섞여 있어 기간 끝 달(toMonth 'end')로 비교합니다.
export function latestMetric(metrics, key) {
  let best
  for (const metric of metrics ?? []) {
    if (metric.key !== key) continue
    if (!best || toMonth(metric.as_of, 'end') > toMonth(best.as_of, 'end')) best = metric
  }
  return best
}
