// 다각형 기둥 모양(prism.js) — 본사·이웃 빌딩 벽(창문 그림 칸 단위 UV)과 지붕
import { it, expect } from 'vitest'
import { Vector3 } from 'three'
import { prismGeometry, flatGeometry } from './prism.js'
import { TILE_W, TILE_H } from './facade.js'

const sq = [[-2, -1], [2, -1], [2, 1], [-2, 1]] // 4 × 2 (반시계)

it('벽은 변마다 사각형 2삼각형, 지붕은 다각형 삼각형 — 그룹 0 = 벽, 1 = 지붕', () => {
  const g = prismGeometry(sq, 0, 3)
  expect(g.groups.map((x) => x.materialIndex)).toEqual([0, 1])
  expect(g.groups[0].count).toBe(4 * 6)
  expect(g.groups[1].count).toBe(2 * 3)
})
it('벽 바깥쪽 면이 바깥을 봄 (시계 방향 윤곽을 줘도)', () => {
  for (const ring of [sq, [...sq].reverse()]) {
    const g = prismGeometry(ring, 0, 3)
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal')
    for (let i = 0; i < g.groups[0].count; i++) {
      const p = new Vector3().fromBufferAttribute(pos, i), n = new Vector3().fromBufferAttribute(nor, i)
      expect(n.x * p.x + n.z * p.z).toBeGreaterThan(0) // 가운데(0,0)에서 바깥으로
    }
  }
})
it('지붕은 위를 봄', () => {
  const g = prismGeometry(sq, 0, 3)
  const nor = g.getAttribute('normal')
  for (let i = g.groups[1].start; i < g.groups[1].start + g.groups[1].count; i++) expect(nor.getY(i)).toBeCloseTo(1)
})
it('벽 UV 는 창문 그림 칸 단위 — 둘레를 따라 이어져 모서리에서 창문이 끊기지 않음', () => {
  const g = prismGeometry(sq, 0, TILE_H * 2)
  const uv = g.getAttribute('uv')
  const us = Array.from({ length: g.groups[0].count }, (_, i) => uv.getX(i))
  const vs = Array.from({ length: g.groups[0].count }, (_, i) => uv.getY(i))
  expect(Math.max(...us)).toBeCloseTo(12 / TILE_W) // 둘레 4+2+4+2 = 12
  expect(Math.max(...vs)).toBeCloseTo(2)
})
it('flatGeometry: 바닥 다각형 여러 개를 한 묶음으로 (위를 봄)', () => {
  const g = flatGeometry([sq, [[5, 5], [6, 5], [6, 6]]], 0.1)
  expect(g.getAttribute('position').count).toBe(2 * 3 + 3)
  expect(g.getAttribute('normal').getY(0)).toBeCloseTo(1)
})
