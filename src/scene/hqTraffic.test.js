// 본사 3D 화면의 움직이는 차·사람 (hqTraffic.js) — 차로 나누기 · 교차로에서 이어지기 · 차는 차도에만 · 사람은 Pitt St Mall 에만
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { hqCityLayout } from './hqCity.js'
import { buildLanes, spawnCars, advanceCar, carPose, buildWalkPath, spawnWalkers, advanceWalker, walkerPose } from './hqTraffic.js'
import { distToSegment } from './geom2d.js'

const L = hqCityLayout(JSON.parse(readFileSync(new URL('../../public/data/hq-city.json', import.meta.url), 'utf8')))
const lanes = buildLanes(L.roads)
const carRoads = L.roads.filter((r) => r.kind === 'car' && r.line)
const near = (p, roads, pad = 0) => roads.some((r) => r.line.some((a, i) => i > 0 && distToSegment(p, r.line[i - 1], a) <= r.width / 2 + pad))

describe('차로', () => {
  it('Market St(일방 3차로)는 차로 3개, OSM 선 방향(서쪽 = −z)으로', () => {
    const m = lanes.filter((l) => l.road === 'w36328670')
    expect(m).toHaveLength(3)
    for (const l of m) expect(l.pts.at(-1)[1]).toBeLessThan(l.pts[0][1])
  })
  it('폭 1칸(5.5m)이 안 되는 골목은 차로를 만들지 않음', () => {
    for (const l of lanes) expect(carRoads.find((r) => r.id === l.road).width).toBeGreaterThanOrEqual(1)
  })
  it('차로는 차도에서만 나옴 — 보행자 거리(Pitt St Mall)에는 차로가 없음', () => {
    for (const l of lanes) expect(carRoads.map((r) => r.id)).toContain(l.road)
    expect(lanes.some((l) => L.roads.find((r) => r.id === l.road)?.name === 'Pitt Street Mall')).toBe(false)
  })
  it('차로는 모두 차도 폭 안', () => {
    for (const l of lanes) for (const p of l.pts) expect(near(p, carRoads, 0.05)).toBe(true)
  })
  it('Pitt St(북쪽으로 일방) 끝은 교차로에서 Market St 차로로 이어짐 (왼쪽으로 꺾음)', () => {
    const pitt = lanes.filter((l) => l.road === 'w168248903')
    expect(pitt.length).toBeGreaterThan(0)
    for (const l of pitt) {
      expect(l.next).not.toBeNull()
      expect(['w36328670', 'w245021283']).toContain(lanes[l.next.lane].road)
    }
  })
})

describe('차', () => {
  const cars = spawnCars(lanes)
  it('차 여러 대가 차로에 흩어져 섬 (같은 차로에선 서로 떨어짐)', () => {
    expect(cars.length).toBeGreaterThanOrEqual(6)
    for (const a of cars) for (const b of cars) if (a !== b && a.lane === b.lane) expect(Math.abs(a.s - b.s)).toBeGreaterThan(2)
  })
  it('30초 동안 움직여도 늘 차도 위 (보행자 거리 위로 가지 않음) · 자리는 매끄럽게 이어짐', () => {
    const sim = spawnCars(lanes)
    let prev = sim.map((c) => carPose(lanes, c))
    for (let t = 0; t < 30; t += 0.1) {
      for (const c of sim) advanceCar(c, 0.1, lanes)
      const now = sim.map((c) => carPose(lanes, c))
      now.forEach((p, i) => {
        if (p.scale > 0.05) expect(near([p.x, p.z], carRoads, 0.05)).toBe(true)
        // 한 걸음(0.1초)에 1칸 넘게 뛰면 끊김 — 차로 처음으로 되돌아가는 경우(크기 0 근처)만 예외
        if (p.scale > 0.3 && prev[i].scale > 0.3) expect(Math.hypot(p.x - prev[i].x, p.z - prev[i].z)).toBeLessThan(1)
      })
      prev = now
    }
  })
  it('바닥 판 가장자리에서 생기고 사라질 땐 크기를 줄였다 키움 (갑자기 나타나지 않게)', () => {
    const l = lanes.find((x) => !x.next)
    const pose = (s) => carPose(lanes, { lane: lanes.indexOf(l), s, speed: 2 })
    expect(pose(l.len - 0.1).scale).toBeLessThan(0.3)
    expect(pose(l.len / 2).scale).toBe(1)
  })
  it('같은 자료면 늘 같은 배치 (새로 고쳐도 같은 자리에서 시작)', () => {
    expect(spawnCars(lanes)).toEqual(spawnCars(lanes))
  })
})

describe('사람 (Pitt St Mall)', () => {
  const path = buildWalkPath(L.roads)
  it('보행자 거리 선을 따라 길이가 있음', () => {
    expect(path).not.toBeNull()
    expect(path.len).toBeGreaterThan(5)
  })
  it('60초 동안 걸어도 보행자 거리 안, 끝에 닿으면 돌아섬', () => {
    const ws = spawnWalkers(path)
    expect(ws.length).toBeGreaterThanOrEqual(8)
    const mall = L.roads.filter((r) => r.name === 'Pitt Street Mall' && r.line)
    let turned = false
    for (let t = 0; t < 60; t += 0.2) {
      for (const w of ws) { const d0 = w.dir; advanceWalker(w, 0.2, path); if (w.dir !== d0) turned = true }
      for (const w of ws) { const p = walkerPose(path, w); expect(near([p.x, p.z], mall, 0.02)).toBe(true) }
    }
    expect(turned).toBe(true)
  })
})
