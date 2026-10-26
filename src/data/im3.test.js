// 지도 '주변 데이터센터' 층 자료(public/data/im3-datacenters.json) 시험
//   scripts/fetch-im3.mjs 가 만든 파일이 지도 층(DataCenterLayer.jsx)이 읽는 모양인지, ODbL 출처 표기가 있는지 봄
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const file = JSON.parse(readFileSync(new URL('../../public/data/im3-datacenters.json', import.meta.url), 'utf8'))

describe('public/data/im3-datacenters.json', () => {
  it('ODbL 라이선스와 출처 문구(OpenStreetMap contributors)가 있음', () => {
    expect(file.source.license).toBe('ODbL-1.0')
    expect(file.source.attribution).toMatch(/IM3/)
    expect(file.source.attribution).toMatch(/© OpenStreetMap contributors/)
    expect(file.note).toMatch(/Open Database License/)
  })
  it('점마다 [경도, 위도, 이름, 운영사, 종류] — 미국 안, 종류는 캠퍼스·건물·위치 중 하나', () => {
    expect(file.points.length).toBeGreaterThan(1000)
    for (const [lng, lat, name, operator, type] of file.points) {
      expect(lng).toBeGreaterThan(-180); expect(lng).toBeLessThan(-60)
      expect(lat).toBeGreaterThan(17); expect(lat).toBeLessThan(72)
      expect(typeof name).toBe('string'); expect(typeof operator).toBe('string')
      expect(['campus', 'building', 'point']).toContain(type)
    }
  })
  it('경도가 지도 경도 펼침(−340° ~ 20°) 안이라 층이 mapLongitude 없이 그대로 써도 캠퍼스 카드와 같은 자리', async () => {
    const { mapLongitude } = await import('../map/mapData.js')
    for (const [lng] of file.points) expect(mapLongitude(lng)).toBeCloseTo(lng, 9)
  })
})
