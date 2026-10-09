import { describe, it, expect } from 'vitest'
import { sunPosition, solarDate, skyTarget, localClock } from './sun.js'
import { toMonth } from '../data/timeline.js'

describe('태양 위치 (sunPosition)', () => {
  it('춘분 정오 적도에서는 태양이 거의 머리 위', () => {
    // 2026-03-20 12:07 UTC 무렵이 경도 0 의 남중 (균시차 약 7분)
    const s = sunPosition(new Date(Date.UTC(2026, 2, 20, 12, 7)), 0, 0)
    expect(s.elevation).toBeGreaterThan(88)
  })
  it('하지 칠드레스 남중 고도 ≈ 90 − (위도 − 23.44)', () => {
    // 경도 −100.2° → 남중은 약 18:43 UTC
    const s = sunPosition(new Date(Date.UTC(2026, 5, 21, 18, 43)), 34.43, -100.2)
    expect(s.elevation).toBeCloseTo(90 - (34.43 - 23.44), 0)
    expect(s.azimuth > 170 && s.azimuth < 190).toBe(true) // 북반구 정오 = 남쪽(180°)
  })
  it('아침 해는 동쪽, 남반구 정오 해는 북쪽', () => {
    const morning = sunPosition(solarDate(toMonth('2026-09'), 8, -100.2), 34.43, -100.2)
    expect(morning.azimuth > 60 && morning.azimuth < 120).toBe(true)
    const bundey = sunPosition(solarDate(toMonth('2026-06'), 12, 139.3), -33.89, 139.3)
    expect(bundey.azimuth < 15 || bundey.azimuth > 345).toBe(true)
  })
})

describe('하늘 목표 (skyTarget)', () => {
  const childress = { lat: 34.43, lng: -100.2 }
  const m = toMonth('2026-10')
  it('낮·노을·밤 프리셋의 밤 정도와 빛 방향', () => {
    const day = skyTarget('day', childress, m)
    expect(day.night).toBe(0)
    expect(day.dir[1]).toBeGreaterThan(Math.sin(29 * Math.PI / 180)) // 고도 30° 이상으로 보정 (읽기 쉬운 그림자)
    const dusk = skyTarget('dusk', childress, m)
    expect(dusk.golden).toBe(1)
    expect(dusk.dir[0]).toBeLessThan(0) // 저녁 해는 서쪽(−x)
    expect(skyTarget('night', childress, m).night).toBe(1)
  })
  it('지금(현지) 모드는 실제 시각의 태양 고도로 밤낮을 정함', () => {
    // 칠드레스 현지 자정 무렵 (06:00 UTC) → 밤, 현지 정오 무렵 (18:40 UTC) → 낮
    const night = skyTarget('live', childress, m, new Date(Date.UTC(2026, 9, 10, 6, 0)))
    const noon = skyTarget('live', childress, m, new Date(Date.UTC(2026, 9, 10, 18, 40)))
    expect(night.night).toBe(1)
    expect(noon.night).toBe(0)
    expect(noon.golden).toBe(0)
  })
  it('모든 방향 벡터는 단위 길이이고 위쪽(+y)을 향함', () => {
    for (const mode of ['day', 'dusk', 'night', 'live']) {
      const { dir } = skyTarget(mode, { lat: 55.33, lng: -123.1 }, toMonth('2026-12'), new Date(Date.UTC(2026, 11, 21, 20)))
      expect(Math.hypot(...dir)).toBeCloseTo(1, 5)
      expect(dir[1]).toBeGreaterThan(0)
    }
  })
})

describe('현지 시각 (localClock)', () => {
  it('시간대가 있으면 그 시간대 시각', () => {
    expect(localClock(new Date(Date.UTC(2026, 9, 10, 2, 5)), { tz: 'America/Chicago', lng: -100.2 })).toBe('21:05')
  })
  it('시간대가 없으면 경도로 계산한 태양시', () => {
    expect(localClock(new Date(Date.UTC(2026, 9, 10, 12, 0)), { lng: 15 })).toBe('13:00')
  })
})
