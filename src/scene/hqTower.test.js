// 본사 3D 화면의 사무 빌딩 모양 (hqTower.js) — 층 쌓기 · IREN 층 · 카메라 상자
import { describe, it, expect } from 'vitest'
import { hqTower, TOWER_W, TOWER_D, sideCorners, hqLabelRoom, PLOT, PODIUM_FLOORS } from './hqTower.js'

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
it('sideCorners: 거의 정면(−z 벽을 마주 봄)이면 얇게만 보이는 옆벽의 뒤 모서리 말고 정면 벽의 두 모서리', () => {
  // 카메라가 −z 쪽에서 조금 +x 로 비킴 → +x 벽은 실처럼 얇게 보임. 그 벽의 뒤 모서리(+x,+z)를 고르면 5층 표시가 띠보다 위에 뜸
  expect(sideCorners(6, -60)).toEqual({ left: [TOWER_W / 2, -TOWER_D / 2], right: [-TOWER_W / 2, -TOWER_D / 2] })
})
it('sideCorners: 바로 위에서 내려다봐도(카메라 x·z = 0) 모서리를 돌려줌', () => {
  const c = sideCorners(0, 0)
  expect(c.left).toHaveLength(2)
  expect(c.right).toHaveLength(2)
})

// 카메라가 빌딩을 맞출 때 비워 둘 화면 자리(px) — 옥상 위 CEO 카드(위), 그 옆 말풍선(오른쪽), 5층 표시(왼쪽) (hq.css 폭과 같은 값)
it('hqLabelRoom: 넓은 화면은 위 230 · 오른쪽 말풍선 320+40 · 왼쪽 5층 표시 200', () => {
  expect(hqLabelRoom(1440)).toEqual({ top: 230, right: 360, left: 200 })
  expect(hqLabelRoom(1024)).toEqual({ top: 230, right: 360, left: 200 })
})
it('hqLabelRoom: 태블릿은 말풍선을 좁게 (260+40), 휴대폰은 위 CEO 카드 자리만 (말풍선은 화면 아래에 붙임)', () => {
  expect(hqLabelRoom(900)).toEqual({ top: 220, right: 300, left: 180 })
  expect(hqLabelRoom(768)).toEqual({ top: 220, right: 300, left: 180 })
  // 휴대폰 CEO 카드는 가로 한 줄 (사진 | 이름 | 성적표, 옥상 위 약 83px) → 카메라 상자의 옥상 위 여유(2.5칸, 390×844 에서 약 110px)에
  //   거의 다 들어가서 위 자리는 조금만 (375×667 작은 휴대폰에서도 카드가 상단 바 밑에 들어오는 값 · 예전 세로 카드는 190)
  expect(hqLabelRoom(767)).toEqual({ top: 20, right: 0, left: 0 })
})

// 실제 윤곽(OSM)을 받으면: 탑 = 'City Centre' 조각 윤곽, 아래 3층 = 땅 윤곽 전체(포디움 · FK 2021 리모델링의 3층 높이 유리 로비)
describe('hqTower: 실제 윤곽', () => {
  const tower = [[-4, -3], [5, -3], [5, 2], [-4, 2]], podium = [[-5, -4], [6, -4], [6, 3], [-5, 3]]
  const R = hqTower({ floors: 20, level: 5 }, { tower, podium })
  it('탑 윤곽·포디움 윤곽을 그대로 씀 (없으면 정사각형)', () => {
    expect(R.ring).toEqual(tower)
    expect(R.podium.ring).toEqual(podium)
    expect(T.ring).toHaveLength(4) // 기본 모양 = TOWER_W × TOWER_D 정사각형
  })
  it('포디움은 아래 3층(G·1·2층) 높이', () => {
    expect(PODIUM_FLOORS).toBe(3)
    expect(R.podium.h).toBeCloseTo(R.floors[3].y)
  })
  it('카메라 상자는 탑 윤곽을 모두 담음 (둘레 2칸 여유)', () => {
    expect(R.box.x0).toBeLessThanOrEqual(-4 - 2); expect(R.box.x1).toBeGreaterThanOrEqual(5 + 2)
    expect(R.box.z0).toBeLessThanOrEqual(-3 - 2); expect(R.box.z1).toBeGreaterThanOrEqual(2 + 2)
  })
  it('sideCorners: 윤곽을 주면 그 윤곽의 꼭짓점 중에서 고름', () => {
    const c = sideCorners(30, 30, tower)
    expect(tower).toContainEqual(c.left)
    expect(tower).toContainEqual(c.right)
    expect(c.left).toEqual([-4, 2]) // (+x, +z) 쪽 카메라: 화면 왼쪽 = (−x, +z) 끝
  })
  it('바닥 판은 40칸(≈220m) — 북동쪽 약 120m 의 시드니 타워까지 담음', () => expect(PLOT).toBe(40))
})

// 본사 화면에 들어올 때 위에서 내려오는 카메라: 시작 자리 = 같은 방위, 더 높은 각도·더 먼 거리, 바라보는 점은 그대로
describe('hqStartPose', () => {
  const home = [-20, 25, 20, 0, 8, 0] // 카메라 x,y,z · 바라보는 점 x,y,z
  it('바라보는 점은 그대로, 방위(바닥 방향)는 같고 더 높고 멀리서 시작', async () => {
    const { hqStartPose } = await import('./hqTower.js')
    const s = hqStartPose(home)
    expect(s.slice(3)).toEqual(home.slice(3))
    const v = [s[0] - s[3], s[1] - s[4], s[2] - s[5]], h = [home[0] - home[3], home[1] - home[4], home[2] - home[5]]
    expect(Math.atan2(v[2], v[0])).toBeCloseTo(Math.atan2(h[2], h[0])) // 같은 방위
    expect(Math.hypot(...v)).toBeGreaterThan(Math.hypot(...h) * 1.4)   // 더 멀리
    const elev = (w) => Math.atan2(w[1], Math.hypot(w[0], w[2]))
    expect(elev(v)).toBeGreaterThan(elev(h) + 0.3)                     // 더 위에서 내려다봄
  })
})

// 로비 위 전광판이 붙는 벽: 포디움 윤곽 중 길 쪽(북 = Market St, 동 = Pitt St) 벽 — 보는 사람 기준 왼쪽→오른쪽으로 글자가 이어지게
describe('streetFaces', () => {
  it('직사각형 포디움: 동쪽 벽(북으로 진행) 다음 북쪽 벽(서로 진행), 글자 위치(u)가 모서리에서 이어짐', async () => {
    const { streetFaces } = await import('./hqTower.js')
    const f = streetFaces([[-5, -4], [6, -4], [6, 3], [-5, 3]]) // x 북 · z 동
    expect(f.map((x) => x.n)).toEqual([[0, 1], [1, 0]])
    expect(f[0].a).toEqual([-5, 3]); expect(f[0].b).toEqual([6, 3])   // 동쪽 벽: 남 → 북 (밖에서 보면 왼쪽 → 오른쪽)
    expect(f[1].a).toEqual([6, 3]); expect(f[1].b).toEqual([6, -4])   // 북쪽 벽: 동 → 서
    expect(f[0].u0).toBe(0); expect(f[1].u0).toBeCloseTo(11)
  })
  it('윤곽 방향(시계·반시계)과 시작점이 달라도 같은 결과', async () => {
    const { streetFaces } = await import('./hqTower.js')
    const a = streetFaces([[-5, -4], [6, -4], [6, 3], [-5, 3]])
    const b = streetFaces([[6, 3], [6, -4], [-5, -4], [-5, 3]])
    expect(b).toEqual(a)
  })
})
