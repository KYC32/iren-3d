import { describe, it, expect } from 'vitest'
import { advancePlayback } from './playback.js'

describe('재생 시간', () => {
  it('늦은 프레임에서는 지난 모든 달을 진행하고 잔여 시간을 보존', () => {
    expect(advancePlayback(100, 650, 200, 200)).toEqual({ month: 103, remainder: 50, finished: false })
  })
  it('한 달보다 짧은 프레임은 현재 월 유지', () => {
    expect(advancePlayback(100, 199, 200, 200).month).toBe(100)
  })
  it('마지막 달에 도착한 프레임에서 바로 종료', () => {
    expect(advancePlayback(199, 200, 200, 200)).toEqual({ month: 200, remainder: 0, finished: true })
  })
  it('장시간 멈춘 탭도 마지막 달을 넘기지 않음', () => {
    expect(advancePlayback(100, 600000, 200, 200).month).toBe(200)
  })
})
