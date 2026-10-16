// 숫자 표시: 1,000MW 이상은 GW 로
export function fmtMw(mw, digits = 1) {
  if (mw == null) return '–'
  if (mw >= 1000) return `${(mw / 1000).toFixed(digits).replace(/\.0$/, '')} GW`
  return `${Math.round(mw).toLocaleString()} MW`
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

