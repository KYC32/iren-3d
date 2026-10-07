// infra.json(v2) 을 불러와 기준일의 화면용 데이터로 바꾸고, KPI 합계를 계산합니다.
import { siteMetricsAt, totalsAt } from './timeline.js'

export async function loadSites() {
  const res = await fetch('/data/infra.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`infra.json 로드 실패: HTTP ${res.status}`)
  const raw = await res.json()
  // 개발 중에는 데이터를 고치다 실수하면 바로 알 수 있게 화면에서도 검증 (배포본은 빌드 때 검증 완료)
  if (import.meta.env.DEV) {
    const { InfraFile } = await import('./schema.js')
    const parsed = InfraFile.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
      throw new Error('infra.json 스키마 오류\n' + msg)
    }
  }
  return raw // 날짜별 화면용 변환은 스토어(setRaw/setMonth)가 담당
}

// ---------- KPI (화면용 사이트 → 그 날짜의 원본으로 계산) ----------
export function siteMetrics(viewSite) {
  return siteMetricsAt(viewSite._raw, viewSite._month)
}

export function companyMetrics(data) {
  const t = totalsAt(data.raw, data.month)
  return { ...t, gridTotal: t.secured }
}
