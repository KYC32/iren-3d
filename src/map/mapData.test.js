import { describe, expect, it } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { boundsFor, MAP_HOME_CENTER, siteFeatures, REGION_NAMES, hqLngLat, regionBounds, mapLongitude, onScreenAnyCopy } from './mapData.js'
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

// 본사(시드니) — '본사' 지역 단추와 지도 위 본사 카드 자리
describe('본사 자리', () => {
  const sites = raw.sites, research = raw.research, hq = raw.companies[0].hq
  it('REGION_NAMES 끝에 본사', () => expect(Object.entries(REGION_NAMES).at(-1)).toEqual(['HQ', ['본사', 'HQ']]))
  it('hqLngLat: 시드니는 이 지도에서 북미 왼쪽(번디와 같은 쪽)', () => {
    const [lng] = hqLngLat(hq); expect(lng).toBe(mapLongitude(hq.lng)); expect(lng).toBeLessThan(MAP_HOME_CENTER[0])
  })
  it("regionBounds: 'AU'·'ALL' 은 본사를 품고, 'HQ' 는 null, 'US' 는 본사 없이", () => {
    const au = regionBounds('AU', sites, research, hq)
    expect(au[1][0]).toBeGreaterThanOrEqual(hqLngLat(hq)[0]); expect(au[0][1]).toBeLessThanOrEqual(hq.lat)
    expect(regionBounds('ALL', sites, research, hq)[0][1]).toBeLessThanOrEqual(hq.lat)
    expect(regionBounds('HQ', sites, research, hq)).toBeNull()
    expect(regionBounds('US', sites, research, hq)).toEqual(boundsFor(sites.filter((s) => s.country === 'US'), research, { centerLng: MAP_HOME_CENTER[0] }))
  })
})

// 지도는 경도를 펼쳐 두지만(시드니 = −208.8°) 지도 라이브러리는 비행 뒤 중심을 [−180,180] 으로 접음
//   → 펼친 경도 하나만 화면 좌표로 바꾸면 360° 떨어진 엉뚱한 자리를 봐서 "화면 밖"이 됨 (본사 카드가 발언 자료를 안 받았음)
describe('onScreenAnyCopy: 경도 ±360° 사본 중 하나라도 화면 안이면 보임', () => {
  // 가짜 화면 좌표: 중심 경도 151.2 를 화면 가운데(720)에, 1° = 10px
  const project = ([lng, lat]) => ({ x: 720 + (lng - 151.2) * 10, y: 450 - lat })
  it('펼친 경도(−208.8)여도 +360 사본(151.2)이 화면 가운데면 보임', () => expect(onScreenAnyCopy(project, [-208.8, -33.87], 1440, 900)).toBe(true))
  it('어느 사본도 화면 밖이면 안 보임', () => expect(onScreenAnyCopy(project, [-20, -33.87], 1440, 900)).toBe(false))
  it('여유: 가로 80px · 아래 100px 바깥까지는 보이는 셈 (카드가 걸쳐 있음)', () => {
    expect(onScreenAnyCopy(() => ({ x: -79, y: 10 }), [0, 0], 1440, 900)).toBe(true)
    expect(onScreenAnyCopy(() => ({ x: 100, y: 999 }), [0, 0], 1440, 900)).toBe(true)
    expect(onScreenAnyCopy(() => ({ x: 100, y: -1 }), [0, 0], 1440, 900)).toBe(false)
  })
})
