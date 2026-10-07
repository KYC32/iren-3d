// 고객 필드로만 묶습니다. GPU 공급사나 협력사 이름으로 구역을 추정하지 않습니다.
export const customerKey = (name) => String(name ?? '').trim().toLowerCase()

export function customerZones(site, companies = []) {
  const groups = new Map()
  for (const b of site.buildings) {
    if (!b.customer || b.status === 'retired') continue
    const key = customerKey(b.customer)
    if (!groups.has(key)) groups.set(key, { key, name: b.customer, buildings: [], contracts: [] })
    groups.get(key).buildings.push(b)
  }
  for (const zone of groups.values()) {
    const ids = new Set(zone.buildings.map((b) => b.id))
    zone.contracts = companies.flatMap((c) => c.contracts ?? []).filter((c) =>
      c.sites.includes(site.id) && customerKey(c.customer) === zone.key && c.buildings?.some((id) => ids.has(id)))
    zone.itMw = zone.buildings.reduce((sum, b) => sum + (b.it_mw || 0), 0)
    zone.grossMw = zone.buildings.reduce((sum, b) => sum + b.gross_mw, 0)
    zone.statuses = Object.entries(Object.groupBy(zone.buildings, (b) => b.status)).map(([status, buildings]) => ({
      status, count: buildings.length, itMw: buildings.reduce((sum, b) => sum + (b.it_mw || 0), 0),
    }))
  }
  return [...groups.values()]
}

export function zoneBounds(blocks) {
  if (!blocks.length) return null
  const x0 = Math.min(...blocks.map((b) => b.x - b.w / 2))
  const x1 = Math.max(...blocks.map((b) => b.x + b.w / 2))
  const z0 = Math.min(...blocks.map((b) => b.z - b.d / 2))
  const z1 = Math.max(...blocks.map((b) => b.z + b.d / 2))
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, side: Math.max(x1 - x0, z1 - z0) + 4 }
}
