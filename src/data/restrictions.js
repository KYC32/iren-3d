// =============================================================
// restrictions.js — 지역 규제(데이터센터 유예·제한 조치) 계산 (순수 함수)
// -------------------------------------------------------------
// 자료: Miklian(2026) "US data center moratoria and local opposition" (CC BY 4.0, Hugging Face)
//   미국 카운티·도시·부족 정부가 2017-01 ~ 2026-08 에 채택한 데이터센터 유예·제한 조치 목록
// scripts/fetch-restrictions.mjs 가 이 함수로 부지마다 계산해 data/restrictions.json 에 적고,
// 캠퍼스 패널(SiteRules.jsx)은 그 결과만 읽음 → 화면에는 계산 코드가 들어가지 않음
// 제3자 연구 자료라 회사 발표가 아님 — 화면에도 그렇게 적음
// =============================================================

// 두 점 사이의 거리(km) — 지구를 반지름 6,371km 공으로 보고 대원 거리를 구함 (하버사인 공식)
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

// 원문의 '현재 상태' 문장(영어, 길고 제각각) → 짧은 상태 하나
//   철회(rescinded·repealed·lifted) / 만료(expired) / 유효(active·in effect) / 그 밖은 모름
//   원문은 보통 상태 낱말로 시작함 ("Active as of …", "Rescinded. Following …") → 첫머리를 먼저 봄
//   첫머리에 없을 때만 첫 문장 안에서 찾음 — 뒤 문장의 부정문("no … action rescinding")에 속지 않게
//   replaced = 유예가 끝나고 영구 규정(조례)으로 바뀜 · extended = 연장 → 유효로 봄
export function statusOf(text) {
  const t = String(text ?? '').trim().toLowerCase()
  if (/^(rescinded|repealed|lifted|revoked)/.test(t)) return 'rescinded'
  if (/^replaced/.test(t)) return 'replaced'
  if (/^(expired|lapsed)/.test(t)) return 'expired'
  if (/^(active|in effect|in force|extended)/.test(t)) return 'active'
  const first = t.split(/[.;]/)[0]
  if (/\b(rescinded|repealed|lifted|revoked)\b/.test(first)) return 'rescinded'
  if (/\b(expired|lapsed)\b/.test(first)) return 'expired'
  if (/\bactive\b|in effect|in force/.test(first)) return 'active'
  return 'unknown'
}

// 부지 하나의 지역 규제 요약
//   site: { site, lat, lng, state(두 글자), county, county_fips } · rows: 조치 목록 (fetch 스크립트가 CSV 에서 만든 것)
//   year: '그해 몇 건'을 셀 해 (보통 자료의 마지막 해)
//   가장 가까운 조치는 같은 주 안에서만 찾음 (주마다 법이 달라서 다른 주 조치는 비교 의미가 작음)
export function restrictionsFor(site, rows, { year }) {
  const inState = rows.filter((r) => r.state === site.state)
  const nearest = inState
    .map((r) => ({ r, km: haversineKm(site.lat, site.lng, r.lat, r.lng) }))
    .sort((a, b) => a.km - b.km)[0]
  return {
    site: site.site,
    county: site.county,
    county_fips: site.county_fips,
    state: site.state,
    county_count: inState.filter((r) => r.county_fips === site.county_fips).length,
    state_count: inState.length,
    state_count_year: inState.filter((r) => String(r.date).startsWith(String(year))).length,
    year,
    nearest: nearest
      ? { jurisdiction: nearest.r.jurisdiction, type: nearest.r.type, county: nearest.r.county, date: nearest.r.date, km: Math.round(nearest.km), status: nearest.r.status }
      : null,
  }
}
