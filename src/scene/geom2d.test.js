// 평면 도형 계산(geom2d.js) — 본사 동네(OSM 윤곽)를 화면에 놓을 때 쓰는 넓이·가운데·자르기·겹침
import { it, expect } from 'vitest'
import { signedArea, centroid, pointInRing, clipRingToRect, clipLineToRect, segmentQuad, ringsOverlap, distToSegment, segmentHitsRing } from './geom2d.js'

const SQ = [[0, 0], [4, 0], [4, 2], [0, 2]] // 4 × 2 직사각형 (x 오른쪽, z 위로 보면 반시계)

it('signedArea: 반시계는 +, 시계는 −, 크기는 넓이', () => {
  expect(signedArea(SQ)).toBeCloseTo(8)
  expect(signedArea([...SQ].reverse())).toBeCloseTo(-8)
})
it('centroid: 넓이 가운데 (꼭짓점 평균이 아님 — 한쪽에 점이 몰려도 치우치지 않음)', () => {
  expect(centroid(SQ)).toEqual([2, 1])
  const dense = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 2], [0, 2]] // 아래 변에 점이 몰림
  const [x, z] = centroid(dense)
  expect(x).toBeCloseTo(2); expect(z).toBeCloseTo(1)
})
it('pointInRing: 안 · 밖', () => {
  expect(pointInRing([1, 1], SQ)).toBe(true)
  expect(pointInRing([5, 1], SQ)).toBe(false)
})
it('clipRingToRect: 사각형 밖으로 나간 부분을 잘라 냄 (넓이로 확인)', () => {
  const cut = clipRingToRect(SQ, -10, 3, -10, 10) // x ≤ 3 만 남김
  expect(Math.abs(signedArea(cut))).toBeCloseTo(6)
  expect(clipRingToRect(SQ, 10, 20, 10, 20)).toEqual([]) // 다 밖이면 빈 목록
})
it('clipLineToRect: 선이 사각형을 지나는 부분만, 나갔다 들어오면 두 조각', () => {
  const runs = clipLineToRect([[-5, 0], [5, 0]], { x0: -1, x1: 1, z0: -1, z1: 1 })
  expect(runs).toHaveLength(1)
  expect(runs[0][0][0]).toBeCloseTo(-1); expect(runs[0].at(-1)[0]).toBeCloseTo(1)
  const zig = clipLineToRect([[-0.5, 0], [-0.5, 5], [0.5, 5], [0.5, 0]], { x0: -1, x1: 1, z0: -1, z1: 1 })
  expect(zig).toHaveLength(2)
})
it('segmentQuad: 선분 둘레 폭 w 의 직사각형 (넓이 = 길이 × 폭)', () => {
  expect(Math.abs(signedArea(segmentQuad([0, 0], [3, 0], 2)))).toBeCloseTo(6)
})
it('ringsOverlap: 겹치면 참, 벽 하나를 같이 쓰며 맞닿기만 하면 거짓 (여유 tol)', () => {
  expect(ringsOverlap(SQ, [[3, 1], [6, 1], [6, 3], [3, 3]], 0.05)).toBe(true)
  expect(ringsOverlap(SQ, [[4, 0], [6, 0], [6, 2], [4, 2]], 0.05)).toBe(false) // x = 4 에서 맞닿음
  expect(ringsOverlap(SQ, [[1, 0.5], [2, 0.5], [2, 1.5], [1, 1.5]], 0.05)).toBe(true) // 안에 쏙 들어감
})
it('distToSegment: 점에서 선분까지 가장 가까운 거리', () => {
  expect(distToSegment([0, 3], [-1, 0], [1, 0])).toBeCloseTo(3)
  expect(distToSegment([4, 0], [-1, 0], [1, 0])).toBeCloseTo(3)
})
it('segmentHitsRing: 선분이 다각형을 지나거나 끝점이 안에 있으면 참', () => {
  expect(segmentHitsRing([-1, 1], [5, 1], SQ)).toBe(true)
  expect(segmentHitsRing([1, 1], [1.5, 1.5], SQ)).toBe(true) // 통째로 안
  expect(segmentHitsRing([-1, 3], [5, 3], SQ)).toBe(false)
})

it('inflateRing: 윤곽을 바깥으로 d 만큼 부풀림 (정사각형 4×4 → 6×6), 방향(시계·반시계)과 상관없이 바깥으로', async () => {
  const { inflateRing } = await import('./geom2d.js')
  const sq = [[-2, -2], [2, -2], [2, 2], [-2, 2]]
  expect(Math.abs(signedArea(inflateRing(sq, 1)))).toBeCloseTo(36)
  expect(Math.abs(signedArea(inflateRing([...sq].reverse(), 1)))).toBeCloseTo(36)
})
it('cleanRing: 겹친 점·한 줄 위의 점을 빼서 벽을 깨끗하게', async () => {
  const { cleanRing } = await import('./geom2d.js')
  expect(cleanRing([[0, 0], [0, 0], [1, 0], [2, 0], [2, 2], [0, 2]])).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]])
})
