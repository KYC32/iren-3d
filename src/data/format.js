// 숫자 표시: 1,000MW 이상은 GW 로
export function fmtMw(mw, digits = 1) {
  if (mw == null) return '–'
  if (mw >= 1000) return `${(mw / 1000).toFixed(digits).replace(/\.0$/, '')} GW`
  return `${Math.round(mw).toLocaleString()} MW`
}

// 이름 머리글자 (사진을 못 받을 때 동그라미에 대신): 'Daniel Roberts' → 'DR', 'Will' → 'W' (최대 2글자)
export function initialsOf(name) {
  return String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// 통전 전 변전소 표시: "통전 목표 2028" / 목표도 모르면 "통전 전"
//   (예전엔 "통전 2028" 이나 날짜 없이 "통전"만 나와 이미 통전된 것처럼 읽혔음)
export function energizeLabel(sub, t) {
  const target = sub?.dates?.target
  return target ? `${t.panel.energizeTarget} ${target}` : t.panel.notEnergized
}

// 회사 발표 지표 표시 (KPI 줄·계약 탭 공용): 단위에 맞게 $bn / $m / % / 년 / GW·MW / 개수
//   qualifier: 'over' = 회사가 "이상"이라고 쓴 값 → 앞에 ">" (예: >$20m), 'about' = "약" → "~" (예: ~$25m)
//   value_max: 범위의 큰 쪽 (예: 선급금 45~55% → value 45, value_max 55)
export function fmtMetric(x, lang = 'ko') {
  const pre = x.qualifier === 'over' ? '>' : x.qualifier === 'about' ? '~' : ''
  const num = x.value_max != null ? `${x.value}~${x.value_max}` : String(x.value)
  let body
  if (x.unit === 'USD bn') body = `$${num}bn`
  else if (x.unit === 'USD m') body = `$${num}m`
  else if (x.unit === '%') body = `${num}%`
  else if (x.unit === 'years') body = lang === 'ko' ? `${num}년` : `${num} yrs`
  else if (x.unit === 'GW' || x.unit === 'MW') body = `${num} ${x.unit}`
  else body = x.value >= 1000 ? `~${Math.round(x.value / 1000)}k` : num // 개수: 큰 수는 k 로 줄임
  return pre + body
}

