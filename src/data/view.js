// =============================================================
// view.js — v2 데이터(시점 이력) → "특정 날짜의 화면용 모양" 으로 변환
// -------------------------------------------------------------
// 화면 코드(지구본·캠퍼스·패널)는 site.status, building.status, site.grid_mw 같은
// "그 순간의 값" 을 기대합니다. 이 파일이 날짜 m 을 받아 그 값들을 계산해 채워 줍니다.
// 타임라인 슬라이더가 날짜를 바꾸면 viewInfra(raw, 새 날짜) 만 다시 부르면 됩니다.
// =============================================================
import { toMonth, progressAt, powerAt, siteStatusAt, phaseMonth, effectiveBuildingsAt } from './timeline.js'

export const asOfMonth = (dateStr) => toMonth(String(dateStr).slice(0, 7))

// 회사 그룹별 기본 건물 종류 (데이터에 kind 가 없을 때)
const DEFAULT_KIND = { miner: 'datahall_air', neocloud: 'datahall_air', hyperscaler: 'datahall_liquid', korea: 'datahall_air' }

// 건물 하나의 화면용 날짜들: 통전 / 인도 / 다음 목표 / 폐쇄
function datesOf(b, m) {
  const dates = {}
  for (const p of b.phases) {
    const pm = phaseMonth(p)
    if (pm <= m) {
      if (p.status === 'commissioning' && p.basis === 'reported') dates.energized = p.from
      if (p.status === 'operating' && p.basis === 'reported') dates.delivered = p.from
    } else {
      if (p.status === 'retired') dates.end = p.from
      else if (!dates.target) dates.target = p.from
    }
  }
  return dates
}

export function viewSite(site, m, groupOf = {}) {
  const status = siteStatusAt(site, m)
  if (!status) return null // 아직 발표 전
  const asOfM = asOfMonth(site.as_of)
  const power = powerAt(site, m)
  const buildings = []
  // 전환(replaces)으로 줄어든 용량까지 반영된 그 날짜의 건물들
  for (const { building: b, status: st, mw, estimated } of effectiveBuildingsAt(site, m)) {
    buildings.push({
      ...b,
      kind: b.kind ?? DEFAULT_KIND[groupOf[site.primary]] ?? 'datahall_air',
      status: st,
      gross_mw: mw,
      gross_estimated: estimated,
      it_mw: b.it_mw ?? 0,
      progress: st === 'under_construction' ? progressAt(b, m, asOfM) : undefined,
      dates: datesOf(b, m),
    })
  }
  // 변전소: 통전 여부와 날짜는 전력 이력(power)에서 계산
  const firstEnergized = site.power.find((p) => p.energized_mw > 0)
  const energized = power.energized > 0
  const substation = {
    mw: power.secured,
    voltage: site.substation?.voltage,
    status: energized ? 'energized' : 'planned',
    dates: energized ? { energized: firstEnergized?.from } : firstEnergized ? { target: firstEnergized.from } : {},
  }
  return {
    ...site,
    _raw: site,
    _month: m,
    lat: site.coord.lat,
    lng: site.coord.lng,
    coord_confidence: site.coord.confidence,
    grid_mw: power.secured,
    status,
    substation,
    buildings,
  }
}

// 회사 지표를 key → 값 객체로 (KPI 카드용)
function metricMap(company) {
  return Object.fromEntries((company?.metrics ?? []).map((x) => [x.key, x.value]))
}

export function viewInfra(raw, m) {
  const groupOf = Object.fromEntries(raw.companies.map((c) => [c.id, c.group]))
  return {
    raw,
    month: m,
    as_of: raw.as_of,
    companies: raw.companies,
    programs: raw.programs,
    // 회사가 하나뿐인 초기 단계의 KPI 카드 호환용 (M2 에서 회사별 KPI 로 교체)
    company: metricMap(raw.companies[0]),
    sites: raw.sites.map((s) => viewSite(s, m, groupOf)).filter(Boolean),
  }
}
