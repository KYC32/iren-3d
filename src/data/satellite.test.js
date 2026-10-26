// 위성 사진 목록(public/data/satellite.json)에서 부지·달에 맞는 사진 고르기 시험
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { satelliteAt } from './satellite.js'
import { toMonth } from './timeline.js'

const man = { images: [
  { site: 'childress', month: '2025-01', date: '2025-01-12', src: '/satellite/childress/2025-01.jpg' },
  { site: 'childress', month: '2026-03', date: '2026-03-02', src: '/satellite/childress/2026-03.jpg' },
  { site: 'childress', month: '2026-10', date: '2026-10-08', src: '/satellite/childress/2026-10.jpg' },
  { site: 'kiowa', month: '2026-10', date: '2026-10-05', src: '/satellite/kiowa/2026-10.jpg' },
] }

describe('satelliteAt', () => {
  it('그 부지의 사진 중 보고 있는 달까지만, 오래된 순', () => {
    expect(satelliteAt(man, 'childress', toMonth('2026-05')).map((i) => i.month)).toEqual(['2025-01', '2026-03'])
  })
  it('보고 있는 달 전에 사진이 없거나 다른 부지면 빈 목록', () => {
    expect(satelliteAt(man, 'childress', toMonth('2024-12'))).toEqual([])
    expect(satelliteAt(man, 'sweetwater-1', toMonth('2026-10'))).toEqual([])
  })
  it('목록 파일이 없으면 빈 목록', () => {
    expect(satelliteAt(null, 'childress', toMonth('2026-10'))).toEqual([])
  })
})

describe('public/data/satellite.json', () => {
  const p = new URL('../../public/data/satellite.json', import.meta.url)
  it('있으면: 사진 파일이 모두 있고 출처 표기(코페르니쿠스)가 있음', () => {
    if (!existsSync(p)) return
    const file = JSON.parse(readFileSync(p, 'utf8'))
    expect(file.source.attribution).toMatch(/Copernicus Sentinel/)
    for (const i of file.images) expect(existsSync(new URL(`../../public${i.src}`, import.meta.url))).toBe(true)
  })
})
