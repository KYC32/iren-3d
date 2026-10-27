// 본사 3D 화면의 실제 동네 (hqCity.js) — OSM 자료(public/data/hq-city.json)를 화면 좌표로 옮긴 결과 검사
//   좌표: 본사 탑 가운데 = (0,0), x = 북쪽, z = 동쪽, 1칸 = 5.5m (처음 카메라는 남동쪽 위 — hqTower.HQ_VIEW)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { hqCityLayout, M_PER_UNIT, occludersOf, towerTargets } from './hqCity.js'
import { hqTower, hqDirection, PLOT, FLOOR_H } from './hqTower.js'
import { centroid, ringsOverlap, pointInRing, distToSegment } from './geom2d.js'

const file = JSON.parse(readFileSync(new URL('../../public/data/hq-city.json', import.meta.url), 'utf8'))
const L = hqCityLayout(file)
const HALF = PLOT / 2
const bbox = (ring) => ({ x0: Math.min(...ring.map((p) => p[0])), x1: Math.max(...ring.map((p) => p[0])), z0: Math.min(...ring.map((p) => p[1])), z1: Math.max(...ring.map((p) => p[1])) })
const P = bbox(L.hq.podium)
// 길 한 줄의 방향이 축과 이루는 각(도): 처음 점 → 끝 점
const angleTo = (line, axis) => {
  const [a, b] = [line[0], line.at(-1)], dx = b[0] - a[0], dz = b[1] - a[1]
  const deg = (Math.atan2(Math.abs(axis === 'x' ? dz : dx), Math.abs(axis === 'x' ? dx : dz)) * 180) / Math.PI
  return deg
}
const named = (name, kind) => L.roads.filter((r) => r.name === name && (!kind || r.kind === kind))
const STREET_OF = { 'Market St': 'Market Street', 'Pitt St': 'Pitt Street', 'Pitt St Mall': 'Pitt Street Mall', 'Castlereagh St': 'Castlereagh Street', 'George St': 'George Street' }

describe('좌표 (OSM 미터 → 화면 칸)', () => {
  it('본사 탑(OSM City Centre 조각) 가운데가 화면 원점', () => {
    const [x, z] = centroid(L.hq.tower)
    expect(Math.abs(x)).toBeLessThan(0.01)
    expect(Math.abs(z)).toBeLessThan(0.01)
  })
  it('1칸 = 5.5m: 본사 땅 윤곽은 남북 약 53m(9.6칸) · 동서 약 38m(6.9칸)', () => {
    expect(M_PER_UNIT).toBe(5.5)
    expect(P.x1 - P.x0).toBeCloseTo(53.6 / 5.5, 0)
    expect(P.z1 - P.z0).toBeCloseTo(38.3 / 5.5, 0)
  })
  it('Market St 는 본사 북쪽(+x)에서 동서(z 축)로 뻗은 차도 (본사 앞 긴 토막은 2° 안, 바닥 판 끝의 짧은 굽은 토막도 6° 안)', () => {
    const m = named('Market Street', 'car')
    expect(m.length).toBeGreaterThan(0)
    const len = (r) => Math.hypot(r.line.at(-1)[0] - r.line[0][0], r.line.at(-1)[1] - r.line[0][1])
    expect(angleTo([...m].sort((a, b) => len(b) - len(a))[0].line, 'z')).toBeLessThan(2)
    for (const r of m) {
      expect(angleTo(r.line, 'z')).toBeLessThan(6)
      expect(Math.min(...r.line.map((p) => p[0]))).toBeGreaterThan(P.x1) // 본사 땅보다 북쪽
    }
  })
  it('Pitt St 는 본사 동쪽(+z)에서 남북(x 축)으로 뻗은 차도', () => {
    const p = named('Pitt Street', 'car')
    expect(p.length).toBeGreaterThan(0)
    for (const r of p) {
      expect(angleTo(r.line, 'x')).toBeLessThan(4)
      expect(Math.min(...r.line.map((q) => q[1]))).toBeGreaterThan(P.z1) // 본사 땅보다 동쪽
    }
  })
  it('Pitt Street Mall 은 Market St 북쪽의 보행자 거리 (차도가 아님)', () => {
    const mall = named('Pitt Street Mall')
    expect(mall.length).toBeGreaterThan(0)
    for (const r of mall) expect(r.kind).toBe('walk')
    const marketX = Math.max(...named('Market Street', 'car').flatMap((r) => r.line.map((p) => p[0])))
    expect(Math.min(...mall.flatMap((r) => (r.line ?? r.ring).map((p) => p[0])))).toBeGreaterThan(marketX - 2)
  })
})

