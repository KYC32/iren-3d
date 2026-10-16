// =============================================================
// URL 해시 ↔ 화면 상태 (순수 함수)
// 예) #date=2027-06&site=childress&c=iren,galaxy&color=company
//   date  : 타임라인 날짜 (YYYY-MM)
//   site  : 열려 있는 캠퍼스
//   c     : 회사 필터 (쉼표로 여러 개)
//   color : 핀 색 기준 (status | company)
//   sky   : 3D 캠퍼스 하늘 (day 낮 | dusk 노을 | night 밤) — 기본인 지금(live, 부지 현지 시각)은 생략
//   page  : 지도 대신 보여 줄 페이지 (portfolio 사업 현황 | stock 주가 | news 뉴스) — 지도는 생략
//   at    : 주가 차트에서 강조할 날짜 (YYYY-MM-DD, page=stock 일 때만)
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
  const surface = q.get('surface')
  if (surface === '3d') out.surface = surface
  const tab = q.get('tab')
  if (['history', 'evidence'].includes(tab)) out.tab = tab
  const page = q.get('page')
  if (['portfolio', 'stock', 'news'].includes(page)) out.page = page
  const at = q.get('at')
  if (out.page === 'stock' && at && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(at)) out.at = at
  const sky = q.get('sky')
  if (['day', 'dusk', 'night', 'live'].includes(sky)) out.sky = sky
  for (const key of ['building','zone']) { const v=q.get(key); if (v && /^[a-z0-9-]+$/.test(v)) out[key]=v }
  return out
}

// 기본값과 같은 항목은 생략해 주소를 짧게 유지
export function buildHash({ site = null, date = null, companies = [], color = 'status', surface = 'map', tab = 'overview', building = null, zone = null, sky = 'live', page = null, at = null } = {}) {
  const q = new URLSearchParams()
  if (page) q.set('page', page)              // 맨 앞: 공유 링크에서 "무슨 페이지인지"가 먼저 보이게
  if (page === 'stock' && at) q.set('at', at)
  if (date) q.set('date', date)
  if (site) q.set('site', site)
  if (companies.length) q.set('c', [...companies].join(','))
  if (color && color !== 'status') q.set('color', color)
  if (site && surface === '3d') q.set('surface', surface)
  if (site && tab !== 'overview') q.set('tab', tab)
  if (site && building) q.set('building',building)
  if (site && zone) q.set('zone',zone)
  if (site && surface === '3d' && sky && sky !== 'live') q.set('sky', sky) // 기본(지금)은 생략
  const s = q.toString().replace(/%2C/g, ',')
  return s ? `#${s}` : ''
}
