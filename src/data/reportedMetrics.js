import { toMonth } from './timeline.js'

// 선택한 월까지 공개된 값만 사용합니다. 같은 지표의 이력이 있으면 가장 최신 값 선택.
// 연·분기·반기 기준 지표는 해당 기간이 끝난 달부터 표시합니다.
export function reportedMetricsAt(metrics, month) {
  const latest = new Map()
  for (const metric of metrics) {
    const when = toMonth(metric.as_of, 'end')
    if (when > month) continue
    const previous = latest.get(metric.key)
    if (!previous || when > previous.when || (when === previous.when && metric.as_of > previous.metric.as_of)) {
      latest.set(metric.key, { metric, when })
    }
  }
  return [...latest.values()].map(({ metric }) => metric)
}
