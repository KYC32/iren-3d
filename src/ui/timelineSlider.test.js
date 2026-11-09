// 월 입력칸의 "완성된 값" 판정 — month 입력을 지원하지 않는 브라우저(글자 칸)에서
// 쓰는 도중의 값으로 날짜가 튀지 않게 하는 기준
import { beforeAll, afterAll, it, expect, vi } from 'vitest'

let isCompleteMonth
beforeAll(async () => {
  // 스토어가 불러올 때 window 를 읽으므로 최소한만 흉내
  vi.stubGlobal('window', { innerWidth: 1280, location: { hash: '', pathname: '/', search: '' }, history: { replaceState: vi.fn() } })
  vi.stubGlobal('navigator', { language: 'ko' })
  isCompleteMonth = (await import('./TimelineSlider.jsx')).isCompleteMonth
})
afterAll(() => vi.unstubAllGlobals())

it.each(['2025-01', '2028-12'])('완성된 YYYY-MM 은 통과: %s', (v) => expect(isCompleteMonth(v)).toBe(true))
it.each(['2025', '2025-', '2025-0', '2025-13', '2025-00', '25-01', ''])('쓰는 도중이거나 틀린 값은 거름: "%s"', (v) => expect(isCompleteMonth(v)).toBe(false))
