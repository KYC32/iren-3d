// sites.json 을 불러와 검증하고, 화면에 필요한 파생값(합계 등)을 계산합니다.
import { SitesFile } from './sitesSchema.js'

export async function loadSites() {
  const res = await fetch('/data/sites.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`sites.json 로드 실패: HTTP ${res.status}`)
  const raw = await res.json()
  const parsed = SitesFile.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error('sites.json 스키마 오류\n' + msg)
  }
  return parsed.data
}

// ---------- 파생값 계산 ----------
// 사이트의 계통 전력(grid_mw)을 "지금 무엇에 쓰이는가" 기준으로 나눕니다.
//   operating : 가동 중인 AI 홀 + 아직 돌고 있는 채굴동(폐쇄 예정이지만 현재 전력을 씀)
//   building  : 시운전 + 건설중
//   planned   : 나머지 (발표된 미래 단계 + 아직 용도 미발표 전력)
// 세 값의 합은 grid_mw 를 넘지 않도록 맞춥니다.
//
// TODO(학습 포인트 3): KPI 정의를 직접 결정해 보세요.
//   예) 채굴동 전력을 '가동'에서 빼고 AI 만 보여줄지? (지금은 mining 으로 따로도 제공)
//   예) commissioning(시운전)을 '가동'으로 볼지 '건설'로 볼지?
export function siteMetrics(site) {
  const sum = (pred) => site.buildings.filter(pred).reduce((n, b) => n + b.gross_mw, 0)
  const ai = sum((b) => b.status === 'operating')
  const mining = sum((b) => b.status === 'decommissioning')
  const operating = ai + mining
  const building = Math.min(
    sum((b) => b.status === 'commissioning' || b.status === 'under_construction'),
    site.grid_mw - operating,
  )
  const planned = Math.max(0, site.grid_mw - operating - building)
  const gpus = site.buildings.reduce((n, b) => n + (b.gpu?.count ?? 0), 0)
  const energized = site.substation.status === 'energized' ? site.grid_mw : 0
  return { operating, ai, mining, building, planned, gpus, energized }
}

export function companyMetrics(data) {
  const keys = ['operating', 'ai', 'mining', 'building', 'planned', 'gpus', 'energized']
  const totals = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const s of data.sites) {
    const m = siteMetrics(s)
    for (const k of keys) totals[k] += m[k]
  }
  return { ...totals, sites: data.sites.length, gridTotal: data.sites.reduce((n, s) => n + s.grid_mw, 0) }
}
