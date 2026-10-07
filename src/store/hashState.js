// =============================================================
// URL 해시 ↔ 화면 상태 (순수 함수)
// 예) #date=2027-06&site=childress&c=iren,galaxy&color=company
//   date  : 타임라인 날짜 (YYYY-MM)
//   site  : 열려 있는 캠퍼스
//   c     : 회사 필터 (쉼표로 여러 개)
//   color : 핀 색 기준 (status | company)
// 옛 링크(#site=childress)도 그대로 동작합니다.
// =============================================================

export function parseHash(hash) {
  const q = new URLSearchParams(String(hash ?? '').replace(/^#/, ''))
  const out = {}
  const site = q.get('site')
  if (site && /^[a-z0-9-]+$/.test(site)) out.site = site
  const date = q.get('date')
  if (date && /^\d{4}-(0[1-9]|1[0-2])$/.test(date)) out.date = date
  const c = q.get('c')
  if (c) {
    const ids = c.split(',').filter((x) => /^[a-z0-9-]+$/.test(x))
    if (ids.length) out.companies = ids
  }
  const color = q.get('color')
  if (color === 'status' || color === 'company') out.color = color
  return out
}

// 기본값과 같은 항목은 생략해 주소를 짧게 유지
export function buildHash({ site = null, date = null, companies = [], color = 'status' } = {}) {
  const q = new URLSearchParams()
  if (date) q.set('date', date)
  if (site) q.set('site', site)
  if (companies.length) q.set('c', [...companies].join(','))
  if (color && color !== 'status') q.set('color', color)
  const s = q.toString().replace(/%2C/g, ',')
  return s ? `#${s}` : ''
}