describe('건물', () => {
  it('본사 땅 윤곽·탑 조각은 이웃 건물 목록에 없고, 이웃 건물은 본사 땅과 겹치지 않음 (벽을 맞댈 뿐)', () => {
    for (const b of L.buildings) {
      expect(['w548828429', 'w387743066']).not.toContain(b.id)
      expect(ringsOverlap(b.ring, L.hq.podium, 0.15)).toBe(false)
    }
  })
  it('건물·길·나무·가로등은 모두 바닥 판 안 (밖으로 나간 부분은 잘림)', () => {
    const pts = [...L.buildings.flatMap((b) => b.ring), ...L.asphalt.flat(), ...L.paving.flat(), ...L.trees, ...L.lamps]
    for (const [x, z] of pts) {
      expect(Math.abs(x)).toBeLessThanOrEqual(HALF + 1e-6)
      expect(Math.abs(z)).toBeLessThanOrEqual(HALF + 1e-6)
    }
  })
  it('높이: 층수 태그 × 층 높이 · height 태그는 m ÷ 5.5 · min_height 는 바닥 높이', () => {
    const theatre = L.buildings.find((b) => b.name === 'State Theatre Building') // building:levels 12
    expect(theatre.y1 - theatre.y0).toBeCloseTo(12 * FLOOR_H)
    const turret = L.buildings.find((b) => b.name === 'Sydney Tower') // min_height 240 · height 270
    expect(turret.y0).toBeCloseTo(240 / 5.5)
    expect(turret.y1).toBeCloseTo(270 / 5.5)
  })
  it('태그가 없는 건물도 종류별 기본 높이로 서 있음 (0 높이 없음)', () => {
    for (const b of L.buildings) expect(b.y1 - b.y0).toBeGreaterThan(0.3)
  })
  it('조각(building:part)과 같은 자리의 윤곽을 두 번 세우지 않음 (같은 모양이 겹쳐 깜빡이지 않게)', () => {
    const grounded = L.buildings.filter((b) => b.y0 === 0)
    for (let i = 0; i < grounded.length; i++) for (let j = i + 1; j < grounded.length; j++) {
      const a = centroid(grounded[i].ring), c = centroid(grounded[j].ring)
      const same = Math.hypot(a[0] - c[0], a[1] - c[1]) < 0.05 && Math.abs(grounded[i].y1 - grounded[j].y1) < 0.05
      expect(same).toBe(false)
    }
  })
  it('시드니 타워: 본사 북동쪽 약 110~125m, 꼭대기 309m (OSM 조각 그대로)', () => {
    const t = L.landmarks.sydneyTower
    expect(t.x).toBeGreaterThan(0); expect(t.z).toBeGreaterThan(0)
    expect(Math.hypot(t.x, t.z) * M_PER_UNIT).toBeGreaterThan(100)
    expect(Math.hypot(t.x, t.z) * M_PER_UNIT).toBeLessThan(130)
    expect(t.top).toBeCloseTo(309 / 5.5)
  })
  it('건물 모양(창문 그림)이 여러 가지', () => {
    expect(new Set(L.buildings.map((b) => b.style)).size).toBeGreaterThanOrEqual(4)
  })
})

