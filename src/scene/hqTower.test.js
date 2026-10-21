// 본사 3D 화면의 사무 빌딩 모양 (hqTower.js) — 층 쌓기 · IREN 층 · 카메라 상자
import { it, expect } from 'vitest'
import { hqTower, TOWER_W } from './hqTower.js'

const T = hqTower({ floors: 20, level: 5 })

it('층판 20개 (지상층 G + Level 1~19), 아래부터 차례로 쌓임', () => {
  expect(T.floors).toHaveLength(20)
  expect(T.floors.map((f) => f.level)).toEqual([...Array(20).keys()])
  for (let i = 1; i < 20; i++) expect(T.floors[i].y).toBeCloseTo(T.floors[i - 1].y + T.floors[i - 1].h)
})
it('IREN 층은 Level 5 하나뿐', () => {
  expect(T.floors.filter((f) => f.iren).map((f) => f.level)).toEqual([5])
  expect(T.iren.level).toBe(5)
})
it('지상층(로비)은 다른 층보다 높음', () => expect(T.floors[0].h).toBeGreaterThan(T.floors[1].h))
it('건물 높이는 층 높이 합 + 옥상 기계실, 폭보다 2배 넘게 높음 (실제 ~33m 폭 · 20층)', () => {
  expect(T.height).toBeGreaterThan(T.floors.at(-1).y + T.floors.at(-1).h)
  expect(T.height / TOWER_W).toBeGreaterThan(2)
})
it('카메라 상자는 건물을 모두 담음', () => {
  expect(T.box.y0).toBe(0); expect(T.box.y1).toBeGreaterThanOrEqual(T.height)
  expect(T.box.x0).toBeLessThan(-TOWER_W / 2); expect(T.box.x1).toBeGreaterThan(TOWER_W / 2)
})
it('쓰는 층이 건물 밖이면 IREN 층 없음 (자료 오류여도 그림은 그려짐)', () => {
  expect(hqTower({ floors: 3, level: 9 }).iren).toBeNull()
})
