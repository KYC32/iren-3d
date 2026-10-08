import { describe, it, expect } from 'vitest'
import { customerZones, zoneBounds } from './customerZones.js'
import { viewInfra } from './view.js'
import { toMonth } from './timeline.js'
import { buildInfra } from '../../scripts/build-data.mjs'

describe('customer zones', () => {
  it('aggregates distinct buildings and links only their customer contracts', () => {
    const data = viewInfra(buildInfra(), toMonth('2026-10'))
    const zones = customerZones(data.sites.find((s) => s.id === 'childress'), data.companies)
    const ms = zones.find((z) => z.key === 'microsoft')
    expect(ms.buildings.map((b) => b.id)).toEqual(['horizon-1', 'horizon-2', 'horizon-3', 'horizon-4'])
    expect(ms.itMw).toBe(200)
    expect(ms.statuses.find((s) => s.status === 'delivered').itMw).toBe(50)
    expect(ms.contracts.map((c) => c.id)).toEqual(['microsoft-2025'])
    expect(zones.find((z) => z.key === 'nvidia').itMw).toBe(0)
  })
  it('does not infer customer zones from a supplier or partnership', () => {
    expect(customerZones({ id: 'x', buildings: [{ id: 'a', gpu: { model: 'NVIDIA' }, gross_mw: 10 }] })).toEqual([])
  })
  it('fits the entire footprint rather than only block centers', () => {
    expect(zoneBounds([{ x: -10, z: 0, w: 8, d: 4 }, { x: 10, z: 6, w: 4, d: 8 }])).toEqual({ x: -1, z: 4, side: 30 })
    expect(zoneBounds([])).toBeNull()
  })
})