describe('길 · 가로수 · 차', () => {
  const cars = L.roads.filter((r) => r.kind === 'car')
  const walks = L.roads.filter((r) => r.kind === 'walk')
  const onRoad = (p, roads) => roads.some((r) => r.line && r.line.some((a, i) => i > 0 && distToSegment(p, r.line[i - 1], a) <= r.width / 2 + 1e-6))
  it('바닥 길 이름은 처음 카메라에서 보이는 자리 (카메라와 글자 사이에 건물이 없음)', () => {
    const d = hqDirection(), cam = [d[0] * 60, 8 + d[1] * 60, d[2] * 60]
    for (const g of L.ground) expect(occludersOf(cam, L.buildings, [{ p: [g.at[0], 0.13, g.at[1]], n: [d[0], 0, d[2]] }])).toEqual([])
    expect(L.ground.some((g) => g.text === 'Pitt St')).toBe(true)
  })
  it('가로수는 건물 안·차도 위가 아님', () => {
    expect(L.trees.length).toBeGreaterThan(5)
    for (const t of L.trees) {
      expect(L.buildings.some((b) => b.y0 === 0 && pointInRing(t, b.ring))).toBe(false)
      expect(pointInRing(t, L.hq.podium)).toBe(false)
      expect(onRoad(t, cars)).toBe(false)
    }
  })
  it('횡단보도는 OSM 의 횡단보도 선에서 나옴 (차도 위)', () => {
    expect(L.zebras.length).toBeGreaterThan(0)
  })
  it('바닥 길 이름은 교차로 밖, Pitt St 이름은 본사 앞(카메라 쪽) 14칸 안', () => {
    const d = hqDirection(), toCam = [d[0], d[2]]
    for (const g of L.ground) {
      const others = cars.filter((r) => STREET_OF[g.text] !== r.name)
      for (const r of others) for (let i = 1; i < r.line.length; i++) expect(distToSegment(g.at, r.line[i - 1], r.line[i])).toBeGreaterThan(r.width / 2 + 1)
    }
    const pitt = L.ground.find((g) => g.text === 'Pitt St')
    expect(Math.hypot(...pitt.at)).toBeLessThan(14)
    expect(pitt.at[0] * toCam[0] + pitt.at[1] * toCam[1]).toBeGreaterThan(0)
  })
  it('바닥에 쓴 길 이름은 처음 카메라(남동쪽 위)에서 왼쪽→오른쪽으로 읽힘', () => {
    const d = hqDirection(), right = [d[2], -d[0]] // 화면 오른쪽 (바닥 x·z)
    expect(L.ground.map((g) => g.text)).toEqual(expect.arrayContaining(['Market St', 'Pitt St', 'Pitt St Mall']))
    for (const g of L.ground) {
      const text = [Math.cos(g.ry), -Math.sin(g.ry)] // 글자 진행 방향 (HqCity.jsx GroundLabel 회전과 같은 식)
      expect(text[0] * right[0] + text[1] * right[1]).toBeGreaterThan(0)
    }
  })
})

// 돌려 볼 때 본사(특히 5층)를 가리는 이웃 건물은 흐리게 — 그 건물을 고르는 계산 (다각형 기둥과 선분)
describe('본사를 가리는 이웃 건물', () => {
  const T = hqTower({ floors: 20, level: 5 }, L.hq)
  const targets = towerTargets(T)
  const camAt = (dx, dz, dist = 60) => {
    const l = Math.hypot(dx, 1.05, dz), cy = (T.box.y0 + T.box.y1) / 2
    return [(dx / l) * dist, cy + (1.05 / l) * dist, (dz / l) * dist]
  }
  const prism = (x, z, s, y1) => ({ ring: [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]], y0: 0, y1 })
  it('카메라와 본사 사이의 높은 건물만 고름 (낮은 건물·옆으로 비킨 건물·뒤쪽 건물은 그대로)', () => {
    const tall = prism(9, 9, 1.5, 12), low = prism(9, 9, 1.5, 0.9), aside = prism(9, -12, 1.5, 12), behind = prism(-9, -9, 1.5, 30)
    expect(occludersOf(camAt(1, 1), [tall, low, aside, behind], targets)).toEqual([0])
  })
  it('과녁 점은 탑 벽 위, IREN 층 높이부터 옥상 아래까지', () => {
    const irenMid = 0.12 + T.iren.y + T.iren.h / 2
    expect(targets.length).toBeGreaterThan(8)
    for (const t of targets) {
      expect(t.p[1]).toBeGreaterThanOrEqual(irenMid - 1e-9)
      expect(t.p[1]).toBeLessThanOrEqual(0.12 + T.roof.y)
      const d = Math.min(...T.ring.map((a, i) => distToSegment([t.p[0], t.p[2]], a, T.ring[(i + 1) % T.ring.length])))
      expect(d).toBeLessThan(0.05)
    }
  })
  it('실제 동네에서도 계산이 돌아감 (고른 번호는 건물 목록 안)', () => {
    const hit = occludersOf(camAt(-1, -1), L.buildings, targets)
    for (const i of hit) expect(i).toBeLessThan(L.buildings.length)
  })
})
