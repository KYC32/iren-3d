// 본사 3D 화면의 사무 빌딩 모양 (hqTower.js) — 층 쌓기 · IREN 층 · 카메라 상자
import { it, expect } from 'vitest'
import { hqTower, TOWER_W, TOWER_D, sideCorners, hqLabelRoom } from './hqTower.js'

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

// 카메라를 돌려도 배지(왼쪽)·말풍선(오른쪽)이 빌딩 화면 가장자리에 붙도록, 카메라 방향에서 본 양 끝 모서리
it('sideCorners: 기본 시점(+x,+z 쪽 카메라)이면 왼쪽 = (-x,+z) 모서리, 오른쪽 = (+x,-z) 모서리', () => {
  expect(sideCorners(30, 30)).toEqual({ left: [-TOWER_W / 2, TOWER_D / 2], right: [TOWER_W / 2, -TOWER_D / 2] })
})
it('sideCorners: 카메라가 반대쪽(-x,-z)으로 돌면 좌우가 바뀜', () => {
  expect(sideCorners(-30, -30)).toEqual({ left: [TOWER_W / 2, -TOWER_D / 2], right: [-TOWER_W / 2, TOWER_D / 2] })
})
it('sideCorners: 카메라가 (-x,+z) 쪽이면 왼쪽 = (-x,-z), 오른쪽 = (+x,+z)', () => {
  expect(sideCorners(-30, 30)).toEqual({ left: [-TOWER_W / 2, -TOWER_D / 2], right: [TOWER_W / 2, TOWER_D / 2] })
})

// 카메라가 빌딩을 맞출 때 비워 둘 화면 자리(px) — 옥상 위 CEO 카드(위), 그 옆 말풍선(오른쪽), 5층 표시(왼쪽) (hq.css 폭과 같은 값)
it('hqLabelRoom: 넓은 화면은 위 230 · 오른쪽 말풍선 320+40 · 왼쪽 5층 표시 200', () => {
  expect(hqLabelRoom(1440)).toEqual({ top: 230, right: 360, left: 200 })
  expect(hqLabelRoom(1024)).toEqual({ top: 230, right: 360, left: 200 })
})
it('hqLabelRoom: 태블릿은 말풍선을 좁게 (260+40), 휴대폰은 위 CEO 카드 자리만 (말풍선은 화면 아래에 붙임)', () => {
  expect(hqLabelRoom(900)).toEqual({ top: 220, right: 300, left: 180 })
  expect(hqLabelRoom(768)).toEqual({ top: 220, right: 300, left: 180 })
  expect(hqLabelRoom(767)).toEqual({ top: 190, right: 0, left: 0 })
})
