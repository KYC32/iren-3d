// 보드판 설정 검사 — 사이트 데이터가 바뀌어도 지도에서 사라지는 사이트가 없게
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BOARDS, K, boardPos, insideBoard, projectToBoard } from './boards.js'

const iren = JSON.parse(readFileSync(new URL('../../data/companies/iren.json', import.meta.url), 'utf8'))

describe('섬 보드', () => {
  it('모든 사이트가 어느 한 판 안에 (가장자리 여백 1단위 이상) 들어간다', () => {
    for (const s of iren.sites) {
      const p = projectToBoard(s.coord.lat, s.coord.lng)
      // 실패하면: 새 지역의 사이트 → boards.js 의 BOARDS 에 판을 추가하거나 범위를 넓히세요
      expect(p, `${s.id} 가 어느 판에도 없음`).not.toBeNull()
      expect(insideBoard(p.board, s.coord.lat, s.coord.lng, 1), `${s.id} 가 판 가장자리에 너무 붙음`).toBe(true)
    }
  })

  it('판끼리 서로 겹치지 않는다', () => {
    const rects = BOARDS.map((b) => {
      const [x, z] = boardPos(b.id)
      return { id: b.id, x0: x - b.w / 2, x1: x + b.w / 2, z0: z - b.d / 2, z1: z + b.d / 2 }
    })
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0
        expect(overlap, `${a.id} 와 ${b.id} 가 겹침`).toBe(false)
      }
    }
  })

  it('모든 판이 같은 축척: 위도 1° 차이는 어느 판에서나 K 단위', () => {
    for (const b of BOARDS) {
      const [lat, lng] = b.center
      const p0 = projectToBoard(lat, lng)
      const p1 = projectToBoard(lat + 1, lng)
      expect(p0.board.id).toBe(b.id)
      expect(Math.abs(p1.z - p0.z)).toBeCloseTo(K, 6)
    }
  })
})
