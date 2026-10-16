import { describe, expect, it } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { boundsFor, MAP_HOME_CENTER, siteFeatures } from './mapData.js'
import { locationFor } from '../data/research.js'

const raw = buildInfra()
// 캠퍼스의 기준 좌표(위치 근거를 반영한 값)는 데이터에서 읽음 — 부지 위치를 다시 확인해 좌표가 바뀌어도 테스트 뜻은 그대로
const pointOf = (id) => { const l = locationFor(raw.sites.find((s) => s.id === id), raw.research); return [l.lng, l.lat] }

describe('America-centered map bounds', () => {
  it('keeps Australia on the Pacific side and includes every campus', () => {
    const [[west, south], [east, north]] = boundsFor(raw.sites, raw.research, { centerLng: MAP_HOME_CENTER[0] })
    const [auLng] = pointOf('bundey'), [esLng] = pointOf('badajoz')   // 가장 서쪽(호주, 태평양 건너) · 가장 동쪽(스페인)
    expect(west).toBeCloseTo(auLng - 360)
    expect(east).toBeCloseTo(esLng)
    expect((west + east) / 2).toBeCloseTo((auLng - 360 + esLng) / 2)
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
    const bundey = pointOf('bundey')
    expect(siteFeatures(au, raw.research).features[0].geometry.coordinates).toEqual(bundey)
    expect(boundsFor(au, raw.research)).toEqual([bundey, bundey])
  })

  it('fits nearby points across the date line without spanning the whole world', () => {
    const sites = [179, -179].map((lng, i) => ({ ...raw.sites[0], id: `sample-${i}`, coord: { lat: 10, lng } }))
    expect(boundsFor(sites, { locations: [] }, { centerLng: MAP_HOME_CENTER[0] })).toEqual([[-181, 10], [-179, 10]])
    expect(boundsFor([], raw.research, { centerLng: MAP_HOME_CENTER[0] })).toBeNull()
  })
})
