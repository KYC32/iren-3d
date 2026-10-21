import { describe, it, expect } from 'vitest'
import { isGzip, isGlb, fitScale, cumulative, pointAlong, flowDots, readJson } from './horizonHall.js'

describe('horizonHall — 파일 종류 알아보기', () => {
  it('gzip 과 GLB 머리글을 구분한다', () => {
    expect(isGzip(new Uint8Array([0x1f, 0x8b, 8, 0]))).toBe(true)
    expect(isGlb(new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0]))).toBe(true)   // 'glTF'
    expect(isGzip(new Uint8Array([0x67, 0x6c, 0x54, 0x46]))).toBe(false)
    expect(isGlb(new Uint8Array([0x1f, 0x8b]))).toBe(false)
    expect(isGzip(new Uint8Array([]))).toBe(false)
  })
})

describe('horizonHall — 블록에 맞추기', () => {
  it('60 × 90 m 부지는 4 × 6 블록에 1/15 로 들어간다', () => {
    expect(fitScale([60, 90], 4, 6)).toBeCloseTo(1 / 15)
  })
  it('비율이 다르면 작은 쪽 배율을 써서 블록 밖으로 나가지 않는다', () => {
    expect(fitScale([60, 90], 4, 3)).toBeCloseTo(3 / 90)
  })
})

describe('horizonHall — 꺾인 선 위의 점', () => {
  const L = [[0, 0, 0], [3, 0, 0], [3, 4, 0]]   // 3 m 간 뒤 꺾여 4 m → 전체 7 m
  const cum = cumulative(L)
  it('누적 길이를 잰다', () => {
    expect(cum).toEqual([0, 3, 7])
  })
  it('구간 안·꺾인 점·끝을 넘으면 처음으로', () => {
    expect(pointAlong(L, cum, 1.5)).toEqual([1.5, 0, 0])
    expect(pointAlong(L, cum, 3)).toEqual([3, 0, 0])
    expect(pointAlong(L, cum, 5)).toEqual([3, 2, 0])
    expect(pointAlong(L, cum, 8)).toEqual([1, 0, 0])     // 7 m 넘으면 한 바퀴 돌아 1 m
    expect(pointAlong(L, cum, -1)).toEqual([3, 3, 0])    // 음수는 끝에서 거꾸로
  })
  it('길이가 0 인 선은 첫 점에 머문다', () => {
    const P = [[1, 2, 3], [1, 2, 3]]
    expect(pointAlong(P, cumulative(P), 5)).toEqual([1, 2, 3])
  })
})

describe('horizonHall — 흐르는 점 배치', () => {
  it('길이에 비례해 점을 놓고, 짧은 선에도 최소 1개', () => {
    const dots = flowDots([[[0, 0, 0], [12, 0, 0]], [[0, 0, 0], [1, 0, 0]]], 6)
    expect(dots.filter((d) => d.line === 0).map((d) => d.offset)).toEqual([0, 6])
    expect(dots.filter((d) => d.line === 1)).toHaveLength(1)
  })
})

describe('horizonHall — 모형 안 JSON', () => {
  it('깨졌거나 없으면 기본값', () => {
    expect(readJson('[1,2]', [])).toEqual([1, 2])
    expect(readJson('{깨짐', [])).toEqual([])
    expect(readJson(undefined, null)).toBe(null)
  })
})
