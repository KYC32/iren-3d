import { it, expect } from 'vitest'
import { When } from './schema.js'
import { toMonth } from './timeline.js'

it.each(['2026-00', '2026-13', '2026-02-31', '2026-02-29', '1900-02-29', '2026-04-31', '2026-01-00', '2026-Q4-12'])(
  '데이터 검증과 월 계산 모두 잘못된 날짜 %s 거부', (value) => {
    expect(When.safeParse(value).success).toBe(false)
    expect(() => toMonth(value)).toThrow()
  },
)
it.each(['2024-02-29', '2000-02-29', '2026-01-31', '2026-Q4', '2026-H2', '2026'])(
  '유효한 날짜 %s 허용', (value) => {
    expect(When.safeParse(value).success).toBe(true)
    expect(() => toMonth(value)).not.toThrow()
  },
)
