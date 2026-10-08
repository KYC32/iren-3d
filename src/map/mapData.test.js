import { describe, expect, it } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { boundsFor, MAP_HOME_CENTER, siteFeatures } from './mapData.js'

const raw = buildInfra()

describe('America-centered map bounds', () => {
  it('keeps Australia on the Pacific side and includes every campus', () => {
    const [[west, south], [east, north]] = boundsFor(raw.sites, raw.research, { centerLng: MAP_HOME_CENTER[0] })
    expect(west).toBeCloseTo(139.3 - 360)
    expect(east).toBeCloseTo(-6.97)
    expect((west + east) / 2).toBeCloseTo(-113.835)
    expect(east - west).toBeLessThan(220)
    for (const f of siteFeatures(raw.sites, raw.research).features) {
      const [lng, lat] = f.geometry.coordinates
      expect([lng - 360, lng, lng + 360].some(x => x >= west - 1e-9 && x <= east + 1e-9)).toBe(true)
      expect(lat).toBeGreaterThanOrEqual(south)
      expect(lat).toBeLessThanOrEqual(north)
    }
  })

  it('preserves canonical marker coordinates and country-level bounds', () => {
    const au = raw.sites.filter(s => s.country === 'AU')
    boundsFor(au, raw.research, { centerLng: MAP_HOME_CENTER[0] })
    expect(siteFeatures(au, raw.research).features[0].geometry.coordinates).toEqual([139.3, -33.89])
    expect(boundsFor(au, raw.research)).toEqual([[139.3, -33.89], [139.3, -33.89]])
  })

  it('fits nearby points across the date line without spanning the whole world', () => {
    const sites = [179, -179].map((lng, i) => ({ ...raw.sites[0], id: `sample-${i}`, coord: { lat: 10, lng } }))
    expect(boundsFor(sites, { locations: [] }, { centerLng: MAP_HOME_CENTER[0] })).toEqual([[-181, 10], [-179, 10]])
    expect(boundsFor([], raw.research, { centerLng: MAP_HOME_CENTER[0] })).toBeNull()
  })
})
